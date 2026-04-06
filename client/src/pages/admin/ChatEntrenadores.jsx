import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { MessageCircle, Send, Users, Loader2, Radio, ChevronDown, User } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

function formatHora(fecha) {
  const d = new Date(fecha)
  const hoy = new Date()
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ChatEntrenadores() {
  const [entrenadores, setEntrenadores] = useState([])
  const [entrenadorSeleccionado, setEntrenadorSeleccionado] = useState(null)
  const [conversaciones, setConversaciones] = useState([])
  const [conversacionActiva, setConversacionActiva] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [loadingMensajes, setLoadingMensajes] = useState(false)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Broadcast
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastCatId, setBroadcastCatId] = useState('')
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false)

  const mensajesEndRef = useRef(null)
  const socketRef = useRef(null)

  // Conectar Socket.io
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) return

    const socket = io(API_BASE, {
      auth: { token },
      reconnectionAttempts: 5
    })

    socket.on('connect', () => console.log('[Chat admin] Socket conectado'))
    socket.on('chat:nuevo-mensaje', ({ conversacionId, mensaje, socioNombre }) => {
      // Actualizar lista de conversaciones
      setConversaciones(prev => prev.map(c =>
        c.id === conversacionId
          ? { ...c, mensajes: [{ contenido: mensaje.contenido, createdAt: mensaje.createdAt, emisorTipo: mensaje.emisorTipo }], mensajesNoLeidos: (c.mensajesNoLeidos || 0) + 1 }
          : c
      ))
      // Si es la conversación activa, agregar el mensaje
      setConversacionActiva(prev => {
        if (prev?.id === conversacionId) {
          setMensajes(m => [...m, mensaje])
        }
        return prev
      })
    })

    socketRef.current = socket
    return () => socket.disconnect()
  }, [])

  useEffect(() => {
    cargarEntrenadores()
  }, [])

  useEffect(() => {
    if (entrenadorSeleccionado) cargarConversaciones()
  }, [entrenadorSeleccionado])

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function cargarEntrenadores() {
    try {
      const res = await api.getFull('/admin/chat/entrenadores')
      setEntrenadores(res?.data || res || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function cargarConversaciones() {
    try {
      const res = await api.getFull(`/admin/chat/conversaciones?entrenadorId=${entrenadorSeleccionado.id}`)
      setConversaciones(res?.data || res || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function abrirConversacion(conv) {
    setConversacionActiva(conv)
    setLoadingMensajes(true)
    try {
      const res = await api.getFull(`/admin/chat/conversaciones/${conv.id}/mensajes`)
      setMensajes(res?.data?.mensajes || [])
      // Limpiar contador
      setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, mensajesNoLeidos: 0 } : c))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMensajes(false)
    }
  }

  async function handleEnviar(e) {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !conversacionActiva || enviando) return
    setEnviando(true)
    try {
      const res = await api.postFull(`/admin/chat/conversaciones/${conversacionActiva.id}/mensajes`, {
        contenido: nuevoMensaje.trim()
      })
      const msg = res?.data || res
      setMensajes(prev => [...prev, msg])
      setNuevoMensaje('')
      // Actualizar ultimo mensaje en la lista
      setConversaciones(prev => prev.map(c =>
        c.id === conversacionActiva.id
          ? { ...c, mensajes: [{ contenido: msg.contenido, createdAt: msg.createdAt, emisorTipo: 'ENTRENADOR' }] }
          : c
      ))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    if (!entrenadorSeleccionado || !broadcastMsg.trim()) return
    setEnviandoBroadcast(true)
    try {
      const res = await api.postFull('/admin/chat/broadcast', {
        entrenadorId: entrenadorSeleccionado.id,
        categoriaActividadId: broadcastCatId || undefined,
        contenido: broadcastMsg.trim()
      })
      alert(`✓ Enviado a ${res?.data?.enviados || '?'} socios`)
      setBroadcastMsg('')
      setShowBroadcast(false)
      await cargarConversaciones()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviandoBroadcast(false)
    }
  }

  const categorias = entrenadorSeleccionado?.categorias?.filter(c => c.activo) || []

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <MessageCircle className="w-7 h-7 text-primary" />
          Chat Entrenadores
        </h1>
        <p className="text-gray-600 mt-1">Mensajes en tiempo real con socios por actividad y categoría</p>
      </div>

    <div className="flex h-[calc(100vh-175px)] gap-0 rounded-xl overflow-hidden border border-gray-200 bg-white">
      {/* Sidebar izquierdo */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 flex flex-col">
        {/* Selector de entrenador */}
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <label className="block text-xs text-gray-500 mb-1">Entrenador</label>
          <select
            value={entrenadorSeleccionado?.id || ''}
            onChange={e => {
              const ent = entrenadores.find(t => t.id === parseInt(e.target.value))
              setEntrenadorSeleccionado(ent || null)
              setConversacionActiva(null)
              setMensajes([])
            }}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Seleccionar entrenador...</option>
            {entrenadores.map(e => (
              <option key={e.id} value={e.id}>{e.nombre} {e.apellido || ''}</option>
            ))}
          </select>
        </div>

        {/* Broadcast button */}
        {entrenadorSeleccionado && (
          <div className="px-3 py-2 border-b border-gray-200">
            <button
              onClick={() => setShowBroadcast(!showBroadcast)}
              className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:bg-primary/5 border border-primary/30 rounded-lg px-3 py-1.5"
            >
              <Radio className="w-4 h-4" /> Mensaje masivo
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showBroadcast ? 'rotate-180' : ''}`} />
            </button>
            {showBroadcast && (
              <form onSubmit={handleBroadcast} className="mt-2 space-y-2">
                {categorias.length > 0 && (
                  <select
                    value={broadcastCatId}
                    onChange={e => setBroadcastCatId(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.categoriaActividadId}>
                        {c.categoriaActividad.actividad.nombre} — {c.categoriaActividad.nombre}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="Mensaje para todos los socios..."
                  rows={3}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <button
                  type="submit"
                  disabled={!broadcastMsg.trim() || enviandoBroadcast}
                  className="w-full text-xs bg-primary text-white rounded px-2 py-1.5 hover:bg-primary/90 disabled:opacity-60"
                >
                  {enviandoBroadcast ? 'Enviando...' : 'Enviar a todos'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {!entrenadorSeleccionado ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <Users className="w-8 h-8 mx-auto mb-2" />
              Seleccioná un entrenador
            </div>
          ) : conversaciones.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Sin conversaciones</div>
          ) : (
            conversaciones.map(conv => (
              <button
                key={conv.id}
                onClick={() => abrirConversacion(conv)}
                className={`w-full px-3 py-3 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                  conversacionActiva?.id === conv.id ? 'bg-red-50 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{conv.socio?.apellidoNombre}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {conv.categoriaActividad?.actividad?.nombre} — {conv.categoriaActividad?.nombre}
                    </p>
                    {conv.mensajes?.[0] && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{conv.mensajes[0].contenido}</p>
                    )}
                  </div>
                  {conv.mensajesNoLeidos > 0 && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                      {conv.mensajesNoLeidos}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel de mensajes */}
      <div className="flex-1 flex flex-col">
        {!conversacionActiva ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Seleccioná una conversación</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{conversacionActiva.socio?.apellidoNombre}</p>
                <p className="text-xs text-gray-500">
                  {conversacionActiva.categoriaActividad?.actividad?.nombre} — {conversacionActiva.categoriaActividad?.nombre}
                </p>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loadingMensajes
                ? <LoadingSpinner />
                : mensajes.map((msg, idx) => (
                  <div key={msg.id || idx} className={`flex ${msg.emisorTipo === 'ENTRENADOR' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                      msg.emisorTipo === 'ENTRENADOR'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}>
                      <p>{msg.contenido}</p>
                      <p className={`text-xs mt-1 ${msg.emisorTipo === 'ENTRENADOR' ? 'text-primary-100 opacity-70' : 'text-gray-400'}`}>
                        {formatHora(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              }
              <div ref={mensajesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleEnviar} className="border-t border-gray-200 p-3 bg-white flex gap-2">
              <input
                type="text"
                value={nuevoMensaje}
                onChange={e => setNuevoMensaje(e.target.value)}
                placeholder="Escribí un mensaje..."
                disabled={enviando}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!nuevoMensaje.trim() || enviando}
                className="bg-primary text-white rounded-lg px-3 py-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </>
        )}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}
    </div>
    </div>
  )
}
