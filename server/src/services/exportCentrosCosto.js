import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

// Función para exportar reporte comparativo a Excel
export async function exportarComparativoExcel(data) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Centros de Costo')

  // Encabezados
  worksheet.columns = [
    { header: 'Centro', key: 'nombre', width: 30 },
    { header: 'Código', key: 'codigo', width: 15 },
    { header: 'Tipo', key: 'tipo', width: 20 },
    { header: 'Ingresos', key: 'ingresos', width: 15, style: { numFmt: '$#,##0.00' } },
    { header: '% Ing.', key: 'porcIngresos', width: 10 },
    { header: 'Egresos', key: 'egresos', width: 15, style: { numFmt: '$#,##0.00' } },
    { header: '% Egr.', key: 'porcEgresos', width: 10 },
    { header: 'Resultado', key: 'resultado', width: 15, style: { numFmt: '$#,##0.00' } },
  ]

  // Estilo de encabezados
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Agregar datos
  data.centros.forEach(centro => {
    worksheet.addRow({
      nombre: centro.nombre,
      codigo: centro.codigo,
      tipo: centro.tipo,
      ingresos: centro.ingresos,
      porcIngresos: `${centro.porcentajeIngresos.toFixed(1)}%`,
      egresos: centro.egresos,
      porcEgresos: `${centro.porcentajeEgresos.toFixed(1)}%`,
      resultado: centro.resultado,
    })
  })

  // Fila de totales
  const totalRow = worksheet.addRow({
    nombre: 'TOTAL',
    codigo: '',
    tipo: '',
    ingresos: data.resumenGeneral.totalIngresos,
    porcIngresos: '100%',
    egresos: data.resumenGeneral.totalEgresos,
    porcEgresos: '100%',
    resultado: data.resumenGeneral.resultado,
  })

  totalRow.font = { bold: true }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF2CC' },
  }

  return await workbook.xlsx.writeBuffer()
}

// Función para exportar evolución temporal a Excel
export async function exportarEvolucionExcel(data) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Evolución Temporal')

  // Encabezados dinámicos por período
  const columns = [
    { header: 'Centro', key: 'centro', width: 30 },
    { header: 'Concepto', key: 'concepto', width: 20 },
  ]

  data.series.forEach(s => {
    columns.push({ header: s.periodo, key: s.periodo, width: 15 })
  })

  worksheet.columns = columns

  // Estilo de encabezados
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Agrupar por centro
  const centrosMap = {}

  data.series.forEach(serie => {
    serie.centros.forEach(c => {
      const key = c.centro.nombre || 'Sin Centro'
      if (!centrosMap[key]) {
        centrosMap[key] = { nombre: key, ingresos: {}, egresos: {}, resultado: {} }
      }
      centrosMap[key].ingresos[serie.periodo] = c.ingresos
      centrosMap[key].egresos[serie.periodo] = c.egresos
      centrosMap[key].resultado[serie.periodo] = c.resultado
    })
  })

  // Agregar filas
  Object.values(centrosMap).forEach(centro => {
    // Ingresos
    const rowIngresos = { centro: centro.nombre, concepto: 'Ingresos' }
    data.series.forEach(s => {
      rowIngresos[s.periodo] = centro.ingresos[s.periodo] || 0
    })
    worksheet.addRow(rowIngresos)

    // Egresos
    const rowEgresos = { centro: centro.nombre, concepto: 'Egresos' }
    data.series.forEach(s => {
      rowEgresos[s.periodo] = centro.egresos[s.periodo] || 0
    })
    worksheet.addRow(rowEgresos)

    // Resultado
    const rowResultado = { centro: centro.nombre, concepto: 'Resultado' }
    data.series.forEach(s => {
      rowResultado[s.periodo] = centro.resultado[s.periodo] || 0
    })
    const resRow = worksheet.addRow(rowResultado)
    resRow.font = { bold: true }

    // Línea separadora
    worksheet.addRow({})
  })

  return await workbook.xlsx.writeBuffer()
}

