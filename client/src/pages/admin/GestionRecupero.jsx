import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  TrendingUp,
  Target,
  UserCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'
import usePagination from '../../hooks/usePagination'
import api from '../../services/api'
import ChatWidget from '../../components/chat/ChatWidget'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function GestionRecupero() {
  const navigate = useNavigate()
  const { page, pagination, setPagination, goToPage } = usePagination()

  const [campanas, setCampanas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Filtros
  const [activa, setActiva] = useState('true')

  // Modal nueva campaña
  const [showNuevaCampanaModal, setShowNuevaCampanaModal] = useState(false)
  const [guardandoCampana, setGuardandoCampana] = useState(false)
  const [formCampana, setFormCampana] = useState({
    nombre: '',
    descripcion: '',
    motivosBaja: '',
    tiempoBajaMin: '',
    tiempoBajaMax: '',
    oferta: '',
    descuento: '',
    mesesDescuento: '',
    sinCuotaIngreso: false,
    fechaInicio: '',
    fechaFin: ''
  })

  useEffect(() => {
    cargarCampanas()
  }, [page, activa])

  const cargarCampanas = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = { page, limit: 10 }
      if (activa !== '') {
        params.activa = activa
      }

      const res = await api.get('/admin/recupero/campanas', { params })
      const data = res.data?.data || []
      const pag = res.data?.pagination

      setCampanas(data)
      if (pag) {
        setPagination(pag)
      }
    } catch (err) {
      console.error('Error cargando campañas:', err)
      setError('Error al cargar las campañas de recupero')
    } finally {
      setLoading(false)
    }
  }

  const handleCrearCampana = async (e) => {
    e.preventDefault()

    if (!formCampana.nombre || !formCampana.oferta || !formCampana.fechaInicio || !formCampana.fechaFin) {
      setError('Debe completar los campos obligatorios: Nombre, Oferta, Fechas')
      return
    }

    try {
      setGuardandoCampana(true)
      setError(null)

      await api.post('/admin/recupero/campanas', formCampana)

      setSuccess('Campaña de recupero creada correctamente')
      setShowNuevaCampanaModal(false)
      setFormCampana({
        nombre: '',
        descripcion: '',
        motivosBaja: '',
        tiempoBajaMin: '',
        tiempoBajaMax: '',
        oferta: '',
        descuento: '',
        mesesDescuento: '',
        sinCuotaIngreso: false,
        fechaInicio: '',
        fechaFin: ''
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

  const getCampanaEstado = (campana) => {
    const hoy = new Date()
    const inicio = new Date(campana.fechaInicio)
    const fin = new Date(campana.fechaFin)

    if (!campana.activa) {
      return { variant: 'secondary', label: 'Inactiva', icon: XCircle }
    }

    if (hoy < inicio) {
      return { variant: 'info', label: 'Programada', icon: Clock }
    }

    if (hoy > fin) {
      return { variant: 'secondary', label: 'Finalizada', icon: CheckCircle }
    }

    return { variant: 'success', label: 'Activa', icon: CheckCircle }
  }

  const calcularTasaConversion = (campana) => {
    if (campana.contactados === 0) return 0
    return ((campana.recuperados / campana.contactados) * 100).toFixed(1)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-primary" />
              Gestión de Recupero de Socios
            </h1>
            <p className="text-gray-600 mt-1">
              Campañas para recuperar socios dados de baja
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

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={activa}
              onChange={(e) => setActiva(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>

          {activa !== '' && (
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => setActiva('')}>
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
            <Target className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">No se encontraron campañas</p>
            <p className="text-sm mt-1">
              Crea tu primera campaña de recupero para comenzar
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
            const estado = getCampanaEstado(campana)
            const IconoEstado = estado.icon
            const tasaConversion = calcularTasaConversion(campana)

            return (
              <div
                key={campana.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/admin/recupero/campanas/${campana.id}`)}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campana.nombre}
                        </h3>
                        <div className="flex items-center gap-1">
                          <IconoEstado className="w-4 h-4" />
                          <StatusBadge {...estado} />
                        </div>
                      </div>
                      {campana.descripcion && (
                        <p className="text-gray-600 text-sm">{campana.descripcion}</p>
                      )}
                    </div>
                  </div>

                  {/* Oferta */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 mb-1">Oferta</p>
                        <p className="text-gray-900">{campana.oferta}</p>
                        {campana.descuento && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Descuento: {campana.descuento}%</span>
                            {campana.mesesDescuento && (
                              <span>Por {campana.mesesDescuento} meses</span>
                            )}
                            {campana.sinCuotaIngreso && (
                              <span className="text-green-600 font-medium">Sin cuota de ingreso</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Objetivo</p>
                      <p className="text-xl font-bold text-gray-900">
                        {campana.sociosObjetivo}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Contactados</p>
                      <p className="text-xl font-bold text-blue-600">
                        {campana.contactados}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Interesados</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {campana.interesados}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Recuperados</p>
                      <p className="text-xl font-bold text-green-600">
                        {campana.recuperados}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDate(campana.fechaInicio)} - {formatDate(campana.fechaFin)}
                        </span>
                      </div>
                      {campana.admin && (
                        <span>
                          Por {campana.admin.nombre} {campana.admin.apellido}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Conversión: {tasaConversion}%
                      </span>
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
        title="Nueva Campaña de Recupero"
        size="lg"
      >
        <form onSubmit={handleCrearCampana}>
          <div className="space-y-4">
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
                placeholder="Ej: Campaña Verano 2024"
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
                placeholder="Descripción de la campaña..."
              />
            </div>

            {/* Oferta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Oferta *
              </label>
              <textarea
                value={formCampana.oferta}
                onChange={(e) => setFormCampana({ ...formCampana, oferta: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Describe la oferta para recuperar socios..."
                required
              />
            </div>

            {/* Descuento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descuento (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formCampana.descuento}
                  onChange={(e) => setFormCampana({ ...formCampana, descuento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meses de Descuento
                </label>
                <input
                  type="number"
                  value={formCampana.mesesDescuento}
                  onChange={(e) => setFormCampana({ ...formCampana, mesesDescuento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Sin cuota de ingreso */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sinCuotaIngreso"
                checked={formCampana.sinCuotaIngreso}
                onChange={(e) => setFormCampana({ ...formCampana, sinCuotaIngreso: e.target.checked })}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="sinCuotaIngreso" className="ml-2 text-sm text-gray-700">
                Sin cuota de ingreso
              </label>
            </div>

            {/* Criterios de segmentación */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Criterios de Segmentación (opcional)
              </h3>

              <div className="space-y-4">
                {/* Motivos de baja */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivos de Baja
                  </label>
                  <input
                    type="text"
                    value={formCampana.motivosBaja}
                    onChange={(e) => setFormCampana({ ...formCampana, motivosBaja: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Ej: ECONOMICO,MUDANZA (separados por coma)"
                  />
                </div>

                {/* Tiempo de baja */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Baja hace (meses mínimo)
                    </label>
                    <input
                      type="number"
                      value={formCampana.tiempoBajaMin}
                      onChange={(e) => setFormCampana({ ...formCampana, tiempoBajaMin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Baja hace (meses máximo)
                    </label>
                    <input
                      type="number"
                      value={formCampana.tiempoBajaMax}
                      onChange={(e) => setFormCampana({ ...formCampana, tiempoBajaMax: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="12"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={formCampana.fechaInicio}
                  onChange={(e) => setFormCampana({ ...formCampana, fechaInicio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  value={formCampana.fechaFin}
                  onChange={(e) => setFormCampana({ ...formCampana, fechaFin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
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
