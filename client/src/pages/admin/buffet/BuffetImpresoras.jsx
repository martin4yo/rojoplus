import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Printer, Wifi, WifiOff, TestTube2, ChefHat, Coffee, Flame, Package, UtensilsCrossed, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

// Iconos disponibles para sectores
const ICONOS_DISPONIBLES = [
  { value: 'ChefHat', label: 'Cocina', icon: ChefHat },
  { value: 'Coffee', label: 'Café/Barra', icon: Coffee },
  { value: 'Flame', label: 'Parrilla', icon: Flame },
  { value: 'Package', label: 'Despacho', icon: Package },
  { value: 'UtensilsCrossed', label: 'Restaurante', icon: UtensilsCrossed },
]

const getIconoComponent = (iconoNombre) => {
  const found = ICONOS_DISPONIBLES.find(i => i.value === iconoNombre)
  return found?.icon || ChefHat
}

export default function BuffetImpresoras() {
  const [sectores, setSectores] = useState([])
  const [impresoras, setImpresoras] = useState([])
  const [categorias, setCategorias] = useState([])
  const [destinos, setDestinos] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal sectores
  const [modalSectorOpen, setModalSectorOpen] = useState(false)
  const [editandoSector, setEditandoSector] = useState(null)
  const [sectorForm, setSectorForm] = useState({
    codigo: '',
    nombre: '',
    icono: 'ChefHat',
    color: '#DC2626',
    orden: 0
  })

  // Modal impresoras
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    sectorId: '',
    ip: '',
    puerto: 9100
  })

  const [testResult, setTestResult] = useState({})

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [secRes, impRes, catRes, destRes] = await Promise.all([
        api.get('/admin/buffet/sectores'),
        api.get('/admin/buffet/impresoras'),
        api.get('/admin/buffet/categorias'),
        api.get('/admin/buffet/destinos-impresion')
      ])
      setSectores(secRes.data || secRes || [])
      setImpresoras(impRes.data || impRes || [])
      setCategorias(catRes.data || catRes || [])
      setDestinos(destRes.data || destRes || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============== SECTORES ==============
  function abrirModalSector(sector = null) {
    if (sector) {
      setEditandoSector(sector)
      setSectorForm({
        codigo: sector.codigo,
        nombre: sector.nombre,
        icono: sector.icono || 'ChefHat',
        color: sector.color || '#DC2626',
        orden: sector.orden || 0
      })
    } else {
      setEditandoSector(null)
      setSectorForm({
        codigo: '',
        nombre: '',
        icono: 'ChefHat',
        color: '#DC2626',
        orden: 0
      })
    }
    setModalSectorOpen(true)
  }

  async function guardarSector(e) {
    e.preventDefault()
    try {
      if (editandoSector) {
        await api.put(`/admin/buffet/sectores/${editandoSector.id}`, sectorForm)
        toast.success('Sector actualizado')
      } else {
        await api.post('/admin/buffet/sectores', sectorForm)
        toast.success('Sector creado')
      }
      setModalSectorOpen(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando sector:', err)
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function eliminarSector(id) {
    if (!confirm('¿Eliminar este sector?')) return
    try {
      await api.delete(`/admin/buffet/sectores/${id}`)
      toast.success('Sector eliminado')
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando sector:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function toggleActivoSector(sector) {
    try {
      await api.put(`/admin/buffet/sectores/${sector.id}`, { activo: !sector.activo })
      cargarDatos()
    } catch (err) {
      console.error('Error actualizando sector:', err)
    }
  }

  // ============== IMPRESORAS ==============
  function abrirModal(impresora = null) {
    if (impresora) {
      setEditando(impresora)
      setFormData({
        nombre: impresora.nombre,
        sectorId: impresora.sectorId || '',
        ip: impresora.ip,
        puerto: impresora.puerto
      })
    } else {
      setEditando(null)
      setFormData({
        nombre: '',
        sectorId: sectores.length > 0 ? sectores[0].id : '',
        ip: '',
        puerto: 9100
      })
    }
    setModalOpen(true)
  }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editando) {
        await api.put(`/admin/buffet/impresoras/${editando.id}`, formData)
        toast.success('Impresora actualizada')
      } else {
        await api.post('/admin/buffet/impresoras', formData)
        toast.success('Impresora creada')
      }
      setModalOpen(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando impresora:', err)
      toast.error(err.response?.data?.error || 'Error al guardar')
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta impresora?')) return
    try {
      await api.delete(`/admin/buffet/impresoras/${id}`)
      toast.success('Impresora eliminada')
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando impresora:', err)
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function testConexion(id) {
    setTestResult({ ...testResult, [id]: 'testing' })
    try {
      await api.post(`/admin/buffet/impresoras/${id}/test`)
      setTestResult({ ...testResult, [id]: 'ok' })
      toast.success('Conexión exitosa')
    } catch (err) {
      setTestResult({ ...testResult, [id]: 'error' })
      toast.error('Error de conexión')
    }
  }

  async function toggleActivo(impresora) {
    try {
      await api.put(`/admin/buffet/impresoras/${impresora.id}`, { activo: !impresora.activo })
      cargarDatos()
    } catch (err) {
      console.error('Error actualizando impresora:', err)
    }
  }

  async function asignarDestino(categoriaMenuId, impresoraId) {
    try {
      await api.post('/admin/buffet/destinos-impresion', { categoriaMenuId, impresoraId })
      cargarDatos()
    } catch (err) {
      console.error('Error asignando destino:', err)
    }
  }

  async function eliminarDestino(destinoId) {
    try {
      await api.delete(`/admin/buffet/destinos-impresion/${destinoId}`)
      cargarDatos()
    } catch (err) {
      console.error('Error eliminando destino:', err)
    }
  }

  const getDestinoImpresora = (categoriaId) => {
    return destinos.find(d => d.categoriaMenuId === categoriaId)
  }

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div></div>
  }

  return (
    <div className="space-y-8">
      {/* ============== SECTORES ============== */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sectores de Preparación</h1>
            <p className="text-gray-600">Áreas de preparación del buffet (Cocina, Barra, Parrilla, etc.)</p>
          </div>
          {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
            <button
              onClick={() => abrirModalSector()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Plus size={18} />
              Nuevo Sector
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectores.map(sector => {
            const IconoSector = getIconoComponent(sector.icono)
            return (
              <div
                key={sector.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 ${!sector.activo ? 'opacity-60' : ''}`}
                style={{ borderLeftColor: sector.color || '#DC2626' }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: (sector.color || '#DC2626') + '20' }}
                    >
                      <IconoSector size={24} style={{ color: sector.color || '#DC2626' }} />
                    </div>
                    <div>
                      <h3 className="font-bold">{sector.nombre}</h3>
                      <span className="text-xs text-gray-500">{sector.codigo}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActivoSector(sector)}
                    className={sector.activo ? 'text-green-600' : 'text-gray-400'}
                    title={sector.activo ? 'Activo' : 'Inactivo'}
                  >
                    {sector.activo ? <Wifi size={20} /> : <WifiOff size={20} />}
                  </button>
                </div>

                <div className="text-sm text-gray-600 mb-3">
                  {sector.impresoras?.length || 0} impresora(s) asignada(s)
                </div>

                {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
                  <div className="flex justify-end gap-1 pt-3 border-t">
                    <button
                      onClick={() => abrirModalSector(sector)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => eliminarSector(sector.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {sectores.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Layers size={48} className="mx-auto mb-4 opacity-30" />
            <p>No hay sectores configurados</p>
            <p className="text-sm mt-2">Cree sectores para organizar las impresoras por área</p>
          </div>
        )}
      </div>

      {/* ============== IMPRESORAS ============== */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Impresoras Térmicas</h2>
            <p className="text-gray-600">Impresoras para tickets y comandas</p>
          </div>
          {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
            <button
              onClick={() => abrirModal()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={sectores.length === 0}
            >
              <Plus size={18} />
              Nueva Impresora
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {impresoras.map(imp => {
            const sector = imp.sector
            const IconoSector = sector ? getIconoComponent(sector.icono) : Printer
            return (
              <div
                key={imp.id}
                className={`bg-white rounded-lg shadow p-4 ${!imp.activo ? 'opacity-60' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: (sector?.color || '#6B7280') + '20' }}
                    >
                      <IconoSector size={24} style={{ color: sector?.color || '#6B7280' }} />
                    </div>
                    <div>
                      <h3 className="font-bold">{imp.nombre}</h3>
                      {sector ? (
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: (sector.color || '#6B7280') + '20', color: sector.color || '#6B7280' }}
                        >
                          {sector.nombre}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                          Sin sector
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActivo(imp)}
                    className={imp.activo ? 'text-green-600' : 'text-gray-400'}
                  >
                    {imp.activo ? <Wifi size={20} /> : <WifiOff size={20} />}
                  </button>
                </div>

                <div className="text-sm text-gray-600 mb-3">
                  <p>IP: {imp.ip}:{imp.puerto}</p>
                </div>

                {/* Categorías asignadas */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Imprime categorías:</p>
                  <div className="flex flex-wrap gap-1">
                    {imp.destinosImpresion?.map(dest => (
                      <span
                        key={dest.id}
                        className="px-2 py-1 text-xs rounded flex items-center gap-1"
                        style={{ backgroundColor: dest.categoriaMenu?.color + '20', color: dest.categoriaMenu?.color }}
                      >
                        {dest.categoriaMenu?.nombre}
                        <button
                          onClick={() => eliminarDestino(dest.id)}
                          className="hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    )) || <span className="text-xs text-gray-400">Ninguna</span>}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <button
                    onClick={() => testConexion(imp.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                      testResult[imp.id] === 'testing' ? 'bg-yellow-100 text-yellow-700' :
                      testResult[imp.id] === 'ok' ? 'bg-green-100 text-green-700' :
                      testResult[imp.id] === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TestTube2 size={14} />
                    {testResult[imp.id] === 'testing' ? 'Probando...' :
                     testResult[imp.id] === 'ok' ? 'OK' :
                     testResult[imp.id] === 'error' ? 'Error' : 'Test'}
                  </button>

                  {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => abrirModal(imp)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => eliminar(imp.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {impresoras.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Printer size={48} className="mx-auto mb-4 opacity-30" />
            <p>No hay impresoras configuradas</p>
          </div>
        )}
      </div>

      {/* Configuración de Destinos */}
      {impresoras.length > 0 && categorias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Destinos de Impresión</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configura qué categorías imprimen en cada impresora
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Impresora Asignada
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categorias.map(cat => {
                  const destino = getDestinoImpresora(cat.id)
                  return (
                    <tr key={cat.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color || '#3B82F6' }}
                          />
                          <span className="font-medium">{cat.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={destino?.impresoraId || ''}
                          onChange={e => {
                            if (e.target.value) {
                              asignarDestino(cat.id, parseInt(e.target.value))
                            } else if (destino) {
                              eliminarDestino(destino.id)
                            }
                          }}
                          className="border border-gray-300 rounded px-3 py-1 text-sm"
                        >
                          <option value="">Sin asignar</option>
                          {impresoras.map(imp => (
                            <option key={imp.id} value={imp.id}>
                              {imp.nombre} ({imp.sector?.nombre || 'Sin sector'})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Sector */}
      {modalSectorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editandoSector ? 'Editar Sector' : 'Nuevo Sector'}
            </h2>
            <form onSubmit={guardarSector} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  value={sectorForm.codigo}
                  onChange={e => setSectorForm({ ...sectorForm, codigo: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 uppercase"
                  placeholder="Ej: COCINA"
                  required
                  disabled={editandoSector}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={sectorForm.nombre}
                  onChange={e => setSectorForm({ ...sectorForm, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Cocina Principal"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icono
                  </label>
                  <select
                    value={sectorForm.icono}
                    onChange={e => setSectorForm({ ...sectorForm, icono: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {ICONOS_DISPONIBLES.map(i => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={sectorForm.color}
                    onChange={e => setSectorForm({ ...sectorForm, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden
                </label>
                <input
                  type="number"
                  value={sectorForm.orden}
                  onChange={e => setSectorForm({ ...sectorForm, orden: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalSectorOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impresora */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editando ? 'Editar Impresora' : 'Nueva Impresora'}
            </h2>
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Impresora Cocina"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sector
                </label>
                <select
                  value={formData.sectorId}
                  onChange={e => setFormData({ ...formData, sectorId: e.target.value ? parseInt(e.target.value) : '' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Sin sector</option>
                  {sectores.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección IP *
                  </label>
                  <input
                    type="text"
                    value={formData.ip}
                    onChange={e => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Puerto
                  </label>
                  <input
                    type="number"
                    value={formData.puerto}
                    onChange={e => setFormData({ ...formData, puerto: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
