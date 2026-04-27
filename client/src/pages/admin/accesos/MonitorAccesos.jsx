import { useState, useEffect, useMemo } from 'react'
import {
  Activity, CheckCircle, XCircle, Users, Clock, MapPin,
  QrCode, CreditCard, Radio, WifiOff, AlertTriangle, UserCheck
} from 'lucide-react'
import Pagination from '../../../components/Pagination'
import { Button } from '../../../components/Button'
import PermitirAccesoManualModal from '../../../components/PermitirAccesoManualModal'

const PAGE_SIZE = 20
const REPEAT_WINDOW_MS = 3 * 60 * 1000 // 3 minutos

export default function MonitorAccesos() {
  const [accesos, setAccesos] = useState([])
  const [estadisticas, setEstadisticas] = useState({
    totalHoy: 0,
    permitidos: 0,
    denegados: 0
  })
  const [dispositivosEstado, setDispositivosEstado] = useState([])
  const [page, setPage] = useState(1)
  const [permitirManualOpen, setPermitirManualOpen] = useState(false)

  // Detecta accesos repetidos: misma persona escaneada dos o más veces en < 3 minutos.
  // Se marca a partir del segundo scan (el primero del burst no es "repetido" todavía).
  const repeatKeys = useMemo(() => {
    const keyOf = (a) => a.socio?.id || a.habilitacionTemporal?.id || a.valorLeido
    const idOf = (a) => a.id ?? `${a.fecha}-${a.valorLeido}`
    const sorted = [...accesos].sort((x, y) => new Date(x.fecha) - new Date(y.fecha))
    const lastSeen = new Map()
    const repeated = new Set()
    for (const a of sorted) {
      const k = keyOf(a)
      if (!k) continue
      const ts = new Date(a.fecha).getTime()
      const prev = lastSeen.get(k)
      if (prev !== undefined && ts - prev <= REPEAT_WINDOW_MS) {
        repeated.add(idOf(a))
      }
      lastSeen.set(k, ts)
    }
    return repeated
  }, [accesos])

  const paginated = useMemo(() => {
    const total = accesos.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
    const to = Math.min(safePage * PAGE_SIZE, total)
    return {
      data: accesos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
      pagination: { page: safePage, totalPages, total, limit: PAGE_SIZE, from, to }
    }
  }, [accesos, page])

  useEffect(() => {
    cargarAccesosRecientes()
    cargarEstadisticas()
    cargarDispositivosEstado()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/accesos/monitor`

    let ws
    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => console.log('✓ WebSocket conectado')

      ws.onmessage = (event) => {
        const nuevoAcceso = JSON.parse(event.data)
        setAccesos(prev => [nuevoAcceso, ...prev].slice(0, 100))

        setEstadisticas(prev => ({
          totalHoy: prev.totalHoy + 1,
          permitidos: nuevoAcceso.resultado === 'PERMITIDO' ? prev.permitidos + 1 : prev.permitidos,
          denegados: nuevoAcceso.resultado === 'DENEGADO' ? prev.denegados + 1 : prev.denegados
        }))
      }

      ws.onerror = (error) => console.error('Error WebSocket:', error)
      ws.onclose = () => console.log('WebSocket cerrado')
    } catch (error) {
      console.error('Error conectando WebSocket:', error)
    }

    return () => { if (ws) ws.close() }
  }, [])

  const cargarAccesosRecientes = async () => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' })
      const response = await fetch(`/api/accesos/registros?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      })
      const data = await response.json()
      if (data.success) setAccesos(data.data || [])
    } catch (error) {
      console.error('Error cargando accesos:', error)
    }
  }

  const cargarEstadisticas = async () => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      const params = new URLSearchParams({ fechaDesde: hoy.toISOString(), page: '1', limit: '1' })
      const response = await fetch(`/api/accesos/registros?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      })
      const data = await response.json()

      if (data.success && data.pagination) {
        const paramsPermitidos = new URLSearchParams({
          fechaDesde: hoy.toISOString(),
          resultado: 'PERMITIDO',
          page: '1',
          limit: '1'
        })
        const responsePermitidos = await fetch(`/api/accesos/registros?${paramsPermitidos.toString()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        })
        const dataPermitidos = await responsePermitidos.json()

        setEstadisticas({
          totalHoy: data.pagination.total || 0,
          permitidos: dataPermitidos.pagination?.total || 0,
          denegados: (data.pagination.total || 0) - (dataPermitidos.pagination?.total || 0)
        })
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const cargarDispositivosEstado = async () => {
    try {
      const response = await fetch('/api/accesos/dispositivos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      })
      const data = await response.json()
      if (data.success) setDispositivosEstado(data.data || [])
    } catch (error) {
      console.error('Error cargando dispositivos:', error)
    }
  }

  const formatFecha = (fecha) => {
    const date = new Date(fecha)
    return date.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const getTiempoDesdeUltimoPing = (ultimoPing) => {
    if (!ultimoPing) return 'Nunca'
    const diff = Math.floor((new Date() - new Date(ultimoPing)) / 1000)
    if (diff < 60) return `Hace ${diff}s`
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
    return `Hace ${Math.floor(diff / 3600)}h`
  }

  const iconoTipoLectura = (tipo) => {
    if (tipo === 'QR') return <QrCode className="w-4 h-4" />
    if (tipo === 'DNI') return <CreditCard className="w-4 h-4" />
    if (tipo === 'RFID') return <Radio className="w-4 h-4" />
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Monitor de Accesos</h1>
            <p className="text-gray-500 text-sm">Visualización en tiempo real</p>
          </div>
        </div>
        <Button onClick={() => setPermitirManualOpen(true)}>
          <UserCheck className="w-4 h-4 mr-2" />
          Permitir sin documento
        </Button>
      </div>

      <PermitirAccesoManualModal
        isOpen={permitirManualOpen}
        onClose={() => setPermitirManualOpen(false)}
        dispositivos={dispositivosEstado}
        onPermitido={() => {
          cargarAccesosRecientes()
          cargarEstadisticas()
        }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Hoy</p>
              <p className="text-3xl font-bold text-gray-800">{estadisticas.totalHoy}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Permitidos</p>
              <p className="text-3xl font-bold text-green-600">{estadisticas.permitidos}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Denegados</p>
              <p className="text-3xl font-bold text-red-600">{estadisticas.denegados}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Estado de Dispositivos */}
      {dispositivosEstado.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Estado de Dispositivos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dispositivosEstado.map((dispositivo) => {
              const pingReciente = dispositivo.ultimoPing &&
                (new Date() - new Date(dispositivo.ultimoPing)) < 60000
              const estadoColor = pingReciente ? 'text-green-600' : 'text-gray-400'
              const estadoBg = pingReciente ? 'bg-green-100' : 'bg-gray-100'

              return (
                <div key={dispositivo.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                  <div className={`p-2 rounded-full ${estadoBg}`}>
                    <Activity className={`w-5 h-5 ${estadoColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{dispositivo.nombre}</p>
                    <p className="text-xs text-gray-500">{dispositivo.ubicacion}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {getTiempoDesdeUltimoPing(dispositivo.ultimoPing)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabla de Accesos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {accesos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay accesos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 w-10"></th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Persona</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 w-24">Tipo</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Motivo</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Dispositivo</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 w-40">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.data.map((acceso, index) => {
                  const esPermitido = acceso.resultado === 'PERMITIDO'
                  const Icon = esPermitido ? CheckCircle : XCircle
                  const colorClase = esPermitido ? 'text-green-600' : 'text-red-600'
                  const idKey = acceso.id ?? `${acceso.fecha}-${acceso.valorLeido}`
                  const esRepetido = repeatKeys.has(idKey)

                  return (
                    <tr key={acceso.id || index} className={`hover:bg-gray-50 ${esRepetido ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <Icon className={`w-5 h-5 inline ${colorClase}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {esRepetido && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap"
                              title="Escaneado más de una vez en los últimos 3 minutos"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Repetido
                            </span>
                          )}
                          {(() => {
                            const nombre = acceso.socio?.apellidoNombre
                              || acceso.habilitacionTemporal?.nombreCompleto
                              || acceso.nombreCompleto
                            const sinIdentificar = !acceso.socio && !acceso.habilitacionTemporal
                            return (
                              <span className="font-medium text-gray-800">
                                {nombre || 'Sin identificar'}
                                {sinIdentificar && acceso.valorLeido && (
                                  <span className="ml-2 font-mono text-sm text-gray-500">
                                    ({acceso.valorLeido})
                                  </span>
                                )}
                              </span>
                            )
                          })()}
                          {acceso.socio?.nroSocio && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                              Socio #{acceso.socio.nroSocio}
                            </span>
                          )}
                          {acceso.habilitacionTemporal && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                              Habilitación
                            </span>
                          )}
                          {acceso.modoValidacion === 'OFFLINE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                          {iconoTipoLectura(acceso.tipoLectura)}
                          {acceso.tipoLectura}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-sm font-medium ${esPermitido ? 'text-green-600' : 'text-red-600'}`}>
                          {acceso.motivoRechazo || 'Permitido'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {acceso.dispositivo && (
                          <div className="text-sm">
                            <p className="text-gray-800">{acceso.dispositivo.nombre}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {acceso.dispositivo.ubicacion}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatFecha(acceso.fecha)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 border-t border-gray-200">
              <Pagination
                pagination={paginated.pagination}
                page={paginated.pagination.page}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
