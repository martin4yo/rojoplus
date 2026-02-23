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
