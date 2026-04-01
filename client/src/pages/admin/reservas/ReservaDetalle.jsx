import { useState, useEffect } from 'react'
import {
  X, Calendar, Clock, MapPin, User, Phone, Mail, CreditCard,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, UserX, Repeat
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useConfirm } from '../../../hooks/useConfirm'

const ESTADO_COLORS = {
  CONFIRMADA:     'bg-green-100 text-green-800',
  PENDIENTE_PAGO: 'bg-yellow-100 text-yellow-800',
  CANCELADA:      'bg-red-100 text-red-800',
  COMPLETADA:     'bg-blue-100 text-blue-800',
  NO_SHOW:        'bg-gray-100 text-gray-600',
}
const ESTADO_LABELS = {
  CONFIRMADA:     'Confirmada',
  PENDIENTE_PAGO: 'Pendiente de Pago',
  CANCELADA:      'Cancelada',
  COMPLETADA:     'Completada',
  NO_SHOW:        'No Show',
}

export default function ReservaDetalle({ reservaId, onClose }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [reserva, setReserva] = useState(null)
  const [accionando, setAccionando] = useState(false)

  useEffect(() => {
    cargarReserva()
  }, [reservaId])

  async function cargarReserva() {
    setLoading(true)
    try {
      const data = await api.get(`/reservas/admin/${reservaId}`)
      setReserva(data)
    } catch {
      toast.error('Error al cargar la reserva')
    } finally {
      setLoading(false)
    }
  }

  async function confirmar() {
    const ok = await confirm('¿Confirmar el pago de esta reserva?')
    if (!ok) return
    setAccionando(true)
    try {
      await api.patch(`/reservas/admin/${reservaId}/confirmar`, { metodoPago: 'EFECTIVO' })
      toast.success('Reserva confirmada')
      cargarReserva()
    } catch (e) {
      toast.error(e.message || 'Error al confirmar')
    } finally {
      setAccionando(false)
    }
  }

  async function cancelar() {
    const tieneGrupo = !!reserva?.grupoRecurrenciaId

    let cancelarGrupo = false
    if (tieneGrupo) {
      cancelarGrupo = await confirm(
        '¿Cancelar solo esta reserva o todas las futuras del grupo recurrente?',
        { confirmText: 'Cancelar grupo', cancelText: 'Solo esta' }
      )
    } else {
      const ok = await confirm('¿Cancelar esta reserva?')
      if (!ok) return
    }

    setAccionando(true)
    try {
      await api.patch(`/reservas/admin/${reservaId}/cancelar`, {
        motivo: 'Cancelado por administrador',
        cancelarGrupo,
      })
      toast.success('Reserva cancelada')
      cargarReserva()
    } catch (e) {
      toast.error(e.message || 'Error al cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function marcarNoShow() {
    const ok = await confirm('¿Marcar esta reserva como No Show?')
    if (!ok) return
    setAccionando(true)
    try {
      await api.patch(`/reservas/admin/${reservaId}/no-show`)
      toast.success('Marcada como No Show')
      cargarReserva()
    } catch (e) {
      toast.error(e.message || 'Error al actualizar')
    } finally {
      setAccionando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <ConfirmDialog />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detalle de Reserva</h2>
            {reserva && (
              <p className="text-sm text-gray-500 font-mono mt-0.5">{reserva.codigo}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : !reserva ? (
          <div className="py-12 text-center text-gray-400">No se encontró la reserva</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Estado */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${ESTADO_COLORS[reserva.estado]}`}>
                {ESTADO_LABELS[reserva.estado]}
              </span>
              {reserva.esRecurrente && (
                <span className="flex items-center gap-1 text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                  <Repeat size={11} /> Recurrente
                </span>
              )}
              {reserva.creadaPorAdmin && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Manual admin</span>
              )}
            </div>

            {/* Espacio y horario */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={15} className="text-primary shrink-0" />
                <span className="font-semibold text-gray-800">{reserva.espacio?.nombre}</span>
                {reserva.espacio?.tipo && <span className="text-gray-500">· {reserva.espacio.tipo}</span>}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={15} className="text-gray-400 shrink-0" />
                <span className="text-gray-700">{formatDate(reserva.fecha)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={15} className="text-gray-400 shrink-0" />
                <span className="text-gray-700">{reserva.horaInicio} – {reserva.horaFin}</span>
                <span className="text-gray-400">({reserva.duracionMin} min)</span>
              </div>
            </div>

            {/* Reservante */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reservante</h3>
              <div className="flex items-center gap-2 text-sm">
                <User size={15} className="text-gray-400 shrink-0" />
                <span className="font-medium text-gray-800">{reserva.nombreReserva} {reserva.apellido}</span>
                {reserva.esSocio && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Socio</span>
                )}
              </div>
              {reserva.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-600">{reserva.email}</span>
                </div>
              )}
              {reserva.telefono && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-600">{reserva.telefono}</span>
                </div>
              )}
              {reserva.dni && (
                <div className="text-sm text-gray-500">DNI: {reserva.dni}</div>
              )}
            </div>

            {/* Pago */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard size={15} className="text-gray-400 shrink-0" />
                  <span className="text-gray-600">{reserva.metodoPago || '–'}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(reserva.precioTotal)}</div>
                  {parseFloat(reserva.descuentoAplicado) > 0 && (
                    <div className="text-xs text-green-600">Descuento: {formatCurrency(reserva.descuentoAplicado)}</div>
                  )}
                </div>
              </div>
              {reserva.paymentIdMP && (
                <div className="text-xs text-gray-400">MP ID: {reserva.paymentIdMP}</div>
              )}
            </div>

            {/* Observaciones */}
            {reserva.observaciones && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                {reserva.observaciones}
              </div>
            )}

            {/* Cancelación */}
            {reserva.estado === 'CANCELADA' && reserva.motivoCancelacion && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-red-700 uppercase">Cancelación</div>
                <div className="text-sm text-red-600">{reserva.motivoCancelacion}</div>
                {reserva.canceladoPor && (
                  <div className="text-xs text-red-400">Por: {reserva.canceladoPor}</div>
                )}
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {reserva.estado === 'PENDIENTE_PAGO' && (
                <button
                  onClick={confirmar}
                  disabled={accionando}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
                >
                  <CheckCircle size={15} /> Confirmar Pago
                </button>
              )}
              {reserva.estado === 'CONFIRMADA' && (
                <button
                  onClick={marcarNoShow}
                  disabled={accionando}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50"
                >
                  <UserX size={15} /> No Show
                </button>
              )}
              {['CONFIRMADA', 'PENDIENTE_PAGO'].includes(reserva.estado) && (
                <button
                  onClick={cancelar}
                  disabled={accionando}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium disabled:opacity-50"
                >
                  <XCircle size={15} /> Cancelar
                </button>
              )}
              <button
                onClick={onClose}
                className="ml-auto px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
