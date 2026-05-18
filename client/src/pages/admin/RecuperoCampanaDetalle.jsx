import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Trash2,
  Power,
  Users,
  Target,
  UserCheck,
  Megaphone,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  ListChecks,
  Phone,
  MessageCircle,
  Mail,
  Plus,
  Search,
  RefreshCw,
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useModal } from '../../components/Modal'
import { formatDate } from '../../utils/formatters'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import MotivosBajaSelector from '../../components/MotivosBajaSelector'
import { renderTemplateSocio, VARS_SOCIO } from '../../utils/templateVars'

const BADGE_COLORS = {
  success: 'bg-green-100 text-green-800 border-green-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  secondary: 'bg-gray-100 text-gray-700 border-gray-200',
}

function Badge({ variant = 'secondary', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${BADGE_COLORS[variant] || BADGE_COLORS.secondary} ${className}`}>
      {children}
    </span>
  )
}

const TIPO_ACCION_LABEL = {
  LLAMADA_TELEFONICA: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  MENSAJE_PORTAL: 'Mensaje portal',
  VISITA_CLUB: 'Visita',
  EVENTO_ESPECIAL: 'Evento',
  OTRO: 'Otro',
}

const RESULTADO_LABEL = {
  RECUPERADO: { label: 'Recuperado', variant: 'success' },
  INTERESADO: { label: 'Interesado', variant: 'info' },
  PENDIENTE_DECISION: { label: 'Pendiente decisión', variant: 'warning' },
  SIN_RESPUESTA: { label: 'Sin respuesta', variant: 'warning' },
  NO_INTERESADO: { label: 'No le interesa', variant: 'danger' },
}


function dateToInputValue(d) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

function getEstadoCampana(campana) {
  if (!campana) return null
  const hoy = new Date()
  const inicio = new Date(campana.fechaInicio)
  const fin = new Date(campana.fechaFin)
  if (!campana.activa) return { label: 'Inactiva', variant: 'secondary', icon: XCircle }
  if (hoy < inicio) return { label: 'Próxima', variant: 'info', icon: Clock }
  if (hoy > fin) return { label: 'Finalizada', variant: 'secondary', icon: XCircle }
  return { label: 'Activa', variant: 'success', icon: CheckCircle }
}

export default function RecuperoCampanaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [campana, setCampana] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const [acciones, setAcciones] = useState([])
  const [loadingAcciones, setLoadingAcciones] = useState(false)

  const [elegibles, setElegibles] = useState([])
  const [loadingElegibles, setLoadingElegibles] = useState(false)
  const [searchElegibles, setSearchElegibles] = useState('')

  // Modal de registrar acción
  const [accionModal, setAccionModal] = useState(null) // { socio, tipo? }

  useEffect(() => {
    cargarCampana()
    // Cargamos elegibles al inicio para que la KPI "Socios objetivo" muestre
    // el conteo real (no el valor persistido en campana.sociosObjetivo).
    cargarElegibles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (tab === 'acciones') cargarAcciones()
    if (tab === 'elegibles') cargarElegibles()
  }, [tab])

  async function cargarCampana() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get(`/admin/recupero/campanas/${id}`)
      setCampana(data)
      setForm({
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        oferta: data.oferta || '',
        descuento: data.descuento ?? '',
        mesesDescuento: data.mesesDescuento ?? '',
        sinCuotaIngreso: !!data.sinCuotaIngreso,
        motivosBaja: data.motivosBaja || '',
        tiempoBajaMin: data.tiempoBajaMin ?? '',
        tiempoBajaMax: data.tiempoBajaMax ?? '',
        fechaInicio: dateToInputValue(data.fechaInicio),
        fechaFin: dateToInputValue(data.fechaFin),
        activa: !!data.activa,
      })
    } catch (err) {
      console.error('Error cargando campaña:', err)
      setError(err.message || 'No se pudo cargar la campaña')
    } finally {
      setLoading(false)
    }
  }

  async function cargarAcciones() {
    try {
      setLoadingAcciones(true)
      const qs = new URLSearchParams({ campanaId: String(id), limit: '100' })
      const res = await api.getFull(`/admin/recupero/acciones?${qs.toString()}`)
      setAcciones(res?.data || [])
    } catch (err) {
      console.error('Error cargando acciones:', err)
    } finally {
      setLoadingAcciones(false)
    }
  }

  async function cargarElegibles() {
    try {
      setLoadingElegibles(true)
      const qs = new URLSearchParams()
      if (searchElegibles.trim()) qs.set('search', searchElegibles.trim())
      const res = await api.getFull(`/admin/recupero/campanas/${id}/socios-elegibles?${qs.toString()}`)
      setElegibles(res?.data || [])
    } catch (err) {
      console.error('Error cargando socios elegibles:', err)
      toast.error('Error cargando socios elegibles')
    } finally {
      setLoadingElegibles(false)
    }
  }

  function getTelefono(socio) {
    return socio?.celular || socio?.celularSecundario || socio?.telefonoFijo || null
  }

  function normalizarWa(tel) {
    if (!tel) return null
    const digits = String(tel).replace(/\D/g, '')
    if (!digits) return null
    // Si no empieza con 54 (Argentina), lo agregamos asumiendo número AR
    return digits.startsWith('54') ? digits : `54${digits}`
  }

  function abrirContacto(socio, tipo) {
    if (tipo === 'LLAMADA_TELEFONICA') {
      const tel = getTelefono(socio)
      if (!tel) return toast.error('El socio no tiene teléfono cargado')
      window.location.href = `tel:${tel}`
    } else if (tipo === 'WHATSAPP') {
      const tel = normalizarWa(getTelefono(socio))
      if (!tel) return toast.error('El socio no tiene celular cargado')
      const mensaje = renderTemplateSocio(campana.oferta || '', socio)
      const texto = encodeURIComponent(mensaje)
      window.open(`https://wa.me/${tel}${texto ? `?text=${texto}` : ''}`, '_blank')
    } else if (tipo === 'EMAIL') {
      if (!socio.email) return toast.error('El socio no tiene email cargado')
      const subject = encodeURIComponent(renderTemplateSocio(campana.nombre || 'Te queremos de vuelta', socio))
      const body = encodeURIComponent(renderTemplateSocio(campana.oferta || '', socio))
      window.location.href = `mailto:${socio.email}?subject=${subject}&body=${body}`
    }
    // Abrir el modal para registrar el resultado de la acción
    setAccionModal({ socio, tipo })
  }

  async function registrarAccion(payload) {
    try {
      await api.post('/admin/recupero/acciones', {
        ...payload,
        socioId: payload.socioId,
        campanaId: parseInt(id),
      })
      toast.success('Acción registrada')
      setAccionModal(null)
      await Promise.all([cargarCampana(), cargarElegibles(), cargarAcciones()])
    } catch (err) {
      toast.error(err.message || 'Error registrando la acción')
    }
  }

  async function guardar() {
    if (!form.nombre || !form.oferta || !form.fechaInicio || !form.fechaFin) {
      setError('Completá: Nombre, Oferta y Fechas')
      return
    }
    try {
      setGuardando(true)
      setError(null)
      await api.put(`/admin/recupero/campanas/${id}`, form)
      toast.success('Campaña actualizada')
      await cargarCampana()
    } catch (err) {
      console.error('Error guardando campaña:', err)
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActiva() {
    const nuevo = !form.activa
    showModal({
      type: nuevo ? 'info' : 'warning',
      title: nuevo ? '¿Activar campaña?' : '¿Desactivar campaña?',
      message: nuevo
        ? 'La campaña va a estar visible y disponible para registrar acciones.'
        : 'La campaña dejará de estar activa pero conservás todos los datos y acciones registradas.',
      confirmText: nuevo ? 'Activar' : 'Desactivar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.put(`/admin/recupero/campanas/${id}`, { activa: nuevo })
          toast.success(nuevo ? 'Campaña activada' : 'Campaña desactivada')
          await cargarCampana()
        } catch (err) {
          toast.error(err.message || 'Error')
        }
      },
    })
  }

  async function eliminar() {
    showModal({
      type: 'warning',
      title: '¿Eliminar campaña?',
      message: `Vas a eliminar "${campana.nombre}". Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/recupero/campanas/${id}`)
          toast.success('Campaña eliminada')
          navigate('/admin/recupero')
        } catch (err) {
          toast.error(err.message || 'No se pudo eliminar (puede tener acciones registradas)')
        }
      },
    })
  }

  if (loading) return <LoadingSpinner />
  if (!campana) {
    return (
      <div className="p-6">
        <Alert variant="danger">No se pudo cargar la campaña</Alert>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/admin/recupero')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
    )
  }

  const estado = getEstadoCampana(campana)
  const EstadoIcon = estado.icon

  return (
    <div>
      {/* Header: navegación + título + acciones */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/recupero')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mr-auto">
          <Megaphone className="w-7 h-7 text-primary" />
          {campana.nombre}
          <Badge variant={estado.variant}>
            <EstadoIcon className="w-3 h-3 mr-1 inline" /> {estado.label}
          </Badge>
        </h1>
        <Button variant="secondary" size="sm" onClick={toggleActiva}>
          <Power className="w-4 h-4 mr-1" />
          {form?.activa ? 'Desactivar' : 'Activar'}
        </Button>
        <Button variant="danger" size="sm" onClick={eliminar}>
          <Trash2 className="w-4 h-4 mr-1" /> Eliminar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Users} label="Socios objetivo" valor={elegibles.length || campana.sociosObjetivo || 0} color="text-gray-600" />
        <KpiCard icon={Target} label="Contactados" valor={campana.contactados || 0} color="text-blue-600" />
        <KpiCard icon={UserCheck} label="Interesados" valor={campana.interesados || 0} color="text-yellow-600" />
        <KpiCard icon={CheckCircle} label="Recuperados" valor={campana.recuperados || 0} color="text-green-600" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 flex gap-1">
        <TabButton active={tab === 'info'} onClick={() => setTab('info')} icon={Info}>Información</TabButton>
        <TabButton active={tab === 'elegibles'} onClick={() => setTab('elegibles')} icon={Users}>Socios elegibles</TabButton>
        <TabButton active={tab === 'acciones'} onClick={() => setTab('acciones')} icon={ListChecks}>
          Acciones {acciones.length > 0 && <span className="ml-1 text-xs text-gray-500">({acciones.length})</span>}
        </TabButton>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4" onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Tab: Información */}
      {tab === 'info' && form && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Datos de la campaña</h3>

              <Field label="Nombre *">
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </Field>

              <Field label="Descripción">
                <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
              </Field>

              <Field label="Oferta *">
                <textarea value={form.oferta} onChange={e => setForm({ ...form, oferta: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Hola {{nombre}}, te ofrecemos…" />
                <div className="mt-1 text-xs text-gray-500">
                  Variables:{' '}
                  {VARS_SOCIO.map((v, i) => (
                    <span key={v.key}>
                      {i > 0 && ' · '}
                      <span className="font-mono bg-gray-100 px-1 rounded" title={v.desc}>{`{{${v.key}}}`}</span>
                    </span>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Descuento (%)">
                  <input type="number" step="0.01" value={form.descuento} onChange={e => setForm({ ...form, descuento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
                <Field label="Meses de Descuento">
                  <input type="number" value={form.mesesDescuento} onChange={e => setForm({ ...form, mesesDescuento: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.sinCuotaIngreso} onChange={e => setForm({ ...form, sinCuotaIngreso: e.target.checked })} className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm text-gray-700">Sin cuota de ingreso</span>
              </label>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Segmentación (opcional)</h3>

              <Field label="Estados de baja a incluir">
                <MotivosBajaSelector
                  value={form.motivosBaja}
                  onChange={v => setForm({ ...form, motivosBaja: v })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Baja hace (meses mín)">
                  <input type="number" value={form.tiempoBajaMin} onChange={e => setForm({ ...form, tiempoBajaMin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
                <Field label="Baja hace (meses máx)">
                  <input type="number" value={form.tiempoBajaMax} onChange={e => setForm({ ...form, tiempoBajaMax: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
              </div>

              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide pt-2 border-t border-gray-200">Vigencia</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha Inicio *">
                  <input type="date" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
                <Field label="Fecha Fin *">
                  <input type="date" value={form.fechaFin} onChange={e => setForm({ ...form, fechaFin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </Field>
              </div>

              {campana.admin && (
                <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  Creada por {campana.admin.nombre} {campana.admin.apellido} el {formatDate(campana.createdAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={cargarCampana} disabled={guardando}>Descartar</Button>
            <Button variant="primary" onClick={guardar} disabled={guardando}>
              <Save className="w-4 h-4 mr-1" />
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      )}

      {/* Tab: Acciones */}
      {tab === 'acciones' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {loadingAcciones ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : acciones.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Todavía no se registraron acciones para esta campaña.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Socio</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Resultado</th>
                    <th className="px-4 py-2 text-left">Observaciones</th>
                    <th className="px-4 py-2 text-left">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {acciones.map(a => {
                    const r = RESULTADO_LABEL[a.resultado] || { label: a.resultado, variant: 'secondary' }
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(a.fecha)}</td>
                        <td className="px-4 py-2">
                          {a.socio
                            ? <>#{a.socio.nroSocio} {a.socio.apellidoNombre}</>
                            : '-'}
                        </td>
                        <td className="px-4 py-2">{TIPO_ACCION_LABEL[a.tipo] || a.tipo}</td>
                        <td className="px-4 py-2"><Badge variant={r.variant}>{r.label}</Badge></td>
                        <td className="px-4 py-2 max-w-xs truncate" title={a.observaciones || ''}>{a.observaciones || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {a.responsable ? `${a.responsable.nombre} ${a.responsable.apellido}` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Socios elegibles */}
      {tab === 'elegibles' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Filtro/búsqueda */}
          <div className="p-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchElegibles}
                onChange={e => setSearchElegibles(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') cargarElegibles() }}
                placeholder="Buscar por nombre o nro. de socio…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={cargarElegibles}>
              <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
            </Button>
            <span className="text-xs text-gray-500 ml-auto">
              {elegibles.length} socio{elegibles.length !== 1 ? 's' : ''} elegible{elegibles.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingElegibles ? (
            <div className="p-8"><LoadingSpinner /></div>
          ) : elegibles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              No se encontraron socios que cumplan los criterios de esta campaña.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Socio</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Baja</th>
                    <th className="px-3 py-2 text-left">Contacto</th>
                    <th className="px-3 py-2 text-left">Última acción</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {elegibles.map(s => {
                    const tel = getTelefono(s)
                    const ua = s.ultimaAccion
                    const uaResultado = ua ? (RESULTADO_LABEL[ua.resultado] || { label: ua.resultado, variant: 'secondary' }) : null
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                            <span>#{s.nroSocio} {s.apellidoNombre}</span>
                            {s.tipoFamilia === 'TITULAR' && (
                              <span title={`Titular del grupo familiar (${s.cantMiembrosFamilia} miembro${s.cantMiembrosFamilia !== 1 ? 's' : ''})`}
                                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                Titular ({s.cantMiembrosFamilia})
                              </span>
                            )}
                            {s.tipoFamilia === 'SOCIO_UNICO' && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">
                                Socio único
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {s.estadoSocioRel ? (
                            <Badge variant="secondary">{s.estadoSocioRel.nombre}</Badge>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {s.fechaBaja ? <div>desde {formatDate(s.fechaBaja)}</div> : <div className="text-gray-400">sin fecha</div>}
                          {s.motivoBaja && <div className="text-gray-400 italic" title={s.motivoBaja}>{s.motivoBaja.length > 30 ? s.motivoBaja.slice(0, 30) + '…' : s.motivoBaja}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {tel && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {tel}
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {s.email}
                            </div>
                          )}
                          {!tel && !s.email && <span className="text-gray-400">Sin contacto</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {ua ? (
                            <div>
                              <Badge variant={uaResultado.variant}>{uaResultado.label}</Badge>
                              <div className="text-gray-400 mt-0.5">{TIPO_ACCION_LABEL[ua.tipo]} · {formatDate(ua.fecha)}</div>
                            </div>
                          ) : <span className="text-gray-400">Sin acciones</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              title="Llamar"
                              onClick={() => abrirContacto(s, 'LLAMADA_TELEFONICA')}
                              disabled={!tel}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:text-gray-300 disabled:hover:bg-transparent"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              title="WhatsApp"
                              onClick={() => abrirContacto(s, 'WHATSAPP')}
                              disabled={!tel}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:text-gray-300 disabled:hover:bg-transparent"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              title="Email"
                              onClick={() => abrirContacto(s, 'EMAIL')}
                              disabled={!s.email}
                              className="p-1.5 rounded hover:bg-purple-50 text-purple-600 disabled:text-gray-300 disabled:hover:bg-transparent"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              title="Registrar acción"
                              onClick={() => setAccionModal({ socio: s, tipo: 'OTRO' })}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Registrar acción */}
      {accionModal && (
        <AccionModal
          socio={accionModal.socio}
          tipoInicial={accionModal.tipo}
          campana={campana}
          onClose={() => setAccionModal(null)}
          onSave={registrarAccion}
        />
      )}

      {ModalComponent}
    </div>
  )
}

function AccionModal({ socio, tipoInicial, campana, onClose, onSave }) {
  const [form, setForm] = useState({
    tipo: tipoInicial || 'LLAMADA_TELEFONICA',
    resultado: 'PENDIENTE_DECISION',
    nivelInteres: '',
    observaciones: '',
    objeciones: '',
    proximaAccion: '',
    fechaProxima: '',
    recordatorio: false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.tipo || !form.resultado) {
      toast.error('Tipo y resultado son obligatorios')
      return
    }
    try {
      setSaving(true)
      await onSave({
        socioId: socio.id,
        tipo: form.tipo,
        resultado: form.resultado,
        nivelInteres: form.nivelInteres || null,
        observaciones: form.observaciones || null,
        objeciones: form.objeciones || null,
        ofertaRealizada: campana?.oferta || null,
        proximaAccion: form.proximaAccion || null,
        fechaProxima: form.fechaProxima || null,
        recordatorio: form.recordatorio,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Registrar acción de recupero</h2>
        <p className="text-sm text-gray-500 mb-4">Socio: <strong>#{socio.nroSocio} {socio.apellidoNombre}</strong></p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de contacto *">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {Object.entries(TIPO_ACCION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Resultado *">
            <select value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {Object.entries(RESULTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Nivel de interés">
            <select value={form.nivelInteres} onChange={e => setForm({ ...form, nivelInteres: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">— Sin determinar —</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
              <option value="NINGUNO">Ninguno</option>
            </select>
          </Field>
          <Field label="Próxima acción (opcional)">
            <select value={form.proximaAccion} onChange={e => setForm({ ...form, proximaAccion: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">— Sin definir —</option>
              {Object.entries(TIPO_ACCION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Observaciones">
            <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Qué le dijiste / qué te respondió…" />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Objeciones / motivo si no le interesa">
            <textarea value={form.objeciones} onChange={e => setForm({ ...form, objeciones: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="No tiene tiempo, le sale caro, etc." />
          </Field>
        </div>

        {form.proximaAccion && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Fecha de próxima acción">
              <input type="date" value={form.fechaProxima} onChange={e => setForm({ ...form, fechaProxima: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </Field>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={form.recordatorio} onChange={e => setForm({ ...form, recordatorio: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Recordarme</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Registrar acción'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, label, valor, color }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <Icon className={`w-8 h-8 ${color}`} />
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{valor}</p>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  )
}

