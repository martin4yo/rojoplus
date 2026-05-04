import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import tiendaApi from '../../../services/tiendaApi'
import { useShopAuth } from '../../../contexts/ShopAuthContext'

export default function LoginMagic() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginConToken } = useShopAuth()
  const token = params.get('token')
  const [estado, setEstado] = useState('verificando') // verificando | ok | error

  useEffect(() => {
    if (!token) { setEstado('error'); return }
    tiendaApi.verifyMagic(token)
      .then(r => {
        loginConToken(r.token, r.customer)
        setEstado('ok')
        setTimeout(() => navigate('/tienda/mis-pedidos'), 1200)
      })
      .catch(() => setEstado('error'))
  }, [token])

  return (
    <div>
      <PublicHero eyebrow="Tienda" title={estado === 'verificando' ? 'Verificando...' : estado === 'ok' ? 'Bienvenido' : 'Link inválido'} compact />
      <div className="text-center py-12">
        {estado === 'verificando' && <Loader className="w-16 h-16 text-gray-400 animate-spin mx-auto" />}
        {estado === 'ok' && <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />}
        {estado === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">El link expiró o no es válido.</p>
            <Link to="/tienda/login" className="pub-cta inline-flex">Pedir nuevo link</Link>
          </>
        )}
      </div>
    </div>
  )
}
