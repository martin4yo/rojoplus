/**
 * Script de importación de socios desde Socios.xlsx (Brio).
 *
 * NOTA: La importación recomendada es desde la UI (`/admin/socios` → Importar Excel).
 * Este script existe como alternativa para procesos automatizados.
 *
 * Ejecutar con: node scripts/importar-socios.js --tenant <slug>
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Separar apellido y nombre (copiado de routes/admin/socios.js)
function separarApellidoNombre(completo) {
  if (!completo) return { apellido: null, nombre: null }

  // Limpiar espacios múltiples
  const limpio = completo.trim().replace(/\s+/g, ' ')
  const partes = limpio.split(' ')

  if (partes.length === 1) {
    return { apellido: partes[0], nombre: null }
  }

  // Detectar si hay coma (formato "APELLIDO, NOMBRE")
  if (limpio.includes(',')) {
    const [apellido, ...resto] = limpio.split(',')
    return {
      apellido: apellido.trim(),
      nombre: resto.join(',').trim() || null
    }
  }

  // Sin coma: primera palabra es apellido, resto es nombre
  // Excepto casos comunes de apellidos compuestos
  const apellidosCompuestos = ['DE', 'DEL', 'DE LA', 'DE LOS', 'DE LAS', 'VAN', 'VON', 'MC', 'MAC', 'O\'']

  let apellido = partes[0]
  let indexNombre = 1

  // Verificar si hay apellido compuesto
  if (partes.length > 2) {
    const segundaParte = partes[1]?.toUpperCase()
    if (apellidosCompuestos.includes(segundaParte) ||
        apellidosCompuestos.includes(`${segundaParte} ${partes[2]?.toUpperCase()}`)) {
      apellido = `${partes[0]} ${partes[1]}`
      indexNombre = 2
      if (apellidosCompuestos.includes(`${segundaParte} ${partes[2]?.toUpperCase()}`)) {
        apellido = `${partes[0]} ${partes[1]} ${partes[2]}`
        indexNombre = 3
      }
    }
  }

  const nombre = partes.slice(indexNombre).join(' ') || null

  return { apellido, nombre }
}

// Convertir fecha serial de Excel a Date
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}

// Normalizar DNI
function normalizarDNI(dni) {
  if (!dni) return null
  return String(dni).replace(/\D/g, '')
}

// Mapear tipo documento
function mapearTipoDoc(tipo) {
  const tipos = {
    'DNI': 'DNI',
    'LC': 'LC',
    'LE': 'LE',
    'PASAPORTE': 'PASAPORTE',
  }
  return tipos[tipo?.toUpperCase()] || 'DNI'
}

// Mapear condición IVA
function mapearCondicionIVA(condicion) {
  const condiciones = {
    'RESPONSABLE INSCRIPTO': 1,
    'RESP INSCRIPTO': 1,
    'RI': 1,
    'MONOTRIBUTO': 6,
    'CONSUMIDOR FINAL': 5,
    'CF': 5,
    'EXENTO': 4,
  }
  return condiciones[condicion?.toUpperCase()] || 5 // Default: Consumidor Final
}

async function main() {
  // 0. Tenant
  const tenant = await resolveTenant(prisma, 'importar-socios.js')
  const tenantId = tenant.id

  console.log('\n🚀 Iniciando importación de socios desde Brio...\n')

  // 1. Leer el archivo Excel
  const filePath = path.join(__dirname, '..', '..', 'brio', 'Socios.xlsx')
  console.log(`📄 Leyendo archivo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allData = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  // Detectar dinámicamente la columna de PIN/RFID mirando la fila de headers reales.
  // El archivo tiene "SOCIOS ORDENADOS" como único header en fila 1,
  // y la fila 2 contiene los nombres reales de las columnas.
  const headersRow = allData[0] || {}
  let columnaPin = null
  for (const [key, value] of Object.entries(headersRow)) {
    const nombre = String(value || '').trim().toUpperCase()
    if (['PIN', 'RFID', 'TARJETA', 'CARNET', 'UID'].includes(nombre)) {
      columnaPin = key
      console.log(`🔑 Columna PIN/RFID detectada en "${key}" (header: "${value}")`)
      break
    }
  }
  if (!columnaPin) {
    console.warn('⚠️  No se detectó columna PIN/RFID en los headers. Los socios se importarán sin rfidUid.')
  }

  // La primera fila contiene los headers, empezar desde la segunda
  const data = allData.slice(1)

  console.log(`📊 Total de registros a procesar: ${data.length}\n`)

  // 2. Sincronizar tablas auxiliares
  // REGLA: Estado y Categoría se importan tal cual del Excel.
  //        TipoSocio tiene EXACTAMENTE 3 valores fijos del sistema (no viene del Excel):
  //          "Socio Unico" | "Titular Familia" | "Miembro Familia"
  //        La columna __EMPTY_14 del Excel es PARENTESCO (no TipoSocio) → va a parentescoTitular.
  console.log('📋 Sincronizando tablas auxiliares (estados, categorías, tipos)...')

  const estadosEnExcel    = [...new Set(data.map(r => String(r['__EMPTY_10'] || '').trim()).filter(Boolean))]
  const categoriasEnExcel = [...new Set(data.map(r => String(r['__EMPTY_9']  || '').trim()).filter(Boolean))]

  // EstadoSocio: crear los que no existan (tal cual del Excel)
  for (const est of estadosEnExcel) {
    const codigo = est.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existe = await prisma.estadoSocio.findFirst({ where: { tenantId, OR: [{ codigo }, { nombre: est }] } })
    if (!existe) {
      const pd = est.toUpperCase().includes('ACTIV') || est.toUpperCase().includes('VIGENT')
      await prisma.estadoSocio.create({ data: { tenantId, codigo, nombre: est, color: pd ? '#10B981' : '#9CA3AF', permiteDescuentos: pd } })
    }
  }
  const mapEstado = {}
  for (const e of await prisma.estadoSocio.findMany({ where: { tenantId } }))
    mapEstado[e.nombre] = e.id

  // CategoriaSocio: crear los que no existan (tal cual del Excel)
  for (const cat of categoriasEnExcel) {
    const codigo = cat.toUpperCase().replace(/\s+/g, '_').substring(0, 50)
    const existe = await prisma.categoriaSocio.findFirst({ where: { tenantId, OR: [{ codigo }, { nombre: cat }] } })
    if (!existe)
      await prisma.categoriaSocio.create({ data: { tenantId, codigo, nombre: cat, color: '#3B82F6' } })
  }
  const mapCategoria = {}
  for (const c of await prisma.categoriaSocio.findMany({ where: { tenantId } }))
    mapCategoria[c.nombre] = c.id

  // TipoSocio: garantizar los 3 valores fijos del sistema
  const TIPOS_SISTEMA = ['Socio Unico', 'Miembro Familia', 'Titular Familia']
  for (const nombre of TIPOS_SISTEMA) {
    const codigo = nombre.toUpperCase().replace(/\s+/g, '_')
    const existe = await prisma.tipoSocio.findFirst({ where: { tenantId, nombre } })
    if (!existe)
      await prisma.tipoSocio.create({ data: { tenantId, codigo, nombre, color: '#3B82F6' } })
  }
  const mapTipo = {}
  for (const t of await prisma.tipoSocio.findMany({ where: { tenantId } }))
    mapTipo[t.nombre] = t.id

  console.log(`   ✓ ${estadosEnExcel.length} estados, ${categoriasEnExcel.length} categorías, 3 tipos sistema\n`)

  // 3. Procesar socios
  console.log('👥 Importando socios...')

  let importados = 0
  let actualizados = 0
  let errores = 0
  const erroresDetalle = []

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    try {
      // Extraer campos del Excel de Brio (nombres exactos de columnas)
      const nroSocio = String(row['SOCIOS ORDENADOS'] || '').trim()

      if (!nroSocio) {
        errores++
        erroresDetalle.push({ fila: i + 2, error: 'Sin número de socio' })
        continue
      }

      // ApellidoNombre viene junto, necesitamos separar
      const apellidoNombre = String(row['__EMPTY'] || '').trim()
      const { apellido, nombre } = separarApellidoNombre(apellidoNombre)

      const tipoDoc = mapearTipoDoc(row['__EMPTY_24']) // Tipo Doc.
      const documento = normalizarDNI(row['__EMPTY_25']) // Documento
      const email = String(row['__EMPTY_30'] || '').trim().toLowerCase() || null // Email
      const emailSecundario = String(row['__EMPTY_45'] || '').trim().toLowerCase() || null // Email Secundario
      const telefono = String(row['__EMPTY_28'] || '').trim() || null // Telefono
      const celular = String(row['__EMPTY_29'] || '').trim() || null // Celular
      const domicilio = String(row['__EMPTY_27'] || '').trim() || null // Domicilio
      const ciudad = String(row['__EMPTY_31'] || '').trim() || null // Ciudad
      const provincia = String(row['__EMPTY_33'] || '').trim() || 'Buenos Aires' // Provincia
      const codigoPostal = String(row['__EMPTY_32'] || '').trim() || null // CP

      const fechaNacimiento = excelDateToJS(row['__EMPTY_2']) // Fecha Nac. (columna 3)
      const fechaAlta = excelDateToJS(row['__EMPTY_12']) // Fecha Alta (columna 13)
      const fechaBaja = excelDateToJS(row['__EMPTY_13']) // Fecha Baja (columna 14)

      // Respetar exactamente los valores del Excel
      const sexo     = String(row['__EMPTY_7']  || '').trim() || null // Sexo (columna 8)
      const zona     = String(row['__EMPTY_8']  || '').trim() || null // Zona (columna 9)
      const categoria = String(row['__EMPTY_9'] || '').trim() || null // Categoría (columna 10)
      const estadoRaw = String(row['__EMPTY_10'] || '').trim()        // Estado (columna 11)
      const estado    = estadoRaw || 'VIGENTE' // Respeta el valor del Excel; fallback si viene vacío

      // Columna 15 (__EMPTY_14) del Excel Brio = PARENTESCO familiar (no es TipoSocio)
      // El TipoSocio del sistema es siempre uno de: Socio Unico | Miembro Familia | Titular Familia
      const parentescoExcel = String(row['__EMPTY_14'] || '').trim() || null

      // TipoSocio: se determina por la estructura familiar, no por el Excel.
      // El script importar-grupos-familiares.js ajusta Titular/Miembro después.
      // Por defecto todos ingresan como "Socio Unico".
      const tipoSocio = 'Socio Unico'

      // Datos fiscales
      const condicionFiscal = String(row['__EMPTY_21'] || row['__EMPTY_40'] || '').trim() // Cond. Fiscal
      const cuil = normalizarDNI(row['__EMPTY_26']) // CUIT/CUIL
      const obraSocial = String(row['__EMPTY_35'] || '').trim() || null // Obra Social
      const profesion = String(row['__EMPTY_36'] || '').trim() || null // Profesión
      const libro = String(row['__EMPTY_37'] || '').trim() || null // Libro
      const folio = String(row['__EMPTY_38'] || '').trim() || null // Folio
      const grupoSanguineo = String(row['__EMPTY_46'] || '').trim() || null // Grupo Sanguíneo
      const factorRh = String(row['__EMPTY_47'] || '').trim() || null // Factor RH

      // Observaciones
      const observaciones = String(row['__EMPTY_39'] || '').trim() || null // Observacion

      // PIN / RFID UID del carnet que lee el molinete
      let rfidUid = null
      if (columnaPin) {
        const raw = row[columnaPin]
        const val = String(raw ?? '').trim()
        // Ignorar vacíos, 0 o guiones
        if (val && val !== '0' && val !== '-' && val.toLowerCase() !== 'null') {
          rfidUid = val
          // Verificar que no esté asignado a otro socio distinto del MISMO tenant
          const conflictivo = await prisma.socio.findFirst({
            where: { tenantId, rfidUid, NOT: { nroSocio } },
            select: { nroSocio: true }
          })
          if (conflictivo) {
            console.warn(`   ⚠️  PIN "${rfidUid}" de socio ${nroSocio} ya está asignado al socio ${conflictivo.nroSocio}. Se importa socio sin PIN.`)
            rfidUid = null
          }
        }
      }

      // Validaciones básicas
      if (!nombre || !apellido) {
        errores++
        erroresDetalle.push({
          fila: i + 2,
          nroSocio,
          error: 'Sin nombre o apellido'
        })
        continue
      }

      // Verificar si ya existe en este tenant
      const socioExistente = await prisma.socio.findUnique({
        where: { tenantId_nroSocio: { tenantId, nroSocio } }
      })

      // Crear apellidoNombre combinado (requerido por el schema)
      const apellidoNombreCompleto = apellido ? `${apellido}${nombre ? ', ' + nombre : ''}` : nombre

      if (socioExistente) {
        // Actualizar (solo se pisa el rfidUid si viene un valor; si no, se conserva el existente)
        await prisma.socio.update({
          where: { id: socioExistente.id },
          data: {
            apellidoNombre: apellidoNombreCompleto,
            nombre,
            apellido,
            tipoDocumento: tipoDoc,
            documento,
            email,
            emailSecundario,
            telefonoFijo: telefono,
            celular,
            domicilio,
            ciudad,
            provincia,
            codigoPostal,
            fechaNacimiento,
            fechaAlta,
            fechaBaja,
            estado,
            condicionFiscal,
            cuil,
            sexo,
            zona,
            categoria,
            tipoSocio,
            parentescoTitular: parentescoExcel,
            obraSocial,
            profesion,
            libro,
            folio,
            grupoSanguineo,
            factorRh,
            observaciones,
            ...(rfidUid && { rfidUid }),
            // IDs FK a tablas de parámetros
            ...(estado    && mapEstado[estado]       && { estadoSocioId:    mapEstado[estado] }),
            ...(categoria && mapCategoria[categoria] && { categoriaSocioId: mapCategoria[categoria] }),
            tipoSocioRelId: mapTipo['Socio Unico'],
          }
        })
        actualizados++
      } else {
        // Crear nuevo
        await prisma.socio.create({
          data: {
            tenantId,
            nroSocio,
            apellidoNombre: apellidoNombreCompleto,
            nombre,
            apellido,
            tipoDocumento: tipoDoc,
            documento,
            email,
            emailSecundario,
            telefonoFijo: telefono,
            celular,
            domicilio,
            ciudad,
            provincia,
            codigoPostal,
            fechaNacimiento,
            fechaAlta,
            fechaBaja,
            estado,
            condicionFiscal,
            cuil,
            sexo,
            zona,
            categoria,
            tipoSocio,
            obraSocial,
            profesion,
            libro,
            folio,
            grupoSanguineo,
            factorRh,
            observaciones,
            rfidUid,
            parentescoTitular: parentescoExcel,
            // IDs FK a tablas de parámetros
            ...(estado    && mapEstado[estado]       && { estadoSocioId:    mapEstado[estado] }),
            ...(categoria && mapCategoria[categoria] && { categoriaSocioId: mapCategoria[categoria] }),
            tipoSocioRelId: mapTipo['Socio Unico'],
          }
        })
        importados++
      }

      // Progreso
      if ((i + 1) % 100 === 0) {
        const progreso = Math.round(((i + 1) / data.length) * 100)
        process.stdout.write(`\r   Progreso: ${progreso}% (${importados} nuevos, ${actualizados} actualizados, ${errores} errores)`)
      }

    } catch (error) {
      errores++
      erroresDetalle.push({
        fila: i + 2,
        nroSocio: row['Nro. Socio'] || row['NroSocio'],
        error: error.message
      })
    }
  }

  console.log('\n')

  // 3. Resumen final
  console.log('=' .repeat(50))
  console.log('📊 RESUMEN DE IMPORTACIÓN')
  console.log('=' .repeat(50))
  console.log(`   Total en Excel:      ${data.length}`)
  console.log(`   Importados (nuevos): ${importados}`)
  console.log(`   Actualizados:        ${actualizados}`)
  console.log(`   Errores:             ${errores}`)
  console.log('=' .repeat(50))

  if (erroresDetalle.length > 0 && erroresDetalle.length <= 10) {
    console.log('\n❌ ERRORES ENCONTRADOS:')
    erroresDetalle.forEach(e => {
      console.log(`   Fila ${e.fila} (Socio ${e.nroSocio || 'N/A'}): ${e.error}`)
    })
  } else if (erroresDetalle.length > 10) {
    console.log(`\n❌ ${erroresDetalle.length} errores encontrados. Mostrando primeros 10:`)
    erroresDetalle.slice(0, 10).forEach(e => {
      console.log(`   Fila ${e.fila} (Socio ${e.nroSocio || 'N/A'}): ${e.error}`)
    })
  }

  // 4. Estadísticas de la BD
  const totalSocios = await prisma.socio.count()
  const sociosActivos = await prisma.socio.count({ where: { estado: 'ACTIVO' } })

  console.log('\n📈 ESTADO DE LA BASE DE DATOS')
  console.log('=' .repeat(50))
  console.log(`   Total socios:        ${totalSocios}`)
  console.log(`   Activos:             ${sociosActivos}`)
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
