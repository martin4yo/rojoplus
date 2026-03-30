import express from 'express'
import { enviarEmailContacto } from '../services/email.js'

const router = express.Router()

/**
 * POST /api/public/contacto
 * Envía mensaje desde formulario de contacto
 */
router.post('/public/contacto', async (req, res) => {
  try {
    const { nombre, email, telefono, asunto, mensaje } = req.body

    // Validaciones
    if (!nombre || !email || !mensaje) {
      return res.status(400).json({
        error: 'Nombre, email y mensaje son requeridos'
      })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'El formato del email no es válido'
      })
    }

    // Validar longitud del mensaje
    if (mensaje.length < 10) {
      return res.status(400).json({
        error: 'El mensaje debe tener al menos 10 caracteres'
      })
    }

    if (mensaje.length > 5000) {
      return res.status(400).json({
        error: 'El mensaje no puede superar los 5000 caracteres'
      })
    }

    // Enviar emails
    await enviarEmailContacto({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      telefono: telefono?.trim() || null,
      asunto: asunto || 'otro',
      mensaje: mensaje.trim(),
      db: req.db,
    })

    res.json({
      success: true,
      message: 'Mensaje enviado correctamente'
    })
  } catch (error) {
    console.error('Error enviando mensaje de contacto:', error)
    res.status(500).json({
      error: 'Error al enviar el mensaje. Por favor intentá de nuevo.'
    })
  }
})

export default router
