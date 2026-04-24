import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, Save, TrendingUp, TrendingDown, Plus, ChevronDown, ChevronRight, Search, X, FileText, Ban } from 'lucide-react'
import { Button } from '../../../components/Button'
import CentroCostoSelector from '../../../components/CentroCostoSelector'
import ConceptoTesoreriaModal from '../../../components/ConceptoTesoreriaModal'
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

  // Selector Socio/Entidad
  const [busquedaPersona, setBusquedaPersona] = useState('')
  const [resultadosPersona, setResultadosPersona] = useState([])
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null)
  const [buscandoPersona, setBuscandoPersona] = useState(false)

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

  async function buscarPersona(q) {
    if (q.length < 2) { setResultadosPersona([]); return }
    setBuscandoPersona(true)
    try {
      const [sociosRes, entidadesRes] = await Promise.all([
        api.getFull(`/admin/socios?q=${encodeURIComponent(q)}&limit=5`),
        api.getFull(`/admin/entidades?busqueda=${encodeURIComponent(q)}&limit=5`).catch(() => ({ data: [] })),
      ])
      const socios = (sociosRes.data || []).map(s => ({ tipo: 'socio', id: s.id, label: `${s.apellido}, ${s.nombre} — Socio #${s.numeroSocio}` }))
      const entidades = (entidadesRes.data || []).map(e => ({ tipo: 'entidad', id: e.id, label: `${e.razonSocial || e.nombre} — ${e.tipo || 'Entidad'}` }))
      setResultadosPersona([...socios, ...entidades])
    } finally {
      setBuscandoPersona(false)
    }
  }

  function seleccionarPersona(p) {
    setPersonaSeleccionada(p)
    setBusquedaPersona('')
    setResultadosPersona([])
    setForm(prev => ({
      ...prev,
      socioId: p.tipo === 'socio' ? p.id : null,
      entidadId: p.tipo === 'entidad' ? p.id : null,
    }))
  }

  function limpiarPersona() {
    setPersonaSeleccionada(null)
    setBusquedaPersona('')
    setResultadosPersona([])
    setForm(prev => ({ ...prev, socioId: null, entidadId: null }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.cajaId || !form.monto || !form.conceptoId || !form.cuentaContableId) {
      setError('Caja, monto, concepto y cuenta contable son requeridos')
      return
    }

    if (!form.medioPagoId) {
      setError('El medio de pago es obligatorio')
      return
    }

    if (!form.descripcion?.trim()) {
      setError('La observación es obligatoria')
      return
    }

    if (!form.centroCostoId) {
      setError('El centro de costo es requerido. Verificá que la caja o el concepto tengan un centro de costo asignado.')
      return
    }

    const montoNum = parseFloat(form.monto)
    if (montoNum <= 0) {
      setError('El monto debe ser mayor a cero')
      return
    }

    setSaving(true)
    try {
      await api.post('/admin/movimientos-caja', {
        cajaId: parseInt(form.cajaId),
        tipo: form.tipo,
        fecha: form.fecha || undefined,
        monto: montoNum,
        cuentaContableId: parseInt(form.cuentaContableId),
        centroCostoId: form.centroCostoId || null,
        concepto: form.concepto || null,
        descripcion: form.descripcion || null,
        medioPagoId: parseInt(form.medioPagoId),
        socioId: form.socioId || null,
        entidadId: form.entidadId || null,
      })

      if (cajaIdParam) {
        navigate(`/admin/tesoreria/cajas/${cajaIdParam}`)
      } else {
        navigate('/admin/tesoreria/movimientos')
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
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
          {/* Tipo de movimiento */}
          <div className="flex gap-4 mb-6">
            <button
              type="button"
              onClick={() => !isReadOnly && setForm(prev => ({ ...prev, tipo: 'INGRESO' }))}
              disabled={isReadOnly}
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                form.tipo === 'INGRESO'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              } ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => !isReadOnly && setForm(prev => ({ ...prev, tipo: 'EGRESO' }))}
              disabled={isReadOnly}
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition ${
                form.tipo === 'EGRESO'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              } ${isReadOnly ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <TrendingDown className="w-5 h-5 mx-auto mb-1" />
              Egreso
            </button>
          </div>

          {/* Socio / Entidad (opcional) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio / Entidad <span className="text-gray-400 font-normal">(opcional)</span></label>
            {personaSeleccionada ? (
              <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="flex-1 text-sm text-blue-800">{personaSeleccionada.label}</span>
                {!isReadOnly && (
                  <button type="button" onClick={limpiarPersona} className="p-1 hover:bg-blue-100 rounded text-blue-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : isReadOnly ? (
              <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">-</div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaPersona}
                    onChange={(e) => { setBusquedaPersona(e.target.value); buscarPersona(e.target.value) }}
                    className="input-field w-full pl-9"
                    placeholder="Buscar socio o entidad..."
                  />
                  {buscandoPersona && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
                </div>
                {resultadosPersona.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                    {resultadosPersona.map((p, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => seleccionarPersona(p)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Fila 1: Caja + Medio de Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Caja */}
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

            {/* Medio de Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago *</label>
              <select
                name="medioPagoId"
                value={form.medioPagoId}
                onChange={handleChange}
                disabled={isReadOnly}
                className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
                required
              >
                <option value="">Seleccionar...</option>
                {mediosPago.map(mp => (
                  <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 2: Fecha + Concepto + Monto */}
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_180px] gap-4 mt-4">
            {/* Fecha */}
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

            {/* Concepto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
              {isReadOnly ? (
                <input
                  type="text"
                  value={form.concepto}
                  readOnly
                  className="input-field w-full bg-gray-50 text-gray-700"
                />
              ) : (
                <div className="flex gap-2">
                  <select
                    name="conceptoId"
                    value={form.conceptoId}
                    onChange={handleChange}
                    className="input-field flex-1"
                    required
                  >
                    <option value="">Seleccionar concepto...</option>
                    {conceptos
                      .filter(c => c.tipo === form.tipo || c.tipo === 'AMBOS')
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nombre}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowConceptoModal(true)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
                    title="Crear nuevo concepto"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
              <input
                type="number"
                name="monto"
                value={form.monto}
                onChange={handleChange}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                className="input-field w-full text-lg disabled:bg-gray-50 disabled:text-gray-700"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Observación */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación *</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
              rows={2}
              placeholder="Detalle obligatorio del movimiento..."
              required
            />
          </div>

          {/* Preview */}
          {!isReadOnly && form.cajaId && form.monto && (
            <div className={`mt-4 p-4 rounded-lg ${form.tipo === 'INGRESO' ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm text-gray-600 mb-1">
                {form.tipo === 'INGRESO' ? 'Se sumará' : 'Se restará'} de <strong>{cajaSeleccionada?.nombre}</strong>:
              </p>
              <p className={`text-2xl font-bold ${form.tipo === 'INGRESO' ? 'text-green-600' : 'text-red-600'}`}>
                {form.tipo === 'INGRESO' ? '+' : '-'}${parseFloat(form.monto || 0).toLocaleString()}
              </p>
              {cajaSeleccionada && form.tipo === 'EGRESO' && parseFloat(form.monto) > cajaSeleccionada.saldoActual && (
                <p className="text-sm text-red-600 mt-2">
                  El monto excede el saldo disponible (${cajaSeleccionada.saldoActual.toLocaleString()})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Acordeón: Datos Contables */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setDatosContablesOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              {datosContablesOpen
                ? <ChevronDown className="w-4 h-4 text-gray-500" />
                : <ChevronRight className="w-4 h-4 text-gray-500" />
              }
              <span className="text-sm font-medium text-gray-700">Datos contables</span>
              {!datosContablesOpen && (form.cuentaContableId || form.centroCostoId) && (
                <span className="text-xs text-gray-400 ml-2">
                  {[
                    cuentaSeleccionada ? `${cuentaSeleccionada.codigo} ${cuentaSeleccionada.nombre}` : null,
                    form.centroCostoId ? `CC asignado` : null
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
              {!datosContablesOpen && !form.cuentaContableId && !form.centroCostoId && (
                <span className="text-xs text-amber-500 ml-2">Se completan automáticamente desde la caja o el concepto</span>
              )}
            </div>
          </button>

          {datosContablesOpen && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable *</label>
                <select
                  name="cuentaContableId"
                  value={form.cuentaContableId}
                  onChange={handleChange}
                  disabled={isReadOnly}
                  className="input-field w-full disabled:bg-gray-50 disabled:text-gray-700"
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {(() => {
                    const conceptoActual = form.conceptoId ? conceptos.find(c => c.id === parseInt(form.conceptoId)) : null
                    const cuentaConcepto = conceptoActual?.cuentaContable
                    const lista = [...cuentasContables]
                    if (cuentaConcepto && !lista.find(c => c.id === cuentaConcepto.id)) lista.push(cuentaConcepto)
                    return lista.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)
                  })()}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Costo *
                </label>
                <CentroCostoSelector
                  value={form.centroCostoId}
                  onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
                  disabled={isReadOnly}
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            {isReadOnly ? 'Volver' : 'Cancelar'}
          </Button>
          {!isReadOnly && (
            <Button type="submit" loading={saving}>
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
    </div>
  )
}
