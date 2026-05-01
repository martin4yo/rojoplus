import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Search, Newspaper, ArrowUpRight } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import PublicHero from '../../components/public/PublicHero'
import { useTenant } from '../../contexts/TenantContext'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const CATEGORIAS = [
  { value: '', label: 'Todas' },
  { value: 'INSTITUCIONAL', label: 'Institucional' },
  { value: 'DEPORTES', label: 'Deportes' },
  { value: 'ACTIVIDADES', label: 'Actividades' },
  { value: 'EVENTOS', label: 'Eventos' },
]

export default function Noticias() {
  const { tenant } = useTenant()
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    api.getFull('/public/noticias')
      .then(data => setNoticias(data?.noticias || []))
      .catch(() => setNoticias([]))
      .finally(() => setLoading(false))
  }, [])

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      <PublicHero
        eyebrow="Novedades"
        title="Noticias."
        subtitle="Enterate de las últimas novedades del club."
      />

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
            <div className="text-center py-16 text-gray-500">
              <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">
                {busqueda || filtroCategoria ? 'No se encontraron noticias con esos filtros.' : 'Aún no hay noticias publicadas.'}
              </p>
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

      {/* Redes sociales del tenant */}
      {(tenant?.redesSociales?.instagram || tenant?.redesSociales?.facebook) && (
        <section className="py-8 bg-primary-50 border-t border-primary-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-primary-dark text-sm">
              <strong>Seguinos en redes:</strong> Para más novedades del club, seguinos en{' '}
              {tenant.redesSociales.instagram && (
                <a href={tenant.redesSociales.instagram} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Instagram
                </a>
              )}
              {tenant.redesSociales.instagram && tenant.redesSociales.facebook && ' y '}
              {tenant.redesSociales.facebook && (
                <a href={tenant.redesSociales.facebook} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Facebook
                </a>
              )}.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
