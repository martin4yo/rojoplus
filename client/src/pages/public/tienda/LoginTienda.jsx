import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, KeyRound } from 'lucide-react'
import PublicHero from '../../../components/public/PublicHero'
import tiendaApi from '../../../services/tiendaApi'

export default function LoginTienda() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function pedirMagicLink(e) {
    e.preventDefault()
    if (!email) return
    setEnviando(true)
    try {
      await tiendaApi.magicLink(email)
      setEnviado(true)
    } catch (err) {
      toast.error(err.message || 'Error')
    } finally { setEnviando(false) }
  }

  return (
    <div>
      <PublicHero eyebrow="Tienda" title="Iniciar sesión" subtitle="Te mandamos un link al email para entrar sin contraseña." compact />

      <div className="max-w-md mx-auto px-4 py-12">
        {enviado ? (
          <div className="border-2 border-emerald-500 p-8 bg-emerald-50 text-center">
            <Mail className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h2 className="font-display-sport text-2xl mb-2">Revisá tu email</h2>
            <p className="text-sm text-gray-700">Si tenés cuenta con <strong>{email}</strong>, te enviamos un link de acceso. El link expira en 15 minutos.</p>
            <button onClick={() => { setEnviado(false); setEmail('') }} className="mt-4 text-sm underline">Probar otro email</button>
          </div>
        ) : (
          <form onSubmit={pedirMagicLink} className="border-2 border-black p-8 bg-white space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-3 border-2 border-black/10 focus:border-black/40 outline-none text-base"
                placeholder="vos@email.com"
                required
              />
            </div>
            <button type="submit" disabled={enviando} className="pub-cta w-full">
              <KeyRound className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviarme link de acceso'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              ¿No tenés cuenta? Podés{' '}
              <Link to="/tienda" className="underline font-medium">comprar como invitado</Link>{' '}
              y se crea automáticamente al pagar.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
