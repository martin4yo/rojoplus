import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// Cache temporal para uploads
const uploadCache = new Map()

// --- CARGOS DE PERSONAL ---

// GET /api/admin/cargos-personal - Listado de cargos
router.get('/cargos-personal', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const cargos = await req.db.cargoPersonal.findMany({
    where,
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      _count: { select: { entidades: true } }
    }
  })

  res.json({ success: true, data: cargos })
}))

// GET /api/admin/cargos-personal/:id - Detalle de cargo
router.get('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const cargo = await req.db.cargoPersonal.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      entidades: {
        where: { activo: true },
        select: { id: true, codigo: true, razonSocial: true }
      }
    }
  })

  if (!cargo) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  res.json({ success: true, data: cargo })
}))

// POST /api/admin/cargos-personal - Crear cargo
router.post('/cargos-personal', authAdmin, asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, orden } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400, 'VALIDATION_ERROR')
  }

  const existente = await req.db.cargoPersonal.findUnique({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un cargo con ese codigo', 400, 'DUPLICATE')
  }

  const cargo = await req.db.cargoPersonal.create({
    data: {
      codigo: codigo.toUpperCase(),
      nombre,
      descripcion,
      orden: orden || 0,
    }
  })

  res.status(201).json({ success: true, data: cargo })
}))

// PUT /api/admin/cargos-personal/:id - Actualizar cargo
router.put('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, orden, activo } = req.body

  const existente = await req.db.cargoPersonal.findUnique({ where: { id: parseInt(id) } })
  if (!existente) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const otro = await req.db.cargoPersonal.findUnique({ where: { codigo } })
    if (otro) throw new AppError('Ya existe un cargo con ese codigo', 400, 'DUPLICATE')
  }

  const cargo = await req.db.cargoPersonal.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo ? codigo.toUpperCase() : existente.codigo,
      nombre: nombre ?? existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo,
    }
  })

  res.json({ success: true, data: cargo })
}))

// DELETE /api/admin/cargos-personal/:id - Eliminar cargo
router.delete('/cargos-personal/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const cargo = await req.db.cargoPersonal.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { entidades: true } } }
  })

  if (!cargo) throw new AppError('Cargo no encontrado', 404, 'NOT_FOUND')

  if (cargo._count.entidades > 0) {
    throw new AppError(`No se puede eliminar, tiene ${cargo._count.entidades} empleado(s) asignado(s)`, 400, 'HAS_RELATIONS')
  }

  await req.db.cargoPersonal.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Cargo eliminado' } })
}))

// --- ENTRENADORES ---

// GET /api/admin/entrenadores - Listado de entrenadores
router.get('/entrenadores', authAdmin, asyncHandler(async (req, res) => {
  const { activo } = req.query
  const where = activo !== undefined ? { activo: activo === 'true' } : {}

  const entrenadores = await req.db.entrenador.findMany({
    where,
    include: {
      entidad: true,
      categorias: {
        where: { activo: true },
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, nombre: true } } }
          }
        }
      }
    },
    orderBy: { nombre: 'asc' },
  })

  res.json({
    success: true,
    data: entrenadores.map(e => ({
      ...e,
      categoriasActivas: e.categorias.length,
    })),
  })
}))

// GET /api/admin/entrenadores/:id - Detalle de entrenador
router.get('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const entrenador = await req.db.entrenador.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      entidad: {
        include: {
          cargoPersonal: true
        }
      },
      categorias: {
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, codigo: true, nombre: true } } }
          }
        },
        orderBy: { fechaDesde: 'desc' }
      }
    },
  })

  if (!entrenador) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  res.json({ success: true, data: entrenador })
}))

// Helper: Generar codigo unico para Entidad PERSONAL
async function generarCodigoEntidadPersonal(prisma) {
  const prefijo = 'PERS-'
  const ultima = await prisma.entidad.findFirst({
    where: { codigo: { startsWith: prefijo } },
    orderBy: { codigo: 'desc' }
  })

  let siguiente = 1
  if (ultima) {
    const numActual = parseInt(ultima.codigo.replace(prefijo, ''))
    if (!isNaN(numActual)) siguiente = numActual + 1
  }

  return `${prefijo}${String(siguiente).padStart(4, '0')}`
}

