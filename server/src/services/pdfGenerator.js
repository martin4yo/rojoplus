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
