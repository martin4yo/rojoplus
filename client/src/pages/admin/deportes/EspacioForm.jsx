import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, MapPin, CheckCircle, XCircle, Sun, Moon, Users, Settings, Clock, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import api from '../../../services/api'

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miercoles', short: 'Mie' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sabado', short: 'Sab' },
  { value: 0, label: 'Domingo', short: 'Dom' },
]

export default function EspacioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'nuevo'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [savingHorarios, setSavingHorarios] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editMode, setEditMode] = useState(!isEditing)

  // Datos para selects
  const [tiposEspacio, setTiposEspacio] = useState([])
  const [actividades, setActividades] = useState([])

  // Form data
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipoEspacioId: '',
    capacidad: '',
    cubierto: false,
    iluminacion: true,
    descripcion: '',
    activo: true,
    actividadIds: []
  })

  // Horarios de disponibilidad
  const [horarios, setHorarios] = useState([])
  const [horariosEditados, setHorariosEditados] = useState(false)

  useEffect(() => {
    cargarDatosAuxiliares()
    if (isEditing) {
      cargarEspacio()
    }
  }, [id])

  async function cargarDatosAuxiliares() {
    try {
      const [tiposRes, actividadesRes] = await Promise.all([
        api.getFull('/admin/tipos-espacio?activo=true'),
        api.getFull('/admin/actividades?activo=true')
      ])
      setTiposEspacio(tiposRes.data || [])
      setActividades(actividadesRes.data || [])
    } catch (err) {
      console.error('Error cargando datos auxiliares:', err)
    }
  }

  async function cargarEspacio() {
    setLoading(true)
    try {
      const res = await api.getFull(`/admin/espacios-deportivos/${id}`)
      const espacio = res.data
      setForm({
        codigo: espacio.codigo || '',
        nombre: espacio.nombre || '',
        tipoEspacioId: espacio.tipoEspacioId ? String(espacio.tipoEspacioId) : '',
        capacidad: espacio.capacidad || '',
        cubierto: espacio.cubierto || false,
        iluminacion: espacio.iluminacion !== false,
        descripcion: espacio.descripcion || '',
        activo: espacio.activo !== false,
        actividadIds: espacio.actividades?.map(a => a.id) || []
      })
      setHorarios(espacio.horariosDisponibilidad || [])
      setHorariosEditados(false)
    } catch (err) {
      setError('Error al cargar espacio')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre || !form.tipoEspacioId) {
      setError('Codigo, nombre y tipo son requeridos')
      return
    }

    setSaving(true)
    try {
      const datos = {
        codigo: form.codigo,
        nombre: form.nombre,
        tipoEspacioId: parseInt(form.tipoEspacioId),
        capacidad: form.capacidad ? parseInt(form.capacidad) : null,
        cubierto: form.cubierto,
        iluminacion: form.iluminacion,
        descripcion: form.descripcion || null,
        activo: form.activo,
        actividadIds: form.actividadIds
      }

      if (isEditing) {
        await api.put(`/admin/espacios-deportivos/${id}`, datos)
        setSuccess('Espacio actualizado correctamente')
        setEditMode(false)
      } else {
        const res = await api.post('/admin/espacios-deportivos', datos)
        setSuccess('Espacio creado correctamente')
        navigate(`/admin/deportes/espacios/${res.data.id}`)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function handleActividadToggle(actividadId) {
    if (!editMode) return
    setForm(prev => ({
      ...prev,
      actividadIds: prev.actividadIds.includes(actividadId)
        ? prev.actividadIds.filter(id => id !== actividadId)
        : [...prev.actividadIds, actividadId]
    }))
  }

  // Horarios
  function handleHorarioChange(diaSemana, field, value) {
    setHorarios(prev => {
      const existing = prev.find(h => h.diaSemana === diaSemana)
      if (existing) {
        return prev.map(h => h.diaSemana === diaSemana ? { ...h, [field]: value } : h)
      } else {
        return [...prev, { diaSemana, horaInicio: '08:00', horaFin: '22:00', activo: true, [field]: value }]
      }
    })
    setHorariosEditados(true)
  }

  function toggleDia(diaSemana) {
    setHorarios(prev => {
      const existing = prev.find(h => h.diaSemana === diaSemana)
      if (existing) {
        // Remover el dia
        return prev.filter(h => h.diaSemana !== diaSemana)
      } else {
        // Agregar el dia con horarios por defecto
        return [...prev, { diaSemana, horaInicio: '08:00', horaFin: '22:00', activo: true }]
      }
    })
    setHorariosEditados(true)
  }

  async function guardarHorarios() {
    setSavingHorarios(true)
    setError(null)
    try {
      await api.post(`/admin/espacios-deportivos/${id}/horarios/bulk`, { horarios })
      setSuccess('Horarios actualizados correctamente')
      setHorariosEditados(false)
    } catch (err) {
      setError(err.message || 'Error al guardar horarios')
    } finally {
      setSavingHorarios(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const tipoSeleccionado = tiposEspacio.find(t => t.id === parseInt(form.tipoEspacioId))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/deportes/espacios')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isEditing ? (editMode ? 'Editar Espacio' : form.nombre) : 'Nuevo Espacio'}
            </h1>
            {isEditing && <p className="text-gray-500 text-sm">{form.codigo}</p>}
          </div>
        </div>
        {isEditing && !editMode && (
          <Button onClick={() => setEditMode(true)}>Editar</Button>
        )}
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal - Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Datos del Espacio</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    className="input-field w-full font-mono"
                    placeholder="Ej: CANCHA-1"
                    disabled={!editMode}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="input-field w-full"
                    placeholder="Ej: Cancha Principal"
                    disabled={!editMode}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  {tiposEspacio.length > 0 ? (
                    <select
                      value={form.tipoEspacioId}
                      onChange={e => setForm({ ...form, tipoEspacioId: e.target.value })}
                      className="input-field w-full"
                      disabled={!editMode}
                      required
                    >
                      <option value="">Seleccionar tipo...</option>
                      {tiposEspacio.map(tipo => (
                        <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      No hay tipos configurados.{' '}
                      <Link to="/admin/deportes/tipos-espacio" className="text-primary hover:underline">
                        Configurar tipos
                      </Link>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={form.capacidad}
                      onChange={e => setForm({ ...form, capacidad: e.target.value })}
                      className="input-field w-full pl-10"
                      placeholder="Ej: 22"
                      min="0"
                      disabled={!editMode}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Cantidad de personas</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="input-field w-full"
                  rows={3}
                  placeholder="Descripcion opcional del espacio..."
                  disabled={!editMode}
                />
              </div>

              {/* Caracteristicas */}
              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-700 mb-3">Caracteristicas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    form.cubierto ? 'border-primary bg-primary/5' : 'border-gray-200'
                  } ${!editMode ? 'opacity-70 cursor-not-allowed' : 'hover:border-gray-300'}`}>
                    <input
                      type="checkbox"
                      checked={form.cubierto}
                      onChange={e => setForm({ ...form, cubierto: e.target.checked })}
                      className="sr-only"
                      disabled={!editMode}
                    />
                    <div className={`p-2 rounded-lg ${form.cubierto ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {form.cubierto ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Cubierto</p>
                      <p className="text-xs text-gray-500">Techado o bajo techo</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    form.iluminacion ? 'border-primary bg-primary/5' : 'border-gray-200'
                  } ${!editMode ? 'opacity-70 cursor-not-allowed' : 'hover:border-gray-300'}`}>
                    <input
                      type="checkbox"
                      checked={form.iluminacion}
                      onChange={e => setForm({ ...form, iluminacion: e.target.checked })}
                      className="sr-only"
                      disabled={!editMode}
                    />
                    <div className={`p-2 rounded-lg ${form.iluminacion ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                      {form.iluminacion ? (
                        <Sun className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <Moon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Iluminacion</p>
                      <p className="text-xs text-gray-500">Para uso nocturno</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Estado activo (solo en edicion) */}
              {isEditing && (
                <div className="pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={e => setForm({ ...form, activo: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                      disabled={!editMode}
                    />
                    <span className="text-sm text-gray-700">Espacio activo</span>
                  </label>
                </div>
              )}

              {/* Botones */}
              {editMode && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button type="submit" loading={saving} disabled={tiposEspacio.length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  {isEditing && (
                    <Button type="button" variant="secondary" onClick={() => {
                      setEditMode(false)
                      cargarEspacio()
                    }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Horarios de disponibilidad (solo en edicion) */}
          {isEditing && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-gray-800">Horarios de Disponibilidad</h2>
                </div>
                {horariosEditados && (
                  <Button size="sm" onClick={guardarHorarios} loading={savingHorarios}>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Horarios
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Configura los dias y horarios en que el espacio esta disponible
              </p>

              <div className="space-y-2">
                {DIAS_SEMANA.map(dia => {
                  const horario = horarios.find(h => h.diaSemana === dia.value)
                  const activo = !!horario

                  return (
                    <div
                      key={dia.value}
                      className={`flex items-center gap-4 p-3 border rounded-lg transition ${
                        activo ? 'border-primary/30 bg-primary/5' : 'border-gray-200'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={() => toggleDia(dia.value)}
                          className="w-4 h-4 rounded border-gray-300 text-primary"
                        />
                        <span className={`font-medium ${activo ? 'text-gray-800' : 'text-gray-400'}`}>
                          {dia.label}
                        </span>
                      </label>

                      {activo && (
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">De</span>
                            <input
                              type="time"
                              value={horario?.horaInicio || '08:00'}
                              onChange={e => handleHorarioChange(dia.value, 'horaInicio', e.target.value)}
                              className="input-field py-1 px-2 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">a</span>
                            <input
                              type="time"
                              value={horario?.horaFin || '22:00'}
                              onChange={e => handleHorarioChange(dia.value, 'horaFin', e.target.value)}
                              className="input-field py-1 px-2 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {!activo && (
                        <span className="text-sm text-gray-400 italic">No disponible</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Resumen */}
              {horarios.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{horarios.length}</span> dia(s) con disponibilidad configurada
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna derecha - Actividades */}
        <div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Actividades Vinculadas</h2>
            <p className="text-sm text-gray-500 mb-4">
              Selecciona las actividades que se pueden realizar en este espacio
            </p>

            {actividades.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {actividades.map(act => (
                  <label
                    key={act.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                      form.actividadIds.includes(act.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200'
                    } ${!editMode ? 'opacity-70 cursor-not-allowed' : 'hover:border-gray-300'}`}
                    onClick={() => handleActividadToggle(act.id)}
                  >
                    <input
                      type="checkbox"
                      checked={form.actividadIds.includes(act.id)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                      disabled={!editMode}
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: act.color || '#6B7280' }}
                    />
                    <div>
                      <p className="font-medium text-gray-700">{act.nombre}</p>
                      <p className="text-xs text-gray-500">{act.codigo}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay actividades registradas
              </p>
            )}

            {form.actividadIds.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{form.actividadIds.length}</span> actividad(es) seleccionada(s)
                </p>
              </div>
            )}
          </div>

          {/* Info adicional */}
          {isEditing && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h2 className="font-semibold text-gray-800 mb-4">Informacion</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${form.activo ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-gray-600">
                    Estado: {form.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {tipoSeleccionado?.nombre || 'Sin tipo'}
                </div>
                {form.capacidad && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    Capacidad: {form.capacidad} personas
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {horarios.length > 0
                    ? `${horarios.length} dia(s) disponible(s)`
                    : 'Sin horarios configurados'}
                </div>
              </div>
            </div>
          )}

          {/* Link a configuracion de tipos */}
          <div className="mt-6">
            <Link
              to="/admin/deportes/tipos-espacio"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary"
            >
              <Settings className="w-4 h-4" />
              Configurar tipos de espacio
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
