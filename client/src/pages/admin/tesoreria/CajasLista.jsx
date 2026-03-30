import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Wallet, Building, CreditCard, Eye, Edit, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPO_ICONS = {
  EFECTIVO: Wallet,
  BANCO: Building,
  MERCADOPAGO: CreditCard,
  OTRO: Wallet
}

const TIPO_COLORS = {
  EFECTIVO: 'bg-green-100 text-green-700',
  BANCO: 'bg-blue-100 text-blue-700',
  MERCADOPAGO: 'bg-cyan-100 text-cyan-700',
  OTRO: 'bg-gray-100 text-gray-700'
}

export default function CajasLista() {
  const navigate = useNavigate()
  const [cajas, setCajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [soloActivas, setSoloActivas] = useState(true)

  useEffect(() => {
    cargarCajas()
  }, [soloActivas])

  async function cargarCajas() {
    setLoading(true)
    try {
      const params = soloActivas ? '?activo=true' : ''
      const res = await api.getFull(`/admin/cajas${params}`)
      setCajas(res.data || [])
    } catch (err) {
      console.error('Error cargando cajas:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalSaldo = cajas.reduce((sum, c) => sum + (Number(c.saldoActual) || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cajas</h1>
            <p className="text-gray-500 text-sm">{cajas.length} cajas registradas</p>
          </div>
        </div>
{tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
          <Button onClick={() => navigate('/admin/tesoreria/cajas/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Caja
          </Button>
        )}
      </div>

      {/* Resumen */}
      <div className="bg-gradient-to-r from-primary to-primary-light rounded-lg shadow-sm p-6 mb-6 text-white">
        <p className="text-white/80 text-sm mb-1">Saldo Total ({cajas.length} cajas)</p>
        <p className="text-3xl font-bold">${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
      </div>

      {/* Filtro */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soloActivas}
            onChange={(e) => setSoloActivas(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-600">Solo cajas activas</span>
        </label>
      </div>

      {/* Grid de Cajas */}
      {loading ? (
        <LoadingSpinner />
      ) : cajas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay cajas registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cajas.map((caja) => {
            const Icon = TIPO_ICONS[caja.tipo] || Wallet
            return (
              <div
                key={caja.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/admin/tesoreria/cajas/${caja.id}`)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${TIPO_COLORS[caja.tipo]?.replace('text-', 'bg-').replace('-700', '-100') || 'bg-gray-100'}`}>
                        <Icon className={`w-5 h-5 ${TIPO_COLORS[caja.tipo]?.split(' ')[1] || 'text-gray-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{caja.nombre}</h3>
                        <p className="text-xs text-gray-500">{caja.codigo}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${TIPO_COLORS[caja.tipo] || 'bg-gray-100 text-gray-600'}`}>
                      {caja.tipo}
                    </span>
                  </div>

                  <div className={`text-2xl font-bold ${(Number(caja.saldoActual) || 0) >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    ${(Number(caja.saldoActual) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>

                  {caja.descripcion && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-1">{caja.descripcion}</p>
                  )}
                </div>

                <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between">
                  <span className={`text-xs font-medium ${caja.activo ? 'text-green-600' : 'text-gray-400'}`}>
                    {caja.activo ? 'Activa' : 'Inactiva'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/tesoreria/cajas/${caja.id}`)
                      }}
                      className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {tienePermiso(PERMISOS.CAJA_MOVIMIENTOS) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/tesoreria/cajas/${caja.id}/editar`)
                        }}
                        className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
