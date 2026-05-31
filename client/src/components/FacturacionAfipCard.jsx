import { useEffect, useState } from 'react'
import { Zap, Plus, Edit2, Trash2, CheckCircle, XCircle, Upload, PlayCircle, Star } from 'lucide-react'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import { Button } from './Button'
import { useModal } from './Modal'

/**
 * Tarjeta de configuración de Facturación Electrónica AFIP.
 * - Conexiones AFIP: lista, crear, editar, eliminar, test, subir cert/key.
 * - Puntos de Venta: lista, crear, editar, eliminar (vinculan a una conexión).
 */
export default function FacturacionAfipCard() {
  const { showModal, ModalComponent } = useModal()
  const [conexiones, setConexiones] = useState([])
  const [puntosVenta, setPuntosVenta] = useState([])
  const [loading, setLoading] = useState(true)

  const [editandoConexion, setEditandoConexion] = useState(null) // null | 'new' | {id, ...}
  const [editandoPV, setEditandoPV] = useState(null)
  const [subiendoCertId, setSubiendoCertId] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [conexRes, pvRes] = await Promise.all([
        api.getFull('/admin/afip-connections'),
        api.getFull('/admin/puntos-venta')
      ])
      setConexiones(conexRes.data || [])
      setPuntosVenta(pvRes.data || [])
    } catch (err) {
      toast.error('Error cargando configuración AFIP')
    } finally {
      setLoading(false)
    }
  }

  async function testConexion(c) {
    const t = toast.loading(`Probando conexión "${c.nombre}"...`)
    try {
      // El endpoint responde { success, mensaje, pasos } en el nivel superior
      // (no envuelto en { data }), por eso usamos postFull para leerlo directo.
      const r = await api.postFull(`/admin/afip-connections/${c.id}/test`)
      toast.dismiss(t)
      if (r?.success) toast.success(`OK: ${r.mensaje}`)
      else toast.error(`Falló: ${r?.mensaje || 'sin detalle'}`)
      cargar()
    } catch (err) {
      toast.dismiss(t)
      toast.error(err.message || 'Error al probar')
    }
  }

  async function eliminarConexion(c) {
    showModal({
      type: 'confirm',
      title: 'Eliminar conexión',
      message: `¿Eliminar la conexión "${c.nombre}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/afip-connections/${c.id}`)
          toast.success('Conexión eliminada')
          cargar()
        } catch (err) {
          toast.error(err.message)
        }
      }
    })
  }

  async function eliminarPV(pv) {
    showModal({
      type: 'confirm',
      title: 'Eliminar punto de venta',
      message: `¿Eliminar PV ${pv.numero} - ${pv.nombre}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/puntos-venta/${pv.id}`)
          toast.success('Punto de venta eliminado')
          cargar()
        } catch (err) {
          toast.error(err.message)
        }
      }
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px]">
      {ModalComponent}
      <div className="flex items-start gap-4 mb-4">
        <div className="p-3 rounded-xl bg-blue-100">
          <Zap className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">Facturación Electrónica AFIP</h3>
          <p className="text-sm text-gray-500 mt-1">Conexiones AFIP y puntos de venta</p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-4">Cargando...</div>
      ) : (
        <>
          {/* CONEXIONES AFIP */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 text-sm">Conexiones AFIP</h4>
              <Button size="sm" variant="secondary" onClick={() => setEditandoConexion('new')}>
                <Plus className="w-4 h-4 mr-1" /> Nueva
              </Button>
            </div>
            {conexiones.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded">Sin conexiones configuradas</p>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Nombre</th>
                      <th className="text-left px-3 py-2">CUIT</th>
                      <th className="text-left px-3 py-2">Ambiente</th>
                      <th className="text-left px-3 py-2">Cert</th>
                      <th className="text-left px-3 py-2">Test</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {conexiones.map(c => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {c.esDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" title="Default" />}
                            <span className={c.activo ? '' : 'text-gray-400 line-through'}>{c.nombre}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{c.cuit}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${c.environment === 'PRODUCTION' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {c.environment === 'PRODUCTION' ? 'PROD' : 'TEST'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {c.certificadoPath ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {c.lastTestStatus === 'success' && <span className="text-green-600">✓ OK</span>}
                          {c.lastTestStatus === 'error' && <span className="text-red-600" title={c.lastTestMessage}>✗ Error</span>}
                          {!c.lastTestStatus && <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => testConexion(c)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Probar conexión">
                              <PlayCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setSubiendoCertId(c.id)} className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Subir certificado">
                              <Upload className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditandoConexion(c)} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => eliminarConexion(c)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PUNTOS DE VENTA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 text-sm">Puntos de Venta</h4>
              <Button size="sm" variant="secondary" onClick={() => setEditandoPV('new')} disabled={conexiones.length === 0}>
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </div>
            {puntosVenta.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded">
                {conexiones.length === 0 ? 'Primero cree una conexión AFIP' : 'Sin puntos de venta configurados'}
              </p>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Nro</th>
                      <th className="text-left px-3 py-2">Nombre</th>
                      <th className="text-left px-3 py-2">Conexión AFIP</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {puntosVenta.map(pv => (
                      <tr key={pv.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono">{String(pv.numero).padStart(4, '0')}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {pv.esDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" title="Default" />}
                            <span className={pv.activo ? '' : 'text-gray-400 line-through'}>{pv.nombre}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {pv.afipConnection?.nombre} <span className="text-gray-400">({pv.afipConnection?.cuit})</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setEditandoPV(pv)} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => eliminarPV(pv)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modales */}
      {editandoConexion && (
        <ConexionModal
          conexion={editandoConexion === 'new' ? null : editandoConexion}
          onClose={() => setEditandoConexion(null)}
          onSaved={() => { setEditandoConexion(null); cargar() }}
        />
      )}
      {editandoPV && (
        <PVModal
          punto={editandoPV === 'new' ? null : editandoPV}
          conexiones={conexiones.filter(c => c.activo)}
          onClose={() => setEditandoPV(null)}
          onSaved={() => { setEditandoPV(null); cargar() }}
        />
      )}
      {subiendoCertId && (
        <CertUploadModal
          conexionId={subiendoCertId}
          onClose={() => setSubiendoCertId(null)}
          onSaved={() => { setSubiendoCertId(null); cargar() }}
        />
      )}
    </div>
  )
}

// =============================================================================
// MODAL CONEXIÓN AFIP
// =============================================================================
function ConexionModal({ conexion, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: conexion?.nombre || '',
    descripcion: conexion?.descripcion || '',
    cuit: conexion?.cuit || '',
    environment: conexion?.environment || 'TESTING',
    wsaaUrl: conexion?.wsaaUrl || '',
    wsfeUrl: conexion?.wsfeUrl || '',
    activo: conexion?.activo ?? true,
    esDefault: conexion?.esDefault || false,
  })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!form.nombre || !form.cuit) {
      toast.error('Nombre y CUIT son requeridos')
      return
    }
    if (!/^\d{11}$/.test(form.cuit)) {
      toast.error('El CUIT debe tener 11 dígitos')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        wsaaUrl: form.wsaaUrl || null,
        wsfeUrl: form.wsfeUrl || null,
      }
      if (conexion) {
        await api.patch(`/admin/afip-connections/${conexion.id}`, payload)
        toast.success('Conexión actualizada')
      } else {
        await api.post('/admin/afip-connections', payload)
        toast.success('Conexión creada')
      }
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">{conexion ? 'Editar conexión' : 'Nueva conexión AFIP'}</h3>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="input-field w-full" placeholder="Ej: Razón Social Principal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} className="input-field w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CUIT *</label>
              <input type="text" value={form.cuit} onChange={e => setForm({...form, cuit: e.target.value.replace(/\D/g, '').slice(0, 11)})} className="input-field w-full font-mono" placeholder="20123456789" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ambiente</label>
              <select value={form.environment} onChange={e => setForm({...form, environment: e.target.value})} className="input-field w-full">
                <option value="TESTING">Homologación (Testing)</option>
                <option value="PRODUCTION">Producción</option>
              </select>
            </div>
          </div>
          <details className="text-xs">
            <summary className="text-gray-500 cursor-pointer">URLs avanzadas (dejar vacío para usar default)</summary>
            <div className="mt-2 space-y-2">
              <input type="text" placeholder="WSAA URL (opcional)" value={form.wsaaUrl} onChange={e => setForm({...form, wsaaUrl: e.target.value})} className="input-field w-full text-xs" />
              <input type="text" placeholder="WSFE URL (opcional)" value={form.wsfeUrl} onChange={e => setForm({...form, wsfeUrl: e.target.value})} className="input-field w-full text-xs" />
            </div>
          </details>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />
              <span>Activo</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.esDefault} onChange={e => setForm({...form, esDefault: e.target.checked})} />
              <span>Default</span>
            </label>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MODAL PUNTO DE VENTA
// =============================================================================
function PVModal({ punto, conexiones, onClose, onSaved }) {
  const [form, setForm] = useState({
    numero: punto?.numero || '',
    nombre: punto?.nombre || '',
    descripcion: punto?.descripcion || '',
    afipConnectionId: punto?.afipConnectionId || (conexiones.find(c => c.esDefault)?.id || conexiones[0]?.id || ''),
    activo: punto?.activo ?? true,
    esDefault: punto?.esDefault || false,
  })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!form.numero || !form.nombre || !form.afipConnectionId) {
      toast.error('Número, nombre y conexión son requeridos')
      return
    }
    setSaving(true)
    try {
      if (punto) {
        await api.patch(`/admin/puntos-venta/${punto.id}`, form)
        toast.success('Punto de venta actualizado')
      } else {
        await api.post('/admin/puntos-venta', form)
        toast.success('Punto de venta creado')
      }
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">{punto ? 'Editar punto de venta' : 'Nuevo punto de venta'}</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número *</label>
              <input type="number" min="1" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} className="input-field w-full font-mono" placeholder="1" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="input-field w-full" placeholder="Casa Central" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Conexión AFIP *</label>
            <select value={form.afipConnectionId} onChange={e => setForm({...form, afipConnectionId: parseInt(e.target.value)})} className="input-field w-full">
              <option value="">Seleccionar...</option>
              {conexiones.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} — {c.cuit} ({c.environment})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />
              <span>Activo</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.esDefault} onChange={e => setForm({...form, esDefault: e.target.checked})} />
              <span>Default</span>
            </label>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MODAL UPLOAD CERTIFICADO
// =============================================================================
function CertUploadModal({ conexionId, onClose, onSaved }) {
  const [cert, setCert] = useState('')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function leerArchivo(file, setter) {
    const text = await file.text()
    setter(text)
  }

  async function subir() {
    if (!cert || !key) {
      toast.error('Faltan certificado o clave privada')
      return
    }
    setSaving(true)
    try {
      await api.post(`/admin/afip-connections/${conexionId}/certificado`, {
        certificado: cert,
        clavePrivada: key,
      })
      toast.success('Certificado guardado')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Subir certificado AFIP</h3>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Certificado (.crt)</label>
            <input type="file" accept=".crt,.pem" onChange={e => e.target.files[0] && leerArchivo(e.target.files[0], setCert)} className="text-sm" />
            {cert && <p className="text-xs text-green-600 mt-1">✓ {cert.length} chars cargados</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Clave privada (.key)</label>
            <input type="file" accept=".key,.pem" onChange={e => e.target.files[0] && leerArchivo(e.target.files[0], setKey)} className="text-sm" />
            {key && <p className="text-xs text-green-600 mt-1">✓ {key.length} chars cargados</p>}
          </div>
          <p className="text-xs text-gray-500">Los archivos se guardarán en el servidor como cert_&lt;id&gt;_&lt;cuit&gt;.crt y key_&lt;id&gt;_&lt;cuit&gt;.key</p>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={subir} disabled={saving || !cert || !key}>{saving ? 'Subiendo...' : 'Subir'}</Button>
        </div>
      </div>
    </div>
  )
}
