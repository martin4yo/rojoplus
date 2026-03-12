/**
 * Chat Service - ROJO IA
 * Servicio para comunicación con el asistente inteligente
 */

// VITE_API_URL ya incluye /api (ej: http://localhost:3000/api)
// En desarrollo sin .env, usar solo /api para aprovechar el proxy
const API_URL = import.meta.env.VITE_API_URL || '/api'

class ChatService {
  /**
   * Enviar mensaje al asistente
   * @param {Object} params
   * @param {string} params.message - Mensaje del usuario
   * @param {string} params.tokenPortal - Token del socio (opcional)
   * @param {string} params.role - Rol: 'socio' | 'camarero' | 'admin'
   */
  async sendMessage({ message, tokenPortal, role }) {
    try {
      const url = `${API_URL}/chat`
      console.log('📤 Enviando mensaje a:', url, { message, role })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          tokenPortal,
          role
        })
      })

      const data = await response.json()
      console.log('📥 Respuesta recibida:', data)

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar el mensaje')
      }

      return data
    } catch (error) {
      console.error('❌ Error en chatService.sendMessage:', error)
      throw error
    }
  }

  /**
   * Verificar si el asistente está disponible
   */
  async checkHealth() {
    try {
      const url = `${API_URL}/chat/health`
      console.log('🔍 Verificando health en:', url)

      const response = await fetch(url)

      if (!response.ok) {
        console.error('❌ Health check failed:', response.status, response.statusText)
        return { available: false }
      }

      const data = await response.json()
      console.log('✅ Health check response:', data)
      return data
    } catch (error) {
      console.error('❌ Error verificando salud del asistente:', error)
      return { available: false }
    }
  }

  /**
   * Subir documento (comprobante, etc.)
   * @param {File} file
   * @param {string} tokenPortal
   */
  async uploadDocument(file, tokenPortal) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tokenPortal', tokenPortal)

      const response = await fetch(`${API_URL}/chat/upload-document`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al subir el documento')
      }

      return data
    } catch (error) {
      console.error('Error en chatService.uploadDocument:', error)
      throw error
    }
  }
}

export default new ChatService()
