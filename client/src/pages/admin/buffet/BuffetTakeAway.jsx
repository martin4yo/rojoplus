import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock, Check, Phone, User, ChefHat, DollarSign, RefreshCw, ShoppingBag, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useTicket } from '../../../contexts/TicketContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'

export default function BuffetTakeAway() {
  const { generarTicketTakeAway, imprimirTicket } = useTicket()
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalCobrar, setModalCobrar] = useState(null)
  const [formData, setFormData] = useState({
    nombreCliente: '',
    telefono: '',
    horaEstimada: '',
    observaciones: '',
    items: []
  })
  const [cobroData, setCobroData] = useState({
    cajaId: '',
    medioPagoId: ''
  })

  const cargarDatos = useCallback(async () => {
    try {
      const [pedRes, prodRes, catRes, cajasRes, mediosRes] = await Promise.all([
        api.get('/admin/buffet/takeaway'),
        api.get('/admin/buffet/productos?disponible=true&activo=true'),
        api.get('/admin/buffet/categorias?activo=true'),
        api.get('/admin/buffet/config/cajas/takeaway'),
        api.get('/admin/buffet/config/medios-pago/takeaway')
      ])
      setPedidos(pedRes.data || pedRes || [])
      setProductos(prodRes.data || prodRes || [])
      setCategorias(catRes.data || catRes || [])
      setCajas(cajasRes.data || cajasRes || [])
      setMediosPago(mediosRes.data || mediosRes || [])

      // Valores por defecto para cobro
      const cajasData = cajasRes.data || cajasRes || []
      if (cajasData.length > 0) {
        setCobroData(prev => ({ ...prev, cajaId: cajasData[0].id }))
      }
      const mediosData = mediosRes.data || mediosRes || []
      const efectivo = mediosData.find(m => m.codigo === 'EFECTIVO')
      if (efectivo) {
        setCobroData(prev => ({ ...prev, medioPagoId: efectivo.id }))
      } else if (mediosData.length > 0) {
        setCobroData(prev => ({ ...prev, medioPagoId: mediosData[0].id }))
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 30000)
    return () => clearInterval(interval)
  }, [cargarDatos])

  function abrirModalNuevo() {
    setFormData({
      nombreCliente: '',
      telefono: '',
      horaEstimada: '',
      observaciones: '',
      items: []
    })
    setModalNuevo(true)
  }

  function agregarItem(producto) {
    setFormData(prev => {
      const items = [...prev.items]
      const existe = items.find(i => i.productoBuffetId === producto.id)
      if (existe) {
        existe.cantidad++
      } else {
        items.push({
          productoBuffetId: producto.id,
          nombre: producto.nombre,
          precio: producto.precio,
          cantidad: 1
        })
      }
      return { ...prev, items }
    })
  }

  function modificarCantidadItem(index, delta) {
    setFormData(prev => {
      const items = [...prev.items]
      items[index].cantidad += delta
      if (items[index].cantidad <= 0) {
        items.splice(index, 1)
      }
      return { ...prev, items }
    })
  }

  async function crearPedido(e) {
    e.preventDefault()
    if (formData.items.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }

    try {
      await api.post('/admin/buffet/takeaway', {
        nombreCliente: formData.nombreCliente,
        telefono: formData.telefono,
        horaEstimada: formData.horaEstimada || null,
        observaciones: formData.observaciones,
        items: formData.items.map(i => ({
          productoBuffetId: i.productoBuffetId,
          cantidad: i.cantidad
        }))
      })
      setModalNuevo(false)
      cargarDatos()
    } catch (err) {
      console.error('Error creando pedido:', err)
      toast.error(err.response?.data?.error || 'Error al crear pedido')
    }
  }

  async function enviarACocina(pedidoId) {
    try {
      await api.post(`/admin/buffet/takeaway/${pedidoId}/enviar-cocina`)
      cargarDatos()
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.error || 'Error al enviar a cocina')
    }
  }

  async function marcarListo(pedidoId) {
    try {
      await api.put(`/admin/buffet/takeaway/${pedidoId}/listo`)
      cargarDatos()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function cobrar(pedidoId) {
    try {
      const pedido = pedidos.find(p => p.id === pedidoId)
      const medioPagoSeleccionado = mediosPago.find(m => m.id === parseInt(cobroData.medioPagoId))

      await api.post(`/admin/buffet/takeaway/${pedidoId}/cobrar`, {
        cajaId: parseInt(cobroData.cajaId),
        medioPagoId: parseInt(cobroData.medioPagoId)
      })

      // Generar y mostrar ticket
      if (pedido) {
        const ticketData = generarTicketTakeAway({
          ...pedido,
          medioPago: medioPagoSeleccionado
        }, 'TAKEAWAY')
        await imprimirTicket(ticketData)
      }

      toast.success('Pedido cobrado y entregado')
      setModalCobrar(null)
      cargarDatos()
    } catch (err) {
      console.error('Error:', err)
      toast.error(err.response?.data?.error || 'Error al cobrar')
    }
  }

  const getColorEstado = (estado) => {
    switch (estado) {
      case 'RECIBIDO': return 'bg-blue-100 text-blue-800'
      case 'EN_PREPARACION': return 'bg-yellow-100 text-yellow-800'
      case 'LISTO': return 'bg-green-100 text-green-800'
      case 'ENTREGADO': return 'bg-gray-100 text-gray-800'
      case 'CANCELADO': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const totalFormulario = formData.items.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)

  const pedidosPendientes = pedidos.filter(p => p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO')

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos Take Away</h1>
          <p className="text-gray-600">{pedidosPendientes.length} pedidos pendientes</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificacionBuffet />
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <RefreshCw size={18} />
          </button>
          {tienePermiso(PERMISOS.BUFFET_MESAS) && (
            <button
              onClick={abrirModalNuevo}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Plus size={18} />
              Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Grid de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pedidosPendientes.map(pedido => (
          <div key={pedido.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getColorEstado(pedido.estado)}`}>
                    {pedido.estado.replace('_', ' ')}
                  </span>
                  <h3 className="font-bold text-lg mt-1">{pedido.numero}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    ${Number(pedido.total).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <User size={14} />
                  {pedido.nombreCliente}
                </p>
                {pedido.telefono && (
                  <p className="flex items-center gap-2">
                    <Phone size={14} />
                    {pedido.telefono}
                  </p>
                )}
                {pedido.horaEstimada && (
                  <p className="flex items-center gap-2">
                    <Clock size={14} />
                    Retira: {new Date(pedido.horaEstimada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Items:</h4>
              <ul className="space-y-1 text-sm">
                {pedido.items?.map((item, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{item.cantidad}x {item.productoBuffet?.nombre}</span>
                    <span className="text-gray-600">${Number(item.subtotal).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 border-t flex gap-2">
              {pedido.estado === 'RECIBIDO' && (
                <button
                  onClick={() => enviarACocina(pedido.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  <ChefHat size={16} />
                  A Cocina
                </button>
              )}
              {pedido.estado === 'EN_PREPARACION' && tienePermiso(PERMISOS.BUFFET_COCINA) && (
                <button
                  onClick={() => marcarListo(pedido.id)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  <Check size={16} />
                  Listo
                </button>
              )}
              {pedido.estado === 'LISTO' && tienePermiso(PERMISOS.BUFFET_COBRAR) && (
                <button
                  onClick={() => setModalCobrar(pedido)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <DollarSign size={16} />
                  Cobrar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pedidosPendientes.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p>No hay pedidos Take Away pendientes</p>
        </div>
      )}

      {/* Modal Nuevo Pedido */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">Nuevo Pedido Take Away</h2>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Panel izquierdo - Productos */}
              <div className="w-1/2 border-r flex flex-col">
                <div className="p-2 bg-gray-100 flex gap-2 overflow-x-auto">
                  {categorias.map(cat => (
                    <button
                      key={cat.id}
                      className="px-3 py-1 bg-white rounded text-sm whitespace-nowrap hover:bg-gray-50"
                      style={{ borderBottom: `3px solid ${cat.color || '#DC2626'}` }}
                    >
                      {cat.nombre}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {productos.map(prod => (
                      <button
                        key={prod.id}
                        onClick={() => agregarItem(prod)}
                        className="p-3 bg-gray-50 rounded text-left hover:bg-gray-100"
                      >
                        <span className="font-medium text-sm block">{prod.nombre}</span>
                        <span className="text-green-600 font-bold">${Number(prod.precio).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Panel derecho - Datos y carrito */}
              <div className="w-1/2 flex flex-col">
                <form onSubmit={crearPedido} className="flex-1 flex flex-col">
                  <div className="p-4 space-y-3">
                    <input
                      type="text"
                      value={formData.nombreCliente}
                      onChange={e => setFormData({ ...formData, nombreCliente: e.target.value })}
                      placeholder="Nombre del cliente *"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Teléfono"
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      />
                      <input
                        type="time"
                        value={formData.horaEstimada}
                        onChange={e => setFormData({ ...formData, horaEstimada: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 border-t">
                    <h4 className="font-medium mb-2">Items ({formData.items.length})</h4>
                    {formData.items.length === 0 ? (
                      <p className="text-gray-400 text-sm">Selecciona productos del menú</p>
                    ) : (
                      <div className="space-y-2">
                        {formData.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <span className="font-medium text-sm">{item.nombre}</span>
                              <span className="text-gray-500 text-sm ml-2">
                                ${Number(item.precio).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => modificarCantidadItem(i, -1)}
                                className="w-6 h-6 bg-gray-200 rounded text-sm"
                              >
                                -
                              </button>
                              <span className="w-6 text-center">{item.cantidad}</span>
                              <button
                                type="button"
                                onClick={() => modificarCantidadItem(i, 1)}
                                className="w-6 h-6 bg-gray-200 rounded text-sm"
                              >
                                +
                              </button>
                            </div>
                            <span className="w-20 text-right font-bold">
                              ${(Number(item.precio) * item.cantidad).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg">Total:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${totalFormulario.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModalNuevo(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Crear Pedido
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cobrar */}
      {modalCobrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Cobrar Pedido {modalCobrar.numero}</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Cliente: {modalCobrar.nombreCliente}</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                Total: ${Number(modalCobrar.total).toLocaleString()}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caja</label>
                <select
                  value={cobroData.cajaId}
                  onChange={e => setCobroData({ ...cobroData, cajaId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
                <select
                  value={cobroData.medioPagoId}
                  onChange={e => setCobroData({ ...cobroData, medioPagoId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {mediosPago.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModalCobrar(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => cobrar(modalCobrar.id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
