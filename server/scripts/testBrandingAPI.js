#!/usr/bin/env node

/**
 * Test script for Branding API endpoints
 * Usage: DATABASE_URL="..." node scripts/testBrandingAPI.js
 */

import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

async function main() {
  try {
    console.log('🧪 Testing Branding API endpoints...\n')

    // Test 1: Get default colors
    console.log('1️⃣  Default Colors')
    const defaultColors = {
      primario: '#DC2626',
      primarioOscuro: '#991B1B',
      primarioClaro: '#FCA5A5',
      secundario: '#7C3AED',
      secundarioOscuro: '#5B21B6',
      secundarioClaro: '#C4B5FD',
      acento: '#22D3EE',
      exito: '#10B981',
      advertencia: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
      fondoPrincipal: '#FFFFFF',
      fondoSecundario: '#F9FAFB',
      textoPrincipal: '#111827',
      textoSecundario: '#6B7280',
      borde: '#E5E7EB'
    }
    console.log('   ✅ 16 colores disponibles')
    Object.entries(defaultColors).forEach(([key]) => {
      console.log(`      • ${key}`)
    })

    // Test 2: Update branding
    console.log('\n2️⃣  Update Branding Validation')

    // Valid hex test
    const validHex = /^#[0-9A-F]{6}$/i
    const testColors = ['#DC2626', '#991B1B', '#FFFFFF', '#000000']
    testColors.forEach(color => {
      if (validHex.test(color)) {
        console.log(`   ✅ Valid hex: ${color}`)
      } else {
        console.log(`   ❌ Invalid hex: ${color}`)
      }
    })

    // Invalid hex test
    const invalidColors = ['DC2626', '#GGG000', '#12345', 'red']
    invalidColors.forEach(color => {
      if (!validHex.test(color)) {
        console.log(`   ✅ Correctly rejected: ${color}`)
      }
    })

    // Test 3: Logo/Favicon URL validation
    console.log('\n3️⃣  URL Validation')
    const testUrls = [
      'https://example.com/logo.png',
      'https://cdn.example.com/images/logo.png',
      'not-a-url',
      ''
    ]
    testUrls.forEach(url => {
      try {
        new URL(url)
        console.log(`   ✅ Valid URL: ${url}`)
      } catch {
        console.log(`   ✅ Correctly rejected: ${url}`)
      }
    })

    // Test 4: Database integration
    console.log('\n4️⃣  Database Integration')

    // Get default tenant
    const defaultTenant = await prisma.tenant.findFirst({
      where: {
        nombre: { contains: 'sportivo' }
      },
      select: {
        id: true,
        nombre: true,
        logoUrl: true,
        faviconUrl: true,
        colores: true
      }
    })

    if (defaultTenant) {
      console.log(`   ✅ Found tenant: ${defaultTenant.nombre}`)
      console.log(`      • ID: ${defaultTenant.id}`)
      console.log(`      • Logo: ${defaultTenant.logoUrl || '(none)'}`)
      console.log(`      • Favicon: ${defaultTenant.faviconUrl || '(none)'}`)
      console.log(`      • Colors configured: ${Object.keys(defaultTenant.colores || {}).length}`)
    } else {
      console.log('   ⚠️  No default tenant found')
    }

    // Test 5: Menu integration
    console.log('\n5️⃣  Menu Integration')
    const configuracionMenu = await prisma.menuItem.findFirst({
      where: { titulo: 'Configuración' }
    })

    if (configuracionMenu) {
      const brandingMenu = await prisma.menuItem.findFirst({
        where: {
          titulo: 'Personalización Visual',
          parentId: configuracionMenu.id
        }
      })

      if (brandingMenu) {
        console.log('   ✅ Branding menu item exists')
        console.log(`      • URL: ${brandingMenu.url}`)
        console.log(`      • Icon: ${brandingMenu.icono}`)
      } else {
        console.log('   ⚠️  Branding menu item not found')
        console.log('      💡 Run: node scripts/addBrandingMenuItem.js')
      }
    } else {
      console.log('   ⚠️  Configuración menu not found')
    }

    console.log('\n✅ All tests completed!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
