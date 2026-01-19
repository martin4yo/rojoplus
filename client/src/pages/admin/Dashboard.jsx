import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Dumbbell, UserX, Receipt, Clock, TrendingUp, TrendingDown, Wallet, CreditCard, Banknote } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Alerta de pendientes */}
      {stats?.comerciosPendientes > 0 && (
        <Alert type="warning" className="mb-6">
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
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Socios</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Socios Activos</p>
                <p className="text-2xl font-bold text-gray-800">{stats?.sociosActivos || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <Dumbbell className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Con Actividad</p>
                <p className="text-2xl font-bold text-green-600">{stats?.sociosConActividad || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-gray-100">
                <UserX className="w-6 h-6 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sin Actividad</p>
                <p className="text-2xl font-bold text-gray-600">{stats?.sociosSinActividad || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cobranza del período */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">
            Cobranza {stats?.periodoActual?.nombre || 'Sin período'}
          </h2>
          <button
            onClick={() => navigate('/admin/cuotas')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition font-medium"
          >
            <Receipt className="w-4 h-4" />
            Cobrar Cuota
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cobrado</p>
                <p className="text-xl font-bold text-green-600">
                  ${(stats?.cobranzaPeriodo?.cobrado || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-xs text-gray-400">{stats?.cobranzaPeriodo?.cantCobrado || 0} cuotas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pendiente</p>
                <p className="text-xl font-bold text-yellow-600">
                  ${(stats?.cobranzaPeriodo?.pendiente || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-xs text-gray-400">{stats?.cobranzaPeriodo?.cantPendiente || 0} cuotas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Generado</p>
                <p className="text-xl font-bold text-blue-600">
                  ${((stats?.cobranzaPeriodo?.cobrado || 0) + (stats?.cobranzaPeriodo?.pendiente || 0)).toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">% Cobrado</p>
                <p className="text-xl font-bold text-purple-600">
                  {stats?.cobranzaPeriodo?.cobrado && stats?.cobranzaPeriodo?.pendiente
                    ? Math.round((stats.cobranzaPeriodo.cobrado / (stats.cobranzaPeriodo.cobrado + stats.cobranzaPeriodo.pendiente)) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caja */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Caja del Mes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ingresos</p>
                <p className="text-xl font-bold text-green-600">
                  ${(stats?.ingresosMes || 0).toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Egresos</p>
                <p className="text-xl font-bold text-red-600">
                  ${(stats?.egresosMes || 0).toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[120px] flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Saldo Total</p>
                <p className="text-xl font-bold text-blue-600">
                  ${(stats?.saldoTotalCajas || 0).toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalle por caja */}
        {stats?.cajas?.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-600 mb-3">Saldos por Caja</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.cajas.map(caja => (
                <div key={caja.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  {caja.tipo === 'EFECTIVO' ? (
                    <Banknote className="w-4 h-4 text-green-500" />
                  ) : (
                    <CreditCard className="w-4 h-4 text-blue-500" />
                  )}
                  <div>
                    <p className="text-xs text-gray-500">{caja.nombre}</p>
                    <p className="text-sm font-semibold text-gray-700">
                      ${caja.saldoActual.toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
