import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ArrowLeft, Receipt, TrendingUp, DollarSign, ChevronDown, ChevronRight, Users, AlertCircle, Clock, Percent, PieChart as PieChartIcon, ArrowLeftCircle, Download } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/LoadingSpinner'

// Colores para los gráficos
const COLORES_COBRADO = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d']
const COLORES_PENDIENTE = ['#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12']

// Tooltip personalizado
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <p className="font-medium text-gray-800">{data.nombre}</p>
        <p className="text-sm text-gray-600">{formatCurrency(data.valor, { showSymbol: false })}</p>
      </div>
    )
  }
  return null
}

// Componente de gráfico de torta compacto con leyenda
function GraficoTorta({ datos, colores, titulo, total, onSliceClick }) {
  if (!datos || datos.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <PieChartIcon className="w-8 h-8 mb-2" />
        <p className="text-sm">Sin datos</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-36 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={50}
              paddingAngle={2}
              dataKey="valor"
              nameKey="nombre"
              onClick={onSliceClick}
              style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
            >
              {datos.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colores[index % colores.length]}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(total, { showSymbol: false })}</p>

      {/* Leyenda compacta */}
      <div className="mt-2 w-full space-y-0.5 max-h-24 overflow-y-auto">
        {datos.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-0.5 px-1 rounded text-xs ${onSliceClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            onClick={() => onSliceClick && onSliceClick(item)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colores[i % colores.length] }}
              />
              <span className="text-gray-700 truncate">{item.nombre}</span>
            </div>
            <span className="text-gray-500 ml-1 flex-shrink-0">
              {((item.valor / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente contenedor de los gráficos de torta
function GraficosTorta({ reporte, nivel, setNivel, actividadSeleccionada, setActividadSeleccionada }) {
  if (!reporte?.categorias) return null

  // Preparar datos según el nivel
  let datosCobrado = []
  let datosPendiente = []
  let totalCobrado = 0
  let totalPendiente = 0
  let titulo = ''
  let subtitulo = ''

  if (nivel === 'categorias') {
    // Nivel 1: Cuota Social vs Actividades
    titulo = 'Distribución por Tipo'
    subtitulo = 'Clic en una sección para ver detalle'

    reporte.categorias.forEach(cat => {
      if (cat.cobrado > 0) {
        datosCobrado.push({ nombre: cat.nombre, valor: cat.cobrado, categoria: cat.categoria, data: cat })
        totalCobrado += cat.cobrado
      }
      if (cat.pendiente > 0) {
        datosPendiente.push({ nombre: cat.nombre, valor: cat.pendiente, categoria: cat.categoria, data: cat })
        totalPendiente += cat.pendiente
      }
    })
  } else if (nivel === 'actividades') {
    // Nivel 2: Actividades individuales
    const catActividades = reporte.categorias.find(c => c.categoria === 'CUOTA_ACTIVIDAD')
    titulo = 'Actividades'
    subtitulo = 'Clic en una actividad para ver categorías'

    if (catActividades?.actividades) {
      catActividades.actividades.forEach(act => {
        if (act.cobrado > 0) {
          datosCobrado.push({ nombre: act.nombre, valor: act.cobrado, id: act.id, data: act })
          totalCobrado += act.cobrado
        }
        if (act.pendiente > 0) {
          datosPendiente.push({ nombre: act.nombre, valor: act.pendiente, id: act.id, data: act })
          totalPendiente += act.pendiente
        }
      })
    }
  } else if (nivel === 'categoriasActividad' && actividadSeleccionada) {
    // Nivel 3: Categorías de una actividad
    titulo = actividadSeleccionada.nombre
    subtitulo = 'Categorías de la actividad'

    if (actividadSeleccionada.categorias) {
      actividadSeleccionada.categorias.forEach(cat => {
        if (cat.cobrado > 0) {
          datosCobrado.push({ nombre: cat.nombre, valor: cat.cobrado, id: cat.id })
          totalCobrado += cat.cobrado
        }
        if (cat.pendiente > 0) {
          datosPendiente.push({ nombre: cat.nombre, valor: cat.pendiente, id: cat.id })
          totalPendiente += cat.pendiente
        }
      })
    }
  }

  function handleClickCobrado(data) {
    if (nivel === 'categorias' && data.categoria === 'CUOTA_ACTIVIDAD') {
      setNivel('actividades')
    } else if (nivel === 'actividades' && data.data?.categorias?.length > 0) {
      setActividadSeleccionada(data.data)
      setNivel('categoriasActividad')
    }
  }

  function handleClickPendiente(data) {
    if (nivel === 'categorias' && data.categoria === 'CUOTA_ACTIVIDAD') {
      setNivel('actividades')
    } else if (nivel === 'actividades' && data.data?.categorias?.length > 0) {
      setActividadSeleccionada(data.data)
      setNivel('categoriasActividad')
    }
  }

  function handleVolver() {
    if (nivel === 'categoriasActividad') {
      setNivel('actividades')
      setActividadSeleccionada(null)
    } else if (nivel === 'actividades') {
      setNivel('categorias')
    }
  }

  return (
    <div className="lg:w-64 flex-shrink-0 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {nivel !== 'categorias' && (
          <button
            onClick={handleVolver}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition bg-white border border-gray-200"
            title="Volver"
          >
            <ArrowLeftCircle className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
          <p className="text-xs text-gray-500">{subtitulo}</p>
        </div>
      </div>

      {/* Tarjeta Cobrado */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-green-600">Cobrado</p>
          <div className="p-1 rounded bg-green-100">
            <PieChartIcon className="w-3 h-3 text-green-600" />
          </div>
        </div>
        <GraficoTorta
          datos={datosCobrado}
          colores={COLORES_COBRADO}
          titulo="cobrado"
          total={totalCobrado}
          onSliceClick={nivel !== 'categoriasActividad' ? handleClickCobrado : null}
        />
      </div>

      {/* Tarjeta Pendiente */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-yellow-600">Pendiente</p>
          <div className="p-1 rounded bg-yellow-100">
            <PieChartIcon className="w-3 h-3 text-yellow-600" />
          </div>
        </div>
        <GraficoTorta
          datos={datosPendiente}
          colores={COLORES_PENDIENTE}
          titulo="pendiente"
          total={totalPendiente}
          onSliceClick={nivel !== 'categoriasActividad' ? handleClickPendiente : null}
        />
      </div>

      {nivel !== 'categoriasActividad' && (
        <p className="text-xs text-gray-400 text-center">
          Clic en el gráfico para ver detalle
        </p>
      )}
    </div>
  )
}

export default function ReporteCuotas() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reporte, setReporte] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [periodoId, setPeriodoId] = useState(null) // null = no cargado aún
  const [periodosCargados, setPeriodosCargados] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [expandedActivities, setExpandedActivities] = useState({})

  // Modal de morosos
  const [showMorosos, setShowMorosos] = useState(false)
  const [morososData, setMorososData] = useState(null)
  const [loadingMorosos, setLoadingMorosos] = useState(false)
  const [morososFiltro, setMorososFiltro] = useState(null)

  // Gráficos de torta - navegación
  const [nivelGrafico, setNivelGrafico] = useState('categorias')
  const [actividadGrafico, setActividadGrafico] = useState(null)

  useEffect(() => {
    cargarPeriodos()
  }, [])

  useEffect(() => {
    // Solo cargar reporte después de que los períodos estén cargados
    if (periodosCargados) {
      cargarReporte()
      // Resetear el nivel del gráfico cuando cambia el período
      setNivelGrafico('categorias')
      setActividadGrafico(null)
    }
  }, [periodoId, periodosCargados])

  async function cargarPeriodos() {
    try {
      const data = await api.get('/admin/periodos')
      setPeriodos(data || [])

      // Seleccionar el período actual por defecto
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
      const hoy = new Date()
      const mesActual = meses[hoy.getMonth()]
      const añoActual = hoy.getFullYear()
      const nombrePeriodoActual = `${mesActual} ${añoActual}`

      const periodoActual = (data || []).find(p =>
        p.estado === 'GENERADO' && p.nombre === nombrePeriodoActual
      )
      if (periodoActual) {
        setPeriodoId(periodoActual.id.toString())
      } else {
        setPeriodoId('') // Sin período seleccionado
      }
      setPeriodosCargados(true)
    } catch (err) {
      console.error('Error cargando periodos:', err)
      setPeriodosCargados(true) // Marcar como cargados aunque haya error
    }
  }

  async function cargarReporte() {
    setLoading(true)
    try {
      const params = periodoId ? `?periodoId=${periodoId}` : ''
      const data = await api.get(`/admin/reportes/cobranza${params}`)
      setReporte(data)
    } catch (err) {
      setError('Error al cargar reporte de cobranza')
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    if (!reporte) return
    const periodoLabel = periodos.find(p => p.id?.toString() === periodoId)?.nombre || 'Todos'

    // Hoja resumen
    const resumen = [
      ['Reporte de Cobranza', periodoLabel],
      [],
      ['Concepto', 'Valor'],
      ['Total Generado', Number(reporte.totalGenerado) || 0],
      ['Total Cobrado', Number(reporte.totalCobrado) || 0],
      ['Total Pendiente', Number(reporte.totalPendiente) || 0],
      ['% Cobranza', `${reporte.porcentajeCobranza || 0}%`],
    ]

    // Hoja por categoría
    const porCat = (reporte.porCategoria || []).map(c => ({
      'Categoría': c.categoria,
      'Generado': Number(c.generado) || 0,
      'Cobrado': Number(c.cobrado) || 0,
      'Pendiente': Number(c.pendiente) || 0,
      '% Cobranza': `${c.porcentaje || 0}%`,
    }))

    const wb = XLSX.utils.book_new()
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
    wsResumen['!cols'] = [{ wch: 25 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

    if (porCat.length) {
      const wsCat = XLSX.utils.json_to_sheet(porCat)
      wsCat['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoría')
    }

    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `cobranza_${periodoLabel.replace(/\s/g, '_')}_${fecha}.xlsx`)
  }

  async function verMorosos(filtro) {
    setMorososFiltro(filtro)
    setLoadingMorosos(true)
    setShowMorosos(true)

    try {
      const params = new URLSearchParams()
      if (periodoId) params.append('periodoId', periodoId)
      if (filtro.categoria) params.append('categoria', filtro.categoria)
      if (filtro.actividadId) params.append('actividadId', filtro.actividadId)
      if (filtro.categoriaActividadId) params.append('categoriaActividadId', filtro.categoriaActividadId)

      const data = await api.get(`/admin/reportes/cobranza/morosos?${params}`)
      setMorososData(data)
    } catch (err) {
      console.error('Error cargando morosos:', err)
    } finally {
      setLoadingMorosos(false)
    }
  }

  function toggleCategory(cat) {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }))
  }

  function toggleActivity(actId) {
    setExpandedActivities(prev => ({
      ...prev,
      [actId]: !prev[actId]
    }))
  }

  const kpis = reporte?.kpis || {}

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/reportes')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Cobranza</h1>
            <p className="text-gray-500 text-sm">Análisis de cuotas, mora y recaudación</p>
          </div>
        </div>

        {/* Filtro de período + Export */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600">Período:</label>
          <select
            value={periodoId || ''}
            onChange={(e) => setPeriodoId(e.target.value)}
            className="input-field w-48"
          >
            <option value="">Todos los períodos</option>
            {periodos.filter(p => p.estado === 'GENERADO').map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {reporte && (
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Receipt className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Generado</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(kpis.generado?.monto || 0, { showSymbol: false })}</p>
              <p className="text-xs text-gray-400">{kpis.generado?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cobrado</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(kpis.cobrado?.monto || 0, { showSymbol: false })}</p>
              <p className="text-xs text-gray-400">{kpis.cobrado?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <DollarSign className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(kpis.pendiente?.monto || 0, { showSymbol: false })}</p>
              <p className="text-xs text-gray-400">{kpis.pendiente?.cantidad || 0} cuotas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Percent className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">% Morosidad</p>
              <p className="text-lg font-bold text-red-600">{kpis.porcentajeMorosidad || 0}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Días prom. pago</p>
              <p className="text-lg font-bold text-blue-600">{kpis.diasPromedioPago || 0} días</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Recargo acum.</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(kpis.recargoPendiente || 0, { showSymbol: false })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor principal: Gráficos a la izquierda + Tabla a la derecha */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Gráficos de Distribución */}
        <GraficosTorta
          reporte={reporte}
          nivel={nivelGrafico}
          setNivel={setNivelGrafico}
          actividadSeleccionada={actividadGrafico}
          setActividadSeleccionada={setActividadGrafico}
        />

        {/* Tabla jerárquica */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Desglose por Categoría</h2>
            <p className="text-xs text-gray-500">Clic en una fila para ver morosos</p>
          </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Generado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">% Cobro</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Morosos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reporte?.categorias?.map(cat => (
                <>
                  {/* Fila de categoría principal */}
                  <tr
                    key={cat.categoria}
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => cat.actividades ? toggleCategory(cat.categoria) : verMorosos({ categoria: cat.categoria })}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {cat.actividades && (
                          expandedCategories[cat.categoria]
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-semibold text-gray-800">{cat.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-gray-800">{formatCurrency(cat.generado, { showSymbol: false })}</p>
                      <p className="text-xs text-gray-400">{cat.cantGenerado} cuotas</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-green-600">{formatCurrency(cat.cobrado, { showSymbol: false })}</p>
                      <p className="text-xs text-gray-400">{cat.cantCobrado} cuotas</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <p className="font-medium text-yellow-600">{formatCurrency(cat.pendiente, { showSymbol: false })}</p>
                      <p className="text-xs text-gray-400">{cat.cantPendiente} cuotas</p>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${cat.porcentajeCobro >= 70 ? 'bg-green-500' : cat.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${cat.porcentajeCobro}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-10">{cat.porcentajeCobro}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {cat.cantPendiente > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            verMorosos({ categoria: cat.categoria })
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                        >
                          <Users className="w-3 h-3" />
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Filas de actividades (si es ACTIVIDAD y está expandida) */}
                  {cat.actividades && expandedCategories[cat.categoria] && cat.actividades.map(act => (
                    <>
                      <tr
                        key={`act-${act.id}`}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => act.categorias?.length > 0 ? toggleActivity(act.id) : verMorosos({ categoria: 'CUOTA_ACTIVIDAD', actividadId: act.id })}
                      >
                        <td className="px-6 py-3 pl-12">
                          <div className="flex items-center gap-2">
                            {act.categorias?.length > 0 && (
                              expandedActivities[act.id]
                                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                : <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-medium text-gray-700">{act.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-gray-700">{formatCurrency(act.generado, { showSymbol: false })}</p>
                          <p className="text-xs text-gray-400">{act.cantGenerado}</p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-green-600">{formatCurrency(act.cobrado, { showSymbol: false })}</p>
                          <p className="text-xs text-gray-400">{act.cantCobrado}</p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <p className="text-yellow-600">{formatCurrency(act.pendiente, { showSymbol: false })}</p>
                          <p className="text-xs text-gray-400">{act.cantPendiente}</p>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${act.porcentajeCobro >= 70 ? 'bg-green-500' : act.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${act.porcentajeCobro}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-600 w-10">{act.porcentajeCobro}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {act.cantPendiente > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                verMorosos({ categoria: 'CUOTA_ACTIVIDAD', actividadId: act.id })
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                            >
                              <Users className="w-3 h-3" />
                              Ver
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Filas de categorías de actividad */}
                      {expandedActivities[act.id] && act.categorias?.map(catAct => (
                        <tr
                          key={`catact-${catAct.id}`}
                          className="hover:bg-gray-50 cursor-pointer bg-gray-50/50"
                          onClick={() => verMorosos({ categoria: 'CUOTA_ACTIVIDAD', categoriaActividadId: catAct.id })}
                        >
                          <td className="px-6 py-2 pl-20">
                            <span className="text-sm text-gray-600">{catAct.nombre}</span>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-gray-600">{formatCurrency(catAct.generado, { showSymbol: false })}</p>
                            <p className="text-xs text-gray-400">{catAct.cantGenerado}</p>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-green-600">{formatCurrency(catAct.cobrado, { showSymbol: false })}</p>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <p className="text-sm text-yellow-600">{formatCurrency(catAct.pendiente, { showSymbol: false })}</p>
                          </td>
                          <td className="px-6 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${catAct.porcentajeCobro >= 70 ? 'bg-green-500' : catAct.porcentajeCobro >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${catAct.porcentajeCobro}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-10">{catAct.porcentajeCobro}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-2 text-center">
                            {catAct.cantPendiente > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  verMorosos({ categoria: 'CUOTA_ACTIVIDAD', categoriaActividadId: catAct.id })
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                              >
                                <Users className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

          {(!reporte?.categorias || reporte.categorias.length === 0) && (
            <div className="p-8 text-center text-gray-500">
              No hay datos de cobranza para mostrar
            </div>
          )}
        </div>
      </div>

      {/* Modal de Morosos */}
      {showMorosos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Socios con deuda pendiente</h3>
                {morososFiltro && (
                  <p className="text-sm text-gray-500">
                    {morososFiltro.categoria && `Categoría: ${morososFiltro.categoria}`}
                    {morososFiltro.actividadId && ` • Actividad ID: ${morososFiltro.actividadId}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowMorosos(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingMorosos ? (
                <LoadingSpinner />
              ) : morososData?.morosos?.length > 0 ? (
                <>
                  {/* Totales */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Socios</p>
                      <p className="text-lg font-bold text-gray-800">{morososData.totales.cantSocios}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Cuotas</p>
                      <p className="text-lg font-bold text-gray-800">{morososData.totales.cantCuotas}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Deuda total</p>
                      <p className="text-lg font-bold text-yellow-600">{formatCurrency(morososData.totales.totalDeuda, { showSymbol: false })}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Recargo acum.</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(morososData.totales.totalRecargo, { showSymbol: false })}</p>
                    </div>
                  </div>

                  {/* Lista de morosos */}
                  <div className="space-y-2">
                    {morososData.morosos.map(m => (
                      <div
                        key={m.socio.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/cuotas?socioId=${m.socio.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">
                              {m.socio.apellidoNombre}
                              <span className="ml-2 text-sm text-gray-400">#{m.socio.nroSocio}</span>
                            </p>
                            <p className="text-sm text-gray-500">
                              {m.cantCuotas} cuota{m.cantCuotas !== 1 ? 's' : ''} pendiente{m.cantCuotas !== 1 ? 's' : ''}
                              {m.maxDiasAtraso > 0 && (
                                <span className="ml-2 text-red-500">
                                  • {m.maxDiasAtraso} días de atraso máx.
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-yellow-600">{formatCurrency(m.totalDeuda, { showSymbol: false })}</p>
                            {m.totalRecargo > 0 && (
                              <p className="text-xs text-orange-500">+{formatCurrency(m.totalRecargo, { showSymbol: false })} recargo</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No hay socios con deuda pendiente para este filtro
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowMorosos(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
