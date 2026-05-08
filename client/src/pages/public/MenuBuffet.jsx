import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Phone, MapPin, Clock, ArrowLeft, Star, Coffee, Pizza, Sandwich, IceCream, Salad, Wine, ChevronDown, X, Download } from 'lucide-react'
import TenantLogo from '../../components/TenantLogo'
import LoadingSpinner from '../../components/LoadingSpinner'
import PublicHero from '../../components/public/PublicHero'

// Imágenes de ejemplo por categoría (usando URLs de imágenes libres de derechos)
const imagenesPorCategoria = {
  'SAND': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
  'PIZZ': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'EMPA': 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400&h=300&fit=crop',
  'MINU': 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=400&h=300&fit=crop',
  'ENSA': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  'POST': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop',
  'CAFE': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop',
  'GOLO': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=300&fit=crop',
  'PANI': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
  'HELA': 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
  'COMB': 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop',
  'DESA': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop',
  'GASE': 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400&h=300&fit=crop',
  'AGJU': 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop',
  'ALCO': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop',
}

// Iconos por categoría
const iconosPorCategoria = {
  'SAND': Sandwich,
  'PIZZ': Pizza,
  'EMPA': UtensilsCrossed,
  'MINU': UtensilsCrossed,
  'ENSA': Salad,
  'POST': IceCream,
  'CAFE': Coffee,
  'GOLO': Star,
  'PANI': Coffee,
  'HELA': IceCream,
  'COMB': Star,
  'DESA': Coffee,
  'GASE': Coffee,
  'AGJU': Coffee,
  'ALCO': Wine,
}

