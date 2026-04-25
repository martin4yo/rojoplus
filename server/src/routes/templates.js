import express from 'express'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { sendTestEmail } from '../services/emailTemplateService.js'
import { generateTestPDF } from '../services/pdfGenerator.js'

const router = express.Router()

// ============================================
// EMAIL TEMPLATES
// ============================================

// GET /api/admin/templates/email - Listar todos los templates de email
router.get('/email', authAdmin, asyncHandler(async (req, res) => {
  const templates = await req.db.emailTemplate.findMany({
    orderBy: { eventType: 'asc' }
  })

  res.json({
    success: true,
    data: templates
  })
}))

// GET /api/admin/templates/email/:id - Obtener un template específico
router.get('/email/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const template = await req.db.emailTemplate.findUnique({
    where: { id }
  })

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template no encontrado'
    })
  }

  res.json({
    success: true,
    data: template
  })
}))

// PUT /api/admin/templates/email/:id - Actualizar un template
router.put('/email/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, subject, bodyHtml, bodyText, variables, isActive } = req.body

  const updated = await req.db.emailTemplate.update({
    where: { id },
    data: {
      nombre,
      descripcion,
      subject,
      bodyHtml,
      bodyText,
      variables,
      isActive
    }
  })

  res.json({
    success: true,
    data: updated,
    message: 'Template actualizado correctamente'
  })
}))

// POST /api/admin/templates/email/:id/test - Enviar email de prueba
router.post('/email/:id/test', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { email } = req.body

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email de destino requerido'
    })
  }

  // Obtener el template
  const template = await req.db.emailTemplate.findUnique({
    where: { id }
  })

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template no encontrado'
    })
  }

  // Enviar email de prueba
  const result = await sendTestEmail(req.prisma, template.eventType, email)

  res.json({
    success: true,
    data: result,
    message: `Email de prueba enviado a ${email}`
  })
}))

// ============================================
// PDF TEMPLATES
// ============================================

// GET /api/admin/templates/pdf - Listar todos los templates de PDF
router.get('/pdf', authAdmin, asyncHandler(async (req, res) => {
  const templates = await req.db.pdfTemplate.findMany({
    orderBy: { tipo: 'asc' }
  })

  res.json({
    success: true,
    data: templates
  })
}))

// GET /api/admin/templates/pdf/:id - Obtener un template específico
router.get('/pdf/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const template = await req.db.pdfTemplate.findUnique({
    where: { id }
  })

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template no encontrado'
    })
  }

  res.json({
    success: true,
    data: template
  })
}))

// PUT /api/admin/templates/pdf/:id - Actualizar un template
router.put('/pdf/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, htmlContent, cssContent, variables, pageFormat, orientation, isActive } = req.body

  const updated = await req.db.pdfTemplate.update({
    where: { id },
    data: {
      nombre,
      descripcion,
      htmlContent,
      cssContent,
      variables,
      pageFormat,
      orientation,
      isActive
    }
  })

  res.json({
    success: true,
    data: updated,
    message: 'Template actualizado correctamente'
  })
}))

// POST /api/admin/templates/pdf/:id/test - Generar PDF de prueba
router.post('/pdf/:id/test', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  // Obtener el template
  const template = await req.db.pdfTemplate.findUnique({
    where: { id }
  })

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template no encontrado'
    })
  }

  // Generar PDF de prueba
  const pdfBuffer = await generateTestPDF(req.prisma, template.tipo)

  // Enviar como descarga
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="prueba-${template.tipo.toLowerCase()}.pdf"`)
  res.send(pdfBuffer)
}))

// POST /api/admin/templates/pdf/:id/preview - Generar preview HTML del PDF
router.post('/pdf/:id/preview', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { data } = req.body

  // Obtener el template
  const template = await req.db.pdfTemplate.findUnique({
    where: { id }
  })

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template no encontrado'
    })
  }

  // Compilar HTML con datos (si se proveen, si no usar datos de prueba)
  const handlebars = await import('handlebars')
  const htmlTemplate = handlebars.default.compile(template.htmlContent)
  const htmlCompiled = htmlTemplate(data || {})

  // Enviar HTML con estilos
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

  res.setHeader('Content-Type', 'text/html')
  res.send(htmlWithStyles)
}))

export default router
