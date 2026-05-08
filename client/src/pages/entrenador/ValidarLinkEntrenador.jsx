import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function ValidarLinkEntrenador() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function validar() {
      try {
        await api.get(`/entrenador/validar-token/${token}`)
        if (!cancelado) navigate('/portal-entrenador', { replace: true })
      } catch (err) {
        if (!cancelado) setError(err.message || 'No se pudo validar el link')
      }
    }
    validar()
    return () => { cancelado = true }
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--error)' }}>Error</h2>
            <p className="mb-6 text-sm" style={{ color: 'var(--text-dim)' }}>{error}</p>
            <button
              onClick={() => navigate('/login-entrenador')}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium"
            >
              Solicitar nuevo link
            </button>
          </>
        ) : (
          <p className="text-sm font-mono uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)' }}>
            Validando acceso…
          </p>
        )}
      </div>
    </div>
  )
}
