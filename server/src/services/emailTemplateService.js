import Handlebars from 'handlebars'
import juice from 'juice'
import { generatePDF } from './pdfGenerator.js'
import { getMailConfig } from './email.js'

const handlebars = Handlebars

/**
 * Verifica si está en modo demo
 */
async function getModoDemo(prisma) {
  try {
    const [modoDemo, emailDemo] = await Promise.all([
      prisma.configuracion.findUnique({ where: { clave: 'MODO_DEMO' } }),
      prisma.configuracion.findUnique({ where: { clave: 'EMAIL_DEMO' } }),
    ])
    return {
      activo: modoDemo?.valor === 'true',
      email: emailDemo?.valor || '',
    }
  } catch (error) {
    console.error('Error obteniendo modo demo:', error.message)
    return { activo: false, email: '' }
  }
}

/**
 * Envía un email usando un template de la base de datos
 * @param {Object} options
 * @param {Object} options.prisma - Cliente de Prisma
 * @param {string} options.eventType - Tipo de evento (COMPROBANTE_PAGO, PAGO_CONFIRMADO, etc.)
 * @param {string} options.to - Destinatario
 * @param {Object} options.data - Datos para compilar el template
 * @param {Object} options.attachPdf - Configuración para adjuntar PDF (opcional)
 * @param {string} options.attachPdf.tipo - Tipo de PDF (RECIBO, FACTURA)
 * @param {Object} options.attachPdf.data - Datos para generar el PDF
 * @param {string} options.attachPdf.filename - Nombre del archivo adjunto
 */
export async function sendTemplateEmail(options) {
  const { prisma, eventType, to, data, attachPdf } = options

  try {
    // 1. Obtener el template de email
    const template = await prisma.emailTemplate.findUnique({
      where: { eventType, isActive: true }
    })

    if (!template) {
      throw new Error(`Template de email "${eventType}" no encontrado o inactivo`)
    }

    // 2. Compilar subject y body con Handlebars
    const subjectTemplate = handlebars.compile(template.subject)
    const bodyHtmlTemplate = handlebars.compile(template.bodyHtml)

    const subject = subjectTemplate(data)
    let bodyHtml = bodyHtmlTemplate(data)

    // 3. Inline CSS con juice (para mejor compatibilidad con clientes de email)
    bodyHtml = juice(bodyHtml)

    // 4. Preparar attachments
    const attachments = []

    // 5. Generar PDF si se solicita
    if (attachPdf) {
      console.log(`📄 Generando PDF adjunto tipo "${attachPdf.tipo}"...`)
      const pdfBuffer = await generatePDF(prisma, attachPdf.tipo, attachPdf.data)
      attachments.push({
        filename: attachPdf.filename || 'comprobante.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      })
    }

    // 6. Obtener config SMTP del tenant + modo demo
    const mailConfig = await getMailConfig(prisma)
    const modoDemo = await getModoDemo(prisma)
    let destinatario = to
    let subjectFinal = subject

    if (modoDemo.activo && modoDemo.email) {
      destinatario = modoDemo.email
      subjectFinal = `[DEMO - Para: ${to}] ${subject}`
      console.log(`📧 MODO DEMO: Redirigiendo email de ${to} a ${modoDemo.email}`)
    }

    // 7. Enviar email
    const mailOpts = {
      from: mailConfig.from,
      to: destinatario,
      subject: subjectFinal,
      html: bodyHtml,
      text: template.bodyText || '',
    }
    if (attachments.length > 0) mailOpts.attachments = attachments
    const info = await mailConfig.transporter.sendMail(mailOpts)

    console.log(`✅ Email enviado: ${eventType} → ${destinatario}`)
    console.log(`   MessageID: ${info.messageId}`)

    return {
      success: true,
      messageId: info.messageId,
      destinatario: destinatario
    }

  } catch (error) {
    console.error(`❌ Error enviando email template "${eventType}":`, error)
    throw error
  }
}

/**
 * Envía un email de prueba
 * @param {Object} prisma - Cliente de Prisma
 * @param {string} eventType - Tipo de evento
 * @param {string} to - Destinatario
 */
export async function sendTestEmail(prisma, eventType, to) {
  // Datos de prueba genéricos
  const testData = {
    clubNombre: 'Club Sportivo Pilar',
    clubLema: 'El equipo de la ciudad',
    clubDireccion: 'Calle Falsa 123, Pilar',
    clubTelefono: '0230-1234567',
    clubEmail: 'info@clubpilar.com',
    socioNombre: 'Juan Pérez (Prueba)',
    numero: 'TEST-00001',
    fecha: new Date().toLocaleDateString('es-AR'),
    medioPago: 'Transferencia Bancaria',
    montoTotal: '15000.00',
    items: [
      { concepto: 'Cuota Social', periodo: 'Enero 2026', monto: '5000.00' },
      { concepto: 'Actividad Fútbol', periodo: 'Enero 2026', monto: '10000.00' }
    ],
    motivoRechazo: 'Datos bancarios incorrectos (PRUEBA)',
    portalUrl: 'https://rojoplus.com/portal',
    cuotas: [
      { concepto: 'Cuota Social', vencimiento: '31/01/2026', monto: '5000.00' },
      { concepto: 'Actividad Fútbol', vencimiento: '31/01/2026', monto: '10000.00' }
    ],
    periodo: 'Enero 2026',
    vencimiento: '31/01/2026',
    monto: '15000.00'
  }

  // Para COMPROBANTE_PAGO o PAGO_CONFIRMADO, adjuntar PDF de prueba
  let attachPdf = null
  if (eventType === 'COMPROBANTE_PAGO' || eventType === 'PAGO_CONFIRMADO') {
    attachPdf = {
      tipo: 'RECIBO',
      data: {
        ...testData,
        socioNumero: '12345'
      },
      filename: 'recibo-prueba.pdf'
    }
  }

  return await sendTemplateEmail({
    prisma,
    eventType,
    to,
    data: testData,
    attachPdf
  })
}

/**
 * Verifica la conexión SMTP
 */
export async function verificarConexionSMTP(db = null) {
  try {
    const mailConfig = await getMailConfig(db)
    await mailConfig.transporter.verify()
    console.log('✅ Conexión SMTP verificada')
    return true
  } catch (error) {
    console.warn('⚠️  Error verificando conexión SMTP:', error.message)
    return false
  }
}

// Registrar helpers de Handlebars para emails
handlebars.registerHelper('formatCurrency', function(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(value)
})

handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleDateString('es-AR')
})

handlebars.registerHelper('eq', function(a, b) {
  return a === b
})

handlebars.registerHelper('or', function(a, b) {
  return a || b
})
