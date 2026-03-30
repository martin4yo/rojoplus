import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  Users,
  Target,
  Award,
  Calendar,
  TrendingUp,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Percent,
  Activity,
  User,
  FileText,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import * as XLSX from 'xlsx'

const api = {
  get: async (url) => {
    const token = localStorage.getItem('adminToken')
    const res = await fetch(`/api${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Error en la petición')
    return res.json()
  },
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(value)
}

function formatPercent(value) {
  return `${Math.round(value)}%`
}

function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// KPI Card Component
function KPICard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  }

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
  }

  const textClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
    purple: 'text-purple-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className={`w-5 h-5 ${textClasses[color]}`} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className={`text-xl font-bold ${textClasses[color]} mt-1`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

// Custom Tooltip
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1']

export default function ReportesDeportivos() {
  const [activeTab, setActiveTab] = useState('asistencia')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Datos
  const [asistenciaData, setAsistenciaData] = useState(null)
  const [partidosData, setPartidosData] = useState(null)
  const [goleadoresData, setGoleadoresData] = useState(null)
  const [asistidoresData, setAsistidoresData] = useState(null)
  const [jugadorStats, setJugadorStats] = useState(null)

  // Filtros
  const [filtros, setFiltros] = useState({
    actividadId: '',
    categoriaId: '',
    fechaDesde: '',
    fechaHasta: '',
    socioId: '',
  })
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [showFiltros, setShowFiltros] = useState(false)
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [sociosEncontrados, setSociosEncontrados] = useState([])
  const [buscando, setBuscando] = useState(false)

  // Cargar actividades y categorías
  useEffect(() => {
    const cargarFiltros = async () => {
      try {
        const [actRes, catRes] = await Promise.all([
          api.get('/admin/actividades'),
          api.get('/admin/categorias'),
        ])
        setActividades(actRes.data || [])
        setCategorias(catRes.data || [])
      } catch (err) {
        console.error('Error cargando filtros:', err)
      }
    }
    cargarFiltros()
  }, [])

  // Cargar datos cuando cambia el tab o los filtros
  useEffect(() => {
    cargarDatos()
  }, [activeTab, filtros])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filtros.actividadId) params.append('actividadId', filtros.actividadId)
      if (filtros.categoriaId) params.append('categoriaId', filtros.categoriaId)
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)

      const queryString = params.toString() ? `?${params.toString()}` : ''

      if (activeTab === 'asistencia') {
        const res = await api.get(`/admin/reportes/deportivos/asistencia${queryString}`)
        setAsistenciaData(res.data)
      } else if (activeTab === 'partidos') {
        const res = await api.get(`/admin/reportes/deportivos/partidos${queryString}`)
        setPartidosData(res.data)
      } else if (activeTab === 'goleadores') {
        const [golRes, astRes] = await Promise.all([
          api.get(`/admin/reportes/deportivos/goleadores${queryString}`),
          api.get(`/admin/reportes/deportivos/asistidores${queryString}`),
        ])
        setGoleadoresData(golRes.data)
        setAsistidoresData(astRes.data)
      } else if (activeTab === 'jugador' && filtros.socioId) {
        const res = await api.get(`/admin/reportes/deportivos/jugador/${filtros.socioId}${queryString}`)
        setJugadorStats(res.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Buscar socios
  const buscarSocios = async (texto) => {
    if (texto.length < 2) {
      setSociosEncontrados([])
      return
    }
    setBuscando(true)
    try {
      const res = await api.get(`/admin/socios?search=${encodeURIComponent(texto)}&limit=10`)
      setSociosEncontrados(res.data || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
    } finally {
      setBuscando(false)
    }
  }

  const tabs = [
    { id: 'asistencia', label: 'Asistencia', icon: Users },
    { id: 'partidos', label: 'Partidos', icon: Trophy },
    { id: 'goleadores', label: 'Ranking', icon: Award },
    { id: 'jugador', label: 'Jugador', icon: User },
  ]

  // Función para exportar a Excel
  const exportarExcel = () => {
    let data = []
    let nombreArchivo = 'reporte-deportivo'

    if (activeTab === 'asistencia' && asistenciaData?.porSocio) {
      nombreArchivo = 'reporte-asistencia'
      data = asistenciaData.porSocio.map((s) => ({
        'Apellido': s.apellido,
        'Nombre': s.nombre,
        'Categoría': s.categoria || '-',
        'Asistencias': s.asistencias,
        'Inasistencias': s.inasistencias,
        '% Asistencia': `${Math.round(s.porcentajeAsistencia)}%`,
      }))
    } else if (activeTab === 'partidos' && partidosData) {
      nombreArchivo = 'reporte-partidos'
      // Exportar resumen y por categoría
      const resumenRow = [{
        'Tipo': 'RESUMEN GENERAL',
        'Total Partidos': partidosData.resumen?.totalPartidos || 0,
        'Ganados': partidosData.resumen?.ganados || 0,
        'Empatados': partidosData.resumen?.empatados || 0,
        'Perdidos': partidosData.resumen?.perdidos || 0,
        'Goles a Favor': partidosData.resumen?.golesAFavor || 0,
        'Goles en Contra': partidosData.resumen?.golesEnContra || 0,
      }]
      const categoriaRows = (partidosData.porCategoria || []).map((cat) => ({
        'Tipo': 'POR CATEGORÍA',
        'Categoría': cat.categoria,
        'Total Partidos': cat.totalPartidos,
        'Ganados': cat.ganados,
        'Empatados': cat.empatados,
        'Perdidos': cat.perdidos,
      }))
      data = [...resumenRow, {}, ...categoriaRows]
    } else if (activeTab === 'goleadores') {
      nombreArchivo = 'reporte-ranking'
      // Crear dos hojas: goleadores y asistidores
      const wb = XLSX.utils.book_new()

      if (goleadoresData?.length) {
        const goleadoresSheet = XLSX.utils.json_to_sheet(goleadoresData.map((j, idx) => ({
          '#': idx + 1,
          'Apellido': j.apellido,
          'Nombre': j.nombre,
          'Categoría': j.categoria || '-',
          'Partidos': j.partidos,
          'Goles': j.goles,
          'Promedio': (j.goles / j.partidos).toFixed(2),
        })))
        XLSX.utils.book_append_sheet(wb, goleadoresSheet, 'Goleadores')
      }

      if (asistidoresData?.length) {
        const asistidoresSheet = XLSX.utils.json_to_sheet(asistidoresData.map((j, idx) => ({
          '#': idx + 1,
          'Apellido': j.apellido,
          'Nombre': j.nombre,
          'Categoría': j.categoria || '-',
          'Partidos': j.partidos,
          'Asistencias': j.asistencias,
          'Promedio': (j.asistencias / j.partidos).toFixed(2),
        })))
        XLSX.utils.book_append_sheet(wb, asistidoresSheet, 'Asistidores')
      }

      if (wb.SheetNames.length > 0) {
        XLSX.writeFile(wb, `${nombreArchivo}-${new Date().toISOString().split('T')[0]}.xlsx`)
      }
      return
    } else if (activeTab === 'jugador' && jugadorStats) {
      nombreArchivo = `estadisticas-${jugadorStats.jugador?.apellido || 'jugador'}`
      data = [{
        'Jugador': `${jugadorStats.jugador?.apellido}, ${jugadorStats.jugador?.nombre}`,
        'Número': jugadorStats.jugador?.numeroSocio,
        'Categoría': jugadorStats.jugador?.categoria || '-',
        'Partidos Jugados': jugadorStats.partidos?.jugados || 0,
        'Partidos Ganados': jugadorStats.partidos?.ganados || 0,
        'Partidos Empatados': jugadorStats.partidos?.empatados || 0,
        'Partidos Perdidos': jugadorStats.partidos?.perdidos || 0,
        'Goles': jugadorStats.goles || 0,
        'Asistencias': jugadorStats.asistencias || 0,
        'Tarjetas Amarillas': jugadorStats.tarjetasAmarillas || 0,
        'Tarjetas Rojas': jugadorStats.tarjetasRojas || 0,
        'Entrenamientos Presentes': jugadorStats.asistencia?.presentes || 0,
        'Entrenamientos Ausentes': jugadorStats.asistencia?.ausentes || 0,
        '% Asistencia Entrenamientos': `${Math.round(jugadorStats.asistencia?.porcentaje || 0)}%`,
      }]
    }

    if (data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      XLSX.writeFile(wb, `${nombreArchivo}-${new Date().toISOString().split('T')[0]}.xlsx`)
    }
  }

  const hayDatosParaExportar = () => {
    if (activeTab === 'asistencia') return asistenciaData?.porSocio?.length > 0
    if (activeTab === 'partidos') return partidosData?.resumen
    if (activeTab === 'goleadores') return goleadoresData?.length > 0 || asistidoresData?.length > 0
    if (activeTab === 'jugador') return !!jugadorStats
    return false
  }

  // Función para exportar a PDF (usando ventana de impresión)
  const exportarPDF = () => {
    // Crear contenido HTML para imprimir
    let titulo = 'Reporte Deportivo'
    let contenido = ''

    if (activeTab === 'asistencia' && asistenciaData) {
      titulo = 'Reporte de Asistencia'
      const { resumen, porSocio } = asistenciaData
      contenido = `
        <div class="resumen">
          <h2>Resumen</h2>
          <div class="kpis">
            <div class="kpi"><strong>Total Entrenamientos:</strong> ${resumen?.totalEntrenamientos || 0}</div>
            <div class="kpi"><strong>Total Asistencias:</strong> ${resumen?.totalAsistencias || 0}</div>
            <div class="kpi"><strong>Promedio Asistencia:</strong> ${Math.round(resumen?.promedioAsistencia || 0)}%</div>
            <div class="kpi"><strong>Deportistas Activos:</strong> ${resumen?.deportistasActivos || 0}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Socio</th>
              <th>Categoría</th>
              <th>Asistencias</th>
              <th>Inasistencias</th>
              <th>% Asistencia</th>
            </tr>
          </thead>
          <tbody>
            ${(porSocio || []).map(s => `
              <tr>
                <td>${s.apellido}, ${s.nombre}</td>
                <td>${s.categoria || '-'}</td>
                <td class="center">${s.asistencias}</td>
                <td class="center">${s.inasistencias}</td>
                <td class="center">${Math.round(s.porcentajeAsistencia)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (activeTab === 'partidos' && partidosData) {
      titulo = 'Reporte de Partidos'
      const { resumen, porCategoria } = partidosData
      contenido = `
        <div class="resumen">
          <h2>Resumen General</h2>
          <div class="kpis">
            <div class="kpi"><strong>Total Partidos:</strong> ${resumen?.totalPartidos || 0}</div>
            <div class="kpi"><strong>Ganados:</strong> ${resumen?.ganados || 0}</div>
            <div class="kpi"><strong>Empatados:</strong> ${resumen?.empatados || 0}</div>
            <div class="kpi"><strong>Perdidos:</strong> ${resumen?.perdidos || 0}</div>
            <div class="kpi"><strong>Goles a Favor:</strong> ${resumen?.golesAFavor || 0}</div>
            <div class="kpi"><strong>Goles en Contra:</strong> ${resumen?.golesEnContra || 0}</div>
          </div>
        </div>
        <h2>Por Categoría</h2>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Partidos</th>
              <th>Ganados</th>
              <th>Empatados</th>
              <th>Perdidos</th>
            </tr>
          </thead>
          <tbody>
            ${(porCategoria || []).map(c => `
              <tr>
                <td>${c.categoria}</td>
                <td class="center">${c.totalPartidos}</td>
                <td class="center">${c.ganados}</td>
                <td class="center">${c.empatados}</td>
                <td class="center">${c.perdidos}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (activeTab === 'goleadores') {
      titulo = 'Ranking de Goleadores y Asistidores'
      contenido = `
        <h2>Goleadores</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Categoría</th>
              <th>Partidos</th>
              <th>Goles</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
            ${(goleadoresData || []).map((j, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td>${j.apellido}, ${j.nombre}</td>
                <td>${j.categoria || '-'}</td>
                <td class="center">${j.partidos}</td>
                <td class="center"><strong>${j.goles}</strong></td>
                <td class="center">${(j.goles / j.partidos).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2 style="margin-top: 30px;">Asistidores</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Categoría</th>
              <th>Partidos</th>
              <th>Asistencias</th>
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
            ${(asistidoresData || []).map((j, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td>${j.apellido}, ${j.nombre}</td>
                <td>${j.categoria || '-'}</td>
                <td class="center">${j.partidos}</td>
                <td class="center"><strong>${j.asistencias}</strong></td>
                <td class="center">${(j.asistencias / j.partidos).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    } else if (activeTab === 'jugador' && jugadorStats) {
      const j = jugadorStats
      titulo = `Estadísticas - ${j.jugador?.apellido}, ${j.jugador?.nombre}`
      contenido = `
        <div class="jugador-header">
          <h2>${j.jugador?.apellido}, ${j.jugador?.nombre}</h2>
          <p>Número de socio: #${j.jugador?.numeroSocio} | Categoría: ${j.jugador?.categoria || 'Sin categoría'}</p>
        </div>
        <div class="resumen">
          <h3>Estadísticas de Partidos</h3>
          <div class="kpis">
            <div class="kpi"><strong>Partidos Jugados:</strong> ${j.partidos?.jugados || 0}</div>
            <div class="kpi"><strong>Ganados:</strong> ${j.partidos?.ganados || 0}</div>
            <div class="kpi"><strong>Empatados:</strong> ${j.partidos?.empatados || 0}</div>
            <div class="kpi"><strong>Perdidos:</strong> ${j.partidos?.perdidos || 0}</div>
          </div>
          <div class="kpis">
            <div class="kpi"><strong>Goles:</strong> ${j.goles || 0}</div>
            <div class="kpi"><strong>Asistencias:</strong> ${j.asistencias || 0}</div>
            <div class="kpi"><strong>Tarjetas Amarillas:</strong> ${j.tarjetasAmarillas || 0}</div>
            <div class="kpi"><strong>Tarjetas Rojas:</strong> ${j.tarjetasRojas || 0}</div>
          </div>
        </div>
        <div class="resumen">
          <h3>Asistencia a Entrenamientos</h3>
          <div class="kpis">
            <div class="kpi"><strong>Presentes:</strong> ${j.asistencia?.presentes || 0}</div>
            <div class="kpi"><strong>Ausentes:</strong> ${j.asistencia?.ausentes || 0}</div>
            <div class="kpi"><strong>Justificadas:</strong> ${j.asistencia?.justificadas || 0}</div>
            <div class="kpi"><strong>% Asistencia:</strong> ${Math.round(j.asistencia?.porcentaje || 0)}%</div>
          </div>
        </div>
      `
    }

    // Abrir ventana de impresión
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #DC2626; border-bottom: 2px solid #DC2626; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 20px; }
          h3 { color: #6B7280; }
          .fecha { color: #6B7280; font-size: 12px; margin-bottom: 20px; }
          .resumen { background: #F9FAFB; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .kpis { display: flex; flex-wrap: wrap; gap: 15px; }
          .kpi { background: white; padding: 10px 15px; border-radius: 6px; border: 1px solid #E5E7EB; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #F3F4F6; padding: 10px; text-align: left; border-bottom: 2px solid #E5E7EB; font-size: 12px; }
          td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          tr:hover { background: #F9FAFB; }
          .center { text-align: center; }
          .jugador-header { background: #DC2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .jugador-header h2 { color: white; margin: 0; }
          .jugador-header p { margin: 5px 0 0 0; opacity: 0.9; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        <p class="fecha">Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}</p>
        ${contenido}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `)
    ventana.document.close()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reportes Deportivos</h1>
            <p className="text-gray-500 text-sm">Estadísticas y análisis de actividades deportivas</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarExcel}
              disabled={loading || !hayDatosParaExportar()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar a Excel"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={exportarPDF}
              disabled={loading || !hayDatosParaExportar()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar a PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={cargarDatos}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex overflow-x-auto border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="p-4 border-b bg-gray-50/50">
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFiltros && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Actividad</label>
                <select
                  value={filtros.actividadId}
                  onChange={(e) => setFiltros({ ...filtros, actividadId: e.target.value, categoriaId: '' })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Todas</option>
                  {actividades.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select
                  value={filtros.categoriaId}
                  onChange={(e) => setFiltros({ ...filtros, categoriaId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Todas</option>
                  {categorias
                    .filter((c) => !filtros.actividadId || c.actividadId === parseInt(filtros.actividadId))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <p>Error: {error}</p>
              <button onClick={cargarDatos} className="mt-4 text-sm underline">
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* Tab Asistencia */}
              {activeTab === 'asistencia' && asistenciaData && (
                <TabAsistencia data={asistenciaData} />
              )}

              {/* Tab Partidos */}
              {activeTab === 'partidos' && partidosData && (
                <TabPartidos data={partidosData} />
              )}

              {/* Tab Goleadores/Ranking */}
              {activeTab === 'goleadores' && (
                <TabRanking goleadores={goleadoresData} asistidores={asistidoresData} />
              )}

              {/* Tab Jugador */}
              {activeTab === 'jugador' && (
                <TabJugador
                  stats={jugadorStats}
                  busquedaSocio={busquedaSocio}
                  setBusquedaSocio={setBusquedaSocio}
                  buscarSocios={buscarSocios}
                  sociosEncontrados={sociosEncontrados}
                  buscando={buscando}
                  filtros={filtros}
                  setFiltros={setFiltros}
                  setSociosEncontrados={setSociosEncontrados}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Tab Asistencia
function TabAsistencia({ data }) {
  const { resumen, porSocio } = data

  // Datos para gráfico
  const chartData = porSocio?.slice(0, 10).map((s) => ({
    name: `${s.apellido}, ${s.nombre?.charAt(0)}.`,
    asistencias: s.asistencias,
    porcentaje: s.porcentajeAsistencia,
  })) || []

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Entrenamientos"
          value={formatNumber(resumen?.totalEntrenamientos || 0)}
          icon={Calendar}
          color="blue"
        />
        <KPICard
          title="Total Asistencias"
          value={formatNumber(resumen?.totalAsistencias || 0)}
          icon={Users}
          color="green"
        />
        <KPICard
          title="Promedio Asistencia"
          value={formatPercent(resumen?.promedioAsistencia || 0)}
          icon={Percent}
          color="purple"
        />
        <KPICard
          title="Deportistas Activos"
          value={formatNumber(resumen?.deportistasActivos || 0)}
          icon={Activity}
          color="yellow"
        />
      </div>

      {/* Gráfico Top 10 */}
      {chartData.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Top 10 - Mayor Asistencia</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="asistencias" fill="#10B981" name="Asistencias" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla detalle */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Socio</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Asistencias</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Inasistencias</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">% Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {porSocio?.map((s, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/socios/${s.socioId}`} className="text-blue-600 hover:underline">
                    {s.apellido}, {s.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.categoria || '-'}</td>
                <td className="px-4 py-3 text-center font-medium text-green-600">{s.asistencias}</td>
                <td className="px-4 py-3 text-center font-medium text-primary">{s.inasistencias}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.porcentajeAsistencia >= 80
                      ? 'bg-green-100 text-green-700'
                      : s.porcentajeAsistencia >= 60
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {formatPercent(s.porcentajeAsistencia)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!porSocio || porSocio.length === 0) && (
          <p className="text-center py-8 text-gray-500">No hay datos de asistencia en el período seleccionado</p>
        )}
      </div>
    </div>
  )
}

// Tab Partidos
function TabPartidos({ data }) {
  const { resumen, porCategoria } = data

  // Datos para gráfico de resultados
  const resultadosData = [
    { name: 'Ganados', value: resumen?.ganados || 0 },
    { name: 'Empatados', value: resumen?.empatados || 0 },
    { name: 'Perdidos', value: resumen?.perdidos || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          title="Total Partidos"
          value={formatNumber(resumen?.totalPartidos || 0)}
          icon={Trophy}
          color="blue"
        />
        <KPICard
          title="Ganados"
          value={formatNumber(resumen?.ganados || 0)}
          subtitle={`${formatPercent((resumen?.ganados / resumen?.totalPartidos) * 100 || 0)}`}
          icon={Award}
          color="green"
        />
        <KPICard
          title="Empatados"
          value={formatNumber(resumen?.empatados || 0)}
          icon={Activity}
          color="yellow"
        />
        <KPICard
          title="Perdidos"
          value={formatNumber(resumen?.perdidos || 0)}
          icon={TrendingUp}
          color="red"
        />
        <KPICard
          title="Dif. de Goles"
          value={`${resumen?.golesAFavor || 0} - ${resumen?.golesEnContra || 0}`}
          subtitle={`Diferencia: ${(resumen?.golesAFavor || 0) - (resumen?.golesEnContra || 0)}`}
          icon={Target}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico de resultados */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Distribución de Resultados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={resultadosData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {resultadosData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#10B981', '#F59E0B', '#EF4444'][index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Estadísticas por categoría */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Rendimiento por Categoría</h3>
          <div className="space-y-3">
            {porCategoria?.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="font-medium text-gray-700">{cat.categoria}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">{cat.ganados}G</span>
                  <span className="text-yellow-600">{cat.empatados}E</span>
                  <span className="text-red-600">{cat.perdidos}P</span>
                  <span className="text-gray-500">({cat.totalPartidos} partidos)</span>
                </div>
              </div>
            ))}
            {(!porCategoria || porCategoria.length === 0) && (
              <p className="text-center py-4 text-gray-500">Sin datos de partidos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Tab Ranking (Goleadores y Asistidores)
function TabRanking({ goleadores, asistidores }) {
  const [subTab, setSubTab] = useState('goleadores')

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('goleadores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subTab === 'goleadores'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Goleadores
        </button>
        <button
          onClick={() => setSubTab('asistidores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subTab === 'asistidores'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Asistidores
        </button>
      </div>

      {/* Tabla de ranking */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Jugador</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Partidos</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">
                {subTab === 'goleadores' ? 'Goles' : 'Asistencias'}
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {(subTab === 'goleadores' ? goleadores : asistidores)?.map((jugador, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  {idx === 0 && <span className="text-2xl">🥇</span>}
                  {idx === 1 && <span className="text-2xl">🥈</span>}
                  {idx === 2 && <span className="text-2xl">🥉</span>}
                  {idx > 2 && <span className="text-gray-500 font-medium">{idx + 1}</span>}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/admin/socios/${jugador.socioId}`} className="text-blue-600 hover:underline font-medium">
                    {jugador.apellido}, {jugador.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{jugador.categoria || '-'}</td>
                <td className="px-4 py-3 text-center text-gray-600">{jugador.partidos}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-bold text-lg text-primary">
                    {subTab === 'goleadores' ? jugador.goles : jugador.asistencias}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {((subTab === 'goleadores' ? jugador.goles : jugador.asistencias) / jugador.partidos).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!(subTab === 'goleadores' ? goleadores : asistidores) ||
          (subTab === 'goleadores' ? goleadores : asistidores).length === 0) && (
          <p className="text-center py-8 text-gray-500">
            No hay datos de {subTab === 'goleadores' ? 'goleadores' : 'asistidores'} en el período seleccionado
          </p>
        )}
      </div>
    </div>
  )
}

// Tab Jugador Individual
function TabJugador({
  stats,
  busquedaSocio,
  setBusquedaSocio,
  buscarSocios,
  sociosEncontrados,
  buscando,
  filtros,
  setFiltros,
  setSociosEncontrados,
}) {
  return (
    <div className="space-y-6">
      {/* Buscador de socio */}
      <div className="max-w-md relative">
        <label className="block text-sm font-medium text-gray-600 mb-2">Buscar Jugador</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busquedaSocio}
            onChange={(e) => {
              setBusquedaSocio(e.target.value)
              buscarSocios(e.target.value)
            }}
            placeholder="Nombre o número de socio..."
            className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm"
          />
          {busquedaSocio && (
            <button
              onClick={() => {
                setBusquedaSocio('')
                setSociosEncontrados([])
                setFiltros({ ...filtros, socioId: '' })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Resultados de búsqueda */}
        {sociosEncontrados.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {sociosEncontrados.map((socio) => (
              <button
                key={socio.id}
                onClick={() => {
                  setFiltros({ ...filtros, socioId: socio.id })
                  setBusquedaSocio(`${socio.apellido}, ${socio.nombre}`)
                  setSociosEncontrados([])
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex justify-between"
              >
                <span className="font-medium">{socio.apellido}, {socio.nombre}</span>
                <span className="text-gray-400">#{socio.numeroSocio}</span>
              </button>
            ))}
          </div>
        )}
        {buscando && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto text-gray-400" />
          </div>
        )}
      </div>

      {/* Estadísticas del jugador */}
      {stats ? (
        <div className="space-y-6">
          {/* Info del jugador */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{stats.jugador?.apellido}, {stats.jugador?.nombre}</h2>
                <p className="text-primary-100">#{stats.jugador?.numeroSocio}</p>
                <p className="text-sm text-primary-100 mt-1">{stats.jugador?.categoria || 'Sin categoría'}</p>
              </div>
            </div>
          </div>

          {/* KPIs del jugador */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Partidos Jugados"
              value={formatNumber(stats.partidos?.jugados || 0)}
              icon={Trophy}
              color="blue"
            />
            <KPICard
              title="Goles"
              value={formatNumber(stats.goles || 0)}
              subtitle={`Promedio: ${((stats.goles || 0) / (stats.partidos?.jugados || 1)).toFixed(2)}`}
              icon={Target}
              color="green"
            />
            <KPICard
              title="Asistencias"
              value={formatNumber(stats.asistencias || 0)}
              subtitle={`Promedio: ${((stats.asistencias || 0) / (stats.partidos?.jugados || 1)).toFixed(2)}`}
              icon={Award}
              color="purple"
            />
            <KPICard
              title="Amarillas / Rojas"
              value={`${stats.tarjetasAmarillas || 0} / ${stats.tarjetasRojas || 0}`}
              icon={Activity}
              color="yellow"
            />
          </div>

          {/* Asistencia a entrenamientos */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-4">Asistencia a Entrenamientos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{stats.asistencia?.presentes || 0}</p>
                <p className="text-xs text-gray-500">Presentes</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{stats.asistencia?.ausentes || 0}</p>
                <p className="text-xs text-gray-500">Ausentes</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.asistencia?.justificadas || 0}</p>
                <p className="text-xs text-gray-500">Justificadas</p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {formatPercent(stats.asistencia?.porcentaje || 0)}
                </p>
                <p className="text-xs text-gray-500">% Asistencia</p>
              </div>
            </div>
          </div>

          {/* Resultados de partidos */}
          {stats.partidos && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 mb-4">Resultados en Partidos</h3>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{stats.partidos.ganados || 0}</p>
                  <p className="text-sm text-gray-500">Ganados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-600">{stats.partidos.empatados || 0}</p>
                  <p className="text-sm text-gray-500">Empatados</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{stats.partidos.perdidos || 0}</p>
                  <p className="text-sm text-gray-500">Perdidos</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Busca un jugador para ver sus estadísticas</p>
        </div>
      )}
    </div>
  )
}
