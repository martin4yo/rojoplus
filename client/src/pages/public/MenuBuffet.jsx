import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Phone, MapPin, Clock, ArrowLeft, Star } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-red-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-2 hover:bg-red-700 rounded-lg">
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <UtensilsCrossed size={28} />
                  Buffet del Club
                </h1>
                <p className="text-red-200 text-sm">Club Sportivo Pilar</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <Clock size={16} />
                Lun-Vie 12:00 - 22:00
              </span>
              <span className="flex items-center gap-2">
                <Phone size={16} />
                (0230) 444-5678
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Categorías */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              className={`px-6 py-3 rounded-full font-medium whitespace-nowrap transition-all ${
                categoriaActiva === cat.id
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
              }`}
              style={categoriaActiva === cat.id ? { backgroundColor: cat.color || '#DC2626' } : {}}
            >
              {cat.nombre}
              <span className="ml-2 text-sm opacity-75">
                ({cat.productos?.length || 0})
              </span>
            </button>
          ))}
        </div>

        {/* Productos de la categoría */}
        {categoriaSeleccionada && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {categoriaSeleccionada.nombre}
            </h2>
            {categoriaSeleccionada.descripcion && (
              <p className="text-gray-600 mb-6">{categoriaSeleccionada.descripcion}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoriaSeleccionada.productos?.map(prod => (
                <div
                  key={prod.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {prod.imagen ? (
                    <img
                      src={prod.imagen}
                      alt={prod.nombre}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <UtensilsCrossed size={48} className="text-gray-300" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900">
                        {prod.nombre}
                        {prod.destacado && (
                          <Star size={16} className="inline ml-2 text-yellow-500 fill-yellow-500" />
                        )}
                      </h3>
                      <span className="text-xl font-bold text-green-600">
                        ${Number(prod.precio).toLocaleString()}
                      </span>
                    </div>
                    {prod.descripcion && (
                      <p className="text-gray-600 text-sm">{prod.descripcion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {categoriaSeleccionada.productos?.length === 0 && (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                No hay productos disponibles en esta categoría
              </div>
            )}
          </div>
        )}

        {categorias.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center">
            <UtensilsCrossed size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">Menú no disponible</h2>
            <p className="text-gray-500">El menú del buffet estará disponible próximamente</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-3">Club Sportivo Pilar</h3>
              <p className="text-gray-400 text-sm">
                El Rojo de la Avenida - Desde 1912
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Horarios</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>Lunes a Viernes: 12:00 - 22:00</li>
                <li>Sábados: 12:00 - 00:00</li>
                <li>Domingos: 12:00 - 20:00</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Contacto</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <Phone size={14} />
                  (0230) 444-5678
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={14} />
                  Av. Sportivo 1234, Pilar
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-6 text-center text-gray-500 text-sm">
            <p>Solo visualización. Para pedidos, acérquese al buffet.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
