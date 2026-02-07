import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  History,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tienePermiso, PERMISOS } from '../../services/permisos'

const api = {
  get: async (url) => {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`/api${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Error en la petición')
    return res.json()
  },
  post: async (url, data) => {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`/api${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Error en la petición')
    return res.json()
  },
}

function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value)
}

export default function PasajeCategoria() {
  const [activeTab, setActiveTab] = useState('revisar')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Datos
  const [revision, setRevision] = useState(null)
  const [historial, setHistorial] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)

  // Filtros
  const [filtros, setFiltros] = useState({
    actividadId: '',
    fechaReferencia: `${new Date().getFullYear() + 1}-01-01`,
    anio: new Date().getFullYear(),
  })
  const [actividades, setActividades] = useState([])
  const [showFiltros, setShowFiltros] = useState(false)

  // Selección
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [ejecutando, setEjecutando] = useState(false)

  // Cargar actividades
  useEffect(() => {
    const cargarActividades = async () => {
      try {
        const res = await api.get('/admin/actividades')
        setActividades(res.data || [])
      } catch (err) {
        console.error('Error cargando actividades:', err)
      }
    }
    cargarActividades()
  }, [])

  // Cargar datos según tab
  useEffect(() => {
    cargarDatos()
  }, [activeTab, filtros])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'revisar') {
        const params = new URLSearchParams()
        if (filtros.actividadId) params.append('actividadId', filtros.actividadId)
        if (filtros.fechaReferencia) params.append('fechaReferencia', filtros.fechaReferencia)
        const queryString = params.toString() ? `?${params.toString()}` : ''

        const res = await api.get(`/admin/categorias/pasaje/revisar${queryString}`)
        setRevision(res.data)
        setSeleccionados(new Set())
      } else if (activeTab === 'historial') {
        const params = new URLSearchParams()
        if (filtros.actividadId) params.append('actividadId', filtros.actividadId)
        const queryString = params.toString() ? `?${params.toString()}` : ''

        const res = await api.get(`/admin/categorias/pasaje/historial${queryString}`)
        setHistorial(res.data || [])
      } else if (activeTab === 'estadisticas') {
        const res = await api.get(`/admin/categorias/pasaje/estadisticas?anio=${filtros.anio}`)
        setEstadisticas(res.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Toggle selección
  const toggleSeleccion = (inscripcionId) => {
    const newSet = new Set(seleccionados)
    if (newSet.has(inscripcionId)) {
      newSet.delete(inscripcionId)
    } else {
      newSet.add(inscripcionId)
    }
    setSeleccionados(newSet)
  }

  // Seleccionar todos
  const seleccionarTodos = () => {
    if (!revision?.pasajesNecesarios) return
    const allIds = revision.pasajesNecesarios.map((p) => p.inscripcionId)
    setSeleccionados(new Set(allIds))
  }

  // Deseleccionar todos
  const deseleccionarTodos = () => {
    setSeleccionados(new Set())
  }

  // Ejecutar pasajes
  const ejecutarPasajes = async () => {
    if (seleccionados.size === 0) {
      toast.error('Debe seleccionar al menos un pasaje')
      return
    }

    const pasajesAEjecutar = revision.pasajesNecesarios
      .filter((p) => seleccionados.has(p.inscripcionId))
      .map((p) => ({
        inscripcionId: p.inscripcionId,
        categoriaDestinoId: p.categoriaDestino.id,
      }))

    setEjecutando(true)
    try {
      const res = await api.post('/admin/categorias/pasaje/ejecutar', {
        pasajes: pasajesAEjecutar,
        fechaEfectiva: filtros.fechaReferencia,
      })

      if (res.success) {
        toast.success(`${res.data.exitosos} pasajes ejecutados exitosamente`)
        if (res.data.fallidos > 0) {
          toast.error(`${res.data.fallidos} pasajes con errores`)
        }
        cargarDatos()
      }
    } catch (err) {
      toast.error('Error al ejecutar pasajes: ' + err.message)
    } finally {
      setEjecutando(false)
    }
  }

  const tabs = [
    { id: 'revisar', label: 'Revisar Pasajes', icon: Users },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pasaje de Categorías</h1>
            <p className="text-gray-500 text-sm">Gestión automática de cambios de categoría por edad</p>
          </div>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex overflow-x-auto border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="p-4 border-b bg-gray-50/50">
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFiltros && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actividad</label>
                <select
                  value={filtros.actividadId}
                  onChange={(e) => setFiltros({ ...filtros, actividadId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Todas</option>
                  {actividades.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              {activeTab === 'revisar' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Fecha de Referencia (calcular edades a esta fecha)
                  </label>
                  <input
                    type="date"
                    value={filtros.fechaReferencia}
                    onChange={(e) => setFiltros({ ...filtros, fechaReferencia: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              {activeTab === 'estadisticas' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                  <select
                    value={filtros.anio}
                    onChange={(e) => setFiltros({ ...filtros, anio: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {[2026, 2025, 2024, 2023].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <p>Error: {error}</p>
              <button onClick={cargarDatos} className="mt-4 text-sm underline">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Tab Revisar */}
              {activeTab === 'revisar' && revision && (
                <TabRevisar
                  revision={revision}
                  seleccionados={seleccionados}
                  toggleSeleccion={toggleSeleccion}
                  seleccionarTodos={seleccionarTodos}
                  deseleccionarTodos={deseleccionarTodos}
                  ejecutarPasajes={ejecutarPasajes}
                  ejecutando={ejecutando}
                  fechaReferencia={filtros.fechaReferencia}
                />
              )}

              {/* Tab Historial */}
              {activeTab === 'historial' && (
                <TabHistorial historial={historial} />
              )}

              {/* Tab Estadísticas */}
              {activeTab === 'estadisticas' && estadisticas && (
                <TabEstadisticas estadisticas={estadisticas} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Tab Revisar Pasajes
function TabRevisar({
  revision,
  seleccionados,
  toggleSeleccion,
  seleccionarTodos,
  deseleccionarTodos,
  ejecutarPasajes,
  ejecutando,
  fechaReferencia,
}) {
  const { estadisticas, pasajesNecesarios, sinCategoriaDisponible } = revision

  return (
    <div className="space-y-6">
      {/* Info fecha referencia */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-700">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">
            Calculando edades al {formatDate(fechaReferencia)}
          </span>
        </div>
        <p className="text-sm text-blue-600 mt-1">
          Normalmente se usa el 1ro de enero del próximo año para planificar los pasajes de categoría.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{formatNumber(estadisticas.totalInscripciones)}</p>
          <p className="text-xs text-gray-500">Inscripciones Activas</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{formatNumber(estadisticas.enRango)}</p>
          <p className="text-xs text-gray-500">En Rango de Edad</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{formatNumber(estadisticas.requierenPasaje)}</p>
          <p className="text-xs text-gray-500">Requieren Pasaje</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{formatNumber(estadisticas.sinCategoriaDisponible)}</p>
          <p className="text-xs text-gray-500">Sin Categoría Disponible</p>
        </div>
      </div>

      {/* Pasajes Necesarios */}
      {pasajesNecesarios.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Pasajes a Ejecutar</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={seleccionarTodos}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Seleccionar todos
              </button>
              <button
                onClick={deseleccionarTodos}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Ninguno
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={seleccionados.size === pasajesNecesarios.length}
                      onChange={(e) =>
                        e.target.checked ? seleccionarTodos() : deseleccionarTodos()
                      }
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Socio</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Edad</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría Actual</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría Destino</th>
                </tr>
              </thead>
              <tbody>
                {pasajesNecesarios.map((pasaje) => (
                  <tr
                    key={pasaje.inscripcionId}
                    className={`border-t hover:bg-gray-50 cursor-pointer ${
                      seleccionados.has(pasaje.inscripcionId) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => toggleSeleccion(pasaje.inscripcionId)}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(pasaje.inscripcionId)}
                        onChange={() => toggleSeleccion(pasaje.inscripcionId)}
                        className="w-4 h-4 rounded border-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/socios/${pasaje.socio.id}`}
                        className="text-blue-600 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {pasaje.socio.apellido}, {pasaje.socio.nombre}
                      </Link>
                      <p className="text-xs text-gray-400">#{pasaje.socio.nroSocio}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-lg">{pasaje.edad}</span>
                      <p className="text-xs text-gray-400">años</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{pasaje.categoriaActual.nombre}</span>
                      <p className="text-xs text-gray-400">
                        {pasaje.categoriaActual.edadMinima || 0} - {pasaje.categoriaActual.edadMaxima || 99} años
                      </p>
                      <p className="text-xs text-gray-500">{pasaje.actividad.nombre}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pasaje.tipoMovimiento === 'ASCENSO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <ArrowUpCircle className="w-3 h-3" />
                          Ascenso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          <ArrowDownCircle className="w-3 h-3" />
                          Descenso
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-green-600">{pasaje.categoriaDestino.nombre}</span>
                      <p className="text-xs text-gray-400">
                        {pasaje.categoriaDestino.edadMinima || 0} - {pasaje.categoriaDestino.edadMaxima || 99} años
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botón ejecutar */}
          {tienePermiso(PERMISOS.DEPORTES_PASAJE) && (
            <div className="flex justify-end">
              <button
                onClick={ejecutarPasajes}
                disabled={seleccionados.size === 0 || ejecutando}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                  seleccionados.size > 0
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {ejecutando ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                Ejecutar {seleccionados.size} pasaje{seleccionados.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sin categoría disponible */}
      {sinCategoriaDisponible.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold">Sin Categoría Disponible ({sinCategoriaDisponible.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Socio</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Edad</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría Actual</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sinCategoriaDisponible.map((pasaje) => (
                  <tr key={pasaje.inscripcionId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/socios/${pasaje.socio.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {pasaje.socio.apellido}, {pasaje.socio.nombre}
                      </Link>
                      <p className="text-xs text-gray-400">#{pasaje.socio.nroSocio}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-lg">{pasaje.edad}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{pasaje.categoriaActual.nombre}</span>
                      <p className="text-xs text-gray-400">
                        {pasaje.categoriaActual.edadMinima || 0} - {pasaje.categoriaActual.edadMaxima || 99} años
                      </p>
                      <p className="text-xs text-gray-500">{pasaje.actividad.nombre}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-yellow-700 text-sm">{pasaje.motivo}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pasajesNecesarios.length === 0 && sinCategoriaDisponible.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <p className="text-gray-600">Todos los deportistas están en la categoría correcta</p>
        </div>
      )}
    </div>
  )
}

// Tab Historial
function TabHistorial({ historial }) {
  if (!historial || historial.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No hay historial de pasajes de categoría</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-600">Fecha</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Socio</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría Origen</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Actividad</th>
          </tr>
        </thead>
        <tbody>
          {historial.map((item) => (
            <tr key={item.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">{formatDate(item.fechaFin)}</td>
              <td className="px-4 py-3">
                <Link
                  to={`/admin/socios/${item.socio.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {item.socio.apellido || ''} {item.socio.nombre || item.socio.apellidoNombre}
                </Link>
                <p className="text-xs text-gray-400">#{item.socio.nroSocio}</p>
              </td>
              <td className="px-4 py-3 font-medium">{item.categoriaActividad.nombre}</td>
              <td className="px-4 py-3 text-gray-600">{item.categoriaActividad.actividad?.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Tab Estadísticas
function TabEstadisticas({ estadisticas }) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="space-y-6">
      {/* KPI Total */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-6 text-white">
        <h2 className="text-lg font-medium">Total de Pasajes en {estadisticas.anio}</h2>
        <p className="text-4xl font-bold mt-2">{formatNumber(estadisticas.totalPasajes)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por Actividad */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Por Actividad / Categoría</h3>
          {estadisticas.porActividad?.length > 0 ? (
            <div className="space-y-2">
              {estadisticas.porActividad.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div>
                    <span className="font-medium text-gray-700">{item.categoria}</span>
                    <p className="text-xs text-gray-500">{item.actividad}</p>
                  </div>
                  <span className="font-bold text-red-600">{formatNumber(item.cantidad)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Sin datos</p>
          )}
        </div>

        {/* Por Mes */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Por Mes</h3>
          {estadisticas.porMes?.length > 0 ? (
            <div className="space-y-2">
              {estadisticas.porMes.map((item) => (
                <div key={item.mes} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="font-medium text-gray-700">{meses[item.mes - 1]}</span>
                  <span className="font-bold text-red-600">{formatNumber(item.cantidad)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Sin datos</p>
          )}
        </div>
      </div>
    </div>
  )
}
