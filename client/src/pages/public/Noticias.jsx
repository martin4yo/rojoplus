import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Search } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// Noticias de ejemplo (fallback si no hay datos en la BD)
const noticiasEjemplo = [
  {
    id: 1,
    titulo: 'Sportivo Pilar clasificó a Playoffs Interconferencias',
    extracto: 'En un partido de altísima tensión, el equipo de La Caldera superó a Gimnasia de Ituzaingó 73-71 y avanzó en la Liga Federal 2025.',
    imagen: '/images/club/68f64b9d.jpeg',
    fechaPublicacion: '2026-01-28',
    categoria: 'DEPORTES',
  },
  {
    id: 2,
    titulo: 'Categoría 2012: ¡Tricampeones!',
    extracto: 'La categoría 2012 cerró el grupo con victoria 3-0 y se consagró tricampeona (2023/24/25) de la Liga Argentina. Un orgullo para el club.',
    imagen: '/images/club/pngwing.com.png',
    fechaPublicacion: '2026-01-20',
    categoria: 'DEPORTES',
  },
  {
    id: 3,
    titulo: 'Mendoza Cup 2024: Campeones internacionales',
    extracto: 'Nuestra categoría 2012 conquistó el torneo internacional Mendoza Cup 2024, sumando otro título a su impresionante palmarés.',
    imagen: '/images/club/gf6127dd755feb3d69457e16a134e721500df191447b9681a6e921d8f92a648aef97dcca6db09cdf4f391cdbe339b3441_1280.jpg',
    fechaPublicacion: '2025-12-15',
    categoria: 'DEPORTES',
  },
  {
    id: 4,
    titulo: 'Femenino campeón: Sportivo venció a Derqui',
    extracto: 'El básquet femenino de Sportivo Pilar se consagró campeón tras vencer a Presidente Derqui en una gran final.',
    imagen: '/images/club/4177dee1f84c3c767bad32efd0d41d885df4931c46126ea3b2acc298fe99ee3cd61de290a4edd84e73bdfc6bf9686d1e2148d8ac79f0ced8fbeeee_1280.jpg',
    fechaPublicacion: '2025-11-28',
    categoria: 'DEPORTES',
  },
  {
    id: 5,
    titulo: 'Formativas arrasan en Torneo de Verano',
    extracto: 'Las categorías 2014 y 2017 se coronaron campeonas divisionales. La 2012 lideró su zona con 111 puntos rumbo a la Copa de Campeones.',
    imagen: '/images/club/4874ca4a8ac815adf95e7c540ced359e6a736d059848c1f1656a0757d8ad9508c98157fed290419d407ae3cd546c441677e987dd9b4936f73fd145_1280.jpg',
    fechaPublicacion: '2025-11-10',
    categoria: 'DEPORTES',
  },
  {
    id: 6,
    titulo: 'Sportivo Pilar cumplió 93 años de historia',
    extracto: 'El 4 de junio celebramos un nuevo aniversario de La Caldera. Más de 90 años formando deportistas y construyendo comunidad en Pilar.',
    imagen: '/images/club/8ad73f3c.jpeg',
    fechaPublicacion: '2025-06-04',
    categoria: 'INSTITUCIONAL',
  },
  {
    id: 7,
    titulo: 'Liga Federal 2026: Sportivo confirmado',
    extracto: 'El club continuará participando en la Liga Federal de Básquet 2026, dentro de la Conferencia Metropolitana junto a otros 23 clubes.',
    imagen: '/images/club/0fd3416c.jpeg',
    fechaPublicacion: '2026-02-01',
    categoria: 'INSTITUCIONAL',
  },
  {
    id: 8,
    titulo: 'Inscripciones abiertas temporada 2026',
    extracto: 'Ya podés inscribirte en todas las actividades deportivas del club. Básquet, fútbol, gimnasia y más. ¡Sumate a La Caldera!',
    imagen: '/images/club/IMG_2915.JPG',
    fechaPublicacion: '2026-02-05',
    categoria: 'INSTITUCIONAL',
  },
]

