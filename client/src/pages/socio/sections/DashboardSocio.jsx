import { useState, useEffect } from 'react'
import api from '../../../services/api'
import {
  UserGroupIcon,
  CreditCardIcon,
  TrophyIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline'
import { Calendar, Clock, MapPin } from 'lucide-react'

export default function DashboardSocio({ socio, tokenPortal, onNavigate }) {
  const [estadoCuenta, setEstadoCuenta] = useState(null)
  const [proximosEventos, setProximosEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDashboard()
  }, [tokenPortal])

  const cargarDashboard = async () => {
    try {
      setLoading(true)
      const [cuenta, eventos] = await Promise.all([
        api.get(`/socio/${tokenPortal}/estado-cuenta`).catch(() => null),
        api.get(`/socio/${tokenPortal}/proximos-eventos`).catch(() => []),
      ])

      setEstadoCuenta(cuenta || null)
      setProximosEventos(Array.isArray(eventos) ? eventos : [])
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatMonto = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(monto)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  const cuotasPendientes = estadoCuenta?.cuotasPendientes || 0
  const montoPendiente = estadoCuenta?.montoPendiente || 0
  const actividadesActivas = estadoCuenta?.actividadesActivas || 0

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div
        className="rounded-xl shadow-lg p-6 text-white"
        style={{ background: 'linear-gradient(to right, var(--color-primary), var(--color-primary-dark, var(--color-primary)))' }}
      >
        <h2 className="text-2xl font-bold mb-2">
          ¡Hola, {socio.apellidoNombre?.includes(',')
            ? socio.apellidoNombre.split(',')[1]?.trim()
            : socio.apellidoNombre}!
        </h2>
        <p className="text-white/70">Bienvenido a tu portal del club</p>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Estado de cuotas */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 rounded-lg p-3">
              <CreditCardIcon className="h-6 w-6 text-green-600" />
            </div>
            {cuotasPendientes === 0 ? (
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-500" />
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Estado de Cuotas</h3>
          {cuotasPendientes === 0 ? (
            <p className="text-2xl font-bold text-green-600">Al día</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-orange-600">{cuotasPendientes} pendientes</p>
              <p className="text-sm text-gray-500 mt-1">{formatMonto(montoPendiente)}</p>
            </>
          )}
        </div>

        {/* Actividades */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 rounded-lg p-3">
              <TrophyIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Mis Actividades</h3>
          <p className="text-2xl font-bold text-blue-600">
            {actividadesActivas} {actividadesActivas === 1 ? 'activa' : 'activas'}
          </p>
        </div>

        {/* Mi QR */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 rounded-lg p-3">
              <QrCodeIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Mi Código QR</h3>
          <p className="text-sm text-gray-500 mb-3">Para descuentos en comercios</p>
          <button
            onClick={() => onNavigate?.('perfil')}
            className="text-purple-600 font-semibold text-sm hover:text-purple-700 transition-colors"
          >
            Ver mi QR →
          </button>
        </div>
      </div>

      {/* Próximos eventos/entrenamientos */}
      {proximosEventos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Próximos Entrenamientos</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {proximosEventos.slice(0, 5).map((evento, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{evento.actividad}</h4>
                    <p className="text-sm text-gray-600 mt-1">{evento.descripcion}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {evento.fecha}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {evento.hora}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {evento.lugar}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Accesos Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate?.('pagos')}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-red-100 rounded-full p-3 mb-2">
              <CreditCardIcon className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Pagar Cuota</span>
          </button>

          <button
            onClick={() => onNavigate?.('actividades')}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-blue-100 rounded-full p-3 mb-2">
              <TrophyIcon className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Inscribirme</span>
          </button>

          <button
            onClick={() => onNavigate?.('beneficios')}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-green-100 rounded-full p-3 mb-2">
              <CalendarIcon className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Beneficios</span>
          </button>

          <button
            onClick={() => onNavigate?.('perfil')}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="bg-purple-100 rounded-full p-3 mb-2">
              <UserGroupIcon className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Mi Perfil</span>
          </button>
        </div>
      </div>

      {/* Notificaciones */}
      {cuotasPendientes > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-orange-800">Tienes cuotas pendientes</h4>
              <p className="text-sm text-orange-700 mt-1">
                Evita recargos pagando antes del vencimiento
              </p>
              <button
                onClick={() => onNavigate?.('pagos')}
                className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Pagar ahora →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
