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

// Contador global de fechas que no se pudieron parsear (para reportar al final)
const _fechasNoParseadas = { total: 0, samples: new Map() }

// Convertir fecha desde Excel a Date.
// Acepta: number (serial), Date, o string con varios formatos comunes (dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, dd.mm.yyyy).
// Devuelve null si no se puede parsear y registra la muestra para warning final.
//
// @param {*} val      - valor de la celda
// @param {string} [tag] - etiqueta del campo (ej: "fechaAlta") para diagnóstico
function excelDateToJS(val, tag = 'fecha') {
  if (val === null || val === undefined || val === '') return null

  // Date directo
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }

  // Number → serial Excel
  if (typeof val === 'number') {
    if (val <= 0) return null
    const utc_days = Math.floor(val - 25569)
    return new Date(utc_days * 86400 * 1000)
  }

  // String
  const s = String(val).trim()
  if (!s) return null
  const sLower = s.toLowerCase()
  if (sLower === '0' || sLower === '-' || sLower === 'null' || sLower === 'undefined' || sLower === 'n/a') {
    return null
  }

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (con o sin ceros, año 2 o 4 dígitos)
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/)
  if (m) {
    let [, d, mo, y] = m
    d = parseInt(d, 10); mo = parseInt(mo, 10); y = parseInt(y, 10)
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, mo - 1, d)
      if (!isNaN(date.getTime())) return date
    }
  }

  // yyyy-mm-dd (ISO)
  const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (iso) {
    const y = parseInt(iso[1], 10), mo = parseInt(iso[2], 10), d = parseInt(iso[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, mo - 1, d)
      if (!isNaN(date.getTime())) return date
    }
  }

  // Fallback: parser nativo
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed

  // Registrar muestra para warning final (sin spamear consola)
  _fechasNoParseadas.total++
  if (!_fechasNoParseadas.samples.has(tag)) {
    _fechasNoParseadas.samples.set(tag, { count: 0, samples: [] })
  }
  const bucket = _fechasNoParseadas.samples.get(tag)
  bucket.count++
  if (bucket.samples.length < 3) bucket.samples.push(s)
  return null
}

