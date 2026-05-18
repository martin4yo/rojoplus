import XLSX from 'xlsx'

const filepath = 'D:/Desarrollos/React/clubix/brio/SaldosBanco.xlsx'
const wb = XLSX.readFile(filepath)
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })

const dataRows = rows.slice(1) // sin header
const conFecha = dataRows.filter(r => r[0] && String(r[0]).trim())
const sinFecha = dataRows.filter(r => !String(r[0]).trim())
const continuaciones = sinFecha.filter(r => String(r[1]).trim())
const totalmenteVacias = sinFecha.filter(r => !String(r[1]).trim())

console.log('Total filas datos:    ', dataRows.length)
console.log('Con fecha:            ', conFecha.length, '← movimientos reales')
console.log('Sin fecha c/ texto:   ', continuaciones.length, '← nombre titular de fila anterior')
console.log('Totalmente vacías:    ', totalmenteVacias.length)

// Códigos únicos en G (para entender los tipos de movimiento)
const codigos = {}
for (const r of conFecha) {
  const c = String(r[6] || '').trim()
  codigos[c] = (codigos[c] || 0) + 1
}
console.log('\nCódigos únicos en col G (top 15):')
Object.entries(codigos).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(8)} → ${v} movimientos`)
})

// Rango de fechas
const fechas = conFecha.map(r => String(r[0]).trim()).filter(Boolean)
console.log('\nRango de fechas: del', fechas[fechas.length - 1], 'al', fechas[0])

// Detectar saldo inicial/final
console.log('\nPrimer movimiento (fila 1):', dataRows[0].slice(0, 7))
console.log('Último movimiento:        ', dataRows[dataRows.length - 1].slice(0, 7))
