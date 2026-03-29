import { useState, useEffect } from 'react'
import { CreditCard, Save, Loader } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function ConfiguracionPagos() {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [config, setConfig] = useState({
    PAGO_CBU: '',
    PAGO_ALIAS: '',
    PAGO_TELEFONO: '',
    PAGO_TITULAR: '',
  })

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  async function cargarConfiguracion() {
    setLoading(true)
    try {
      const data = await api.get('/admin/sistema/configuracion')

      const configMap = {}
      data?.forEach(item => {
        if (item.clave.startsWith('PAGO_')) {
          configMap[item.clave] = item.valor
        }
      })

      setConfig(prev => ({ ...prev, ...configMap }))
    } catch (err) {
      setError('Error al cargar la configuración')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function guardarConfiguracion(e) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setSuccess(null)

    try {
      // Guardar cada configuración por separado
      await Promise.all([
        api.put('/admin/sistema/configuracion/PAGO_CBU', { valor: config.PAGO_CBU }),
        api.put('/admin/sistema/configuracion/PAGO_ALIAS', { valor: config.PAGO_ALIAS }),
        api.put('/admin/sistema/configuracion/PAGO_TELEFONO', { valor: config.PAGO_TELEFONO }),
        api.put('/admin/sistema/configuracion/PAGO_TITULAR', { valor: config.PAGO_TITULAR }),
      ])

      setSuccess('Configuración guardada correctamente')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración de Pagos</h1>
        </div>
        <p className="text-gray-600">Datos bancarios para transferencias desde el portal del socio</p>
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {/* Formulario */}
      <form onSubmit={guardarConfiguracion} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titular de la cuenta *
            </label>
            <input
              type="text"
              value={config.PAGO_TITULAR}
              onChange={e => setConfig({ ...config, PAGO_TITULAR: e.target.value })}
              className="input-field w-full"
              placeholder="Club Sportivo Pilar"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CBU *
            </label>
            <input
              type="text"
              value={config.PAGO_CBU}
              onChange={e => setConfig({ ...config, PAGO_CBU: e.target.value })}
              className="input-field w-full font-mono"
              placeholder="0000000000000000000000"
              maxLength="22"
              required
            />
            <p className="text-xs text-gray-500 mt-1">22 dígitos</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alias *
            </label>
            <input
              type="text"
              value={config.PAGO_ALIAS}
              onChange={e => setConfig({ ...config, PAGO_ALIAS: e.target.value })}
              className="input-field w-full"
              placeholder="sportivo.pilar"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Los socios pueden copiar este alias para hacer la transferencia</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teléfono / WhatsApp *
            </label>
            <input
              type="text"
              value={config.PAGO_TELEFONO}
              onChange={e => setConfig({ ...config, PAGO_TELEFONO: e.target.value })}
              className="input-field w-full"
              placeholder="+54 9 11 0000-0000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Número al cual los socios pueden enviar el comprobante</p>
          </div>

          {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
            <div className="pt-4 border-t border-gray-200">
              <Button type="submit" loading={guardando} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Información adicional */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">¿Dónde se usa esta información?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>En el Portal del Socio, sección "Pagos"</li>
          <li>Los socios pueden ver estos datos para realizar transferencias</li>
          <li>Incluye un botón para copiar el alias fácilmente</li>
          <li>Permite informar el pago y subir el comprobante</li>
        </ul>
      </div>
    </div>
  )
}
