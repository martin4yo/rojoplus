import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Search, ShoppingCart, Package } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import SelectCentroCosto from '../../../components/SelectCentroCosto'
import SearchInput from '../../../components/SearchInput'
import { formatCurrency, formatDateForInput } from '../../../utils/formatters'
import { useApiData } from '../../../hooks/useApiData'
import StatusBadge from '../../../components/StatusBadge'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function OrdenCompraForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const isEditing = !!id

  const [saving, setSaving] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)

  // Cargar datos iniciales con useApiData
  const { data: proveedores = [], loading: loadingProveedores } = useApiData('/admin/entidades', {
    params: { tipo: 'PROVEEDOR', activo: true, limit: 500 }
  })

  const { data: productos = [], loading: loadingProductos } = useApiData('/admin/productos', {
    params: { activo: true, limit: 500 }
  })

  const [form, setForm] = useState({
    entidadId: '',
    fechaEntrega: '',
    observaciones: '',
    centroCostoId: '',
    items: []
  })

  // Cargar orden si estamos editando
  useEffect(() => {
    if (isEditing) {
      cargarOrden()
    }
  }, [id])

  async function cargarOrden() {
    try {
      const ordenRes = await api.getFull(`/admin/ordenes-compra/${id}`)
      const orden = ordenRes.data
      setForm({
        entidadId: orden.entidadId?.toString() || '',
        fechaEntrega: formatDateForInput(orden.fechaEntrega),
        observaciones: orden.observaciones || '',
        centroCostoId: orden.centroCostoId?.toString() || '',
        items: orden.items.map(item => ({
          id: item.id,
          productoVarianteId: item.productoVarianteId?.toString() || '',
          descripcion: item.descripcion || '',
          cantidad: item.cantidad?.toString() || '',
          precioUnitario: item.precioUnitario?.toString() || '',
          producto: item.productoVariante?.producto || null,
          variante: item.productoVariante || null
        }))
      })
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({ type: 'error', message: 'Error al cargar los datos' })
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleItemChange(index, field, value) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  function agregarItemManual() {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productoVarianteId: '',
        descripcion: '',
        cantidad: '1',
        precioUnitario: '',
        producto: null,
        variante: null
      }]
    }))
  }

  function agregarProducto(producto, variante) {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productoVarianteId: variante.id.toString(),
        descripcion: `${producto.nombre} - ${variante.talle}${variante.color ? ` ${variante.color}` : ''}`,
        cantidad: '1',
        precioUnitario: producto.precioCompra?.toString() || '',
        producto: producto,
        variante: variante
      }]
    }))
    setMostrarBuscador(false)
    setBusquedaProducto('')
  }

  function eliminarItem(index) {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  function calcularSubtotal() {
    return form.items.reduce((sum, item) => {
      const cantidad = parseFloat(item.cantidad) || 0
      const precio = parseFloat(item.precioUnitario) || 0
      return sum + (cantidad * precio)
    }, 0)
  }

  const subtotal = calcularSubtotal()
  const iva = subtotal * 0.21
  const total = subtotal + iva

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.entidadId) {
      showModal({ type: 'warning', message: 'Debe seleccionar un proveedor' })
      return
    }

    if (form.items.length === 0) {
      showModal({ type: 'warning', message: 'Debe agregar al menos un item' })
      return
    }

    for (const item of form.items) {
      if (!item.descripcion && !item.productoVarianteId) {
        showModal({ type: 'warning', message: 'Cada item debe tener una descripcion o un producto seleccionado' })
        return
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        showModal({ type: 'warning', message: 'La cantidad debe ser mayor a 0' })
        return
      }
      if (!item.precioUnitario || parseFloat(item.precioUnitario) <= 0) {
        showModal({ type: 'warning', message: 'El precio unitario debe ser mayor a 0' })
        return
      }
    }

    setSaving(true)
    try {
      const data = {
        entidadId: parseInt(form.entidadId),
        fechaEntrega: form.fechaEntrega || null,
        observaciones: form.observaciones || null,
        centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null,
        items: form.items.map(item => ({
          productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
          descripcion: item.descripcion || null,
          cantidad: parseFloat(item.cantidad),
          precioUnitario: parseFloat(item.precioUnitario)
        }))
      }

      if (isEditing) {
        await api.put(`/admin/ordenes-compra/${id}`, data)
      } else {
        await api.post('/admin/ordenes-compra', data)
      }

      navigate('/admin/egresos/ordenes-compra')
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar la orden' })
    } finally {
      setSaving(false)
    }
  }


  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  const loading = loadingProveedores || loadingProductos

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {ModalComponent}
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/egresos/ordenes-compra')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos principales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos de la Orden</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              <select
                name="entidadId"
                value={form.entidadId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.razonSocial} {p.nombreFantasia ? `(${p.nombreFantasia})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Entrega Estimada
              </label>
              <input
                type="date"
                name="fechaEntrega"
                value={form.fechaEntrega}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <input
                type="text"
                name="observaciones"
                value={form.observaciones}
                onChange={handleChange}
                placeholder="Notas adicionales..."
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Costo
              </label>
              <SelectCentroCosto
                value={form.centroCostoId}
                onChange={(val) => setForm(prev => ({ ...prev, centroCostoId: val }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Opcional - para reportes contables</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Items</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMostrarBuscador(!mostrarBuscador)}
              >
                <Package className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
              <Button type="button" variant="secondary" onClick={agregarItemManual}>
                <Plus className="w-4 h-4 mr-2" />
                Item Manual
              </Button>
            </div>
          </div>

          {/* Buscador de productos */}
          {mostrarBuscador && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="mb-3">
                <SearchInput
                  value={busquedaProducto}
                  onChange={setBusquedaProducto}
                  placeholder="Buscar producto por nombre o codigo..."
                  autoFocus={true}
                  debounceMs={300}
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {productosFiltrados.slice(0, 10).map((producto) => (
                  <div key={producto.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-xs text-gray-500">{producto.codigo}</span>
                        <p className="font-medium text-gray-800">{producto.nombre}</p>
                        {producto.precioCompra && (
                          <p className="text-sm text-gray-600">
                            Precio compra: {formatCurrency(producto.precioCompra)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {producto.variantes?.map((variante) => (
                        <button
                          key={variante.id}
                          type="button"
                          onClick={() => agregarProducto(producto, variante)}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-primary hover:text-white rounded-lg transition"
                        >
                          {variante.talle}{variante.color ? ` - ${variante.color}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {busquedaProducto && productosFiltrados.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No se encontraron productos</p>
                )}
              </div>
            </div>
          )}

          {/* Lista de items */}
          {form.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay items agregados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Descripcion
                      </label>
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                        placeholder="Descripcion del item..."
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                        min="1"
                        step="1"
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Precio Unitario
                      </label>
                      <input
                        type="number"
                        value={item.precioUnitario}
                        onChange={(e) => handleItemChange(index, 'precioUnitario', e.target.value)}
                        min="0"
                        step="0.01"
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                  <div className="text-right pt-5">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatCurrency((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarItem(index)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Totales */}
          {form.items.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA (21%):</span>
                    <span className="font-medium">{formatCurrency(iva)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/egresos/ordenes-compra')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Guardar Cambios' : 'Crear Orden'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
