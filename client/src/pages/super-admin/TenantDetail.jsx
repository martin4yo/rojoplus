import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Users, Settings, FileText, Bot, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [features, setFeatures] = useState({ whatsapp: false, waAgent: false })
  const [guardandoFeature, setGuardandoFeature] = useState(null) // key del feature que se está guardando

  useEffect(() => {
    cargarTenant()
    cargarFeatures()
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
      const [wa, agent] = await Promise.all([
        api.getFull(`/super-admin/tenants/${id}/configuracion/PLAN_FEATURE_WHATSAPP`).catch(() => ({ valor: null })),
        api.getFull(`/super-admin/tenants/${id}/configuracion/PLAN_FEATURE_WA_AGENT`).catch(() => ({ valor: null })),
      ])
      setFeatures({ whatsapp: wa.valor === 'true', waAgent: agent.valor === 'true' })
    } catch {
      // silencioso
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
