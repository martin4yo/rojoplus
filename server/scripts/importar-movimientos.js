/**
 * Script para importar movimientos financieros desde Conceptos.xlsx
 * Crea registros en movimientos_caja
 * - Si Nro. Socio existe en tabla socios → movimiento de socio
 * - Si NO existe → movimiento de entidad (proveedor/empleado)
 *
 * Ejecutar con: node scripts/importar-movimientos.js --tenant <slug> [--desde-anio YYYY] [--desde-mes M]
 * Prerequisito: Pasos 1 (socios) y 4 (proveedores) completados
 */

import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import { arg, resolveTenant } from './_lib/cli.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Filtro de período por fecha de movimiento (default: año actual y mes 4)
const PERIODO_DESDE_ANIO = parseInt(arg('desde-anio', String(new Date().getFullYear())))
const PERIODO_DESDE_MES  = parseInt(arg('desde-mes',  '4'))
const FECHA_CORTE = new Date(PERIODO_DESDE_ANIO, PERIODO_DESDE_MES - 1, 1)

function excelDateToJS(val) {
  if (!val) return new Date()
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000)
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

// Conceptos que son EGRESOS
const CONCEPTOS_EGRESO = new Set([
  'SUELDOS Y JORNALES', 'SUELDOS Y JORNALES COMERCIALIZ', 'SAC', 'CARGAS SOCIALES',
  'HONORARIO', 'VIATICOS', 'LIMPIEZA', 'INGRESOS LIMPIEZA',
  'ALQUILER TAEKWONDO', 'ALQUILER GIMNASIO', 'ALQUILER PILETA', 'ALQUILER IPEF',
  'ALQUILER ZUMBA', 'ALQUILER TENIS', 'ALQUILER KICK BOKING', 'ALQUILER LEIVA',
  'ALQUILER CANCHA BASQUET', 'ALQUILER CANCHA VETERANOS', 'ALQUILER BUFFET',
  'ALQUILER CHOPIN', 'ALQUILER QUINCHO 1', 'ALQUILER PREDIO FUTBOL 11',
  'ALQUILER MODELO', 'INGRESOS ALQUILERES VARIOS',
  'MANTENIMIENTO SEDE', 'MATERIALES', 'MATERIALES DEPORTIVOS', 'LIBRERIA',
  'GASTOS VARIOS', 'GASTOS SUBCOMISIONES 1', 'OTROS VARIOS INGRESOS',
  'INTERESES Y GASTOS BANCARIOS', 'NNTERESES A PROVEEDORES',
  'DEVOLUCIONES', 'DESCUENTOS CONCEDIDOS', 'INCOBRABLES',
  'COSTO ENVIO', 'MOSQUETONES', 'BOTINEROS', 'CANILLERAS', 'VINCHAS',
  'BOTELLAS TERMICAS', 'JARROS TERMICOS', 'SET MATERO', 'MATES', 'LLAVEROS',
  'TAZA CERAMICA', 'MOUSE PAD', 'GORRO DE LANA',
])

function inferirTipo(concepto, estadoCuota) {
  if (estadoCuota === 'Proveedor') return 'EGRESO'
  if (CONCEPTOS_EGRESO.has(concepto)) return 'EGRESO'
  return 'INGRESO'
}

