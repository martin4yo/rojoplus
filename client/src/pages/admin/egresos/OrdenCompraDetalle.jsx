import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, ShoppingCart, Package, CheckCircle, XCircle, Truck, Building2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
import api from '../../../services/api'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: ShoppingCart },
  PARCIAL: { label: 'Parcial', color: 'bg-blue-100 text-blue-700', icon: Truck },
  RECIBIDA: { label: 'Recibida', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600', icon: XCircle }
}

export default function OrdenCompraDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modoRecepcion, setModoRecepcion] = useState(false)
  const [recepcion, setRecepcion] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarOrden()
  }, [id])

  async function cargarOrden() {
    setLoading(true)
    try {
      const res = await api.getFull(`/admin/ordenes-compra/${id}`)
      setOrden(res.data)

      // Inicializar recepcion con cantidades pendientes
      const recepcionInicial = {}
      res.data.items.forEach(item => {
        const pendiente = parseFloat(item.cantidad) - parseFloat(item.cantidadRecibida)
        recepcionInicial[item.id] = pendiente > 0 ? pendiente.toString() : '0'
      })
      setRecepcion(recepcionInicial)
    } catch (err) {
      console.error('Error cargando orden:', err)
      showModal({ type: 'error', message: 'Error al cargar la orden' })
      navigate('/admin/egresos/ordenes-compra')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecibir() {
    const itemsRecibidos = Object.entries(recepcion)
      .filter(([_, cantidad]) => parseFloat(cantidad) > 0)
      .map(([itemId, cantidad]) => ({
        itemId: parseInt(itemId),
        cantidadRecibida: parseFloat(cantidad)
      }))

    if (itemsRecibidos.length === 0) {
      showModal({ type: 'warning', message: 'Debe ingresar al menos una cantidad a recibir' })
      return
    }

    setSaving(true)
    try {
      await api.put(`/admin/ordenes-compra/${id}/recibir`, { itemsRecibidos })
      await cargarOrden()
      setModoRecepcion(false)
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al registrar recepcion' })
    } finally {
      setSaving(false)
    }
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!orden) return null

  const estadoConfig = ESTADOS[orden.estado]
  const EstadoIcon = estadoConfig?.icon || ShoppingCart

  return (
    <div>
      {ModalComponent}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
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
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{orden.numero}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${estadoConfig?.color}`}>
                <EstadoIcon className="w-3 h-3" />
                {estadoConfig?.label || orden.estado}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {orden.estado === 'PENDIENTE' && (
            <Link to={`/admin/egresos/ordenes-compra/${id}/editar`}>
              <Button variant="secondary">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
          {(orden.estado === 'PENDIENTE' || orden.estado === 'PARCIAL') && !modoRecepcion && (
            <Button onClick={() => setModoRecepcion(true)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Registrar Recepcion
            </Button>
          )}
        </div>
      </div>

      {/* Info principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Proveedor */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Proveedor</h2>
          </div>
          <p className="font-medium text-gray-800">{orden.entidad?.razonSocial}</p>
          {orden.entidad?.nombreFantasia && (
            <p className="text-sm text-gray-500">{orden.entidad.nombreFantasia}</p>
          )}
          {orden.entidad?.documento && (
            <p className="text-sm text-gray-600 mt-2">
              {orden.entidad.tipoDocumento}: {orden.entidad.documento}
            </p>
          )}
          {orden.entidad?.telefono && (
            <p className="text-sm text-gray-600">{orden.entidad.telefono}</p>
          )}
        </div>

        {/* Fechas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Datos de la Orden</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Fecha:</span>
              <span className="text-sm font-medium">{formatFecha(orden.fecha)}</span>
            </div>
            {orden.fechaEntrega && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Entrega estimada:</span>
                <span className="text-sm font-medium">{formatFecha(orden.fechaEntrega)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Items:</span>
              <span className="text-sm font-medium">{orden.items?.length || 0}</span>
            </div>
          </div>
          {orden.observaciones && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">{orden.observaciones}</p>
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Totales</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subtotal:</span>
              <span className="text-sm font-medium">{formatMonto(orden.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">IVA (21%):</span>
              <span className="text-sm font-medium">{formatMonto(orden.iva)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total:</span>
              <span className="text-primary">{formatMonto(orden.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">Items de la Orden</h2>
          </div>
          {modoRecepcion && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModoRecepcion(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRecibir} disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar Recepcion'}
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Producto</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Precio Unit.</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Pedido</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Recibido</th>
                {modoRecepcion && (
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Recibir Ahora</th>
                )}
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orden.items?.map((item) => {
                const pendiente = parseFloat(item.cantidad) - parseFloat(item.cantidadRecibida)
                const completado = pendiente <= 0

                return (
                  <tr key={item.id} className={completado ? 'bg-green-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.productoVariante?.producto?.fotos?.[0] ? (
                          <img
                            src={item.productoVariante.producto.fotos[0].url}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">
                            {item.descripcion || item.productoVariante?.producto?.nombre || 'Item'}
                          </p>
                          {item.productoVariante && (
                            <p className="text-sm text-gray-500">
                              {item.productoVariante.talle}
                              {item.productoVariante.color ? ` - ${item.productoVariante.color}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium">{formatMonto(item.precioUnitario)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium">{parseFloat(item.cantidad)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        completado
                          ? 'bg-green-100 text-green-700'
                          : parseFloat(item.cantidadRecibida) > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {parseFloat(item.cantidadRecibida)} / {parseFloat(item.cantidad)}
                      </span>
                    </td>
                    {modoRecepcion && (
                      <td className="px-4 py-3 text-center">
                        {!completado ? (
                          <input
                            type="number"
                            value={recepcion[item.id] || '0'}
                            onChange={(e) => setRecepcion(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }))}
                            min="0"
                            max={pendiente}
                            className="input-field w-20 text-center"
                          />
                        ) : (
                          <span className="text-green-600">
                            <CheckCircle className="w-5 h-5 mx-auto" />
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-800">{formatMonto(item.subtotal)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjuntos */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <AdjuntosComprobante tipo="ordenCompra" comprobanteId={orden.id} />
      </div>
    </div>
  )
}
