import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Search, ShoppingCart, Package, User, Building2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function PedidoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const isEditing = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clientes, setClientes] = useState([])
  const [socios, setSocios] = useState([])
  const [productos, setProductos] = useState([])
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [mostrarBuscadorSocio, setMostrarBuscadorSocio] = useState(false)

  const [tipoCliente, setTipoCliente] = useState('socio') // 'socio' o 'cliente'

  const [form, setForm] = useState({
    entidadId: '',
    socioId: '',
    socioNombre: '',
    fechaEntrega: '',
    observaciones: '',
    items: []
  })

  const [totales, setTotales] = useState({
    subtotal: 0,
    iva21: 0,
    iva105: 0,
    total: 0
  })

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (id) cargarPedido()
  }, [id])

  useEffect(() => {
    calcularTotales()
  }, [form.items])

  async function cargarDatosIniciales() {
    setLoading(true)
    try {
      const [clientesRes, prodRes] = await Promise.all([
        api.getFull('/admin/entidades?tipo=CLIENTE&activo=true&limit=500'),
        api.getFull('/admin/productos?activo=true&limit=500')
      ])
      setClientes(clientesRes.data || [])
      setProductos(prodRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({ type: 'error', message: 'Error al cargar los datos' })
    } finally {
      setLoading(false)
    }
  }

  async function cargarPedido() {
    try {
      const response = await api.getFull(`/admin/pedidos/${id}`)
      const pedido = response.data

      setForm({
        entidadId: pedido.entidadId?.toString() || '',
        socioId: pedido.socioId?.toString() || '',
        socioNombre: pedido.socio?.apellidoNombre || '',
        fechaEntrega: pedido.fechaEntrega ? pedido.fechaEntrega.split('T')[0] : '',
        observaciones: pedido.observaciones || '',
        items: pedido.items.map(item => ({
          productoVarianteId: item.productoVarianteId?.toString() || '',
          descripcion: item.descripcion || '',
          cantidad: item.cantidad.toString(),
          precioUnitario: item.precioUnitario.toString(),
          iva: '21',
          producto: item.productoVariante?.producto || null,
          variante: item.productoVariante || null
        }))
      })

      setTipoCliente(pedido.socioId ? 'socio' : 'cliente')
    } catch (err) {
      console.error('Error cargando pedido:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar el pedido',
        onConfirm: () => navigate('/admin/ingresos/pedidos')
      })
    }
  }

  async function buscarSocios(termino) {
    if (!termino || termino.length < 2) {
      setSocios([])
      return
    }
    try {
      const response = await api.getFull(`/admin/socios?q=${encodeURIComponent(termino)}&limit=10`)
      setSocios(response.data?.socios || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleTipoClienteChange(tipo) {
    setTipoCliente(tipo)
    setForm(prev => ({
      ...prev,
      entidadId: '',
      socioId: '',
      socioNombre: ''
    }))
    setSocios([])
    setBusquedaSocio('')
  }

  function handleSocioSelect(socio) {
    setForm(prev => ({
      ...prev,
      socioId: socio.id.toString(),
      socioNombre: `#${socio.nroSocio} - ${socio.apellidoNombre}`
    }))
    setMostrarBuscadorSocio(false)
    setBusquedaSocio('')
    setSocios([])
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
        iva: '21',
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
        precioUnitario: producto.precioVenta?.toString() || '',
        iva: '21',
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

  function calcularTotales() {
    let subtotal = 0
    let iva21 = 0
    let iva105 = 0

    for (const item of form.items) {
      const cantidad = parseFloat(item.cantidad) || 0
      const precio = parseFloat(item.precioUnitario) || 0
      const itemSubtotal = cantidad * precio

      subtotal += itemSubtotal

      if (item.iva === '21') {
        iva21 += itemSubtotal * 0.21
      } else if (item.iva === '10.5') {
        iva105 += itemSubtotal * 0.105
      }
    }

    const total = subtotal + iva21 + iva105

    setTotales({ subtotal, iva21, iva105, total })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (tipoCliente === 'socio' && !form.socioId) {
      showModal({ type: 'warning', message: 'Debe seleccionar un socio' })
      return
    }

    if (tipoCliente === 'cliente' && !form.entidadId) {
      showModal({ type: 'warning', message: 'Debe seleccionar un cliente' })
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
        entidadId: tipoCliente === 'cliente' ? parseInt(form.entidadId) : null,
        socioId: tipoCliente === 'socio' ? parseInt(form.socioId) : null,
        fechaEntrega: form.fechaEntrega || null,
        observaciones: form.observaciones || null,
        items: form.items.map(item => ({
          productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
          descripcion: item.descripcion || null,
          cantidad: parseFloat(item.cantidad),
          precioUnitario: parseFloat(item.precioUnitario),
          iva: parseFloat(item.iva)
        }))
      }

      if (isEditing) {
        await api.put(`/admin/pedidos/${id}`, data)
      } else {
        await api.post('/admin/pedidos', data)
      }

      showModal({
        type: 'success',
        message: `Pedido ${isEditing ? 'actualizado' : 'creado'} correctamente`,
        onConfirm: () => navigate('/admin/ingresos/pedidos')
      })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar el pedido' })
    } finally {
      setSaving(false)
    }
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

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
          onClick={() => navigate('/admin/ingresos/pedidos')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <ShoppingCart className="w-6 h-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Pedido' : 'Nuevo Pedido'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente/Socio */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cliente</h2>

          {/* Selector de tipo */}
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => handleTipoClienteChange('socio')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                tipoCliente === 'socio'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className="w-5 h-5" />
              Socio
            </button>
            <button
              type="button"
              onClick={() => handleTipoClienteChange('cliente')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                tipoCliente === 'cliente'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-5 h-5" />
              Cliente Externo
            </button>
          </div>

          {tipoCliente === 'socio' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Socio *
              </label>
              {form.socioId ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="font-medium text-green-800">{form.socioNombre}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setForm(prev => ({ ...prev, socioId: '', socioNombre: '' }))}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaSocio}
                    onChange={(e) => {
                      setBusquedaSocio(e.target.value)
                      buscarSocios(e.target.value)
                      setMostrarBuscadorSocio(true)
                    }}
                    onFocus={() => setMostrarBuscadorSocio(true)}
                    placeholder="Buscar socio por nombre, DNI o nro..."
                    className="input-field w-full pl-10"
                  />
                  {mostrarBuscadorSocio && socios.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                      {socios.map((socio) => (
                        <button
                          key={socio.id}
                          type="button"
                          onClick={() => handleSocioSelect(socio)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="font-medium">#{socio.nroSocio} - {socio.apellidoNombre}</p>
                          <p className="text-sm text-gray-500">{socio.documento}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente *
              </label>
              <select
                name="entidadId"
                value={form.entidadId}
                onChange={handleChange}
                required
                className="input-field w-full"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial} {c.nombreFantasia ? `(${c.nombreFantasia})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Entrega
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
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  placeholder="Buscar producto por nombre o codigo..."
                  className="input-field w-full pl-10"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {productosFiltrados.slice(0, 10).map((producto) => (
                  <div key={producto.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-mono text-xs text-gray-500">{producto.codigo}</span>
                        <p className="font-medium text-gray-800">{producto.nombre}</p>
                        {producto.precioVenta && (
                          <p className="text-sm text-gray-600">
                            Precio: {formatMonto(producto.precioVenta)}
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
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-green-500 hover:text-white rounded-lg transition"
                        >
                          {variante.talle}{variante.color ? ` - ${variante.color}` : ''}
                          <span className="ml-1 text-xs opacity-75">({variante.stockActual})</span>
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
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
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
                        Precio Unit.
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
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        IVA
                      </label>
                      <select
                        value={item.iva}
                        onChange={(e) => handleItemChange(index, 'iva', e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="21">21%</option>
                        <option value="10.5">10.5%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-right pt-5">
                    <p className="text-sm font-semibold text-gray-800">
                      {formatMonto((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0))}
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
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatMonto(totales.subtotal)}</span>
                  </div>
                  {totales.iva21 > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IVA 21%:</span>
                      <span className="font-medium">{formatMonto(totales.iva21)}</span>
                    </div>
                  )}
                  {totales.iva105 > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IVA 10.5%:</span>
                      <span className="font-medium">{formatMonto(totales.iva105)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-green-600">{formatMonto(totales.total)}</span>
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
            onClick={() => navigate('/admin/ingresos/pedidos')}
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
                {isEditing ? 'Actualizar Pedido' : 'Crear Pedido'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
