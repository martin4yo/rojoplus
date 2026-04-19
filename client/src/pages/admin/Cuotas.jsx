import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Receipt, CheckCircle, DollarSign, X, Users, ChevronDown, ChevronUp, Edit2, Plus, Trash2, CreditCard, Download, Mail, MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import { SearchInputWithDropdown } from '../../components/SearchInput'
import { PlanPagosModal } from '../../components/PlanPagosModal'
import AdjuntosComprobante from '../../components/AdjuntosComprobante'
import SelectCentroCosto from '../../components/SelectCentroCosto'
import Pagination from '../../components/Pagination'
import StatusBadge from '../../components/StatusBadge'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import usePagination from '../../hooks/usePagination'
import api from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'
import ChatWidget from '../../components/chat/ChatWidget'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function Cuotas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()

  const [cuotas, setCuotas] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros
  const [periodoId, setPeriodoId] = useState(searchParams.get('periodoId') || '')
  const [estado, setEstado] = useState(searchParams.get('estado') || '')

  // Paginación
  const { page, pagination, setPagination, goToPage } = usePagination()

  // Buscador de socios
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  // Modo cobranza
  const [modoCobranza, setModoCobranza] = useState(false)
  const [cobranzaData, setCobranzaData] = useState(null)
  const [cargandoCobranza, setCargandoCobranza] = useState(false)
  const [sociosExpandidos, setSociosExpandidos] = useState({})

  // Seleccion para pago
  const [seleccionadas, setSeleccionadas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [cajas, setCajas] = useState([])
  const [showPagoModal, setShowPagoModal] = useState(false)
  // splits: [{ medioPagoId, cajaId, monto }]
  const [splits, setSplits] = useState([{ medioPagoId: '', cajaId: '', monto: '' }])
  const [registrandoPago, setRegistrandoPago] = useState(false)
  const [success, setSuccess] = useState(null)
  const [showPagoExitosoModal, setShowPagoExitosoModal] = useState(false)
  const [numeroRecibo, setNumeroRecibo] = useState(null)
  const [pagoId, setPagoId] = useState(null)
  const [enviandoRecibo, setEnviandoRecibo] = useState({})
  const [resultadoRecibo, setResultadoRecibo] = useState({})

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
    centroCostoId: '',
  })

  // Crear cargo manual
  const [showCrearCargoModal, setShowCrearCargoModal] = useState(false)
  const [socioParaCargo, setSocioParaCargo] = useState(null)

  // Plan de pagos
  const [showPlanPagosModal, setShowPlanPagosModal] = useState(false)

  // Pagos informados (A conciliar)
  const [pagosInformados, setPagosInformados] = useState([])
  const [showComprobanteModal, setShowComprobanteModal] = useState(false)
  const [comprobanteUrl, setComprobanteUrl] = useState(null)
  const [showConfirmarModal, setShowConfirmarModal] = useState(false)
  const [showRechazarModal, setShowRechazarModal] = useState(false)
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [procesandoConciliacion, setProcesandoConciliacion] = useState(false)

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  useEffect(() => {
    if (!modoCobranza) {
      cargarCuotas()
    }
  }, [periodoId, estado, page, modoCobranza])

  // Detectar si se debe abrir cobranza automáticamente
  useEffect(() => {
    const cobrarSocioId = searchParams.get('cobrarSocioId')
    if (cobrarSocioId && !modoCobranza) {
      seleccionarSocioParaCobranza({ id: parseInt(cobrarSocioId) })
      // Limpiar el parámetro de la URL
      setSearchParams({})
    }
  }, [searchParams, modoCobranza])

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
      } catch (err) {
        console.error('Error buscando socios:', err)
      } finally {
        setBuscandoSocio(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [busquedaSocio])

  async function cargarDatosIniciales() {
    try {
      const [periodosData, mediosData, categoriasData, cajasData] = await Promise.all([
        api.get('/admin/periodos'),
        api.get('/admin/medios-pago'),
        api.get('/admin/categorias-cargo'),
        api.get('/admin/cajas'),
      ])
      setPeriodos(periodosData || [])
      setMediosPago(mediosData || [])
      setCategoriasCargo(categoriasData || [])
      setCajas((cajasData || []).filter(c => c.paraCaja))
      // Pre-seleccionar defaults en splits
      const primerMedio = mediosData?.[0]
      const defaultMedio = primerMedio?.id?.toString() || ''
      const defaultCaja = primerMedio?.cajaDefaultId?.toString() || cajasData?.find(c => c.paraCaja)?.id?.toString() || ''
      setSplits([{ medioPagoId: defaultMedio, cajaId: defaultCaja, monto: '' }])
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
        centroCostoId: formCargo.centroCostoId ? parseInt(formCargo.centroCostoId) : null,
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
    const confirmed = await confirm('Anular cargo', '¿Anular este cargo? Esta accion no se puede deshacer.')
    if (!confirmed) return

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
      centroCostoId: '',
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
        centroCostoId: formCargo.centroCostoId ? parseInt(formCargo.centroCostoId) : null,
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
      // Si el estado es "A_CONCILIAR", cargar pagos informados
      if (estado === 'A_CONCILIAR') {
        const params = new URLSearchParams()
        params.append('estado', 'PENDIENTE')
        params.append('page', page.toString())

        const data = await api.get(`/admin/pagos-informados?${params}`)
        setPagosInformados(data.data || [])
        setPagination(data.pagination)
        setCuotas([]) // Limpiar cuotas normales
      } else {
        // Cargar cuotas normales
        const params = new URLSearchParams()
        if (periodoId) params.append('periodoId', periodoId)
        if (estado) params.append('estado', estado)
        params.append('page', page.toString())

        const data = await api.get(`/admin/cuotas?${params}`)
        setCuotas(data.data || [])
        setPagination(data.pagination)
        setPagosInformados([]) // Limpiar pagos informados
      }
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function seleccionarSocioParaCobranza(socio) {
    setBusquedaSocio('')
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

  function abrirModalPago() {
    const total = calcularTotalSeleccionado().total
    const primerMedio = mediosPago[0]
    const defaultMedio = primerMedio?.id?.toString() || ''
    const defaultCaja = primerMedio?.cajaDefaultId?.toString() || cajas[0]?.id?.toString() || ''
    setSplits([{ medioPagoId: defaultMedio, cajaId: defaultCaja, monto: total.toFixed(2) }])
    setShowPagoModal(true)
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
    if (!cobranzaData) return { base: 0, recargo: 0, descuento: 0, total: 0 }
    const seleccionadasData = cobranzaData.cuotas?.filter(c => seleccionadas.includes(c.id)) || []
    const base = seleccionadasData.reduce((sum, c) => sum + Number(c.montoTotal), 0)
    const recargo = seleccionadasData.reduce((sum, c) => sum + (c.recargoCalculado || 0), 0)
    const descuento = seleccionadasData.reduce((sum, c) => sum + (c.descuentoCalculado || 0), 0)
    return { base, recargo, descuento, total: base + recargo - descuento }
  }

  async function registrarPago() {
    if (seleccionadas.length === 0) return

    const total = calcularTotalSeleccionado().total
    const sumaSplits = splits.reduce((s, sp) => s + (parseFloat(sp.monto) || 0), 0)

    for (const sp of splits) {
      if (!sp.medioPagoId || !sp.cajaId || !sp.monto) {
        setError('Completá todos los campos en los medios de pago')
        return
      }
    }
    if (Math.abs(sumaSplits - total) > 1) {
      setError(`La suma de los medios de pago ($${sumaSplits.toFixed(2)}) debe ser igual al total ($${total.toFixed(2)})`)
      return
    }

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
        mediosPago: splits.map(sp => ({
          medioPagoId: parseInt(sp.medioPagoId),
          cajaId: parseInt(sp.cajaId),
          monto: parseFloat(sp.monto),
        })),
      })
      setNumeroRecibo(result.numero)
      setPagoId(result.id)
      setSeleccionadas([])
      setShowPagoModal(false)
      setShowPagoExitosoModal(true)
    } catch (err) {
      setError(err.message || 'Error al registrar pago')
    } finally {
      setRegistrandoPago(false)
    }
  }

  async function descargarReciboPDF() {
    if (!pagoId) return
    try {
      const token = localStorage.getItem('adminToken')
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      const tenantSlug = window.location.hostname.match(/^([^.]+)\.localhost/)?.[1] || null
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

      const response = await fetch(`${apiUrl}/admin/pagos/${pagoId}/recibo-pdf`, { headers })
      if (!response.ok) throw new Error('Error al generar PDF')
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `recibo-${numeroRecibo || pagoId}.pdf`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error descargando PDF:', err)
    }
  }

  async function enviarReciboPorCanal(canal) {
    if (!pagoId) return
    setEnviandoRecibo(prev => ({ ...prev, [canal]: true }))
    try {
      const res = await api.postFull(`/admin/pagos/${pagoId}/enviar-recibo`, { canales: [canal] })
      const resultado = res?.data?.[canal]
      setResultadoRecibo(prev => ({ ...prev, [canal]: resultado }))
    } catch (err) {
      setResultadoRecibo(prev => ({ ...prev, [canal]: { ok: false, mensaje: 'Error al enviar' } }))
    } finally {
      setEnviandoRecibo(prev => ({ ...prev, [canal]: false }))
    }
  }

  function cerrarModalPagoExitoso() {
    setShowPagoExitosoModal(false)
    setNumeroRecibo(null)
    setPagoId(null)
    setEnviandoRecibo({})
    setResultadoRecibo({})

    // Si vino desde otra página (con cobrarSocioId), volver atrás
    const cobrarSocioId = searchParams.get('cobrarSocioId')
    if (cobrarSocioId) {
      navigate(-1) // Volver a la página anterior
    } else {
      // Si no, recargar datos de cobranza o salir
      if (cobranzaData?.sociosPorCobrar?.[0]?.socio?.id) {
        seleccionarSocioParaCobranza({ id: cobranzaData.sociosPorCobrar[0].socio.id })
      } else {
        salirModoCobranza()
      }
    }
  }

  // Funciones para pagos informados (conciliación)
  function verComprobante(url) {
    setComprobanteUrl(url)
    setShowComprobanteModal(true)
  }

  function abrirModalConfirmar(pago) {
    setPagoSeleccionado(pago)
    setShowConfirmarModal(true)
  }

  function abrirModalRechazar(pago) {
    setPagoSeleccionado(pago)
    setMotivoRechazo('')
    setShowRechazarModal(true)
  }

  async function confirmarPago() {
    if (!cajaId || !medioPagoId) {
      setError('Debes seleccionar caja y medio de pago')
      return
    }

    setProcesandoConciliacion(true)
    setError(null)

    try {
      await api.post(`/admin/pagos-informados/${pagoSeleccionado.id}/confirmar`, {
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId),
      })

      setSuccess('Pago confirmado correctamente')
      setShowConfirmarModal(false)
      setPagoSeleccionado(null)
      setCajaId('')
      setMedioPagoId('')
      cargarCuotas()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al confirmar pago')
    } finally {
      setProcesandoConciliacion(false)
    }
  }

  async function rechazarPago() {
    if (!motivoRechazo.trim()) {
      setError('Debes indicar el motivo del rechazo')
      return
    }

    setProcesandoConciliacion(true)
    setError(null)

    try {
      await api.post(`/admin/pagos-informados/${pagoSeleccionado.id}/rechazar`, {
        motivo: motivoRechazo,
      })

      setSuccess('Pago rechazado correctamente')
      setShowRechazarModal(false)
      setPagoSeleccionado(null)
      setMotivoRechazo('')
      cargarCuotas()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al rechazar pago')
    } finally {
      setProcesandoConciliacion(false)
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
          <Button
            onClick={abrirModalPago}
            disabled={seleccionadas.length === 0}
            className="flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Cobrar
          </Button>
        </div>

        {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

        {cargandoCobranza ? (
          <LoadingSpinner />
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
                    {formatCurrency(calcularTotalSeleccionado().total)}
                  </p>
                  {calcularTotalSeleccionado().recargo > 0 && (
                    <p className="text-sm text-red-600">
                      Incluye {formatCurrency(calcularTotalSeleccionado().recargo)} de recargo por mora
                    </p>
                  )}
                  {calcularTotalSeleccionado().descuento > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      Descuento por pago anticipado: -{formatCurrency(calcularTotalSeleccionado().descuento)}
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
                    onClick={abrirModalPago}
                    disabled={seleccionadas.length === 0}
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Cobrar {formatCurrency(calcularTotalSeleccionado().total)}
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
                        <p className="font-bold text-gray-800">{formatCurrency(grupo.total)}</p>
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
                                {cuota.conceptoTesoreria
                                  ? cuota.conceptoTesoreria.nombre
                                  : formatCategoria(cuota.categoria)}
                                {cuota.categoriaActividad && (
                                  <span className="text-gray-500 font-normal">
                                    {' - '}{cuota.categoriaActividad.actividad?.nombre} / {cuota.categoriaActividad.nombre}
                                  </span>
                                )}
                                {cuota.categoria === 'FINANCIACION' && cuota.descripcion && !cuota.conceptoTesoreria && (
                                  <span className="text-blue-600 font-normal">
                                    {' - '}{cuota.descripcion.match(/Cuota \d+\/\d+/)?.[0] || ''}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {cuota.categoria === 'FINANCIACION' && cuota.descripcion && !cuota.conceptoTesoreria
                                  ? cuota.descripcion.replace(/ - Cuota \d+\/\d+$/, '').replace('Financiación: ', '')
                                  : cuota.descripcion && !cuota.periodo
                                    ? cuota.descripcion
                                    : cuota.periodo?.nombre}
                              </p>
                            </div>
                            <div className="text-right">
                              {cuota.recargoCalculado > 0 ? (
                                <>
                                  <p className="font-semibold text-gray-800">{formatCurrency(cuota.montoConRecargo)}</p>
                                  <p className="text-xs text-red-500">+{formatCurrency(cuota.recargoCalculado)} mora</p>
                                </>
                              ) : (
                                <p className="font-semibold text-gray-800">{formatCurrency(cuota.montoTotal)}</p>
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
        <Modal
          isOpen={showPagoModal}
          onClose={() => setShowPagoModal(false)}
          title="Confirmar Pago"
          maxWidth="max-w-2xl"
        >
          {(() => {
            const totalAPagar = calcularTotalSeleccionado().total
            const sumaSplits = splits.reduce((s, sp) => s + (parseFloat(sp.monto) || 0), 0)
            const diferencia = Math.round((totalAPagar - sumaSplits) * 100) / 100

            function updateSplit(idx, field, value) {
              setSplits(prev => prev.map((sp, i) => {
                if (i !== idx) return sp
                const updated = { ...sp, [field]: value }
                // Al cambiar medio de pago, auto-seleccionar caja default si tiene
                if (field === 'medioPagoId' && value) {
                  const medio = mediosPago.find(m => m.id.toString() === value)
                  if (medio?.cajaDefaultId) {
                    updated.cajaId = medio.cajaDefaultId.toString()
                  }
                }
                return updated
              }))
            }
            function addSplit() {
              const restante = Math.max(0, Math.round((totalAPagar - sumaSplits) * 100) / 100)
              const defaultMedio = mediosPago[0]?.id?.toString() || ''
              const defaultCaja = mediosPago[0]?.cajaDefaultId?.toString() || cajas[0]?.id?.toString() || ''
              setSplits(prev => [...prev, { medioPagoId: defaultMedio, cajaId: defaultCaja, monto: restante.toFixed(2) }])
            }
            function removeSplit(idx) {
              setSplits(prev => prev.filter((_, i) => i !== idx))
            }

            return (
              <div className="space-y-4">
                {/* Resumen total */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Total a cobrar</p>
                  <p className="text-3xl font-bold text-gray-800">{formatCurrency(totalAPagar)}</p>
                  {calcularTotalSeleccionado().recargo > 0 && (
                    <div className="text-xs mt-1 space-y-0.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Cuotas/Cargos:</span><span>{formatCurrency(calcularTotalSeleccionado().base)}</span>
                      </div>
                      <div className="flex justify-between text-red-500">
                        <span>Recargo mora:</span><span>{formatCurrency(calcularTotalSeleccionado().recargo)}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{seleccionadas.length} ítem{seleccionadas.length > 1 ? 's' : ''}</p>
                </div>

                {/* Splits de medios de pago */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Medios de Pago</label>
                    <button
                      type="button"
                      onClick={addSplit}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Agregar medio
                    </button>
                  </div>

                  <div className="space-y-2">
                    {splits.map((sp, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-[1fr_8rem_auto] gap-2">
                          <select
                            value={sp.medioPagoId}
                            onChange={e => updateSplit(idx, 'medioPagoId', e.target.value)}
                            className="input-field text-sm"
                          >
                            <option value="">Medio de pago...</option>
                            {mediosPago.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                          </select>
                          <input
                            type="number"
                            value={sp.monto}
                            onChange={e => updateSplit(idx, 'monto', e.target.value)}
                            className="input-field text-sm text-right"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                          />
                          {splits.length > 1
                            ? <button type="button" onClick={() => removeSplit(idx)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            : <div />
                          }
                          <select
                            value={sp.cajaId}
                            onChange={e => updateSplit(idx, 'cajaId', e.target.value)}
                            className="input-field text-sm col-span-2 mt-2"
                          >
                            <option value="">Caja...</option>
                            {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Indicador diferencia */}
                  {diferencia !== 0 && (
                    <div className={`mt-2 text-sm font-medium flex justify-between px-1 ${diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      <span>{diferencia > 0 ? 'Falta asignar:' : 'Excede en:'}</span>
                      <span>{formatCurrency(Math.abs(diferencia))}</span>
                    </div>
                  )}
                  {diferencia === 0 && sumaSplits > 0 && (
                    <p className="mt-2 text-sm text-green-600 text-right font-medium">✓ Montos completos</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={registrarPago}
                    loading={registrandoPago}
                    disabled={diferencia !== 0}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Pago
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPagoModal(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* Modal de pago exitoso */}
        <Modal
          isOpen={showPagoExitosoModal}
          onClose={cerrarModalPagoExitoso}
          maxWidth="max-w-lg"
        >
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Cobranza Registrada!</h2>
            <p className="text-gray-600 mb-4">
              El pago se registró correctamente
            </p>
            {numeroRecibo && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Número de Recibo</p>
                <p className="text-3xl font-bold text-primary">#{numeroRecibo}</p>
              </div>
            )}
          </div>

          {/* Acciones del recibo */}
          {pagoId && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <p className="text-sm text-gray-500 text-center mb-2">Acciones del comprobante</p>

              {/* Descargar PDF */}
              <button
                onClick={descargarReciboPDF}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>

              {/* Enviar por email */}
              <div>
                <button
                  onClick={() => enviarReciboPorCanal('email')}
                  disabled={!!enviandoRecibo.email || resultadoRecibo.email?.ok}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enviandoRecibo.email
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Mail className="w-4 h-4" />}
                  {resultadoRecibo.email?.ok ? 'Email enviado ✓' : 'Enviar por Email'}
                </button>
                {resultadoRecibo.email && !resultadoRecibo.email.ok && (
                  <p className="text-xs text-red-500 mt-1 text-center">{resultadoRecibo.email.mensaje}</p>
                )}
              </div>

              {/* Enviar por WhatsApp */}
              <div>
                <button
                  onClick={() => enviarReciboPorCanal('whatsapp')}
                  disabled={!!enviandoRecibo.whatsapp || resultadoRecibo.whatsapp?.ok}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-green-300 rounded-lg text-green-700 hover:bg-green-50 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {enviandoRecibo.whatsapp
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <MessageCircle className="w-4 h-4" />}
                  {resultadoRecibo.whatsapp?.ok ? 'WhatsApp enviado ✓' : 'Enviar por WhatsApp'}
                </button>
                {resultadoRecibo.whatsapp && !resultadoRecibo.whatsapp.ok && (
                  <p className="text-xs text-red-500 mt-1 text-center">{resultadoRecibo.whatsapp.mensaje}</p>
                )}
              </div>

              {/* Adjuntos */}
              <div className="border-t pt-3">
                <AdjuntosComprobante tipo="pago" comprobanteId={pagoId} />
              </div>
            </div>
          )}

          <Button
            onClick={cerrarModalPagoExitoso}
            className="w-full flex items-center justify-center gap-2 mt-4"
          >
            Continuar
          </Button>
        </Modal>

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
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cuotas</h1>
            <p className="text-gray-500 text-sm">Administra las cuotas de los socios</p>
          </div>
        </div>
        <Button onClick={() => navigate('/admin/periodos')} variant="secondary" className="flex items-center gap-2">
          Ver Periodos
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Buscador de socios para cobranza */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cobrar a socio/familia</label>
        <SearchInputWithDropdown
          value={busquedaSocio}
          onChange={setBusquedaSocio}
          results={resultadosSocio}
          loading={buscandoSocio}
          onSelectResult={seleccionarSocioParaCobranza}
          renderResult={(socio) => (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold flex-shrink-0">
                {socio.apellidoNombre?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{socio.apellidoNombre}</p>
                <p className="text-sm text-gray-500">#{socio.nroSocio} - DNI: {socio.documento}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {socio.titularFamiliaId === null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {socio.tipoSocio?.includes('Familia') ? 'Titular' : 'Unico'}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); abrirCrearCargo(socio) }}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                  title="Agregar Cargo"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          placeholder="Buscar socio por nombre, DNI o nro. socio..."
          minChars={2}
          debounceMs={300}
          emptyMessage="No se encontraron socios"
          onEnter={() => {
            if (resultadosSocio.length > 0) {
              seleccionarSocioParaCobranza(resultadosSocio[0])
            }
          }}
        />
      </div>

      {/* Filtros */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
            <select
              value={periodoId}
              onChange={e => { setPeriodoId(e.target.value); goToPage(1) }}
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
              onChange={e => { setEstado(e.target.value); goToPage(1) }}
              className="input-field w-full"
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="PAGADO">Pagados</option>
              <option value="A_CONCILIAR">A conciliar</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setPeriodoId(''); setEstado(''); goToPage(1) }}
              className="text-sm text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de cuotas o pagos informados */}
      {loading ? (
        <LoadingSpinner />
      ) : estado === 'A_CONCILIAR' ? (
        /* Vista de pagos informados */
        pagosInformados.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay pagos pendientes de conciliar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pagosInformados.map(pago => (
              <div key={pago.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{pago.socio.apellidoNombre}</h3>
                      <span className="text-sm text-gray-500">#{pago.socio.nroSocio}</span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                        PENDIENTE
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Informado: {formatDateTime(pago.fechaInformado, { dateFormat: 'long' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(pago.monto)}
                    </p>
                  </div>
                </div>

                {/* Cuotas incluidas */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Cuotas incluidas:</h4>
                  <div className="space-y-1">
                    {pago.cuotas.map((cuota, idx) => (
                      <div key={cuota.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {formatCategoria(cuota.categoria)}
                          {cuota.periodo && ` - ${cuota.periodo.nombre} ${cuota.periodo.anio}`}
                          {cuota.categoriaActividad && ` - ${cuota.categoriaActividad.actividad.nombre}`}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(cuota.montoTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comprobante y acciones */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {pago.comprobante && (
                      <button
                        onClick={() => verComprobante(pago.comprobante)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition flex items-center gap-2"
                      >
                        <Receipt className="w-4 h-4" />
                        Ver comprobante
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirModalRechazar(pago)}
                      className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => abrirModalConfirmar(pago)}
                      className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirmar pago
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
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
                          {formatCurrency(cuota.montoTotal)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={cuota.estado} type="cuota" />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(cuota.fechaVencimiento)}
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
          <Pagination
            pagination={pagination}
            page={page}
            onPageChange={goToPage}
            className="mt-6"
          />
        </>
      )}

      {/* Modal editar cargo */}
      <Modal
        isOpen={showEditModal && cargoEditando}
        onClose={() => setShowEditModal(false)}
        title="Editar Cargo"
        maxWidth="max-w-lg"
      >
        {cargoEditando && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {cargoEditando.socio?.apellidoNombre} - {formatCategoria(cargoEditando.categoria)}
            </p>
            <form onSubmit={guardarCargo} className="space-y-4">
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
                    {formatCurrency((parseFloat(formCargo.montoOriginal) || 0) + (parseFloat(formCargo.montoRecargo) || 0) - (parseFloat(formCargo.montoBonificacion) || 0))}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
                <SelectCentroCosto
                  value={formCargo.centroCostoId}
                  onChange={(val) => setFormCargo({ ...formCargo, centroCostoId: val })}
                  className="w-full"
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
          </>
        )}
      </Modal>

      {/* Modal ver comprobante */}
      <Modal
        isOpen={showComprobanteModal}
        onClose={() => setShowComprobanteModal(false)}
        title="Comprobante de Pago"
        maxWidth="max-w-4xl"
      >
        <img
          src={comprobanteUrl}
          alt="Comprobante"
          className="w-full max-h-[70vh] object-contain rounded-lg"
        />
      </Modal>

      {/* Modal confirmar pago */}
      <Modal
        isOpen={showConfirmarModal && pagoSeleccionado}
        onClose={() => {
          setShowConfirmarModal(false)
          setPagoSeleccionado(null)
          setCajaId('')
          setMedioPagoId('')
        }}
        title="Confirmar Pago"
        maxWidth="max-w-lg"
      >
        {pagoSeleccionado && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {pagoSeleccionado.socio.apellidoNombre} - {formatCurrency(pagoSeleccionado.monto)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caja *</label>
                <select
                  value={cajaId}
                  onChange={e => setCajaId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar caja</option>
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago *</label>
                <select
                  value={medioPagoId}
                  onChange={e => setMedioPagoId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccionar medio de pago</option>
                  {mediosPago.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Al confirmar, se registrará el pago, se marcarán las cuotas como pagadas y se creará el movimiento en caja.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={confirmarPago}
                  loading={procesandoConciliacion}
                  className="flex-1"
                  disabled={!cajaId || !medioPagoId}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowConfirmarModal(false)
                    setPagoSeleccionado(null)
                    setCajaId('')
                    setMedioPagoId('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal rechazar pago */}
      <Modal
        isOpen={showRechazarModal && pagoSeleccionado}
        onClose={() => {
          setShowRechazarModal(false)
          setPagoSeleccionado(null)
          setMotivoRechazo('')
        }}
        title="Rechazar Pago"
        maxWidth="max-w-lg"
      >
        {pagoSeleccionado && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {pagoSeleccionado.socio.apellidoNombre} - {formatCurrency(pagoSeleccionado.monto)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo *</label>
                <textarea
                  value={motivoRechazo}
                  onChange={e => setMotivoRechazo(e.target.value)}
                  className="input-field w-full"
                  rows="4"
                  placeholder="Explica por qué se rechaza este pago..."
                  required
                ></textarea>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-800">
                  <strong>Atención:</strong> El socio será notificado del rechazo y el comprobante quedará registrado.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={rechazarPago}
                  loading={procesandoConciliacion}
                  variant="danger"
                  className="flex-1"
                  disabled={!motivoRechazo.trim()}
                >
                  Rechazar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowRechazarModal(false)
                    setPagoSeleccionado(null)
                    setMotivoRechazo('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ConfirmDialog */}
      <ConfirmDialog />

      {/* Modal crear cargo */}
      <Modal
        isOpen={showCrearCargoModal && socioParaCargo}
        onClose={() => setShowCrearCargoModal(false)}
        title="Nuevo Cargo"
        maxWidth="max-w-lg"
      >
        {socioParaCargo && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Para: {socioParaCargo.apellidoNombre} (#{socioParaCargo.nroSocio})
            </p>
            <form onSubmit={crearCargo} className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
                <SelectCentroCosto
                  value={formCargo.centroCostoId}
                  onChange={(val) => setFormCargo({ ...formCargo, centroCostoId: val })}
                  className="w-full"
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
          </>
        )}
      </Modal>

      {/* Axio - Chat Widget para Admins */}
      <ChatWidget role="admin" position="bottom-right" />
    </div>
  )
}
