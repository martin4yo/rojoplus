import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Receipt, Search, CheckCircle, Clock, AlertTriangle, DollarSign, X, User, Users, ChevronDown, ChevronUp, Edit2, Plus, Trash2, CreditCard } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { PlanPagosModal } from '../../components/PlanPagosModal'
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
  const [page, setPage] = useState(1)

  // Buscador de socios
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [showResultados, setShowResultados] = useState(false)
  const searchRef = useRef(null)

  // Modo cobranza
  const [modoCobranza, setModoCobranza] = useState(false)
  const [cobranzaData, setCobranzaData] = useState(null)
  const [cargandoCobranza, setCargandoCobranza] = useState(false)
  const [sociosExpandidos, setSociosExpandidos] = useState({})

  // Seleccion para pago
  const [seleccionadas, setSeleccionadas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [medioPagoId, setMedioPagoId] = useState('')
  const [registrandoPago, setRegistrandoPago] = useState(false)
  const [success, setSuccess] = useState(null)

  // Edicion de cargo
  const [showEditModal, setShowEditModal] = useState(false)
  const [cargoEditando, setCargoEditando] = useState(null)
  const [guardandoCargo, setGuardandoCargo] = useState(false)
  const [categoriasCargo, setCategoriasCargo] = useState([])
  const [formCargo, setFormCargo] = useState({
    categoria: '',
    descripcion: '',
    montoOriginal: '',
    montoRecargo: '',
    montoBonificacion: '',
    fechaVencimiento: '',
  })

  // Crear cargo manual
  const [showCrearCargoModal, setShowCrearCargoModal] = useState(false)
  const [socioParaCargo, setSocioParaCargo] = useState(null)

  // Plan de pagos
  const [showPlanPagosModal, setShowPlanPagosModal] = useState(false)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (!modoCobranza) {
      cargarCuotas()
    }
  }, [periodoId, estado, page, modoCobranza])

  // Buscar socios con debounce
  useEffect(() => {
    if (busquedaSocio.length < 2) {
      setResultadosSocio([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoSocio(true)
      try {
        const data = await api.get(`/admin/socios?q=${encodeURIComponent(busquedaSocio)}&limit=10`)
        setResultadosSocio(data.socios || [])
        setShowResultados(true)
      } catch (err) {
        console.error('Error buscando socios:', err)
      } finally {
        setBuscandoSocio(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [busquedaSocio])

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResultados(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function cargarDatosIniciales() {
    try {
      const [periodosData, mediosData, categoriasData] = await Promise.all([
        api.get('/admin/periodos'),
        api.get('/admin/medios-pago'),
        api.get('/admin/categorias-cargo'),
      ])
      setPeriodos(periodosData || [])
      setMediosPago(mediosData || [])
      setCategoriasCargo(categoriasData || [])
      if (mediosData?.length > 0) {
        setMedioPagoId(mediosData[0].id.toString())
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err)
    }
  }

  function abrirEditarCargo(cargo) {
    setCargoEditando(cargo)
    setFormCargo({
      categoria: cargo.categoria || '',
      descripcion: cargo.descripcion || '',
      montoOriginal: cargo.montoOriginal?.toString() || '',
      montoRecargo: cargo.montoRecargo?.toString() || '0',
      montoBonificacion: cargo.montoBonificacion?.toString() || '0',
      fechaVencimiento: cargo.fechaVencimiento ? new Date(cargo.fechaVencimiento).toISOString().split('T')[0] : '',
    })
    setShowEditModal(true)
  }

  async function guardarCargo(e) {
    e.preventDefault()
    setGuardandoCargo(true)
    setError(null)

    try {
      await api.put(`/admin/cargos/${cargoEditando.id}`, {
        categoria: formCargo.categoria,
        descripcion: formCargo.descripcion,
        montoOriginal: parseFloat(formCargo.montoOriginal),
        montoRecargo: parseFloat(formCargo.montoRecargo) || 0,
        montoBonificacion: parseFloat(formCargo.montoBonificacion) || 0,
        fechaVencimiento: formCargo.fechaVencimiento,
      })
      setSuccess('Cargo actualizado correctamente')
      setShowEditModal(false)
      cargarCuotas()
    } catch (err) {
      setError(err.message || 'Error al guardar cargo')
    } finally {
      setGuardandoCargo(false)
    }
  }

  async function anularCargo(cargoId) {
    if (!confirm('¿Anular este cargo? Esta accion no se puede deshacer.')) return

    try {
      await api.delete(`/admin/cargos/${cargoId}`)
      setSuccess('Cargo anulado correctamente')
      cargarCuotas()
    } catch (err) {
      setError(err.message || 'Error al anular cargo')
    }
  }

  function abrirCrearCargo(socio) {
    setSocioParaCargo(socio)
    setFormCargo({
      categoria: '',
      descripcion: '',
      montoOriginal: '',
      montoRecargo: '0',
      montoBonificacion: '0',
      fechaVencimiento: new Date().toISOString().split('T')[0],
    })
    setShowCrearCargoModal(true)
  }

  async function crearCargo(e) {
    e.preventDefault()
    setGuardandoCargo(true)
    setError(null)

    try {
      await api.post('/admin/cargos', {
        socioId: socioParaCargo.id,
        categoria: formCargo.categoria,
        periodoId: periodoId ? parseInt(periodoId) : null,
        descripcion: formCargo.descripcion,
        montoOriginal: parseFloat(formCargo.montoOriginal),
        montoRecargo: parseFloat(formCargo.montoRecargo) || 0,
        montoBonificacion: parseFloat(formCargo.montoBonificacion) || 0,
        fechaVencimiento: formCargo.fechaVencimiento,
      })
      setSuccess('Cargo creado correctamente')
      setShowCrearCargoModal(false)
      cargarCuotas()
    } catch (err) {
      setError(err.message || 'Error al crear cargo')
    } finally {
      setGuardandoCargo(false)
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

  async function seleccionarSocioParaCobranza(socio) {
    setBusquedaSocio('')
    setShowResultados(false)
    setModoCobranza(true)
    setCargandoCobranza(true)
    setSeleccionadas([])

    try {
      // Construir query params con los filtros actuales
      const params = new URLSearchParams()
      if (periodoId) params.append('periodoId', periodoId)
      if (estado) params.append('estado', estado)
      const queryString = params.toString()

      const data = await api.get(`/admin/cuotas/cobranza/${socio.id}${queryString ? '?' + queryString : ''}`)
      setCobranzaData(data)
      // Expandir todos los socios por defecto
      const expandidos = {}
      data.sociosPorCobrar?.forEach(s => { expandidos[s.socio.id] = true })
      setSociosExpandidos(expandidos)
      // Seleccionar solo las cuotas PENDIENTES por defecto (para cobrar)
      const pendientes = data.cuotas?.filter(c => c.estado === 'PENDIENTE').map(c => c.id) || []
      setSeleccionadas(pendientes)
    } catch (err) {
      setError('Error al cargar cuotas para cobranza')
      setModoCobranza(false)
    } finally {
      setCargandoCobranza(false)
    }
  }

  function salirModoCobranza() {
    setModoCobranza(false)
    setCobranzaData(null)
    setSeleccionadas([])
    setSociosExpandidos({})
  }

  function toggleSocioExpandido(socioId) {
    setSociosExpandidos(prev => ({
      ...prev,
      [socioId]: !prev[socioId]
    }))
  }

  function toggleSeleccion(cuotaId) {
    setSeleccionadas(prev =>
      prev.includes(cuotaId)
        ? prev.filter(id => id !== cuotaId)
        : [...prev, cuotaId]
    )
  }

  function seleccionarTodas() {
    if (!cobranzaData) return
    const todas = cobranzaData.cuotas?.map(c => c.id) || []
    if (seleccionadas.length === todas.length) {
      setSeleccionadas([])
    } else {
      setSeleccionadas(todas)
    }
  }

  function seleccionarTodasDeSocio(socioId) {
    if (!cobranzaData) return
    const cuotasSocio = cobranzaData.cuotas?.filter(c => c.socioId === socioId).map(c => c.id) || []
    const todasSeleccionadas = cuotasSocio.every(id => seleccionadas.includes(id))

    if (todasSeleccionadas) {
      setSeleccionadas(prev => prev.filter(id => !cuotasSocio.includes(id)))
    } else {
      setSeleccionadas(prev => [...new Set([...prev, ...cuotasSocio])])
    }
  }

  function calcularTotalSeleccionado() {
    if (!cobranzaData) return { base: 0, recargo: 0, total: 0 }
    const seleccionadasData = cobranzaData.cuotas?.filter(c => seleccionadas.includes(c.id)) || []
    const base = seleccionadasData.reduce((sum, c) => sum + Number(c.montoTotal), 0)
    const recargo = seleccionadasData.reduce((sum, c) => sum + (c.recargoCalculado || 0), 0)
    return { base, recargo, total: base + recargo }
  }

  async function registrarPago() {
    if (seleccionadas.length === 0 || !medioPagoId) return

    // Obtener el titular o socio principal para el pago
    const socioIdPago = cobranzaData?.titular?.id || cobranzaData?.sociosPorCobrar?.[0]?.socio?.id

    if (!socioIdPago) {
      setError('No se pudo determinar el socio para el pago')
      return
    }

    setRegistrandoPago(true)
    setError(null)

    try {
      const result = await api.post('/admin/pagos', {
        socioId: socioIdPago,
        cuotaIds: seleccionadas,
        medioPagoId: parseInt(medioPagoId),
      })
      setSuccess(`Pago registrado correctamente. Recibo #${result.numero}`)
      setSeleccionadas([])
      setShowPagoModal(false)
      // Recargar datos de cobranza
      if (cobranzaData?.sociosPorCobrar?.[0]?.socio?.id) {
        seleccionarSocioParaCobranza({ id: cobranzaData.sociosPorCobrar[0].socio.id })
      } else {
        salirModoCobranza()
      }
    } catch (err) {
      setError(err.message || 'Error al registrar pago')
    } finally {
      setRegistrandoPago(false)
    }
  }

  function formatCategoria(categoria) {
    const nombres = {
      'CUOTA_SOCIAL': 'Cuota Social',
      'CUOTA_ACTIVIDAD': 'Cuota Actividad',
      'CARNET': 'Carnet',
      'MOROSIDAD': 'Morosidad',
      'NOTA_CREDITO': 'Nota de Crédito',
      'FINANCIACION': 'Financiación',
    }
    return nombres[categoria] || categoria?.replace(/_/g, ' ') || 'Sin categoría'
  }

  function getEstadoBadge(estado) {
    switch (estado) {
      case 'PAGADO':
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
      case 'FINANCIADA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CreditCard className="w-3 h-3" />
            Financiada
          </span>
        )
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <X className="w-3 h-3" />
            Anulada
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

  // Vista de Cobranza
  if (modoCobranza) {
    return (
      <div>
        {/* Header cobranza */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={salirModoCobranza}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">Cobranza</h1>
            {cobranzaData?.esFamilia && cobranzaData?.titular && (
              <p className="text-gray-500 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Grupo Familiar: {cobranzaData.titular.apellidoNombre}
              </p>
            )}
          </div>
        </div>

        {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

        {cargandoCobranza ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : cobranzaData?.cuotas?.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-800 font-medium">No hay cuotas pendientes</p>
            <p className="text-gray-500 text-sm mt-1">Este socio/familia está al día</p>
            <Button onClick={salirModoCobranza} variant="secondary" className="mt-4">
              Volver
            </Button>
          </div>
        ) : (
          <>
            {/* Resumen y acciones */}
            <div className="mb-4 p-4 bg-primary-light rounded-lg border border-primary">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={seleccionadas.length === cobranzaData?.cuotas?.length}
                      onChange={seleccionarTodas}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">
                      {seleccionadas.length} de {cobranzaData?.resumen?.cantidadCuotas} cuotas seleccionadas
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-primary">
                    ${calcularTotalSeleccionado().total.toLocaleString('es-AR')}
                  </p>
                  {calcularTotalSeleccionado().recargo > 0 && (
                    <p className="text-sm text-red-600">
                      Incluye ${calcularTotalSeleccionado().recargo.toLocaleString('es-AR')} de recargo
                    </p>
                  )}
                  {cobranzaData?.esFamilia && (
                    <p className="text-sm text-gray-500">
                      {cobranzaData.resumen.cantidadSocios} integrante{cobranzaData.resumen.cantidadSocios > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPlanPagosModal(true)}
                    disabled={seleccionadas.length < 1}
                    className="flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Plan de Pagos
                  </Button>
                  <Button
                    onClick={() => setShowPagoModal(true)}
                    disabled={seleccionadas.length === 0}
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Cobrar ${calcularTotalSeleccionado().total.toLocaleString('es-AR')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de cuotas agrupadas por socio */}
            <div className="space-y-4">
              {cobranzaData?.sociosPorCobrar?.map(grupo => {
                const expandido = sociosExpandidos[grupo.socio.id]
                const cuotasGrupo = grupo.cuotas || []
                const todasSeleccionadas = cuotasGrupo.every(c => seleccionadas.includes(c.id))
                const algunaSeleccionada = cuotasGrupo.some(c => seleccionadas.includes(c.id))

                return (
                  <div key={grupo.socio.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header del socio */}
                    <div
                      className="flex items-center gap-3 p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSocioExpandido(grupo.socio.id)}
                    >
                      <input
                        type="checkbox"
                        checked={todasSeleccionadas}
                        ref={el => el && (el.indeterminate = algunaSeleccionada && !todasSeleccionadas)}
                        onChange={(e) => { e.stopPropagation(); seleccionarTodasDeSocio(grupo.socio.id) }}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold">
                        {grupo.socio.apellidoNombre?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{grupo.socio.apellidoNombre}</p>
                        <p className="text-sm text-gray-500">#{grupo.socio.nroSocio} - {cuotasGrupo.length} cuota{cuotasGrupo.length > 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="font-bold text-gray-800">${grupo.total.toLocaleString('es-AR')}</p>
                      </div>
                      {expandido ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>

                    {/* Detalle de cuotas */}
                    {expandido && (
                      <div className="divide-y divide-gray-100">
                        {cuotasGrupo.map(cuota => (
                          <div
                            key={cuota.id}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${seleccionadas.includes(cuota.id) ? 'bg-primary-light/50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionadas.includes(cuota.id)}
                              onChange={() => toggleSeleccion(cuota.id)}
                              className="rounded border-gray-300 ml-6"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                {formatCategoria(cuota.categoria)}
                                {cuota.categoriaActividad && (
                                  <span className="text-gray-500 font-normal">
                                    {' - '}{cuota.categoriaActividad.actividad?.nombre} / {cuota.categoriaActividad.nombre}
                                  </span>
                                )}
                                {cuota.categoria === 'FINANCIACION' && cuota.descripcion && (
                                  <span className="text-blue-600 font-normal">
                                    {' - '}{cuota.descripcion.match(/Cuota \d+\/\d+/)?.[0] || ''}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {cuota.categoria === 'FINANCIACION' && cuota.descripcion
                                  ? cuota.descripcion.replace(/ - Cuota \d+\/\d+$/, '').replace('Financiación: ', '')
                                  : cuota.periodo?.nombre}
                              </p>
                            </div>
                            <div className="text-right">
                              {cuota.recargoCalculado > 0 ? (
                                <>
                                  <p className="font-semibold text-gray-800">${cuota.montoConRecargo?.toLocaleString('es-AR')}</p>
                                  <p className="text-xs text-red-500">+${cuota.recargoCalculado?.toLocaleString('es-AR')} mora</p>
                                </>
                              ) : (
                                <p className="font-semibold text-gray-800">${Number(cuota.montoTotal).toLocaleString('es-AR')}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Modal de pago */}
        {showPagoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Confirmar Pago</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total a cobrar</p>
                  <p className="text-3xl font-bold text-gray-800">
                    ${calcularTotalSeleccionado().total.toLocaleString('es-AR')}
                  </p>
                  {calcularTotalSeleccionado().recargo > 0 && (
                    <div className="text-sm mt-2 space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Cuotas:</span>
                        <span>${calcularTotalSeleccionado().base.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Recargo por mora:</span>
                        <span>${calcularTotalSeleccionado().recargo.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  )}
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

        {/* Modal de plan de pagos */}
        <PlanPagosModal
          isOpen={showPlanPagosModal}
          onClose={() => setShowPlanPagosModal(false)}
          socioId={cobranzaData?.titular?.id || cobranzaData?.sociosPorCobrar?.[0]?.socio?.id}
          cuotasSeleccionadas={
            cobranzaData?.cuotas
              ?.filter(c => seleccionadas.includes(c.id))
              .map(c => ({
                id: c.id,
                descripcion: c.periodo?.nombre || c.descripcion || `Cargo #${c.id}`,
                monto: Number(c.montoTotal) + (c.recargoCalculado || 0),
              })) || []
          }
          onSuccess={() => {
            setSuccess('Plan de pagos generado correctamente')
            setSeleccionadas([])
            const socioId = cobranzaData?.titular?.id || cobranzaData?.sociosPorCobrar?.[0]?.socio?.id
            if (socioId) seleccionarSocioParaCobranza({ id: socioId })
          }}
        />
      </div>
    )
  }

  // Vista normal de cuotas
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

      {/* Buscador de socios para cobranza */}
      <div className="mb-6" ref={searchRef}>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cobrar a socio/familia</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar socio por nombre, DNI o nro. socio..."
            value={busquedaSocio}
            onChange={e => setBusquedaSocio(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && resultadosSocio.length > 0) {
                e.preventDefault()
                seleccionarSocioParaCobranza(resultadosSocio[0])
              }
            }}
            className="input-field w-full pl-10"
          />
          {buscandoSocio && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {/* Resultados de búsqueda */}
          {showResultados && resultadosSocio.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {resultadosSocio.map(socio => (
                <div
                  key={socio.id}
                  className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold">
                    {socio.apellidoNombre?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{socio.apellidoNombre}</p>
                    <p className="text-sm text-gray-500">#{socio.nroSocio} - DNI: {socio.documento}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {socio.titularFamiliaId === null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {socio.tipoSocio?.includes('Familia') ? 'Titular' : 'Unico'}
                      </span>
                    )}
                    <button
                      onClick={() => { setShowResultados(false); abrirCrearCargo(socio) }}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Agregar Cargo"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => seleccionarSocioParaCobranza(socio)}
                      className="p-2 text-primary hover:bg-primary-light rounded-lg transition"
                      title="Cobrar"
                    >
                      <DollarSign className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showResultados && busquedaSocio.length >= 2 && resultadosSocio.length === 0 && !buscandoSocio && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
              No se encontraron socios
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
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
              <option value="PAGADO">Pagados</option>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Socio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cuotas.map(cuota => (
                    <tr key={cuota.id} className="hover:bg-gray-50">
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
                        {cuota.periodo?.nombre || (cuota.fechaVencimiento &&
                          new Date(cuota.fechaVencimiento).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">
                          {formatCategoria(cuota.categoria)}
                          {cuota.categoria === 'FINANCIACION' && cuota.descripcion && (
                            <span className="text-blue-600 font-normal ml-1">
                              {cuota.descripcion.match(/Cuota \d+\/\d+/)?.[0] || ''}
                            </span>
                          )}
                        </p>
                        {cuota.categoriaActividad && (
                          <p className="text-xs text-gray-500">
                            {cuota.categoriaActividad.actividad?.nombre} - {cuota.categoriaActividad.nombre}
                          </p>
                        )}
                        {cuota.categoria === 'FINANCIACION' && cuota.descripcion && (
                          <p className="text-xs text-gray-500">
                            {cuota.descripcion.replace(/ - Cuota \d+\/\d+$/, '').replace('Financiación: ', '')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-800">
                          ${Number(cuota.montoTotal).toLocaleString('es-AR')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getEstadoBadge(cuota.estado)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(cuota.fechaVencimiento).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {cuota.estado === 'PENDIENTE' && (
                            <>
                              <button
                                onClick={() => seleccionarSocioParaCobranza({ id: cuota.socioId })}
                                className="p-1.5 text-primary hover:bg-primary-light rounded transition"
                                title="Cobrar"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => abrirEditarCargo(cuota)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => anularCargo(cuota.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title="Anular"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
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
                Página {page} de {pagination.pages}
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

      {/* Modal editar cargo */}
      {showEditModal && cargoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Editar Cargo</h2>
              <p className="text-sm text-gray-500 mt-1">
                {cargoEditando.socio?.apellidoNombre} - {formatCategoria(cargoEditando.categoria)}
              </p>
            </div>
            <form onSubmit={guardarCargo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={formCargo.categoria}
                  onChange={e => setFormCargo({ ...formCargo, categoria: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasCargo.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <input
                  type="text"
                  value={formCargo.descripcion}
                  onChange={e => setFormCargo({ ...formCargo, descripcion: e.target.value })}
                  className="input-field w-full"
                  placeholder="Descripcion opcional"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Original</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoOriginal}
                    onChange={e => setFormCargo({ ...formCargo, montoOriginal: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recargo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoRecargo}
                    onChange={e => setFormCargo({ ...formCargo, montoRecargo: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bonificacion</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoBonificacion}
                    onChange={e => setFormCargo({ ...formCargo, montoBonificacion: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  Monto Total: <span className="font-bold text-gray-800">
                    ${((parseFloat(formCargo.montoOriginal) || 0) + (parseFloat(formCargo.montoRecargo) || 0) - (parseFloat(formCargo.montoBonificacion) || 0)).toLocaleString('es-AR')}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                <input
                  type="date"
                  value={formCargo.fechaVencimiento}
                  onChange={e => setFormCargo({ ...formCargo, fechaVencimiento: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="submit" loading={guardandoCargo} className="flex-1">
                  Guardar Cambios
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear cargo */}
      {showCrearCargoModal && socioParaCargo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo Cargo</h2>
              <p className="text-sm text-gray-500 mt-1">
                Para: {socioParaCargo.apellidoNombre} (#{socioParaCargo.nroSocio})
              </p>
            </div>
            <form onSubmit={crearCargo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select
                  value={formCargo.categoria}
                  onChange={e => setFormCargo({ ...formCargo, categoria: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasCargo.map(c => (
                    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <input
                  type="text"
                  value={formCargo.descripcion}
                  onChange={e => setFormCargo({ ...formCargo, descripcion: e.target.value })}
                  className="input-field w-full"
                  placeholder="Descripcion opcional"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoOriginal}
                    onChange={e => setFormCargo({ ...formCargo, montoOriginal: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recargo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoRecargo}
                    onChange={e => setFormCargo({ ...formCargo, montoRecargo: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bonificacion</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCargo.montoBonificacion}
                    onChange={e => setFormCargo({ ...formCargo, montoBonificacion: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento *</label>
                <input
                  type="date"
                  value={formCargo.fechaVencimiento}
                  onChange={e => setFormCargo({ ...formCargo, fechaVencimiento: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="submit" loading={guardandoCargo} className="flex-1">
                  Crear Cargo
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowCrearCargoModal(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
