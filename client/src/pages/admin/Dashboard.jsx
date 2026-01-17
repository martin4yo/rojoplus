import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Store, Upload, BarChart3 } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function AdminDashboard() {
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Cards de stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-sm">Ventas Hoy</p>
          <p className="text-3xl font-bold text-gray-800">{stats?.ventasHoy || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-sm">Comercios Activos</p>
          <p className="text-3xl font-bold text-gray-800">{stats?.comerciosActivos || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-sm">Socios Activos</p>
          <p className="text-3xl font-bold text-gray-800">{stats?.sociosActivos || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-sm">Monto Hoy</p>
          <p className="text-3xl font-bold text-primary">
            $ {(stats?.montoTotalHoy || 0).toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Alerta de pendientes */}
      {stats?.comerciosPendientes > 0 && (
        <Alert type="warning" className="mb-6">
          <div className="flex items-center justify-between">
            <span>
              <strong>{stats.comerciosPendientes}</strong> solicitudes de comercios pendientes de aprobacion
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

      {/* Stats semanales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen Semanal</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Ventas</span>
              <span className="font-semibold">{stats?.ventasSemana || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monto total</span>
              <span className="font-semibold">
                $ {(stats?.montoTotalSemana || 0).toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Acciones Rapidas</h2>
          <div className="space-y-2">
            <Link
              to="/admin/comercios"
              className="flex items-center gap-3 w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Store className="w-5 h-5 text-gray-500" />
              <span>Ver comercios</span>
            </Link>
            <Link
              to="/admin/socios/cargar"
              className="flex items-center gap-3 w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-500" />
              <span>Cargar socios desde Excel</span>
            </Link>
            <Link
              to="/admin/reportes"
              className="flex items-center gap-3 w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-gray-500" />
              <span>Ver reportes</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
