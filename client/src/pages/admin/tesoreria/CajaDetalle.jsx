import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Wallet, Building, CreditCard, TrendingUp, TrendingDown, Plus, ArrowRightLeft, Calendar } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

const TIPO_ICONS = {
  EFECTIVO: Wallet,
  BANCO: Building,
  MERCADOPAGO: CreditCard,
  OTRO: Wallet
}

export default function CajaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [caja, setCaja] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return {
      desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0],
      hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    cargarDatos()
  }, [id, periodo])

  async function cargarDatos() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        desde: periodo.desde,
        hasta: periodo.hasta
      })
      const data = await api.get(`/admin/cajas/${id}/resumen?${params}`)
      setCaja(data.caja)
      setResumen(data)
    } catch (err) {
      console.error('Error cargando caja:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!caja) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Caja no encontrada</p>
      </div>
    )
  }

  const Icon = TIPO_ICONS[caja.tipo] || Wallet

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/tesoreria/cajas')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
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
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            caja.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {caja.activo ? 'Activa' : 'Inactiva'}
          </span>
          <Button variant="secondary" onClick={() => navigate(`/admin/tesoreria/cajas/${id}/editar`)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      {/* Saldo actual */}
      <div className="bg-gradient-to-r from-primary to-red-700 rounded-lg shadow-sm p-6 mb-6 text-white">
        <p className="text-white/80 text-sm mb-1">Saldo Actual</p>
        <p className={`text-4xl font-bold ${caja.saldoActual < 0 ? 'text-yellow-200' : ''}`}>
          ${caja.saldoActual.toLocaleString()}
        </p>
        {caja.descripcion && (
          <p className="text-white/70 text-sm mt-2">{caja.descripcion}</p>
        )}
      </div>

      {/* Acciones rapidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Button
          variant="secondary"
          className="justify-center"
          onClick={() => navigate(`/admin/tesoreria/movimientos/nuevo?cajaId=${id}&tipo=INGRESO`)}
        >
          <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
          Registrar Ingreso
        </Button>
        <Button
          variant="secondary"
          className="justify-center"
          onClick={() => navigate(`/admin/tesoreria/movimientos/nuevo?cajaId=${id}&tipo=EGRESO`)}
        >
          <TrendingDown className="w-4 h-4 mr-2 text-red-600" />
          Registrar Egreso
        </Button>
        <Button
          variant="secondary"
          className="justify-center"
          onClick={() => navigate(`/admin/tesoreria/transferencias/nueva?origenId=${id}`)}
        >
          <ArrowRightLeft className="w-4 h-4 mr-2 text-blue-600" />
          Transferir
        </Button>
      </div>

      {/* Filtro de periodo */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Periodo:</span>
          </div>
          <input
            type="date"
            value={periodo.desde}
            onChange={(e) => setPeriodo(p => ({ ...p, desde: e.target.value }))}
            className="input-field text-sm"
          />
          <span className="text-gray-400">a</span>
          <input
            type="date"
            value={periodo.hasta}
            onChange={(e) => setPeriodo(p => ({ ...p, hasta: e.target.value }))}
            className="input-field text-sm"
          />
        </div>
      </div>

      {/* Resumen del periodo */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ingresos ({resumen.ingresos.cantidad})</p>
                <p className="text-xl font-bold text-green-600">
                  +${resumen.ingresos.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Egresos ({resumen.egresos.cantidad})</p>
                <p className="text-xl font-bold text-red-600">
                  -${resumen.egresos.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${resumen.saldoMovimientos >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <Wallet className={`w-5 h-5 ${resumen.saldoMovimientos >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Neto del periodo</p>
                <p className={`text-xl font-bold ${resumen.saldoMovimientos >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {resumen.saldoMovimientos >= 0 ? '+' : ''}${resumen.saldoMovimientos.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ultimos movimientos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Ultimos Movimientos</h2>
          <Link
            to={`/admin/tesoreria/movimientos?cajaId=${id}`}
            className="text-sm text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {resumen?.ultimosMovimientos?.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {resumen.ultimosMovimientos.map((mov) => (
              <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${mov.tipo === 'INGRESO' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {mov.tipo === 'INGRESO' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {mov.concepto?.nombre || mov.descripcion || mov.tipo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(mov.fecha).toLocaleDateString()} - {mov.numero}
                      {mov.medioPago && ` - ${mov.medioPago.nombre}`}
                    </p>
                  </div>
                </div>
                <span className={`font-bold ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                  {mov.tipo === 'INGRESO' ? '+' : '-'}${mov.monto.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No hay movimientos en el periodo seleccionado
          </div>
        )}
      </div>
    </div>
  )
}
