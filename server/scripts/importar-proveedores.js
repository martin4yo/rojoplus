/**
 * Script para importar entidades (proveedores/empleados/servicios) desde Conceptos.xlsx
 * Importa como Entidad tipo PROVEEDOR todos los Nro. que NO existen en la tabla socios
 *
 * Ejecutar con: node scripts/importar-proveedores.js
 * Prerequisito: Paso 1 (socios) completado
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()
const TENANT_SLUG = 'sportivopilar'

async function importarProveedores() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no encontrado`)
    const tenantId = tenant.id
    console.log(`Tenant: ${tenant.nombre} (id=${tenantId})`)

    // Leer Conceptos.xlsx
    const filePath = path.join(__dirname, '../../brio/Conceptos.xlsx')
    const workbook = XLSX.readFile(filePath)
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 })
    console.log(`Registros en Conceptos.xlsx: ${data.length}`)

    // Cargar todos los nroSocio de la tabla socios del tenant
    const socios = await prisma.socio.findMany({
      where: { tenantId },
      select: { nroSocio: true }
    })
    const nrosSocios = new Set(socios.map(s => s.nroSocio?.toString().trim()).filter(Boolean))
    console.log(`Socios en BD: ${nrosSocios.size}`)

    // Extraer entidades únicas: Nro. Socio que NO existe en tabla socios
    const entidadesMap = new Map()
    for (const row of data) {
      const nro = row['Nro. Socio']?.toString().trim()
      if (!nro) continue
      if (nrosSocios.has(nro)) continue       // es socio → saltar
      if (entidadesMap.has(nro)) continue     // ya lo procesamos

      entidadesMap.set(nro, {
        nro,
        razonSocial: row['Apelllido y Nombre']?.toString().trim() || `ENTIDAD-${nro}`,
        documento: row['Documento']?.toString().trim() || null,
        email: row['E-Mail']?.toString().trim() || null,
        telefono: (row['Celular'] || row['Teléfono'])?.toString().trim() || null,
        direccion: row['Domicilio']?.toString().trim() || null,
      })
    }

    console.log(`\nEntidades a importar: ${entidadesMap.size}`)

    // Limpiar entidades de migración del tenant (solo las de código BRIO-)
    const deleted = await prisma.entidad.deleteMany({
      where: { tenantId, codigo: { startsWith: 'BRIO-' } }
    })
    console.log(`Entidades previas eliminadas: ${deleted.count}`)

    // Crear entidades
    let creadas = 0
    let errores = 0
    const erroresDetalle = []

    for (const [nro, entidad] of entidadesMap) {
      const codigo = `BRIO-${nro}`
      try {
        await prisma.entidad.create({
          data: {
            tenantId,
            codigo,
            tipo: 'PROVEEDOR',
            razonSocial: entidad.razonSocial,
            documento: entidad.documento,
            email: entidad.email,
            telefono: entidad.telefono,
            direccion: entidad.direccion,
            activo: true,
          }
        })
        creadas++
      } catch (err) {
        errores++
        erroresDetalle.push(`Nro ${nro} (${entidad.razonSocial}): ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('LISTO')
    console.log(`Entidades creadas: ${creadas}`)
    console.log(`Errores:          ${errores}`)
    if (erroresDetalle.length > 0) {
      console.log('\nDetalle errores:')
      erroresDetalle.slice(0, 20).forEach(e => console.log(`  - ${e}`))
    }

    const total = await prisma.entidad.count({ where: { tenantId, codigo: { startsWith: 'BRIO-' } } })
    console.log(`\nTotal entidades BRIO en BD: ${total}`)

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarProveedores()
