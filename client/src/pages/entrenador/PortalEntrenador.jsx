import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Calendar, Trophy, MessageSquare, LogOut } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import PlantelTab from './tabs/PlantelTab'
import EntrenamientosTab from './tabs/EntrenamientosTab'
import ConvocatoriasTab from './tabs/ConvocatoriasTab'
import ChatTab from './tabs/ChatTab'

const TABS = [
  { id: 'plantel', label: 'Plantel', icon: Users },
  { id: 'entrenamientos', label: 'Entrenamientos', icon: Calendar },
  { id: 'partidos', label: 'Partidos', icon: Trophy },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

export default function PortalEntrenador() {
  const navigate = useNavigate()
  const [entrenador, setEntrenador] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [tab, setTab] = useState('plantel')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function load() {
      try {
        const [me, cats] = await Promise.all([
          api.get('/entrenador/me'),
          api.get('/entrenador/mis-categorias'),
        ])
        if (cancelado) return
        setEntrenador(me)
        setCategorias(cats || [])
        if (cats && cats.length > 0) setCategoriaActiva(cats[0])
      } catch (err) {
        if (err.code === 'NOT_AUTHENTICATED' || err.code === 'SESSION_EXPIRED' || err.status === 401) {
          navigate('/login-entrenador', { replace: true })
        } else {
          toast.error(err.message || 'Error cargando portal')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    load()
    return () => { cancelado = true }
  }, [navigate])

  async function cerrarSesion() {
    try { await api.post('/entrenador/sesion/cerrar', {}) } catch {}
    navigate('/login-entrenador', { replace: true })
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Cargando portal…
      </div>
    )
  }

  if (categorias.length === 0) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold mb-2">No tenés categorías asignadas</h2>
        <p className="text-sm text-gray-600 mb-6">Contactá al club para que te asignen categorías.</p>
        <button onClick={cerrarSesion} className="text-sm text-gray-500 hover:text-red-600">
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Portal entrenador</div>
            <div className="font-semibold text-gray-900 truncate">
              {entrenador?.nombre} {entrenador?.apellido || ''}
            </div>
          </div>
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Selector de categoría */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {categorias.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoriaActiva(c)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  categoriaActiva?.id === c.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{c.actividad} · {c.nombre}</span>
                <span className={`ml-2 text-xs ${categoriaActiva?.id === c.id ? 'text-blue-100' : 'text-gray-500'}`}>
                  ({c.cantInscriptos})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[57px] z-20">
        <div className="max-w-6xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map(t => {
              const Icon = t.icon
              const activo = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activo
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto p-4">
        {categoriaActiva && tab === 'plantel' && <PlantelTab categoria={categoriaActiva} />}
        {categoriaActiva && tab === 'entrenamientos' && <EntrenamientosTab categoria={categoriaActiva} />}
        {categoriaActiva && tab === 'partidos' && <ConvocatoriasTab categoria={categoriaActiva} />}
        {tab === 'chat' && <ChatTab />}
      </main>
    </div>
  )
}
