import { useState, useEffect } from 'react'
import { CreditCard, Check, ArrowRight, RefreshCw, Calendar, Search, Wallet, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount || 0)
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatDateTime(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function PendientesConciliar() {
  const [tab, setTab] = useState('pendientes')
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [cajas, setCajas] = useState([])
  const [cajasDestino, setCajasDestino] = useState([])
  const [selectedMovimientos, setSelectedMovimientos] = useState([])
  const [conciliando, setConciliando] = useState(false)
  const [transfiriendo, setTransfiriendo] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [cajaDestinoId, setCajaDestinoId] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [filtros, setFiltros] = useState({
    cajaId: '',
    desde: '',
    hasta: ''
  })

  useEffect(() => {
    cargarCajas()
    cargarResumen()
  }, [])

  useEffect(() => {
    if (tab === 'pendientes') {
      cargarMovimientos()
    }
  }, [tab, filtros])

  async function cargarCajas() {
    try {
      const response = await api.getFull('/admin/cajas?activo=true')
      const todasCajas = response.data || []
      // Cajas que requieren conciliacion (para filtrar pendientes)
      const cajasConc = todasCajas.filter(c => c.requiereConciliacion)
      setCajas(cajasConc)
      // Cajas destino (las que NO requieren conciliacion, ej: cuenta bancaria)
      const cajasNoCon = todasCajas.filter(c => !c.requiereConciliacion)
      setCajasDestino(cajasNoCon)
    } catch (err) {
      console.error('Error cargando cajas:', err)
    }
  }

  async function cargarResumen() {
    try {
      const response = await api.getFull('/admin/pendientes-conciliar/resumen')
      setResumen(response.data)
    } catch (err) {
      console.error('Error cargando resumen:', err)
    }
  }

  async function cargarMovimientos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.cajaId) params.append('cajaId', filtros.cajaId)
      if (filtros.desde) params.append('desde', filtros.desde)
      if (filtros.hasta) params.append('hasta', filtros.hasta)
      params.append('page', pagination.page)

      const response = await api.getFull(`/admin/pendientes-conciliar?${params}`)
      setMovimientos(response.data || [])
      setPagination(response.pagination || { page: 1, pages: 1, total: 0 })
    } catch (err) {
      console.error('Error cargando movimientos:', err)
      setError('Error al cargar movimientos pendientes')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      setSelectedMovimientos(movimientos.map(m => m.id))
    } else {
      setSelectedMovimientos([])
    }
  }

  function handleSelectMovimiento(id) {
    setSelectedMovimientos(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      }
      return [...prev, id]
    })
  }

  async function handleConciliar() {
    if (selectedMovimientos.length === 0) {
      setError('Seleccione al menos un movimiento')
      return
    }

    setConciliando(true)
    setError(null)
    try {
      const response = await api.post('/admin/pendientes-conciliar/conciliar', {
        movimientoIds: selectedMovimientos,
        observacion: observacion || null
      })
      setSuccess(response.message)
      setSelectedMovimientos([])
      setObservacion('')
      cargarMovimientos()
      cargarResumen()
    } catch (err) {
      setError(err.message || 'Error al conciliar movimientos')
    } finally {
      setConciliando(false)
    }
  }

  async function handleTransferir() {
    if (!cajaDestinoId) {
      setError('Seleccione una caja destino')
      return
    }

    if (selectedMovimientos.length === 0) {
      setError('Seleccione al menos un movimiento')
      return
    }

    // Verificar que todos los movimientos seleccionados son de la misma caja
    const cajasOrigen = [...new Set(movimientos
      .filter(m => selectedMovimientos.includes(m.id))
      .map(m => m.cajaId))]

    if (cajasOrigen.length > 1) {
      setError('Solo puede transferir movimientos de una misma caja a la vez')
      return
    }

    setTransfiriendo(true)
    setError(null)
    try {
      const response = await api.post('/admin/pendientes-conciliar/transferir', {
        cajaOrigenId: cajasOrigen[0],
        cajaDestinoId: parseInt(cajaDestinoId),
        movimientoIds: selectedMovimientos,
        concepto: 'Acreditacion de valores conciliados'
      })
      setSuccess(response.message)
      setSelectedMovimientos([])
      setShowTransferModal(false)
      setCajaDestinoId('')
      cargarMovimientos()
      cargarResumen()
    } catch (err) {
      setError(err.message || 'Error al transferir')
    } finally {
      setTransfiriendo(false)
    }
  }

  const montoSeleccionado = movimientos
    .filter(m => selectedMovimientos.includes(m.id))
    .reduce((sum, m) => sum + m.monto, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <CreditCard className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Valores Pendientes de Conciliar</h1>
            <p className="text-sm text-gray-500">Gestione los pagos con tarjeta pendientes de acreditacion bancaria</p>
          </div>
        </div>
        <Button onClick={() => { cargarResumen(); cargarMovimientos(); }} variant="secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">&times;</button>
        </div>
      )}

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Total Pendiente</p>
                <p className="text-2xl font-bold text-amber-700">{formatMoney(resumen.totalPendiente)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-xs text-amber-500 mt-1">{resumen.totalCantidadPendiente} movimientos</p>
          </div>
          {resumen.cajas?.map(c => (
            <div key={c.caja.id} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{c.caja.nombre}</p>
                  <p className="text-xl font-bold text-gray-800">{formatMoney(c.pendientes.monto)}</p>
                </div>
                <Wallet className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{c.pendientes.cantidad} pendientes</span>
                <span>{c.conciliados.cantidad} conciliados</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('pendientes')}
          className={`px-4 py-2 font-medium transition-colors ${
            tab === 'pendientes'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendientes de Conciliar
        </button>
        <button
          onClick={() => setTab('ayuda')}
          className={`px-4 py-2 font-medium transition-colors ${
            tab === 'ayuda'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Como Funciona
        </button>
      </div>

      {tab === 'pendientes' && (
        <>
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caja</label>
                <select
                  value={filtros.cajaId}
                  onChange={(e) => setFiltros(prev => ({ ...prev, cajaId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Todas las cajas</option>
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={filtros.desde}
                  onChange={(e) => setFiltros(prev => ({ ...prev, desde: e.target.value }))}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filtros.hasta}
                  onChange={(e) => setFiltros(prev => ({ ...prev, hasta: e.target.value }))}
                  className="input-field w-full"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => cargarMovimientos()} variant="secondary" className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          {/* Acciones masivas */}
          {selectedMovimientos.length > 0 && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-blue-700">
                  {selectedMovimientos.length} movimientos seleccionados
                </span>
                <span className="text-blue-600 ml-2">
                  (Total: {formatMoney(montoSeleccionado)})
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConciliar} loading={conciliando} size="sm">
                  <Check className="w-4 h-4 mr-2" />
                  Marcar como Conciliados
                </Button>
                <Button onClick={() => setShowTransferModal(true)} variant="secondary" size="sm">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Transferir a Cuenta Bancaria
                </Button>
              </div>
            </div>
          )}

          {/* Campo observacion */}
          {selectedMovimientos.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observacion de conciliacion (opcional)
              </label>
              <input
                type="text"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                className="input-field w-full"
                placeholder="Ej: Verificado en extracto bancario del 15/02/2026"
              />
            </div>
          )}

          {/* Tabla de movimientos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay movimientos pendientes de conciliar</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedMovimientos.length === movimientos.length && movimientos.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nro.</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Caja</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Concepto</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Socio</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Medio Pago</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movimientos.map(mov => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedMovimientos.includes(mov.id)}
                          onChange={() => handleSelectMovimiento(mov.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(mov.fecha)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">
                        {mov.numero}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {mov.caja?.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {mov.concepto}
                        {mov.descripcion && (
                          <p className="text-xs text-gray-400">{mov.descripcion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {mov.pago?.socio ? (
                          <span>#{mov.pago.socio.nroSocio} - {mov.pago.socio.apellidoNombre}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {mov.pago?.medioPago?.nombre || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-right text-green-600">
                        {formatMoney(mov.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginacion */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setPagination(prev => ({ ...prev, page }))}
                  className={`px-3 py-1 rounded ${
                    pagination.page === page
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'ayuda' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Como funciona la conciliacion de valores</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
              <div>
                <h3 className="font-medium text-gray-800">Ingreso de pagos con tarjeta</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Cuando se registra un pago con tarjeta (presencial o por debito automatico), el monto se acredita
                  en una caja marcada como "Requiere Conciliacion". Estos valores quedan pendientes de verificacion.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">2</div>
              <div>
                <h3 className="font-medium text-gray-800">Verificacion en extracto bancario</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Periodicamente, al recibir el extracto bancario, se verifica que los montos de las tarjetas
                  fueron efectivamente acreditados en la cuenta bancaria del club.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">3</div>
              <div>
                <h3 className="font-medium text-gray-800">Marcar como conciliados</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Seleccione los movimientos que coinciden con el extracto y haga clic en "Marcar como Conciliados".
                  Esto indica que el valor fue verificado y ya no es "pendiente".
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">4</div>
              <div>
                <h3 className="font-medium text-gray-800">Transferir a cuenta bancaria (opcional)</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Opcionalmente, puede transferir los valores conciliados a la caja de "Cuenta Bancaria"
                  para reflejar que el dinero ya esta disponible en el banco.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Importante
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Para que una caja reciba valores pendientes de conciliacion, debe estar marcada con
              "Requiere conciliacion bancaria" en su configuracion. Puede configurar esto desde
              Tesoreria → Cajas → Editar.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Transferencia */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transferir a Cuenta Bancaria</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Transfiriendo <strong>{selectedMovimientos.length}</strong> movimientos por un total de{' '}
                  <strong className="text-green-600">{formatMoney(montoSeleccionado)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta bancaria destino *
                </label>
                <select
                  value={cajaDestinoId}
                  onChange={(e) => setCajaDestinoId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Seleccione una cuenta...</option>
                  {cajasDestino.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setShowTransferModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleTransferir} loading={transfiriendo}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Transferir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
