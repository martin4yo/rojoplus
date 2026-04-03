import { useState, useEffect, useRef } from 'react'
import { Banknote, Smartphone, Building2, CreditCard, FileText, RefreshCw, Users, Wallet } from 'lucide-react'

const ICONO_MAP = {
  EFECTIVO:      Banknote,
  MERCADOPAGO:   Smartphone,
  QR:            Smartphone,
  MODO:          Smartphone,
  TRANSFERENCIA: Building2,
  DEBITO:        CreditCard,
  CREDITO:       CreditCard,
  DEBITO_AUTO:   RefreshCw,
  CHEQUE:        FileText,
  COBRADOR:      Users,
}

export default function PagoUnificado({ total, mediosPago = [], onChange }) {
  const [entradas, setEntradas] = useState({})
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // Resetear cuando cambian los medios de pago disponibles
  useEffect(() => {
    const init = {}
    mediosPago.forEach(mp => { init[mp.id] = { descripcion: '', monto: '' } })
    setEntradas(init)
  }, [mediosPago.map(m => m.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const getMontoNum = (id) => parseFloat(entradas[id]?.monto) || 0

  const pagosActivos = mediosPago
    .map(mp => ({ ...mp, montoNum: getMontoNum(mp.id) }))
    .filter(p => p.montoNum > 0)

  const totalPagado = pagosActivos.reduce((s, p) => s + p.montoNum, 0)
  const pendiente = total - totalPagado

  // Notificar al padre
  useEffect(() => {
    const pagos = pagosActivos.map(p => ({
      medioPagoId: p.id,
      monto: p.montoNum,
      descripcion: entradas[p.id]?.descripcion || ''
    }))
    onChangeRef.current?.({ pagos, totalPagado, pendiente, esCompleto: pendiente <= 0.001 })
  }, [entradas])  // eslint-disable-line react-hooks/exhaustive-deps

  const setMonto = (id, val) =>
    setEntradas(prev => ({ ...prev, [id]: { ...prev[id], monto: val } }))

  const setSaldo = (id) => {
    const otrosPagados = pagosActivos
      .filter(p => p.id !== id)
      .reduce((s, p) => s + p.montoNum, 0)
    const saldo = Math.max(0, total - otrosPagados)
    setMonto(id, saldo.toFixed(2))
  }

  return (
    <div className="space-y-2">
      {mediosPago.map(mp => {
        const entrada = entradas[mp.id] || { descripcion: '', monto: '' }
        const montoNum = parseFloat(entrada.monto) || 0
        const esEfectivo = mp.codigo === 'EFECTIVO'
        const activo = montoNum > 0
        const vuelto = esEfectivo && montoNum > total ? montoNum - total : null
        const insuficiente = esEfectivo && montoNum > 0 && montoNum < total && pagosActivos.length === 1
        const Icon = ICONO_MAP[mp.codigo] || Wallet

        return (
          <div
            key={mp.id}
            className={`border rounded-lg p-3 transition-colors ${
              activo ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            {/* Header + importe en la misma línea */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 flex-1 text-sm font-semibold text-gray-700 min-w-0">
                <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="truncate">{mp.nombre}</span>
              </span>
              <button
                type="button"
                onClick={() => setSaldo(mp.id)}
                className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 font-medium transition-colors flex-shrink-0"
              >
                Saldo
              </button>
              <input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={entrada.monto}
                onChange={e => setMonto(mp.id, e.target.value)}
                className={`w-28 flex-shrink-0 border rounded-lg px-2.5 py-1.5 text-sm text-right font-mono outline-none focus:ring-2 ${
                  activo
                    ? 'border-green-400 focus:ring-green-400'
                    : 'border-gray-300 focus:ring-green-400 focus:border-green-400'
                }`}
              />
            </div>

            {/* Vuelto (efectivo) */}
            {vuelto !== null && vuelto > 0 && (
              <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                <span className="text-sm text-blue-700 font-medium">Vuelto:</span>
                <span className="text-sm text-blue-800 font-bold tabular-nums">
                  ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Monto insuficiente */}
            {insuficiente && (
              <p className="mt-1.5 text-xs text-red-500">
                Insuficiente — faltan ${(total - montoNum).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        )
      })}

      {/* Resumen si hay más de un medio activo */}
      {pagosActivos.length > 1 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Total pagado:</span>
            <span className="font-semibold tabular-nums">
              ${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`flex justify-between font-bold border-t border-gray-300 pt-1 ${pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
            <span>{pendiente > 0 ? 'Pendiente:' : 'Cubierto'}</span>
            <span className="tabular-nums">
              {pendiente > 0 ? `$${pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '✓'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
