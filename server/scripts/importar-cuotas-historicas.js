/**
 * Script para importar cuotas históricas desde Brio.
 *
 * NOTA: para el flujo de migración Brio recomendado, usar `importar-cuotas.js` que es más
 * completo. Este script existe para casos puntuales de carga histórica masiva.
 *
 * Uso: node scripts/importar-cuotas-historicas.js --tenant <slug>
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Mapeo de categorías
const CATEGORIA_MAP = {
  'CUOTA SOCIAL': 'CUOTA_SOCIAL',
  'ACTIVIDAD': 'CUOTA_ACTIVIDAD',
  'CONCEPTO': 'CARNET', // Por defecto, se refina después
  'FINANCIADO': 'FINANCIACION',
  'MOROSIDAD': 'MOROSIDAD',
}

// Mapeo de estados
const ESTADO_MAP = {
  'PAGADA': 'PAGADO',
  'PENDIENTE': 'PENDIENTE',
  'NOTA DE CRÉDITO': 'ANULADO', // Se tratará como cargo negativo
  'FINANCIADO': 'PENDIENTE',
}

// Mapeo de tipoCuota para CUOTA_SOCIAL
const TIPO_CUOTA_MAP = {
  'GRUPO FAMILIAR': 'GRUPO_FAMILIAR',
  'ACTIVO': 'SOCIO_UNICO',
  'ACTIVO 2': 'SOCIO_UNICO',
  'CADETE': 'SOCIO_UNICO',
  'INFANTIL': 'SOCIO_UNICO',
}

// Convertir fecha de Excel a Date
function excelDateToJS(excelDate) {
  if (!excelDate) return null
  if (typeof excelDate === 'string') {
    // Si es string tipo "01/2020", crear fecha del primer día del mes
    const match = excelDate.match(/^(\d{2})\/(\d{4})$/)
    if (match) {
      return new Date(parseInt(match[2]), parseInt(match[1]) - 1, 1)
    }
    return new Date(excelDate)
  }
  // Número de Excel (días desde 1/1/1900)
  const date = new Date((excelDate - 25569) * 86400 * 1000)
  return date
}

// Parsear periodo "MM/YYYY" a {anio, mes}
function parsePeriodo(periodoStr) {
  if (!periodoStr) return null
  const match = periodoStr.match(/^(\d{2})\/(\d{4})$/)
  if (!match) return null
  return {
    mes: parseInt(match[1]),
    anio: parseInt(match[2]),
  }
}

// Parsear "ACTIVIDAD - CATEGORIA"
function parseActividadCategoria(descCuota) {
  if (!descCuota) return { actividad: null, categoria: null }
  const parts = descCuota.split(' - ')
  if (parts.length >= 2) {
    return {
      actividad: parts[0].trim(),
      categoria: parts.slice(1).join(' - ').trim(),
    }
  }
  return { actividad: descCuota.trim(), categoria: null }
}

async function main() {
  console.log('=== Importación de Cuotas Históricas ===\n')

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await resolveTenant(prisma, 'importar-cuotas-historicas.js')
  const tenantId = tenant.id

  // 0. Verificar si ya hay cargos en la BD del tenant
  const cargosExistentes = await prisma.cargo.count({ where: { tenantId } })
  if (cargosExistentes > 0) {
    console.log(`⚠️  Ya existen ${cargosExistentes} cargos en este tenant.`)
    console.log(`   Si deseas reimportar, primero ejecutá:`)
    console.log(`     DELETE FROM cargos WHERE tenant_id = ${tenantId};`)
    console.log('   Abortando importación.\n')
    return
  }

  // 1. Leer archivo Excel
  console.log('Leyendo archivo Cuotas.xlsx...')
  const filePath = path.join(__dirname, '../../Brio/Cuotas.xlsx')
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  // Headers en fila 3 (índice 2), datos desde fila 4
  const headers = data[2]
  const rows = data.slice(3).filter(row => row[4]) // Filtrar filas sin nroSocio

  console.log(`Total de registros a procesar: ${rows.length}`)

  // 2. Cargar socios existentes (con info de familia) del tenant
  console.log('\nCargando socios...')
  const socios = await prisma.socio.findMany({
    where: { tenantId },
    select: { id: true, nroSocio: true, titularFamiliaId: true },
  })
  // Crear mapa con nroSocio como string Y como número para coincidir con ambos formatos
  const socioMap = new Map()
  socios.forEach(s => {
    const data = { id: s.id, grupoFamiliarId: s.titularFamiliaId || s.id }
    socioMap.set(s.nroSocio, data) // String
    socioMap.set(parseInt(s.nroSocio), data) // Número
    socioMap.set(String(s.nroSocio), data) // String explícito
  })
  console.log(`Socios cargados: ${socios.length}`)

  // 3. Cargar actividades y categorías del tenant
  console.log('Cargando actividades y categorías...')
  const actividades = await prisma.actividad.findMany({
    where: { tenantId },
    include: { categorias: true },
  })

  // Crear mapa de búsqueda por nombre (normalizado)
  const actividadMap = new Map()
  const categoriaMap = new Map()

  actividades.forEach(act => {
    const nombreNorm = act.nombre.toUpperCase().trim()
    actividadMap.set(nombreNorm, act.id)

    act.categorias.forEach(cat => {
      const catNorm = cat.nombre.toUpperCase().trim()
      // Clave compuesta: "ACTIVIDAD|CATEGORIA"
      categoriaMap.set(`${nombreNorm}|${catNorm}`, cat.id)
      // También solo por nombre de categoría
      categoriaMap.set(catNorm, cat.id)
    })
  })
  console.log(`Actividades: ${actividades.length}, Categorías: ${categoriaMap.size}`)

  // 4. Crear/obtener periodos
  console.log('\nCreando periodos...')
  const periodosUnicos = new Set()
  rows.forEach(row => {
    if (row[9]) periodosUnicos.add(row[9])
  })

  const periodosExistentes = await prisma.periodo.findMany()
  const periodoMap = new Map(periodosExistentes.map(p => [`${String(p.mes).padStart(2, '0')}/${p.anio}`, p.id]))

  // Mapa de fechas de vencimiento por periodo
  const periodoVencimientoMap = new Map(periodosExistentes.map(p => [p.id, p.fechaVencimiento]))

  let periodosCreados = 0
  for (const periodoStr of periodosUnicos) {
    const parsed = parsePeriodo(periodoStr)
    if (!parsed) continue

    const key = `${String(parsed.mes).padStart(2, '0')}/${parsed.anio}`
    if (!periodoMap.has(key)) {
      const fechaVencimiento = new Date(parsed.anio, parsed.mes, 10) // Día 10 del mes siguiente
      const periodo = await prisma.periodo.create({
        data: {
          anio: parsed.anio,
          mes: parsed.mes,
          nombre: `${['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][parsed.mes]} ${parsed.anio}`,
          fechaVencimiento,
          estado: 'GENERADO',
        },
      })
      periodoMap.set(key, periodo.id)
      periodoVencimientoMap.set(periodo.id, fechaVencimiento)
      periodosCreados++
    }
  }
  console.log(`Periodos creados: ${periodosCreados}, Total: ${periodoMap.size}`)

  // 5. Procesar cuotas
  console.log('\nProcesando cuotas...')

  const stats = {
    total: 0,
    importadas: 0,
    sinSocio: 0,
    sinPeriodo: 0,
    errores: 0,
    porCategoria: {},
    porEstado: {},
  }

  const batchSize = 1000
  const cargosToCreate = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    stats.total++

    try {
      // Columnas según análisis:
      // 0: Fecha Gen, 1: Forma Pago, 2: Cobrador, 3: Medio de Pago
      // 4: Nro. Socio, 5: Apellido Nombre, 6: Celular, 7: Categ. Socio
      // 8: Tipo Cuota, 9: Periodo, 10: Desc. Cuota, 11: Precio
      // 12: Porc. Cuota, 13: Importe Real, 14: Estado, 15: Generado
      // 16: Est. Cuota, 17: Fecha Cobro, 18: Caja, 19: Usuario
      // 20: Nro. Cuenta, 21: Nombre

      const nroSocio = row[4]
      const tipoCuotaOrig = row[8]
      const periodoStr = row[9]
      const descCuota = row[10]
      const precio = parseFloat(row[11]) || 0
      const porcCuota = parseFloat(row[12]) || 1
      const importeReal = parseFloat(row[13]) || precio
      const estCuota = row[16]
      const fechaCobro = row[17]

      // Buscar socio
      const socioData = socioMap.get(nroSocio)
      if (!socioData) {
        stats.sinSocio++
        continue
      }
      const { id: socioId, grupoFamiliarId } = socioData

      // Buscar periodo
      const periodoId = periodoMap.get(periodoStr)
      if (!periodoId) {
        stats.sinPeriodo++
        continue
      }
      const fechaVencimiento = periodoVencimientoMap.get(periodoId) || new Date()

      // Determinar categoría
      let categoria = CATEGORIA_MAP[tipoCuotaOrig] || 'CUOTA_SOCIAL'
      let tipoCuota = null
      let categoriaActividadId = null
      let descripcion = descCuota

      // Lógica específica por tipo
      if (tipoCuotaOrig === 'CUOTA SOCIAL') {
        tipoCuota = TIPO_CUOTA_MAP[descCuota] || 'SOCIO_UNICO'
        descripcion = null // No necesita descripción adicional
      }
      else if (tipoCuotaOrig === 'ACTIVIDAD') {
        const { actividad, categoria: catNombre } = parseActividadCategoria(descCuota)

        // Intentar encontrar la categoría de actividad
        if (actividad && catNombre) {
          const actNorm = actividad.toUpperCase()
          const catNorm = catNombre.toUpperCase()

          // Buscar por combinación
          categoriaActividadId = categoriaMap.get(`${actNorm}|${catNorm}`)

          // Si no encuentra, buscar solo por categoría
          if (!categoriaActividadId) {
            categoriaActividadId = categoriaMap.get(catNorm)
          }
        }

        descripcion = descCuota // Guardar como descripción si no se encontró
      }
      else if (tipoCuotaOrig === 'CONCEPTO') {
        // Si empieza con CARNET, es categoría CARNET
        if (descCuota && descCuota.toUpperCase().startsWith('CARNET')) {
          categoria = 'CARNET'
        } else {
          // Otros conceptos, mantener descripción
          categoria = 'CARNET' // O crear otra categoría si es necesario
        }
      }
      else if (tipoCuotaOrig === 'MOROSIDAD') {
        // La morosidad puede ser de cuota social o actividad
        // Guardar descripción para saber de qué era
      }

      // Determinar estado
      let estado = ESTADO_MAP[estCuota] || 'PENDIENTE'
      let montoOriginal = importeReal

      // Si es nota de crédito, hacer monto negativo
      if (estCuota === 'NOTA DE CRÉDITO') {
        categoria = 'NOTA_CREDITO'
        montoOriginal = -Math.abs(importeReal)
        estado = 'PAGADO' // Las notas de crédito ya están aplicadas
      }

      // Calcular fecha de pago
      let fechaPago = null
      if (estado === 'PAGADO' && fechaCobro) {
        fechaPago = excelDateToJS(fechaCobro)
      }

      // Crear objeto cargo
      const cargo = {
        tenantId,
        periodoId,
        socioId,
        grupoFamiliarId,
        categoria,
        tipoCuota,
        categoriaActividadId,
        descripcion: descripcion || null,
        montoOriginal,
        montoRecargo: 0,
        montoBonificacion: 0,
        montoTotal: montoOriginal,
        estado,
        fechaVencimiento,
        fechaPago,
      }

      cargosToCreate.push(cargo)

      // Estadísticas
      stats.porCategoria[categoria] = (stats.porCategoria[categoria] || 0) + 1
      stats.porEstado[estado] = (stats.porEstado[estado] || 0) + 1

      // Insertar en batches
      if (cargosToCreate.length >= batchSize) {
        await prisma.cargo.createMany({ data: cargosToCreate })
        stats.importadas += cargosToCreate.length
        console.log(`  Procesados: ${stats.total}/${rows.length} (${Math.round(stats.total/rows.length*100)}%)`)
        cargosToCreate.length = 0
      }

    } catch (error) {
      stats.errores++
      if (stats.errores <= 5) {
        console.error(`Error en fila ${i + 4}:`, error.message)
      }
    }
  }

  // Insertar último batch
  if (cargosToCreate.length > 0) {
    await prisma.cargo.createMany({ data: cargosToCreate })
    stats.importadas += cargosToCreate.length
  }

  // 6. Mostrar resumen
  console.log('\n=== RESUMEN DE IMPORTACIÓN ===')
  console.log(`Total registros: ${stats.total}`)
  console.log(`Importadas: ${stats.importadas}`)
  console.log(`Sin socio: ${stats.sinSocio}`)
  console.log(`Sin periodo: ${stats.sinPeriodo}`)
  console.log(`Errores: ${stats.errores}`)
  console.log('\nPor categoría:')
  Object.entries(stats.porCategoria).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`)
  })
  console.log('\nPor estado:')
  Object.entries(stats.porEstado).forEach(([est, count]) => {
    console.log(`  ${est}: ${count}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
