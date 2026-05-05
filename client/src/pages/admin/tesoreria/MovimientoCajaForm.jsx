import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, Save, TrendingUp, TrendingDown, Plus, ChevronDown, ChevronRight, Search, X, FileText, Ban, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import CentroCostoSelector from '../../../components/CentroCostoSelector'
import ConceptoTesoreriaModal from '../../../components/ConceptoTesoreriaModal'
import { SearchInputWithDropdown } from '../../../components/SearchInput'
import AdjuntosComprobante from '../../../components/AdjuntosComprobante'
import ComprobanteMovimientoModal from '../../../components/ComprobanteMovimientoModal'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { formatCurrency, formatDate } from '../../../utils/formatters'

const RUTA_MOVIMIENTO_CONTABLE = {
  FACTURA_VENTA: (id) => `/admin/ingresos/facturas/${id}`,
  NOTA_CREDITO_CLIENTE: (id) => `/admin/ingresos/facturas/${id}`,
  NOTA_DEBITO_CLIENTE: (id) => `/admin/ingresos/facturas/${id}`,
  RECIBO_COBRO: (id) => `/admin/ingresos/recibos/${id}`,
  FACTURA_COMPRA: (id) => `/admin/egresos/facturas/${id}`,
  NOTA_CREDITO_PROVEEDOR: (id) => `/admin/egresos/facturas/${id}`,
  NOTA_DEBITO_PROVEEDOR: (id) => `/admin/egresos/facturas/${id}`,
  ORDEN_PAGO: (id) => `/admin/egresos/ordenes-pago/${id}`,
}

