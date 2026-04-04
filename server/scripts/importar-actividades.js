/**
 * Importar actividades, categorías e inscripciones desde ActividadesStatus.xlsx
 *
 * Uso:
 *   node scripts/importar-actividades.js <tenant-slug> [--dry-run] [--reset]
 *
 *   --dry-run : muestra qué haría sin escribir nada
 *   --reset   : borra inscripciones, categorías y actividades del tenant antes de importar
 *               (si se omite, solo inserta/omite sin borrar nada)
 *
 * Ejemplo:
 *   node scripts/importar-actividades.js sportivopilar
 *   node scripts/importar-actividades.js sportivopilar --reset
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Argumentos CLI ──────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const TENANT_SLUG = args.find(a => !a.startsWith('--'))
const DRY_RUN     = args.includes('--dry-run')
const RESET       = args.includes('--reset')

if (!TENANT_SLUG) {
  console.error('ERROR: Debes pasar el tenant slug como primer argumento.')
  console.error('  Uso: node scripts/importar-actividades.js <tenant-slug> [--dry-run] [--reset]')
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte un serial de Excel (días desde 1900-01-01) a Date de JS */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return new Date()
  // Excel erróneamente cuenta 1900 como bisiesto → offset de 25569 días desde epoch
  const MS_PER_DAY = 86400 * 1000
  return new Date((serial - 25569) * MS_PER_DAY)
}

function siNo(val) {
  return val?.toString().trim().toUpperCase() === 'SI'
}

function codigoActividad(nombre) {
  return nombre.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
}

function codigoCategoria(actCodigo, catNombre) {
  return (actCodigo + '_' + catNombre.toUpperCase().replace(/\s+/g, '_')).substring(0, 50)
}

function estadoInscripcion(estadoExcel) {
  const e = estadoExcel?.toString().trim().toUpperCase()
  if (e === 'VIGENTE' || e === 'ACTIVO' || e === 'ACTIVA') return 'ACTIVA'
  return 'INACTIVA'
}

// ── Main ─────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()

