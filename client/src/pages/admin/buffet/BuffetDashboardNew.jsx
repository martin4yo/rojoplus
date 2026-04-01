import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  ChefHat, Coffee, Truck, RefreshCw, ArrowRight,
  CreditCard, Banknote, QrCode, BarChart3
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import ChatWidget from '../../../components/chat/ChatWidget'

// Rangos de fecha predefinidos
const RANGOS_FECHA = [
  { id: 'hoy', label: 'Hoy', getDates: () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)
    return { desde: hoy, hasta: fin }
  }},
  { id: 'ayer', label: 'Ayer', getDates: () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    ayer.setHours(0, 0, 0, 0)
    const fin = new Date(ayer)
    fin.setHours(23, 59, 59, 999)
    return { desde: ayer, hasta: fin }
  }},
  { id: 'semana', label: 'Esta Semana', getDates: () => {
    const hoy = new Date()
    const diaSemana = hoy.getDay()
    const desde = new Date(hoy)
    desde.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    desde.setHours(0, 0, 0, 0)
    const hasta = new Date()
    hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }},
  { id: 'mes', label: 'Este Mes', getDates: () => {
    const hoy = new Date()
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const hasta = new Date()
    hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }},
  { id: 'mesAnterior', label: 'Mes Anterior', getDates: () => {
    const hoy = new Date()
    const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999)
    return { desde, hasta }
  }},
  { id: 'personalizado', label: 'Personalizado', getDates: () => null }
]

