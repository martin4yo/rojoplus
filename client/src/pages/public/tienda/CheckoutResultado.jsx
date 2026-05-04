import { useEffect, useState } from 'react'
import { useSearchParams, Link, useLocation } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, ShoppingBag } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import { useShopCart } from '../../../contexts/ShopCartContext'
import tiendaApi from '../../../services/tiendaApi'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

/**
 * Una sola página, decide modo según la ruta:
 *   /tienda/checkout/exito     → polling hasta que paymentStatus=paid
 *   /tienda/checkout/pendiente → muestra "esperando confirmación"
 *   /tienda/checkout/error     → muestra error
 */
export default function CheckoutResultado() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { clear } = useShopCart()
  const ref = params.get('ref') || params.get('external_reference') || localStorage.getItem('tiendaUltimoCheckout')

  const modo = location.pathname.endsWith('/exito') ? 'exito'
    : location.pathname.endsWith('/error') ? 'error'
    : location.pathname.endsWith('/pendiente') ? 'pendiente'
    : 'exito'

  const [pedido, setPedido] = useState(null)
  const [intentos, setIntentos] = useState(0)

  useEffect(() => {
    if (!ref || modo === 'error') return
    let cancelado = false

    async function fetchPedido() {
      try {
        const p = await tiendaApi.getPedidoPorRef(ref)
        if (cancelado) return
        setPedido(p)
        if (p.paymentStatus === 'paid') {
          clear() // limpiar carrito al confirmar
          localStorage.removeItem('tiendaUltimoCheckout')
        } else if (p.paymentStatus === 'pending' && intentos < 12) {
          setTimeout(() => setIntentos(i => i + 1), 2500)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchPedido()
    return () => { cancelado = true }
  }, [ref, intentos, modo])

  if (modo === 'error') {
    return (
      <div>
        <PublicHero eyebrow="Pago" title="No pudimos procesar el pago" subtitle="Mercado Pago rechazó la operación. Tu carrito sigue intacto." compact />
        <div className="text-center py-12 space-y-4">
          <XCircle className="w-20 h-20 text-red-500 mx-auto" />
          <Link to="/tienda/carrito" className="pub-cta inline-flex"><ShoppingBag className="w-4 h-4" /> Volver al carrito</Link>
        </div>
      </div>
    )
  }

  if (!ref) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No se encontró un pedido para mostrar.</p>
        <Link to="/tienda" className="pub-cta inline-flex mt-4"><ShoppingBag className="w-4 h-4" /> Ir a la tienda</Link>
      </div>
    )
  }

  const estaPagado = pedido?.paymentStatus === 'paid'
  const estaPendiente = pedido?.paymentStatus === 'pending'
  const estaExpirado = pedido?.paymentStatus === 'expired' || pedido?.paymentStatus === 'cancelled'

  return (
    <div>
      <PublicHero
        eyebrow="Pago"
        title={estaPagado ? '¡Listo!' : estaPendiente ? 'Procesando pago' : 'Estado del pedido'}
        subtitle={estaPagado
          ? 'Recibimos tu pago. Te enviamos un email con el detalle.'
          : estaPendiente
            ? 'Estamos confirmando con Mercado Pago...'
            : 'No se completó el pago.'}
        compact
      />

      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-6">
        {estaPagado ? (
          <CheckCircle className="w-24 h-24 text-emerald-500 mx-auto" />
        ) : estaPendiente ? (
          <Clock className="w-24 h-24 text-amber-500 mx-auto animate-pulse" />
        ) : estaExpirado ? (
          <XCircle className="w-24 h-24 text-gray-400 mx-auto" />
        ) : null}

        {pedido && (
          <div className="border-2 border-black/10 p-6 bg-white text-left max-w-md mx-auto">
            <div className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Pedido</div>
            <div className="font-display-sport text-3xl mb-3">{pedido.numero}</div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Estado:</span> <span className="font-medium">{pedido.estado?.nombre}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total:</span> <span className="font-bold">{fmt(pedido.total)}</span></div>
              {pedido.compradorEmail && <div className="flex justify-between"><span className="text-gray-500">Email:</span> <span className="text-xs">{pedido.compradorEmail}</span></div>}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link to="/tienda" className="pub-cta-outline inline-flex">Seguir comprando</Link>
          <Link to="/tienda/mis-pedidos" className="pub-cta inline-flex">Ver mis pedidos</Link>
        </div>
      </div>
    </div>
  )
}
