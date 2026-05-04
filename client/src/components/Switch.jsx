/**
 * Switch reusable (toggle on/off).
 * Reemplaza cualquier checkbox que represente un estado activado/desactivado.
 *
 * Uso básico:
 *   <Switch checked={value} onChange={setValue} />
 *
 * Con etiqueta inline:
 *   <Switch checked={value} onChange={setValue} label="Producto activo" />
 *
 * Con etiquetas activado/desactivado:
 *   <Switch checked={value} onChange={setValue} onLabel="Activada" offLabel="Desactivada" />
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  onLabel,
  offLabel,
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: { track: 'h-5 w-9',  thumb: 'h-3.5 w-3.5', on: 'translate-x-[18px]', off: 'translate-x-1' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4',     on: 'translate-x-6',       off: 'translate-x-1' },
    lg: { track: 'h-7 w-12', thumb: 'h-5 w-5',     on: 'translate-x-6',       off: 'translate-x-1' },
  }
  const s = sizes[size] || sizes.md

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span
        className={`relative inline-flex ${s.track} items-center rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block ${s.thumb} transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? s.on : s.off
          }`}
        />
      </span>
      {(label || onLabel || offLabel) && (
        <span className={`text-sm select-none ${
          checked
            ? (onLabel ? 'text-emerald-700 font-medium' : 'text-gray-700')
            : (offLabel ? 'text-gray-500' : 'text-gray-700')
        }`}>
          {label || (checked ? onLabel : offLabel)}
        </span>
      )}
    </button>
  )
}
