import PDFDocument from 'pdfkit'
import Handlebars from 'handlebars'

const handlebars = Handlebars

/**
 * Genera un PDF a partir de un template guardado en la base de datos
 * NOTA: Con PDFKit no podemos renderizar HTML/CSS directamente.
 * Esta función crea PDFs básicos usando los datos proporcionados.
 *
 * @param {Object} prisma - Cliente de Prisma
 * @param {string} tipo - Tipo de PDF (RECIBO, FACTURA, COMPROBANTE_PAGO)
 * @param {Object} data - Datos para compilar el template
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generatePDF(prisma, tipo, data) {
  try {
    // 1. Buscar el template en la base de datos (para verificar que existe)
    const template = await prisma.pdfTemplate.findUnique({
      where: { tipo, isActive: true }
    })

    if (!template) {
      throw new Error(`Template PDF tipo "${tipo}" no encontrado o inactivo`)
    }

    // 2. Generar PDF según el tipo
    let pdfBuffer

    switch (tipo) {
      case 'RECIBO':
        pdfBuffer = await generarPDFRecibo(data, template)
        break
      case 'FACTURA':
        pdfBuffer = await generarPDFFactura(data, template)
        break
      case 'COMPROBANTE_PAGO':
        pdfBuffer = await generarPDFComprobantePago(data, template)
        break
      default:
        throw new Error(`Tipo de PDF "${tipo}" no soportado`)
    }

    console.log(`✅ PDF generado: ${tipo}`)
    return pdfBuffer

  } catch (error) {
    console.error(`❌ Error generando PDF tipo "${tipo}":`, error)
    throw error
  }
}

/**
 * Genera PDF de Recibo usando PDFKit
 */
