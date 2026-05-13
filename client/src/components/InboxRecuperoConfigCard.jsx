import { useEffect, useState } from 'react'
import { Inbox, CheckCircle, XCircle, Save, Play } from 'lucide-react'
import api from '../services/api'
import { toast } from 'react-hot-toast'

/**
 * Tarjeta de configuración del polling IMAP para bandeja de respuestas de
 * campañas de recupero. Las credenciales (user/pass) caen por defecto a las
 * de SMTP si se dejan vacías.
 */
export default function InboxRecuperoConfigCard() {
  const [cfg, setCfg] = useState({
    enabled: false,
    host: '',
    port: '993',
    user: '',
    pass: '',
    secure: 'true',
  })
  const [cfgInicial, setCfgInicial] = useState(cfg)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [testeando, setTesteando] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState(null) // { tipo, mensaje }

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      setLoading(true)
      const claves = ['IMAP_ENABLED', 'IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS', 'IMAP_SECURE']
      const results = await Promise.all(
        claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null))
      )
      const map = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      const cargado = {
        enabled: map.IMAP_ENABLED === 'true',
        host: map.IMAP_HOST,
        port: map.IMAP_PORT || '993',
        user: map.IMAP_USER,
        pass: map.IMAP_PASS,
        secure: map.IMAP_SECURE || 'true',
      }
      setCfg(cargado)
      setCfgInicial(cargado)
    } catch (err) {
      console.error('Error cargando config IMAP:', err)
    } finally {
      setLoading(false)
    }
  }

  async function guardar() {
    setGuardando(true)
    try {
      const campos = [
        { clave: 'IMAP_ENABLED', valor: cfg.enabled ? 'true' : 'false', descripcion: 'Activar polling IMAP de respuestas' },
        { clave: 'IMAP_HOST', valor: cfg.host, descripcion: 'Servidor IMAP' },
        { clave: 'IMAP_PORT', valor: cfg.port, descripcion: 'Puerto IMAP (993 por defecto)' },
        { clave: 'IMAP_USER', valor: cfg.user, descripcion: 'Usuario IMAP (opcional, usa SMTP_USER si vacío)' },
        { clave: 'IMAP_PASS', valor: cfg.pass, descripcion: 'Contraseña IMAP (opcional, usa SMTP_PASS si vacío)' },
        { clave: 'IMAP_SECURE', valor: cfg.secure, descripcion: 'Usar TLS' },
      ]
      await Promise.all(campos.map(({ clave, valor, descripcion }) =>
        api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'EMAIL', descripcion })
      ))
      setCfgInicial(cfg)
      setResultado(null)
      toast.success('Configuración IMAP guardada')
    } catch (err) {
      toast.error(err.message || 'Error al guardar IMAP')
    } finally {
      setGuardando(false)
    }
  }

  async function testear() {
    setTesteando(true)
    setResultado(null)
    try {
      const r = await api.post('/admin/recupero/inbox/test')
      const mailboxes = r?.mailboxes || []
      setResultado({ tipo: 'ok', mensaje: `Conexión OK. Buzones: ${mailboxes.join(', ') || 'INBOX'}` })
    } catch (err) {
      setResultado({ tipo: 'error', mensaje: err.message || 'Error testeando IMAP' })
    } finally {
      setTesteando(false)
    }
  }

  async function ejecutarAhora() {
    setEjecutando(true)
    try {
      const r = await api.post('/admin/recupero/inbox/run')
      toast.success(`Procesado: ${r?.procesados || 0} respuesta(s), ${r?.errores || 0} error(es)`)
    } catch (err) {
      toast.error(err.message || 'Error ejecutando polling')
    } finally {
      setEjecutando(false)
    }
  }

  const modificado = JSON.stringify(cfg) !== JSON.stringify(cfgInicial)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px]">
      <div className="flex items-start gap-4 mb-4">
        <div className={`p-3 rounded-xl ${cfg.enabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Inbox className={`w-6 h-6 ${cfg.enabled ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">Bandeja de respuestas (IMAP)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Lee la casilla del club cada 5 minutos. Cuando un socio responde a una campaña de recupero, queda en "Respuestas pendientes".
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-700">Activar</span>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={e => setCfg({ ...cfg, enabled: e.target.checked })}
            className="w-4 h-4 text-primary rounded"
          />
        </label>
      </div>

      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Host *</label>
              <input
                type="text"
                value={cfg.host}
                onChange={e => setCfg({ ...cfg, host: e.target.value })}
                placeholder="imap.gmail.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Puerto</label>
              <input
                type="text"
                value={cfg.port}
                onChange={e => setCfg({ ...cfg, port: e.target.value })}
                placeholder="993"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Usuario <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={cfg.user}
                onChange={e => setCfg({ ...cfg, user: e.target.value })}
                placeholder="Si vacío, usa SMTP_USER"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contraseña <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="password"
                value={cfg.pass}
                onChange={e => setCfg({ ...cfg, pass: e.target.value })}
                placeholder="Si vacío, usa SMTP_PASS"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={cfg.secure === 'true'}
                  onChange={e => setCfg({ ...cfg, secure: e.target.checked ? 'true' : 'false' })}
                  className="w-4 h-4 text-primary rounded"
                />
                Usar TLS (recomendado, puerto 993)
              </label>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="font-medium text-gray-700 mb-1">Ejemplos de host:</p>
            <ul className="space-y-0.5">
              <li>• Gmail: <code className="bg-white px-1 rounded">imap.gmail.com:993</code> (requiere App Password)</li>
              <li>• Outlook/365: <code className="bg-white px-1 rounded">outlook.office365.com:993</code></li>
              <li>• Hostinger/cPanel: <code className="bg-white px-1 rounded">mail.tudominio.com:993</code></li>
            </ul>
          </div>

          {resultado && (
            <div className={`flex items-start gap-2 text-sm mb-3 ${resultado.tipo === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
              {resultado.tipo === 'ok'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span className="break-words">{resultado.mensaje}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={ejecutarAhora}
              disabled={ejecutando || modificado || !cfg.enabled}
              title={modificado ? 'Guardá los cambios antes' : 'Ejecutar el polling ahora'}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ejecutando
                ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Play className="w-4 h-4" />}
              Ejecutar ahora
            </button>
            <button
              type="button"
              onClick={testear}
              disabled={testeando || !cfg.host || modificado}
              title={modificado ? 'Guardá los cambios antes de testear' : ''}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testeando
                ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Inbox className="w-4 h-4" />}
              Testear
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !modificado}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {guardando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
