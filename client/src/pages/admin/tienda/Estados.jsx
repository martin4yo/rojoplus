import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { GitBranch, Plus, Trash2, Save, ArrowRight } from 'lucide-react'
import { Button } from '../../../components/Button'
import PageHeader from '../../../components/PageHeader'
import LoadingSpinner from '../../../components/LoadingSpinner'
import Switch from '../../../components/Switch'
import api from '../../../services/api'

const FLAGS = [
  { key: 'isInitial',       label: 'Inicial',          help: 'Estado al crear un pedido (sólo uno)' },
  { key: 'isFinal',         label: 'Final',            help: 'Termina el flujo del pedido' },
  { key: 'permiteFacturar', label: 'Permite facturar', help: 'Habilita el botón de facturación' },
  { key: 'autoFacturar',    label: 'Auto-facturar',    help: 'Genera la factura automáticamente al entrar' },
  { key: 'notificaCliente', label: 'Notifica al cliente', help: 'Envía email al comprador en este estado' },
]

export default function Estados() {
  const [loading, setLoading] = useState(true)
  const [estados, setEstados] = useState([])
  const [transiciones, setTransiciones] = useState([])
  const [edit, setEdit] = useState(null)
  const [nuevaTrans, setNuevaTrans] = useState({ desdeId: '', hastaId: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true)
      const data = await api.get('/admin/tienda/estados')
      setEstados(data.estados || [])
      setTransiciones(data.transiciones || [])
    } finally { setLoading(false) }
  }

  function nuevoEstado() {
    setEdit({
      id: null, codigo: '', nombre: '', color: '#6B7280',
      isInitial: false, isFinal: false, permiteFacturar: false,
      autoFacturar: false, notificaCliente: true, ordenKanban: estados.length + 1, activo: true,
    })
  }

  async function guardarEstado() {
    try {
      if (edit.id) {
        await api.put(`/admin/tienda/estados/${edit.id}`, edit)
      } else {
        await api.post('/admin/tienda/estados', edit)
      }
      toast.success('Guardado')
      setEdit(null)
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function eliminarEstado(e) {
    if (!confirm(`¿Eliminar estado "${e.nombre}"?`)) return
    try {
      await api.delete(`/admin/tienda/estados/${e.id}`)
      toast.success('Eliminado')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function crearTransicion() {
    if (!nuevaTrans.desdeId || !nuevaTrans.hastaId) return
    try {
      await api.post('/admin/tienda/estados/transiciones', {
        desdeId: parseInt(nuevaTrans.desdeId), hastaId: parseInt(nuevaTrans.hastaId),
      })
      setNuevaTrans({ desdeId: '', hastaId: '' })
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function eliminarTransicion(id) {
    try {
      await api.delete(`/admin/tienda/estados/transiciones/${id}`)
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  const getEstado = id => estados.find(e => e.id === id)

  if (loading) return <div className="p-8"><LoadingSpinner /></div>

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      <PageHeader icon={GitBranch} title="Tienda — Estados de pedido" subtitle="Configurá el flujo de los pedidos">
        <Button onClick={nuevoEstado}><Plus className="w-4 h-4" /> Nuevo estado</Button>
      </PageHeader>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-app">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Orden</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Flags</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {estados.map(e => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-3">{e.ordenKanban}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: e.color }} />
                    <div>
                      <div className="font-medium">{e.nombre}</div>
                      <div className="text-xs text-muted">{e.codigo}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {e.isInitial && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">Inicial</span>}
                    {e.isFinal && <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-600">Final</span>}
                    {e.permiteFacturar && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Facturar</span>}
                    {e.autoFacturar && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">Auto-fact</span>}
                    {e.notificaCliente && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">Notifica</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button className="text-sm underline" onClick={() => setEdit({ ...e })}>Editar</button>
                  <button className="text-error" onClick={() => eliminarEstado(e)}><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transiciones */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold">Transiciones permitidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {transiciones.map(t => {
            const desde = getEstado(t.desdeId), hasta = getEstado(t.hastaId)
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-app rounded">
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${desde?.color}20`, color: desde?.color }}>{desde?.nombre || '?'}</span>
                  <ArrowRight className="w-4 h-4 text-muted" />
                  <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${hasta?.color}20`, color: hasta?.color }}>{hasta?.nombre || '?'}</span>
                </div>
                <button className="text-error" onClick={() => eliminarTransicion(t.id)}><Trash2 className="w-4 h-4" /></button>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 items-end pt-3 border-t">
          <select className="input-field flex-1" value={nuevaTrans.desdeId} onChange={e => setNuevaTrans({ ...nuevaTrans, desdeId: e.target.value })}>
            <option value="">Desde...</option>
            {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select className="input-field flex-1" value={nuevaTrans.hastaId} onChange={e => setNuevaTrans({ ...nuevaTrans, hastaId: e.target.value })}>
            <option value="">Hasta...</option>
            {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <Button onClick={crearTransicion}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Modal de edición de estado */}
      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">{edit.id ? 'Editar estado' : 'Nuevo estado'}</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Código *</label>
              <input type="text" className="input-field w-full uppercase" value={edit.codigo} onChange={e => setEdit({ ...edit, codigo: e.target.value.toUpperCase() })} disabled={!!edit.id} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input type="text" className="input-field w-full" value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} />
            </div>

            <div className="flex gap-3 items-center">
              <label className="block text-sm font-medium">Color</label>
              <input type="color" className="w-10 h-10 cursor-pointer rounded" value={edit.color} onChange={e => setEdit({ ...edit, color: e.target.value })} />
              <input type="number" className="input-field w-20" value={edit.ordenKanban} onChange={e => setEdit({ ...edit, ordenKanban: parseInt(e.target.value) || 0 })} placeholder="Orden" />
            </div>

            <div className="space-y-3">
              {FLAGS.map(f => (
                <div key={f.key} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted">{f.help}</div>
                  </div>
                  <Switch
                    checked={!!edit[f.key]}
                    onChange={v => setEdit({ ...edit, [f.key]: v })}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={guardarEstado}><Save className="w-4 h-4" /> Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
