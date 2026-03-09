import { useState, useEffect, useCallback, useRef } from 'react'
import { User, X, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import GestionPedido from '../../../components/buffet/GestionPedido'
import ClienteSelector from '../../../components/buffet/ClienteSelector'

export default function BuffetBarra() {
  const [pedidoActivo, setPedidoActivo] = useState(null)
  const [mostrarSelectorCliente, setMostrarSelectorCliente] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const creandoPedido = useRef(false)

  // Al montar, crear un pedido temporal automáticamente
  useEffect(() => {
    if (!creandoPedido.current) {
      creandoPedido.current = true
      crearPedidoBarra()
    }
  }, [])

  async function crearPedidoBarra(cliente = null) {
    try {
      const ahora = new Date()

      const res = await api.post('/admin/buffet/takeaway', {
        nombreCliente: cliente?.razonSocial || 'Venta Barra',
        telefono: cliente?.telefono || '',
        tipo: 'RETIRO',
        tipoVenta: 'BARRA', // Identificador especial
        horaEstimada: ahora.toISOString(),
        observaciones: cliente ? `Cliente: ${cliente.razonSocial}` : 'Venta rápida en barra',
        socioId: cliente?.socioId || null,
        clienteId: cliente?.id || null
      })

      const pedido = res.data || res
      setPedidoActivo(pedido)

      if (cliente) {
        setClienteSeleccionado(cliente)
        toast.success(`Cliente: ${cliente.razonSocial}`)
      }
    } catch (err) {
      console.error('Error creando pedido barra:', err)
      toast.error('Error al crear pedido')
    }
  }

  function handleClienteSeleccionado(cliente) {
    setClienteSeleccionado(cliente)
    setMostrarSelectorCliente(false)

    // Recrear pedido con el cliente
    if (pedidoActivo) {
      // Cancelar pedido anterior si no tiene items
      if (!pedidoActivo.items || pedidoActivo.items.length === 0) {
        api.delete(`/admin/buffet/takeaway/${pedidoActivo.id}`).catch(() => {})
      }
    }

    crearPedidoBarra(cliente)
  }

  function limpiarCliente() {
    setClienteSeleccionado(null)

    // Recrear pedido sin cliente
    if (pedidoActivo) {
      if (!pedidoActivo.items || pedidoActivo.items.length === 0) {
        api.delete(`/admin/buffet/takeaway/${pedidoActivo.id}`).catch(() => {})
      }
    }

    crearPedidoBarra(null)
  }

  function handlePedidoCerrado() {
    // Limpiar y crear nuevo pedido
    setPedidoActivo(null)
    setClienteSeleccionado(null)
    creandoPedido.current = false
    setTimeout(() => {
      creandoPedido.current = true
      crearPedidoBarra()
    }, 100)
  }

  // Callback estable para evitar loops infinitos en GestionPedido
  const handleActualizarPedido = useCallback((pedidoActualizado) => {
    setPedidoActivo(pedidoActualizado)
  }, [])

  if (!pedidoActivo) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Preparando venta...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con info rápida */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-lg p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-3 rounded-full">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Venta Rápida en Barra</h1>
              <p className="text-orange-100 text-sm">
                Pedido #{pedidoActivo.numero} • Retiro inmediato
              </p>
            </div>
          </div>

          {/* Cliente */}
          <div className="flex items-center space-x-2">
            {clienteSeleccionado ? (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center space-x-2">
                <User className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{clienteSeleccionado.razonSocial}</div>
                  <div className="text-xs text-orange-100">
                    {clienteSeleccionado.tipoDocumento} {clienteSeleccionado.documento}
                  </div>
                </div>
                <button
                  onClick={limpiarCliente}
                  className="ml-2 p-1 hover:bg-white/20 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarSelectorCliente(true)}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors rounded-lg px-4 py-2 flex items-center space-x-2"
              >
                <User className="h-5 w-5" />
                <span className="font-medium">Agregar Cliente</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gestión del pedido */}
      <GestionPedido
        tipo="takeaway"
        id={pedidoActivo.id}
        onVolver={handlePedidoCerrado}
        onActualizar={handleActualizarPedido}
      />

      {/* Modal selector de cliente */}
      {mostrarSelectorCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <User className="h-6 w-6 text-orange-600" />
                <span>Seleccionar Cliente</span>
              </h2>
              <button
                onClick={() => setMostrarSelectorCliente(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <ClienteSelector
                onClienteSeleccionado={handleClienteSeleccionado}
                mostrarBotonCancelar={false}
              />
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
              <button
                onClick={() => setMostrarSelectorCliente(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
