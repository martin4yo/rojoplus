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
  Loader2
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { formatDate, formatDateTime } from '../../utils/formatters'
import usePagination from '../../hooks/usePagination'
import api from '../../services/api'
import ChatWidget from '../../components/chat/ChatWidget'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function GestionComunicaciones() {
  const navigate = useNavigate()
  const { page, pagination, setPagination, goToPage } = usePagination()

  const [campanas, setCampanas] = useState([])
  const [templates, setTemplates] = useState([])
  const [actividades, setActividades] = useState([])
  const [categoriasActividad, setCategoriasActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [enviandoCampana, setEnviandoCampana] = useState(null)

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
      deudores: null
    },
    fechaProgramada: ''
  })

  useEffect(() => {
    cargarCampanas()
    cargarTemplates()
    api.getFull('/admin/actividades?limit=100').then(r => setActividades(r?.data || r || []))
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
      setCategoriasActividad(cats?.data || cats || [])
    } else {
      setCategoriasActividad([])
    }
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

      const params = { page, limit: 10 }
      if (tipo) params.tipo = tipo
      if (estado) params.estado = estado

      const res = await api.get('/admin/comunicaciones/campanas', { params })
      const data = res.data?.data || []
      const pag = res.data?.pagination

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
          deudores: null
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
      case 'ENVIADA':
        return { variant: 'success', label: 'Enviada', icon: CheckCircle }
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
              <option value="ENVIADA">Enviada</option>
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
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {campana.fechaProgramada && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Programada: {formatDateTime(campana.fechaProgramada)}</span>
                        </div>
                      )}
                      {campana.fechaEnvio && (
                        <div className="flex items-center gap-1">
                          <Send className="w-4 h-4" />
                          <span>Enviada: {formatDateTime(campana.fechaEnvio)}</span>
                        </div>
                      )}
                      {campana.admin && (
                        <span>
                          Por {campana.admin.nombre} {campana.admin.apellido}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {(campana.estado === 'BORRADOR' || campana.estado === 'PROGRAMADA') && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={enviandoCampana === campana.id}
                          onClick={() => handleEnviarCampana(campana.id)}
                        >
                          {enviandoCampana === campana.id
                            ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Enviando...</>
                            : <><Send className="w-4 h-4 mr-1" />Enviar</>}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/comunicaciones/campanas/${campana.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalle
                      </Button>
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
        size="lg"
      >
        <form onSubmit={handleCrearCampana}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Campaña *
              </label>
              <input
                type="text"
                value={formCampana.nombre}
                onChange={(e) => setFormCampana({ ...formCampana, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ej: Newsletter Enero 2024"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formCampana.descripcion}
                onChange={(e) => setFormCampana({ ...formCampana, descripcion: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Descripción breve de la campaña..."
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
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

            {/* Canales */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canales de Comunicación *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formCampana.canales.includes('email')}
                    onChange={() => handleToggleCanal('email')}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <Mail className="w-4 h-4 ml-2 mr-1 text-gray-600" />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formCampana.canales.includes('whatsapp')}
                    onChange={() => handleToggleCanal('whatsapp')}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <MessageSquare className="w-4 h-4 ml-2 mr-1 text-gray-600" />
                  <span className="text-sm text-gray-700">WhatsApp</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formCampana.canales.includes('sms')}
                    onChange={() => handleToggleCanal('sms')}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <MessageSquare className="w-4 h-4 ml-2 mr-1 text-gray-600" />
                  <span className="text-sm text-gray-700">SMS</span>
                </label>
              </div>
            </div>

            {/* Template Email */}
            {formCampana.canales.includes('email') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template de Email *
                </label>
                <select
                  value={formCampana.emailTemplateId}
                  onChange={(e) => setFormCampana({ ...formCampana, emailTemplateId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} - {t.asunto}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Template WhatsApp */}
            {formCampana.canales.includes('whatsapp') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje de WhatsApp *
                </label>
                <textarea
                  value={formCampana.whatsappTemplate}
                  onChange={(e) => setFormCampana({ ...formCampana, whatsappTemplate: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Escribe el mensaje para WhatsApp..."
                  required
                />
              </div>
            )}

            {/* Segmentación */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Segmentación de Destinatarios
              </h3>

              <div className="space-y-4">
                {/* Estado de socios */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado de Socios
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {['ACTIVO', 'VIGENTE', 'BAJA'].map(est => (
                      <label key={est} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formCampana.segmentacion.estado?.includes(est)}
                          onChange={(e) => {
                            const estados = e.target.checked
                              ? [...(formCampana.segmentacion.estado || []), est]
                              : formCampana.segmentacion.estado.filter(s => s !== est)
                            setFormCampana({
                              ...formCampana,
                              segmentacion: { ...formCampana.segmentacion, estado: estados }
                            })
                          }}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{est}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actividad / Categoría */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Actividad (opcional)</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (opcional)</label>
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

                {/* Deudores */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Socios con Deuda
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deudores"
                        checked={formCampana.segmentacion.deudores === true}
                        onChange={() => setFormCampana({
                          ...formCampana,
                          segmentacion: { ...formCampana.segmentacion, deudores: true }
                        })}
                        className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Solo deudores</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deudores"
                        checked={formCampana.segmentacion.deudores === false}
                        onChange={() => setFormCampana({
                          ...formCampana,
                          segmentacion: { ...formCampana.segmentacion, deudores: false }
                        })}
                        className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Sin deuda</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deudores"
                        checked={formCampana.segmentacion.deudores === null}
                        onChange={() => setFormCampana({
                          ...formCampana,
                          segmentacion: { ...formCampana.segmentacion, deudores: null }
                        })}
                        className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Todos</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Fecha programada */}
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Programada (opcional)
              </label>
              <input
                type="datetime-local"
                value={formCampana.fechaProgramada}
                onChange={(e) => setFormCampana({ ...formCampana, fechaProgramada: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no se especifica, la campaña quedará en borrador
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowNuevaCampanaModal(false)}
              disabled={guardandoCampana}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={guardandoCampana}>
              {guardandoCampana ? 'Creando...' : 'Crear Campaña'}
            </Button>
          </div>
        </form>
      </Modal>

      <ChatWidget />
    </div>
  )
}
