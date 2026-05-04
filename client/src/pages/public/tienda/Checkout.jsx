import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShoppingBag, ArrowLeft, AlertCircle } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import { useShopCart } from '../../../contexts/ShopCartContext'
import { useShopAuth } from '../../../contexts/ShopAuthContext'
import tiendaApi from '../../../services/tiendaApi'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

export default function Checkout() {
  const navigate = useNavigate()
  const { items, totalPrecio, totalItems } = useShopCart()
  const { customer, isAuthenticated } = useShopAuth()

  const [config, setConfig] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    documento: '',
    notas: '',
  })

  useEffect(() => {
    tiendaApi.getConfig().then(setConfig).catch(() => {})
  }, [])

  // Pre-llenar si está logueado
  useEffect(() => {
    if (customer) {
      setForm(f => ({
        ...f,
        nombre: customer.nombre || f.nombre,
        email: customer.email || f.email,
        telefono: customer.telefono || f.telefono,
        documento: customer.documento || f.documento,
      }))
    }
  }, [customer])

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-6">Tu carrito está vacío.</p>
        <Link to="/tienda" className="pub-cta inline-flex"><ShoppingBag className="w-4 h-4" /> Ir a la tienda</Link>
      </div>
    )
  }

  async function pagar(e) {
    e.preventDefault()
    setError(null)

    if (!form.nombre || !form.email) {
      setError('Nombre y email son obligatorios')
      return
    }

    setEnviando(true)
    try {
      const result = await tiendaApi.checkout({
        items: items.map(i => ({ productoVarianteId: i.varianteId, cantidad: i.cantidad })),
        comprador: {
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono || null,
          documento: form.documento || null,
        },
        notasComprador: form.notas || null,
      })

      // Guardar referencia para confirmation page
      localStorage.setItem('tiendaUltimoCheckout', result.externalReference)
      // Redirect a MP
      window.location.href = result.initPoint
    } catch (err) {
      console.error(err)
      if (err.code === 'STOCK_INSUFFICIENT' && err.details) {
        setError('Algunos productos no tienen stock disponible. Revisá el carrito.')
      } else {
        setError(err.message || 'Error al procesar el checkout')
      }
      setEnviando(false)
    }
  }

  return (
    <div>
      <PublicHero
        eyebrow="Checkout"
        title="Finalizar compra"
        subtitle="Verificá tus datos y pasá al pago seguro."
        compact
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/tienda/carrito" className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-gray-500 hover:text-black mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver al carrito
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <form onSubmit={pagar} className="lg:col-span-2 space-y-6">
            {!isAuthenticated && config?.permitirInvitados && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm">
                ¿Ya tenés cuenta en la tienda?{' '}
                <Link to="/tienda/login" className="underline font-medium">Iniciá sesión</Link>{' '}
                o seguí como invitado.
              </div>
            )}

            <div className="border-2 border-black/10 p-6 bg-white">
              <h2 className="font-mono uppercase tracking-widest text-xs mb-4">Datos del comprador</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none"
                    disabled={isAuthenticated}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1">DNI/CUIT</label>
                  <input
                    type="text"
                    value={form.documento}
                    onChange={e => setForm({ ...form, documento: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-mono uppercase tracking-wider mb-1">Notas (opcional)</label>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none"
                  placeholder="Alguna aclaración para el club..."
                />
              </div>
            </div>

            <div className="border-2 border-black/10 p-6 bg-gray-50">
              <h2 className="font-mono uppercase tracking-widest text-xs mb-2">Retiro</h2>
              <p className="text-sm">
                {config?.retiroDireccion
                  ? <><strong>{config.retiroDireccion}</strong></>
                  : 'En sede del club (te confirmamos los detalles por email)'}
              </p>
              {config?.retiroHorarios && (
                <p className="text-xs text-gray-600 mt-1">{config.retiroHorarios}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={enviando} className="pub-cta w-full">
              {enviando ? 'Redirigiendo...' : `Pagar ${fmt(totalPrecio)} con Mercado Pago`}
            </button>

            <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500 text-center">
              Vas a ser redirigido a Mercado Pago para completar el pago. El stock queda reservado por {config?.reservaTtlMin || 15} minutos.
            </p>
          </form>

          {/* Resumen */}
          <aside>
            <div className="border-2 border-black p-6 bg-white sticky top-24">
              <h3 className="font-mono uppercase tracking-widest text-xs mb-4">Tu pedido</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map(it => (
                  <div key={it.varianteId} className="flex justify-between text-sm gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{it.nombre}</div>
                      <div className="text-xs text-gray-500">
                        {it.talle ? `Talle ${it.talle}` : ''}{it.color ? ` · ${it.color}` : ''} · x{it.cantidad}
                      </div>
                    </div>
                    <div className="font-bold">{fmt(it.precio * it.cantidad)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-black/20 mt-4 pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{fmt(totalPrecio)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