// Imprime un resumen de las fechas que no se pudieron parsear.
// Llamar al final del script.
function reportarFechasNoParseadas() {
  if (_fechasNoParseadas.total === 0) return
  console.warn(`\n⚠️  ${_fechasNoParseadas.total} fechas no se pudieron parsear y quedaron como NULL:`)
  for (const [tag, info] of _fechasNoParseadas.samples) {
    console.warn(`   • ${tag}: ${info.count} ocurrencias. Ejemplos: ${info.samples.map(s => `"${s}"`).join(', ')}`)
  }
  console.warn('   Verificá el formato de la columna en el Excel original.\n')
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

  // El archivo tiene "SOCIOS ORDENADOS" como único header en fila 1.
  // La fila 2 contiene los nombres reales de las columnas.
  // Construimos un mapa header→key para acceder por nombre y evitar shifts por columna.
  const headersRow = allData[0] || {}
  const headerToKey = {}
  for (const [key, value] of Object.entries(headersRow)) {
    const nombre = String(value || '').trim()
    if (nombre) headerToKey[nombre.toLowerCase()] = key
  }

  // Helper para acceder por nombre de header (case-insensitive). Si no existe, fallback null.
  const getCol = (row, headerName) => {
    const key = headerToKey[headerName.toLowerCase()]
    return key !== undefined ? row[key] : undefined
  }

  // Detectar la columna de PIN/RFID por nombre conocido
  let columnaPin = null
  for (const candidato of ['PIN', 'RFID', 'TARJETA', 'CARNET', 'UID']) {
    const k = headerToKey[candidato.toLowerCase()]
    if (k) {
      columnaPin = k
      console.log(`🔑 Columna PIN/RFID detectada en "${k}" (header: "${candidato}")`)
      break
    }
  }
  if (!columnaPin) {
    console.warn('⚠️  No se detectó columna PIN/RFID en los headers. Los socios se importarán sin rfidUid.')
  }

  console.log(`📋 Headers detectados: ${Object.keys(headerToKey).length} columnas`)

  // La primera fila contiene los headers, empezar desde la segunda
  const data = allData.slice(1)

  console.log(`📊 Total de registros a procesar: ${data.length}\n`)

  // 2. Sincronizar tablas auxiliares
  // REGLA: Estado y Categoría se importan tal cual del Excel.
  //        TipoSocio tiene EXACTAMENTE 3 valores fijos del sistema (no viene del Excel):
  //          "Socio Unico" | "Titular Familia" | "Miembro Familia"
  //        La columna __EMPTY_14 del Excel es PARENTESCO (no TipoSocio) → va a parentescoTitular.
  console.log('📋 Sincronizando tablas auxiliares (estados, categorías, tipos)...')

  const estadosEnExcel    = [...new Set(data.map(r => String(getCol(r, 'Estado')    || '').trim()).filter(Boolean))]
  const categoriasEnExcel = [...new Set(data.map(r => String(getCol(r, 'Categoria') || '').trim()).filter(Boolean))]

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
      // Extraer campos del Excel de Brio por NOMBRE de header (no por posición).
      // El nro. de socio está en la primera columna que el header llama "Nro.Socio"
      // pero la key del primer registro es "SOCIOS ORDENADOS" (header de la fila 1).
      const nroSocio = String(row['SOCIOS ORDENADOS'] ?? getCol(row, 'Nro.Socio') ?? '').trim()

      if (!nroSocio) {
        errores++
        erroresDetalle.push({ fila: i + 2, error: 'Sin número de socio' })
        continue
      }

      // ApellidoNombre viene junto, necesitamos separar
      const apellidoNombre = String(getCol(row, 'ApellidoNombre') || '').trim()
      const { apellido, nombre } = separarApellidoNombre(apellidoNombre)

      const tipoDoc        = mapearTipoDoc(getCol(row, 'Tipo Doc.'))
      const documento      = normalizarDNI(getCol(row, 'Documento'))
      const email          = String(getCol(row, 'Email') || '').trim().toLowerCase() || null
      const emailSecundario = String(getCol(row, 'Email Secundario') || '').trim().toLowerCase() || null
      const telefono       = String(getCol(row, 'Telefono') || '').trim() || null
      const celular        = String(getCol(row, 'Celular') || '').trim() || null
      const domicilio      = String(getCol(row, 'Domicilio') || '').trim() || null
      const ciudad         = String(getCol(row, 'Ciudad') || '').trim() || null
      const provincia      = String(getCol(row, 'Provincia') || '').trim() || 'Buenos Aires'
      const codigoPostal   = String(getCol(row, 'CP') || '').trim() || null

      const fechaNacimiento = excelDateToJS(getCol(row, 'Fecha Nac.'), 'fechaNacimiento')
      const fechaAlta       = excelDateToJS(getCol(row, 'Fecha Alta'), 'fechaAlta')
      const fechaBaja       = excelDateToJS(getCol(row, 'Fecha Baja'), 'fechaBaja')

      // Respetar exactamente los valores del Excel
      const sexo      = String(getCol(row, 'Sexo') || '').trim() || null
      const zona      = String(getCol(row, 'Zona') || '').trim() || null
      const categoria = String(getCol(row, 'Categoria') || '').trim() || null
      const estadoRaw = String(getCol(row, 'Estado') || '').trim()
      const estado    = estadoRaw || 'VIGENTE'

      // Parentesco familiar (no es TipoSocio del sistema)
      const parentescoExcel = String(getCol(row, 'Parentesco') || '').trim() || null

      // TipoSocio: se determina por la estructura familiar, no por el Excel.
      // El script importar-grupos-familiares.js ajusta Titular/Miembro después.
      const tipoSocio = 'Socio Unico'

      // Datos fiscales
      const condicionFiscal = String(getCol(row, 'Cond. Fiscal') || '').trim()
      const cuil            = normalizarDNI(getCol(row, 'CUIT/CUIL'))
      const obraSocial      = String(getCol(row, 'Obra Social') || '').trim() || null
      const profesion       = String(getCol(row, 'Profesión') || getCol(row, 'Profesion') || '').trim() || null
      const libro           = String(getCol(row, 'Libro') || '').trim() || null
      const folio           = String(getCol(row, 'Folio') || '').trim() || null
      const grupoSanguineo  = String(getCol(row, 'Grupo Sanguíneo') || getCol(row, 'Grupo Sanguineo') || '').trim() || null
      const factorRh        = String(getCol(row, 'Factor RH') || '').trim() || null

      // Observaciones
      const observaciones = String(getCol(row, 'Observacion') || getCol(row, 'Observaciones') || '').trim() || null

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

  reportarFechasNoParseadas()

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