async function importarMovimientos() {
  try {
    const tenant = await resolveTenant(prisma, 'importar-movimientos.js')
    const tenantId = tenant.id
    console.log(`Filtro de período: desde ${PERIODO_DESDE_MES}/${PERIODO_DESDE_ANIO} en adelante`)

    // Leer Conceptos.xlsx
    const filePath = path.join(__dirname, '../../brio/Conceptos.xlsx')
    const workbook = XLSX.readFile(filePath)
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 })
    console.log(`Registros en Conceptos.xlsx: ${data.length}`)

    // Cargar socios del tenant
    const socios = await prisma.socio.findMany({
      where: { tenantId },
      select: { nroSocio: true }
    })
    const nrosSocios = new Set(socios.map(s => s.nroSocio?.toString().trim()).filter(Boolean))
    console.log(`Socios en BD: ${nrosSocios.size}`)

    // Cargar entidades BRIO del tenant
    const entidades = await prisma.entidad.findMany({
      where: { tenantId, codigo: { startsWith: 'BRIO-' } },
      select: { id: true, codigo: true }
    })
    const entidadesPorCodigo = new Map()
    entidades.forEach(e => entidadesPorCodigo.set(e.codigo, e.id))
    console.log(`Entidades BRIO en BD: ${entidades.length}`)

    // Buscar admin del tenant para registradoPor
    const tenantUsuario = await prisma.tenantUsuario.findFirst({
      where: { tenantId },
      include: { admin: { select: { id: true, activo: true } } }
    })
    const admin = tenantUsuario?.admin
    if (!admin) throw new Error('No hay admin para este tenant en la BD')
    console.log(`Admin registrador: id=${admin.id}`)

    // Obtener o crear Caja de migración
    let cajaMigracion = await prisma.caja.findFirst({
      where: { tenantId, codigo: 'MIGRACION_BRIO' }
    })
    if (!cajaMigracion) {
      // Buscar cuentaContable para la caja
      let cuentaCaja = await prisma.cuentaContable.findFirst({
        where: { tenantId, codigo: '1.1.01.00' }
      })
      if (!cuentaCaja) {
        cuentaCaja = await prisma.cuentaContable.findFirst({ where: { tenantId } })
      }

      cajaMigracion = await prisma.caja.create({
        data: {
          tenantId,
          codigo: 'MIGRACION_BRIO',
          nombre: 'Migración Brio (Histórico)',
          tipo: 'EFECTIVO',
          descripcion: 'Caja temporal para movimientos históricos importados desde Brio',
          activo: false,
          cuentaContableId: cuentaCaja?.id || null,
        }
      })
      console.log(`Caja de migración creada: id=${cajaMigracion.id}`)
    } else {
      console.log(`Caja de migración existente: id=${cajaMigracion.id}`)
    }

    // Obtener o crear CuentaContable genérica de migración
    let cuentaMigracion = await prisma.cuentaContable.findFirst({
      where: { tenantId, codigo: 'MIGRACION' }
    })
    if (!cuentaMigracion) {
      cuentaMigracion = await prisma.cuentaContable.create({
        data: {
          tenantId,
          codigo: 'MIGRACION',
          nombre: 'Migración Histórica Brio',
          tipo: 'INGRESO',
          esImputable: false,
          activo: false,
        }
      })
      console.log(`CuentaContable migración creada: id=${cuentaMigracion.id}`)
    }

    // Limpiar movimientos de migración anteriores
    console.log('\nLimpiando movimientos de migración anteriores...')
    const deleted = await prisma.movimientoCaja.deleteMany({
      where: { tenantId, concepto: { startsWith: '[BRIO]' } }
    })
    console.log(`Movimientos eliminados: ${deleted.count}`)

    // Importar movimientos
    let importados = 0
    let errores = 0
    let omitidosPorFecha = 0
    let contador = 1
    const erroresDetalle = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      const nro = row['Nro. Socio']?.toString().trim()
      const concepto = row['Concepto']?.toString().trim() || 'SIN CONCEPTO'
      const importe = parseFloat(row['Importe Total']) || 0
      const descripcion = row['Descripción']?.toString().trim() || ''
      const comprobante = row['Comprobante']?.toString().trim() || ''
      const estadoCuota = row['Estado de la Cuota']?.toString() || ''
      const fecha = excelDateToJS(row['Fecha Movimiento'])

      if (!nro || importe === 0) continue
      if (fecha < FECHA_CORTE) { omitidosPorFecha++; continue }

      const esSocio = nrosSocios.has(nro)
      const entidadId = !esSocio ? entidadesPorCodigo.get(`BRIO-${nro}`) : null
      const tipo = inferirTipo(concepto, estadoCuota)

      // Número único para el movimiento
      const numero = `BRIO-${String(contador).padStart(6, '0')}`
      contador++

      try {
        await prisma.movimientoCaja.create({
          data: {
            tenantId,
            numero,
            cajaId: cajaMigracion.id,
            cuentaContableId: cuentaMigracion.id,
            tipo,
            concepto: `[BRIO] ${concepto}`,
            monto: Math.abs(importe),
            fecha,
            comprobanteNro: comprobante || null,
            descripcion: descripcion || null,
            estado: 'CONFIRMADO',
            registradoPor: admin.id,
            observacionConciliacion: [
              esSocio ? `Socio: ${nro}` : `Entidad: ${nro}`,
              estadoCuota ? `Estado: ${estadoCuota}` : null,
              row['Usuario Comprobante'] ? `Usuario: ${row['Usuario Comprobante']}` : null,
            ].filter(Boolean).join(' | '),
          }
        })
        importados++
        if (importados % 500 === 0) console.log(`  Procesados: ${importados}...`)
      } catch (err) {
        errores++
        if (errores <= 20) erroresDetalle.push(`Fila ${i + 3}: ${concepto} nro ${nro} - ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('LISTO')
    console.log(`Movimientos importados: ${importados}`)
    console.log(`Omitidos por fecha:    ${omitidosPorFecha}`)
    console.log(`Errores:               ${errores}`)

    if (erroresDetalle.length > 0) {
      console.log('\nDetalle errores:')
      erroresDetalle.forEach(e => console.log(`  - ${e}`))
    }

    const totalIngreso = await prisma.movimientoCaja.count({
      where: { tenantId, concepto: { startsWith: '[BRIO]' }, tipo: 'INGRESO' }
    })
    const totalEgreso = await prisma.movimientoCaja.count({
      where: { tenantId, concepto: { startsWith: '[BRIO]' }, tipo: 'EGRESO' }
    })
    console.log(`\nEn BD — Ingresos: ${totalIngreso} | Egresos: ${totalEgreso}`)

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importarMovimientos()
