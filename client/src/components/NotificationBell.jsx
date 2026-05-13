import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Inbox, MessageCircle, Mail, ExternalLink } from 'lucide-react'
import api from '../services/api'

const TIPO_ICON = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
}

function formatRel(date) {
  const d = new Date(date)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'hace un instante'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const dias = Math.floor(h / 24)
  if (dias < 7) return `hace ${dias} d`
  return d.toLocaleDateString('es-AR')
}

/**
 * Campana de notificaciones en el header del admin.
 * Muestra las últimas respuestas pendientes de campañas de recupero.
 *
 * Se actualiza:
 *  - al montar
 *  - cuando RecuperoNotifier dispacha 'recupero:nueva-pendiente'
 *  - cuando RecuperoPendientes dispacha 'recupero:pendiente-atendida'
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [pendientes, setPendientes] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    cargarCount()
    const onNueva = () => { cargarCount(); if (open) cargarPendientes() }
    const onAtendida = () => { cargarCount(); if (open) cargarPendientes() }
    window.addEventListener('recupero:nueva-pendiente', onNueva)
    window.addEventListener('recupero:pendiente-atendida', onAtendida)
    return () => {
      window.removeEventListener('recupero:nueva-pendiente', onNueva)
      window.removeEventListener('recupero:pendiente-atendida', onAtendida)
    }
  }, [open])

  // Click afuera cierra el dropdown
  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)
          && btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function cargarCount() {
    try {
      const r = await api.getFull('/admin/recupero/pendientes/count')
      setCount(r?.total || 0)
    } catch {
      // silencioso
    }
  }

  async function cargarPendientes() {
    try {
      setLoading(true)
      const r = await api.getFull('/admin/recupero/pendientes')
      setPendientes((r?.data || []).slice(0, 5)) // mostrar máx 5
    } catch {
      setPendientes([])
    } finally {
      setLoading(false)
    }
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) cargarPendientes()
  }

  function irAPendiente(p) {
    setOpen(false)
    navigate('/admin/recupero/pendientes')
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className="flex items-center justify-center w-9 h-9 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-full transition-colors relative"
        title={count > 0 ? `Tenés ${count} respuesta(s) pendiente(s)` : 'Sin notificaciones'}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">Respuestas pendientes</span>
            {count > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                {count}
              </span>
            )}
          </div>

          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">Cargando…</div>
          ) : pendientes.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No hay respuestas pendientes
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {pendientes.map(p => {
                const Icon = TIPO_ICON[p.tipo] || MessageCircle
                return (
                  <button
                    key={p.id}
                    onClick={() => irAPendiente(p)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            #{p.socio?.nroSocio} {p.socio?.apellidoNombre}
                          </p>
                          <span className="text-[10px] text-gray-400 ml-auto whitespace-nowrap">{formatRel(p.fecha)}</span>
                        </div>
                        {p.campana?.nombre && (
                          <p className="text-[11px] text-gray-500 truncate">{p.campana.nombre}</p>
                        )}
                        <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{p.observaciones}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {count > 0 && (
            <button
              onClick={() => { setOpen(false); navigate('/admin/recupero/pendientes') }}
              className="w-full px-4 py-2 text-sm text-center text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center justify-center gap-1 transition"
            >
              Ver todas <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
