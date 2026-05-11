import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import SelectCentroCosto from '../../components/SelectCentroCosto'
import Switch from '../../components/Switch'

const COLORES = [
  { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-800' },
  { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-800' },
  { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-800' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-100 text-yellow-800' },
  { value: 'purple', label: 'Púrpura', class: 'bg-purple-100 text-purple-800' },
  { value: 'gray', label: 'Gris', class: 'bg-gray-100 text-gray-800' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-100 text-orange-800' },
]

const TITULOS = {
  'tipos-socio': 'Tipo de Socio',
  'categorias-socio': 'Categoría de Socio',
  'estados-socio': 'Estado de Socio',
  'conceptos-tesoreria': 'Concepto',
  'cargos-personal': 'Cargo de Personal',
  'descuentos-disponibles': 'Descuento Disponible',
  'rubros': 'Rubro',
  'medios-pago': 'Medio de Pago',
  'categorias-cargo': 'Categoría de Cargo',
}

const TIPOS_MEDIO_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta Crédito' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta Débito' },
  { value: 'QR', label: 'QR / MercadoPago' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta Corriente' },
  { value: 'OTRO', label: 'Otro' },
]

export default function ConfiguracionForm() {
  const { tabla, id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'nuevo'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [conceptosTesoreria, setConceptosTesoreria] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [cajas, setCajas] = useState([])

  const titulo = TITULOS[tabla] || 'Registro'

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: tabla === 'estados-socio' ? 'green' : 'blue',
    orden: 0,
    activo: true,
    // tipos-socio
    cuotaMensual: '',
    // categorias-socio
    porcentajeDescuento: 0,
    // estados-socio
    permiteDescuentos: true,
    permiteIngresoMolinete: false,
    esSocioActivo: true,
    rolVigencia: '',
    // cargos-personal
    esEntrenador: false,
    // conceptos-tesoreria
    tipo: 'INGRESO',
    usaEnCompras: false,
    usaEnVentas: false,
    usaEnTesoreria: true,
    cuentaContableId: '',
    centroCostoId: '',
    // descuentos-disponibles
    porcentaje: '',
    // medios-pago
    tipoMedioPago: 'EFECTIVO',
    requiereDatosBanco: false,
    comisionPct: 0,
    paraCaja: true,
    paraBuffet: true,
    paraKiosco: true,
    paraTakeaway: true,
    conceptoTesoreriaId: '',
    cajaDefaultId: '',
  })

  useEffect(() => {
    if (tabla === 'tipos-socio' || tabla === 'medios-pago') {
      cargarConceptosTesoreria()
    }
    if (tabla === 'medios-pago') {
      api.get('/admin/cajas').then(r => setCajas((r || []).filter(c => c.paraCaja)))
    }
    if (tabla === 'conceptos-tesoreria') {
      cargarCuentasContables()
    }
    if (isEditing) {
      cargarDatos()
    }
  }, [id, tabla])

  async function cargarConceptosTesoreria() {
    try {
      const data = await api.get('/admin/conceptos-tesoreria?activo=true')
      setConceptosTesoreria(data || [])
    } catch (err) {
      console.error('Error cargando conceptos:', err)
    }
  }

  async function cargarCuentasContables() {
    try {
      const res = await api.getFull('/admin/cuentas-contables?flat=true&esImputable=true&activo=true')
      setCuentasContables(res.data || [])
    } catch (err) {
      console.error('Error cargando cuentas contables:', err)
    }
  }

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/${tabla}/${id}`)
      setForm({
        codigo: data.codigo || '',
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        color: data.color || 'blue',
        orden: data.orden || 0,
        activo: data.activo !== false,
        cuotaMensual: data.cuotaMensual || '',
        porcentajeDescuento: data.porcentajeDescuento || 0,
        permiteDescuentos: data.permiteDescuentos !== false,
        permiteIngresoMolinete: data.permiteIngresoMolinete === true,
        esSocioActivo: data.esSocioActivo !== false,
        rolVigencia: data.rolVigencia || '',
        esEntrenador: data.esEntrenador === true,
        // conceptos-tesoreria
        tipo: data.tipo || 'INGRESO',
        usaEnCompras: data.usaEnCompras || false,
        usaEnVentas: data.usaEnVentas || false,
        usaEnTesoreria: data.usaEnTesoreria !== false,
        cuentaContableId: data.cuentaContableId ? String(data.cuentaContableId) : '',
        centroCostoId: data.centroCostoId ? String(data.centroCostoId) : '',
        // medios-pago
        tipoMedioPago: data.tipo || 'EFECTIVO',
        requiereDatosBanco: data.requiereDatosBanco || false,
        comisionPct: data.comisionPct || 0,
        paraCaja: data.paraCaja !== false,
        paraBuffet: data.paraBuffet !== false,
        paraKiosco: data.paraKiosco !== false,
        paraTakeaway: data.paraTakeaway !== false,
        conceptoTesoreriaId: data.conceptoTesoreriaId ? String(data.conceptoTesoreriaId) : '',
        cajaDefaultId: data.cajaDefaultId ? String(data.cajaDefaultId) : '',
      })
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const datos = {
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        orden: parseInt(form.orden) || 0,
        activo: form.activo,
      }

      // Campos específicos según tabla
      if (tabla === 'tipos-socio') {
        datos.color = form.color
        datos.cuotaMensual = form.cuotaMensual ? parseFloat(form.cuotaMensual) : null
        datos.conceptoTesoreriaId = form.conceptoTesoreriaId ? parseInt(form.conceptoTesoreriaId) : null
      }

      if (tabla === 'categorias-socio') {
        datos.color = form.color
        datos.porcentajeDescuento = parseFloat(form.porcentajeDescuento) || 0
      }

      if (tabla === 'estados-socio') {
        datos.color = form.color
        datos.permiteDescuentos = form.permiteDescuentos
        datos.permiteIngresoMolinete = form.permiteIngresoMolinete
        datos.esSocioActivo = form.esSocioActivo
        datos.rolVigencia = form.rolVigencia || null
      }

      if (tabla === 'categorias-cargo') {
        datos.color = form.color
      }

      if (tabla === 'cargos-personal') {
        datos.esEntrenador = form.esEntrenador === true
      }

      if (tabla === 'conceptos-tesoreria') {
        datos.tipo = form.tipo
        datos.usaEnCompras = form.usaEnCompras
        datos.usaEnVentas = form.usaEnVentas
        datos.usaEnTesoreria = form.usaEnTesoreria
        datos.cuentaContableId = form.cuentaContableId ? parseInt(form.cuentaContableId) : null
        datos.centroCostoId = form.centroCostoId ? parseInt(form.centroCostoId) : null
      }

      if (tabla === 'descuentos-disponibles') {
        datos.porcentaje = parseFloat(form.porcentaje)
        delete datos.codigo // No usa código
        delete datos.color // No usa color
      }

      if (tabla === 'rubros') {
        delete datos.codigo // No usa código
        delete datos.color // No usa color
      }

      if (tabla === 'medios-pago') {
        datos.tipo = form.tipoMedioPago
        datos.requiereDatosBanco = form.requiereDatosBanco
        datos.comisionPct = parseFloat(form.comisionPct) || 0
        datos.paraCaja = form.paraCaja
        datos.paraBuffet = form.paraBuffet
        datos.paraKiosco = form.paraKiosco
        datos.paraTakeaway = form.paraTakeaway
        datos.conceptoTesoreriaId = form.conceptoTesoreriaId ? parseInt(form.conceptoTesoreriaId) : null
        datos.cajaDefaultId = form.cajaDefaultId ? parseInt(form.cajaDefaultId) : null
        delete datos.color
        delete datos.descripcion
      }

      if (isEditing) {
        await api.put(`/admin/${tabla}/${id}`, datos)
      } else {
        await api.post(`/admin/${tabla}`, datos)
      }

      navigate(`/admin/configuracion/${tabla}`)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

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
          onClick={() => navigate(`/admin/configuracion/${tabla}`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar' : 'Nuevo'} {titulo}
          </h1>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Formulario */}
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${tabla === 'conceptos-tesoreria' || tabla === 'medios-pago' ? 'max-w-3xl' : 'max-w-xl'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Layout especial para conceptos-tesoreria y medios-pago */}
          {tabla === 'medios-pago' ? (
            <>
              {/* Fila 1: Código | Nombre */}
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              {/* Fila 2: Tipo (select full width) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={form.tipoMedioPago}
                  onChange={e => setForm({ ...form, tipoMedioPago: e.target.value })}
                  className="input-field w-full"
                >
                  {TIPOS_MEDIO_PAGO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Fila 2: Concepto Tesorería | Comisión | Orden */}
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concepto Tesorería <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.conceptoTesoreriaId}
                    onChange={e => setForm({ ...form, conceptoTesoreriaId: e.target.value })}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Seleccionar concepto...</option>
                    {conceptosTesoreria.filter(c => c.tipo === 'INGRESO' || c.tipo === 'AMBOS').map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comisión %</label>
                  <input
                    type="number"
                    value={form.comisionPct}
                    onChange={e => setForm({ ...form, comisionPct: e.target.value })}
                    className="input-field w-full"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    value={form.orden}
                    onChange={e => setForm({ ...form, orden: e.target.value })}
                    className="input-field w-full"
                    min="0"
                  />
                </div>
              </div>

              {/* Caja por defecto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caja por defecto</label>
                <select
                  value={form.cajaDefaultId}
                  onChange={e => setForm({ ...form, cajaDefaultId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">Sin caja por defecto</option>
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fila 3: Opciones + Botones */}
              <div className="flex items-center gap-5 pt-2 border-t flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiereDatosBanco}
                    onChange={e => setForm({ ...form, requiereDatosBanco: e.target.checked })}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700">Req. datos banco</span>
                </label>
                <div className="h-4 border-l border-gray-300" />
                <span className="text-sm font-medium text-gray-600">Disponible en:</span>
                {[
                  { key: 'paraCaja',     label: 'Caja' },
                  { key: 'paraBuffet',   label: 'Buffet' },
                  { key: 'paraKiosco',   label: 'Kiosco' },
                  { key: 'paraTakeaway', label: 'Pedidos' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
                {isEditing && (
                  <>
                    <div className="h-4 border-l border-gray-300" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.activo}
                        onChange={e => setForm({ ...form, activo: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Activo</span>
                    </label>
                  </>
                )}
                <div className="flex gap-3 ml-auto">
                  <Button type="submit" loading={saving} className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Guardar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => navigate(`/admin/configuracion/${tabla}`)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </>
          ) : tabla === 'conceptos-tesoreria' ? (
            <>
              {/* Fila 1: Tipo | Código | Nombre | Orden */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <div className="flex gap-1">
                    {['INGRESO', 'EGRESO', 'AMBOS'].map(tipo => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setForm({ ...form, tipo, cuentaContableId: '' })}
                        className={`flex-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition ${
                          form.tipo === tipo
                            ? tipo === 'INGRESO' ? 'border-green-500 bg-green-50 text-green-700'
                            : tipo === 'EGRESO'  ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {tipo === 'INGRESO' ? 'Ingreso' : tipo === 'EGRESO' ? 'Egreso' : 'Ambos'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    value={form.orden}
                    onChange={e => setForm({ ...form, orden: e.target.value })}
                    className="input-field w-full"
                    min="0"
                  />
                </div>
              </div>

              {/* Fila 2: Cuenta Contable | Centro de Costo | Descripción */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta Contable <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <select
                    value={form.cuentaContableId}
                    onChange={e => setForm({ ...form, cuentaContableId: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">Sin asignar</option>
                    {cuentasContables
                      .filter(c => {
                        if (form.tipo === 'INGRESO') return c.tipo === 'INGRESO' || c.codigo.startsWith('4')
                        if (form.tipo === 'EGRESO') return c.tipo === 'EGRESO' || c.codigo.startsWith('5')
                        return true
                      })
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centro de Costo <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <SelectCentroCosto
                    value={form.centroCostoId}
                    onChange={(val) => setForm({ ...form, centroCostoId: val ? String(val) : '' })}
                    showEmpty
                    emptyLabel="Sin asignar"
                    className="input-field w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se usa al cobrar cuotas asociadas a este concepto
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={form.descripcion}
                    onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className="input-field w-full"
                    placeholder="Descripción opcional"
                  />
                </div>
              </div>

              {/* Fila 3: Usar en + Activo + Botones */}
              <div className="flex items-center gap-6 pt-1 border-t flex-wrap">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Usar en:</span>
                  {[
                    { key: 'usaEnTesoreria', label: 'Tesorería' },
                    { key: 'usaEnCompras',   label: 'Compras' },
                    { key: 'usaEnVentas',    label: 'Ventas' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={e => setForm({ ...form, [key]: e.target.checked })}
                        className="rounded border-gray-300 text-primary"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                {isEditing && (
                  <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={e => setForm({ ...form, activo: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Activo</span>
                  </label>
                )}
                <div className="flex gap-3 ml-auto">
                  <Button type="submit" loading={saving} className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Guardar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => navigate(`/admin/configuracion/${tabla}`)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
          {/* Layout estándar para otras tablas */}
          <div className="grid grid-cols-2 gap-4">
            {tabla !== 'descuentos-disponibles' && tabla !== 'rubros' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                  className="input-field w-full"
                  required
                />
              </div>
            )}
            <div className={tabla === 'descuentos-disponibles' || tabla === 'rubros' ? 'col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={e => setForm({ ...form, orden: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="input-field w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className="input-field w-full"
            />
          </div>

          {/* Campos específicos para tipos-socio */}
          {tabla === 'tipos-socio' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuota Mensual ($)</label>
                  <input
                    type="number"
                    value={form.cuotaMensual}
                    onChange={e => setForm({ ...form, cuotaMensual: e.target.value })}
                    className="input-field w-full"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concepto Tesorería</label>
                  <select
                    value={form.conceptoTesoreriaId}
                    onChange={e => setForm({ ...form, conceptoTesoreriaId: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">Sin asignar</option>
                    {conceptosTesoreria.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Campos específicos para categorias-socio */}
          {tabla === 'categorias-socio' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje Descuento (%)</label>
              <input
                type="number"
                value={form.porcentajeDescuento}
                onChange={e => setForm({ ...form, porcentajeDescuento: e.target.value })}
                className="input-field w-full"
                step="0.01"
                min="0"
                max="100"
                placeholder="Ej: 50 para becado 50%"
              />
              <p className="text-xs text-gray-500 mt-1">
                Descuento que se aplica a todas las cuotas del socio (0 = sin descuento, 100 = exento)
              </p>
            </div>
          )}

          {/* Campos específicos para estados-socio */}
          {tabla === 'estados-socio' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-purple-800 font-medium">
                    Cuenta como socio del club
                  </label>
                  <Switch
                    checked={form.esSocioActivo}
                    onChange={(v) => setForm({ ...form, esSocioActivo: v })}
                  />
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  Activar para estados como Vigente, Bloqueado por morosidad, etc. Desactivar para Baja, Renuncia, Expulsión. Los reportes de morosidad excluyen a los socios cuyo estado tenga este flag desactivado.
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <label className="text-sm text-green-800">
                  Permite usar descuentos en comercios (Clubix)
                </label>
                <Switch
                  checked={form.permiteDescuentos}
                  onChange={(v) => setForm({ ...form, permiteDescuentos: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <label className="text-sm text-blue-800">
                  Permite ingresar por molinete (control de accesos)
                </label>
                <Switch
                  checked={form.permiteIngresoMolinete}
                  onChange={(v) => setForm({ ...form, permiteIngresoMolinete: v })}
                />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                <label className="block text-sm font-medium text-amber-800">
                  Rol en vigencia automática por morosidad
                </label>
                <select
                  value={form.rolVigencia || ''}
                  onChange={(e) => setForm({ ...form, rolVigencia: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">Sin rol — estado normal</option>
                  <option value="AL_DIA">Al día (al cobrar y quedar sin cuotas vencidas)</option>
                  <option value="BLOQUEADO">Bloqueado (cuando el socio se atrasa)</option>
                </select>
                <p className="text-xs text-amber-700">
                  El cron de vigencia mueve socios entre los estados marcados como "Al día" y "Bloqueado". Sólo puede haber un estado por cada rol.
                </p>
              </div>
            </div>
          )}

          {/* Campos específicos para descuentos-disponibles */}
          {tabla === 'descuentos-disponibles' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje (%)</label>
              <input
                type="number"
                value={form.porcentaje}
                onChange={e => setForm({ ...form, porcentaje: e.target.value })}
                className="input-field w-full"
                step="0.01"
                min="0"
                max="100"
                required
                placeholder="Ej: 10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Porcentaje de descuento que se aplicará (0 a 100)
              </p>
            </div>
          )}


          {/* Cargo de Personal — flag esEntrenador */}
          {tabla === 'cargos-personal' && (
            <div className="space-y-3 bg-blue-50 border border-blue-200 rounded p-4">
              <Switch
                checked={form.esEntrenador === true}
                onChange={(v) => setForm({ ...form, esEntrenador: v })}
                label="Cargo de entrenador"
              />
              <p className="text-xs text-gray-600 ml-12">
                Si está activo, el personal con este cargo podrá tener perfil de entrenador
                (categorías asignadas, plantel, asistencia, partidos, chat con socios) y
                acceder al portal del entrenador.
              </p>
            </div>
          )}

          {/* Color del badge (no para conceptos-tesoreria, descuentos-disponibles, rubros ni medios-pago) */}
          {tabla !== 'conceptos-tesoreria' && tabla !== 'descuentos-disponibles' && tabla !== 'rubros' && tabla !== 'medios-pago' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color del Badge</label>
              <div className="flex flex-wrap gap-2">
                {COLORES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`px-3 py-1.5 text-sm rounded-full transition ${c.class} ${
                      form.color === c.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="activo" className="text-sm text-gray-700">Activo</label>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" loading={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Guardar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/admin/configuracion/${tabla}`)}
            >
              Cancelar
            </Button>
          </div>
          </> )}
        </form>
      </div>
    </div>
  )
}
