import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Link2, CheckCircle2, AlertCircle, RefreshCw,
  ArrowRight, FileText, User, Calendar, Zap, Check, X
} from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount || 0)
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR')
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

export default function ConciliacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [extracto, setExtracto] = useState(null)
  const [pendientes, setPendientes] = useState({ movimientosExtracto: [], movimientosCaja: [], sugerencias: [] })
  const [matches, setMatches] = useState([]) // { movimientoExtractoId, movimientoCajaId }
  const [selectedExtracto, setSelectedExtracto] = useState(null)
  const [selectedCaja, setSelectedCaja] = useState(null)
  const [conciliando, setConciliando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [id])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [extractoRes, pendientesRes] = await Promise.all([
        api.getFull(`/admin/conciliacion/extractos/${id}`),
        api.getFull(`/admin/conciliacion/pendientes?extractoId=${id}`)
      ])
      setExtracto(extractoRes.data)
      setPendientes(pendientesRes.data)

      // Auto-aplicar sugerencias de alta confianza
      const sugerenciasAltas = (pendientesRes.data.sugerencias || [])
        .filter(s => s.confianza === 'ALTA')
      if (sugerenciasAltas.length > 0) {
        setMatches(sugerenciasAltas.map(s => ({
          movimientoExtractoId: s.movimientoExtractoId,
          movimientoCajaId: s.movimientoCajaId
        })))
      }
    } catch (err) {
      setError('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectExtracto(mov) {
    if (selectedExtracto?.id === mov.id) {
      setSelectedExtracto(null)
    } else {
      setSelectedExtracto(mov)
      // Buscar sugerencia
      const sugerencia = pendientes.sugerencias?.find(s => s.movimientoExtractoId === mov.id)
      if (sugerencia) {
        const cajaSugerida = pendientes.movimientosCaja.find(m => m.id === sugerencia.movimientoCajaId)
        if (cajaSugerida && !isMatched(cajaSugerida.id)) {
          setSelectedCaja(cajaSugerida)
        }
      }
    }
  }

  function handleSelectCaja(mov) {
    if (selectedCaja?.id === mov.id) {
      setSelectedCaja(null)
    } else {
      setSelectedCaja(mov)
    }
  }

  function handleMatch() {
    if (!selectedExtracto || !selectedCaja) return

    // Verificar que no esten ya matcheados
    if (isMatched(selectedExtracto.id, 'extracto') || isMatched(selectedCaja.id, 'caja')) {
      setError('Uno de los movimientos ya esta matcheado')
      return
    }

    setMatches(prev => [...prev, {
      movimientoExtractoId: selectedExtracto.id,
      movimientoCajaId: selectedCaja.id
    }])
    setSelectedExtracto(null)
    setSelectedCaja(null)
  }

  function handleRemoveMatch(movimientoExtractoId) {
    setMatches(prev => prev.filter(m => m.movimientoExtractoId !== movimientoExtractoId))
  }

  function isMatched(movId, tipo = 'extracto') {
    if (tipo === 'extracto') {
      return matches.some(m => m.movimientoExtractoId === movId)
    }
    return matches.some(m => m.movimientoCajaId === movId)
  }

  function getMatchedWith(movId, tipo = 'extracto') {
    if (tipo === 'extracto') {
      const match = matches.find(m => m.movimientoExtractoId === movId)
      if (match) {
        return pendientes.movimientosCaja.find(m => m.id === match.movimientoCajaId)
      }
    } else {
      const match = matches.find(m => m.movimientoCajaId === movId)
      if (match) {
        return pendientes.movimientosExtracto.find(m => m.id === match.movimientoExtractoId)
      }
    }
    return null
  }

  function aplicarTodasSugerencias() {
    const nuevosMatches = (pendientes.sugerencias || [])
      .filter(s => !isMatched(s.movimientoExtractoId, 'extracto') && !isMatched(s.movimientoCajaId, 'caja'))
      .map(s => ({
        movimientoExtractoId: s.movimientoExtractoId,
        movimientoCajaId: s.movimientoCajaId
      }))
    setMatches(prev => [...prev, ...nuevosMatches])
  }

  async function handleConciliar() {
    if (matches.length === 0) {
      setError('Debe vincular al menos un movimiento')
      return
    }

    setConciliando(true)
    setError(null)
    try {
      const response = await api.post('/admin/conciliacion/conciliar', {
        extractoId: parseInt(id),
        matches,
        observaciones
      })
      setSuccess(response.message)
      setMatches([])
      cargarDatos()
    } catch (err) {
      setError(err.message || 'Error al conciliar')
    } finally {
      setConciliando(false)
    }
  }

  const montoMatcheado = matches.reduce((sum, m) => {
    const movE = pendientes.movimientosExtracto.find(e => e.id === m.movimientoExtractoId)
    return sum + (movE?.importe || 0)
  }, 0)

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!extracto) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Extracto no encontrado</p>
        <Button onClick={() => navigate('/admin/tesoreria/conciliacion')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const pendientesExtracto = pendientes.movimientosExtracto.filter(m => !m.conciliado && !isMatched(m.id, 'extracto'))
  const pendientesCaja = pendientes.movimientosCaja.filter(m => !isMatched(m.id, 'caja'))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/tesoreria/conciliacion')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Link2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Conciliar Extracto {extracto.numero}
            </h1>
            <p className="text-sm text-gray-500">
              {extracto.caja?.nombre} | {formatDate(extracto.periodoDesde)} - {formatDate(extracto.periodoHasta)}
            </p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Resumen extracto */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Movimientos</p>
            <p className="text-xl font-bold">{extracto.cantidadMovimientos}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Saldo Inicial</p>
            <p className="text-xl font-bold">{formatMoney(extracto.saldoInicial)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Creditos</p>
            <p className="text-xl font-bold text-green-600">{formatMoney(extracto.totalCreditos)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Debitos</p>
            <p className="text-xl font-bold text-red-600">{formatMoney(extracto.totalDebitos)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Saldo Final</p>
            <p className="text-xl font-bold">{formatMoney(extracto.saldoFinal)}</p>
          </div>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              <strong>{matches.length}</strong> movimientos vinculados
              <span className="text-primary ml-2">({formatMoney(montoMatcheado)})</span>
            </span>
            {pendientes.sugerencias?.length > 0 && (
              <Button onClick={aplicarTodasSugerencias} variant="secondary" size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Aplicar Sugerencias ({pendientes.sugerencias.length})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones..."
              className="input-field w-64"
            />
            <Button onClick={handleConciliar} loading={conciliando} disabled={matches.length === 0}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Conciliar ({matches.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Panel de matching - 2 columnas */}
      <div className="grid grid-cols-2 gap-6">
        {/* Columna Extracto Bancario */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <h3 className="font-semibold text-blue-800">
              <FileText className="w-4 h-4 inline mr-2" />
              Extracto Bancario
            </h3>
            <span className="text-sm text-blue-600">{pendientesExtracto.length} pendientes</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {pendientesExtracto.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>Todos los movimientos conciliados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendientesExtracto.map(mov => {
                  const isSelected = selectedExtracto?.id === mov.id
                  const sugerencia = pendientes.sugerencias?.find(s => s.movimientoExtractoId === mov.id)
                  return (
                    <div
                      key={mov.id}
                      onClick={() => handleSelectExtracto(mov)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-800">{mov.concepto}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(mov.fecha)}
                            {mov.referencia && <span className="ml-2">Ref: {mov.referencia}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${mov.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.tipo === 'CREDITO' ? '+' : '-'}{formatMoney(mov.importe)}
                          </p>
                          {sugerencia && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              sugerencia.confianza === 'ALTA' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              <Zap className="w-3 h-3 inline" /> Match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna Movimientos Caja */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <h3 className="font-semibold text-amber-800">
              <User className="w-4 h-4 inline mr-2" />
              Movimientos de Caja
            </h3>
            <span className="text-sm text-amber-600">{pendientesCaja.length} pendientes</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {pendientesCaja.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No hay movimientos pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendientesCaja.map(mov => {
                  const isSelected = selectedCaja?.id === mov.id
                  return (
                    <div
                      key={mov.id}
                      onClick={() => handleSelectCaja(mov)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-50 border-l-4 border-amber-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-800">{mov.concepto}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(mov.fecha)} | {mov.numero}
                          </p>
                          {mov.pago?.socio && (
                            <p className="text-xs text-gray-500">
                              <User className="w-3 h-3 inline mr-1" />
                              #{mov.pago.socio.nroSocio} - {mov.pago.socio.apellidoNombre}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${mov.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                            {mov.tipo === 'INGRESO' ? '+' : '-'}{formatMoney(mov.monto)}
                          </p>
                          {mov.pago?.medioPago && (
                            <span className="text-xs text-gray-400">{mov.pago.medioPago.nombre}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Boton de vincular (entre las columnas) */}
      {selectedExtracto && selectedCaja && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <Button onClick={handleMatch} size="lg" className="shadow-xl">
            <Link2 className="w-5 h-5 mr-2" />
            Vincular Seleccionados
          </Button>
        </div>
      )}

      {/* Lista de matches pendientes de confirmar */}
      {matches.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="font-semibold text-green-800">
              <Check className="w-4 h-4 inline mr-2" />
              Movimientos Vinculados ({matches.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {matches.map(match => {
              const movE = pendientes.movimientosExtracto.find(m => m.id === match.movimientoExtractoId)
              const movC = pendientes.movimientosCaja.find(m => m.id === match.movimientoCajaId)
              if (!movE || !movC) return null
              return (
                <div key={match.movimientoExtractoId} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="font-medium">{movE.concepto}</p>
                      <p className="text-xs text-gray-400">{formatDate(movE.fecha)} | {formatMoney(movE.importe)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <div className="text-sm">
                      <p className="font-medium">{movC.concepto}</p>
                      <p className="text-xs text-gray-400">{movC.numero} | {formatMoney(movC.monto)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMatch(match.movimientoExtractoId)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Movimientos ya conciliados del extracto */}
      {extracto.movimientos?.filter(m => m.conciliado).length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-600">
              <CheckCircle2 className="w-4 h-4 inline mr-2" />
              Ya Conciliados ({extracto.movimientos.filter(m => m.conciliado).length})
            </h3>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600">Fecha</th>
                  <th className="px-4 py-2 text-left text-gray-600">Concepto</th>
                  <th className="px-4 py-2 text-right text-gray-600">Importe</th>
                  <th className="px-4 py-2 text-left text-gray-600">Conciliado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {extracto.movimientos.filter(m => m.conciliado).map(mov => (
                  <tr key={mov.id} className="text-gray-500">
                    <td className="px-4 py-2">{formatDate(mov.fecha)}</td>
                    <td className="px-4 py-2">{mov.concepto}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={mov.tipo === 'CREDITO' ? 'text-green-600' : 'text-red-600'}>
                        {formatMoney(mov.importe)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 inline mr-1" />
                      {formatDate(mov.fechaConciliacion)}
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
