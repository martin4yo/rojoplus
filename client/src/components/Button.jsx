export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled = false,
  ...props
}) {
  const baseClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    text: 'btn-text',
  }

  return (
    <button
      className={`${baseClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Procesando...
        </span>
      ) : (
        <span className="flex items-center justify-center">
          {children}
        </span>
      )}
    </button>
  )
}

export default Button
