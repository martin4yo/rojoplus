import { useState } from 'react'
import { Users, ShoppingCart, DollarSign, Plus, Minus } from 'lucide-react'
import Modal from '../Modal'

export default function SplitCuenta({
  isOpen,
  onClose,
  comanda,
  onAplicar
}) {
  const [modoDivision, setModoDivision] = useState('partes') // 'partes' | 'items' | 'monto'
  const [numeroPartes, setNumeroPartes] = useState(2)
  const [asignacionItems, setAsignacionItems] = useState({}) // { itemId: personaId }
  const [montosPersonalizados, setMontosPersonalizados] = useState([])

  if (!comanda) return null

  const total = comanda.total || 0
  const items = comanda.items || []

  // Calcular monto por persona (división simple)
  const montoPorPersona = total / numeroPartes

  // Calcular totales por persona (división por items)
  const calcularTotalesPorItems = () => {
    const totales = {}
    const itemsCompartidos = []

    items.forEach(item => {
      const persona = asignacionItems[item.id]
      const subtotalItem = item.precioUnitario * item.cantidad

      if (persona === 'compartido') {
        itemsCompartidos.push(subtotalItem)
      } else if (persona) {
        totales[persona] = (totales[persona] || 0) + subtotalItem
      }
    })

    // Distribuir items compartidos
    if (itemsCompartidos.length > 0) {
      const totalCompartido = itemsCompartidos.reduce((sum, val) => sum + val, 0)
      const porPersona = totalCompartido / numeroPartes

      for (let i = 1; i <= numeroPartes; i++) {
        totales[i] = (totales[i] || 0) + porPersona
      }
    }

    return totales
  }

  const handleAsignarItem = (itemId, persona) => {
    setAsignacionItems(prev => ({
      ...prev,
      [itemId]: persona
    }))
  }

  const handleAplicar = () => {
    let resultado = {}

    if (modoDivision === 'partes') {
      resultado = {
        modo: 'partes',
        numeroPartes,
        montoPorPersona
      }
    } else if (modoDivision === 'items') {
      resultado = {
        modo: 'items',
        numeroPartes,
        asignacion: asignacionItems,
        totales: calcularTotalesPorItems()
      }
    } else if (modoDivision === 'monto') {
      resultado = {
        modo: 'monto',
        montos: montosPersonalizados
      }
    }

    onAplicar?.(resultado)
    onClose()
  }

  const totalesPorItems = modoDivision === 'items' ? calcularTotalesPorItems() : {}

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dividir Cuenta"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Opciones de división */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setModoDivision('partes')}
            className={`p-4 border-2 rounded-lg transition-all ${
              modoDivision === 'partes'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Users size={24} className="mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium text-center">Partes iguales</p>
          </button>

          <button
            type="button"
            onClick={() => setModoDivision('items')}
            className={`p-4 border-2 rounded-lg transition-all ${
              modoDivision === 'items'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <ShoppingCart size={24} className="mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium text-center">Por items</p>
          </button>

          <button
            type="button"
            onClick={() => setModoDivision('monto')}
            className={`p-4 border-2 rounded-lg transition-all ${
              modoDivision === 'monto'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <DollarSign size={24} className="mx-auto mb-2 text-blue-600" />
            <p className="text-sm font-medium text-center">Por monto</p>
          </button>
        </div>

        {/* Modo: Partes iguales */}
        {modoDivision === 'partes' && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium mb-3 text-center">
              Número de personas:
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setNumeroPartes(Math.max(2, numeroPartes - 1))}
                className="p-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition active:scale-95"
              >
                <Minus size={20} />
              </button>
              <span className="text-5xl font-bold w-24 text-center tabular-nums">
                {numeroPartes}
              </span>
              <button
                type="button"
                onClick={() => setNumeroPartes(numeroPartes + 1)}
                className="p-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition active:scale-95"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="mt-6 p-4 bg-white border-2 border-green-500 rounded-lg">
              <p className="text-sm text-gray-600 mb-1 text-center">Cada persona paga:</p>
              <p className="text-4xl font-bold text-green-600 text-center tabular-nums">
                ${montoPorPersona.toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
          </div>
        )}

        {/* Modo: Por items */}
        {modoDivision === 'items' && (
          <div>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">Asigna cada item a una persona:</p>
              <p className="text-xs">Los items marcados como "Compartido" se dividen entre todos.</p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.map(item => {
                const subtotalItem = item.precioUnitario * item.cantidad
                const personaAsignada = asignacionItems[item.id]

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">
                        {item.producto?.nombre || item.nombre} x{item.cantidad}
                      </p>
                      <p className="text-sm text-gray-600">
                        ${subtotalItem.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <select
                      value={personaAsignada || ''}
                      onChange={(e) => handleAsignarItem(item.id, e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    >
                      <option value="">Asignar...</option>
                      {Array.from({ length: numeroPartes }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>Persona {n}</option>
                      ))}
                      <option value="compartido">Compartido</option>
                    </select>
                  </div>
                )
              })}
            </div>

            {/* Resumen por persona */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: numeroPartes }, (_, i) => i + 1).map(persona => {
                const total = totalesPorItems[persona] || 0
                return (
                  <div key={persona} className="p-3 bg-white border rounded-lg">
                    <p className="text-xs text-gray-600">Persona {persona}:</p>
                    <p className="text-lg font-bold text-green-600">
                      ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modo: Por monto (placeholder) */}
        {modoDivision === 'monto' && (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-sm text-gray-600">
              Esta función estará disponible próximamente.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAplicar}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition"
          >
            Aplicar División
          </button>
        </div>
      </div>
    </Modal>
  )
}
