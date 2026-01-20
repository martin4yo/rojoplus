import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, ChevronRight, Search, X, User, PieChart as PieChartIcon, ArrowLeftCircle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

// Colores para el gráfico de torta
const COLORES_TORTA = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D',
  '#16A34A', '#059669', '#0D9488', '#0891B2', '#0284C7',
  '#2563EB', '#4F46E5', '#7C3AED', '#9333EA', '#C026D3',
]

// Tooltip personalizado
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <p className="font-medium text-gray-800">{data.nombre}</p>
        <p className="text-sm text-gray-600">{data.valor} inscriptos</p>
      </div>
    )
  }
  return null
}

// Componente de gráfico de torta compacto con leyenda lateral
function GraficoTorta({ datos, onSliceClick, titulo, subtitulo, onVolver }) {
  const total = datos.reduce((sum, d) => sum + d.valor, 0)
  if (total === 0) return null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {onVolver && (
            <button
              onClick={onVolver}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition bg-white border border-gray-200"
              title="Volver a actividades"
            >
              <ArrowLeftCircle className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
            {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={datos}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={2}
                dataKey="valor"
                nameKey="nombre"
                onClick={(data) => onSliceClick && onSliceClick(data)}
                style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
              >
                {datos.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORES_TORTA[index % COLORES_TORTA.length]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <p className="text-2xl font-bold text-gray-800 mt-2">{total}</p>
        <p className="text-xs text-gray-500">inscriptos</p>
      </div>

      {/* Leyenda compacta */}
      <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
        {datos.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-1 px-2 rounded text-xs ${onSliceClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            onClick={() => onSliceClick && onSliceClick(item)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORES_TORTA[i % COLORES_TORTA.length] }}
              />
              <span className="text-gray-700 truncate">{item.nombre}</span>
            </div>
            <span className="text-gray-500 ml-2 flex-shrink-0">
              {item.valor} ({((item.valor / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>

      {onSliceClick && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Clic para ver categorías
        </p>
      )}
    </div>
  )
}

export default function ReporteActividades() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actividades, setActividades] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null)

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
        /* Vista normal: Gráfico a la izquierda + Tarjetas a la derecha */
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Gráfico de Torta - Columna izquierda */}
          {actividades.length > 0 && (
            <div className="lg:w-72 flex-shrink-0">
              {actividadSeleccionada ? (
                <GraficoTorta
                  titulo={`Categorías de ${actividadSeleccionada.nombre}`}
                  subtitulo="Distribución por categoría"
                  datos={(actividadSeleccionada.categorias || []).map(cat => {
                    const inscriptosCat = actividadSeleccionada.inscriptos?.filter(
                      ins => ins.categoriaNombre === cat.nombre
                    ).length || 0
                    return {
                      id: cat.id,
                      nombre: cat.nombre,
                      valor: inscriptosCat,
                    }
                  }).filter(d => d.valor > 0)}
                  onVolver={() => setActividadSeleccionada(null)}
                />
              ) : (
                <GraficoTorta
                  titulo="Distribución por Actividad"
                  subtitulo="Inscriptos por actividad"
                  datos={actividades.map(a => ({
                    id: a.id,
                    nombre: a.nombre,
                    valor: a.totalInscriptos || 0,
                    actividad: a,
                  })).filter(d => d.valor > 0)}
                  onSliceClick={(slice) => setActividadSeleccionada(slice.actividad)}
                />
              )}
            </div>
          )}

          {/* Tarjetas de actividades - Columna derecha */}
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {actividades.map(actividad => (
                <div
                  key={actividad.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer"
                  onClick={() => navigate(`/admin/reportes/actividades/${actividad.id}`)}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-100">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800">{actividad.nombre}</h3>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{actividad.totalInscriptos}</p>
                        <p className="text-xs text-gray-500">inscriptos</p>
                      </div>
                      <div className="border-l pl-4">
                        <p className="text-lg font-bold text-gray-600">{actividad.categorias?.length || 0}</p>
                        <p className="text-xs text-gray-500">categorías</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border-t text-xs text-primary font-medium flex items-center justify-between">
                    <span>Ver detalle</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>

            {actividades.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                No hay actividades configuradas
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