export default function BuffetDashboard() {
  const puedeVerDashboard = tienePermiso(PERMISOS.BUFFET_VER) || tienePermiso(PERMISOS.BUFFET_CONFIG)

  const [rangoSeleccionado, setRangoSeleccionado] = useState('hoy')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  const [limiteProductos, setLimiteProductos] = useState(5)

  // Obtener fechas según el rango seleccionado
  const obtenerFechas = useCallback(() => {
    if (rangoSeleccionado === 'personalizado') {
      return {
        desde: fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null,
        hasta: fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null
      }
    }
    const rango = RANGOS_FECHA.find(r => r.id === rangoSeleccionado)
    return rango?.getDates() || { desde: new Date(), hasta: new Date() }
  }, [rangoSeleccionado, fechaDesde, fechaHasta])

  // Cargar datos del dashboard
  const cargarDatos = useCallback(async () => {
    if (!puedeVerDashboard) return

    setLoading(true)
    try {
      const { desde, hasta } = obtenerFechas()
      if (!desde || !hasta) {
        setLoading(false)
        return
      }

      const params = new URLSearchParams({
        desde: desde.toISOString(),
        hasta: hasta.toISOString()
      })

      const res = await api.get(`/admin/buffet/dashboard-estadisticas?${params}`)
      const data = res?.data || res
      setKpis(data)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
      toast.error('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [obtenerFechas, puedeVerDashboard])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Formatear moneda
  const formatMoney = (value) => {
    return `$${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
  }

  // Formatear porcentaje de cambio
  const formatCambio = (actual, anterior) => {
    if (!anterior || anterior === 0) return null
    const cambio = ((actual - anterior) / anterior) * 100
    return cambio.toFixed(1)
  }

  if (!puedeVerDashboard) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No tienes permiso para ver el dashboard</p>
        <Link to="/admin/buffet" className="text-blue-600 hover:underline mt-2 inline-block">
          Ir al mapa de mesas
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Dashboard Buffet" subtitle="Estadísticas y métricas de ventas">
        {/* Filtros de fecha */}
        {RANGOS_FECHA.map(rango => (
          <button
            key={rango.id}
            onClick={() => setRangoSeleccionado(rango.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rangoSeleccionado === rango.id
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {rango.label}
          </button>
        ))}
        <button
          onClick={() => cargarDatos()}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Actualizar"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </PageHeader>

      {/* Fechas personalizadas */}
      {rangoSeleccionado === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => cargarDatos()}
            disabled={!fechaDesde || !fechaHasta}
            className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : kpis ? (
        <>
          {/* KPIs Principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Ventas Totales */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Ventas Totales</span>
                <DollarSign className="text-green-500" size={20} />
              </div>
              <div className="text-2xl font-bold text-gray-800">{formatMoney(kpis.ventasTotal)}</div>
              {kpis.ventasTotalAnterior > 0 && (
                <div className={`text-xs flex items-center gap-1 mt-1 ${
                  kpis.ventasTotal >= kpis.ventasTotalAnterior ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpis.ventasTotal >= kpis.ventasTotalAnterior ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {formatCambio(kpis.ventasTotal, kpis.ventasTotalAnterior)}% vs período anterior
                </div>
              )}
            </div>

            {/* Cantidad de Ventas */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Operaciones</span>
                <ShoppingCart className="text-blue-500" size={20} />
              </div>
              <div className="text-2xl font-bold text-gray-800">{kpis.cantidadVentas || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                Ticket Promedio: {formatMoney(kpis.ticketPromedio)}
              </div>
            </div>

            {/* Mesas Atendidas */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Mesas</span>
                <ChefHat className="text-orange-500" size={20} />
              </div>
              <div className="text-2xl font-bold text-gray-800">{kpis.mesasAtendidas || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                Promedio: {formatMoney(kpis.promedioMesa)}
              </div>
            </div>

            {/* Pedidos Delivery/TakeAway */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Pedidos</span>
                <Truck className="text-purple-500" size={20} />
              </div>
              <div className="text-2xl font-bold text-gray-800">{kpis.pedidosTakeaway || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                Total: {formatMoney(kpis.totalTakeaway)}
              </div>
            </div>
          </div>

          {/* Segunda fila de KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Ventas Kiosco */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Kiosco</span>
                <Coffee className="text-amber-500" size={20} />
              </div>
              <div className="text-xl font-bold text-gray-800">{formatMoney(kpis.ventasKiosco)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.cantidadKiosco || 0} operaciones
              </div>
            </div>

            {/* Efectivo */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Efectivo</span>
                <Banknote className="text-green-600" size={20} />
              </div>
              <div className="text-xl font-bold text-gray-800">{formatMoney(kpis.pagoEfectivo)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.cantidadVentas > 0 ? ((kpis.pagoEfectivo / kpis.ventasTotal) * 100).toFixed(0) : 0}% del total
              </div>
            </div>

            {/* Tarjeta */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">Tarjeta</span>
                <CreditCard className="text-blue-600" size={20} />
              </div>
              <div className="text-xl font-bold text-gray-800">{formatMoney(kpis.pagoTarjeta)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.cantidadVentas > 0 ? ((kpis.pagoTarjeta / kpis.ventasTotal) * 100).toFixed(0) : 0}% del total
              </div>
            </div>

            {/* QR/Transferencia */}
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm">QR/Transferencia</span>
                <QrCode className="text-indigo-600" size={20} />
              </div>
              <div className="text-xl font-bold text-gray-800">{formatMoney(kpis.pagoDigital)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {kpis.cantidadVentas > 0 ? ((kpis.pagoDigital / kpis.ventasTotal) * 100).toFixed(0) : 0}% del total
              </div>
            </div>
          </div>

          {/* Evolución de ventas por día */}
          {kpis.ventasPorDia && kpis.ventasPorDia.length >= 1 && ['mes', 'mesAnterior', 'personalizado'].includes(rangoSeleccionado) && (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                Evolución de ventas por día
                <span className="text-xs font-normal text-gray-400">Clic en una barra para filtrar ese día</span>
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={kpis.ventasPorDia}
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  onClick={(chartData) => {
                    if (!chartData?.activePayload?.[0]) return
                    const fecha = chartData.activePayload[0].payload.fecha
                    setFechaDesde(fecha)
                    setFechaHasta(fecha)
                    setRangoSeleccionado('personalizado')
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toLocaleString('es-AR')}`, 'Ventas']}
                    labelFormatter={label => `Día ${label}`}
                  />
                  <Bar dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Productos más vendidos y Ventas por hora */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Productos */}
            {kpis.topProductos && kpis.topProductos.length > 0 && (
              <div className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Productos más vendidos</h3>
                  <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                    {[{ label: 'Top 5', value: 5 }, { label: 'Top 10', value: 10 }, { label: 'Todos', value: null }].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setLimiteProductos(opt.value)}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          limiteProductos === opt.value
                            ? 'bg-white shadow text-orange-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {(limiteProductos ? kpis.topProductos.slice(0, limiteProductos) : kpis.topProductos).map((prod, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-gray-100 text-gray-700' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-gray-700">{prod.nombre}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{prod.cantidad}</div>
                        <div className="text-xs text-gray-500">{formatMoney(prod.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {limiteProductos && kpis.topProductos.length > limiteProductos && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Mostrando {limiteProductos} de {kpis.topProductos.length} productos
                  </p>
                )}
              </div>
            )}

            {/* Ventas por hora */}
            {kpis.ventasPorHora && Object.values(kpis.ventasPorHora).some(v => v.total > 0) && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Ventas por hora</h3>
                <div className="space-y-2">
                  {Object.entries(kpis.ventasPorHora)
                    .filter(([_, v]) => v.total > 0)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                    .map(([hora, data]) => (
                      <div key={hora} className="flex items-center gap-2">
                        <span className="w-12 text-xs text-gray-500">{hora}:00</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-orange-500 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (data.total / (kpis.maxVentaHora || 1)) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="w-20 text-right text-sm font-medium">{formatMoney(data.total)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No hay datos para el período seleccionado
        </div>
      )}

      {/* Link a mesas */}
      <div className="flex justify-center">
        <Link
          to="/admin/buffet/estado"
          className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
        >
          Ir al mapa de mesas <ArrowRight size={18} />
        </Link>
      </div>

      {/* Xavi - Chat Widget para Camareros */}
      <ChatWidget role="camarero" position="bottom-right" />
    </div>
  )
}
