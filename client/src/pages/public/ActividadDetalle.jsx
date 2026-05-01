import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  Calendar,
  ChevronRight,
  Trophy,
  Newspaper,
  ClipboardList,
  UserCheck,
  BookOpen
} from 'lucide-react'
import api from '../../services/api'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import LoadingSpinner from '../../components/LoadingSpinner'

const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const defaultImages = {
  'FUTBOL': '/images/club/futbol.jpg',
  'FÚTBOL': '/images/club/futbol.jpg',
  'BASQUET': '/images/club/basquet.jpg',
  'BÁSQUET': '/images/club/basquet.jpg',
  'VOLEY': '/images/club/voley.jpg',
  'VÓLEY': '/images/club/voley.jpg',
  'HOCKEY': '/images/club/hockey.jpg',
  'NATACION': '/images/club/natacion.jpg',
  'NATACIÓN': '/images/club/natacion.jpg',
  'GIMNASIA': '/images/club/gimnasia.jpg',
  'TENIS': '/images/club/tenis.jpg',
  'PATIN': '/images/club/patin.jpg',
  'PATÍN': '/images/club/patin.jpg',
  'TAEKWONDO': '/images/club/taekwondo.jpg',
  'DEFAULT': '/images/club/68f64b9d.jpeg'
}

function getActivityImage(actividad) {
  if (actividad?.imagen) return actividad.imagen
  const key = actividad?.nombre?.toUpperCase().replace(/\s+/g, '_')
  return defaultImages[key] || defaultImages.DEFAULT
}

const TABS = [
  { id: 'descripcion', label: 'Descripción', icon: BookOpen },
  { id: 'noticias', label: 'Noticias', icon: Newspaper },
  { id: 'cronograma', label: 'Cronograma', icon: Calendar },
  { id: 'staff', label: 'Staff', icon: UserCheck },
  { id: 'reglamento', label: 'Reglamento', icon: ClipboardList }
]

