import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit, Wallet, Building, CreditCard, TrendingUp, TrendingDown,
  ArrowRightLeft, Calendar, ChevronDown, ChevronRight, Search, Banknote,
  Smartphone, FileText, X, Scale, Eye
} from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPO_ICONS = {
  EFECTIVO: Wallet,
  BANCO: Building,
  MERCADOPAGO: CreditCard,
  OTRO: Wallet
}

const MEDIO_PAGO_CONFIG = {
  EFECTIVO:         { label: 'Efectivo',         icon: Banknote,      color: 'text-green-600',  bg: 'bg-green-50' },
  MERCADOPAGO:      { label: 'MercadoPago',      icon: Smartphone,    color: 'text-blue-600',   bg: 'bg-blue-50' },
  QR:               { label: 'QR / MercadoPago', icon: Smartphone,    color: 'text-blue-600',   bg: 'bg-blue-50' },
  TRANSFERENCIA:    { label: 'Transferencia',    icon: ArrowRightLeft, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  CHEQUE:           { label: 'Cheque',           icon: FileText,      color: 'text-orange-600', bg: 'bg-orange-50' },
  TARJETA:          { label: 'Tarjeta',          icon: CreditCard,    color: 'text-purple-600', bg: 'bg-purple-50' },
  TARJETA_CREDITO:  { label: 'Tarjeta Crédito',  icon: CreditCard,    color: 'text-purple-600', bg: 'bg-purple-50' },
  TARJETA_DEBITO:   { label: 'Tarjeta Débito',   icon: CreditCard,    color: 'text-violet-600', bg: 'bg-violet-50' },
  CUENTA_CORRIENTE: { label: 'Cuenta Corriente', icon: FileText,      color: 'text-teal-600',   bg: 'bg-teal-50' },
  OTRO:             { label: 'Otro',             icon: Wallet,        color: 'text-gray-600',   bg: 'bg-gray-50' },
  SIN_ESPECIFICAR:  { label: 'Sin especificar',  icon: Wallet,        color: 'text-gray-500',   bg: 'bg-gray-50' },
}

function getMedioPagoKey(value) {
  return value || 'SIN_ESPECIFICAR'
}

function MedioPagoRow({ grupo, cajaId, periodo }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const config = MEDIO_PAGO_CONFIG[grupo.medioPagoTipo] || MEDIO_PAGO_CONFIG.OTRO
  const Icon = config.icon
  const displayLabel = grupo.medioPago || 'Sin especificar'

  async function toggleExpand() {
    if (!expanded && movimientos.length === 0) {
      await cargarMovimientos('')
    }
    setExpanded(v => !v)
  }

  async function cargarMovimientos(texto) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        cajaId,
        medioPagoId: grupo.medioPagoId ?? 'null',
        limit: 200
      })
      if (periodo.desde) params.set('desde', periodo.desde)
      if (periodo.hasta) params.set('hasta', periodo.hasta)
      if (texto) params.set('busqueda', texto)
      const res = await api.getFull(`/admin/movimientos-caja?${params}`)
      setMovimientos(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleBusqueda(e) {
    const val = e.target.value
    setBusqueda(val)
    cargarMovimientos(val)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Fila resumen */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <span className={`font-medium text-gray-800 flex-1`}>{displayLabel}</span>

        <div className="flex items-center gap-6 text-sm">
          {grupo.cantIngresos > 0 && (
            <span className="text-green-600 font-medium">
              +{formatCurrency(grupo.ingresos, { showSymbol: false })}
              <span className="text-gray-400 font-normal ml-1">({grupo.cantIngresos})</span>
            </span>
          )}
          {grupo.cantEgresos > 0 && (
            <span className="text-red-600 font-medium">
              -{formatCurrency(grupo.egresos, { showSymbol: false })}
              <span className="text-gray-400 font-normal ml-1">({grupo.cantEgresos})</span>
            </span>
          )}
          <span className={`font-bold min-w-[80px] text-right ${grupo.neto >= 0 ? 'text-gray-800' : 'text-red-700'}`}>
            {grupo.neto >= 0 ? '+' : ''}{formatCurrency(grupo.neto, { showSymbol: false })}
          </span>
        </div>

        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
        }
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Searchbox dentro del grupo */}
          <div className="p-3 bg-gray-50 border-b border-gray-100">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={handleBusqueda}
                placeholder="Buscar por número o descripción..."
                className="input-field pl-8 py-1.5 text-sm w-full"
              />
              {busqueda && (
                <button onClick={() => { setBusqueda(''); cargarMovimientos('') }} className="absolute right-2 top-2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : movimientos.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">Sin movimientos</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Número</th>
                    <th className="text-left px-4 py-2">Concepto</th>
                    <th className="text-left px-4 py-2">Observación</th>
                    <th className="text-right px-4 py-2">Monto</th>
                    <th className="text-right px-4 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movimientos.map(mov => (
                    <tr key={mov.id} className={`hover:bg-gray-50 ${mov.anulado ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDate(mov.fecha)}</td>
                      <td className="px-4 py-2 font-mono text-gray-500 whitespace-nowrap">{mov.numero}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {mov.concepto || '-'}
                        {mov.anulado && <span className="ml-2 text-xs text-gray-400">(anulado)</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate" title={mov.descripcion || ''}>
                        {mov.descripcion || <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                        {mov.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(mov.monto, { showSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => navigate(`/admin/tesoreria/movimientos/${mov.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PREFILTROS = [
  { key: 'hoy',     label: 'Hoy' },
  { key: 'ayer',    label: 'Ayer' },
  { key: 'semana',  label: 'Esta semana' },
  { key: 'mes',     label: 'Este mes' },
  { key: 'custom',  label: 'Personalizado' },
]

function getPeriodoPara(key) {
  const hoy = new Date()
  if (key === 'hoy')   return { desde: toISO(hoy), hasta: toISO(hoy) }
  if (key === 'ayer') {
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
    return { desde: toISO(ayer), hasta: toISO(ayer) }
  }
  if (key === 'semana') {
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    return { desde: toISO(lunes), hasta: toISO(hoy) }
  }
  if (key === 'mes') {
    return {
      desde: toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta: toISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
    }
  }
  return null
}

export default function CajaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [caja, setCaja] = useState(null)
  const [loadingCaja, setLoadingCaja] = useState(true)
  const [resumen, setResumen] = useState(null)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [prefiltro, setPrefiltro] = useState('hoy')
  const [periodo, setPeriodo] = useState(() => getPeriodoPara('hoy'))

  // Carga la caja una sola vez
  useEffect(() => {
    async function cargarCaja() {
      setLoadingCaja(true)
      try {
        const params = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta })
        const data = await api.get(`/admin/cajas/${id}/resumen?${params}`)
        setCaja(data.caja)
        setResumen(data)
      } catch (err) {
        console.error('Error cargando caja:', err)
      } finally {
        setLoadingCaja(false)
      }
    }
    cargarCaja()
  }, [id])

  // Recarga solo el resumen cuando cambia el periodo (sin tocar `caja`)
  useEffect(() => {
    if (!caja) return
    async function cargarResumen() {
      setLoadingResumen(true)
      try {
        const params = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta })
        const data = await api.get(`/admin/cajas/${id}/resumen?${params}`)
        setResumen(data)
      } catch (err) {
        console.error('Error cargando resumen:', err)
      } finally {
        setLoadingResumen(false)
      }
    }
    cargarResumen()
  }, [periodo])

  if (loadingCaja) {
    return (
      <LoadingSpinner />
    )
  }

  if (!caja) {
    return <div className="text-center py-12"><p className="text-gray-500">Caja no encontrada</p></div>
  }

  const Icon = TIPO_ICONS[caja.tipo] || Wallet

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/tesoreria/cajas')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{caja.nombre}</h1>
              <p className="text-gray-500 text-sm">{caja.codigo} - {caja.tipo}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${caja.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {caja.activo ? 'Activa' : 'Inactiva'}
          </span>
          {tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
            <Button variant="secondary" onClick={() => navigate(`/admin/tesoreria/cajas/${id}/editar`)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Saldo actual */}
      <div className="bg-gradient-to-r from-primary to-primary-light rounded-lg shadow-sm p-6 mb-6 text-white">
        <p className="text-white/80 text-sm mb-1">Saldo Actual</p>
        <p className={`text-4xl font-bold ${caja.saldoActual < 0 ? 'text-yellow-200' : ''}`}>
          ${caja.saldoActual.toLocaleString()}
        </p>
        {caja.descripcion && <p className="text-white/70 text-sm mt-2">{caja.descripcion}</p>}
      </div>

      {/* Acciones rápidas */}
      {tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Button variant="secondary" className="justify-center" onClick={() => navigate(`/admin/tesoreria/movimientos/nuevo?cajaId=${id}&tipo=INGRESO`)}>
            <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
            Registrar Ingreso
          </Button>
          <Button variant="secondary" className="justify-center" onClick={() => navigate(`/admin/tesoreria/movimientos/nuevo?cajaId=${id}&tipo=EGRESO`)}>
            <TrendingDown className="w-4 h-4 mr-2 text-red-600" />
            Registrar Egreso
          </Button>
          <Button variant="secondary" className="justify-center" onClick={() => navigate(`/admin/tesoreria/transferencias/nueva?origenId=${id}`)}>
            <ArrowRightLeft className="w-4 h-4 mr-2 text-blue-600" />
            Transferir
          </Button>
        </div>
      )}

      {/* Filtro de periodo */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto h-9">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {PREFILTROS.map(p => (
            <button
              key={p.key}
              onClick={() => {
                setPrefiltro(p.key)
                const rango = getPeriodoPara(p.key)
                if (rango) setPeriodo(rango)
              }}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                prefiltro === p.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          {prefiltro === 'custom' && (
            <>
              <span className="text-gray-300 flex-shrink-0">|</span>
              <input
                type="date"
                value={periodo.desde}
                onChange={(e) => setPeriodo(p => ({ ...p, desde: e.target.value }))}
                className="input-field text-sm py-1 w-36 flex-shrink-0"
              />
              <span className="text-gray-400 text-sm flex-shrink-0">al</span>
              <input
                type="date"
                value={periodo.hasta}
                onChange={(e) => setPeriodo(p => ({ ...p, hasta: e.target.value }))}
                className="input-field text-sm py-1 w-36 flex-shrink-0"
              />
            </>
          )}
        </div>
      </div>

      {/* Resumen del periodo */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Saldo anterior */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <Wallet className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Saldo anterior</p>
                <p className={`text-xl font-bold ${resumen.saldoAnterior >= 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                  ${(resumen.saldoAnterior ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          {/* Ingresos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ingresos ({resumen.ingresos.cantidad})</p>
                <p className="text-xl font-bold text-green-600">+${resumen.ingresos.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {/* Egresos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Egresos ({resumen.egresos.cantidad})</p>
                <p className="text-xl font-bold text-red-600">-${resumen.egresos.total.toLocaleString()}</p>
              </div>
            </div>
          </div>
          {/* Saldo final del período */}
          <div className={`rounded-lg shadow-sm border p-4 ${resumen.saldoFinal >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${resumen.saldoFinal >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <Scale className={`w-5 h-5 ${resumen.saldoFinal >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className={`text-sm ${resumen.saldoFinal >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo al cierre</p>
                <p className={`text-xl font-bold ${resumen.saldoFinal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  ${(resumen.saldoFinal ?? resumen.saldoMovimientos).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Por Medio de Pago */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">Por Medio de Pago</h2>
        {loadingResumen ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : resumen?.porMedioPago?.length > 0 ? (
          <div className="space-y-2">
            {resumen.porMedioPago.map(grupo => (
              <MedioPagoRow
                key={grupo.medioPagoId ?? 'sin-especificar'}
                grupo={grupo}
                cajaId={id}
                periodo={periodo}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-8">Sin movimientos en el periodo</p>
        )}
      </div>

    </div>
  )
}
