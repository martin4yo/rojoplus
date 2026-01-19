import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, UserCheck, UserX, UserPlus, PieChart } from 'lucide-react'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function ReporteSocios() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    porEstado: [],
    porTipo: [],
    porCategoria: [],
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      // Obtener todos los socios para calcular estadísticas
      const [sociosResp, estados, tipos, categorias] = await Promise.all([
        api.get('/admin/socios?limit=10000'),
        api.get('/admin/configuracion/estados-socio'),
        api.get('/admin/configuracion/tipos-socio'),
        api.get('/admin/configuracion/categorias-socio'),
      ])

      const socios = sociosResp.data || sociosResp || []

      // Agrupar por estado
      const porEstado = (estados || []).map(e => ({
        ...e,
        cantidad: socios.filter(s => s.estado === e.nombre || s.estadoSocioId === e.id).length
      })).sort((a, b) => b.cantidad - a.cantidad)

      // Agrupar por tipo
      const porTipo = (tipos || []).map(t => ({
        ...t,
        cantidad: socios.filter(s => s.tipoSocio === t.nombre || s.tipoSocioRelId === t.id).length
      })).sort((a, b) => b.cantidad - a.cantidad)

      // Agrupar por categoría
      const porCategoria = (categorias || []).map(c => ({
        ...c,
        cantidad: socios.filter(s => s.categoria === c.nombre || s.categoriaSocioId === c.id).length
      })).sort((a, b) => b.cantidad - a.cantidad)

      setEstadisticas({
        total: socios.length,
        porEstado,
        porTipo,
        porCategoria,
      })
    } catch (err) {
      setError('Error al cargar estadísticas de socios')
    } finally {
      setLoading(false)
    }
  }

  // Colores para las barras
  const coloresEstado = {
    'VIGENTE': 'bg-green-500',
    'ACTIVO': 'bg-green-500',
    'BAJA': 'bg-red-500',
    'SUSPENDIDO': 'bg-yellow-500',
    'PENDIENTE': 'bg-blue-500',
  }

  function getColorEstado(nombre) {
    for (const [key, color] of Object.entries(coloresEstado)) {
      if (nombre?.toUpperCase().includes(key)) return color
    }
    return 'bg-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const sociosActivos = estadisticas.porEstado.find(e =>
    e.nombre?.toUpperCase().includes('VIGENTE') || e.nombre?.toUpperCase().includes('ACTIVO')
  )?.cantidad || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/reportes')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reporte de Socios</h1>
          <p className="text-gray-500 text-sm">Estadísticas de membresía</p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      {/* Resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Socios</p>
              <p className="text-3xl font-bold text-gray-800">{estadisticas.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-100">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Socios Activos</p>
              <p className="text-3xl font-bold text-green-600">{sociosActivos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gray-100">
              <PieChart className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">% Activos</p>
              <p className="text-3xl font-bold text-gray-800">
                {estadisticas.total > 0 ? Math.round((sociosActivos / estadisticas.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por Estado, Tipo y Categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por Estado */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Por Estado</h2>
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porEstado.map(estado => (
              <div key={estado.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{estado.nombre}</span>
                  <span className="font-medium text-gray-800">{estado.cantidad}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getColorEstado(estado.nombre)}`}
                    style={{ width: `${estadisticas.total > 0 ? (estado.cantidad / estadisticas.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {estadisticas.porEstado.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Por Tipo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Por Tipo</h2>
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porTipo.map((tipo, idx) => (
              <div key={tipo.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{tipo.nombre}</span>
                  <span className="font-medium text-gray-800">{tipo.cantidad}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${['bg-primary', 'bg-blue-500', 'bg-purple-500', 'bg-indigo-500'][idx % 4]}`}
                    style={{ width: `${estadisticas.total > 0 ? (tipo.cantidad / estadisticas.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {estadisticas.porTipo.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Por Categoría */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Por Categoría</h2>
          </div>
          <div className="p-4 space-y-3">
            {estadisticas.porCategoria.map((cat, idx) => (
              <div key={cat.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{cat.nombre}</span>
                  <span className="font-medium text-gray-800">{cat.cantidad}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${['bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-cyan-500'][idx % 4]}`}
                    style={{ width: `${estadisticas.total > 0 ? (cat.cantidad / estadisticas.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {estadisticas.porCategoria.length === 0 && (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
