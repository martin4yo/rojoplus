import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Eye, Check, X } from 'lucide-react'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'
import api from '../../services/api'

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({
    estado: '',
    buscar: '',
    desde: '',
    hasta: ''
  })
  const [stats, setStats] = useState({
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    total: 0,
    totalMes: 0
  })
  const [selectedSolicitud, setSelectedSolicitud] = useState(null)
  const [showModalAprobar, setShowModalAprobar] = useState(false)
  const [showModalRechazar, setShowModalRechazar] = useState(false)
  const [showModalDetalle, setShowModalDetalle] = useState(false)
  const [tiposSocio, setTiposSocio] = useState([])
  const [categoriasSocio, setCategoriasSocio] = useState([])

  const [formAprobar, setFormAprobar] = useState({
    tipoSocioId: '',
    categoriaSocioId: '',
    observacionesInternas: ''
  })

  const [motivoRechazo, setMotivoRechazo] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [filtros])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams(filtros).toString()
      const [solicitudes, stats, tipos, categorias] = await Promise.all([
        api.getFull(`/admin/solicitudes${qs ? '?' + qs : ''}`),
        api.getFull('/admin/solicitudes-stats'),
        api.getFull('/admin/tipos-socio'),
        api.getFull('/admin/categorias-socio'),
      ])
      setSolicitudes(solicitudes?.data || [])
      setStats(stats?.data || {})
      setTiposSocio(tipos?.data || [])
      setCategoriasSocio(categorias?.data || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar las solicitudes')
    } finally {
      setLoading(false)
    }
  }

  const handleVerDetalle = async (id) => {
    try {
      const data = await api.getFull(`/admin/solicitudes/${id}`)
      setSelectedSolicitud(data.data)
      setShowModalDetalle(true)
    } catch (error) {
      console.error('Error al cargar solicitud:', error)
      toast.error('Error al cargar el detalle')
    }
  }

  const handleAprobar = (solicitud) => {
    setSelectedSolicitud(solicitud)
    setFormAprobar({
      tipoSocioId: '',
      categoriaSocioId: '',
      observacionesInternas: ''
    })
    setShowModalAprobar(true)
  }

  const handleRechazar = (solicitud) => {
    setSelectedSolicitud(solicitud)
    setMotivoRechazo('')
    setShowModalRechazar(true)
  }

  const confirmarAprobacion = async () => {
    if (!formAprobar.tipoSocioId) {
      toast.error('Debes seleccionar un tipo de socio')
      return
    }

    try {
      const data = await api.put(`/admin/solicitudes/${selectedSolicitud.id}/aprobar`, formAprobar)
      toast.success(`Solicitud aprobada. Socio #${data?.socioTitular?.nroSocio || 'N/A'} creado`)
      setShowModalAprobar(false)
      cargarDatos()
    } catch (error) {
      console.error('Error al aprobar:', error)
      toast.error(error.message)
    }
  }

  const confirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      toast.error('Debes especificar el motivo del rechazo')
      return
    }

    try {
      await api.put(`/admin/solicitudes/${selectedSolicitud.id}/rechazar`, { motivoRechazo })
      toast.success('Solicitud rechazada correctamente')
      setShowModalRechazar(false)
      cargarDatos()
    } catch (error) {
      console.error('Error al rechazar:', error)
      toast.error(error.message)
    }
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getBadgeEstado = (estado) => {
    const colors = {
      PENDIENTE: 'bg-yellow-100 text-yellow-800',
      APROBADA: 'bg-green-100 text-green-800',
      RECHAZADA: 'bg-red-100 text-red-800'
    }
    return colors[estado] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Solicitudes de Alta de Socios</h1>
        <p className="text-gray-600 mt-2">Gestiona las solicitudes recibidas desde el formulario público</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="text-sm text-yellow-700">Pendientes</div>
          <div className="text-2xl font-bold text-yellow-900">{stats.pendientes}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-sm text-green-700">Aprobadas</div>
          <div className="text-2xl font-bold text-green-900">{stats.aprobadas}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-sm text-red-700">Rechazadas</div>
          <div className="text-2xl font-bold text-red-900">{stats.rechazadas}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="text-sm text-blue-700">Este Mes</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalMes}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="RECHAZADA">Rechazadas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
            <input
              type="text"
              value={filtros.buscar}
              onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
              placeholder="Nombre, DNI, Email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : solicitudes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No se encontraron solicitudes
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DNI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {solicitudes.map((sol) => (
                  <tr key={sol.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{sol.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {sol.apellidos} {sol.nombres}
                      </div>
                      <div className="text-sm text-gray-500">{sol.telefono}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sol.documento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sol.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sol.actividadInscripcion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFecha(sol.fechaSolicitud)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeEstado(sol.estado)}`}>
                        {sol.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleVerDetalle(sol.id)}
                          title="Ver detalle"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sol.estado === 'PENDIENTE' && tienePermiso(PERMISOS.SOCIOS_CREAR) && (
                          <>
                            <button
                              onClick={() => handleAprobar(sol)}
                              title="Aprobar solicitud"
                              className="p-2 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-600 transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRechazar(sol)}
                              title="Rechazar solicitud"
                              className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle */}
      {showModalDetalle && selectedSolicitud && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Detalle de Solicitud #{selectedSolicitud.id}</h3>
              <button
                onClick={() => setShowModalDetalle(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Apellidos</label>
                  <p className="text-gray-900">{selectedSolicitud.apellidos}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nombres</label>
                  <p className="text-gray-900">{selectedSolicitud.nombres}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Documento</label>
                  <p className="text-gray-900">{selectedSolicitud.documento}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Fecha Nacimiento</label>
                  <p className="text-gray-900">{formatFecha(selectedSolicitud.fechaNacimiento)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{selectedSolicitud.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Teléfono</label>
                  <p className="text-gray-900">{selectedSolicitud.telefono}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Domicilio</label>
                  <p className="text-gray-900">
                    {selectedSolicitud.direccionCalle} {selectedSolicitud.direccionNumero}, {selectedSolicitud.localidad}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Actividad</label>
                  <p className="text-gray-900">{selectedSolicitud.actividadInscripcion}</p>
                </div>
                {selectedSolicitud.tieneEnfermedades && selectedSolicitud.detalleEnfermedades && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700">Condiciones Médicas</label>
                    <p className="text-gray-900">{selectedSolicitud.detalleEnfermedades}</p>
                  </div>
                )}
                {selectedSolicitud.tutorApellidos && (
                  <>
                    <div className="col-span-2 border-t pt-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Datos del Tutor</h4>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Apellidos Tutor</label>
                      <p className="text-gray-900">{selectedSolicitud.tutorApellidos}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nombres Tutor</label>
                      <p className="text-gray-900">{selectedSolicitud.tutorNombres}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Documento Tutor</label>
                      <p className="text-gray-900">{selectedSolicitud.tutorDocumento}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Teléfono Tutor</label>
                      <p className="text-gray-900">{selectedSolicitud.tutorTelefono}</p>
                    </div>
                  </>
                )}
                {selectedSolicitud.estado !== 'PENDIENTE' && (
                  <>
                    <div className="col-span-2 border-t pt-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Información de Procesamiento</h4>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Estado</label>
                      <p>
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeEstado(selectedSolicitud.estado)}`}>
                          {selectedSolicitud.estado}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fecha Respuesta</label>
                      <p className="text-gray-900">{formatFecha(selectedSolicitud.fechaRespuesta)}</p>
                    </div>
                    {selectedSolicitud.respondidoPorAdmin && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700">Procesado por</label>
                        <p className="text-gray-900">
                          {selectedSolicitud.respondidoPorAdmin.nombre} {selectedSolicitud.respondidoPorAdmin.apellido}
                        </p>
                      </div>
                    )}
                    {selectedSolicitud.socioCreatedRel && (
                      <div className="col-span-2 bg-green-50 p-3 rounded-lg">
                        <label className="text-sm font-medium text-green-700">Socio Creado</label>
                        <p className="text-green-900 font-semibold">
                          #{selectedSolicitud.socioCreatedRel.nroSocio} - {selectedSolicitud.socioCreatedRel.apellidoNombre}
                        </p>
                      </div>
                    )}
                    {selectedSolicitud.motivoRechazo && (
                      <div className="col-span-2 bg-red-50 p-3 rounded-lg">
                        <label className="text-sm font-medium text-red-700">Motivo de Rechazo</label>
                        <p className="text-red-900">{selectedSolicitud.motivoRechazo}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {selectedSolicitud.estado === 'PENDIENTE' && tienePermiso(PERMISOS.SOCIOS_CREAR) && (
                <>
                  <button
                    onClick={() => {
                      setShowModalDetalle(false)
                      handleAprobar(selectedSolicitud)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => {
                      setShowModalDetalle(false)
                      handleRechazar(selectedSolicitud)
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Rechazar
                  </button>
                </>
              )}
              <button
                onClick={() => setShowModalDetalle(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aprobar */}
      {showModalAprobar && selectedSolicitud && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Aprobar Solicitud</h3>
              <p className="text-gray-600 mt-2">
                {selectedSolicitud.apellidos} {selectedSolicitud.nombres} - DNI: {selectedSolicitud.documento}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Socio <span className="text-red-500">*</span>
                </label>
                <select
                  value={formAprobar.tipoSocioId}
                  onChange={(e) => setFormAprobar({ ...formAprobar, tipoSocioId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {tiposSocio.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría de Socio</label>
                <select
                  value={formAprobar.categoriaSocioId}
                  onChange={(e) => setFormAprobar({ ...formAprobar, categoriaSocioId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Ninguna</option>
                  {categoriasSocio.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre} ({cat.porcentajeDescuento}% descuento)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones Internas</label>
                <textarea
                  value={formAprobar.observacionesInternas}
                  onChange={(e) => setFormAprobar({ ...formAprobar, observacionesInternas: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Notas internas (no visibles para el socio)..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModalAprobar(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAprobacion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar Aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {showModalRechazar && selectedSolicitud && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Rechazar Solicitud</h3>
              <p className="text-gray-600 mt-2">
                {selectedSolicitud.apellidos} {selectedSolicitud.nombres} - DNI: {selectedSolicitud.documento}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del Rechazo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Explica el motivo del rechazo. Este mensaje será enviado al solicitante..."
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Este mensaje será enviado por email al solicitante
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModalRechazar(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRechazo}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