// POST /api/admin/entrenadores - Crear entrenador
router.post('/entrenadores', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre, apellido, documento, telefono, email, socioId, especialidad, observaciones,
    // Campos adicionales para Entidad PERSONAL
    tipoDocumento, direccion, ciudad, provincia, codigoPostal, banco, cbu, alias,
    legajo, cargoPersonalId, fechaIngreso, sueldoBasico,
    // Campos de Staff Público
    mostrarEnWeb, fotoStaff, biografiaStaff, emailPublico, telefonoPublico, ordenStaff
  } = req.body

  if (!nombre) {
    throw new AppError('El nombre es requerido', 400, 'VALIDATION_ERROR')
  }

  // Crear en transaccion: Entidad PERSONAL + Entrenador
  const entrenador = await req.prisma.$transaction(async (tx) => {
    // 1. Crear Entidad tipo PERSONAL
    const codigoEntidad = await generarCodigoEntidadPersonal(tx)
    const razonSocial = apellido ? `${apellido}, ${nombre}` : nombre

    const entidad = await tx.entidad.create({
      data: {
        codigo: codigoEntidad,
        tipo: 'PERSONAL',
        razonSocial,
        tipoDocumento: tipoDocumento || 'DNI',
        documento,
        email,
        telefono,
        direccion,
        ciudad,
        provincia,
        codigoPostal,
        banco,
        cbu,
        alias,
        legajo,
        cargoPersonalId: cargoPersonalId ? parseInt(cargoPersonalId) : null,
        fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
        sueldoBasico: sueldoBasico ? parseFloat(sueldoBasico) : null,
      }
    })

    // 2. Crear Entrenador vinculado a la Entidad
    const nuevoEntrenador = await tx.entrenador.create({
      data: {
        nombre,
        apellido,
        documento,
        telefono,
        email,
        socioId: socioId ? parseInt(socioId) : null,
        especialidad,
        observaciones,
        entidadId: entidad.id,
        // Datos de Staff Público
        mostrarEnWeb: mostrarEnWeb || false,
        fotoStaff: fotoStaff || null,
        biografiaStaff: biografiaStaff || null,
        emailPublico: emailPublico || null,
        telefonoPublico: telefonoPublico || null,
        ordenStaff: ordenStaff ? parseInt(ordenStaff) : 0,
      },
      include: { entidad: true }
    })

    return nuevoEntrenador
  })

  res.status(201).json({ success: true, data: entrenador })
}))

