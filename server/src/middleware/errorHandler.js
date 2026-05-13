export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Error interno del servidor'

  // Errores esperados (auth, validación, not found): warning corto sin stack trace.
  // Errores 5xx o inesperados: log completo con stack.
  if (statusCode >= 400 && statusCode < 500) {
    console.warn(`[${statusCode}] ${err.code || 'ERR'}: ${req.method} ${req.originalUrl} — ${message}`)
  } else {
    console.error('Error:', err)
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
    },
  })
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}
