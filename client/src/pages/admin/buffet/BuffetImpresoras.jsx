import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Printer, Wifi, WifiOff, TestTube2, ChefHat, Coffee, Flame, Package, UtensilsCrossed, Layers, Monitor, Usb, Cloud, RefreshCw, Laptop } from 'lucide-react'
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

// Tipos de conexión de impresora
const TIPOS_CONEXION = [
  { value: 'IP', label: 'Red (IP)', icon: Wifi, descripcion: 'Impresora con dirección IP propia' },
  { value: 'USB', label: 'USB', icon: Usb, descripcion: 'Impresora conectada por USB al puesto' },
  { value: 'CUPS', label: 'CUPS/Sistema', icon: Cloud, descripcion: 'Impresora configurada en el sistema (Linux CUPS)' },
  { value: 'WINDOWS', label: 'Windows', icon: Laptop, descripcion: 'Impresora instalada en Windows' },
]

const getIconoComponent = (iconoNombre) => {
  const found = ICONOS_DISPONIBLES.find(i => i.value === iconoNombre)
  return found?.icon || ChefHat
}

const getTipoConexionIcon = (tipo) => {
  const found = TIPOS_CONEXION.find(t => t.value === tipo)
  return found?.icon || Wifi
}

export default function BuffetImpresoras() {
  const [sectores, setSectores] = useState([])
  const [impresoras, setImpresoras] = useState([])
  const [categorias, setCategorias] = useState([])
  const [destinos, setDestinos] = useState([])
  const [puestos, setPuestos] = useState([])
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
    tipoConexion: 'IP',
    ip: '',
    puerto: 9100,
    destino: '',
    puestoId: ''
  })

  const [testResult, setTestResult] = useState({})

  // Config de impresoras para tickets
  const [configTickets, setConfigTickets] = useState({
    tickets: null,
    kiosco: null,
    takeaway: null
  })
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  useEffect(() => {
    cargarDatos()
    cargarConfigTickets()
  }, [])

  async function cargarDatos() {
    try {
      const [secRes, impRes, catRes, destRes, puestosRes] = await Promise.all([
        api.get('/admin/buffet/sectores'),
        api.get('/admin/buffet/impresoras'),
        api.get('/admin/buffet/categorias'),
        api.get('/admin/buffet/destinos-impresion'),
        api.get('/admin/buffet/puestos').catch(() => ({ data: [] }))
      ])
      setSectores(secRes.data || secRes || [])
      setImpresoras(impRes.data || impRes || [])
      setCategorias(catRes.data || catRes || [])
      setDestinos(destRes.data || destRes || [])
      setPuestos(puestosRes.data || puestosRes || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function refrescarPuestos() {
    try {
      const res = await api.get('/admin/buffet/puestos')
      setPuestos(res.data || res || [])
      toast.success('Puestos actualizados')
    } catch (err) {
      console.error('Error refrescando puestos:', err)
    }
  }

  async function cargarConfigTickets() {
    try {
      const res = await api.get('/admin/buffet/config-impresoras')
      const data = res.data?.data || res.data || {}
      setConfigTickets(data.config || { tickets: null, kiosco: null, takeaway: null })
    } catch (err) {
      console.error('Error cargando config tickets:', err)
    }
  }

  async function guardarConfigTickets() {
    setGuardandoConfig(true)
    try {
      await api.put('/admin/buffet/config-impresoras', configTickets)
      toast.success('Configuración de impresoras guardada')
    } catch (err) {
      console.error('Error guardando config:', err)
      toast.error('Error al guardar configuración')
    } finally {
      setGuardandoConfig(false)
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
        tipoConexion: impresora.tipoConexion || 'IP',
        ip: impresora.ip || '',
        puerto: impresora.puerto || 9100,
        destino: impresora.destino || '',
        puestoId: impresora.puestoId || ''
      })
    } else {
      setEditando(null)
      setFormData({
        nombre: '',
        sectorId: sectores.length > 0 ? sectores[0].id : '',
        tipoConexion: 'IP',
        ip: '',
        puerto: 9100,
        destino: '',
        puestoId: ''
      })
    }
    setModalOpen(true)
  }

  // Obtener impresoras detectadas del puesto seleccionado
  function getImpresorasDelPuesto(puestoId) {
    const puesto = puestos.find(p => p.puestoId === puestoId)
    return puesto?.impresoras || []
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

  async function toggleSaltarControl(destinoId, saltarControlActual) {
    try {
      await api.put(`/admin/buffet/destinos-impresion/${destinoId}`, {
        saltarControlCocina: !saltarControlActual
      })
      cargarDatos()
    } catch (err) {
      console.error('Error actualizando destino:', err)
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
            const IconoConexion = getTipoConexionIcon(imp.tipoConexion || 'IP')
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
                      <div className="flex items-center gap-2">
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
                        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 flex items-center gap-1">
                          <IconoConexion size={12} />
                          {imp.tipoConexion || 'IP'}
                        </span>
                      </div>
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
                  {imp.tipoConexion === 'IP' || !imp.tipoConexion ? (
                    <p>IP: {imp.ip}:{imp.puerto}</p>
                  ) : (
                    <>
                      <p>Destino: {imp.destino}</p>
                      {imp.puestoId && (
                        <p className="text-xs text-gray-500">Puesto: {imp.puestoId}</p>
                      )}
                    </>
                  )}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entrega Directa
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
                      <td className="px-4 py-3">
                        {destino ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={destino.saltarControlCocina || false}
                              onChange={() => toggleSaltarControl(destino.id, destino.saltarControlCocina)}
                              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <span className="text-xs text-gray-600">
                              {destino.saltarControlCocina
                                ? 'Listo automático'
                                : 'Requiere control'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============== IMPRESORAS PARA TICKETS ============== */}
      {impresoras.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Impresoras para Tickets</h2>
          <p className="text-sm text-gray-600 mb-4">
            Selecciona qué impresora usar para cada tipo de ticket de cobro
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tickets de Mesas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🍽️ Tickets de Mesas
              </label>
              <select
                value={configTickets.tickets || ''}
                onChange={e => setConfigTickets({ ...configTickets, tickets: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Sin asignar</option>
                {impresoras.map(imp => (
                  <option key={imp.id} value={imp.id}>
                    {imp.nombre} {imp.sector ? `(${imp.sector.nombre})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Para cobros de comandas en mesas
              </p>
            </div>

            {/* Tickets de Kiosco */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Tickets de Kiosco
              </label>
              <select
                value={configTickets.kiosco || ''}
                onChange={e => setConfigTickets({ ...configTickets, kiosco: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Sin asignar</option>
                {impresoras.map(imp => (
                  <option key={imp.id} value={imp.id}>
                    {imp.nombre} {imp.sector ? `(${imp.sector.nombre})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Para ventas rápidas de kiosco
              </p>
            </div>

            {/* Tickets de Take Away */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🥡 Tickets de Take Away
              </label>
              <select
                value={configTickets.takeaway || ''}
                onChange={e => setConfigTickets({ ...configTickets, takeaway: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Sin asignar</option>
                {impresoras.map(imp => (
                  <option key={imp.id} value={imp.id}>
                    {imp.nombre} {imp.sector ? `(${imp.sector.nombre})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Para pedidos para llevar
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex justify-end">
            <button
              onClick={guardarConfigTickets}
              disabled={guardandoConfig}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {guardandoConfig ? 'Guardando...' : 'Guardar Configuración'}
            </button>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

              {/* Tipo de conexión */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Conexión *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS_CONEXION.map(tipo => {
                    const IconoTipo = tipo.icon
                    return (
                      <button
                        key={tipo.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, tipoConexion: tipo.value, ip: '', destino: '', puestoId: '' })}
                        className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                          formData.tipoConexion === tipo.value
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <IconoTipo size={20} />
                        <span className="text-xs font-medium">{tipo.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {TIPOS_CONEXION.find(t => t.value === formData.tipoConexion)?.descripcion}
                </p>
              </div>

              {/* Campos para IP */}
              {formData.tipoConexion === 'IP' && (
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
              )}

              {/* Campos para USB/CUPS/WINDOWS */}
              {(formData.tipoConexion === 'USB' || formData.tipoConexion === 'CUPS' || formData.tipoConexion === 'WINDOWS') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto de Trabajo *
                      <button
                        type="button"
                        onClick={refrescarPuestos}
                        className="ml-2 text-blue-600 hover:text-blue-700"
                        title="Refrescar puestos"
                      >
                        <RefreshCw size={14} className="inline" />
                      </button>
                    </label>
                    {puestos.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        <p className="font-medium">No hay puestos conectados</p>
                        <p className="text-xs mt-1">
                          Instale el agente de impresión (print-agent) en el puesto de trabajo.
                          Ver documentación en /docs/print-agent.md
                        </p>
                      </div>
                    ) : (
                      <select
                        value={formData.puestoId}
                        onChange={e => setFormData({ ...formData, puestoId: e.target.value, destino: '' })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        required
                      >
                        <option value="">Seleccionar puesto...</option>
                        {puestos.map(p => (
                          <option key={p.puestoId} value={p.puestoId}>
                            {p.nombre} {p.conectado ? '🟢' : '🔴'} ({p.impresoras?.length || 0} impresoras)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {formData.puestoId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {formData.tipoConexion === 'USB' ? 'Dispositivo USB *' :
                         formData.tipoConexion === 'WINDOWS' ? 'Impresora Windows *' : 'Impresora CUPS *'}
                      </label>
                      {getImpresorasDelPuesto(formData.puestoId).length > 0 ? (
                        <select
                          value={formData.destino}
                          onChange={e => setFormData({ ...formData, destino: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        >
                          <option value="">Seleccionar impresora...</option>
                          {getImpresorasDelPuesto(formData.puestoId)
                            .filter(imp => imp.tipo === formData.tipoConexion)
                            .map((imp, idx) => (
                              <option key={idx} value={imp.destino}>
                                {imp.nombre} ({imp.destino})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={formData.destino}
                            onChange={e => setFormData({ ...formData, destino: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder={formData.tipoConexion === 'USB' ? '/dev/usb/lp0' :
                                        formData.tipoConexion === 'WINDOWS' ? 'EPSON TM-T20' : 'EPSON_TM_T20'}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {formData.tipoConexion === 'USB'
                              ? 'Ruta del dispositivo USB (ej: /dev/usb/lp0)'
                              : formData.tipoConexion === 'WINDOWS'
                              ? 'Nombre de la impresora en Windows (ver Panel de Control > Impresoras)'
                              : 'Nombre de la impresora en CUPS (usar: lpstat -p)'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

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
