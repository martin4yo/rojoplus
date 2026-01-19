import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronDown, ChevronRight, Users, AlertCircle, Clock, Percent, BarChart3 } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ReporteCuotas() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reporte, setReporte] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [periodoId, setPeriodoId] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [expandedActivities, setExpandedActivities] = useState({})

  // Modal de morosos
  const [showMorosos, setShowMorosos] = useState(false)
  const [morososData, setMorososData] = useState(null)
  const [loadingMorosos, setLoadingMorosos] = useState(false)
  const [morososFiltro, setMorososFiltro] = useState(null)

  // Gráfico de evolución
  const [evolucionData, setEvolucionData] = useState([])
  const [loadingEvolucion, setLoadingEvolucion] = useState(false)
  const [rangoFechas, setRangoFechas] = useState(() => {
    const hoy = new Date()
    const hace6Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
    return {
      desde: hace6Meses.toISOString().split('T')[0],
      hasta: hoy.toISOString().split('T')[0],
    }
  })

  // Filtros del gráfico
  const [filtroGrafico, setFiltroGrafico] = useState({
    categoria: '',
    actividadId: '',
    categoriaActividadId: '',
  })
  const [actividades, setActividades] = useState([])
  const [categoriasActividad, setCategoriasActividad] = useState([])

  useEffect(() => {
    cargarPeriodos()
    cargarActividades()
  }, [])

  useEffect(() => {
    cargarReporte()
  }, [periodoId])

  useEffect(() => {
    cargarEvolucion()
  }, [rangoFechas, filtroGrafico])

  // Cargar categorías cuando cambia la actividad seleccionada
  useEffect(() => {
    if (filtroGrafico.actividadId) {
      cargarCategoriasActividad(filtroGrafico.actividadId)
    } else {
      setCategoriasActividad([])
    }
  }, [filtroGrafico.actividadId])

  async function cargarPeriodos() {
    try {
      const data = await api.get('/admin/periodos')
      setPeriodos(data || [])
    } catch (err) {
      console.error('Error cargando periodos:', err)
    }
  }

  async function cargarActividades() {
    try {
      const data = await api.get('/admin/actividades')
      setActividades(data || [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  async function cargarCategoriasActividad(actividadId) {
    try {
      const data = await api.get(`/admin/actividades/${actividadId}`)
      setCategoriasActividad(data?.categorias || [])
    } catch (err) {
      console.error('Error cargando categorías:', err)
    }
  }

  async function cargarReporte() {
    setLoading(true)
    try {
      const params = periodoId ? `?periodoId=${periodoId}` : ''
      const data = await api.get(`/admin/reportes/cobranza${params}`)
      setReporte(data)
    } catch (err) {
      setError('Error al cargar reporte de cobranza')
    } finally {
      setLoading(false)
    }
  }

  async function cargarEvolucion() {
    setLoadingEvolucion(true)
    try {
      const params = new URLSearchParams()
      if (rangoFechas.desde) params.append('desde', rangoFechas.desde)
      if (rangoFechas.hasta) params.append('hasta', rangoFechas.hasta)
      if (filtroGrafico.categoria) params.append('categoria', filtroGrafico.categoria)
      if (filtroGrafico.actividadId) params.append('actividadId', filtroGrafico.actividadId)
      if (filtroGrafico.categoriaActividadId) params.append('categoriaActividadId', filtroGrafico.categoriaActividadId)

      const data = await api.get(`/admin/reportes/cobranza/evolucion?${params}`)
      setEvolucionData(data.evolucion || [])
    } catch (err) {
      console.error('Error cargando evolución:', err)
    } finally {
      setLoadingEvolucion(false)
    }
  }

  function handleCategoriaChange(categoria) {
    setFiltroGrafico({
      categoria,
      actividadId: '',
      categoriaActividadId: '',
    })
  }

  function handleActividadChange(actividadId) {
    setFiltroGrafico(prev => ({
      ...prev,
      actividadId,
      categoriaActividadId: '',
    }))
  }

  async function verMorosos(filtro) {
    setMorososFiltro(filtro)
    setLoadingMorosos(true)
    setShowMorosos(true)

    try {
      const params = new URLSearchParams()
      if (periodoId) params.append('periodoId', periodoId)
      if (filtro.categoria) params.append('categoria', filtro.categoria)
      if (filtro.actividadId) params.append('actividadId', filtro.actividadId)
      if (filtro.categoriaActividadId) params.append('categoriaActividadId', filtro.categoriaActividadId)

      const data = await api.get(`/admin/reportes/cobranza/morosos?${params}`)
      setMorososData(data)
    } catch (err) {
      console.error('Error cargando morosos:', err)
    } finally {
      setLoadingMorosos(false)
    }
  }

  function toggleCategory(cat) {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }))
  }

  function toggleActivity(actId) {
    setExpandedActivities(prev => ({
      ...prev,
      [actId]: !prev[actId]
    }))
  }

  const kpis = reporte?.kpis || {}

  // Formatear números para el tooltip del gráfico
  const formatCurrency = (value) => `$${value.toLocaleString('es-AR')}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/reportes')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Cobranza</h1>
            <p className="text-gray-500 text-sm">Análisis de cuotas, mora y recaudación</p>
          </div>
        </div>

        {/* Filtro de período */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Período:</label>
          <select
            value={periodoId}
            onChange={(e) => setPeriodoId(e.target.value)}
            className="input-field w-48"
          >
            <option value="">Todos los períodos</option>
            {periodos.filter(p => p.estado === 'GENERADO').map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Receipt className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Generado</p>
              <p className="text-lg font-bold text-gray-800">${(kpis.generado?.monto || 0).toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-400">{kpis.generado?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cobrado</p>
              <p className="text-lg font-bold text-green-600">${(kpis.cobrado?.monto || 0).toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-400">{kpis.cobrado?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <DollarSign className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className="text-lg font-bold text-yellow-600">${(kpis.pendiente?.monto || 0).toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-400">{kpis.pendiente?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Percent className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">% Morosidad</p>
              <p className="text-lg font-bold text-red-600">{kpis.porcentajeMorosidad || 0}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Días prom. pago</p>
              <p className="text-lg font-bold text-blue-600">{kpis.diasPromedioPago || 0} días</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Recargo acum.</p>
              <p className="text-lg font-bold text-orange-600">${(kpis.recargoPendiente || 0).toLocaleString('es-AR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla jerárquica */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Desglose por Categoría</h2>
          <p className="text-sm text-gray-500">Clic en una fila para ver los morosos de ese concepto</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Generado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">% Cobro</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Morosos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reporte?.categorias?.map(cat => (
                <>
                  {/* Fila de categoría principal */}
                  <tr
                    key={cat.categoria}
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => cat.actividades ? toggleCategory(cat.categoria) : verMorosos({ categoria: cat.categoria })}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {cat.actividades && (
                          expandedCategories[cat.categoria]
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-semibold text-gray-800">{cat.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-gray-800">${cat.generado.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400">{cat.cantGenerado} cuotas</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-green-600">${cat.cobrado.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400">{cat.cantCobrado} cuotas</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-yellow-600">${cat.pendiente.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400">{cat.cantPendiente} cuotas</p>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${cat.porcentajeCobro >= 70 ? 'bg-green-500' : cat.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${cat.porcentajeCobro}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-10">{cat.porcentajeCobro}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {cat.cantPendiente > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            verMorosos({ categoria: cat.categoria })
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                        >
                          <Users className="w-3 h-3" />
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Filas de actividades (si es ACTIVIDAD y está expandida) */}
                  {cat.actividades && expandedCategories[cat.categoria] && cat.actividades.map(act => (
                    <>
                      <tr
                        key={`act-${act.id}`}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => act.categorias?.length > 0 ? toggleActivity(act.id) : verMorosos({ categoria: 'CUOTA_ACTIVIDAD', actividadId: act.id })}
                      >
                        <td className="px-6 py-3 pl-12">
                          <div className="flex items-center gap-2">
                            {act.categorias?.length > 0 && (
                              expandedActivities[act.id]
                                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                : <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-700">{act.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-gray-700">${act.generado.toLocaleString('es-AR')}</p>
                          <p className="text-xs text-gray-400">{act.cantGenerado}</p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-green-600">${act.cobrado.toLocaleString('es-AR')}</p>
                          <p className="text-xs text-gray-400">{act.cantCobrado}</p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-yellow-600">${act.pendiente.toLocaleString('es-AR')}</p>
                          <p className="text-xs text-gray-400">{act.cantPendiente}</p>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${act.porcentajeCobro >= 70 ? 'bg-green-500' : act.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${act.porcentajeCobro}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-600 w-10">{act.porcentajeCobro}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {act.cantPendiente > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                verMorosos({ categoria: 'CUOTA_ACTIVIDAD', actividadId: act.id })
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                            >
                              <Users className="w-3 h-3" />
                              Ver
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Filas de categorías de actividad */}
                      {expandedActivities[act.id] && act.categorias?.map(catAct => (
                        <tr
                          key={`catact-${catAct.id}`}
                          className="hover:bg-gray-50 cursor-pointer bg-gray-50/50"
                          onClick={() => verMorosos({ categoria: 'CUOTA_ACTIVIDAD', categoriaActividadId: catAct.id })}
                        >
                          <td className="px-6 py-2 pl-20">
                            <span className="text-sm text-gray-600">{catAct.nombre}</span>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-gray-600">${catAct.generado.toLocaleString('es-AR')}</p>
                            <p className="text-xs text-gray-400">{catAct.cantGenerado}</p>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-green-600">${catAct.cobrado.toLocaleString('es-AR')}</p>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-yellow-600">${catAct.pendiente.toLocaleString('es-AR')}</p>
                          </td>
                          <td className="px-6 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${catAct.porcentajeCobro >= 70 ? 'bg-green-500' : catAct.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${catAct.porcentajeCobro}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-10">{catAct.porcentajeCobro}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-2 text-center">
                            {catAct.cantPendiente > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  verMorosos({ categoria: 'CUOTA_ACTIVIDAD', categoriaActividadId: catAct.id })
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                              >
                                <Users className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {(!reporte?.categorias || reporte.categorias.length === 0) && (
          <div className="p-8 text-center text-gray-500">
            No hay datos de cobranza para mostrar
          </div>
        )}
      </div>

      {/* Gráfico de Evolución */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Evolución de Cobranza</h2>
                <p className="text-sm text-gray-500">Comparativa generado vs cobrado por período</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Desde:</label>
                <input
                  type="date"
                  value={rangoFechas.desde}
                  onChange={(e) => setRangoFechas(prev => ({ ...prev, desde: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Hasta:</label>
                <input
                  type="date"
                  value={rangoFechas.hasta}
                  onChange={(e) => setRangoFechas(prev => ({ ...prev, hasta: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>

          {/* Filtros en cascada */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Tipo:</label>
              <select
                value={filtroGrafico.categoria}
                onChange={(e) => handleCategoriaChange(e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Todos</option>
                <option value="CUOTA_SOCIAL">Cuota Social</option>
                <option value="CUOTA_ACTIVIDAD">Actividades</option>
                <option value="INSCRIPCION">Inscripciones</option>
                <option value="FINANCIACION">Financiación</option>
              </select>
            </div>

            {filtroGrafico.categoria === 'CUOTA_ACTIVIDAD' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Actividad:</label>
                <select
                  value={filtroGrafico.actividadId}
                  onChange={(e) => handleActividadChange(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Todas</option>
                  {actividades.map(act => (
                    <option key={act.id} value={act.id}>{act.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {filtroGrafico.actividadId && categoriasActividad.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Categoría:</label>
                <select
                  value={filtroGrafico.categoriaActividadId}
                  onChange={(e) => setFiltroGrafico(prev => ({ ...prev, categoriaActividadId: e.target.value }))}
                  className="input-field text-sm"
                >
                  <option value="">Todas</option>
                  {categoriasActividad.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {(filtroGrafico.categoria || filtroGrafico.actividadId || filtroGrafico.categoriaActividadId) && (
              <button
                onClick={() => setFiltroGrafico({ categoria: '', actividadId: '', categoriaActividadId: '' })}
                className="text-sm text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {loadingEvolucion ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : evolucionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={evolucionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name === 'generado' ? 'Generado' : 'Cobrado']}
                  labelStyle={{ fontWeight: 'bold' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend
                  formatter={(value) => value === 'generado' ? 'Generado' : 'Cobrado'}
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                <Line type="monotone" dataKey="generado" stroke="#6b7280" strokeWidth={2} dot={{ r: 4 }} name="generado" />
                <Line type="monotone" dataKey="cobrado" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="cobrado" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 text-gray-300" />
              <p>No hay datos para el rango seleccionado</p>
            </div>
          )}
        </div>

        {/* Resumen del gráfico */}
        {evolucionData.length > 0 && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Generado</p>
                <p className="text-lg font-bold text-gray-700">
                  ${evolucionData.reduce((sum, d) => sum + d.generado, 0).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Cobrado</p>
                <p className="text-lg font-bold text-green-600">
                  ${evolucionData.reduce((sum, d) => sum + d.cobrado, 0).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Promedio Mensual</p>
                <p className="text-lg font-bold text-blue-600">
                  ${Math.round(evolucionData.reduce((sum, d) => sum + d.cobrado, 0) / evolucionData.length).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">% Cobro Promedio</p>
                <p className="text-lg font-bold text-yellow-600">
                  {Math.round(evolucionData.reduce((sum, d) => sum + d.porcentajeCobro, 0) / evolucionData.length)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Morosos */}
      {showMorosos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Socios con deuda pendiente</h3>
                {morososFiltro && (
                  <p className="text-sm text-gray-500">
                    {morososFiltro.categoria && `Categoría: ${morososFiltro.categoria}`}
                    {morososFiltro.actividadId && ` • Actividad ID: ${morososFiltro.actividadId}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowMorosos(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingMorosos ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : morososData?.morosos?.length > 0 ? (
                <>
                  {/* Totales */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Socios</p>
                      <p className="text-lg font-bold text-gray-800">{morososData.totales.cantSocios}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Cuotas</p>
                      <p className="text-lg font-bold text-gray-800">{morososData.totales.cantCuotas}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Deuda total</p>
                      <p className="text-lg font-bold text-yellow-600">${morososData.totales.totalDeuda.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Recargo acum.</p>
                      <p className="text-lg font-bold text-orange-600">${morososData.totales.totalRecargo.toLocaleString('es-AR')}</p>
                    </div>
                  </div>

                  {/* Lista de morosos */}
                  <div className="space-y-2">
                    {morososData.morosos.map(m => (
                      <div
                        key={m.socio.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/cuotas?socioId=${m.socio.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">
                              {m.socio.apellidoNombre}
                              <span className="ml-2 text-sm text-gray-400">#{m.socio.nroSocio}</span>
                            </p>
                            <p className="text-sm text-gray-500">
                              {m.cantCuotas} cuota{m.cantCuotas !== 1 ? 's' : ''} pendiente{m.cantCuotas !== 1 ? 's' : ''}
                              {m.maxDiasAtraso > 0 && (
                                <span className="ml-2 text-red-500">
                                  • {m.maxDiasAtraso} días de atraso máx.
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-yellow-600">${m.totalDeuda.toLocaleString('es-AR')}</p>
                            {m.totalRecargo > 0 && (
                              <p className="text-xs text-orange-500">+${m.totalRecargo.toLocaleString('es-AR')} recargo</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No hay socios con deuda pendiente para este filtro
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowMorosos(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
