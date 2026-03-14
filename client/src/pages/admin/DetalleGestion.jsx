import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  DollarSign,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Edit2,
  Plus,
  FileText,
  TrendingUp,
  Home
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import StatusBadge from '../../components/StatusBadge'
import { PlanPagosModal } from '../../components/PlanPagosModal'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import api from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'
import ChatWidget from '../../components/chat/ChatWidget'

export default function DetalleGestion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()

  const [gestion, setGestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Modal de acción
  const [showAccionModal, setShowAccionModal] = useState(false)
  const [guardandoAccion, setGuardandoAccion] = useState(false)
  const [formAccion, setFormAccion] = useState({
    tipo: '',
    resultado: '',
    contactado: false,
    observaciones: '',
    monto: '',
    promesaPago: '',
    proximaAccion: '',
    fechaProxima: ''
  })

  // Modal de edición
  const [showEditModal, setShowEditModal] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [responsables, setResponsables] = useState([])
  const [formEdit, setFormEdit] = useState({
    estado: '',
    responsableId: '',
    proximaAccion: '',
    fechaProximaAccion: ''
  })

  // Plan de pagos
  const [showPlanPagosModal, setShowPlanPagosModal] = useState(false)

  useEffect(() => {
    cargarGestion()
    cargarResponsables()
  }, [id])

  const cargarResponsables = async () => {
    try {
      const res = await api.get('/admin/admins')
      setResponsables(res.data?.data || [])
    } catch (err) {
      console.error('Error cargando responsables:', err)
    }
  }

  const cargarGestion = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/admin/cobranzas/${id}`)
      setGestion(res.data?.data || null)
    } catch (err) {
      console.error('Error cargando gestión:', err)
      setError('Error al cargar los datos de la gestión')
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarAccion = async (e) => {
    e.preventDefault()

    if (!formAccion.tipo || !formAccion.resultado) {
      setError('Debe completar tipo y resultado de la acción')
      return
    }

    try {
      setGuardandoAccion(true)
      setError(null)

      const payload = {
        tipo: formAccion.tipo,
        resultado: formAccion.resultado,
        contactado: formAccion.contactado,
        observaciones: formAccion.observaciones || null,
        monto: formAccion.monto ? parseFloat(formAccion.monto) : null,
        promesaPago: formAccion.promesaPago || null,
        proximaAccion: formAccion.proximaAccion || null,
        fechaProxima: formAccion.fechaProxima || null
      }

      await api.post(`/admin/cobranzas/${id}/acciones`, payload)

      setSuccess('Acción registrada correctamente')
      setShowAccionModal(false)
      setFormAccion({
        tipo: '',
        resultado: '',
        contactado: false,
        observaciones: '',
        monto: '',
        promesaPago: '',
        proximaAccion: '',
        fechaProxima: ''
      })

      await cargarGestion()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error registrando acción:', err)
      setError(err.response?.data?.message || 'Error al registrar la acción')
    } finally {
      setGuardandoAccion(false)
    }
  }

  const handleEditarGestion = async (e) => {
    e.preventDefault()

    try {
      setGuardandoEdicion(true)
      setError(null)

      const payload = {
        estado: formEdit.estado || gestion.estado,
        responsableId: formEdit.responsableId ? parseInt(formEdit.responsableId) : gestion.responsableId,
        proximaAccion: formEdit.proximaAccion || gestion.proximaAccion,
        fechaProximaAccion: formEdit.fechaProximaAccion || gestion.fechaProximaAccion
      }

      await api.put(`/admin/cobranzas/${id}`, payload)

      setSuccess('Gestión actualizada correctamente')
      setShowEditModal(false)

      await cargarGestion()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error actualizando gestión:', err)
      setError(err.response?.data?.message || 'Error al actualizar la gestión')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const abrirEditModal = () => {
    setFormEdit({
      estado: gestion.estado,
      responsableId: gestion.responsableId || '',
      proximaAccion: gestion.proximaAccion || '',
      fechaProximaAccion: gestion.fechaProximaAccion ? gestion.fechaProximaAccion.split('T')[0] : ''
    })
    setShowEditModal(true)
  }

  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'CRITICA':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'ALTA':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'MEDIA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'BAJA':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getEstadoConfig = (estado) => {
    switch (estado) {
      case 'PENDIENTE':
        return { variant: 'warning', label: 'Pendiente' }
      case 'EN_GESTION':
        return { variant: 'info', label: 'En Gestión' }
      case 'PROMESA_PAGO':
        return { variant: 'primary', label: 'Promesa Pago' }
      case 'NO_CONTACTADO':
        return { variant: 'danger', label: 'No Contactado' }
      case 'RESUELTO':
        return { variant: 'success', label: 'Resuelto' }
      default:
        return { variant: 'secondary', label: estado }
    }
  }

  const getTipoAccionIcon = (tipo) => {
    switch (tipo) {
      case 'LLAMADA':
        return <Phone className="w-4 h-4" />
      case 'EMAIL':
        return <Mail className="w-4 h-4" />
      case 'WHATSAPP':
        return <MessageSquare className="w-4 h-4" />
      case 'VISITA':
        return <Home className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        <p className="ml-3 text-gray-600">Cargando gestión...</p>
      </div>
    )
  }

  if (error && !gestion) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/admin/cobranzas')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al listado
        </Button>
      </div>
    )
  }

  if (!gestion) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Alert variant="warning" className="mb-4">
          No se encontró la gestión
        </Alert>
        <Button variant="secondary" onClick={() => navigate('/admin/cobranzas')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al listado
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/cobranzas')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al listado
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Gestión de Cobranza #{gestion.id}
            </h1>
            <p className="text-gray-600">
              {gestion.socio?.apellidoNombre} - Nro: {gestion.socio?.nroSocio}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={abrirEditModal}>
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAccionModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Acción
            </Button>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="danger" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resumen de Gestión */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Resumen de Gestión
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Estado</p>
                <StatusBadge {...getEstadoConfig(gestion.estado)} />
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Prioridad</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPrioridadColor(gestion.prioridad)}`}>
                  {gestion.prioridad}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Deuda Total</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(gestion.montoDeuda)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Cuotas Adeudadas</p>
                <p className="text-xl font-bold text-gray-900">
                  {gestion.cuotasAdeudadas}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Días de Atraso</p>
                <p className={`text-xl font-bold ${
                  gestion.diasAtraso > 90 ? 'text-red-600' :
                  gestion.diasAtraso > 60 ? 'text-orange-600' :
                  gestion.diasAtraso > 30 ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {gestion.diasAtraso} días
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Acciones Registradas</p>
                <p className="text-xl font-bold text-gray-900">
                  {gestion.acciones?.length || 0}
                </p>
              </div>
            </div>

            {gestion.proximaAccion && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Próxima Acción Programada</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{gestion.proximaAccion}</span>
                  {gestion.fechaProximaAccion && (
                    <span className="text-sm text-gray-500">
                      - {formatDate(gestion.fechaProximaAccion)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {gestion.responsable && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Responsable Asignado</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {gestion.responsable.nombre} {gestion.responsable.apellido}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Cargos Pendientes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Cuotas Vencidas ({gestion.socio?.cargos?.length || 0})
              </h2>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPlanPagosModal(true)}
                disabled={!gestion.socio?.cargos || gestion.socio.cargos.length === 0}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Crear Plan de Pagos
              </Button>
            </div>

            {gestion.socio?.cargos && gestion.socio.cargos.length > 0 ? (
              <div className="space-y-2">
                {gestion.socio.cargos.map((cargo) => (
                  <div
                    key={cargo.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{cargo.descripcion}</p>
                      <p className="text-sm text-gray-600">
                        Vencimiento: {formatDate(cargo.fechaVencimiento)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {formatCurrency(cargo.montoTotal)}
                      </p>
                      <StatusBadge variant="danger" label={cargo.estado} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">
                No hay cargos pendientes
              </p>
            )}
          </div>

          {/* Historial de Acciones */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Historial de Acciones
            </h2>

            {gestion.acciones && gestion.acciones.length > 0 ? (
              <div className="space-y-4">
                {gestion.acciones.map((accion) => (
                  <div
                    key={accion.id}
                    className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getTipoAccionIcon(accion.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {accion.tipo.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {accion.responsable?.nombre} {accion.responsable?.apellido}
                          </p>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDateTime(accion.fecha)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Resultado:</span>
                          <StatusBadge
                            variant={
                              accion.resultado === 'PAGO_REALIZADO' ? 'success' :
                              accion.resultado === 'PROMESA_PAGO' ? 'primary' :
                              accion.resultado === 'SIN_RESPUESTA' ? 'danger' :
                              'secondary'
                            }
                            label={accion.resultado.replace('_', ' ')}
                          />
                          {accion.contactado && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>

                        {accion.observaciones && (
                          <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                            {accion.observaciones}
                          </p>
                        )}

                        {accion.monto && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Monto:</span> {formatCurrency(accion.monto)}
                          </p>
                        )}

                        {accion.promesaPago && (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Promesa de pago:</span> {formatDate(accion.promesaPago)}
                          </p>
                        )}

                        {accion.proximaAccion && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <TrendingUp className="w-4 h-4" />
                            <span className="font-medium">Próxima acción:</span>
                            <span>{accion.proximaAccion}</span>
                            {accion.fechaProxima && (
                              <span className="text-gray-500">
                                ({formatDate(accion.fechaProxima)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No hay acciones registradas aún</p>
                <p className="text-sm mt-1">
                  Comienza registrando la primera acción de cobranza
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Columna Lateral - Datos del Socio */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Datos del Socio
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Nombre Completo</p>
                <p className="font-medium text-gray-900">
                  {gestion.socio?.apellidoNombre}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Nro de Socio</p>
                <p className="font-medium text-gray-900">
                  {gestion.socio?.nroSocio}
                </p>
              </div>

              {gestion.socio?.email && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a
                      href={`mailto:${gestion.socio.email}`}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      {gestion.socio.email}
                    </a>
                  </div>
                </div>
              )}

              {gestion.socio?.celular && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Celular</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a
                      href={`tel:${gestion.socio.celular}`}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      {gestion.socio.celular}
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/admin/socios/${gestion.socio?.id}`)}
                >
                  Ver Ficha Completa
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Registrar Acción */}
      <Modal
        isOpen={showAccionModal}
        onClose={() => setShowAccionModal(false)}
        title="Registrar Acción de Cobranza"
        size="lg"
      >
        <form onSubmit={handleRegistrarAccion}>
          <div className="space-y-4">
            {/* Tipo de Acción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Acción *
              </label>
              <select
                value={formAccion.tipo}
                onChange={(e) => setFormAccion({ ...formAccion, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar...</option>
                <option value="LLAMADA">Llamada</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="VISITA">Visita</option>
                <option value="CARTA">Carta</option>
              </select>
            </div>

            {/* Resultado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resultado *
              </label>
              <select
                value={formAccion.resultado}
                onChange={(e) => setFormAccion({ ...formAccion, resultado: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar...</option>
                <option value="PROMESA_PAGO">Promesa de Pago</option>
                <option value="PAGO_REALIZADO">Pago Realizado</option>
                <option value="SIN_RESPUESTA">Sin Respuesta</option>
                <option value="NO_CONTESTA">No Contesta</option>
                <option value="NUMERO_INVALIDO">Número Inválido</option>
                <option value="SE_COMPROMETE">Se Compromete a Pagar</option>
                <option value="REFINANCIACION">Solicita Refinanciación</option>
              </select>
            </div>

            {/* Contactado */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="contactado"
                checked={formAccion.contactado}
                onChange={(e) => setFormAccion({ ...formAccion, contactado: e.target.checked })}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="contactado" className="ml-2 text-sm text-gray-700">
                Se contactó con el socio
              </label>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones
              </label>
              <textarea
                value={formAccion.observaciones}
                onChange={(e) => setFormAccion({ ...formAccion, observaciones: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Detalles de la conversación, acuerdos, etc."
              />
            </div>

            {/* Monto (si pagó) */}
            {formAccion.resultado === 'PAGO_REALIZADO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto Pagado
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formAccion.monto}
                  onChange={(e) => setFormAccion({ ...formAccion, monto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Promesa de pago */}
            {formAccion.resultado === 'PROMESA_PAGO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Promesa de Pago
                </label>
                <input
                  type="date"
                  value={formAccion.promesaPago}
                  onChange={(e) => setFormAccion({ ...formAccion, promesaPago: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Próxima Acción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Próxima Acción
              </label>
              <input
                type="text"
                value={formAccion.proximaAccion}
                onChange={(e) => setFormAccion({ ...formAccion, proximaAccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ej: Volver a llamar, Enviar email, etc."
              />
            </div>

            {/* Fecha Próxima */}
            {formAccion.proximaAccion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Próxima Acción
                </label>
                <input
                  type="date"
                  value={formAccion.fechaProxima}
                  onChange={(e) => setFormAccion({ ...formAccion, fechaProxima: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAccionModal(false)}
              disabled={guardandoAccion}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={guardandoAccion}>
              {guardandoAccion ? 'Guardando...' : 'Registrar Acción'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Editar Gestión */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Gestión"
      >
        <form onSubmit={handleEditarGestion}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={formEdit.estado}
                onChange={(e) => setFormEdit({ ...formEdit, estado: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_GESTION">En Gestión</option>
                <option value="PROMESA_PAGO">Promesa Pago</option>
                <option value="NO_CONTACTADO">No Contactado</option>
                <option value="RESUELTO">Resuelto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsable
              </label>
              <select
                value={formEdit.responsableId}
                onChange={(e) => setFormEdit({ ...formEdit, responsableId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Sin asignar</option>
                {responsables.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} {r.apellido}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Próxima Acción
              </label>
              <input
                type="text"
                value={formEdit.proximaAccion}
                onChange={(e) => setFormEdit({ ...formEdit, proximaAccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Próxima Acción
              </label>
              <input
                type="date"
                value={formEdit.fechaProximaAccion}
                onChange={(e) => setFormEdit({ ...formEdit, fechaProximaAccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={guardandoEdicion}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={guardandoEdicion}>
              {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Plan de Pagos */}
      {showPlanPagosModal && gestion.socio && (
        <PlanPagosModal
          isOpen={showPlanPagosModal}
          onClose={() => {
            setShowPlanPagosModal(false)
            cargarGestion()
          }}
          socioId={gestion.socio.id}
          cargos={gestion.socio.cargos || []}
        />
      )}

      <ConfirmDialog />
      <ChatWidget />
    </div>
  )
}
