import { useEffect, useState } from 'react'
import { Phone, Mail, AlertTriangle } from 'lucide-react'
import api from '../../../services/api'

export default function PlantelTab({ categoria }) {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function load() {
      setCargando(true)
      try {
        const data = await api.get(`/entrenador/categorias/${categoria.id}/plantel`)
        if (!cancelado) setItems(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelado) setItems([])
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    load()
    return () => { cancelado = true }
  }, [categoria.id])

  function aptaInfo(socio) {
    if (!socio.aptaFisicaVigente) return { texto: 'Apta no vigente', tipo: 'error' }
    if (socio.aptaFisicaVence) {
      const dias = Math.floor((new Date(socio.aptaFisicaVence) - Date.now()) / (24 * 60 * 60 * 1000))
      if (dias < 0) return { texto: 'Apta vencida', tipo: 'error' }
      if (dias < 30) return { texto: `Vence en ${dias}d`, tipo: 'warn' }
    }
    return null
  }

  if (cargando) return <div className="text-sm text-gray-500 py-8 text-center">Cargando plantel…</div>
  if (items.length === 0) return <div className="text-sm text-gray-500 py-8 text-center">Sin inscriptos en esta categoría.</div>

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 mb-2">
        {items.length} inscripto{items.length !== 1 ? 's' : ''} activo{items.length !== 1 ? 's' : ''}
      </div>
      {items.map(s => {
        const apta = aptaInfo(s)
        return (
          <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {s.fotoUrl
                ? <img src={s.fotoUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-gray-400 font-bold">{(s.apellidoNombre || '?').slice(0, 1)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">{s.apellidoNombre}</div>
              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                <span>Nº {s.nroSocio}</span>
                {s.edad != null && <span>{s.edad} años</span>}
                {s.esMenor && <span className="text-blue-600">menor</span>}
                {apta && (
                  <span className={apta.tipo === 'error' ? 'text-red-600 flex items-center gap-1' : 'text-amber-600 flex items-center gap-1'}>
                    <AlertTriangle className="w-3 h-3" />
                    {apta.texto}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {s.celular && (
                <a href={`tel:${s.celular}`} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Phone className="w-4 h-4" />
                </a>
              )}
              {s.email && (
                <a href={`mailto:${s.email}`} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Mail className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
