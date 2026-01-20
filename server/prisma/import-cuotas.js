/**
 * Script de importación de cuotas históricas desde Cuotas.xlsx
 *
 * Ejecutar con: node prisma/import-cuotas.js
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Mapeo de categorías del Excel a nuestro modelo
const CATEGORIA_MAP = {
  'CUOTA SOCIAL': 'CUOTA_SOCIAL',
  'ACTIVIDAD': 'ACTIVIDAD',
  'CONCEPTO': 'CONCEPTO',
  'MOROSIDAD': 'MOROSIDAD',
  'FINANCIADO': 'FINANCIADO',
}

// Mapeo de estados del Excel a nuestro modelo
const ESTADO_MAP = {
  'PAGADA': 'PAGADO',
  'PENDIENTE': 'PENDIENTE',
  'NOTA DE CRÉDITO': 'NOTA_CREDITO',
  'FINANCIADO': 'PENDIENTE', // Los financiados son pendientes hasta que se paguen
}

// Convertir fecha serial de Excel a Date
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}

// Parsear periodo "MM/YYYY" a {mes, anio}
function parsePeriodo(periodoStr) {
  if (!periodoStr) return null
  const [mes, anio] = periodoStr.split('/')
  return {
    mes: parseInt(mes),
    anio: parseInt(anio),
    nombre: periodoStr,
  }
}

async function main() {
  console.log('🚀 Iniciando importación de cuotas históricas...\n')

  // 1. Leer el archivo Excel
  const filePath = path.join(__dirname, '..', '..', 'brio', 'Cuotas.xlsx')
  console.log(`📄 Leyendo archivo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  // Headers en fila 2 (índice 2), datos desde fila 3
  const headers = data[2]
  const rows = data.slice(3).filter(row => row.length > 0 && row[4]) // Filtrar filas vacías y sin nro socio

  console.log(`📊 Total de registros a procesar: ${rows.length}\n`)

  // 2. Obtener todos los socios para mapear nroSocio -> id
  console.log('👥 Cargando socios...')
  const socios = await prisma.socio.findMany({
    select: { id: true, nroSocio: true, titularFamiliaId: true }
  })
  const socioMap = new Map()
  socios.forEach(s => socioMap.set(s.nroSocio, s))
  console.log(`   ${socios.length} socios cargados`)

  // 3. Obtener actividades y categorías existentes
  console.log('🏃 Cargando actividades...')
  const actividades = await prisma.actividad.findMany({
    include: { categorias: true }
  })
  console.log(`   ${actividades.length} actividades cargadas`)

  // 4. Extraer conceptos únicos del Excel
  console.log('\n📋 Extrayendo conceptos del Excel...')
  const conceptosSet = new Map() // key: "TIPO|DESC" -> { tipoCuota, descCuota, cuentaContable }

  rows.forEach(row => {
    const tipoCuota = row[8] // CUOTA SOCIAL, ACTIVIDAD, CONCEPTO, MOROSIDAD, FINANCIADO
    const descCuota = row[10] // ACTIVO, CARNET, BASQUET - BASQUET CADETE, etc.
    const cuentaContable = row[20] // Nro. Cuenta

    if (tipoCuota && descCuota) {
      const key = `${tipoCuota}|${descCuota}`
      if (!conceptosSet.has(key)) {
        conceptosSet.set(key, { tipoCuota, descCuota, cuentaContable })
      }
    }
  })

  console.log(`   ${conceptosSet.size} conceptos únicos encontrados`)

  // 5. Crear los ConceptoCargo en la BD
  console.log('\n💾 Creando conceptos en la base de datos...')
  const conceptoCargoMap = new Map() // key: "TIPO|DESC" -> id

  let orden = 0
  for (const [key, data] of conceptosSet) {
    const categoria = CATEGORIA_MAP[data.tipoCuota] || 'CONCEPTO'
    let codigo = data.descCuota.toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_-]/g, '')
      .substring(0, 50)

    // Agregar prefijo para evitar duplicados entre categorías
    if (categoria !== 'CUOTA_SOCIAL') {
      codigo = `${categoria.substring(0, 3)}_${codigo}`
    }

    // Verificar si ya existe
    let conceptoCargo = await prisma.conceptoCargo.findUnique({
      where: { codigo }
    })

    if (!conceptoCargo) {
      try {
        conceptoCargo = await prisma.conceptoCargo.create({
          data: {
            codigo,
            nombre: data.descCuota,
            categoria,
            recurrencia: categoria === 'MOROSIDAD' ? 'AUTOMATICO' :
                        (categoria === 'CONCEPTO' ? 'UNICO' : 'MENSUAL'),
            generaEnMasivo: categoria === 'CUOTA_SOCIAL' || categoria === 'ACTIVIDAD',
            cuentaContable: data.cuentaContable || null,
            activo: true,
            orden: orden++,
          }
        })
        console.log(`   ✅ Creado: ${conceptoCargo.codigo} (${categoria})`)
      } catch (err) {
        // Si hay error de código duplicado, agregar sufijo
        codigo = `${codigo}_${Date.now()}`
        conceptoCargo = await prisma.conceptoCargo.create({
          data: {
            codigo,
            nombre: data.descCuota,
            categoria,
            recurrencia: categoria === 'MOROSIDAD' ? 'AUTOMATICO' :
                        (categoria === 'CONCEPTO' ? 'UNICO' : 'MENSUAL'),
            generaEnMasivo: categoria === 'CUOTA_SOCIAL' || categoria === 'ACTIVIDAD',
            cuentaContable: data.cuentaContable || null,
            activo: true,
            orden: orden++,
          }
        })
        console.log(`   ✅ Creado (con sufijo): ${conceptoCargo.codigo}`)
      }
    }

    conceptoCargoMap.set(key, conceptoCargo.id)
  }

  // 6. Crear los Periodos
  console.log('\n📅 Creando periodos...')
  const periodosSet = new Set()
  rows.forEach(row => {
    const periodo = row[9] // "MM/YYYY"
    if (periodo) periodosSet.add(periodo)
  })

  const periodoMap = new Map() // key: "MM/YYYY" -> id

  for (const periodoStr of periodosSet) {
    const p = parsePeriodo(periodoStr)
    if (!p) continue

    let periodo = await prisma.periodo.findUnique({
      where: { anio_mes: { anio: p.anio, mes: p.mes } }
    })

    if (!periodo) {
      // Crear fecha de vencimiento (día 10 del mes)
      const fechaVencimiento = new Date(p.anio, p.mes - 1, 10)

      periodo = await prisma.periodo.create({
        data: {
          anio: p.anio,
          mes: p.mes,
          nombre: p.nombre,
          fechaVencimiento,
          estado: 'GENERADO',
        }
      })
      console.log(`   ✅ Periodo: ${periodo.nombre}`)
    }

    periodoMap.set(periodoStr, periodo.id)
  }

  console.log(`   ${periodoMap.size} periodos creados/verificados`)

  // 7. Mapear categorías de actividad del Excel
  console.log('\n🎯 Mapeando categorías de actividad...')
  const categoriaActividadMap = new Map() // key: "ACTIVIDAD - CATEGORIA" -> id

  // Extraer todas las descripciones de actividad del Excel
  const actividadesExcel = new Set(
    rows
      .filter(row => row[8] === 'ACTIVIDAD')
      .map(row => row[10])
      .filter(Boolean)
  )

  for (const descActividad of actividadesExcel) {
    // El formato es "ACTIVIDAD - CATEGORIA" ej: "BASQUET - BASQUET CADETE"
    const parts = descActividad.split(' - ')
    if (parts.length >= 2) {
      const actNombre = parts[0].trim()
      const catNombre = parts.slice(1).join(' - ').trim()

      // Buscar la actividad
      const actividad = actividades.find(a =>
        a.nombre.toUpperCase() === actNombre.toUpperCase() ||
        a.codigo.toUpperCase() === actNombre.toUpperCase()
      )

      if (actividad) {
        // Buscar la categoría dentro de la actividad
        const categoria = actividad.categorias.find(c =>
          c.nombre.toUpperCase() === catNombre.toUpperCase() ||
          c.nombre.toUpperCase().includes(catNombre.toUpperCase()) ||
          catNombre.toUpperCase().includes(c.nombre.toUpperCase())
        )

        if (categoria) {
          categoriaActividadMap.set(descActividad, categoria.id)
        }
      }
    }
  }

  console.log(`   ${categoriaActividadMap.size} categorías mapeadas de ${actividadesExcel.size} encontradas`)

  // 8. Importar los cargos en lotes
  console.log('\n📥 Importando cargos...')

  const BATCH_SIZE = 1000
  let importados = 0
  let errores = 0
  let sinSocio = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const cargosToCreate = []

    for (const row of batch) {
      const nroSocio = String(row[4])
      const socio = socioMap.get(nroSocio)

      if (!socio) {
        sinSocio++
        continue
      }

      const tipoCuota = row[8]
      const descCuota = row[10]
      const periodoStr = row[9]
      const importe = Number(row[13]) || 0 // Importe Real
      const estadoExcel = row[16] // Est. Cuota
      const fechaGen = excelDateToJS(row[0])
      const fechaCobro = excelDateToJS(row[17])

      const key = `${tipoCuota}|${descCuota}`
      const conceptoCargoId = conceptoCargoMap.get(key)
      const periodoId = periodoMap.get(periodoStr)

      if (!conceptoCargoId) {
        errores++
        continue
      }

      // Determinar estado
      let estado = ESTADO_MAP[estadoExcel] || 'PENDIENTE'

      // Si el importe es negativo, es una nota de crédito
      if (importe < 0) {
        estado = 'NOTA_CREDITO'
      }

      // Determinar grupo familiar
      const grupoFamiliarId = socio.titularFamiliaId || socio.id

      // Categoría de actividad (si aplica)
      const categoriaActividadId = tipoCuota === 'ACTIVIDAD'
        ? categoriaActividadMap.get(descCuota) || null
        : null

      cargosToCreate.push({
        periodoId,
        socioId: socio.id,
        grupoFamiliarId,
        conceptoCargoId,
        categoriaActividadId,
        descripcion: descCuota,
        montoOriginal: Math.abs(importe),
        montoRecargo: 0,
        montoBonificacion: 0,
        montoTotal: importe,
        estado,
        fechaGeneracion: fechaGen || new Date(),
        fechaVencimiento: periodoId ? null : new Date(), // Si hay periodo, tomará del periodo
        fechaPago: estado === 'PAGADO' ? fechaCobro : null,
        origen: 'IMPORTACION',
      })
    }

    if (cargosToCreate.length > 0) {
      await prisma.cargo.createMany({
        data: cargosToCreate,
        skipDuplicates: true,
      })
      importados += cargosToCreate.length
    }

    // Progreso
    const progreso = Math.min(100, Math.round(((i + batch.length) / rows.length) * 100))
    process.stdout.write(`\r   Progreso: ${progreso}% (${importados} importados, ${errores} errores, ${sinSocio} sin socio)`)
  }

  console.log('\n')

  // 9. Resumen final
  console.log('=' .repeat(50))
  console.log('📊 RESUMEN DE IMPORTACIÓN')
  console.log('=' .repeat(50))
  console.log(`   Total en Excel:      ${rows.length}`)
  console.log(`   Importados:          ${importados}`)
  console.log(`   Errores:             ${errores}`)
  console.log(`   Sin socio:           ${sinSocio}`)
  console.log(`   Conceptos creados:   ${conceptosSet.size}`)
  console.log(`   Periodos creados:    ${periodoMap.size}`)
  console.log('=' .repeat(50))

  // 10. Estadísticas de la BD
  const totalCargos = await prisma.cargo.count()
  const cargosPendientes = await prisma.cargo.count({ where: { estado: 'PENDIENTE' } })
  const cargosPagados = await prisma.cargo.count({ where: { estado: 'PAGADO' } })

  console.log('\n📈 ESTADO DE LA BASE DE DATOS')
  console.log('=' .repeat(50))
  console.log(`   Total cargos:        ${totalCargos}`)
  console.log(`   Pendientes:          ${cargosPendientes}`)
  console.log(`   Pagados:             ${cargosPagados}`)
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