async function main() {
  // 1. Tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) {
    console.error(`ERROR: Tenant "${TENANT_SLUG}" no encontrado.`)
    process.exit(1)
  }
  const tenantId = tenant.id
  console.log(`Tenant: ${tenant.nombre} (id=${tenantId})`)
  if (DRY_RUN) console.log('*** MODO DRY-RUN: no se escribirá nada ***\n')

  // 2. Leer Excel
  const filePath = path.join(__dirname, '../../brio/ActividadesStatus.xlsx')
  const workbook = XLSX.readFile(filePath)
  const sheet    = workbook.Sheets[workbook.SheetNames[0]]
  const rows     = XLSX.utils.sheet_to_json(sheet, { range: 2 })
  console.log(`Registros en el Excel: ${rows.length}\n`)

  // 3. Reset opcional
  if (RESET && !DRY_RUN) {
    console.log('Borrando datos existentes del tenant...')
    const di = await prisma.inscripcion.deleteMany({ where: { tenantId } })
    const dc = await prisma.categoriaActividad.deleteMany({ where: { tenantId } })
    const da = await prisma.actividad.deleteMany({ where: { tenantId } })
    console.log(`  Inscripciones eliminadas: ${di.count}`)
    console.log(`  Categorías eliminadas:    ${dc.count}`)
    console.log(`  Actividades eliminadas:   ${da.count}\n`)
  }

  // 4. Armar mapa Actividad → Set<Categoría>
  const actividadesMap = new Map() // actNombre → Set<catNombre>
  for (const row of rows) {
    const act = row['Actividad']?.toString().trim()
    const cat = row['Cat. Actividad']?.toString().trim()
    if (!act) continue
    if (!actividadesMap.has(act)) actividadesMap.set(act, new Set())
    if (cat) actividadesMap.get(act).add(cat)
  }

  console.log(`Actividades únicas: ${actividadesMap.size}`)
  for (const [a, cats] of actividadesMap) {
    console.log(`  - ${a}: ${cats.size} categorías`)
  }
  console.log()

  // 5. Crear actividades y categorías
  // Mapas para lookup al crear inscripciones
  const catIdMap = new Map() // codigoCat → id

  let ordenAct = 1
  for (const [actNombre, categoriasSet] of actividadesMap) {
    const actCodigo = codigoActividad(actNombre)

    let actividad
    if (!DRY_RUN) {
      actividad = await prisma.actividad.findFirst({ where: { codigo: actCodigo, tenantId } })
      if (!actividad) {
        actividad = await prisma.actividad.create({
          data: { tenantId, codigo: actCodigo, nombre: actNombre, requiereAptaFisica: true, activo: true, orden: ordenAct }
        })
        console.log(`[NUEVA] Actividad: ${actNombre}`)
      } else {
        console.log(`[EXISTE] Actividad: ${actNombre}`)
      }
    } else {
      console.log(`[DRY] Actividad: ${actNombre}`)
      actividad = { id: -1 }
    }

    let ordenCat = 1
    for (const catNombre of categoriasSet) {
      const catCodigo = codigoCategoria(actCodigo, catNombre)

      if (!DRY_RUN) {
        let cat = await prisma.categoriaActividad.findFirst({ where: { codigo: catCodigo, tenantId } })
        if (!cat) {
          cat = await prisma.categoriaActividad.create({
            data: { tenantId, codigo: catCodigo, nombre: catNombre, actividadId: actividad.id, activo: true, orden: ordenCat }
          })
          console.log(`  + Categoría creada: ${catNombre}`)
        } else {
          console.log(`  = Categoría existe: ${catNombre}`)
        }
        catIdMap.set(catCodigo, cat.id)
      } else {
        console.log(`  [DRY] Categoría: ${catNombre}`)
        catIdMap.set(catCodigo, -1)
      }
      ordenCat++
    }
    ordenAct++
  }
  console.log()

  // 6. Crear inscripciones
  console.log('Procesando inscripciones...')
  const stats = { creadas: 0, existentes: 0, socioNoEncontrado: 0, catNoEncontrada: 0, errores: 0 }
  const noEncontrados = [] // lista de nroSocio no hallados

  for (const row of rows) {
    const actNombre = row['Actividad']?.toString().trim()
    const catNombre = row['Cat. Actividad']?.toString().trim()
    const nroSocioRaw = row['Nro Socio']

    if (!actNombre || !catNombre || !nroSocioRaw) continue

    const nroSocio   = nroSocioRaw.toString().trim()
    const actCodigo  = codigoActividad(actNombre)
    const catCodigo  = codigoCategoria(actCodigo, catNombre)
    const fechaInicio = excelDateToJS(row['Fecha de Alta Actividad'])
    const estado     = estadoInscripcion(row['Estado'])
    const becado     = siNo(row['Becado'])
    const federado   = siNo(row['Federado'])
    const porcentaje = parseFloat(row['Porcentaje']) || 100

    if (DRY_RUN) {
      console.log(`  [DRY] Socio ${nroSocio} → ${actNombre} / ${catNombre}`)
      stats.creadas++
      continue
    }

    // Buscar socio por nroSocio
    const socio = await prisma.socio.findFirst({ where: { nroSocio, tenantId } })
    if (!socio) {
      if (!noEncontrados.includes(nroSocio)) noEncontrados.push(nroSocio)
      stats.socioNoEncontrado++
      continue
    }

    // Obtener categoriaActividadId
    let categoriaActividadId = catIdMap.get(catCodigo)
    if (!categoriaActividadId) {
      // fallback: buscar en BD (por si ya existía antes del --reset)
      const cat = await prisma.categoriaActividad.findFirst({ where: { codigo: catCodigo, tenantId } })
      if (!cat) {
        console.warn(`  WARN: Categoría no encontrada: ${catCodigo}`)
        stats.catNoEncontrada++
        continue
      }
      categoriaActividadId = cat.id
      catIdMap.set(catCodigo, cat.id)
    }

    // Crear inscripción (evitar duplicados por unique constraint)
    try {
      await prisma.inscripcion.upsert({
        where: { socioId_categoriaActividadId_fechaInicio: { socioId: socio.id, categoriaActividadId, fechaInicio } },
        create: {
          tenantId,
          socioId: socio.id,
          categoriaActividadId,
          fechaInicio,
          estado,
          becado,
          federado,
          porcentajeCuota: porcentaje,
        },
        update: {
          estado,
          becado,
          federado,
          porcentajeCuota: porcentaje,
        }
      })
      stats.creadas++
    } catch (err) {
      console.error(`  ERROR socio ${nroSocio} / ${catCodigo}: ${err.message}`)
      stats.errores++
    }
  }

  // 7. Resumen
  console.log('\n' + '='.repeat(55))
  console.log('IMPORTACIÓN FINALIZADA')
  console.log('='.repeat(55))
  console.log(`Inscripciones creadas/actualizadas: ${stats.creadas}`)
  console.log(`Socios no encontrados:              ${stats.socioNoEncontrado}`)
  if (noEncontrados.length) console.log(`  Nros: ${noEncontrados.join(', ')}`)
  console.log(`Categorías no encontradas:          ${stats.catNoEncontrada}`)
  console.log(`Errores:                            ${stats.errores}`)

  if (!DRY_RUN) {
    const totalAct = await prisma.actividad.count({ where: { tenantId } })
    const totalCat = await prisma.categoriaActividad.count({ where: { tenantId } })
    const totalIns = await prisma.inscripcion.count({ where: { tenantId } })
    console.log(`\nTotales en BD (${TENANT_SLUG}):`)
    console.log(`  Actividades:   ${totalAct}`)
    console.log(`  Categorías:    ${totalCat}`)
    console.log(`  Inscripciones: ${totalIns}`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
