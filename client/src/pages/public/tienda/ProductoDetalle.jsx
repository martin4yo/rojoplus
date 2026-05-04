import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, Plus, Minus, Tag, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import tiendaApi from '../../../services/tiendaApi'
import { useShopCart } from '../../../contexts/ShopCartContext'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

export default function ProductoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useShopCart()
  const [producto, setProducto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fotoActiva, setFotoActiva] = useState(0)
  const [varianteId, setVarianteId] = useState(null)
  const [cantidad, setCantidad] = useState(1)

  useEffect(() => {
    tiendaApi.getProducto(id)
      .then(p => {
        setProducto(p)
        // Pre-select primera variante con stock
        const conStock = p.variantes?.find(v => !v.sinStock)
        if (conStock) setVarianteId(conStock.id)
      })
      .catch(() => navigate('/tienda'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-20 text-gray-500">Cargando...</div>
  if (!producto) return null

  const variante = producto.variantes?.find(v => v.id === varianteId)
  const precioFinal = variante?.precio ?? producto.precio
  const precioLista = variante?.precioLista ?? producto.precioLista
  const enOferta = variante?.enOferta ?? producto.enOferta

  function agregar() {
    if (!variante) {
      toast.error('Elegí un talle')
      return
    }
    if (variante.sinStock) {
      toast.error('Sin stock')
      return
    }
    if (cantidad > variante.stockDisponible) {
      toast.error(`Solo quedan ${variante.stockDisponible} unidades disponibles`)
      return
    }
    addItem({
      productoId: producto.id,
      varianteId: variante.id,
      nombre: producto.nombre,
      talle: variante.talle,
      color: variante.color,
      precio: precioFinal,
      foto: producto.fotos?.[0]?.url || null,
      cantidad,
      stockDisponible: variante.stockDisponible,
    })
    toast.success('Agregado al carrito')
  }

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/tienda" className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-gray-500 hover:text-black mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver a la tienda
        </Link>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Galería */}
          <div className="space-y-3">
            <div className="aspect-square bg-gray-100 overflow-hidden relative">
              {producto.fotos?.length > 0 ? (
                <img src={producto.fotos[fotoActiva]?.url} alt={producto.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ShoppingBag className="w-24 h-24" />
                </div>
              )}
              {enOferta && (
                <span className="absolute top-4 left-4 px-3 py-1.5 font-mono uppercase tracking-wider font-bold bg-amber-500 text-white">OFERTA</span>
              )}
              {producto.destacado && !enOferta && (
                <span className="absolute top-4 left-4 px-3 py-1.5 font-mono uppercase tracking-wider font-bold bg-black text-white">Destacado</span>
              )}
            </div>
            {producto.fotos?.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {producto.fotos.map((f, idx) => (
                  <button
                    key={f.id}
                    onClick={() => setFotoActiva(idx)}
                    className={`aspect-square overflow-hidden border-2 ${idx === fotoActiva ? 'border-black' : 'border-transparent opacity-60'}`}
                  >
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {producto.categoria && (
              <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">{producto.categoria.nombre}</p>
            )}
            <h1 className="font-display-sport uppercase tracking-tight" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1, fontWeight: 400 }}>
              {producto.nombre}
            </h1>

            <div className="mt-6 flex items-baseline gap-3">
              {enOferta && (
                <span className="text-xl text-gray-400 line-through">{fmt(precioLista)}</span>
              )}
              <span className={`text-3xl md:text-4xl font-bold ${enOferta ? 'text-amber-600' : ''}`}>{fmt(precioFinal)}</span>
            </div>

            {producto.descripcion && (
              <div className="mt-6 text-gray-600 leading-relaxed whitespace-pre-line">{producto.descripcion}</div>
            )}

            {/* Variantes */}
            {producto.variantes?.length > 0 && (
              <div className="mt-8">
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">Talle / Variante</p>
                <div className="flex flex-wrap gap-2">
                  {producto.variantes.map(v => {
                    const label = `${v.talle || 'Único'}${v.color ? ` · ${v.color}` : ''}`
                    const seleccionado = v.id === varianteId
                    return (
                      <button
                        key={v.id}
                        onClick={() => !v.sinStock && setVarianteId(v.id)}
                        disabled={v.sinStock}
                        className={`px-4 py-2 border-2 text-sm font-mono uppercase tracking-wider transition ${
                          seleccionado
                            ? 'bg-black text-white border-black'
                            : v.sinStock
                              ? 'border-gray-200 text-gray-300 line-through cursor-not-allowed'
                              : 'border-black/30 hover:border-black'
                        }`}
                      >{label}</button>
                    )
                  })}
                </div>
                {variante && (
                  <p className="text-xs text-gray-500 mt-2">
                    {variante.stockDisponible > 0 ? `${variante.stockDisponible} disponibles` : 'Sin stock'}
                  </p>
                )}
              </div>
            )}

            {/* Cantidad + agregar */}
            <div className="mt-8 flex items-stretch gap-3">
              <div className="flex border-2 border-black">
                <button
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="px-3 hover:bg-black/5"
                ><Minus className="w-4 h-4" /></button>
                <input
                  type="number"
                  value={cantidad}
                  min={1}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center outline-none"
                />
                <button
                  onClick={() => setCantidad(cantidad + 1)}
                  className="px-3 hover:bg-black/5"
                ><Plus className="w-4 h-4" /></button>
              </div>

              <button
                onClick={agregar}
                disabled={!variante || variante.sinStock}
                className="pub-cta flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" /> Agregar al carrito
              </button>
            </div>

            <div className="mt-8 pt-6 border-t text-xs font-mono uppercase tracking-wider text-gray-500">
              <p>Retiro en sede</p>
              <p>Pago seguro con Mercado Pago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
