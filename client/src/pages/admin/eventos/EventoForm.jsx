import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Calendar } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function EventoForm({ eventoId, onClose, isModal = false }) {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const id = eventoId || paramId
  const isEdit = id && id !== 'nuevo'

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [espacios, setEspacios] = useState([])
  const [partidos, setPartidos] = useState([])
  const [conceptosTesoreria, setConceptosTesoreria] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo: 'DEPORTIVO',
    fecha: '',
    hora: '',
    horaApertura: '',
    horaFin: '',
    espacioId: '',
    ubicacion: '',
    capacidadTotal: '',
    permiteSobreventa: false,
    ventasHabilitadas: true,
    partidoId: '',
    imagen: '',
    conceptoTesoreriaId: '',
    centroCostoId: ''
  })

  useEffect(() => {
    cargarDatosIniciales()
    if (isEdit) {
      cargarEvento()
    }
  }, [id])

  async function cargarDatosIniciales() {
    try {
      // Cargar espacios deportivos
      const espaciosData = await api.get('/admin/espacios-deportivos')
      setEspacios(espaciosData || [])

      // Cargar partidos sin evento vinculado
      const partidosData = await api.get('/admin/partidos?sinEvento=true')
      setPartidos(partidosData || [])

      // Cargar conceptos de tesorería
      const conceptosData = await api.get('/admin/conceptos-tesoreria?activo=true')
      setConceptosTesoreria(conceptosData || [])

      // Cargar centros de costo
      const centrosData = await api.get('/admin/centros-costo?activo=true')
      setCentrosCosto(centrosData || [])
    } catch (err) {
      console.error('Error al cargar datos iniciales:', err)
    }
  }

  async function cargarEvento() {
    try {
      const data = await api.get(`/eventos/${id}`)

      // Convertir fecha UTC a fecha local sin problemas de timezone
      let fechaLocal = ''
      if (data.fecha) {
        const date = new Date(data.fecha)
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        const day = String(date.getUTCDate()).padStart(2, '0')
        fechaLocal = `${year}-${month}-${day}`
      }

      setForm({
        codigo: data.codigo || '',
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        tipo: data.tipo || 'DEPORTIVO',
        fecha: fechaLocal,
        hora: data.hora || '',
        horaApertura: data.horaApertura || '',
        horaFin: data.horaFin || '',
        espacioId: data.espacioId || '',
        ubicacion: data.ubicacion || '',
        capacidadTotal: data.capacidadTotal || '',
        permiteSobreventa: data.permiteSobreventa || false,
        ventasHabilitadas: data.ventasHabilitadas !== false,
        partidoId: data.partidoId || '',
        imagen: data.imagen || '',
        conceptoTesoreriaId: data.conceptoTesoreriaId || '',
        centroCostoId: data.centroCostoId || ''
      })
    } catch (err) {
      toast.error('Error al cargar evento')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    try {
      // Convertir fecha a ISO sin problemas de timezone
      let fechaISO = form.fecha
      if (form.fecha && form.fecha.length === 10) {
        // Si es formato YYYY-MM-DD, agregar la hora UTC para evitar conversión
        fechaISO = `${form.fecha}T12:00:00.000Z`
      }

      const data = {
        ...form,
        fecha: fechaISO,
        capacidadTotal: parseInt(form.capacidadTotal),
        espacioId: form.espacioId ? parseInt(form.espacioId) : null,
        partidoId: form.partidoId ? parseInt(form.partidoId) : null,
        conceptoTesoreriaId: form.conceptoTesoreriaId ? parseInt(form.conceptoTesoreriaId) : null,
        centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null
      }

      if (isEdit) {
        await api.put(`/eventos/${id}`, data)
        toast.success('Evento actualizado correctamente')
      } else {
        await api.post('/eventos', data)
        toast.success('Evento creado correctamente')
      }

      if (isModal && onClose) {
        onClose()
      } else {
        navigate('/admin/eventos')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar evento')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {!isModal && (
          <button
            onClick={() => navigate('/admin/eventos')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEdit ? 'Editar Evento' : 'Nuevo Evento'}
            </h1>
            {isEdit && <p className="text-gray-500 text-sm">{form.nombre}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Información básica */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary uppercase"
                placeholder="EVT-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="DEPORTIVO">Deportivo</option>
                <option value="SOCIAL">Social</option>
                <option value="RECREATIVO">Recreativo</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Ej: Partido de Fútbol - Final"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Descripción del evento..."
            />
          </div>
        </div>

        {/* Fecha y Hora */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fecha y Hora</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                name="hora"
                value={form.hora}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora Apertura
              </label>
              <input
                type="time"
                name="horaApertura"
                value={form.horaApertura}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora Fin
            </label>
            <input
              type="time"
              name="horaFin"
              value={form.horaFin}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>

        {/* Ubicación */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Espacio Deportivo
              </label>
              <select
                name="espacioId"
                value={form.espacioId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Sin espacio asignado</option>
                {espacios.map(espacio => (
                  <option key={espacio.id} value={espacio.id}>
                    {espacio.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación Libre
              </label>
              <input
                type="text"
                name="ubicacion"
                value={form.ubicacion}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                placeholder="Ej: Salón Principal"
              />
            </div>
          </div>
        </div>

        {/* Capacidad */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Capacidad</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacidad Total <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="capacidadTotal"
                value={form.capacidadTotal}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                placeholder="Ej: 500"
              />
            </div>

            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="permiteSobreventa"
                name="permiteSobreventa"
                checked={form.permiteSobreventa}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="permiteSobreventa" className="ml-2 block text-sm text-gray-700">
                Permitir sobreventa
              </label>
            </div>
          </div>
        </div>

        {/* Vinculaciones */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vinculaciones</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Partido (opcional)
            </label>
            <select
              name="partidoId"
              value={form.partidoId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value="">Sin partido vinculado</option>
              {partidos.map(partido => (
                <option key={partido.id} value={partido.id}>
                  {partido.categoriaActividad?.nombre || 'Local'} vs {partido.rival} - {new Date(partido.fecha).toLocaleDateString()}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Solo se muestran partidos sin evento asignado
            </p>
          </div>
        </div>

        {/* Contabilidad */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contabilidad</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto de Tesorería
              </label>
              <select
                name="conceptoTesoreriaId"
                value={form.conceptoTesoreriaId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Seleccionar concepto...</option>
                {conceptosTesoreria.map(concepto => (
                  <option key={concepto.id} value={concepto.id}>
                    {concepto.codigo} - {concepto.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Define la cuenta contable para los ingresos del evento
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Costos
              </label>
              <select
                name="centroCostoId"
                value={form.centroCostoId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Seleccionar centro...</option>
                {centrosCosto.map(centro => (
                  <option key={centro.id} value={centro.id}>
                    {centro.codigo} - {centro.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Asigna los ingresos a un centro de costos específico
              </p>
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="mb-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="ventasHabilitadas"
              name="ventasHabilitadas"
              checked={form.ventasHabilitadas}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="ventasHabilitadas" className="ml-2 block text-sm text-gray-700">
              Ventas habilitadas
            </label>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (isModal && onClose) {
                onClose()
              } else {
                navigate('/admin/eventos')
              }
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Guardar Cambios' : 'Crear Evento'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
