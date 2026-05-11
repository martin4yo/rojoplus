import { useState, useEffect, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'

const ReporteCentrosCosto = lazy(() => import('./ReporteCentrosCosto'))
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  Users,
  UserPlus,
  UserMinus,
  UserX,
  Dumbbell,
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
  Banknote,
  CreditCard,
  Building2,
  Briefcase,
  Clock,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  HeartPulse,
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
  AreaChart,
  Area,
} from 'recharts'
import api from '../../services/api'
import Switch from '../../components/Switch'

const LS_CAJAS_EXCLUIDAS = 'dashboard.tesoreria.cajasExcluidas'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const COLORS_INGRESOS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5']
const COLORS_EGRESOS = ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2']

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyCompact(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1).replace('.', ',')} B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} M`
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)} K`
  return formatCurrency(n)
}

function CurrencyResponsive({ value, className = '' }) {
  return (
    <>
      <span className={`sm:hidden whitespace-nowrap ${className}`}>{formatCurrencyCompact(value)}</span>
      <span className={`hidden sm:inline whitespace-nowrap ${className}`}>{formatCurrency(value)}</span>
    </>
  )
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value)
}

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
    blue: 'bg-blue-100', green: 'bg-green-100', red: 'bg-red-100',
    yellow: 'bg-yellow-100', purple: 'bg-purple-100', gray: 'bg-gray-100',
  }
  const textClasses = {
    blue: 'text-blue-700', green: 'text-green-700', red: 'text-red-700',
    yellow: 'text-yellow-700', purple: 'text-purple-700', gray: 'text-gray-700',
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
      <div className="mt-3 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{title}</p>
        <p className={`${size === 'large' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-bold ${textClasses[color]} mt-1 whitespace-nowrap overflow-hidden text-ellipsis`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color = 'green', showLabel = true }) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const colorClasses = {
    green: 'bg-green-500', blue: 'bg-blue-500', yellow: 'bg-yellow-500', red: 'bg-red-500',
  }
  return (
    <div className="w-full">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <p className="text-xs text-gray-500 mt-1 text-right">{percentage}%</p>}
    </div>
  )
}

function StatusIndicator({ status, label }) {
  const statusConfig = {
    good: { color: 'bg-green-500', text: 'text-green-200' },
    warning: { color: 'bg-yellow-500', text: 'text-yellow-200' },
    danger: { color: 'bg-red-500', text: 'text-red-200' },
  }
  const config = statusConfig[status]
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color} animate-pulse`} />
      <span className={`text-sm font-medium ${config.text}`}>{label}</span>
    </div>
  )
}

function AlertCard({ tipo, titulo, mensaje, accion }) {
  const styles = {
    danger: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const iconStyles = {
    danger: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  }
  return (
    <Link
      to={accion || '#'}
      className={`block rounded-xl border p-4 ${styles[tipo] || styles.info} hover:shadow-md transition-all`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[tipo] || iconStyles.info}`} />
        <div className="flex-1">
          <p className="font-semibold text-sm">{titulo}</p>
          <p className="text-xs mt-1 opacity-90">{mensaje}</p>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1 opacity-50" />
      </div>
    </Link>
  )
}

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

