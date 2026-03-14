/**
 * Rutas para administración de Menú
 * - CRUD de items de menú
 * - Asignación de roles a items
 * - Obtención de menú filtrado por rol del usuario
 */

import express from 'express'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'

const router = express.Router()

// Todos los endpoints requieren autenticación de admin
router.use(authAdmin)

/**
 * GET /api/admin/menu
 * Obtiene el menú filtrado según los roles del usuario actual
 * Retorna solo los items que el usuario puede ver
 */
router.get('/', asyncHandler(async (req, res) => {
  const adminId = req.admin.id

  // Obtener el admin con su rol desde la BD (el JWT solo tiene id y email)
  const admin = await req.prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      rolId: true,
      rol: {
        select: { id: true, esSuperAdmin: true }
      }
    }
  })

  if (!admin) {
    return res.json({ success: true, data: [] })
  }

  // Obtener info del rol del usuario
  let userRoles = []
  let esSuperAdmin = false

  if (admin.rol) {
    userRoles = [admin.rol.id]
    esSuperAdmin = admin.rol.esSuperAdmin || false
  }

  // Obtener todos los items de menú activos (padres)
  const menuItems = await req.req.db.menuItem.findMany({
    where: {
      activo: true,
      parentId: null
    },
    include: {
      children: {
        where: { activo: true },
        include: {
          roles: { select: { rolId: true } }
        },
        orderBy: { orden: 'asc' }
      },
      roles: { select: { rolId: true } }
    },
    orderBy: { orden: 'asc' }
  })

  // Función para verificar si el usuario puede ver un item
  function canAccess(item) {
    // Super admin ve todo
    if (esSuperAdmin) return true

    // Si es solo para super admin, ocultar
    if (item.soloSuperAdmin) return false

    // Si no tiene roles asignados, solo super admin puede ver
    const itemRoles = item.roles.map(r => r.rolId)
    if (itemRoles.length === 0) return false

    // El usuario necesita tener alguno de los roles asignados
    return userRoles.some(ur => itemRoles.includes(ur))
  }

  // Filtrar items según permisos
  // Un padre se muestra si: tiene acceso directo O algún hijo tiene acceso
  const filteredMenu = menuItems
    .filter(item => {
      // Si el padre tiene acceso directo
      if (canAccess(item)) return true
      // Si algún hijo tiene acceso, mostrar el padre
      if (item.children?.length > 0) {
        return item.children.some(child => canAccess(child))
      }
      return false
    })
    .map(item => ({
      id: item.id,
      titulo: item.titulo,
      icono: item.icono,
      url: item.url,
      orden: item.orden,
      children: item.children
        .filter(child => canAccess(child))
        .map(child => ({
          id: child.id,
          titulo: child.titulo,
          icono: child.icono,
          url: child.url,
          orden: child.orden
        }))
    }))
    // Eliminar padres sin URL y sin hijos visibles
    .filter(item => item.url || (item.children && item.children.length > 0))

  res.json({
    success: true,
    data: filteredMenu
  })
}))

/**
 * GET /api/admin/menu/admin
 * Obtiene TODOS los items de menú (para administración)
 * Solo usuarios con permiso USUARIOS_GESTIONAR
 */
router.get('/admin', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const menuItems = await req.req.db.menuItem.findMany({
    where: { parentId: null },
    include: {
      children: {
        include: {
          roles: {
            include: { rol: { select: { id: true, codigo: true, nombre: true } } }
          }
        },
        orderBy: { orden: 'asc' }
      },
      roles: {
        include: { rol: { select: { id: true, codigo: true, nombre: true } } }
      }
    },
    orderBy: { orden: 'asc' }
  })

  // Transformar para incluir rolesIds directamente
  const result = menuItems.map(item => ({
    ...item,
    rolesIds: item.roles.map(r => r.rolId),
    children: item.children.map(child => ({
      ...child,
      rolesIds: child.roles.map(r => r.rolId)
    }))
  }))

  res.json({
    success: true,
    data: result
  })
}))

/**
 * GET /api/admin/menu/roles
 * Lista todos los roles disponibles
 */
router.get('/roles', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const roles = await req.prisma.rol.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      esSuperAdmin: true
    },
    orderBy: { nombre: 'asc' }
  })

  res.json({
    success: true,
    data: roles
  })
}))

/**
 * POST /api/admin/menu
 * Crear nuevo item de menú
 */
