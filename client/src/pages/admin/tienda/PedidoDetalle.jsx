import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ShoppingBag, X, FileText, MessageSquare, History } from 'lucide-react'
import { Button } from '../../../components/Button'
import LoadingSpinner from '../../../components/LoadingSpinner'
import api from '../../../services/api'

const PAYMENT_STATUS = {
  pending: { label: 'Pago pendiente', color: '#F59E0B' },
  paid: { label: 'Pagado', color: '#10B981' },
  expired: { label: 'Expirado', color: '#6B7280' },
  refunded: { label: 'Reembolsado', color: '#3B82F6' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
}

function fmt(d) { return new Date(d).toLocaleString('es-AR') }
function money(n) { return `$${Number(n || 0).toLocaleString('es-AR')}` }

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [estados, setEstados] = useState([])
  const [transiciones, setTransiciones] = useState([])
  const [cambiando, setCambiando] = useState(false)
  const [showCambio, setShowCambio] = useState(false)
  const [nuevoEstadoId, setNuevoEstadoId] = useState('')
  const [nota, setNota] = useState('')
  const [notasAdmin, setNotasAdmin] = useState('')

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    try {
      setLoading(true)
      const [p, est] = await Promise.all([
        api.get(`/admin/tienda/pedidos/${id}`),
        api.get('/admin/tienda/estados'),
      ])
      setPedido(p)
      setEstados(est.estados || [])
      setTransiciones(est.transiciones || [])
      setNotasAdmin(p.notasAdmin || '')
    } catch (err) {
      toast.error(err.message || 'Error cargando pedido')
    } finally {
      setLoading(false)
    }
  }

  const transicionesValidas = transiciones
    .filter(t => t.desdeId === pedido?.estadoId)
    .map(t => estados.find(e => e.id === t.hastaId))
    .filter(Boolean)

  async function cambiarEstado() {
    if (!nuevoEstadoId) return
    try {
      setCambiando(true)
      await api.post(`/admin/tienda/pedidos/${id}/cambiar-estado`, { nuevoEstadoId: parseInt(nuevoEstadoId), nota })
      toast.success('Estado cambiado')
      setShowCambio(false)
      setNuevoEstadoId(''); setNota('')
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally { setCambiando(false) }
  }

  async function cancelarPedido() {
    if (!confirm('¿Cancelar este pedido? Las reservas de stock se liberan.')) return
    try {
      await api.post(`/admin/tienda/pedidos/${id}/cancelar`, { nota: 'Cancelado desde detalle' })
      toast.success('Cancelado')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function guardarNotasAdmin() {
    try {
      await api.post(`/admin/tienda/pedidos/${id}/notas`, { notasAdmin })
      toast.success('Notas guardadas')
    } catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="p-8"><LoadingSpinner /></div>
  if (!pedido) return <div className="p-8 text-muted">Pedido no encontrado</div>

  const ps = PAYMENT_STATUS[pedido.paymentStatus] || { label: pedido.paymentStatus, color: '#888' }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/tienda/pedidos')} className="p-2 rounded hover:bg-app">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{pedido.numero}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${pedido.estado?.color}20`, color: pedido.estado?.color }}>
              {pedido.estado?.nombre}
            </span>
            <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${ps.color}20`, color: ps.color }}>
              {ps.label}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">Creado {fmt(pedido.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {transicionesValidas.length > 0 && !pedido.estado?.isFinal && (
            <Button onClick={() => setShowCambio(true)}>Cambiar estado</Button>
          )}
          {!pedido.estado?.isFinal && pedido.paymentStatus !== 'paid' && (
            <Button variant="secondary" onClick={cancelarPedido}>
              <X className="w-4 h-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Items */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold mb-3">Productos</h3>
          <div className="space-y-2">
            {pedido.items?.map(it => (
              <div key={it.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                {it.snapshotImagen || it.productoVariante?.producto?.fotos?.[0]?.url ? (
                  <img
                    src={it.snapshotImagen || it.productoVariante.producto.fotos[0].url}
                    alt=""
                    className="w-14 h-14 rounded object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-app" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{it.snapshotNombre}</div>
                  <div className="text-xs text-muted">
                    {it.snapshotTalle ? `Talle ${it.snapshotTalle}` : ''}
                    {it.snapshotColor ? ` · ${it.snapshotColor}` : ''}
                    {it.snapshotSku ? ` · SKU ${it.snapshotSku}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{Number(it.cantidad)} × {money(it.precioUnitario)}</div>
                  <div className="font-bold">{money(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex justify-end">
            <div className="text-right">
              <div className="text-sm text-muted">Subtotal: {money(pedido.subtotal)}</div>
              <div className="text-2xl font-bold">{money(pedido.total)}</div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-2">Comprador</h3>
            <div className="text-sm">
              <div className="font-medium">{pedido.compradorNombre}</div>
              <div className="text-muted text-xs">{pedido.compradorEmail}</div>
              {pedido.compradorTelefono && <div className="text-muted text-xs">{pedido.compradorTelefono}</div>}
              {pedido.compradorDocumento && <div className="text-muted text-xs">DNI/CUIT: {pedido.compradorDocumento}</div>}
            </div>
            {pedido.socio && (
              <div className="mt-3 pt-3 border-t text-xs">
                <div className="text-muted">Socio vinculado:</div>
                <Link to={`/admin/socios/${pedido.socio.id}`} className="underline">
                  {pedido.socio.nroSocio} — {pedido.socio.apellidoNombre}
                </Link>
              </div>
            )}
            {pedido.entidad && (
              <div className="mt-3 pt-3 border-t text-xs">
                <div className="text-muted">Cliente vinculado:</div>
                <span>{pedido.entidad.codigo} — {pedido.entidad.razonSocial}</span>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-2">Pago</h3>
            <div className="text-xs space-y-1">
              <div><span className="text-muted">Método:</span> {pedido.paymentMethod}</div>
              <div><span className="text-muted">Estado:</span> {ps.label}</div>
              {pedido.mpPaymentId && <div><span className="text-muted">MP ID:</span> {pedido.mpPaymentId}</div>}
              {pedido.pagadoEn && <div><span className="text-muted">Pagado:</span> {fmt(pedido.pagadoEn)}</div>}
              {pedido.expiraEn && pedido.paymentStatus === 'pending' && (
                <div><span className="text-muted">Expira:</span> {fmt(pedido.expiraEn)}</div>
              )}
            </div>
            {pedido.pedido && (
              <div className="mt-3 pt-3 border-t text-xs">
                <Link to={`/admin/ingresos/pedidos/${pedido.pedido.id}`} className="underline">
                  Ver pedido interno {pedido.pedido.numero}
                </Link>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Notas internas</h3>
            <textarea
              className="input-field w-full text-sm"
              rows={4}
              value={notasAdmin}
              onChange={e => setNotasAdmin(e.target.value)}
              placeholder="Notas privadas del admin (no se muestran al comprador)"
            />
            <Button className="mt-2 w-full" variant="secondary" onClick={guardarNotasAdmin}>Guardar notas</Button>
            {pedido.notasComprador && (
              <div className="mt-3 pt-3 border-t text-xs">
                <div className="text-muted mb-1">Mensaje del comprador:</div>
                <div className="italic">"{pedido.notasComprador}"</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Historial</h3>
        <div className="space-y-2">
          {pedido.historial?.map(h => (
            <div key={h.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${h.estado?.color}20`, color: h.estado?.color }}>
                {h.estado?.nombre}
              </span>
              <div className="flex-1">
                {h.nota && <div>{h.nota}</div>}
                <div className="text-xs text-muted">
                  {fmt(h.createdAt)}
                  {h.admin && ` · ${h.admin.nombre} ${h.admin.apellido || ''}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal cambiar estado */}
      {showCambio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Cambiar estado</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Nuevo estado</label>
              <select className="input-field w-full" value={nuevoEstadoId} onChange={e => setNuevoEstadoId(e.target.value)}>
                <option value="">Elegir...</option>
                {transicionesValidas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nota (opcional)</label>
              <textarea className="input-field w-full" rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Mensaje al comprador o nota interna" />
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="secondary" onClick={() => setShowCambio(false)}>Cancelar</Button>
              <Button onClick={cambiarEstado} disabled={!nuevoEstadoId || cambiando}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
