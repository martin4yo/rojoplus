import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'

// Beep sintético via Web Audio (sin archivos externos)
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // ignorar si el browser bloquea audio
  }
}

/**
 * Listener global de respuestas pendientes de campañas de recupero.
 * Se conecta al socket.io del admin y, cuando llega una respuesta de un socio
 * a una campaña activa, muestra un toast con un link a la bandeja.
 *
 * Se monta una sola vez (en AdminLayout) para mantener una sola conexión.
 */
export default function RecuperoNotifier() {
  const navigate = useNavigate()
  const socketRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) return

    const url = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || window.location.origin
    const socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('recupero:respuesta-pendiente', (payload) => {
      playBeep()
      // Avisar a la campana del header (NotificationBell) y a cualquier vista abierta
      window.dispatchEvent(new CustomEvent('recupero:nueva-pendiente', { detail: payload }))
      toast.custom(
        (t) => (
          <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-green-500`}
          >
            <button
              className="flex-1 w-0 p-4 text-left"
              onClick={() => {
                toast.dismiss(t.id)
                navigate('/admin/recupero/pendientes')
              }}
            >
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Nueva respuesta de #{payload.nroSocio} {payload.socioNombre}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{payload.mensaje}</p>
                  <p className="mt-1 text-xs text-blue-600 font-medium">Click para ver →</p>
                </div>
              </div>
            </button>
            <button
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600"
              onClick={() => toast.dismiss(t.id)}
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ),
        { duration: 8000 }
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [navigate])

  return null
}
