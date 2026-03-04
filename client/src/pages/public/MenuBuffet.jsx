import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Phone, MapPin, Clock, ArrowLeft, Star, Coffee, Pizza, Sandwich, IceCream, Salad, Wine } from 'lucide-react'

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

  useEffect(() => {
    cargarMenu()
  }, [])

  async function cargarMenu() {
    try {
      const res = await fetch('/api/buffet/menu-publico')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p className="text-white/80">Cargando menú...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Hero Header */}
      <header className="relative bg-gradient-to-b from-red-900 via-red-800 to-red-700 text-white overflow-hidden">
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Volver al sitio</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/80">
              <span className="flex items-center gap-2">
                <Clock size={16} />
                Lun-Dom 12:00 - 22:00
              </span>
              <span className="flex items-center gap-2">
                <Phone size={16} />
                (0230) 444-5678
              </span>
            </div>
          </div>

          <div className="text-center">
            <img
              src="/images/club/pngwing.com.png"
              alt="Club Sportivo Pilar"
              className="h-24 md:h-32 w-auto mx-auto mb-4 drop-shadow-2xl"
            />
            <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">
              Buffet del Club
            </h1>
            <p className="text-xl text-red-200 font-light">
              Club Sportivo Pilar
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm">
              <UtensilsCrossed size={16} />
              <span>Cocina casera y parrilla</span>
            </div>
          </div>
        </div>

        {/* Onda decorativa */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#f5f5f4"/>
          </svg>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Categorías con wrap */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categorias.map(cat => {
              const Icono = getIcono(cat.codigo)
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaActiva(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                    categoriaActiva === cat.id
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  style={categoriaActiva === cat.id ? {
                    backgroundColor: cat.color || '#DC2626',
                    boxShadow: `0 4px 14px ${cat.color || '#DC2626'}40`
                  } : {}}
                >
                  <Icono size={18} />
                  <span>{cat.nombre}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    categoriaActiva === cat.id ? 'bg-white/20' : 'bg-stone-200'
                  }`}>
                    {cat.productos?.length || 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenido de la categoría */}
        {categoriaSeleccionada && (
          <div className="animate-fadeIn">
            {/* Header de categoría con imagen */}
            <div className="relative rounded-2xl overflow-hidden mb-8 h-48 md:h-64">
              <img
                src={getImagen(categoriaSeleccionada.codigo)}
                alt={categoriaSeleccionada.nombre}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">
                  {categoriaSeleccionada.nombre}
                </h2>
                {categoriaSeleccionada.descripcion && (
                  <p className="text-white/80">{categoriaSeleccionada.descripcion}</p>
                )}
              </div>
            </div>

            {/* Grid de productos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriaSeleccionada.productos?.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border border-stone-100 flex items-start gap-4"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Imagen del producto o placeholder */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200">
                    {prod.imagen ? (
                      <img
                        src={prod.imagen}
                        alt={prod.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed size={28} className="text-stone-300" />
                      </div>
                    )}
                  </div>

                  {/* Info del producto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                        {prod.nombre}
                        {prod.destacado && (
                          <Star size={14} className="text-amber-500 fill-amber-500" />
                        )}
                      </h3>
                      <span className="text-lg font-bold text-red-600 whitespace-nowrap">
                        ${Number(prod.precio).toLocaleString('es-AR')}
                      </span>
                    </div>
                    {prod.descripcion && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2">{prod.descripcion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {categoriaSeleccionada.productos?.length === 0 && (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <UtensilsCrossed size={48} className="mx-auto text-stone-300 mb-4" />
                <p className="text-stone-500">No hay productos disponibles en esta categoría</p>
              </div>
            )}
          </div>
        )}

        {categorias.length === 0 && (
          <div className="bg-white rounded-xl p-16 text-center shadow-sm">
            <UtensilsCrossed size={64} className="mx-auto text-stone-300 mb-6" />
            <h2 className="text-2xl font-bold text-stone-700 mb-2">Menú no disponible</h2>
            <p className="text-stone-500">El menú del buffet estará disponible próximamente</p>
          </div>
        )}
      </main>

      {/* Footer elegante */}
      <footer className="bg-stone-900 text-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo y descripción */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/images/club/pngwing.com.png"
                  alt="Club Sportivo Pilar"
                  className="h-12 w-auto brightness-0 invert opacity-80"
                />
                <div>
                  <h3 className="font-bold text-lg">Club Sportivo Pilar</h3>
                  <p className="text-stone-400 text-sm">El Rojo de la Avenida - Desde 1912</p>
                </div>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">
                Nuestro buffet ofrece comida casera, parrilla y las mejores minutas
                en un ambiente familiar. Abierto para socios y visitantes.
              </p>
            </div>

            {/* Horarios */}
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Clock size={18} className="text-red-500" />
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
                  <Phone size={16} className="text-red-500" />
                  (0230) 444-5678
                </li>
                <li className="flex items-start gap-2">
                  <MapPin size={16} className="text-red-500 mt-0.5" />
                  <span>Av. Sportivo 1234<br/>Pilar, Buenos Aires</span>
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