export default function MovimientoCajaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { id: movimientoId } = useParams()
  const isReadOnly = !!movimientoId
  const cajaIdParam = searchParams.get('cajaId')
  const tipoParam = searchParams.get('tipo')

  const [cajas, setCajas] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [movimientoCreado, setMovimientoCreado] = useState(null)
  const [error, setError] = useState(null)
  const [datosContablesOpen, setDatosContablesOpen] = useState(false)

  const [form, setForm] = useState({
    cajaId: cajaIdParam || '',
    tipo: tipoParam || 'INGRESO',
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    conceptoId: '',
    cuentaContableId: '',
    centroCostoId: null,
    concepto: '',
    descripcion: '',
    medioPagoId: '',
    socioId: null,
    entidadId: null,
  })
  const [movimiento, setMovimiento] = useState(null)
  // Items del movimiento (pueden ser múltiples conceptos en una sola operación)
  const [items, setItems] = useState([])
  const itemsTotal = items.reduce((s, it) => s + (parseFloat(it.monto) || 0), 0)
  // Medios de pago (pueden ser múltiples — efectivo + transferencia, etc.)
  const [mediosPagoLista, setMediosPagoLista] = useState([])
  const mediosTotal = mediosPagoLista.reduce((s, mp) => s + (parseFloat(mp.monto) || 0), 0)
  const balanceaTotal = items.length > 0 && Math.abs(itemsTotal - mediosTotal) < 0.01

  // Selector Socio/Entidad estilo FacturaVentaForm: radios + search box
  const [tipoPersona, setTipoPersona] = useState('SOCIO') // 'SOCIO' | 'ENTIDAD' | 'NINGUNO'
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null)
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [resultadosSocio, setResultadosSocio] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [busquedaEntidad, setBusquedaEntidad] = useState('')
  const [resultadosEntidad, setResultadosEntidad] = useState([])
  const [buscandoEntidad, setBuscandoEntidad] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const [showConceptoModal, setShowConceptoModal] = useState(false)

  async function cargarDatos() {
    try {
      setLoading(true)
      const [cajasRes, cuentasRes, conceptosRes, mediosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/cuentas-contables?flat=true'),
        api.getFull('/admin/conceptos-tesoreria'),
        api.getFull('/admin/medios-pago')
      ])
      const cajasData = cajasRes.data || []
      setCajas(cajasData)
      setCuentasContables((cuentasRes.data || []).filter(c => c.esImputable))
      setConceptos(conceptosRes.data || [])
      setMediosPago((mediosRes.data || []).filter(m => m.paraCaja && m.activo))

      // Si hay cajaId en la URL, poblar solo el centro de costo de la caja (la cuenta contable la da el concepto)
      if (cajaIdParam) {
        const caja = cajasData.find(c => c.id === parseInt(cajaIdParam))
        if (caja) {
          setForm(prev => ({
            ...prev,
            centroCostoId: caja.centroCostoId || prev.centroCostoId
          }))
        }
      }

      // Modo solo lectura: cargar movimiento existente
      if (movimientoId) {
        const movRes = await api.getFull(`/admin/movimientos-caja/${movimientoId}`)
        const mov = movRes.data
        setMovimiento(mov)

        // Inyectar caja/medio de pago si estan inactivos y no aparecen en la lista activa
        if (mov.caja && !cajasData.find(c => c.id === mov.caja.id)) {
          setCajas([...cajasData, mov.caja])
        }
        if (mov.medioPagoRel) {
          setMediosPago(prev => prev.find(m => m.id === mov.medioPagoRel.id) ? prev : [...prev, mov.medioPagoRel])
        }
        if (mov.cuentaContable) {
          setCuentasContables(prev => prev.find(c => c.id === mov.cuentaContable.id) ? prev : [...prev, mov.cuentaContable])
        }

        const personaLabel = mov.socio
          ? `${mov.socio.apellidoNombre} — Socio #${mov.socio.nroSocio}`
          : mov.entidad
            ? `${mov.entidad.razonSocial} — ${mov.entidad.tipo || 'Entidad'}`
            : null
        if (personaLabel) {
          setPersonaSeleccionada({
            tipo: mov.socio ? 'socio' : 'entidad',
            id: mov.socio?.id || mov.entidad?.id,
            label: personaLabel,
          })
        }

        setForm({
          cajaId: mov.cajaId ? String(mov.cajaId) : '',
          tipo: mov.tipo || 'INGRESO',
          fecha: mov.fecha ? new Date(mov.fecha).toISOString().split('T')[0] : '',
          monto: mov.monto != null ? String(mov.monto) : '',
          conceptoId: '',
          cuentaContableId: mov.cuentaContableId ? String(mov.cuentaContableId) : '',
          centroCostoId: mov.centroCostoId || null,
          concepto: mov.concepto || '',
          descripcion: mov.descripcion || '',
          medioPagoId: mov.medioPagoId ? String(mov.medioPagoId) : '',
          socioId: mov.socioId || null,
          entidadId: mov.entidadId || null,
        })
        // Si el movimiento tiene items persistidos, cargarlos
        if (Array.isArray(mov.items) && mov.items.length > 0) {
          setItems(mov.items.map(it => ({
            conceptoId: it.conceptoTesoreriaId ? String(it.conceptoTesoreriaId) : '',
            conceptoNombre: it.conceptoTesoreria?.nombre || '',
            cuentaContableId: String(it.cuentaContableId),
            cuentaContableLabel: it.cuentaContable ? `${it.cuentaContable.codigo} - ${it.cuentaContable.nombre}` : '',
            centroCostoId: it.centroCostoId || null,
            centroCostoLabel: it.centroCosto ? `${it.centroCosto.codigo} - ${it.centroCosto.nombre}` : '',
            monto: String(it.monto),
            descripcion: it.descripcion || '',
          })))
        }
        // Cargar medios de pago
        if (Array.isArray(mov.mediosPago) && mov.mediosPago.length > 0) {
          setMediosPagoLista(mov.mediosPago.map(mp => ({
            medioPagoId: String(mp.medioPagoId),
            medioPagoLabel: mp.medioPago?.nombre || '',
            monto: String(mp.monto),
            nroOperacion: mp.nroOperacion || '',
            descripcion: mp.descripcion || '',
          })))
        } else if (mov.medioPagoId) {
          setMediosPagoLista([{
            medioPagoId: String(mov.medioPagoId),
            medioPagoLabel: mov.medioPagoRel?.nombre || '',
            monto: String(mov.monto),
            nroOperacion: '',
            descripcion: '',
          }])
        }
        setDatosContablesOpen(true)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))

    // Al cambiar de caja, solo poblar centro de costo (la cuenta contable la da el concepto)
    if (name === 'cajaId' && value) {
      const caja = cajas.find(c => c.id === parseInt(value))
      if (caja) {
        setForm(prev => ({
          ...prev,
          cajaId: value,
          centroCostoId: caja.centroCostoId || prev.centroCostoId
        }))
      }
    }

    // Al seleccionar concepto: actualizar cuenta contable (siempre) y CC (solo si la caja no tiene uno)
    if (name === 'conceptoId' && value) {
      const concepto = conceptos.find(c => c.id === parseInt(value))
      if (concepto) {
        const cuentaId = concepto.cuentaContable?.id || concepto.cuentaContableId
        setForm(prev => {
          const cajaActual = cajas.find(c => c.id === parseInt(prev.cajaId))
          const cajaTieneCc = !!cajaActual?.centroCostoId
          return {
            ...prev,
            concepto: concepto.nombre,
            cuentaContableId: cuentaId ? String(cuentaId) : prev.cuentaContableId,
            centroCostoId: cajaTieneCc ? prev.centroCostoId : (concepto.centroCostoId || prev.centroCostoId),
          }
        })
        // Abrir el acordeón si el concepto tiene datos contables para mostrar
        if (cuentaId || concepto.centroCostoId) {
          setDatosContablesOpen(true)
        }
      }
    }
  }

  function handleConceptoCreado(conceptoCreado) {
    setConceptos(prev => [...prev, conceptoCreado])
    setForm(prev => {
      const cajaActual = cajas.find(c => c.id === parseInt(prev.cajaId))
      const cajaTieneCc = !!cajaActual?.centroCostoId
      return {
        ...prev,
        conceptoId: String(conceptoCreado.id),
        concepto: conceptoCreado.nombre,
        cuentaContableId: String(conceptoCreado.cuentaContableId),
        centroCostoId: cajaTieneCc ? prev.centroCostoId : (conceptoCreado.centroCostoId || prev.centroCostoId),
      }
    })
    setDatosContablesOpen(true)
  }

  async function buscarSocios(q) {
    if (!q || q.length < 2) { setResultadosSocio([]); return }
    setBuscandoSocio(true)
    try {
      const response = await api.getFull(`/admin/socios?q=${encodeURIComponent(q)}&limit=10`)
      setResultadosSocio(response?.data?.socios || [])
    } catch (err) {
      console.error('Error buscando socios:', err)
      setResultadosSocio([])
    } finally {
      setBuscandoSocio(false)
    }
  }

  async function buscarEntidades(q) {
    if (!q || q.length < 2) { setResultadosEntidad([]); return }
    setBuscandoEntidad(true)
    try {
      const response = await api.getFull(`/admin/entidades?busqueda=${encodeURIComponent(q)}&activo=true&limit=10`)
      setResultadosEntidad(response?.data || [])
    } catch (err) {
      console.error('Error buscando entidades:', err)
      setResultadosEntidad([])
    } finally {
      setBuscandoEntidad(false)
    }
  }

  function handleSelectSocio(s) {
    setPersonaSeleccionada({ tipo: 'socio', id: s.id, label: `#${s.nroSocio} — ${s.apellidoNombre}` })
    setBusquedaSocio(`#${s.nroSocio} — ${s.apellidoNombre}`)
    setResultadosSocio([])
    setForm(prev => ({ ...prev, socioId: s.id, entidadId: null }))
  }

  function handleSelectEntidad(e) {
    setPersonaSeleccionada({ tipo: 'entidad', id: e.id, label: `${e.codigo} — ${e.razonSocial} (${e.tipo})` })
    setBusquedaEntidad(`${e.codigo} — ${e.razonSocial}`)
    setResultadosEntidad([])
    setForm(prev => ({ ...prev, entidadId: e.id, socioId: null }))
  }

  function limpiarPersona() {
    setPersonaSeleccionada(null)
    setBusquedaSocio('')
    setBusquedaEntidad('')
    setResultadosSocio([])
    setResultadosEntidad([])
    setForm(prev => ({ ...prev, socioId: null, entidadId: null }))
  }

  function agregarItem() {
    // Por defecto el item nuevo hereda CC de la caja seleccionada (si tiene)
    const cajaActual = cajas.find(c => c.id === parseInt(form.cajaId))
    setItems(prev => [...prev, {
      conceptoId: '',
      cuentaContableId: '',
      centroCostoId: cajaActual?.centroCostoId || null,
      monto: '',
      descripcion: '',
    }])
  }

  function eliminarItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function agregarMedioPago() {
    // Auto-completar el monto con la diferencia faltante para llegar al total de items
    const restante = itemsTotal - mediosTotal
    setMediosPagoLista(prev => [...prev, {
      medioPagoId: '',
      monto: restante > 0 ? restante.toFixed(2) : '',
      nroOperacion: '',
      descripcion: '',
    }])
  }

  function eliminarMedioPago(idx) {
    setMediosPagoLista(prev => prev.filter((_, i) => i !== idx))
  }

  function handleMedioPagoChange(idx, field, value) {
    setMediosPagoLista(prev => prev.map((mp, i) => i === idx ? { ...mp, [field]: value } : mp))
  }

  function autocompletarMonto(idx) {
    // Llenar el monto del medio idx con la diferencia faltante
    const restante = itemsTotal - mediosTotal + (parseFloat(mediosPagoLista[idx]?.monto) || 0)
    handleMedioPagoChange(idx, 'monto', restante > 0 ? restante.toFixed(2) : '0.00')
  }

  function handleItemChange(idx, field, value) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      // Si cambia el concepto, traer cuenta contable y CC desde el concepto
      if (field === 'conceptoId') {
        if (!value) {
          updated.cuentaContableId = ''
          updated.cuentaContableLabel = ''
          return updated
        }
        const concepto = conceptos.find(c => c.id === parseInt(value))
        if (concepto) {
          const ccId = concepto.cuentaContableId || concepto.cuentaContable?.id
          if (ccId) {
            updated.cuentaContableId = String(ccId)
            const ccObj = concepto.cuentaContable || cuentasContables.find(c => c.id === ccId)
            updated.cuentaContableLabel = ccObj ? `${ccObj.codigo} - ${ccObj.nombre}` : ''
          } else {
            // Sin cuenta contable: limpiar y mostrar advertencia al guardar
            updated.cuentaContableId = ''
            updated.cuentaContableLabel = ''
          }
          if (concepto.centroCostoId) {
            updated.centroCostoId = concepto.centroCostoId
          }
          if (!updated.descripcion) {
            updated.descripcion = concepto.nombre
          }
        }
      }
      return updated
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.cajaId) {
      setError('Caja es requerida')
      return
    }

    if (items.length === 0) {
      setError('Agregá al menos un concepto')
      return
    }

    for (const [idx, it] of items.entries()) {
      if (!it.conceptoId) {
        setError(`Item ${idx + 1}: seleccioná un concepto`)
        return
      }
      if (!it.cuentaContableId) {
        const concepto = conceptos.find(c => c.id === parseInt(it.conceptoId))
        setError(`Item ${idx + 1}: el concepto "${concepto?.nombre || it.conceptoId}" no tiene cuenta contable asignada. Configurala en Tablas Auxiliares → Conceptos de Tesorería.`)
        return
      }
      if (!it.centroCostoId) {
        setError(`Item ${idx + 1}: el centro de costo es obligatorio`)
        return
      }
      const m = parseFloat(it.monto)
      if (!m || m <= 0) {
        setError(`Item ${idx + 1}: el monto debe ser mayor a cero`)
        return
      }
    }

    if (mediosPagoLista.length === 0) {
      setError('Agregá al menos un medio de pago')
      return
    }

    for (const [idx, mp] of mediosPagoLista.entries()) {
      if (!mp.medioPagoId) {
        setError(`Medio de pago ${idx + 1}: seleccioná el medio`)
        return
      }
      const m = parseFloat(mp.monto)
      if (!m || m <= 0) {
        setError(`Medio de pago ${idx + 1}: el monto debe ser mayor a cero`)
        return
      }
    }

    if (!balanceaTotal) {
      const diff = (itemsTotal - mediosTotal).toFixed(2)
      setError(`Los conceptos suman $${itemsTotal.toFixed(2)} y los medios de pago $${mediosTotal.toFixed(2)}. Diferencia: $${diff}. Deben coincidir.`)
      return
    }

    setSaving(true)
    try {
      const creado = await api.post('/admin/movimientos-caja', {
        cajaId: parseInt(form.cajaId),
        tipo: form.tipo,
        fecha: form.fecha || undefined,
        descripcion: form.descripcion || null,
        socioId: form.socioId || null,
        entidadId: form.entidadId || null,
        items: items.map(it => ({
          conceptoTesoreriaId: it.conceptoId ? parseInt(it.conceptoId) : null,
          cuentaContableId: parseInt(it.cuentaContableId),
          centroCostoId: parseInt(it.centroCostoId),
          monto: parseFloat(it.monto),
          descripcion: it.descripcion || null,
        })),
        mediosPago: mediosPagoLista.map(mp => ({
          medioPagoId: parseInt(mp.medioPagoId),
          monto: parseFloat(mp.monto),
          nroOperacion: mp.nroOperacion || null,
          descripcion: mp.descripcion || null,
        })),
      })

      // Recargar con relaciones (socio/entidad) para precargar email/teléfono en el modal
      let completo = creado
      try {
        completo = await api.get(`/admin/movimientos-caja/${creado.id}`)
      } catch (_) { /* fallback al objeto sin relaciones */ }
      setMovimientoCreado(completo)
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function cerrarModalYNavegar() {
    setMovimientoCreado(null)
    if (cajaIdParam) {
      navigate(`/admin/tesoreria/cajas/${cajaIdParam}`)
    } else {
      navigate('/admin/tesoreria/movimientos')
    }
  }

  const cajaSeleccionada = cajas.find(c => c.id === parseInt(form.cajaId))
  const cuentaSeleccionada = cuentasContables.find(c => c.id === parseInt(form.cuentaContableId))

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${form.tipo === 'INGRESO' ? 'bg-green-100' : 'bg-red-100'}`}>
            {form.tipo === 'INGRESO' ? (
              <TrendingUp className="w-6 h-6 text-green-600" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isReadOnly
                ? `${form.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} ${movimiento?.numero || ''}`
                : `Nuevo ${form.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}`}
            </h1>
            {isReadOnly && movimiento && (
              <p className="text-sm text-gray-500">
                {formatDate(movimiento.fecha)} · {movimiento.caja?.nombre}
                {movimiento.anulado && (
                  <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <Ban className="w-3 h-3" /> Anulado
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {isReadOnly && movimiento?.movimientoContable && RUTA_MOVIMIENTO_CONTABLE[movimiento.movimientoContable.tipo] && (
          <div className="ml-auto">
            <Button
              variant="secondary"
              onClick={() => navigate(RUTA_MOVIMIENTO_CONTABLE[movimiento.movimientoContable.tipo](movimiento.movimientoContable.id))}
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Movimiento Contable
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Fila: Buscador socio/entidad */}
          <div className="mb-4">
            <div className="flex-1 min-w-0">
              {personaSeleccionada ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="flex-1 text-sm text-blue-800 truncate">{personaSeleccionada.label}</span>
                  {!isReadOnly && (
                    <button type="button" onClick={limpiarPersona} className="p-1 hover:bg-blue-100 rounded text-blue-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : isReadOnly ? (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">Sin socio/entidad</div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="tipoPersona"
                        value="SOCIO"
                        checked={tipoPersona === 'SOCIO'}
                        onChange={() => { setTipoPersona('SOCIO'); setBusquedaEntidad(''); setResultadosEntidad([]) }}
                        className="text-primary focus:ring-primary"
                      />
                      Socio
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="tipoPersona"
                        value="ENTIDAD"
                        checked={tipoPersona === 'ENTIDAD'}
                        onChange={() => { setTipoPersona('ENTIDAD'); setBusquedaSocio(''); setResultadosSocio([]) }}
                        className="text-primary focus:ring-primary"
                      />
                      Entidad (Cliente / Proveedor / Personal)
                    </label>
                  </div>

                  {tipoPersona === 'SOCIO' ? (
                    <SearchInputWithDropdown
                      value={busquedaSocio}
                      onChange={(value) => { setBusquedaSocio(value); buscarSocios(value) }}
                      results={resultadosSocio}
                      loading={buscandoSocio}
                      onSelectResult={handleSelectSocio}
                      renderResult={(s) => <span>#{s.nroSocio} — {s.apellidoNombre}</span>}
                      placeholder="Buscar socio (opcional)..."
                      minChars={2}
                      debounceMs={300}
                      emptyMessage="No se encontraron socios"
                    />
                  ) : (
                    <SearchInputWithDropdown
                      value={busquedaEntidad}
                      onChange={(value) => { setBusquedaEntidad(value); buscarEntidades(value) }}
                      results={resultadosEntidad}
                      loading={buscandoEntidad}
                      onSelectResult={handleSelectEntidad}
                      renderResult={(e) => (
                        <div>
                          <span className="font-medium">{e.razonSocial}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {e.tipo}{e.documento ? ` · ${e.tipoDocumento || 'CUIT'}: ${e.documento}` : ''}
                          </span>
                        </div>
                      )}
                      placeholder="Buscar entidad (opcional)..."
                      minChars={2}
                      debounceMs={300}
                      emptyMessage="No se encontraron entidades"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila: Caja + Fecha + Observación */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_1.5fr] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caja *</label>
              <select
                name="cajaId"
                value={form.cajaId}
                onChange={handleChange}
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
                required
              >
                <option value="">Seleccionar caja...</option>
                {cajas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (${c.saldoActual.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
              <input
                type="text"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
                placeholder="Observación general (opcional)"
              />
            </div>
          </div>
        </div>

        {/* Items: lista de conceptos del movimiento */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Conceptos</h2>
              <p className="text-xs text-gray-500">
                Podés ingresar varios conceptos en el mismo movimiento (ej: cuota social + carnet + actividad).
              </p>
            </div>
            {!isReadOnly && (
              <Button type="button" variant="secondary" onClick={agregarItem}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar concepto
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">Sin conceptos agregados</p>
              {!isReadOnly && (
                <button type="button" onClick={agregarItem} className="text-primary text-sm mt-2 hover:underline">
                  Agregar el primero
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Concepto *</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Centro de Costo *</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Detalle</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-[140px]">Monto *</th>
                    {!isReadOnly && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const conceptosFiltrados = conceptos.filter(c => c.tipo === form.tipo || c.tipo === 'AMBOS')
                    const conceptoSel = item.conceptoId ? conceptos.find(c => c.id === parseInt(item.conceptoId)) : null
                    const conceptoSinCuenta = conceptoSel && !(conceptoSel.cuentaContableId || conceptoSel.cuentaContable?.id)
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 align-top">
                          {isReadOnly ? (
                            <div>
                              <div className="text-sm">{item.conceptoNombre || '-'}</div>
                              {item.cuentaContableLabel && (
                                <div className="text-xs text-gray-500 mt-0.5">{item.cuentaContableLabel}</div>
                              )}
                            </div>
                          ) : (
                            <>
                              <select
                                value={item.conceptoId}
                                onChange={(e) => handleItemChange(idx, 'conceptoId', e.target.value)}
                                className="input-field w-full text-sm"
                                required
                              >
                                <option value="">Seleccionar...</option>
                                {conceptosFiltrados.map(c => (
                                  <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                                ))}
                              </select>
                              {item.cuentaContableLabel && (
                                <div className="text-[11px] text-gray-500 mt-1 truncate" title={item.cuentaContableLabel}>
                                  Cta: {item.cuentaContableLabel}
                                </div>
                              )}
                              {conceptoSinCuenta && (
                                <div className="text-[11px] text-red-600 mt-1">
                                  ⚠ El concepto no tiene cuenta contable asignada
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {isReadOnly ? (
                            <span className="text-xs">{item.centroCostoLabel || '-'}</span>
                          ) : (
                            <CentroCostoSelector
                              value={item.centroCostoId}
                              onChange={(id) => handleItemChange(idx, 'centroCostoId', id)}
                              required
                              className="text-sm"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                            className="input-field w-full text-sm disabled:bg-gray-50 disabled:text-gray-700"
                            placeholder="Detalle"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.monto}
                            onChange={(e) => handleItemChange(idx, 'monto', e.target.value)}
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                            className="input-field w-full text-sm text-right disabled:bg-gray-50 disabled:text-gray-700"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            required
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => eliminarItem(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={4} className="px-3 py-3 text-right text-sm text-gray-600">
                      Total ({items.length} concepto{items.length !== 1 ? 's' : ''}):
                    </td>
                    <td className={`px-3 py-3 text-right font-bold text-lg ${form.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                      {form.tipo === 'INGRESO' ? '+' : '-'}${itemsTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    {!isReadOnly && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Preview saldo caja */}
          {!isReadOnly && form.cajaId && itemsTotal > 0 && cajaSeleccionada && form.tipo === 'EGRESO' && itemsTotal > cajaSeleccionada.saldoActual && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              El total excede el saldo disponible de {cajaSeleccionada.nombre} (${cajaSeleccionada.saldoActual.toLocaleString()})
            </div>
          )}
        </div>

        {/* Medios de Pago */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Medios de Pago</h2>
              <p className="text-xs text-gray-500">
                Podés combinar varios medios (ej: $5000 efectivo + $3000 transferencia).
              </p>
            </div>
            {!isReadOnly && (
              <Button type="button" variant="secondary" onClick={agregarMedioPago}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar medio
              </Button>
            )}
          </div>

          {mediosPagoLista.length === 0 ? (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">Sin medios de pago agregados</p>
              {!isReadOnly && (
                <button type="button" onClick={agregarMedioPago} className="text-primary text-sm mt-2 hover:underline">
                  Agregar el primero
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Medio *</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Nro. Operación</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Detalle</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-[160px]">Monto *</th>
                    {!isReadOnly && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mediosPagoLista.map((mp, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        {isReadOnly ? (
                          <span>{mp.medioPagoLabel || '-'}</span>
                        ) : (
                          <select
                            value={mp.medioPagoId}
                            onChange={(e) => handleMedioPagoChange(idx, 'medioPagoId', e.target.value)}
                            className="input-field w-full text-sm"
                            required
                          >
                            <option value="">Seleccionar...</option>
                            {mediosPago.map(m => (
                              <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={mp.nroOperacion}
                          onChange={(e) => handleMedioPagoChange(idx, 'nroOperacion', e.target.value)}
                          readOnly={isReadOnly}
                          disabled={isReadOnly}
                          className="input-field w-full text-sm disabled:bg-gray-50 disabled:text-gray-700"
                          placeholder="Opcional"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={mp.descripcion}
                          onChange={(e) => handleMedioPagoChange(idx, 'descripcion', e.target.value)}
                          readOnly={isReadOnly}
                          disabled={isReadOnly}
                          className="input-field w-full text-sm disabled:bg-gray-50 disabled:text-gray-700"
                          placeholder="Detalle"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={mp.monto}
                            onChange={(e) => handleMedioPagoChange(idx, 'monto', e.target.value)}
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                            className="input-field flex-1 text-sm text-right disabled:bg-gray-50 disabled:text-gray-700"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            required
                          />
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => autocompletarMonto(idx)}
                              className="p-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
                              title="Autocompletar con la diferencia"
                            >
                              =
                            </button>
                          )}
                        </div>
                      </td>
                      {!isReadOnly && (
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => eliminarMedioPago(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={3} className="px-3 py-3 text-right text-sm text-gray-600">
                      Total medios:
                    </td>
                    <td className={`px-3 py-3 text-right font-bold text-lg ${balanceaTotal ? 'text-green-600' : 'text-amber-600'}`}>
                      ${mediosTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    {!isReadOnly && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Indicador de balance */}
          {!isReadOnly && items.length > 0 && (
            <div className={`mt-4 p-3 rounded-lg border text-sm ${
              balanceaTotal
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {balanceaTotal ? (
                <>✓ Balanceado: conceptos ${itemsTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })} = medios ${mediosTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>
              ) : (
                <>⚠ Diferencia ${(itemsTotal - mediosTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}: conceptos ${itemsTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })} vs medios ${mediosTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>
              )}
            </div>
          )}
        </div>

        {/* Adjuntos: solo disponibles cuando el movimiento ya fue guardado */}
        {isReadOnly && movimiento?.id && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <AdjuntosComprobante tipo="movimientoCaja" comprobanteId={movimiento.id} />
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            {isReadOnly ? 'Volver' : 'Cancelar'}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              loading={saving}
              disabled={items.length === 0 || mediosPagoLista.length === 0 || !balanceaTotal}
            >
              <Save className="w-4 h-4 mr-2" />
              Registrar {form.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
            </Button>
          )}
        </div>
      </form>

      <ConceptoTesoreriaModal
        isOpen={showConceptoModal}
        onClose={() => setShowConceptoModal(false)}
        onCreated={handleConceptoCreado}
        tipoDefault={form.tipo}
      />

      <ComprobanteMovimientoModal
        isOpen={!!movimientoCreado}
        onClose={cerrarModalYNavegar}
        movimiento={movimientoCreado}
        variante="success"
      />
    </div>
  )
}
