import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, UserCheck, UserX, UserPlus, TrendingUp, TrendingDown, Dumbbell, AlertCircle, Clock, Calendar, Download } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// Generar lista de períodos (últimos 24 meses)
function generarPeriodos() {
  const periodos = []
  const ahora = new Date()
  for (let i = 0; i < 24; i++) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    periodos.push({
      valor: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`,
      label: `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`,
      año: fecha.getFullYear(),
      mes: fecha.getMonth()
    })
  }
  return periodos
}

export default function ReporteSocios() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [socios, setSocios] = useState([])
  const [estados, setEstados] = useState([])
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [estadoFiltro, setEstadoFiltro] = useState('VIGENTE')
  const [metricas, setMetricas] = useState({
    conActividades: 0,
    conDeuda: 0,
    antiguedadPromedio: 0,
  })

  // Período seleccionado para métricas de crecimiento
  const periodos = useMemo(() => generarPeriodos(), [])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(periodos[0]?.valor || '')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      // Obtener todos los socios y datos adicionales
      const [sociosResp, estadosData, tiposData, categoriasData, actividadesResp] = await Promise.all([
        api.get('/admin/socios?limit=10000'),
        api.get('/admin/estados-socio'),
        api.get('/admin/tipos-socio'),
        api.get('/admin/categorias-socio'),
        api.get('/admin/actividades'),
      ])

      const sociosData = sociosResp?.socios || []
      setSocios(sociosData)
      setEstados(estadosData || [])
      setTipos(tiposData || [])
      setCategorias(categoriasData || [])

      // Calcular métricas que no dependen del período
      const ahora = new Date()

      // Socios con actividades (tienen inscripciones)
      let sociosConActividades = new Set()
      for (const actividad of (actividadesResp || [])) {
        for (const cat of (actividad.categorias || [])) {
          try {
            const catData = await api.get(`/admin/categorias-actividad/${cat.id}`)
            for (const ins of (catData.inscripciones || [])) {
              if (ins.socioId) sociosConActividades.add(ins.socioId)
            }
          } catch (e) {
            // Ignorar errores de categorías individuales
          }
        }
      }

      // IDs de socios VIGENTES
      const sociosVigentesIds = new Set(
        sociosData
          .filter(s => s.estado === 'VIGENTE' || (estadosData || []).find(e => e.id === s.estadoSocioId)?.nombre === 'VIGENTE')
          .map(s => s.id)
      )

      // Socios VIGENTES con deuda (cuotas pendientes)
      let sociosConDeuda = 0
      try {
        // Obtener cuotas pendientes y filtrar por socios vigentes
        const cuotasResp = await api.get('/admin/cuotas?estado=PENDIENTE&limit=10000')
        const cuotasPendientes = cuotasResp?.cuotas || []
        const sociosConDeudaSet = new Set(
          cuotasPendientes
            .filter(c => sociosVigentesIds.has(c.socioId))
            .map(c => c.socioId)
        )
        sociosConDeuda = sociosConDeudaSet.size
      } catch (e) {
        // Si falla, dejamos en 0
      }

      // Antigüedad promedio (en años) - solo socios con fechaAlta
      let sumaAntiguedad = 0
      let countConFecha = 0
      sociosData.forEach(s => {
        if (s.fechaAlta) {
          const fechaAlta = new Date(s.fechaAlta)
          const años = (ahora - fechaAlta) / (1000 * 60 * 60 * 24 * 365)
          sumaAntiguedad += años
          countConFecha++
        }
      })

      setMetricas({
        conActividades: sociosConActividades.size,
        conDeuda: sociosConDeuda,
        antiguedadPromedio: countConFecha > 0 ? (sumaAntiguedad / countConFecha).toFixed(1) : 0,
      })
    } catch (err) {
      setError('Error al cargar estadísticas de socios')
    } finally {
      setLoading(false)
    }
  }

  // Calcular estadísticas
  const estadisticas = (() => {
    // Agrupar por estado (todos los socios)
    const porEstado = estados.map(e => ({
      ...e,
      cantidad: socios.filter(s => s.estado === e.nombre || s.estadoSocioId === e.id).length
    })).sort((a, b) => b.cantidad - a.cantidad)

    // Filtrar socios por estado seleccionado
    const sociosFiltrados = estadoFiltro
      ? socios.filter(s => s.estado === estadoFiltro || estados.find(e => e.id === s.estadoSocioId)?.nombre === estadoFiltro)
      : socios

    // Agrupar por tipo (socios filtrados)
    const porTipo = tipos.map(t => ({
      ...t,
      cantidad: sociosFiltrados.filter(s => s.tipoSocio === t.nombre || s.tipoSocioRelId === t.id).length
    })).sort((a, b) => b.cantidad - a.cantidad)

    // Agrupar por categoría (socios filtrados)
    const porCategoria = categorias.map(c => ({
      ...c,
      cantidad: sociosFiltrados.filter(s => s.categoria === c.nombre || s.categoriaSocioId === c.id).length
    })).sort((a, b) => b.cantidad - a.cantidad)

    return {
      total: socios.length,
      totalFiltrado: sociosFiltrados.length,
      porEstado,
      porTipo,
      porCategoria,
    }
  })()

  // Métricas de crecimiento basadas en el período seleccionado
  const metricasCrecimiento = useMemo(() => {
    if (!periodoSeleccionado || socios.length === 0) {
      return { nuevos: 0, bajas: 0, crecimiento: 0 }
    }

    const [año, mes] = periodoSeleccionado.split('-').map(Number)
    const primerDia = new Date(año, mes - 1, 1)
    const ultimoDia = new Date(año, mes, 0, 23, 59, 59, 999)

    // Nuevos en el período (por fechaAlta)
    const nuevos = socios.filter(s => {
      if (!s.fechaAlta) return false
      const fechaAlta = new Date(s.fechaAlta)
      return fechaAlta >= primerDia && fechaAlta <= ultimoDia
    }).length

    // Bajas en el período (por fechaBaja)
    const bajas = socios.filter(s => {
      if (!s.fechaBaja) return false
      const esBaja = s.estado === 'BAJA' || estados.find(e => e.id === s.estadoSocioId)?.nombre?.includes('BAJA')
      const fechaBaja = new Date(s.fechaBaja)
      return esBaja && fechaBaja >= primerDia && fechaBaja <= ultimoDia
    }).length

    return {
      nuevos,
      bajas,
      crecimiento: nuevos - bajas
    }
  }, [periodoSeleccionado, socios, estados])

  // Colores para las barras
  const coloresEstado = {
    'VIGENTE': 'bg-green-500',
    'ACTIVO': 'bg-green-500',
    'BAJA': 'bg-red-500',
    'SUSPENDIDO': 'bg-yellow-500',
    'PENDIENTE': 'bg-blue-500',
  }

  function getColorEstado(nombre) {
    for (const [key, color] of Object.entries(coloresEstado)) {
      if (nombre?.toUpperCase().includes(key)) return color
    }
    return 'bg-gray-500'
  }

  const exportarExcel = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      const hostname = window.location.hostname
      const match = hostname.match(/^([^.]+)\.localhost/)
      if (match) headers['X-Tenant-Slug'] = match[1]
      const params = estadoFiltro ? `?estado=${estadoFiltro}` : ''
      const response = await fetch(`/api/admin/socios/exportar${params}`, { headers })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `socios_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar:', err)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  const sociosActivos = estadisticas.porEstado.find(e =>
    e.nombre?.toUpperCase().includes('VIGENTE') || e.nombre?.toUpperCase().includes('ACTIVO')
  )?.cantidad || 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/reportes')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Socios</h1>
            <p className="text-gray-500 text-sm">Estadísticas de membresía</p>
          </div>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Resumen general */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-800">{estadisticas.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <UserCheck className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Activos</p>
              <p className="text-xl font-bold text-green-600">{sociosActivos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Dumbbell className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Con actividad</p>
              <p className="text-xl font-bold text-orange-600">{metricas.conActividades}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Con deuda</p>
              <p className="text-xl font-bold text-yellow-600">{metricas.conDeuda}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Antigüedad prom.</p>
              <p className="text-xl font-bold text-purple-600">{metricas.antiguedadPromedio} <span className="text-sm font-normal">años</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Crecimiento por período */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            Crecimiento por Período
          </h3>
          <select
            value={periodoSeleccionado}
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {periodos.map(p => (
              <option key={p.valor} value={p.valor}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-gray-500">Altas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{metricasCrecimiento.nuevos}</p>
          </div>

          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-600" />
              <span className="text-xs text-gray-500">Bajas</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{metricasCrecimiento.bajas}</p>
          </div>

          <div className={`text-center p-3 rounded-lg ${metricasCrecimiento.crecimiento >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              {metricasCrecimiento.crecimiento >= 0
                ? <TrendingUp className="w-4 h-4 text-green-600" />
                : <TrendingDown className="w-4 h-4 text-red-600" />
              }
              <span className="text-xs text-gray-500">Crecimiento</span>
            </div>
            <p className={`text-2xl font-bold ${metricasCrecimiento.crecimiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metricasCrecimiento.crecimiento >= 0 ? '+' : ''}{metricasCrecimiento.crecimiento}
            </p>
          </div>
        </div>
      </div>

      {/* Distribución por Estado, Tipo y Categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por Estado */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Por Estado</h2>
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porEstado.map(estado => {
              const porcentaje = estadisticas.total > 0 ? (estado.cantidad / estadisticas.total) * 100 : 0
              return (
                <div key={estado.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{estado.nombre}</span>
                    <span className="font-medium text-gray-800">
                      {estado.cantidad} <span className="text-gray-400">({porcentaje.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getColorEstado(estado.nombre)}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {estadisticas.porEstado.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Por Tipo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Por Tipo</h2>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Todos</option>
                {estados.map(e => (
                  <option key={e.id} value={e.nombre}>{e.nombre}</option>
                ))}
              </select>
            </div>
            {estadoFiltro && (
              <p className="text-xs text-gray-500 mt-1">
                {estadisticas.totalFiltrado} socios {estadoFiltro}
              </p>
            )}
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porTipo.map((tipo, idx) => {
              const porcentaje = estadisticas.totalFiltrado > 0 ? (tipo.cantidad / estadisticas.totalFiltrado) * 100 : 0
              return (
                <div key={tipo.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{tipo.nombre}</span>
                    <span className="font-medium text-gray-800">
                      {tipo.cantidad} <span className="text-gray-400">({porcentaje.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${['bg-primary', 'bg-blue-500', 'bg-purple-500', 'bg-indigo-500'][idx % 4]}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {estadisticas.porTipo.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Por Categoría */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Por Categoría</h2>
            {estadoFiltro && (
              <p className="text-xs text-gray-500 mt-1">
                Filtrado por estado: {estadoFiltro}
              </p>
            )}
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porCategoria.map((cat, idx) => {
              const porcentaje = estadisticas.totalFiltrado > 0 ? (cat.cantidad / estadisticas.totalFiltrado) * 100 : 0
              return (
                <div key={cat.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{cat.nombre}</span>
                    <span className="font-medium text-gray-800">
                      {cat.cantidad} <span className="text-gray-400">({porcentaje.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${['bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-cyan-500'][idx % 4]}`}
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {estadisticas.porCategoria.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
