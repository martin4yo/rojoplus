import { useState, useEffect } from 'react'
import api from '../../../services/api'
import { Download, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function EvolucionTemporal() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [centros, setCentros] = useState([])
  const [filters, setFilters] = useState({
    centroCostoId: '',
    fechaDesde: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0],
    agrupacion: 'mensual',
  })

  useEffect(() => {
    cargarCentros()
    cargarReporte()
  }, [])

  const cargarCentros = async () => {
    try {
      const response = await api.get('/admin/centros-costo?activo=true')
      setCentros(response.data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const cargarReporte = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(filters.centroCostoId && { centroCostoId: filters.centroCostoId }),
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        agrupacion: filters.agrupacion,
      })
      const response = await api.get(`/admin/centros-costo-evolucion-temporal?${params}`)
      setData(response.data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportar = async () => {
    try {
      const params = new URLSearchParams({
        ...(filters.centroCostoId && { centroCostoId: filters.centroCostoId }),
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        agrupacion: filters.agrupacion,
      })
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/centros-costo-export-evolucion?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evolucion-temporal-${Date.now()}.xlsx`
      a.click()
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)
  }

  // Preparar datos para el gráfico
  const prepararDatosGrafico = () => {
    if (!data || !data.series) return []

    return data.series.map(s => {
      const item = { periodo: s.periodo }
      s.centros.forEach(c => {
        const nombre = c.centro?.nombre || 'Sin Centro'
        item[`${nombre}_ingresos`] = c.ingresos
        item[`${nombre}_egresos`] = c.egresos
        item[`${nombre}_resultado`] = c.resultado
      })
      item.totalIngresos = s.totales.ingresos
      item.totalEgresos = s.totales.egresos
      item.totalResultado = s.totales.resultado
      return item
    })
  }

  const datosGrafico = prepararDatosGrafico()

  // Obtener colores para las líneas
  const colores = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evolución Temporal - Centros de Costo</h1>
          <p className="text-sm text-gray-500">Análisis de tendencias en el tiempo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button
            onClick={cargarReporte}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costo</label>
            <select
              value={filters.centroCostoId}
              onChange={(e) => setFilters({ ...filters, centroCostoId: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Todos</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agrupación</label>
            <select
              value={filters.agrupacion}
              onChange={(e) => setFilters({ ...filters, agrupacion: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={cargarReporte}
            className="w-full md:w-auto px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Gráfico de Ingresos */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolución de Ingresos</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip formatter={(value) => formatMonto(value)} />
                <Legend />
                <Line type="monotone" dataKey="totalIngresos" stroke="#10b981" strokeWidth={2} name="Total Ingresos" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Egresos */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolución de Egresos</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip formatter={(value) => formatMonto(value)} />
                <Legend />
                <Line type="monotone" dataKey="totalEgresos" stroke="#ef4444" strokeWidth={2} name="Total Egresos" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Resultado */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolución de Resultado</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip formatter={(value) => formatMonto(value)} />
                <Legend />
                <Line type="monotone" dataKey="totalResultado" stroke="#3b82f6" strokeWidth={2} name="Resultado" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla detallada */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Detalle por Período</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Egresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.series.map((serie) => (
                    <tr key={serie.periodo} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {serie.periodo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                        {formatMonto(serie.totales.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-medium">
                        {formatMonto(serie.totales.egresos)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        serie.totales.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMonto(serie.totales.resultado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
