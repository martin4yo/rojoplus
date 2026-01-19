import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, ChevronRight, Search, X, User } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function ReporteActividades() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actividades, setActividades] = useState([])
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarActividades()
  }, [])

  async function cargarActividades() {
    setLoading(true)
    try {
      const data = await api.get('/admin/actividades')
      // Para cada actividad, cargar inscriptos de todas sus categorías
      const actividadesConInscriptos = await Promise.all(
        (data || []).map(async (actividad) => {
          let inscriptos = []
          for (const cat of actividad.categorias || []) {
            const catData = await api.get(`/admin/categorias-actividad/${cat.id}`)
            const inscripcionesCat = (catData.inscripciones || []).map(ins => ({
              ...ins,
              categoriaNombre: cat.nombre
            }))
            inscriptos = [...inscriptos, ...inscripcionesCat]
          }
          return { ...actividad, inscriptos, totalInscriptos: inscriptos.length }
        })
      )
      setActividades(actividadesConInscriptos)
    } catch (err) {
      setError('Error al cargar actividades')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar inscriptos por búsqueda
  function filtrarInscriptos(inscriptos) {
    if (!busqueda.trim()) return []
    const query = busqueda.toLowerCase().trim()
    return inscriptos.filter(ins =>
      ins.socio?.apellidoNombre?.toLowerCase().includes(query) ||
      ins.socio?.nroSocio?.toString().includes(query) ||
      ins.socio?.documento?.toString().includes(query)
    )
  }

  // Actividades filtradas (las que tienen inscriptos que matchean)
  const actividadesFiltradas = busqueda.trim()
    ? actividades.filter(a => filtrarInscriptos(a.inscriptos).length > 0)
    : actividades

  // Total de inscriptos encontrados
  const totalEncontrados = busqueda.trim()
    ? actividadesFiltradas.reduce((acc, a) => acc + filtrarInscriptos(a.inscriptos).length, 0)
    : 0

  // Totales
  const totalActividades = actividades.length
  const totalCategorias = actividades.reduce((acc, a) => acc + (a.categorias?.length || 0), 0)
  const totalInscriptos = actividades.reduce((acc, a) => acc + (a.totalInscriptos || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/reportes')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reporte de Actividades</h1>
            <p className="text-gray-500 text-sm">
              {totalActividades} actividades, {totalCategorias} categorías, {totalInscriptos} inscriptos
            </p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Buscador */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar inscripto por nombre, DNI o nro. socio..."
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
            {totalEncontrados} inscripto{totalEncontrados !== 1 ? 's' : ''} encontrado{totalEncontrados !== 1 ? 's' : ''} en {actividadesFiltradas.length} actividad{actividadesFiltradas.length !== 1 ? 'es' : ''}
          </p>
        )}
      </div>

      {/* Si hay búsqueda, mostrar resultados con inscriptos */}
      {busqueda.trim() ? (
        <div className="space-y-4">
          {actividadesFiltradas.map(actividad => {
            const inscriptosEncontrados = filtrarInscriptos(actividad.inscriptos)
            return (
              <div key={actividad.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Header de actividad */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-orange-50 cursor-pointer hover:bg-orange-100"
                  onClick={() => navigate(`/admin/reportes/actividades/${actividad.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Users className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">{actividad.nombre}</span>
                      <span className="text-sm text-gray-500 ml-2">({inscriptosEncontrados.length} encontrados)</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                {/* Lista de inscriptos encontrados */}
                <div className="divide-y">
                  {inscriptosEncontrados.map(ins => (
                    <div
                      key={ins.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/socios/${ins.socio.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-800">{ins.socio.apellidoNombre}</span>
                          <span className="text-xs text-gray-400 ml-2">#{ins.socio.nroSocio}</span>
                          {ins.socio.documento && (
                            <span className="text-xs text-gray-400 ml-2">DNI: {ins.socio.documento}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {ins.categoriaNombre}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {actividadesFiltradas.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No se encontraron inscriptos
            </div>
          )}
        </div>
      ) : (
        /* Tarjetas de actividades (vista normal sin búsqueda) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {actividades.map(actividad => (
            <div
              key={actividad.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer"
              onClick={() => navigate(`/admin/reportes/actividades/${actividad.id}`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-orange-100">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-gray-800">{actividad.nombre}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{actividad.totalInscriptos}</p>
                      <p className="text-xs text-gray-500">inscriptos</p>
                    </div>
                    <div className="border-l pl-4">
                      <p className="text-xl font-bold text-gray-600">{actividad.categorias?.length || 0}</p>
                      <p className="text-xs text-gray-500">categorías</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium flex items-center justify-between">
                <span>Ver detalle</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}

          {actividades.length === 0 && (
            <div className="col-span-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No hay actividades configuradas
            </div>
          )}
        </div>
      )}
    </div>
  )
}
