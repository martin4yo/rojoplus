import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, User, ChevronDown, ChevronRight, Search, X, UserCheck, Plus, Trash2 } from 'lucide-react'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import api from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'

export default function ReporteActividadDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [actividad, setActividad] = useState(null)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({})
  const [inscripcionesPorCategoria, setInscripcionesPorCategoria] = useState({})
  const [entrenadoresPorCategoria, setEntrenadoresPorCategoria] = useState({})
  const [todosEntrenadores, setTodosEntrenadores] = useState([])
  const [busqueda, setBusqueda] = useState('')

  // Para asignar entrenador
  const [asignandoCategoria, setAsignandoCategoria] = useState(null)
  const [entrenadorSeleccionado, setEntrenadorSeleccionado] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState('ENTRENADOR')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarActividad()
  }, [id])

  async function cargarActividad() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/actividades/${id}`)
      setActividad(data)

      // Cargar inscriptos y entrenadores (categorías colapsadas por defecto)
      const exp = {}
      const inscripciones = {}
      const entrenadores = {}

      // Cargar todos los entrenadores
      const entrenadoresData = await api.get('/admin/entrenadores?activo=true')
      setTodosEntrenadores(entrenadoresData)

      for (const cat of data.categorias || []) {
        exp[cat.id] = false
        const catData = await api.get(`/admin/categorias-actividad/${cat.id}`)
        inscripciones[cat.id] = catData.inscripciones || []

        // Filtrar entrenadores asignados a esta categoría
        entrenadores[cat.id] = entrenadoresData.filter(e =>
          e.categorias?.some(c => c.categoriaActividad?.id === cat.id && c.activo)
        )
      }

      setCategoriasExpandidas(exp)
      setInscripcionesPorCategoria(inscripciones)
      setEntrenadoresPorCategoria(entrenadores)
    } catch (err) {
      setError('Error al cargar actividad')
    } finally {
      setLoading(false)
    }
  }

  function toggleCategoria(categoriaId) {
    setCategoriasExpandidas(prev => ({ ...prev, [categoriaId]: !prev[categoriaId] }))
  }

  // Filtrar inscriptos por búsqueda
  function filtrarInscriptos(inscriptos) {
    if (!busqueda.trim()) return inscriptos
    const query = busqueda.toLowerCase().trim()
    return inscriptos.filter(ins =>
      ins.socio.apellidoNombre?.toLowerCase().includes(query) ||
      ins.socio.nroSocio?.toString().includes(query) ||
      ins.socio.documento?.toString().includes(query)
    )
  }

  // Asignar entrenador a categoría
  async function asignarEntrenador(categoriaId) {
    if (!entrenadorSeleccionado) return

    setGuardando(true)
    try {
      await api.post(`/admin/entrenadores/${entrenadorSeleccionado}/categorias`, {
        categoriaActividadId: categoriaId,
        rol: rolSeleccionado,
      })

      // Actualizar la lista local
      const entrenador = todosEntrenadores.find(e => e.id === parseInt(entrenadorSeleccionado))
      if (entrenador) {
        setEntrenadoresPorCategoria(prev => ({
          ...prev,
          [categoriaId]: [...(prev[categoriaId] || []), entrenador]
        }))
      }

      setSuccess('Entrenador asignado')
      setAsignandoCategoria(null)
      setEntrenadorSeleccionado('')
      setRolSeleccionado('ENTRENADOR')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err.message || 'Error al asignar entrenador')
    } finally {
      setGuardando(false)
    }
  }

  // Quitar entrenador de categoría
  async function quitarEntrenador(entrenadorId, categoriaId) {
    const confirmed = await confirm('Quitar entrenador', '¿Quitar este entrenador de la categoría?')
    if (!confirmed) return

    try {
      await api.delete(`/admin/entrenadores/${entrenadorId}/categorias/${categoriaId}`)

      // Actualizar la lista local
      setEntrenadoresPorCategoria(prev => ({
        ...prev,
        [categoriaId]: (prev[categoriaId] || []).filter(e => e.id !== entrenadorId)
      }))

      setSuccess('Entrenador quitado')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError('Error al quitar entrenador')
    }
  }

  // Entrenadores disponibles para asignar (no asignados aún a esta categoría)
  function entrenadoresDisponibles(categoriaId) {
    const asignados = entrenadoresPorCategoria[categoriaId] || []
    const idsAsignados = asignados.map(e => e.id)
    return todosEntrenadores.filter(e => !idsAsignados.includes(e.id))
  }

  const roles = [
    { value: 'ENTRENADOR', label: 'Entrenador' },
    { value: 'ASISTENTE', label: 'Asistente' },
    { value: 'PREPARADOR_FISICO', label: 'Preparador Fisico' },
  ]

  // Totales
  const totalInscriptos = Object.values(inscripcionesPorCategoria).reduce((acc, ins) => acc + ins.length, 0)

  // Total filtrado
  const totalFiltrado = Object.values(inscripcionesPorCategoria).reduce((acc, ins) => acc + filtrarInscriptos(ins).length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!actividad) {
    return (
      <div className="text-center py-8 text-gray-500">
        Actividad no encontrada
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/reportes/actividades')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-100">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{actividad.nombre}</h1>
              <p className="text-gray-500 text-sm">
                {actividad.categorias?.length || 0} categorías, {totalInscriptos} inscriptos
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => navigate('/admin/entrenadores')}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <UserCheck className="w-4 h-4" />
          Gestionar Entrenadores
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI o nro. socio..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {busqueda && (
          <p className="text-sm text-gray-500 mt-2">
            Mostrando {totalFiltrado} de {totalInscriptos} inscriptos
          </p>
        )}
      </div>

      {/* Lista de categorías con inscriptos */}
      <div className="space-y-4">
        {actividad.categorias?.map(categoria => {
          const inscriptosOriginales = inscripcionesPorCategoria[categoria.id] || []
          const inscriptos = filtrarInscriptos(inscriptosOriginales)
          const entrenadores = entrenadoresPorCategoria[categoria.id] || []
          // Si hay búsqueda, expandir automáticamente las categorías con resultados
          const expandida = busqueda ? inscriptos.length > 0 : categoriasExpandidas[categoria.id]
          const mostrandoAsignar = asignandoCategoria === categoria.id

          // Si hay búsqueda y no hay resultados en esta categoría, ocultarla
          if (busqueda && inscriptos.length === 0) return null

          return (
            <div key={categoria.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Cabecera de categoría */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleCategoria(categoria.id)}
              >
                <div className="flex items-center gap-3">
                  <button className="p-1">
                    {expandida ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{categoria.nombre}</span>
                      <span className="text-xs text-gray-400 font-mono">{categoria.codigo}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    {inscriptos.length} inscriptos
                  </span>
                </div>
              </div>

              {/* Sección de entrenadores */}
              <div className="px-4 py-2 bg-teal-50 border-t border-b border-teal-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium text-teal-700">Entrenadores:</span>
                    {entrenadores.length > 0 ? (
                      entrenadores.map(ent => (
                        <span
                          key={ent.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-sm"
                        >
                          {ent.nombre} {ent.apellido || ''}
                          <button
                            onClick={(e) => { e.stopPropagation(); quitarEntrenador(ent.id, categoria.id) }}
                            className="ml-1 p-0.5 hover:bg-teal-200 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500 italic">Sin asignar</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setAsignandoCategoria(mostrandoAsignar ? null : categoria.id)
                      setEntrenadorSeleccionado('')
                    }}
                    className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-lg transition"
                    title="Asignar entrenador"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Formulario para asignar entrenador */}
                {mostrandoAsignar && (
                  <div className="mt-3 flex items-end gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs text-teal-600 mb-1">Entrenador</label>
                      <select
                        value={entrenadorSeleccionado}
                        onChange={(e) => setEntrenadorSeleccionado(e.target.value)}
                        className="w-full px-3 py-1.5 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {entrenadoresDisponibles(categoria.id).map(ent => (
                          <option key={ent.id} value={ent.id}>
                            {ent.nombre} {ent.apellido || ''} {ent.especialidad ? `(${ent.especialidad})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-40">
                      <label className="block text-xs text-teal-600 mb-1">Rol</label>
                      <select
                        value={rolSeleccionado}
                        onChange={(e) => setRolSeleccionado(e.target.value)}
                        className="w-full px-3 py-1.5 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white"
                      >
                        {roles.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => asignarEntrenador(categoria.id)}
                      disabled={!entrenadorSeleccionado || guardando}
                      loading={guardando}
                      className="whitespace-nowrap"
                    >
                      Asignar
                    </Button>
                    <button
                      onClick={() => setAsignandoCategoria(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Lista de inscriptos */}
              {expandida && (
                <div className="border-t divide-y">
                  {inscriptos.length > 0 ? (
                    inscriptos.map(ins => (
                      <div
                        key={ins.id}
                        className="flex items-center justify-between px-4 py-2.5 pl-12 hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/socios/${ins.socio.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{ins.socio.apellidoNombre}</span>
                            <span className="text-xs text-gray-400 ml-2">#{ins.socio.nroSocio}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ins.becado && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Becado</span>
                          )}
                          {ins.federado && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Federado</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 pl-12 text-sm text-gray-400 italic">
                      Sin inscriptos en esta categoría
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {(!actividad.categorias || actividad.categorias.length === 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            Esta actividad no tiene categorías configuradas
          </div>
        )}
      </div>

      {/* ConfirmDialog */}
      <ConfirmDialog />
    </div>
  )
}
