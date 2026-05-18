/**
 * Reproduce el import del extracto Credicoop para diagnosticar el error de Prisma.
 * Replica el flujo del endpoint /admin/conciliacion/extractos/importar pero
 * sin BD: solo parsea y muestra qué se intentaría insertar + valida tipos.
 */
import fs from 'node:fs'
import XLSX from 'xlsx'

const filepath = 'D:/Desarrollos/React/clubix/brio/SaldosBanco.xlsx'
const buffer = fs.readFileSync(filepath)
const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

console.log('Total filas:', rows.length)
console.log('Tipo de celda fecha en fila 1 (col A):', typeof rows[1]?.[0], rows[1]?.[0])
console.log('  Es Date?', rows[1]?.[0] instanceof Date)
console.log('Tipo de celda fecha en fila 100 (col A):', typeof rows[100]?.[0], rows[100]?.[0])
console.log('  Es Date?', rows[100]?.[0] instanceof Date)

// Replicar lógica del parser
function parsearFecha(str, formato) {
  if (formato === 'DD/MM/YYYY') {
    const [d, m, y] = str.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  throw new Error(`Formato fecha no soportado: ${formato}`)
}

const config = {
  hoja: 0, primeraFila: 1, formatoFecha: 'DD/MM/YYYY',
  columnas: { fecha: 0, concepto: 1, referencia: 2, debito: 3, credito: 4, saldo: 5 },
  mergearFilasContinuacion: true,
}

const movimientos = []
let totalDebitos = 0
let totalCreditos = 0
const fechasRaras = []
const importesRaros = []
const saldosRaros = []

for (let i = config.primeraFila; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.every(c => c === '' || c === null || c === undefined)) continue
  const col = (idx) => row[idx]

  const fechaVal = col(0)
  const concepto = String(col(1) || '').trim()
  const deb = parseFloat(String(col(3) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
  const cred = parseFloat(String(col(4) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
  let importe = 0, tipo = 'CREDITO'
  if (deb > 0) { importe = deb; tipo = 'DEBITO' } else { importe = cred; tipo = 'CREDITO' }

  if ((!fechaVal || importe === 0) && config.mergearFilasContinuacion && concepto && movimientos.length > 0) {
    movimientos[movimientos.length - 1].concepto += ' — ' + concepto
    continue
  }
  if (!fechaVal || importe === 0) continue

  let fecha
  if (fechaVal instanceof Date) {
    fecha = fechaVal
  } else {
    try { fecha = parsearFecha(String(fechaVal), 'DD/MM/YYYY') } catch { continue }
  }

  // Detectar fechas fuera del rango razonable (anteriores a 2010 o posteriores a 2100)
  if (fecha.getFullYear() < 2010 || fecha.getFullYear() > 2100) {
    fechasRaras.push({ fila: i, fechaVal, fechaParseada: fecha.toISOString() })
  }

  const saldo = parseFloat(String(col(5) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || null

  // Validar precisión: Decimal(12, 2) acepta hasta 9999999999.99
  if (Math.abs(importe) > 9999999999.99) importesRaros.push({ fila: i, importe })
  if (saldo !== null && Math.abs(saldo) > 9999999999.99) saldosRaros.push({ fila: i, saldo })

  movimientos.push({ fecha, tipo, importe, concepto, saldo })
  if (tipo === 'DEBITO') totalDebitos += importe
  else totalCreditos += importe
}

console.log('\nMovimientos parseados:', movimientos.length)
console.log('Total débitos:', totalDebitos, ' (precision:', totalDebitos.toString().length, 'chars)')
console.log('Total créditos:', totalCreditos, ' (precision:', totalCreditos.toString().length, 'chars)')

console.log('\n--- ANOMALÍAS ---')
console.log('Fechas raras (<2010 o >2100):', fechasRaras.length)
if (fechasRaras.length > 0) console.table(fechasRaras.slice(0, 5))

console.log('Importes fuera de Decimal(12,2):', importesRaros.length)
console.log('Saldos fuera de Decimal(12,2):', saldosRaros.length)

// Primer y último movimiento
movimientos.sort((a, b) => a.fecha - b.fecha)
console.log('\nPrimer mov (cronológico):', movimientos[0]?.fecha?.toISOString(), movimientos[0]?.importe)
console.log('Último mov:', movimientos[movimientos.length - 1]?.fecha?.toISOString(), movimientos[movimientos.length - 1]?.importe)

// Verificar tipos
const conceptosLargos = movimientos.filter(m => m.concepto.length > 500)
console.log('\nConceptos >500 chars (¿desbordan?):', conceptosLargos.length)
if (conceptosLargos.length > 0) console.log('  Ejemplo:', conceptosLargos[0].concepto.slice(0, 100), '...')