// PUT /api/admin/entrenadores/:id - Actualizar entrenador
router.put('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre, apellido, documento, telefono, email, socioId, especialidad, observaciones, activo,
    // Campos adicionales para Entidad PERSONAL
    tipoDocumento, direccion, ciudad, provincia, codigoPostal, banco, cbu, alias,
    legajo, cargoPersonalId, fechaIngreso, sueldoBasico,
    // Campos de Staff Público
    mostrarEnWeb, fotoStaff, biografiaStaff, emailPublico, telefonoPublico, ordenStaff
  } = req.body

  const existente = await req.db.entrenador.findUnique({
    where: { id: parseInt(id) },
    include: { entidad: true }
  })
  if (!existente) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  // Actualizar en transaccion
  const entrenador = await req.prisma.$transaction(async (tx) => {
    // 1. Actualizar o crear Entidad PERSONAL
    const nombreFinal = nombre ?? existente.nombre
    const apellidoFinal = apellido !== undefined ? apellido : existente.apellido
    const razonSocial = apellidoFinal ? `${apellidoFinal}, ${nombreFinal}` : nombreFinal

    if (existente.entidadId) {
      // Actualizar Entidad existente
      await tx.entidad.update({
        where: { id: existente.entidadId },
        data: {
          razonSocial,
          tipoDocumento: tipoDocumento !== undefined ? tipoDocumento : undefined,
          documento: documento !== undefined ? documento : undefined,
          email: email !== undefined ? email : undefined,
          telefono: telefono !== undefined ? telefono : undefined,
          direccion: direccion !== undefined ? direccion : undefined,
          ciudad: ciudad !== undefined ? ciudad : undefined,
          provincia: provincia !== undefined ? provincia : undefined,
          codigoPostal: codigoPostal !== undefined ? codigoPostal : undefined,
          banco: banco !== undefined ? banco : undefined,
          cbu: cbu !== undefined ? cbu : undefined,
          alias: alias !== undefined ? alias : undefined,
          legajo: legajo !== undefined ? legajo : undefined,
          cargoPersonalId: cargoPersonalId !== undefined ? (cargoPersonalId ? parseInt(cargoPersonalId) : null) : undefined,
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : undefined,
          sueldoBasico: sueldoBasico !== undefined ? (sueldoBasico ? parseFloat(sueldoBasico) : null) : undefined,
          activo: activo !== undefined ? activo : undefined,
        }
      })
    } else {
      // Crear Entidad si no existe (migracion de entrenadores antiguos)
      const codigoEntidad = await generarCodigoEntidadPersonal(tx)
      const entidad = await tx.entidad.create({
        data: {
          codigo: codigoEntidad,
          tipo: 'PERSONAL',
          razonSocial,
          tipoDocumento: tipoDocumento || 'DNI',
          documento: documento !== undefined ? documento : existente.documento,
          email: email !== undefined ? email : existente.email,
          telefono: telefono !== undefined ? telefono : existente.telefono,
          direccion,
          ciudad,
          provincia,
          codigoPostal,
          banco,
          cbu,
          alias,
          legajo,
          cargoPersonalId: cargoPersonalId ? parseInt(cargoPersonalId) : null,
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
          sueldoBasico: sueldoBasico ? parseFloat(sueldoBasico) : null,
        }
      })

      // Vincular entidad al entrenador
      await tx.entrenador.update({
        where: { id: parseInt(id) },
        data: { entidadId: entidad.id }
      })
    }

    // 2. Actualizar Entrenador
    const entrenadorActualizado = await tx.entrenador.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombreFinal,
        apellido: apellidoFinal,
        documento: documento !== undefined ? documento : existente.documento,
        telefono: telefono !== undefined ? telefono : existente.telefono,
        email: email !== undefined ? email : existente.email,
        socioId: socioId !== undefined ? (socioId ? parseInt(socioId) : null) : existente.socioId,
        especialidad: especialidad !== undefined ? especialidad : existente.especialidad,
        observaciones: observaciones !== undefined ? observaciones : existente.observaciones,
        activo: activo !== undefined ? activo : existente.activo,
        // Datos de Staff Público
        mostrarEnWeb: mostrarEnWeb !== undefined ? mostrarEnWeb : existente.mostrarEnWeb,
        fotoStaff: fotoStaff !== undefined ? fotoStaff : existente.fotoStaff,
        biografiaStaff: biografiaStaff !== undefined ? biografiaStaff : existente.biografiaStaff,
        emailPublico: emailPublico !== undefined ? emailPublico : existente.emailPublico,
        telefonoPublico: telefonoPublico !== undefined ? telefonoPublico : existente.telefonoPublico,
        ordenStaff: ordenStaff !== undefined ? parseInt(ordenStaff) : existente.ordenStaff,
      },
      include: {
        entidad: true,
        categorias: {
          where: { activo: true },
          include: {
            categoriaActividad: {
              include: { actividad: { select: { id: true, nombre: true } } }
            }
          }
        }
      },
    })

    return entrenadorActualizado
  })

  res.json({ success: true, data: entrenador })
}))

