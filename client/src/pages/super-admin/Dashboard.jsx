import { useState, useEffect } from 'react'
import { Building2, Users, TrendingUp, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      setLoading(true)
      const [statsData, tenantsData] = await Promise.all([
        api.get('/super-admin/stats'),
        api.get('/super-admin/tenants?estado=PENDING_APPROVAL')
      ])

      setStats(statsData)
      setTenants(tenantsData || [])
    } catch (error) {
      toast.error('Error cargando datos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Tenants',
      value: stats?.tenants || 0,
      icon: Building2,
      color: 'bg-blue-50 text-blue-600',
      action: () => navigate('/super-admin/tenants')
    },
    {
      title: 'Tenants Activos',
      value: stats?.activeTenants || 0,
      icon: Activity,
      color: 'bg-green-50 text-green-600',
      action: () => navigate('/super-admin/tenants?filter=active')
    },
    {
      title: 'Total Admins',
      value: stats?.admins || 0,
      icon: Users,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      title: 'Total Socios',
      value: stats?.socios || 0,
      icon: TrendingUp,
      color: 'bg-orange-50 text-orange-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Super-Admin</h1>
        <p className="text-gray-600">Visión general del sistema Clubix</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={idx}
              onClick={card.action}
              className={`${card.color} rounded-lg p-6 cursor-pointer hover:shadow-lg transition`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-75">{card.title}</p>
                  <p className="text-4xl font-bold mt-2">{card.value}</p>
                </div>
                <Icon className="w-12 h-12 opacity-20" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Tenants Pendientes */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Aprobaciones Pendientes</h2>
          {tenants.length > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              {tenants.length} pendiente{tenants.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {tenants.length > 0 ? (
          <div className="space-y-3">
            {tenants.map(tenant => (
              <div
                key={tenant.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{tenant.nombre}</p>
                  <p className="text-sm text-gray-600">{tenant.email}</p>
                </div>
                <button
                  onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
                >
                  Revisar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No hay tenants pendientes de aprobación</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">Acciones Rápidas</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/super-admin/tenants')}
              className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Ver todos los tenants
            </button>
            <button
              onClick={() => navigate('/super-admin/tenants/nuevo')}
              className="w-full px-4 py-2 text-left border border-primary text-primary rounded-lg hover:bg-primary hover:text-white text-sm transition"
            >
              Crear nuevo tenant
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">Información</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-600">Versión:</span> 1.0.0</p>
            <p><span className="text-gray-600">Sistema:</span> Clubix Multi-Tenant</p>
            <p><span className="text-gray-600">Estado:</span> <span className="text-green-600">Operativo</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
