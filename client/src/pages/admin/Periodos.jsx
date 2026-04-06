import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Plus, Play, CheckCircle, Clock, AlertCircle, DollarSign, Trash2, RefreshCw, Receipt } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'

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

  // Filtro de periodo hasta (por defecto mes actual)
  const [periodoHasta, setPeriodoHasta] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Configuración
  const [diaVencimiento, setDiaVencimiento] = useState(10)
  const [venceMismoMes, setVenceMismoMes] = useState(false)

  // Modal crear periodo
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [formData, setFormData] = useState({
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    fechaVencimiento: '',
  })
  const [creando, setCreando] = useState(false)
  const [generando, setGenerando] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  useEffect(() => {
    cargarPeriodos()
    cargarConfiguracion()
  }, [])

  async function cargarConfiguracion() {
    try {
      const [configDia, configMes] = await Promise.all([
        api.get('/admin/sistema/configuracion/CUOTA_DIA_VENCIMIENTO'),
        api.get('/admin/sistema/configuracion/CUOTA_VENCE_MISMO_MES'),
      ])
      if (configDia?.valor) {
        setDiaVencimiento(parseInt(configDia.valor))
      }
      setVenceMismoMes(configMes?.valor === 'true')
    } catch (err) {
      console.error('Error cargando configuración:', err)
    }
  }

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
      const resultado = await api.post('/admin/periodos', formData)
      const periodoId = resultado.id

      // Si el periodo ya existía (creado por plan de pagos), generar cuotas automáticamente
      if (resultado.existente) {
        setSuccess(`El periodo ${MESES[formData.mes - 1]} ${formData.anio} ya existía. Generando cuotas...`)
        // Generar cuotas automáticamente
        try {
          const genResult = await api.post(`/admin/periodos/${periodoId}/generar`)
          setSuccess(genResult.mensaje || `Cuotas generadas: ${genResult.cuotasGeneradas}`)
        } catch (genErr) {
          setError(genErr.message || 'Error al generar cuotas')
        }
      } else {
        setSuccess('Periodo creado correctamente')
      }
      setShowCrearModal(false)
      setFormData({
        anio: new Date().getFullYear(),
        mes: new Date().getMonth() + 1,
        fechaVencimiento: '',
      })
      cargarPeriodos()
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Error al crear periodo'
      setError(mensaje)
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
      // Usar mensaje del servidor que incluye info de saltados
      setSuccess(result.mensaje || `Se generaron ${result.cuotasGeneradas} cuotas`)
      cargarPeriodos()
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Error al generar cuotas')
    } finally {
      setGenerando(null)
    }
  }

  function confirmarEliminarPeriodo(periodo) {
    showModal({
      type: 'warning',
      title: 'Eliminar Periodo',
      message: `¿Eliminar el periodo "${periodo.nombre}"? Se eliminarán todas las cuotas pendientes asociadas.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => eliminarPeriodo(periodo.id),
    })
  }

  async function eliminarPeriodo(periodoId) {
    setEliminando(periodoId)
    setError(null)

    try {
      await api.delete(`/admin/periodos/${periodoId}`)
      setSuccess('Periodo eliminado correctamente')
      cargarPeriodos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar periodo')
    } finally {
      setEliminando(null)
    }
  }

  function getEstadoBadge(estado, periodo) {
    // Mostrar "Generado" si tiene cargos (independientemente del estado en BD)
    if (estado === 'GENERADO' || periodo.totalCuotas > 0) {
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

  // Calcular fecha de vencimiento por defecto
  function calcularFechaVencimiento(anio, mes, dia, mismoMes) {
    // Si vence en el mismo mes: mes-1 (porque mes es 1-12 y Date usa 0-11)
    // Si vence en el mes siguiente: mes (que ya da el siguiente)
    const mesVencimiento = mismoMes ? mes - 1 : mes
    const fecha = new Date(anio, mesVencimiento, dia)
    return fecha.toISOString().split('T')[0]
  }

  useEffect(() => {
    if (formData.anio && formData.mes && diaVencimiento) {
      setFormData(prev => ({
        ...prev,
        fechaVencimiento: calcularFechaVencimiento(prev.anio, prev.mes, diaVencimiento, venceMismoMes)
      }))
    }
  }, [formData.anio, formData.mes, diaVencimiento, venceMismoMes])

  // Generar opciones para el select de periodo hasta
  function generarOpcionesPeriodo() {
    const opciones = []
    const añoActual = new Date().getFullYear()
    // Desde 2024 hasta el año actual + 1
    for (let año = 2024; año <= añoActual + 1; año++) {
      for (let mes = 1; mes <= 12; mes++) {
        opciones.push({
          value: `${año}-${String(mes).padStart(2, '0')}`,
          label: `${MESES[mes - 1]} ${año}`
        })
      }
    }
    return opciones
  }

  // Filtrar periodos hasta el periodo seleccionado
  const periodosFiltrados = periodos.filter(periodo => {
    if (!periodo.anio || !periodo.mes) return true
    const periodoKey = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`
    return periodoKey <= periodoHasta
  })

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Receipt className="w-7 h-7 text-primary" />
            Periodos de Cuota
          </h1>
          <p className="text-gray-600 mt-1">Genera y administra las cuotas mensuales</p>
        </div>
        {tienePermiso(PERMISOS.CUOTAS_GENERAR) && (
          <Button onClick={() => setShowCrearModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Periodo
          </Button>
        )}
      </div>

      {/* Filtro de periodo */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Mostrar hasta:</label>
          <select
            value={periodoHasta}
            onChange={(e) => setPeriodoHasta(e.target.value)}
            className="input-field w-48"
          >
            {generarOpcionesPeriodo().map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {periodosFiltrados.length} de {periodos.length} periodos
          </span>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Listado de periodos */}
      {periodosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay periodos creados</p>
          <p className="text-gray-400 text-sm mt-1">Crea un periodo para comenzar a generar cuotas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periodosFiltrados.map(periodo => (
            <div key={periodo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {/* Header con nombre y estado */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-light">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{periodo.nombre}</h3>
                    <p className="text-xs text-gray-500">
                      Vence: {new Date(periodo.fechaVencimiento).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>
                {getEstadoBadge(periodo.estado, periodo)}
              </div>

              {periodo.totalCuotas > 0 ? (
                <>
                  {/* Stats en grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-800">
                        ${periodo.montoTotal?.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-xs font-medium text-gray-600">{periodo.totalCuotas} cuotas</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-600">
                        ${periodo.montoPagado?.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-gray-500">Cobrado</p>
                      <p className="text-xs font-medium text-green-600">{periodo.cuotasPagadas} cuotas</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-red-600">
                        ${periodo.montoPendiente?.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-gray-500">Pendiente</p>
                      <p className="text-xs font-medium text-red-600">{periodo.cuotasPendientes} cuotas</p>
                    </div>
                  </div>

                  {/* Indicadores de cobranza y mora */}
                  {periodo.totalCuotas > 0 && (
                    <div className="mb-3 flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Cobranza</span>
                          <span className="font-medium text-green-600">
                            {Math.round((periodo.cuotasPagadas / periodo.totalCuotas) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${(periodo.cuotasPagadas / periodo.totalCuotas) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Mora</span>
                          <span className="font-medium text-red-600">
                            {Math.round((periodo.cuotasVencidas / periodo.totalCuotas) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full transition-all"
                            style={{ width: `${(periodo.cuotasVencidas / periodo.totalCuotas) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botones de acción - solo iconos */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/admin/cuotas?periodoId=${periodo.id}`)}
                      className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition"
                      title="Ver Cuotas"
                    >
                      <Receipt className="w-5 h-5" />
                    </button>
                    {tienePermiso(PERMISOS.CUOTAS_GENERAR) && periodo.cuotasPagadas === 0 && (
                      <>
                        <button
                          onClick={() => confirmarGenerarCuotas(periodo.id)}
                          disabled={generando === periodo.id}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
                          title="Regenerar Cuotas"
                        >
                          <RefreshCw className={`w-5 h-5 ${generando === periodo.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => confirmarEliminarPeriodo(periodo)}
                          disabled={eliminando === periodo.id}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                          title="Eliminar Periodo"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* Periodo pendiente - botón generar */
                <div className="flex gap-2">
                  {tienePermiso(PERMISOS.CUOTAS_GENERAR) && (
                    <Button
                      onClick={() => confirmarGenerarCuotas(periodo.id)}
                      loading={generando === periodo.id}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Generar Cuotas
                    </Button>
                  )}
                  {tienePermiso(PERMISOS.CUOTAS_GENERAR) && (
                    <button
                      onClick={() => confirmarEliminarPeriodo(periodo)}
                      disabled={eliminando === periodo.id}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                      title="Eliminar Periodo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Vencimiento
                  <span className="text-gray-400 font-normal ml-1">(calculada automáticamente)</span>
                </label>
                <input
                  type="date"
                  value={formData.fechaVencimiento}
                  onChange={e => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                  className="input-field w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {venceMismoMes
                    ? `Día ${diaVencimiento} del mismo mes del periodo`
                    : `Día ${diaVencimiento} del mes siguiente al periodo`
                  }
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
