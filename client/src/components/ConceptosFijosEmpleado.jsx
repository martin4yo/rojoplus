import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Power } from 'lucide-react'
import { Button } from './Button'
import { useModal } from './Modal'
import api from '../services/api'
import LoadingSpinner from './LoadingSpinner'

export default function ConceptosFijosEmpleado({ entidadId, sueldoBasico }) {
  const { showModal, ModalComponent } = useModal()
  const [loading, setLoading] = useState(true)
  const [conceptos, setConceptos] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    conceptoId: '',
    valor: '',
    esPorcentaje: false,
    fechaInicio: '',
    fechaFin: '',
    activo: true,
    observaciones: ''
  })

  useEffect(() => {
    cargar()
  }, [entidadId])

  async function cargar() {
    setLoading(true)
    try {
      const [conceptosData, catalogoData] = await Promise.all([
        api.get(`/admin/entidades/${entidadId}/conceptos-liquidacion`),
        api.getFull('/admin/conceptos-liquidacion?activo=true')
      ])
      setConceptos(Array.isArray(conceptosData) ? conceptosData : [])
      setCatalogo((catalogoData?.data || catalogoData || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })))
    } catch (err) {
      console.error('Error cargando conceptos del empleado:', err)
    } finally {
      setLoading(false)
    }
  }

  function nuevo() {
    setForm({
      conceptoId: '',
      valor: '',
      esPorcentaje: false,
      fechaInicio: '',
      fechaFin: '',
      activo: true,
      observaciones: ''
    })
    setEditando('nuevo')
  }

  function editar(c) {
    setForm({
      conceptoId: c.conceptoId,
      valor: c.valor !== null ? String(c.valor) : '',
      esPorcentaje: !!c.esPorcentaje,
      fechaInicio: c.fechaInicio ? c.fechaInicio.slice(0, 10) : '',
      fechaFin: c.fechaFin ? c.fechaFin.slice(0, 10) : '',
      activo: c.activo,
      observaciones: c.observaciones || ''
    })
    setEditando(c.id)
  }

  async function guardar() {
    if (!form.conceptoId) {
      showModal({ type: 'warning', message: 'Seleccione un concepto' })
      return
    }
    setSaving(true)
    try {
      const data = {
        conceptoId: parseInt(form.conceptoId),
        valor: form.valor ? parseFloat(form.valor) : null,
        esPorcentaje: form.esPorcentaje,
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        activo: form.activo,
        observaciones: form.observaciones || null
      }
      if (editando === 'nuevo') {
        await api.post(`/admin/entidades/${entidadId}/conceptos-liquidacion`, data)
      } else {
        await api.put(`/admin/entidades/${entidadId}/conceptos-liquidacion/${editando}`, data)
      }
      setEditando(null)
      await cargar()
      showModal({ type: 'success', message: 'Concepto guardado' })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(c) {
    try {
      await api.put(`/admin/entidades/${entidadId}/conceptos-liquidacion/${c.id}`, { activo: !c.activo })
      await cargar()
    } catch (err) {
      showModal({ type: 'error', message: 'Error al actualizar' })
    }
  }

  async function eliminar(c) {
    showModal({
      type: 'warning',
      message: `¿Eliminar el concepto "${c.concepto?.nombre}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/entidades/${entidadId}/conceptos-liquidacion/${c.id}`)
          await cargar()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al eliminar' })
        }
      }
    })
  }

  function formatMonto(c) {
    if (c.valor !== null && c.valor !== undefined) {
      return c.esPorcentaje
        ? `${c.valor}% del básico`
        : `$${Number(c.valor).toLocaleString()}`
    }
    if (c.concepto?.porcentaje) return `${c.concepto.porcentaje}% del básico (catálogo)`
    if (c.concepto?.montoFijo) return `$${Number(c.concepto.montoFijo).toLocaleString()} (catálogo)`
    return '-'
  }

  function calcularPreview(c) {
    if (!sueldoBasico) return null
    const sb = parseFloat(sueldoBasico)
    let monto = 0
    if (c.valor !== null && c.valor !== undefined) {
      monto = c.esPorcentaje ? sb * parseFloat(c.valor) / 100 : parseFloat(c.valor)
    } else if (c.concepto?.porcentaje) {
      monto = sb * parseFloat(c.concepto.porcentaje) / 100
    } else if (c.concepto?.montoFijo) {
      monto = parseFloat(c.concepto.montoFijo)
    }
    return monto
  }

  if (loading) return <LoadingSpinner />

  // Excluir conceptos ya asignados al elegir uno nuevo
  const conceptosDisponibles = catalogo.filter(c => {
    if (editando && editando !== 'nuevo') return true
    return !conceptos.some(ce => ce.conceptoId === c.id)
  })

  return (
    <div>
      {ModalComponent}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Conceptos fijos del empleado</h2>
          <p className="text-sm text-gray-500">Se aplican automáticamente cada mes al generar la liquidación.</p>
        </div>
        {!editando && (
          <Button type="button" onClick={nuevo}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo concepto
          </Button>
        )}
      </div>

      {editando && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            {editando === 'nuevo' ? 'Nuevo concepto fijo' : 'Editar concepto fijo'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
              <select
                value={form.conceptoId}
                onChange={(e) => setForm({ ...form, conceptoId: e.target.value })}
                className="input-field w-full"
                disabled={editando !== 'nuevo'}
              >
                <option value="">Seleccionar...</option>
                <optgroup label="Haberes">
                  {conceptosDisponibles.filter(c => c.tipo === 'HABER').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </optgroup>
                <optgroup label="Deducciones">
                  {conceptosDisponibles.filter(c => c.tipo === 'DEDUCCION').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (override)</label>
                <input
                  type="number"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="Vacío = usar valor del catálogo"
                  step="0.01"
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-center gap-1 pb-2">
                <input
                  type="checkbox"
                  id="esPorcentaje"
                  checked={form.esPorcentaje}
                  onChange={(e) => setForm({ ...form, esPorcentaje: e.target.checked })}
                  className="w-4 h-4 rounded text-primary"
                />
                <label htmlFor="esPorcentaje" className="text-sm text-gray-700">%</label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigente desde</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigente hasta</label>
              <input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input
                type="checkbox"
                id="activoCE"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="w-4 h-4 rounded text-primary"
              />
              <label htmlFor="activoCE" className="text-sm font-medium text-gray-700">Activo</label>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <input
                type="text"
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {conceptos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">El empleado no tiene conceptos fijos asignados.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Concepto</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Valor</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Estimado</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Vigencia</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {conceptos.map(c => {
                const preview = calcularPreview(c)
                return (
                  <tr key={c.id} className={!c.activo ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{c.concepto?.nombre}</div>
                      <div className="text-xs text-gray-500 font-mono">{c.concepto?.codigo}</div>
                      {c.observaciones && <div className="text-xs text-gray-500 mt-1">{c.observaciones}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.concepto?.tipo === 'HABER' ? (
                        <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                          <TrendingUp className="w-4 h-4" /> Haber
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 text-sm">
                          <TrendingDown className="w-4 h-4" /> Deducción
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatMonto(c)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {preview !== null && preview > 0 ? `$${preview.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {c.fechaInicio || c.fechaFin ? (
                        <>
                          {c.fechaInicio ? new Date(c.fechaInicio).toLocaleDateString() : '...'}
                          {' → '}
                          {c.fechaFin ? new Date(c.fechaFin).toLocaleDateString() : '...'}
                        </>
                      ) : 'Sin límite'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => toggleActivo(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title={c.activo ? 'Desactivar' : 'Activar'}>
                          <Power className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => editar(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Editar">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => eliminar(c)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
