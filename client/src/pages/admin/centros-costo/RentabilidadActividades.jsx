import { useState, useEffect } from 'react'
import api from '../../../services/api'
import { Download, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function RentabilidadActividades() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [centros, setCentros] = useState([])
  const [filters, setFilters] = useState({
    centroCostoId: '',
    fechaDesde: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    cargarCentros()
    cargarReporte()
  }, [])

  const cargarCentros = async () => {
    try {
      // api.get ya devuelve el `data` de la respuesta: es el array, no {data:[...]}
      const centrosData = await api.get('/admin/centros-costo?activo=true')
      setCentros(centrosData || [])
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
      })
      const response = await api.get(`/admin/centros-costo-rentabilidad-actividades?${params}`)
      setData(response)
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
      })
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/centros-costo-export-rentabilidad?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rentabilidad-actividades-${Date.now()}.xlsx`
      a.click()
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rentabilidad por Actividad</h1>
          <p className="text-sm text-gray-500">Análisis de ingresos vs costos por actividad deportiva</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <LoadingSpinner />
      )}

      {data && !loading && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600">Total Ingresos</p>
              <p className="mt-2 text-2xl font-bold text-green-600">{formatMonto(data.resumen.totalIngresos)}</p>
            </div>
            <div className="bg-white shadow-sm rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600">Total Costos</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{formatMonto(data.resumen.totalCostos)}</p>
            </div>
            <div className="bg-white shadow-sm rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600">Resultado</p>
              <p className={`mt-2 text-2xl font-bold ${data.resumen.totalResultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMonto(data.resumen.totalResultado)}
              </p>
            </div>
            <div className="bg-white shadow-sm rounded-lg p-6">
              <p className="text-sm font-medium text-gray-600">Total Inscripciones</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{data.resumen.totalInscripciones}</p>
            </div>
          </div>

          {/* Top Rentables y Menos Rentables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Rentables */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Top 10 Más Rentables</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topRentables} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="actividad.nombre" width={150} />
                  <Tooltip formatter={(value) => formatMonto(value)} />
                  <Bar dataKey="resultado" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Menos Rentables */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900">Top 10 Menos Rentables</h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.menosRentables} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="actividad.nombre" width={150} />
                  <Tooltip formatter={(value) => formatMonto(value)} />
                  <Bar dataKey="resultado" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Detalle por Actividad</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centro</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actividad</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Insc.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.actividades.map((act, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {act.centroCosto.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {act.actividad.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {act.inscripciones}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                        {formatMonto(act.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-medium">
                        {formatMonto(act.costos)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        act.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMonto(act.resultado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {act.margen.toFixed(1)}%
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
