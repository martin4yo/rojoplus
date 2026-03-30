import { useState, useEffect, useCallback, useRef } from 'react'
import { User, X, Zap, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import GestionPedido from '../../../components/buffet/GestionPedido'
import ClienteSelector from '../../../components/buffet/ClienteSelector'
import ChatWidget from '../../../components/chat/ChatWidget'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function BuffetBarra() {
  const [pedidoActivo, setPedidoActivo] = useState(null)
  const [mostrarSelectorCliente, setMostrarSelectorCliente] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const creandoPedido = useRef(false)
  const pedidoActivoRef = useRef(null)

  // Mantener ref sincronizado con el estado para usarlo en cleanup
  useEffect(() => {
    pedidoActivoRef.current = pedidoActivo
  }, [pedidoActivo])

  // Al montar, crear un pedido temporal automáticamente
  useEffect(() => {
    if (!creandoPedido.current) {
      creandoPedido.current = true
      crearPedidoBarra()
    }
  }, [])

  // Limpiar pedido BARRA al desmontar el componente (solo unmount, no en cada cambio)
  useEffect(() => {
    return () => {
      const pedido = pedidoActivoRef.current
      if (pedido?.id && pedido.tipo === 'BARRA') {
        const items = pedido.items || []
        if (items.length === 0) {
          api.delete(`/admin/buffet/takeaway/${pedido.id}`).catch(() => {})
        }
      }
    }
  }, [])

  async function crearPedidoBarra(cliente = null) {
    try {
      const ahora = new Date()

      const res = await api.post('/admin/buffet/takeaway', {
        nombreCliente: cliente?.razonSocial || 'Venta Barra',
        telefono: cliente?.telefono || '',
        tipo: 'BARRA',
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
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header personalizado con gradiente naranja */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePedidoCerrado}
            className="p-2 hover:bg-white/20 rounded transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Venta Rápida en Barra
            </h1>
            <p className="text-sm text-orange-100">Pedido #{pedidoActivo.numero}</p>
          </div>
        </div>

        {/* Cliente */}
        <div>
          {clienteSeleccionado ? (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
              <User className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">{clienteSeleccionado.razonSocial}</div>
                <div className="text-xs text-orange-100">
                  {clienteSeleccionado.tipoDocumento} {clienteSeleccionado.documento}
                </div>
              </div>
              <button
                onClick={limpiarCliente}
                className="ml-2 p-1 hover:bg-white/30 rounded transition-colors"
                title="Quitar cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMostrarSelectorCliente(true)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <User className="h-4 w-4" />
              Agregar Cliente
            </button>
          )}
        </div>
      </div>

      {/* Gestión del pedido */}
      <div className="flex-1 min-h-0">
        <GestionPedido
          tipo="takeaway"
          id={pedidoActivo.id}
          onVolver={handlePedidoCerrado}
          onActualizar={handleActualizarPedido}
          useFlexHeight={true}
          hideHeader={true}
        />
      </div>

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

      {/* Xavi - Chat Widget para Camareros */}
      <ChatWidget role="camarero" position="bottom-right" />
    </div>
  )
}
