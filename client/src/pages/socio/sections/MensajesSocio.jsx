import { useState, useEffect, useRef } from 'react'
import { api } from '../../../services/api'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

export default function MensajesSocio({ socio, tokenPortal, onMensajesLeidos }) {
  const [conversaciones, setConversaciones] = useState([])
  const [conversacionActiva, setConversacionActiva] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const mensajesEndRef = useRef(null)

  useEffect(() => {
    cargarConversaciones()
  }, [tokenPortal])

  useEffect(() => {
    if (conversacionActiva) {
      cargarMensajes(conversacionActiva)
    }
  }, [conversacionActiva])

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  const cargarConversaciones = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/socio/${tokenPortal}/conversaciones`)
      setConversaciones(response.data || [])
      if (response.data?.length > 0 && !conversacionActiva) {
        setConversacionActiva(response.data[0].id)
      }
    } catch (err) {
      console.error('Error cargando conversaciones:', err)
    } finally {
      setLoading(false)
    }
  }

  const cargarMensajes = async (conversacionId) => {
    try {
      const response = await api.get(`/socio/${tokenPortal}/conversaciones/${conversacionId}/mensajes`)
      setMensajes(response.data || [])

      // Marcar como leídos
      await api.post(`/socio/${tokenPortal}/conversaciones/${conversacionId}/marcar-leido`)
      onMensajesLeidos()
    } catch (err) {
      console.error('Error cargando mensajes:', err)
    }
  }

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !conversacionActiva || enviando) return

    try {
      setEnviando(true)
      await api.post(`/socio/${tokenPortal}/conversaciones/${conversacionActiva}/mensajes`, {
        mensaje: nuevoMensaje,
      })
      setNuevoMensaje('')
      await cargarMensajes(conversacionActiva)
    } catch (err) {
      alert('Error al enviar: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatFecha = (fecha) => {
    const d = new Date(fecha)
    const hoy = new Date()
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)

    if (d.toDateString() === hoy.toDateString()) {
      return `Hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    } else if (d.toDateString() === ayer.toDateString()) {
      return `Ayer ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (conversaciones.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes conversaciones</h3>
        <p className="text-gray-600">
          Cuando te inscribas en una actividad, podrás comunicarte con tu entrenador aquí
        </p>
      </div>
    )
  }

  const conversacion = conversaciones.find((c) => c.id === conversacionActiva)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 h-full">
        {/* Lista de conversaciones */}
        <div className="border-r border-gray-200 overflow-y-auto">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Conversaciones</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {conversaciones.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setConversacionActiva(conv.id)}
                className={`w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors ${
                  conversacionActiva === conv.id ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="bg-gray-200 rounded-full p-2">
                    <UserCircleIcon className="h-8 w-8 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{conv.entrenador}</p>
                    <p className="text-sm text-gray-600 truncate">{conv.actividad}</p>
                    {conv.ultimoMensaje && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{conv.ultimoMensaje}</p>
                    )}
                  </div>
                  {conv.noLeidos > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {conv.noLeidos}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mensajes */}
        <div className="col-span-2 flex flex-col h-full">
          {/* Header de conversación */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center space-x-3">
            <div className="bg-gray-200 rounded-full p-2">
              <UserCircleIcon className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{conversacion?.entrenador}</h3>
              <p className="text-sm text-gray-600">{conversacion?.actividad}</p>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.esDelSocio ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    msg.esDelSocio
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                  }`}
                >
                  <p className="text-sm">{msg.mensaje}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.esDelSocio ? 'text-red-100' : 'text-gray-500'
                    }`}
                  >
                    {formatFecha(msg.fecha)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={mensajesEndRef} />
          </div>

          {/* Input de mensaje */}
          <form
            onSubmit={enviarMensaje}
            className="bg-white border-t border-gray-200 px-6 py-4"
          >
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={enviando}
              />
              <button
                type="submit"
                disabled={!nuevoMensaje.trim() || enviando}
                className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-6 w-6" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
