import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Edit, Calendar, FileText, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function NovedadesLiquidacion() {
  const { showModal, ModalComponent } = useModal()
  const hoy = new Date()

  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [loading, setLoading] = useState(true)
  const [novedades, setNovedades] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [conceptos, setConceptos] = useState([])

  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    entidadId: '',
    conceptoId: '',
    importe: '',
    observaciones: ''
  })

  useEffect(() => {
    cargarMaestros()
  }, [])

  useEffect(() => {
    cargarNovedades()
  }, [mes, anio])

  async function cargarMaestros() {
    try {
      const [empData, conceptosData] = await Promise.all([
        api.getFull('/admin/entidades?tipo=PERSONAL&activo=true&limit=500'),
        api.getFull('/admin/conceptos-liquidacion?activo=true')
      ])
      setEmpleados(empData?.data || empData || [])
      setConceptos(conceptosData?.data || conceptosData || [])
    } catch (err) {
      console.error('Error cargando maestros:', err)
    }
  }

  async function cargarNovedades() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/novedades-liquidacion?mes=${mes}&anio=${anio}`)
      setNovedades(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando novedades:', err)
    } finally {
      setLoading(false)
    }
  }

  function nuevo() {
    setForm({ entidadId: '', conceptoId: '', importe: '', observaciones: '' })
    setEditando('nuevo')
  }

  function editar(n) {
    setForm({
      entidadId: n.entidadId,
      conceptoId: n.conceptoId,
      importe: String(n.importe),
      observaciones: n.observaciones || ''
    })
    setEditando(n.id)
  }

  async function guardar() {
    if (editando === 'nuevo') {
      if (!form.entidadId || !form.conceptoId || !form.importe) {
        showModal({ type: 'warning', message: 'Empleado, concepto e importe son requeridos' })
        return
      }
    }
    setSaving(true)
    try {
      if (editando === 'nuevo') {
        await api.post('/admin/novedades-liquidacion', {
          entidadId: parseInt(form.entidadId),
          conceptoId: parseInt(form.conceptoId),
          mes,
          anio,
          importe: parseFloat(form.importe),
          observaciones: form.observaciones || null
        })
      } else {
        await api.put(`/admin/novedades-liquidacion/${editando}`, {
          importe: parseFloat(form.importe),
          observaciones: form.observaciones || null
        })
      }
      setEditando(null)
      await cargarNovedades()
      showModal({ type: 'success', message: 'Novedad guardada' })
    } catch (err) {
      showModal({ type: 'error', message: err.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(n) {
    showModal({
      type: 'warning',
      message: `¿Eliminar la novedad de ${n.entidad?.razonSocial} - ${n.concepto?.nombre}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/novedades-liquidacion/${n.id}`)
          await cargarNovedades()
        } catch (err) {
          showModal({ type: 'error', message: err.message || 'Error al eliminar' })
        }
      }
    })
  }

  const totales = useMemo(() => {
    let haberes = 0, deducciones = 0
    for (const n of novedades) {
      const m = parseFloat(n.importe) || 0
      if (n.concepto?.tipo === 'HABER') haberes += m
      else deducciones += m
    }
    return { haberes, deducciones, neto: haberes - deducciones, cantidad: novedades.length }
  }, [novedades])

  const aniosDisponibles = useMemo(() => {
    const actual = hoy.getFullYear()
    return [actual + 1, actual, actual - 1, actual - 2]
  }, [])

  return (
    <div>
      {ModalComponent}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100">
            <FileText className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Novedades de Liquidación</h1>
            <p className="text-gray-500 text-sm">Conceptos variables que se aplican solo en este período</p>
          </div>
        </div>
        {!editando && (
          <Button onClick={nuevo}>
            <Plus className="w-4 h-4 mr-2" /> Nueva novedad
          </Button>
        )}
      </div>

      {/* Filtros de período + totales, todo en una sola fila. flex-nowrap para que
          no se parta; si la pantalla es muy angosta scrollea en horizontal. */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex flex-nowrap items-center gap-4 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Período:</span>
        </div>
        <select
          value={mes}
          onChange={(e) => setMes(parseInt(e.target.value))}
          className="input-field w-auto shrink-0"
        >
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={anio}
          onChange={(e) => setAnio(parseInt(e.target.value))}
          className="input-field w-auto shrink-0"
        >
          {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="flex-1 min-w-4" />

        <div className="flex gap-6 text-sm shrink-0 whitespace-nowrap">
          <div>
            <span className="text-gray-500">Novedades: </span>
            <span className="font-semibold text-gray-800">{totales.cantidad}</span>
          </div>
          <div>
            <span className="text-gray-500">Haberes: </span>
            <span className="font-semibold text-green-700">${totales.haberes.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Deducciones: </span>
            <span className="font-semibold text-red-700">${totales.deducciones.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Neto: </span>
            <span className={`font-semibold ${totales.neto >= 0 ? 'text-gray-800' : 'text-red-700'}`}>
              ${totales.neto.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      {editando && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            {editando === 'nuevo' ? `Nueva novedad — ${MESES[mes - 1]} ${anio}` : 'Editar novedad'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empleado *</label>
              <select
                value={form.entidadId}
                onChange={(e) => setForm({ ...form, entidadId: e.target.value })}
                className="input-field w-full"
                disabled={editando !== 'nuevo'}
              >
                <option value="">Seleccionar...</option>
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.razonSocial} {e.legajo ? `(Leg. ${e.legajo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
              <select
                value={form.conceptoId}
                onChange={(e) => setForm({ ...form, conceptoId: e.target.value })}
                className="input-field w-full"
                disabled={editando !== 'nuevo'}
              >
                <option value="">Seleccionar...</option>
                <optgroup label="Haberes">
                  {conceptos.filter(c => c.tipo === 'HABER').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </optgroup>
                <optgroup label="Deducciones">
                  {conceptos.filter(c => c.tipo === 'DEDUCCION').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe *</label>
              <input
                type="number"
                step="0.01"
                value={form.importe}
                onChange={(e) => setForm({ ...form, importe: e.target.value })}
                className="input-field w-full"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <input
                type="text"
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                className="input-field w-full"
                placeholder="Detalle opcional..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : novedades.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No hay novedades cargadas para {MESES[mes - 1]} {anio}.</p>
          <p className="text-sm text-gray-400 mt-1">Cargá novedades antes de generar la liquidación del período.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Empleado</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Concepto</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Importe</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Observaciones</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {novedades.map(n => (
                <tr key={n.id} className={n.aplicada ? 'bg-blue-50/40' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{n.entidad?.razonSocial}</div>
                    {n.entidad?.legajo && <div className="text-xs text-gray-500">Leg. {n.entidad.legajo}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800">{n.concepto?.nombre}</div>
                    <div className="text-xs text-gray-500 font-mono">{n.concepto?.codigo}</div>
                  </td>
                  <td className="px-4 py-3">
                    {n.concepto?.tipo === 'HABER' ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                        <TrendingUp className="w-4 h-4" /> Haber
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 text-sm">
                        <TrendingDown className="w-4 h-4" /> Deducción
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${Number(n.importe).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{n.observaciones || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {n.aplicada ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3" /> Aplicada
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {!n.aplicada && (
                        <>
                          <button onClick={() => editar(n)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => eliminar(n)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h3 className="font-medium text-purple-800 mb-2">Cómo funcionan las novedades</h3>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>- Las novedades se cargan <b>antes</b> de generar la liquidación del período.</li>
          <li>- Al generar la liquidación de {MESES[mes - 1]} {anio}, las novedades pendientes se aplican y quedan marcadas como "Aplicada".</li>
          <li>- Si se anula la liquidación, las novedades vuelven a quedar disponibles.</li>
          <li>- Las novedades aplicadas no pueden modificarse ni eliminarse.</li>
        </ul>
      </div>
    </div>
  )
}
