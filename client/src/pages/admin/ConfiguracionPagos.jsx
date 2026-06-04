import { useState, useEffect } from 'react'
import { CreditCard, Save, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import Switch from '../../components/Switch'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function ConfiguracionPagos() {
  const [loading, setLoading] = useState(true)
  const [savingMP, setSavingMP] = useState(false)
  const [savingTransferencia, setSavingTransferencia] = useState(false)

  // MercadoPago
  const [mpConfig, setMpConfig] = useState(null)
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [editandoToken, setEditandoToken] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [modoTest, setModoTest] = useState(false)
  const [cajaDefaultId, setCajaDefaultId] = useState('')
  const [nombreComercio, setNombreComercio] = useState('')

  // Transferencia bancaria
  const [transferencia, setTransferencia] = useState({
    PAGO_CBU: '',
    PAGO_ALIAS: '',
    PAGO_TELEFONO: '',
    PAGO_TITULAR: '',
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [mp, confList] = await Promise.all([
        api.get('/admin/configuracion/mercadopago'),
        api.get('/admin/sistema/configuracion'),
      ])
      setMpConfig(mp)
      setPublicKey(mp.publicKey || '')
      setModoTest(!!mp.modoTest)
      setCajaDefaultId(mp.cajaDefaultId ? String(mp.cajaDefaultId) : '')
      setNombreComercio(mp.nombreComercio || '')
      setEditandoToken(!mp.configurado)

      const map = {}
      confList?.forEach(item => { if (item.clave.startsWith('PAGO_')) map[item.clave] = item.valor })
      setTransferencia(prev => ({ ...prev, ...map }))
    } catch (err) {
      toast.error('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  async function guardarToken() {
    if (!accessTokenInput.trim()) { toast.error('El access token está vacío'); return }
    if (!accessTokenInput.startsWith('TEST-') && !accessTokenInput.startsWith('APP_USR-')) {
      toast.error('El access token debe empezar con TEST- (prueba) o APP_USR- (producción)')
      return
    }
    try {
      setSavingMP(true)
      await api.put('/admin/configuracion/mercadopago', { accessToken: accessTokenInput })
      toast.success('Access token guardado')
      setAccessTokenInput('')
      setEditandoToken(false)
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally { setSavingMP(false) }
  }

  async function eliminarToken() {
    if (!confirm('¿Eliminar el access token? La integración con MercadoPago dejará de funcionar.')) return
    try {
      await api.put('/admin/configuracion/mercadopago', { accessToken: '' })
      toast.success('Access token eliminado')
      setAccessTokenInput('')
      setEditandoToken(true)
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  async function guardarConfigMP() {
    try {
      setSavingMP(true)
      await api.put('/admin/configuracion/mercadopago', {
        publicKey,
        modoTest,
        nombreComercio,
        cajaDefaultId: cajaDefaultId ? parseInt(cajaDefaultId) : null,
      })
      toast.success('Configuración de MercadoPago guardada')
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally { setSavingMP(false) }
  }

  async function guardarTransferencia(e) {
    e.preventDefault()
    try {
      setSavingTransferencia(true)
      await Promise.all([
        api.put('/admin/sistema/configuracion/PAGO_CBU', { valor: transferencia.PAGO_CBU, modulo: 'PAGOS' }),
        api.put('/admin/sistema/configuracion/PAGO_ALIAS', { valor: transferencia.PAGO_ALIAS, modulo: 'PAGOS' }),
        api.put('/admin/sistema/configuracion/PAGO_TELEFONO', { valor: transferencia.PAGO_TELEFONO, modulo: 'PAGOS' }),
        api.put('/admin/sistema/configuracion/PAGO_TITULAR', { valor: transferencia.PAGO_TITULAR, modulo: 'PAGOS' }),
      ])
      toast.success('Datos bancarios guardados')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar')
    } finally { setSavingTransferencia(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>

  const tokenPrefijo = mpConfig?.tokenPrefijo
  const enProduccion = tokenPrefijo === 'APP_USR'
  const enTest = tokenPrefijo === 'TEST'

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        icon={CreditCard}
        title="Configuración de Pagos"
        subtitle="Medios de pago disponibles en el portal del socio"
      />

      {/* ── MercadoPago ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            {mpConfig?.configurado
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            }
            <div>
              <h2 className="font-semibold text-gray-800">MercadoPago</h2>
              <p className="text-sm text-gray-500">Pago online con tarjeta, débito y billeteras virtuales</p>
            </div>
          </div>
          {enProduccion && <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">PRODUCCIÓN</span>}
          {enTest && <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">PRUEBA</span>}
        </div>

        <div className="p-6 space-y-6">

          {/* Access Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Access Token</label>
              {mpConfig?.configurado && !editandoToken && (
                <div className="flex gap-3 items-center">
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{mpConfig.tokenMasked}</code>
                  <button onClick={() => setEditandoToken(true)} className="text-xs text-blue-600 hover:underline">Cambiar</button>
                  <button onClick={eliminarToken} className="text-xs text-red-600 hover:underline">Eliminar</button>
                </div>
              )}
            </div>

            {!mpConfig?.configurado && mpConfig?.tieneFallbackEnv && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 text-sm text-blue-800 rounded">
                Usando el token del <code>.env</code> global. Configurá uno propio acá para sobrescribirlo.
              </div>
            )}

            {editandoToken && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={accessTokenInput}
                    onChange={e => setAccessTokenInput(e.target.value)}
                    className="input-field w-full pr-10 font-mono"
                    placeholder="TEST-... o APP_USR-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Conseguilo en{' '}
                  <a href="https://www.mercadopago.com.ar/developers/panel/credentials" target="_blank" rel="noreferrer" className="underline text-blue-600">
                    mercadopago.com.ar → Desarrolladores → Credenciales
                  </a>.
                  Empieza con <code>TEST-</code> para pruebas o <code>APP_USR-</code> para producción.
                </p>
                <div className="flex gap-2">
                  <Button onClick={guardarToken} loading={savingMP} disabled={!accessTokenInput}>
                    <Save className="w-4 h-4 mr-1" /> Guardar token
                  </Button>
                  {mpConfig?.configurado && (
                    <Button variant="secondary" onClick={() => { setEditandoToken(false); setAccessTokenInput('') }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Nombre en checkout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la institución en el checkout
            </label>
            <input
              type="text"
              value={nombreComercio}
              onChange={e => setNombreComercio(e.target.value)}
              className="input-field w-full"
              placeholder="Club Sportivo Pilar"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              Texto que el socio ve en el checkout de MP. Si lo dejás vacío se usa el nombre del tenant.
            </p>
            {nombreComercio && (
              <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden text-sm">
                <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Vista previa</div>
                <div className="p-3 space-y-2 bg-white">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-36 shrink-0">Título del pago:</span>
                    <span className="font-medium text-gray-800">{nombreComercio} — Cuota Social</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-36 shrink-0">Descripción:</span>
                    <span className="text-gray-700">Cuota 06/2026 · {nombreComercio}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-36 shrink-0">Resumen tarjeta:</span>
                    <span className="font-mono text-gray-700">
                      {nombreComercio.toUpperCase().slice(0, 22)}
                      {nombreComercio.length > 22 && <span className="text-orange-500 ml-1 text-xs">(truncado a 22 chars)</span>}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Public Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
            <input
              type="text"
              value={publicKey}
              onChange={e => setPublicKey(e.target.value)}
              className="input-field w-full font-mono"
              placeholder="TEST-... o APP_USR-..."
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">Clave pública para checkout embebido (Bricks). Opcional.</p>
          </div>

          {/* Modo prueba */}
          <div className="flex items-start gap-3">
            <Switch checked={modoTest} onChange={setModoTest} onLabel="Modo prueba activo" offLabel="Modo producción" />
            <p className="text-xs text-gray-500 mt-0.5">
              El modo real lo determina el token (TEST- vs APP_USR-). Esta etiqueta es informativa.
            </p>
          </div>

          {/* Caja destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Caja destino de los pagos MP</label>
            <select value={cajaDefaultId} onChange={e => setCajaDefaultId(e.target.value)} className="input-field w-full">
              <option value="">— Sin asignar —</option>
              {(mpConfig?.cajas || []).map(c => {
                const ids = [c.mpStoreId, c.mpPosId].filter(Boolean).join('/')
                return (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.codigo ? ` (${c.codigo})` : ''}{ids ? ` — MP ${ids}` : ''}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Caja donde se acreditan los pagos de cuotas por MP. Configurá Store/POS por caja en <strong>Tesorería → Cajas</strong>.
            </p>
          </div>

          {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
            <div className="pt-2">
              <Button onClick={guardarConfigMP} loading={savingMP}>
                <Save className="w-4 h-4 mr-2" /> Guardar configuración MP
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Transferencia bancaria ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Transferencia bancaria</h2>
          <p className="text-sm text-gray-500">Datos para que el socio transfiera y suba el comprobante</p>
        </div>

        <form onSubmit={guardarTransferencia} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Titular de la cuenta *</label>
            <input
              type="text"
              value={transferencia.PAGO_TITULAR}
              onChange={e => setTransferencia({ ...transferencia, PAGO_TITULAR: e.target.value })}
              className="input-field w-full"
              placeholder="Club Sportivo Pilar"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CBU *</label>
            <input
              type="text"
              value={transferencia.PAGO_CBU}
              onChange={e => setTransferencia({ ...transferencia, PAGO_CBU: e.target.value })}
              className="input-field w-full font-mono"
              placeholder="0000000000000000000000"
              maxLength="22"
              required
            />
            <p className="text-xs text-gray-500 mt-1">22 dígitos</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alias *</label>
            <input
              type="text"
              value={transferencia.PAGO_ALIAS}
              onChange={e => setTransferencia({ ...transferencia, PAGO_ALIAS: e.target.value })}
              className="input-field w-full"
              placeholder="sportivo.pilar"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Los socios pueden copiar este alias para transferir</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono / WhatsApp *</label>
            <input
              type="text"
              value={transferencia.PAGO_TELEFONO}
              onChange={e => setTransferencia({ ...transferencia, PAGO_TELEFONO: e.target.value })}
              className="input-field w-full"
              placeholder="+54 9 11 0000-0000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Número al que los socios envían el comprobante</p>
          </div>

          {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
            <Button type="submit" loading={savingTransferencia}>
              <Save className="w-4 h-4 mr-2" /> Guardar datos bancarios
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
