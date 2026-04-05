import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  ChefHat, Coffee, Truck, RefreshCw, ArrowRight,
  CreditCard, Banknote, QrCode, BarChart3, ArrowUpCircle, ArrowDownCircle, Scale,
  ChevronDown, ChevronRight, Wallet, Printer, Download, Eye, X, ChevronLeft
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Line, Legend
} from 'recharts'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import ChatWidget from '../../../components/chat/ChatWidget'
import LoadingSpinner from '../../../components/LoadingSpinner'

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
  const [criterioProductos, setCriterioProductos] = useState('cantidad') // 'cantidad' | 'total'
  const [agruparCategoria, setAgruparCategoria] = useState(false)
  const [categoriasColapsadas, setCategoriasColapsadas] = useState({})
  const [mediosPagoExpanded, setMediosPagoExpanded] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [tendencia, setTendencia] = useState([])
  const [mesesTendencia, setMesesTendencia] = useState(12)
  const [ventas, setVentas] = useState([])
  const [ventasTotal, setVentasTotal] = useState(0)
  const [ventasPagina, setVentasPagina] = useState(1)
  const [ventasTotalPages, setVentasTotalPages] = useState(1)
  const [loadingVentas, setLoadingVentas] = useState(false)
  const [ventasExpanded, setVentasExpanded] = useState(false)
  const [ventaDetalle, setVentaDetalle] = useState(null) // { tipo, id, numero }
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [detalleItems, setDetalleItems] = useState(null)

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
      if (desde > hasta) {
        toast.error('La fecha "desde" no puede ser posterior a "hasta"')
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

  // Cargar listado de ventas del período
  const cargarVentas = useCallback(async (pagina = 1) => {
    if (!puedeVerDashboard) return
    const { desde, hasta } = obtenerFechas()
    if (!desde || !hasta) return
    setLoadingVentas(true)
    try {
      const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString(), limit: 50, page: pagina })
      const res = await api.getFull(`/admin/buffet/ventas-periodo?${params}`)
      setVentas(res?.data || [])
      setVentasTotal(res?.total || 0)
      setVentasPagina(res?.page || 1)
      setVentasTotalPages(res?.pages || 1)
    } catch {
      setVentas([])
    } finally {
      setLoadingVentas(false)
    }
  }, [obtenerFechas, puedeVerDashboard])

  useEffect(() => {
    cargarVentas(1)
  }, [cargarVentas])

  // Cargar detalle de una venta
  const verDetalle = async (venta) => {
    setVentaDetalle(venta)
    setDetalleItems(null)
    setLoadingDetalle(true)
    try {
      const endpoint = venta.tipo === 'COMANDA'
        ? `/admin/buffet/comandas/${venta.id}`
        : `/admin/buffet/takeaway/${venta.id}`
      const data = await api.get(endpoint)
      const items = data?.items || []
      setDetalleItems(items)
    } catch {
      setDetalleItems([])
    } finally {
      setLoadingDetalle(false)
    }
  }

  // Cargar tendencia mensual (independiente del rango de fechas)
  useEffect(() => {
    if (!puedeVerDashboard) return
    api.get(`/admin/buffet/tendencia-mensual?meses=${mesesTendencia}`)
      .then(res => setTendencia(res?.data || res || []))
      .catch(() => {})
  }, [mesesTendencia, puedeVerDashboard])

  // Imprimir reporte de cierre
  const imprimirReporte = async () => {
    const { desde, hasta } = obtenerFechas()
    if (!desde || !hasta) {
      toast.error('Seleccione un período válido')
      return
    }
    setImprimiendo(true)
    try {
      const reporte = await api.post('/admin/buffet/reporte-cierre', {
        desde: desde.toISOString(),
        hasta: hasta.toISOString()
      })
      const { ticketBase64 } = reporte || {}
      await api.post('/admin/buffet/imprimir-ticket-directo', {
        ticketBase64,
        tipoTicket: 'CUENTA'
      })
      toast.success('Reporte enviado a impresora')
    } catch (err) {
      toast.error(err.message || 'Error al imprimir reporte')
    } finally {
      setImprimiendo(false)
    }
  }

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
          onClick={imprimirReporte}
          disabled={imprimiendo || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          title="Imprimir reporte de cierre"
        >
          <Printer size={16} className={imprimiendo ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">Reporte</span>
        </button>
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
        <LoadingSpinner />
      ) : kpis ? (
        <>
          {/* Saldo Anterior / Ingresos / Egresos / Saldo Actual */}
          {(() => {
            // Usar movimientoCaja como fuente única (igual que saldoAnterior)
            const totalIngresosCaja = (kpis.porMedioPago || []).reduce((s, m) => s + m.ingresos, 0)
            const totalEgresosCaja = (kpis.porMedioPago || []).reduce((s, m) => s + m.egresos, 0)
            const saldoReal = (kpis.saldoAnterior || 0) + totalIngresosCaja - totalEgresosCaja
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm font-medium">Saldo Anterior</span>
                    <Wallet className="text-gray-400" size={20} />
                  </div>
                  <div className="text-2xl font-bold text-gray-700">{formatMoney(kpis.saldoAnterior || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Antes del período</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-700 text-sm font-medium">Ingresos</span>
                    <ArrowUpCircle className="text-green-500" size={20} />
                  </div>
                  <div className="text-2xl font-bold text-green-800">{formatMoney(totalIngresosCaja)}</div>
                  <div className="text-xs text-green-600 mt-1">{kpis.cantidadVentas || 0} operaciones</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-700 text-sm font-medium">Egresos</span>
                    <ArrowDownCircle className="text-red-500" size={20} />
                  </div>
                  <div className="text-2xl font-bold text-red-800">{formatMoney(totalEgresosCaja)}</div>
                  <div className="text-xs text-red-600 mt-1">{kpis.egresosPorConcepto?.length || 0} registros</div>
                </div>
                <div className={`border rounded-xl p-4 ${saldoReal >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${saldoReal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Saldo Real</span>
                    <Scale className={saldoReal >= 0 ? 'text-blue-500' : 'text-orange-500'} size={20} />
                  </div>
                  <div className={`text-2xl font-bold ${saldoReal >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                    {formatMoney(saldoReal)}
                  </div>
                  <div className={`text-xs mt-1 ${saldoReal >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    Ant. + Ing. − Egr.
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Acordeón: Detalle por Medio de Pago */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <button
              onClick={() => setMediosPagoExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-700 flex items-center gap-2 text-sm">
                <CreditCard size={16} className="text-gray-400" />
                Detalle por Medio de Pago
              </span>
              {mediosPagoExpanded
                ? <ChevronDown size={16} className="text-gray-400" />
                : <ChevronRight size={16} className="text-gray-400" />
              }
            </button>
            {mediosPagoExpanded && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Medio de Pago</th>
                      <th className="text-right px-4 py-2">Saldo Anterior</th>
                      <th className="text-right px-4 py-2 text-green-600">Ingresos</th>
                      <th className="text-right px-4 py-2 text-red-600">Egresos</th>
                      <th className="text-right px-4 py-2">Saldo Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(kpis.porMedioPago || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-xs">Sin movimientos</td>
                      </tr>
                    ) : (kpis.porMedioPago || []).map((mp, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{mp.medioPago || 'Sin especificar'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{formatMoney(mp.saldoAnterior)}</td>
                        <td className="px-4 py-2.5 text-right text-green-600 font-medium">+{formatMoney(mp.ingresos)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600 font-medium">-{formatMoney(mp.egresos)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${mp.saldo >= 0 ? 'text-gray-800' : 'text-red-700'}`}>
                          {formatMoney(mp.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Listado de Ventas del Período */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <button
              onClick={() => setVentasExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-700 flex items-center gap-2 text-sm">
                <ShoppingCart size={16} className="text-gray-400" />
                Ventas del período
                {ventasTotal > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
                    {ventasTotal}
                  </span>
                )}
              </span>
              {ventasExpanded
                ? <ChevronDown size={16} className="text-gray-400" />
                : <ChevronRight size={16} className="text-gray-400" />
              }
            </button>
            {ventasExpanded && (
              <div className="border-t border-gray-100 overflow-x-auto">
                {loadingVentas ? (
                  <div className="py-6 text-center text-sm text-gray-400">Cargando...</div>
                ) : ventas.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">Sin ventas en el período</div>
                ) : (() => {
                    const hayComprobantes = ventas.some(v => v.comprobante)
                    const colSpanFoot = hayComprobantes ? 5 : 4
                    return (
                  <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Hora</th>
                        <th className="text-left px-4 py-2">Tipo</th>
                        <th className="text-left px-4 py-2">Detalle</th>
                        {hayComprobantes && <th className="text-left px-4 py-2">Comprobante</th>}
                        <th className="text-right px-4 py-2">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ventas.map((v, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{v.numero || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                            {v.fecha ? new Date(v.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              v.tipo === 'COMANDA' ? 'bg-orange-100 text-orange-700'
                              : v.tipo === 'TAKEAWAY' ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                              {v.tipo === 'COMANDA' ? `Mesa ${v.mesa || '?'}` : v.tipo === 'TAKEAWAY' ? 'TakeAway' : 'Kiosco'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs max-w-[200px] truncate">
                            {v.socio || v.cliente || (v.cobradoPor ? `Cobró: ${v.cobradoPor}` : '-')}
                          </td>
                          {hayComprobantes && (
                            <td className="px-4 py-2.5 text-xs text-gray-400">
                              {v.comprobante
                                ? <span className="text-green-600 font-medium">{v.comprobante.tipo} {v.comprobante.puntoVenta?.toString().padStart(4,'0') || ''}-{String(v.comprobante.numero || '').padStart(8,'0')}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                            {formatMoney(v.total)}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => verDetalle(v)}
                              className="p-1 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors"
                              title="Ver detalle"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td colSpan={colSpanFoot} className="px-4 py-2.5 text-sm font-semibold text-gray-700">
                          Total del período ({ventasTotal} ventas)
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                          {formatMoney(kpis?.ventasTotal || 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  {ventasTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <span className="text-xs text-gray-500">
                        Página {ventasPagina} de {ventasTotalPages} · {ventasTotal} ventas
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cargarVentas(ventasPagina - 1)}
                          disabled={ventasPagina <= 1 || loadingVentas}
                          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(5, ventasTotalPages) }, (_, i) => {
                          const p = ventasPagina <= 3 ? i + 1
                            : ventasPagina >= ventasTotalPages - 2 ? ventasTotalPages - 4 + i
                            : ventasPagina - 2 + i
                          if (p < 1 || p > ventasTotalPages) return null
                          return (
                            <button
                              key={p}
                              onClick={() => cargarVentas(p)}
                              disabled={loadingVentas}
                              className={`w-7 h-7 text-xs rounded ${p === ventasPagina ? 'bg-orange-500 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                            >
                              {p}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => cargarVentas(ventasPagina + 1)}
                          disabled={ventasPagina >= ventasTotalPages || loadingVentas}
                          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                    )
                  })()}
              </div>
            )}
          </div>

          {/* Evolución de ventas por día */}
          {kpis.ventasPorDia && kpis.ventasPorDia.length > 1 && (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Evolución de ventas por día</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kpis.ventasPorDia} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatMoney(v)} labelFormatter={l => `Día ${l}`} />
                  <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} name="Ventas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Productos más vendidos y Ventas por hora */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Productos */}
            {(() => {
              const sorted = [...(kpis.topProductos || [])].sort((a, b) =>
                criterioProductos === 'total' ? b.total - a.total : b.cantidad - a.cantidad
              )
              // Agrupado por categoría
              const grupos = agruparCategoria
                ? sorted.reduce((acc, p) => {
                    const cat = p.categoria || 'Sin categoría'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(p)
                    return acc
                  }, {})
                : null
              const lista = !agruparCategoria
                ? (limiteProductos ? sorted.slice(0, limiteProductos) : sorted)
                : null

              const toggleCategoria = (cat) => setCategoriasColapsadas(prev => ({ ...prev, [cat]: !prev[cat] }))

              const renderFila = (prod, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>{idx + 1}</span>
                    <span className="text-gray-700 text-sm truncate">{prod.nombre}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 whitespace-nowrap">
                    <span className="text-xs text-gray-400 w-8 text-right">{prod.cantidad} un</span>
                    <span className="font-semibold text-sm text-gray-800 w-20 text-right">{formatMoney(prod.total)}</span>
                  </div>
                </div>
              )

              const exportarExcel = () => {
                const rangoLabel = rangoSeleccionado === 'custom'
                  ? `${fechaDesde}_${fechaHasta}`
                  : RANGOS_FECHA.find(r => r.id === rangoSeleccionado)?.label || rangoSeleccionado
                const filas = sorted.map(p => ({
                  Categoría: p.categoria || 'Sin categoría',
                  Producto: p.nombre,
                  'Un. Vendidas': p.cantidad,
                  'Total Ventas ($)': p.total,
                  'Stock Ingresado': p.ingresoStock || 0,
                }))
                const ws = XLSX.utils.json_to_sheet(filas)
                ws['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Productos')
                XLSX.writeFile(wb, `productos-vendidos-${rangoLabel}.xlsx`)
              }

              return (
                <div className="bg-white rounded-xl shadow p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {criterioProductos === 'total' ? 'Productos más rentables' : 'Productos más vendidos'}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Criterio */}
                      <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                        {[{ label: 'Cant.', value: 'cantidad' }, { label: '$', value: 'total' }].map(opt => (
                          <button key={opt.value} onClick={() => setCriterioProductos(opt.value)}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                              criterioProductos === opt.value ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'
                            }`}>{opt.label}</button>
                        ))}
                      </div>
                      {/* Límite (solo sin agrupación) */}
                      {!agruparCategoria && (
                        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                          {[{ label: 'Top 5', value: 5 }, { label: 'Top 10', value: 10 }, { label: 'Todos', value: null }].map(opt => (
                            <button key={opt.label} onClick={() => setLimiteProductos(opt.value)}
                              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                limiteProductos === opt.value ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'
                              }`}>{opt.label}</button>
                          ))}
                        </div>
                      )}
                      {/* Toggle categoría */}
                      <button
                        onClick={() => {
                          const next = !agruparCategoria
                          setAgruparCategoria(next)
                          if (next) {
                            // Inicializar todas colapsadas
                            const todas = sorted.reduce((acc, p) => {
                              const cat = p.categoria || 'Sin categoría'
                              acc[cat] = true
                              return acc
                            }, {})
                            setCategoriasColapsadas(todas)
                          } else {
                            setCategoriasColapsadas({})
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          agruparCategoria
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Por categoría
                      </button>
                      {/* Exportar Excel */}
                      {sorted.length > 0 && (
                        <button
                          onClick={exportarExcel}
                          title="Exportar a Excel"
                          className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cabecera columnas */}
                  {sorted.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-100 mb-1">
                      <span>Producto</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="w-8 text-right">Un</span>
                        <span className="w-20 text-right">Total</span>
                      </div>
                    </div>
                  )}

                  {sorted.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ventas en el período</p>
                  )}

                  {/* Sin agrupación */}
                  {!agruparCategoria && (
                    <>
                      <div className="divide-y divide-gray-50">{lista.map(renderFila)}</div>
                      {limiteProductos && sorted.length > limiteProductos && (
                        <p className="text-xs text-gray-400 text-center mt-3">
                          Mostrando {limiteProductos} de {sorted.length} productos
                        </p>
                      )}
                    </>
                  )}

                  {/* Agrupado por categoría */}
                  {agruparCategoria && grupos && (
                    <div className="space-y-1">
                      {Object.entries(grupos)
                        .sort((a, b) => {
                          const totalA = a[1].reduce((s, p) => s + (criterioProductos === 'total' ? p.total : p.cantidad), 0)
                          const totalB = b[1].reduce((s, p) => s + (criterioProductos === 'total' ? p.total : p.cantidad), 0)
                          return totalB - totalA
                        })
                        .map(([cat, prods]) => {
                          const colapsada = !!categoriasColapsadas[cat]
                          const subtotalCant = prods.reduce((s, p) => s + p.cantidad, 0)
                          const subtotalMonto = prods.reduce((s, p) => s + p.total, 0)
                          return (
                            <div key={cat}>
                              <button
                                onClick={() => toggleCategoria(cat)}
                                className="w-full flex items-center justify-between py-1.5 px-1 rounded hover:bg-orange-50 transition-colors group"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {colapsada
                                    ? <ChevronRight className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                                  <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide truncate">{cat}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 whitespace-nowrap ml-2">
                                  <span className="w-8 text-right">{subtotalCant} un</span>
                                  <span className="w-20 text-right font-semibold">{formatMoney(subtotalMonto)}</span>
                                </div>
                              </button>
                              {!colapsada && (
                                <div className="pl-5 divide-y divide-gray-50">{prods.map(renderFila)}</div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Ventas por hora */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Ventas por hora</h3>
              {kpis.ventasPorHora && Object.values(kpis.ventasPorHora).some(v => v.total > 0) ? (
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
                            style={{ width: `${Math.min(100, (data.total / (kpis.maxVentaHora || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-sm font-medium">{formatMoney(data.total)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Sin ventas en el período</p>
              )}
            </div>
          </div>

          {/* Detalle de Egresos */}
          {kpis.egresosPorConcepto && kpis.egresosPorConcepto.length > 0 && (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowDownCircle size={16} className="text-red-500" /> Detalle de Egresos
              </h3>
              <div className="space-y-2">
                {kpis.egresosPorConcepto.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 truncate block">{e.concepto}</span>
                      <span className="text-xs text-gray-400">{e.cantidad} registro{e.cantidad !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-red-400 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (e.total / (kpis.totalEgresos || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-red-700 w-24 text-right">{formatMoney(e.total)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Total egresos</span>
                  <span className="text-base font-bold text-red-700">{formatMoney(kpis.totalEgresos || 0)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No hay datos para el período seleccionado
        </div>
      )}

      {/* Tendencia mensual - siempre visible independiente del filtro */}
      {tendencia.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-orange-500" />
              Tendencia mensual
            </h3>
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
              {[{ label: '6M', value: 6 }, { label: '12M', value: 12 }, { label: '24M', value: 24 }].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMesesTendencia(opt.value)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    mesesTendencia === opt.value
                      ? 'bg-white shadow text-orange-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={tendencia} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => `$${Math.abs(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip
                formatter={(value, name) => [
                  `$${Number(value).toLocaleString('es-AR')}`,
                  name === 'ingresos' ? 'Ingresos' : name === 'egresos' ? 'Egresos' : 'Resultado'
                ]}
              />
              <Legend formatter={name => name === 'ingresos' ? 'Ingresos' : name === 'egresos' ? 'Egresos' : 'Resultado'} />
              <Bar dataKey="ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} opacity={0.8} />
              <Bar dataKey="egresos" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.8} />
              <Line
                type="monotone"
                dataKey="resultado"
                stroke="#ea580c"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#ea580c' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
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

      {/* Modal detalle de venta */}
      {ventaDetalle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVentaDetalle(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <span className="font-semibold text-gray-800">{ventaDetalle.numero}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                  ventaDetalle.tipo === 'COMANDA' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {ventaDetalle.tipo === 'COMANDA' ? `Mesa ${ventaDetalle.mesa || '?'}` : 'TakeAway'}
                </span>
              </div>
              <button onClick={() => setVentaDetalle(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingDetalle ? (
                <div className="py-8 text-center text-sm text-gray-400">Cargando...</div>
              ) : detalleItems === null ? null : detalleItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Sin detalle disponible</div>
              ) : (
                <div className="space-y-2">
                  {detalleItems.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700">{item.cantidad}x {item.productoBuffet?.nombre || item.producto?.nombre || item.nombre || '—'}</span>
                        {item.observaciones && <p className="text-xs text-gray-400 mt-0.5">{item.observaciones}</p>}
                      </div>
                      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{formatMoney(Number(item.subtotal || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">{ventaDetalle.fecha ? new Date(ventaDetalle.fecha).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}</span>
              <span className="font-bold text-gray-800">{formatMoney(ventaDetalle.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
