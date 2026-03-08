import { Router } from 'express'
import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import { authAdmin, invalidarCachePermisos } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// MIS PERMISOS (para el usuario autenticado)
// =============================================================================

// GET /api/admin/mis-permisos - Obtener permisos del usuario actual
router.get('/mis-permisos', asyncHandler(async (req, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.id },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      rol: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          esSuperAdmin: true,
          permisos: {
            include: { permiso: true }
          },
          cajas: {
            include: { caja: { select: { id: true, codigo: true, nombre: true } } }
          }
        }
      }
    }
  })

  if (!admin) {
    throw new AppError('Usuario no encontrado', 404)
  }

  let permisos = []
  let cajasPermitidas = []
  let esSuperAdmin = false

  if (admin.rol) {
    esSuperAdmin = admin.rol.esSuperAdmin
    if (esSuperAdmin) {
      // Super admin tiene todos los permisos y todas las cajas
      permisos = ['*']
      cajasPermitidas = ['*']
    } else {
      permisos = admin.rol.permisos.map(pr => pr.permiso.codigo)
      cajasPermitidas = admin.rol.cajas.map(cr => cr.caja.id)
    }
  }

  res.json({
    success: true,
    data: {
      usuario: {
        id: admin.id,
        nombre: admin.nombre,
        apellido: admin.apellido,
        email: admin.email
      },
      rol: admin.rol ? {
        id: admin.rol.id,
        codigo: admin.rol.codigo,
        nombre: admin.rol.nombre
      } : null,
      esSuperAdmin,
      permisos,
      cajasPermitidas
    }
  })
}))

// =============================================================================
// ROLES
// =============================================================================

// GET /api/admin/roles - Listar roles
router.get('/roles', asyncHandler(async (req, res) => {
  const { activo } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'

  const roles = await prisma.rol.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: {
      _count: { select: { admins: true, permisos: true } }
    }
  })

  res.json({ success: true, data: roles })
}))

// GET /api/admin/roles/:id - Detalle de rol
router.get('/roles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const rol = await prisma.rol.findUnique({
    where: { id: parseInt(id) },
    include: {
      permisos: {
        include: { permiso: true }
      },
      admins: {
        select: { id: true, nombre: true, apellido: true, email: true }
      }
    }
  })

  if (!rol) {
    throw new AppError('Rol no encontrado', 404)
  }

  res.json({ success: true, data: rol })
}))

// POST /api/admin/roles - Crear rol
router.post('/roles', asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, esSuperAdmin, permisos } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400)
  }

  const existente = await prisma.rol.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un rol con ese codigo', 400)
  }

  const rol = await prisma.rol.create({
    data: {
      codigo,
      nombre,
      descripcion,
      esSuperAdmin: esSuperAdmin || false,
      permisos: permisos?.length ? {
        create: permisos.map(permisoId => ({
          permisoId: parseInt(permisoId)
        }))
      } : undefined
    },
    include: {
      permisos: { include: { permiso: true } }
    }
  })

  res.status(201).json({ success: true, data: rol })
}))

// PUT /api/admin/roles/:id - Actualizar rol
router.put('/roles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, esSuperAdmin, activo, permisos } = req.body

  const existente = await prisma.rol.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Rol no encontrado', 404)
  }

  // No permitir desactivar rol SUPERADMIN
  if (existente.codigo === 'SUPERADMIN' && activo === false) {
    throw new AppError('No se puede desactivar el rol SUPERADMIN', 400)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.rol.findUnique({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un rol con ese codigo', 400)
    }
  }

  // Actualizar rol y permisos
  const rol = await prisma.$transaction(async (tx) => {
    // Actualizar permisos si se proporcionan
    if (permisos !== undefined) {
      // Eliminar permisos actuales
      await tx.permisoRol.deleteMany({ where: { rolId: parseInt(id) } })
      // Crear nuevos permisos
      if (permisos.length > 0) {
        await tx.permisoRol.createMany({
          data: permisos.map(permisoId => ({
            rolId: parseInt(id),
            permisoId: parseInt(permisoId)
          }))
        })
      }
    }

    return await tx.rol.update({
      where: { id: parseInt(id) },
      data: {
        codigo: codigo || existente.codigo,
        nombre: nombre || existente.nombre,
        descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
        esSuperAdmin: esSuperAdmin !== undefined ? esSuperAdmin : existente.esSuperAdmin,
        activo: activo !== undefined ? activo : existente.activo
      },
      include: {
        permisos: { include: { permiso: true } }
      }
    })
  })

  // Invalidar cache de permisos
  invalidarCachePermisos()

  res.json({ success: true, data: rol })
}))

