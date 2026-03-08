import { useState } from 'react'
import { ArrowLeft, Coffee, LayoutGrid, ImageIcon } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

/**
 * Componente reutilizable para mostrar categorías y productos del menú
 *
 * @param {Object} props
 * @param {Array} props.categorias - Lista de categorías
 * @param {Array} props.productos - Lista de productos
 * @param {Function} props.onProductoClick - Callback al hacer click en un producto
 * @param {boolean} props.disabled - Deshabilitar clicks en productos
 * @param {string} props.busqueda - Término de búsqueda externo (opcional)
 * @param {boolean} props.mostrarStock - Mostrar badges de stock
 * @param {string} props.gridCategorias - Clases de grid para categorías
 * @param {string} props.gridProductos - Clases de grid para productos
 * @param {string} props.className - Clases adicionales para el contenedor
 */
export default function MenuProductos({
  categorias = [],
  productos = [],
  onProductoClick,
  disabled = false,
  busqueda = '',
  mostrarStock = false,
  gridCategorias = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  gridProductos = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  className = ''
}) {
  const [categoriaActiva, setCategoriaActiva] = useState(null)

  // categoriaActiva: null = mostrar tarjetas de categorías, 'TODAS' = todos, id = categoría específica
  const mostrandoCategorias = categoriaActiva === null && !busqueda

  // Ordenar categorías alfabéticamente
  const categoriasOrdenadas = [...categorias].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  )

  // Filtrar y ordenar productos alfabéticamente
  const productosFiltrados = productos
    .filter(p => {
      const matchCategoria = categoriaActiva === 'TODAS' || categoriaActiva === null || p.categoriaMenuId === categoriaActiva
      const matchBusqueda = !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigoBarras?.includes(busqueda)
      return matchCategoria && matchBusqueda
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

  // Si hay búsqueda activa, mostrar productos directamente
  const efectivamenteMostrandoCategorias = mostrandoCategorias && !busqueda

  return (
    <div className={`flex flex-col flex-1 overflow-hidden ${className}`}>
      {/* Barra de categoría activa con botón volver */}
      {!efectivamenteMostrandoCategorias && (
        <div className="bg-gray-50 border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setCategoriaActiva(null)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Categorías</span>
          </button>
          {!busqueda && (
            <span
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: categoriaActiva === 'TODAS' ? '#374151' : (categorias.find(c => c.id === categoriaActiva)?.color || '#DC2626') }}
            >
              {categoriaActiva === 'TODAS' ? 'Todas' : categorias.find(c => c.id === categoriaActiva)?.nombre || 'Categoría'}
            </span>
          )}
          {busqueda && (
            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-100 text-blue-700">
              Búsqueda: "{busqueda}"
            </span>
          )}
          <span className="text-sm text-gray-500">
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Grid de Categorías o Productos */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-gray-100">
        {efectivamenteMostrandoCategorias ? (
          /* Vista de Categorías - Tarjetas grandes */
          <div className={`grid ${gridCategorias} gap-3 md:gap-4`}>
            {/* Tarjeta "Todas" */}
            <button
              onClick={() => setCategoriaActiva('TODAS')}
              className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl p-5 md:p-6 text-left transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 rounded-xl flex items-center justify-center">
                  <LayoutGrid size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-bold text-white">Todas</h3>
                  <p className="text-sm text-gray-300 mt-0.5">{productos.length} productos</p>
                </div>
              </div>
            </button>

            {/* Tarjetas de categorías (ordenadas alfabéticamente) */}
            {categoriasOrdenadas.map(cat => {
              const productosEnCategoria = productos.filter(p => p.categoriaMenuId === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaActiva(cat.id)}
                  className="rounded-2xl p-5 md:p-6 text-left transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: cat.color || '#DC2626' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ImageIcon size={28} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-bold text-white truncate">{cat.nombre}</h3>
                      <p className="text-sm text-white/70 mt-0.5">{productosEnCategoria} productos</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          /* Vista de Productos */
          <div className={`grid ${gridProductos} gap-2 md:gap-3`}>
            {productosFiltrados.map(prod => {
              const sinStock = mostrarStock && prod.stock !== undefined && prod.stock === 0
              const stockBajo = mostrarStock && prod.stock !== undefined && prod.stock > 0 && prod.stock <= 5

              return (
                <button
                  key={prod.id}
                  onClick={() => !sinStock && !disabled && onProductoClick?.(prod)}
                  disabled={sinStock || disabled}
                  className={`bg-white rounded-xl p-2.5 md:p-3 text-left transition-all border-2 shadow-sm ${
                    sinStock || disabled
                      ? 'opacity-50 cursor-not-allowed border-transparent'
                      : 'border-transparent hover:shadow-lg hover:border-red-500 active:scale-[0.97] active:bg-red-50'
                  }`}
                >
                  <div className="flex gap-2.5 md:gap-3">
                    {prod.imagen ? (
                      <img
                        src={prod.imagen}
                        alt={prod.nombre}
                        className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <Coffee size={22} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 leading-snug">{prod.nombre}</h3>
                      {prod.codigoBarras && (
                        <p className="text-xs text-gray-400 truncate mt-0.5 hidden md:block">{prod.codigoBarras}</p>
                      )}
                      <p className="text-base md:text-lg font-bold text-green-600 mt-0.5">
                        {formatCurrency(prod.precio, { showSymbol: false })}
                      </p>

                      {/* Badge de stock */}
                      {mostrarStock && prod.stock !== undefined && (
                        <div className="mt-1">
                          {sinStock ? (
                            <span className="inline-block text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                              Sin stock
                            </span>
                          ) : stockBajo ? (
                            <span className="inline-block text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                              Quedan {prod.stock}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {productosFiltrados.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Coffee size={48} className="mx-auto mb-3 opacity-30" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
