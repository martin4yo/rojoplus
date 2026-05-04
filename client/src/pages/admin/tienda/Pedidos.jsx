import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShoppingBag, LayoutGrid, List, Search, RefreshCw, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import PageHeader from '../../../components/PageHeader'
import LoadingSpinner from '../../../components/LoadingSpinner'
import api from '../../../services/api'

const PAYMENT_STATUS_LABEL = {
  pending: 'Pago pendiente',
  paid: 'Pagado',
  expired: 'Expirado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-AR')}`
}

export default function PedidosTienda() {
  const [vista, setVista] = useState(() => localStorage.getItem('tiendaPedidosVista') || 'kanban')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ estados: [], pedidosPorEstado: {} })
  const [lista, setLista] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroPaymentStatus, setFiltroPaymentStatus] = useState('')

  useEffect(() => { localStorage.setItem('tiendaPedidosVista', vista) }, [vista])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 15000) // refresh cada 15s
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, busqueda, filtroPaymentStatus])

  async function cargar() {
    try {
      setLoading(true)
      if (vista === 'kanban') {
        const d = await api.get('/admin/tienda/pedidos/kanban')
        setData(d)
      } else {
        const params = new URLSearchParams()
        if (busqueda) params.append('q', busqueda)
        if (filtroPaymentStatus) params.append('paymentStatus', filtroPaymentStatus)
        const r = await api.get(`/admin/tienda/pedidos?${params}`)
        setLista(r.items || [])
      }
    } catch (err) {
      toast.error(err.message || 'Error cargando pedidos')
    } finally {
      setLoading(false)
    }
  }

  async function moverEstado(pedidoId, nuevoEstadoId) {
    try {
      await api.post(`/admin/tienda/pedidos/${pedidoId}/cambiar-estado`, { nuevoEstadoId })
      toast.success('Estado actualizado')
      cargar()
    } catch (err) {
      toast.error(err.message || 'No se pudo cambiar el estado')
    }
  }

  function onDragStart(e, pedidoId, estadoActualId) {
    e.dataTransfer.setData('pedidoId', pedidoId)
    e.dataTransfer.setData('estadoActualId', estadoActualId)
  }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e, nuevoEstadoId) {
    e.preventDefault()
    const pedidoId = parseInt(e.dataTransfer.getData('pedidoId'))
    const estadoActualId = parseInt(e.dataTransfer.getData('estadoActualId'))
    if (!pedidoId || estadoActualId === nuevoEstadoId) return
    moverEstado(pedidoId, nuevoEstadoId)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader icon={ShoppingBag} title="Tienda — Pedidos" subtitle="Pedidos online de los compradores">
        <button className="btn-secondary" onClick={cargar}><RefreshCw className="w-4 h-4" /></button>
        <div className="inline-flex items-center bg-app rounded-md p-0.5">
          <button
            className={`px-3 py-1.5 text-sm rounded ${vista === 'kanban' ? 'bg-surface shadow' : 'text-muted'}`}
            onClick={() => setVista('kanban')}
          ><LayoutGrid className="w-4 h-4 inline" /> Kanban</button>
          <button
            className={`px-3 py-1.5 text-sm rounded ${vista === 'lista' ? 'bg-surface shadow' : 'text-muted'}`}
            onClick={() => setVista('lista')}
          ><List className="w-4 h-4 inline" /> Lista</button>
        </div>
      </PageHeader>

      {vista === 'lista' && (
        <div className="card p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text" placeholder="Buscar por número, comprador, email..."
              className="input-field pl-10 w-full"
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select className="input-field" value={filtroPaymentStatus} onChange={e => setFiltroPaymentStatus(e.target.value)}>
            <option value="">Todos los pagos</option>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="p-8"><LoadingSpinner /></div>
      ) : vista === 'kanban' ? (
        <KanbanView data={data} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} />
      ) : (
        <ListaView lista={lista} />
      )}
    </div>
  )
}

function KanbanView({ data, onDragStart, onDragOver, onDrop }) {
  const { estados, pedidosPorEstado } = data
  if (!estados || estados.length === 0) {
    return <div className="card p-8 text-center text-muted">No hay estados configurados. Andá a "Estados" para crearlos.</div>
  }
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-h-[60vh]" style={{ width: 'max-content' }}>
        {estados.map(estado => (
          <div
            key={estado.id}
            className="w-80 flex-shrink-0 bg-app rounded-lg flex flex-col"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, estado.id)}
          >
            <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-app rounded-t-lg" style={{ borderColor: estado.color, borderTopWidth: 3 }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: estado.color }} />
                <span className="font-medium text-sm">{estado.nombre}</span>
              </div>
              <span className="text-xs text-muted">{(pedidosPorEstado[estado.id] || []).length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {(pedidosPorEstado[estado.id] || []).map(p => (
                <KanbanCard key={p.id} pedido={p} onDragStart={onDragStart} />
              ))}
              {(!pedidosPorEstado[estado.id] || pedidosPorEstado[estado.id].length === 0) && (
                <div className="text-xs text-muted text-center py-6 opacity-50">— vacío —</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KanbanCard({ pedido, onDragStart }) {
  return (
    <Link
      to={`/admin/tienda/pedidos/${pedido.id}`}
      draggable
      onDragStart={(e) => onDragStart(e, pedido.id, pedido.estadoId)}
      className="block bg-surface rounded-md p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-muted">{pedido.numero}</span>
        <span className="text-xs text-muted">{formatDate(pedido.createdAt)}</span>
      </div>
      <div className="font-medium text-sm">{pedido.compradorNombre || pedido.socio?.apellidoNombre}</div>
      <div className="text-xs text-muted truncate">{pedido.compradorEmail}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold">{fmtMoney(pedido.total)}</span>
        <span className="text-xs text-muted">{pedido.items?.length || 0} ítem{(pedido.items?.length || 0) === 1 ? '' : 's'}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide opacity-70 mt-1 inline-block">
        {PAYMENT_STATUS_LABEL[pedido.paymentStatus] || pedido.paymentStatus}
      </span>
    </Link>
  )
}

function ListaView({ lista }) {
  if (!lista.length) {
    return <div className="card p-8 text-center text-muted">No hay pedidos.</div>
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-app">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Número</th>
            <th className="text-left px-4 py-3 font-medium">Comprador</th>
            <th className="text-left px-4 py-3 font-medium">Estado</th>
            <th className="text-left px-4 py-3 font-medium">Pago</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-left px-4 py-3 font-medium">Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map(p => (
            <tr key={p.id} className="border-t hover:bg-app/30">
              <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{p.compradorNombre}</div>
                <div className="text-xs text-muted">{p.compradorEmail}</div>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${p.estado?.color}20`, color: p.estado?.color }}>
                  {p.estado?.nombre}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted">{PAYMENT_STATUS_LABEL[p.paymentStatus] || p.paymentStatus}</td>
              <td className="px-4 py-3 text-right font-bold">{fmtMoney(p.total)}</td>
              <td className="px-4 py-3 text-xs text-muted">{formatDate(p.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link to={`/admin/tienda/pedidos/${p.id}`} className="opacity-70 hover:opacity-100">
                  <Eye className="w-4 h-4 inline" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
