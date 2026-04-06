import { useState, useEffect, useCallback } from 'react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import toast from 'react-hot-toast'

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(v)

function getFirstDayOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function getLastDayOfMonth() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-AR')
}

export default function MovimientosCentroCosto() {
  const [centros, setCentros] = useState([])
  const [centroCostoId, setCentroCostoId] = useState('')
  const [fechaDesde, setFechaDesde] = useState(getFirstDayOfMonth())
  const [fechaHasta, setFechaHasta] = useState(getLastDayOfMonth())
  const [tipo, setTipo] = useState('caja')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/admin/configuracion/centros-costo')
      .then(res => setCentros(res.data || res || []))
      .catch(() => toast.error('Error al cargar centros de costo'))
  }, [])

  const cargar = useCallback(async () => {
    if (!centroCostoId) return
    try {
      setLoading(true)
      const params = new URLSearchParams({ tipo, page, fechaDesde, fechaHasta })
      const res = await api.get(`/admin/centros-costo/${centroCostoId}/movimientos?${params}`)
      setData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }, [centroCostoId, tipo, page, fechaDesde, fechaHasta])

  useEffect(() => {
    setPage(1)
  }, [centroCostoId, tipo, fechaDesde, fechaHasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const resultado = data ? data.totales.ingresos - data.totales.egresos : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Movimientos por Centro de Costo</h1>
        <p className="text-gray-500 text-sm mt-1">Consulta detallada de movimientos de caja y contables</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
            <select
              value={centroCostoId}
              onChange={e => setCentroCostoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Seleccionar...</option>
              {centros.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={cargar}
              disabled={!centroCostoId || loading}
              className="w-full bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Cargando...' : 'Consultar'}
            </button>
          </div>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-700 font-medium">Ingresos</p>
              <p className="text-2xl font-bold text-green-800 mt-1">{formatCurrency(data.totales.ingresos)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium">Egresos</p>
              <p className="text-2xl font-bold text-red-800 mt-1">{formatCurrency(data.totales.egresos)}</p>
            </div>
            <div className={`rounded-xl p-4 border ${resultado >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-sm font-medium ${resultado >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Resultado</p>
              <p className={`text-2xl font-bold mt-1 ${resultado >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{formatCurrency(resultado)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setTipo('caja')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${tipo === 'caja' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Caja
              </button>
              <button
                onClick={() => setTipo('contable')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${tipo === 'contable' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Contable
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : data.movimientos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No hay movimientos para el período seleccionado</div>
            ) : tipo === 'caja' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-left">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Concepto</th>
                      <th className="px-4 py-3 font-medium">Descripción</th>
                      <th className="px-4 py-3 font-medium">Socio</th>
                      <th className="px-4 py-3 font-medium">Caja</th>
                      <th className="px-4 py-3 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.movimientos.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{formatDate(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{m.concepto?.nombre || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{m.descripcion || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.socio ? `${m.socio.nroSocio} - ${m.socio.apellidoNombre}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.caja?.nombre || '-'}</td>
                        <td className={`px-4 py-3 font-medium text-right ${m.tipo === 'INGRESO' ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(m.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-left">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Concepto</th>
                      <th className="px-4 py-3 font-medium">Referencia</th>
                      <th className="px-4 py-3 font-medium">Número</th>
                      <th className="px-4 py-3 font-medium text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.movimientos.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{formatDate(m.fecha)}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{m.tipo}</td>
                        <td className="px-4 py-3 text-gray-700">{m.concepto?.nombre || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.socio
                            ? `${m.socio.nroSocio} - ${m.socio.apellidoNombre}`
                            : m.entidad?.razonSocial || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.numero || '-'}</td>
                        <td className="px-4 py-3 font-medium text-right text-gray-800">
                          {formatCurrency(m.montoTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.pagination && data.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Página {data.pagination.page} de {data.pagination.pages} — {data.pagination.total} registros
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
                    disabled={page === data.pagination.pages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!centroCostoId && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Seleccioná un centro de costo para ver sus movimientos</p>
        </div>
      )}
    </div>
  )
}
