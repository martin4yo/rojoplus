import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import { Button } from '../../../components/Button'

export default function EntrenadorTab({ entidadId, entidad }) {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [actividades, setActividades] = useState([])
  const [categoriasAsignadas, setCategoriasAsignadas] = useState([])
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)

  const [form, setForm] = useState({
    especialidad: '',
    observaciones: '',
    activo: true,
    mostrarEnWeb: false,
    fotoStaff: '',
    biografiaStaff: '',
    emailPublico: '',
    telefonoPublico: '',
    ordenStaff: 0,
  })

  async function cargar() {
    setCargando(true)
    try {
      const [p, cats, acts] = await Promise.all([
        api.get(`/admin/entidades/${entidadId}/entrenador`),
        api.get(`/admin/entidades/${entidadId}/entrenador/categorias`),
        api.getFull('/admin/actividades?activo=true'),
      ])
      setPerfil(p)
      setCategoriasAsignadas(Array.isArray(cats) ? cats : [])
      setActividades(acts.data || [])
      if (p) {
        setForm({
          especialidad: p.especialidad || '',
          observaciones: p.observaciones || '',
          activo: p.activo !== false,
          mostrarEnWeb: !!p.mostrarEnWeb,
          fotoStaff: p.fotoStaff || '',
          biografiaStaff: p.biografiaStaff || '',
          emailPublico: p.emailPublico || '',
          telefonoPublico: p.telefonoPublico || '',
          ordenStaff: p.ordenStaff || 0,
        })
      }
    } catch (err) {
      toast.error(err.message || 'Error cargando perfil entrenador')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [entidadId])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function guardar() {
    setGuardando(true)
    try {
      await api.put(`/admin/entidades/${entidadId}/entrenador`, form)
      toast.success(perfil ? 'Perfil entrenador actualizado' : 'Perfil entrenador creado')
      await cargar()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="text-sm text-gray-500 py-8 text-center">Cargando…</div>

  return (
    <div className="space-y-6">
      {!perfil && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">Esta entidad aún no tiene perfil de entrenador.</p>
            <p className="text-amber-700 mt-1">Al guardar se creará automáticamente. También se crea al asignar la primera categoría.</p>
          </div>
        </div>
      )}

      {/* Datos del rol */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Datos del rol</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
            <input
              type="text"
              name="especialidad"
              value={form.especialidad}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="Ej: Preparación física, Arquero, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <input
              type="text"
              name="observaciones"
              value={form.observaciones}
              onChange={handleChange}
              className="input-field w-full"
            />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} className="w-4 h-4" />
          <span className="text-sm">Activo</span>
        </label>
      </div>

      {/* Datos staff web */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Sitio público — staff técnico</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mostrarEnWeb" checked={form.mostrarEnWeb} onChange={handleChange} className="w-4 h-4" />
            <span className="flex items-center gap-1">
              {form.mostrarEnWeb ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              Mostrar en sitio público
            </span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto (URL)</label>
            <input
              type="text"
              name="fotoStaff"
              value={form.fotoStaff}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orden en lista</label>
            <input
              type="number"
              name="ordenStaff"
              value={form.ordenStaff}
              onChange={handleChange}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email público</label>
            <input
              type="email"
              name="emailPublico"
              value={form.emailPublico}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="contacto@club.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono público</label>
            <input
              type="text"
              name="telefonoPublico"
              value={form.telefonoPublico}
              onChange={handleChange}
              className="input-field w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Biografía</label>
          <textarea
            name="biografiaStaff"
            value={form.biografiaStaff}
            onChange={handleChange}
            rows={3}
            className="input-field w-full"
            placeholder="Trayectoria del entrenador para mostrar en el sitio público…"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={guardar} loading={guardando}>
          Guardar perfil
        </Button>
      </div>

      {/* Categorías asignadas */}
      <CategoriasAsignadas
        entidadId={entidadId}
        actividades={actividades}
        categoriasAsignadas={categoriasAsignadas}
        onChange={cargar}
      />
    </div>
  )
}

function CategoriasAsignadas({ entidadId, actividades, categoriasAsignadas, onChange }) {
  const [actividadSel, setActividadSel] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')
  const [rol, setRol] = useState('ENTRENADOR')
  const [agregando, setAgregando] = useState(false)

  const actividadObj = actividades.find(a => a.id === parseInt(actividadSel))
  const categoriasDisponibles = actividadObj?.categorias?.filter(
    c => c.activo && !categoriasAsignadas.some(ca => ca.categoriaActividadId === c.id)
  ) || []

  async function agregar() {
    if (!categoriaSel) return
    setAgregando(true)
    try {
      await api.post(`/admin/entidades/${entidadId}/entrenador/categorias`, {
        categoriaActividadId: parseInt(categoriaSel),
        rol,
      })
      toast.success('Categoría asignada')
      setActividadSel('')
      setCategoriaSel('')
      setRol('ENTRENADOR')
      onChange()
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally {
      setAgregando(false)
    }
  }

  async function quitar(relId) {
    if (!confirm('¿Quitar esta categoría?')) return
    try {
      await api.delete(`/admin/entidades/${entidadId}/entrenador/categorias/${relId}`)
      toast.success('Categoría quitada')
      onChange()
    } catch (err) {
      toast.error(err.message || 'Error')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">Categorías asignadas</h3>

      {/* Asignar nueva */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-blue-900 mb-1">Actividad</label>
            <select value={actividadSel} onChange={(e) => { setActividadSel(e.target.value); setCategoriaSel('') }} className="input-field w-full text-sm">
              <option value="">Elegir…</option>
              {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-blue-900 mb-1">Categoría</label>
            <select value={categoriaSel} onChange={(e) => setCategoriaSel(e.target.value)} className="input-field w-full text-sm" disabled={!actividadSel}>
              <option value="">{actividadSel ? 'Elegir…' : '—'}</option>
              {categoriasDisponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-blue-900 mb-1">Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="input-field w-full text-sm">
              <option value="ENTRENADOR">Entrenador</option>
              <option value="AYUDANTE">Ayudante</option>
              <option value="PREPARADOR">Preparador físico</option>
              <option value="DELEGADO">Delegado</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={agregar} loading={agregando} disabled={!categoriaSel} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Asignar
            </Button>
          </div>
        </div>
      </div>

      {/* Lista */}
      {categoriasAsignadas.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">No hay categorías asignadas.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {categoriasAsignadas.map(rel => (
            <div key={rel.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">
                  {rel.categoriaActividad?.actividad?.nombre} · {rel.categoriaActividad?.nombre}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {rel.rol} · desde {new Date(rel.fechaDesde).toLocaleDateString('es-AR')}
                  {rel.fechaHasta && ` · hasta ${new Date(rel.fechaHasta).toLocaleDateString('es-AR')}`}
                </div>
              </div>
              <button onClick={() => quitar(rel.id)} className="text-red-600 hover:text-red-700 p-2 rounded hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
