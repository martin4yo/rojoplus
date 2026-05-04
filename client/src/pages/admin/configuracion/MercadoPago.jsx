import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CreditCard, Save, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import PageHeader from '../../../components/PageHeader'
import LoadingSpinner from '../../../components/LoadingSpinner'
import Switch from '../../../components/Switch'
import api from '../../../services/api'

export default function ConfiguracionMercadoPago() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(null)
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [modoTest, setModoTest] = useState(false)
  const [editandoToken, setEditandoToken] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true)
      const c = await api.get('/admin/pagos/mercadopago')
      setConfig(c)
      setPublicKey(c.publicKey || '')
      setModoTest(!!c.modoTest)
      setEditandoToken(!c.configurado) // Si no hay token, abrimos el editor por default
    } catch (err) {
      toast.error(err.message || 'Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }

  async function guardarToken() {
    if (!accessTokenInput || !accessTokenInput.trim()) {
      toast.error('El access token está vacío')
      return
    }
    if (!accessTokenInput.startsWith('TEST-') && !accessTokenInput.startsWith('APP_USR-')) {
      toast.error('El access token debe empezar con TEST- (prueba) o APP_USR- (producción)')
      return
    }
    try {
      setSaving(true)
      await api.put('/admin/pagos/mercadopago', { accessToken: accessTokenInput })
      toast.success('Access token guardado')
      setAccessTokenInput('')
      setEditandoToken(false)
      cargar()
    } catch (err) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  async function eliminarToken() {
    if (!confirm('¿Eliminar el access token? La integración con MP del tenant dejará de funcionar.')) return
    try {
      await api.put('/admin/pagos/mercadopago', { accessToken: '' })
      toast.success('Access token eliminado')
      setAccessTokenInput('')
      setEditandoToken(true)
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function guardarOtros() {
    try {
      setSaving(true)
      await api.put('/admin/pagos/mercadopago', { publicKey, modoTest })
      toast.success('Configuración guardada')
      cargar()
    } catch (err) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-8"><LoadingSpinner /></div>

  const tokenPrefijo = config?.tokenPrefijo
  const enModoProduccion = tokenPrefijo === 'APP_USR'
  const enModoTest = tokenPrefijo === 'TEST'

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <PageHeader
        icon={CreditCard}
        title="Mercado Pago"
        subtitle="Configuración global del tenant para todos los pagos por Mercado Pago"
      />

      {/* Estado actual */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          {config?.configurado ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500" />
          )}
          <h3 className="font-bold">
            {config?.configurado ? 'Mercado Pago configurado' : 'Sin configurar'}
          </h3>
          {enModoProduccion && (
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700 rounded">PRODUCCIÓN</span>
          )}
          {enModoTest && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700 rounded">PRUEBA</span>
          )}
        </div>

        {!config?.configurado && config?.tieneFallbackEnv && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 text-sm">
            Mientras no configures un token propio, el sistema usa el del archivo <code>.env</code> global.
          </div>
        )}

        {/* Access Token */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Access Token</label>
            {config?.configurado && !editandoToken && (
              <div className="flex gap-2 items-center">
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{config.tokenMasked}</code>
                <button onClick={() => setEditandoToken(true)} className="text-xs underline text-blue-600">Cambiar</button>
                <button onClick={eliminarToken} className="text-xs underline text-red-600">Eliminar</button>
              </div>
            )}
          </div>
          {editandoToken && (
            <div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessTokenInput}
                  onChange={e => setAccessTokenInput(e.target.value)}
                  className="input-field w-full pr-10 font-mono text-sm"
                  placeholder="TEST-1234567890... o APP_USR-1234567890..."
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Conseguilo en <a href="https://www.mercadopago.com.ar/developers/panel/credentials" target="_blank" rel="noreferrer" className="underline">mercadopago.com.ar/developers/panel/credentials</a>.
                Empieza con <code>TEST-</code> para pruebas o <code>APP_USR-</code> para producción.
              </p>
              <div className="flex gap-2 mt-3">
                <Button onClick={guardarToken} disabled={saving || !accessTokenInput}>
                  <Save className="w-4 h-4" /> Guardar token
                </Button>
                {config?.configurado && (
                  <Button variant="secondary" onClick={() => { setEditandoToken(false); setAccessTokenInput('') }}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Public Key */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Public Key</label>
          <input
            type="text"
            value={publicKey}
            onChange={e => setPublicKey(e.target.value)}
            className="input-field w-full font-mono text-sm"
            placeholder="TEST-pubKey... o APP_USR-pubKey..."
          />
          <p className="text-xs text-muted mt-1">Se usa para integraciones de checkout embebido (Bricks). Opcional.</p>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t">
          <Switch
            checked={modoTest}
            onChange={setModoTest}
            onLabel="Modo prueba activo"
            offLabel="Modo producción"
          />
          <div className="text-xs text-muted">
            <strong>Aclaración:</strong> el modo lo determina el token (TEST- vs APP_USR-).
            Esta etiqueta es informativa para que el sistema sepa qué muestra al usuario.
          </div>
        </div>

        <div className="pt-3 border-t flex justify-end">
          <Button onClick={guardarOtros} disabled={saving}>
            <Save className="w-4 h-4" /> Guardar
          </Button>
        </div>
      </div>

      <div className="card p-5 bg-gray-50">
        <h3 className="font-bold mb-2 text-sm">Cómo conseguir credenciales de prueba</h3>
        <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
          <li>Entrá a <a href="https://www.mercadopago.com.ar/developers/panel/test-users" target="_blank" rel="noreferrer" className="underline text-blue-600">developers/panel/test-users</a> con tu cuenta MP</li>
          <li>Creá 2 usuarios de prueba: uno será el "vendedor" del club, otro será un "comprador" para testear</li>
          <li>Iniciá sesión con el usuario VENDEDOR de prueba en MP</li>
          <li>Copiá su access token (<code>TEST-...</code>) acá</li>
          <li>Para testear: paga con la cuenta del usuario COMPRADOR de prueba (logueado en otra ventana)</li>
          <li>Tarjeta de prueba: <code>5031 7557 3453 0604</code> · CVV 123 · 11/30 · titular <code>APRO</code></li>
        </ol>
      </div>
    </div>
  )
}
