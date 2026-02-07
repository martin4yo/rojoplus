import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Store, DollarSign, TrendingUp, Percent, ChevronRight } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import api from '../../services/api'

export default function ReporteComercios() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [comercios, setComercios] = useState([])
  const [reporte, setReporte] = useState(null)
  const [filtros, setFiltros] = useState(() => {
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return {
      desde: primerDiaMes.toISOString().split('T')[0],
      hasta: hoy.toISOString().split('T')[0],
    }
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      // Calcular fechas del mes actual para la carga inicial
      const hoy = new Date()
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const desde = primerDiaMes.toISOString().split('T')[0]
      const hasta = hoy.toISOString().split('T')[0]

      const [comerciosData, reporteData] = await Promise.all([
        api.get('/admin/comercios?estado=ACTIVO'),
        api.get(`/admin/reportes/ventas?desde=${desde}&hasta=${hasta}`),
      ])
      setComercios(comerciosData.comercios || [])
      setReporte(reporteData)
    } catch (err) {
      setError('Error al cargar datos de comercios')
    } finally {
      setLoading(false)
    }
  }

  async function aplicarFiltros(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const reporteData = await api.get(`/admin/reportes/ventas?${params}`)
      setReporte(reporteData)
    } catch (err) {
      setError('Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }

  async function handleExportar() {
    try {
      const params = new URLSearchParams()
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)

      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/reportes/ventas/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Error al exportar')
      }

      // Descargar el archivo
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${filtros.desde || 'inicio'}_${filtros.hasta || 'fin'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Error al exportar el reporte')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/reportes')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reporte de Comercios</h1>
          <p className="text-gray-500 text-sm">Ventas y descuentos otorgados</p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form onSubmit={aplicarFiltros} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
              className="input-field"
            />
          </div>
          <Button type="submit">Filtrar</Button>
          <button
            type="button"
            onClick={handleExportar}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
          >
            Exportar CSV
          </button>
        </form>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-100">
              <Store className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Comercios Activos</p>
              <p className="text-3xl font-bold text-gray-800">{comercios.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Ventas</p>
              <p className="text-3xl font-bold text-gray-800">{reporte?.resumen?.totalVentas || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-100">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monto Vendido</p>
              <p className="text-2xl font-bold text-green-600">
                ${(reporte?.resumen?.montoOriginal || 0).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary-light">
              <Percent className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Descuentos Otorgados</p>
              <p className="text-2xl font-bold text-primary">
                ${(reporte?.resumen?.totalDescuentos || 0).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ventas por comercio */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Ventas por Comercio</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comercio</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ventas</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto Original</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Con Descuento</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Descuento</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(reporte?.porComercio || []).map(item => {
                const participacion = reporte?.resumen?.totalVentas > 0
                  ? Math.round((item.ventas / reporte.resumen.totalVentas) * 100)
                  : 0
                return (
                  <tr
                    key={item.comercioId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/comercios/${item.comercioId}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Store className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-800">{item.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-800">
                      {item.ventas}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      ${item.montoOriginal?.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-800">
                      ${item.monto?.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-right text-primary font-medium">
                      ${item.descuentos?.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-purple-500"
                            style={{ width: `${participacion}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-10">{participacion}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(!reporte?.porComercio || reporte.porComercio.length === 0) && (
          <div className="p-8 text-center text-gray-500">
            No hay ventas registradas en el período seleccionado
          </div>
        )}
      </div>

      {/* Listado de comercios sin ventas */}
      {comercios.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Comercios Adheridos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {comercios.map(comercio => {
              const ventasComercio = reporte?.porComercio?.find(c => c.comercioId === comercio.id)
              return (
                <div
                  key={comercio.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => navigate(`/admin/comercios/${comercio.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Store className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{comercio.nombre}</p>
                      <p className="text-xs text-gray-500">{comercio.descuento}% descuento</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{ventasComercio?.ventas || 0}</p>
                    <p className="text-xs text-gray-500">ventas</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
