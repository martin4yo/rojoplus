import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import tiendaApi from '../../../services/tiendaApi'

export default function VerificarEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [estado, setEstado] = useState('verificando')

  useEffect(() => {
    if (!token) { setEstado('error'); return }
    tiendaApi.verifyEmail(token).then(() => setEstado('ok')).catch(() => setEstado('error'))
  }, [token])

  return (
    <div>
      <PublicHero eyebrow="Tienda" title={estado === 'ok' ? 'Email verificado' : estado === 'error' ? 'Link inválido' : 'Verificando...'} compact />
      <div className="text-center py-12">
        {estado === 'verificando' && <Loader className="w-16 h-16 text-gray-400 animate-spin mx-auto" />}
        {estado === 'ok' && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <Link to="/tienda/login" className="pub-cta inline-flex">Iniciar sesión</Link>
          </>
        )}
        {estado === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">El link expiró o no es válido.</p>
          </>
        )}
      </div>
    </div>
  )
}
