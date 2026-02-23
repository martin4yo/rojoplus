import pdf from 'pdf-creator-node'
import Handlebars from 'handlebars'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const handlebars = Handlebars
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Genera un PDF a partir de un template guardado en la base de datos
 * @param {Object} prisma - Cliente de Prisma
 * @param {string} tipo - Tipo de PDF (RECIBO, FACTURA, COMPROBANTE_PAGO)
 * @param {Object} data - Datos para compilar el template
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
export async function generatePDF(prisma, tipo, data) {
  try {
    // 1. Buscar el template en la base de datos
    const template = await prisma.pdfTemplate.findUnique({
      where: { tipo, isActive: true }
    })

    if (!template) {
      throw new Error(`Template PDF tipo "${tipo}" no encontrado o inactivo`)
    }

    // 2. Compilar HTML con Handlebars
    const htmlTemplate = handlebars.compile(template.htmlContent)
    const htmlCompiled = htmlTemplate(data)

    // 3. Preparar el HTML completo con CSS
    const htmlWithStyles = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>${template.cssContent}</style>
      </head>
      <body>
        ${htmlCompiled}
      </body>
      </html>
    `

    // 4. Configurar opciones del PDF
    const options = {
      format: template.pageFormat || 'A4',
      orientation: template.orientation || 'portrait',
      border: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    }

    // 5. Preparar documento para pdf-creator-node
    const document = {
      html: htmlWithStyles,
      data: {},
      path: path.join(__dirname, '../../temp', `${tipo}_${Date.now()}.pdf`),
      type: ''
    }

    // 6. Crear directorio temp si no existe
    const tempDir = path.join(__dirname, '../../temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // 7. Generar PDF
    const result = await pdf.create(document, options)

    // 8. Leer el archivo generado como buffer
    const pdfBuffer = fs.readFileSync(result.filename)

    // 9. Eliminar archivo temporal
    fs.unlinkSync(result.filename)

    console.log(`✅ PDF generado: ${tipo}`)
    return pdfBuffer

  } catch (error) {
    console.error(`❌ Error generando PDF tipo "${tipo}":`, error)
    throw error
  }
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
