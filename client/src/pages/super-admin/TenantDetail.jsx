import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Users, Settings, FileText, Bot, MessageCircle, Cpu, Key, Eye, EyeOff, Save, BarChart2, ScanLine, BrainCircuit } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [features, setFeatures] = useState({ whatsapp: false, waAgent: false, parse: false })
  const [guardandoFeature, setGuardandoFeature] = useState(null) // key del feature que se está guardando
  const [parseApiKey, setParseApiKey] = useState('')
  const [guardandoParseKey, setGuardandoParseKey] = useState(false)
  const [mostrarParseKey, setMostrarParseKey] = useState(false)
  const [configIA, setConfigIA] = useState({
    enabled: 'false', chatEnabled: 'true',
    horarioInicio: '7', horarioFin: '23', msgFueraHorario: '', whitelist: '',
    nombre: '', promptExtra: '',
    analisisProvider: 'local',
  })
  const [guardandoIA, setGuardandoIA] = useState(false)

  useEffect(() => {
    cargarTenant()
    cargarFeatures()
    cargarConfigIA()
  }, [id])

  async function cargarTenant() {
    try {
      const data = await api.getFull(`/super-admin/tenants/${id}`)
      setTenant(data)
    } catch (error) {
      toast.error('Error cargando tenant: ' + error.message)
      navigate('/admin/tenants')
    } finally {
      setLoading(false)
    }
  }

  async function cargarFeatures() {
    try {
      const [wa, agent, parse, parseKey] = await Promise.all([
        api.getFull(`/super-admin/tenants/${id}/configuracion/PLAN_FEATURE_WHATSAPP`).catch(() => ({ valor: null })),
        api.getFull(`/super-admin/tenants/${id}/configuracion/PLAN_FEATURE_WA_AGENT`).catch(() => ({ valor: null })),
        api.getFull(`/super-admin/tenants/${id}/configuracion/PLAN_FEATURE_PARSE`).catch(() => ({ valor: null })),
        api.getFull(`/super-admin/tenants/${id}/configuracion/PARSE_API_KEY`).catch(() => ({ valor: null })),
      ])
      setFeatures({ whatsapp: wa.valor === 'true', waAgent: agent.valor === 'true', parse: parse.valor === 'true' })
      setParseApiKey(parseKey.valor || '')
    } catch {
      // silencioso
    }
  }

  async function guardarParseApiKey() {
    setGuardandoParseKey(true)
    try {
      await api.postFull(`/super-admin/tenants/${id}/configuracion`, {
        clave: 'PARSE_API_KEY',
        valor: parseApiKey.trim(),
        tipo: 'STRING',
        modulo: 'PLAN',
        descripcion: 'API Key de Axioma Parse para escaneo de comprobantes'
      })
      toast.success('API Key de Parse guardada')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setGuardandoParseKey(false)
    }
  }

  async function toggleFeature(key, clave, label) {
    const nuevoValor = !features[key]
    setGuardandoFeature(key)
    try {
      await api.postFull(`/super-admin/tenants/${id}/configuracion`, {
        clave,
        valor: nuevoValor ? 'true' : 'false',
        tipo: 'BOOLEAN',
        modulo: 'PLAN',
        descripcion: label
      })
      setFeatures(f => ({ ...f, [key]: nuevoValor }))
      toast.success(`${label}: ${nuevoValor ? 'habilitado' : 'deshabilitado'}`)
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setGuardandoFeature(null)
    }
  }

  async function cargarConfigIA() {
    try {
      // Las claves IA legacy (CHAT_USE_AXIO_HUB, WA_AGENT_SYSTEM_PROMPT, AI_PROVIDER,
      // AI_MODEL_TIER, AI_API_KEY, AI_MODEL_OVERRIDE) ya no se honran — el chat
      // y el agente WA siempre van por AXIO Hub. Quedan en DB para tenants
      // pre-existentes pero el código nuevo las ignora.
      const claves = [
        'WA_AGENT_ENABLED', 'CHAT_AGENT_ENABLED',
        'WA_AGENT_HORARIO_INICIO', 'WA_AGENT_HORARIO_FIN', 'WA_AGENT_MSG_FUERA_HORARIO',
        'WA_AGENT_WHITELIST', 'WA_AGENT_NOMBRE', 'WA_AGENT_SYSTEM_PROMPT_EXTRA',
        'AI_ANALISIS_PROVIDER',
      ]
      const results = await Promise.all(
        claves.map(c => api.getFull(`/super-admin/tenants/${id}/configuracion/${c}`).catch(() => ({ valor: null })))
      )
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setConfigIA({
        enabled: cfg.WA_AGENT_ENABLED || 'false',
        chatEnabled: cfg.CHAT_AGENT_ENABLED !== '' ? cfg.CHAT_AGENT_ENABLED : 'true',
        horarioInicio: cfg.WA_AGENT_HORARIO_INICIO || '7',
        horarioFin: cfg.WA_AGENT_HORARIO_FIN || '23',
        msgFueraHorario: cfg.WA_AGENT_MSG_FUERA_HORARIO || '',
        whitelist: cfg.WA_AGENT_WHITELIST || '',
        nombre: cfg.WA_AGENT_NOMBRE || '',
        promptExtra: cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA || '',
        analisisProvider: cfg.AI_ANALISIS_PROVIDER || 'local',
      })
    } catch (err) {
      console.error('Error cargando config IA:', err)
    }
  }

  async function guardarConfigIA() {
    setGuardandoIA(true)
    try {
      const campos = [
        { clave: 'WA_AGENT_ENABLED', valor: configIA.enabled, descripcion: 'Agente IA WhatsApp habilitado', modulo: 'IA' },
        { clave: 'CHAT_AGENT_ENABLED', valor: configIA.chatEnabled, descripcion: 'Asistente de chat interno habilitado', modulo: 'IA' },
        { clave: 'WA_AGENT_HORARIO_INICIO', valor: configIA.horarioInicio, descripcion: 'Hora inicio agente', modulo: 'IA' },
        { clave: 'WA_AGENT_HORARIO_FIN', valor: configIA.horarioFin, descripcion: 'Hora fin agente', modulo: 'IA' },
        { clave: 'WA_AGENT_MSG_FUERA_HORARIO', valor: configIA.msgFueraHorario, descripcion: 'Mensaje fuera de horario', modulo: 'IA' },
        { clave: 'WA_AGENT_WHITELIST', valor: configIA.whitelist, descripcion: 'Lista blanca de números', modulo: 'IA' },
        { clave: 'WA_AGENT_NOMBRE', valor: configIA.nombre, descripcion: 'Nombre del asistente virtual', modulo: 'IA' },
        { clave: 'WA_AGENT_SYSTEM_PROMPT_EXTRA', valor: configIA.promptExtra, descripcion: 'Instrucciones adicionales para el agente (se appendea al system prompt del hub)', modulo: 'IA' },
        { clave: 'AI_ANALISIS_PROVIDER', valor: configIA.analisisProvider, descripcion: 'Motor para análisis de datos del club', modulo: 'IA' },
      ]
      await Promise.all(campos.map(({ clave, valor, descripcion, modulo }) =>
        api.postFull(`/super-admin/tenants/${id}/configuracion`, { clave, valor, tipo: 'STRING', modulo, descripcion })
      ))
      toast.success('Configuración de IA guardada')
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setGuardandoIA(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-8">
        <p>Tenant no encontrado</p>
      </div>
    )
  }

  const estadoColor = {
    PENDING_APPROVAL: 'text-yellow-600 bg-yellow-50',
    ACTIVE: 'text-green-600 bg-green-50',
    SUSPENDED: 'text-red-600 bg-red-50',
    CANCELLED: 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/tenants')}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{tenant.nombre}</h1>
            <p className="text-gray-600">{tenant.subdomain}.clubix.com</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/admin/tenants/${tenant.id}/editar`)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar
        </button>
      </div>

      {/* Estado */}
      <div className={`rounded-lg p-4 ${estadoColor[tenant.estado]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Estado del Club</p>
            <p className="text-sm">
              {tenant.estado === 'PENDING_APPROVAL' && 'Pendiente de aprobación'}
              {tenant.estado === 'ACTIVE' && 'Activo'}
              {tenant.estado === 'SUSPENDED' && `Suspendido: ${tenant.motivoSuspension}`}
              {tenant.estado === 'CANCELLED' && 'Cancelado'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b flex">
          {[
            { id: 'info', label: 'Información', icon: FileText },
            { id: 'admins', label: 'Administradores', icon: Users },
            { id: 'funcionalidades', label: 'Funcionalidades', icon: Bot },
            { id: 'agente', label: 'Agente IA', icon: Cpu },
            { id: 'config', label: 'Configuración', icon: Settings }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Tab: Información */}
          {tab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{tenant.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Teléfono</p>
                  <p className="font-medium">{tenant.telefono || '-'}</p>
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Descripción</p>
                  <p className="font-medium">{tenant.descripcion || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="font-medium">{tenant.plan}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Moneda</p>
                  <p className="font-medium">{tenant.moneda}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Máx Socios</p>
                  <p className="font-medium">{tenant.maxSocios || 'Ilimitado'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Máx Admins</p>
                  <p className="font-medium">{tenant.maxAdmins || 'Ilimitado'}</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Ubicación</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Dirección</p>
                    <p className="font-medium">{tenant.direccion || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ciudad</p>
                    <p className="font-medium">{tenant.ciudad || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Provincia</p>
                    <p className="font-medium">{tenant.provincia || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Código Postal</p>
                    <p className="font-medium">{tenant.codigoPostal || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold mb-4">Auditoría</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Creado</p>
                    <p>{new Date(tenant.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Actualizado</p>
                    <p>{new Date(tenant.updatedAt).toLocaleString()}</p>
                  </div>
                  {tenant.fechaAprobacion && (
                    <div>
                      <p className="text-gray-600">Aprobado</p>
                      <p>{new Date(tenant.fechaAprobacion).toLocaleString()}</p>
                    </div>
                  )}
                  {tenant.fechaSuspension && (
                    <div>
                      <p className="text-gray-600">Suspendido</p>
                      <p>{new Date(tenant.fechaSuspension).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Administradores */}
          {tab === 'admins' && (
            <div>
              {tenant.tenantUsuarios && tenant.tenantUsuarios.length > 0 ? (
                <div className="space-y-4">
                  {tenant.tenantUsuarios.map(tu => (
                    <div key={tu.id} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{tu.admin?.nombre || 'Admin'}</p>
                        <p className="text-sm text-gray-600">{tu.admin?.email}</p>
                        <p className="text-xs text-gray-500 mt-1">Rol: {tu.rol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {tu.activo ? (
                            <span className="text-green-600">Activo</span>
                          ) : (
                            <span className="text-gray-600">Inactivo</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Desde {new Date(tu.fechaIngreso).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay administradores asignados</p>
              )}
            </div>
          )}

          {/* Tab: Funcionalidades */}
          {tab === 'funcionalidades' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Activá las funcionalidades disponibles según el plan contratado por el club.</p>

              {/* WhatsApp Notificaciones */}
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Notificaciones por WhatsApp</p>
                    <p className="text-sm text-gray-500">Permite enviar avisos de cuotas, pagos y novedades vía WhatsApp</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={guardandoFeature === 'whatsapp'}
                  onClick={() => toggleFeature('whatsapp', 'PLAN_FEATURE_WHATSAPP', 'Notificaciones WhatsApp')}
                  className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${features.whatsapp ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${features.whatsapp ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* Agente IA */}
              <div className={`border rounded-lg p-4 flex items-center justify-between ${!features.whatsapp ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Agente de IA (WhatsApp)</p>
                    <p className="text-sm text-gray-500">Asistente virtual con Claude AI que responde consultas de socios</p>
                    {!features.whatsapp && (
                      <p className="text-xs text-amber-600 mt-0.5">Requiere tener WhatsApp habilitado</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={guardandoFeature === 'waAgent' || !features.whatsapp}
                  onClick={() => toggleFeature('waAgent', 'PLAN_FEATURE_WA_AGENT', 'Agente IA WhatsApp')}
                  className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${features.waAgent && features.whatsapp ? 'bg-purple-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${features.waAgent && features.whatsapp ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* Parse — Escaneo de comprobantes */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <ScanLine className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium">Escaneo de comprobantes (Parse)</p>
                      <p className="text-sm text-gray-500">OCR automático al subir comprobante de transferencia — extrae monto, fecha y referencia</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={guardandoFeature === 'parse'}
                    onClick={() => toggleFeature('parse', 'PLAN_FEATURE_PARSE', 'Escaneo de comprobantes')}
                    className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${features.parse ? 'bg-teal-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${features.parse ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                {features.parse && (
                  <div className="pt-2 border-t space-y-2">
                    <label className="block text-sm font-medium text-gray-700">API Key de Axioma Parse</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={mostrarParseKey ? 'text' : 'password'}
                          value={parseApiKey}
                          onChange={e => setParseApiKey(e.target.value)}
                          placeholder="pk-..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarParseKey(!mostrarParseKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {mostrarParseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={guardarParseApiKey}
                        disabled={guardandoParseKey || !parseApiKey.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
                      >
                        {guardandoParseKey ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Agente IA */}
          {tab === 'agente' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">Configuración del asistente virtual de IA para WhatsApp y chat interno.</p>

              {/* Chat interno */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg"><Bot className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <p className="font-medium">Asistente de chat (Portal del Socio)</p>
                      <p className="text-sm text-gray-500">Widget de chat IA dentro del portal web del socio</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigIA({ ...configIA, chatEnabled: configIA.chatEnabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${configIA.chatEnabled === 'true' ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configIA.chatEnabled === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Agente WA */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg"><Bot className="w-5 h-5 text-purple-600" /></div>
                    <div>
                      <p className="font-medium">Agente de IA (WhatsApp)</p>
                      <p className="text-sm text-gray-500">Asistente virtual que responde consultas de socios por WhatsApp</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigIA({ ...configIA, enabled: configIA.enabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${configIA.enabled === 'true' ? 'bg-purple-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configIA.enabled === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio atención</label>
                    <input type="number" value={configIA.horarioInicio} onChange={e => setConfigIA({ ...configIA, horarioInicio: e.target.value })} min="0" max="23" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin atención</label>
                    <input type="number" value={configIA.horarioFin} onChange={e => setConfigIA({ ...configIA, horarioFin: e.target.value })} min="0" max="23" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del asistente</label>
                  <input type="text" value={configIA.nombre} onChange={e => setConfigIA({ ...configIA, nombre: e.target.value })} placeholder="Asistente" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Cómo se presenta el bot al saludar.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje fuera de horario</label>
                  <textarea value={configIA.msgFueraHorario} onChange={e => setConfigIA({ ...configIA, msgFueraHorario: e.target.value })} placeholder="Hola! Nuestro asistente atiende de 7 a 23hs. Te respondemos pronto." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lista blanca de números <span className="text-gray-400 font-normal">(solo para pruebas)</span></label>
                  <input type="text" value={configIA.whitelist} onChange={e => setConfigIA({ ...configIA, whitelist: e.target.value })} placeholder="5491112345678, 5491187654321" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Separados por coma. Vacío = responde a todos.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones adicionales (tono / persona)</label>
                  <textarea value={configIA.promptExtra} onChange={e => setConfigIA({ ...configIA, promptExtra: e.target.value })} placeholder="Ej: No informes precios. Derivá inscripciones nuevas a administración." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={3} />
                  <p className="text-xs text-gray-500 mt-1">Se appendea al system prompt del hub. El comportamiento base (tool-calling, idioma) viene del hub — no hace falta repetirlo acá.</p>
                </div>
              </div>

              {/* Motor de análisis de datos */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <p className="font-medium">Motor de análisis de datos</p>
                    <p className="text-sm text-gray-500">Define qué IA usa el panel de análisis del club (resumen mensual, socios en riesgo, actividades).</p>
                  </div>
                </div>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm w-fit">
                  <button
                    type="button"
                    onClick={() => setConfigIA({ ...configIA, analisisProvider: 'local' })}
                    className={`px-4 py-2 transition-colors ${configIA.analisisProvider === 'local' ? 'bg-indigo-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Local (Ollama) — gratis, datos privados
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigIA({ ...configIA, analisisProvider: 'cloud' })}
                    className={`px-4 py-2 transition-colors border-l border-gray-300 ${configIA.analisisProvider === 'cloud' ? 'bg-indigo-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Cloud (Claude) — mayor calidad, consume créditos
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={guardarConfigIA}
                  disabled={guardandoIA}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  {guardandoIA ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar configuración de IA
                </button>
              </div>
            </div>
          )}

          {/* Tab: Configuración */}
          {tab === 'config' && (
            <div>
              {tenant.configuraciones && tenant.configuraciones.length > 0 ? (
                <div className="space-y-2">
                  {tenant.configuraciones.map(config => (
                    <div key={config.id} className="border rounded-lg p-3 bg-gray-50">
                      <p className="font-medium text-sm">{config.clave}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {config.clave.toLowerCase().includes('pass') || config.clave.toLowerCase().includes('key')
                          ? '••••••••'
                          : config.valor}
                      </p>
                      {config.descripcion && (
                        <p className="text-xs text-gray-400 mt-1">{config.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay configuraciones</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
