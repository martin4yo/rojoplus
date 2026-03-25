import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Filter,
  X,
  ChevronDown,
  Trophy,
  Dumbbell
} from 'lucide-react'
import api from '../../services/api'
import BannerPublicitario from '../../components/public/BannerPublicitario'

const PRESETS_FECHA = [
  { id: 'esta-semana', label: 'Esta semana' },
  { id: 'proxima-semana', label: 'Próxima semana' },
  { id: 'este-mes', label: 'Este mes' },
  { id: 'proximo-mes', label: 'Próximo mes' },
  { id: 'personalizado', label: 'Personalizado' }
]

const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Cronograma() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Estados
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [eventos, setEventos] = useState({ entrenamientos: [], partidos: [], eventos: [] })
  const [loading, setLoading] = useState(true)

  // Filtros
  const [actividadesSeleccionadas, setActividadesSeleccionadas] = useState([])
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([])
  const [presetFecha, setPresetFecha] = useState('esta-semana')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // UI
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  useEffect(() => {
    cargarActividades()

    // Pre-seleccionar actividad si viene por parámetro
    const actividadId = searchParams.get('actividad')
    if (actividadId) {
      setActividadesSeleccionadas([parseInt(actividadId)])
    }
  }, [])

  useEffect(() => {
    if (actividades.length > 0) {
      cargarCronograma()
    }
  }, [actividadesSeleccionadas, categoriasSeleccionadas, presetFecha, fechaDesde, fechaHasta])

  useEffect(() => {
    // Cuando cambian las actividades, actualizar categorías disponibles
    if (actividadesSeleccionadas.length > 0) {
      const categoriasDisponibles = actividades
        .filter(a => actividadesSeleccionadas.includes(a.id))
        .flatMap(a => a.categorias || [])
      setCategorias(categoriasDisponibles)

      // Limpiar categorías seleccionadas que ya no están disponibles
      setCategoriasSeleccionadas(prev =>
        prev.filter(catId => categoriasDisponibles.some(c => c.id === catId))
      )
    } else {
      // Si no hay actividades seleccionadas, mostrar todas las categorías
      const todasCategorias = actividades.flatMap(a => a.categorias || [])
      setCategorias(todasCategorias)
    }
  }, [actividadesSeleccionadas, actividades])

  async function cargarActividades() {
    try {
      const data = await api.get('/public/actividades')
      const acts = Array.isArray(data) ? data : data.data || []
      setActividades(acts)

      // Cargar todas las categorías inicialmente
      const todasCategorias = acts.flatMap(a => a.categorias || [])
      setCategorias(todasCategorias)
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  async function cargarCronograma() {
    try {
      setLoading(true)

      const params = new URLSearchParams()

      if (actividadesSeleccionadas.length > 0) {
        params.append('actividadIds', actividadesSeleccionadas.join(','))
      }

      if (categoriasSeleccionadas.length > 0) {
        params.append('categoriaIds', categoriasSeleccionadas.join(','))
      }

      if (presetFecha !== 'personalizado') {
        params.append('preset', presetFecha)
      } else {
        if (fechaDesde) params.append('desde', fechaDesde)
        if (fechaHasta) params.append('hasta', fechaHasta)
      }

      const data = await api.get(`/public/cronograma?${params.toString()}`)
      setEventos(data || { entrenamientos: [], partidos: [], eventos: [] })
    } catch (err) {
      console.error('Error cargando cronograma:', err)
      setEventos({ entrenamientos: [], partidos: [], eventos: [] })
    } finally {
      setLoading(false)
    }
  }

  function toggleActividad(id) {
    setActividadesSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  function toggleCategoria(id) {
    setCategoriasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function limpiarFiltros() {
    setActividadesSeleccionadas([])
    setCategoriasSeleccionadas([])
    setPresetFecha('esta-semana')
    setFechaDesde('')
    setFechaHasta('')
  }

  function formatearFecha(fecha) {
    const date = new Date(fecha)
    const dia = diasSemana[date.getDay()]
    const diaMes = date.getDate()
    const mes = date.toLocaleDateString('es-AR', { month: 'short' })
    return `${dia} ${diaMes} ${mes}`
  }

  function formatearHora(hora) {
    if (!hora) return ''
    return hora.slice(0, 5)
  }

  // Combinar todos los eventos y ordenar por fecha
  const todosEventos = [
    ...eventos.entrenamientos.map(e => ({ ...e, tipo: 'ENTRENAMIENTO' })),
    ...eventos.partidos.map(p => ({ ...p, tipo: 'PARTIDO' })),
    ...eventos.eventos?.map(ev => ({ ...ev, tipo: 'EVENTO' })) || []
  ].sort((a, b) => {
    const fechaA = new Date(a.fecha || a.fechaHora)
    const fechaB = new Date(b.fecha || b.fechaHora)
    return fechaA - fechaB
  })

  const cantidadFiltrosActivos = actividadesSeleccionadas.length + categoriasSeleccionadas.length

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary-dark py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-6">
            <Calendar className="w-10 h-10 md:w-12 md:h-12 text-white" />
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white">
                Cronograma de Actividades
              </h1>
              <p className="text-primary-100 mt-1 text-sm md:text-base">
                Entrenamientos, partidos y eventos del club
              </p>
            </div>
          </div>

          {/* Barra de búsqueda tipo Google */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-full shadow-lg p-2 flex items-center gap-2">
              <button
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className={`px-4 py-2 rounded-full font-medium transition-colors flex items-center gap-2 ${
                  mostrarFiltros || cantidadFiltrosActivos > 0
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {cantidadFiltrosActivos > 0 && (
                  <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {cantidadFiltrosActivos}
                  </span>
                )}
              </button>

              <div className="flex-1 px-4 text-gray-600 text-sm md:text-base">
                {actividadesSeleccionadas.length === 0 && categoriasSeleccionadas.length === 0
                  ? 'Mostrando todas las actividades'
                  : `${actividadesSeleccionadas.length} actividad(es) • ${categoriasSeleccionadas.length} categoría(s)`}
              </div>

              {cantidadFiltrosActivos > 0 && (
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden md:inline">Limpiar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="HEADER" ubicacion="CRONOGRAMA" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Panel de filtros */}
        {mostrarFiltros && (
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6 space-y-6">
            {/* Filtro de fecha */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">Período</h3>
              <div className="flex flex-wrap gap-2">
                {PRESETS_FECHA.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setPresetFecha(preset.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                      presetFecha === preset.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {presetFecha === 'personalizado' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de actividades */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">
                Actividades
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (seleccioná una o varias)
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {actividades.map(act => (
                  <button
                    key={act.id}
                    onClick={() => toggleActividad(act.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                      actividadesSeleccionadas.includes(act.id)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {act.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro de categorías */}
            {categorias.length > 0 && (
              <div>
                <button
                  onClick={() => setMostrarCategorias(!mostrarCategorias)}
                  className="w-full flex items-center justify-between font-semibold text-gray-900 mb-3 text-sm md:text-base hover:text-primary transition-colors"
                >
                  <span>
                    Categorías
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      (opcional)
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${mostrarCategorias ? 'rotate-180' : ''}`}
                  />
                </button>

                {mostrarCategorias && (
                  <div className="flex flex-wrap gap-2">
                    {categorias.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategoria(cat.id)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs md:text-sm ${
                          categoriasSeleccionadas.includes(cat.id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resultados */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : todosEventos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay eventos programados
            </h3>
            <p className="text-gray-600 mb-6">
              No encontramos actividades para los filtros seleccionados
            </p>
            {cantidadFiltrosActivos > 0 && (
              <button
                onClick={limpiarFiltros}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-blue-600" />
                  {eventos.entrenamientos.length} entrenamientos
                </span>
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  {eventos.partidos.length} partidos
                </span>
                {eventos.eventos?.length > 0 && (
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-600" />
                    {eventos.eventos.length} eventos
                  </span>
                )}
              </div>
            </div>

            {/* Lista de eventos */}
            {todosEventos.map((evento, idx) => {
              const esTipoEntrenamiento = evento.tipo === 'ENTRENAMIENTO'
              const esTipoPartido = evento.tipo === 'PARTIDO'

              return (
                <div
                  key={`${evento.tipo}-${evento.id || idx}`}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="flex items-start gap-4 p-4 md:p-6">
                    {/* Barra de color según tipo */}
                    <div
                      className={`w-1 h-full min-h-[80px] rounded-full ${
                        esTipoEntrenamiento
                          ? 'bg-blue-500'
                          : esTipoPartido
                          ? 'bg-primary'
                          : 'bg-green-500'
                      }`}
                    />

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      {/* Tipo */}
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${
                          esTipoEntrenamiento
                            ? 'bg-blue-100 text-blue-800'
                            : esTipoPartido
                            ? 'bg-primary-100 text-primary-dark'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {evento.tipo}
                      </span>

                      {/* Título */}
                      <h3 className="font-bold text-gray-900 text-lg mb-2">
                        {esTipoPartido
                          ? `${evento.equipoLocal} vs ${evento.equipoVisitante}`
                          : evento.actividad || evento.titulo || evento.nombre}
                      </h3>

                      {/* Categoría */}
                      {evento.categoria && (
                        <p className="text-gray-600 text-sm mb-3">{evento.categoria}</p>
                      )}

                      {/* Detalles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          {formatearFecha(evento.fecha || evento.fechaHora)}
                        </span>

                        {(evento.horaInicio || evento.hora) && (
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            {formatearHora(evento.horaInicio || evento.hora)}
                            {evento.horaFin && ` - ${formatearHora(evento.horaFin)}`}
                          </span>
                        )}

                        {(evento.lugar || evento.espacio) && (
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            {evento.lugar || evento.espacio}
                          </span>
                        )}

                        {esTipoPartido && evento.esLocal !== undefined && (
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4 flex-shrink-0" />
                            {evento.esLocal ? 'Local' : 'Visitante'}
                          </span>
                        )}
                      </div>

                      {/* Descripción si existe */}
                      {evento.descripcion && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                          {evento.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BannerPublicitario tipo="FOOTER" ubicacion="CRONOGRAMA" />
    </div>
  )
}
