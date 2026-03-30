import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminComercioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comercio, setComercio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const { showModal, ModalComponent } = useModal()

  const [form, setForm] = useState({
    descuentoPct: '',
    acumulacionActiva: false,
    acumComprasReq: '',
    acumPeriodoDias: '',
    acumDescuentoExtra: '',
  })

  useEffect(() => {
    cargarComercio()
  }, [id])

  async function cargarComercio() {
    try {
      const data = await api.get(`/admin/comercios/${id}`)
      setComercio(data)
      setForm({
        descuentoPct: data.descuentoPct || 10,
        acumulacionActiva: data.acumulacionActiva || false,
        acumComprasReq: data.acumComprasReq || 4,
        acumPeriodoDias: data.acumPeriodoDias || 7,
        acumDescuentoExtra: data.acumDescuentoExtra || 15,
      })
    } catch (err) {
      setError('Error al cargar comercio')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await api.patch(`/admin/comercios/${id}`, {
        descuentoPct: parseFloat(form.descuentoPct),
        acumulacionActiva: form.acumulacionActiva,
        acumComprasReq: parseInt(form.acumComprasReq),
        acumPeriodoDias: parseInt(form.acumPeriodoDias),
        acumDescuentoExtra: parseFloat(form.acumDescuentoExtra),
      })
      setSuccess('Cambios guardados correctamente')
    } catch (err) {
      setError('Error al guardar cambios')
    } finally {
      setSaving(false)
    }
  }

  async function reenviarLink() {
    try {
      await api.post(`/admin/comercios/${id}/reenviar-link`)
      showModal({
        type: 'success',
        title: 'Link reenviado',
        message: 'El link de acceso ha sido enviado al email del comercio.',
      })
    } catch (err) {
      showModal({
        type: 'error',
        message: 'Error al reenviar link',
      })
    }
  }

  function desactivar() {
    showModal({
      type: 'warning',
      title: 'Desactivar comercio',
      message: '¿Estás seguro de desactivar este comercio? Ya no podrá registrar ventas.',
      confirmText: 'Desactivar',
      showCancel: true,
      onConfirm: async () => {
        try {
          await api.post(`/admin/comercios/${id}/desactivar`)
          showModal({
            type: 'success',
            title: 'Comercio desactivado',
            message: 'El comercio ha sido desactivado.',
          })
          cargarComercio()
        } catch (err) {
          showModal({
            type: 'error',
            message: 'Error al desactivar comercio',
          })
        }
      },
    })
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!comercio) {
    return <Alert type="error">Comercio no encontrado</Alert>
  }

  const estadoColor = {
    PENDIENTE: 'bg-yellow-100 text-yellow-800',
    ACTIVO: 'bg-green-100 text-green-800',
    RECHAZADO: 'bg-red-100 text-red-800',
    INACTIVO: 'bg-gray-100 text-gray-800',
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{comercio.nombre}</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor[comercio.estado]}`}>
            {comercio.estado}
          </span>
        </div>
        <button
          onClick={() => navigate('/admin/comercios')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Volver
        </button>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}
      {success && <Alert type="success" className="mb-6">{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info del comercio */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Información</h2>
          <div className="space-y-3">
            <div>
              <span className="text-gray-500 text-sm">Dirección</span>
              <p className="text-gray-800">{comercio.direccion}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Rubro</span>
              <p className="text-gray-800">{comercio.rubro?.nombre}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Teléfono</span>
              <p className="text-gray-800">{comercio.telefono}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Email</span>
              <p className="text-gray-800">{comercio.email}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">CUIT</span>
              <p className="text-gray-800">{comercio.cuit}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Responsable</span>
              <p className="text-gray-800">{comercio.responsable}</p>
            </div>
          </div>

          {comercio.estado === 'ACTIVO' && (
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <Button variant="secondary" className="w-full" onClick={reenviarLink}>
                Reenviar link de acceso
              </Button>
              <button
                onClick={desactivar}
                className="w-full text-red-600 hover:text-red-800 py-2 text-sm"
              >
                Desactivar comercio
              </button>
            </div>
          )}
        </div>

        {/* Configuración de descuentos */}
        {comercio.estado === 'ACTIVO' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuración de Descuentos</h2>
            <form onSubmit={handleSave}>
              <Input
                label="Descuento base (%)"
                type="number"
                value={form.descuentoPct}
                onChange={(e) => setForm({ ...form, descuentoPct: e.target.value })}
                min="0"
                max="100"
              />

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.acumulacionActiva}
                    onChange={(e) => setForm({ ...form, acumulacionActiva: e.target.checked })}
                    className="w-5 h-5 text-primary rounded"
                  />
                  <span className="text-gray-700 font-medium">
                    Activar descuento por acumulación
                  </span>
                </label>
              </div>

              {form.acumulacionActiva && (
                <div className="pl-4 border-l-2 border-primary-light space-y-4">
                  <Input
                    label="Compras requeridas"
                    type="number"
                    value={form.acumComprasReq}
                    onChange={(e) => setForm({ ...form, acumComprasReq: e.target.value })}
                    min="1"
                  />
                  <Input
                    label="Período (días)"
                    type="number"
                    value={form.acumPeriodoDias}
                    onChange={(e) => setForm({ ...form, acumPeriodoDias: e.target.value })}
                    min="1"
                  />
                  <Input
                    label="Descuento extra (%)"
                    type="number"
                    value={form.acumDescuentoExtra}
                    onChange={(e) => setForm({ ...form, acumDescuentoExtra: e.target.value })}
                    min="0"
                    max="100"
                  />
                </div>
              )}

              <Button type="submit" className="w-full mt-6" loading={saving}>
                Guardar cambios
              </Button>
            </form>
          </div>
        )}

        {/* Stats del comercio */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Estadísticas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-800">{comercio.totalVentas || 0}</p>
              <p className="text-gray-500 text-sm">Total ventas</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                $ {(comercio.montoTotalVentas || 0).toLocaleString('es-AR')}
              </p>
              <p className="text-gray-500 text-sm">Monto total</p>
            </div>
          </div>
        </div>
      </div>

      {ModalComponent}
    </div>
  )
}
