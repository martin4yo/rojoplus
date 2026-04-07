import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Clock, MapPin, Users, Trophy, Check, X,
  Home, Plane, Send, Bell, MessageCircle, Mail, Save, UserPlus,
  UserMinus, BarChart3, Award, AlertCircle
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'

const AVATAR_COLORS = [
  ['#1a73e8', '#fff'], ['#e53935', '#fff'], ['#43a047', '#fff'],
  ['#fb8c00', '#fff'], ['#8e24aa', '#fff'], ['#00897b', '#fff'],
  ['#d81b60', '#fff'], ['#3949ab', '#fff'], ['#6d4c41', '#fff'],
]

function avatarData(nombre) {
  const partes = (nombre || '?').trim().split(/\s+/)
  const ini = partes.length >= 2
    ? partes[0][0] + partes[1][0]
    : partes[0].slice(0, 2)
  const idx = (nombre || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  const [bg, color] = AVATAR_COLORS[idx]
  return { ini: ini.toUpperCase(), bg, color }
}

export default function PartidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [partido, setPartido] = useState(null)
  const [sociosDisponibles, setSociosDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('convocatoria')

  // Resultado
  const [golesLocal, setGolesLocal] = useState('')
  const [golesVisitante, setGolesVisitante] = useState('')

  // Estadísticas
  const [estadisticas, setEstadisticas] = useState([])

  useEffect(() => {
    fetchPartido()
  }, [id])

  const fetchPartido = async () => {
    setLoading(true)
    try {
      const data = await api.get(`/admin/partidos/${id}`)
      setPartido(data)
      setGolesLocal(data.golesLocal ?? '')
      setGolesVisitante(data.golesVisitante ?? '')

      // Cargar socios disponibles para convocar
      const sociosData = await api.get(`/admin/partidos/${id}/convocados`)
      setSociosDisponibles(sociosData || [])

      // Inicializar estadísticas desde convocados
      if (data.estadisticas?.length > 0) {
        setEstadisticas(data.estadisticas.map(e => ({
          socioId: e.socioId,
          socio: e.socio,
          minutosJugados: e.minutosJugados || '',
          goles: e.goles || 0,
          asistencias: e.asistencias || 0,
          tarjetaAmarilla: e.tarjetaAmarilla || 0,
          tarjetaRoja: e.tarjetaRoja || 0,
          esTitular: e.esTitular || false
        })))
      } else if (data.convocados?.length > 0) {
        setEstadisticas(data.convocados.filter(c => c.confirmado !== false).map(c => ({
          socioId: c.socioId,
          socio: c.socio,
          minutosJugados: '',
          goles: 0,
          asistencias: 0,
          tarjetaAmarilla: 0,
          tarjetaRoja: 0,
          esTitular: false
        })))
      }
    } catch (err) {
      console.error('Error cargando partido:', err)
      toast.error('Error al cargar partido')
    } finally {
      setLoading(false)
    }
  }

  const handleConvocar = async (socioId) => {
    try {
      await api.post(`/admin/partidos/${id}/convocar`, { socioIds: [socioId] })
      toast.success('Jugador convocado')
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al convocar')
    }
  }

  const handleQuitarConvocatoria = async (socioId) => {
    try {
      await api.delete(`/admin/partidos/${id}/convocar/${socioId}`)
      toast.success('Jugador quitado de la convocatoria')
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al quitar')
    }
  }

  const handleConvocarTodos = async () => {
    const noConvocados = sociosDisponibles.filter(s => !s.convocatoria)
    if (noConvocados.length === 0) {
      toast.info('Todos los jugadores ya están convocados')
      return
    }
    try {
      await api.post(`/admin/partidos/${id}/convocar`, {
        socioIds: noConvocados.map(s => s.id)
      })
      toast.success(`${noConvocados.length} jugadores convocados`)
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al convocar')
    }
  }

  const handleNotificar = async (tipo) => {
    try {
      const result = await api.post(`/admin/partidos/${id}/notificar-convocados`, { tipo })
      const { resultados } = result
      let mensaje = 'Notificaciones enviadas: '
      if (tipo === 'push' || tipo === 'todos') mensaje += `Push: ${resultados.push.enviados}. `
      if (tipo === 'email' || tipo === 'todos') mensaje += `Email: ${resultados.email.enviados}. `
      if (tipo === 'whatsapp' || tipo === 'todos') mensaje += `WhatsApp: ${resultados.whatsapp.pendientes} pendientes. `
      toast.success(mensaje)
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al notificar')
    }
  }

  const handleGuardarResultado = async () => {
    try {
      await api.post(`/admin/partidos/${id}/resultado`, {
        golesLocal: golesLocal !== '' ? parseInt(golesLocal) : null,
        golesVisitante: golesVisitante !== '' ? parseInt(golesVisitante) : null
      })
      toast.success('Resultado guardado')
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al guardar resultado')
    }
  }

  const handleGuardarEstadisticas = async () => {
    try {
      await api.post(`/admin/partidos/${id}/estadisticas`, { estadisticas })
      toast.success('Estadísticas guardadas')
      fetchPartido()
    } catch (err) {
      toast.error(err.message || 'Error al guardar estadísticas')
    }
  }

  const updateEstadistica = (socioId, field, value) => {
    setEstadisticas(prev => prev.map(e =>
      e.socioId === socioId ? { ...e, [field]: value } : e
    ))
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!partido) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Partido no encontrado</p>
        <Link to="/admin/partidos" className="text-red-600 hover:underline mt-2 inline-block">
          Volver a partidos
        </Link>
      </div>
    )
  }

  const convocados = sociosDisponibles.filter(s => s.convocatoria)
  const noConvocados = sociosDisponibles.filter(s => !s.convocatoria)
  const confirmados = convocados.filter(s => s.convocatoria?.confirmado === true)
  const pendientes = convocados.filter(s => s.convocatoria?.confirmado === null)
  const rechazados = convocados.filter(s => s.convocatoria?.confirmado === false)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/partidos')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-red-600 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a partidos
        </button>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-red-600">
                  {partido.categoriaActividad?.actividad?.nombre} - {partido.categoriaActividad?.nombre}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  partido.estado === 'PROGRAMADO' ? 'bg-blue-100 text-blue-700' :
                  partido.estado === 'FINALIZADO' ? 'bg-green-100 text-green-700' :
                  partido.estado === 'SUSPENDIDO' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {partido.estado}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                {partido.condicion === 'LOCAL' ? (
                  <Home className="w-6 h-6 text-green-600" />
                ) : (
                  <Plane className="w-6 h-6 text-blue-600" />
                )}
                <h1 className="text-2xl font-bold text-gray-900">
                  vs {partido.rival}
                </h1>
                {partido.golesLocal !== null && partido.golesVisitante !== null && (
                  <span className="px-4 py-2 bg-gray-900 text-white font-bold text-xl rounded">
                    {partido.condicion === 'LOCAL'
                      ? `${partido.golesLocal} - ${partido.golesVisitante}`
                      : `${partido.golesVisitante} - ${partido.golesLocal}`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(partido.fecha).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {partido.hora}hs
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {partido.condicion === 'LOCAL'
                    ? (partido.espacio?.nombre || 'La Caldera')
                    : (partido.ubicacion || 'A confirmar')}
                </span>
              </div>
            </div>

            {/* Resumen convocatoria */}
            <div className="text-right">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{confirmados.length}</p>
                  <p className="text-xs text-gray-500">Confirmados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{pendientes.length}</p>
                  <p className="text-xs text-gray-500">Pendientes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{rechazados.length}</p>
                  <p className="text-xs text-gray-500">Rechazados</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b flex">
          <button
            onClick={() => setActiveTab('convocatoria')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'convocatoria'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Convocatoria
          </button>
          <button
            onClick={() => setActiveTab('resultado')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'resultado'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-2" />
            Resultado
          </button>
          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'estadisticas'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Estadísticas
          </button>
        </div>

        <div className="p-6">
          {/* Tab Convocatoria */}
          {activeTab === 'convocatoria' && (
            <div>
              {/* Acciones */}
              {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={handleConvocarTodos}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Convocar a todos
                  </button>
                  <button
                    onClick={() => handleNotificar('push')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    Notificar Push
                  </button>
                  <button
                    onClick={() => handleNotificar('email')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Notificar Email
                  </button>
                  <button
                    onClick={() => handleNotificar('whatsapp')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Preparar WhatsApp
                  </button>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Convocados */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Convocados ({convocados.length})
                  </h3>
                  <div className="space-y-2">
                    {convocados.length === 0 ? (
                      <p className="text-gray-500 text-sm">No hay jugadores convocados</p>
                    ) : (
                      convocados.map(socio => (
                        <div
                          key={socio.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {socio.fotoUrl ? (
                              <img
                                src={socio.fotoUrl}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm"
                                style={{ backgroundColor: avatarData(socio.apellidoNombre).bg, color: avatarData(socio.apellidoNombre).color }}>
                                {avatarData(socio.apellidoNombre).ini}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{socio.apellidoNombre}</p>
                              <p className="text-xs text-gray-500">#{socio.nroSocio}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {socio.convocatoria?.confirmado === true && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Confirmado
                              </span>
                            )}
                            {socio.convocatoria?.confirmado === false && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                                <X className="w-3 h-3" /> Rechazado
                              </span>
                            )}
                            {socio.convocatoria?.confirmado === null && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                Pendiente
                              </span>
                            )}
                            {socio.convocatoria?.notificadoPush && (
                              <Bell className="w-4 h-4 text-purple-500" title="Notificado por Push" />
                            )}
                            {socio.convocatoria?.notificadoEmail && (
                              <Mail className="w-4 h-4 text-blue-500" title="Notificado por Email" />
                            )}
                            {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                              <button
                                onClick={() => handleQuitarConvocatoria(socio.id)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Quitar de convocatoria"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Disponibles */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Disponibles ({noConvocados.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {noConvocados.length === 0 ? (
                      <p className="text-gray-500 text-sm">Todos los jugadores están convocados</p>
                    ) : (
                      noConvocados.map(socio => (
                        <div
                          key={socio.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {socio.fotoUrl ? (
                              <img
                                src={socio.fotoUrl}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm"
                                style={{ backgroundColor: avatarData(socio.apellidoNombre).bg, color: avatarData(socio.apellidoNombre).color }}>
                                {avatarData(socio.apellidoNombre).ini}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{socio.apellidoNombre}</p>
                              <p className="text-xs text-gray-500">#{socio.nroSocio}</p>
                            </div>
                          </div>
                          {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                            <button
                              onClick={() => handleConvocar(socio.id)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                              title="Convocar"
                            >
                              <UserPlus className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Resultado */}
          {activeTab === 'resultado' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
                Cargar Resultado
              </h3>

              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    {partido.condicion === 'LOCAL' ? 'Sportivo Pilar' : partido.rival}
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={partido.condicion === 'LOCAL' ? golesLocal : golesVisitante}
                    onChange={(e) => partido.condicion === 'LOCAL'
                      ? setGolesLocal(e.target.value)
                      : setGolesVisitante(e.target.value)
                    }
                    className="w-20 h-20 text-center text-3xl font-bold border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <span className="text-2xl font-bold text-gray-400">-</span>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    {partido.condicion === 'LOCAL' ? partido.rival : 'Sportivo Pilar'}
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={partido.condicion === 'LOCAL' ? golesVisitante : golesLocal}
                    onChange={(e) => partido.condicion === 'LOCAL'
                      ? setGolesVisitante(e.target.value)
                      : setGolesLocal(e.target.value)
                    }
                    className="w-20 h-20 text-center text-3xl font-bold border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                <button
                  onClick={handleGuardarResultado}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Guardar Resultado
                </button>
              )}
            </div>
          )}

          {/* Tab Estadísticas */}
          {activeTab === 'estadisticas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Estadísticas Individuales
                </h3>
                {tienePermiso(PERMISOS.DEPORTES_PARTIDOS) && (
                  <button
                    onClick={handleGuardarEstadisticas}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Guardar
                  </button>
                )}
              </div>

              {estadisticas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No hay jugadores para cargar estadísticas.</p>
                  <p className="text-sm">Primero convocá jugadores en la pestaña "Convocatoria".</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3">Jugador</th>
                        <th className="text-center p-3 w-16">Titular</th>
                        <th className="text-center p-3 w-20">Min.</th>
                        <th className="text-center p-3 w-16">Goles</th>
                        <th className="text-center p-3 w-16">Asist.</th>
                        <th className="text-center p-3 w-16">TA</th>
                        <th className="text-center p-3 w-16">TR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {estadisticas.map(est => (
                        <tr key={est.socioId} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {est.socio?.fotoUrl ? (
                                <img
                                  src={est.socio.fotoUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                                  style={{ backgroundColor: avatarData(est.socio?.apellidoNombre).bg, color: avatarData(est.socio?.apellidoNombre).color }}>
                                  {avatarData(est.socio?.apellidoNombre).ini}
                                </div>
                              )}
                              <span className="font-medium">{est.socio?.apellidoNombre}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={est.esTitular}
                              onChange={(e) => updateEstadistica(est.socioId, 'esTitular', e.target.checked)}
                              className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={est.minutosJugados}
                              onChange={(e) => updateEstadistica(est.socioId, 'minutosJugados', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-center"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              value={est.goles}
                              onChange={(e) => updateEstadistica(est.socioId, 'goles', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-center"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              value={est.asistencias}
                              onChange={(e) => updateEstadistica(est.socioId, 'asistencias', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-center"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              max="2"
                              value={est.tarjetaAmarilla}
                              onChange={(e) => updateEstadistica(est.socioId, 'tarjetaAmarilla', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-center bg-yellow-50"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              value={est.tarjetaRoja}
                              onChange={(e) => updateEstadistica(est.socioId, 'tarjetaRoja', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-center bg-red-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
