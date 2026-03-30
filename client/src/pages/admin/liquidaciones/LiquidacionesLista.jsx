import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Calendar, DollarSign, Users, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PARCIAL: { label: 'Parcial', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  ANULADO: { label: 'Anulado', color: 'bg-red-100 text-red-700', icon: XCircle }
}

export default function LiquidacionesLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [liquidaciones, setLiquidaciones] = useState([])
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())

  useEffect(() => {
    cargarLiquidaciones()
  }, [filtroAnio])

  async function cargarLiquidaciones() {
    setLoading(true)
    try {
      const response = await api.getFull(`/admin/liquidaciones?anio=${filtroAnio}&limit=50`)
      setLiquidaciones(response.data || [])
    } catch (err) {
      console.error('Error cargando liquidaciones:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto || 0)
  }

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Generar anios para filtro
  const anioActual = new Date().getFullYear()
  const anios = [anioActual, anioActual - 1, anioActual - 2]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Liquidaciones de Sueldos</h1>
            <p className="text-gray-500 text-sm">Gestion de liquidaciones del personal</p>
          </div>
        </div>
{tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
          <Button onClick={() => navigate('/admin/liquidaciones/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Liquidacion
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Anio:</span>
          </label>
          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(parseInt(e.target.value))}
            className="input-field w-32"
          >
            {anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <LoadingSpinner />
        ) : liquidaciones.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay liquidaciones para el anio {filtroAnio}</p>
{tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
              <Button
                variant="secondary"
                onClick={() => navigate('/admin/liquidaciones/nueva')}
                className="mt-4"
              >
                Generar Primera Liquidacion
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Periodo</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Empleados</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total Bruto</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Deducciones</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total Neto</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Generada</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((liq) => {
                  const estadoInfo = ESTADOS[liq.estado] || ESTADOS.PENDIENTE
                  const EstadoIcon = estadoInfo.icon

                  return (
                    <tr
                      key={liq.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/liquidaciones/${liq.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{liq.periodo}</p>
                            <p className="text-xs text-gray-500 font-mono">{liq.numero}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{liq._count?.items || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatMonto(liq.totalBruto)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">
                        -{formatMonto(liq.totalDeducciones)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-green-600">
                          {formatMonto(liq.totalNeto)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                          <EstadoIcon className="w-3 h-3" />
                          {estadoInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">
                        {formatFecha(liq.fechaGeneracion)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/admin/liquidaciones/${liq.id}`)
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
