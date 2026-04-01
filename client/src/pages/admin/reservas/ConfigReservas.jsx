import { useState, useEffect } from 'react'
import { Settings, Plus, Save, Trash2, Globe, MapPin, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { formatCurrency } from '../../../utils/formatters'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useConfirm } from '../../../hooks/useConfirm'

const CAMPOS_CONFIG = [
  { key: 'duracionSlotMin', label: 'Duración del slot', tipo: 'number', sufijo: 'min', min: 15, max: 480 },
  { key: 'cuposSimultaneos', label: 'Cupos simultáneos', tipo: 'number', sufijo: '', min: 1, max: 100 },
  { key: 'anticipacionMinHs', label: 'Anticipación mínima', tipo: 'number', sufijo: 'hs', min: 0, max: 72 },
  { key: 'anticipacionMaxDias', label: 'Anticipación máxima', tipo: 'number', sufijo: 'días', min: 1, max: 365 },
  { key: 'politicaCancelacionHs', label: 'Cancelación gratuita hasta', tipo: 'number', sufijo: 'hs antes', min: 0, max: 168 },
]

const DEFAULT_FORM = {
  espacioId: null,
  modoPrecio: 'FIJO',
  precioBase: '',
  precioSocio: '',
  precioNoSocio: '',
  descuentoSocioPorc: 0,
  duracionSlotMin: 60,
  cuposSimultaneos: 1,
  anticipacionMinHs: 2,
  anticipacionMaxDias: 30,
  politicaCancelacionHs: 24,
  permiteCancelacionOnline: true,
  activo: true,
}

