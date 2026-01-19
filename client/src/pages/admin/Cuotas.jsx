import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Receipt, Search, Filter, ChevronDown, CheckCircle, Clock, AlertTriangle, DollarSign } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function Cuotas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [cuotas, setCuotas] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Filtros
  const [periodoId, setPeriodoId] = useState(searchParams.get('periodoId') || '')
  const [estado, setEstado] = useState(searchParams.get('estado') || '')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(true)

  // Seleccion para pago
  const [seleccionadas, setSeleccionadas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [medioPagoId, setMedioPagoId] = useState('')
  const [registrandoPago, setRegistrandoPago] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    cargarCuotas()
  }, [periodoId, estado, page])

  async function cargarDatosIniciales() {
    try {
      const [periodosData, mediosData] = await Promise.all([
        api.get('/admin/periodos'),
        api.get('/admin/medios-pago'),
      ])
      setPeriodos(periodosData || [])
      setMediosPago(mediosData || [])
      if (mediosData?.length > 0) {
        setMedioPagoId(mediosData[0].id.toString())
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err)
    }
  }

  async function cargarCuotas() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (periodoId) params.append('periodoId', periodoId)
      if (estado) params.append('estado', estado)
      params.append('page', page.toString())

      const data = await api.get(`/admin/cuotas?${params}`)
      setCuotas(data.data || [])
      setPagination(data.pagination)
    } catch (err) {
      setError('Error al cargar cuotas')
    } finally {
      setLoading(false)
    }
  }

  function toggleSeleccion(cuotaId) {
    setSeleccionadas(prev =>
      prev.includes(cuotaId)
        ? prev.filter(id => id !== cuotaId)
        : [...prev, cuotaId]
    )
  }

  function seleccionarTodas() {
    const pendientes = cuotas.filter(c => c.estado === 'PENDIENTE').map(c => c.id)
    if (seleccionadas.length === pendientes.length) {
      setSeleccionadas([])
    } else {
      setSeleccionadas(pendientes)
    }
  }

  function calcularTotalSeleccionado() {
    return cuotas
      .filter(c => seleccionadas.includes(c.id))
      .reduce((sum, c) => sum + Number(c.montoTotal), 0)
  }

  async function registrarPago() {
    if (seleccionadas.length === 0 || !medioPagoId) return

    // Obtener el socioId de la primera cuota seleccionada
    const primerasCuotas = cuotas.filter(c => seleccionadas.includes(c.id))
    const socioId = primerasCuotas[0]?.socioId

    // Verificar que todas las cuotas son del mismo socio
    const mismosocio = primerasCuotas.every(c => c.socioId === socioId)
    if (!mismosocio) {
      setError('Solo se pueden pagar cuotas del mismo socio a la vez')
      return
    }

    setRegistrandoPago(true)
    setError(null)

    try {
      const result = await api.post('/admin/pagos', {
        socioId,
        cuotaIds: seleccionadas,
        medioPagoId: parseInt(medioPagoId),
      })
      setSuccess(`Pago registrado correctamente. Recibo #${result.numero}`)
      setSeleccionadas([])
      setShowPagoModal(false)
      cargarCuotas()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar pago')
    } finally {
      setRegistrandoPago(false)
    }
  }

  function getEstadoBadge(estado) {
    switch (estado) {
      case 'PAGADA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Pagada
          </span>
        )
      case 'VENCIDA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3" />
            Vencida
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        )
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cuotas</h1>
          <p className="text-gray-500 mt-1">Administra las cuotas de los socios</p>
        </div>
        <Button onClick={() => navigate('/admin/periodos')} variant="secondary" className="flex items-center gap-2">
          Ver Periodos
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Filtros */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
              <select
                value={periodoId}
                onChange={e => { setPeriodoId(e.target.value); setPage(1) }}
                className="input-field w-full"
              >
                <option value="">Todos los periodos</option>
                {periodos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={estado}
                onChange={e => { setEstado(e.target.value); setPage(1) }}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="PAGADA">Pagadas</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setPeriodoId(''); setEstado(''); setPage(1) }}
                className="text-sm text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de acciones para cuotas seleccionadas */}
      {seleccionadas.length > 0 && (
        <div className="mb-4 p-4 bg-primary-light rounded-lg border border-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-primary-dark">
              {seleccionadas.length} cuota{seleccionadas.length > 1 ? 's' : ''} seleccionada{seleccionadas.length > 1 ? 's' : ''}
            </p>
            <p className="text-2xl font-bold text-primary">
              ${calcularTotalSeleccionado().toLocaleString('es-AR')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setSeleccionadas([])} variant="secondary" size="sm">
              Cancelar
            </Button>
            <Button onClick={() => setShowPagoModal(true)} className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Registrar Pago
            </Button>
          </div>
        </div>
      )}

      {/* Tabla de cuotas */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : cuotas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay cuotas para mostrar</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={seleccionadas.length === cuotas.filter(c => c.estado === 'PENDIENTE').length && cuotas.filter(c => c.estado === 'PENDIENTE').length > 0}
                        onChange={seleccionarTodas}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Socio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cuotas.map(cuota => (
                    <tr
                      key={cuota.id}
                      className={`hover:bg-gray-50 ${seleccionadas.includes(cuota.id) ? 'bg-primary-light' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {cuota.estado === 'PENDIENTE' && (
                          <input
                            type="checkbox"
                            checked={seleccionadas.includes(cuota.id)}
                            onChange={() => toggleSeleccion(cuota.id)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/admin/socios/${cuota.socioId}`)}
                          className="text-left hover:text-primary"
                        >
                          <p className="font-medium text-gray-800">{cuota.socio?.apellidoNombre}</p>
                          <p className="text-sm text-gray-500">#{cuota.socio?.nroSocio}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {cuota.periodo?.nombre}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{cuota.tipoCuota?.nombre}</p>
                        {cuota.categoriaActividad && (
                          <p className="text-xs text-gray-500">
                            {cuota.categoriaActividad.actividad?.nombre} - {cuota.categoriaActividad.nombre}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-800">
                          ${Number(cuota.montoTotal).toLocaleString('es-AR')}
                        </p>
                        {Number(cuota.montoBonificacion) > 0 && (
                          <p className="text-xs text-green-600">
                            -{Number(cuota.montoBonificacion).toLocaleString('es-AR')} desc.
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getEstadoBadge(cuota.estado)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(cuota.fechaVencimiento).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginacion */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-gray-600">
                Pagina {page} de {pagination.pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.pages}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Registrar Pago</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Cuotas a pagar</p>
                <p className="text-3xl font-bold text-gray-800">
                  ${calcularTotalSeleccionado().toLocaleString('es-AR')}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {seleccionadas.length} cuota{seleccionadas.length > 1 ? 's' : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
                <select
                  value={medioPagoId}
                  onChange={e => setMedioPagoId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  {mediosPago.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={registrarPago}
                  loading={registrandoPago}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Pago
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPagoModal(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
