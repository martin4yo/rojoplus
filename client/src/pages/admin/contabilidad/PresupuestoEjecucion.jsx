import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart2, Star } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function PresupuestoEjecucion() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vistaActiva, setVistaActiva] = useState('detalle') // detalle, resumen
  const [filtroTipo, setFiltroTipo] = useState('') // '', 'CUENTA', 'CONCEPTO'
  const [filtroEstado, setFiltroEstado] = useState('') // '', 'ok', 'warning', 'danger'
  const [filtroMes, setFiltroMes] = useState('') // '', '1'-'12'

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    try {
      setLoading(true)
      const [ejecRes, resumenRes] = await Promise.all([
        api.getFull(`/admin/presupuestos/${id}/ejecucion`),
        api.getFull(`/admin/presupuestos/${id}/resumen`)
      ])
      setData(ejecRes.data)
      setResumen(resumenRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }

  const getEjecucionStatus = (porcentaje) => {
    if (porcentaje >= 90 && porcentaje <= 110) return 'ok'
    if (porcentaje >= 75 && porcentaje <= 125) return 'warning'
    return 'danger'
  }

  const getStatusBadge = (porcentaje) => {
    const status = getEjecucionStatus(porcentaje)
    const estilos = {
      ok: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800'
    }
    return estilos[status]
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error || 'Presupuesto no encontrado'}
      </div>
    )
  }

  // Agrupar datos por cuenta/concepto
  const lineasAgrupadas = {}
  for (const linea of data.lineas) {
    let key, nombre, tipo, tipoCuenta
    if (linea.cuentaContableId) {
      key = `cuenta_${linea.cuentaContableId}`
      nombre = linea.cuentaContable?.nombre || 'Cuenta sin nombre'
      tipo = 'CUENTA'
      tipoCuenta = linea.cuentaContable?.tipo || 'EGRESO'
    } else {
      key = `concepto_${linea.conceptoId}`
      nombre = linea.concepto?.nombre || 'Concepto sin nombre'
      tipo = 'CONCEPTO'
      // Para conceptos, usar el tipo de la cuenta contable asociada
      tipoCuenta = linea.concepto?.cuentaContable?.tipo || linea.concepto?.tipo || 'EGRESO'
    }

    if (!lineasAgrupadas[key]) {
      lineasAgrupadas[key] = {
        key,
        tipo,
        tipoCuenta,
        nombre,
        meses: {},
        totalPresupuestado: 0,
        totalEjecutado: 0
      }
    }

    lineasAgrupadas[key].meses[linea.mes] = {
      presupuestado: parseFloat(linea.montoPresupuestado),
      ejecutado: linea.montoEjecutado,
      diferencia: linea.diferencia,
      porcentaje: linea.porcentajeEjecucion
    }
    lineasAgrupadas[key].totalPresupuestado += parseFloat(linea.montoPresupuestado)
    lineasAgrupadas[key].totalEjecutado += linea.montoEjecutado
  }

  // Si hay filtro de mes, calcular totales solo para ese mes
  const mesSeleccionado = filtroMes ? parseInt(filtroMes) : null

  const filasArray = Object.values(lineasAgrupadas).map(fila => {
    // Si hay filtro de mes, usar los valores de ese mes específico
    if (mesSeleccionado) {
      const mesDatos = fila.meses[mesSeleccionado] || { presupuestado: 0, ejecutado: 0 }
      return {
        ...fila,
        totalPresupuestado: mesDatos.presupuestado,
        totalEjecutado: mesDatos.ejecutado,
        porcentajeTotal: mesDatos.presupuestado !== 0
          ? (mesDatos.ejecutado / mesDatos.presupuestado) * 100
          : 0
      }
    }
    // Sin filtro, usar totales anuales
    return {
      ...fila,
      porcentajeTotal: fila.totalPresupuestado !== 0
        ? (fila.totalEjecutado / fila.totalPresupuestado) * 100
        : 0
    }
  })

  // Aplicar filtros
  const filasFiltradas = filasArray.filter(fila => {
    if (filtroTipo && fila.tipo !== filtroTipo) return false
    if (filtroEstado) {
      const status = getEjecucionStatus(fila.porcentajeTotal)
      if (status !== filtroEstado) return false
    }
    return true
  })

  // Totales separados por tipo (ingresos positivos, egresos negativos)
  const filasIngresos = filasArray.filter(f => f.tipoCuenta === 'INGRESO')
  const filasEgresos = filasArray.filter(f => f.tipoCuenta !== 'INGRESO')

  const ingresosPresupuestados = filasIngresos.reduce((sum, f) => sum + f.totalPresupuestado, 0)
  const ingresosEjecutados = filasIngresos.reduce((sum, f) => sum + f.totalEjecutado, 0)
  const egresosPresupuestados = filasEgresos.reduce((sum, f) => sum + f.totalPresupuestado, 0)
  const egresosEjecutados = filasEgresos.reduce((sum, f) => sum + f.totalEjecutado, 0)

  // Resultado = Ingresos + Egresos (egresos ya son negativos)
  const totalPresupuestado = ingresosPresupuestados + egresosPresupuestados
  const totalEjecutado = ingresosEjecutados + egresosEjecutados
  const porcentajeGeneral = totalPresupuestado !== 0 ? (totalEjecutado / totalPresupuestado) * 100 : 0

  // KPIs
  const kpis = {
    lineasOk: filasArray.filter(f => getEjecucionStatus(f.porcentajeTotal) === 'ok').length,
    lineasWarning: filasArray.filter(f => getEjecucionStatus(f.porcentajeTotal) === 'warning').length,
    lineasDanger: filasArray.filter(f => getEjecucionStatus(f.porcentajeTotal) === 'danger').length,
    total: filasArray.length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/admin/contabilidad/presupuestos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Control Presupuestario - {data.presupuesto.anio}
              </h1>
              <span className="text-sm text-gray-400">v{data.presupuesto.version}</span>
              {data.presupuesto.esPrincipal && (
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" title="Versión Principal" />
              )}
            </div>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              {data.presupuesto.nombre} - Comparación presupuesto vs ejecución real
              {filtroMes && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {MESES[parseInt(filtroMes) - 1]} {data.presupuesto.anio}
                </span>
              )}
            </p>
          </div>
        </div>
        <Link to={`/admin/contabilidad/presupuestos/${id}`}>
          <Button variant="outline">
            Ver Presupuesto
          </Button>
        </Link>
      </div>

      {/* KPIs - Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-green-100 text-green-700">+</span>
                Ingresos
              </p>
              <p className="text-lg font-bold text-green-700">{formatMoney(ingresosEjecutados)}</p>
              <p className="text-xs text-gray-500">de {formatMoney(ingresosPresupuestados)}</p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                ingresosPresupuestados > 0 ? getStatusBadge((ingresosEjecutados / ingresosPresupuestados) * 100) : 'bg-gray-100 text-gray-600'
              }`}>
                {ingresosPresupuestados > 0 ? Math.round((ingresosEjecutados / ingresosPresupuestados) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Egresos */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-red-100 text-red-700">−</span>
                Egresos
              </p>
              <p className="text-lg font-bold text-red-700">{formatMoney(egresosEjecutados)}</p>
              <p className="text-xs text-gray-500">de {formatMoney(egresosPresupuestados)}</p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                egresosPresupuestados !== 0 ? getStatusBadge((egresosEjecutados / egresosPresupuestados) * 100) : 'bg-gray-100 text-gray-600'
              }`}>
                {egresosPresupuestados !== 0 ? Math.round((egresosEjecutados / egresosPresupuestados) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${totalEjecutado >= 0 ? 'border-green-500' : 'border-red-500'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Resultado</p>
              <p className={`text-lg font-bold ${totalEjecutado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatMoney(totalEjecutado)}
              </p>
              <p className="text-xs text-gray-500">presup. {formatMoney(totalPresupuestado)}</p>
            </div>
            <div className="text-right">
              {totalEjecutado >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Estado de partidas */}
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 mb-2">Estado de Partidas</p>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">{kpis.lineasOk}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-sm">{kpis.lineasWarning}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-sm">{kpis.lineasDanger}</span>
            </div>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div className="bg-green-500" style={{width: `${(kpis.lineasOk / kpis.total) * 100}%`}}></div>
            <div className="bg-yellow-500" style={{width: `${(kpis.lineasWarning / kpis.total) * 100}%`}}></div>
            <div className="bg-red-500" style={{width: `${(kpis.lineasDanger / kpis.total) * 100}%`}}></div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Tipo:</label>
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CUENTA">Cuentas Contables</option>
              <option value="CONCEPTO">Conceptos</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Estado:</label>
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ok">En rango (90-110%)</option>
              <option value="warning">Desviación moderada (75-125%)</option>
              <option value="danger">Desviación alta</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Mes:</label>
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value="">Año completo</option>
              {MESES.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
          </div>
          <div className="flex-1"></div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              className={`px-3 py-1 rounded text-sm ${vistaActiva === 'detalle' ? 'bg-white shadow' : ''}`}
              onClick={() => setVistaActiva('detalle')}
            >
              Detalle
            </button>
            <button
              className={`px-3 py-1 rounded text-sm ${vistaActiva === 'resumen' ? 'bg-white shadow' : ''}`}
              onClick={() => setVistaActiva('resumen')}
            >
              Resumen
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Ejecución */}
      {vistaActiva === 'detalle' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                    Cuenta / Concepto
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Presupuestado
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ejecutado
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diferencia
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % Ejecución
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No hay datos para mostrar
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((fila) => {
                    const diferencia = fila.totalPresupuestado - fila.totalEjecutado
                    const status = getEjecucionStatus(fila.porcentajeTotal)
                    return (
                      <tr key={fila.key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              fila.tipo === 'CUENTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {fila.tipo === 'CUENTA' ? 'Cta' : 'Cpto'}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded font-bold ${
                              fila.tipoCuenta === 'INGRESO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {fila.tipoCuenta === 'INGRESO' ? '+' : '−'}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{fila.nombre}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-gray-900">
                          {formatMoney(fila.totalPresupuestado)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-gray-900">
                          {formatMoney(fila.totalEjecutado)}
                        </td>
                        <td className={`px-3 py-3 text-right text-sm font-medium ${
                          diferencia >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {diferencia >= 0 ? '+' : ''}{formatMoney(diferencia)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(fila.porcentajeTotal)}`}>
                            {Math.round(fila.porcentajeTotal)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {status === 'ok' && <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />}
                          {status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto" />}
                          {status === 'danger' && <AlertTriangle className="w-5 h-5 text-red-500 mx-auto" />}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                {/* Fila de Ingresos */}
                <tr className="bg-green-50 font-medium">
                  <td className="px-4 py-2 text-sm text-green-800 sticky left-0 bg-green-50">
                    <span className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-green-200 text-green-700">+</span>
                      INGRESOS
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-green-700">{formatMoney(ingresosPresupuestados)}</td>
                  <td className="px-3 py-2 text-right text-sm text-green-700">{formatMoney(ingresosEjecutados)}</td>
                  <td className="px-3 py-2 text-right text-sm text-green-700">{formatMoney(ingresosPresupuestados - ingresosEjecutados)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ingresosPresupuestados > 0 ? getStatusBadge((ingresosEjecutados / ingresosPresupuestados) * 100) : 'bg-gray-100'}`}>
                      {ingresosPresupuestados > 0 ? Math.round((ingresosEjecutados / ingresosPresupuestados) * 100) : 0}%
                    </span>
                  </td>
                  <td className="bg-green-50"></td>
                </tr>
                {/* Fila de Egresos */}
                <tr className="bg-red-50 font-medium">
                  <td className="px-4 py-2 text-sm text-red-800 sticky left-0 bg-red-50">
                    <span className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-xs rounded font-bold bg-red-200 text-red-700">−</span>
                      EGRESOS
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-red-700">{formatMoney(egresosPresupuestados)}</td>
                  <td className="px-3 py-2 text-right text-sm text-red-700">{formatMoney(egresosEjecutados)}</td>
                  <td className="px-3 py-2 text-right text-sm text-red-700">{formatMoney(egresosPresupuestados - egresosEjecutados)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${egresosPresupuestados !== 0 ? getStatusBadge((egresosEjecutados / egresosPresupuestados) * 100) : 'bg-gray-100'}`}>
                      {egresosPresupuestados !== 0 ? Math.round((egresosEjecutados / egresosPresupuestados) * 100) : 0}%
                    </span>
                  </td>
                  <td className="bg-red-50"></td>
                </tr>
                {/* Fila de Resultado */}
                <tr className="bg-gray-200 font-bold">
                  <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-200">RESULTADO</td>
                  <td className={`px-3 py-3 text-right text-sm ${totalPresupuestado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(totalPresupuestado)}
                  </td>
                  <td className={`px-3 py-3 text-right text-sm ${totalEjecutado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(totalEjecutado)}
                  </td>
                  <td className={`px-3 py-3 text-right text-sm ${
                    totalPresupuestado - totalEjecutado >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatMoney(totalPresupuestado - totalEjecutado)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(porcentajeGeneral)}`}>
                      {Math.round(porcentajeGeneral)}%
                    </span>
                  </td>
                  <td className="bg-gray-200"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Vista Resumen por Mes */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cuenta / Concepto
                  </th>
                  {MESES.map((mes, idx) => (
                    <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      {mes}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-gray-100">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filasFiltradas.map((fila) => (
                  <tr key={fila.key} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{fila.nombre}</span>
                    </td>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((mes) => {
                      const data = fila.meses[mes]
                      if (!data) {
                        return <td key={mes} className="px-2 py-2 text-center text-gray-400">-</td>
                      }
                      const status = getEjecucionStatus(data.porcentaje)
                      return (
                        <td key={mes} className="px-2 py-2 text-center">
                          <div className={`text-xs px-1 py-0.5 rounded ${
                            status === 'ok' ? 'bg-green-50' :
                            status === 'warning' ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            {Math.round(data.porcentaje)}%
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center bg-gray-50">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(fila.porcentajeTotal)}`}>
                        {Math.round(fila.porcentajeTotal)}%
                      </span>
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
