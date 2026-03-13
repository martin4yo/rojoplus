import { useState, useEffect } from 'react'
import api from '../../../services/api'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function DashboardEjecutivo() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => {
    cargarDashboard()
  }, [mes, anio])

  const cargarDashboard = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/admin/centros-costo-dashboard-ejecutivo?mes=${mes}&anio=${anio}`)
      setData(response.data)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(monto)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Ejecutivo - Centros de Costo</h1>
          <p className="text-sm text-gray-500">Período: {mes}/{anio}</p>
        </div>
        <button
          onClick={cargarDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow-sm rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('es-AR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Ingresos</p>
                  <p className="mt-2 text-2xl font-bold text-green-600">{formatMonto(data.kpis.totalIngresos)}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-500" />
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Egresos</p>
                  <p className="mt-2 text-2xl font-bold text-red-600">{formatMonto(data.kpis.totalEgresos)}</p>
                </div>
                <TrendingDown className="h-10 w-10 text-red-500" />
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resultado</p>
                  <p className={`mt-2 text-2xl font-bold ${data.kpis.resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatMonto(data.kpis.resultado)}
                  </p>
                  <p className="text-xs text-gray-500">Margen: {data.kpis.margen.toFixed(1)}%</p>
                </div>
                <DollarSign className="h-10 w-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Centros Activos</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{data.kpis.centrosActivos}</p>
                  <p className="text-xs text-red-600">En déficit: {data.kpis.centrosDeficit}</p>
                </div>
                <Building2 className="h-10 w-10 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Alertas */}
          {data.alertas.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Alertas de Desvíos</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    {data.alertas.map((alerta, i) => (
                      <div key={i} className="mt-1">
                        <span className={`font-semibold ${alerta.severidad === 'CRITICA' ? 'text-red-600' : 'text-yellow-700'}`}>
                          [{alerta.severidad}]
                        </span>{' '}
                        {alerta.centro}: {formatMonto(alerta.monto)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico Top Ingresos/Egresos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Ingresos</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topIngresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMonto(value)} />
                  <Bar dataKey="ingresos" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Egresos</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topEgresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMonto(value)} />
                  <Bar dataKey="egresos" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla de centros */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Detalle por Centro</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Centro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Egresos</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Resultado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Trans.</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.centros.map((centro) => (
                    <tr key={centro.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{centro.nombre}</div>
                        <div className="text-xs text-gray-500">{centro.tipo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                        {formatMonto(centro.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-medium">
                        {formatMonto(centro.egresos)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        centro.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMonto(centro.resultado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {centro.transacciones}
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
