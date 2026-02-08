import { useState, useEffect } from 'react'
import { BellIcon, EnvelopeIcon, DevicePhoneMobileIcon, TrophyIcon, CalendarIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import api from '../../../services/api'
import toast from 'react-hot-toast'

export default function NotificacionesSocio({ tokenPortal }) {
  const [preferencias, setPreferencias] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    cargarPreferencias()
  }, [tokenPortal])

  async function cargarPreferencias() {
    try {
      setLoading(true)
      const res = await api.get(`/socio/${tokenPortal}/preferencias-notificaciones`)
      const data = res.data || res
      setPreferencias(data)
    } catch (error) {
      console.error('Error cargando preferencias:', error)
      toast.error('Error al cargar preferencias')
    } finally {
      setLoading(false)
    }
  }

  async function guardarPreferencias(nuevasPreferencias) {
    try {
      setSaving(true)
      await api.put(`/socio/${tokenPortal}/preferencias-notificaciones`, nuevasPreferencias)
      setPreferencias(nuevasPreferencias)
      toast.success('Preferencias guardadas')
    } catch (error) {
      console.error('Error guardando preferencias:', error)
      toast.error('Error al guardar preferencias')
    } finally {
      setSaving(false)
    }
  }

  function togglePreferencia(categoria, campo) {
    const nuevasPreferencias = {
      ...preferencias,
      [categoria]: {
        ...preferencias[categoria],
        [campo]: !preferencias[categoria][campo]
      }
    }
    guardarPreferencias(nuevasPreferencias)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!preferencias) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se pudieron cargar las preferencias
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <BellIcon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Preferencias de Notificaciones</h2>
            <p className="text-gray-600 text-sm">Configura qué notificaciones quieres recibir</p>
          </div>
        </div>
      </div>

      {/* Cuotas y General */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Cuotas y General</h3>
          </div>
        </div>
        <div className="divide-y">
          <NotificacionItem
            titulo="Cuota próxima a vencer"
            descripcion="Email 5 días antes del vencimiento"
            activo={preferencias.cuotasYGeneral?.cuotaProximaVencer}
            onChange={() => togglePreferencia('cuotasYGeneral', 'cuotaProximaVencer')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Cuota vencida"
            descripcion="Email el día del vencimiento"
            activo={preferencias.cuotasYGeneral?.cuotaVencida}
            onChange={() => togglePreferencia('cuotasYGeneral', 'cuotaVencida')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Recordatorio de morosidad"
            descripcion="Email cada 15 días si tienes cuotas pendientes"
            activo={preferencias.cuotasYGeneral?.recordatorioMorosidad}
            onChange={() => togglePreferencia('cuotasYGeneral', 'recordatorioMorosidad')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Confirmación de inscripción"
            descripcion="Email al inscribirte en una actividad"
            activo={preferencias.cuotasYGeneral?.confirmacionInscripcion}
            onChange={() => togglePreferencia('cuotasYGeneral', 'confirmacionInscripcion')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Noticias del club"
            descripcion="Novedades y comunicados importantes"
            activo={preferencias.cuotasYGeneral?.noticiasClub}
            onChange={() => togglePreferencia('cuotasYGeneral', 'noticiasClub')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Notificaciones push"
            descripcion="Alertas en tu celular (si instalaste la app)"
            activo={preferencias.cuotasYGeneral?.notificacionesPush}
            onChange={() => togglePreferencia('cuotasYGeneral', 'notificacionesPush')}
            disabled={saving}
            icon={<DevicePhoneMobileIcon className="h-5 w-5 text-blue-500" />}
          />
        </div>
      </div>

      {/* Deportivas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Actividades Deportivas</h3>
          </div>
        </div>
        <div className="divide-y">
          <NotificacionItem
            titulo="Convocatoria a partidos"
            descripcion="Email cuando seas convocado a un partido"
            activo={preferencias.deportivas?.convocatoriaPartido}
            onChange={() => togglePreferencia('deportivas', 'convocatoriaPartido')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Recordatorio de partido"
            descripcion="Email 24 horas antes del partido"
            activo={preferencias.deportivas?.recordatorioPartido}
            onChange={() => togglePreferencia('deportivas', 'recordatorioPartido')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Cancelación de entrenamiento"
            descripcion="Email si se cancela un entrenamiento programado"
            activo={preferencias.deportivas?.cancelacionEntrenamiento}
            onChange={() => togglePreferencia('deportivas', 'cancelacionEntrenamiento')}
            disabled={saving}
          />
          <NotificacionItem
            titulo="Nuevo entrenamiento"
            descripcion="Email cuando se programe un nuevo entrenamiento"
            activo={preferencias.deportivas?.nuevoEntrenamiento}
            onChange={() => togglePreferencia('deportivas', 'nuevoEntrenamiento')}
            disabled={saving}
          />
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <EnvelopeIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Las notificaciones se envían por email</p>
            <p className="text-blue-600">
              Asegurate de tener tu email actualizado en tu perfil para recibir las notificaciones correctamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificacionItem({ titulo, descripcion, activo, onChange, disabled, icon }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {icon || (
          activo ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
          )
        )}
        <div>
          <p className="font-medium text-gray-900">{titulo}</p>
          <p className="text-sm text-gray-500">{descripcion}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
          activo ? 'bg-red-600' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            activo ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
