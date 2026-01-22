import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

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
}

export default function ConfiguracionForm() {
  const { tabla, id } = useParams()
  const navigate = useNavigate()
  const isEditing = id && id !== 'nuevo'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [conceptosTesoreria, setConceptosTesoreria] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])

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
    conceptoTesoreriaId: '',
    // categorias-socio
    porcentajeDescuento: 0,
    // estados-socio
    permiteDescuentos: true,
    // conceptos-tesoreria
    tipo: 'INGRESO',
    usaEnCompras: false,
    usaEnVentas: false,
    usaEnTesoreria: true,
    cuentaContableId: '',
    // descuentos-disponibles
    porcentaje: '',
  })

  useEffect(() => {
    if (tabla === 'tipos-socio') {
      cargarConceptosTesoreria()
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
        conceptoTesoreriaId: data.conceptoTesoreriaId || '',
        porcentajeDescuento: data.porcentajeDescuento || 0,
        permiteDescuentos: data.permiteDescuentos !== false,
        // conceptos-tesoreria
        tipo: data.tipo || 'INGRESO',
        usaEnCompras: data.usaEnCompras || false,
        usaEnVentas: data.usaEnVentas || false,
        usaEnTesoreria: data.usaEnTesoreria !== false,
        cuentaContableId: data.cuentaContableId ? String(data.cuentaContableId) : '',
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
      }

      if (tabla === 'conceptos-tesoreria') {
        datos.tipo = form.tipo
        datos.usaEnCompras = form.usaEnCompras
        datos.usaEnVentas = form.usaEnVentas
        datos.usaEnTesoreria = form.usaEnTesoreria
        datos.cuentaContableId = form.cuentaContableId ? parseInt(form.cuentaContableId) : null
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

      if (isEditing) {
        await api.put(`/admin/${tabla}/${id}`, datos)
      } else {
        await api.post(`/admin/${tabla}`, datos)
      }

      navigate(`/admin/configuracion/${tabla}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuota Mensual</label>
                  <input
                    type="number"
                    value={form.cuotaMensual}
                    onChange={e => setForm({ ...form, cuotaMensual: e.target.value })}
                    className="input-field w-full"
                    step="0.01"
                    placeholder="Ej: 15000"
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
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <input
                type="checkbox"
                id="permiteDescuentos"
                checked={form.permiteDescuentos}
                onChange={e => setForm({ ...form, permiteDescuentos: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="permiteDescuentos" className="text-sm text-green-800">
                Permite usar descuentos en comercios (RojoPlus)
              </label>
            </div>
          )}

          {/* Campos específicos para conceptos-tesoreria */}
          {tabla === 'conceptos-tesoreria' && (
            <>
              {/* Tipo de concepto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="flex gap-2">
                  {['INGRESO', 'EGRESO', 'AMBOS'].map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setForm({ ...form, tipo, cuentaContableId: '' })}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition ${
                        form.tipo === tipo
                          ? tipo === 'INGRESO'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : tipo === 'EGRESO'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {tipo === 'INGRESO' ? 'Ingreso' : tipo === 'EGRESO' ? 'Egreso' : 'Ambos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usar en */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usar en</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.usaEnTesoreria}
                      onChange={e => setForm({ ...form, usaEnTesoreria: e.target.checked })}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">Tesorería</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.usaEnCompras}
                      onChange={e => setForm({ ...form, usaEnCompras: e.target.checked })}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">Compras</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.usaEnVentas}
                      onChange={e => setForm({ ...form, usaEnVentas: e.target.checked })}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">Ventas</span>
                  </label>
                </div>
              </div>

              {/* Cuenta Contable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta Contable (opcional)
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
                      <option key={c.id} value={c.id}>
                        {c.codigo} - {c.nombre}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Vincula a una cuenta del plan de cuentas para reportes contables
                </p>
              </div>
            </>
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

          {/* Color del badge (no para conceptos-tesoreria, descuentos-disponibles ni rubros) */}
          {tabla !== 'conceptos-tesoreria' && tabla !== 'descuentos-disponibles' && tabla !== 'rubros' && (
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
        </form>
      </div>
    </div>
  )
}
