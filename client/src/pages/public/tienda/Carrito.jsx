import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Trash2, Plus, Minus, ArrowLeft } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import { useShopCart } from '../../../contexts/ShopCartContext'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

export default function Carrito() {
  const navigate = useNavigate()
  const { items, totalItems, totalPrecio, setCantidad, removeItem } = useShopCart()

  if (items.length === 0) {
    return (
      <div>
        <PublicHero eyebrow="Tienda" title="Tu carrito está vacío" subtitle="Agregá productos antes de pasar a pagar." />
        <div className="text-center py-12">
          <Link to="/tienda" className="pub-cta inline-flex">
            <ShoppingBag className="w-4 h-4" /> Ver productos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/tienda" className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-gray-500 hover:text-black mb-6">
          <ArrowLeft className="w-4 h-4" /> Seguir comprando
        </Link>

        <h1 className="font-display-sport uppercase tracking-tight mb-8" style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1, fontWeight: 400 }}>
          Carrito <span className="text-gray-400">({totalItems})</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {items.map(it => (
              <div key={it.varianteId} className="flex gap-4 p-4 border-2 border-black/10 bg-white">
                <div className="w-24 h-24 bg-gray-100 flex-shrink-0">
                  {it.foto ? (
                    <img src={it.foto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-display-sport uppercase tracking-tight" style={{ fontSize: 22, lineHeight: 1, fontWeight: 400 }}>
                    {it.nombre}
                  </div>
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">
                    {it.talle ? `Talle ${it.talle}` : ''}{it.color ? ` · ${it.color}` : ''}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex border-2 border-black/20">
                      <button onClick={() => setCantidad(it.varianteId, it.cantidad - 1)} className="px-2 hover:bg-black/5"><Minus className="w-3 h-3" /></button>
                      <span className="px-3 py-1 text-sm">{it.cantidad}</span>
                      <button onClick={() => setCantidad(it.varianteId, it.cantidad + 1)} className="px-2 hover:bg-black/5"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => removeItem(it.varianteId)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{fmt(it.precio)} c/u</p>
                  <p className="text-lg font-bold mt-1">{fmt(it.precio * it.cantidad)}</p>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:col-span-1">
            <div className="border-2 border-black p-6 bg-gray-50 sticky top-24">
              <h3 className="font-mono uppercase tracking-widest text-xs mb-4">Resumen</h3>
              <div className="flex justify-between mb-2 text-sm">
                <span>Subtotal ({totalItems} item{totalItems === 1 ? '' : 's'})</span>
                <span>{fmt(totalPrecio)}</span>
              </div>
              <div className="border-t border-black/20 mt-3 pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{fmt(totalPrecio)}</span>
              </div>
              <button
                onClick={() => navigate('/tienda/checkout')}
                className="pub-cta w-full mt-6"
              >Finalizar compra</button>
              <p className="text-[10px] uppercase tracking-wider font-mono text-gray-500 mt-3 text-center">Retiro en sede</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
