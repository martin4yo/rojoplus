import { useState, useEffect } from 'react'
import { Wallet, Plus, Trash2, Loader2, X, ArrowDownCircle, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/Button'
import Modal from '../../../components/Modal'
import Switch from '../../../components/Switch'
import api from '../../../services/api'
import { formatCurrency, formatDate } from '../../../utils/formatters'
import { useConfirm } from '../../../hooks/useConfirm'
import toast from 'react-hot-toast'

const ORIGEN_LABEL = {
  ATENCION_CLUB: 'Atención del club',
  DEVOLUCION: 'Devolución',
  AJUSTE: 'Ajuste',
  PAGO_PARCIAL: 'Pago parcial',
  ANULACION_PAGO: 'Anulación de pago',
}

export default function SaldoFavorTab({ socioId, socioNombre }) {
  const [data, setData] = useState({ saldos: [], totalDisponible: 0, totalOriginal: 0, totalAplicado: 0 })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  useEffect(() => { cargar() }, [socioId])

  async function cargar() {
    setLoading(true)
    try {
      const res = await api.get(`/admin/socios/${socioId}/saldos-favor`)
      setData(res || { saldos: [], totalDisponible: 0, totalOriginal: 0, totalAplicado: 0 })
    } catch (err) {
      toast.error('Error cargando saldos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function anularSaldo(saldo) {
    const ok = await confirm(
      'Anular saldo a favor',
      `¿Anular el saldo de ${formatCurrency(saldo.montoOriginal)} (${saldo.motivo || ORIGEN_LABEL[saldo.origen] || saldo.origen})?`,
      { confirmText: 'Anular', variant: 'danger' }
    )
    if (!ok) return
    try {
      await api.delete(`/admin/socios/${socioId}/saldos-favor/${saldo.id}`)
      toast.success('Saldo anulado')
      cargar()
    } catch (err) {
      toast.error(err.message || 'Error al anular')
    }
  }

  return (
    <div>
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-green-700 mb-1">Saldo disponible</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(data.totalDisponible)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total acreditado</p>
          <p className="text-2xl font-bold text-gray-700">{formatCurrency(data.totalOriginal)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-blue-700 mb-1">Aplicado a pagos</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(data.totalAplicado)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Movimientos de saldo</h3>
        <Button type="button" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Acreditar saldo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
      ) : data.saldos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>El socio no tiene saldos a favor</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Origen</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Motivo</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Acreditado</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Disponible</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.saldos.map(s => {
                const aplicado = s.montoOriginal - s.montoDisponible
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDate(s.fecha)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                        {ORIGEN_LABEL[s.origen] || s.origen}
                      </span>
                      {s.movimientoCajaEgreso && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Egreso #{s.movimientoCajaEgreso.numero} ({s.movimientoCajaEgreso.caja?.nombre})
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-gray-800">{s.motivo || '-'}</p>
                      {s.observaciones && <p className="text-xs text-gray-500 mt-0.5">{s.observaciones}</p>}
                      {aplicado > 0 && (
                        <p className="text-[10px] text-blue-600 mt-0.5">Aplicado: {formatCurrency(aplicado)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{formatCurrency(s.montoOriginal)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap font-bold ${s.montoDisponible > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatCurrency(s.montoDisponible)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.aplicaciones.length === 0 && (
                        <button
                          type="button"
                          onClick={() => anularSaldo(s)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Anular"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AcreditarSaldoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        socioId={socioId}
        socioNombre={socioNombre}
        onCreated={() => { setModalOpen(false); cargar() }}
      />
      <ConfirmDialog />
    </div>
  )
}

function AcreditarSaldoModal({ isOpen, onClose, socioId, socioNombre, onCreated }) {
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [conEgreso, setConEgreso] = useState(false)
  const [cajas, setCajas] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [cajaId, setCajaId] = useState('')
  const [medioPagoId, setMedioPagoId] = useState('')
  const [cuentaContableId, setCuentaContableId] = useState('')
  const [centroCostoId, setCentroCostoId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setMonto(''); setMotivo(''); setObservaciones('')
      setConEgreso(false); setCajaId(''); setMedioPagoId('')
      setCuentaContableId(''); setCentroCostoId('')
      setError(null)
      return
    }
    cargarAuxiliares()
  }, [isOpen])

  async function cargarAuxiliares() {
    try {
      const [cajasData, mediosData, cuentasData] = await Promise.all([
        api.get('/admin/cajas?activo=true'),
        api.get('/admin/medios-pago?activo=true'),
        api.getFull('/admin/cuentas-contables?flat=true&esImputable=true&activo=true'),
      ])
      setCajas(cajasData || [])
      setMediosPago((mediosData || []).filter(m => m.paraCaja !== false))
      setCuentas(cuentasData?.data || [])
    } catch (err) {
      setError('Error cargando datos: ' + err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const montoNum = parseFloat(monto)
    if (!montoNum || montoNum <= 0) return setError('Monto inválido')
    if (!motivo.trim()) return setError('El motivo es obligatorio')
    if (conEgreso && (!cajaId || !medioPagoId || !cuentaContableId)) {
      return setError('Para registrar egreso completá caja, medio de pago y cuenta contable')
    }

    setGuardando(true)
    try {
      let movimientoCajaEgresoId = null

      if (conEgreso) {
        // 1) Crear el egreso de caja
        const egreso = await api.post('/admin/movimientos-caja', {
          cajaId: parseInt(cajaId),
          tipo: 'EGRESO',
          monto: montoNum,
          medioPagoId: parseInt(medioPagoId),
          cuentaContableId: parseInt(cuentaContableId),
          centroCostoId: centroCostoId ? parseInt(centroCostoId) : undefined,
          concepto: `Saldo a favor - ${socioNombre}`,
          descripcion: motivo + (observaciones ? ` - ${observaciones}` : ''),
          socioId,
        })
        movimientoCajaEgresoId = egreso?.id || egreso?.data?.id
        if (!movimientoCajaEgresoId) throw new Error('No se pudo crear el egreso de caja')
      }

      // 2) Crear el saldo a favor (con o sin link al egreso)
      await api.post(`/admin/socios/${socioId}/saldos-favor`, {
        monto: montoNum,
        motivo: motivo.trim(),
        observaciones: observaciones.trim() || undefined,
        origen: conEgreso ? 'DEVOLUCION' : 'ATENCION_CLUB',
        movimientoCajaEgresoId,
      })

      toast.success('Saldo a favor acreditado')
      onCreated()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acreditar saldo a favor" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Socio: <strong>{socioNombre}</strong>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="input-field w-full"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Atención del club, devolución cuota X"
            className="input-field w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows="2"
            className="input-field w-full"
          />
        </div>

        {/* Switch egreso */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <ArrowDownCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-gray-800">Devolución en efectivo</label>
                <p className="text-xs text-gray-500">Genera un egreso de caja vinculado a este saldo. Si está OFF, queda como atención del club sin tocar caja.</p>
              </div>
            </div>
            <Switch checked={conEgreso} onChange={setConEgreso} />
          </div>

          {conEgreso && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Caja *</label>
                  <select value={cajaId} onChange={(e) => setCajaId(e.target.value)} className="input-field w-full text-sm">
                    <option value="">Seleccioná caja</option>
                    {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Medio de pago *</label>
                  <select value={medioPagoId} onChange={(e) => setMedioPagoId(e.target.value)} className="input-field w-full text-sm">
                    <option value="">Seleccioná medio</option>
                    {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cuenta contable *</label>
                <select value={cuentaContableId} onChange={(e) => setCuentaContableId(e.target.value)} className="input-field w-full text-sm">
                  <option value="">Seleccioná cuenta</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={guardando}>Acreditar</Button>
        </div>
      </form>
    </Modal>
  )
}
