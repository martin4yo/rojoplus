import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Image, Search, Check, X, Package, Upload, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import { useConfirm } from '../../../hooks/useConfirm'

export default function BuffetProductos() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [categoriasStock, setCategoriasStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTiposVenta, setFiltroTiposVenta] = useState([]) // Array para multiselect
  const [busqueda, setBusqueda] = useState('')
  const [modoCreacion, setModoCreacion] = useState('nuevo') // 'nuevo' o 'existente'
  const [productosStock, setProductosStock] = useState([])

  const [formData, setFormData] = useState({
    // Campos para producto nuevo (stock)
    codigo: '',
    categoriaStockId: '',
    // Campos comunes
    nombre: '',
    descripcion: '',
    codigoBarras: '',
    precio: '',
    // Campos específicos de buffet
    categoriaMenuId: '',
    imagen: '',
    tiposVenta: ['BUFFET', 'KIOSCO'], // Array con ambos por defecto
    disponible: true,
    destacado: false,
    orden: 0,
    // Para vincular producto existente
    productoId: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [prodRes, catRes, catStockRes, stockRes] = await Promise.all([
        api.get('/admin/buffet/productos'),
        api.get('/admin/buffet/categorias'),
        api.get('/admin/categorias-producto'),  // Stock categories
        api.get('/admin/productos')              // Stock products
      ])
      setProductos(prodRes.data || prodRes || [])
      setCategorias(catRes.data || catRes || [])
      setCategoriasStock(catStockRes.data || catStockRes || [])
      setProductosStock(stockRes.data || stockRes || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  function abrirModal(producto = null) {
    if (producto) {
      setEditando(producto)
      setFormData({
        codigo: producto.producto?.codigo || '',
        categoriaStockId: producto.producto?.categoriaId || '',
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        codigoBarras: producto.codigoBarras || '',
        precio: producto.precio,
        categoriaMenuId: producto.categoriaMenuId,
        imagen: producto.imagen || '',
        tiposVenta: producto.tiposVenta || ['BUFFET', 'KIOSCO'],
        disponible: producto.disponible,
        destacado: producto.destacado,
        orden: producto.orden || 0,
        productoId: producto.productoId
      })
      setModoCreacion('existente')
    } else {
      setEditando(null)
      setFormData({
        codigo: '',
        categoriaStockId: '',
        nombre: '',
        descripcion: '',
        codigoBarras: '',
        precio: '',
        categoriaMenuId: categorias[0]?.id || '',
        imagen: '',
        tiposVenta: ['BUFFET', 'KIOSCO'],
        disponible: true,
        destacado: false,
        orden: 0,
        productoId: ''
      })
      setModoCreacion('nuevo')
    }
    setModalOpen(true)
  }

  function generarCodigo() {
    const prefijo = 'BUF'
    const numero = String(Date.now()).slice(-6)
    setFormData({ ...formData, codigo: `${prefijo}${numero}` })
  }

  function seleccionarProductoStock(e) {
    const id = parseInt(e.target.value)
    if (!id) {
      setFormData({ ...formData, productoId: '', nombre: '', precio: '' })
      return
    }
    const prod = productosStock.find(p => p.id === id)
    if (prod) {
      setFormData({
        ...formData,
        productoId: id,
        nombre: prod.nombre,
        precio: prod.precioVenta || ''
      })
    }
  }

  async function guardar(e) {
    e.preventDefault()

    // Validar que al menos un tipo de venta esté seleccionado
    if (formData.tiposVenta.length === 0) {
      toast.error('Debe seleccionar al menos un tipo de venta')
      return
    }

    try {
      if (editando) {
        // Actualizar producto existente
        await api.put(`/admin/buffet/productos/${editando.id}`, {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          codigoBarras: formData.codigoBarras || null,
          precio: parseFloat(formData.precio),
          categoriaMenuId: parseInt(formData.categoriaMenuId),
          imagen: formData.imagen,
          tiposVenta: formData.tiposVenta,
          disponible: formData.disponible,
          destacado: formData.destacado,
          orden: parseInt(formData.orden) || 0
        })
        toast.success('Producto actualizado')
      } else {
        if (modoCreacion === 'nuevo') {
          // Crear producto nuevo (stock + buffet)
          await api.post('/admin/buffet/productos/crear-completo', {
            // Datos del producto stock
            codigo: formData.codigo,
            categoriaStockId: formData.categoriaStockId ? parseInt(formData.categoriaStockId) : null,
            // Datos comunes
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            codigoBarras: formData.codigoBarras || null,
            precio: parseFloat(formData.precio),
            // Datos del producto buffet
            categoriaMenuId: parseInt(formData.categoriaMenuId),
            imagen: formData.imagen,
            tiposVenta: formData.tiposVenta,
            disponible: formData.disponible,
            destacado: formData.destacado,
            orden: parseInt(formData.orden) || 0
          })
          toast.success('Producto creado')
        } else {
          // Vincular producto existente del stock
          await api.post('/admin/buffet/productos', {
            productoId: parseInt(formData.productoId),
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            codigoBarras: formData.codigoBarras || null,
            precio: parseFloat(formData.precio),
            categoriaMenuId: parseInt(formData.categoriaMenuId),
            imagen: formData.imagen,
            tiposVenta: formData.tiposVenta,
            disponible: formData.disponible,
            destacado: formData.destacado,
            orden: parseInt(formData.orden) || 0
          })
          toast.success('Producto agregado al menú')
        }
      }
      setModalOpen(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando producto:', err)
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function eliminar(id) {
    const confirmed = await confirm(
      '¿Eliminar producto?',
      'Se eliminará este producto del menú. Esta acción no se puede deshacer.',
      { variant: 'danger', confirmText: 'Eliminar' }
    )
    if (!confirmed) return
    try {
      await api.delete(`/admin/buffet/productos/${id}`)
      toast.success('Producto eliminado del menú')
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando producto:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function toggleDisponible(producto) {
    try {
      await api.put(`/admin/buffet/productos/${producto.id}/disponibilidad`, {
        disponible: !producto.disponible
      })
      cargarDatos()
    } catch (err) {
      console.error('Error actualizando disponibilidad:', err)
    }
  }

  // Filtrar productos del stock que ya están en el menú
  const productosStockDisponibles = productosStock.filter(p =>
    !productos.some(pb => pb.productoId === p.id)
  )

  const productosFiltrados = productos.filter(p => {
    const matchCategoria = !filtroCategoria || p.categoriaMenuId === parseInt(filtroCategoria)
    // Si hay filtros de tipo, el producto debe tener al menos uno de los tipos seleccionados
    const matchTipoVenta = filtroTiposVenta.length === 0 ||
      filtroTiposVenta.some(tipo => p.tiposVenta?.includes(tipo))
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCategoria && matchTipoVenta && matchBusqueda
  })

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Productos del Menú" subtitle="Gestiona los productos disponibles en el buffet">
        {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
          <>
            <button
              onClick={() => navigate('/admin/buffet/productos/importar')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload size={18} />
              Importar
            </button>
            <button
              onClick={() => abrirModal()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Plus size={18} />
              Agregar Producto
            </button>
          </>
        )}
      </PageHeader>

      {/* Filtros */}
      <div className="flex gap-4 bg-white p-4 rounded-lg shadow">
        <div className="flex-1">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Tipo:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroTiposVenta.includes('BUFFET')}
              onChange={e => {
                if (e.target.checked) {
                  setFiltroTiposVenta([...filtroTiposVenta, 'BUFFET'])
                } else {
                  setFiltroTiposVenta(filtroTiposVenta.filter(t => t !== 'BUFFET'))
                }
              }}
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-purple-700">Buffet</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroTiposVenta.includes('KIOSCO')}
              onChange={e => {
                if (e.target.checked) {
                  setFiltroTiposVenta([...filtroTiposVenta, 'KIOSCO'])
                } else {
                  setFiltroTiposVenta(filtroTiposVenta.filter(t => t !== 'KIOSCO'))
                }
              }}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-blue-700">Kiosco</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filtroTiposVenta.includes('TAKEAWAY')}
              onChange={e => {
                if (e.target.checked) {
                  setFiltroTiposVenta([...filtroTiposVenta, 'TAKEAWAY'])
                } else {
                  setFiltroTiposVenta(filtroTiposVenta.filter(t => t !== 'TAKEAWAY'))
                }
              }}
              className="rounded text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-green-700">Pedidos</span>
          </label>
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {productosFiltrados.map(prod => (
          <div
            key={prod.id}
            className={`bg-white rounded-lg shadow overflow-hidden ${!prod.activo ? 'opacity-60' : ''}`}
          >
            {prod.imagen ? (
              <img
                src={prod.imagen}
                alt={prod.nombre}
                className="w-full h-40 object-cover"
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                <Image size={48} className="text-gray-300" />
              </div>
            )}

            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold">{prod.nombre}</h3>
                  <p className="text-sm text-gray-500">{prod.categoriaMenu?.nombre}</p>
                </div>
                <span className="text-lg font-bold text-green-600">
                  ${Number(prod.precio).toLocaleString()}
                </span>
              </div>

              {prod.descripcion && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{prod.descripcion}</p>
              )}

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleDisponible(prod)}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                      prod.disponible
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {prod.disponible ? <Check size={12} /> : <X size={12} />}
                    {prod.disponible ? 'Disponible' : 'No disponible'}
                  </button>
                  {prod.destacado && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                      Destacado
                    </span>
                  )}
                  {prod.tiposVenta?.includes('BUFFET') && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      Buffet
                    </span>
                  )}
                  {prod.tiposVenta?.includes('KIOSCO') && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      Kiosco
                    </span>
                  )}
                  {prod.tiposVenta?.includes('TAKEAWAY') && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                      Pedidos
                    </span>
                  )}
                </div>

                {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigate(`/admin/buffet/productos/${prod.id}/opciones`)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                      title="Configurar opciones"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => abrirModal(prod)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Editar producto"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => eliminar(prod.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar producto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {productosFiltrados.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {productos.length === 0
            ? 'No hay productos en el menú. Agrega algunos para empezar.'
            : 'No se encontraron productos con los filtros seleccionados.'}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header fijo */}
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">
                {editando ? 'Editar Producto' : 'Agregar Producto al Menú'}
              </h2>
            </div>

            {/* Contenido con scroll */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* Selector de modo (solo al crear) */}
              {!editando && (
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setModoCreacion('nuevo')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                      modoCreacion === 'nuevo'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Plus size={18} />
                    <span className="font-medium">Crear Nuevo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCreacion('existente')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                      modoCreacion === 'existente'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Package size={18} />
                    <span className="font-medium">Desde Stock</span>
                  </button>
                </div>
              )}

              <form id="formProducto" onSubmit={guardar} className="space-y-3">
                {/* Campos para producto nuevo - 2 columnas */}
                {!editando && modoCreacion === 'nuevo' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={formData.codigo}
                          onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          placeholder="BUF001"
                          required
                        />
                        <button
                          type="button"
                          onClick={generarCodigo}
                          className="px-2 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs"
                        >
                          Auto
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cat. Stock</label>
                      <select
                        value={formData.categoriaStockId}
                        onChange={e => setFormData({ ...formData, categoriaStockId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <option value="">Sin categoría</option>
                        {categoriasStock.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Selector de producto existente */}
                {!editando && modoCreacion === 'existente' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Producto del Stock *</label>
                    <select
                      value={formData.productoId}
                      onChange={seleccionarProductoStock}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      required={modoCreacion === 'existente'}
                    >
                      <option value="">Seleccionar producto...</option>
                      {productosStockDisponibles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} - {p.nombre} {p.precioVenta ? `($${Number(p.precioVenta).toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fila: Categoría Menú + Nombre */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Menú *</label>
                    <select
                      value={formData.categoriaMenuId}
                      onChange={e => setFormData({ ...formData, categoriaMenuId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Nombre del producto"
                      required
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={formData.descripcion}
                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="Descripción breve"
                  />
                </div>

                {/* Fila: Precio + Código Barras + Orden */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precio}
                      onChange={e => setFormData({ ...formData, precio: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Barras</label>
                    <input
                      type="text"
                      value={formData.codigoBarras}
                      onChange={e => setFormData({ ...formData, codigoBarras: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Escanear"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                    <input
                      type="number"
                      value={formData.orden}
                      onChange={e => setFormData({ ...formData, orden: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                {/* URL Imagen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL de Imagen</label>
                  <input
                    type="url"
                    value={formData.imagen}
                    onChange={e => setFormData({ ...formData, imagen: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    placeholder="https://..."
                  />
                </div>

                {/* Fila: Disponible en + Opciones */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disponible en *</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.tiposVenta.includes('BUFFET')}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, tiposVenta: [...formData.tiposVenta, 'BUFFET'] })
                            } else {
                              setFormData({ ...formData, tiposVenta: formData.tiposVenta.filter(t => t !== 'BUFFET') })
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-purple-700">Buffet</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.tiposVenta.includes('KIOSCO')}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, tiposVenta: [...formData.tiposVenta, 'KIOSCO'] })
                            } else {
                              setFormData({ ...formData, tiposVenta: formData.tiposVenta.filter(t => t !== 'KIOSCO') })
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-blue-700">Kiosco</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.tiposVenta.includes('TAKEAWAY')}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, tiposVenta: [...formData.tiposVenta, 'TAKEAWAY'] })
                            } else {
                              setFormData({ ...formData, tiposVenta: formData.tiposVenta.filter(t => t !== 'TAKEAWAY') })
                            }
                          }}
                          className="rounded text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-green-700">Pedidos</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opciones</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.disponible}
                          onChange={e => setFormData({ ...formData, disponible: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Disponible</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destacado}
                          onChange={e => setFormData({ ...formData, destacado: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Destacado</span>
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer fijo */}
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="formProducto"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {editando ? 'Guardar Cambios' : modoCreacion === 'nuevo' ? 'Crear Producto' : 'Agregar al Menú'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
