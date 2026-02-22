import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Package, Search, Eye, Edit, AlertTriangle, Image, LayoutGrid, List, ArrowUpDown, Download } from 'lucide-react'
import { Button } from '../../../components/Button'
import Table from '../../../components/Table'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatCurrency } from '../../../utils/formatters'
import { usePagination } from '../../../hooks/usePagination'
import Pagination from '../../../components/Pagination'

export default function ProductosLista() {
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState(null)

  // Vista: 'shop' o 'lista'
  const [vista, setVista] = useState(() => {
    return localStorage.getItem('productosVista') || 'shop'
  })

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [soloConStock, setSoloConStock] = useState(false)
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)
  const { page, pagination, setPagination, goToPage } = usePagination(1, vista === 'shop' ? 24 : 50)

  useEffect(() => {
    cargarCategorias()
    cargarResumen()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      goToPage(1)
      cargarProductos()
    }, 300)
    return () => clearTimeout(timer)
  }, [busqueda, categoriaId, soloActivos, soloConStock, soloBajoMinimo, goToPage])

  useEffect(() => {
    cargarProductos()
  }, [page])

  useEffect(() => {
    localStorage.setItem('productosVista', vista)
  }, [vista])

  async function cargarProductos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busqueda) params.append('busqueda', busqueda)
      if (categoriaId) params.append('categoriaId', categoriaId)
      if (soloActivos) params.append('activo', 'true')
      params.append('page', page)
      params.append('limit', vista === 'shop' ? 24 : 50)

      const res = await api.getFull(`/admin/productos?${params}`)
      let data = res.data || []

      // Filtros adicionales del lado cliente
      if (soloConStock) {
        data = data.filter(p => p.stockTotal > 0)
      }
      if (soloBajoMinimo) {
        data = data.filter(p => p.variantes?.some(v => parseFloat(v.stockActual) < parseFloat(v.stockMinimo)))
      }

      setProductos(data)
      setPagination(res.pagination || { total: 0, totalPages: 1 })
    } catch (err) {
      console.error('Error cargando productos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarCategorias() {
    try {
      const res = await api.getFull('/admin/categorias-producto?activo=true')
      setCategorias(res.data || [])
    } catch (err) {
      console.error('Error cargando categorias:', err)
    }
  }

  async function cargarResumen() {
    try {
      const res = await api.getFull('/admin/stock/resumen')
      setResumen(res.data)
    } catch (err) {
      console.error('Error cargando resumen:', err)
    }
  }


  function exportarCSV() {
    const headers = ['Codigo', 'Nombre', 'Categoria', 'Stock', 'Precio Venta', 'Valor Stock']
    const rows = productos.map(p => [
      p.codigo,
      p.nombre,
      p.categoria?.nombre || '',
      p.stockTotal,
      formatCurrency(p.precioVenta || 0, { showSymbol: false }),
      formatCurrency((parseFloat(p.precioVenta) || 0) * (parseFloat(p.stockTotal) || 0), { showSymbol: false })
    ])

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Define columns for Table component
  const columns = [
    {
      key: 'fotoPrincipal',
      label: 'Foto',
      sortable: false,
      className: 'w-16',
      render: (producto) => (
        <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden">
          {producto.fotoPrincipal ? (
            <img
              src={producto.fotoPrincipal}
              alt={producto.nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="w-6 h-6 text-gray-300" />
            </div>
          )}
        </div>
      )
    },
    {
      key: 'codigo',
      label: 'Codigo',
      sortable: true,
      render: (producto) => (
        <span className="font-mono text-sm text-gray-600">{producto.codigo}</span>
      )
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      render: (producto) => (
        <div>
          <p className="font-medium text-gray-800">{producto.nombre}</p>
          {!producto.activo && (
            <span className="text-xs text-gray-400">(Inactivo)</span>
          )}
        </div>
      )
    },
    {
      key: 'categoriaNombre',
      label: 'Categoria',
      sortable: true,
      className: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (producto) => (
        producto.categoria ? (
          <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
            {producto.categoria.nombre}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    {
      key: 'stockTotal',
      label: 'Stock',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right',
      render: (producto) => {
        const bajoMinimo = producto.variantes?.some(v => parseFloat(v.stockActual) < parseFloat(v.stockMinimo))
        return (
          <div className="flex items-center justify-end gap-1">
            <span className={`font-semibold ${producto.stockTotal <= 0 ? 'text-red-500' : bajoMinimo ? 'text-orange-500' : 'text-gray-800'}`}>
              {producto.stockTotal}
            </span>
            {bajoMinimo && (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            )}
          </div>
        )
      }
    },
    {
      key: 'precioVenta',
      label: 'Precio',
      sortable: true,
      className: 'text-right hidden sm:table-cell',
      cellClassName: 'text-right hidden sm:table-cell',
      render: (producto) => (
        <span className="text-gray-800">{formatCurrency(parseFloat(producto.precioVenta) || 0)}</span>
      )
    },
    {
      key: 'valorStock',
      label: 'Valor Stock',
      sortable: true,
      className: 'text-right hidden lg:table-cell',
      cellClassName: 'text-right hidden lg:table-cell',
      render: (producto) => {
        const valorStock = (parseFloat(producto.precioVenta) || 0) * (parseFloat(producto.stockTotal) || 0)
        return (
          <span className="font-semibold text-green-600">{formatCurrency(valorStock)}</span>
        )
      }
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      className: 'text-center w-24',
      cellClassName: 'text-center',
      render: (producto) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/stock/productos/${producto.id}`)
            }}
            className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/stock/movimientos?productoId=${producto.id}`)
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Ver movimientos"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          {tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/stock/productos/${producto.id}?editar=true`)
              }}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
            <p className="text-gray-500 text-sm">{pagination.total} productos en catalogo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vista === 'lista' && (
            <Button variant="secondary" onClick={exportarCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          )}
{tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
            <Button onClick={() => navigate('/admin/stock/productos/nuevo')}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Productos Activos</p>
            <p className="text-2xl font-bold text-gray-800">{resumen.totalProductos}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Variantes</p>
            <p className="text-2xl font-bold text-gray-800">{resumen.totalVariantes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Valor Stock (Venta)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(resumen.valorStockVenta)}</p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm border p-4 ${resumen.variantesBajoMinimo > 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
            <p className="text-sm text-gray-500">Bajo Stock</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${resumen.variantesBajoMinimo > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                {resumen.variantesBajoMinimo}
              </p>
              {resumen.variantesBajoMinimo > 0 && (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Busqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por codigo o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>

          {/* Categoria */}
          <div className="sm:w-48">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todas las categorias</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          {/* Checkboxes de filtro */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-600">Solo activos</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={soloConStock}
                onChange={(e) => setSoloConStock(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-600">Con stock</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={soloBajoMinimo}
                onChange={(e) => setSoloBajoMinimo(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-orange-600">Bajo minimo</span>
            </label>
          </div>

          {/* Toggle Vista */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setVista('shop')}
              className={`p-2 rounded-md transition ${vista === 'shop' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista Shop"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`p-2 rounded-md transition ${vista === 'lista' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista Lista"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : productos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay productos que coincidan con la busqueda</p>
        </div>
      ) : vista === 'lista' ? (
        /* Vista Lista/Tabla */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table
            columns={columns}
            data={productos.map(p => ({
              ...p,
              // Add computed fields for sorting
              categoriaNombre: p.categoria?.nombre || '',
              valorStock: (parseFloat(p.precioVenta) || 0) * (parseFloat(p.stockTotal) || 0)
            }))}
            sortable
            emptyMessage="No hay productos que coincidan con la busqueda"
          />

          {/* Totales */}
          <div className="bg-gray-50 border-t px-4 py-3 flex flex-wrap gap-4 justify-end text-sm">
            <div>
              <span className="text-gray-500">Total Items: </span>
              <span className="font-semibold">{productos.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Stock Total: </span>
              <span className="font-semibold">
                {productos.reduce((sum, p) => sum + (parseFloat(p.stockTotal) || 0), 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Valor Total: </span>
              <span className="font-semibold text-green-600">
                {formatCurrency(productos.reduce((sum, p) => sum + ((parseFloat(p.precioVenta) || 0) * (parseFloat(p.stockTotal) || 0)), 0))}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Vista Shop/Grid */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {productos.map((producto) => (
              <div
                key={producto.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer group"
                onClick={() => navigate(`/admin/stock/productos/${producto.id}`)}
              >
                {/* Imagen */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {producto.fotoPrincipal ? (
                    <img
                      src={producto.fotoPrincipal}
                      alt={producto.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  {producto.stockTotal <= 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Sin Stock
                    </div>
                  )}
                  {!producto.activo && (
                    <div className="absolute inset-0 bg-gray-500/50 flex items-center justify-center">
                      <span className="bg-gray-800 text-white px-3 py-1 rounded text-sm">Inactivo</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-mono">{producto.codigo}</p>
                      <h3 className="font-semibold text-gray-800 truncate">{producto.nombre}</h3>
                    </div>
                  </div>

                  {producto.categoria && (
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 mb-2">
                      {producto.categoria.nombre}
                    </span>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div>
                      {producto.precioVenta && (
                        <p className="text-lg font-bold text-primary">{formatCurrency(producto.precioVenta)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Stock: <span className="font-semibold">{producto.stockTotal}</span></p>
                      <p className="text-xs text-gray-400">{producto._count?.variantes || 0} variantes</p>
                    </div>
                  </div>

                  {/* Talles con stock */}
                  {producto.variantes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                      {producto.variantes.slice(0, 6).map((v, i) => (
                        <span
                          key={i}
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            v.stockActual > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {v.talle}{v.color ? `/${v.color}` : ''}: {v.stockActual}
                        </span>
                      ))}
                      {producto.variantes.length > 6 && (
                        <span className="text-xs text-gray-400">+{producto.variantes.length - 6} mas</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/admin/stock/productos/${producto.id}`)
                    }}
                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/admin/stock/movimientos?productoId=${producto.id}`)
                    }}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Ver movimientos"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  {tienePermiso(PERMISOS.STOCK_GESTIONAR) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/stock/productos/${producto.id}?editar=true`)
                      }}
                      className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginacion */}
          <Pagination
            pagination={pagination}
            page={page}
            onPageChange={goToPage}
            className="mt-6"
          />
        </>
      )}
    </div>
  )
}
