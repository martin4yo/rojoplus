/**
 * Script de importación de grupos familiares desde GruposFamiliares.xlsx (Brio)
 *
 * Ejecutar con: node scripts/importar-grupos-familiares.js
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Iniciando importación de grupos familiares desde Brio...\n')

  // 1. Leer el archivo Excel
  const filePath = path.join(__dirname, '..', '..', 'brio', 'GruposFamiliares.xlsx')
  console.log(`📄 Leyendo archivo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 })

  // Headers en fila 2 (índice 2), datos desde fila 3
  const data = allData.slice(3)

  console.log(`📊 Total de registros a procesar: ${data.length}\n`)

  // 2. Cargar todos los socios para mapear nroSocio -> id
  console.log('👥 Cargando socios...')
  const socios = await prisma.socio.findMany({
    select: { id: true, nroSocio: true, apellidoNombre: true }
  })
  const socioMap = new Map()
  socios.forEach(s => socioMap.set(s.nroSocio, s))
  console.log(`   ${socios.length} socios cargados\n`)

  // 3. Agrupar por titular
  console.log('🔗 Procesando relaciones familiares...')
  const gruposPorTitular = new Map()

  for (const row of data) {
    const nroSocio = String(row[0] || '').trim()
    const nroTitular = String(row[9] || '').trim()
    const parentesco = String(row[7] || '').trim()
    const tipoSocio = String(row[8] || '').trim()

    if (!nroSocio || !nroTitular) continue

    if (!gruposPorTitular.has(nroTitular)) {
      gruposPorTitular.set(nroTitular, [])
    }

    gruposPorTitular.get(nroTitular).push({
      nroSocio,
      nroTitular,
      parentesco,
      tipoSocio
    })
  }

  console.log(`   ${gruposPorTitular.size} grupos familiares encontrados\n`)

  // 4. Actualizar relaciones en la base de datos
  console.log('💾 Actualizando relaciones en base de datos...')

  let actualizados = 0
  let errores = 0
  let sinSocio = 0
  let sinTitular = 0
  const erroresDetalle = []

  for (const [nroTitular, miembros] of gruposPorTitular) {
    const titular = socioMap.get(nroTitular)

    if (!titular) {
      sinTitular++
      continue
    }

    // Actualizar cada miembro del grupo
    for (const miembro of miembros) {
      try {
        const socio = socioMap.get(miembro.nroSocio)

        if (!socio) {
          sinSocio++
          continue
        }

        // Si el socio es el mismo que el titular, asegurar que titularFamiliaId sea null
        if (miembro.nroSocio === nroTitular) {
          await prisma.socio.update({
            where: { id: socio.id },
            data: {
              titularFamiliaId: null,
              parentescoTitular: null,
              tipoSocio: 'Titular Familia'
            }
          })
        } else {
          // Es un miembro de familia, asignar al titular
          await prisma.socio.update({
            where: { id: socio.id },
            data: {
              titularFamiliaId: titular.id,
              parentescoTitular: miembro.parentesco || null,
              tipoSocio: miembro.tipoSocio || 'Miembro Familia'
            }
          })
        }

        actualizados++

        // Progreso cada 50
        if (actualizados % 50 === 0) {
          process.stdout.write(`\r   Progreso: ${actualizados} actualizados, ${errores} errores, ${sinSocio} sin socio, ${sinTitular} sin titular`)
        }

      } catch (error) {
        errores++
        erroresDetalle.push({
          nroSocio: miembro.nroSocio,
          error: error.message
        })
      }
    }
  }

  console.log(`\r   Progreso: ${actualizados} actualizados, ${errores} errores, ${sinSocio} sin socio, ${sinTitular} sin titular`)
  console.log('\n')

  // 5. Resumen final
  console.log('=' .repeat(50))
  console.log('📊 RESUMEN DE IMPORTACIÓN')
  console.log('=' .repeat(50))
  console.log(`   Total en Excel:      ${data.length}`)
  console.log(`   Grupos familiares:   ${gruposPorTitular.size}`)
  console.log(`   Actualizados:        ${actualizados}`)
  console.log(`   Sin socio en BD:     ${sinSocio}`)
  console.log(`   Sin titular en BD:   ${sinTitular}`)
  console.log(`   Errores:             ${errores}`)
  console.log('=' .repeat(50))

  if (erroresDetalle.length > 0 && erroresDetalle.length <= 10) {
    console.log('\n❌ ERRORES ENCONTRADOS:')
    erroresDetalle.forEach(e => {
      console.log(`   Socio ${e.nroSocio}: ${e.error}`)
    })
  } else if (erroresDetalle.length > 10) {
    console.log(`\n❌ ${erroresDetalle.length} errores encontrados. Mostrando primeros 10:`)
    erroresDetalle.slice(0, 10).forEach(e => {
      console.log(`   Socio ${e.nroSocio}: ${e.error}`)
    })
  }

  // 6. Estadísticas de la BD
  const totalSocios = await prisma.socio.count()
  const sociosTitulares = await prisma.socio.count({
    where: {
      titularFamiliaId: null,
      tipoSocio: { contains: 'Titular' }
    }
  })
  const sociosMiembros = await prisma.socio.count({
    where: {
      titularFamiliaId: { not: null }
    }
  })

  console.log('\n📈 ESTADO DE LA BASE DE DATOS')
  console.log('=' .repeat(50))
  console.log(`   Total socios:        ${totalSocios}`)
  console.log(`   Titulares familia:   ${sociosTitulares}`)
  console.log(`   Miembros familia:    ${sociosMiembros}`)
  console.log(`   Sin grupo familiar:  ${totalSocios - sociosTitulares - sociosMiembros}`)
  console.log('=' .repeat(50))

  console.log('\n✅ Importación completada!')
}

main()
  .catch((e) => {
    console.error('❌ Error durante la importación:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
