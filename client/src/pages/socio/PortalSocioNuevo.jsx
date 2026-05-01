import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import api from '../../services/api'
import {
  HomeIcon,
  UserIcon,
  TrophyIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  XMarkIcon,
  TagIcon,
  BanknotesIcon,
  BellIcon,
  TicketIcon,
  EllipsisHorizontalIcon,
  CalendarDaysIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserIcon as UserIconSolid,
  TrophyIcon as TrophyIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  TagIcon as TagIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  BellIcon as BellIconSolid,
  TicketIcon as TicketIconSolid,
  EllipsisHorizontalIcon as EllipsisHorizontalIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  IdentificationIcon as IdentificationIconSolid,
} from '@heroicons/react/24/solid'
import { useModal } from '../../components/Modal'
import PushNotificationBanner from '../../components/PushNotificationBanner'
import InstallAppButton from '../../components/InstallAppButton'
import ChatWidget from '../../components/chat/ChatWidget'

// Componentes de secciones
import DashboardSocio from './sections/DashboardSocio'
import MiPerfilSocio from './sections/MiPerfilSocio'
import CarnetDigitalSocio from './sections/CarnetDigitalSocio'
import MisActividadesSocio from './sections/MisActividadesSocio'
import MensajesSocio from './sections/MensajesSocio'
import PagosSocio from './sections/PagosSocio'
import BeneficiosSocio from './sections/BeneficiosSocio'
import DebitoAutomaticoSocio from './sections/DebitoAutomaticoSocio'
import NotificacionesSocio from './sections/NotificacionesSocio'
import EventosSocio from './sections/EventosSocio'
import ReservasSocio from './sections/ReservasSocio'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function PortalSocioNuevo() {
  const { tokenPortal } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showModal, ModalComponent } = useModal()
  const [activeTab, setActiveTab] = useState('inicio')
  const [socio, setSocio] = useState(null)
  const [branding, setBranding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const [cuotasPendientes, setCuotasPendientes] = useState(0)
  const [mostrarMenuMas, setMostrarMenuMas] = useState(false)

  useEffect(() => {
    cargarDatosSocio()
  }, [tokenPortal])

  // Detectar respuesta de MercadoPago
  useEffect(() => {
    const pagoStatus = searchParams.get('pago')
    const seccion = searchParams.get('seccion')

    if (pagoStatus) {
      // Limpiar el query param
      setSearchParams({})

      // Navegar a la sección correcta
      if (seccion === 'eventos') {
        setActiveTab('eventos')
      } else if (seccion === 'pagos') {
        setActiveTab('pagos')
      }

      // Mostrar mensaje según el resultado
      if (pagoStatus === 'exito') {
        showModal({
          type: 'success',
          title: seccion === 'eventos' ? 'Compra exitosa' : 'Pago exitoso',
          message: seccion === 'eventos'
            ? 'Tu compra de entradas ha sido procesada correctamente. Recibirás las entradas por email en breve.'
            : 'Tu pago ha sido procesado correctamente. En breve se verá reflejado en tu cuenta.',
          onConfirm: () => {
            cargarDatosSocio() // Recargar datos
          }
        })
      } else if (pagoStatus === 'error') {
        showModal({
          type: 'error',
          title: 'Pago fallido',
          message: 'Hubo un problema al procesar tu pago. Por favor intenta nuevamente.'
        })
      } else if (pagoStatus === 'pendiente') {
        showModal({
          type: 'warning',
          title: 'Pago pendiente',
          message: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
        })
      }
    }
  }, [searchParams])

  const cargarDatosSocio = async () => {
    try {
      setLoading(true)
      // api.get ya retorna data.data, así que response es directamente el objeto socio
      const socioData = await api.get(`/socio/${tokenPortal}`)
      setSocio(socioData)
      if (socioData?.branding) setBranding(socioData.branding)

      // Cargar datos adicionales en paralelo
      const [cuotas] = await Promise.all([
        api.get(`/socio/${tokenPortal}/cuotas/pendientes`).catch(() => []),
      ])

      setMensajesNoLeidos(0) // TODO: implementar cuando esté el endpoint de mensajes
      setCuotasPendientes(Array.isArray(cuotas) ? cuotas.length : 0)

      setError(null)
    } catch (err) {
      console.error('Error cargando datos del socio:', err)
      setError(err.message || 'No se pudo cargar la información. Verifica que el link sea válido.')
    } finally {
      setLoading(false)
    }
  }

  // Tabs principales (mostrar en barra de navegación)
  const tabsPrincipales = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      badge: null,
    },
    {
      id: 'carnet',
      label: 'Carnet',
      icon: IdentificationIcon,
      iconSolid: IdentificationIconSolid,
      badge: null,
    },
    {
      id: 'actividades',
      label: 'Deportes',
      icon: TrophyIcon,
      iconSolid: TrophyIconSolid,
      badge: null,
    },
    {
      id: 'pagos',
      label: 'Pagos',
      icon: CreditCardIcon,
      iconSolid: CreditCardIconSolid,
      badge: cuotasPendientes > 0 ? cuotasPendientes : null,
    },
  ]

  // Tabs secundarias (mostrar en menú "Más")
  const tabsSecundarias = [
    {
      id: 'reservas',
      label: 'Reservas',
      icon: CalendarDaysIcon,
      iconSolid: CalendarDaysIconSolid,
      badge: null,
      descripcion: 'Reservar canchas y espacios',
    },
    {
      id: 'eventos',
      label: 'Eventos',
      icon: TicketIcon,
      iconSolid: TicketIconSolid,
      badge: null,
      descripcion: 'Compra entradas a eventos del club',
    },
    {
      id: 'beneficios',
      label: 'Beneficios',
      icon: TagIcon,
      iconSolid: TagIconSolid,
      badge: null,
      descripcion: 'Descuentos en comercios adheridos',
    },
    {
      id: 'notificaciones',
      label: 'Avisos',
      icon: BellIcon,
      iconSolid: BellIconSolid,
      badge: null,
      descripcion: 'Notificaciones y anuncios del club',
    },
    {
      id: 'perfil',
      label: 'Mi Perfil',
      icon: UserIcon,
      iconSolid: UserIconSolid,
      badge: null,
      descripcion: 'Datos personales y código QR',
    },
  ]

  const handleTabSecundariaClick = (tabId) => {
    setActiveTab(tabId)
    setMostrarMenuMas(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !socio) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid-pub opacity-40" />
        <div className="relative max-w-md w-full p-8 md:p-12" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div
            className="w-14 h-14 mb-6 flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--error) 12%, transparent)' }}
          >
            <XMarkIcon className="h-7 w-7" style={{ color: 'var(--error)' }} />
          </div>
          <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>Acceso</div>
          <h1 className="font-display-sport mb-3" style={{ fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 0.96, color: 'var(--text)' }}>
            Link no válido.
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
            El enlace que seguiste no es válido o ha expirado. Solicitá uno nuevo.
          </p>
          <Link
            to="/login-socio"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em]"
            style={{ color: 'var(--accent)' }}
          >
            Volver al login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Header athletic */}
      <header className="sticky top-0 z-40 relative overflow-hidden" style={{ backgroundColor: 'var(--pub-hero-bg)' }}>
        <div className="absolute inset-0 bg-field-grid-pub opacity-40 pointer-events-none" />
        <div className="absolute -right-24 -top-24 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'var(--color-primary)' }} />

        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity min-w-0">
              <img src={branding?.logoUrl || '/images/logo.png'} alt="Logo" className="h-10 w-auto flex-shrink-0" />
              <div className="leading-tight min-w-0">
                <h1 className="font-display-sport text-pub-fg truncate" style={{ fontSize: 18, lineHeight: 1 }}>
                  {branding?.nombre || 'Portal'}
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pub-fg-50 mt-0.5">
                  Portal del socio
                </p>
              </div>
            </Link>
            <div className="text-right min-w-0">
              <p className="font-medium text-pub-fg truncate" style={{ fontSize: 14 }}>{socio.apellidoNombre}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pub-fg-60 mt-0.5">
                Socio Nº {socio.nroSocio}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'inicio' && <DashboardSocio socio={socio} tokenPortal={tokenPortal} onNavigate={setActiveTab} mensajesNoLeidos={mensajesNoLeidos} />}
        {activeTab === 'carnet' && <CarnetDigitalSocio socio={socio} tokenPortal={tokenPortal} branding={branding} />}
        {activeTab === 'eventos' && <EventosSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'reservas' && <ReservasSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'beneficios' && <BeneficiosSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'actividades' && <MisActividadesSocio socio={socio} tokenPortal={tokenPortal} />}
        {activeTab === 'pagos' && <PagosSocio socio={socio} tokenPortal={tokenPortal} onPagoRealizado={cargarDatosSocio} mensajesNoLeidos={mensajesNoLeidos} onNavigate={setActiveTab} />}
        {activeTab === 'notificaciones' && <NotificacionesSocio tokenPortal={tokenPortal} />}
        {activeTab === 'perfil' && <MiPerfilSocio socio={socio} tokenPortal={tokenPortal} onUpdate={cargarDatosSocio} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-5 gap-1">
            {/* Tabs principales */}
            {tabsPrincipales.map((tab) => {
              const Icon = activeTab === tab.id ? tab.iconSolid : tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-gray-500 hover:text-gray-700 active:bg-gray-100'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`h-6 w-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {tab.badge && (
                      <span className="absolute -top-2 -right-2 bg-[var(--accent)] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-[var(--accent)] rounded-t-full" />
                  )}
                </button>
              )
            })}

            {/* Botón "Más" */}
            <button
              onClick={() => setMostrarMenuMas(true)}
              className={`relative flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ${
                tabsSecundarias.some((t) => t.id === activeTab)
                  ? 'text-[var(--accent)]'
                  : 'text-gray-500 hover:text-gray-700 active:bg-gray-100'
              }`}
            >
              <div className="relative">
                <EllipsisHorizontalIcon
                  className={`h-6 w-6 transition-transform ${
                    tabsSecundarias.some((t) => t.id === activeTab) ? 'scale-110' : ''
                  }`}
                />
              </div>
              <span
                className={`text-xs mt-1 font-medium ${
                  tabsSecundarias.some((t) => t.id === activeTab) ? 'font-semibold' : ''
                }`}
              >
                Más
              </span>
              {tabsSecundarias.some((t) => t.id === activeTab) && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-[var(--accent)] rounded-t-full" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Menú "Más" (Modal Sheet) */}
      {mostrarMenuMas && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setMostrarMenuMas(false)}
        >
          <div
            className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Más opciones</h3>
              <button
                onClick={() => setMostrarMenuMas(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Opciones secundarias */}
            <div className="p-4 space-y-2">
              {tabsSecundarias.map((tab) => {
                const Icon = activeTab === tab.id ? tab.iconSolid : tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSecundariaClick(tab.id)}
                    className={`w-full flex items-center space-x-4 p-4 rounded-xl transition-all ${
                      isActive
                        ? 'bg-red-50 border-2 border-red-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        isActive ? 'bg-red-100' : 'bg-white'
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${isActive ? 'text-[var(--accent)]' : 'text-gray-600'}`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div
                        className={`font-semibold ${
                          isActive ? 'text-[var(--accent)]' : 'text-gray-900'
                        }`}
                      >
                        {tab.label}
                      </div>
                      <div className="text-sm text-gray-500">{tab.descripcion}</div>
                    </div>
                    {isActive && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent)]"></div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Espacio adicional para botón home en iOS */}
            <div className="h-8"></div>

            {/* Powered by */}
            <p className="text-center text-[10px] text-gray-400 pb-2">Powered by AxiomaCloud</p>
          </div>
        </div>
      )}

      {ModalComponent}

      {/* Banner de notificaciones push */}
      <PushNotificationBanner token={tokenPortal} />

      {/* Botón instalar app */}
      <InstallAppButton />

      {/* Axio - Chat Widget */}
      <ChatWidget tokenPortal={tokenPortal} role="socio" position="bottom-right" />
    </div>
  )
}
