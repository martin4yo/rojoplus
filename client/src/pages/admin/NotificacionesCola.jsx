import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Send, Mail, MessageCircle, AlertTriangle, CheckCircle, Clock, Play, Megaphone } from 'lucide-react'
import { Button } from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import api from '../../services/api'
import toast from 'react-hot-toast'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'REINTENTANDO', label: 'Reintentando' },
  { value: 'ENVIADO', label: 'Enviadas' },
  { value: 'FALLIDO_DEFINITIVO', label: 'Fallidas' },
]

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
]

const COLOR_ESTADO = {
  ENVIADO: 'bg-green-100 text-green-700',
  ENVIADO_CON_ERROR: 'bg-yellow-100 text-yellow-700',
  PENDIENTE: 'bg-blue-100 text-blue-700',
  REINTENTANDO: 'bg-amber-100 text-amber-700',
  FALLIDO_DEFINITIVO: 'bg-red-100 text-red-700',
}

export default function NotificacionesCola() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [reintentando, setReintentando] = useState(null)
  const [filtros, setFiltros] = useState({ tipo: '', estado: '', eventType: '' })
  const [avisarOpen, setAvisarOpen] = useState(false)
  const [avisarVentana, setAvisarVentana] = useState(3)
  const [avisarEvitarReavisar, setAvisarEvitarReavisar] = useState(true)
  const [avisarPreview, setAvisarPreview] = useState(null)
  const [avisarLoading, setAvisarLoading] = useState(false)

  async function cargarDashboard() {
    try {
      const data = await api.get('/admin/notificaciones-log/dashboard')
      setDashboard(data)
    } catch (err) {
      console.error('Error dashboard:', err)
    }
  }

  async function cargarLogs(page = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filtros.tipo) params.append('tipo', filtros.tipo)
      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.eventType) params.append('eventType', filtros.eventType)
      const data = await api.get(`/admin/notificaciones-log?${params}`)
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
    } catch (err) {
      console.error('Error logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDashboard()
    cargarLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.tipo, filtros.estado, filtros.eventType])

  async function procesarAhora() {
    setProcesando(true)
    try {
      const r = await api.post('/admin/notificaciones-log/procesar-ahora', {})
      toast.success(`Procesadas ${r.exitosos} enviadas, ${r.fallidos} en reintento, ${r.agotados} agotaron reintentos`)
      await Promise.all([cargarDashboard(), cargarLogs(pagination.page)])
    } catch (err) {
      toast.error(err?.message || 'Error al procesar')
    } finally {
      setProcesando(false)
    }
  }

  async function abrirAvisar() {
    setAvisarOpen(true)
    setAvisarPreview(null)
    setAvisarVentana(3)
    setAvisarEvitarReavisar(true)
    await cargarPreviewAvisar(3, true)
  }

  async function cargarPreviewAvisar(ventana = avisarVentana, evitar = avisarEvitarReavisar) {
    setAvisarLoading(true)
    try {
      const r = await api.post('/admin/notificaciones-log/avisar-cuotas-vencidas', {
        dryRun: true,
        periodosVentana: ventana,
        evitarReavisar: evitar,
      })
      setAvisarPreview(r)
    } catch (err) {
      toast.error(err?.message || 'Error al previsualizar')
    } finally {
      setAvisarLoading(false)
    }
  }

  async function confirmarAvisar() {
    if (!avisarPreview || avisarPreview.aEncolar === 0) return
    setAvisarLoading(true)
    try {
      const r = await api.post('/admin/notificaciones-log/avisar-cuotas-vencidas', {
        dryRun: false,
        periodosVentana: avisarVentana,
        evitarReavisar: avisarEvitarReavisar,
      })
      toast.success(`Encolados ${r.encolados} · Omitidos ${r.omitidos} · Errores ${r.errores}`)
      setAvisarOpen(false)
      await Promise.all([cargarDashboard(), cargarLogs(1)])
    } catch (err) {
      toast.error(err?.message || 'Error al encolar')
    } finally {
      setAvisarLoading(false)
    }
  }

  async function reintentar(id) {
    setReintentando(id)
    try {
      await api.post(`/admin/notificaciones-log/${id}/reintentar`, {})
      toast.success('Reencolada')
      await cargarLogs(pagination.page)
    } catch (err) {
      toast.error(err?.message || 'Error')
    } finally {
      setReintentando(null)
    }
  }

  const StatCard = ({ icon, label, value, color }) => (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${color}`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-2xl font-bold text-gray-800">{value ?? '-'}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cola de Notificaciones</h1>
          <p className="text-sm text-gray-500">Estado de los envíos por email y WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { cargarDashboard(); cargarLogs(pagination.page) }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
          <Button variant="secondary" onClick={abrirAvisar} className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Avisar cuotas vencidas
          </Button>
          <Button onClick={procesarAhora} disabled={procesando} className="flex items-center gap-2">
            <Play className="w-4 h-4" />
            {procesando ? 'Procesando...' : 'Procesar ahora'}
          </Button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<Clock className="w-6 h-6 text-blue-500" />} label="Pendientes" value={dashboard?.pendientes} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-amber-500" />} label="Reintentando" value={dashboard?.reintentando} />
        <StatCard icon={<CheckCircle className="w-6 h-6 text-green-500" />} label="Enviadas (24h)" value={dashboard?.enviadosHoy} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-red-500" />} label="Fallidas (def.)" value={dashboard?.fallidos} />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-500" />} label="Errores (7d)" value={dashboard?.fallidosUlt7d} />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-700">Filtros:</span>
        <select
          value={filtros.estado}
          onChange={e => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filtros.tipo}
          onChange={e => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          {TIPOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="eventType (ej: BLOQUEO_MOROSIDAD)"
          value={filtros.eventType}
          onChange={e => setFiltros(prev => ({ ...prev, eventType: e.target.value }))}
          className="text-sm border border-gray-300 rounded px-2 py-1 flex-1 min-w-[200px]"
        />
        <span className="text-xs text-gray-500 ml-auto">{pagination.total} {pagination.total === 1 ? 'registro' : 'registros'}</span>
      </div>

      {/* Tabla */}
      {loading && logs.length === 0 ? (
        <div className="py-8"><LoadingSpinner /></div>
      ) : logs.length === 0 ? (
        <Alert type="info">Sin registros con esos filtros.</Alert>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Canal</th>
                <th className="px-3 py-2 text-left">Evento</th>
                <th className="px-3 py-2 text-left">Socio</th>
                <th className="px-3 py-2 text-left">Destino</th>
                <th className="px-3 py-2 text-center">Intentos</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${COLOR_ESTADO[l.estado] || 'bg-gray-100 text-gray-700'}`}>
                      {l.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      {l.tipo === 'EMAIL' ? <Mail className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                      {l.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{l.eventType}</td>
                  <td className="px-3 py-2">
                    {l.socio ? (
                      <button onClick={() => navigate(`/admin/socios/${l.socio.id}`)} className="text-blue-600 hover:underline">
                        #{l.socio.nroSocio} {l.socio.apellidoNombre}
                      </button>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 font-mono text-xs">{l.destinatario}</td>
                  <td className="px-3 py-2 text-center text-gray-700"><strong>{l.intentos}</strong>/5</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {l.fechaEnvio
                      ? new Date(l.fechaEnvio).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : (l.fechaProgramado
                          ? `prog: ${new Date(l.fechaProgramado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                          : '-')}
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600 max-w-xs truncate" title={l.error || ''}>{l.error || '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {(l.estado === 'REINTENTANDO' || l.estado === 'FALLIDO_DEFINITIVO' || l.estado === 'ENVIADO_CON_ERROR') && (
                      <Button variant="secondary" onClick={() => reintentar(l.id)} disabled={reintentando === l.id} className="text-xs">
                        {reintentando === l.id ? '...' : 'Reintentar'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Avisar cuotas vencidas */}
      <Modal isOpen={avisarOpen} onClose={() => setAvisarOpen(false)} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Megaphone className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Avisar cuotas vencidas</h2>
              <p className="text-sm text-gray-500">Encola avisos por email y WhatsApp a socios vigentes con cuotas vencidas</p>
            </div>
          </div>

          {avisarPreview?.demo?.activo ? (
            <Alert type="info">
              <strong>MODO DEMO activo.</strong> Todos los envíos van a redirigir a
              {avisarPreview.demo.email && <> · email: <code>{avisarPreview.demo.email}</code></>}
              {avisarPreview.demo.whatsapp && <> · WA: <code>{avisarPreview.demo.whatsapp}</code></>}
            </Alert>
          ) : (
            <Alert type="warning">
              <strong>MODO DEMO desactivado.</strong> Los avisos se van a enviar a los socios reales. Activá MODO_DEMO en Configuración si esto es una prueba.
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Períodos hacia atrás</span>
              <input
                type="number"
                min={1}
                value={avisarVentana}
                onChange={e => setAvisarVentana(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={() => cargarPreviewAvisar()}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <span className="block text-xs text-gray-500 mt-1">Meses contados desde el actual hacia atrás</span>
            </label>
            <label className="text-sm flex items-start gap-2 pt-6">
              <input
                type="checkbox"
                checked={avisarEvitarReavisar}
                onChange={e => { setAvisarEvitarReavisar(e.target.checked); cargarPreviewAvisar(avisarVentana, e.target.checked) }}
                className="mt-0.5"
              />
              <span className="text-gray-700">No reavisar (últimos 7 días)</span>
            </label>
          </div>

          {avisarPreview?.periodosEnVentana?.length > 0 && (
            <div className="text-xs text-gray-600 -mt-2">
              <span className="font-medium">Períodos en la ventana:</span>{' '}
              {avisarPreview.periodosEnVentana.map((p, i) => (
                <span key={i} className="inline-block px-2 py-0.5 mr-1 mb-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">{p}</span>
              ))}
            </div>
          )}

          {avisarLoading && !avisarPreview ? (
            <div className="py-6"><LoadingSpinner /></div>
          ) : avisarPreview ? (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-800">{avisarPreview.candidatos}</div>
                  <div className="text-xs text-gray-500">Candidatos</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-400">{avisarPreview.yaNotificados}</div>
                  <div className="text-xs text-gray-500">Ya notificados</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{avisarPreview.aEncolar}</div>
                  <div className="text-xs text-gray-500">A encolar</div>
                </div>
              </div>
              {avisarPreview.ejemplos?.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-1">Primeros {avisarPreview.ejemplos.length}:</p>
                  <ul className="text-xs text-gray-600 space-y-0.5 max-h-40 overflow-y-auto">
                    {avisarPreview.ejemplos.map(e => (
                      <li key={e.socioId}>
                        <strong>{e.socio}</strong>{' '}
                        <span className="text-gray-400">[{e.estado || '?'}]</span>
                        {e.bloqueado && <span className="ml-1 text-red-600 font-medium">BLOQUEADO</span>}
                        {' — '}
                        <strong>{e.cantidadCuotas}</strong> cuota{e.cantidadCuotas === 1 ? '' : 's'} · ${e.totalAdeudado.toLocaleString('es-AR')} · desde {new Date(e.vencimientoMasViejo).toLocaleDateString('es-AR')}
                        {!e.flagSocio && <span className="text-orange-600"> · opt-out morosidad</span>}
                        {!e.tieneEmail && !e.tieneWA && <span className="text-red-600"> · sin canales</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" onClick={() => setAvisarOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmarAvisar}
              disabled={avisarLoading || !avisarPreview || avisarPreview.aEncolar === 0}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {avisarLoading ? 'Encolando...' : `Encolar ${avisarPreview?.aEncolar || 0} avisos`}
            </Button>
          </div>
        </div>
      </Modal>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <span className="text-xs text-gray-500">Página {pagination.page} de {pagination.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => cargarLogs(pagination.page - 1)} disabled={pagination.page <= 1 || loading}>Anterior</Button>
            <Button variant="secondary" onClick={() => cargarLogs(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages || loading}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  )
}
