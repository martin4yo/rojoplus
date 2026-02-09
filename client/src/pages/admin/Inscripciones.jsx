import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Edit2, X, Search, Filter, UserMinus, Download } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function Inscripciones() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Datos
  const [inscripciones, setInscripciones] = useState([])
  const [actividades, setActividades] = useState([])
  const [categorias, setCategorias] = useState([])
  const [sociosBuscados, setSociosBuscados] = useState([])

  // Filtros
  const [actividadId, setActividadId] = useState('')
  const [categoriaActividadId, setCategoriaActividadId] = useState('')
  const [estado, setEstado] = useState('')
  const [search, setSearch] = useState('')

  // Paginación
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  // Modales
  const [modalNueva, setModalNueva] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalBaja, setModalBaja] = useState(false)
  const [inscripcionSeleccionada, setInscripcionSeleccionada] = useState(null)

  // Formulario nueva inscripción
  const [formNueva, setFormNueva] = useState({
    socioId: '',
    actividadId: '',
    categoriaActividadId: '',
    exentoCuota: false,
    porcentajeCuota: 100,
    observaciones: ''
  })

  // Búsqueda de socio
  const [busquedaSocio, setBusquedaSocio] = useState('')
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  // Formulario editar
  const [formEditar, setFormEditar] = useState({
    exentoCuota: false,
    porcentajeCuota: 100,
    observaciones: ''
  })

  // Formulario baja
  const [motivoBaja, setMotivoBaja] = useState('')

  useEffect(() => {
    cargarActividades()
  }, [])

  useEffect(() => {
    cargarInscripciones()
  }, [page, actividadId, categoriaActividadId, estado])

  useEffect(() => {
    if (actividadId) {
      cargarCategorias(actividadId)
    } else {
      setCategorias([])
      setCategoriaActividadId('')
    }
  }, [actividadId])

  async function cargarInscripciones() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (actividadId) params.append('actividadId', actividadId)
      if (categoriaActividadId) params.append('categoriaId', categoriaActividadId)
      if (estado) params.append('estado', estado)
      if (search) params.append('q', search)

      // Usar getFull para obtener data + pagination
      const response = await api.getFull(`/admin/inscripciones?${params}`)
      setInscripciones(response?.data || [])
      setPagination(response?.pagination || null)
    } catch (err) {
      console.error('Error cargando inscripciones:', err)
      setError('Error al cargar inscripciones')
    } finally {
      setLoading(false)
    }
  }

  async function cargarActividades() {
    try {
      const data = await api.get('/admin/actividades')
      setActividades(data || [])
    } catch (err) {
      console.error('Error al cargar actividades:', err)
    }
  }

  async function cargarCategorias(actividadId) {
    try {
      const data = await api.get(`/admin/actividades/${actividadId}?soloActivas=true`)
      setCategorias(data?.categorias || [])
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    }
  }

  async function buscarSocio(query) {
    if (!query || query.length < 2) {
      setSociosBuscados([])
      return
    }

    setBuscandoSocio(true)
    try {
      // Solo buscar socios activos o vigentes para inscripciones
      const data = await api.get(`/admin/socios?q=${encodeURIComponent(query)}&limit=10&estadosValidos=ACTIVO,VIGENTE`)
      setSociosBuscados(data?.socios || [])
    } catch (err) {
      console.error('Error al buscar socios:', err)
    } finally {
      setBuscandoSocio(false)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    setPage(1)
    cargarInscripciones()
  }

  function limpiarFiltros() {
    setActividadId('')
    setCategoriaActividadId('')
    setEstado('')
    setSearch('')
    setPage(1)
  }

  async function crearInscripcion(e) {
    e.preventDefault()
    setError(null)

    if (!formNueva.socioId || !formNueva.categoriaActividadId) {
      setError('Socio y categoría son obligatorios')
      return
    }

    console.log('Enviando inscripción:', formNueva)
    try {
      await api.post('/admin/inscripciones', formNueva)
      setSuccess('Inscripción creada exitosamente')
      setModalNueva(false)
      setFormNueva({
        socioId: '',
        actividadId: '',
        categoriaActividadId: '',
        exentoCuota: false,
        porcentajeCuota: 100,
        observaciones: ''
      })
      setSociosBuscados([])
      setBusquedaSocio('')
      cargarInscripciones()
    } catch (err) {
      console.error('Error al crear inscripción:', err)
      setError(err.message || 'Error al crear inscripción')
    }
  }

  async function editarInscripcion(e) {
    e.preventDefault()
    setError(null)

    try {
      await api.put(`/admin/inscripciones/${inscripcionSeleccionada.id}`, formEditar)
      setSuccess('Inscripción actualizada')
      setModalEditar(false)
      cargarInscripciones()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al actualizar inscripción')
    }
  }

  async function darDeBaja(e) {
    e.preventDefault()
    setError(null)

    if (!motivoBaja.trim()) {
      setError('El motivo de baja es obligatorio')
      return
    }

    try {
      await api.delete(`/admin/inscripciones/${inscripcionSeleccionada.id}`, {
        data: { motivo: motivoBaja }
      })
      setSuccess('Inscripción dada de baja')
      setModalBaja(false)
      setMotivoBaja('')
      cargarInscripciones()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al dar de baja')
    }
  }

  function abrirModalEditar(inscripcion) {
    setInscripcionSeleccionada(inscripcion)
    setFormEditar({
      exentoCuota: inscripcion.exentoCuota || false,
      porcentajeCuota: inscripcion.porcentajeCuota || 100,
      observaciones: inscripcion.observaciones || ''
    })
    setModalEditar(true)
  }

  function abrirModalBaja(inscripcion) {
    setInscripcionSeleccionada(inscripcion)
    setMotivoBaja('')
    setModalBaja(true)
  }

  async function exportarPlantel(categoriaId) {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/categorias-actividad/${categoriaId}/plantel/excel`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        }
      )

      if (!response.ok) throw new Error('Error al exportar')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plantel_categoria_${categoriaId}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Error al exportar plantel')
      console.error(err)
    }
  }

  if (loading && inscripciones.length === 0) {
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
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <ClipboardList className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Inscripciones</h1>
            <p className="text-gray-500 text-sm">
              {pagination?.total || 0} inscripciones totales
            </p>
          </div>
        </div>
        {tienePermiso(PERMISOS.INSCRIPCIONES_GESTIONAR) && (
          <Button
            onClick={() => setModalNueva(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Inscripción
          </Button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} className="mb-4">
          {success}
        </Alert>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
          <button
            onClick={limpiarFiltros}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Actividad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Actividad
            </label>
            <select
              value={actividadId}
              onChange={(e) => { setActividadId(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las actividades</option>
              {actividades.map(act => (
                <option key={act.id} value={act.id}>{act.nombre}</option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={categoriaActividadId}
              onChange={(e) => { setCategoriaActividadId(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!actividadId}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVA">Activa</option>
              <option value="INACTIVA">Inactiva</option>
            </select>
          </div>

          {/* Búsqueda */}
          <form onSubmit={handleBuscar}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar socio
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o documento..."
                className="w-full px-3 py-2 pl-9 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </form>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuota
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inscripciones.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No se encontraron inscripciones
                  </td>
                </tr>
              ) : (
                inscripciones.map(inscripcion => (
                  <tr key={inscripcion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {inscripcion.socio?.apellidoNombre || `${inscripcion.socio?.apellidos || ''}, ${inscripcion.socio?.nombres || ''}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        #{inscripcion.socio?.nroSocio || inscripcion.socio?.numeroSocio} - {inscripcion.socio?.documento || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inscripcion.categoriaActividad.actividad.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inscripcion.categoriaActividad.nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        inscripcion.estado === 'ACTIVA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {inscripcion.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(inscripcion.fechaInicio).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inscripcion.exentoCuota ? (
                        <span className="text-green-600 font-semibold">Exento</span>
                      ) : inscripcion.porcentajeCuota !== 100 ? (
                        <span>{inscripcion.porcentajeCuota}%</span>
                      ) : (
                        <span>100%</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {tienePermiso(PERMISOS.INSCRIPCIONES_GESTIONAR) && (
                        <button
                          onClick={() => abrirModalEditar(inscripcion)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {tienePermiso(PERMISOS.INSCRIPCIONES_GESTIONAR) && inscripcion.estado === 'ACTIVA' && (
                        <button
                          onClick={() => abrirModalBaja(inscripcion)}
                          className="text-red-600 hover:text-red-900"
                          title="Dar de baja"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(page - 1) * 50 + 1} a {Math.min(page * 50, pagination.total)} de {pagination.total} inscripciones
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-500">
                Página {page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nueva Inscripción */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Nueva Inscripción</h2>
              <button
                onClick={() => {
                  setModalNueva(false)
                  setFormNueva({
                    socioId: '',
                    actividadId: '',
                    categoriaActividadId: '',
                    exentoCuota: false,
                    porcentajeCuota: 100,
                    observaciones: ''
                  })
                  setSociosBuscados([])
                  setBusquedaSocio('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={crearInscripcion} className="p-6 space-y-4">
              {/* Buscar Socio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Socio *
                </label>
                <input
                  type="text"
                  value={busquedaSocio}
                  onChange={(e) => {
                    setBusquedaSocio(e.target.value)
                    buscarSocio(e.target.value)
                  }}
                  placeholder="Buscar por nombre o documento..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!!formNueva.socioId}
                />

                {/* Resultados búsqueda */}
                {sociosBuscados.length > 0 && !formNueva.socioId && (
                  <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                    {sociosBuscados.map(socio => (
                      <button
                        key={socio.id}
                        type="button"
                        onClick={() => {
                          setFormNueva(prev => ({ ...prev, socioId: socio.id }))
                          setBusquedaSocio(`${socio.apellidoNombre} (${socio.documento || socio.nroSocio})`)
                          setSociosBuscados([])
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                      >
                        <div className="font-medium">{socio.apellidoNombre}</div>
                        <div className="text-sm text-gray-500">#{socio.nroSocio} - DNI: {socio.documento || '-'}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Socio seleccionado */}
                {formNueva.socioId && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-blue-800">{busquedaSocio}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormNueva(prev => ({ ...prev, socioId: '' }))
                        setBusquedaSocio('')
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actividad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actividad *
                </label>
                <select
                  value={formNueva.actividadId}
                  onChange={(e) => {
                    const actId = e.target.value
                    setFormNueva(prev => ({
                      ...prev,
                      actividadId: actId,
                      categoriaActividadId: ''
                    }))
                    if (actId) cargarCategorias(actId)
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar actividad</option>
                  {actividades.map(act => (
                    <option key={act.id} value={act.id}>{act.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría *
                </label>
                <select
                  value={formNueva.categoriaActividadId}
                  onChange={(e) => setFormNueva(prev => ({ ...prev, categoriaActividadId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!formNueva.actividadId}
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                      {cat.edadMinima || cat.edadMaxima ? ` (${cat.edadMinima || 0}-${cat.edadMaxima || '+'} años)` : ''}
                      {cat.cupoMaximo ? ` - Cupo: ${cat.cupoMaximo}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exento Cuota */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formNueva.exentoCuota}
                    onChange={(e) => setFormNueva(prev => ({ ...prev, exentoCuota: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Exento de cuota</span>
                </label>
              </div>

              {/* Porcentaje Cuota */}
              {!formNueva.exentoCuota && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porcentaje de Cuota (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formNueva.porcentajeCuota}
                    onChange={(e) => setFormNueva(prev => ({ ...prev, porcentajeCuota: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formNueva.observaciones}
                  onChange={(e) => setFormNueva(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones opcionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalNueva(false)
                    setFormNueva({
                      socioId: '',
                      actividadId: '',
                      categoriaActividadId: '',
                      exentoCuota: false,
                      porcentajeCuota: 100,
                      observaciones: ''
                    })
                    setSociosBuscados([])
                    setBusquedaSocio('')
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Crear Inscripción
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Inscripción */}
      {modalEditar && inscripcionSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Editar Inscripción</h2>
              <button
                onClick={() => setModalEditar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editarInscripcion} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg mb-4">
                <div className="text-sm text-gray-600">Socio:</div>
                <div className="font-medium">{inscripcionSeleccionada.socio?.apellidoNombre || `${inscripcionSeleccionada.socio?.apellidos}, ${inscripcionSeleccionada.socio?.nombres}`}</div>
                <div className="text-sm text-gray-600 mt-1">Actividad:</div>
                <div className="font-medium">{inscripcionSeleccionada.categoriaActividad?.actividad?.nombre} - {inscripcionSeleccionada.categoriaActividad?.nombre}</div>
              </div>

              {/* Exento Cuota */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formEditar.exentoCuota}
                    onChange={(e) => setFormEditar(prev => ({ ...prev, exentoCuota: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Exento de cuota</span>
                </label>
              </div>

              {/* Porcentaje Cuota */}
              {!formEditar.exentoCuota && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porcentaje de Cuota (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formEditar.porcentajeCuota}
                    onChange={(e) => setFormEditar(prev => ({ ...prev, porcentajeCuota: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formEditar.observaciones}
                  onChange={(e) => setFormEditar(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones opcionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalEditar(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dar de Baja */}
      {modalBaja && inscripcionSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Dar de Baja</h2>
              <button
                onClick={() => setModalBaja(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={darDeBaja} className="p-6 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-800">
                  ¿Está seguro de dar de baja esta inscripción?
                </div>
                <div className="font-medium mt-2">{inscripcionSeleccionada.socio?.apellidoNombre || `${inscripcionSeleccionada.socio?.apellidos}, ${inscripcionSeleccionada.socio?.nombres}`}</div>
                <div className="text-sm text-gray-600">{inscripcionSeleccionada.categoriaActividad?.actividad?.nombre} - {inscripcionSeleccionada.categoriaActividad?.nombre}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de Baja *
                </label>
                <textarea
                  value={motivoBaja}
                  onChange={(e) => setMotivoBaja(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Ingrese el motivo de la baja..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalBaja(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">
                  Confirmar Baja
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
