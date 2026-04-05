import { useState, useEffect } from 'react'
import { Bot, MessageSquare, Zap, DollarSign, RefreshCw, TrendingUp } from 'lucide-react'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return (n || 0).toString()
}

function fmtCosto(usd) {
  if (!usd || usd < 0.0001) return '< $0.001'
  return `$${usd.toFixed(4)}`
}

function fmtFecha(s) {
  return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function IAMetricas() {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true)
      setError(null)
      const res = await api.getFull(`/admin/ia/metricas?desde=${desde}&hasta=${hasta}`)
      setDatos(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Calcular barra de porcentaje para el gráfico de días
  const maxMensajesDia = datos?.porDia?.length
    ? Math.max(...datos.porDia.map(d => d.mensajes), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-purple-600" />
            Métricas del Agente IA
          </h1>
          <p className="text-gray-500 text-sm mt-1">Uso del asistente de WhatsApp y chat interno</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={cargar} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>}

      {!loading && datos && (
        <>
          {/* Tarjetas de totales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Mensajes procesados', value: fmt(datos.mensajes),    icon: MessageSquare, color: 'text-purple-600 bg-purple-50' },
              { label: 'Tokens de entrada',   value: fmt(datos.inputTokens), icon: Zap,           color: 'text-blue-600 bg-blue-50'   },
              { label: 'Tokens de salida',    value: fmt(datos.outputTokens),icon: TrendingUp,    color: 'text-orange-600 bg-orange-50'},
              { label: 'Costo estimado (USD)',value: fmtCosto(datos.costoUSD),icon: DollarSign,   color: 'text-red-600 bg-red-50'     },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={`rounded-xl p-5 ${color} flex items-center gap-4`}>
                <Icon className="w-8 h-8 opacity-60 shrink-0" />
                <div>
                  <p className="text-xs font-medium opacity-75">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {datos.mensajes === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
              <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin actividad en el período seleccionado</p>
              <p className="text-sm mt-1">Los mensajes procesados por el agente aparecerán aquí.</p>
            </div>
          )}

          {datos.mensajes > 0 && (
            <>
              {/* Gráfico de barras por día */}
              {datos.porDia?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Mensajes por día</h2>
                  <div className="flex items-end gap-1 h-32">
                    {datos.porDia.map((d, i) => {
                      const pct = Math.max(4, (d.mensajes / maxMensajesDia) * 100)
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="relative w-full">
                            <div
                              className="w-full bg-purple-500 hover:bg-purple-600 rounded-t transition-all cursor-default"
                              style={{ height: `${pct * 1.2}px` }}
                              title={`${d.mensajes} mensajes`}
                            />
                          </div>
                          {datos.porDia.length <= 15 && (
                            <span className="text-[10px] text-gray-400 rotate-45 origin-left whitespace-nowrap">
                              {fmtFecha(d.dia)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {datos.porDia.length > 15 && (
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>{fmtFecha(datos.porDia[0].dia)}</span>
                      <span>{fmtFecha(datos.porDia[datos.porDia.length - 1].dia)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Desglose por modelo */}
              {datos.porModelo?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <h2 className="text-sm font-semibold text-gray-700">Desglose por modelo</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium">Proveedor</th>
                        <th className="px-5 py-3 text-left font-medium">Modelo</th>
                        <th className="px-5 py-3 text-right font-medium">Mensajes</th>
                        <th className="px-5 py-3 text-right font-medium">Input tokens</th>
                        <th className="px-5 py-3 text-right font-medium">Output tokens</th>
                        <th className="px-5 py-3 text-right font-medium">Costo est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {datos.porModelo.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 capitalize font-medium text-gray-800">{m.provider}</td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-600">{m.model}</td>
                          <td className="px-5 py-3 text-right font-semibold text-purple-700">{m.mensajes}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{fmt(m.inputTokens)}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{fmt(m.outputTokens)}</td>
                          <td className="px-5 py-3 text-right font-medium text-red-600">{fmtCosto(m.costoUSD)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-gray-400 text-right">
                * Costos estimados según precios públicos. Pueden variar con descuentos de volumen.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
