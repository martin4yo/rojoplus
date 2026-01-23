import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import {
  TrophyIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  MapPinIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function MisActividadesSocio({ socio, tokenPortal }) {
  const [inscripciones, setInscripciones] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('mis-actividades') // 'mis-actividades' | 'disponibles'

  useEffect(() => {
    cargarActividades()
  }, [tokenPortal])

  const cargarActividades = async () => {
    try {
      setLoading(true)
      const [misActividades, actDisponibles] = await Promise.all([
        api.get(`/socio/${tokenPortal}/inscripciones`).catch(() => ({ data: [] })),
        api.get(`/socio/${tokenPortal}/actividades-disponibles`).catch(() => ({ data: [] })),
      ])

      setInscripciones(misActividades.data || [])
      setDisponibles(actDisponibles.data || [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    } finally {
      setLoading(false)
    }
  }

  const inscribirseEnActividad = async (categoriaId) => {
    if (!confirm('¿Confirmar inscripción?')) return

    try {
      await api.post(`/socio/${tokenPortal}/inscripciones`, { categoriaActividadId: categoriaId })
      alert('¡Inscripción exitosa!')
      cargarActividades()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const darDeBaja = async (inscripcionId) => {
    if (!confirm('¿Estás seguro de darte de baja?')) return

    try {
      await api.post(`/socio/${tokenPortal}/inscripciones/${inscripcionId}/baja`)
      alert('Baja realizada')
      cargarActividades()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setTab('mis-actividades')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'mis-actividades'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Mis Actividades ({inscripciones.length})
          </button>
          <button
            onClick={() => setTab('disponibles')}
            className={`py-4 px-6 font-semibold transition-colors ${
              tab === 'disponibles'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Disponibles ({disponibles.length})
          </button>
        </div>
      </div>

      {/* Contenido según tab */}
      {tab === 'mis-actividades' && (
        <div className="space-y-4">
          {inscripciones.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <TrophyIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No estás inscripto en ninguna actividad
              </h3>
              <p className="text-gray-600 mb-6">Explora las actividades disponibles y únete</p>
              <button
                onClick={() => setTab('disponibles')}
                className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Ver actividades
              </button>
            </div>
          ) : (
            inscripciones.map((insc) => (
              <div key={insc.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
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
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay actividades disponibles en este momento
              </h3>
              <p className="text-gray-600">Vuelve pronto para ver nuevas actividades</p>
            </div>
          ) : (
            disponibles.map((act) => (
              <div key={act.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
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
    </div>
  )
}
