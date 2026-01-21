import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search, Calendar, ChevronDown, ArrowLeft, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

export default function LibroMayor() {
  const [cuentas, setCuentas] = useState([])
  const [saldos, setSaldos] = useState({})
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMov, setLoadingMov] = useState(false)

  const [filters, setFilters] = useState({
    desde: '',
    hasta: '',
    search: ''
  })

  useEffect(() => {
    cargarCuentas()
  }, [])

  useEffect(() => {
    if (cuentaSeleccionada) {
      cargarMovimientos()
    }
  }, [cuentaSeleccionada, filters.desde, filters.hasta])

  async function cargarCuentas() {
    try {
      setLoading(true)
      // Cargar cuentas y saldos en paralelo
      const [resCuentas, resSaldos] = await Promise.all([
        api.getFull('/admin/cuentas-contables?esImputable=true&activo=true&flat=true'),
        api.getFull('/admin/asientos/resumen/balance').catch(() => ({ data: { cuentas: {}, totales: {} } }))
      ])

      setCuentas(resCuentas.data || [])

      // Procesar saldos - crear mapa de id -> saldo
      const saldosMap = {}
      const saldosData = resSaldos.data?.cuentas || {}

      // Procesar cada tipo
      Object.values(saldosData).forEach(cuentasTipo => {
        cuentasTipo.forEach(c => {
          saldosMap[c.id] = c.saldo
        })
      })

      setSaldos(saldosMap)
    } catch (err) {
      console.error('Error cargando cuentas:', err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarMovimientos() {
    if (!cuentaSeleccionada) return

    try {
      setLoadingMov(true)
      const params = new URLSearchParams()
      if (filters.desde) params.append('desde', filters.desde)
      if (filters.hasta) params.append('hasta', filters.hasta)

      const url = `/admin/asientos/libro-mayor/${cuentaSeleccionada.id}${params.toString() ? '?' + params.toString() : ''}`
      const res = await api.getFull(url)
      setMovimientos(res.data.movimientos || [])
      setResumen(res.data.resumen || null)
    } catch (err) {
      console.error('Error cargando movimientos:', err)
      setMovimientos([])
      setResumen(null)
    } finally {
      setLoadingMov(false)
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount || 0)
  }

  const cuentasFiltradas = cuentas.filter(c => {
    if (!filters.search) return true
    const search = filters.search.toLowerCase()
    return (
      c.codigo.toLowerCase().includes(search) ||
      c.nombre.toLowerCase().includes(search)
    )
  })

  // Agrupar cuentas por tipo
  const cuentasPorTipo = cuentasFiltradas.reduce((acc, c) => {
    const tipo = c.tipo || 'OTROS'
    if (!acc[tipo]) acc[tipo] = []
    acc[tipo].push(c)
    return acc
  }, {})

  const tipoLabels = {
    ACTIVO: 'Activo',
    PASIVO: 'Pasivo',
    PATRIMONIO: 'Patrimonio Neto',
    INGRESO: 'Ingresos',
    EGRESO: 'Egresos',
    OTROS: 'Otros'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/contabilidad/asientos"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Libro Mayor</h1>
            <p className="text-sm text-gray-500">Movimientos por cuenta contable</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: Lista de cuentas */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 mb-3">Cuentas Contables</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cuenta..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-field pl-9 w-full text-sm"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Cargando...</div>
            ) : (
              Object.entries(cuentasPorTipo).map(([tipo, cuentasTipo]) => (
                <div key={tipo} className="border-b last:border-b-0">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    {tipoLabels[tipo] || tipo}
                  </div>
                  {cuentasTipo.map(cuenta => {
                    const saldo = saldos[cuenta.id] || 0
                    // Determinar si es deudor o acreedor según naturaleza de la cuenta
                    const esCuentaDeudora = ['ACTIVO', 'EGRESO'].includes(cuenta.tipo)
                    const esDeudor = esCuentaDeudora ? saldo > 0 : saldo < 0
                    return (
                      <button
                        key={cuenta.id}
                        onClick={() => setCuentaSeleccionada(cuenta)}
                        className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition ${
                          cuentaSeleccionada?.id === cuenta.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-gray-500">{cuenta.codigo}</span>
                          {saldo !== 0 && (
                            <span className="font-mono text-xs font-medium">
                              <span className={esDeudor ? 'text-blue-600' : 'text-orange-600'}>
                                {formatMoney(Math.abs(saldo))}
                              </span>
                              <span className={`ml-0.5 ${esDeudor ? 'text-blue-400' : 'text-orange-400'}`}>
                                {esDeudor ? 'D' : 'H'}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{cuenta.nombre}</p>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Movimientos */}
        <div className="lg:col-span-2 space-y-4">
          {!cuentaSeleccionada ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Seleccione una cuenta para ver sus movimientos</p>
            </div>
          ) : (
            <>
              {/* Info cuenta seleccionada */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-gray-500">{cuentaSeleccionada.codigo}</span>
                    <h2 className="text-lg font-semibold text-gray-900">{cuentaSeleccionada.nombre}</h2>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    cuentaSeleccionada.tipo === 'ACTIVO' ? 'bg-blue-100 text-blue-800' :
                    cuentaSeleccionada.tipo === 'PASIVO' ? 'bg-orange-100 text-orange-800' :
                    cuentaSeleccionada.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' :
                    cuentaSeleccionada.tipo === 'EGRESO' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tipoLabels[cuentaSeleccionada.tipo] || cuentaSeleccionada.tipo}
                  </span>
                </div>
              </div>

              {/* Filtros de fecha */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={filters.desde}
                      onChange={(e) => setFilters({ ...filters, desde: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={filters.hasta}
                      onChange={(e) => setFilters({ ...filters, hasta: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <Button variant="secondary" onClick={() => setFilters({ ...filters, desde: '', hasta: '' })}>
                    Limpiar
                  </Button>
                </div>
              </div>

              {/* Resumen */}
              {resumen && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Total Debe</span>
                    </div>
                    <p className="text-lg font-semibold">{formatMoney(resumen.totalDebe)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-red-600 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Total Haber</span>
                    </div>
                    <p className="text-lg font-semibold">{formatMoney(resumen.totalHaber)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-medium">Saldo</span>
                    </div>
                    <p className={`text-lg font-semibold ${
                      Number(resumen.saldo) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatMoney(resumen.saldo)}
                    </p>
                  </div>
                </div>
              )}

              {/* Tabla de movimientos */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Asiento
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Concepto
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Debe
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Haber
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                          Saldo
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                          Ver
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingMov ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Cargando movimientos...
                          </td>
                        </tr>
                      ) : movimientos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No hay movimientos en el período seleccionado
                          </td>
                        </tr>
                      ) : (
                        movimientos.map((mov, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {formatDate(mov.fecha)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-primary">{mov.asientoNumero}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {mov.descripcion || mov.asientoConcepto}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(mov.debe) > 0 && (
                                <span className="font-mono text-sm text-green-600">
                                  {formatMoney(mov.debe)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {Number(mov.haber) > 0 && (
                                <span className="font-mono text-sm text-red-600">
                                  {formatMoney(mov.haber)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono text-sm font-medium ${
                                Number(mov.saldoAcumulado) >= 0 ? 'text-gray-900' : 'text-red-600'
                              }`}>
                                {formatMoney(mov.saldoAcumulado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Link
                                to={`/admin/contabilidad/asientos/${mov.asientoId}`}
                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition inline-flex"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
