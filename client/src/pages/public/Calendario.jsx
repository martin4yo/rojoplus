import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Users } from 'lucide-react'
import api from '../../services/api'
import BannerPublicitario from '../../components/public/BannerPublicitario'

const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function Calendario() {
  const [fecha, setFecha] = useState(new Date())
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('mes') // 'mes' o 'lista'

  useEffect(() => {
    cargarEventos()
  }, [fecha])

  async function cargarEventos() {
    try {
      setLoading(true)
      const year = fecha.getFullYear()
      const month = fecha.getMonth() + 1
      const data = await api.get(`/public/calendario?year=${year}&month=${month}`)
      setEventos(Array.isArray(data) ? data : data.eventos || [])
    } catch (err) {
      console.error('Error cargando eventos:', err)
      setEventos([])
    } finally {
      setLoading(false)
    }
  }

  function mesAnterior() {
    setFecha(new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1))
  }

  function mesSiguiente() {
    setFecha(new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1))
  }

  function getDiasDelMes() {
    const year = fecha.getFullYear()
    const month = fecha.getMonth()
    const primerDia = new Date(year, month, 1)
    const ultimoDia = new Date(year, month + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    const diaInicio = primerDia.getDay()

    const dias = []

    // Días vacíos al inicio
    for (let i = 0; i < diaInicio; i++) {
      dias.push({ dia: null, eventos: [] })
    }

    // Días del mes
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaDia = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const eventosDelDia = eventos.filter(e => e.fecha?.startsWith(fechaDia))
      dias.push({ dia, fecha: fechaDia, eventos: eventosDelDia })
    }

    return dias
  }

  function getTipoColor(tipo) {
    switch (tipo?.toUpperCase()) {
      case 'PARTIDO': return 'bg-primary'
      case 'ENTRENAMIENTO': return 'bg-blue-500'
      case 'EVENTO': return 'bg-green-500'
      case 'REUNION': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const dias = getDiasDelMes()
  const hoy = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero */}
      <div className="bg-primary text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Calendar className="w-12 h-12" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Calendario</h1>
              <p className="text-primary-100 mt-1">Eventos, partidos y actividades del club</p>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="HEADER" ubicacion="CALENDARIO" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controles */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Navegación de mes */}
            <div className="flex items-center gap-4">
              <button
                onClick={mesAnterior}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
                {meses[fecha.getMonth()]} {fecha.getFullYear()}
              </h2>
              <button
                onClick={mesSiguiente}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle vista */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setVista('mes')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  vista === 'mes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setVista('lista')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  vista === 'lista' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : vista === 'mes' ? (
          /* Vista Calendario */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header días */}
            <div className="grid grid-cols-7 bg-gray-50">
              {diasSemana.map(dia => (
                <div key={dia} className="py-3 text-center text-sm font-medium text-gray-500">
                  {dia}
                </div>
              ))}
            </div>

            {/* Días del mes */}
            <div className="grid grid-cols-7 border-t">
              {dias.map((item, idx) => (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r p-2 ${
                    item.dia === null ? 'bg-gray-50' : ''
                  } ${item.fecha === hoy ? 'bg-primary-50' : ''}`}
                >
                  {item.dia && (
                    <>
                      <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                        item.fecha === hoy
                          ? 'bg-primary text-white rounded-full font-bold'
                          : 'text-gray-700'
                      }`}>
                        {item.dia}
                      </span>
                      <div className="mt-1 space-y-1">
                        {item.eventos.slice(0, 3).map((evento, i) => (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded text-white truncate ${getTipoColor(evento.tipo)}`}
                            title={evento.titulo || evento.nombre}
                          >
                            {evento.titulo || evento.nombre}
                          </div>
                        ))}
                        {item.eventos.length > 3 && (
                          <div className="text-xs text-gray-500 px-2">
                            +{item.eventos.length - 3} más
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Vista Lista */
          <div className="space-y-4">
            {eventos.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No hay eventos programados para este mes</p>
              </div>
            ) : (
              eventos.map((evento, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-full min-h-[60px] rounded-full ${getTipoColor(evento.tipo)}`} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getTipoColor(evento.tipo)} text-white mb-2`}>
                            {evento.tipo || 'Evento'}
                          </span>
                          <h3 className="font-semibold text-gray-900">
                            {evento.titulo || evento.nombre}
                          </h3>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(evento.fecha).toLocaleDateString('es-AR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </span>
                        {evento.hora && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {evento.hora}
                          </span>
                        )}
                        {evento.lugar && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {evento.lugar}
                          </span>
                        )}
                        {evento.categoria && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {evento.categoria}
                          </span>
                        )}
                      </div>

                      {evento.descripcion && (
                        <p className="mt-2 text-sm text-gray-600">{evento.descripcion}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tipos de eventos</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-gray-600">Partidos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Entrenamientos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Eventos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-gray-600">Reuniones</span>
            </div>
          </div>
        </div>
      </div>

      <BannerPublicitario tipo="FOOTER" ubicacion="CALENDARIO" />
    </div>
  )
}