export default function MenuBuffet() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [menuMobileAbierto, setMenuMobileAbierto] = useState(false)

  useEffect(() => {
    cargarMenu()
  }, [])

  function getTenantHeaders() {
    const hostname = window.location.hostname
    let slug = null
    if (hostname.includes('localhost')) {
      const m = hostname.match(/^([^.]+)\.localhost/)
      if (m) slug = m[1]
    } else {
      const parts = hostname.split('.')
      if (parts.length > 2 && parts[0] !== 'www') slug = parts[0]
    }
    return slug ? { 'X-Tenant-Slug': slug } : {}
  }

  async function cargarMenu() {
    try {
      const res = await fetch('/api/buffet/menu-publico', { headers: getTenantHeaders() })
      const data = await res.json()
      if (data.success) {
        setCategorias(data.data || [])
        if (data.data?.length > 0) {
          setCategoriaActiva(data.data[0].id)
        }
      }
    } catch (err) {
      console.error('Error cargando menú:', err)
    } finally {
      setLoading(false)
    }
  }

  const categoriaSeleccionada = categorias.find(c => c.id === categoriaActiva)
  const getIcono = (codigo) => iconosPorCategoria[codigo] || UtensilsCrossed
  const getImagen = (codigo) => imagenesPorCategoria[codigo] || null

  async function descargarPDF() {
    try {
      const res = await fetch('/api/buffet/menu-publico/pdf', { headers: getTenantHeaders() })
      if (!res.ok) throw new Error('Error al generar PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `menu-buffet-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error descargando PDF:', err)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Carta del club"
        title="Buffet."
        subtitle="Lo que hay para comer y tomar hoy."
        compact
      >
        <button
          onClick={descargarPDF}
          className="group inline-flex items-center gap-3 px-5 py-3 transition-all"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--accent-fg, #fff)',
            fontFamily: 'Geist Mono, monospace',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: 600,
          }}
          title="Descargar menú en PDF"
        >
          <Download size={16} />
          <span>Descargar PDF</span>
        </button>
      </PublicHero>

      {/* Estado de carga: mostrar spinner DEBAJO del hero (no reemplaza la página) */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      )}

      {!loading && (
      <main className="max-w-6xl mx-auto px-4 pt-4 pb-8">
        {/* Categorías - Mobile: dropdown, Desktop: flex-wrap */}

        {/* Mobile: Botón dropdown athletic */}
        <div className="md:hidden mb-4 relative">
          <button
            onClick={() => setMenuMobileAbierto(!menuMobileAbierto)}
            className="w-full p-4 flex items-center justify-between transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              {categoriaSeleccionada && (
                <>
                  {(() => {
                    const Icono = getIcono(categoriaSeleccionada.codigo)
                    return <Icono size={18} style={{ color: 'var(--text-dim)' }} />
                  })()}
                  <span
                    className="font-mono uppercase tracking-[0.18em] font-semibold"
                    style={{ fontSize: 11, color: 'var(--color-text-primary, var(--text))' }}
                  >
                    {categoriaSeleccionada.nombre}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5" style={{
                    backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)'
                  }}>
                    {categoriaSeleccionada.productos?.length || 0}
                  </span>
                </>
              )}
            </div>
            <ChevronDown
              size={18}
              style={{ color: 'var(--text-muted)' }}
              className={`transition-transform ${menuMobileAbierto ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown móvil */}
          {menuMobileAbierto && (
            <div
              className="absolute left-0 right-0 mt-px z-50 max-h-80 overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {categorias.map(cat => {
                const Icono = getIcono(cat.codigo)
                const activo = categoriaActiva === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoriaActiva(cat.id)
                      setMenuMobileAbierto(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{
                      backgroundColor: activo ? 'var(--accent-soft)' : 'transparent',
                      borderLeft: activo ? `3px solid ${cat.color || 'var(--color-primary)'}` : '3px solid transparent',
                      color: activo ? 'var(--color-text-primary, var(--text))' : 'var(--text-dim)',
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      fontWeight: 600,
                    }}
                  >
                    <Icono size={16} />
                    <span className="flex-1 text-left">{cat.nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.5" style={{
                      backgroundColor: activo ? (cat.color || 'var(--color-primary)') : 'var(--bg-app)',
                      color: activo ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                    }}>
                      {cat.productos?.length || 0}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop: layout sidebar izquierda + contenido derecha */}
        <div className="hidden md:grid md:grid-cols-[260px_1fr] gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {/* Sidebar izquierda — lista de categorías */}
          <aside style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              Categorías
            </div>
            <nav className="flex flex-col">
              {categorias.map(cat => {
                const Icono = getIcono(cat.codigo)
                const activo = categoriaActiva === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoriaActiva(cat.id)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors text-left"
                    style={{
                      backgroundColor: activo ? 'var(--accent-soft)' : 'transparent',
                      borderLeft: activo ? `3px solid ${cat.color || 'var(--color-primary)'}` : '3px solid transparent',
                      color: activo ? 'var(--color-text-primary, var(--text))' : 'var(--text-dim)',
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.18em',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <Icono size={16} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{cat.nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.5 flex-shrink-0" style={{
                      backgroundColor: activo ? (cat.color || 'var(--color-primary)') : 'var(--bg-app)',
                      color: activo ? 'var(--accent-fg, #fff)' : 'var(--text-muted)',
                    }}>
                      {cat.productos?.length || 0}
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Contenido derecha */}
          <section style={{ backgroundColor: 'var(--bg-surface)' }}>
            {categoriaSeleccionada ? (
              <div className="animate-fadeIn">
                {/* Header de categoría con imagen */}
                <div className="relative overflow-hidden h-48 md:h-64" style={{ borderBottom: '1px solid var(--border)' }}>
                  <img
                    src={getImagen(categoriaSeleccionada.codigo)}
                    alt={categoriaSeleccionada.nombre}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 mb-2">
                      Categoría
                    </div>
                    <h2 className="font-display-sport text-white" style={{ fontSize: 'clamp(28px, 4vw, 56px)', lineHeight: 0.95 }}>
                      {categoriaSeleccionada.nombre}
                    </h2>
                    {categoriaSeleccionada.descripcion && (
                      <p className="text-white/80 mt-2 max-w-2xl" style={{ fontWeight: 300 }}>
                        {categoriaSeleccionada.descripcion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lista de productos */}
                <div className="flex flex-col">
                  {categoriaSeleccionada.productos?.map((prod, idx) => (
                    <div
                      key={prod.id}
                      className="p-4 flex items-start gap-4 transition-colors hover:bg-pub-fg-10"
                      style={{ borderBottom: '1px solid var(--border)', animationDelay: `${idx * 30}ms` }}
                    >
                      <div
                        className="w-20 h-20 flex-shrink-0 overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}
                      >
                        {prod.imagen ? (
                          <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <UtensilsCrossed size={28} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary, var(--text))' }}>
                            {prod.nombre}
                            {prod.destacado && (
                              <Star size={14} className="text-amber-500 fill-amber-500" />
                            )}
                          </h3>
                          <span
                            className="font-bold whitespace-nowrap"
                            style={{ fontSize: '1.05rem', color: 'var(--color-primary)', fontFamily: 'Geist Mono, monospace' }}
                          >
                            ${Number(prod.precio).toLocaleString('es-AR')}
                          </span>
                        </div>
                        {prod.descripcion && (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-dim)' }}>{prod.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {categoriaSeleccionada.productos?.length === 0 && (
                    <div className="p-12 text-center">
                      <UtensilsCrossed size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                      <p style={{ color: 'var(--text-dim)' }}>No hay productos disponibles en esta categoría</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center" style={{ color: 'var(--text-dim)' }}>
                Seleccioná una categoría
              </div>
            )}
          </section>
        </div>

        {/* Mobile: contenido completo (la sidebar se reemplaza por el dropdown ya existente) */}
        <div className="md:hidden">
          {categoriaSeleccionada && (
            <div className="animate-fadeIn">
              <div className="relative overflow-hidden h-48" style={{ border: '1px solid var(--border)', marginBottom: 0 }}>
                <img
                  src={getImagen(categoriaSeleccionada.codigo)}
                  alt={categoriaSeleccionada.nombre}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 mb-1">
                    Categoría
                  </div>
                  <h2 className="font-display-sport text-white" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 0.95 }}>
                    {categoriaSeleccionada.nombre}
                  </h2>
                  {categoriaSeleccionada.descripcion && (
                    <p className="text-white/80 text-sm mt-1" style={{ fontWeight: 300 }}>
                      {categoriaSeleccionada.descripcion}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                {categoriaSeleccionada.productos?.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 flex items-start gap-3"
                    style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-16 h-16 flex-shrink-0 overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: 'var(--bg-surface-hi)', border: '1px solid var(--border)' }}
                    >
                      {prod.imagen ? (
                        <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <UtensilsCrossed size={22} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-text-primary, var(--text))' }}>
                          {prod.nombre}
                          {prod.destacado && <Star size={12} className="text-amber-500 fill-amber-500" />}
                        </h3>
                        <span
                          className="font-bold whitespace-nowrap text-sm"
                          style={{ color: 'var(--color-primary)', fontFamily: 'Geist Mono, monospace' }}
                        >
                          ${Number(prod.precio).toLocaleString('es-AR')}
                        </span>
                      </div>
                      {prod.descripcion && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-dim)' }}>{prod.descripcion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {categorias.length === 0 && (
          <div className="bg-white rounded-xl p-16 text-center shadow-sm">
            <UtensilsCrossed size={64} className="mx-auto text-stone-300 mb-6" />
            <h2 className="text-2xl font-bold text-stone-700 mb-2">Menú no disponible</h2>
            <p className="text-stone-500">El menú del buffet estará disponible próximamente</p>
          </div>
        )}
      </main>
      )}

      {/* Footer elegante */}
      <footer className="bg-stone-900 text-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo y descripción */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <TenantLogo className="h-10 w-auto brightness-0 invert opacity-80" />
                <div>
                  <h3 className="font-bold text-lg">Club Sportivo Pilar</h3>
                  <p className="text-stone-400 text-sm">El Rojo de la Avenida - Desde 1912</p>
                </div>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">
                Nuestro buffet ofrece comida casera y las mejores minutas
                en un ambiente familiar. Abierto para socios y visitantes.
              </p>
            </div>

            {/* Horarios */}
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                Horarios
              </h4>
              <ul className="text-stone-400 text-sm space-y-2">
                <li className="flex justify-between">
                  <span>Lunes a Viernes</span>
                  <span>12:00 - 22:00</span>
                </li>
                <li className="flex justify-between">
                  <span>Sábados</span>
                  <span>12:00 - 00:00</span>
                </li>
                <li className="flex justify-between">
                  <span>Domingos</span>
                  <span>12:00 - 20:00</span>
                </li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="font-semibold mb-4">Contacto</h4>
              <ul className="text-stone-400 text-sm space-y-3">
                <li className="flex items-center gap-2">
                  <Phone size={16} className="text-primary" />
                  (0230) 442-0297
                </li>
                <li className="flex items-start gap-2">
                  <MapPin size={16} className="text-primary mt-0.5" />
                  <span>Av. Tomás Márquez 1125<br/>Pilar, Buenos Aires</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-stone-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-stone-500 text-sm">
              © {new Date().getFullYear()} Club Sportivo Pilar. Todos los derechos reservados.
            </p>
            <p className="text-stone-500 text-xs bg-stone-800 px-3 py-1.5 rounded-full">
              Solo visualización - Para pedidos, acérquese al buffet
            </p>
          </div>
        </div>
      </footer>

      {/* Estilos adicionales */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