router.post('/', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const { parentId, titulo, icono, url, descripcion, orden, activo, soloSuperAdmin } = req.body

  if (!titulo || !icono) {
    throw new AppError('Título e ícono son obligatorios', 400)
  }

  // Si tiene parentId, verificar que existe
  if (parentId) {
    const parent = await req.req.db.menuItem.findUnique({
      where: { id: parseInt(parentId) }
    })
    if (!parent) {
      throw new AppError('Item padre no encontrado', 404)
    }
  }

  const menuItem = await req.req.db.menuItem.create({
    data: {
      parentId: parentId ? parseInt(parentId) : null,
      titulo,
      icono,
      url: url || null,
      descripcion: descripcion || null,
      orden: orden || 0,
      activo: activo !== false,
      soloSuperAdmin: soloSuperAdmin || false
    }
  })

  res.status(201).json({
    success: true,
    message: 'Item de menú creado',
    data: menuItem
  })
}))

/**
 * PUT /api/admin/menu/:id
 * Actualizar item de menú
 */
router.put('/:id', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const { parentId, titulo, icono, url, descripcion, orden, activo, soloSuperAdmin } = req.body

  const existing = await req.req.db.menuItem.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existing) {
    throw new AppError('Item de menú no encontrado', 404)
  }

  // No permitir que un item sea su propio padre
  if (parentId && parseInt(parentId) === parseInt(id)) {
    throw new AppError('Un item no puede ser su propio padre', 400)
  }

  const menuItem = await req.req.db.menuItem.update({
    where: { id: parseInt(id) },
    data: {
      parentId: parentId !== undefined ? (parentId ? parseInt(parentId) : null) : undefined,
      titulo: titulo !== undefined ? titulo : undefined,
      icono: icono !== undefined ? icono : undefined,
      url: url !== undefined ? (url || null) : undefined,
      descripcion: descripcion !== undefined ? (descripcion || null) : undefined,
      orden: orden !== undefined ? orden : undefined,
      activo: activo !== undefined ? activo : undefined,
      soloSuperAdmin: soloSuperAdmin !== undefined ? soloSuperAdmin : undefined
    }
  })

  res.json({
    success: true,
    message: 'Item de menú actualizado',
    data: menuItem
  })
}))

/**
 * DELETE /api/admin/menu/:id
 * Eliminar item de menú (y sus hijos en cascada)
 */
router.delete('/:id', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const existing = await req.req.db.menuItem.findUnique({
    where: { id: parseInt(id) },
    include: { children: true }
  })

  if (!existing) {
    throw new AppError('Item de menú no encontrado', 404)
  }

  // El cascade delete se encarga de los hijos
  await req.req.db.menuItem.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: `Item "${existing.titulo}" eliminado${existing.children.length > 0 ? ` junto con ${existing.children.length} subitem(s)` : ''}`
  })
}))

/**
 * PATCH /api/admin/menu/:id/roles
 * Actualizar roles asignados a un item de menú
 */
router.patch('/:id/roles', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rolesIds } = req.body

  if (!Array.isArray(rolesIds)) {
    throw new AppError('rolesIds debe ser un array', 400)
  }

  const existing = await req.req.db.menuItem.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existing) {
    throw new AppError('Item de menú no encontrado', 404)
  }

  // Validar que los roles existan
  if (rolesIds.length > 0) {
    const rolesCount = await req.prisma.rol.count({
      where: { id: { in: rolesIds.map(r => parseInt(r)) } }
    })
    if (rolesCount !== rolesIds.length) {
      throw new AppError('Uno o más roles no existen', 400)
    }
  }

  // Eliminar roles actuales y agregar los nuevos
  await req.prisma.$transaction([
    req.req.db.menuItemRol.deleteMany({
      where: { menuItemId: parseInt(id) }
    }),
    ...rolesIds.map(rolId =>
      req.req.db.menuItemRol.create({
        data: {
          menuItemId: parseInt(id),
          rolId: parseInt(rolId)
        }
      })
    )
  ])

  // Obtener el item actualizado
  const updated = await req.req.db.menuItem.findUnique({
    where: { id: parseInt(id) },
    include: {
      roles: {
        include: { rol: { select: { id: true, codigo: true, nombre: true } } }
      }
    }
  })

  res.json({
    success: true,
    message: 'Roles actualizados',
    data: {
      ...updated,
      rolesIds: updated.roles.map(r => r.rolId)
    }
  })
}))

