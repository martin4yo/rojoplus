import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Settings, TrendingUp, TrendingDown, Check } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

export default function ConceptosLiquidacion() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [conceptos, setConceptos] = useState([])
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form para editar/crear
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: 'HABER',
    descripcion: '',
    esFijo: false,
    porcentaje: '',
    montoFijo: '',
    orden: 0
  })

  useEffect(() => {
    cargarConceptos()
  }, [])

  async function cargarConceptos() {
    setLoading(true)
    try {
      const response = await api.getFull('/admin/conceptos-liquidacion')
      setConceptos(response.data || response || [])
    } catch (err) {
      console.error('Error cargando conceptos:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleNuevo() {
    setForm({
      codigo: '',
      nombre: '',
      tipo: 'HABER',
      descripcion: '',
      esFijo: false,
      porcentaje: '',
      montoFijo: '',
      orden: conceptos.length
    })
    setEditando('nuevo')
  }

  function handleEditar(concepto) {
    setForm({
      codigo: concepto.codigo,
      nombre: concepto.nombre,
      tipo: concepto.tipo,
      descripcion: concepto.descripcion || '',
      esFijo: concepto.esFijo,
      porcentaje: concepto.porcentaje?.toString() || '',
      montoFijo: concepto.montoFijo?.toString() || '',
      orden: concepto.orden
    })
    setEditando(concepto.id)
  }

  async function handleGuardar() {
    if (!form.codigo || !form.nombre) {
      showModal({ type: 'warning', message: 'Codigo y nombre son requeridos' })
      return
    }

    setSaving(true)
    try {
      const data = {
        codigo: form.codigo.toUpperCase(),
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion || null,
        esFijo: form.esFijo,
        porcentaje: form.porcentaje ? parseFloat(form.porcentaje) : null,
        montoFijo: form.montoFijo ? parseFloat(form.montoFijo) : null,
        orden: form.orden
      }

      if (editando === 'nuevo') {
        await api.post('/admin/conceptos-liquidacion', data)
      } else {
        await api.put(`/admin/conceptos-liquidacion/${editando}`, data)
      }

      setEditando(null)
      await cargarConceptos()
      showModal({ type: 'success', message: 'Concepto guardado correctamente' })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(concepto) {
    try {
      await api.put(`/admin/conceptos-liquidacion/${concepto.id}`, {
        activo: !concepto.activo
      })
      await cargarConceptos()
    } catch (err) {
      showModal({ type: 'error', message: 'Error al actualizar' })
    }
  }

  function formatMonto(monto) {
    if (!monto) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

  const haberes = conceptos.filter(c => c.tipo === 'HABER')
  const deducciones = conceptos.filter(c => c.tipo === 'DEDUCCION')

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100">
            <Settings className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Conceptos de Liquidacion</h1>
            <p className="text-gray-500 text-sm">Configure los conceptos para liquidaciones de sueldos</p>
          </div>
        </div>
{tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
          <Button onClick={handleNuevo}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Concepto
          </Button>
        )}
      </div>

      {/* Formulario de edicion */}
      {editando && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editando === 'nuevo' ? 'Nuevo Concepto' : 'Editar Concepto'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo *
              </label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="HORAS_EXTRA"
                className="input-field w-full font-mono"
                disabled={editando !== 'nuevo'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Horas Extra"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="input-field w-full"
              >
                <option value="HABER">Haber (suma)</option>
                <option value="DEDUCCION">Deduccion (resta)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <input
                type="text"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripcion opcional..."
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Orden
              </label>
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porcentaje del Sueldo
              </label>
              <input
                type="number"
                value={form.porcentaje}
                onChange={(e) => setForm({ ...form, porcentaje: e.target.value })}
                placeholder="Ej: 10"
                step="0.01"
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Si aplica % sobre sueldo basico</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto Fijo
              </label>
              <input
                type="number"
                value={form.montoFijo}
                onChange={(e) => setForm({ ...form, montoFijo: e.target.value })}
                placeholder="Ej: 5000"
                step="0.01"
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Si es un monto fijo para todos</p>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="esFijo"
                checked={form.esFijo}
                onChange={(e) => setForm({ ...form, esFijo: e.target.checked })}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <label htmlFor="esFijo" className="text-sm font-medium text-gray-700">
                Aplicar automaticamente a todos
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="secondary" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Haberes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
              <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Haberes (Suman)
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {haberes.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No hay conceptos de haberes</p>
              ) : (
                haberes.map((concepto) => (
                  <div
                    key={concepto.id}
                    className={`p-4 flex items-center justify-between ${!concepto.activo ? 'bg-gray-50 opacity-60' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{concepto.nombre}</p>
                        {concepto.esFijo && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            Automatico
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{concepto.codigo}</p>
                      {concepto.porcentaje && (
                        <p className="text-sm text-gray-600">{concepto.porcentaje}% del sueldo</p>
                      )}
                      {concepto.montoFijo && (
                        <p className="text-sm text-gray-600">{formatMonto(concepto.montoFijo)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
                        <button
                          onClick={() => handleToggleActivo(concepto)}
                          className={`p-2 rounded-lg ${concepto.activo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
                        <button
                          onClick={() => handleEditar(concepto)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Deducciones */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
              <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Deducciones (Restan)
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {deducciones.length === 0 ? (
                <p className="p-6 text-center text-gray-500">No hay conceptos de deducciones</p>
              ) : (
                deducciones.map((concepto) => (
                  <div
                    key={concepto.id}
                    className={`p-4 flex items-center justify-between ${!concepto.activo ? 'bg-gray-50 opacity-60' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{concepto.nombre}</p>
                        {concepto.esFijo && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            Automatico
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono">{concepto.codigo}</p>
                      {concepto.porcentaje && (
                        <p className="text-sm text-gray-600">{concepto.porcentaje}% del sueldo</p>
                      )}
                      {concepto.montoFijo && (
                        <p className="text-sm text-gray-600">{formatMonto(concepto.montoFijo)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
                        <button
                          onClick={() => handleToggleActivo(concepto)}
                          className={`p-2 rounded-lg ${concepto.activo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {tienePermiso(PERMISOS.SUELDOS_GESTIONAR) && (
                        <button
                          onClick={() => handleEditar(concepto)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h3 className="font-medium text-purple-800 mb-2">Informacion</h3>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>- Los conceptos marcados como "Automatico" se aplicaran a todos los empleados al generar la liquidacion</li>
          <li>- El sueldo basico siempre se aplica automaticamente desde la ficha del empleado</li>
          <li>- Puede agregar conceptos adicionales por empleado al editar la liquidacion</li>
        </ul>
      </div>
    </div>
  )
}