// =============================================================================
// PERMISOS
// =============================================================================

// GET /api/admin/permisos - Listar todos los permisos disponibles
router.get('/permisos', asyncHandler(async (req, res) => {
  const permisos = await prisma.permiso.findMany({
    orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }]
  })

  // Agrupar por modulo
  const agrupados = permisos.reduce((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = []
    acc[p.modulo].push(p)
    return acc
  }, {})

  res.json({ success: true, data: permisos, agrupados })
}))

// =============================================================================
// CAJAS POR ROL
// =============================================================================

// GET /api/admin/roles/:id/cajas - Obtener cajas asignadas a un rol
router.get('/roles/:id/cajas', asyncHandler(async (req, res) => {
  const { id } = req.params

  const rol = await prisma.rol.findUnique({
    where: { id: parseInt(id) },
    include: {
      cajas: {
        include: {
          caja: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              tipo: true,
              activo: true,
              paraBuffet: true,
              paraCaja: true,
              paraKiosco: true,
              paraTakeaway: true,
              puntoVentaAfip: true
            }
          }
        }
      }
    }
  })

  if (!rol) {
    throw new AppError('Rol no encontrado', 404)
  }

  const cajas = rol.cajas.map(cr => cr.caja)
  res.json({ success: true, data: cajas })
}))

// PUT /api/admin/roles/:id/cajas - Actualizar cajas asignadas a un rol
router.put('/roles/:id/cajas', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { cajaIds } = req.body // Array de IDs de cajas

  const rol = await prisma.rol.findUnique({ where: { id: parseInt(id) } })
  if (!rol) {
    throw new AppError('Rol no encontrado', 404)
  }

  // No permitir modificar cajas del rol SUPERADMIN (tiene acceso a todas)
  if (rol.esSuperAdmin) {
    throw new AppError('El rol Super Admin tiene acceso a todas las cajas', 400)
  }

  await prisma.$transaction(async (tx) => {
    // Eliminar asignaciones actuales
    await tx.cajaRol.deleteMany({ where: { rolId: parseInt(id) } })

    // Crear nuevas asignaciones
    if (cajaIds && cajaIds.length > 0) {
      await tx.cajaRol.createMany({
        data: cajaIds.map(cajaId => ({
          rolId: parseInt(id),
          cajaId: parseInt(cajaId)
        }))
      })
    }
  })

  // Obtener cajas actualizadas
  const cajasActualizadas = await prisma.cajaRol.findMany({
    where: { rolId: parseInt(id) },
    include: {
      caja: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          tipo: true,
          activo: true,
          puntoVentaAfip: true
        }
      }
    }
  })

  // Invalidar cache de permisos
  invalidarCachePermisos()

  res.json({
    success: true,
    data: cajasActualizadas.map(cr => cr.caja),
    message: `Se asignaron ${cajaIds?.length || 0} cajas al rol`
  })
}))

// GET /api/admin/cajas-disponibles - Obtener todas las cajas disponibles para asignar
router.get('/cajas-disponibles', asyncHandler(async (req, res) => {
  const cajas = await prisma.caja.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      tipo: true,
      paraBuffet: true,
      paraCaja: true,
      paraKiosco: true,
      paraTakeaway: true,
      puntoVentaAfip: true
    },
    orderBy: { nombre: 'asc' }
  })

  res.json({ success: true, data: cajas })
}))

// =============================================================================
// USUARIOS (ADMINS)
// =============================================================================

// GET /api/admin/usuarios - Listar usuarios
router.get('/usuarios', asyncHandler(async (req, res) => {
  const { activo, rolId } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (rolId) where.rolId = parseInt(rolId)

  const usuarios = await prisma.admin.findMany({
    where,
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      telefono: true,
      activo: true,
      createdAt: true,
      lastLogin: true,
      rol: { select: { id: true, codigo: true, nombre: true, esSuperAdmin: true } }
    }
  })

  res.json({ success: true, data: usuarios })
}))

