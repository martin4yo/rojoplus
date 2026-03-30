import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, ChevronLeft, Share2, Facebook, Twitter, Copy, Check } from 'lucide-react'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function NoticiaDetalle() {
  const { slug } = useParams()
  const [noticia, setNoticia] = useState(null)
  const [relacionadas, setRelacionadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchNoticia()
  }, [slug])

  const fetchNoticia = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getFull(`/public/noticias/${slug}`)
      if (data?.noticia) {
        setNoticia(data.noticia)
        setRelacionadas(data.relacionadas || [])
      } else {
        setError('Noticia no encontrada')
      }
    } catch (err) {
      console.error('Error cargando noticia:', err)
      setError('Error al cargar la noticia')
    } finally {
      setLoading(false)
    }
  }

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

  const shareUrl = window.location.href
  const shareTitle = noticia?.titulo || 'Noticia de Club Sportivo Pilar'

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Error al copiar el link')
    }
  }

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const handleShareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const handleShareWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
      '_blank'
    )
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (error || !noticia) {
    return (
      <div className="bg-gray-300 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Noticia no encontrada'}
          </h1>
          <p className="text-gray-600 mb-8">
            La noticia que buscás no existe o fue eliminada.
          </p>
          <Link
            to="/noticias"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Ver todas las noticias
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-300 min-h-screen">
      {/* Hero con imagen */}
      <section className="relative bg-gray-900">
        {noticia.imagen ? (
          <img
            src={noticia.imagen}
            alt={noticia.titulo}
            className="w-full h-auto max-h-[500px] object-contain mx-auto"
          />
        ) : (
          <div className="w-full h-72 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <span className="text-white text-8xl font-bold opacity-20">SP</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Contenido del hero */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoriaColor(noticia.categoria)}`}>
                {noticia.categoria}
              </span>
              {noticia.destacada && (
                <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-sm font-semibold rounded-full">
                  Destacada
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-4">
              {noticia.titulo}
            </h1>
            <div className="flex items-center gap-4 text-gray-300 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatFecha(noticia.fechaPublicacion)}
              </div>
              {noticia.autor && (
                <span>
                  Por {noticia.autor.nombre} {noticia.autor.apellido}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Navegación */}
      <div className="bg-gray-200 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/noticias"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Volver a noticias
          </Link>

          {/* Compartir */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm hidden sm:inline">Compartir:</span>
            <button
              onClick={handleShareFacebook}
              className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
              title="Compartir en Facebook"
            >
              <Facebook className="w-4 h-4" />
            </button>
            <button
              onClick={handleShareTwitter}
              className="w-9 h-9 bg-sky-500 text-white rounded-lg flex items-center justify-center hover:bg-sky-600 transition-colors"
              title="Compartir en Twitter"
            >
              <Twitter className="w-4 h-4" />
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="w-9 h-9 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors"
              title="Compartir en WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="w-9 h-9 bg-gray-600 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
              title="Copiar link"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <article className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Extracto */}
          {noticia.extracto && (
            <p className="text-xl text-gray-600 mb-8 font-medium leading-relaxed border-l-4 border-primary pl-6">
              {noticia.extracto}
            </p>
          )}

          {/* Contenido HTML */}
          <div
            className="prose prose-lg prose-gray max-w-none
              prose-headings:text-gray-900
              prose-p:text-gray-700
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-xl prose-img:shadow-lg
              prose-blockquote:border-primary prose-blockquote:bg-gray-100 prose-blockquote:py-2 prose-blockquote:rounded-r-lg
            "
            dangerouslySetInnerHTML={{ __html: noticia.contenido }}
          />
        </div>
      </article>

      {/* Banner medio */}
      <BannerPublicitario tipo="MEDIO" ubicacion="NOTICIA_DETALLE" />

      {/* Noticias relacionadas */}
      {relacionadas.length > 0 && (
        <section className="py-12 bg-gray-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Noticias relacionadas
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {relacionadas.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/noticias/${rel.slug}`}
                  className="bg-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                >
                  <div className="bg-gray-300 relative overflow-hidden">
                    {rel.imagen ? (
                      <img
                        src={rel.imagen}
                        alt={rel.titulo}
                        className="w-full h-auto group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-primary to-primary">
                        <span className="text-white text-3xl font-bold opacity-30">SP</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-gray-500 text-sm mb-2">
                      {formatFecha(rel.fechaPublicacion)}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">
                      {rel.titulo}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-12 bg-primary">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Seguí las novedades del club
          </h2>
          <p className="text-primary-100 mb-6">
            Enterate de todas las novedades siguiéndonos en redes sociales
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="https://www.instagram.com/sportivopilaroficial"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white text-primary rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/sportivopilaroficial"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary-dark text-white border border-primary rounded-xl font-semibold hover:bg-primary-dark transition-colors"
            >
              Facebook
            </a>
          </div>
        </div>
      </section>

      {/* Banner Footer */}
      <BannerPublicitario tipo="FOOTER" ubicacion="NOTICIA_DETALLE" />
    </div>
  )
}
