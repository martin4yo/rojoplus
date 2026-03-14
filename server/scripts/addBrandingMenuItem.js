import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

async function main() {
  try {
    // Find the Configuración menu item
    const configMenu = await prisma.menuItem.findFirst({
      where: { titulo: 'Configuración', parentId: null }
    })

    if (!configMenu) {
      console.log('❌ Configuración menu not found')
      return
    }

    console.log(`✅ Found Configuración menu (ID: ${configMenu.id})`)

    // Check if Branding already exists
    const existing = await prisma.menuItem.findFirst({
      where: {
        titulo: 'Personalización Visual',
        parentId: configMenu.id
      }
    })

    if (existing) {
      console.log('✅ Personalización Visual menu item already exists')
      return
    }

    // Create Branding menu item
    const branding = await prisma.menuItem.create({
      data: {
        titulo: 'Personalización Visual',
        icono: 'Palette',
        url: '/admin/configuracion/branding',
        descripcion: 'Personaliza colores y logos del club',
        parentId: configMenu.id,
        orden: 100,
        activo: true
      }
    })

    console.log('✅ Created Personalización Visual menu item:')
    console.log(`   ID: ${branding.id}`)
    console.log(`   URL: ${branding.url}`)
    console.log(`   Icon: ${branding.icono}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
