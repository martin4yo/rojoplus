import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Package, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function AlertasStock() {
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarAlertas()
  }, [])

  async function cargarAlertas() {
    setLoading(true)
    try {
      const res = await api.getFull('/admin/stock/alertas')
      setAlertas(res.data || [])
    } catch (err) {
      console.error('Error cargando alertas:', err)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar por producto
  const productosAgrupados = alertas.reduce((acc, alerta) => {
    const key = alerta.productoId
    if (!acc[key]) {
      acc[key] = {
        productoId: alerta.productoId,
        productoCodigo: alerta.productoCodigo,
        productoNombre: alerta.productoNombre,
        variantes: []
      }
    }
    acc[key].variantes.push(alerta)
    return acc
  }, {})

  const productosArray = Object.values(productosAgrupados)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${alertas.length > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
            <AlertTriangle className={`w-6 h-6 ${alertas.length > 0 ? 'text-orange-600' : 'text-green-600'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Alertas de Stock</h1>
            <p className="text-gray-500 text-sm">
              {alertas.length === 0
                ? 'No hay productos con stock bajo'
                : `${alertas.length} variantes con stock bajo el minimo`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={cargarAlertas}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Link to="/admin/stock/movimientos/ajuste">
            <Button>Ajustar Stock</Button>
          </Link>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <LoadingSpinner />
      ) : alertas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Todo en orden</h2>
          <p className="text-gray-500">No hay productos con stock por debajo del minimo establecido.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productosArray.map(producto => (
            <div
              key={producto.productoId}
              className="bg-white rounded-lg shadow-sm border border-orange-200 overflow-hidden"
            >
              {/* Cabecera del producto */}
              <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <div>
                    <span className="font-mono text-sm text-orange-700 bg-orange-100 px-2 py-0.5 rounded mr-2">
                      {producto.productoCodigo}
                    </span>
                    <span className="font-semibold text-gray-800">{producto.productoNombre}</span>
                  </div>
                </div>
                <Link
                  to={`/admin/stock/productos/${producto.productoId}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver producto <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Lista de variantes con bajo stock */}
              <div className="divide-y">
                {producto.variantes.map(v => {
                  const porcentaje = v.stockMinimo > 0
                    ? Math.round((v.stockActual / v.stockMinimo) * 100)
                    : 0
                  const esCritico = v.stockActual === 0

                  return (
                    <div
                      key={v.id}
                      className={`px-4 py-3 flex items-center justify-between ${esCritico ? 'bg-red-50' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-xs text-gray-500">Talle</p>
                          <p className="font-bold text-gray-800">{v.talle}</p>
                          {v.color && (
                            <p className="text-xs text-gray-500">{v.color}</p>
                          )}
                        </div>

                        {/* Barra de progreso */}
                        <div className="w-32">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                porcentaje === 0
                                  ? 'bg-red-500'
                                  : porcentaje < 50
                                  ? 'bg-orange-500'
                                  : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(100, porcentaje)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-center">
                            {porcentaje}% del minimo
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Stock Actual</p>
                          <p className={`text-xl font-bold ${esCritico ? 'text-red-600' : 'text-orange-600'}`}>
                            {v.stockActual}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Minimo</p>
                          <p className="text-xl font-medium text-gray-600">{v.stockMinimo}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Faltan</p>
                          <p className="text-xl font-bold text-red-600">
                            {Math.max(0, v.stockMinimo - v.stockActual)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resumen al final */}
      {alertas.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-6 justify-center text-center">
            <div>
              <p className="text-sm text-gray-500">Productos Afectados</p>
              <p className="text-2xl font-bold text-gray-800">{productosArray.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Variantes Bajo Minimo</p>
              <p className="text-2xl font-bold text-orange-600">{alertas.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sin Stock (Critico)</p>
              <p className="text-2xl font-bold text-red-600">
                {alertas.filter(a => a.stockActual === 0).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
