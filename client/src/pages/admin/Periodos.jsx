import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Plus, Play, CheckCircle, Clock, AlertCircle, DollarSign } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function Periodos() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Modal crear periodo
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [formData, setFormData] = useState({
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    fechaVencimiento: '',
  })
  const [creando, setCreando] = useState(false)
  const [generando, setGenerando] = useState(null)

  useEffect(() => {
    cargarPeriodos()
  }, [])

  async function cargarPeriodos() {
    setLoading(true)
    try {
      const data = await api.get('/admin/periodos')
      setPeriodos(data || [])
    } catch (err) {
      setError('Error al cargar periodos')
    } finally {
      setLoading(false)
    }
  }

  async function crearPeriodo(e) {
    e.preventDefault()
    setCreando(true)
    setError(null)

    try {
      await api.post('/admin/periodos', formData)
      setSuccess('Periodo creado correctamente')
      setShowCrearModal(false)
      setFormData({
        anio: new Date().getFullYear(),
        mes: new Date().getMonth() + 1,
        fechaVencimiento: '',
      })
      cargarPeriodos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear periodo')
    } finally {
      setCreando(false)
    }
  }

  function confirmarGenerarCuotas(periodoId) {
    showModal({
      type: 'warning',
      title: 'Generar Cuotas',
      message: '¿Generar cuotas para este periodo? Esta acción no se puede deshacer.',
      confirmText: 'Generar',
      cancelText: 'Cancelar',
      onConfirm: () => generarCuotas(periodoId),
    })
  }

  async function generarCuotas(periodoId) {
    setGenerando(periodoId)
    setError(null)

    try {
      const result = await api.post(`/admin/periodos/${periodoId}/generar`)
      setSuccess(`Se generaron ${result.cuotasGeneradas} cuotas para ${result.sociosProcesados} socios`)
      cargarPeriodos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al generar cuotas')
    } finally {
      setGenerando(null)
    }
  }

  function getEstadoBadge(estado, periodo) {
    if (estado === 'GENERADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Generado
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3" />
        Pendiente
      </span>
    )
  }

  // Calcular fecha de vencimiento por defecto (dia 10 del mes siguiente)
  function calcularFechaVencimiento(anio, mes) {
    const fecha = new Date(anio, mes, 10) // mes ya es 1-12, al usar como índice da el siguiente
    return fecha.toISOString().split('T')[0]
  }

  useEffect(() => {
    if (formData.anio && formData.mes) {
      setFormData(prev => ({
        ...prev,
        fechaVencimiento: calcularFechaVencimiento(prev.anio, prev.mes)
      }))
    }
  }, [formData.anio, formData.mes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Periodos de Cuota</h1>
          <p className="text-gray-500 mt-1">Genera y administra las cuotas mensuales</p>
        </div>
        <Button onClick={() => setShowCrearModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Periodo
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Listado de periodos */}
      <div className="grid gap-4">
        {periodos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay periodos creados</p>
            <p className="text-gray-400 text-sm mt-1">Crea un periodo para comenzar a generar cuotas</p>
          </div>
        ) : (
          periodos.map(periodo => (
            <div key={periodo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info del periodo */}
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary-light">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{periodo.nombre}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {getEstadoBadge(periodo.estado, periodo)}
                      <span className="text-sm text-gray-500">
                        Vence: {new Date(periodo.fechaVencimiento).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats y acciones */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  {periodo.estado === 'GENERADO' ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-800">{periodo.totalCuotas}</p>
                        <p className="text-xs text-gray-500">Cuotas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{periodo.cuotasPagadas}</p>
                        <p className="text-xs text-gray-500">Pagadas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{periodo.cuotasPendientes}</p>
                        <p className="text-xs text-gray-500">Pendientes</p>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => confirmarGenerarCuotas(periodo.id)}
                      loading={generando === periodo.id}
                      className="flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Generar Cuotas
                    </Button>
                  )}

                  {periodo.estado === 'GENERADO' && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/cuotas?periodoId=${periodo.id}`)}
                      >
                        Ver Cuotas
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              {periodo.estado === 'GENERADO' && periodo.totalCuotas > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Cobranza</span>
                    <span className="font-medium">
                      {Math.round((periodo.cuotasPagadas / periodo.totalCuotas) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(periodo.cuotasPagadas / periodo.totalCuotas) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$0</span>
                    <span className="font-medium text-gray-700">
                      Total: ${periodo.montoTotal?.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal crear periodo */}
      {showCrearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo Periodo de Cuota</h2>
            </div>
            <form onSubmit={crearPeriodo} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                  <select
                    value={formData.anio}
                    onChange={e => setFormData({ ...formData, anio: parseInt(e.target.value) })}
                    className="input-field w-full"
                    required
                  >
                    {[2024, 2025, 2026, 2027].map(anio => (
                      <option key={anio} value={anio}>{anio}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                  <select
                    value={formData.mes}
                    onChange={e => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                    className="input-field w-full"
                    required
                  >
                    {MESES.map((mes, idx) => (
                      <option key={idx} value={idx + 1}>{mes}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={formData.fechaVencimiento}
                  onChange={e => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                  className="input-field w-full"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fecha limite para pagar sin recargo
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="submit" loading={creando} className="flex-1">
                  Crear Periodo
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowCrearModal(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {ModalComponent}
    </div>
  )
}
