/**
 * Test offline del parser de Credicoop con el archivo SaldosBanco.xlsx.
 * No toca BD — solo verifica que el parser entienda el formato correctamente.
 */
import fs from 'node:fs'
import XLSX from 'xlsx'

const filepath = process.argv[2] || 'D:/Desarrollos/React/clubix/brio/SaldosBanco.xlsx'
const buffer = fs.readFileSync(filepath)
const contenidoBase64 = buffer.toString('base64')

// Config del preset Credicoop
const config = {
  hoja: 0,
  primeraFila: 1,
  formatoFecha: 'DD/MM/YYYY',
  columnas: { fecha: 0, concepto: 1, referencia: 2, debito: 3, credito: 4, saldo: 5 },
  mergearFilasContinuacion: true,
  ordenInvertido: process.argv.includes('--invertir'),
}
console.log('ordenInvertido =', config.ordenInvertido)

// Réplica mínima del parser (sólo XLSX)
function parsearFecha(str, formato) {
  if (formato === 'DD/MM/YYYY') {
    const [d, m, y] = str.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  throw new Error(`Formato fecha no soportado: ${formato}`)
}

function parsearXLSX(contenidoBase64, config) {
  const { hoja = 0, primeraFila = 1, formatoFecha = 'DD/MM/YYYY', columnas = {},
    mergearFilasContinuacion = false, ordenInvertido = false } = config
  const buffer = Buffer.from(contenidoBase64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = typeof hoja === 'number' ? workbook.SheetNames[hoja] : hoja
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const movimientos = []

  for (let i = primeraFila; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue
    const col = idx => (idx !== undefined && idx !== null) ? row[idx] : undefined
    const fechaVal = col(columnas.fecha ?? 0)
    const concepto = String(col(columnas.concepto ?? 1) || '').trim()

    let importe = 0, tipo = 'CREDITO'
    if (columnas.debito !== undefined && columnas.credito !== undefined) {
      const deb = parseFloat(String(col(columnas.debito) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      const cred = parseFloat(String(col(columnas.credito) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      if (deb > 0) { importe = deb; tipo = 'DEBITO' } else { importe = cred; tipo = 'CREDITO' }
    }

    if ((!fechaVal || importe === 0) && mergearFilasContinuacion && concepto && movimientos.length > 0) {
      const ult = movimientos[movimientos.length - 1]
      ult.concepto = `${ult.concepto} — ${concepto}`.slice(0, 500)
      continue
    }
    if (!fechaVal || importe === 0) continue

    let fecha = fechaVal instanceof Date ? fechaVal : (() => {
      try { return parsearFecha(String(fechaVal), formatoFecha) } catch { return null }
    })()
    if (!fecha) continue

    const saldo = columnas.saldo !== undefined
      ? parseFloat(String(col(columnas.saldo) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || null
      : null

    movimientos.push({
      fecha, tipo, importe,
      concepto: (concepto || 'Movimiento').replace(/[\r\n]+/g, ' — ').replace(/\s+/g, ' ').trim(),
      referencia: columnas.referencia !== undefined ? String(col(columnas.referencia) || '').trim() : null,
      saldo,
    })
  }

  if (ordenInvertido) movimientos.reverse()

  let saldoInicial = 0, saldoFinal = 0
  if (movimientos.length > 0) {
    const primero = movimientos[0]
    if (primero.saldo !== null) saldoInicial = primero.saldo - (primero.tipo === 'CREDITO' ? primero.importe : -primero.importe)
    const ultimo = movimientos[movimientos.length - 1]
    if (ultimo.saldo !== null) saldoFinal = ultimo.saldo
  }
  return { movimientos, saldoInicial, saldoFinal }
}

console.log(`Parseando: ${filepath}\n`)
const t0 = Date.now()
const r = parsearXLSX(contenidoBase64, config)
const ms = Date.now() - t0

console.log(`Tiempo:               ${ms} ms`)
console.log(`Movimientos parseados: ${r.movimientos.length}`)
console.log(`Saldo inicial:         $${r.saldoInicial.toLocaleString('es-AR')}`)
console.log(`Saldo final:           $${r.saldoFinal.toLocaleString('es-AR')}`)

const creditos = r.movimientos.filter(m => m.tipo === 'CREDITO')
const debitos = r.movimientos.filter(m => m.tipo === 'DEBITO')
const totalCred = creditos.reduce((s, m) => s + m.importe, 0)
const totalDeb = debitos.reduce((s, m) => s + m.importe, 0)
console.log(`Créditos:              ${creditos.length} (total $${totalCred.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`)
console.log(`Débitos:               ${debitos.length} (total $${totalDeb.toLocaleString('es-AR', { minimumFractionDigits: 2 })})`)

const fmt = d => d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '-'
console.log(`Rango fechas:          ${fmt(r.movimientos[0]?.fecha)} → ${fmt(r.movimientos[r.movimientos.length - 1]?.fecha)}`)

// Verificar coherencia: saldoInicial + créditos - débitos ≈ saldoFinal
const calculado = r.saldoInicial + totalCred - totalDeb
const diff = Math.abs(calculado - r.saldoFinal)
console.log(`\nCoherencia saldos:`)
console.log(`  ${r.saldoInicial.toFixed(2)} + ${totalCred.toFixed(2)} - ${totalDeb.toFixed(2)} = ${calculado.toFixed(2)}`)
console.log(`  saldoFinal esperado: ${r.saldoFinal.toFixed(2)}`)
console.log(`  diferencia: $${diff.toFixed(2)} ${diff < 1 ? '✅ OK' : '⚠️  no coincide'}`)

console.log(`\nPrimeros 5 movimientos (cronológicos):`)
r.movimientos.slice(0, 5).forEach((m, i) => {
  console.log(`  ${i + 1}. ${fmt(m.fecha)} | ${m.tipo} | $${m.importe.toFixed(2).padStart(12)} | saldo $${m.saldo?.toFixed(2)} | ${m.concepto.slice(0, 70)}`)
})
console.log(`\nÚltimos 5 movimientos:`)
r.movimientos.slice(-5).forEach((m, i) => {
  console.log(`  ${i + 1}. ${fmt(m.fecha)} | ${m.tipo} | $${m.importe.toFixed(2).padStart(12)} | saldo $${m.saldo?.toFixed(2)} | ${m.concepto.slice(0, 70)}`)
})

// Conteos: cuántos conceptos quedaron mergeados con titular
const conTitular = r.movimientos.filter(m => m.concepto.includes(' — ')).length
console.log(`\nMovimientos con titular mergeado (contienen " — "): ${conTitular}`)

// Verificación de orden cronológico
console.log(`\nOrden cronológico (fecha de cada bloque de 2000 mov.):`)
const fmt2 = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
for (let i = 0; i < r.movimientos.length; i += 2000) {
  console.log(`  idx ${String(i).padStart(5)} → ${fmt2(r.movimientos[i].fecha)}`)
}
console.log(`  idx ${String(r.movimientos.length - 1).padStart(5)} → ${fmt2(r.movimientos[r.movimientos.length - 1].fecha)} (último)`)

// ¿Está ordenado ASC?
let ascCount = 0, descCount = 0
for (let i = 1; i < r.movimientos.length; i++) {
  if (r.movimientos[i].fecha >= r.movimientos[i - 1].fecha) ascCount++
  else descCount++
}
const total = ascCount + descCount
console.log(`\nComparaciones consecutivas: ASC=${ascCount} (${(ascCount * 100 / total).toFixed(1)}%) | DESC=${descCount} (${(descCount * 100 / total).toFixed(1)}%)`)
console.log(`→ ${ascCount > descCount ? 'orden ASC ✅' : 'orden DESC ⚠️'}`)
