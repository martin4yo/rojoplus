import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, Upload, User, AlertTriangle, Users } from 'lucide-react'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

// Modal de confirmación personalizado
function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary-dark"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

const SECCIONES = [
  { key: 'COMISION_DIRECTIVA', label: 'Comisión Directiva', color: 'red' },
  { key: 'VOCALES', label: 'Vocales', color: 'green' },
  { key: 'REVISORES', label: 'Revisores de Cuentas', color: 'blue' },
  { key: 'SUBCOMISIONES', label: 'Subcomisiones', color: 'purple' },
]

const TIPOS = [
  { value: 'TITULAR', label: 'Titular' },
  { value: 'SUPLENTE', label: 'Suplente' },
]

export default function Autoridades() {
  const [autoridades, setAutoridades] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // id de la autoridad que se está editando
  const [formData, setFormData] = useState({})
  const [agregando, setAgregando] = useState(null) // sección donde se está agregando
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null, action: null })
  const [periodoComision, setPeriodoComision] = useState('Período 2024 - 2026')
  const [editandoPeriodo, setEditandoPeriodo] = useState(false)

  useEffect(() => {
    fetchAutoridades()
    fetchPeriodo()
  }, [])

  const fetchAutoridades = async () => {
    try {
      const data = await api.get('/admin/autoridades')
      setAutoridades(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error:', error)
      setMensaje({ tipo: 'error', texto: 'Error al cargar autoridades' })
      setAutoridades([])
    } finally {
      setLoading(false)
    }
  }

  const fetchPeriodo = async () => {
    try {
      const data = await api.get('/admin/autoridades/config/periodo')
      if (data?.periodo) {
        setPeriodoComision(data.periodo)
      }
    } catch (error) {
      console.error('Error cargando período:', error)
    }
  }

  const handleSavePeriodo = async () => {
    try {
      await api.put('/admin/autoridades/config/periodo', { periodo: periodoComision })
      setMensaje({ tipo: 'success', texto: 'Período actualizado' })
      setEditandoPeriodo(false)
    } catch (error) {
      console.error('Error:', error)
      setMensaje({ tipo: 'error', texto: 'Error al guardar período' })
    }
  }

  const handleEdit = (autoridad) => {
    setEditando(autoridad.id)
    setFormData({ ...autoridad })
    setAgregando(null)
  }

  const handleCancelEdit = () => {
    setEditando(null)
    setFormData({})
    setAgregando(null)
  }

  const handleAgregar = (seccion) => {
    setAgregando(seccion)
    setEditando(null)
    setFormData({
      seccion,
      nombre: '',
      cargo: '',
      tipo: 'TITULAR',
      desde: new Date().getFullYear().toString(),
      email: '',
      telefono: '',
      foto: '',
      descripcion: '',
      responsable: '',
      activo: true
    })
  }

  const handleSave = async () => {
    if (!formData.nombre) {
      setMensaje({ tipo: 'error', texto: 'El nombre es requerido' })
      return
    }

    setGuardando(true)
    try {
      if (editando) {
        await api.put(`/admin/autoridades/${editando}`, formData)
        setMensaje({ tipo: 'success', texto: 'Autoridad actualizada' })
      } else {
        await api.post('/admin/autoridades', formData)
        setMensaje({ tipo: 'success', texto: 'Autoridad creada' })
      }
      await fetchAutoridades()
      handleCancelEdit()
    } catch (error) {
      console.error('Error:', error)
      setMensaje({ tipo: 'error', texto: 'Error al guardar' })
    } finally {
      setGuardando(false)
    }
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ open: true, id, action: 'delete' })
  }

  const handleDeleteConfirm = async () => {
    const id = confirmModal.id
    try {
      await api.delete(`/admin/autoridades/${id}`)
      setMensaje({ tipo: 'success', texto: 'Autoridad eliminada' })
      await fetchAutoridades()
    } catch (error) {
      console.error('Error:', error)
      setMensaje({ tipo: 'error', texto: 'Error al eliminar' })
    }
  }

  const handleMover = async (id, direccion) => {
    const seccionActual = (autoridades || []).find(a => a.id === id)?.seccion
    const itemsSeccion = (autoridades || []).filter(a => a.seccion === seccionActual).sort((a, b) => a.orden - b.orden)
    const idx = itemsSeccion.findIndex(a => a.id === id)

    if (direccion === 'up' && idx === 0) return
    if (direccion === 'down' && idx === itemsSeccion.length - 1) return

    const newIdx = direccion === 'up' ? idx - 1 : idx + 1
    const itemsReordenados = [...itemsSeccion]
    ;[itemsReordenados[idx], itemsReordenados[newIdx]] = [itemsReordenados[newIdx], itemsReordenados[idx]]

    const updates = itemsReordenados.map((item, i) => ({ id: item.id, orden: i + 1 }))

    try {
      await api.put('/admin/autoridades/reordenar/batch', { items: updates })
      await fetchAutoridades()
    } catch (error) {
      console.error('Error:', error)
      setMensaje({ tipo: 'error', texto: 'Error al reordenar' })
    }
  }

  const handleFotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, foto: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSeedClick = () => {
    setConfirmModal({ open: true, id: null, action: 'seed' })
  }

  const handleSeedConfirm = async () => {
    try {
      await api.post('/admin/autoridades/seed')
      setMensaje({ tipo: 'success', texto: 'Datos de ejemplo cargados' })
      await fetchAutoridades()
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message || 'Error al cargar datos' })
    }
  }

  const handleConfirmAction = () => {
    if (confirmModal.action === 'delete') {
      handleDeleteConfirm()
    } else if (confirmModal.action === 'seed') {
      handleSeedConfirm()
    }
  }

  const getAutoridadesPorSeccion = (seccion) => {
    return (autoridades || []).filter(a => a.seccion === seccion).sort((a, b) => a.orden - b.orden)
  }

  const renderFormulario = (seccion) => {
    const esComision = seccion === 'COMISION_DIRECTIVA'
    const esVocalRevisor = seccion === 'VOCALES' || seccion === 'REVISORES'
    const esSubcomision = seccion === 'SUBCOMISIONES'

    return (
      <div className="bg-white p-4 rounded-lg border-2 border-primary/30 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Foto */}
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
              {formData.foto ? (
                <img src={formData.foto} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Subir foto
              <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
            </label>
          </div>

          {/* Nombre */}
          <div className={esSubcomision ? '' : 'md:col-span-2'}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {esSubcomision ? 'Nombre de la Subcomisión' : 'Nombre completo'}
            </label>
            <input
              type="text"
              value={formData.nombre || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              placeholder={esSubcomision ? 'Ej: Subcomisión de Básquet' : 'Ej: Juan Pérez'}
            />
          </div>

          {/* Cargo (solo Comisión) */}
          {esComision && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <input
                type="text"
                value={formData.cargo || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Ej: Presidente"
              />
            </div>
          )}

          {/* Tipo (Vocales y Revisores) */}
          {esVocalRevisor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={formData.tipo || 'TITULAR'}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Responsable (Subcomisiones) */}
          {esSubcomision && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <input
                type="text"
                value={formData.responsable || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Nombre del responsable"
              />
            </div>
          )}

          {/* Desde (Comisión) */}
          {esComision && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde (año)</label>
              <input
                type="text"
                value={formData.desde || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, desde: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="2024"
              />
            </div>
          )}

          {/* Email */}
          {!esSubcomision && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="email@ejemplo.com"
              />
            </div>
          )}

          {/* Descripción (Subcomisiones) */}
          {esSubcomision && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={formData.descripcion || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                rows={2}
                placeholder="Descripción de las funciones..."
              />
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={guardando}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const renderTarjeta = (autoridad, seccion) => {
    const esComision = seccion === 'COMISION_DIRECTIVA'
    const esVocalRevisor = seccion === 'VOCALES' || seccion === 'REVISORES'
    const esSubcomision = seccion === 'SUBCOMISIONES'

    if (editando === autoridad.id) {
      return renderFormulario(seccion)
    }

    return (
      <div className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow group">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
            {autoridad.foto ? (
              <img src={autoridad.foto} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 font-semibold">
                {autoridad.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {esComision && (
              <span className="text-primary text-xs font-semibold uppercase">{autoridad.cargo}</span>
            )}
            {esVocalRevisor && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                autoridad.tipo === 'TITULAR' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {autoridad.tipo === 'TITULAR' ? 'Titular' : 'Suplente'}
              </span>
            )}
            <h4 className="font-semibold text-gray-900 truncate">{autoridad.nombre}</h4>
            {esComision && autoridad.desde && (
              <p className="text-gray-500 text-sm">Desde {autoridad.desde}</p>
            )}
            {esComision && autoridad.email && (
              <p className="text-gray-500 text-xs truncate">{autoridad.email}</p>
            )}
            {esSubcomision && autoridad.responsable && (
              <p className="text-gray-500 text-sm">Resp: {autoridad.responsable}</p>
            )}
            {esSubcomision && autoridad.descripcion && (
              <p className="text-gray-500 text-xs line-clamp-2">{autoridad.descripcion}</p>
            )}
          </div>

          {/* Acciones */}
          {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleMover(autoridad.id, 'up')}
                className="p-1 hover:bg-gray-100 rounded"
                title="Subir"
              >
                <ChevronUp className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => handleMover(autoridad.id, 'down')}
                className="p-1 hover:bg-gray-100 rounded"
                title="Bajar"
              >
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => handleEdit(autoridad)}
                className="p-1 hover:bg-primary/10 rounded"
                title="Editar"
              >
                <Edit2 className="w-4 h-4 text-blue-600" />
              </button>
              <button
                onClick={() => handleDeleteClick(autoridad.id)}
                className="p-1 hover:bg-primary/10 rounded"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Autoridades del Club</h1>
            <p className="text-sm text-gray-500">Gestiona la información de las autoridades</p>
          </div>
        </div>
        {autoridades?.length === 0 && (
          <button
            onClick={handleSeedClick}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            Cargar datos de ejemplo
          </button>
        )}
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className={`mb-4 p-3 rounded-lg ${
          mensaje.tipo === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {mensaje.texto}
          <button onClick={() => setMensaje(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Secciones */}
      <div className="space-y-8">
        {SECCIONES.map(seccion => (
          <div key={seccion.key} className="bg-gray-50 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{seccion.label}</h2>
                {seccion.key === 'COMISION_DIRECTIVA' && (
                  <div className="flex items-center gap-2 mt-1">
                    {editandoPeriodo ? (
                      <>
                        <input
                          type="text"
                          value={periodoComision}
                          onChange={(e) => setPeriodoComision(e.target.value)}
                          className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary"
                          placeholder="Ej: Período 2024 - 2026"
                        />
                        <button
                          onClick={handleSavePeriodo}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditandoPeriodo(false)}
                          className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500 text-sm">{periodoComision}</span>
                        <button
                          onClick={() => setEditandoPeriodo(true)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Editar período"
                        >
                          <Edit2 className="w-3 h-3 text-gray-500" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {tienePermiso(PERMISOS.CONTENIDO_GESTIONAR) && (
                <button
                  onClick={() => handleAgregar(seccion.key)}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-1 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              )}
            </div>

            {/* Formulario de agregar */}
            {agregando === seccion.key && (
              <div className="mb-4">
                {renderFormulario(seccion.key)}
              </div>
            )}

            {/* Lista de autoridades */}
            <div className={`grid gap-3 ${
              seccion.key === 'SUBCOMISIONES' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {getAutoridadesPorSeccion(seccion.key).map(autoridad => (
                <div key={autoridad.id}>
                  {renderTarjeta(autoridad, seccion.key)}
                </div>
              ))}
            </div>

            {getAutoridadesPorSeccion(seccion.key).length === 0 && !agregando && (
              <p className="text-gray-500 text-center py-8">
                No hay {seccion.label.toLowerCase()} cargados
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, id: null, action: null })}
        onConfirm={handleConfirmAction}
        title={confirmModal.action === 'seed' ? 'Cargar datos' : 'Eliminar autoridad'}
        message={confirmModal.action === 'seed'
          ? '¿Cargar datos de ejemplo? Solo funciona si no hay autoridades cargadas.'
          : '¿Está seguro que desea eliminar esta autoridad?'
        }
      />
    </div>
  )
}
