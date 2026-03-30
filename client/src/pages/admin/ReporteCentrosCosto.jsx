import { useState, useEffect } from 'react'
import api from '../../services/api'
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { BarChart3 } from 'lucide-react'

export default function ReporteCentrosCosto() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    // Inicializar con el mes actual
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    setFechaDesde(primerDiaMes.toISOString().split('T')[0])
    setFechaHasta(hoy.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      cargarReporte()
    }
  }, [fechaDesde, fechaHasta])

  const cargarReporte = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/centros-costo-reporte-comparativo', {
        params: { fechaDesde, fechaHasta }
      })
      setData(response.data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Error cargando reporte:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monto)
  }

  const formatPorcentaje = (porcentaje) => {
    return `${porcentaje.toFixed(1)}%`
  }

  const exportarExcel = async () => {
    try {
      const params = new URLSearchParams({
        fechaDesde,
        fechaHasta,
      })
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/centros-costo-export-comparativo?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `centros-costo-${Date.now()}.xlsx`
      a.click()
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  const exportarPDF = async () => {
    try {
      const params = new URLSearchParams({
        fechaDesde,
        fechaHasta,
        formato: 'pdf',
      })
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/centros-costo-export-comparativo?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `centros-costo-${Date.now()}.pdf`
      a.click()
    } catch (err) {
      console.error('Error al exportar:', err)
    }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estado de Resultados por Centro de Costo</h1>
            <p className="text-sm text-gray-500">Análisis multidimensional de ingresos y egresos</p>
          </div>
        </div>
        {data && (
          <div className="flex gap-2">
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={exportarPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Resumen General */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Ingresos</p>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {formatMonto(data.resumenGeneral.totalIngresos)}
                  </p>
                </div>
                <ArrowTrendingUpIcon className="h-12 w-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Egresos</p>
                  <p className="mt-2 text-3xl font-bold text-red-600">
                    {formatMonto(data.resumenGeneral.totalEgresos)}
                  </p>
                </div>
                <ArrowTrendingDownIcon className="h-12 w-12 text-red-500" />
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resultado</p>
                  <p className={`mt-2 text-3xl font-bold ${
                    data.resumenGeneral.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatMonto(data.resumenGeneral.resultado)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {data.resumenGeneral.tipo}
                  </p>
                </div>
                <ChartBarIcon className={`h-12 w-12 ${
                  data.resumenGeneral.resultado >= 0 ? 'text-green-500' : 'text-red-500'
                }`} />
              </div>
            </div>
          </div>

          {/* Top 5 Ingresos y Egresos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Ingresos */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="bg-green-50 px-6 py-3 border-b border-green-200">
                <h2 className="text-lg font-semibold text-green-900">Top 5 Ingresos</h2>
              </div>
              <div className="p-6">
                {data.topIngresos.length > 0 ? (
                  <div className="space-y-4">
                    {data.topIngresos.map((centro, index) => (
                      <div key={centro.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 font-bold text-sm">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{centro.nombre}</p>
                            <p className="text-xs text-gray-500">{formatPorcentaje(centro.porcentajeIngresos)} del total</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-green-600">
                          {formatMonto(centro.ingresos)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">Sin ingresos en el período</p>
                )}
              </div>
            </div>

            {/* Top Egresos */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="bg-red-50 px-6 py-3 border-b border-red-200">
                <h2 className="text-lg font-semibold text-red-900">Top 5 Egresos</h2>
              </div>
              <div className="p-6">
                {data.topEgresos.length > 0 ? (
                  <div className="space-y-4">
                    {data.topEgresos.map((centro, index) => (
                      <div key={centro.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-800 font-bold text-sm">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{centro.nombre}</p>
                            <p className="text-xs text-gray-500">{formatPorcentaje(centro.porcentajeEgresos)} del total</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-red-600">
                          {formatMonto(centro.egresos)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">Sin egresos en el período</p>
                )}
              </div>
            </div>
          </div>

          {/* Tabla Detallada */}
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Detalle por Centro de Costo</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Centro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ingresos
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % Ing.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Egresos
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % Egr.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resultado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.centros.map((centro) => (
                    <tr key={centro.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{centro.nombre}</div>
                          <div className="text-xs text-gray-500">{centro.codigo}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          centro.tipo === 'OPERATIVO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {centro.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                        {formatMonto(centro.ingresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {formatPorcentaje(centro.porcentajeIngresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-medium">
                        {formatMonto(centro.egresos)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {formatPorcentaje(centro.porcentajeEgresos)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                        centro.resultado >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatMonto(centro.resultado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan="2" className="px-6 py-4 text-sm text-gray-900">
                      TOTAL
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-700">
                      {formatMonto(data.resumenGeneral.totalIngresos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      100%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-700">
                      {formatMonto(data.resumenGeneral.totalEgresos)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      100%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm ${
                      data.resumenGeneral.resultado >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {formatMonto(data.resumenGeneral.resultado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
