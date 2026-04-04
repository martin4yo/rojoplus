import { useState, useEffect } from 'react'
import { Eye, Trash2, CheckCircle, XCircle, AlertCircle, Plus, Building2, Users, Activity, TrendingUp, ExternalLink, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function TenantsList() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [tenants, setTenants] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    cargarTenants()
  }, [filter])

  async function cargarTenants() {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filter !== 'all') {
        const estadoMap = { pending: 'PENDING_APPROVAL', active: 'ACTIVE', suspended: 'SUSPENDED' }
        params.append('estado', estadoMap[filter])
      }

      const [data, statsData] = await Promise.all([
        api.getFull(`/super-admin/tenants?${params.toString()}`),
        filter === 'all' ? api.getFull('/super-admin/tenants/stats') : Promise.resolve(null)
      ])

      setTenants(Array.isArray(data) ? data : data.data || [])
      if (statsData) setStats(statsData)
    } catch (error) {
      toast.error('Error cargando tenants: ' + error.message)
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  async function aprobar(id) {
    try {
      await api.post(`/super-admin/tenants/${id}/approve`)
      toast.success('Tenant aprobado')
      cargarTenants()
    } catch (error) {
      toast.error('Error aprobando tenant: ' + error.message)
    }
  }

  async function rechazar(id) {
    const razon = prompt('¿Motivo del rechazo?')
    if (!razon) return

    try {
      await api.post(`/super-admin/tenants/${id}/reject`, { razon })
      toast.success('Tenant rechazado')
      cargarTenants()
    } catch (error) {
      toast.error('Error rechazando tenant: ' + error.message)
    }
  }

  async function suspender(id) {
    const razon = prompt('¿Motivo de la suspensión?')
    if (!razon) return

    try {
      await api.post(`/super-admin/tenants/${id}/suspend`, { razon })
      toast.success('Tenant suspendido')
      cargarTenants()
    } catch (error) {
      toast.error('Error suspendiendo tenant: ' + error.message)
    }
  }

  async function initDatos(tenant) {
    const confirmado = await confirm(
      'Inicializar datos básicos',
      `¿Crear datos básicos para "${tenant.nombre}"? Solo se crearán datos en tablas vacías. Las tablas que ya tengan datos no se modifican.`,
      { confirmText: 'Inicializar', variant: 'warning' }
    )
    if (!confirmado) return

    try {
      const res = await api.postFull(`/super-admin/tenants/${tenant.id}/init-datos`)
      const r = res.resultado || {}
      const creados = Object.entries(r)
        .filter(([, v]) => v.created)
        .map(([k, v]) => `${k}: ${v.created}`)
        .join(', ')
      const omitidos = Object.entries(r)
        .filter(([, v]) => v.skipped)
        .map(([k, v]) => `${k} (${v.existentes} existentes)`)
        .join(', ')
      toast.success(`Datos inicializados.\nCreados: ${creados || 'ninguno'}\nOmitidos: ${omitidos || 'ninguno'}`, { duration: 6000 })
    } catch (error) {
      toast.error('Error: ' + error.message)
    }
  }

  function abrirSitio(subdomain) {
    const hostname = window.location.hostname
    const url = hostname.includes('localhost')
      ? `http://${subdomain}.localhost:5173`
      : `https://${subdomain}.clubix.com.ar`
    window.open(url, '_blank')
  }

  async function eliminar(id, subdomain) {
    if (subdomain === 'sportivo-pilar') {
      toast.error('No se puede eliminar el tenant por defecto')
      return
    }

    if (!await confirm('Eliminar tenant', '¿Eliminar este tenant? Esta acción no se puede deshacer.', { variant: 'danger', confirmText: 'Eliminar' })) return

    try {
      await api.delete(`/super-admin/tenants/${id}`)
      toast.success('Tenant eliminado')
      cargarTenants()
    } catch (error) {
      toast.error('Error eliminando tenant: ' + error.message)
    }
  }

  const filtered = tenants.filter(t =>
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getEstadoBadge = (estado) => {
    const badges = {
      PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activo' },
      SUSPENDED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelado' }
    }
    const badge = badges[estado] || badges.PENDING_APPROVAL
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Tenants</h1>
          <p className="text-gray-600">Administra todos los clubs del sistema</p>
        </div>
        <button
          onClick={() => navigate('/admin/tenants/nuevo')}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Tenant
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tenants', value: stats.tenants, icon: Building2, color: 'text-blue-600 bg-blue-50' },
            { label: 'Activos', value: stats.activeTenants, icon: Activity, color: 'text-green-600 bg-green-50' },
            { label: 'Admins', value: stats.admins, icon: Users, color: 'text-purple-600 bg-purple-50' },
            { label: 'Socios', value: stats.socios, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-lg p-4 ${color} flex items-center gap-4`}>
              <Icon className="w-8 h-8 opacity-60" />
              <div>
                <p className="text-sm font-medium opacity-75">{label}</p>
                <p className="text-2xl font-bold">{value ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'active', label: 'Activos' },
            { value: 'suspended', label: 'Suspendidos' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre, subdomain o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-14"></th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nombre</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Subdomain</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Creado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(tenant => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {tenant.logoUrl ? (
                      <img
                        src={tenant.logoUrl}
                        alt={tenant.nombre}
                        className="w-10 h-10 object-contain rounded"
                        onError={e => e.target.style.display = 'none'}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {tenant.nombre?.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{tenant.nombre}</div>
                    <div className="text-sm text-gray-500">{tenant.descripcion?.substring(0, 50)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{tenant.subdomain}</code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{tenant.email || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium">{tenant.plan}</td>
                  <td className="px-6 py-4">{getEstadoBadge(tenant.estado)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                        className="p-2 hover:bg-blue-50 rounded text-blue-600"
                        title="Ver"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => initDatos(tenant)}
                        className="p-2 hover:bg-purple-50 rounded text-purple-600"
                        title="Inicializar datos básicos (plan de cuentas, tipos de socio, conceptos, etc.)"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>

                      {tenant.activo && (
                        <button
                          onClick={() => abrirSitio(tenant.subdomain)}
                          className="p-2 hover:bg-green-50 rounded text-green-600"
                          title="Abrir sitio del club"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}

                      {tenant.estado === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => aprobar(tenant.id)}
                            className="p-2 hover:bg-green-50 rounded text-green-600"
                            title="Aprobar"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rechazar(tenant.id)}
                            className="p-2 hover:bg-red-50 rounded text-red-600"
                            title="Rechazar"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {tenant.estado === 'ACTIVE' && (
                        <button
                          onClick={() => suspender(tenant.id)}
                          className="p-2 hover:bg-yellow-50 rounded text-yellow-600"
                          title="Suspender"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      )}

                      {tenant.subdomain !== 'sportivo-pilar' && (
                        <button
                          onClick={() => eliminar(tenant.id, tenant.subdomain)}
                          className="p-2 hover:bg-red-50 rounded text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay tenants que coincidan con los criterios de búsqueda
          </div>
        )}
      </div>

    </div>
    <ConfirmDialog />
    </>
  )
}
