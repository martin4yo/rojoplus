import { useState, useEffect } from 'react'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'
import {
  TrophyIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  MapPinIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

export default function MisActividadesSocio({ socio, tokenPortal }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [inscripciones, setInscripciones] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [tab, setTab] = useState('mis-actividades') // 'mis-actividades' | 'disponibles' | 'asistencia'

  useEffect(() => {
    cargarActividades()
  }, [tokenPortal])

  useEffect(() => {
    if (tab === 'asistencia' && historial.length === 0) {
      cargarHistorial()
    }
  }, [tab])

  const cargarActividades = async () => {
    try {
      setLoading(true)
      const [misActividades, actDisponibles] = await Promise.all([
        api.get(`/socio/${tokenPortal}/inscripciones`).catch(() => []),
        api.get(`/socio/${tokenPortal}/actividades-disponibles`).catch(() => []),
      ])

      setInscripciones(Array.isArray(misActividades) ? misActividades : [])
      setDisponibles(Array.isArray(actDisponibles) ? actDisponibles : [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    } finally {
      setLoading(false)
    }
  }

  const cargarHistorial = async () => {
    try {
      setLoadingHistorial(true)
      const res = await api.get(`/socio/${tokenPortal}/historial-asistencia?dias=90`)
      setHistorial(Array.isArray(res) ? res : (res?.data || []))
    } catch (err) {
      console.error('Error cargando historial de asistencia:', err)
    } finally {
      setLoadingHistorial(false)
    }
  }

  const inscribirseEnActividad = async (categoriaId) => {
    const confirmed = await confirm('Confirmar inscripción', '¿Deseas inscribirte en esta actividad?', { variant: 'primary', confirmText: 'Inscribirme' })
    if (!confirmed) return

    try {
      await api.post(`/socio/${tokenPortal}/inscripciones`, { categoriaActividadId: categoriaId })
      toast.success('¡Inscripción exitosa!')
      cargarActividades()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  const darDeBaja = async (inscripcionId) => {
    const confirmed = await confirm('Darse de baja', '¿Estás seguro de darte de baja de esta actividad?', { variant: 'danger', confirmText: 'Darme de baja' })
    if (!confirmed) return

    try {
      await api.post(`/socio/${tokenPortal}/inscripciones/${inscripcionId}/baja`)
      toast.success('Baja realizada')
      cargarActividades()
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header athletic */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Deportes
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Mis <span style={{ color: 'var(--color-primary)' }}>actividades</span>
        </h1>
      </div>

      {/* Tabs athletic */}
      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: 'var(--border)' }}>
        {[
          { id: 'mis-actividades', label: 'Mis actividades', count: inscripciones.length },
          { id: 'disponibles', label: 'Disponibles', count: disponibles.length },
          { id: 'asistencia', label: 'Mi asistencia', count: null },
        ].map(({ id, label, count }) => {
          const activo = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="py-4 px-4 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors"
              style={{
                backgroundColor: activo ? 'var(--color-primary)' : 'var(--bg-surface)',
                color: activo ? 'var(--accent-fg)' : 'var(--text-dim)',
              }}
            >
              {label}{count !== null && ` (${count})`}
            </button>
          )
        })}
      </div>

      {/* Contenido según tab */}
      {tab === 'mis-actividades' && (
        <div className="space-y-4">
          {inscripciones.length === 0 ? (
            <div className="pub-card p-12 text-center">
              <TrophyIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No estás inscripto en ninguna actividad
              </h3>
              <p className="text-gray-600 mb-6">Explora las actividades disponibles y únete</p>
              <button
                onClick={() => setTab('disponibles')}
                className="pub-cta inline-flex"
              >
                <PlusCircleIcon className="h-5 w-5" />
                <span>Ver actividades</span>
              </button>
            </div>
          ) : (
            inscripciones.map((insc) => (
              <div key={insc.id} className="pub-card overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{insc.actividad}</h3>
                      <p className="text-gray-600 mt-1">{insc.categoria}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            insc.estado === 'ACTIVA'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {insc.estado}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-red-100 rounded-lg p-3">
                        <TrophyIcon className="h-8 w-8 text-red-600" />
                      </div>
                    </div>
                  </div>

                  {/* Información de la actividad */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {insc.entrenador && (
                      <div className="flex items-start space-x-3">
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Entrenador</p>
                          <p className="text-base text-gray-900">{insc.entrenador}</p>
                        </div>
                      </div>
                    )}

                    {insc.horarios && (
                      <div className="flex items-start space-x-3">
                        <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Horarios</p>
                          <p className="text-base text-gray-900">{insc.horarios}</p>
                        </div>
                      </div>
                    )}

                    {insc.cuotaMensual && (
                      <div className="flex items-start space-x-3">
                        <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Cuota mensual</p>
                          <p className="text-base text-gray-900">
                            ${parseFloat(insc.cuotaMensual).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="mt-6 flex items-center justify-end space-x-3">
                    <button
                      onClick={() => darDeBaja(insc.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                    >
                      Darme de baja
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                      Ver horarios
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'disponibles' && (
        <div className="space-y-4">
          {disponibles.length === 0 ? (
            <div className="pub-card p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay actividades disponibles en este momento
              </h3>
              <p className="text-gray-600">Vuelve pronto para ver nuevas actividades</p>
            </div>
          ) : (
            disponibles.map((act) => (
              <div key={act.id} className="pub-card overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{act.actividad}</h3>
                      <p className="text-gray-600 mt-1">{act.categoria}</p>
                      {act.descripcion && (
                        <p className="text-sm text-gray-500 mt-2">{act.descripcion}</p>
                      )}
                    </div>
                    <div className="bg-blue-100 rounded-lg p-3">
                      <TrophyIcon className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>

                  {/* Detalles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {act.entrenador && (
                      <div className="flex items-start space-x-3">
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Entrenador</p>
                          <p className="text-base text-gray-900">{act.entrenador}</p>
                        </div>
                      </div>
                    )}

                    {act.cuposDisponibles !== undefined && (
                      <div className="flex items-start space-x-3">
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Cupos</p>
                          <p className="text-base text-gray-900">
                            {act.cuposDisponibles} disponibles
                          </p>
                        </div>
                      </div>
                    )}

                    {act.cuotaMensual && (
                      <div className="flex items-start space-x-3">
                        <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Cuota mensual</p>
                          <p className="text-base text-gray-900">
                            ${parseFloat(act.cuotaMensual).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botón de inscripción */}
                  <div className="mt-6">
                    <button
                      onClick={() => inscribirseEnActividad(act.id)}
                      className="w-full inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                    >
                      <PlusCircleIcon className="h-5 w-5 mr-2" />
                      Inscribirme
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Asistencia */}
      {tab === 'asistencia' && (
        <div className="space-y-6">
          {loadingHistorial ? (
            <LoadingSpinner />
          ) : historial.length === 0 ? (
            <div className="pub-card p-12 text-center">
              <ChartBarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin historial de asistencia</h3>
              <p className="text-gray-600">No hay entrenamientos registrados en los últimos 90 días</p>
            </div>
          ) : (
            historial.map(item => (
              <div key={item.inscripcionId} className="pub-card overflow-hidden">
                {/* Cabecera con resumen */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{item.actividad}</h3>
                      <p className="text-sm text-gray-500">{item.categoria}</p>
                    </div>
                    {item.resumen.pct !== null && (
                      <div className={`text-center px-4 py-2 rounded-xl ${
                        item.resumen.pct >= 75 ? 'bg-green-100' :
                        item.resumen.pct >= 50 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        <p className={`text-2xl font-bold ${
                          item.resumen.pct >= 75 ? 'text-green-700' :
                          item.resumen.pct >= 50 ? 'text-yellow-700' : 'text-red-700'
                        }`}>{item.resumen.pct}%</p>
                        <p className="text-xs text-gray-500">asistencia</p>
                      </div>
                    )}
                  </div>

                  {/* Barra de progreso */}
                  {item.resumen.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{item.resumen.presentes} presentes</span>
                        <span>{item.resumen.total} entrenamientos</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            item.resumen.pct >= 75 ? 'bg-green-500' :
                            item.resumen.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.resumen.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista de entrenamientos */}
                {item.entrenamientos.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {item.entrenamientos.map(e => {
                      const fecha = new Date(e.fecha)
                      const fechaStr = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
                      const esPresente = e.asistencia === 'PRESENTE'
                      const esAusente = e.asistencia === 'AUSENTE'

                      return (
                        <div key={e.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              esPresente ? 'bg-green-500' :
                              esAusente ? 'bg-red-400' : 'bg-gray-300'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-gray-800 capitalize">{fechaStr}</p>
                              <p className="text-xs text-gray-400">{e.horaInicio} - {e.horaFin}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {e.horaLlegada && (
                              <span className="text-xs text-gray-400">{e.horaLlegada}</span>
                            )}
                            {esPresente && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Presente
                              </span>
                            )}
                            {esAusente && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                                <XCircleIcon className="h-3.5 w-3.5" />
                                Ausente
                              </span>
                            )}
                            {!e.asistencia && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs">
                                Sin registro
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
