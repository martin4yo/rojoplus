import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Filter } from 'lucide-react'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPOS = ['COMISION', 'ASAMBLEA', 'DIRECTIVA', 'OTRO']
const ESTADOS = ['BORRADOR', 'FIRMADA', 'ARCHIVADA']
const TIPO_COLOR = {
  COMISION: 'bg-blue-100 text-blue-700',
  ASAMBLEA: 'bg-purple-100 text-purple-700',
  DIRECTIVA: 'bg-indigo-100 text-indigo-700',
  OTRO: 'bg-gray-100 text-gray-600',
}
const ESTADO_COLOR = {
  BORRADOR: 'bg-yellow-100 text-yellow-700',
  FIRMADA: 'bg-green-100 text-green-700',
  ARCHIVADA: 'bg-gray-100 text-gray-500',
}

export default function ActasLista() {
  const navigate = useNavigate()
  const [actas, setActas] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear())

  useEffect(() => { cargar() }, [filtroTipo, filtroEstado, anio])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroEstado) params.set('estado', filtroEstado)
      if (anio) params.set('anio', anio)
      const data = await api.get(`/admin/gobernanza/actas?${params}`)
      setActas(data.data || data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const actasFiltradas = actas.filter(a =>
    !buscar || a.titulo.toLowerCase().includes(buscar.toLowerCase())
  )

  const anios = []
  for (let y = new Date().getFullYear(); y >= 2020; y--) anios.push(y)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">Actas de reunión</h1>
        </div>
        {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
          <button
            onClick={() => navigate('/admin/gobernanza/actas/nueva')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
          >
            <Plus className="w-4 h-4" />
            Nueva acta
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por título..."
            className="input-field pl-9 w-full"
          />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input-field">
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(e.target.value)} className="input-field">
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {actasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              No hay actas registradas
            </div>
          ) : (
            <div className="space-y-3">
              {actasFiltradas.map(acta => (
                <div
                  key={acta.id}
                  onClick={() => navigate(`/admin/gobernanza/actas/${acta.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm cursor-pointer transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[acta.tipo] || ''}`}>{acta.tipo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[acta.estado] || ''}`}>{acta.estado}</span>
                      </div>
                      <p className="font-semibold text-gray-800 truncate">{acta.titulo}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {acta.fecha ? new Date(acta.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                        {acta.lugar && ` · ${acta.lugar}`}
                      </p>
                    </div>
                    {acta.adjuntoUrl && (
                      <span className="text-xs text-gray-400 flex-shrink-0">PDF adjunto</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
