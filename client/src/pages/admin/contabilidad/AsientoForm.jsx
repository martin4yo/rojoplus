import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, BookOpen, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function AsientoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cuentas, setCuentas] = useState([])

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    lineas: [
      { cuentaContableId: '', descripcion: '', debe: '', haber: '' },
      { cuentaContableId: '', descripcion: '', debe: '', haber: '' }
    ]
  })

  useEffect(() => {
    cargarCuentas()
    if (isEditing) {
      cargarAsiento()
    }
  }, [id])

  async function cargarCuentas() {
    try {
      const res = await api.getFull('/admin/cuentas-contables?esImputable=true&activo=true&flat=true')
      setCuentas(res.data || [])
    } catch (err) {
      console.error('Error cargando cuentas:', err)
    }
  }

  async function cargarAsiento() {
    try {
      setLoading(true)
      const res = await api.getFull(`/admin/asientos/${id}`)
      const asiento = res.data
      setForm({
        fecha: asiento.fecha.split('T')[0],
        concepto: asiento.concepto,
        lineas: asiento.lineas.map(l => ({
          id: l.id,
          cuentaContableId: l.cuentaContableId.toString(),
          descripcion: l.descripcion || '',
          debe: l.debe ? Number(l.debe).toString() : '',
          haber: l.haber ? Number(l.haber).toString() : ''
        }))
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function addLinea() {
    setForm({
      ...form,
      lineas: [
        ...form.lineas,
        { cuentaContableId: '', descripcion: '', debe: '', haber: '' }
      ]
    })
  }

  function removeLinea(index) {
    if (form.lineas.length <= 2) {
      showModal({
        type: 'warning',
        message: 'Un asiento debe tener al menos 2 líneas'
      })
      return
    }
    setForm({
      ...form,
      lineas: form.lineas.filter((_, i) => i !== index)
    })
  }

  function updateLinea(index, field, value) {
    const newLineas = [...form.lineas]
    newLineas[index] = { ...newLineas[index], [field]: value }

    // Si se ingresa en debe, limpiar haber y viceversa
    if (field === 'debe' && value) {
      newLineas[index].haber = ''
    } else if (field === 'haber' && value) {
      newLineas[index].debe = ''
    }

    setForm({ ...form, lineas: newLineas })
  }

  const totalDebe = form.lineas.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0)
  const totalHaber = form.lineas.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0)
  const diferencia = Math.abs(totalDebe - totalHaber)
  const balanceado = diferencia < 0.01

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validaciones
    if (!form.concepto.trim()) {
      setError('El concepto es requerido')
      return
    }

    const lineasValidas = form.lineas.filter(l =>
      l.cuentaContableId && (parseFloat(l.debe) || parseFloat(l.haber))
    )

    if (lineasValidas.length < 2) {
      setError('Un asiento debe tener al menos 2 líneas con cuenta y monto')
      return
    }

    if (!balanceado) {
      setError('El asiento no está balanceado. Debe = Haber')
      return
    }

    setSaving(true)
    try {
      const payload = {
        fecha: form.fecha,
        concepto: form.concepto,
        lineas: lineasValidas.map((l, idx) => ({
          cuentaContableId: parseInt(l.cuentaContableId),
          descripcion: l.descripcion || null,
          debe: parseFloat(l.debe) || 0,
          haber: parseFloat(l.haber) || 0,
          orden: idx + 1
        }))
      }

      if (isEditing) {
        await api.put(`/admin/asientos/${id}`, payload)
      } else {
        await api.post('/admin/asientos', payload)
      }

      navigate('/admin/contabilidad/asientos')
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/contabilidad/asientos"
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Asiento' : 'Nuevo Asiento'}
            </h1>
            <p className="text-sm text-gray-500">Partida doble</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Datos del Asiento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto *
              </label>
              <input
                type="text"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                className="input-field w-full"
                placeholder="Ej: Pago de servicios, Cobranza cuota, etc."
                required
              />
            </div>
          </div>
        </div>

        {/* Líneas del asiento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Líneas del Asiento</h2>
            <Button type="button" variant="secondary" onClick={addLinea}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Línea
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase py-2 px-2 w-[40%]">
                    Cuenta Contable
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase py-2 px-2 w-[20%]">
                    Descripción
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase py-2 px-2 w-[15%]">
                    Debe
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase py-2 px-2 w-[15%]">
                    Haber
                  </th>
                  <th className="text-center text-xs font-semibold text-gray-600 uppercase py-2 px-2 w-[10%]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.lineas.map((linea, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 px-2">
                      <select
                        value={linea.cuentaContableId}
                        onChange={(e) => updateLinea(index, 'cuentaContableId', e.target.value)}
                        className="input-field w-full text-sm"
                      >
                        <option value="">Seleccionar cuenta...</option>
                        {cuentas.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.codigo} - {c.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={linea.descripcion}
                        onChange={(e) => updateLinea(index, 'descripcion', e.target.value)}
                        className="input-field w-full text-sm"
                        placeholder="Detalle opcional"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={linea.debe}
                        onChange={(e) => updateLinea(index, 'debe', e.target.value)}
                        className="input-field w-full text-right text-sm"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={linea.haber}
                        onChange={(e) => updateLinea(index, 'haber', e.target.value)}
                        className="input-field w-full text-right text-sm"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLinea(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar línea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="py-3 px-2 text-right">
                    Totales:
                  </td>
                  <td className="py-3 px-2 text-right text-green-600">
                    {formatMoney(totalDebe)}
                  </td>
                  <td className="py-3 px-2 text-right text-red-600">
                    {formatMoney(totalHaber)}
                  </td>
                  <td></td>
                </tr>
                {!balanceado && (
                  <tr className="bg-yellow-50">
                    <td colSpan={2} className="py-2 px-2 text-right text-yellow-700 text-sm">
                      Diferencia:
                    </td>
                    <td colSpan={2} className="py-2 px-2 text-center text-yellow-700 font-semibold">
                      {formatMoney(diferencia)}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Indicador de balance */}
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
            balanceado ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>
            {balanceado ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">Asiento balanceado</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  El asiento no está balanceado. Diferencia: {formatMoney(diferencia)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <Link to="/admin/contabilidad/asientos">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" loading={saving} disabled={!balanceado}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Guardar Cambios' : 'Crear Asiento'}
          </Button>
        </div>
      </form>

      {ModalComponent}
    </div>
  )
}
