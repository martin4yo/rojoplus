import { useState, useEffect } from 'react'
import api from '../../../services/api'
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrophyIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'

export default function ConvocatoriasSocio({ socio, tokenPortal }) {
  const [convocatorias, setConvocatorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas') // 'todas', 'pendiente', 'confirmada', 'rechazada'
  const [procesando, setProcesando] = useState(null)

  useEffect(() => {
    cargarConvocatorias()
  }, [tokenPortal, filtro])

  const cargarConvocatorias = async () => {
    try {
      setLoading(true)
      const params = filtro !== 'todas' ? `?estado=${filtro}` : ''
      const data = await api.get(`/socio/${tokenPortal}/convocatorias${params}`)
      setConvocatorias(Array.isArray(data) ? data : data.data || [])
    } catch (err) {
      console.error('Error cargando convocatorias:', err)
      setConvocatorias([])
    } finally {
      setLoading(false)
    }
  }

  const responderConvocatoria = async (partidoId, confirmado) => {
    const motivoRechazo = confirmado ? null : prompt('¿Por qué no podés asistir? (opcional)')

    try {
      setProcesando(partidoId)
      await api.put(`/socio/${tokenPortal}/convocatorias/${partidoId}`, {
        confirmado,
        motivoRechazo
      })
      alert(confirmado ? '¡Asistencia confirmada!' : 'Se registró que no podés asistir')
      cargarConvocatorias()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message))
    } finally {
      setProcesando(null)
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

  const convocatoriasPendientes = convocatorias.filter(c => c.confirmado === null).length
  const convocatoriasConfirmadas = convocatorias.filter(c => c.confirmado === true).length
  const convocatoriasRechazadas = convocatorias.filter(c => c.confirmado === false).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-900">{convocatoriasPendientes}</p>
            </div>
            <QuestionMarkCircleIcon className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Confirmadas</p>
              <p className="text-2xl font-bold text-green-900">{convocatoriasConfirmadas}</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Rechazadas</p>
              <p className="text-2xl font-bold text-gray-900">{convocatoriasRechazadas}</p>
            </div>
            <XCircleIcon className="h-10 w-10 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setFiltro('todas')}
            className={`flex-1 py-3 px-6 font-medium transition-colors whitespace-nowrap ${
              filtro === 'todas'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas ({convocatorias.length})
          </button>
          <button
            onClick={() => setFiltro('pendiente')}
            className={`flex-1 py-3 px-6 font-medium transition-colors whitespace-nowrap ${
              filtro === 'pendiente'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pendientes ({convocatoriasPendientes})
          </button>
          <button
            onClick={() => setFiltro('confirmada')}
            className={`flex-1 py-3 px-6 font-medium transition-colors whitespace-nowrap ${
              filtro === 'confirmada'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Confirmadas ({convocatoriasConfirmadas})
          </button>
          <button
            onClick={() => setFiltro('rechazada')}
            className={`flex-1 py-3 px-6 font-medium transition-colors whitespace-nowrap ${
              filtro === 'rechazada'
                ? 'bg-red-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Rechazadas ({convocatoriasRechazadas})
          </button>
        </div>
      </div>

      {/* Lista de convocatorias */}
      {convocatorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <TrophyIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filtro === 'pendiente'
              ? 'No tenés convocatorias pendientes'
              : filtro === 'confirmada'
              ? 'No tenés convocatorias confirmadas'
              : filtro === 'rechazada'
              ? 'No tenés convocatorias rechazadas'
              : 'No tenés convocatorias'}
          </h3>
          <p className="text-gray-600">
            {filtro === 'todas'
              ? 'Cuando tu entrenador te convoque a un partido, aparecerá aquí.'
              : 'Cambiá el filtro para ver otras convocatorias.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {convocatorias.map((conv) => (
            <div
              key={conv.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${
                conv.confirmado === null
                  ? 'border-yellow-400'
                  : conv.confirmado === true
                  ? 'border-green-400'
                  : 'border-gray-400'
              }`}
            >
              <div className="p-6">
                {/* Header con estado */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">{conv.partido.actividad}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs font-medium text-gray-500">{conv.partido.categoria}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {conv.partido.equipoLocal} vs {conv.partido.equipoVisitante}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          conv.partido.esLocal
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {conv.partido.esLocal ? 'Local' : 'Visitante'}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          conv.confirmado === null
                            ? 'bg-yellow-100 text-yellow-800'
                            : conv.confirmado === true
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {conv.confirmado === null ? (
                          <>
                            <QuestionMarkCircleIcon className="h-4 w-4 mr-1" />
                            Pendiente de respuesta
                          </>
                        ) : conv.confirmado === true ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Confirmada
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-4 w-4 mr-1" />
                            No podés asistir
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-3">
                    <TrophyIcon className="h-8 w-8 text-red-600" />
                  </div>
                </div>

                {/* Detalles del partido */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <CalendarDaysIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Fecha</p>
                      <p className="text-base text-gray-900">{formatearFecha(conv.partido.fecha)}</p>
                    </div>
                  </div>

                  {conv.partido.hora && (
                    <div className="flex items-start space-x-3">
                      <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Hora</p>
                        <p className="text-base text-gray-900">{formatearHora(conv.partido.hora)}</p>
                      </div>
                    </div>
                  )}

                  {conv.partido.lugar && (
                    <div className="flex items-start space-x-3">
                      <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Lugar</p>
                        <p className="text-base text-gray-900">{conv.partido.lugar}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Motivo de rechazo si existe */}
                {conv.confirmado === false && conv.motivoRechazo && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Motivo:</p>
                    <p className="text-sm text-gray-600">{conv.motivoRechazo}</p>
                  </div>
                )}

                {/* Botones de acción (solo si está pendiente y el partido no pasó) */}
                {conv.confirmado === null && new Date(conv.partido.fecha) > new Date() && (
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <button
                      onClick={() => responderConvocatoria(conv.partidoId, true)}
                      disabled={procesando === conv.partidoId}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {procesando === conv.partidoId ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Confirmar asistencia
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => responderConvocatoria(conv.partidoId, false)}
                      disabled={procesando === conv.partidoId}
                      className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {procesando === conv.partidoId ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <XCircleIcon className="h-5 w-5 mr-2" />
                          No puedo asistir
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Mensaje si el partido ya pasó */}
                {new Date(conv.partido.fecha) < new Date() && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500 text-center italic">
                      Este partido ya finalizó
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
