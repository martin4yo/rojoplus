import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  MessageSquare,
  Send,
  Users,
  TrendingUp,
  Plus,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3,
  Eye,
  Loader2,
  Search,
  Trash2
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal, { useModal } from '../../components/Modal'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { formatDate, formatDateTime } from '../../utils/formatters'
import usePagination from '../../hooks/usePagination'
import api from '../../services/api'
import { AxioChat } from '@axio/chat'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function GestionComunicaciones() {
  const navigate = useNavigate()
  const { page, pagination, setPagination, goToPage } = usePagination()
  const { showModal, ModalComponent } = useModal()

  const [campanas, setCampanas] = useState([])
  const [templates, setTemplates] = useState([])
  const [actividades, setActividades] = useState([])
  const [categoriasActividad, setCategoriasActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [enviandoCampana, setEnviandoCampana] = useState(null)
  const [reenviandoCampana, setReenviandoCampana] = useState(null)
  const [modalReenvio, setModalReenvio] = useState(null) // campana o null

  // Modal destinatarios
  const [destinatariosModal, setDestinatariosModal] = useState({ open: false, lista: [], total: 0, loading: false, titulo: '' })
  const [destinatariosBusqueda, setDestinatariosBusqueda] = useState('')

  // Filtros
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')

  // Modal nueva campaña
  const [showNuevaCampanaModal, setShowNuevaCampanaModal] = useState(false)
  const [guardandoCampana, setGuardandoCampana] = useState(false)
  const [formCampana, setFormCampana] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'INFORMATIVA',
    canales: ['email'],
    emailTemplateId: '',
    whatsappTemplate: '',
    smsTemplate: '',
    segmentacion: {
      estado: ['ACTIVO', 'VIGENTE'],
      actividadId: '',
      categoriaActividadId: '',
      edadMin: '',
      edadMax: '',
      deudores: null,
      nrosSocio: ''
    },
    fechaProgramada: ''
  })

  useEffect(() => {
    cargarCampanas()
    cargarTemplates()
    api.getFull('/admin/actividades?limit=100').then(r => setActividades((r?.data || r || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }))))
  }, [page, tipo, estado])

  const cargarTemplates = async () => {
    try {
      const res = await api.getFull('/admin/templates/email')
      setTemplates(res?.data || res || [])
    } catch (err) {
      console.error('Error cargando templates:', err)
    }
  }

  const handleActividadChange = async (actividadId) => {
    setFormCampana(prev => ({
      ...prev,
      segmentacion: { ...prev.segmentacion, actividadId, categoriaActividadId: '' }
    }))
    if (actividadId) {
      const cats = await api.getFull(`/admin/categorias-actividad?actividadId=${actividadId}&limit=100`)
      setCategoriasActividad((cats?.data || cats || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })))
    } else {
      setCategoriasActividad([])
    }
  }

  const abrirDestinatariosCampana = async (campana) => {
    setDestinatariosBusqueda('')
    setDestinatariosModal({ open: true, lista: [], total: 0, loading: true, titulo: campana.nombre })
    try {
      const res = await api.getFull(`/admin/comunicaciones/campanas/${campana.id}/destinatarios`)
      setDestinatariosModal({ open: true, lista: res.data || [], total: res.total || 0, loading: false, titulo: campana.nombre })
    } catch {
      setDestinatariosModal(prev => ({ ...prev, loading: false }))
    }
  }

  const previsualizarDestinatarios = async () => {
    if (!formCampana.segmentacion) return
    setDestinatariosBusqueda('')
    setDestinatariosModal({ open: true, lista: [], total: 0, loading: true, titulo: 'Previsualización de destinatarios' })
    try {
      const res = await api.postFull('/admin/comunicaciones/previsualizar-destinatarios', {
        segmentacion: formCampana.segmentacion,
        canales: formCampana.canales
      })
      setDestinatariosModal({ open: true, lista: res.data || [], total: res.total || 0, loading: false, titulo: 'Previsualización de destinatarios' })
    } catch {
      setDestinatariosModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleReenviar = async (campana, modo) => {
    setReenviandoCampana(campana.id)
    setModalReenvio(null)
    try {
      const res = await api.postFull(`/admin/comunicaciones/campanas/${campana.id}/reenviar`, { modo })
      setSuccess(res?.message || 'Reenvío completado')
      await cargarCampanas()
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err.message || 'Error al reenviar')
    } finally {
      setReenviandoCampana(null)
    }
  }

  const handleDuplicar = async (campana) => {
    try {
      const res = await api.postFull(`/admin/comunicaciones/campanas/${campana.id}/duplicar`, {})
      setSuccess(`Campaña duplicada: "${res.data?.nombre || ''}"`)
      await cargarCampanas()
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err.message || 'Error al duplicar')
    }
  }

  const handleEliminarCampana = (campana) => {
    showModal({
      type: 'warning',
      title: 'Eliminar campaña',
      message: `¿Seguro que querés eliminar la campaña "${campana.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/comunicaciones/campanas/${campana.id}`)
          setSuccess('Campaña eliminada')
          await cargarCampanas()
          setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
          setError(err.message || 'Error al eliminar la campaña')
        }
      }
    })
  }

  const handleEnviarCampana = async (campanaId) => {
    setEnviandoCampana(campanaId)
    try {
      const res = await api.postFull(`/admin/comunicaciones/campanas/${campanaId}/enviar`, {})
      setSuccess(res?.message || 'Campaña enviada correctamente')
      await cargarCampanas()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviandoCampana(null)
    }
  }

  const cargarCampanas = async () => {
    try {
      setLoading(true)
      setError(null)

      const qs = new URLSearchParams({ page, limit: 10 })
      if (tipo) qs.append('tipo', tipo)
      if (estado) qs.append('estado', estado)

      const res = await api.getFull(`/admin/comunicaciones/campanas?${qs}`)
      const data = res.data || []
      const pag = res.pagination

      setCampanas(data)
      if (pag) {
        setPagination(pag)
      }
    } catch (err) {
      console.error('Error cargando campañas:', err)
      setError('Error al cargar las campañas de comunicación')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearCampana = async (e) => {
    e.preventDefault()

    if (!formCampana.nombre || !formCampana.tipo) {
      setError('Debe completar nombre y tipo de campaña')
      return
    }

    if (formCampana.canales.includes('email') && !formCampana.emailTemplateId) {
      setError('Debe seleccionar un template de email')
      return
    }

    try {
      setGuardandoCampana(true)
      setError(null)

      const payload = {
        ...formCampana,
        canales: JSON.stringify(formCampana.canales),
        segmentacion: JSON.stringify(formCampana.segmentacion)
      }

      await api.post('/admin/comunicaciones/campanas', payload)

      setSuccess('Campaña creada correctamente')
      setShowNuevaCampanaModal(false)
      setFormCampana({
        nombre: '',
        descripcion: '',
        tipo: 'INFORMATIVA',
        canales: ['email'],
        emailTemplateId: '',
        whatsappTemplate: '',
        smsTemplate: '',
        segmentacion: {
          estado: ['ACTIVO', 'VIGENTE'],
          actividadId: '',
          categoriaActividadId: '',
          edadMin: '',
          edadMax: '',
          deudores: null,
          nrosSocio: ''
        },
        fechaProgramada: ''
      })

      await cargarCampanas()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error creando campaña:', err)
      setError(err.response?.data?.message || 'Error al crear la campaña')
    } finally {
      setGuardandoCampana(false)
    }
  }

  const handleToggleCanal = (canal) => {
    const canales = formCampana.canales.includes(canal)
      ? formCampana.canales.filter(c => c !== canal)
      : [...formCampana.canales, canal]

    setFormCampana({ ...formCampana, canales })
  }

  const getEstadoCampanaConfig = (estado) => {
    switch (estado) {
      case 'BORRADOR':
        return { variant: 'secondary', label: 'Borrador', icon: Clock }
      case 'PROGRAMADA':
        return { variant: 'info', label: 'Programada', icon: Calendar }
      case 'EN_CURSO':
        return { variant: 'warning', label: 'En Curso', icon: Send }
      case 'COMPLETADA':
        return { variant: 'success', label: 'Completada', icon: CheckCircle }
      case 'CANCELADA':
        return { variant: 'danger', label: 'Cancelada', icon: XCircle }
      default:
        return { variant: 'secondary', label: estado, icon: Clock }
    }
  }

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'INFORMATIVA':
        return <Mail className="w-5 h-5 text-blue-500" />
      case 'PROMOCIONAL':
        return <TrendingUp className="w-5 h-5 text-green-500" />
      case 'RECORDATORIO':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <Mail className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Mail className="w-7 h-7 text-primary" />
              Campañas de Comunicación
            </h1>
            <p className="text-gray-600 mt-1">
              Gestión de comunicaciones masivas con socios
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowNuevaCampanaModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="INFORMATIVA">Informativa</option>
              <option value="PROMOCIONAL">Promocional</option>
              <option value="RECORDATORIO">Recordatorio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="PROGRAMADA">Programada</option>
              <option value="EN_CURSO">En Curso</option>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          {(tipo || estado) && (
            <div className="flex items-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTipo('')
                  setEstado('')
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
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

      {/* Lista de Campañas */}
      <div className="space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : campanas.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <Send className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">No se encontraron campañas</p>
            <p className="text-sm mt-1">
              Crea tu primera campaña de comunicación
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => setShowNuevaCampanaModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Campaña
            </Button>
          </div>
        ) : (
          campanas.map((campana) => {
            const estadoConfig = getEstadoCampanaConfig(campana.estado)
            const IconoEstado = estadoConfig.icon
            const canales = JSON.parse(campana.canales || '[]')

            return (
              <div
                key={campana.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getTipoIcon(campana.tipo)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campana.nombre}
                        </h3>
                        <div className="flex items-center gap-1">
                          <IconoEstado className="w-4 h-4" />
                          <StatusBadge {...estadoConfig} />
                        </div>
                      </div>
                      {campana.descripcion && (
                        <p className="text-gray-600 text-sm">{campana.descripcion}</p>
                      )}
                    </div>
                  </div>

                  {/* Canales */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-medium text-gray-700">Canales:</span>
                    <div className="flex gap-2">
                      {canales.map((canal) => (
                        <span
                          key={canal}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                        >
                          {canal === 'email' && <Mail className="w-3 h-3" />}
                          {canal === 'whatsapp' && <MessageSquare className="w-3 h-3" />}
                          {canal === 'sms' && <MessageSquare className="w-3 h-3" />}
                          {canal.charAt(0).toUpperCase() + canal.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Destinatarios</p>
                      <p className="text-xl font-bold text-gray-900">
                        {campana.totalDestinatarios}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Enviados</p>
                      <p className="text-xl font-bold text-blue-600">
                        {campana.enviados}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Abiertos</p>
                      <p className="text-xl font-bold text-green-600">
                        {campana.abiertos}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Clicks</p>
                      <p className="text-xl font-bold text-purple-600">
                        {campana.clicks}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Errores</p>
                      <p className="text-xl font-bold text-red-600">
                        {campana.errores}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 gap-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                      {campana.fechaProgramada && (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>Programada: {formatDateTime(campana.fechaProgramada)}</span>
                        </div>
                      )}
                      {campana.fechaEnvio && (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Send className="w-4 h-4 shrink-0" />
                          <span>Enviada: {formatDateTime(campana.fechaEnvio)}</span>
                        </div>
                      )}
                      {campana.admin && (
                        <span className="whitespace-nowrap">
                          Por {campana.admin.nombre} {campana.admin.apellido}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => abrirDestinatariosCampana(campana)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        {campana.totalDestinatarios} destinatarios
                      </button>
                      {(campana.estado === 'BORRADOR' || campana.estado === 'PROGRAMADA') && (
                        <button
                          disabled={enviandoCampana === campana.id}
                          onClick={() => handleEnviarCampana(campana.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {enviandoCampana === campana.id
                            ? <><Loader2 className="w-4 h-4 shrink-0 animate-spin" />Enviando...</>
                            : <><Send className="w-4 h-4 shrink-0" />Enviar</>}
                        </button>
                      )}
                      {(campana.estado === 'COMPLETADA' || campana.estado === 'EN_CURSO') && (
                        <>
                          <button
                            disabled={reenviandoCampana === campana.id}
                            onClick={() => setModalReenvio(campana)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                          >
                            {reenviandoCampana === campana.id
                              ? <><Loader2 className="w-4 h-4 shrink-0 animate-spin" />Reenviando...</>
                              : <><Send className="w-4 h-4 shrink-0" />Reenviar</>}
                          </button>
                          <button
                            onClick={() => handleDuplicar(campana)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Duplicar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => navigate(`/admin/comunicaciones/campanas/${campana.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-4 h-4 shrink-0" />
                        Ver Detalle
                      </button>
                      {campana.estado !== 'EN_CURSO' && campana.estado !== 'COMPLETADA' && (
                        <button
                          onClick={() => handleEliminarCampana(campana)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors shrink-0"
                          title="Eliminar campaña"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Paginación */}
        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={goToPage}
            />
          </div>
        )}
      </div>

      {/* Modal Nueva Campaña */}
      <Modal
        isOpen={showNuevaCampanaModal}
        onClose={() => setShowNuevaCampanaModal(false)}
        title="Nueva Campaña de Comunicación"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCrearCampana}>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

            {/* Fila 1: Nombre + Tipo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Campaña *</label>
                <input
                  type="text"
                  value={formCampana.nombre}
                  onChange={(e) => setFormCampana({ ...formCampana, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ej: Newsletter Enero 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={formCampana.tipo}
                  onChange={(e) => setFormCampana({ ...formCampana, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="INFORMATIVA">Informativa</option>
                  <option value="PROMOCIONAL">Promocional</option>
                  <option value="RECORDATORIO">Recordatorio</option>
                </select>
              </div>
            </div>

            {/* Fila 2: Canales + Descripción */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canales *</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'email', label: 'Email', Icon: Mail },
                    { id: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare },
                    { id: 'sms', label: 'SMS', Icon: MessageSquare },
                  ].map(({ id, label, Icon }) => (
                    <label key={id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formCampana.canales.includes(id)}
                        onChange={() => handleToggleCanal(id)}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formCampana.descripcion}
                  onChange={(e) => setFormCampana({ ...formCampana, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Descripción breve de la campaña..."
                />
              </div>
            </div>

            {/* Templates (condicionales) */}
            {(formCampana.canales.includes('email') || formCampana.canales.includes('whatsapp')) && (
              <div className="grid grid-cols-2 gap-3">
                {formCampana.canales.includes('email') && (
                  <div className={!formCampana.canales.includes('whatsapp') ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template de Email *</label>
                    <select
                      value={formCampana.emailTemplateId}
                      onChange={(e) => setFormCampana({ ...formCampana, emailTemplateId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre} - {t.asunto}</option>
                      ))}
                    </select>
                  </div>
                )}
                {formCampana.canales.includes('whatsapp') && (
                  <div className={!formCampana.canales.includes('email') ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje WhatsApp *</label>
                    <textarea
                      value={formCampana.whatsappTemplate}
                      onChange={(e) => setFormCampana({ ...formCampana, whatsappTemplate: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                      placeholder="Ej: Hola {{nombre}}, tu deuda es {{deuda_total}}."
                      required
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {['{{nombre}}','{{nroSocio}}','{{celular}}','{{email}}','{{deuda_total}}','{{cuotas_vencidas}}','{{actividad}}'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFormCampana(prev => ({ ...prev, whatsappTemplate: (prev.whatsappTemplate || '') + v }))}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-mono transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Segmentación */}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Segmentación de Destinatarios</h3>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!formCampana.segmentacion.nrosSocio}
                    onChange={(e) => setFormCampana(prev => ({
                      ...prev,
                      segmentacion: { ...prev.segmentacion, nrosSocio: e.target.checked ? prev.segmentacion.nrosSocio || ' ' : '' }
                    }))}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  Lista específica de socios
                </label>
              </div>

              {formCampana.segmentacion.nrosSocio !== undefined && formCampana.segmentacion.nrosSocio !== '' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Números de socio <span className="text-gray-400 font-normal">(separados por coma)</span>
                  </label>
                  <textarea
                    value={formCampana.segmentacion.nrosSocio}
                    onChange={(e) => setFormCampana(prev => ({
                      ...prev,
                      segmentacion: { ...prev.segmentacion, nrosSocio: e.target.value }
                    }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono"
                    placeholder="Ej: 1001, 1042, 1187, 2034"
                  />
                  <p className="text-xs text-gray-400 mt-1">Solo se enviará a estos socios. Los demás filtros de segmentación son ignorados.</p>
                </div>
              ) : (
              <div className="grid grid-cols-3 gap-3">
                {/* Estado socios */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado de Socios</label>
                  <div className="space-y-1">
                    {['ACTIVO', 'VIGENTE', 'BAJA'].map(est => (
                      <label key={est} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCampana.segmentacion.estado?.includes(est)}
                          onChange={(e) => {
                            const estados = e.target.checked
                              ? [...(formCampana.segmentacion.estado || []), est]
                              : formCampana.segmentacion.estado.filter(s => s !== est)
                            setFormCampana({ ...formCampana, segmentacion: { ...formCampana.segmentacion, estado: estados } })
                          }}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{est}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actividad + Categoría */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Actividad</label>
                    <select
                      value={formCampana.segmentacion.actividadId}
                      onChange={(e) => handleActividadChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    >
                      <option value="">Todas</option>
                      {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={formCampana.segmentacion.categoriaActividadId}
                      onChange={(e) => setFormCampana(prev => ({ ...prev, segmentacion: { ...prev.segmentacion, categoriaActividadId: e.target.value } }))}
                      disabled={!formCampana.segmentacion.actividadId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Todas</option>
                      {categoriasActividad.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* Deudores + Fecha programada */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Socios con Deuda</label>
                    <div className="space-y-1">
                      {[
                        { value: true, label: 'Solo deudores' },
                        { value: false, label: 'Sin deuda' },
                        { value: null, label: 'Todos' },
                      ].map(({ value, label }) => (
                        <label key={label} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="deudores"
                            checked={formCampana.segmentacion.deudores === value}
                            onChange={() => setFormCampana({ ...formCampana, segmentacion: { ...formCampana.segmentacion, deudores: value } })}
                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                          />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Fecha programada */}
            <div className="border-t border-gray-200 pt-3">
              <div className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada (opcional)</label>
                  <input
                    type="datetime-local"
                    value={formCampana.fechaProgramada}
                    onChange={(e) => setFormCampana({ ...formCampana, fechaProgramada: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Si no se especifica, quedará en borrador</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-gray-200">
            <button type="button" onClick={previsualizarDestinatarios} disabled={guardandoCampana}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50">
              <Users className="w-4 h-4 shrink-0" />
              Ver destinatarios
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNuevaCampanaModal(false)} disabled={guardandoCampana}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoCampana}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                {guardandoCampana ? 'Creando...' : 'Crear Campaña'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal destinatarios */}
      <Modal
        isOpen={destinatariosModal.open}
        onClose={() => setDestinatariosModal(prev => ({ ...prev, open: false }))}
        title={`${destinatariosModal.titulo} — Destinatarios (${destinatariosModal.total})`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={destinatariosBusqueda}
              onChange={e => setDestinatariosBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {destinatariosModal.loading ? (
            <LoadingSpinner />
          ) : destinatariosModal.lista.length === 0 ? (
            <p className="text-center text-gray-500 py-6">No hay destinatarios</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Socio</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {destinatariosModal.lista
                    .filter(d => {
                      if (!destinatariosBusqueda) return true
                      const q = destinatariosBusqueda.toLowerCase()
                      return (
                        d.apellidoNombre?.toLowerCase().includes(q) ||
                        d.email?.toLowerCase().includes(q) ||
                        d.telefono?.includes(q) ||
                        d.nroSocio?.toString().includes(q)
                      )
                    })
                    .map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{d.nroSocio}</td>
                        <td className="px-4 py-2 font-medium text-gray-800">{d.apellidoNombre}</td>
                        <td className="px-4 py-2 text-gray-600">{d.email || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2 text-gray-600">{d.telefono || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal modo reenvío */}
      <Modal
        isOpen={!!modalReenvio}
        onClose={() => setModalReenvio(null)}
        title="Reenviar campaña"
        maxWidth="max-w-sm"
      >
        {modalReenvio && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              ¿A quién querés reenviar <strong>"{modalReenvio.nombre}"</strong>?
            </p>
            {modalReenvio.errores > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Esta campaña tuvo <strong>{modalReenvio.errores}</strong> envíos con error.
              </p>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleReenviar(modalReenvio, 'todos')}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors"
              >
                <Send className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div>A todos los destinatarios</div>
                  <div className="text-xs opacity-80">{modalReenvio.totalDestinatarios} socios</div>
                </div>
              </button>
              <button
                disabled={!modalReenvio.errores}
                onClick={() => handleReenviar(modalReenvio, 'errores')}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div>Solo los que fallaron</div>
                  <div className="text-xs opacity-70">{modalReenvio.errores} con error</div>
                </div>
              </button>
              <button
                onClick={() => setModalReenvio(null)}
                className="text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {ModalComponent}
      <AxioChat endpoint="/api/chat" title="AXIO" extraBody={{ role: "admin" }} />
    </div>
  )
}
