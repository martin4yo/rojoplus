import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import Switch from '../../components/Switch'
import {
  ClipboardList,
  Users,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Download,
  RefreshCw,
} from 'lucide-react'

const api = {
  get: async (url) => {
    const token = localStorage.getItem('adminToken')
    const headers = { Authorization: `Bearer ${token}` }
    const match = window.location.hostname.match(/^([^.]+)\.localhost/)
    if (match) headers['X-Tenant-Slug'] = match[1]
    const res = await fetch(`/api${url}`, { headers })
    if (!res.ok) throw new Error('Error en la petición')
    return res.json()
  },
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value || 0)
}

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
  }
  const iconBg = { blue: 'bg-blue-100', green: 'bg-green-100', red: 'bg-red-100', teal: 'bg-teal-100' }
  const textCls = { blue: 'text-blue-700', green: 'text-green-700', red: 'text-red-700', teal: 'text-teal-700' }
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className={`inline-flex p-2 rounded-lg ${iconBg[color]}`}>
        <Icon className={`w-5 h-5 ${textCls[color]}`} />
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className={`text-xl font-bold ${textCls[color]} mt-1`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function ReporteSociosActividad() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [actividades, setActividades] = useState([])
  const [actividadId, setActividadId] = useState('')
  const [soloDeudores, setSoloDeudores] = useState(false)

  const cargarActividades = async () => {
    try {
      const res = await api.get('/admin/actividades')
      setActividades(res?.data ?? res ?? [])
    } catch (err) {
      console.error('Error cargando actividades:', err)
    }
  }

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (actividadId) params.append('actividadId', actividadId)
      if (soloDeudores) params.append('soloDeudores', 'true')
      const res = await api.get(`/admin/reportes/deportivos/socios-por-actividad?${params}`)
      setData(res?.data ?? res)
    } catch (err) {
      setError('Error al cargar el reporte')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarActividades() }, [])
  useEffect(() => { cargarDatos() }, [actividadId, soloDeudores])

  const exportarExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (actividadId) params.append('actividadId', actividadId)
      if (soloDeudores) params.append('soloDeudores', 'true')
      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      const match = window.location.hostname.match(/^([^.]+)\.localhost/)
      if (match) headers['X-Tenant-Slug'] = match[1]
      const response = await fetch(`/api/admin/reportes/deportivos/socios-por-actividad/exportar?${params}`, { headers })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `socios_por_actividad_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  // Agrupar filas por actividad → categoría para el render de grilla.
  const grupos = (() => {
    if (!data?.filas) return []
    const map = new Map()
    for (const f of data.filas) {
      const key = `${f.actividad}|||${f.categoria}`
      if (!map.has(key)) {
        map.set(key, { actividad: f.actividad, categoria: f.categoria, filas: [], subtotal: 0 })
      }
      const g = map.get(key)
      g.filas.push(f)
      g.subtotal += f.saldoDeudor
    }
    return Array.from(map.values())
  })()

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner />
          <p className="text-gray-600">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 font-medium">{error}</p>
        <button onClick={cargarDatos} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Reintentar
        </button>
      </div>
    )
  }

  const totales = data?.totales || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100">
            <ClipboardList className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Socios por Actividad</h1>
            <p className="text-gray-500 text-sm mt-1">
              Inscriptos activos y su saldo deudor (cuotas pendientes y vencidas)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={actividadId}
            onChange={(e) => setActividadId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
          >
            <option value="">Todas las actividades</option>
            {actividades.map(act => (
              <option key={act.id} value={act.id}>{act.nombre}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 px-2">
            <Switch size="sm" checked={soloDeudores} onChange={() => setSoloDeudores(v => !v)} />
            Solo deudores
          </label>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Inscripciones" value={formatNumber(totales.totalInscripciones)} subtitle={`${formatNumber(totales.sociosUnicos)} socios`} icon={Users} color="blue" />
        <KPICard title="Al día" value={formatNumber(totales.sociosAlDia)} icon={CheckCircle2} color="green" />
        <KPICard title="Con deuda" value={formatNumber(totales.sociosDeudores)} icon={AlertTriangle} color="red" />
        <KPICard title="Saldo deudor total" value={formatCurrency(totales.totalSaldoDeudor)} icon={DollarSign} color="teal" />
      </div>

      {/* Grilla agrupada por actividad/categoría */}
      {grupos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
          No hay inscriptos para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g, gi) => (
            <div key={gi} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-800">
                  {g.actividad}{g.categoria ? ` · ${g.categoria}` : ''}
                  <span className="ml-2 text-sm font-normal text-gray-500">({g.filas.length} inscriptos)</span>
                </h3>
                <span className="text-sm text-gray-600">
                  Deuda: <span className={`font-semibold ${g.subtotal > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(g.subtotal)}</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium uppercase text-xs">Nro</th>
                      <th className="px-4 py-2 text-left font-medium uppercase text-xs">Apellido y Nombre</th>
                      <th className="px-4 py-2 text-left font-medium uppercase text-xs">Documento</th>
                      <th className="px-4 py-2 text-left font-medium uppercase text-xs">Teléfono</th>
                      <th className="px-4 py-2 text-right font-medium uppercase text-xs">Saldo Deudor</th>
                      <th className="px-4 py-2 text-center font-medium uppercase text-xs">Estado</th>
                      <th className="px-4 py-2 text-left font-medium uppercase text-xs w-64">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {g.filas.map((f, i) => (
                      <tr key={f.inscripcionId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{f.nroSocio}</td>
                        <td className="px-4 py-2 text-gray-900 font-medium whitespace-nowrap">
                          <Link to={`/admin/socios/${f.socioId}`} className="hover:text-teal-700 hover:underline">
                            {f.apellidoNombre}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{f.documento}</td>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{f.celular}</td>
                        <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${f.saldoDeudor > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {f.saldoDeudor > 0 ? formatCurrency(f.saldoDeudor) : '—'}
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          {f.alDia ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Al día</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              Debe ({f.cantCuotasAdeudadas})
                            </span>
                          )}
                        </td>
                        {/* Celda de observaciones vacía para anotar a mano / imprimir */}
                        <td className="px-4 py-2">
                          <div className="h-6 border-b border-dashed border-gray-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
