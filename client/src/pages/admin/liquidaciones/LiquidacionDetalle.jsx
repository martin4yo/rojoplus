import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, User, CheckCircle, Clock, CreditCard, Wallet, Plus, Trash2, XCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PARCIAL: { label: 'Parcial', color: 'bg-blue-100 text-blue-700', icon: Clock },
  PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  ANULADO: { label: 'Anulado', color: 'bg-red-100 text-red-700', icon: XCircle }
}

const MEDIOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' }
]

export default function LiquidacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [liquidacion, setLiquidacion] = useState(null)
  const [cajas, setCajas] = useState([])
  const [conceptosDisponibles, setConceptosDisponibles] = useState([])

  // Estado para pago individual
  const [pagando, setPagando] = useState(null) // ID del item que se esta pagando
  const [cajaId, setCajaId] = useState('')
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA')
  const [nroOperacion, setNroOperacion] = useState('')

  // Estado para seleccion multiple
  const [itemsSeleccionados, setItemsSeleccionados] = useState([])

  // Estado para edicion de conceptos
  const [editando, setEditando] = useState(null) // ID del item que se esta editando

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [liqRes, cajasRes, conceptosRes] = await Promise.all([
        api.getFull(`/admin/liquidaciones/${id}`),
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conceptos-liquidacion?activo=true')
      ])
      setLiquidacion(liqRes)
      const cajasArray = cajasRes.data || cajasRes || []
      const conceptosArray = conceptosRes.data || conceptosRes || []
      setCajas(cajasArray)
      setConceptosDisponibles(conceptosArray)
      if (cajasArray.length > 0) {
        setCajaId(cajasArray[0].id.toString())
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      showModal({
        type: 'error',
        message: 'Error al cargar la liquidacion',
        onConfirm: () => navigate('/admin/liquidaciones')
      })
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

  async function handlePagarItem(itemId) {
    if (!cajaId) {
      showModal({ type: 'warning', message: 'Debe seleccionar una caja' })
      return
    }

    setPagando(itemId)
    try {
      await api.post(`/admin/liquidaciones/${id}/pagar`, {
        itemId,
        cajaId: parseInt(cajaId),
        medioPago,
        nroOperacion: nroOperacion || null
      })

      showModal({
        type: 'success',
        message: 'Pago registrado correctamente'
      })

      // Recargar datos
      await cargarDatos()
    } catch (err) {
      showModal({
        type: 'error',
        message: err.message || 'Error al registrar el pago'
      })
    } finally {
      setPagando(null)
    }
  }

  function toggleSeleccion(itemId) {
    setItemsSeleccionados(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  function toggleSeleccionarTodos() {
    const pendientes = liquidacion.items.filter(i => i.estado === 'PENDIENTE')
    if (itemsSeleccionados.length === pendientes.length) {
      setItemsSeleccionados([])
    } else {
      setItemsSeleccionados(pendientes.map(i => i.id))
    }
  }

  async function handlePagarSeleccionados() {
    if (!cajaId) {
      showModal({ type: 'warning', message: 'Debe seleccionar una caja' })
      return
    }

    if (itemsSeleccionados.length === 0) {
      showModal({ type: 'warning', message: 'Debe seleccionar al menos un empleado para pagar' })
      return
    }

    const itemsAPagar = liquidacion.items.filter(i => itemsSeleccionados.includes(i.id))
    const totalAPagar = itemsAPagar.reduce((sum, i) => sum + parseFloat(i.netoAPagar), 0)

    showModal({
      type: 'confirm',
      title: 'Pago Masivo',
      message: `Se pagaran ${itemsAPagar.length} empleados seleccionados por un total de ${formatMonto(totalAPagar)}. ¿Desea continuar?`,
      onConfirm: async () => {
        setPagando('selected')
        try {
          // Pagar cada item seleccionado
          for (const itemId of itemsSeleccionados) {
            await api.post(`/admin/liquidaciones/${id}/pagar`, {
              itemId,
              cajaId: parseInt(cajaId),
              medioPago,
              nroOperacion: nroOperacion || null
            })
          }

          showModal({
            type: 'success',
            message: `Se pagaron ${itemsSeleccionados.length} empleados correctamente`
          })

          setItemsSeleccionados([])
          await cargarDatos()
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al registrar los pagos'
          })
        } finally {
          setPagando(null)
        }
      }
    })
  }

  async function handleAnular() {
    showModal({
      type: 'confirm',
      title: 'Anular Liquidacion',
      message: '¿Esta seguro que desea anular esta liquidacion? Esta accion no se puede deshacer.',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/liquidaciones/${id}`)
          showModal({
            type: 'success',
            message: 'Liquidacion anulada correctamente',
            onConfirm: () => navigate('/admin/liquidaciones')
          })
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al anular la liquidacion'
          })
        }
      }
    })
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!liquidacion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Liquidacion no encontrada</p>
        <Button variant="secondary" onClick={() => navigate('/admin/liquidaciones')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const estadoInfo = ESTADOS[liquidacion.estado] || ESTADOS.PENDIENTE
  const EstadoIcon = estadoInfo.icon
  const itemsPendientes = liquidacion.items.filter(i => i.estado === 'PENDIENTE')
  const itemsPagados = liquidacion.items.filter(i => i.estado === 'PAGADO')

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/liquidaciones')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Liquidacion {liquidacion.periodo}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-mono">{liquidacion.numero}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                  <EstadoIcon className="w-3 h-3" />
                  {estadoInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {liquidacion.estado === 'PENDIENTE' && (
          <Button variant="secondary" onClick={handleAnular}>
            <XCircle className="w-4 h-4 mr-2" />
            Anular
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Resumen */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Empleados</p>
          <p className="text-2xl font-bold text-gray-800">{liquidacion.items.length}</p>
          <p className="text-xs text-gray-500">
            {itemsPagados.length} pagados / {itemsPendientes.length} pendientes
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Bruto</p>
          <p className="text-2xl font-bold text-gray-800">{formatMonto(liquidacion.totalBruto)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Deducciones</p>
          <p className="text-2xl font-bold text-red-600">-{formatMonto(liquidacion.totalDeducciones)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Neto a Pagar</p>
          <p className="text-2xl font-bold text-green-600">{formatMonto(liquidacion.totalNeto)}</p>
        </div>
      </div>

      {/* Panel de pago */}
      {itemsPendientes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            Registrar Pagos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caja *
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={cajaId}
                  onChange={(e) => setCajaId(e.target.value)}
                  className="input-field w-full pl-10"
                >
                  <option value="">Seleccionar caja...</option>
                  {cajas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({formatMonto(c.saldoActual)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medio de Pago
              </label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="input-field w-full"
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nro. Operacion
              </label>
              <input
                type="text"
                value={nroOperacion}
                onChange={(e) => setNroOperacion(e.target.value)}
                placeholder="Ref. transferencia..."
                className="input-field w-full"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePagarSeleccionados}
                disabled={pagando || !cajaId || itemsSeleccionados.length === 0}
                className="w-full"
              >
                {pagando === 'selected' ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Pagando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Pago Masivo ({itemsSeleccionados.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            {itemsSeleccionados.length > 0 ? (
              <>
                Seleccionados: <span className="font-bold text-purple-600">{itemsSeleccionados.length}</span> empleados
                {' - '}
                Total: <span className="font-bold text-purple-600">
                  {formatMonto(liquidacion.items.filter(i => itemsSeleccionados.includes(i.id)).reduce((sum, i) => sum + parseFloat(i.netoAPagar), 0))}
                </span>
              </>
            ) : (
              <>
                Total pendiente: <span className="font-bold text-purple-600">
                  {formatMonto(itemsPendientes.reduce((sum, i) => sum + parseFloat(i.netoAPagar), 0))}
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Lista de empleados */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Detalle por Empleado</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {itemsPendientes.length > 0 && (
                  <th className="text-center py-3 px-4 font-medium text-gray-600 w-12">
                    <input
                      type="checkbox"
                      checked={itemsSeleccionados.length === itemsPendientes.length && itemsPendientes.length > 0}
                      onChange={toggleSeleccionarTodos}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-left py-3 px-4 font-medium text-gray-600">Empleado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Sueldo Base</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Haberes</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Deducciones</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Neto</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {liquidacion.items.map((item) => {
                const itemEstado = ESTADOS[item.estado] || ESTADOS.PENDIENTE
                const ItemEstadoIcon = itemEstado.icon

                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {itemsPendientes.length > 0 && (
                      <td className="py-3 px-4 text-center">
                        {item.estado === 'PENDIENTE' && (
                          <input
                            type="checkbox"
                            checked={itemsSeleccionados.includes(item.id)}
                            onChange={() => toggleSeleccion(item.id)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                          />
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{item.entidad?.razonSocial}</p>
                          <p className="text-xs text-gray-500">
                            {item.entidad?.cargoPersonal?.nombre || 'Sin cargo'} - Legajo: {item.entidad?.legajo || '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatMonto(item.sueldoBasico)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      +{formatMonto(item.totalHaberes)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                      -{formatMonto(item.totalDeducciones)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-purple-600">
                        {formatMonto(item.netoAPagar)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${itemEstado.color}`}>
                        <ItemEstadoIcon className="w-3 h-3" />
                        {itemEstado.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.estado === 'PENDIENTE' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handlePagarItem(item.id)}
                          disabled={pagando === item.id || !cajaId}
                        >
                          {pagando === item.id ? (
                            <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                          ) : (
                            'Pagar'
                          )}
                        </Button>
                      )}
                      {item.estado === 'PAGADO' && item.fechaPago && (
                        <span className="text-xs text-gray-500">
                          {formatFecha(item.fechaPago)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observaciones */}
      {liquidacion.observaciones && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">Observaciones:</p>
          <p>{liquidacion.observaciones}</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p>Generada: {formatFecha(liquidacion.fechaGeneracion)}</p>
        {liquidacion.fechaPago && (
          <p>Fecha de pago completo: {formatFecha(liquidacion.fechaPago)}</p>
        )}
      </div>
    </div>
  )
}
