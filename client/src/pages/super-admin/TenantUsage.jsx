import { useState, useEffect } from 'react'
import { Users, Bot, TrendingUp, DollarSign, MessageSquare, Activity, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const ESTADO_BADGE = {
  ACTIVE:           { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Activo'     },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente'  },
  SUSPENDED:        { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Suspendido' },
  CANCELLED:        { bg: 'bg-gray-100',   text: 'text-gray-800',   label: 'Cancelado'  },
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatCosto(usd) {
  if (usd < 0.001) return '< $0.001'
  return `$${usd.toFixed(4)}`
}

function formatFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function TenantUsage() {
  const [datos, setDatos] = useState([])
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true)
      const res = await api.getFull(`/super-admin/tenants/uso?desde=${desde}&hasta=${hasta}`)
      setDatos(res.tenants || [])
    } catch (e) {
      toast.error('Error cargando datos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Totales globales
  const totales = datos.reduce((acc, t) => ({
    socios:       acc.socios + t.socios,
    mensajesAI:   acc.mensajesAI + t.ai.mensajes,
    inputTokens:  acc.inputTokens + t.ai.inputTokens,
    outputTokens: acc.outputTokens + t.ai.outputTokens,
    costoUSD:     acc.costoUSD + t.ai.costoUSD,
  }), { socios: 0, mensajesAI: 0, inputTokens: 0, outputTokens: 0, costoUSD: 0 })

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Uso</h1>
          <p className="text-gray-600">Métricas por tenant y consumo de IA</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <span className="text-gray-500">→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={cargar}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas de totales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Tenants',       value: datos.length,                icon: Activity,      color: 'text-blue-600 bg-blue-50'   },
          { label: 'Socios activos',value: totales.socios,              icon: Users,         color: 'text-green-600 bg-green-50' },
          { label: 'Mensajes IA',   value: totales.mensajesAI,          icon: MessageSquare, color: 'text-purple-600 bg-purple-50'},
          { label: 'Tokens totales',value: formatTokens(totales.inputTokens + totales.outputTokens), icon: Bot, color: 'text-orange-600 bg-orange-50'},
          { label: 'Costo est. IA', value: formatCosto(totales.costoUSD), icon: DollarSign, color: 'text-red-600 bg-red-50'     },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`rounded-lg p-4 ${color} flex items-center gap-3`}>
            <Icon className="w-7 h-7 opacity-60 shrink-0" />
            <div>
              <p className="text-xs font-medium opacity-75">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Tenant</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Plan / Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Socios</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Admins</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Última actividad</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Mensajes IA</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Tokens</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Costo est.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {datos.map(t => {
              const badge = ESTADO_BADGE[t.estado] || ESTADO_BADGE.PENDING_APPROVAL
              const abierto = expandido === t.id
              const totalTokens = t.ai.inputTokens + t.ai.outputTokens

              return [
                <tr key={t.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandido(abierto ? null : t.id)}>
                  <td className="px-4 py-3 text-gray-400">
                    {t.ai.breakdown.length > 0
                      ? (abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
                      : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.nombre}</div>
                    <div className="text-xs text-gray-500">{t.subdomain}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-700">{t.plan}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{t.socios}</td>
                  <td className="px-4 py-3 text-right">{t.admins}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{formatFecha(t.ultimaActividad)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.ai.mensajes > 0
                      ? <span className="font-medium text-purple-700">{t.ai.mensajes}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {totalTokens > 0
                      ? <span className="text-orange-700">{formatTokens(totalTokens)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.ai.costoUSD > 0
                      ? <span className="font-medium text-red-600">{formatCosto(t.ai.costoUSD)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>,

                // Fila de desglose por modelo
                abierto && t.ai.breakdown.length > 0 && (
                  <tr key={`${t.id}-detail`} className="bg-purple-50">
                    <td colSpan={9} className="px-8 py-3">
                      <div className="text-xs font-semibold text-purple-700 mb-2">Desglose por modelo</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pb-1 font-medium w-32">Proveedor</th>
                            <th className="text-left pb-1 font-medium">Modelo</th>
                            <th className="text-right pb-1 font-medium">Mensajes</th>
                            <th className="text-right pb-1 font-medium">Input tokens</th>
                            <th className="text-right pb-1 font-medium">Output tokens</th>
                            <th className="text-right pb-1 font-medium">Costo est.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.ai.breakdown.map((b, i) => (
                            <tr key={i} className="border-t border-purple-100">
                              <td className="py-1 capitalize text-purple-800 font-medium">{b.provider}</td>
                              <td className="py-1 font-mono text-gray-600">{b.model}</td>
                              <td className="py-1 text-right">{b.mensajes}</td>
                              <td className="py-1 text-right">{formatTokens(b.inputTokens)}</td>
                              <td className="py-1 text-right">{formatTokens(b.outputTokens)}</td>
                              <td className="py-1 text-right font-medium">{formatCosto(b.costoUSD)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )
              ]
            })}
          </tbody>
        </table>

        {datos.length === 0 && (
          <div className="text-center py-10 text-gray-500">No hay datos disponibles</div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">
        * Costos estimados según precios públicos de cada proveedor. Pueden variar con descuentos o cambios de tarifa.
      </p>
    </div>
  )
}
