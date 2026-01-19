import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Tag, Activity, Dumbbell, UserCheck, Wallet } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function TablasAuxiliares() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [tiposSocio, setTiposSocio] = useState([])
  const [categoriasSocio, setCategoriasSocio] = useState([])
  const [estadosSocio, setEstadosSocio] = useState([])
  const [actividades, setActividades] = useState([])
  const [entrenadores, setEntrenadores] = useState([])
  const [conceptosTesoreria, setConceptosTesoreria] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [tipos, categorias, estados, acts, entrens, conceptos] = await Promise.all([
        api.get('/admin/tipos-socio'),
        api.get('/admin/categorias-socio'),
        api.get('/admin/estados-socio'),
        api.get('/admin/actividades'),
        api.get('/admin/entrenadores'),
        api.get('/admin/conceptos-tesoreria'),
      ])
      setTiposSocio(tipos || [])
      setCategoriasSocio(categorias || [])
      setEstadosSocio(estados || [])
      setActividades(acts || [])
      setEntrenadores(entrens || [])
      setConceptosTesoreria(conceptos || [])
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const tarjetasSocios = [
    { tipo: 'tipos-socio', titulo: 'Tipos de Socio', icono: Tag, items: tiposSocio, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { tipo: 'categorias-socio', titulo: 'Categorías', icono: Users, items: categoriasSocio, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { tipo: 'estados-socio', titulo: 'Estados', icono: Activity, items: estadosSocio, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
  ]

  const totalCategorias = actividades.reduce((acc, a) => acc + (a.cantidadCategorias || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-gray-500 mt-1">Administra las tablas auxiliares del sistema</p>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Sección: Socios */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Socios</h2>
        <div className="flex flex-wrap gap-6">
          {tarjetasSocios.map(t => (
            <div
              key={t.tipo}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
              onClick={() => navigate(`/admin/configuracion/${t.tipo}`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${t.bgColor}`}>
                    <t.icono className={`w-6 h-6 ${t.iconColor}`} />
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/configuracion/${t.tipo}/nuevo`) }}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo
                  </Button>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-semibold text-gray-800">{t.titulo}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{t.items.length}</p>
                  <p className="text-xs text-gray-500">registros</p>
                </div>
              </div>
              <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                Ver listado →
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección: Actividades */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Actividades</h2>
        <div className="flex flex-wrap gap-6">
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
            onClick={() => navigate('/admin/actividades')}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-orange-100">
                  <Dumbbell className="w-6 h-6 text-orange-600" />
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/actividades/nueva') }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nueva
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800">Actividades</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{actividades.length}</p>
                <p className="text-xs text-gray-500">{totalCategorias} categorías</p>
              </div>
            </div>
            <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
              Ver listado →
            </div>
          </div>

          {/* Entrenadores */}
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
            onClick={() => navigate('/admin/entrenadores')}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-teal-100">
                  <UserCheck className="w-6 h-6 text-teal-600" />
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/entrenadores/nuevo') }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800">Entrenadores</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{entrenadores.length}</p>
                <p className="text-xs text-gray-500">
                  {entrenadores.filter(e => e.activo).length} activos
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
              Ver listado →
            </div>
          </div>
        </div>
      </div>

      {/* Sección: Tesorería */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Tesorería</h2>
        <div className="flex flex-wrap gap-6">
          {/* Conceptos de Tesorería */}
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
            onClick={() => navigate('/admin/configuracion/conceptos-tesoreria')}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-emerald-100">
                  <Wallet className="w-6 h-6 text-emerald-600" />
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/conceptos-tesoreria/nuevo') }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800">Conceptos</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{conceptosTesoreria.length}</p>
                <p className="text-xs text-gray-500">
                  {conceptosTesoreria.filter(c => c.activo).length} activos
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
              Ver listado →
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
