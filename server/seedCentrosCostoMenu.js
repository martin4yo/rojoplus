import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedCentrosCostoMenu() {
  try {
    console.log('📊 Agregando items de menú para Centros de Costo...\n')

    // Obtener rol SUPER_ADMIN
    const superAdminRol = await prisma.rol.findFirst({
      where: { codigo: 'SUPER_ADMIN' }
    })

    if (!superAdminRol) {
      console.error('❌ No se encontró el rol SUPER_ADMIN')
      process.exit(1)
    }

    // Buscar el menú padre "Configuracion"
    let configMenu = await prisma.menuItem.findFirst({
      where: { titulo: 'Configuracion', parentId: null }
    })

    if (!configMenu) {
      console.log('⚠️  No se encontró el menú "Configuracion", creándolo...')
      configMenu = await prisma.menuItem.create({
        data: {
          titulo: 'Configuracion',
          icono: 'Settings',
          orden: 16,
          activo: true
        }
      })
      await prisma.menuItemRol.create({
        data: { menuItemId: configMenu.id, rolId: superAdminRol.id }
      })
    }

    // Buscar el menú "Reportes" (puede ser padre o item simple)
    let reportesMenu = await prisma.menuItem.findFirst({
      where: { titulo: 'Reportes', parentId: null }
    })

    // Agregar "Centros de Costo" bajo Configuracion
    const centrosCostoUrl = '/admin/configuracion/centros-costo'
    let centrosCostoItem = await prisma.menuItem.findFirst({
      where: { url: centrosCostoUrl }
    })

    if (!centrosCostoItem) {
      // Obtener el máximo orden dentro de Configuracion
      const maxOrden = await prisma.menuItem.aggregate({
        where: { parentId: configMenu.id },
        _max: { orden: true }
      })

      centrosCostoItem = await prisma.menuItem.create({
        data: {
          parentId: configMenu.id,
          titulo: 'Centros de Costo',
          icono: 'Calculator',
          url: centrosCostoUrl,
          orden: (maxOrden._max.orden || 0) + 1,
          activo: true
        }
      })

      // Asignar a SUPER_ADMIN
      await prisma.menuItemRol.create({
        data: { menuItemId: centrosCostoItem.id, rolId: superAdminRol.id }
      })

      console.log('✓ Centros de Costo (en Configuración)')
    } else {
      console.log('⊗ Centros de Costo (ya existe)')
    }

    // Agregar "Reporte Centros de Costo"
    const reporteCCUrl = '/admin/reportes/centros-costo'
    let reporteCCItem = await prisma.menuItem.findFirst({
      where: { url: reporteCCUrl }
    })

    if (!reporteCCItem) {
      if (reportesMenu) {
        // Si Reportes es un menú padre con hijos, agregar como hijo
        const tieneHijos = await prisma.menuItem.count({
          where: { parentId: reportesMenu.id }
        })

        if (tieneHijos > 0 || !reportesMenu.url) {
          // Agregar como hijo de Reportes
          const maxOrden = await prisma.menuItem.aggregate({
            where: { parentId: reportesMenu.id },
            _max: { orden: true }
          })

          reporteCCItem = await prisma.menuItem.create({
            data: {
              parentId: reportesMenu.id,
              titulo: 'Centros de Costo',
              icono: 'BarChart3',
              url: reporteCCUrl,
              orden: (maxOrden._max.orden || 0) + 1,
              activo: true
            }
          })
        } else {
          // Reportes es un item simple, convertirlo en padre
          await prisma.menuItem.update({
            where: { id: reportesMenu.id },
            data: { url: null }
          })

          // Crear el item de reporte general
          await prisma.menuItem.create({
            data: {
              parentId: reportesMenu.id,
              titulo: 'General',
              icono: 'BarChart3',
              url: '/admin/reportes',
              orden: 1,
              activo: true
            }
          })

          reporteCCItem = await prisma.menuItem.create({
            data: {
              parentId: reportesMenu.id,
              titulo: 'Centros de Costo',
              icono: 'Calculator',
              url: reporteCCUrl,
              orden: 2,
              activo: true
            }
          })
        }
      } else {
        // Crear menú Reportes como padre
        reportesMenu = await prisma.menuItem.create({
          data: {
            titulo: 'Reportes',
            icono: 'BarChart3',
            orden: 15,
            activo: true
          }
        })
        await prisma.menuItemRol.create({
          data: { menuItemId: reportesMenu.id, rolId: superAdminRol.id }
        })

        reporteCCItem = await prisma.menuItem.create({
          data: {
            parentId: reportesMenu.id,
            titulo: 'Centros de Costo',
            icono: 'Calculator',
            url: reporteCCUrl,
            orden: 1,
            activo: true
          }
        })
      }

      // Asignar a SUPER_ADMIN
      await prisma.menuItemRol.create({
        data: { menuItemId: reporteCCItem.id, rolId: superAdminRol.id }
      })

      console.log('✓ Reporte Centros de Costo (en Reportes)')
    } else {
      console.log('⊗ Reporte Centros de Costo (ya existe)')
    }

    console.log('\n✅ Seed completado')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedCentrosCostoMenu()
