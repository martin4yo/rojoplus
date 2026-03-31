import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
      { titulo: 'Venta Barra', icono: 'Zap', url: '/admin/buffet/barra', orden: 6 },
      { titulo: 'Cocina (KDS)', icono: 'ChefHat', url: '/admin/buffet/cocina', orden: 7 },
      { titulo: 'Productos', icono: 'Package', url: '/admin/buffet/productos', orden: 8 },
      { titulo: 'Precios', icono: 'DollarSign', url: '/admin/buffet/precios', orden: 9 },
      { titulo: 'Categorías', icono: 'Tag', url: '/admin/buffet/categorias', orden: 10 },
      { titulo: 'Impresoras', icono: 'Printer', url: '/admin/buffet/impresoras', orden: 11 },
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
    titulo: 'Reservas', icono: 'CalendarDays', orden: 13,
    children: [
      { titulo: 'Calendario', icono: 'CalendarDays', url: '/admin/reservas', orden: 1 },
      { titulo: 'Configuración', icono: 'Settings', url: '/admin/reservas/config', orden: 2 },
    ]
  },
  {
    titulo: 'Eventos', icono: 'Ticket', orden: 14,
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
  { titulo: 'Reportes', icono: 'BarChart3', url: '/admin/reportes', orden: 16 },
  {
    titulo: 'Configuracion', icono: 'Settings', orden: 17,
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
  {
    titulo: 'Centros de Costo', icono: 'Building2', orden: 18,
    children: [
      { titulo: 'Dashboard Ejecutivo', icono: 'LayoutDashboard', url: '/admin/reportes/centros-costo/dashboard', orden: 1 },
      { titulo: 'Evolución Temporal', icono: 'TrendingUp', url: '/admin/reportes/centros-costo/evolucion', orden: 2 },
      { titulo: 'Rentabilidad Actividades', icono: 'Target', url: '/admin/reportes/centros-costo/rentabilidad', orden: 3 },
      { titulo: 'Presupuesto vs Real', icono: 'PieChart', url: '/admin/reportes/centros-costo/presupuesto', orden: 4 },
      { titulo: 'Estado de Resultados', icono: 'FileText', url: '/admin/reportes/centros-costo', orden: 5 },
    ]
  },
]

async function seedMenu() {
  try {
    console.log('🍽️  Seeding menú...\n')

    let creados = 0
    let existentes = 0

    // Obtener rol SUPER_ADMIN
    const superAdminRol = await prisma.rol.findFirst({
      where: { codigo: 'SUPER_ADMIN' }
    })

    if (!superAdminRol) {
      console.error('❌ No se encontró el rol SUPER_ADMIN')
      process.exit(1)
    }

    for (const item of menuData) {
      // Verificar si ya existe el padre
      let parent = await prisma.menuItem.findFirst({
        where: item.url ? { url: item.url } : { titulo: item.titulo, parentId: null }
      })

      if (!parent) {
        // Crear el padre
        parent = await prisma.menuItem.create({
          data: {
            titulo: item.titulo,
            icono: item.icono,
            url: item.url || null,
            orden: item.orden,
            activo: true,
            soloSuperAdmin: false
          }
        })

        // Asignar rol SUPER_ADMIN
        await prisma.menuItemRol.create({
          data: {
            menuItemId: parent.id,
            rolId: superAdminRol.id
          }
        })

        console.log(`✓ ${item.titulo}`)
        creados++
      } else {
        console.log(`⊗ ${item.titulo} (ya existe)`)
        existentes++
      }

      // Procesar hijos
      if (item.children && parent.id) {
        for (const child of item.children) {
          const childExists = await prisma.menuItem.findFirst({
            where: { url: child.url }
          })

          if (!childExists) {
            const newChild = await prisma.menuItem.create({
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

            // Asignar rol SUPER_ADMIN
            await prisma.menuItemRol.create({
              data: {
                menuItemId: newChild.id,
                rolId: superAdminRol.id
              }
            })

            console.log(`  ✓ ${child.titulo}`)
            creados++
          } else {
            console.log(`  ⊗ ${child.titulo} (ya existe)`)
            existentes++
          }
        }
      }
    }

    const total = await prisma.menuItem.count()

    console.log(`\n📊 Resumen:`)
    console.log(`   ✓ Items creados: ${creados}`)
    console.log(`   ⊗ Ya existían: ${existentes}`)
    console.log(`   📦 Total: ${total}`)
    console.log('\n✅ Seed de menú completado!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedMenu()
