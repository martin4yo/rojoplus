import { useEffect, useState } from 'react'
import { Smartphone, Monitor, Tablet, Trash2, AlertTriangle } from 'lucide-react'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import { Button } from '../../../components/Button'

function descripcionUA(ua) {
  if (!ua) return { dispositivo: 'Desconocido', browser: '', icon: Monitor }
  const s = ua.toLowerCase()
  let dispositivo = 'Desktop'
  let icon = Monitor
  if (s.includes('iphone')) { dispositivo = 'iPhone'; icon = Smartphone }
  else if (s.includes('ipad')) { dispositivo = 'iPad'; icon = Tablet }
  else if (s.includes('android')) {
    if (s.includes('mobile')) { dispositivo = 'Android'; icon = Smartphone }
    else { dispositivo = 'Tablet Android'; icon = Tablet }
  } else if (s.includes('mobile')) { dispositivo = 'Mobile'; icon = Smartphone }

  let browser = ''
  if (s.includes('chrome') && !s.includes('edg')) browser = 'Chrome'
  else if (s.includes('firefox')) browser = 'Firefox'
  else if (s.includes('safari') && !s.includes('chrome')) browser = 'Safari'
  else if (s.includes('edg')) browser = 'Edge'
  return { dispositivo, browser, icon }
}

export default function DispositivosTab({ socioId }) {
  const [sesiones, setSesiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [revocando, setRevocando] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await api.get(`/admin/socios/${socioId}/sesiones`)
      setSesiones(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err.message || 'Error cargando dispositivos')
      setSesiones([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [socioId])

  async function revocar(id) {
    if (!confirm('¿Cerrar sesión en este dispositivo? El socio tendrá que volver a iniciar sesión allí.')) return
    setRevocando(id)
    try {
      await api.post(`/admin/socios/${socioId}/sesiones/${id}/revocar`)
      toast.success('Dispositivo desconectado')
      await cargar()
    } catch (err) {
      toast.error(err.message || 'Error al revocar')
    } finally {
      setRevocando(null)
    }
  }

  async function revocarTodas() {
    if (!confirm('¿Cerrar sesión en TODOS los dispositivos? El socio tendrá que volver a iniciar sesión en cada uno.')) return
    setRevocando('all')
    try {
      const data = await api.post(`/admin/socios/${socioId}/sesiones/revocar-todas`)
      toast.success(`${data.revocadas || 0} sesiones cerradas`)
      await cargar()
    } catch (err) {
      toast.error(err.message || 'Error al revocar')
    } finally {
      setRevocando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Dispositivos conectados</h3>
          <p className="text-sm text-gray-500 mt-1">
            Sesiones activas del socio en el portal. Cada sesión dura 30 días desde el último acceso.
          </p>
        </div>
        {sesiones.length > 0 && (
          <Button variant="secondary" onClick={revocarTodas} disabled={revocando !== null}>
            <Trash2 className="w-4 h-4 mr-2" />
            Cerrar todas
          </Button>
        )}
      </div>

      {cargando ? (
        <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>
      ) : sesiones.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No hay dispositivos recordados.</p>
          <p className="text-xs text-gray-400 mt-1">El socio no usó la opción "recordar dispositivo" o todas las sesiones expiraron.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {sesiones.map(s => {
            const { dispositivo, browser, icon: Icon } = descripcionUA(s.userAgent)
            return (
              <div key={s.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">
                    {dispositivo}{browser ? ` · ${browser}` : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <div>Último acceso: {new Date(s.lastUsedAt).toLocaleString('es-AR')}</div>
                    <div>Creada: {new Date(s.createdAt).toLocaleString('es-AR')}</div>
                    <div>Expira: {new Date(s.expiresAt).toLocaleDateString('es-AR')}</div>
                    {s.ip && <div>IP: {s.ip}</div>}
                  </div>
                </div>
                <button
                  onClick={() => revocar(s.id)}
                  disabled={revocando !== null}
                  className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  {revocando === s.id ? 'Cerrando…' : 'Desconectar'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