const CATEGORIAS = [
  { value: '', label: 'Todas' },
  { value: 'INSTITUCIONAL', label: 'Institucional' },
  { value: 'DEPORTES', label: 'Deportes' },
  { value: 'ACTIVIDADES', label: 'Actividades' },
  { value: 'EVENTOS', label: 'Eventos' },
]

export default function Noticias() {
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetchNoticias()
  }, [])

  const fetchNoticias = async () => {
    try {
      const data = await api.getFull('/public/noticias')
      // Si hay noticias en la BD, usarlas; si no, usar las de ejemplo
      if (data?.noticias && data.noticias.length > 0) {
        setNoticias(data.noticias)
      } else {
        setNoticias(noticiasEjemplo)
      }
    } catch (err) {
      console.error('Error cargando noticias:', err)
      // Usar noticias de ejemplo como fallback
      setNoticias(noticiasEjemplo)
    } finally {
      setLoading(false)
    }
  }

  const noticiasFiltradas = noticias.filter(n => {
    const matchCategoria = !filtroCategoria || n.categoria === filtroCategoria
    const matchBusqueda = !busqueda ||
      n.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.extracto.toLowerCase().includes(busqueda.toLowerCase())
    return matchCategoria && matchBusqueda
  })

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getCategoriaColor = (categoria) => {
    switch (categoria) {
      case 'INSTITUCIONAL': return 'bg-blue-100 text-blue-700'
      case 'DEPORTES': return 'bg-green-100 text-green-700'
      case 'ACTIVIDADES': return 'bg-purple-100 text-purple-700'
      case 'EVENTOS': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Noticias
          </h1>
          <p className="text-base text-primary-100 max-w-2xl mx-auto">
            Enterate de las últimas novedades del club
          </p>
        </div>
      </section>

      {/* Filtros */}
      <section className="py-8 bg-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar noticias..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
              />
            </div>

            {/* Categoría */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
            >
              {CATEGORIAS.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Lista de noticias */}
      <section className="py-12 md:py-16 bg-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : noticiasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No se encontraron noticias</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {noticiasFiltradas.map((noticia) => (
                <article
                  key={noticia.id}
                  className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                >
                  {/* Imagen */}
                  <div className="relative overflow-hidden">
                    {noticia.imagen ? (
                      <img
                        src={noticia.imagen}
                        alt={noticia.titulo}
                        className="w-full h-auto group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-primary to-primary">
                        <span className="text-white text-4xl font-bold opacity-30">SP</span>
                      </div>
                    )}
                    <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${getCategoriaColor(noticia.categoria)}`}>
                      {noticia.categoria}
                    </span>
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                      <Calendar className="w-4 h-4" />
                      {formatFecha(noticia.fechaPublicacion)}
                    </div>

                    <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {noticia.titulo}
                    </h2>

                    <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                      {noticia.extracto}
                    </p>

                    <Link
                      to={`/noticias/${noticia.slug}`}
                      className="inline-flex items-center text-primary font-medium text-sm hover:text-primary-dark"
                    >
                      Leer más
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="NOTICIAS" />

      {/* Info - Redes sociales */}
      <section className="py-8 bg-primary-50 border-t border-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-primary-dark text-sm">
            <strong>Seguinos en redes:</strong> Para más novedades del club, seguinos en{' '}
            <a href="https://www.instagram.com/sportivopilaroficial" target="_blank" rel="noopener noreferrer" className="underline font-medium">
              Instagram
            </a>{' '}y{' '}
            <a href="https://www.facebook.com/sportivopilaroficial" target="_blank" rel="noopener noreferrer" className="underline font-medium">
              Facebook
            </a>.
          </p>
        </div>
      </section>
    </div>
  )
}
