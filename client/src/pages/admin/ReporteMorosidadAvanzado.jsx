import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  X,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'

const api = {
  get: async (url) => {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`/api${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Error en la petición')
    return res.json()
  },
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value)
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  }

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
  }

  const textClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
    purple: 'text-purple-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className={`w-5 h-5 ${textClasses[color]}`} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className={`text-xl font-bold ${textClasses[color]} mt-1`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 ? formatCurrency(entry.value) : formatNumber(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']

export default function ReporteMorosidadAvanzado() {
  const [activeTab, setActiveTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Datos
  const [kpis, setKpis] = useState(null)
  const [antiguedad, setAntiguedad] = useState(null)
  const [proyeccion, setProyeccion] = useState(null)
  const [morosos, setMorosos] = useState(null)

  // Filtro global de rango de períodos
  const [periodos, setPeriodos] = useState([])
  const [periodoIdDesde, setPeriodoIdDesde] = useState('')
  const [periodoIdHasta, setPeriodoIdHasta] = useState('')

  // Filtros
  const [filtros, setFiltros] = useState({
    categoria: '',
    actividadId: '',
    diasMinimo: '',
    diasMaximo: '',
    ordenarPor: 'deuda',
    orden: 'desc',
  })
  const [actividades, setActividades] = useState([])
  const [showFiltros, setShowFiltros] = useState(false)
  const [page, setPage] = useState(1)

  // Expansión de detalle de socio
  const [expandedSocio, setExpandedSocio] = useState(null)

  // Resuelve el rango (desde, hasta) a la lista de IDs de períodos
  const resolverPeriodoIds = () => {
    if (!periodoIdDesde || !periodoIdHasta) return []
    const desde = periodos.find(p => p.id.toString() === periodoIdDesde)
    const hasta = periodos.find(p => p.id.toString() === periodoIdHasta)
    if (!desde || !hasta) return []
    const k = (p) => p.anio * 100 + p.mes
    const min = Math.min(k(desde), k(hasta))
    const max = Math.max(k(desde), k(hasta))
    return periodos.filter(p => k(p) >= min && k(p) <= max).map(p => p.id)
  }

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)

      const ids = resolverPeriodoIds()
      const qs = ids.length > 0 ? `?periodoIds=${ids.join(',')}` : ''

      const [kpisRes, antiguedadRes, proyeccionRes, actividadesRes] = await Promise.all([
        api.get(`/admin/reportes/morosidad/resumen-kpis${qs}`),
        api.get(`/admin/reportes/morosidad/antiguedad${qs}`),
        api.get(`/admin/reportes/morosidad/proyeccion${qs}`),
        api.get('/admin/actividades'),
      ])

      setKpis(kpisRes.data)
      setAntiguedad(antiguedadRes.data)
      setProyeccion(proyeccionRes.data)
      setActividades(actividadesRes.data || [])
    } catch (err) {
      setError('Error al cargar datos de morosidad')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const cargarPeriodos = async () => {
    try {
      const data = await api.get('/admin/periodos')
      const ordenados = [...(data || [])].sort((a, b) => {
        if (a.anio !== b.anio) return b.anio - a.anio
        return b.mes - a.mes
      })
      setPeriodos(ordenados)
      const hoy = new Date()
      const actual = ordenados.find(p => p.mes === hoy.getMonth() + 1 && p.anio === hoy.getFullYear())
      const elegido = actual || ordenados[0]
      if (elegido) {
        setPeriodoIdDesde(elegido.id.toString())
        setPeriodoIdHasta(elegido.id.toString())
      }
    } catch (err) {
      console.error('Error cargando periodos:', err)
    }
  }

  const cargarMorosos = async () => {
    try {
      const params = new URLSearchParams()
      const ids = resolverPeriodoIds()
      if (ids.length > 0) params.append('periodoIds', ids.join(','))
      if (filtros.categoria) params.append('categoria', filtros.categoria)
      if (filtros.actividadId) params.append('actividadId', filtros.actividadId)
      if (filtros.diasMinimo) params.append('diasMinimo', filtros.diasMinimo)
      if (filtros.diasMaximo) params.append('diasMaximo', filtros.diasMaximo)
      params.append('ordenarPor', filtros.ordenarPor)
      params.append('orden', filtros.orden)
      params.append('page', page)
      params.append('limit', 20)

      const res = await api.get(`/admin/reportes/morosidad/detalle?${params}`)
      setMorosos(res.data)
    } catch (err) {
      console.error('Error al cargar morosos:', err)
    }
  }

  useEffect(() => {
    cargarPeriodos()
  }, [])

  useEffect(() => {
    // Cargar datos solo cuando ya hay rango definido (o si el usuario lo limpió)
    if (periodos.length > 0) cargarDatos()
  }, [periodoIdDesde, periodoIdHasta, periodos.length])

  useEffect(() => {
    if (activeTab === 'detalle' && periodos.length > 0) {
      cargarMorosos()
    }
  }, [activeTab, filtros, page, periodoIdDesde, periodoIdHasta, periodos.length])

  const exportarExcel = async () => {
    try {
      const params = new URLSearchParams()
      const ids = resolverPeriodoIds()
      if (ids.length > 0) params.append('periodoIds', ids.join(','))
      if (filtros.categoria) params.append('categoria', filtros.categoria)
      if (filtros.actividadId) params.append('actividadId', filtros.actividadId)
      if (filtros.diasMinimo) params.append('diasMinimo', filtros.diasMinimo)

      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      const hostname = window.location.hostname
      const match = hostname.match(/^([^.]+)\.localhost/)
      if (match) headers['X-Tenant-Slug'] = match[1]

      const response = await fetch(`/api/admin/reportes/morosidad/exportar?${params}`, { headers })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `morosidad_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner />
          <p className="text-gray-600">Cargando reporte de morosidad...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={cargarDatos}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'antiguedad', label: 'Antigüedad' },
    { id: 'proyeccion', label: 'Proyección' },
    { id: 'detalle', label: 'Detalle' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Morosidad</h1>
          <p className="text-gray-500 text-sm mt-1">
            Análisis detallado de deudas y proyección de recargos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600">Desde:</label>
          <select
            value={periodoIdDesde}
            onChange={(e) => setPeriodoIdDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
          >
            <option value="">Todos</option>
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <label className="text-sm text-gray-600">Hasta:</label>
          <select
            value={periodoIdHasta}
            onChange={(e) => setPeriodoIdHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
          >
            <option value="">Todos</option>
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'resumen' && kpis && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Socios Morosos"
              value={formatNumber(kpis.totalMorosos)}
              subtitle={`${kpis.porcentajeMorosidad}% del total`}
              icon={Users}
              color="red"
            />
            <KPICard
              title="Deuda Total"
              value={formatCurrency(kpis.totalDeuda)}
              subtitle={`${kpis.totalCuotasVencidas} cuotas vencidas`}
              icon={DollarSign}
              color="red"
            />
            <KPICard
              title="Recargos Acumulados"
              value={formatCurrency(kpis.totalRecargos)}
              icon={TrendingUp}
              color="yellow"
            />
            <KPICard
              title="Días Promedio Atraso"
              value={`${kpis.promedioAtraso} días`}
              subtitle={`Promedio: ${formatCurrency(kpis.promedioDeuda)}`}
              icon={Clock}
              color="purple"
            />
          </div>

          {/* Total con recargos */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">DEUDA TOTAL CON RECARGOS</p>
                <p className="text-3xl font-bold text-red-700 mt-1">
                  {formatCurrency(kpis.totalConRecargos)}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </div>

          {/* Gráfico de antigüedad */}
          {antiguedad && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Distribución por Antigüedad</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={antiguedad.antiguedad.filter(a => a.montoTotal > 0)}
                      dataKey="montoTotal"
                      nameKey="rango"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      label={({ rango, porcentaje }) => `${porcentaje}%`}
                    >
                      {antiguedad.antiguedad.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {antiguedad.antiguedad.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                        <span className="text-sm font-medium text-gray-700">{item.rango}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(item.montoTotal)}</p>
                        <p className="text-xs text-gray-500">{item.cantSocios} socios</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Antigüedad */}
      {activeTab === 'antiguedad' && antiguedad && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Análisis de Antigüedad de Deuda</h3>
              <p className="text-sm text-gray-500 mt-1">
                Distribución de la deuda según días de atraso
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rango</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cuotas</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Socios</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recargo Est.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {antiguedad.antiguedad.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                          <span className="font-medium text-gray-900">{item.rango}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">{formatNumber(item.cantCuotas)}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{formatNumber(item.cantSocios)}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{formatCurrency(item.montoTotal)}</td>
                      <td className="px-6 py-4 text-right text-yellow-600">{formatCurrency(item.recargoEstimado)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(item.montoConRecargo)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.porcentaje > 30 ? 'bg-red-100 text-red-700' :
                          item.porcentaje > 15 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.porcentaje}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td className="px-6 py-4">TOTALES</td>
                    <td className="px-6 py-4 text-right">{formatNumber(antiguedad.totales.cantCuotas)}</td>
                    <td className="px-6 py-4 text-right">{formatNumber(antiguedad.totales.cantSocios)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(antiguedad.totales.montoTotal)}</td>
                    <td className="px-6 py-4 text-right text-yellow-600">{formatCurrency(antiguedad.totales.recargoEstimado)}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(antiguedad.totales.montoTotal + antiguedad.totales.recargoEstimado)}</td>
                    <td className="px-6 py-4 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Gráfico de barras */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Deuda por Antigüedad</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={antiguedad.antiguedad}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="montoTotal" name="Deuda" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recargoEstimado" name="Recargo" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Proyección */}
      {activeTab === 'proyeccion' && proyeccion && (
        <div className="space-y-6">
          {/* Configuración actual */}
          {proyeccion.configuracion && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-800 mb-2">Configuración de Recargos Activa</h3>
              <div className="flex flex-wrap gap-4 text-sm text-blue-700">
                <span>Tipo: <strong>{proyeccion.configuracion.tipo}</strong></span>
                <span>Porcentaje: <strong>{proyeccion.configuracion.porcentaje}%</strong></span>
                {proyeccion.configuracion.tipo === 'ACUMULATIVO' && (
                  <span>Cada: <strong>{proyeccion.configuracion.cadaDias} días</strong></span>
                )}
                {proyeccion.configuracion.topeMaximo && (
                  <span>Tope: <strong>{proyeccion.configuracion.topeMaximo}%</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Tabla de proyección */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Proyección de Recargos</h3>
              <p className="text-sm text-gray-500 mt-1">
                Estimación del crecimiento de la deuda por recargos
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cuotas Vencidas</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deuda Base</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recargo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Incremento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {proyeccion.proyecciones.map((item, idx) => {
                    const incremento = idx > 0
                      ? item.totalConRecargo - proyeccion.proyecciones[0].totalConRecargo
                      : 0
                    return (
                      <tr key={idx} className={idx === 0 ? 'bg-green-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 font-medium text-gray-900">{item.label}</td>
                        <td className="px-6 py-4 text-right text-gray-700">{formatNumber(item.cuotasVencidas)}</td>
                        <td className="px-6 py-4 text-right text-gray-700">{formatCurrency(item.totalDeuda)}</td>
                        <td className="px-6 py-4 text-right text-yellow-600">{formatCurrency(item.totalRecargo)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(item.totalConRecargo)}</td>
                        <td className="px-6 py-4 text-right">
                          {incremento > 0 && (
                            <span className="text-red-600 flex items-center justify-end gap-1">
                              <ArrowUpRight className="w-4 h-4" />
                              +{formatCurrency(incremento)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico de proyección */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Evolución Proyectada</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={proyeccion.proyecciones}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="totalDeuda" name="Deuda Base" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="totalRecargo" name="Recargo" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="totalConRecargo" name="Total" stroke="#EF4444" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Detalle */}
      {activeTab === 'detalle' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-700">Filtros</span>
              </div>
              {showFiltros ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showFiltros && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Categoría</label>
                  <select
                    value={filtros.categoria}
                    onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    <option value="CUOTA_SOCIAL">Cuota Social</option>
                    <option value="CUOTA_ACTIVIDAD">Cuota Actividad</option>
                    <option value="CARNET">Carnet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Actividad</label>
                  <select
                    value={filtros.actividadId}
                    onChange={e => setFiltros({ ...filtros, actividadId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    {actividades.map(act => (
                      <option key={act.id} value={act.id}>{act.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Días mínimo</label>
                  <input
                    type="number"
                    value={filtros.diasMinimo}
                    onChange={e => setFiltros({ ...filtros, diasMinimo: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Ordenar por</label>
                  <select
                    value={filtros.ordenarPor}
                    onChange={e => setFiltros({ ...filtros, ordenarPor: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="deuda">Mayor deuda</option>
                    <option value="dias">Más días atraso</option>
                    <option value="nombre">Nombre</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Lista de morosos */}
          {morosos && (
            <>
              <div className="text-sm text-gray-500">
                Mostrando {morosos.morosos.length} de {morosos.pagination.total} socios morosos
              </div>

              <div className="space-y-3">
                {morosos.morosos.map(item => (
                  <div key={item.socio.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedSocio(expandedSocio === item.socio.id ? null : item.socio.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-700 font-bold text-sm">
                              {item.socio.apellidoNombre?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.socio.apellidoNombre}</p>
                            <p className="text-sm text-gray-500">#{item.socio.nroSocio}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatCurrency(item.totalDeuda + item.totalRecargo)}</p>
                          <p className="text-xs text-gray-500">
                            {item.cantCuotas} cuotas · {item.maxDiasAtraso} días máx
                          </p>
                        </div>
                      </div>
                    </div>

                    {expandedSocio === item.socio.id && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        {/* Contacto */}
                        <div className="flex flex-wrap gap-4 mb-4 text-sm">
                          {item.socio.celular && (
                            <a href={`tel:${item.socio.celular}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Phone className="w-4 h-4" />
                              {item.socio.celular}
                            </a>
                          )}
                          {item.socio.email && (
                            <a href={`mailto:${item.socio.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Mail className="w-4 h-4" />
                              {item.socio.email}
                            </a>
                          )}
                        </div>

                        {/* Cuotas */}
                        <div className="space-y-2">
                          {item.cuotas.map(cuota => (
                            <div key={cuota.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                              <div>
                                <p className="font-medium text-gray-800">{cuota.concepto}</p>
                                <p className="text-xs text-gray-500">{cuota.periodo}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(cuota.monto + cuota.recargo)}</p>
                                <p className="text-xs text-red-500">{cuota.diasAtraso} días atraso</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Link a ficha */}
                        <div className="mt-4 flex justify-end">
                          <Link
                            to={`/admin/socios/${item.socio.id}`}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Ver ficha del socio →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {morosos.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Página {page} de {morosos.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(morosos.pagination.totalPages, p + 1))}
                    disabled={page === morosos.pagination.totalPages}
                    className="px-3 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
