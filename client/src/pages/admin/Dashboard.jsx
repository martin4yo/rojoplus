import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Dumbbell, UserX, Receipt, LayoutDashboard } from 'lucide-react'
import { Alert } from '../../components/Alert'
import CashFlowPanel from '../../components/CashFlowPanel'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarStats() {
      try {
        const data = await api.get('/admin/dashboard')
        setStats(data)
      } catch (err) {
        console.error('Error cargando dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    cargarStats()
  }, [])

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <LayoutDashboard className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      </div>

      {/* Alerta de pendientes */}
      {stats?.comerciosPendientes > 0 && (
        <Alert type="warning">
          <div className="flex items-center justify-between">
            <span>
              <strong>{stats.comerciosPendientes}</strong> solicitudes de comercios pendientes de aprobación
            </span>
            <Link
              to="/admin/comercios?estado=PENDIENTE"
              className="text-primary font-semibold hover:underline"
            >
              Ver solicitudes
            </Link>
          </div>
        </Alert>
      )}

      {/* Socios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Socios</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Socios Activos</p>
              <p className="text-2xl font-bold text-blue-700">{stats?.sociosActivos || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="p-3 rounded-full bg-green-100">
              <Dumbbell className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Con Actividad</p>
              <p className="text-2xl font-bold text-green-700">{stats?.sociosConActividad || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="p-3 rounded-full bg-gray-100">
              <UserX className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sin Actividad</p>
              <p className="text-2xl font-bold text-gray-600">{stats?.sociosSinActividad || 0}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to="/admin/socios"
            className="text-sm text-primary hover:text-primary-dark font-medium"
          >
            Ver todos los socios →
          </Link>
        </div>
      </div>

      {/* Panel de CashFlow */}
      <CashFlowPanel stats={stats} />
    </div>
  )
}
