import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, LogOut } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import tiendaApi from '../../../services/tiendaApi'
import { useShopAuth } from '../../../contexts/ShopAuthContext'

function fmt(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }
function fecha(d) { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function MisPedidos() {
  const navigate = useNavigate()
  const { isAuthenticated, customer, logout } = useShopAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/tienda/login')
      return
    }
    tiendaApi.getMisPedidos()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  if (!isAuthenticated) return null

  return (
    <div>
      <PublicHero eyebrow="Tienda" title="Mis pedidos" subtitle={customer?.email} compact>
        <button onClick={() => { logout(); navigate('/tienda') }} className="pub-cta-outline inline-flex">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </PublicHero>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando...</div>
        ) : pedidos.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Todavía no tenés pedidos.</p>
            <Link to="/tienda" className="pub-cta inline-flex">Ir a la tienda</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map(p => (
              <div key={p.id} className="border-2 border-black/10 p-4 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-widest text-gray-500">{fecha(p.createdAt)}</div>
                    <div className="font-display-sport text-2xl">{p.numero}</div>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 text-xs font-mono uppercase tracking-wider" style={{ background: `${p.estado?.color}20`, color: p.estado?.color }}>
                      {p.estado?.nombre}
                    </span>
                    <div className="font-bold text-lg mt-1">{fmt(p.total)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.items?.slice(0, 4).map(it => (
                    <div key={it.id} className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-50 border border-black/5">
                      {it.snapshotImagen && <img src={it.snapshotImagen} alt="" className="w-8 h-8 object-cover" />}
                      <div>
                        <div className="font-medium">{it.snapshotNombre}</div>
                        <div className="text-gray-500">x{Number(it.cantidad)}{it.snapshotTalle ? ` · ${it.snapshotTalle}` : ''}</div>
                      </div>
                    </div>
                  ))}
                  {p.items?.length > 4 && (
                    <div className="text-xs text-gray-500 self-center">+{p.items.length - 4} más</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
