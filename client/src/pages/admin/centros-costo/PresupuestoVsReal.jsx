import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { Download, RefreshCw, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function PresupuestoVsReal() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [centros, setCentros] = useState([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [centroCostoId, setCentroCostoId] = useState('')

  useEffect(() => {
    cargarCentros()
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
        anio,
        ...(centroCostoId && { centroCostoId }),
      })
      const response = await api.get(`/admin/centros-costo-presupuesto-vs-real?${params}`)
      setData(response.data)
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.message || 'No se encontró presupuesto aprobado para el año')
    } finally {
      setLoading(false)
    }
  }

  const exportar = async () => {
    try {
      const params = new URLSearchParams({
        anio,
        ...(centroCostoId && { centroCostoId }),
      })
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/centros-costo-export-presupuesto?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presupuesto-vs-real-${anio}.xlsx`
      a.click()
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)
  }

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto vs Real - Centros de Costo</h1>
          <p className="text-sm text-gray-500">Comparación de presupuesto y ejecución real</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportar}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costo</label>
            <select
              value={centroCostoId}
              onChange={(e) => setCentroCostoId(e.target.value)}
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
          {/* Info del presupuesto */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Presupuesto: {data.presupuesto.nombre || `Año ${data.anio}`}
                </p>
                <p className="text-xs text-blue-700">Estado: APROBADO</p>
              </div>
            </div>
          </div>

          {/* Tabla y gráficos por centro */}
          {data.centros.map((centro) => (
            <div key={centro.centro.id || 'sin_centro'} className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h2 className="text-lg font-semibold text-gray-900">{centro.centro.nombre}</h2>
                <div className="mt-1 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Presupuestado:</span>
                    <span className="ml-2 font-medium text-blue-600">{formatMonto(centro.totales.presupuestado)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Real:</span>
                    <span className="ml-2 font-medium text-purple-600">{formatMonto(centro.totales.real)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Desvío:</span>
                    <span className={`ml-2 font-bold ${centro.totales.desvio >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMonto(centro.totales.desvio)} ({centro.totales.desvioPorc.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Gráfico */}
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={centro.meses.map(m => ({
                    ...m,
                    mesNombre: meses[m.mes - 1],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mesNombre" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatMonto(value)} />
                    <Legend />
                    <Bar dataKey="presupuestado" fill="#3b82f6" name="Presupuestado" />
                    <Bar dataKey="real" fill="#8b5cf6" name="Real" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla mensual */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Presupuestado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Real</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Desvío</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Desvío %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {centro.meses.map((mes) => (
                      <tr key={mes.mes} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {meses[mes.mes - 1]}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600">
                          {formatMonto(mes.presupuestado)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-purple-600">
                          {formatMonto(mes.real)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          mes.desvio >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatMonto(mes.desvio)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${
                          Math.abs(mes.desvioPorc) > 20 ? 'font-bold text-red-600' : 'text-gray-600'
                        }`}>
                          {mes.desvioPorc.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-600">
                        {formatMonto(centro.totales.presupuestado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-purple-600">
                        {formatMonto(centro.totales.real)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        centro.totales.desvio >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatMonto(centro.totales.desvio)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        Math.abs(centro.totales.desvioPorc) > 20 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {centro.totales.desvioPorc.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
