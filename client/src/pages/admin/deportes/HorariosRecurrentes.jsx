import { useState, useEffect } from 'react'
import { Calendar, Plus, Edit, Trash2, Clock, MapPin } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miercoles', short: 'Mie' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sabado', short: 'Sab' },
  { value: 0, label: 'Domingo', short: 'Dom' },
]

export default function HorariosRecurrentes() {
  const [horarios, setHorarios] = useState([])
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [espacios, setEspacios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Filtros
  const [filtroActividad, setFiltroActividad] = useState('')

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [horarioEditando, setHorarioEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Modal eliminar
  const [modalEliminar, setModalEliminar] = useState({ visible: false, horario: null })
  const [eliminando, setEliminando] = useState(false)

  // Form
  const [form, setForm] = useState({
    categoriaActividadId: '',
    espacioId: '',
    diaSemana: '',
    horaInicio: '18:00',
    horaFin: '19:30'
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    cargarHorarios()
  }, [filtroActividad])

  async function cargarDatos() {
    try {
      const [actividadesRes, espaciosRes] = await Promise.all([
        api.getFull('/admin/actividades?activo=true'),
        api.getFull('/admin/espacios-deportivos?activo=true')
      ])
      setActividades(actividadesRes.data || [])
      setEspacios(espaciosRes.data || [])

      // Cargar categorías de todas las actividades
      const todasCategorias = []
      for (const act of actividadesRes.data || []) {
        const catRes = await api.getFull(`/admin/categorias-actividad?actividadId=${act.id}&activo=true`)
        todasCategorias.push(...(catRes.data || []).map(c => ({ ...c, actividad: act })))
      }
      setCategorias(todasCategorias)
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  async function cargarHorarios() {
    setLoading(true)
    try {
      let url = '/admin/horarios-recurrentes'
      const params = new URLSearchParams()
      if (filtroActividad) {
        // Filtrar por categorías de la actividad seleccionada
        const categoriasDeActividad = categorias.filter(c => c.actividadId === parseInt(filtroActividad))
        // Si no hay categorías, no hay horarios
        if (categoriasDeActividad.length === 0) {
          setHorarios([])
          setLoading(false)
          return
        }
      }
      const response = await api.getFull(url)
      let data = response.data || []

      // Filtrar en cliente por actividad si está seleccionada
      if (filtroActividad) {
        data = data.filter(h => h.categoriaActividad?.actividadId === parseInt(filtroActividad))
      }

      setHorarios(data)
    } catch (err) {
      setError('Error al cargar los horarios')
    } finally {
      setLoading(false)
    }
  }

  function abrirModal(horario = null) {
    if (horario) {
      setHorarioEditando(horario)
      setForm({
        categoriaActividadId: String(horario.categoriaActividadId),
        espacioId: horario.espacioId ? String(horario.espacioId) : '',
        diaSemana: String(horario.diaSemana),
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin
      })
    } else {
      setHorarioEditando(null)
      setForm({
        categoriaActividadId: '',
        espacioId: '',
        diaSemana: '',
        horaInicio: '18:00',
        horaFin: '19:30'
      })
    }
    setModalAbierto(true)
  }

  async function guardarHorario(e) {
    e.preventDefault()
    setError(null)

    if (!form.categoriaActividadId || form.diaSemana === '' || !form.horaInicio || !form.horaFin) {
      setError('Categoria, dia, hora inicio y hora fin son requeridos')
      return
    }

    setGuardando(true)
    try {
      const datos = {
        categoriaActividadId: parseInt(form.categoriaActividadId),
        espacioId: form.espacioId ? parseInt(form.espacioId) : null,
        diaSemana: parseInt(form.diaSemana),
        horaInicio: form.horaInicio,
        horaFin: form.horaFin
      }

      if (horarioEditando) {
        await api.put(`/admin/horarios-recurrentes/${horarioEditando.id}`, datos)
        setSuccess('Horario actualizado correctamente')
      } else {
        await api.post('/admin/horarios-recurrentes', datos)
        setSuccess('Horario creado correctamente')
      }

      setModalAbierto(false)
      cargarHorarios()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar() {
    if (!modalEliminar.horario) return

    setEliminando(true)
    try {
      await api.delete(`/admin/horarios-recurrentes/${modalEliminar.horario.id}`)
      setSuccess('Horario eliminado correctamente')
      setModalEliminar({ visible: false, horario: null })
      cargarHorarios()
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  // Agrupar horarios por categoría
  const horariosAgrupados = horarios.reduce((acc, h) => {
    const key = h.categoriaActividadId
    if (!acc[key]) {
      acc[key] = {
        categoria: h.categoriaActividad,
        horarios: []
      }
    }
    acc[key].horarios.push(h)
    return acc
  }, {})

  // Categorías filtradas por actividad seleccionada
  const categoriasFiltradas = filtroActividad
    ? categorias.filter(c => c.actividadId === parseInt(filtroActividad))
    : categorias

  if (loading && horarios.length === 0) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Horarios Recurrentes</h1>
            <p className="text-gray-500 text-sm">Templates de horarios semanales por categoria</p>
          </div>
        </div>
        {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
          <Button onClick={() => abrirModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Horario
          </Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Actividad</label>
            <select
              value={filtroActividad}
              onChange={(e) => setFiltroActividad(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todas las actividades</option>
              {actividades.map((act) => (
                <option key={act.id} value={act.id}>{act.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Listado agrupado por categoría */}
      {Object.keys(horariosAgrupados).length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay horarios recurrentes configurados</p>
          {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
            <button onClick={() => abrirModal()} className="text-primary hover:underline mt-2">
              Crear el primer horario
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(horariosAgrupados).map(({ categoria, horarios: horariosCategoria }) => (
            <div key={categoria.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: categoria.actividad?.color || '#6B7280' }}
                />
                <h3 className="font-semibold text-gray-800">
                  {categoria.actividad?.nombre} - {categoria.nombre}
                </h3>
              </div>

              <div className="divide-y">
                {horariosCategoria
                  .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
                  .map(horario => {
                    const dia = DIAS_SEMANA.find(d => d.value === horario.diaSemana)
                    const espacio = espacios.find(e => e.id === horario.espacioId)

                    return (
                      <div
                        key={horario.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-24 font-medium text-gray-800">
                            {dia?.label || 'N/A'}
                          </div>
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {horario.horaInicio} - {horario.horaFin}
                          </div>
                          {espacio && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {espacio.nombre}
                            </div>
                          )}
                        </div>
                        {tienePermiso(PERMISOS.DEPORTES_ENTRENAMIENTOS) && (
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => abrirModal(horario)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setModalEliminar({ visible: true, horario })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={horarioEditando ? 'Editar Horario' : 'Nuevo Horario Recurrente'}
      >
        <form onSubmit={guardarHorario} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select
              value={form.categoriaActividadId}
              onChange={(e) => setForm({ ...form, categoriaActividadId: e.target.value })}
              className="input-field w-full"
              required
              disabled={!!horarioEditando}
            >
              <option value="">Seleccionar categoria...</option>
              {categoriasFiltradas.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.actividad?.nombre} - {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dia de la semana *</label>
            <select
              value={form.diaSemana}
              onChange={(e) => setForm({ ...form, diaSemana: e.target.value })}
              className="input-field w-full"
              required
            >
              <option value="">Seleccionar dia...</option>
              {DIAS_SEMANA.map((dia) => (
                <option key={dia.value} value={dia.value}>{dia.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
              <input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin *</label>
              <input
                type="time"
                value={form.horaFin}
                onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Espacio (opcional)</label>
            <select
              value={form.espacioId}
              onChange={(e) => setForm({ ...form, espacioId: e.target.value })}
              className="input-field w-full"
            >
              <option value="">Sin espacio asignado</option>
              {espacios.map((esp) => (
                <option key={esp.id} value={esp.id}>{esp.nombre}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Si asignas un espacio, se validaran conflictos de horario
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              {horarioEditando ? 'Guardar Cambios' : 'Crear Horario'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={modalEliminar.visible}
        onClose={() => setModalEliminar({ visible: false, horario: null })}
        title="Eliminar Horario"
      >
        <p className="text-gray-600 mb-6">
          ¿Estas seguro de eliminar este horario recurrente?
          Esta accion no afecta los entrenamientos ya generados.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setModalEliminar({ visible: false, horario: null })}
          >
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleEliminar} loading={eliminando}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
