import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Calendar, MapPin, Users, Ticket,
  TrendingUp, Plus, Trash2, Save, X, Download, Eye, Mail
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { formatDate, formatCurrency } from '../../../utils/formatters'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function EventoDetalle({ eventoId, eventoData, onClose, isModal = false }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const { id: paramId } = useParams()
  const navigate = useNavigate()

  const id = eventoId || paramId

  const [loading, setLoading] = useState(!eventoData)
  const [evento, setEvento] = useState(eventoData || null)
  const [categorias, setCategorias] = useState([])
  const [entradas, setEntradas] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [estadisticas, setEstadisticas] = useState(null)

  const [tabActual, setTabActual] = useState('info')

  // Estados para CRUD categorías
  const [editandoCategoria, setEditandoCategoria] = useState(null)
  const [nuevaCategoria, setNuevaCategoria] = useState(false)
  const [formCategoria, setFormCategoria] = useState({
    nombre: '',
    descripcion: '',
    precioSocio: '',
    precioNoSocio: '',
    capacidad: '',
    activo: true,
    orden: 0
  })

  // Filtros ventas
  const [filtrosVentas, setFiltrosVentas] = useState({
    estado: '',
    categoria: '',
    canal: ''
  })

  // Modal de email
  const [mostrarModalEmail, setMostrarModalEmail] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')
  const [entradaSeleccionada, setEntradaSeleccionada] = useState(null)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  useEffect(() => {
    if (!eventoData && id) {
      cargarEvento()
    } else if (eventoData) {
      // Si se pasaron datos, cargar las estadísticas si están
      if (eventoData.estadisticas) {
        setEstadisticas(eventoData.estadisticas)
      }
    }
  }, [id, eventoData])

  useEffect(() => {
    if (tabActual === 'categorias') cargarCategorias()
    if (tabActual === 'ventas') cargarVentas()
    if (tabActual === 'ingresos') cargarIngresos()
    if (tabActual === 'estadisticas') cargarEstadisticas()
  }, [tabActual, filtrosVentas])

  async function cargarEvento() {
    setLoading(true)
    try {
      const data = await api.get(`/eventos/${id}`)
      setEvento(data)
    } catch (err) {
      toast.error('Error al cargar evento')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function cargarCategorias() {
    try {
      const data = await api.get(`/eventos/${id}/categorias`)
      setCategorias(data || [])
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    }
  }

  async function cargarVentas() {
    try {
      const params = new URLSearchParams()
      if (filtrosVentas.estado) params.append('estado', filtrosVentas.estado)
      if (filtrosVentas.categoria) params.append('categoriaId', filtrosVentas.categoria)
      if (filtrosVentas.canal) params.append('canal', filtrosVentas.canal)

      const data = await api.get(`/eventos/${id}/entradas?${params.toString()}`)
      setEntradas(data || [])
    } catch (err) {
      console.error('Error al cargar ventas:', err)
    }
  }

  async function descargarQRLote(entrada) {
    try {
      // Buscar todas las entradas del mismo lote (mismo movimientoCajaId y comprador)
      const entradasLote = entrada.movimientoCajaId
        ? entradas.filter(e => e.movimientoCajaId === entrada.movimientoCajaId && e.estado !== 'ANULADA')
        : [entrada]

      const codigos = entradasLote.map(e => e.codigo)

      const response = await api.downloadFile('/eventos/generar-pdf-entradas', {
        codigos,
        nombreComprador: entrada.nombreComprador
      })

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const ext = blob.type === 'application/zip' ? 'zip' : 'pdf'
      const safeName = (entrada.nombreComprador || 'entradas').replace(/\s/g, '_')
      link.download = `entradas-${safeName}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(ext === 'zip' ? 'ZIP con entradas descargado' : 'Entrada descargada')
    } catch (err) {
      toast.error(err.message || 'Error al generar PDF')
    }
  }

  function enviarQRPorEmail(entrada) {
    setEntradaSeleccionada(entrada)
    setEmailDestino(entrada.emailComprador || '')
    setMostrarModalEmail(true)
  }

  async function confirmarEnvioEmail() {
    if (!emailDestino || !emailDestino.includes('@')) {
      toast.error('Ingrese un email válido')
      return
    }

    setEnviandoEmail(true)
    try {
      // Buscar todas las entradas del mismo lote
      const entradasLote = entradaSeleccionada.movimientoCajaId
        ? entradas.filter(e => e.movimientoCajaId === entradaSeleccionada.movimientoCajaId && e.estado !== 'ANULADA')
        : [entradaSeleccionada]

      const codigos = entradasLote.map(e => e.codigo)

      await api.post('/eventos/enviar-entradas', {
        codigos,
        email: emailDestino,
        nombreComprador: entradaSeleccionada.nombreComprador
      })

      toast.success(`Entradas enviadas a ${emailDestino}`)
      setMostrarModalEmail(false)
      setEmailDestino('')
      setEntradaSeleccionada(null)
    } catch (err) {
      toast.error(err.message || 'Error al enviar entradas por email')
    } finally {
      setEnviandoEmail(false)
    }
  }

  async function cargarIngresos() {
    try {
      const data = await api.get(`/eventos/${id}/ingresos`)
      setIngresos(data || [])
    } catch (err) {
      console.error('Error al cargar ingresos:', err)
    }
  }

  async function cargarEstadisticas() {
    try {
      const data = await api.get(`/eventos/${id}/estadisticas`)
      setEstadisticas(data)
    } catch (err) {
      console.error('Error al cargar estadísticas:', err)
    }
  }

  // CRUD Categorías
  function iniciarNuevaCategoria() {
    setNuevaCategoria(true)
    setEditandoCategoria(null)
    setFormCategoria({
      nombre: '',
      descripcion: '',
      precioSocio: '',
      precioNoSocio: '',
      capacidad: '',
      activo: true,
      orden: categorias.length + 1
    })
  }

  function iniciarEdicionCategoria(categoria) {
    setEditandoCategoria(categoria.id)
    setNuevaCategoria(false)
    setFormCategoria({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      precioSocio: categoria.precioSocio,
      precioNoSocio: categoria.precioNoSocio,
      capacidad: categoria.capacidad || '',
      activo: categoria.activo,
      orden: categoria.orden
    })
  }

  function cancelarEdicion() {
    setNuevaCategoria(false)
    setEditandoCategoria(null)
  }

  async function guardarCategoria() {
    try {
      const data = {
        ...formCategoria,
        precioSocio: parseFloat(formCategoria.precioSocio),
        precioNoSocio: parseFloat(formCategoria.precioNoSocio),
        capacidad: formCategoria.capacidad ? parseInt(formCategoria.capacidad) : null
      }

      if (nuevaCategoria) {
        await api.post(`/eventos/${id}/categorias`, data)
        toast.success('Categoría creada exitosamente')
      } else {
        await api.put(`/eventos/categorias/${editandoCategoria}`, data)
        toast.success('Categoría actualizada exitosamente')
      }

      cancelarEdicion()
      cargarCategorias()
      cargarEvento() // Actualizar stats
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar categoría')
    }
  }

  async function eliminarCategoria(categoriaId) {
    const confirmed = await confirm('¿Eliminar esta categoría?', 'Esta accion no se puede deshacer.')
    if (!confirmed) return
    try {
      await api.delete(`/eventos/categorias/${categoriaId}`)
      toast.success('Categoría eliminada')
      cargarCategorias()
      cargarEvento()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar categoría')
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

  function getEstadoEntradaBadge(estado) {
    const colors = {
      'VALIDA': 'bg-green-100 text-green-800',
      'USADA': 'bg-gray-100 text-gray-800',
      'ANULADA': 'bg-red-100 text-red-800'
    }
    return colors[estado] || 'bg-gray-100 text-gray-800'
  }

  function getCanalBadge(canal) {
    const colors = {
      'ADMIN': 'bg-purple-100 text-purple-800',
      'PORTAL_SOCIO': 'bg-blue-100 text-blue-800',
      'SITIO_WEB': 'bg-green-100 text-green-800',
      'BUFFET': 'bg-orange-100 text-orange-800'
    }
    return colors[canal] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (!evento) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Evento no encontrado</p>
      </div>
    )
  }

  return (
    <div>
      <ConfirmDialog />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {!isModal && (
            <button
              onClick={() => navigate('/admin/eventos')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Ticket className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{evento.nombre}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-500 text-sm">{evento.codigo}</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBadgeColor(evento.estado)}`}>
                  {evento.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
        {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && evento.estado !== 'CANCELADO' && (
          <Button
            onClick={() => {
              if (isModal && onClose) {
                onClose()
              }
              navigate(`/admin/eventos/${id}/editar`)
            }}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'info', label: 'Información', icon: Calendar },
              { id: 'categorias', label: 'Categorías', icon: Ticket },
              { id: 'ventas', label: 'Ventas', icon: TrendingUp },
              { id: 'ingresos', label: 'Ingresos', icon: Users },
              { id: 'estadisticas', label: 'Estadísticas', icon: TrendingUp }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm ${
                  tabActual === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 min-h-[400px]">
          {/* Tab Info */}
          {tabActual === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tipo</h3>
                  <p className="text-gray-900">{evento.tipo}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Fecha y Hora</h3>
                  <div className="flex items-center text-gray-900">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {formatDate(evento.fecha)} - {evento.hora}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Ubicación</h3>
                  <div className="flex items-center text-gray-900">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    {evento.espacio?.nombre || evento.ubicacion || 'No especificado'}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Capacidad</h3>
                  <div className="flex items-center text-gray-900">
                    <Users className="w-4 h-4 mr-2 text-gray-400" />
                    {evento.entradasVendidas} / {evento.capacidadTotal}
                    <span className="ml-2 text-sm text-gray-500">
                      ({Math.round((evento.entradasVendidas / evento.capacidadTotal) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>

              {evento.descripcion && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Descripción</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{evento.descripcion}</p>
                </div>
              )}

              {evento.partido && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Partido Vinculado</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium">
                      {evento.partido.categoriaActividad?.nombre || 'Local'} vs {evento.partido.rival}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(evento.partido.fecha)} - {evento.partido.hora}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Apertura</h3>
                  <p className="text-gray-900">{evento.horaApertura || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Finalización</h3>
                  <p className="text-gray-900">{evento.horaFin || '-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Ventas</h3>
                  <p className="text-gray-900">
                    {evento.ventasHabilitadas ? (
                      <span className="text-green-600">Habilitadas</span>
                    ) : (
                      <span className="text-red-600">Deshabilitadas</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Categorías */}
          {tabActual === 'categorias' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Categorías de Entrada ({categorias.length})
                </h3>
                {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && !nuevaCategoria && !editandoCategoria && (
                  <Button onClick={iniciarNuevaCategoria} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nueva Categoría
                  </Button>
                )}
              </div>

              {/* Formulario Nueva/Editar */}
              {(nuevaCategoria || editandoCategoria) && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    {nuevaCategoria ? 'Nueva Categoría' : 'Editar Categoría'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formCategoria.nombre}
                        onChange={(e) => setFormCategoria({ ...formCategoria, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        placeholder="Ej: General, VIP, Platea"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacidad
                      </label>
                      <input
                        type="number"
                        value={formCategoria.capacidad}
                        onChange={(e) => setFormCategoria({ ...formCategoria, capacidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        placeholder="Dejar vacío para ilimitado"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Socio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCategoria.precioSocio}
                        onChange={(e) => setFormCategoria({ ...formCategoria, precioSocio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio No Socio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCategoria.precioNoSocio}
                        onChange={(e) => setFormCategoria({ ...formCategoria, precioNoSocio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        value={formCategoria.descripcion}
                        onChange={(e) => setFormCategoria({ ...formCategoria, descripcion: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Button onClick={guardarCategoria} className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Guardar
                    </Button>
                    <Button onClick={cancelarEdicion} variant="secondary" className="flex items-center gap-2">
                      <X className="w-4 h-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista Categorías */}
              {categorias.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay categorías creadas
                </div>
              ) : (
                <div className="space-y-3">
                  {categorias.map(categoria => (
                    <div key={categoria.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{categoria.nombre}</h4>
                            {!categoria.activo && (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                Inactiva
                              </span>
                            )}
                          </div>
                          {categoria.descripcion && (
                            <p className="text-sm text-gray-500 mt-1">{categoria.descripcion}</p>
                          )}
                          <div className="flex items-center gap-6 mt-2 text-sm">
                            <div>
                              <span className="text-gray-500">Socio:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {formatCurrency(categoria.precioSocio)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">No Socio:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {formatCurrency(categoria.precioNoSocio)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Vendidas:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {categoria.entradasVendidas}
                                {categoria.capacidad && ` / ${categoria.capacidad}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        {tienePermiso(PERMISOS.EVENTOS_GESTIONAR) && (
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => iniciarEdicionCategoria(categoria)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => eliminarCategoria(categoria.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Ventas */}
          {tabActual === 'ventas' && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Entradas Vendidas ({entradas.length})
                </h3>

                {/* Filtros */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <select
                    value={filtrosVentas.estado}
                    onChange={(e) => setFiltrosVentas({ ...filtrosVentas, estado: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Todos los estados</option>
                    <option value="VALIDA">Válida</option>
                    <option value="USADA">Usada</option>
                    <option value="ANULADA">Anulada</option>
                  </select>
                  <select
                    value={filtrosVentas.canal}
                    onChange={(e) => setFiltrosVentas({ ...filtrosVentas, canal: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Todos los canales</option>
                    <option value="ADMIN">Admin</option>
                    <option value="PORTAL_SOCIO">Portal Socio</option>
                    <option value="SITIO_WEB">Sitio Web</option>
                    <option value="BUFFET">Buffet</option>
                  </select>
                  <select
                    value={filtrosVentas.categoria}
                    onChange={(e) => setFiltrosVentas({ ...filtrosVentas, categoria: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabla Entradas */}
              {entradas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay entradas vendidas
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comprador</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entradas.map(entrada => (
                        <tr key={entrada.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {entrada.codigo.substring(0, 8)}...
                            </code>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {entrada.categoria?.nombre}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{entrada.nombreComprador}</div>
                            {entrada.esSocio && (
                              <div className="text-xs text-blue-600">Socio</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatCurrency(entrada.precio)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCanalBadge(entrada.canalVenta)}`}>
                              {entrada.canalVenta}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEstadoEntradaBadge(entrada.estado)}`}>
                              {entrada.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(entrada.fechaVenta)}
                          </td>
                          <td className="px-4 py-3">
                            {entrada.estado !== 'ANULADA' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => descargarQRLote(entrada)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Descargar QR"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => enviarQRPorEmail(entrada)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Enviar por email"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Ingresos */}
          {tabActual === 'ingresos' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ingresos Registrados ({ingresos.length})
              </h3>

              {ingresos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay ingresos registrados
                </div>
              ) : (
                <div className="space-y-2">
                  {ingresos.map(ingreso => (
                    <div key={ingreso.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Eye className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {ingreso.entrada?.nombreComprador}
                          </p>
                          <p className="text-sm text-gray-500">
                            {ingreso.entrada?.categoria?.nombre}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(ingreso.fecha).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ingreso.modoValidacion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Estadísticas */}
          {tabActual === 'estadisticas' && estadisticas && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas del Evento</h3>

              {/* Cards Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Entradas Vendidas</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {estadisticas.totalVendidas}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    de {evento.capacidadTotal} disponibles
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Ingresos Registrados</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {estadisticas.totalIngresadas}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {Math.round((estadisticas.totalIngresadas / estadisticas.totalVendidas) * 100)}% de vendidas
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">Recaudación Total</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {formatCurrency(estadisticas.totalRecaudado)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-orange-600 font-medium">Ocupación</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {Math.round((estadisticas.totalVendidas / evento.capacidadTotal) * 100)}%
                  </p>
                </div>
              </div>

              {/* Ventas por Categoría */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3">Ventas por Categoría</h4>
                <div className="space-y-2">
                  {estadisticas.porCategoria?.map(cat => (
                    <div key={cat.categoriaId} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{cat.nombre}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {cat.cantidad} vendidas
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ventas por Canal */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Ventas por Canal</h4>
                <div className="space-y-2">
                  {estadisticas.porCanal?.map(canal => (
                    <div key={canal.canal} className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCanalBadge(canal.canal)}`}>
                        {canal.canal}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {canal.cantidad} entradas
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatCurrency(canal.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Enviar por Email */}
      {mostrarModalEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Enviar Entradas por Email</h3>
              <button
                onClick={() => setMostrarModalEmail(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Se enviará{entradaSeleccionada?.movimientoCajaId
                  ? 'n todas las entradas de esta compra'
                  : ' esta entrada'} a:
              </p>
              <input
                type="email"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
                placeholder="ejemplo@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setMostrarModalEmail(false)}
                className="flex-1"
                disabled={enviandoEmail}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmarEnvioEmail}
                className="flex-1 flex items-center justify-center gap-2"
                disabled={enviandoEmail || !emailDestino}
              >
                {enviandoEmail ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
