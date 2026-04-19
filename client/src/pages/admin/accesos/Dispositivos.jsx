import { useState, useEffect } from 'react'
import {
  DoorOpen, Plus, Edit, Trash2, KeyRound, Copy, Check, Eye, EyeOff,
  AlertTriangle, Radio, CircleDot, X, Info
} from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import LoadingSpinner from '../../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { useConfirm } from '../../../hooks/useConfirm'

const formInicial = {
  codigo: '',
  nombre: '',
  ubicacion: '',
  tiempoApertura: 3,
  modoOffline: true,
  intervaloSync: 5,
  activo: true
}

export default function Dispositivos() {
  const [dispositivos, setDispositivos] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalForm, setModalForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formInicial)
  const [submitting, setSubmitting] = useState(false)

  const [modalToken, setModalToken] = useState(null)
  const [tokenVisible, setTokenVisible] = useState(false)
  const [tokenCopiado, setTokenCopiado] = useState(false)

  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => { cargar() }, [])

  const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
    'Content-Type': 'application/json'
  })

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accesos/dispositivos', { headers: authHeaders() })
      const data = await res.json()
      if (data.success) setDispositivos(data.data || [])
      else toast.error(data.error || 'Error cargando dispositivos')
    } catch (err) {
      toast.error('Error de red')
    } finally {
      setLoading(false)
    }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm(formInicial)
    setModalForm(true)
  }

  const abrirEditar = (d) => {
    setEditando(d)
    setForm({
      codigo: d.codigo || '',
      nombre: d.nombre || '',
      ubicacion: d.ubicacion || '',
      tiempoApertura: d.tiempoApertura ?? 3,
      modoOffline: d.modoOffline ?? true,
      intervaloSync: d.intervaloSync ?? 5,
      activo: d.activo ?? true
    })
    setModalForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        tiempoApertura: form.tiempoApertura === '' ? undefined : parseInt(form.tiempoApertura),
        intervaloSync: form.intervaloSync === '' ? undefined : parseInt(form.intervaloSync)
      }

      const url = editando ? `/api/accesos/dispositivos/${editando.id}` : '/api/accesos/dispositivos'
      const method = editando ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        toast.success(editando ? 'Dispositivo actualizado' : 'Dispositivo creado')
        setModalForm(false)
        cargar()
      } else {
        toast.error(data.error || 'Error guardando')
      }
    } catch (err) {
      toast.error('Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEliminar = async (d) => {
    const ok = await confirm(
      'Eliminar dispositivo',
      `¿Seguro que querés eliminar "${d.nombre}"? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    try {
      const res = await fetch(`/api/accesos/dispositivos/${d.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Dispositivo eliminado')
        cargar()
      } else {
        toast.error(data.error || 'Error eliminando')
      }
    } catch {
      toast.error('Error de red')
    }
  }

  const handleGenerarToken = async (d) => {
    const tieneYa = d.tieneToken
    const ok = tieneYa
      ? await confirm(
          'Regenerar token',
          `"${d.nombre}" ya tiene un token. Regenerarlo invalida el actual y requiere actualizar config.json del molinete-service. ¿Continuar?`
        )
      : true
    if (!ok) return

    try {
      const res = await fetch(`/api/accesos/dispositivos/${d.id}/regenerar-token`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (data.success) {
        setTokenVisible(false)
        setTokenCopiado(false)
        setModalToken(data.data)
        cargar()
      } else {
        toast.error(data.error || 'Error generando token')
      }
    } catch {
      toast.error('Error de red')
    }
  }

  const handleRevocarToken = async (d) => {
    const ok = await confirm(
      'Revocar token',
      `¿Revocar el token de "${d.nombre}"? El dispositivo dejará de poder autenticarse en el cloud hasta que generes uno nuevo.`
    )
    if (!ok) return
    try {
      const res = await fetch(`/api/accesos/dispositivos/${d.id}/revocar-token`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Token revocado')
        cargar()
      } else {
        toast.error(data.error || 'Error revocando')
      }
    } catch {
      toast.error('Error de red')
    }
  }

  const copiarToken = async () => {
    if (!modalToken) return
    try {
      await navigator.clipboard.writeText(modalToken.apiToken)
      setTokenCopiado(true)
      toast.success('Token copiado al portapapeles')
      setTimeout(() => setTokenCopiado(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const formatUltimoPing = (fecha) => {
    if (!fecha) return 'Nunca'
    const d = new Date(fecha)
    return d.toLocaleString('es-AR')
  }

  const pingStatus = (fecha) => {
    if (!fecha) return 'offline'
    const diff = Date.now() - new Date(fecha).getTime()
    if (diff < 2 * 60 * 1000) return 'online'
    if (diff < 15 * 60 * 1000) return 'warning'
    return 'offline'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <DoorOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dispositivos de Acceso</h1>
            <p className="text-gray-500 text-sm">{dispositivos.length} dispositivos registrados</p>
          </div>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Dispositivo
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : dispositivos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DoorOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay dispositivos registrados</p>
            <p className="text-sm mt-1">Creá uno para que el molinete-service pueda autenticarse.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600 w-10"></th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Código</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden md:table-cell">Ubicación</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 hidden lg:table-cell">Último ping</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Token</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dispositivos.map(d => {
                  const status = pingStatus(d.ultimoPing)
                  const dotClass = status === 'online'
                    ? 'text-green-500'
                    : status === 'warning' ? 'text-yellow-500' : 'text-gray-400'
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center">
                        <CircleDot className={`w-4 h-4 inline ${dotClass}`} />
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{d.codigo}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{d.nombre}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{d.ubicacion}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell">{formatUltimoPing(d.ultimoPing)}</td>
                      <td className="px-4 py-3 text-center">
                        {d.tieneToken ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            <KeyRound className="w-3 h-3" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                            <AlertTriangle className="w-3 h-3" /> Sin token
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.activo ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Activo</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleGenerarToken(d)}
                            title={d.tieneToken ? 'Regenerar token' : 'Generar token'}
                            className="p-2 rounded-md hover:bg-indigo-50 text-indigo-600"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {d.tieneToken && (
                            <button
                              onClick={() => handleRevocarToken(d)}
                              title="Revocar token"
                              className="p-2 rounded-md hover:bg-amber-50 text-amber-600"
                            >
                              <Radio className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => abrirEditar(d)}
                            title="Editar"
                            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(d)}
                            title="Eliminar"
                            className="p-2 rounded-md hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {modalForm && (
        <Modal
          isOpen={modalForm}
          onClose={() => setModalForm(false)}
          title={editando ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p>
                  Este formulario define la <strong>identidad lógica</strong> del dispositivo en el cloud.
                  La configuración de hardware (lectores USB, puertos RFID, relay del molinete) vive en
                  el archivo <code className="bg-white px-1 rounded">config.json</code> del servicio
                  <code className="bg-white px-1 rounded">molinete-service</code> instalado en el PC del club.
                </p>
                <p className="mt-1">
                  Después de crear el dispositivo, usá el botón de llave <KeyRound className="w-3 h-3 inline" /> en
                  la tabla para generar su API Token.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  value={form.codigo}
                  onChange={e => setForm({ ...form, codigo: e.target.value })}
                  className="input-field w-full"
                  placeholder="molinete-entrada-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="input-field w-full"
                  placeholder="Molinete Entrada Principal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación *</label>
              <input
                type="text"
                required
                value={form.ubicacion}
                onChange={e => setForm({ ...form, ubicacion: e.target.value })}
                className="input-field w-full"
                placeholder="Entrada calle Tucumán"
              />
            </div>

            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-3">Parámetros de negocio (el molinete los consulta del cloud)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo apertura (s)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.tiempoApertura}
                    onChange={e => setForm({ ...form, tiempoApertura: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo sync (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.intervaloSync}
                    onChange={e => setForm({ ...form, intervaloSync: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  <div className="flex items-center gap-2">
                    <input
                      id="modoOffline"
                      type="checkbox"
                      checked={form.modoOffline}
                      onChange={e => setForm({ ...form, modoOffline: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="modoOffline" className="text-sm font-medium text-gray-700">Modo offline</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="activo"
                      type="checkbox"
                      checked={form.activo}
                      onChange={e => setForm({ ...form, activo: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="activo" className="text-sm font-medium text-gray-700">Activo</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <Button variant="secondary" type="button" onClick={() => setModalForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {editando ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal token generado */}
      {modalToken && (
        <Modal
          isOpen={!!modalToken}
          onClose={() => setModalToken(null)}
          title="Token generado"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Copiá este token ahora.</p>
                <p>No se va a volver a mostrar. Si lo perdés, vas a tener que regenerarlo.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {modalToken.nombre} <span className="font-mono text-gray-500">({modalToken.codigo})</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 break-all">
                  {tokenVisible ? modalToken.apiToken : modalToken.apiToken.replace(/./g, '•')}
                </div>
                <button
                  type="button"
                  onClick={() => setTokenVisible(v => !v)}
                  className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                  title={tokenVisible ? 'Ocultar' : 'Mostrar'}
                >
                  {tokenVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={copiarToken}
                  className="p-2 rounded-md hover:bg-indigo-50 text-indigo-600"
                  title="Copiar"
                >
                  {tokenCopiado ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="font-semibold mb-1">Para configurar el molinete-service:</p>
              <p>Pegá este token en <code className="bg-white px-1 rounded">config.json</code> bajo:</p>
              <pre className="mt-2 text-xs bg-white rounded p-2 border border-gray-200">{`"tenant": {
  "slug": "<subdomain-del-club>",
  "apiToken": "${tokenVisible ? modalToken.apiToken : '<token-copiado>'}"
}`}</pre>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setModalToken(null)}>
                <X className="w-4 h-4 mr-2" />
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog />
    </div>
  )
}
