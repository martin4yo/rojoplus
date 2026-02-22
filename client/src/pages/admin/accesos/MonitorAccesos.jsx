import { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, Users, Clock } from 'lucide-react'

export default function MonitorAccesos() {
  const [accesos, setAccesos] = useState([])
  const [estadisticas, setEstadisticas] = useState({
    totalHoy: 0,
    permitidos: 0,
    denegados: 0
  })
  const [dispositivosEstado, setDispositivosEstado] = useState([])

  useEffect(() => {
    // Cargar accesos recientes al montar
    cargarAccesosRecientes()

    // Cargar estadísticas del día
    cargarEstadisticas()

    // Cargar estado de dispositivos
    cargarDispositivosEstado()

    // Conectar WebSocket para tiempo real
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/accesos/monitor`

    let ws
    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✓ WebSocket conectado')
      }

      ws.onmessage = (event) => {
        const nuevoAcceso = JSON.parse(event.data)
        setAccesos(prev => [nuevoAcceso, ...prev].slice(0, 50))

        // Actualizar estadísticas
        setEstadisticas(prev => ({
          totalHoy: prev.totalHoy + 1,
          permitidos: nuevoAcceso.resultado === 'PERMITIDO' ? prev.permitidos + 1 : prev.permitidos,
          denegados: nuevoAcceso.resultado === 'DENEGADO' ? prev.denegados + 1 : prev.denegados
        }))
      }

      ws.onerror = (error) => {
        console.error('Error WebSocket:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket cerrado')
      }
    } catch (error) {
      console.error('Error conectando WebSocket:', error)
    }

    return () => {
      if (ws) ws.close()
    }
  }, [])

  const cargarAccesosRecientes = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50'
      })

      const response = await fetch(`/api/accesos/registros?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setAccesos(data.data || [])
      }
    } catch (error) {
      console.error('Error cargando accesos:', error)
    }
  }

  const cargarEstadisticas = async () => {
    try {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      const params = new URLSearchParams({
        fechaDesde: hoy.toISOString(),
        page: '1',
        limit: '1'
      })

      const response = await fetch(`/api/accesos/registros?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()
      if (data.success && data.pagination) {
        // Contar permitidos y denegados
        const paramsPermitidos = new URLSearchParams({
          fechaDesde: hoy.toISOString(),
          resultado: 'PERMITIDO',
          page: '1',
          limit: '1'
        })

        const responsePermitidos = await fetch(`/api/accesos/registros?${paramsPermitidos.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
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
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setDispositivosEstado(data.data || [])
      }
    } catch (error) {
      console.error('Error cargando dispositivos:', error)
    }
  }

  const formatFecha = (fecha) => {
    const date = new Date(fecha)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getTiempoDesdeUltimoPing = (ultimoPing) => {
    if (!ultimoPing) return 'Nunca'

    const ahora = new Date()
    const ping = new Date(ultimoPing)
    const diff = Math.floor((ahora - ping) / 1000) // segundos

    if (diff < 60) return `Hace ${diff}s`
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
    return `Hace ${Math.floor(diff / 3600)}h`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Activity className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monitor de Accesos</h1>
          <p className="text-gray-500 text-sm">Visualización en tiempo real</p>
        </div>
      </div>

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
                (new Date() - new Date(dispositivo.ultimoPing)) < 60000 // < 1 minuto
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

      {/* Stream de Accesos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-800">Últimos 50 Accesos</h2>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {accesos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay accesos registrados</p>
            </div>
          ) : (
            accesos.map((acceso, index) => {
              const esPermitido = acceso.resultado === 'PERMITIDO'
              const Icon = esPermitido ? CheckCircle : XCircle
              const colorClase = esPermitido ? 'text-green-600' : 'text-red-600'
              const bgClase = esPermitido ? 'bg-green-50' : 'bg-red-50'
              const borderClase = esPermitido ? 'border-l-green-500' : 'border-l-red-500'

              return (
                <div
                  key={index}
                  className={`px-6 py-4 hover:bg-gray-50 transition-colors border-l-4 ${borderClase} ${index === 0 ? bgClase : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className={`w-5 h-5 ${colorClase} mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-800">
                            {acceso.socio?.apellidoNombre || acceso.habilitacionTemporal?.nombreCompleto || 'Sin identificar'}
                          </p>
                          {acceso.socio?.nroSocio && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Socio #{acceso.socio.nroSocio}
                            </span>
                          )}
                          {acceso.habilitacionTemporal && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              Habilitación
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            {acceso.tipoLectura === 'QR' && '📱 QR'}
                            {acceso.tipoLectura === 'DNI' && '🆔 DNI'}
                            {acceso.tipoLectura === 'RFID' && '📡 RFID'}
                          </span>
                          <span>•</span>
                          <span className={esPermitido ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {acceso.motivoRechazo || 'Permitido'}
                          </span>
                          {acceso.modoValidacion === 'OFFLINE' && (
                            <>
                              <span>•</span>
                              <span className="text-orange-600 font-medium">Offline</span>
                            </>
                          )}
                        </div>
                        {acceso.dispositivo && (
                          <p className="text-xs text-gray-400 mt-1">
                            {acceso.dispositivo.nombre} - {acceso.dispositivo.ubicacion}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 whitespace-nowrap">
                        {formatFecha(acceso.fecha)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
