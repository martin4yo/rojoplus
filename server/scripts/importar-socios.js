/**
 * Script de importación de socios desde Socios.xlsx (Brio)
 *
 * Ejecutar con: node scripts/importar-socios.js
 */

import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

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
  console.log('🚀 Iniciando importación de socios desde Brio...\n')

  // 1. Leer el archivo Excel
  const filePath = path.join(__dirname, '..', '..', 'brio', 'Socios.xlsx')
  console.log(`📄 Leyendo archivo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allData = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  // La primera fila contiene los headers, empezar desde la segunda
  const data = allData.slice(1)

  console.log(`📊 Total de registros a procesar: ${data.length}\n`)

  // 2. Procesar socios
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
      const sexo = String(row['__EMPTY_7'] || '').trim() || null // Sexo (columna 8)
      const zona = String(row['__EMPTY_8'] || '').trim() || null // Zona (columna 9)
      const categoria = String(row['__EMPTY_9'] || '').trim() || null // Categoria (columna 10)
      const estadoRaw = String(row['__EMPTY_10'] || '').trim() // Estado (columna 11)
      const estado = estadoRaw || 'VIGENTE' // Si está vacío, asumir VIGENTE
      const tipoSocio = String(row['__EMPTY_14'] || '').trim() || null // TipoSocio (columna 15)

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

      // Verificar si ya existe
      const socioExistente = await prisma.socio.findUnique({
        where: { nroSocio }
      })

      // Crear apellidoNombre combinado (requerido por el schema)
      const apellidoNombreCompleto = apellido ? `${apellido}${nombre ? ', ' + nombre : ''}` : nombre

      if (socioExistente) {
        // Actualizar
        await prisma.socio.update({
          where: { nroSocio },
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
            obraSocial,
            profesion,
            libro,
            folio,
            grupoSanguineo,
            factorRh,
            observaciones,
          }
        })
        actualizados++
      } else {
        // Crear nuevo
        await prisma.socio.create({
          data: {
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
