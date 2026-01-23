import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../services/api'
import {
  HomeIcon,
  UserIcon,
  TrophyIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserIcon as UserIconSolid,
  TrophyIcon as TrophyIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  CreditCardIcon as CreditCardIconSolid,
} from '@heroicons/react/24/solid'

// Componentes de secciones
import DashboardSocio from './sections/DashboardSocio'
import MiPerfilSocio from './sections/MiPerfilSocio'
import MisActividadesSocio from './sections/MisActividadesSocio'
import MensajesSocio from './sections/MensajesSocio'
import PagosSocio from './sections/PagosSocio'

export default function PortalSocioNuevo() {
  const { tokenPortal } = useParams()
  const [activeTab, setActiveTab] = useState('inicio')
  const [socio, setSocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const [cuotasPendientes, setCuotasPendientes] = useState(0)

  useEffect(() => {
    cargarDatosSocio()
  }, [tokenPortal])

  const cargarDatosSocio = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/socio/${tokenPortal}`)
      setSocio(response.data)

      // Cargar datos adicionales en paralelo
      const [mensajes, cuotas] = await Promise.all([
        api.get(`/socio/${tokenPortal}/mensajes/no-leidos`).catch(() => ({ data: { count: 0 } })),
        api.get(`/socio/${tokenPortal}/cuotas/pendientes`).catch(() => ({ data: { count: 0 } })),
      ])

      setMensajesNoLeidos(mensajes.data?.count || 0)
      setCuotasPendientes(cuotas.data?.count || 0)

      setError(null)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      badge: null,
    },
    {
      id: 'perfil',
      label: 'Perfil',
      icon: UserIcon,
      iconSolid: UserIconSolid,
      badge: null,
    },
    {
      id: 'actividades',
      label: 'Actividades',
      icon: TrophyIcon,
      iconSolid: TrophyIconSolid,
      badge: null,
    },
    {
      id: 'mensajes',
      label: 'Mensajes',
      icon: ChatBubbleLeftRightIcon,
      iconSolid: ChatIconSolid,
      badge: mensajesNoLeidos > 0 ? mensajesNoLeidos : null,
    },
    {
      id: 'pagos',
      label: 'Pagos',
      icon: CreditCardIcon,
      iconSolid: CreditCardIconSolid,
      badge: cuotasPendientes > 0 ? cuotasPendientes : null,
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tu información...</p>
        </div>
      </div>
    )
  }

  if (error || !socio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XMarkIcon className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso no válido</h1>
          <p className="text-gray-600 mb-6">
            El enlace que seguiste no es válido o ha expirado. Por favor, solicita un nuevo enlace.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/images/logo.png" alt="Logo" className="h-12 w-auto" />
              <div>
                <h1 className="text-white font-bold text-lg">Rojo Plus</h1>
                <p className="text-red-100 text-xs">Portal del Socio</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-semibold">{socio.apellidoNombre}</p>
              <p className="text-red-100 text-sm">Socio N° {socio.nroSocio}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'inicio' && <DashboardSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'perfil' && <MiPerfilSocio socio={socio} tokenPortal={tokenPortal} onUpdate={cargarDatosSocio} />}
        {activeTab === 'actividades' && <MisActividadesSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'mensajes' && <MensajesSocio socio={socio} tokenPortal={tokenPortal} onMensajesLeidos={() => setMensajesNoLeidos(0)} />}
        {activeTab === 'pagos' && <PagosSocio socio={socio} tokenPortal={tokenPortal} onPagoRealizado={cargarDatosSocio} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const Icon = activeTab === tab.id ? tab.iconSolid : tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ${
                    isActive
                      ? 'text-red-600'
                      : 'text-gray-500 hover:text-gray-700 active:bg-gray-100'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`h-6 w-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {tab.badge && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-red-600 rounded-t-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