// Función para exportar rentabilidad de actividades a Excel
export async function exportarRentabilidadExcel(data) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Rentabilidad Actividades')

  // Encabezados
  worksheet.columns = [
    { header: 'Centro de Costo', key: 'centro', width: 25 },
    { header: 'Actividad', key: 'actividad', width: 30 },
    { header: 'Inscripciones', key: 'inscripciones', width: 15 },
    { header: 'Ingresos', key: 'ingresos', width: 15 },
    { header: 'Costos', key: 'costos', width: 15 },
    { header: 'Resultado', key: 'resultado', width: 15 },
    { header: 'Margen %', key: 'margen', width: 12 },
  ]

  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Agregar datos
  data.actividades.forEach(act => {
    worksheet.addRow({
      centro: act.centroCosto.nombre,
      actividad: act.actividad.nombre,
      inscripciones: act.inscripciones,
      ingresos: act.ingresos,
      costos: act.costos,
      resultado: act.resultado,
      margen: `${act.margen.toFixed(1)}%`,
    })
  })

  // Totales
  const totalRow = worksheet.addRow({
    centro: 'TOTAL',
    actividad: '',
    inscripciones: data.resumen.totalInscripciones,
    ingresos: data.resumen.totalIngresos,
    costos: data.resumen.totalCostos,
    resultado: data.resumen.totalResultado,
    margen: '',
  })

  totalRow.font = { bold: true }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF2CC' },
  }

  return await workbook.xlsx.writeBuffer()
}

// Función para exportar presupuesto vs real a Excel
export async function exportarPresupuestoExcel(data) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(`Presupuesto ${data.anio}`)

  // Encabezados
  const columns = [
    { header: 'Centro', key: 'centro', width: 25 },
    { header: 'Concepto', key: 'concepto', width: 20 },
  ]

  for (let i = 1; i <= 12; i++) {
    columns.push({ header: `Mes ${i}`, key: `mes${i}`, width: 12 })
  }

  columns.push({ header: 'Total', key: 'total', width: 15 })

  worksheet.columns = columns

  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Agregar datos por centro
  data.centros.forEach(centro => {
    // Fila de presupuestado
    const rowPpto = { centro: centro.centro.nombre, concepto: 'Presupuestado' }
    centro.meses.forEach((m, i) => {
      rowPpto[`mes${i + 1}`] = m.presupuestado
    })
    rowPpto.total = centro.totales.presupuestado
    worksheet.addRow(rowPpto)

    // Fila de real
    const rowReal = { centro: '', concepto: 'Real' }
    centro.meses.forEach((m, i) => {
      rowReal[`mes${i + 1}`] = m.real
    })
    rowReal.total = centro.totales.real
    worksheet.addRow(rowReal)

    // Fila de desvío
    const rowDesvio = { centro: '', concepto: 'Desvío' }
    centro.meses.forEach((m, i) => {
      rowDesvio[`mes${i + 1}`] = m.desvio
    })
    rowDesvio.total = centro.totales.desvio
    const desvioRow = worksheet.addRow(rowDesvio)
    desvioRow.font = { bold: true }

    // Separador
    worksheet.addRow({})
  })

  return await workbook.xlsx.writeBuffer()
}

// Funciones PDF simplificadas
export function generarPDFComparativo(data) {
  const doc = new PDFDocument({ margin: 50 })

  doc.fontSize(18).text('Estado de Resultados por Centro de Costo', { align: 'center' })
  doc.moveDown()

  doc.fontSize(12).text(`Período: ${data.periodo?.desde || 'N/A'} - ${data.periodo?.hasta || 'N/A'}`)
  doc.moveDown()

  // Resumen
  doc.fontSize(14).text('Resumen General', { underline: true })
  doc.fontSize(10)
  doc.text(`Total Ingresos: $${data.resumenGeneral.totalIngresos.toLocaleString('es-AR')}`)
  doc.text(`Total Egresos: $${data.resumenGeneral.totalEgresos.toLocaleString('es-AR')}`)
  doc.text(`Resultado: $${data.resumenGeneral.resultado.toLocaleString('es-AR')} (${data.resumenGeneral.tipo})`)
  doc.moveDown()

  // Tabla
  doc.fontSize(12).text('Detalle por Centro', { underline: true })
  doc.fontSize(8)

  data.centros.forEach(centro => {
    doc.text(
      `${centro.nombre} (${centro.codigo}): Ing $${centro.ingresos.toFixed(0)} | Egr $${centro.egresos.toFixed(0)} | Res $${centro.resultado.toFixed(0)}`
    )
  })

  doc.end()
  return doc
}