export default function ActividadDetalle() {
  const { id } = useParams()
  const [actividad, setActividad] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tabActivo, setTabActivo] = useState('descripcion')

  // Datos de tabs
  const [noticias, setNoticias] = useState([])
  const [staff, setStaff] = useState([])
  const [proximosPartidos, setProximosPartidos] = useState([])
  const [reglamento, setReglamento] = useState([])
  const [loadingTab, setLoadingTab] = useState(false)

  useEffect(() => {
    cargarActividad()
  }, [id])

  useEffect(() => {
    if (actividad && tabActivo !== 'descripcion') {
      cargarDatosTab(tabActivo)
    }
  }, [tabActivo, actividad])

  async function cargarActividad() {
    try {
      setLoading(true)
      // El endpoint público de detalle devuelve el objeto sin wrap
      // {success, data}, por eso usamos getFull (api.get devolvería data.data
      // que es undefined en ese caso).
      const data = await api.getFull(`/public/actividades/${id}`)
      setActividad(data)
    } catch (err) {
      console.error('Error cargando actividad:', err)
      setError('No se pudo cargar la actividad')
    } finally {
      setLoading(false)
    }
  }

  async function cargarDatosTab(tab) {
    try {
      setLoadingTab(true)

      switch (tab) {
        case 'noticias':
          const noticiasData = await api.get(`/public/actividades/${id}/noticias`)
          setNoticias(Array.isArray(noticiasData) ? noticiasData : noticiasData.data || [])
          break

        case 'cronograma':
          const partidosData = await api.get(`/public/partidos/proximos?actividadId=${id}`)
          setProximosPartidos(Array.isArray(partidosData) ? partidosData : partidosData.data || [])
          break

        case 'staff':
          const staffData = await api.get(`/public/actividades/${id}/staff`)
          setStaff(Array.isArray(staffData) ? staffData : staffData.data || [])
          break

        case 'reglamento':
          const reglamentoData = await api.get('/public/reglamento')
          setReglamento(Array.isArray(reglamentoData) ? reglamentoData : reglamentoData.data || [])
          break
      }
    } catch (err) {
      console.error(`Error cargando ${tab}:`, err)
    } finally {
      setLoadingTab(false)
    }
  }

  function formatearFecha(fecha) {
    if (!fecha) return ''
    const date = new Date(fecha)
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatearHora(hora) {
    if (!hora) return ''
    return hora.slice(0, 5)
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (error || !actividad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: 'var(--bg-app)' }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--text-muted)' }}>
          Error 404
        </div>
        <h1 className="font-display-sport mb-4" style={{ fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 0.94, color: 'var(--color-text-primary, var(--text))' }}>
          Actividad<br /><span style={{ color: 'var(--accent)' }}>no encontrada.</span>
        </h1>
        <p className="mb-8 max-w-md" style={{ color: 'var(--color-text-secondary, var(--text-dim))' }}>
          {error || 'Esta actividad no está disponible o ya no se ofrece.'}
        </p>
        <Link
          to="/actividades"
          className="group inline-flex items-center gap-3 px-6 py-3 transition-colors"
          style={{
            border: '1px solid var(--text)',
            color: 'var(--color-text-primary, var(--text))',
            fontFamily: 'Geist Mono, monospace',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: 600,
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Ver todas las actividades
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Hero con imagen athletic */}
      <div className="relative h-[60vh] min-h-[400px] md:min-h-[500px] overflow-hidden">
        <img
          src={getActivityImage(actividad)}
          alt={actividad.nombre}
          className="w-full h-full object-cover"
        />
        {/* Triple overlay para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-field-grid opacity-40 mix-blend-overlay" />

        <div className="absolute inset-0 flex flex-col">
          {/* Top: back link */}
          <div className="pt-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <Link
                to="/actividades"
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Volver a actividades
              </Link>
            </div>
          </div>

          {/* Bottom: title + stats */}
          <div className="mt-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-12">
            <div className="max-w-7xl mx-auto">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70 mb-4 flex items-center gap-3">
                <span className="inline-block h-px w-8" style={{ backgroundColor: 'var(--color-primary)' }} />
                Actividad
              </div>
              <h1
                className="font-display-sport text-white"
                style={{ fontSize: 'clamp(48px, 9vw, 140px)', lineHeight: 0.92 }}
              >
                {actividad.nombre}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/85">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  {actividad.inscriptos || 0} inscriptos
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  {actividad.categorias?.length || 0} categorías
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="HEADER" ubicacion="ACTIVIDADES" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contenido principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <div className="flex border-b">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setTabActivo(tab.id)}
                      className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 font-medium transition-colors whitespace-nowrap ${
                        tabActivo === tab.id
                          ? 'border-b-2 border-primary text-primary'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Contenido de tabs */}
            <div className="space-y-6">
              {loadingTab ? (
                <div className="bg-white rounded-xl shadow-sm p-12 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  {/* Tab: Descripción */}
                  {tabActivo === 'descripcion' && (
                    <>
                      <section className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre la actividad</h2>
                        <p className="text-gray-600 leading-relaxed">
                          {actividad.descripcion || `${actividad.nombre} es una de las actividades deportivas que ofrece nuestro club para todas las edades. Contamos con profesores capacitados y las mejores instalaciones para que puedas disfrutar y mejorar tu rendimiento.`}
                        </p>
                      </section>

                      <section className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Categorías disponibles</h2>
                        {actividad.categorias?.length > 0 ? (
                          <div className="space-y-4">
                            {actividad.categorias.map(cat => (
                              <div key={cat.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-gray-800">{cat.nombre}</h3>
                                  <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {cat._count?.inscripciones || 0} inscriptos
                                  </span>
                                </div>

                                {cat.edadMinima || cat.edadMaxima ? (
                                  <p className="text-sm text-gray-500 mb-3">
                                    Edad: {cat.edadMinima || 0} - {cat.edadMaxima || '+'} años
                                  </p>
                                ) : null}

                                {cat.horarios?.length > 0 ? (
                                  <div className="mt-3 pt-3 border-t border-gray-100">
                                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      Horarios
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {cat.horarios.map((h, i) => (
                                        <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                                          <span className="font-medium">{diasSemana[h.diaSemana]}</span>
                                          <span className="mx-2">·</span>
                                          <span>{h.horaInicio?.slice(0,5)} - {h.horaFin?.slice(0,5)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">Horarios a confirmar</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No hay categorías disponibles en este momento.</p>
                        )}
                      </section>
                    </>
                  )}

                  {/* Tab: Noticias */}
                  {tabActivo === 'noticias' && (
                    <section className="bg-white rounded-xl shadow-sm p-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Noticias y Novedades</h2>
                      {noticias.length > 0 ? (
                        <div className="space-y-4">
                          {noticias.map(noticia => (
                            <div key={noticia.id} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                              {noticia.imagen && (
                                <img
                                  src={noticia.imagen}
                                  alt={noticia.titulo}
                                  className="w-full h-48 object-cover rounded-lg mb-4"
                                />
                              )}
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  noticia.tipo === 'RESULTADO' ? 'bg-primary-100 text-primary-dark' :
                                  noticia.tipo === 'COMUNICADO' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {noticia.tipo}
                                </span>
                                {noticia.destacada && (
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                                    Destacada
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-gray-900 mb-2">{noticia.titulo}</h3>
                              {noticia.copete && (
                                <p className="text-gray-600 text-sm mb-2">{noticia.copete}</p>
                              )}
                              <p className="text-gray-500 text-xs">
                                {formatearFecha(noticia.fechaPublicacion)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No hay noticias disponibles</p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Tab: Cronograma */}
                  {tabActivo === 'cronograma' && (
                    <>
                      <section className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl font-bold text-gray-900">Próximos Partidos</h2>
                          <Link
                            to={`/cronograma?actividad=${id}`}
                            className="text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-1"
                          >
                            Ver cronograma completo
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                        {proximosPartidos.length > 0 ? (
                          <div className="space-y-3">
                            {proximosPartidos.slice(0, 5).map(partido => (
                              <div key={partido.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-500">
                                    {partido.categoria}
                                  </span>
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    partido.esLocal ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {partido.esLocal ? 'Local' : 'Visitante'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold">{partido.equipoLocal}</span>
                                  <span className="text-gray-400 mx-2">vs</span>
                                  <span className="font-semibold">{partido.equipoVisitante}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {formatearFecha(partido.fecha)}
                                  </span>
                                  {partido.hora && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {formatearHora(partido.hora)}
                                    </span>
                                  )}
                                  {partido.lugar && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      {partido.lugar}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No hay partidos programados</p>
                          </div>
                        )}
                      </section>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-800">
                          <strong>Ver cronograma completo:</strong> Para consultar todos los entrenamientos, partidos y eventos, visitá la sección de{' '}
                          <Link to={`/cronograma?actividad=${id}`} className="underline font-semibold">
                            Cronograma
                          </Link>.
                        </p>
                      </div>
                    </>
                  )}

                  {/* Tab: Staff */}
                  {tabActivo === 'staff' && (
                    <section className="bg-white rounded-xl shadow-sm p-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Staff Técnico</h2>
                      {staff.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {staff.map(miembro => (
                            <div key={miembro.id} className="border border-gray-200 rounded-lg p-4 flex items-start gap-4">
                              {miembro.foto ? (
                                <img
                                  src={miembro.foto}
                                  alt={`${miembro.nombre} ${miembro.apellido}`}
                                  className="w-20 h-20 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                                  <UserCheck className="w-10 h-10 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                  {miembro.nombre} {miembro.apellido}
                                </h3>
                                <p className="text-sm text-primary font-medium">{miembro.rol}</p>
                                {miembro.biografia && (
                                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                                    {miembro.biografia}
                                  </p>
                                )}
                                {miembro.email && (
                                  <p className="text-xs text-gray-500 mt-2">{miembro.email}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No hay staff técnico registrado</p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Tab: Reglamento */}
                  {tabActivo === 'reglamento' && (
                    <section className="bg-white rounded-xl shadow-sm p-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Reglamento de Convivencia</h2>
                      {reglamento.length > 0 ? (
                        <div className="space-y-6">
                          {['GENERAL', 'PADRES', 'JUGADORES', 'ENTRENADORES', 'SANCIONES', 'CONFLICTOS'].map(seccion => {
                            const articulos = reglamento.filter(a => a.seccion === seccion && a.activo)
                            if (articulos.length === 0) return null

                            return (
                              <div key={seccion}>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                                  {seccion}
                                </h3>
                                <div className="space-y-3">
                                  {articulos.map(art => (
                                    <div key={art.id} className="pl-4 border-l-2 border-primary-200">
                                      <h4 className="font-semibold text-gray-900">{art.titulo}</h4>
                                      <p className="text-sm text-gray-600 mt-1">{art.contenido}</p>
                                      {art.requiereAceptacion && (
                                        <span className="inline-block mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                          Requiere aceptación
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No hay reglamento disponible</p>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CTA Inscripción */}
            <div className="bg-primary rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">¿Querés sumarte?</h3>
              <p className="text-primary-100 text-sm mb-4">
                Completá el formulario de inscripción y empezá a disfrutar de {actividad.nombre} en nuestro club.
              </p>
              <Link
                to="/inscripcion-socio"
                className="block w-full bg-white text-primary font-semibold py-3 px-4 rounded-lg text-center hover:bg-primary-50 transition-colors"
              >
                Solicitar inscripción
              </Link>
            </div>

            {/* Info de contacto */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Información</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Las prácticas se realizan en las instalaciones del club</span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Profesores capacitados para todas las edades</span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Inscripciones abiertas todo el año</span>
                </li>
              </ul>
            </div>

            {/* Otras actividades */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Otras actividades</h3>
              <Link
                to="/actividades"
                className="flex items-center justify-between text-primary hover:text-primary-dark font-medium"
              >
                Ver todas las actividades
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="FOOTER" ubicacion="ACTIVIDADES" />
    </div>
  )
}
