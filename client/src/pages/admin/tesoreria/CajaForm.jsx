import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Wallet } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPOS_CAJA = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'BANCO', label: 'Cuenta Bancaria' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'VALORES_PENDIENTES', label: 'Valores Pendientes' },
  { value: 'OTRO', label: 'Otro' }
]


export default function CajaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cuentasContables, setCuentasContables] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [mediosPago, setMediosPago] = useState([])

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipo: 'EFECTIVO',
    descripcion: '',
    saldoInicial: '',
    cuentaContableId: '',
    centroCostoId: '',
    requiereConciliacion: false,
    activo: true,
    mediosPagoPermitidos: ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA'],
    // Campos de facturación y uso
    puntoVentaAfip: '',
    paraBuffet: false,
    paraKiosco: false,
    paraTakeaway: false,
    paraCaja: true
  })

  useEffect(() => {
    cargarDatosIniciales()
    if (isEditing) {
      cargarCaja()
    }
  }, [id])

  async function cargarDatosIniciales() {
    try {
      const [cuentasRes, centrosRes, mediosRes] = await Promise.all([
        api.getFull('/admin/cuentas-contables?tipo=ACTIVO&esImputable=true&flat=true'),
        api.getFull('/admin/centros-costo?activo=true'),
        api.getFull('/admin/medios-pago?activo=true')
      ])
      setCuentasContables(cuentasRes.data || [])
      setCentrosCosto(centrosRes.data || centrosRes || [])
      setMediosPago(mediosRes.data || mediosRes || [])

      // Si es nueva caja, inicializar con todos los medios de pago activos
      if (!isEditing && mediosRes.data?.length) {
        setForm(prev => ({
          ...prev,
          mediosPagoPermitidos: mediosRes.data.map(mp => mp.codigo)
        }))
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err)
    }
  }

  async function cargarCaja() {
    setLoading(true)
    try {
      const caja = await api.get(`/admin/cajas/${id}`)
      setForm({
        codigo: caja.codigo || '',
        nombre: caja.nombre || '',
        tipo: caja.tipo || 'EFECTIVO',
        descripcion: caja.descripcion || '',
        saldoInicial: '',
        cuentaContableId: caja.cuentaContableId ? String(caja.cuentaContableId) : '',
        centroCostoId: caja.centroCostoId ? String(caja.centroCostoId) : '',
        requiereConciliacion: caja.requiereConciliacion || false,
        activo: caja.activo,
        mediosPagoPermitidos: caja.mediosPagoPermitidos || [],
        // Campos de facturación y uso
        puntoVentaAfip: caja.puntoVentaAfip ? String(caja.puntoVentaAfip) : '',
        paraBuffet: caja.paraBuffet || false,
        paraKiosco: caja.paraKiosco || false,
        paraTakeaway: caja.paraTakeaway || false,
        paraCaja: caja.paraCaja !== false
      })
    } catch (err) {
      setError('Error al cargar la caja')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function toggleMedioPago(codigo) {
    setForm(prev => ({
      ...prev,
      mediosPagoPermitidos: prev.mediosPagoPermitidos.includes(codigo)
        ? prev.mediosPagoPermitidos.filter(c => c !== codigo)
        : [...prev.mediosPagoPermitidos, codigo]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.nombre) {
      setError('Codigo y nombre son requeridos')
      return
    }

    setSaving(true)
    try {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion || null,
        cuentaContableId: form.cuentaContableId ? parseInt(form.cuentaContableId) : null,
        centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null,
        requiereConciliacion: form.requiereConciliacion,
        activo: form.activo,
        mediosPagoPermitidos: form.mediosPagoPermitidos,
        // Campos de facturación y uso
        puntoVentaAfip: form.puntoVentaAfip ? parseInt(form.puntoVentaAfip) : null,
        paraBuffet: form.paraBuffet,
        paraKiosco: form.paraKiosco,
        paraTakeaway: form.paraTakeaway,
        paraCaja: form.paraCaja
      }

      if (!isEditing && form.saldoInicial) {
        payload.saldoInicial = parseFloat(form.saldoInicial)
      }

      if (isEditing) {
        await api.put(`/admin/cajas/${id}`, payload)
      } else {
        await api.post('/admin/cajas', payload)
      }

      navigate('/admin/tesoreria/cajas')
    } catch (err) {
      setError(err.message || 'Error al guardar')
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
          onClick={() => navigate('/admin/tesoreria/cajas')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Editar Caja' : 'Nueva Caja'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos de la Caja</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo *
              </label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Ej: CAJA-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Ej: Caja Principal"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className="input-field w-full"
              >
                {TIPOS_CAJA.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuenta Contable
              </label>
              <select
                name="cuentaContableId"
                value={form.cuentaContableId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">-- Sin cuenta contable --</option>
                {cuentasContables.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Vincula esta caja a una cuenta del plan de cuentas para asientos automaticos
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Costo
              </label>
              <select
                name="centroCostoId"
                value={form.centroCostoId}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">-- Sin centro de costo --</option>
                {centrosCosto.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} - {c.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Las ventas de esta caja se asignarán a este centro de costo
              </p>
            </div>
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Inicial
                </label>
                <input
                  type="number"
                  name="saldoInicial"
                  value={form.saldoInicial}
                  onChange={handleChange}
                  className="input-field w-full"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                className="input-field w-full"
                rows={3}
                placeholder="Descripcion opcional..."
              />
            </div>
          </div>
        </div>

        {/* Medios de Pago Permitidos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Medios de Pago Permitidos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona qué medios de pago se pueden usar en esta caja
          </p>
          {mediosPago.length === 0 ? (
            <p className="text-gray-500 text-sm">Cargando medios de pago...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {mediosPago.map(mp => (
                <label
                  key={mp.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.mediosPagoPermitidos.includes(mp.codigo)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.mediosPagoPermitidos.includes(mp.codigo)}
                    onChange={() => toggleMedioPago(mp.codigo)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-gray-700 font-medium">{mp.nombre}</span>
                </label>
              ))}
            </div>
          )}
          {form.mediosPagoPermitidos.length === 0 && mediosPago.length > 0 && (
            <p className="text-amber-600 text-sm mt-3">
              ⚠️ Debes seleccionar al menos un medio de pago
            </p>
          )}
        </div>

        {/* Facturación y Uso */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Facturación y Uso</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Punto de Venta AFIP
              </label>
              <input
                type="number"
                name="puntoVentaAfip"
                value={form.puntoVentaAfip}
                onChange={handleChange}
                className="input-field w-full"
                min="1"
                max="99999"
                placeholder="Ej: 1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Numero de punto de venta asignado por AFIP para facturación electronica
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Usar esta caja en:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.paraCaja ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  name="paraCaja"
                  checked={form.paraCaja}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-gray-700 font-medium">Caja General</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.paraBuffet ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  name="paraBuffet"
                  checked={form.paraBuffet}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-gray-700 font-medium">Buffet</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.paraKiosco ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  name="paraKiosco"
                  checked={form.paraKiosco}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-gray-700 font-medium">Kiosco</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                form.paraTakeaway ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  name="paraTakeaway"
                  checked={form.paraTakeaway}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-gray-700 font-medium">TakeAway</span>
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Define donde estará disponible esta caja para registrar ventas
            </p>
          </div>
        </div>

        {/* Conciliación */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="requiereConciliacion"
              checked={form.requiereConciliacion}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-gray-700 font-medium">Requiere conciliación bancaria</span>
          </label>
          <p className="text-sm text-gray-500 mt-2 ml-8">
            Marcar esta opción para cajas que reciben pagos con tarjeta u otros valores que se acreditan posteriormente.
            Los ingresos a esta caja quedarán pendientes de conciliar hasta que se verifiquen en el extracto bancario.
          </p>
        </div>

        {/* Estado */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-gray-700">Caja activa</span>
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Las cajas inactivas no pueden recibir movimientos ni transferencias
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/tesoreria/cajas')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Guardar Cambios' : 'Crear Caja'}
          </Button>
        </div>
      </form>
    </div>
  )
}
