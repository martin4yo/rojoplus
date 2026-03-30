import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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
function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', size = 'normal', onClick }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
    gray: 'bg-gray-100',
  }

  const textClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
    purple: 'text-purple-700',
    gray: 'text-gray-700',
  }

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses[color]} transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className={`w-5 h-5 ${textClasses[color]}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className={`${size === 'large' ? 'text-2xl' : 'text-xl'} font-bold ${textClasses[color]} mt-1`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

// Progress Bar
function ProgressBar({ value, max, color = 'green', showLabel = true }) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }

  return (
    <div className="w-full">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-500 mt-1 text-right">{percentage}%</p>
      )}
    </div>
  )
}

// Alert Card
function AlertCard({ tipo, titulo, mensaje, accion }) {
  const config = {
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', icon: AlertTriangle, iconColor: 'text-yellow-600' },
    danger: { bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle, iconColor: 'text-red-600' },
    success: { bg: 'bg-green-50', border: 'border-green-300', icon: CheckCircle2, iconColor: 'text-green-600' },
  }

  const { bg, border, icon: Icon, iconColor } = config[tipo] || config.warning

  return (
    <Link to={accion} className={`block p-4 rounded-lg border ${bg} ${border} hover:shadow-md transition-all`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">{titulo}</p>
          <p className="text-sm text-gray-600 mt-1">{mensaje}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </Link>
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
            {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function DashboardEjecutivo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/admin/dashboard/ejecutivo')
      setData(response.data)
    } catch (err) {
      setError('Error al cargar el dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner />
          <p className="text-gray-600">Cargando dashboard...</p>
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

  if (!data) return null

  const { socios, financiero, actividades, graficos, alertas } = data

  const tabs = [
    { id: 'general', label: 'General', icon: BarChart3 },
    { id: 'socios', label: 'Socios', icon: Users },
    { id: 'financiero', label: 'Financiero', icon: DollarSign },
    { id: 'actividades', label: 'Actividades', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-gray-500 text-sm mt-1">
            Resumen ejecutivo del Club Sportivo Pilar
            {data.periodoActual && ` - Período ${data.periodoActual.nombre}`}
          </p>
        </div>
        <button
          onClick={cargarDatos}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Alertas */}
      {alertas && alertas.length > 0 && activeTab === 'general' && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Alertas</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {alertas.map((alerta, idx) => (
              <AlertCard key={idx} {...alerta} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* KPIs Principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Socios Activos"
              value={formatNumber(socios.activos)}
              icon={Users}
              color="blue"
              trend={socios.tendenciaNuevos > 0 ? 'up' : socios.tendenciaNuevos < 0 ? 'down' : undefined}
              trendValue={socios.tendenciaNuevos !== 0 ? `${Math.abs(socios.tendenciaNuevos)}%` : undefined}
            />
            <KPICard
              title="Cobranza Mes"
              value={`${financiero.cobranzaMes.porcentaje}%`}
              subtitle={formatCurrency(financiero.cobranzaMes.cobrado)}
              icon={Target}
              color={financiero.cobranzaMes.porcentaje >= 70 ? 'green' : financiero.cobranzaMes.porcentaje >= 50 ? 'yellow' : 'red'}
            />
            <KPICard
              title="Morosidad"
              value={formatCurrency(financiero.morosidadTotal.monto)}
              subtitle={`${financiero.morosidadTotal.cantSocios} socios`}
              icon={AlertTriangle}
              color="red"
            />
            <KPICard
              title="Inscripciones"
              value={formatNumber(actividades.inscripcionesActivas)}
              icon={Activity}
              color="purple"
              trend={actividades.tendenciaInscripciones > 0 ? 'up' : actividades.tendenciaInscripciones < 0 ? 'down' : undefined}
              trendValue={actividades.tendenciaInscripciones !== 0 ? `${Math.abs(actividades.tendenciaInscripciones)}%` : undefined}
            />
          </div>

          {/* Gráficos */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Evolución de Cobranza */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Evolución de Cobranza</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={graficos.evolucionCobranza}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="cobrado" name="Cobrado" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendiente" name="Pendiente" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Crecimiento de Socios */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Movimiento de Socios</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={graficos.crecimientoSocios}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="altas" name="Altas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bajas" name="Bajas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Resumen Financiero del Mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Saldo en Cajas</p>
                <p className="text-xl font-bold text-gray-800">{formatCurrency(financiero.resumenFinanciero.saldoCajas)}</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500">Ingresos Mes</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(financiero.resumenFinanciero.ingresosMes)}</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-500">Egresos Mes</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(financiero.resumenFinanciero.egresosMes)}</p>
              </div>
              <div className={`text-center p-4 rounded-lg ${financiero.resumenFinanciero.cashFlowMes >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className="text-sm text-gray-500">Cash Flow</p>
                <p className={`text-xl font-bold ${financiero.resumenFinanciero.cashFlowMes >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(financiero.resumenFinanciero.cashFlowMes)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Socios */}
      {activeTab === 'socios' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Socios Activos"
              value={formatNumber(socios.activos)}
              icon={Users}
              color="blue"
              size="large"
            />
            <KPICard
              title="Nuevos (30 días)"
              value={formatNumber(socios.nuevos30Dias)}
              icon={UserPlus}
              color="green"
              trend={socios.tendenciaNuevos > 0 ? 'up' : socios.tendenciaNuevos < 0 ? 'down' : undefined}
              trendValue={`${Math.abs(socios.tendenciaNuevos)}% vs anterior`}
            />
            <KPICard
              title="Bajas (30 días)"
              value={formatNumber(socios.bajas30Dias)}
              icon={UserMinus}
              color="red"
            />
            <KPICard
              title="Retención"
              value={`${socios.tasaRetencion}%`}
              icon={Target}
              color={socios.tasaRetencion >= 95 ? 'green' : socios.tasaRetencion >= 90 ? 'yellow' : 'red'}
            />
          </div>

          {/* Gráfico de crecimiento */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Evolución de Socios (6 meses)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={graficos.crecimientoSocios}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="altas" name="Altas" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="bajas" name="Bajas" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="neto" name="Neto" stroke="#3B82F6" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Link a gestión de socios */}
          <div className="flex justify-end">
            <Link
              to="/admin/socios"
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              Ver todos los socios
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab: Financiero */}
      {activeTab === 'financiero' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Generado Mes"
              value={formatCurrency(financiero.cobranzaMes.generado)}
              subtitle={`${financiero.cobranzaMes.cantCobrado + financiero.cobranzaMes.cantPendiente} cuotas`}
              icon={DollarSign}
              color="blue"
            />
            <KPICard
              title="Cobrado"
              value={formatCurrency(financiero.cobranzaMes.cobrado)}
              subtitle={`${financiero.cobranzaMes.cantCobrado} cuotas`}
              icon={CheckCircle2}
              color="green"
            />
            <KPICard
              title="Pendiente"
              value={formatCurrency(financiero.cobranzaMes.pendiente)}
              subtitle={`${financiero.cobranzaMes.cantPendiente} cuotas`}
              icon={AlertTriangle}
              color="yellow"
            />
            <KPICard
              title="% Cobranza"
              value={`${financiero.cobranzaMes.porcentaje}%`}
              icon={Target}
              color={financiero.cobranzaMes.porcentaje >= 70 ? 'green' : financiero.cobranzaMes.porcentaje >= 50 ? 'yellow' : 'red'}
              size="large"
            />
          </div>

          {/* Barra de progreso cobranza */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-800">Progreso de Cobranza del Período</h3>
              <span className="text-sm text-gray-500">
                {formatCurrency(financiero.cobranzaMes.cobrado)} de {formatCurrency(financiero.cobranzaMes.generado)}
              </span>
            </div>
            <ProgressBar
              value={financiero.cobranzaMes.cobrado}
              max={financiero.cobranzaMes.generado}
              color={financiero.cobranzaMes.porcentaje >= 70 ? 'green' : financiero.cobranzaMes.porcentaje >= 50 ? 'yellow' : 'red'}
            />
          </div>

          {/* Morosidad */}
          <div className="bg-red-50 rounded-xl border border-red-200 p-6">
            <h3 className="font-semibold text-red-800 mb-4">Morosidad Acumulada</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-red-700">{formatCurrency(financiero.morosidadTotal.monto)}</p>
                <p className="text-sm text-red-600 mt-1">Monto Total</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-700">{financiero.morosidadTotal.cantSocios}</p>
                <p className="text-sm text-red-600 mt-1">Socios Morosos</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-red-700">{financiero.morosidadTotal.cantCuotas}</p>
                <p className="text-sm text-red-600 mt-1">Cuotas Vencidas</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                to="/admin/reportes/morosidad"
                className="flex items-center gap-2 text-red-700 hover:text-red-800 font-medium"
              >
                Ver reporte de morosidad
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Gráfico evolución */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Evolución de Cobranza</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={graficos.evolucionCobranza}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="cobrado" name="Cobrado" stackId="a" fill="#10B981" />
                <Bar dataKey="pendiente" name="Pendiente" stackId="a" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Actividades */}
      {activeTab === 'actividades' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard
              title="Inscripciones Activas"
              value={formatNumber(actividades.inscripcionesActivas)}
              icon={Activity}
              color="purple"
              size="large"
            />
            <KPICard
              title="Tendencia"
              value={`${actividades.tendenciaInscripciones >= 0 ? '+' : ''}${actividades.tendenciaInscripciones}%`}
              subtitle="vs 30 días anteriores"
              icon={actividades.tendenciaInscripciones >= 0 ? TrendingUp : TrendingDown}
              color={actividades.tendenciaInscripciones >= 0 ? 'green' : 'red'}
            />
            <KPICard
              title="Actividades"
              value={actividades.top5Actividades.length}
              subtitle="con inscriptos"
              icon={PieChartIcon}
              color="blue"
            />
          </div>

          {/* Top 5 Actividades */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Top 5 Actividades más Populares</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={actividades.top5Actividades}
                      dataKey="cantidad"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      label={({ nombre, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {actividades.top5Actividades.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {actividades.top5Actividades.map((act, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-700 truncate max-w-[200px]">{act.nombre}</span>
                    </div>
                    <span className="font-bold text-gray-900">{act.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ocupación por Actividad */}
          {actividades.ocupacionActividades && actividades.ocupacionActividades.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Ocupación de Actividades (&gt; 50%)</h3>
              <div className="space-y-4">
                {actividades.ocupacionActividades.map((act, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[300px]">{act.nombre}</span>
                      <span className="text-sm text-gray-500">{act.inscriptos} / {act.cupo}</span>
                    </div>
                    <ProgressBar
                      value={act.inscriptos}
                      max={act.cupo}
                      color={act.ocupacion >= 90 ? 'red' : act.ocupacion >= 70 ? 'yellow' : 'green'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link a actividades */}
          <div className="flex justify-end">
            <Link
              to="/admin/reportes/actividades"
              className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              Ver reporte de actividades
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
