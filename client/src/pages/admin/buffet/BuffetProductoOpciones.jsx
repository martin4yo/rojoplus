import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Trash2, Settings, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import PageHeader from '../../../components/PageHeader'
import { useConfirm } from '../../../hooks/useConfirm'
import LoadingSpinner from '../../../components/LoadingSpinner'

export default function BuffetProductoOpciones() {
  const { productoId } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [producto, setProducto] = useState(null)
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal para grupo
  const [modalGrupo, setModalGrupo] = useState(false)
  const [editandoGrupo, setEditandoGrupo] = useState(null)
  const [formGrupo, setFormGrupo] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'UNICA',
    obligatorio: true,
    minSelecciones: 1,
    maxSelecciones: 1,
    orden: 0
  })

  // Modal para opción
  const [modalOpcion, setModalOpcion] = useState(false)
  const [grupoParaOpcion, setGrupoParaOpcion] = useState(null)
  const [editandoOpcion, setEditandoOpcion] = useState(null)
  const [formOpcion, setFormOpcion] = useState({
    nombre: '',
    descripcion: '',
    precioAdicional: 0,
    seleccionadoPorDefecto: false,
    orden: 0
  })

  // Grupos expandidos
  const [expandidos, setExpandidos] = useState({})

  useEffect(() => {
    cargarDatos()
  }, [productoId])

  async function cargarDatos() {
    try {
      // Cargar todos los productos y filtrar el que necesitamos
      const res = await api.get('/admin/buffet/productos')
      const productos = res.data?.data || res.data || res || []
      const prod = productos.find(p => String(p.id) === String(productoId))

      if (!prod) {
        toast.error('Producto no encontrado')
        setLoading(false)
        return
      }
      setProducto(prod)
      const gruposData = prod.gruposOpciones || []
      setGrupos(gruposData)

      // Expandir todos los grupos por defecto
      const exp = {}
      gruposData.forEach(g => {
        exp[g.id] = true
      })
      setExpandidos(exp)
    } catch (err) {
      console.error('Error cargando datos:', err)
      toast.error('Error al cargar el producto')
    } finally {
      setLoading(false)
    }
  }

  // ============ GRUPOS ============
  function abrirModalGrupo(grupo = null) {
    if (grupo) {
      setEditandoGrupo(grupo)
      setFormGrupo({
        nombre: grupo.nombre,
        descripcion: grupo.descripcion || '',
        tipo: grupo.tipo,
        obligatorio: grupo.obligatorio,
        minSelecciones: grupo.minSelecciones,
        maxSelecciones: grupo.maxSelecciones,
        orden: grupo.orden
      })
    } else {
      setEditandoGrupo(null)
      setFormGrupo({
        nombre: '',
        descripcion: '',
        tipo: 'UNICA',
        obligatorio: true,
        minSelecciones: 1,
        maxSelecciones: 1,
        orden: grupos.length
      })
    }
    setModalGrupo(true)
  }

  async function guardarGrupo(e) {
    e.preventDefault()
    try {
      if (editandoGrupo) {
        await api.put(`/admin/buffet/grupos-opciones/${editandoGrupo.id}`, formGrupo)
        toast.success('Grupo actualizado')
      } else {
        await api.post(`/admin/buffet/productos/${productoId}/grupos-opciones`, formGrupo)
        toast.success('Grupo creado')
      }
      setModalGrupo(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando grupo:', err)
      toast.error('Error al guardar el grupo')
    }
  }

  async function eliminarGrupo(grupo) {
    const confirmed = await confirm(
      '¿Eliminar grupo?',
      `Se eliminará "${grupo.nombre}" y todas sus opciones. Esta acción no se puede deshacer.`,
      { variant: 'danger', confirmText: 'Eliminar' }
    )
    if (!confirmed) return
    try {
      await api.delete(`/admin/buffet/grupos-opciones/${grupo.id}`)
      toast.success('Grupo eliminado')
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando grupo:', err)
      toast.error('Error al eliminar el grupo')
    }
  }

  // ============ OPCIONES ============
  function abrirModalOpcion(grupo, opcion = null) {
    setGrupoParaOpcion(grupo)
    if (opcion) {
      setEditandoOpcion(opcion)
      setFormOpcion({
        nombre: opcion.nombre,
        descripcion: opcion.descripcion || '',
        precioAdicional: opcion.precioAdicional || 0,
        seleccionadoPorDefecto: opcion.seleccionadoPorDefecto || false,
        orden: opcion.orden
      })
    } else {
      setEditandoOpcion(null)
      setFormOpcion({
        nombre: '',
        descripcion: '',
        precioAdicional: 0,
        seleccionadoPorDefecto: false,
        orden: grupo.opciones?.length || 0
      })
    }
    setModalOpcion(true)
  }

  async function guardarOpcion(e) {
    e.preventDefault()
    try {
      if (editandoOpcion) {
        await api.put(`/admin/buffet/opciones/${editandoOpcion.id}`, formOpcion)
        toast.success('Opción actualizada')
      } else {
        await api.post(`/admin/buffet/grupos-opciones/${grupoParaOpcion.id}/opciones`, formOpcion)
        toast.success('Opción creada')
      }
      setModalOpcion(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando opción:', err)
      toast.error('Error al guardar la opción')
    }
  }

  async function eliminarOpcion(opcion) {
    const confirmed = await confirm(
      '¿Eliminar opción?',
      `Se eliminará "${opcion.nombre}". Esta acción no se puede deshacer.`,
      { variant: 'danger', confirmText: 'Eliminar' }
    )
    if (!confirmed) return
    try {
      await api.delete(`/admin/buffet/opciones/${opcion.id}`)
      toast.success('Opción eliminada')
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando opción:', err)
      toast.error('Error al eliminar la opción')
    }
  }

  function toggleExpanded(grupoId) {
    setExpandidos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }))
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!producto) {
    return <div className="p-8 text-center text-gray-500">Producto no encontrado</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title={`Opciones: ${producto.nombre}`}
        subtitle="Configura los grupos de opciones y sus valores"
      >
        <button
          onClick={() => navigate('/admin/buffet/productos')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
        <button
          onClick={() => abrirModalGrupo()}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus size={18} />
          Nuevo Grupo
        </button>
      </PageHeader>

      {/* Info del producto */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} className="w-16 h-16 rounded object-cover" />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400">
            Sin img
          </div>
        )}
        <div>
          <h3 className="font-bold text-lg">{producto.nombre}</h3>
          <p className="text-gray-500">{producto.categoriaMenu?.nombre} • ${Number(producto.precio).toLocaleString()}</p>
        </div>
      </div>

      {/* Grupos de opciones */}
      <div className="space-y-4">
        {grupos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Settings size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Este producto no tiene opciones configuradas.</p>
            <p className="text-sm mt-2">Usa el botón "Nuevo Grupo" para agregar guarniciones, tamaños, ingredientes, etc.</p>
          </div>
        ) : (
          grupos.map(grupo => (
            <div key={grupo.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header del grupo */}
              <div
                className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(grupo.id)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical size={18} className="text-gray-400" />
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                      {grupo.nombre}
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        grupo.tipo === 'UNICA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {grupo.tipo === 'UNICA' ? 'Selección única' : 'Múltiple'}
                      </span>
                      {grupo.obligatorio && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Obligatorio</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {grupo.descripcion || `${grupo.opciones?.length || 0} opciones`}
                      {grupo.tipo === 'MULTIPLE' && ` • Min: ${grupo.minSelecciones}, Max: ${grupo.maxSelecciones}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); abrirModalGrupo(grupo) }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Editar grupo"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); eliminarGrupo(grupo) }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Eliminar grupo"
                  >
                    <Trash2 size={16} />
                  </button>
                  {expandidos[grupo.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Opciones del grupo */}
              {expandidos[grupo.id] && (
                <div className="p-4">
                  <div className="space-y-2">
                    {grupo.opciones?.map(opcion => (
                      <div
                        key={opcion.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical size={16} className="text-gray-300" />
                          <div>
                            <span className="font-medium">{opcion.nombre}</span>
                            {opcion.seleccionadoPorDefecto && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                Por defecto
                              </span>
                            )}
                            {opcion.descripcion && (
                              <p className="text-sm text-gray-500">{opcion.descripcion}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {Number(opcion.precioAdicional) !== 0 && (
                            <span className={`font-medium ${Number(opcion.precioAdicional) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Number(opcion.precioAdicional) > 0 ? '+' : ''}${Number(opcion.precioAdicional).toLocaleString()}
                            </span>
                          )}
                          <button
                            onClick={() => abrirModalOpcion(grupo, opcion)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => eliminarOpcion(opcion)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => abrirModalOpcion(grupo)}
                    className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-red-400 hover:text-red-600 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Agregar opción
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Grupo */}
      {modalGrupo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">
                {editandoGrupo ? 'Editar Grupo' : 'Nuevo Grupo de Opciones'}
              </h2>
            </div>
            <form onSubmit={guardarGrupo} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formGrupo.nombre}
                  onChange={e => setFormGrupo({ ...formGrupo, nombre: e.target.value })}
                  placeholder="Ej: Guarnición, Tamaño, Ingredientes"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formGrupo.descripcion}
                  onChange={e => setFormGrupo({ ...formGrupo, descripcion: e.target.value })}
                  placeholder="Texto de ayuda para el usuario"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de selección</label>
                <select
                  value={formGrupo.tipo}
                  onChange={e => {
                    const tipo = e.target.value
                    setFormGrupo({
                      ...formGrupo,
                      tipo,
                      minSelecciones: tipo === 'UNICA' ? 1 : formGrupo.minSelecciones,
                      maxSelecciones: tipo === 'UNICA' ? 1 : formGrupo.maxSelecciones
                    })
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="UNICA">Única (solo 1 opción)</option>
                  <option value="MULTIPLE">Múltiple (varias opciones)</option>
                </select>
              </div>

              {formGrupo.tipo === 'MULTIPLE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mínimo</label>
                    <input
                      type="number"
                      min="0"
                      value={formGrupo.minSelecciones}
                      onChange={e => setFormGrupo({ ...formGrupo, minSelecciones: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Máximo</label>
                    <input
                      type="number"
                      min="1"
                      value={formGrupo.maxSelecciones}
                      onChange={e => setFormGrupo({ ...formGrupo, maxSelecciones: parseInt(e.target.value) || 1 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="obligatorio"
                  checked={formGrupo.obligatorio}
                  onChange={e => setFormGrupo({ ...formGrupo, obligatorio: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="obligatorio" className="text-sm">
                  Obligatorio (el cliente debe seleccionar una opción)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalGrupo(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {editandoGrupo ? 'Guardar' : 'Crear Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Opción */}
      {modalOpcion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">
                {editandoOpcion ? 'Editar Opción' : `Nueva Opción en "${grupoParaOpcion?.nombre}"`}
              </h2>
            </div>
            <form onSubmit={guardarOpcion} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formOpcion.nombre}
                  onChange={e => setFormOpcion({ ...formOpcion, nombre: e.target.value })}
                  placeholder="Ej: Papas Fritas, Grande, Lechuga"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formOpcion.descripcion}
                  onChange={e => setFormOpcion({ ...formOpcion, descripcion: e.target.value })}
                  placeholder="Descripción opcional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio adicional</label>
                <input
                  type="number"
                  step="0.01"
                  value={formOpcion.precioAdicional}
                  onChange={e => setFormOpcion({ ...formOpcion, precioAdicional: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">0 = sin costo extra, negativo = descuento</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="porDefecto"
                  checked={formOpcion.seleccionadoPorDefecto}
                  onChange={e => setFormOpcion({ ...formOpcion, seleccionadoPorDefecto: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="porDefecto" className="text-sm">
                  Seleccionado por defecto (ej: ingredientes que vienen incluidos)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpcion(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {editandoOpcion ? 'Guardar' : 'Crear Opción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  )
}
