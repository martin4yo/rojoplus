import { useState, useEffect } from 'react'
import { LayoutGrid } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { formatCurrency } from '../../../utils/formatters'

const toISO = d => d.toISOString().split('T')[0]

const RANGOS = [
  { id: 'mes', label: 'Este Mes', getDates: () => {
    const hoy = new Date()
    return { desde: toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: toISO(hoy) }
  }},
  { id: 'mesAnterior', label: 'Mes Anterior', getDates: () => {
    const hoy = new Date()
    return {
      desde: toISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      hasta: toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    }
  }},
  { id: 'anio', label: 'Este Año', getDates: () => {
    const hoy = new Date()
    return { desde: toISO(new Date(hoy.getFullYear(), 0, 1)), hasta: toISO(hoy) }
  }},
  { id: 'personalizado', label: 'Personalizado', getDates: () => null },
]

const fmt = (n) => formatCurrency(n || 0, { showSymbol: false })

export default function ReporteMatriz() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rango, setRango] = useState('mes')
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date()
    return toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  })
  const [fechaHasta, setFechaHasta] = useState(() => toISO(new Date()))
  const [ocultarVacios, setOcultarVacios] = useState(true)

  useEffect(() => {
    cargarReporte(fechaDesde, fechaHasta)
  }, [])

  async function cargarReporte(desde, hasta) {
    try {
      setLoading(true)
      const response = await api.get('/admin/centros-costo-reporte-matriz', {
        params: { fechaDesde: desde, fechaHasta: hasta },
      })
      setData(response)
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }

  function handleRango(id) {
    setRango(id)
    if (id !== 'personalizado') {
      const fechas = RANGOS.find(r => r.id === id).getDates()
      setFechaDesde(fechas.desde)
      setFechaHasta(fechas.hasta)
      cargarReporte(fechas.desde, fechas.hasta)
    }
  }

  function aplicarPersonalizado() {
    if (fechaDesde && fechaHasta) cargarReporte(fechaDesde, fechaHasta)
  }

  const centros = data?.centros || []
  const filas = ocultarVacios
    ? centros.filter(c =>
        c.ingresos.devengado || c.ingresos.cobrado || c.ingresos.pendiente ||
        c.egresos.devengado || c.egresos.pagado || c.egresos.pendiente
      )
    : centros

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <LayoutGrid className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reporte Matriz por Centro de Costo</h1>
          <p className="text-gray-500 text-sm">Devengado, Cobrado/Pagado y Pendiente por centro</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {RANGOS.map(r => (
              <button
                key={r.id}
                onClick={() => handleRango(r.id)}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  rango === r.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {rango === 'personalizado' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Desde</label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="input-field text-sm" />
              </div>
              <button onClick={aplicarPersonalizado} className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
                Aplicar
              </button>
            </>
          )}
          <label className="flex items-center gap-2 ml-auto text-sm text-gray-600">
            <input type="checkbox" checked={ocultarVacios} onChange={e => setOcultarVacios(e.target.checked)} className="rounded" />
            Ocultar CCs sin movimientos
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : filas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          No hay movimientos en el período seleccionado.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th rowSpan={2} className="text-left px-4 py-2 font-medium text-gray-700 align-bottom">
                  Centro de Costo
                </th>
                <th colSpan={3} className="text-center px-4 py-2 font-medium text-green-700 border-l border-gray-200">
                  INGRESOS
                </th>
                <th colSpan={3} className="text-center px-4 py-2 font-medium text-red-700 border-l border-gray-200">
                  EGRESOS
                </th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="text-right px-3 py-2 font-medium text-gray-600 border-l border-gray-200">Devengado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Cobrado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Pendiente</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 border-l border-gray-200">Devengado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Pagado</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(cc => (
                <tr key={cc.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-800">{cc.nombre}</div>
                    <div className="text-xs text-gray-500">{cc.codigo}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono border-l border-gray-100 text-gray-700">{fmt(cc.ingresos.devengado)}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{fmt(cc.ingresos.cobrado)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cc.ingresos.pendiente > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {fmt(cc.ingresos.pendiente)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono border-l border-gray-100 text-gray-700">{fmt(cc.egresos.devengado)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-700">{fmt(cc.egresos.pagado)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cc.egresos.pendiente > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {fmt(cc.egresos.pendiente)}
                  </td>
                </tr>
              ))}
            </tbody>
            {data?.totales && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-gray-800">TOTAL</td>
                  <td className="px-3 py-3 text-right font-mono border-l border-gray-200 text-gray-800">{fmt(data.totales.ingresos.devengado)}</td>
                  <td className="px-3 py-3 text-right font-mono text-green-700">{fmt(data.totales.ingresos.cobrado)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600">{fmt(data.totales.ingresos.pendiente)}</td>
                  <td className="px-3 py-3 text-right font-mono border-l border-gray-200 text-gray-800">{fmt(data.totales.egresos.devengado)}</td>
                  <td className="px-3 py-3 text-right font-mono text-red-700">{fmt(data.totales.egresos.pagado)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600">{fmt(data.totales.egresos.pendiente)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p><strong>Devengado:</strong> obligación generada en el período (cuotas generadas, facturas emitidas/recibidas, liquidaciones, ingresos/egresos directos).</p>
        <p><strong>Cobrado/Pagado:</strong> movimientos de caja del período.</p>
        <p><strong>Pendiente:</strong> saldo al "hasta" (cuotas impagas + facturas con saldo + liquidaciones sin pagar).</p>
      </div>
    </div>
  )
}
