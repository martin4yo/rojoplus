import { Delete } from 'lucide-react'

export default function TecladoNumerico({ onInput, onClear, onEnter, className = '', compact = false }) {
  const botones = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['00', '0', '.']
  ]

  const handleClick = (valor) => {
    onInput?.(valor)
  }

  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'} ${className}`}>
      {/* Botones numéricos 3x4 */}
      {botones.map((fila, i) => (
        fila.map(btn => (
          <button
            key={`${i}-${btn}`}
            onClick={() => handleClick(btn)}
            className={`${compact ? 'h-12 text-lg w-14' : 'h-14 text-xl'} font-bold bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded transition-all active:scale-95 touch-manipulation select-none`}
            type="button"
          >
            {btn}
          </button>
        ))
      ))}

      {/* Botón Clear */}
      <button
        onClick={onClear}
        className={`col-span-3 ${compact ? 'h-12' : 'h-14'} bg-red-100 text-red-700 font-bold rounded hover:bg-red-200 active:bg-red-300 transition-all active:scale-95 touch-manipulation flex items-center justify-center gap-1`}
        type="button"
        title="Limpiar (Borrar todo)"
      >
        <Delete size={compact ? 16 : 18} />
        <span className={compact ? 'text-sm' : ''}>C</span>
      </button>
    </div>
  )
}