// DELETE /api/admin/entrenadores/:id - Eliminar entrenador
router.delete('/entrenadores/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Primero eliminar las asignaciones de categorías
  await req.db.entrenadorCategoria.deleteMany({
    where: { entrenadorId: parseInt(id) }
  })

  await req.db.entrenador.delete({ where: { id: parseInt(id) } })
  res.json({ success: true, data: { mensaje: 'Entrenador eliminado' } })
}))

// POST /api/admin/entrenadores/upload-foto - Upload de foto para staff
router.post('/entrenadores/upload-foto', authAdmin, upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se recibió ningún archivo'
    })
  }

  try {
    // Validar que sea imagen
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'El archivo debe ser una imagen'
      })
    }

    // Guardar en cache temporal (similar a noticias)
    const fileId = uuidv4()
    uploadCache.set(fileId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname
    })

    // Limpiar cache después de 1 hora
    setTimeout(() => uploadCache.delete(fileId), 3600000)

    res.json({
      success: true,
      message: 'Foto subida correctamente',
      data: {
        fileId,
        preview: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      }
    })
  } catch (err) {
    console.error('Error al subir foto:', err)
    res.status(500).json({
      success: false,
      message: 'Error al subir foto'
    })
  }
})

// POST /api/admin/entrenadores/:id/categorias - Asignar categoría a entrenador
router.post('/entrenadores/:id/categorias', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { categoriaActividadId, rol } = req.body

  if (!categoriaActividadId) {
    throw new AppError('La categoría es requerida', 400, 'VALIDATION_ERROR')
  }

  const entrenador = await req.db.entrenador.findUnique({ where: { id: parseInt(id) } })
  if (!entrenador) throw new AppError('Entrenador no encontrado', 404, 'NOT_FOUND')

  const categoria = await req.prisma.categoriaActividad.findUnique({ where: { id: parseInt(categoriaActividadId) } })
  if (!categoria) throw new AppError('Categoría no encontrada', 404, 'NOT_FOUND')

  // Verificar si ya existe la asignación
  const existente = await req.db.entrenadorCategoria.findUnique({
    where: {
      entrenadorId_categoriaActividadId: {
        entrenadorId: parseInt(id),
        categoriaActividadId: parseInt(categoriaActividadId)
      }
    }
  })

  if (existente) {
    // Si existe pero está inactiva, reactivarla
    if (!existente.activo) {
      const asignacion = await req.db.entrenadorCategoria.update({
        where: { id: existente.id },
        data: { activo: true, rol: rol || 'ENTRENADOR', fechaDesde: new Date() },
        include: {
          categoriaActividad: {
            include: { actividad: { select: { id: true, nombre: true } } }
          }
        }
      })
      return res.json({ success: true, data: asignacion })
    }
    throw new AppError('El entrenador ya está asignado a esta categoría', 400, 'DUPLICATE')
  }

  const asignacion = await req.db.entrenadorCategoria.create({
    data: {
      entrenadorId: parseInt(id),
      categoriaActividadId: parseInt(categoriaActividadId),
      rol: rol || 'ENTRENADOR',
    },
    include: {
      categoriaActividad: {
        include: { actividad: { select: { id: true, nombre: true } } }
      }
    }
  })

  res.status(201).json({ success: true, data: asignacion })
}))

// DELETE /api/admin/entrenadores/:id/categorias/:catId - Quitar categoría de entrenador
router.delete('/entrenadores/:id/categorias/:catId', authAdmin, asyncHandler(async (req, res) => {
  const { id, catId } = req.params

  const asignacion = await req.db.entrenadorCategoria.findFirst({
    where: {
      entrenadorId: parseInt(id),
      categoriaActividadId: parseInt(catId),
      activo: true
    }
  })

  if (!asignacion) throw new AppError('Asignación no encontrada', 404, 'NOT_FOUND')

  await req.db.entrenadorCategoria.update({
    where: { id: asignacion.id },
    data: { activo: false, fechaHasta: new Date() }
  })

  res.json({ success: true, data: { mensaje: 'Categoría desasignada' } })
}))

export default router
