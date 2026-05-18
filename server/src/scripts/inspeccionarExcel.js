import XLSX from 'xlsx'

const filepath = process.argv[2] || 'D:/Desarrollos/React/clubix/brio/SaldosBanco.xlsx'
const wb = XLSX.readFile(filepath)
console.log('Archivo:', filepath)
console.log('Hojas:', wb.SheetNames)

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name]
  console.log(`\n=== Hoja: "${name}" (rango: ${sheet['!ref']}) ===`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  console.log('Total filas:', rows.length)
  const maxFilas = Math.min(rows.length, 25)
  console.log(`Primeras ${maxFilas} filas:`)
  rows.slice(0, maxFilas).forEach((r, i) => {
    const cells = r.slice(0, 12).map((c, idx) => `[${String.fromCharCode(65 + idx)}]"${String(c).slice(0, 35)}"`).join(' | ')
    console.log(`  ${String(i).padStart(3)}: ${cells}`)
  })
}
