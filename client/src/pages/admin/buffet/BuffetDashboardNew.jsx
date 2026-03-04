import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Receipt,
  Clock, ChefHat, Coffee, Truck, Calendar, RefreshCw, ArrowRight,
  CreditCard, Banknote, QrCode, Eye, FileText, Printer
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import TicketPreview from '../../../components/buffet/TicketPreview'

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
  const puedeCobrar = tienePermiso(PERMISOS.BUFFET_COBRAR) || tienePermiso(PERMISOS.BUFFET_KIOSCO)

  const [rangoSeleccionado, setRangoSeleccionado] = useState('hoy')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  const [ventas, setVentas] = useState([])
  const [cargandoVentas, setCargandoVentas] = useState(false)

  // Preview de ticket
  const [previewTicket, setPreviewTicket] = useState(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

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

  // Cargar ventas del período
  const cargarVentas = useCallback(async () => {
    if (!puedeCobrar) return

    setCargandoVentas(true)
    try {
      const { desde, hasta } = obtenerFechas()
      if (!desde || !hasta) {
        setCargandoVentas(false)
        return
      }

      const params = new URLSearchParams({
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        limit: '50'
      })

      const res = await api.get(`/admin/buffet/ventas-periodo?${params}`)
      const data = res?.data || res || []
      setVentas(data)
    } catch (err) {
      console.error('Error cargando ventas:', err)
    } finally {
      setCargandoVentas(false)
    }
  }, [obtenerFechas, puedeCobrar])

  useEffect(() => {
    cargarDatos()
    cargarVentas()
  }, [cargarDatos, cargarVentas])

  // Ver preview del ticket
  const verPreviewTicket = async (venta) => {
    setCargandoPreview(true)
    try {
      const tipo = venta.tipo === 'COMANDA' ? 'comanda' : 'takeaway'
      const data = await api.getFull(`/admin/buffet/preview-ticket/${tipo}/${venta.id}`)

      if (data.comprobante?.cae) {
        setPreviewTicket({
          tipo: 'FISCAL',
          empresa: data.empresa || {},
          comprobante: {
            tipo: data.comprobante.tipo,
            puntoVenta: data.comprobante.puntoVenta,
            numero: data.comprobante.numero,
            fecha: data.comprobante.fecha || venta.fecha,
            cae: data.comprobante.cae,
            fechaVtoCae: data.comprobante.fechaVtoCae
          },
          cliente: {
            nombre: data.comprobante.nombreReceptor || 'Consumidor Final',
            documento: data.comprobante.docReceptor,
            tipoDoc: data.comprobante.tipoDocReceptor || 99,
            condicionIva: data.comprobante.condicionIvaReceptor === 5 ? 'Consumidor Final' :
                          data.comprobante.condicionIvaReceptor === 1 ? 'IVA Responsable Inscripto' :
                          data.comprobante.condicionIvaReceptor === 6 ? 'Responsable Monotributo' : 'Consumidor Final'
          },
          items: (data.items || []).map(item => ({
            cantidad: item.cantidad,
            nombre: item.nombre,
            precio: Number(item.precioUnitario || item.precio || 0),
            subtotal: Number(item.subtotal || (item.cantidad * (item.precioUnitario || item.precio || 0)))
          })),
          subtotal: Number(data.comprobante.neto || 0),
          iva: Number(data.comprobante.iva || 0),
          total: Number(data.comprobante.total || venta.total),
          discriminaIva: data.comprobante.tipoAfip === 1,
          medioPago: data.medioPago || 'VARIOS',
          qrUrl: data.qrUrl
        })
      } else {
        setPreviewTicket({
          tipo: venta.tipo === 'COMANDA' ? 'CUENTA' : 'TAKEAWAY',
          numero: data.comanda?.numero || data.pedido?.numero || venta.numero,
          mesa: venta.mesa,
          cliente: venta.socio || venta.cliente,
          fecha: venta.fecha,
          items: (data.items || []).map(item => ({
            cantidad: item.cantidad,
            nombre: item.nombre,
            precio: Number(item.precioUnitario || item.precio || 0)
          })),
          total: venta.total,
          medioPago: data.medioPago || 'VARIOS'
        })
      }
    } catch (err) {
      console.error('Error cargando preview:', err)
      toast.error('Error al cargar preview del ticket')
    } finally {
      setCargandoPreview(false)
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
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Buffet</h1>
          <p className="text-gray-500 text-sm">Estadísticas y métricas de ventas</p>
        </div>

        {/* Filtros de fecha */}
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => { cargarDatos(); cargarVentas() }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

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
            onClick={() => { cargarDatos(); cargarVentas() }}
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

          {/* Productos más vendidos y Ventas por hora */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Productos */}
            {kpis.topProductos && kpis.topProductos.length > 0 && (
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Productos más vendidos</h3>
                <div className="space-y-3">
                  {kpis.topProductos.slice(0, 5).map((prod, idx) => (
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
              </div>
            )}

            {/* Ventas por hora (solo para hoy) */}
            {kpis.ventasPorHora && rangoSeleccionado === 'hoy' && (
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

      {/* Tabla de Ventas */}
      {puedeCobrar && (
        <div className="bg-white rounded-xl shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Receipt className="text-green-600" size={20} />
              Ventas del Período
              {ventas.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  {ventas.length}
                </span>
              )}
            </h3>
            {cargandoVentas && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            )}
          </div>

          {ventas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No hay ventas en el período seleccionado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comprobante</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ventas.map(venta => (
                    <tr key={`${venta.tipo}-${venta.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(venta.fecha).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          venta.tipo === 'COMANDA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {venta.tipo === 'COMANDA' ? `Mesa ${venta.mesa}` : 'TakeAway'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{venta.numero}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {venta.socio || venta.cliente || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {venta.comprobante ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <FileText size={14} />
                            {venta.comprobante.tipo} {venta.comprobante.puntoVenta}-{venta.comprobante.numero}
                          </span>
                        ) : venta.esVentaInterna ? (
                          <span className="text-amber-600">Venta Interna</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatMoney(venta.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => verPreviewTicket(venta)}
                          disabled={cargandoPreview}
                          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                          title="Ver ticket"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Preview Ticket */}
      {previewTicket && (
        <TicketPreview
          ticket={previewTicket}
          onClose={() => setPreviewTicket(null)}
          onPrint={() => setPreviewTicket(null)}
          onPrintAsImage={async (imageBase64, impresoraId) => {
            console.log('[Dashboard] onPrintAsImage - impresoraId:', impresoraId)
            try {
              const res = await api.postFull('/admin/buffet/imprimir-imagen', {
                imagen: imageBase64,
                impresoraId
              })
              console.log('[Dashboard] Respuesta del servidor:', res)
              if (res?.success) {
                toast.success(`Ticket enviado a ${res.impresora || 'impresora'}`)
                setPreviewTicket(null)
              } else {
                console.log('[Dashboard] Error en respuesta:', res?.error)
                toast.error(res?.error || 'Error al imprimir')
              }
            } catch (err) {
              console.error('[Dashboard] Error enviando imagen:', err)
              toast.error(err.message || 'Error al enviar a impresora')
            }
          }}
        />
      )}
    </div>
  )
}
