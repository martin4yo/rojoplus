import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Eye, Edit2, Trash2, Calendar, MapPin, Users, Ticket, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Modal } from '../../../components/Modal'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatDate } from '../../../utils/formatters'
import EventoDetalle from './EventoDetalle'
import EventoForm from './EventoForm'
import toast from 'react-hot-toast'

export default function EventosLista() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState([])
  const [eventoDetalle, setEventoDetalle] = useState(null)
  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const [eventoEditar, setEventoEditar] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  // Filtros
  const [filtros, setFiltros] = useState({
    tipo: '',
    estado: '',
    search: ''
  })

  useEffect(() => {
    cargarEventos()
  }, [filtros])

  async function cargarEventos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.tipo) params.append('tipo', filtros.tipo)
      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.search) params.append('search', filtros.search)

      const data = await api.get(`/eventos?${params.toString()}`)
      setEventos(data || [])
    } catch (err) {
      toast.error('Error al cargar eventos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function verDetalle(id) {
    try {
      const data = await api.get(`/eventos/${id}`)
      setEventoDetalle(data)
      setMostrarDetalle(true)
    } catch (err) {
      toast.error('Error al cargar detalle del evento')
      console.error(err)
    }
  }

  function cerrarDetalle() {
    setMostrarDetalle(false)
    setEventoDetalle(null)
    cargarEventos() // Recargar lista por si hubo cambios
  }

  function abrirFormularioNuevo() {
    setEventoEditar(null)
    setMostrarFormulario(true)
  }

  function abrirFormularioEditar(id) {
    setEventoEditar(id)
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
    setEventoEditar(null)
    cargarEventos() // Recargar lista por si hubo cambios
  }

  async function cancelarEvento(id) {
    if (!confirm('¿Cancelar este evento? Se anularán todas las entradas vendidas.')) return
    try {
      await api.delete(`/eventos/${id}`)
      toast.success('Evento cancelado exitosamente')
      cargarEventos()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cancelar evento')
    }
  }

  function getBadgeColor(estado) {
    const colors = {
      'PROGRAMADO': 'bg-blue-100 text-blue-800',
      'EN_CURSO': 'bg-green-100 text-green-800',
      'FINALIZADO': 'bg-gray-100 text-gray-800',
      'CANCELADO': 'bg-red-100 text-red-800'
    }
    return colors[estado] || 'bg-gray-100 text-gray-800'
  }

  function getTipoBadgeColor(tipo) {
    const colors = {
      'DEPORTIVO': 'bg-orange-100 text-orange-800',
      'SOCIAL': 'bg-purple-100 text-purple-800',
      'RECREATIVO': 'bg-pink-100 text-pink-800'
    }
    return colors[tipo] || 'bg-gray-100 text-gray-800'
  }

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
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Ticket className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Eventos</h1>
              <p className="text-gray-500 text-sm">
                {eventos.length} eventos registrados
              </p>
            </div>
          </div>
        </div>
        {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && (
          <Button
            onClick={abrirFormularioNuevo}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, código, descripción..."
              value={filtros.search}
              onChange={(e) => setFiltros({ ...filtros, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="DEPORTIVO">Deportivo</option>
              <option value="SOCIAL">Social</option>
              <option value="RECREATIVO">Recreativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="PROGRAMADO">Programado</option>
              <option value="EN_CURSO">En Curso</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Eventos */}
      {eventos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay eventos</h3>
          <p className="text-gray-500 mb-6">
            Comienza creando tu primer evento
          </p>
          {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && (
            <Button onClick={abrirFormularioNuevo}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Evento
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Evento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ubicación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Capacidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {eventos.map((evento) => (
                <tr key={evento.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {evento.nombre}
                      </div>
                      <div className="text-sm text-gray-500">
                        {evento.codigo}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoBadgeColor(evento.tipo)}`}>
                      {evento.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      <div>
                        <div>{formatDate(evento.fecha)}</div>
                        <div className="text-gray-500">{evento.hora}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="w-4 h-4 mr-2" />
                      {evento.espacio?.nombre || evento.ubicacion || 'No especificado'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-2 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {evento.entradasVendidas} / {evento.capacidadTotal}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round((evento.entradasVendidas / evento.capacidadTotal) * 100)}% ocupado
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBadgeColor(evento.estado)}`}>
                      {evento.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {tienePermiso(PERMISOS.EVENTOS_VER) && (
                        <button
                          onClick={() => verDetalle(evento.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && evento.estado !== 'CANCELADO' && (
                        <button
                          onClick={() => abrirFormularioEditar(evento.id)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && evento.estado === 'PROGRAMADO' && (
                        <button
                          onClick={() => cancelarEvento(evento.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Cancelar evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detalle Evento */}
      {mostrarDetalle && eventoDetalle && (
        <Modal isOpen={true} onClose={cerrarDetalle} maxWidth="max-w-6xl">
          <EventoDetalle
            eventoId={eventoDetalle.id}
            eventoData={eventoDetalle}
            onClose={cerrarDetalle}
            isModal={true}
          />
        </Modal>
      )}

      {/* Modal Formulario Evento (Crear/Editar) */}
      {mostrarFormulario && (
        <Modal isOpen={true} onClose={cerrarFormulario} maxWidth="max-w-4xl">
          <EventoForm
            eventoId={eventoEditar}
            onClose={cerrarFormulario}
            isModal={true}
          />
        </Modal>
      )}
    </div>
  )
}
