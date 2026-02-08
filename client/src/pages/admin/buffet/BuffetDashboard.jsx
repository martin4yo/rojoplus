import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Users, Clock, DollarSign, ChefHat, ShoppingBag, Coffee, AlertCircle, RefreshCw, Settings, X, UserCheck, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'

export default function BuffetDashboard() {
  const [kpis, setKpis] = useState(null)
  const [mesas, setMesas] = useState([])
  const [todasLasMesas, setTodasLasMesas] = useState([]) // Para el modal de asignación
  const [mozos, setMozos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verMisMesas, setVerMisMesas] = useState(false)
  const [modalAsignacion, setModalAsignacion] = useState(false)
  const [asignaciones, setAsignaciones] = useState({}) // { mesaId: mozoId }

  const puedeAsignar = tienePermiso(PERMISOS.BUFFET_CONFIG)

  const cargarDatos = useCallback(async () => {
    try {
      setError(null)
      const [dashRes, mesasRes, todasMesasRes] = await Promise.all([
        api.get('/admin/buffet/dashboard'),
        api.get(`/admin/buffet/mesas/estado${verMisMesas ? '?misMesas=true' : ''}`),
        api.get('/admin/buffet/mesas/estado') // Siempre cargar todas para el modal
      ])
      setKpis(dashRes.data || dashRes)
      const mesasData = mesasRes.data || mesasRes || []
      setMesas(mesasData)

      const todasData = todasMesasRes.data || todasMesasRes || []
      setTodasLasMesas(todasData)

      // Inicializar asignaciones con las actuales (de todas las mesas)
      const asignacionesActuales = {}
      todasData.forEach(m => {
        asignacionesActuales[m.id] = m.mozoAsignado?.id || ''
      })
      setAsignaciones(asignacionesActuales)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
      setError('Error al cargar datos del buffet')
    } finally {
      setLoading(false)
    }
  }, [verMisMesas])

  const cargarMozos = async () => {
    try {
      const res = await api.get('/admin/buffet/mozos')
      setMozos(res.data || res || [])
    } catch (err) {
      console.error('Error cargando mozos:', err)
    }
  }

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 30000)
    return () => clearInterval(interval)
  }, [cargarDatos])

  useEffect(() => {
    if (puedeAsignar) {
      cargarMozos()
    }
  }, [puedeAsignar])

  const handleAsignacionChange = (mesaId, mozoId) => {
    setAsignaciones(prev => ({
      ...prev,
      [mesaId]: mozoId
    }))
  }

  const guardarAsignaciones = async () => {
    try {
      const asignacionesArray = Object.entries(asignaciones).map(([mesaId, mozoId]) => ({
        mesaId: parseInt(mesaId),
        mozoId: mozoId ? parseInt(mozoId) : null
      }))

      await api.post('/admin/buffet/mesas/asignar-masivo', { asignaciones: asignacionesArray })
      toast.success('Asignaciones guardadas')
      setModalAsignacion(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando asignaciones:', err)
      toast.error('Error al guardar asignaciones')
    }
  }

  const limpiarAsignaciones = async () => {
    if (!confirm('¿Desasignar todas las mesas? (Limpiar turno)')) return

    try {
      await api.post('/admin/buffet/mesas/desasignar-todas')
      toast.success('Todas las mesas desasignadas')
      setModalAsignacion(false)
      cargarDatos()
    } catch (err) {
      console.error('Error limpiando asignaciones:', err)
      toast.error('Error al limpiar asignaciones')
    }
  }

  const getColorEstadoMesa = (estado) => {
    switch (estado) {
      case 'LIBRE': return 'bg-green-500'
      case 'OCUPADA': return 'bg-red-500'
      case 'CUENTA_PEDIDA': return 'bg-yellow-500'
      case 'LIMPIEZA': return 'bg-gray-400'
      default: return 'bg-gray-300'
    }
  }

  const getTextoEstado = (estado) => {
    switch (estado) {
      case 'LIBRE': return 'Libre'
      case 'OCUPADA': return 'Ocupada'
      case 'CUENTA_PEDIDA': return 'Cuenta'
      case 'LIMPIEZA': return 'Limpieza'
      default: return estado
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buffet - Dashboard</h1>
          <p className="text-gray-600">Vista general del estado del buffet</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Mis Mesas / Todas */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setVerMisMesas(false)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !verMisMesas ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setVerMisMesas(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                verMisMesas ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mis Mesas
            </button>
          </div>

          {/* Notificaciones en tiempo real */}
          <NotificacionBuffet />

          {puedeAsignar && (
            <button
              onClick={() => setModalAsignacion(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
            >
              <Settings size={16} />
              <span className="hidden md:inline">Asignar Mozos</span>
            </button>
          )}

          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
          >
            <RefreshCw size={16} />
            <span className="hidden md:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="text-blue-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Mesas Ocupadas</p>
                <p className="text-2xl font-bold">{kpis.mesas?.ocupadas || 0}/{kpis.mesas?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <Users className="text-orange-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Comandas Activas</p>
                <p className="text-2xl font-bold">{kpis.comandas?.activas || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-purple-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Take Away</p>
                <p className="text-2xl font-bold">{kpis.takeAway?.pendientes || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <ChefHat className="text-red-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">En Cocina</p>
                <p className="text-2xl font-bold">{kpis.cocina?.itemsPendientes || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <DollarSign className="text-green-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Ventas Hoy</p>
                <p className="text-2xl font-bold">${(kpis.ventas?.totalHoy || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
            <div className="flex items-center gap-3">
              <Clock className="text-gray-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Cerradas Hoy</p>
                <p className="text-2xl font-bold">{kpis.comandas?.cerradasHoy || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accesos Rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/admin/buffet/mesas"
          className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg text-center transition-colors"
        >
          <UtensilsCrossed size={32} className="mx-auto mb-2" />
          <span className="font-medium">Mesas</span>
        </Link>
        <Link
          to="/admin/buffet/takeaway"
          className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-lg text-center transition-colors"
        >
          <ShoppingBag size={32} className="mx-auto mb-2" />
          <span className="font-medium">Take Away</span>
        </Link>
        <Link
          to="/admin/buffet/kiosco"
          className="bg-orange-600 hover:bg-orange-700 text-white p-6 rounded-lg text-center transition-colors"
        >
          <Coffee size={32} className="mx-auto mb-2" />
          <span className="font-medium">Kiosco</span>
        </Link>
        <Link
          to="/admin/buffet/cocina"
          className="bg-red-600 hover:bg-red-700 text-white p-6 rounded-lg text-center transition-colors"
        >
          <ChefHat size={32} className="mx-auto mb-2" />
          <span className="font-medium">Cocina</span>
        </Link>
      </div>

      {/* Mapa de Mesas */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {verMisMesas ? 'Mis Mesas Asignadas' : 'Estado de Mesas'}
          </h2>
          {verMisMesas && mesas.length === 0 && (
            <span className="text-sm text-gray-500">No tenés mesas asignadas</span>
          )}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Cuenta</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Limpieza</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white text-[9px]">C</div>
            <span>Comunal</span>
          </div>
        </div>

        {/* Grid de Mesas */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {mesas.map(mesa => {
            const comandasActivas = mesa.comandas?.filter(c =>
              ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
            ) || []
            const totalMesa = comandasActivas.reduce((sum, c) => sum + Number(c.total || 0), 0)

            return (
              <Link
                key={mesa.id}
                to={`/admin/buffet/comanda/${mesa.id}`}
                className={`${getColorEstadoMesa(mesa.estado)} text-white p-3 md:p-4 rounded-lg text-center hover:opacity-90 transition-opacity relative`}
              >
                {mesa.esComunal && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-[10px]" title="Mesa Comunal">
                    C
                  </div>
                )}
                <div className="font-bold text-lg">{mesa.numero}</div>
                <div className="text-xs opacity-90">{getTextoEstado(mesa.estado)}</div>
                {mesa.mozoAsignado && (
                  <div className="text-[10px] opacity-75 truncate" title={`Mozo: ${mesa.mozoAsignado.nombre}`}>
                    {mesa.mozoAsignado.nombre.split(' ')[0]}
                  </div>
                )}
                {mesa.tiempoOcupada && (
                  <div className="text-xs mt-1">{mesa.tiempoOcupada} min</div>
                )}
                {comandasActivas.length > 0 && (
                  <div className="text-xs mt-1 font-medium">
                    ${totalMesa.toLocaleString()}
                    {mesa.esComunal && comandasActivas.length > 1 && (
                      <span className="block text-[10px] opacity-75">({comandasActivas.length} grupos)</span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        {mesas.length === 0 && !verMisMesas && (
          <p className="text-center text-gray-500 py-8">
            No hay mesas configuradas.{' '}
            <Link to="/admin/buffet/mesas" className="text-blue-600 hover:underline">
              Configurar mesas
            </Link>
          </p>
        )}

        {mesas.length === 0 && verMisMesas && (
          <p className="text-center text-gray-500 py-8">
            No tenés mesas asignadas para este turno.
            <button
              onClick={() => setVerMisMesas(false)}
              className="block mx-auto mt-2 text-blue-600 hover:underline"
            >
              Ver todas las mesas
            </button>
          </p>
        )}
      </div>

      {/* Modal Asignación de Mozos */}
      {modalAsignacion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Asignar Mozos a Mesas</h2>
              <button onClick={() => setModalAsignacion(false)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Mozos disponibles */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Mozos disponibles</h3>
                <div className="flex flex-wrap gap-2">
                  {mozos.map(mozo => (
                    <div key={mozo.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                      <UserCheck size={14} className="text-purple-600" />
                      <span>{mozo.nombreCompleto}</span>
                      <span className="text-xs text-gray-500">({mozo.mesasAsignadas} mesas)</span>
                    </div>
                  ))}
                  {mozos.length === 0 && (
                    <p className="text-gray-500 text-sm">No hay mozos con permiso BUFFET_MESAS</p>
                  )}
                </div>
              </div>

              {/* Tabla de asignaciones */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mesa</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Zona</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mozo Asignado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {todasLasMesas.map(mesa => (
                      <tr key={mesa.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="font-medium">Mesa {mesa.numero}</span>
                          {mesa.esComunal && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Comunal</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{mesa.zona || '-'}</td>
                        <td className="px-4 py-2">
                          <select
                            value={asignaciones[mesa.id] || ''}
                            onChange={e => handleAsignacionChange(mesa.id, e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="">Sin asignar</option>
                            {mozos.map(mozo => (
                              <option key={mozo.id} value={mozo.id}>{mozo.nombreCompleto}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {todasLasMesas.length === 0 && (
                <p className="text-center text-gray-500 py-4">No hay mesas configuradas</p>
              )}
            </div>

            <div className="p-4 border-t flex justify-between">
              <button
                onClick={limpiarAsignaciones}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
                Limpiar Turno
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalAsignacion(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarAsignaciones}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Guardar Asignaciones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