export default function DashboardEjecutivo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('general')
  const [cajasExcluidas, setCajasExcluidas] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CAJAS_EXCLUIDAS)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  })

  const toggleCajaExcluida = (id) => {
    setCajasExcluidas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(LS_CAJAS_EXCLUIDAS, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/admin/dashboard/ejecutivo')
      setData(response)
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
        <LoadingSpinner />
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

  const { socios, financiero, actividades, tesoreria = {}, graficos, alertas, comerciosPendientes = 0 } = data
  const cajas = tesoreria.cajas || []
  const saldoTotalCajas = tesoreria.saldoTotalCajas || 0
  const tarjetasPendientes = tesoreria.tarjetasPendientes || { cantidad: 0, montoTotal: 0, detalle: [] }
  const echeqsRecibidos = tesoreria.echeqsRecibidos || { cantidad: 0, montoTotal: 0, enCartera: 0, montoEnCartera: 0, depositados: 0, montoDepositados: 0, vencidos: 0, proximosAVencer: 0 }
  const echeqsEmitidos = tesoreria.echeqsEmitidos || { cantidad: 0, montoTotal: 0, vencidos: 0, proximosAVencer: 0 }
  const ingresosComposicion = graficos.ingresosComposicion || []
  const egresosComposicion = graficos.egresosComposicion || []
  const cashFlowMensualRaw = graficos.cashFlowMensual || []
  const cashFlowPorCajaMes = graficos.cashFlowPorCajaMes || {}

  const cajasEfectivo = cajas.filter(c => c.tipo === 'EFECTIVO')
  const cajasBanco = cajas.filter(c => c.tipo === 'BANCO')
  const totalEfectivo = cajasEfectivo.filter(c => !cajasExcluidas.has(c.id)).reduce((s, c) => s + Number(c.saldoActual), 0)
  const totalBancos = cajasBanco.filter(c => !cajasExcluidas.has(c.id)).reduce((s, c) => s + Number(c.saldoActual), 0)
  const cajasNegativas = cajas.filter(c => Number(c.saldoActual) < 0)

  // CashFlow filtrado por cajas excluidas (client-side, sin refetch).
  // Recalcula ingresos/egresos/neto de cada mes sumando sólo las cajas activas,
  // y reconstruye el saldo acumulado tomando como ancla el saldo actual filtrado.
  const cashFlowMensual = (() => {
    if (cajasExcluidas.size === 0 || cashFlowMensualRaw.length === 0) return cashFlowMensualRaw
    const cajasIncluidas = cajas.filter(c => !cajasExcluidas.has(c.id)).map(c => c.id)
    const saldoActualFiltrado = totalEfectivo + totalBancos
    const series = cashFlowMensualRaw.map(p => {
      const byCaja = cashFlowPorCajaMes[p.mes] || {}
      let ingresos = 0, egresos = 0
      for (const cid of cajasIncluidas) {
        const v = byCaja[cid]
        if (v) { ingresos += v.ingresos; egresos += v.egresos }
      }
      return { mes: p.mes, ingresos: Math.round(ingresos), egresos: Math.round(egresos), neto: Math.round(ingresos - egresos) }
    })
    // Saldo acumulado: ancla = saldoActualFiltrado; arrastre = saldoActual - sum(netos 6m)
    const netoTotal = series.reduce((s, p) => s + p.neto, 0)
    let saldo = saldoActualFiltrado - netoTotal
    return series.map(p => { saldo += p.neto; return { ...p, saldo: Math.round(saldo) } })
  })()

  const totalPorCobrar = (financiero.saldoClientes || 0) + (financiero.cobranzaMes.pendiente || 0)
  const totalPorPagar = (financiero.saldoProveedores || 0) + (financiero.sueldosPorPagar || 0)
  const balanceNeto = totalPorCobrar - totalPorPagar

  const saludLabel = {
    good: 'Saludable',
    warning: 'Atención',
    danger: 'Crítico',
  }[financiero.saludFinanciera] || '—'

  const tabs = [
    { id: 'general', label: 'General', icon: BarChart3 },
    { id: 'socios', label: 'Socios', icon: Users },
    { id: 'financiero', label: 'Financiero', icon: DollarSign },
    { id: 'tesoreria', label: 'Tesorería', icon: Wallet },
    { id: 'cuentas', label: 'Cuentas', icon: Briefcase },
    { id: 'centrosCosto', label: 'Centros de Costo', icon: Building2 },
    { id: 'actividades', label: 'Actividades', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data.nombreTenant ? `Resumen ejecutivo de ${data.nombreTenant}` : 'Resumen ejecutivo'}
            {data.periodoActual && ` · Período ${data.periodoActual.nombre}`}
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

      {/* Header con estado de salud */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-6 h-6 text-slate-300" />
            <div>
              <h2 className="text-lg font-bold">Salud Financiera</h2>
              <p className="text-slate-400 text-xs mt-0.5">Snapshot global del club</p>
            </div>
          </div>
          <StatusIndicator status={financiero.saludFinanciera || 'warning'} label={saludLabel} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Wallet className="w-4 h-4" />
              Liquidez Total
            </div>
            <p className={`text-lg sm:text-xl md:text-2xl font-bold ${saldoTotalCajas < 0 ? 'text-red-400' : ''}`}>
              <CurrencyResponsive value={saldoTotalCajas} />
            </p>
            {cajasNegativas.length > 0 ? (
              <div className="mt-2 space-y-0.5">
                <p className="text-[10px] text-red-300 font-mono uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Cajas en negativo:
                </p>
                {cajasNegativas.slice(0, 3).map(c => (
                  <p key={c.id} className="text-[11px] text-red-200 truncate">
                    {c.nombre}: <span className="font-semibold">{formatCurrency(Number(c.saldoActual))}</span>
                  </p>
                ))}
                <button
                  onClick={() => setActiveTab('tesoreria')}
                  className="text-[10px] text-slate-300 hover:text-white underline mt-1"
                >
                  Ver tesorería →
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Disponible inmediato</p>
            )}
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <TrendingUp className="w-4 h-4" />
              Cash Flow Neto
            </div>
            <p className={`text-lg sm:text-xl md:text-2xl font-bold ${financiero.resumenFinanciero.cashFlowMes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <CurrencyResponsive value={financiero.resumenFinanciero.cashFlowMes} />
            </p>
            <p className="text-xs text-slate-400 mt-1">Este mes</p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Target className="w-4 h-4" />
              Índice Cobranza
            </div>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{financiero.cobranzaMes.porcentaje}%</p>
            <ProgressBar
              value={financiero.cobranzaMes.porcentaje}
              max={100}
              color={financiero.cobranzaMes.porcentaje >= 70 ? 'green' : financiero.cobranzaMes.porcentaje >= 50 ? 'yellow' : 'red'}
              showLabel={false}
            />
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Clock className="w-4 h-4" />
              Días Cobertura
            </div>
            <p className={`text-lg sm:text-xl md:text-2xl font-bold ${financiero.diasCobertura >= 30 ? 'text-green-400' : financiero.diasCobertura >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
              {financiero.diasCobertura > 999 ? '+999' : financiero.diasCobertura}
            </p>
            <p className="text-xs text-slate-400 mt-1">Con liquidez actual</p>
          </div>
        </div>
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
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Alertas (sólo en general) */}
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
          {/* Cards de socios */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Socios</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="p-3 rounded-full bg-blue-100">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Socios Activos</p>
                  <p className="text-2xl font-bold text-blue-700">{formatNumber(socios.activos)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="p-3 rounded-full bg-green-100">
                  <Dumbbell className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Con Actividad</p>
                  <p className="text-2xl font-bold text-green-700">{formatNumber(socios.conActividad || 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="p-3 rounded-full bg-gray-100">
                  <UserX className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sin Actividad</p>
                  <p className="text-2xl font-bold text-gray-600">{formatNumber(socios.sinActividad || 0)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Link to="/admin/socios" className="text-sm text-primary hover:text-primary-dark font-medium">
                Ver todos los socios →
              </Link>
            </div>
          </div>

          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Cobranza Mes"
              value={`${financiero.cobranzaMes.porcentaje}%`}
              subtitle={formatCurrency(financiero.cobranzaMes.cobrado)}
              icon={Target}
              color={financiero.cobranzaMes.porcentaje >= 70 ? 'green' : financiero.cobranzaMes.porcentaje >= 50 ? 'yellow' : 'red'}
            />
            <KPICard
              title="Morosidad"
              value={<CurrencyResponsive value={financiero.morosidadTotal.monto} />}
              subtitle={`${financiero.morosidadTotal.cantSocios} socios`}
              icon={AlertTriangle}
              color="red"
            />
            <KPICard
              title="Inscripciones del mes"
              value={formatNumber(actividades.inscripcionesPeriodo ?? actividades.inscripcionesActivas)}
              subtitle="Iniciadas este mes"
              icon={Activity}
              color="purple"
              trend={actividades.tendenciaInscripciones > 0 ? 'up' : actividades.tendenciaInscripciones < 0 ? 'down' : undefined}
              trendValue={actividades.tendenciaInscripciones !== 0 ? `${Math.abs(actividades.tendenciaInscripciones)}%` : undefined}
            />
            <KPICard
              title="Nuevos (30 días)"
              value={formatNumber(socios.nuevos30Dias)}
              icon={UserPlus}
              color="blue"
              trend={socios.tendenciaNuevos > 0 ? 'up' : socios.tendenciaNuevos < 0 ? 'down' : undefined}
              trendValue={socios.tendenciaNuevos !== 0 ? `${Math.abs(socios.tendenciaNuevos)}%` : undefined}
            />
          </div>

          {/* Gráficos */}
          <div className="grid md:grid-cols-2 gap-6">
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

          {/* Resumen Financiero del Mes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Resumen Financiero del Mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg min-w-0">
                <p className="text-sm text-gray-500">Saldo en Cajas</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800"><CurrencyResponsive value={financiero.resumenFinanciero.saldoCajas} /></p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg min-w-0">
                <p className="text-sm text-gray-500">Ingresos Mes</p>
                <p className="text-lg sm:text-xl font-bold text-green-700"><CurrencyResponsive value={financiero.resumenFinanciero.ingresosMes} /></p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg min-w-0">
                <p className="text-sm text-gray-500">Egresos Mes</p>
                <p className="text-lg sm:text-xl font-bold text-red-700"><CurrencyResponsive value={financiero.resumenFinanciero.egresosMes} /></p>
              </div>
              <div className={`text-center p-4 rounded-lg min-w-0 ${financiero.resumenFinanciero.cashFlowMes >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className="text-sm text-gray-500">Cash Flow</p>
                <p className={`text-lg sm:text-xl font-bold ${financiero.resumenFinanciero.cashFlowMes >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  <CurrencyResponsive value={financiero.resumenFinanciero.cashFlowMes} />
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

          <div className="flex justify-end">
            <Link to="/admin/socios" className="flex items-center gap-2 text-primary hover:text-primary-dark font-medium">
              Ver todos los socios <ArrowRight className="w-4 h-4" />
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
              value={<CurrencyResponsive value={financiero.cobranzaMes.generado} />}
              subtitle={`${(financiero.cobranzaMes.cantCobrado || 0) + (financiero.cobranzaMes.cantPendiente || 0)} cuotas`}
              icon={DollarSign}
              color="blue"
            />
            <KPICard
              title="Cobrado"
              value={<CurrencyResponsive value={financiero.cobranzaMes.cobrado} />}
              subtitle={`${financiero.cobranzaMes.cantCobrado || 0} cuotas`}
              icon={CheckCircle2}
              color="green"
            />
            <KPICard
              title="Pendiente"
              value={<CurrencyResponsive value={financiero.cobranzaMes.pendiente} />}
              subtitle={`${financiero.cobranzaMes.cantPendiente || 0} cuotas`}
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

          {/* Progreso cobranza */}
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
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-700"><CurrencyResponsive value={financiero.morosidadTotal.monto} /></p>
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
              <Link to="/admin/reportes/morosidad" className="flex items-center gap-2 text-red-700 hover:text-red-800 font-medium">
                Ver reporte de morosidad <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Histórico de cobranza con barras stacked */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Histórico de Cobranza</h3>
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

          {/* Índice de cobranza por período */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Índice de Cobranza por Período</h3>
            <div className="space-y-4">
              {(graficos.evolucionCobranza || []).map(p => (
                <div key={p.periodo} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-20">{p.periodo}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={p.porcentaje}
                      max={100}
                      color={p.porcentaje >= 70 ? 'green' : p.porcentaje >= 50 ? 'yellow' : 'red'}
                      showLabel={false}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-12 text-right ${p.porcentaje >= 70 ? 'text-green-600' : p.porcentaje >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {p.porcentaje}%
                  </span>
                </div>
              ))}
              {(!graficos.evolucionCobranza || graficos.evolucionCobranza.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">Sin datos históricos</p>
              )}
            </div>
          </div>

          {/* Composición ingresos / egresos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Composición de Ingresos</h3>
              {ingresosComposicion.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={ingresosComposicion} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                          {ingresosComposicion.map((_, index) => (
                            <Cell key={index} fill={COLORS_INGRESOS[index % COLORS_INGRESOS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {ingresosComposicion.map((item, index) => (
                      <div key={item.nombre} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_INGRESOS[index % COLORS_INGRESOS.length] }} />
                          <span className="text-sm text-gray-600">{item.nombre}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{formatCurrency(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">Sin datos de ingresos este mes</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Composición de Egresos</h3>
              {egresosComposicion.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={egresosComposicion} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                          {egresosComposicion.map((_, index) => (
                            <Cell key={index} fill={COLORS_EGRESOS[index % COLORS_EGRESOS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {egresosComposicion.map((item, index) => (
                      <div key={item.nombre} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_EGRESOS[index % COLORS_EGRESOS.length] }} />
                          <span className="text-sm text-gray-600">{item.nombre}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{formatCurrency(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">Sin datos de egresos este mes</p>
              )}
            </div>
          </div>

          {/* Evolución de saldos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-1">Evolución de Saldos</h3>
            <p className="text-xs text-gray-500 mb-4">
              El "saldo acumulado" arranca con el arrastre histórico y suma el flujo neto de cada mes.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowMensual} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorSaldo)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="neto" name="Cash Flow Neto del mes" stroke="#3B82F6" fillOpacity={1} fill="url(#colorNeto)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Tesorería */}
      {activeTab === 'tesoreria' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Efectivo */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-100">
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Efectivo</h3>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEfectivo)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {cajasEfectivo.map(caja => {
                  const saldo = Number(caja.saldoActual) || 0
                  const incluida = !cajasExcluidas.has(caja.id)
                  return (
                    <div key={caja.id} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${incluida ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Switch size="sm" checked={incluida} onChange={() => toggleCajaExcluida(caja.id)} />
                        <span className="text-sm text-gray-600 truncate">{caja.nombre}</span>
                      </div>
                      <span className={`text-sm font-semibold ${incluida ? (saldo >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400 line-through'}`}>
                        {formatCurrency(saldo)}
                      </span>
                    </div>
                  )
                })}
                {cajasEfectivo.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No hay cajas de efectivo</p>
                )}
              </div>
            </div>

            {/* Bancos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-100">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Bancos</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalBancos)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {cajasBanco.map(caja => {
                  const saldo = Number(caja.saldoActual) || 0
                  const incluida = !cajasExcluidas.has(caja.id)
                  return (
                    <div key={caja.id} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${incluida ? '' : 'opacity-50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Switch size="sm" checked={incluida} onChange={() => toggleCajaExcluida(caja.id)} />
                        <span className="text-sm text-gray-600 truncate">{caja.nombre}</span>
                      </div>
                      <span className={`text-sm font-semibold ${incluida ? (saldo >= 0 ? 'text-blue-600' : 'text-red-600') : 'text-gray-400 line-through'}`}>
                        {formatCurrency(saldo)}
                      </span>
                    </div>
                  )
                })}
                {cajasBanco.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No hay cuentas bancarias</p>
                )}
              </div>
            </div>

            {/* Tarjetas pendientes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Tarjetas Pendientes</h3>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(tarjetasPendientes.montoTotal)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {tarjetasPendientes.detalle?.length > 0 ? (
                  <>
                    {tarjetasPendientes.detalle.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-gray-600">{item.tipo}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-purple-600">{formatCurrency(item.monto)}</p>
                          <p className="text-xs text-gray-400">{item.cantidad} operaciones</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Total operaciones</span>
                        <span className="font-semibold text-gray-700">{tarjetasPendientes.cantidad}</span>
                      </div>
                    </div>
                    <Link
                      to="/admin/tesoreria/conciliacion"
                      className="block w-full text-center py-2 px-4 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition"
                    >
                      Ir a Conciliación
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Sin tarjetas pendientes</p>
                  </div>
                )}
              </div>
            </div>

            {/* eCheqs Recibidos */}
            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">eCheqs Recibidos</h3>
                    <p className="text-xs text-gray-500">Pendientes de acreditación</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(echeqsRecibidos.montoTotal)}</p>
              </div>
              {echeqsRecibidos.cantidad > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-gray-600">En Cartera</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(echeqsRecibidos.montoEnCartera)}</p>
                      <p className="text-xs text-gray-400">{echeqsRecibidos.enCartera} cheques</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Depositados (pend. acreditar)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(echeqsRecibidos.montoDepositados)}</p>
                      <p className="text-xs text-gray-400">{echeqsRecibidos.depositados} cheques</p>
                    </div>
                  </div>
                  {(echeqsRecibidos.vencidos > 0 || echeqsRecibidos.proximosAVencer > 0) && (
                    <div className="pt-2 border-t border-gray-100 flex gap-3">
                      {echeqsRecibidos.vencidos > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{echeqsRecibidos.vencidos} vencidos</span>
                        </div>
                      )}
                      {echeqsRecibidos.proximosAVencer > 0 && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600">
                          <Clock className="w-3 h-3" />
                          <span>{echeqsRecibidos.proximosAVencer} próximos a vencer</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Link
                    to="/admin/tesoreria/echeqs?tipo=RECIBIDO"
                    className="block w-full text-center py-2 px-4 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition"
                  >
                    Ver eCheqs Recibidos
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin eCheqs recibidos pendientes</p>
                </div>
              )}
            </div>

            {/* eCheqs Emitidos */}
            <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-100">
                    <ArrowUpFromLine className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">eCheqs Emitidos</h3>
                    <p className="text-xs text-gray-500">Pendientes de débito</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(echeqsEmitidos.montoTotal)}</p>
              </div>
              {echeqsEmitidos.cantidad > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span className="text-sm text-gray-600">Pendientes de debitar</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-rose-600">{formatCurrency(echeqsEmitidos.montoTotal)}</p>
                      <p className="text-xs text-gray-400">{echeqsEmitidos.cantidad} cheques</p>
                    </div>
                  </div>
                  {(echeqsEmitidos.vencidos > 0 || echeqsEmitidos.proximosAVencer > 0) && (
                    <div className="pt-2 border-t border-gray-100 flex gap-3">
                      {echeqsEmitidos.vencidos > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{echeqsEmitidos.vencidos} vencidos</span>
                        </div>
                      )}
                      {echeqsEmitidos.proximosAVencer > 0 && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600">
                          <Clock className="w-3 h-3" />
                          <span>{echeqsEmitidos.proximosAVencer} próximos a vencer</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Link
                    to="/admin/tesoreria/echeqs?tipo=EMITIDO"
                    className="block w-full text-center py-2 px-4 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition"
                  >
                    Ver eCheqs Emitidos
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin eCheqs emitidos pendientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Evolución de saldos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Evolución de Saldos</h3>
            <p className="text-xs text-gray-500 mb-4">
              El "saldo acumulado" arranca con el arrastre histórico y suma el flujo neto de cada mes.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowMensual} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNetoT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaldoT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorSaldoT)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="neto" name="Cash Flow Neto del mes" stroke="#3B82F6" fillOpacity={1} fill="url(#colorNetoT)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Cuentas */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Balance de Cuentas Corrientes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Total por Cobrar</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPorCobrar)}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-sm text-gray-600 mb-1">Total por Pagar</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(totalPorPagar)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${balanceNeto >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <p className="text-sm text-gray-600 mb-1">Balance Neto</p>
                <p className={`text-2xl font-bold ${balanceNeto >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(balanceNeto)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  Cuentas por Cobrar
                </h4>
                <div className="space-y-2">
                  <Link to="/admin/cuotas" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100">
                        <Users className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-700">Cuotas Pendientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(financiero.cobranzaMes.pendiente || 0)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                  <Link to="/admin/ingresos/facturas" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100">
                        <Building2 className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-700">Saldo Clientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(financiero.saldoClientes || 0)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                  Cuentas por Pagar
                </h4>
                <div className="space-y-2">
                  <Link to="/admin/egresos/facturas" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100">
                        <Building2 className="w-4 h-4 text-red-600" />
                      </div>
                      <span className="text-sm text-gray-700">Saldo Proveedores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(financiero.saldoProveedores || 0)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                  <Link to="/admin/liquidaciones" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-100">
                        <Briefcase className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-sm text-gray-700">Sueldos por Pagar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-orange-600">{formatCurrency(financiero.sueldosPorPagar || 0)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Posición financiera neta */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Posición Financiera Neta</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  {balanceNeto >= 0 ? (
                    <div
                      className="absolute left-1/2 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-r-full"
                      style={{ width: `${Math.min(50, (balanceNeto / (totalPorCobrar + totalPorPagar || 1)) * 100)}%` }}
                    />
                  ) : (
                    <div
                      className="absolute right-1/2 h-full bg-gradient-to-l from-red-400 to-red-500 rounded-l-full"
                      style={{ width: `${Math.min(50, (Math.abs(balanceNeto) / (totalPorCobrar + totalPorPagar || 1)) * 100)}%` }}
                    />
                  )}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400" />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Deudor</span>
                  <span>Equilibrio</span>
                  <span>Acreedor</span>
                </div>
              </div>
              <div className={`p-4 rounded-xl ${balanceNeto >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className="text-xs text-gray-600">Posición</p>
                <p className={`text-lg font-bold ${balanceNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {balanceNeto >= 0 ? 'Acreedor' : 'Deudor'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Centros de Costo */}
      {activeTab === 'centrosCosto' && (
        <Suspense fallback={<LoadingSpinner />}>
          <ReporteCentrosCosto embedded />
        </Suspense>
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
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {actividades.top5Actividades.map((_, index) => (
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
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-medium text-gray-700 truncate max-w-[200px]">{act.nombre}</span>
                    </div>
                    <span className="font-bold text-gray-900">{act.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

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

          <div className="flex justify-end">
            <Link to="/admin/reportes/actividades" className="flex items-center gap-2 text-primary hover:text-primary-dark font-medium">
              Ver reporte de actividades <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
