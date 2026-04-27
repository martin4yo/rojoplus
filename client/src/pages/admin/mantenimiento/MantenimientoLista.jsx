import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wrench, Search, LayoutGrid, List, AlertCircle, AlertTriangle, ArrowUp, ArrowDown, Calendar, MapPin, User } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const ESTADOS = [
  { value: 'PENDIENTE',  label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200', headerColor: 'bg-yellow-50 border-yellow-200' },
  { value: 'EN_PROCESO', label: 'En proceso', color: 'bg-blue-100 text-blue-800 border-blue-200',     headerColor: 'bg-blue-50 border-blue-200' },
  { value: 'RESUELTA',   label: 'Resuelta',   color: 'bg-green-100 text-green-800 border-green-200',  headerColor: 'bg-green-50 border-green-200' },
  { value: 'CANCELADA',  label: 'Cancelada',  color: 'bg-gray-100 text-gray-700 border-gray-200',     headerColor: 'bg-gray-50 border-gray-200' }
]

const PRIORIDADES = [
  { value: 'BAJA',     label: 'Baja',     color: 'text-gray-600',  icon: ArrowDown },
  { value: 'MEDIA',    label: 'Media',    color: 'text-blue-600',  icon: ArrowUp },
  { value: 'ALTA',     label: 'Alta',     color: 'text-orange-600', icon: AlertTriangle },
  { value: 'URGENTE',  label: 'Urgente',  color: 'text-red-600',   icon: AlertCircle }
]

const TIPOS = [
  { value: 'CORRECTIVO', label: 'Correctivo' },
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'MEJORA',     label: 'Mejora' }
]

export default function MantenimientoLista() {
  const navigate = useNavigate()

  const [vista, setVista] = useState('lista') // 'lista' | 'kanban'
  const [loading, setLoading] = useState(true)
  const [ordenes, setOrdenes] = useState([])
  const [responsables, setResponsables] = useState([])

  const [filtros, setFiltros] = useState({
    estado: '',
    prioridad: '',
    tipo: '',
    responsableId: '',
    q: ''
  })

  useEffect(() => {
    cargar()
    cargarResponsables()
  }, [])

  useEffect(() => {
    cargar()
  }, [filtros.estado, filtros.prioridad, filtros.tipo, filtros.responsableId])

  async function cargar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.estado) params.set('estado', filtros.estado)
      if (filtros.prioridad) params.set('prioridad', filtros.prioridad)
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.responsableId) params.set('responsableId', filtros.responsableId)
      if (filtros.q) params.set('q', filtros.q)
      const data = await api.get(`/admin/mantenimiento?${params.toString()}`)
      setOrdenes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando órdenes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarResponsables() {
    try {
      const data = await api.getFull('/admin/entidades?activo=true&limit=500')
      const todas = data?.data || data || []
      setResponsables(todas.filter(e => e.tipo === 'PERSONAL' || e.tipo === 'PROVEEDOR'))
    } catch (err) {
      console.error('Error cargando responsables:', err)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    cargar()
  }

  const ordenesPorEstado = useMemo(() => {
    const map = {}
    for (const e of ESTADOS) map[e.value] = []
    for (const o of ordenes) {
      if (map[o.estado]) map[o.estado].push(o)
    }
    return map
  }, [ordenes])

  function PrioridadBadge({ prioridad }) {
    const p = PRIORIDADES.find(x => x.value === prioridad) || PRIORIDADES[1]
    const Icon = p.icon
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${p.color}`}>
        <Icon className="w-3 h-3" /> {p.label}
      </span>
    )
  }

  function EstadoBadge({ estado }) {
    const e = ESTADOS.find(x => x.value === estado) || ESTADOS[0]
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${e.color}`}>{e.label}</span>
  }

  function OrdenCard({ orden }) {
    return (
      <div
        onClick={() => navigate(`/admin/mantenimiento/${orden.id}`)}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2 cursor-pointer hover:shadow-md transition"
      >
        <div className="flex items-start justify-between mb-2">
          <span className="font-mono text-xs text-gray-500">{orden.numero}</span>
          <PrioridadBadge prioridad={orden.prioridad} />
        </div>
        <p className="font-medium text-gray-800 mb-2 line-clamp-2">{orden.titulo}</p>
        <div className="space-y-1 text-xs text-gray-600">
          {(orden.espacio || orden.ubicacion) && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {orden.espacio?.nombre || orden.ubicacion}
            </div>
          )}
          {orden.responsable && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" /> {orden.responsable.razonSocial}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {new Date(orden.fechaApertura).toLocaleDateString()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100">
            <Wrench className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mantenimiento</h1>
            <p className="text-gray-500 text-sm">Órdenes de trabajo y reparaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setVista('lista')}
              className={`px-3 py-2 text-sm flex items-center gap-1 ${vista === 'lista' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" /> Lista
            </button>
            <button
              onClick={() => setVista('kanban')}
              className={`px-3 py-2 text-sm flex items-center gap-1 ${vista === 'kanban' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
          </div>
          {tienePermiso(PERMISOS.MANTENIMIENTO_GESTIONAR) && (
            <Button onClick={() => navigate('/admin/mantenimiento/nueva')}>
              <Plus className="w-4 h-4 mr-2" /> Nueva orden
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form onSubmit={handleBuscar} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por título, número o ubicación..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
              className="input-field w-full pl-9"
            />
          </div>
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} className="input-field">
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select value={filtros.prioridad} onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })} className="input-field">
            <option value="">Todas las prioridades</option>
            {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filtros.responsableId} onChange={(e) => setFiltros({ ...filtros, responsableId: e.target.value })} className="input-field">
            <option value="">Todos los responsables</option>
            {responsables.map(r => <option key={r.id} value={r.id}>{r.razonSocial}</option>)}
          </select>
        </div>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : ordenes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No hay órdenes de trabajo con esos filtros.</p>
        </div>
      ) : vista === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ESTADOS.map(estado => (
            <div key={estado.value} className={`rounded-lg border ${estado.headerColor}`}>
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${estado.color}`}>{estado.label}</span>
                <span className="text-xs text-gray-500">{ordenesPorEstado[estado.value].length}</span>
              </div>
              <div className="p-2 min-h-[100px] max-h-[70vh] overflow-y-auto">
                {ordenesPorEstado[estado.value].length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin órdenes</p>
                ) : (
                  ordenesPorEstado[estado.value].map(o => <OrdenCard key={o.id} orden={o} />)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Número</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Título</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Ubicación</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Responsable</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Prioridad</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Apertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ordenes.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/mantenimiento/${o.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-sm">{o.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{o.titulo}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{TIPOS.find(t => t.value === o.tipo)?.label}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {o.espacio?.nombre || o.ubicacion || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {o.responsable?.razonSocial || <span className="text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3"><PrioridadBadge prioridad={o.prioridad} /></td>
                    <td className="px-4 py-3"><EstadoBadge estado={o.estado} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(o.fechaApertura).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