/**
 * PATCH /api/admin/menu/:id/reorder
 * Cambiar el orden de un item
 */
router.patch('/:id/reorder', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const { orden } = req.body

  if (typeof orden !== 'number') {
    throw new AppError('orden debe ser un número', 400)
  }

  const menuItem = await req.req.db.menuItem.update({
    where: { id: parseInt(id) },
    data: { orden }
  })

  res.json({
    success: true,
    message: 'Orden actualizado',
    data: menuItem
  })
}))

/**
 * POST /api/admin/menu/seed
 * Crear/actualizar menú inicial basado en el menú hardcodeado actual
 * Solo agrega items que no existan (compara por URL)
 */
router.post('/seed', checkPermiso('USUARIOS_GESTIONAR'), asyncHandler(async (req, res) => {
  // Menú inicial basado en el actual
  const menuData = [
    { titulo: 'Dashboard', icono: 'LayoutDashboard', url: '/admin', orden: 1 },
    { titulo: 'Dashboard Ejecutivo', icono: 'BarChart3', url: '/admin/dashboard-ejecutivo', orden: 2 },
    {
      titulo: 'Socios', icono: 'Users', orden: 3,
      children: [
        { titulo: 'Listado Socios', icono: 'Users', url: '/admin/socios', orden: 1 },
        { titulo: 'Solicitudes Alta', icono: 'UserPlus', url: '/admin/solicitudes', orden: 2 },
        { titulo: 'Inscripciones', icono: 'ClipboardList', url: '/admin/inscripciones', orden: 3 },
        { titulo: 'Cuotas y Periodos', icono: 'Receipt', url: '/admin/periodos', orden: 4 },
      ]
    },
    {
      titulo: 'Ingresos', icono: 'TrendingUp', orden: 4,
      children: [
        { titulo: 'Clientes', icono: 'UserCheck', url: '/admin/ingresos/clientes', orden: 1 },
        { titulo: 'Pedidos', icono: 'ShoppingCart', url: '/admin/ingresos/pedidos', orden: 2 },
        { titulo: 'Facturas Emitidas', icono: 'FileText', url: '/admin/ingresos/facturas', orden: 3 },
        { titulo: 'Recibos de Cobro', icono: 'FileCheck', url: '/admin/ingresos/recibos', orden: 4 },
      ]
    },
    {
      titulo: 'Egresos', icono: 'TrendingDown', orden: 5,
      children: [
        { titulo: 'Proveedores', icono: 'Building2', url: '/admin/egresos/proveedores', orden: 1 },
        { titulo: 'Ordenes de Compra', icono: 'ShoppingCart', url: '/admin/egresos/ordenes-compra', orden: 2 },
        { titulo: 'Facturas Recibidas', icono: 'FileText', url: '/admin/egresos/facturas', orden: 3 },
        { titulo: 'Ordenes de Pago', icono: 'CreditCard', url: '/admin/egresos/ordenes-pago', orden: 4 },
      ]
    },
    {
      titulo: 'Sueldos', icono: 'DollarSign', orden: 6,
      children: [
        { titulo: 'Personal', icono: 'Briefcase', url: '/admin/egresos/personal', orden: 1 },
        { titulo: 'Liquidaciones', icono: 'FileText', url: '/admin/liquidaciones', orden: 2 },
        { titulo: 'Conceptos', icono: 'Settings', url: '/admin/liquidaciones/conceptos', orden: 3 },
      ]
    },
    {
      titulo: 'Tesoreria', icono: 'Wallet', orden: 7,
      children: [
        { titulo: 'Cajas', icono: 'Wallet', url: '/admin/tesoreria/cajas', orden: 1 },
        { titulo: 'Cierre de Caja', icono: 'ClipboardList', url: '/admin/cierres-caja', orden: 2 },
        { titulo: 'Debito Automatico', icono: 'CreditCard', url: '/admin/debito-automatico', orden: 3 },
        { titulo: 'Movimientos', icono: 'ArrowLeftRight', url: '/admin/tesoreria/movimientos', orden: 4 },
        { titulo: 'Transferencias', icono: 'ArrowLeftRight', url: '/admin/tesoreria/transferencias', orden: 5 },
        { titulo: 'Valores Pendientes', icono: 'CreditCard', url: '/admin/tesoreria/pendientes-conciliar', orden: 6 },
        { titulo: 'Conciliacion Bancaria', icono: 'FileCheck', url: '/admin/tesoreria/conciliacion', orden: 7 },
      ]
    },
    {
      titulo: 'Stock', icono: 'Package', orden: 8,
      children: [
        { titulo: 'Productos', icono: 'BoxesIcon', url: '/admin/stock/productos', orden: 1 },
        { titulo: 'Categorias', icono: 'Tag', url: '/admin/stock/categorias', orden: 2 },
        { titulo: 'Movimientos', icono: 'ArrowLeftRight', url: '/admin/stock/movimientos', orden: 3 },
        { titulo: 'Alertas Stock', icono: 'AlertTriangle', url: '/admin/stock/alertas', orden: 4 },
      ]
    },
    {
      titulo: 'Contabilidad', icono: 'Calculator', orden: 9,
      children: [
        { titulo: 'Plan de Cuentas', icono: 'BookOpen', url: '/admin/contabilidad/plan-cuentas', orden: 1 },
        { titulo: 'Libro Diario', icono: 'FileText', url: '/admin/contabilidad/asientos', orden: 2 },
        { titulo: 'Libro Mayor', icono: 'BookOpen', url: '/admin/contabilidad/libro-mayor', orden: 3 },
        { titulo: 'Presupuestos', icono: 'BarChart3', url: '/admin/contabilidad/presupuestos', orden: 4 },
      ]
    },
    {
      titulo: 'Deportes', icono: 'Trophy', orden: 10,
      children: [
        { titulo: 'Partidos', icono: 'Trophy', url: '/admin/partidos', orden: 1 },
        { titulo: 'Entrenamientos', icono: 'Calendar', url: '/admin/deportes/entrenamientos', orden: 2 },
        { titulo: 'Horarios', icono: 'ClipboardList', url: '/admin/deportes/horarios', orden: 3 },
        { titulo: 'Espacios', icono: 'MapPin', url: '/admin/deportes/espacios', orden: 4 },
        { titulo: 'Tipos de Espacio', icono: 'Settings', url: '/admin/deportes/tipos-espacio', orden: 5 },
        { titulo: 'Reportes Deportivos', icono: 'BarChart3', url: '/admin/reportes/deportivos', orden: 6 },
        { titulo: 'Pasaje Categoría', icono: 'ArrowUpCircle', url: '/admin/deportes/pasaje-categoria', orden: 7 },
      ]
    },
    {
      titulo: 'Buffet', icono: 'UtensilsCrossed', orden: 11,
      children: [
        { titulo: 'Dashboard', icono: 'LayoutDashboard', url: '/admin/buffet', orden: 1 },
        { titulo: 'Estado Mesas', icono: 'Users', url: '/admin/buffet/estado', orden: 2 },
        { titulo: 'Mesas', icono: 'UtensilsCrossed', url: '/admin/buffet/mesas', orden: 3 },
        { titulo: 'Pedidos', icono: 'ShoppingBag', url: '/admin/buffet/takeaway', orden: 4 },
        { titulo: 'Kiosco', icono: 'Coffee', url: '/admin/buffet/kiosco', orden: 5 },
        { titulo: 'Cocina (KDS)', icono: 'ChefHat', url: '/admin/buffet/cocina', orden: 6 },
        { titulo: 'Productos', icono: 'Package', url: '/admin/buffet/productos', orden: 7 },
        { titulo: 'Precios', icono: 'DollarSign', url: '/admin/buffet/precios', orden: 8 },
        { titulo: 'Categorías', icono: 'Tag', url: '/admin/buffet/categorias', orden: 9 },
        { titulo: 'Impresoras', icono: 'Printer', url: '/admin/buffet/impresoras', orden: 10 },
      ]
    },
    {
      titulo: 'Control de Accesos', icono: 'Activity', orden: 12,
      children: [
        { titulo: 'Monitor en Vivo', icono: 'Activity', url: '/admin/accesos/monitor', orden: 1 },
        { titulo: 'DNIs Denegados', icono: 'AlertTriangle', url: '/admin/accesos/intentos-denegados', orden: 2 },
        { titulo: 'Habilitaciones', icono: 'UserPlus', url: '/admin/accesos/habilitaciones', orden: 3 },
        { titulo: 'Control Móvil', icono: 'Smartphone', url: '/admin/accesos/control-pwa', orden: 4 },
      ]
    },
    {
      titulo: 'Eventos', icono: 'Ticket', orden: 13,
      children: [
        { titulo: 'Gestión de Eventos', icono: 'Ticket', url: '/admin/eventos', orden: 1 },
        { titulo: 'Vender Entradas', icono: 'ShoppingCart', url: '/admin/eventos/vender', orden: 2 },
      ]
    },
    {
      titulo: 'Contenido', icono: 'Newspaper', orden: 14,
      children: [
        { titulo: 'Noticias', icono: 'Newspaper', url: '/admin/noticias', orden: 1 },
        { titulo: 'Banners', icono: 'Megaphone', url: '/admin/publicidad', orden: 2 },
        { titulo: 'Comercios', icono: 'Store', url: '/admin/comercios', orden: 3 },
      ]
    },
    { titulo: 'Reportes', icono: 'BarChart3', url: '/admin/reportes', orden: 15 },
    {
      titulo: 'Configuracion', icono: 'Settings', orden: 16,
      children: [
        { titulo: 'General', icono: 'Sliders', url: '/admin/configuracion', orden: 1 },
        { titulo: 'Datos Bancarios', icono: 'CreditCard', url: '/admin/configuracion/pagos', orden: 2 },
        { titulo: 'Autoridades', icono: 'Users', url: '/admin/configuracion/autoridades', orden: 3 },
        { titulo: 'Usuarios', icono: 'Users', url: '/admin/configuracion/usuarios', orden: 4 },
        { titulo: 'Roles', icono: 'Shield', url: '/admin/configuracion/roles', orden: 5 },
        { titulo: 'Menú', icono: 'Menu', url: '/admin/configuracion/menu', orden: 6 },
        { titulo: 'Templates Email', icono: 'Mail', url: '/admin/configuracion/templates/email', orden: 7 },
        { titulo: 'Templates PDF', icono: 'FileText', url: '/admin/configuracion/templates/pdf', orden: 8 },
        { titulo: 'Facturacion AFIP', icono: 'FileText', url: '/admin/configuracion/fiscal', orden: 9 },
      ]
    },
  ]

  // Obtener items existentes para comparar
  const existingItems = await req.req.db.menuItem.findMany({
    include: { children: true }
  })

  // Función para buscar item existente
  function findExisting(titulo, url, parentId = null) {
    return existingItems.find(item => {
      // Comparar por URL si existe
      if (url && item.url === url) return true
      // O por título + parentId si no tiene URL
      if (!url && item.titulo === titulo && item.parentId === parentId) return true
      // También buscar en hijos
      if (item.children) {
        const childMatch = item.children.find(c =>
          (url && c.url === url) || (!url && c.titulo === titulo)
        )
        if (childMatch) return true
      }
      return false
    })
  }

  let creados = 0
  let existentes = 0

  // Crear items que no existan
  for (const item of menuData) {
    let parent = findExisting(item.titulo, item.url)

    if (!parent) {
      // Crear el padre
      parent = await req.req.db.menuItem.create({
        data: {
          titulo: item.titulo,
          icono: item.icono,
          url: item.url || null,
          orden: item.orden,
          activo: true,
          soloSuperAdmin: false
        }
      })
      creados++
    } else {
      existentes++
      // Buscar el item real en la BD si existe
      const realParent = await req.req.db.menuItem.findFirst({
        where: item.url ? { url: item.url } : { titulo: item.titulo, parentId: null }
      })
      if (realParent) parent = realParent
    }

    // Procesar hijos
    if (item.children && parent.id) {
      for (const child of item.children) {
        const childExists = await req.req.db.menuItem.findFirst({
          where: { url: child.url }
        })

        if (!childExists) {
          await req.req.db.menuItem.create({
            data: {
              parentId: parent.id,
              titulo: child.titulo,
              icono: child.icono,
              url: child.url,
              orden: child.orden,
              activo: true,
              soloSuperAdmin: false
            }
          })
          creados++
        } else {
          existentes++
        }
      }
    }
  }

  const total = await req.req.db.menuItem.count()

  res.status(201).json({
    success: true,
    message: `Menú sincronizado: ${creados} nuevos, ${existentes} ya existían. Total: ${total} items`,
    data: { totalItems: total, creados, existentes }
  })
}))

export default router
