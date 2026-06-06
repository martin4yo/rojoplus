import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Settings, Store } from 'lucide-react'
import { Button } from '../../../components/Button'
import PageHeader from '../../../components/PageHeader'
import LoadingSpinner from '../../../components/LoadingSpinner'
import Switch from '../../../components/Switch'
import api from '../../../services/api'

const CAMPOS = [
  { clave: 'TIENDA_HABILITADA',         label: 'Tienda activa',           tipo: 'BOOLEAN', help: 'Si está apagada, la URL pública /tienda no muestra productos' },
  { clave: 'TIENDA_TITULO_HERO',        label: 'Título del hero',         tipo: 'STRING',  help: 'Texto principal grande de la tienda (ej: "Tienda")' },
  { clave: 'TIENDA_SUBTITULO_HERO',     label: 'Subtítulo del hero',      tipo: 'STRING',  help: 'Texto secundario debajo del título' },
  { clave: 'TIENDA_CAJA_ID',            label: 'Caja contable (ID)',      tipo: 'INT',     help: 'ID numérico de la caja donde imputan los pagos' },
  { clave: 'TIENDA_MEDIO_PAGO_MP_ID',   label: 'Medio de pago MP (ID)',   tipo: 'INT',     help: 'ID del medio de pago "Mercado Pago Online"' },
  { clave: 'TIENDA_RESERVA_TTL_MIN',    label: 'TTL reserva de stock (min)', tipo: 'INT', help: 'Minutos durante los cuales se reserva el stock mientras el comprador paga' },
  { clave: 'TIENDA_PERMITIR_INVITADOS', label: 'Permitir compra como invitado', tipo: 'BOOLEAN', help: 'Si se desactiva, el comprador debe registrarse antes' },
  { clave: 'TIENDA_RETIRO_DIRECCION',   label: 'Dirección de retiro',     tipo: 'STRING',  help: 'Dónde el comprador retira el pedido' },
  { clave: 'TIENDA_RETIRO_HORARIOS',    label: 'Horarios de retiro',      tipo: 'STRING',  help: 'Texto libre con los horarios' },
]

export default function Configuracion() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [valores, setValores] = useState({})
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      setLoading(true)
      const [cfg, cajasData, mpData] = await Promise.all([
        api.get('/admin/tienda/configuracion'),
        api.get('/admin/cajas?activo=true').catch(() => []),
        api.get('/admin/medios-pago?activo=true').catch(() => []),
      ])
      const map = {}
      for (const r of cfg.raw || []) map[r.clave] = r.valor
      setValores(map)
      setCajas((Array.isArray(cajasData) ? cajasData : (cajasData?.data || [])).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })))
      setMediosPago(Array.isArray(mpData) ? mpData : (mpData?.data || []))
    } catch (err) {
      toast.error('No se pudo cargar la configuración')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function setValor(clave, valor) {
    setValores(v => ({ ...v, [clave]: valor }))
  }

  async function guardar() {
    try {
      setSaving(true)
      const body = {}
      for (const c of CAMPOS) {
        let v = valores[c.clave]
        if (v === undefined || v === null) v = ''
        body[c.clave] = String(v)
      }
      await api.put('/admin/tienda/configuracion', body)
      toast.success('Configuración guardada')
    } catch (err) {
      toast.error(err.message || 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8"><LoadingSpinner /></div>

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <PageHeader
        icon={Store}
        title="Tienda — Configuración"
        subtitle="Parámetros generales del módulo"
      />

      <div className="card space-y-5 p-6">
        {CAMPOS.map(campo => (
          <div key={campo.clave} className="grid md:grid-cols-3 gap-2 md:gap-4 items-start">
            <div>
              <div className="font-medium text-sm">{campo.label}</div>
              <div className="text-xs text-muted">{campo.help}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-50 mt-1">{campo.clave}</div>
            </div>
            <div className="md:col-span-2">
              {campo.tipo === 'BOOLEAN' ? (
                <Switch
                  checked={valores[campo.clave] === 'true'}
                  onChange={v => setValor(campo.clave, v ? 'true' : 'false')}
                  onLabel="Activada"
                  offLabel="Desactivada"
                />
              ) : campo.clave === 'TIENDA_CAJA_ID' ? (
                <select
                  className="input-field w-full"
                  value={valores[campo.clave] || ''}
                  onChange={e => setValor(campo.clave, e.target.value)}
                >
                  <option value="">— Seleccionar caja —</option>
                  {cajas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              ) : campo.clave === 'TIENDA_MEDIO_PAGO_MP_ID' ? (
                <select
                  className="input-field w-full"
                  value={valores[campo.clave] || ''}
                  onChange={e => setValor(campo.clave, e.target.value)}
                >
                  <option value="">— Seleccionar medio de pago —</option>
                  {mediosPago.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              ) : campo.tipo === 'INT' ? (
                <input
                  type="number"
                  className="input-field w-full"
                  value={valores[campo.clave] || ''}
                  onChange={e => setValor(campo.clave, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="input-field w-full"
                  value={valores[campo.clave] || ''}
                  onChange={e => setValor(campo.clave, e.target.value)}
                />
              )}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t flex justify-end">
          <Button onClick={guardar} disabled={saving}>
            <Settings className="w-4 h-4" /> Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  )
}