export default function ConfigReservas() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [configs, setConfigs] = useState([])
  const [espacios, setEspacios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // id de config | 'nuevo'
  const [form, setForm] = useState(DEFAULT_FORM)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [cfgs, esps] = await Promise.all([
        api.get('/reservas/admin/config'),
        api.get('/reservas/espacios'),
      ])
      setConfigs(cfgs || [])
      setEspacios(esps || [])
    } catch {
      toast.error('Error al cargar configuraciones')
    } finally {
      setLoading(false)
    }
  }

  function abrirNuevo() {
    setForm({ ...DEFAULT_FORM })
    setEditando('nuevo')
  }

  function abrirEditar(cfg) {
    setForm({
      ...DEFAULT_FORM,
      ...cfg,
      espacioId: cfg.espacioId || null,
      precioBase: cfg.precioBase ?? '',
      precioSocio: cfg.precioSocio ?? '',
      precioNoSocio: cfg.precioNoSocio ?? '',
      descuentoSocioPorc: cfg.descuentoSocioPorc ?? 0,
    })
    setEditando(cfg.id)
  }

  function cerrar() {
    setEditando(null)
    setForm(DEFAULT_FORM)
  }

  async function guardar() {
    setGuardando(true)
    try {
      const payload = {
        ...form,
        espacioId: form.espacioId ? parseInt(form.espacioId) : null,
        precioBase: form.precioBase !== '' ? parseFloat(form.precioBase) : null,
        precioSocio: form.precioSocio !== '' ? parseFloat(form.precioSocio) : null,
        precioNoSocio: form.precioNoSocio !== '' ? parseFloat(form.precioNoSocio) : null,
        descuentoSocioPorc: parseInt(form.descuentoSocioPorc) || 0,
        duracionSlotMin: parseInt(form.duracionSlotMin),
        cuposSimultaneos: parseInt(form.cuposSimultaneos),
        anticipacionMinHs: parseInt(form.anticipacionMinHs),
        anticipacionMaxDias: parseInt(form.anticipacionMaxDias),
        politicaCancelacionHs: parseInt(form.politicaCancelacionHs),
      }

      if (editando === 'nuevo') {
        await api.post('/reservas/admin/config', payload)
        toast.success('Configuración creada')
      } else {
        await api.put(`/reservas/admin/config/${editando}`, payload)
        toast.success('Configuración actualizada')
      }
      cerrar()
      cargarDatos()
    } catch (e) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const espacioNombre = (id) => espacios.find(e => e.id === id)?.nombre || '–'

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>

  return (
    <div className="space-y-4">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Reservas</h1>
          <p className="text-sm text-gray-500 mt-1">Precios, slots y políticas por espacio</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium"
        >
          <Plus size={16} /> Nueva config
        </button>
      </div>

      {/* Cards de configs */}
      {configs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <Settings size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">No hay configuraciones. Creá una para habilitar reservas.</p>
          <button onClick={abrirNuevo} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition">
            Crear primera config
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map(cfg => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              espacioNombre={espacioNombre(cfg.espacioId)}
              onEditar={() => abrirEditar(cfg)}
            />
          ))}
        </div>
      )}

      {/* Modal formulario */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editando === 'nuevo' ? 'Nueva Configuración' : 'Editar Configuración'}
              </h2>
            </div>

            <div className="p-6 space-y-5">

              {/* Alcance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alcance</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, espacioId: null }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-medium transition ${!form.espacioId ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <Globe size={14} /> Global (todos los espacios)
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, espacioId: espacios[0]?.id || null }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 text-sm font-medium transition ${form.espacioId ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <MapPin size={14} /> Espacio específico
                  </button>
                </div>
                {form.espacioId && (
                  <select
                    value={form.espacioId || ''}
                    onChange={e => setForm(f => ({ ...f, espacioId: e.target.value }))}
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Seleccionar espacio...</option>
                    {espacios.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                )}
              </div>

              {/* Slots y cupos */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Disponibilidad</label>
                <div className="grid grid-cols-2 gap-3">
                  {CAMPOS_CONFIG.map(({ key, label, tipo, sufijo, min, max }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type={tipo}
                          min={min}
                          max={max}
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {sufijo && <span className="text-xs text-gray-500 whitespace-nowrap">{sufijo}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Precios</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setForm(f => ({ ...f, modoPrecio: 'FIJO' }))}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${form.modoPrecio === 'FIJO' ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    Precios fijos
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, modoPrecio: 'DESCUENTO_PORCENTAJE' }))}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${form.modoPrecio === 'DESCUENTO_PORCENTAJE' ? 'border-primary bg-primary-50 text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    % Descuento socio
                  </button>
                </div>

                {form.modoPrecio === 'FIJO' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio público ($)</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={form.precioNoSocio}
                        onChange={e => setForm(f => ({ ...f, precioNoSocio: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio socio ($)</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={form.precioSocio}
                        onChange={e => setForm(f => ({ ...f, precioSocio: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio base ($)</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={form.precioBase}
                        onChange={e => setForm(f => ({ ...f, precioBase: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Descuento socio (%)</label>
                      <input
                        type="number" min={0} max={100}
                        value={form.descuentoSocioPorc}
                        onChange={e => setForm(f => ({ ...f, descuentoSocioPorc: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Preview de precios */}
                {((form.modoPrecio === 'FIJO' && form.precioNoSocio) || (form.modoPrecio === 'DESCUENTO_PORCENTAJE' && form.precioBase)) && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Público:</span>
                      <span className="font-medium">{formatCurrency(form.modoPrecio === 'FIJO' ? form.precioNoSocio : form.precioBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Socio:</span>
                      <span className="font-medium text-green-700">
                        {form.modoPrecio === 'FIJO'
                          ? formatCurrency(form.precioSocio || form.precioNoSocio)
                          : formatCurrency(parseFloat(form.precioBase || 0) * (1 - (form.descuentoSocioPorc || 0) / 100))
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cancelación online */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-gray-700">Cancelación online</div>
                  <div className="text-xs text-gray-500">El reservante puede cancelar sin llamar</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, permiteCancelacionOnline: !f.permiteCancelacionOnline }))}
                  className={`w-10 h-6 rounded-full transition ${form.permiteCancelacionOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${form.permiteCancelacionOnline ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-gray-700">Configuración activa</div>
                  <div className="text-xs text-gray-500">Si está inactiva no se aplica al espacio</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={`w-10 h-6 rounded-full transition ${form.activo ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${form.activo ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Footer */}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <button onClick={cerrar} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition text-sm font-medium disabled:opacity-50"
                >
                  <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigCard({ config, espacioNombre, onEditar }) {
  const esGlobal = !config.espacioId

  const precioPublico = config.modoPrecio === 'FIJO'
    ? parseFloat(config.precioNoSocio || 0)
    : parseFloat(config.precioBase || 0)
  const precioSocio = config.modoPrecio === 'FIJO'
    ? parseFloat(config.precioSocio || config.precioNoSocio || 0)
    : parseFloat(config.precioBase || 0) * (1 - (config.descuentoSocioPorc || 0) / 100)

  return (
    <div className={`bg-white rounded-xl border-2 p-5 space-y-3 ${config.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {esGlobal ? <Globe size={15} className="text-gray-400" /> : <MapPin size={15} className="text-primary" />}
            <span className="font-semibold text-gray-800">{esGlobal ? 'Config global' : espacioNombre}</span>
          </div>
          {!config.activo && <span className="text-xs text-gray-400 mt-0.5 block">Inactiva</span>}
        </div>
        <button onClick={onEditar} className="text-xs text-primary hover:underline font-medium">Editar</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">Slot</div>
        <div className="font-medium">{config.duracionSlotMin} min</div>
        <div className="text-gray-500">Cupos</div>
        <div className="font-medium">{config.cuposSimultaneos}</div>
        <div className="text-gray-500">Precio público</div>
        <div className="font-medium">{formatCurrency(precioPublico)}</div>
        <div className="text-gray-500">Precio socio</div>
        <div className="font-medium text-green-700">{formatCurrency(precioSocio)}</div>
        <div className="text-gray-500">Cancelación</div>
        <div className="font-medium">{config.politicaCancelacionHs}hs antes</div>
        <div className="text-gray-500">Cancel. online</div>
        <div>{config.permiteCancelacionOnline
          ? <span className="text-green-600 font-medium">✓ Sí</span>
          : <span className="text-gray-400">No</span>}
        </div>
      </div>
    </div>
  )
}
