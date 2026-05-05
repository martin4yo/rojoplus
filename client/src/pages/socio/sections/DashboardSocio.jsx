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
import { Calendar, Clock, MapPin, ArrowUpRight } from 'lucide-react'

export default function DashboardSocio({ socio, tokenPortal, onNavigate, mensajesNoLeidos = 0 }) {
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
          <div key={i} className="pub-card p-6 animate-pulse" style={{ borderRadius: 0 }}>
            <div className="h-4 rounded w-1/4 mb-4" style={{ backgroundColor: 'var(--border)' }} />
            <div className="h-8 rounded w-1/2" style={{ backgroundColor: 'var(--border)' }} />
          </div>
        ))}
      </div>
    )
  }

  const cuotasPendientes = estadoCuenta?.cuotasPendientes || 0
  const montoPendiente = estadoCuenta?.montoPendiente || 0
  const actividadesActivas = estadoCuenta?.actividadesActivas || 0
  const incluyeFamilia = estadoCuenta?.incluyeFamilia
  const cantMiembrosFamilia = estadoCuenta?.cantMiembrosFamilia || 0

  const nombrePila = socio.apellidoNombre?.includes(',')
    ? socio.apellidoNombre.split(',')[1]?.trim()
    : socio.apellidoNombre

  return (
    <div className="space-y-10">
      {/* Hero athletic de bienvenida */}
      <section className="relative overflow-hidden p-8 md:p-12" style={{ backgroundColor: 'var(--pub-hero-bg)', color: 'var(--pub-hero-fg)' }}>
        <div className="absolute inset-0 bg-field-grid-pub opacity-40 pointer-events-none" />
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'var(--color-primary)' }} />

        <div className="relative grid md:grid-cols-3 gap-8 items-end">
          <div className="md:col-span-2">
            <div className="pub-eyebrow mb-4 text-pub-fg-70">
              Hola, socio Nº {socio.nroSocio}
            </div>
            <h2 className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 0.94 }}>
              {nombrePila}
            </h2>
            <p className="mt-4 text-pub-fg-70 max-w-lg">
              Pagá cuotas, gestioná tu carnet y reservas, accedé a beneficios y eventos del club. Todo desde acá.
            </p>
          </div>

          <div className="md:text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-pub-fg-50 mb-2">
              Estado
            </div>
            <p className="font-display-sport text-pub-fg" style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1 }}>
              {cuotasPendientes === 0 ? (
                <span style={{ color: 'var(--success)' }}>Al día</span>
              ) : (
                <span style={{ color: 'var(--warning)' }}>{cuotasPendientes} pend.</span>
              )}
            </p>
            {cuotasPendientes > 0 && (
              <p className="mt-2 text-pub-fg-70 text-sm">{formatMonto(montoPendiente)}</p>
            )}
            {incluyeFamilia && cuotasPendientes > 0 && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-pub-fg-50">
                Grupo familiar · {cantMiembrosFamilia + 1} socios
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Cards de resumen — pub-card pattern */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          <SummaryCard
            label="Estado de cuotas"
            value={cuotasPendientes === 0 ? 'Al día' : `${cuotasPendientes} pend.`}
            sub={cuotasPendientes === 0 ? 'Sin saldo pendiente' : formatMonto(montoPendiente)}
            icon={CreditCardIcon}
            tone={cuotasPendientes === 0 ? 'success' : 'warning'}
            statusIcon={cuotasPendientes === 0 ? CheckCircleIcon : ExclamationTriangleIcon}
            number="01"
          />
          <SummaryCard
            label="Mis actividades"
            value={`${actividadesActivas} ${actividadesActivas === 1 ? 'activa' : 'activas'}`}
            sub="Inscripciones vigentes"
            icon={TrophyIcon}
            tone="info"
            number="02"
          />
          <SummaryCard
            label="Mi código QR"
            value="Beneficios"
            sub="Para descuentos en comercios"
            icon={QrCodeIcon}
            tone="accent"
            number="03"
            onClick={() => onNavigate?.('perfil')}
          />
          <SummaryCard
            label="Mis avisos"
            value={
              cuotasPendientes === 0 && mensajesNoLeidos === 0
                ? 'Sin novedades'
                : `${cuotasPendientes + mensajesNoLeidos} nuevos`
            }
            sub={
              mensajesNoLeidos > 0
                ? `${mensajesNoLeidos} mensaje${mensajesNoLeidos > 1 ? 's' : ''} sin leer`
                : cuotasPendientes > 0 ? 'Cuotas por pagar' : 'Todo en orden'
            }
            icon={CheckCircleIcon}
            tone={cuotasPendientes > 0 || mensajesNoLeidos > 0 ? 'warning' : 'muted'}
            number="04"
            onClick={() => onNavigate?.(cuotasPendientes > 0 ? 'pagos' : 'mensajes')}
          />
        </div>
      </section>

      {/* Próximos entrenamientos */}
      {proximosEventos.length > 0 && (
        <section>
          <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
            Agenda
          </div>
          <h3 className="font-display-sport mb-6" style={{ fontSize: 'clamp(22px, 3vw, 32px)', lineHeight: 1, color: 'var(--text)' }}>
            Próximos <span style={{ color: 'var(--color-primary)' }}>entrenamientos</span>
          </h3>
          <div className="pub-card p-0 overflow-hidden" style={{ borderRadius: 0 }}>
            <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {proximosEventos.slice(0, 5).map((evento, index) => (
                <div key={index} className="p-5 flex items-start gap-4 hover:bg-[var(--bg-surface-hi)] transition-colors">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] mt-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium" style={{ color: 'var(--text)' }}>{evento.actividad}</h4>
                    {evento.descripcion && (
                      <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{evento.descripcion}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {evento.fecha}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {evento.hora}
                      </span>
                      {evento.lugar && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {evento.lugar}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Accesos rápidos */}
      <section>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Acciones
        </div>
        <h3 className="font-display-sport mb-6" style={{ fontSize: 'clamp(22px, 3vw, 32px)', lineHeight: 1, color: 'var(--text)' }}>
          Accesos <span style={{ color: 'var(--color-primary)' }}>rápidos</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: 'var(--border)' }}>
          {[
            { id: 'pagos', label: 'Pagar cuota', icon: CreditCardIcon, num: '01' },
            { id: 'actividades', label: 'Inscribirme', icon: TrophyIcon, num: '02' },
            { id: 'beneficios', label: 'Beneficios', icon: CalendarIcon, num: '03' },
            { id: 'perfil', label: 'Mi perfil', icon: UserGroupIcon, num: '04' },
          ].map(({ id, label, icon: Icon, num }) => (
            <button
              key={id}
              onClick={() => onNavigate?.(id)}
              className="group p-6 flex flex-col items-start gap-4 transition-all"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
                <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>{num}</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="font-display-sport text-base" style={{ color: 'var(--text)', fontSize: 18 }}>
                  {label}
                </span>
                <ArrowUpRight className="w-4 h-4 ml-auto group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" style={{ color: 'var(--color-primary)' }} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon: Icon, statusIcon: StatusIcon, tone, number, onClick }) {
  const toneColor = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    info: 'var(--info)',
    accent: 'var(--color-primary)',
    muted: 'var(--text-muted)',
  }[tone] || 'var(--text-dim)'

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`group relative p-5 flex flex-col gap-3 text-left ${onClick ? 'hover:bg-[var(--bg-surface-hi)] transition-colors cursor-pointer' : ''}`}
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-6 w-6" style={{ color: toneColor }} />
        <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
          {number}
        </span>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="font-display-sport" style={{ fontSize: 22, lineHeight: 1, color: 'var(--text)' }}>
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-xs" style={{ color: toneColor }}>
            {sub}
          </p>
        )}
      </div>
      {StatusIcon && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <StatusIcon className="h-4 w-4" style={{ color: toneColor }} />
        </div>
      )}
    </Component>
  )
}
