import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShoppingBag, Tag, Star } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import tiendaApi from '../../../services/tiendaApi'
import { useShopCart } from '../../../contexts/ShopCartContext'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

export default function Tienda() {
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | destacados | ofertas
  const [orden, setOrden] = useState('') // '' | precio_asc | precio_desc | nombre
  const { totalItems } = useShopCart()

  useEffect(() => {
    tiendaApi.getConfig().then(setConfig).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(cargar, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, filtro, orden])

  async function cargar() {
    setLoading(true)
    try {
      const params = {}
      if (busqueda) params.q = busqueda
      if (filtro === 'destacados') params.destacados = 'true'
      if (filtro === 'ofertas') params.ofertas = 'true'
      if (orden) params.orden = orden
      const data = await tiendaApi.getProductos(params)
      setProductos(data || [])
    } catch (err) {
      console.error(err)
      setProductos([])
    } finally { setLoading(false) }
  }

  const tituloHero = config?.tituloHero || 'Tienda'
  const subHero = config?.subtituloHero || ''

  if (config && config.habilitada === false) {
    return (
      <div>
        <PublicHero eyebrow="Tienda" title="Próximamente" subtitle="La tienda online del club abre muy pronto." />
      </div>
    )
  }

  return (
    <div>
      <PublicHero
        eyebrow="Merchandising"
        title={tituloHero}
        subtitle={subHero || 'Indumentaria, accesorios y productos oficiales del club. Retiro en sede.'}
      >
        <Link
          to="/tienda/carrito"
          className="pub-cta inline-flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" /> Ver carrito {totalItems > 0 && <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{totalItems}</span>}
        </Link>
      </PublicHero>

      <section className="bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center justify-between mb-8 pb-4 border-b">
            <div className="flex flex-wrap gap-2">
              <FilterPill active={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</FilterPill>
              <FilterPill active={filtro === 'destacados'} onClick={() => setFiltro('destacados')}><Star className="w-3 h-3 inline" /> Destacados</FilterPill>
              <FilterPill active={filtro === 'ofertas'} onClick={() => setFiltro('ofertas')}><Tag className="w-3 h-3 inline" /> Ofertas</FilterPill>
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="pl-10 pr-3 py-2 border-2 border-black/10 focus:border-black/40 outline-none text-sm w-48"
                />
              </div>
              <select value={orden} onChange={e => setOrden(e.target.value)} className="border-2 border-black/10 px-2 py-2 text-sm">
                <option value="">Ordenar...</option>
                <option value="precio_asc">Menor precio</option>
                <option value="precio_desc">Mayor precio</option>
                <option value="nombre">Nombre A-Z</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="text-center py-20 text-gray-500">Cargando productos...</div>
          ) : productos.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay productos disponibles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {productos.map(p => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs uppercase tracking-wider font-mono border-2 transition ${
        active ? 'bg-black text-white border-black' : 'bg-white border-black/20 text-black/70 hover:border-black/60'
      }`}
    >{children}</button>
  )
}

function ProductCard({ producto }) {
  const sinStock = producto.sinStock
  return (
    <Link to={`/tienda/${producto.id}`} className="group block">
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {producto.foto ? (
          <img
            src={producto.foto}
            alt={producto.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ShoppingBag className="w-16 h-16" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {producto.enOferta && (
            <span className="px-2 py-1 text-xs font-mono uppercase tracking-wider font-bold bg-amber-500 text-white">OFERTA</span>
          )}
          {producto.destacado && !producto.enOferta && (
            <span className="px-2 py-1 text-xs font-mono uppercase tracking-wider font-bold bg-black text-white">Destacado</span>
          )}
        </div>

        {sinStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="font-mono uppercase text-xs tracking-widest">Sin stock</span>
          </div>
        )}
      </div>

      <div className="pt-3">
        <h3 className="font-display-sport text-xl leading-tight uppercase tracking-tight" style={{ fontWeight: 400 }}>
          {producto.nombre}
        </h3>
        {producto.categoria && (
          <p className="text-xs uppercase tracking-wider text-gray-500 font-mono mt-1">{producto.categoria.nombre}</p>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          {producto.enOferta && (
            <span className="text-sm text-gray-400 line-through">{fmt(producto.precioLista)}</span>
          )}
          <span className={`text-lg font-bold ${producto.enOferta ? 'text-amber-600' : ''}`}>{fmt(producto.precio)}</span>
        </div>
      </div>
    </Link>
  )
}
