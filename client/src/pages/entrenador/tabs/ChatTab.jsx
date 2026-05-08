import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, Send, MessageSquare } from 'lucide-react'
import api from '../../../services/api'
import toast from 'react-hot-toast'

export default function ChatTab() {
  const [conversaciones, setConversaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.get('/entrenador/conversaciones')
      setConversaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [])

  if (seleccionada) {
    return <Conversacion conv={seleccionada} onVolver={() => { setSeleccionada(null); cargar() }} />
  }

  return (
    <div className="space-y-3">
      {cargando ? (
        <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
      ) : conversaciones.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aún no hay conversaciones.</p>
          <p className="text-xs text-gray-400 mt-1">Los socios pueden iniciar una conversación desde su portal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversaciones.map(c => (
            <button
              key={c.id}
              onClick={() => setSeleccionada(c)}
              className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:shadow-md flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {c.socio?.fotoUrl
                  ? <img src={c.socio.fotoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-gray-400 font-bold">{(c.socio?.apellidoNombre || '?').slice(0, 1)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                  {c.socio?.apellidoNombre || 'Socio'}
                  {c.mensajesNoLeidos > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full">{c.mensajesNoLeidos}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {c.categoriaActividad?.actividad?.nombre} · {c.categoriaActividad?.nombre}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.ultimoMensaje && new Date(c.ultimoMensaje).toLocaleString('es-AR')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Conversacion({ conv, onVolver }) {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const finRef = useRef(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.get(`/entrenador/conversaciones/${conv.id}/mensajes`)
      setMensajes(Array.isArray(data) ? data : [])
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { cargar() }, [conv.id])

  async function enviar(e) {
    e?.preventDefault()
    if (!texto.trim() || enviando) return
    setEnviando(true)
    try {
      await api.post(`/entrenador/conversaciones/${conv.id}/mensajes`, { contenido: texto.trim() })
      setTexto('')
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onVolver} className="text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="font-medium text-gray-900">{conv.socio?.apellidoNombre || 'Socio'}</div>
          <div className="text-xs text-gray-500">{conv.categoriaActividad?.nombre}</div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 overflow-y-auto space-y-3">
        {cargando ? (
          <div className="text-sm text-gray-500 text-center py-8">Cargando…</div>
        ) : mensajes.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">No hay mensajes aún.</div>
        ) : (
          mensajes.map(m => {
            const propio = m.emisorTipo === 'ENTRENADOR'
            return (
              <div key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-lg ${propio ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                  <div className="text-sm whitespace-pre-wrap break-words">{m.contenido}</div>
                  <div className={`text-[10px] mt-1 ${propio ? 'text-blue-200' : 'text-gray-500'}`}>
                    {new Date(m.createdAt).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un mensaje…"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          disabled={enviando}
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
