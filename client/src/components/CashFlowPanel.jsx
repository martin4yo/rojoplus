import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  CreditCard,
  UserCheck,
  Building2,
  Briefcase,
  PiggyBank,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts'

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

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value)
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue', size = 'normal' }) {
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
    <div className={`rounded-xl border p-4 ${colorClasses[color]} transition-all hover:shadow-md`}>
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

// Indicador de Estado
function StatusIndicator({ status, label }) {
  const statusConfig = {
    good: { color: 'bg-green-500', icon: CheckCircle2, text: 'text-green-700' },
    warning: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'text-yellow-700' },
    danger: { color: 'bg-red-500', icon: AlertTriangle, text: 'text-red-700' },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color} animate-pulse`} />
      <span className={`text-sm font-medium ${config.text}`}>{label}</span>
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

// Custom Tooltip for charts
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function CashFlowPanel({ stats }) {
  const [activeTab, setActiveTab] = useState('general')

  if (!stats) return null

  const {
    ingresosMes = 0,
    egresosMes = 0,
    saldoTotalCajas = 0,
    cajas = [],
    cobranzaPeriodo = {},
    saldoClientes = 0,
    saldoProveedores = 0,
    sueldosPorPagar = 0,
    tarjetasPendientes = { cantidad: 0, montoTotal: 0, detalle: [] },
    echeqsRecibidos = { cantidad: 0, montoTotal: 0, enCartera: 0, montoEnCartera: 0, depositados: 0, montoDepositados: 0, vencidos: 0, proximosAVencer: 0 },
    echeqsEmitidos = { cantidad: 0, montoTotal: 0, vencidos: 0, proximosAVencer: 0 },
    graficos = {},
  } = stats

  const {
    cashFlowMensual = [],
    cobranzaHistorica = [],
    ingresosComposicion = [],
    egresosComposicion = [],
  } = graficos

  // Cálculos de KPIs
  const cashFlowNeto = ingresosMes - egresosMes
  const liquidezTotal = saldoTotalCajas
  const totalPorCobrar = saldoClientes + (cobranzaPeriodo.pendiente || 0)
  const totalPorPagar = saldoProveedores + sueldosPorPagar
  const balanceNeto = totalPorCobrar - totalPorPagar
  const indiceCobranza = cobranzaPeriodo.cobrado && cobranzaPeriodo.pendiente
    ? Math.round((cobranzaPeriodo.cobrado / (cobranzaPeriodo.cobrado + cobranzaPeriodo.pendiente)) * 100)
    : 0

  // Promedio diario de egresos (basado en el mes actual, asumiendo 30 días)
  const promedioEgresoDiario = egresosMes / 30
  const diasCobertura = promedioEgresoDiario > 0 ? Math.round(liquidezTotal / promedioEgresoDiario) : 999

  // Estado de salud financiera
  const saludFinanciera = cashFlowNeto >= 0 && indiceCobranza >= 70 && diasCobertura >= 30
    ? 'good'
    : cashFlowNeto < 0 || indiceCobranza < 50 || diasCobertura < 15
    ? 'danger'
    : 'warning'

  // Separar cajas por tipo
  const cajasEfectivo = cajas.filter(c => c.tipo === 'EFECTIVO')
  const cajasBanco = cajas.filter(c => c.tipo === 'BANCO')
  const totalEfectivo = cajasEfectivo.reduce((sum, c) => sum + Number(c.saldoActual), 0)
  const totalBancos = cajasBanco.reduce((sum, c) => sum + Number(c.saldoActual), 0)

  return (
    <div className="space-y-6">
      {/* Header con estado de salud */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Panel de CashFlow</h2>
            <p className="text-slate-400 text-sm mt-1">Resumen financiero actualizado</p>
          </div>
          <StatusIndicator
            status={saludFinanciera}
            label={saludFinanciera === 'good' ? 'Saludable' : saludFinanciera === 'warning' ? 'Atención' : 'Crítico'}
          />
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Wallet className="w-4 h-4" />
              Liquidez Total
            </div>
            <p className="text-2xl font-bold">{formatCurrency(liquidezTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">Disponible inmediato</p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <TrendingUp className="w-4 h-4" />
              Cash Flow Neto
            </div>
            <p className={`text-2xl font-bold ${cashFlowNeto >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(cashFlowNeto)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Este mes</p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Target className="w-4 h-4" />
              Índice Cobranza
            </div>
            <p className="text-2xl font-bold">{indiceCobranza}%</p>
            <ProgressBar value={indiceCobranza} max={100} color={indiceCobranza >= 70 ? 'green' : indiceCobranza >= 50 ? 'yellow' : 'red'} showLabel={false} />
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Clock className="w-4 h-4" />
              Días Cobertura
            </div>
            <p className={`text-2xl font-bold ${diasCobertura >= 30 ? 'text-green-400' : diasCobertura >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
              {diasCobertura > 999 ? '+999' : diasCobertura}
            </p>
            <p className="text-xs text-slate-400 mt-1">Con liquidez actual</p>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'general', label: 'General' },
          { id: 'flujo', label: 'Flujo de Caja' },
          { id: 'cobranza', label: 'Cobranza' },
          { id: 'cuentas', label: 'Cuentas' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Fila de KPIs secundarios */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Ingresos del Mes"
              value={formatCurrency(ingresosMes)}
              icon={TrendingUp}
              color="green"
            />
            <KPICard
              title="Egresos del Mes"
              value={formatCurrency(egresosMes)}
              icon={TrendingDown}
              color="red"
            />
            <KPICard
              title="Por Cobrar Total"
              value={formatCurrency(totalPorCobrar)}
              subtitle={`Cuotas: ${formatCurrency(cobranzaPeriodo.pendiente || 0)}`}
              icon={UserCheck}
              color="green"
            />
            <KPICard
              title="Por Pagar Total"
              value={formatCurrency(totalPorPagar)}
              subtitle={`Sueldos: ${formatCurrency(sueldosPorPagar)}`}
              icon={Building2}
              color="red"
            />
          </div>

          {/* Gráfico principal: Evolución Cash Flow */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolución del Cash Flow</h3>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cashFlowMensual} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Composición Ingresos y Egresos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ingresos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Composición de Ingresos</h3>
              {ingresosComposicion.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={ingresosComposicion}
                          dataKey="valor"
                          nameKey="nombre"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                        >
                          {ingresosComposicion.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_INGRESOS[index % COLORS_INGRESOS.length]} />
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

            {/* Egresos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Composición de Egresos</h3>
              {egresosComposicion.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={egresosComposicion}
                          dataKey="valor"
                          nameKey="nombre"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={60}
                        >
                          {egresosComposicion.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_EGRESOS[index % COLORS_EGRESOS.length]} />
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
        </div>
      )}

      {/* Tab: Flujo de Caja */}
      {activeTab === 'flujo' && (
        <div className="space-y-6">
          {/* Saldos por tipo - 5 columnas en una línea */}
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
                  return (
                    <div key={caja.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{caja.nombre}</span>
                      <span className={`text-sm font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                  return (
                    <div key={caja.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{caja.nombre}</span>
                      <span className={`text-sm font-semibold ${saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
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

            {/* Tarjetas Pendientes de Conciliación */}
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

            {/* eCheqs Recibidos (Pendientes de Acreditación) */}
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

            {/* eCheqs Emitidos (Pendientes de Débito) */}
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

          {/* Gráfico de línea Cash Flow Neto */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cash Flow Neto - Tendencia</h3>
            <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={cashFlowMensual} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNeto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="neto" name="Cash Flow Neto" stroke="#3B82F6" fillOpacity={1} fill="url(#colorNeto)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab: Cobranza */}
      {activeTab === 'cobranza' && (
        <div className="space-y-6">
          {/* KPIs de Cobranza */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Cobrado"
              value={formatCurrency(cobranzaPeriodo.cobrado || 0)}
              subtitle={`${cobranzaPeriodo.cantCobrado || 0} cuotas`}
              icon={CheckCircle2}
              color="green"
            />
            <KPICard
              title="Pendiente"
              value={formatCurrency(cobranzaPeriodo.pendiente || 0)}
              subtitle={`${cobranzaPeriodo.cantPendiente || 0} cuotas`}
              icon={Clock}
              color="yellow"
            />
            <KPICard
              title="Total Generado"
              value={formatCurrency((cobranzaPeriodo.cobrado || 0) + (cobranzaPeriodo.pendiente || 0))}
              subtitle="Período actual"
              icon={Target}
              color="blue"
            />
            <KPICard
              title="% Cobrado"
              value={`${indiceCobranza}%`}
              subtitle={indiceCobranza >= 70 ? 'Buen índice' : 'Por mejorar'}
              icon={TrendingUp}
              color={indiceCobranza >= 70 ? 'green' : indiceCobranza >= 50 ? 'yellow' : 'red'}
            />
          </div>

          {/* Gráfico histórico de cobranza */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico de Cobranza</h3>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cobranzaHistorica} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="cobrado" name="Cobrado" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pendiente" name="Pendiente" fill="#FBBF24" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Porcentaje de cobranza por periodo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Índice de Cobranza por Período</h3>
            <div className="space-y-4">
              {cobranzaHistorica.map((periodo) => (
                <div key={periodo.periodo} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-20">{periodo.periodo}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={periodo.porcentaje}
                      max={100}
                      color={periodo.porcentaje >= 70 ? 'green' : periodo.porcentaje >= 50 ? 'yellow' : 'red'}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-12 text-right ${periodo.porcentaje >= 70 ? 'text-green-600' : periodo.porcentaje >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {periodo.porcentaje}%
                  </span>
                </div>
              ))}
              {cobranzaHistorica.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">Sin datos históricos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Cuentas */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          {/* Resumen de cuentas */}
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

            {/* Detalle */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por Cobrar */}
              <div>
                <h4 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  Cuentas por Cobrar
                </h4>
                <div className="space-y-2">
                  <Link to="/admin/cuotas" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100">
                        <UserCheck className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-sm text-gray-700">Cuotas Pendientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(cobranzaPeriodo.pendiente || 0)}</span>
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
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(saldoClientes)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                </div>
              </div>

              {/* Por Pagar */}
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
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(saldoProveedores)}</span>
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
                      <span className="text-sm font-semibold text-orange-600">{formatCurrency(sueldosPorPagar)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Indicador de posición financiera */}
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
    </div>
  )
}
