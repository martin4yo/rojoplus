import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Dumbbell } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'

export default function AdminReportes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reporte, setReporte] = useState(null)
  const { showModal, ModalComponent } = useModal()

  const [filtros, setFiltros] = useState({
    desde: '',
    hasta: '',
    comercioId: '',
  })

  const [comercios, setComercios] = useState([])

  useEffect(() => {
    cargarComercios()
    cargarReporte()
  }, [])

  async function cargarComercios() {
    try {
      const data = await api.get('/admin/comercios?estado=ACTIVO')
      setComercios(data.comercios || [])
    } catch (err) {
      console.error('Error cargando comercios:', err)
    }
  }

  async function cargarReporte() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      if (filtros.comercioId) params.append('comercioId', filtros.comercioId)

      const data = await api.get(`/admin/reportes/ventas?${params}`)
      setReporte(data)
    } catch (err) {
      setError('Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }

  function handleFiltrar(e) {
    e.preventDefault()
    cargarReporte()
  }

  async function handleExportar(formato) {
    try {
      const params = new URLSearchParams({ formato })
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      if (filtros.comercioId) params.append('comercioId', filtros.comercioId)

      // Abrir en nueva ventana para descargar
      const token = localStorage.getItem('adminToken')
      window.open(`/api/admin/reportes/ventas/export?${params}&token=${token}`, '_blank')
    } catch (err) {
      showModal({
        type: 'error',
        message: 'Error al exportar el reporte',
      })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reportes</h1>

      {/* Accesos rápidos a otros reportes */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition"
          onClick={() => navigate('/admin/reportes/actividades')}
        >
          <div className="p-3 rounded-lg bg-orange-100">
            <Dumbbell className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Actividades</p>
            <p className="text-xs text-gray-500">Ver inscriptos por actividad y categoría</p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <form onSubmit={handleFiltrar} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Comercio
            </label>
            <select
              value={filtros.comercioId}
              onChange={(e) => setFiltros({ ...filtros, comercioId: e.target.value })}
              className="input-field"
            >
              <option value="">Todos</option>
              {comercios.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <Button type="submit">Filtrar</Button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExportar('csv')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => handleExportar('xlsx')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            >
              Exportar Excel
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-sm">Total Ventas</p>
              <p className="text-3xl font-bold text-gray-800">
                {reporte?.resumen?.totalVentas || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-sm">Monto Original</p>
              <p className="text-2xl font-bold text-gray-800">
                $ {(reporte?.resumen?.montoOriginal || 0).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-sm">Monto con Descuento</p>
              <p className="text-2xl font-bold text-primary">
                $ {(reporte?.resumen?.montoConDescuento || 0).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-sm">Total Descuentos</p>
              <p className="text-2xl font-bold text-green-600">
                $ {(reporte?.resumen?.totalDescuentos || 0).toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          {/* Ventas por comercio */}
          {reporte?.porComercio?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Ventas por Comercio</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Comercio
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Ventas
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reporte.porComercio.map((item) => (
                    <tr key={item.comercioId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {item.nombre}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {item.ventas}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-800 font-medium">
                        $ {item.monto?.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {ModalComponent}
    </div>
  )
}