async function generarPDFRecibo(data, template) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: template.pageFormat || 'A4',
        margin: 50
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Encabezado
      doc.fontSize(20)
         .fillColor('#DC2626')
         .font('Helvetica-Bold')
         .text('RECIBO', { align: 'center' })

      doc.moveDown()

      // Información del club
      doc.fontSize(10)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text(data.clubNombre || '', { align: 'center' })

      if (data.clubLema) {
        doc.fontSize(9)
           .font('Helvetica')
           .text(data.clubLema, { align: 'center' })
      }

      if (data.clubDireccion) {
        doc.fontSize(8)
           .text(data.clubDireccion, { align: 'center' })
      }

      if (data.clubTelefono || data.clubEmail) {
        doc.fontSize(8)
           .text(`${data.clubTelefono || ''} ${data.clubEmail || ''}`, { align: 'center' })
      }

      doc.moveDown(2)

      // Número de recibo y fecha
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(`Recibo N°: ${data.numero || '-'}`, { align: 'left' })
         .moveDown(0.5)
         .fontSize(10)
         .font('Helvetica')
         .text(`Fecha: ${data.fecha || '-'}`)
         .moveDown()

      // Información del socio
      if (data.socioNombre || data.socioNumero) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('SOCIO:', { continued: true })
           .font('Helvetica')
           .text(` ${data.socioNombre || '-'}`)

        if (data.socioNumero) {
          doc.text(`N° Socio: ${data.socioNumero}`)
        }
        doc.moveDown()
      }

      // Medio de pago
      if (data.medioPago) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Medio de Pago:', { continued: true })
           .font('Helvetica')
           .text(` ${data.medioPago}`)

        if (data.nroOperacion) {
          doc.text(`N° Operación: ${data.nroOperacion}`)
        }
        doc.moveDown()
      }

      // Items (conceptos)
      if (data.items && data.items.length > 0) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('CONCEPTOS:', { underline: true })
           .moveDown(0.5)

        const startX = 50
        const colWidths = [250, 150, 100]

        data.items.forEach(item => {
          doc.fontSize(9)
             .font('Helvetica')
             .text(item.concepto || '-', startX, doc.y, { width: colWidths[0], continued: true })
             .text(item.periodo || '', { width: colWidths[1], continued: true })
             .text(`$${parseFloat(item.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { width: colWidths[2], align: 'right' })
        })

        doc.moveDown()
      }

      // Total
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke()
         .moveDown(0.5)

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#DC2626')
         .text(`TOTAL: $${parseFloat(data.montoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { align: 'right' })

      doc.moveDown(2)

      // Observaciones
      if (data.observaciones) {
        doc.fontSize(9)
           .fillColor('#000')
           .font('Helvetica')
           .text(`Observaciones: ${data.observaciones}`)
      }

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera PDF de Factura usando PDFKit
 */
async function generarPDFFactura(data, template) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: template.pageFormat || 'A4',
        margin: 50
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // Encabezado
      doc.fontSize(20)
         .fillColor('#DC2626')
         .font('Helvetica-Bold')
         .text(`FACTURA ${data.tipoFactura || ''}`, { align: 'center' })

      doc.moveDown()

      // Información del club
      doc.fontSize(10)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text(data.clubNombre || '', { align: 'center' })

      if (data.clubDireccion) {
        doc.fontSize(8)
           .font('Helvetica')
           .text(data.clubDireccion, { align: 'center' })
      }

      if (data.clubCuit) {
        doc.text(`CUIT: ${data.clubCuit}`, { align: 'center' })
      }

      doc.moveDown(2)

      // Número y fecha
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(`Factura N°: ${data.puntoVenta || ''}-${data.numeroFactura || ''}`, { align: 'left' })
         .moveDown(0.5)
         .font('Helvetica')
         .text(`Fecha: ${data.fecha || '-'}`)
         .moveDown()

      // Cliente
      if (data.clienteNombre) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('CLIENTE:', { continued: true })
           .font('Helvetica')
           .text(` ${data.clienteNombre}`)

        if (data.clienteDni) {
          doc.text(`DNI: ${data.clienteDni}`)
        }
        doc.moveDown()
      }

      // Items
      if (data.items && data.items.length > 0) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('DETALLE:', { underline: true })
           .moveDown(0.5)

        data.items.forEach(item => {
          doc.fontSize(9)
             .font('Helvetica')
             .text(`${item.cantidad || 1} x ${item.descripcion || '-'} - $${parseFloat(item.precioUnitario || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} = $${parseFloat(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
        })

        doc.moveDown()
      }

      // Totales
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke()
         .moveDown(0.5)

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Subtotal: $${parseFloat(data.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { align: 'right' })

      if (data.iva && parseFloat(data.iva) > 0) {
        doc.text(`IVA (${data.ivaPorc || 0}%): $${parseFloat(data.iva).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { align: 'right' })
      }

      doc.moveDown(0.5)

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#DC2626')
         .text(`TOTAL: $${parseFloat(data.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { align: 'right' })

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera PDF de Comprobante de Pago usando PDFKit
 */
async function generarPDFComprobantePago(data, template) {
  // Por ahora, usar el mismo formato que el recibo
  return generarPDFRecibo(data, template)
}

/**
 * Genera PDF de Cierre de Caja con desglose por medio de pago y concepto
 */
export async function generarPDFCierreCaja(cierreData) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const esInformePrevio = cierreData.esInformePrevio || false
      const pageWidth = doc.page.width - 80 // Ancho útil (descontando márgenes)

      // ==================== ENCABEZADO ====================

      // Borde superior fino
      doc.rect(40, 40, pageWidth, 3).fill('#1F2937')

      // Logo del club (si existe)
      let logoLoaded = false
      if (cierreData.clubLogoUrl) {
        try {
          const logoPath = cierreData.clubLogoUrl.startsWith('http')
            ? cierreData.clubLogoUrl
            : `./public${cierreData.clubLogoUrl}`

          doc.image(logoPath, 55, 55, { width: 60, height: 60 })
          logoLoaded = true
        } catch (err) {
          console.log('No se pudo cargar el logo del club:', err.message)
        }
      }

      const textStartX = logoLoaded ? 130 : 55

      doc.fontSize(11)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text(cierreData.clubNombre || '', textStartX, 55, { align: 'left' })

      const tituloInforme = esInformePrevio ? 'INFORME PREVIO AL CIERRE' : 'INFORME DE CIERRE DE CAJA'

      doc.fontSize(18)
         .fillColor('#1F2937')
         .font('Helvetica-Bold')
         .text(tituloInforme, textStartX, 72, { align: 'left' })

      if (esInformePrevio) {
        doc.fontSize(8)
           .fillColor('#9CA3AF')
           .font('Helvetica')
           .text('Documento no oficial — solo para referencia', textStartX, 96, { align: 'left' })
      }

      doc.fillColor('#000')

      // ==================== INFO DE LA CAJA ====================

      doc.y = 155

      // Caja con información de la caja y fecha
      doc.roundedRect(40, doc.y, pageWidth, 65, 4)
         .lineWidth(0.5)
         .strokeColor('#D1D5DB')
         .stroke()

      doc.roundedRect(40, doc.y, pageWidth, 24, 4)
         .fill('#374151')

      doc.fontSize(12)
         .fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .text(cierreData.cajaNombre || 'Caja', 50, doc.y - 22 + 7, { align: 'left' })

      doc.y = 155 + 34

      // Información en dos columnas
      doc.fontSize(8)
         .fillColor('#9CA3AF')
         .font('Helvetica')
         .text('FECHA:', 50, doc.y)

      doc.fontSize(10)
         .fillColor('#1F2937')
         .font('Helvetica-Bold')
         .text(cierreData.fecha, 120, doc.y)

      if (!esInformePrevio && cierreData.cerradoPor) {
        doc.fontSize(8)
           .fillColor('#9CA3AF')
           .font('Helvetica')
           .text('CERRADO POR:', 300, doc.y)

        doc.fontSize(10)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(cierreData.cerradoPor, 385, doc.y, { width: 150 })
      }

      doc.y += 18

      if (!esInformePrevio && cierreData.firmadoPor) {
        doc.fontSize(8)
           .fillColor('#9CA3AF')
           .font('Helvetica')
           .text('FIRMADO POR:', 300, doc.y)

        doc.fontSize(10)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(cierreData.firmadoPor, 385, doc.y, { width: 150 })
      }

      doc.moveDown(3)

      // ==================== RESUMEN FINANCIERO CON TARJETAS ====================

      doc.fontSize(14)
         .fillColor('#1F2937')
         .font('Helvetica-Bold')
         .text('RESUMEN FINANCIERO', 40)
         .moveDown(0.8)

      const startY = doc.y
      const cardWidth = (pageWidth - 10) / 2
      const cardHeight = esInformePrevio ? 210 : 190

      // Tarjeta izquierda - Movimientos del día
      doc.roundedRect(40, startY, cardWidth, cardHeight, 5)
         .lineWidth(1)
         .strokeColor('#E5E7EB')
         .stroke()

      // Header de la tarjeta
      doc.roundedRect(40, startY, cardWidth, 30, 5)
         .fill('#4B5563')

      doc.fontSize(10)
         .fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .text('MOVIMIENTOS DEL DIA', 50, startY + 10)

      let cardY = startY + 45

      // Saldo Inicial (solo en informe previo)
      if (esInformePrevio && cierreData.saldoInicial !== undefined) {
        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('Saldo Inicial', 50, cardY)

        doc.fontSize(13)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(`$${cierreData.saldoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 50, cardY + 12)

        cardY += 40
      }

      // Ingresos
      doc.fontSize(9)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('^ Total Ingresos', 50, cardY)

      doc.fontSize(13)
         .fillColor('#166534')
         .font('Helvetica-Bold')
         .text(`$${cierreData.totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 50, cardY + 12)

      cardY += 40

      // Egresos
      doc.fontSize(9)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('v Total Egresos', 50, cardY)

      doc.fontSize(13)
         .fillColor('#7F1D1D')
         .font('Helvetica-Bold')
         .text(`$${cierreData.totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 50, cardY + 12)

      if (esInformePrevio && cierreData.cantidadMovimientos !== undefined) {
        cardY += 40

        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('# Operaciones', 50, cardY)

        doc.fontSize(13)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(`${cierreData.cantidadMovimientos}`, 50, cardY + 12)
      }

      // Tarjeta derecha - Resultado
      const rightCardX = 40 + cardWidth + 10

      doc.roundedRect(rightCardX, startY, cardWidth, cardHeight, 5)
         .lineWidth(1)
         .strokeColor('#E5E7EB')
         .stroke()

      if (esInformePrevio) {
        // Header para informe previo
        doc.roundedRect(rightCardX, startY, cardWidth, 30, 5)
           .fill('#4B5563')

        doc.fontSize(10)
           .fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .text('SALDO ESPERADO', rightCardX + 10, startY + 10)

        const resultY = startY + 60

        doc.fontSize(10)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('Efectivo que debe haber', rightCardX + 10, resultY)

        doc.fontSize(22)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(`$${cierreData.saldoEsperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, rightCardX + 10, resultY + 20)

        doc.fontSize(8)
           .fillColor('#9CA3AF')
           .font('Helvetica')
           .text('Este monto debe coincidir con el', rightCardX + 10, resultY + 60)
           .text('efectivo contado fisicamente', rightCardX + 10, resultY + 70)

      } else {
        // Header para cierre final
        const diferencia = cierreData.diferencia
        const headerColor = diferencia === 0 ? '#374151' : diferencia > 0 ? '#374151' : '#374151'
        const headerText = diferencia === 0 ? 'CAJA BALANCEADA' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'

        doc.roundedRect(rightCardX, startY, cardWidth, 30, 5)
           .fill(headerColor)

        doc.fontSize(11)
           .fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .text(headerText, rightCardX + 10, startY + 10)

        let resultY = startY + 45

        // Saldo Sistema
        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('Saldo Sistema', rightCardX + 10, resultY)

        doc.fontSize(12)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(`$${cierreData.saldoSistema.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, rightCardX + 10, resultY + 12)

        resultY += 40

        // Saldo Real
        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('Saldo Real (Contado)', rightCardX + 10, resultY)

        doc.fontSize(12)
           .fillColor('#1F2937')
           .font('Helvetica-Bold')
           .text(`$${cierreData.saldoReal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, rightCardX + 10, resultY + 12)

        resultY += 40

        // Diferencia (destacada)
        doc.roundedRect(rightCardX + 10, resultY - 5, cardWidth - 20, 45, 3)
           .fillOpacity(0.1)
           .fill(headerColor)
           .fillOpacity(1)

        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica')
           .text('Diferencia', rightCardX + 20, resultY)

        const diferenciaColor = diferencia === 0 ? '#166534' : diferencia > 0 ? '#166534' : '#7F1D1D'
        doc.fontSize(18)
           .fillColor(diferenciaColor)
           .font('Helvetica-Bold')
           .text(`${diferencia >= 0 ? '+' : ''}$${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, rightCardX + 20, resultY + 14)
      }

      doc.y = startY + cardHeight + 20

      // ==================== DESGLOSE POR MEDIO DE PAGO ====================

      doc.fontSize(14)
         .fillColor('#1F2937')
         .font('Helvetica-Bold')
         .text('DESGLOSE POR MEDIO DE PAGO', 40)
         .moveDown(0.8)

      if (cierreData.desgloseMedioPago && cierreData.desgloseMedioPago.length > 0) {
        const tableY = doc.y

        // Fondo y borde de la tabla
        const rowHeight = 28
        const tableHeight = (cierreData.desgloseMedioPago.length + 1) * rowHeight

        doc.roundedRect(40, tableY, pageWidth, tableHeight, 5)
           .lineWidth(1)
           .strokeColor('#E5E7EB')
           .stroke()

        // Header de la tabla
        doc.rect(40, tableY, pageWidth, rowHeight)
           .fill('#F9FAFB')

        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica-Bold')
           .text('MEDIO DE PAGO', 50, tableY + 10, { width: 180 })
           .text('INGRESOS', 240, tableY + 10, { width: 100, align: 'right' })
           .text('EGRESOS', 350, tableY + 10, { width: 100, align: 'right' })
           .text('TOTAL', 460, tableY + 10, { width: 80, align: 'right' })

        let currentRowY = tableY + rowHeight

        cierreData.desgloseMedioPago.forEach((item, index) => {
          // Fondo alternado
          if (index % 2 === 0) {
            doc.rect(40, currentRowY, pageWidth, rowHeight)
               .fillOpacity(0.03)
               .fill('#000000')
               .fillOpacity(1)
          }

          // Línea separadora
          doc.moveTo(40, currentRowY)
             .lineTo(40 + pageWidth, currentRowY)
             .strokeColor('#F3F4F6')
             .stroke()

          // Contenido de la fila
          doc.fontSize(10)
             .fillColor('#1F2937')
             .font('Helvetica')
             .text(item.nombre, 50, currentRowY + 9, { width: 180 })

          doc.font('Helvetica-Bold')
             .fillColor('#166534')
             .text(`$${item.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 240, currentRowY + 9, { width: 100, align: 'right' })

          doc.fillColor('#7F1D1D')
             .text(`$${item.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 350, currentRowY + 9, { width: 100, align: 'right' })

          const totalColor = item.total >= 0 ? '#1F2937' : '#7F1D1D'
          doc.fillColor(totalColor)
             .text(`$${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 460, currentRowY + 9, { width: 80, align: 'right' })

          currentRowY += rowHeight
        })

        doc.y = currentRowY + 10
      } else {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#9CA3AF')
           .text('No hay movimientos registrados', { align: 'center' })
        doc.moveDown(1)
      }

      doc.moveDown(1)

      // ==================== DESGLOSE POR CONCEPTO ====================

      doc.fontSize(14)
         .fillColor('#1F2937')
         .font('Helvetica-Bold')
         .text('DESGLOSE POR CONCEPTO', 40)
         .moveDown(0.8)

      if (cierreData.desgloseConcepto && cierreData.desgloseConcepto.length > 0) {
        const tableY = doc.y
        const rowHeight = 32

        // Verificar si necesitamos nueva página
        if (tableY > 650) {
          doc.addPage()
          doc.y = 80
        }

        const tableHeight = (cierreData.desgloseConcepto.length + 1) * rowHeight

        // Fondo y borde de la tabla
        doc.roundedRect(40, doc.y, pageWidth, tableHeight, 5)
           .lineWidth(1)
           .strokeColor('#E5E7EB')
           .stroke()

        const headerY = doc.y

        // Header de la tabla
        doc.rect(40, headerY, pageWidth, rowHeight)
           .fill('#F9FAFB')

        doc.fontSize(9)
           .fillColor('#6B7280')
           .font('Helvetica-Bold')
           .text('CONCEPTO', 50, headerY + 11, { width: 200 })
           .text('CANT.', 260, headerY + 11, { width: 50, align: 'center' })
           .text('INGRESOS', 320, headerY + 11, { width: 100, align: 'right' })
           .text('EGRESOS', 430, headerY + 11, { width: 100, align: 'right' })

        let currentRowY = headerY + rowHeight

        cierreData.desgloseConcepto.forEach((item, index) => {
          // Verificar nueva página
          if (currentRowY > 750) {
            doc.addPage()
            currentRowY = 80
          }

          // Fondo alternado
          if (index % 2 === 0) {
            doc.rect(40, currentRowY, pageWidth, rowHeight)
               .fillOpacity(0.03)
               .fill('#000000')
               .fillOpacity(1)
          }

          // Línea separadora
          doc.moveTo(40, currentRowY)
             .lineTo(40 + pageWidth, currentRowY)
             .strokeColor('#F3F4F6')
             .stroke()

          // Contenido de la fila
          doc.fontSize(9)
             .fillColor('#1F2937')
             .font('Helvetica')
             .text(item.concepto, 50, currentRowY + 11, { width: 200 })

          doc.font('Helvetica-Bold')
             .fillColor('#6B7280')
             .text(item.cantidad.toString(), 260, currentRowY + 11, { width: 50, align: 'center' })

          doc.fillColor('#166534')
             .text(`$${item.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 320, currentRowY + 11, { width: 100, align: 'right' })

          doc.fillColor('#7F1D1D')
             .text(`$${item.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 430, currentRowY + 11, { width: 100, align: 'right' })

          currentRowY += rowHeight
        })

        doc.y = currentRowY + 10
      } else {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#9CA3AF')
           .text('No hay movimientos registrados', { align: 'center' })
        doc.moveDown(1)
      }

      // ==================== OBSERVACIONES ====================

      if (cierreData.observaciones) {
        doc.moveDown(1.5)

        doc.roundedRect(40, doc.y, pageWidth, 'auto', 5)
           .lineWidth(1)
           .strokeColor('#E5E7EB')

        const obsY = doc.y

        doc.rect(40, obsY, pageWidth, 25)
           .fill('#F3F4F6')

        doc.fontSize(10)
           .fillColor('#374151')
           .font('Helvetica-Bold')
           .text('OBSERVACIONES', 50, obsY + 7)

        doc.y = obsY + 35

        doc.fontSize(9)
           .fillColor('#374151')
           .font('Helvetica')
           .text(cierreData.observaciones, 50, doc.y, { width: pageWidth - 20, align: 'left' })

        const textHeight = doc.heightOfString(cierreData.observaciones, { width: pageWidth - 20 })

        doc.roundedRect(40, obsY, pageWidth, 35 + textHeight + 15, 5)
           .lineWidth(1)
           .strokeColor('#E5E7EB')
           .stroke()

        doc.y = obsY + 35 + textHeight + 20
      }

      // ==================== FOOTER MEJORADO ====================

      const footerStartY = doc.page.height - 80

      // Ir al footer
      if (doc.y > footerStartY - 20) {
        doc.addPage()
        doc.y = footerStartY
      } else {
        doc.y = footerStartY
      }

      // Línea separadora superior
      doc.moveTo(40, doc.y)
         .lineTo(40 + pageWidth, doc.y)
         .strokeColor('#E5E7EB')
         .lineWidth(1)
         .stroke()

      doc.moveDown(0.8)

      // Información del footer en dos columnas
      const footerTextY = doc.y

      doc.fontSize(7)
         .fillColor('#9CA3AF')
         .font('Helvetica')
         .text('Fecha de generacion:', 50, footerTextY)

      doc.fontSize(8)
         .fillColor('#6B7280')
         .font('Helvetica-Bold')
         .text(new Date().toLocaleString('es-AR', {
           day: '2-digit',
           month: '2-digit',
           year: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         }), 50, footerTextY + 10)

      doc.fontSize(7)
         .fillColor('#9CA3AF')
         .font('Helvetica')
         .text('Sistema:', 350, footerTextY, { align: 'right', width: 185 })

      doc.fontSize(8)
         .fillColor('#6B7280')
         .font('Helvetica-Bold')
         .text('Clubix - Gestion de Club', 350, footerTextY + 10, { align: 'right', width: 185 })

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera un PDF de prueba con datos de ejemplo
 * @param {Object} prisma - Cliente de Prisma
 * @param {string} tipo - Tipo de PDF
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generateTestPDF(prisma, tipo) {
  // Datos de ejemplo según el tipo
  const testData = {
    RECIBO: {
      clubNombre: 'Club Sportivo Pilar',
      clubLema: 'El equipo de la ciudad',
      clubDireccion: 'Calle Falsa 123, Pilar',
      clubTelefono: '0230-1234567',
      clubEmail: 'info@clubpilar.com',
      numero: 'R-00001234',
      fecha: new Date().toLocaleDateString('es-AR'),
      fechaGeneracion: new Date().toLocaleString('es-AR'),
      socioNombre: 'Juan Pérez',
      socioNumero: '12345',
      medioPago: 'Transferencia Bancaria',
      nroOperacion: 'OP-98765',
      montoTotal: '15000.00',
      items: [
        { concepto: 'Cuota Social', periodo: 'Enero 2026', monto: '5000.00' },
        { concepto: 'Actividad Fútbol', periodo: 'Enero 2026', monto: '10000.00' }
      ],
      observaciones: 'Pago recibido correctamente'
    },
    FACTURA: {
      clubNombre: 'Club Sportivo Pilar',
      clubLogo: null,
      clubDireccion: 'Calle Falsa 123, Pilar',
      clubTelefono: '0230-1234567',
      clubEmail: 'info@clubpilar.com',
      clubCuit: '30-12345678-9',
      tipoFactura: 'C',
      puntoVenta: '0001',
      numeroFactura: '00001234',
      fecha: new Date().toLocaleDateString('es-AR'),
      clienteNombre: 'María González',
      clienteDni: '12.345.678',
      subtotal: '10000.00',
      iva: '0.00',
      ivaPorc: '0',
      total: '10000.00',
      items: [
        { cantidad: 2, descripcion: 'Entrada al buffet', precioUnitario: '5000.00', subtotal: '10000.00' }
      ]
    }
  }

  const data = testData[tipo]
  if (!data) {
    throw new Error(`No hay datos de prueba para el tipo "${tipo}"`)
  }

  return await generatePDF(prisma, tipo, data)
}

// Registrar helpers de Handlebars
handlebars.registerHelper('formatCurrency', function(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(value)
})

handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleDateString('es-AR')
})

// ─────────────────────────────────────────────────────────
// Helpers para el recibo
// ─────────────────────────────────────────────────────────

function _unidades(n) {
  const u = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  return u[n] || ''
}

function _decenas(n) {
  if (n < 20) return _unidades(n)
  const d = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const dec = Math.floor(n / 10)
  const uni = n % 10
  if (dec === 2) return uni === 0 ? 'VEINTE' : `VEINTI${_unidades(uni)}`
  return uni === 0 ? d[dec] : `${d[dec]} Y ${_unidades(uni)}`
}

function _centenas(n) {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
  const cen = Math.floor(n / 100)
  const resto = n % 100
  return resto === 0 ? c[cen] : `${c[cen]} ${_decenas(resto)}`
}

function _miles(n) {
  if (n === 0) return ''
  if (n === 1) return 'MIL'
  return `${_centenas(n)} MIL`
}

function numeroALetras(numero) {
  const entero = Math.floor(Math.abs(numero))
  const centavos = Math.round((Math.abs(numero) - entero) * 100)

  let texto = ''
  if (entero === 0) {
    texto = 'CERO'
  } else {
    const millones = Math.floor(entero / 1000000)
    const miles = Math.floor((entero % 1000000) / 1000)
    const cientos = entero % 1000

    const partes = []
    if (millones > 0) partes.push(millones === 1 ? 'UN MILLÓN' : `${_centenas(millones)} MILLONES`)
    if (miles > 0) partes.push(_miles(miles))
    if (cientos > 0) partes.push(_centenas(cientos))

    texto = partes.join(' ')
  }

  return `${texto} CON ${centavos}/100`
}

/**
 * Genera un PDF de recibo directamente desde un objeto pago de Prisma.
 * No requiere template en DB.
 */
export async function generarReciboPagoPDF(pago, adminNombre = '', configMap = {}) {
  return new Promise((resolve, reject) => {
    try {
      const MG = 30          // margen lateral
      const PW = 595.28      // ancho A4
      const INNER = PW - MG * 2  // 535.28

      const doc = new PDFDocument({ size: 'A4', margin: MG, autoFirstPage: true })
      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const clubNombre = configMap.CLUB_NOMBRE || 'Club Sportivo Pilar'
      const clubDir    = configMap.CLUB_DIRECCION || 'Avda. Tomás Marquez 1125 - (1629) Pilar - Bs As.'
      const clubTel    = configMap.CLUB_TELEFONO || 'Tel: (0230) 4420297'

      const fechaObj = new Date(pago.fecha)
      const fechaStr = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

      // Partir numero "0001-55565786" → punto de venta + numero
      const partes = (pago.numero || '').split('-')
      const puntoVenta = partes[0] || '0001'
      const nroRecibo  = partes[1] || pago.numero || ''

      const montoTotal = Number(pago.montoTotal || 0)
      const montoStr   = montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })
      const montoLetras = numeroALetras(montoTotal)

      const socio  = pago.socio || {}
      const cargos = pago.cargos || []
      const mediosPago = pago.mediosPago || []

      // Construir dirección del socio
      const domParts = [socio.domicilio || socio.calle, socio.ciudad].filter(Boolean)
      const domicilioStr = domParts.join(' - ') || ''

      // ─────────────────────────────────────────────────────
      // SECCIÓN 1: CABECERA
      // ─────────────────────────────────────────────────────
      // Borde exterior de la cabecera
      const HDR_TOP  = MG
      const HDR_H    = 90
      const HDR_BOT  = HDR_TOP + HDR_H

      doc.rect(MG, HDR_TOP, INNER, HDR_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Separador vertical izquierdo del bloque tipo (a 2/5 del ancho)
      const divX1 = MG + INNER * 0.42
      const divX2 = MG + INNER * 0.58
      doc.moveTo(divX1, HDR_TOP).lineTo(divX1, HDR_BOT).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.moveTo(divX2, HDR_TOP).lineTo(divX2, HDR_BOT).strokeColor('#000000').lineWidth(0.5).stroke()

      // ── Bloque izquierdo: logo + datos del club ──
      const LX = MG + 8
      const logoUrl = configMap.CLUB_LOGO_URL || null
      const LOGO_SIZE = 54
      let logoLoaded = false

      if (logoUrl) {
        try {
          let logoPath
          if (logoUrl.startsWith('http')) {
            logoPath = logoUrl
          } else if (logoUrl.startsWith('/uploads/')) {
            logoPath = `./uploads${logoUrl.slice('/uploads'.length)}`
          } else {
            logoPath = `./public${logoUrl}`
          }
          const logoY = HDR_TOP + (HDR_H - LOGO_SIZE) / 2
          doc.image(logoPath, LX, logoY, { width: LOGO_SIZE, height: LOGO_SIZE, fit: [LOGO_SIZE, LOGO_SIZE] })
          logoLoaded = true
        } catch (e) {
          console.log('Logo no disponible:', e.message)
        }
      }

      const textX = logoLoaded ? LX + LOGO_SIZE + 6 : LX
      const textW = divX1 - textX - 4
      const textY = logoLoaded ? HDR_TOP + (HDR_H - 42) / 2 : HDR_TOP + 8

      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
         .text(clubNombre, textX, textY, { width: textW })
      doc.font('Helvetica').fontSize(7)
         .text(clubDir, textX, doc.y + 2, { width: textW })
         .text(clubTel, textX, doc.y + 1, { width: textW })

      // ── Bloque central: tipo comprobante ──
      const CX = divX1 + 2
      const CW = divX2 - divX1 - 4
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(38)
         .text('C', CX, HDR_TOP + 10, { width: CW, align: 'center' })
      doc.fontSize(9).text(puntoVenta, CX, HDR_TOP + 56, { width: CW, align: 'center' })

      // ── Bloque derecho: datos del comprobante ──
      const RX = divX2 + 6
      const RW = MG + INNER - RX - 4

      // Fila superior: "RECIBOS C" + "ORIGINAL"
      doc.font('Helvetica-Bold').fontSize(11)
         .text('RECIBOS C', RX, HDR_TOP + 6, { width: RW * 0.6 })

      doc.rect(RX + RW * 0.62, HDR_TOP + 4, RW * 0.36, 14).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.font('Helvetica-Bold').fontSize(7)
         .text('ORIGINAL', RX + RW * 0.62 + 2, HDR_TOP + 7, { width: RW * 0.36, align: 'center' })

      doc.font('Helvetica').fontSize(8)
         .text(`Nº   ${puntoVenta} - ${nroRecibo}`, RX, HDR_TOP + 24, { width: RW })
         .text(`Fecha:  ${fechaStr}`, RX, doc.y + 4, { width: RW })

      // Separador horizontal interno en bloque derecho antes de IVA
      doc.moveTo(divX2, HDR_TOP + HDR_H - 18).lineTo(MG + INNER, HDR_TOP + HDR_H - 18).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#000000')
         .text('I.V.A EXENTO', RX, HDR_TOP + HDR_H - 14, { width: RW, align: 'center' })

      // ─────────────────────────────────────────────────────
      // SECCIÓN 2: DATOS DEL SOCIO
      // ─────────────────────────────────────────────────────
      const SEC2_TOP = HDR_BOT
      const SEC2_H   = 62
      const SEC2_BOT = SEC2_TOP + SEC2_H

      doc.rect(MG, SEC2_TOP, INNER, SEC2_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Línea divisoria horizontal a mitad de la sección (para separar nombre/dir de socio-num/caja)
      const midSocioY = SEC2_TOP + 42
      doc.moveTo(MG, midSocioY).lineTo(MG + INNER, midSocioY).strokeColor('#000000').lineWidth(0.5).stroke()

      // Divisor vertical en la fila inferior
      const midSecX = MG + INNER / 2
      doc.moveTo(midSecX, midSocioY).lineTo(midSecX, SEC2_BOT).strokeColor('#000000').lineWidth(0.5).stroke()

      const S2X = MG + 6
      const S2W = INNER - 12

      // Fila 1: RECIBIMOS DE
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
         .text('RECIBIMOS DE:', S2X, SEC2_TOP + 5, { continued: true })
         .font('Helvetica').text(`  ${socio.apellidoNombre || '-'}`)

      // Fila 2: DIRECCIÓN
      doc.font('Helvetica-Bold').fontSize(8)
         .text('DIRECCIÓN:', S2X, doc.y + 2, { continued: true })
         .font('Helvetica').text(`  ${domicilioStr || '-'}`)

      // Fila 3: LA CANTIDAD DE PESOS
      doc.font('Helvetica-Bold').fontSize(8)
         .text('LA CANTIDAD DE PESOS:', S2X, doc.y + 2, { continued: true })
         .font('Helvetica').text(`  ${montoLetras}`)

      // Fila inferior izquierda: Nro Socio
      doc.font('Helvetica-Bold').fontSize(8)
         .text('Nro Socio:', S2X, midSocioY + 4, { continued: true })
         .font('Helvetica').text(`  ${socio.nroSocio || '-'}`)

      // Fila inferior derecha: Caja
      doc.font('Helvetica-Bold').fontSize(8)
         .text('Caja:', midSecX + 6, midSocioY + 4, { continued: true })
         .font('Helvetica').text(`  ${pago.caja?.nombre || pago.medioPago?.nombre || '-'}`)

      // ─────────────────────────────────────────────────────
      // SECCIÓN 3: TABLA CONCEPTOS | MEDIOS DE PAGO
      // ─────────────────────────────────────────────────────
      const HDR_ROW_H = 16
      const ROW_H     = 14
      const numRows   = Math.max(cargos.length, mediosPago.length > 0 ? mediosPago.length : 1, 1)
      // Máximo disponible en la página para que el footer no se salga
      const PAGE_H    = doc.page.height
      const MAX_TBL_H = PAGE_H - MG - SEC2_BOT - 40 - 35  // footer + subfooter + margen
      const TBL_TOP   = SEC2_BOT
      const TBL_H     = Math.min(Math.max(HDR_ROW_H + numRows * ROW_H + 10, 60), MAX_TBL_H)
      const TBL_BOT   = TBL_TOP + TBL_H

      // Borde tabla
      doc.rect(MG, TBL_TOP, INNER, TBL_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Divisor vertical central de la tabla
      const divTblX = MG + INNER / 2
      doc.moveTo(divTblX, TBL_TOP).lineTo(divTblX, TBL_BOT).strokeColor('#000000').lineWidth(0.5).stroke()

      // ── Cabeceras de columnas ──
      doc.rect(MG, TBL_TOP, INNER / 2, HDR_ROW_H).fillColor('#f3f4f6').fillOpacity(1)
         .fill().fillOpacity(1)
      doc.rect(divTblX, TBL_TOP, INNER / 2, HDR_ROW_H).fillColor('#f3f4f6').fillOpacity(1)
         .fill().fillOpacity(1)
      doc.rect(MG, TBL_TOP, INNER, HDR_ROW_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Anchos columnas lado izquierdo: CONCEPTO | IMPORTE
      const LCW = INNER / 2  // 267.64
      const lcConcepto = LCW - 65
      const lcImporte  = 65

      // Anchos columnas lado derecho: FORMA PAGO | LEYENDA | IMPORTE
      const RCW = INNER / 2
      const rcFormaPago = 70
      const rcLeyenda   = RCW - rcFormaPago - 65
      const rcImporte   = 65

      const HDR_Y = TBL_TOP + 4

      // Padding interno de las columnas IMPORTE (evita que el texto llegue al borde)
      const IMP_PAD = 8

      // Cabeceras izquierda
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(7)
         .text('CONCEPTO', MG + 4, HDR_Y, { width: lcConcepto })
      doc.text('IMPORTE', MG + 4 + lcConcepto, HDR_Y, { width: lcImporte - IMP_PAD, align: 'right' })

      // Separador vertical importe izquierdo
      doc.moveTo(divTblX - lcImporte, TBL_TOP).lineTo(divTblX - lcImporte, TBL_BOT)
         .strokeColor('#000000').lineWidth(0.3).stroke()

      // Cabeceras derecha
      doc.text('FORMA PAGO', divTblX + 4, HDR_Y, { width: rcFormaPago })
      doc.text('LEYENDA', divTblX + 4 + rcFormaPago, HDR_Y, { width: rcLeyenda })
      doc.text('IMPORTE', divTblX + 4 + rcFormaPago + rcLeyenda, HDR_Y, { width: rcImporte - IMP_PAD, align: 'right' })

      // Separadores verticales derecha
      doc.moveTo(divTblX + rcFormaPago, TBL_TOP + HDR_ROW_H).lineTo(divTblX + rcFormaPago, TBL_BOT)
         .strokeColor('#000000').lineWidth(0.3).stroke()
      doc.moveTo(divTblX + rcFormaPago + rcLeyenda, TBL_TOP).lineTo(divTblX + rcFormaPago + rcLeyenda, TBL_BOT)
         .strokeColor('#000000').lineWidth(0.3).stroke()

      // Línea bajo cabecera
      doc.moveTo(MG, TBL_TOP + HDR_ROW_H).lineTo(MG + INNER, TBL_TOP + HDR_ROW_H)
         .strokeColor('#000000').lineWidth(0.5).stroke()

      // ── Filas de contenido ──
      let rowY = TBL_TOP + HDR_ROW_H + 4

      doc.fillColor('#111827').font('Helvetica').fontSize(7.5)

      cargos.forEach(c => {
        const concepto = [
          c.periodo?.nombre,
          c.conceptoTesoreria?.nombre || c.descripcion || 'Cuota',
          c.categoriaActividad ? `${c.categoriaActividad.actividad?.nombre || ''} ${c.categoriaActividad.nombre || ''}`.trim() : null
        ].filter(Boolean).join(' - ')
        const monto = `$ ${Number(c.montoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

        doc.text(concepto, MG + 4, rowY, { width: lcConcepto, ellipsis: true, lineBreak: false })
        doc.text(monto, MG + 4 + lcConcepto, rowY, { width: lcImporte - IMP_PAD, align: 'right', lineBreak: false })
        rowY += ROW_H
      })

      // Filas derecha (medios de pago)
      let rowYR = TBL_TOP + HDR_ROW_H + 4
      const leyendaBase = socio.nroSocio
        ? `(S${socio.nroSocio}) ${socio.apellidoNombre || ''} / ${socio.estado || 'ACTIVO'}`
        : socio.apellidoNombre || ''

      if (mediosPago.length > 0) {
        mediosPago.forEach(mp => {
          const formaPago = mp.medioPago?.nombre || mp.caja?.nombre || '-'
          const leyenda   = leyendaBase
          const monto     = `$ ${Number(mp.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

          doc.text(formaPago, divTblX + 4, rowYR, { width: rcFormaPago - 4, lineBreak: false })
          doc.text(leyenda, divTblX + 4 + rcFormaPago, rowYR, { width: rcLeyenda - 4, ellipsis: true, lineBreak: false })
          doc.text(monto, divTblX + 4 + rcFormaPago + rcLeyenda, rowYR, { width: rcImporte - IMP_PAD, align: 'right', lineBreak: false })
          rowYR += ROW_H
        })
      } else if (pago.medioPago) {
        // Fallback si no hay mediosPago[]
        const formaPago = pago.medioPago?.nombre || '-'
        doc.text(formaPago, divTblX + 4, rowYR, { width: rcFormaPago - 4, lineBreak: false })
        doc.text(leyendaBase, divTblX + 4 + rcFormaPago, rowYR, { width: rcLeyenda - 4, ellipsis: true, lineBreak: false })
        doc.text(`$ ${montoStr}`, divTblX + 4 + rcFormaPago + rcLeyenda, rowYR, { width: rcImporte - IMP_PAD, align: 'right', lineBreak: false })
      }

      // ─────────────────────────────────────────────────────
      // SECCIÓN 4: FOOTER
      // ─────────────────────────────────────────────────────
      const FTR_TOP = TBL_BOT
      const FTR_H   = 40
      const FTR_BOT = FTR_TOP + FTR_H

      doc.rect(MG, FTR_TOP, INNER, FTR_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Divisores verticales footer
      const fDiv1 = MG + INNER * 0.28
      const fDiv2 = MG + INNER * 0.52
      const fDiv3 = MG + INNER * 0.72

      doc.moveTo(fDiv1, FTR_TOP).lineTo(fDiv1, FTR_BOT).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.moveTo(fDiv2, FTR_TOP).lineTo(fDiv2, FTR_BOT).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.moveTo(fDiv3, FTR_TOP).lineTo(fDiv3, FTR_BOT).strokeColor('#000000').lineWidth(0.5).stroke()

      doc.fillColor('#374151').font('Helvetica').fontSize(7)
         .text('FIRMA AUTORIZADA', MG + 4, FTR_TOP + 14, { width: fDiv1 - MG - 8, align: 'center' })
         .text('SELLO AUTORIZADO', fDiv1 + 4, FTR_TOP + 14, { width: fDiv2 - fDiv1 - 8, align: 'center' })

      doc.font('Helvetica-Bold').fontSize(8)
         .text('TOTAL', fDiv2 + 4, FTR_TOP + 10, { width: fDiv3 - fDiv2 - 8, align: 'right' })
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
         .text(`$${montoStr}`, fDiv3 + 4, FTR_TOP + 8, { width: MG + INNER - fDiv3 - 8, align: 'right' })

      // ─────────────────────────────────────────────────────
      // SECCIÓN 5: SUB-FOOTER (Imprimió, CAI, VTO)
      // ─────────────────────────────────────────────────────
      const SF_TOP = FTR_BOT + 4
      doc.fillColor('#6b7280').font('Helvetica').fontSize(7)

      if (adminNombre) {
        doc.text(`Imprimió: ${adminNombre}`, fDiv3 + 4, SF_TOP, { width: MG + INNER - fDiv3 - 8 })
      }

      doc.text('C.A.I.:', fDiv3 + 4, SF_TOP + 10, { width: MG + INNER - fDiv3 - 8 })
      doc.text('VTO:', fDiv3 + 4, SF_TOP + 18, { width: MG + INNER - fDiv3 - 8 })

      // Nombre socio + periodo al pie izquierdo
      const periodoStr = cargos.length > 0 ? (cargos[0].periodo?.nombre || '') : ''
      doc.font('Helvetica').fontSize(7).fillColor('#374151')
         .text(`${socio.apellidoNombre || ''} (${socio.nroSocio || ''}) - ${periodoStr}`, MG, SF_TOP + 2)

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera el PDF del comprobante de un Movimiento de Caja (ingreso/egreso suelto).
 * Mismo layout que el recibo de pago, adaptado a la información del movimiento:
 * cabecera con club + tipo (I/E), datos del socio o entidad, tabla con concepto/items
 * y medios de pago, footer con total.
 */
export async function generarComprobanteMovimientoPDF(movimiento, adminNombre = '', configMap = {}) {
  return new Promise((resolve, reject) => {
    try {
      const MG = 30
      const PW = 595.28
      const INNER = PW - MG * 2

      const doc = new PDFDocument({ size: 'A4', margin: MG, autoFirstPage: true })
      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const clubNombre = configMap.CLUB_NOMBRE || 'Club'
      const clubDir    = configMap.CLUB_DIRECCION || ''
      const clubTel    = configMap.CLUB_TELEFONO || ''

      const esIngreso = movimiento.tipo === 'INGRESO'
      const tipoLetra = esIngreso ? 'I' : 'E'
      const tipoLabel = esIngreso ? 'COMPROBANTE INGRESO' : 'COMPROBANTE EGRESO'
      const verbo     = esIngreso ? 'RECIBIMOS DE:' : 'PAGAMOS A:'

      const fechaObj = new Date(movimiento.fecha)
      const fechaStr = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

      const partes = (movimiento.numero || '').split('-')
      const puntoVenta = partes[0] || '0001'
      const nroComp    = partes[1] || movimiento.numero || ''

      const montoTotal  = Number(movimiento.monto || 0)
      const montoStr    = montoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })
      const montoLetras = numeroALetras(montoTotal)

      // Persona/entidad asociada al movimiento
      const socio   = movimiento.socio || movimiento.pago?.socio || null
      const entidad = movimiento.entidad || null
      const nombrePersona = socio?.apellidoNombre || entidad?.razonSocial || entidad?.nombreFantasia || '-'
      const docPersona    = socio?.documento || entidad?.documento || ''
      const idPersona     = socio?.nroSocio ? `Socio #${socio.nroSocio}` : (entidad?.tipo ? entidad.tipo : '')

      const items      = Array.isArray(movimiento.items) && movimiento.items.length > 0 ? movimiento.items : []
      const mediosPago = movimiento.mediosPago || []

      // ─── Cabecera ───
      const HDR_TOP = MG, HDR_H = 90, HDR_BOT = HDR_TOP + HDR_H
      doc.rect(MG, HDR_TOP, INNER, HDR_H).strokeColor('#000000').lineWidth(0.5).stroke()
      const divX1 = MG + INNER * 0.42
      const divX2 = MG + INNER * 0.58
      doc.moveTo(divX1, HDR_TOP).lineTo(divX1, HDR_BOT).stroke()
      doc.moveTo(divX2, HDR_TOP).lineTo(divX2, HDR_BOT).stroke()

      // Bloque izquierdo — logo + datos del club
      const LX = MG + 8
      const logoUrl = configMap.CLUB_LOGO_URL || null
      const LOGO_SIZE = 54
      let logoLoaded = false
      if (logoUrl) {
        try {
          let logoPath
          if (logoUrl.startsWith('http')) logoPath = logoUrl
          else if (logoUrl.startsWith('/uploads/')) logoPath = `./uploads${logoUrl.slice('/uploads'.length)}`
          else logoPath = `./public${logoUrl}`
          const logoY = HDR_TOP + (HDR_H - LOGO_SIZE) / 2
          doc.image(logoPath, LX, logoY, { width: LOGO_SIZE, height: LOGO_SIZE, fit: [LOGO_SIZE, LOGO_SIZE] })
          logoLoaded = true
        } catch (e) { /* ignore */ }
      }
      const textX = logoLoaded ? LX + LOGO_SIZE + 6 : LX
      const textW = divX1 - textX - 4
      const textY = logoLoaded ? HDR_TOP + (HDR_H - 42) / 2 : HDR_TOP + 8
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9).text(clubNombre, textX, textY, { width: textW })
      doc.font('Helvetica').fontSize(7)
        .text(clubDir, textX, doc.y + 2, { width: textW })
        .text(clubTel, textX, doc.y + 1, { width: textW })

      // Bloque central — tipo I/E
      const CX = divX1 + 2, CW = divX2 - divX1 - 4
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(38).text(tipoLetra, CX, HDR_TOP + 10, { width: CW, align: 'center' })
      doc.fontSize(9).text(puntoVenta, CX, HDR_TOP + 56, { width: CW, align: 'center' })

      // Bloque derecho
      const RX = divX2 + 6, RW = MG + INNER - RX - 4
      doc.font('Helvetica-Bold').fontSize(11).text(tipoLabel, RX, HDR_TOP + 6, { width: RW * 0.6 })
      doc.rect(RX + RW * 0.62, HDR_TOP + 4, RW * 0.36, 14).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.font('Helvetica-Bold').fontSize(7).text('ORIGINAL', RX + RW * 0.62 + 2, HDR_TOP + 7, { width: RW * 0.36, align: 'center' })
      doc.font('Helvetica').fontSize(8)
        .text(`Nº   ${puntoVenta} - ${nroComp}`, RX, HDR_TOP + 24, { width: RW })
        .text(`Fecha:  ${fechaStr}`, RX, doc.y + 4, { width: RW })

      doc.moveTo(divX2, HDR_TOP + HDR_H - 18).lineTo(MG + INNER, HDR_TOP + HDR_H - 18).strokeColor('#000000').lineWidth(0.5).stroke()
      doc.font('Helvetica-Bold').fontSize(7).text('I.V.A EXENTO', RX, HDR_TOP + HDR_H - 14, { width: RW, align: 'center' })

      // ─── Datos del receptor ───
      const SEC2_TOP = HDR_BOT, SEC2_H = 62, SEC2_BOT = SEC2_TOP + SEC2_H
      doc.rect(MG, SEC2_TOP, INNER, SEC2_H).strokeColor('#000000').lineWidth(0.5).stroke()
      const midSocioY = SEC2_TOP + 42
      doc.moveTo(MG, midSocioY).lineTo(MG + INNER, midSocioY).stroke()
      const midSecX = MG + INNER / 2
      doc.moveTo(midSecX, midSocioY).lineTo(midSecX, SEC2_BOT).stroke()
      const S2X = MG + 6
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000')
        .text(verbo, S2X, SEC2_TOP + 5, { continued: true })
        .font('Helvetica').text(`  ${nombrePersona}`)
      doc.font('Helvetica-Bold').fontSize(8)
        .text('CONCEPTO:', S2X, doc.y + 2, { continued: true })
        .font('Helvetica').text(`  ${movimiento.concepto || movimiento.descripcion || '-'}`)
      doc.font('Helvetica-Bold').fontSize(8)
        .text('LA CANTIDAD DE PESOS:', S2X, doc.y + 2, { continued: true })
        .font('Helvetica').text(`  ${montoLetras}`)
      doc.font('Helvetica-Bold').fontSize(8)
        .text(idPersona ? 'Identif:' : 'Documento:', S2X, midSocioY + 4, { continued: true })
        .font('Helvetica').text(`  ${idPersona || docPersona || '-'}`)
      doc.font('Helvetica-Bold').fontSize(8)
        .text('Caja:', midSecX + 6, midSocioY + 4, { continued: true })
        .font('Helvetica').text(`  ${movimiento.caja?.nombre || '-'}`)

      // ─── Tabla items / medios de pago ───
      const HDR_ROW_H = 16, ROW_H = 14
      const filasIzq = items.length > 0 ? items.length : 1
      const filasDer = mediosPago.length > 0 ? mediosPago.length : 1
      const numRows  = Math.max(filasIzq, filasDer, 1)
      const PAGE_H   = doc.page.height
      const MAX_TBL_H = PAGE_H - MG - SEC2_BOT - 40 - 35
      const TBL_TOP  = SEC2_BOT
      const TBL_H    = Math.min(Math.max(HDR_ROW_H + numRows * ROW_H + 10, 60), MAX_TBL_H)
      const TBL_BOT  = TBL_TOP + TBL_H

      doc.rect(MG, TBL_TOP, INNER, TBL_H).strokeColor('#000000').lineWidth(0.5).stroke()
      const divTblX = MG + INNER / 2
      doc.moveTo(divTblX, TBL_TOP).lineTo(divTblX, TBL_BOT).stroke()

      doc.rect(MG, TBL_TOP, INNER / 2, HDR_ROW_H).fillColor('#f3f4f6').fillOpacity(1).fill().fillOpacity(1)
      doc.rect(divTblX, TBL_TOP, INNER / 2, HDR_ROW_H).fillColor('#f3f4f6').fillOpacity(1).fill().fillOpacity(1)
      doc.rect(MG, TBL_TOP, INNER, HDR_ROW_H).strokeColor('#000000').lineWidth(0.5).stroke()

      const LCW = INNER / 2
      const lcConcepto = LCW - 65
      const lcImporte  = 65
      const RCW = INNER / 2
      const rcFormaPago = 70
      const rcLeyenda   = RCW - rcFormaPago - 65
      const rcImporte   = 65
      const HDR_Y = TBL_TOP + 4
      const IMP_PAD = 8

      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(7)
        .text('CONCEPTO', MG + 4, HDR_Y, { width: lcConcepto })
        .text('IMPORTE', MG + 4 + lcConcepto, HDR_Y, { width: lcImporte - IMP_PAD, align: 'right' })

      doc.moveTo(divTblX - lcImporte, TBL_TOP).lineTo(divTblX - lcImporte, TBL_BOT).strokeColor('#000000').lineWidth(0.3).stroke()

      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(7)
        .text('FORMA PAGO', divTblX + 4, HDR_Y, { width: rcFormaPago })
        .text('LEYENDA', divTblX + 4 + rcFormaPago, HDR_Y, { width: rcLeyenda })
        .text('IMPORTE', divTblX + 4 + rcFormaPago + rcLeyenda, HDR_Y, { width: rcImporte - IMP_PAD, align: 'right' })

      doc.moveTo(divTblX + rcFormaPago, TBL_TOP + HDR_ROW_H).lineTo(divTblX + rcFormaPago, TBL_BOT).strokeColor('#000000').lineWidth(0.3).stroke()
      doc.moveTo(divTblX + rcFormaPago + rcLeyenda, TBL_TOP).lineTo(divTblX + rcFormaPago + rcLeyenda, TBL_BOT).strokeColor('#000000').lineWidth(0.3).stroke()
      doc.moveTo(MG, TBL_TOP + HDR_ROW_H).lineTo(MG + INNER, TBL_TOP + HDR_ROW_H).strokeColor('#000000').lineWidth(0.5).stroke()

      // Filas izquierda — items o concepto único
      let rowY = TBL_TOP + HDR_ROW_H + 4
      doc.fillColor('#111827').font('Helvetica').fontSize(7.5)
      if (items.length > 0) {
        items.forEach(it => {
          const concepto = [it.conceptoTesoreria?.nombre, it.descripcion].filter(Boolean).join(' - ') || '-'
          const monto    = `$ ${Number(it.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          doc.text(concepto, MG + 4, rowY, { width: lcConcepto, ellipsis: true, lineBreak: false })
          doc.text(monto, MG + 4 + lcConcepto, rowY, { width: lcImporte - IMP_PAD, align: 'right', lineBreak: false })
          rowY += ROW_H
        })
      } else {
        const concepto = movimiento.concepto || movimiento.descripcion || '-'
        doc.text(concepto, MG + 4, rowY, { width: lcConcepto, ellipsis: true, lineBreak: false })
        doc.text(`$ ${montoStr}`, MG + 4 + lcConcepto, rowY, { width: lcImporte - IMP_PAD, align: 'right', lineBreak: false })
      }

      // Filas derecha — medios de pago
      let rowYR = TBL_TOP + HDR_ROW_H + 4
      const leyendaBase = idPersona ? `${idPersona} ${nombrePersona}`.trim() : nombrePersona
      if (mediosPago.length > 0) {
        mediosPago.forEach(mp => {
          const formaPago = mp.medioPago?.nombre || '-'
          const monto = `$ ${Number(mp.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          doc.text(formaPago, divTblX + 4, rowYR, { width: rcFormaPago - 4, lineBreak: false })
          doc.text(leyendaBase, divTblX + 4 + rcFormaPago, rowYR, { width: rcLeyenda - 4, ellipsis: true, lineBreak: false })
          doc.text(monto, divTblX + 4 + rcFormaPago + rcLeyenda, rowYR, { width: rcImporte - IMP_PAD, align: 'right', lineBreak: false })
          rowYR += ROW_H
        })
      } else {
        const formaPago = movimiento.medioPagoRel?.nombre || movimiento.medioPago || '-'
        doc.text(formaPago, divTblX + 4, rowYR, { width: rcFormaPago - 4, lineBreak: false })
        doc.text(leyendaBase, divTblX + 4 + rcFormaPago, rowYR, { width: rcLeyenda - 4, ellipsis: true, lineBreak: false })
        doc.text(`$ ${montoStr}`, divTblX + 4 + rcFormaPago + rcLeyenda, rowYR, { width: rcImporte - IMP_PAD, align: 'right', lineBreak: false })
      }

      // ─── Footer ───
      const FTR_TOP = TBL_BOT, FTR_H = 40, FTR_BOT = FTR_TOP + FTR_H
      doc.rect(MG, FTR_TOP, INNER, FTR_H).strokeColor('#000000').lineWidth(0.5).stroke()
      const fDiv1 = MG + INNER * 0.28
      const fDiv2 = MG + INNER * 0.52
      const fDiv3 = MG + INNER * 0.72
      doc.moveTo(fDiv1, FTR_TOP).lineTo(fDiv1, FTR_BOT).stroke()
      doc.moveTo(fDiv2, FTR_TOP).lineTo(fDiv2, FTR_BOT).stroke()
      doc.moveTo(fDiv3, FTR_TOP).lineTo(fDiv3, FTR_BOT).stroke()
      doc.fillColor('#374151').font('Helvetica').fontSize(7)
        .text('FIRMA AUTORIZADA', MG + 4, FTR_TOP + 14, { width: fDiv1 - MG - 8, align: 'center' })
        .text('SELLO AUTORIZADO', fDiv1 + 4, FTR_TOP + 14, { width: fDiv2 - fDiv1 - 8, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(8).text('TOTAL', fDiv2 + 4, FTR_TOP + 10, { width: fDiv3 - fDiv2 - 8, align: 'right' })
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
        .text(`$${montoStr}`, fDiv3 + 4, FTR_TOP + 8, { width: MG + INNER - fDiv3 - 8, align: 'right' })

      const SF_TOP = FTR_BOT + 4
      doc.fillColor('#6b7280').font('Helvetica').fontSize(7)
      if (adminNombre) doc.text(`Imprimió: ${adminNombre}`, fDiv3 + 4, SF_TOP, { width: MG + INNER - fDiv3 - 8 })
      doc.font('Helvetica').fontSize(7).fillColor('#374151')
        .text(`${nombrePersona}${idPersona ? ` (${idPersona})` : ''} - ${fechaStr}`, MG, SF_TOP + 2)

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
