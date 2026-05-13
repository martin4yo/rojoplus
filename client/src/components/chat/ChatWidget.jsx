import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, MessageCircle } from 'lucide-react'
import ChatMessage from './ChatMessage'
import chatService from '../../services/chatService'

/**
 * ChatWidget Component
 * Widget flotante de chat con Axio
 *
 * Props:
 * - tokenPortal: Token del socio (para rol socio)
 * - role: 'socio' | 'camarero' | 'admin'
 * - position: 'bottom-right' | 'bottom-left' | 'sidebar' (default: bottom-right)
 */
const STORAGE_KEY = 'chat_widget_pos'
const MOBILE_BREAKPOINT = '(max-width: 640px)'

function loadSavedPos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_BREAKPOINT).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(MOBILE_BREAKPOINT)
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export default function ChatWidget({
  tokenPortal,
  role = 'socio',
  position = 'bottom-right'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAvailable, setIsAvailable] = useState(null) // null = cargando
  const [agentName, setAgentName] = useState('Axio')
  const [dragPos, setDragPos] = useState(null) // { x, y } desde esquina inferior derecha, null = posición default
  const isMobile = useIsMobile()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false })

  // Verificar disponibilidad del asistente al montar
  useEffect(() => {
    checkHealth()
  }, [])

  // Auto-scroll al último mensaje
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Focus input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkHealth = async () => {
    const health = await chatService.checkHealth()
    setIsAvailable(health.available)
    if (health.agentName) setAgentName(health.agentName)

    if (!health.available) {
      console.warn('⚠️  Asistente no disponible')
    }
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !isAvailable) return

    const userMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      timestamp: new Date(),
      isUser: true
    }

    // Agregar mensaje del usuario
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Llamar al backend
      const response = await chatService.sendMessage({
        message: userMessage.content,
        tokenPortal,
        role
      })

      // Agregar respuesta del asistente
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        timestamp: new Date(),
        isUser: false,
        data: response.data,
        hashInput: response.hashInput || null,
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Si hay acción específica (ej: link de pago), podríamos manejarlo aquí
      if (response.requiresUserAction === 'payment' && response.data?.linkPago) {
        // El link ya está en el mensaje como markdown
        console.log('Link de pago disponible:', response.data.linkPago)
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error)

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: '😅 Ups, hubo un error al procesar tu mensaje. ¿Podés intentar de nuevo?',
        timestamp: new Date(),
        isUser: false
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleOpen = () => {
    setIsOpen(!isOpen)

    // Mensaje de bienvenida al abrir por primera vez
    if (!isOpen && messages.length === 0) {
      const welcomeMessage = getWelcomeMessage()
      setMessages([
        {
          id: 'welcome',
          content: welcomeMessage,
          timestamp: new Date(),
          isUser: false
        }
      ])
    }
  }

  const getWelcomeMessage = () => {
    switch (role) {
      case 'socio':
        return `👋 ¡Hola! Soy **${agentName}**, tu asistente del club.

Puedo ayudarte con:
• 💳 Consultar tu deuda y generar links de pago
• 🏃 Inscribirte en actividades
• 📅 Ver tu calendario de entrenamientos
• 🍔 Hacer pedidos en el buffet
• 👨‍👩‍👧 Gestionar tu grupo familiar

**Ejemplos:**
• "Cuál es mi deuda?"
• "Generar link de pago"
• "Inscribirme en tenis"
• "Ver menú del buffet"`

      case 'camarero':
        return `👋 ¡Hola! Soy **${agentName}**, tu asistente para el buffet.

Puedo ayudarte con:
• 🍽️ Ver estado de mesas
• ➕ Agregar items a comandas
• 💰 Ver cuentas de mesas
• 🔴 Abrir/cerrar mesas
• 📋 Ver comandas pendientes

**Ejemplos:**
• "Qué mesas están ocupadas?"
• "Abrir mesa 5"
• "Agregar 2 cervezas a mesa 8"
• "Ver cuenta de mesa 7"`

      case 'admin':
        return `👋 ¡Hola! Soy **${agentName}**, tu asistente administrativo.

Puedo ayudarte con:
• 📊 Consultas y reportes
• ⚡ Acciones rápidas
• 💰 Estado de cobranzas

**Ejemplos:**
• "Cuántos socios morosos hay?"
• "Ventas del buffet hoy"`

      default:
        return `👋 ¡Hola! Soy ${agentName}, ¿en qué puedo ayudarte?`
    }
  }

  // Cargar posición guardada
  useEffect(() => {
    if (position === 'sidebar') return
    const saved = loadSavedPos()
    if (saved) setDragPos(saved)
  }, [])

  const handlePointerDown = (e) => {
    if (position === 'sidebar' || isMobile) return
    e.preventDefault()
    const d = dragRef.current
    d.dragging = true
    d.moved = false
    d.startX = e.clientX
    d.startY = e.clientY
    const current = dragPos || { x: 24, y: 24 }
    d.startPosX = current.x
    d.startPosY = current.y
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (isMobile) return
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    if (!d.moved) return
    const newX = Math.max(8, Math.min(window.innerWidth - 64, d.startPosX - dx))
    const newY = Math.max(8, Math.min(window.innerHeight - 64, d.startPosY - dy))
    setDragPos({ x: newX, y: newY })
  }

  const handlePointerUp = (e) => {
    if (isMobile) {
      toggleOpen()
      return
    }
    const d = dragRef.current
    if (!d.dragging) return
    d.dragging = false
    if (d.moved) {
      // Guardar posición final
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dragPos)) } catch {}
    } else {
      // No hubo movimiento real → es un click
      toggleOpen()
    }
  }

  // Determinar posición del widget
  const getPositionClasses = () => {
    if (position === 'sidebar') return 'relative w-full h-full'
    return 'fixed z-50'
  }

  const getPositionStyle = () => {
    if (position === 'sidebar') return {}
    const pos = dragPos || { x: 24, y: 24 }
    return { right: pos.x, bottom: pos.y }
  }

  // No renderizar hasta confirmar disponibilidad; ocultar si no hay API key
  if (!isAvailable) return null

  // Mobile abierto: ocupar pantalla completa con dvh para respetar el teclado
  // virtual. Desktop o sidebar: comportamiento previo.
  const isFullscreenMobile = isOpen && isMobile && position !== 'sidebar'
  const panelClasses =
    position === 'sidebar'
      ? 'w-full h-full rounded-2xl border border-gray-200 dark:border-gray-800'
      : isFullscreenMobile
        ? 'fixed inset-0 w-full h-[100dvh] rounded-none border-0'
        : 'w-80 sm:w-96 h-[500px] sm:h-[580px] rounded-2xl border border-gray-200 dark:border-gray-800'

  const panelStyle =
    position === 'sidebar' || isFullscreenMobile
      ? {}
      : { position: 'fixed', ...getPositionStyle() }

  return (
    <div className={getPositionClasses()} style={getPositionStyle()}>
      {/* Botón flotante — draggable en desktop, tap en mobile */}
      {!isOpen && position !== 'sidebar' && (
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-14 h-14 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg flex items-center justify-center transition-colors touch-none select-none cursor-pointer sm:cursor-grab sm:active:cursor-grabbing"
          aria-label="Abrir chat de IA"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Panel de chat */}
      {(isOpen || position === 'sidebar') && (
        <div
          className={`bg-white dark:bg-gray-900 shadow-2xl flex flex-col ${panelClasses}`}
          style={panelStyle}
        >
          {/* Header */}
          <div
            className={`bg-gradient-to-r from-primary to-primary-dark text-white p-4 flex items-center justify-between ${
              isFullscreenMobile ? 'rounded-none pt-[max(1rem,env(safe-area-inset-top))]' : 'rounded-t-2xl'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <h3 className="font-semibold">{agentName}</h3>
                <p className="text-xs opacity-90">
                  {isAvailable ? 'Conectado' : 'No disponible'}
                </p>
              </div>
            </div>
            {position !== 'sidebar' && (
              <button
                onClick={toggleOpen}
                className="hover:bg-white/20 rounded-full w-11 h-11 flex items-center justify-center transition-colors"
                aria-label="Cerrar chat"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isUser={message.isUser}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            className={`p-4 border-t border-gray-200 dark:border-gray-800 ${
              isFullscreenMobile ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : ''
            }`}
          >
            {!isAvailable && (
              <div className="mb-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 p-2 rounded">
                ⚠️ El asistente no está disponible en este momento.
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isAvailable
                    ? 'Escribe tu mensaje...'
                    : 'Asistente no disponible'
                }
                disabled={isLoading || !isAvailable}
                /* font-size: 16px en mobile evita el zoom automático de iOS al hacer focus */
                className="flex-1 px-4 py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />

              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !isAvailable}
                className="px-4 py-2 min-w-[44px] min-h-[44px] bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                aria-label="Enviar mensaje"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Powered by AXIO
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