// GET /api/admin/usuarios/:id - Detalle de usuario
router.get('/usuarios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const usuario = await prisma.admin.findUnique({
    where: { id: parseInt(id) },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      telefono: true,
      activo: true,
      createdAt: true,
      lastLogin: true,
      rol: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          esSuperAdmin: true,
          permisos: { include: { permiso: true } }
        }
      }
    }
  })

  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404)
  }

  res.json({ success: true, data: usuario })
}))

// POST /api/admin/usuarios - Crear usuario
router.post('/usuarios', asyncHandler(async (req, res) => {
  const { email, password, nombre, apellido, telefono, rolId } = req.body

  if (!email || !password || !nombre) {
    throw new AppError('Email, password y nombre son requeridos', 400)
  }

  const existente = await prisma.admin.findUnique({ where: { email } })
  if (existente) {
    throw new AppError('Ya existe un usuario con ese email', 400)
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const usuario = await prisma.admin.create({
    data: {
      email,
      passwordHash,
      nombre,
      apellido,
      telefono,
      rolId: rolId ? parseInt(rolId) : null
    },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      telefono: true,
      activo: true,
      createdAt: true,
      rol: { select: { id: true, codigo: true, nombre: true, esSuperAdmin: true } }
    }
  })

  res.status(201).json({ success: true, data: usuario })
}))

// PUT /api/admin/usuarios/:id - Actualizar usuario
router.put('/usuarios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { email, password, nombre, apellido, telefono, rolId, activo } = req.body

  const existente = await prisma.admin.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Usuario no encontrado', 404)
  }

  // Verificar email unico si cambio
  if (email && email !== existente.email) {
    const duplicado = await prisma.admin.findUnique({ where: { email } })
    if (duplicado) {
      throw new AppError('Ya existe un usuario con ese email', 400)
    }
  }

  const data = {
    email: email || existente.email,
    nombre: nombre || existente.nombre,
    apellido: apellido !== undefined ? apellido : existente.apellido,
    telefono: telefono !== undefined ? telefono : existente.telefono,
    rolId: rolId !== undefined ? (rolId ? parseInt(rolId) : null) : existente.rolId,
    activo: activo !== undefined ? activo : existente.activo
  }

  // Solo actualizar password si se proporciona
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10)
  }

  const usuario = await prisma.admin.update({
    where: { id: parseInt(id) },
    data,
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      telefono: true,
      activo: true,
      createdAt: true,
      lastLogin: true,
      rol: { select: { id: true, codigo: true, nombre: true, esSuperAdmin: true } }
    }
  })

  res.json({ success: true, data: usuario })
}))

// POST /api/admin/usuarios/:id/cambiar-password - Cambiar password de usuario
// Si es el propio usuario, requiere passwordActual
// Si es un admin cambiando la password de otro, solo requiere password
router.post('/usuarios/:id/cambiar-password', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { password, passwordActual, passwordNueva } = req.body
  const usuarioActualId = req.admin?.id

  // Determinar si es cambio propio o por admin
  const esPropio = usuarioActualId === parseInt(id)

  // Si es cambio propio, usar passwordNueva y verificar passwordActual
  const nuevaPassword = esPropio ? passwordNueva : password

  if (!nuevaPassword || nuevaPassword.length < 6) {
    throw new AppError('La password debe tener al menos 6 caracteres', 400)
  }

  const existente = await prisma.admin.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Usuario no encontrado', 404)
  }

  // Si es cambio propio, verificar la password actual
  if (esPropio) {
    if (!passwordActual) {
      throw new AppError('Debe ingresar la contraseña actual', 400)
    }
    const passwordValida = await bcrypt.compare(passwordActual, existente.passwordHash)
    if (!passwordValida) {
      throw new AppError('La contraseña actual es incorrecta', 400)
    }
  }

  const passwordHash = await bcrypt.hash(nuevaPassword, 10)
  await prisma.admin.update({
    where: { id: parseInt(id) },
    data: { passwordHash }
  })

  res.json({ success: true, message: 'Password actualizada correctamente' })
}))

export default router
