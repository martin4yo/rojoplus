import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Clock, MapPin, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import toast from 'react-hot-toast'
import { useConfirm } from '../../../hooks/useConfirm'

export default function IntentosDenegados() {
  const [intentos, setIntentos] = useState([])
  const [loading, setLoading] = useState(false)
  const [mostrarResueltos, setMostrarResueltos] = useState(false)
  const [modalHabilitacion, setModalHabilitacion] = useState(null)
  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => {
    cargarIntentos()

    // Auto-refresh cada 10 segundos
    const interval = setInterval(cargarIntentos, 10000)
    return () => clearInterval(interval)
  }, [mostrarResueltos])

  const cargarIntentos = async () => {
    try {
      const params = new URLSearchParams({
        resuelto: mostrarResueltos.toString()
      })

      const response = await fetch(`/api/accesos/intentos-denegados?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setIntentos(data.data || [])
      }
    } catch (error) {
      console.error('Error cargando intentos:', error)
    }
  }

  const abrirModalHabilitacion = (intento) => {
    setModalHabilitacion(intento)
  }

  const handleHabilitar = async (formData) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/accesos/intentos-denegados/${modalHabilitacion.dni}/habilitar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Habilitación creada correctamente')
        setModalHabilitacion(null)
        cargarIntentos()
      } else {
        toast.error(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error habilitando:', error)
      toast.error('Error al crear habilitación')
    } finally {
      setLoading(false)
    }
  }

  const handleDescartar = async (dni) => {
    const confirmed = await confirm(
      '¿Descartar intentos?',
      `¿Está seguro de descartar los intentos del DNI ${dni}? Esta acción no se puede deshacer.`,
      { variant: 'danger', confirmText: 'Descartar' }
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/accesos/intentos-denegados/${dni}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Intentos descartados')
        cargarIntentos()
      } else {
        toast.error(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error descartando:', error)
      toast.error('Error al descartar intentos')
    }
  }

  const formatFecha = (fecha) => {
    const date = new Date(fecha)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const intentosPendientes = intentos.filter(i => !i.resuelto)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Intentos de Acceso Denegados</h1>
            <p className="text-gray-500 text-sm">
              {intentosPendientes.length} DNIs pendientes de resolución
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarResueltos}
            onChange={(e) => setMostrarResueltos(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-600">Mostrar resueltos</span>
        </label>
      </div>

      {/* Advertencia si hay pendientes */}
      {!mostrarResueltos && intentosPendientes.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800">
                {intentosPendientes.length} DNI{intentosPendientes.length > 1 ? 's' : ''} pendiente{intentosPendientes.length > 1 ? 's' : ''} de atención
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Estas personas intentaron ingresar pero no están registradas en el sistema.
                Puede habilitarlas temporalmente o descartar los intentos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Intentos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {intentos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {mostrarResueltos
                ? 'No hay intentos resueltos'
                : 'No hay intentos pendientes'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">DNI</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">
                    Primer Intento
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                    Último Intento
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">
                    Cantidad
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">
                    Dispositivo
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">
                    Estado
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {intentos.map((intento) => (
                  <tr key={intento.dni} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-lg font-bold text-gray-800">
                        {intento.dni}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatFecha(intento.primerIntento)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatFecha(intento.ultimoIntento)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
                        {intento.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {intento.dispositivo && (
                        <div className="text-sm">
                          <p className="font-medium text-gray-800">{intento.dispositivo.nombre}</p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {intento.dispositivo.ubicacion}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {intento.resuelto ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Resuelto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <AlertTriangle className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {!intento.resuelto && (
                          <>
                            <button
                              onClick={() => abrirModalHabilitacion(intento)}
                              className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90 transition-colors"
                              title="Habilitar acceso temporal"
                            >
                              ✅ Habilitar
                            </button>
                            <button
                              onClick={() => handleDescartar(intento.dni)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Descartar intentos"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {intento.resuelto && intento.habilitacion && (
                          <span className="text-sm text-gray-500">
                            Habilitado: {intento.habilitacion.nombreCompleto}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Habilitación */}
      {modalHabilitacion && (
        <ModalHabilitacion
          dni={modalHabilitacion.dni}
          intentos={modalHabilitacion.intentos}
          onClose={() => setModalHabilitacion(null)}
          onSubmit={handleHabilitar}
          loading={loading}
        />
      )}

      <ConfirmDialog />
    </div>
  )
}

// Componente Modal para crear habilitación
function ModalHabilitacion({ dni, intentos, onClose, onSubmit, loading }) {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    motivo: '',
    diasHabilitados: 7,
    diasCustom: '',
    accesosPermitidos: '',
    observaciones: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    const dias = formData.diasCustom
      ? parseInt(formData.diasCustom)
      : formData.diasHabilitados

    onSubmit({
      nombreCompleto: formData.nombreCompleto.trim(),
      motivo: formData.motivo.trim() || null,
      diasHabilitados: dias,
      accesosPermitidos: formData.accesosPermitidos ? parseInt(formData.accesosPermitidos) : null,
      observaciones: formData.observaciones.trim() || null
    })
  }

  const opcionesDias = [
    { value: 1, label: '1 día' },
    { value: 3, label: '3 días' },
    { value: 7, label: '7 días (Recomendado)' },
    { value: 30, label: '30 días' },
    { value: 0, label: 'Personalizado' }
  ]

  return (
    <Modal onClose={onClose} title="Habilitar Acceso Temporal">
      <form onSubmit={handleSubmit}>
        {/* Información del DNI */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-900">DNI: <span className="font-mono text-xl">{dni}</span></p>
              <p className="text-sm text-orange-700 mt-1">
                {intentos.length} intento{intentos.length > 1 ? 's' : ''} registrado{intentos.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              value={formData.nombreCompleto}
              onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo
            </label>
            <input
              type="text"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ej: Invitado, Familiar, Servicio técnico..."
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días de Habilitación *
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {opcionesDias.map((opcion) => (
                <label
                  key={opcion.value}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.diasHabilitados === opcion.value && !formData.diasCustom
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dias"
                    value={opcion.value}
                    checked={formData.diasHabilitados === opcion.value && !formData.diasCustom}
                    onChange={(e) => setFormData({
                      ...formData,
                      diasHabilitados: parseInt(e.target.value),
                      diasCustom: ''
                    })}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{opcion.label}</span>
                </label>
              ))}
            </div>

            {formData.diasHabilitados === 0 && (
              <input
                type="number"
                min="1"
                max="365"
                required
                value={formData.diasCustom}
                onChange={(e) => setFormData({ ...formData, diasCustom: e.target.value })}
                placeholder="Ingrese cantidad de días"
                className="input-field w-full"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Límite de Accesos (opcional)
            </label>
            <input
              type="number"
              min="1"
              value={formData.accesosPermitidos}
              onChange={(e) => setFormData({ ...formData, accesosPermitidos: e.target.value })}
              placeholder="Dejar vacío para ilimitado"
              className="input-field w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si se especifica, la persona solo podrá ingresar esta cantidad de veces
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              rows={3}
              placeholder="Información adicional..."
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Creando...' : '✅ Crear Habilitación'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
