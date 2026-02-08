import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChefHat, Clock, Check, Play, AlertCircle, RefreshCw, Coffee, Flame, Package, UtensilsCrossed } from 'lucide-react'
import api from '../../../services/api'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'

// Iconos disponibles para sectores
const ICONOS_DISPONIBLES = {
  ChefHat, Coffee, Flame, Package, UtensilsCrossed
}

export default function BuffetCocina() {
  const { sector } = useParams()
  const navigate = useNavigate()

  const [sectores, setSectores] = useState([])
  const [sectorActual, setSectorActual] = useState(null)
  const [items, setItems] = useState([])
  const [loadingSectores, setLoadingSectores] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState(null)

  // Cargar lista de sectores
  useEffect(() => {
    async function cargarSectores() {
      try {
        const res = await api.get('/admin/buffet/kds/sectores')
        const data = res.data || res || []
        setSectores(data)

        // Seleccionar sector según parámetro URL o el primero disponible
        if (data.length > 0) {
          const sectorParam = sector?.toUpperCase()
          const encontrado = data.find(s => s.codigo === sectorParam || s.id === parseInt(sector))
          setSectorActual(encontrado || data[0])
        }
      } catch (err) {
        console.error('Error cargando sectores:', err)
      } finally {
        setLoadingSectores(false)
      }
    }
    cargarSectores()
  }, [sector])

  const cargarPendientes = useCallback(async () => {
    if (!sectorActual) return

    try {
      setError(null)
      setLoadingItems(true)
      const res = await api.get(`/admin/buffet/kds/${sectorActual.codigo}/pendientes`)
      setItems(res.data || res || [])
    } catch (err) {
      console.error('Error cargando pendientes:', err)
      setError('Error al cargar pedidos pendientes')
    } finally {
      setLoadingItems(false)
    }
  }, [sectorActual])

  useEffect(() => {
    cargarPendientes()
    // Polling cada 10 segundos
    const interval = setInterval(cargarPendientes, 10000)
    return () => clearInterval(interval)
  }, [cargarPendientes])

  async function marcarPreparando(item) {
    try {
      await api.put(`/admin/buffet/kds/items/${item.id}/preparando`, { tipo: item.tipo })
      cargarPendientes()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  async function marcarListo(item) {
    try {
      await api.put(`/admin/buffet/kds/items/${item.id}/listo`, { tipo: item.tipo })
      cargarPendientes()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const getColorTiempo = (minutos) => {
    if (minutos < 5) return 'text-green-600 bg-green-100'
    if (minutos < 10) return 'text-yellow-600 bg-yellow-100'
    if (minutos < 15) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getColorEstado = (estado) => {
    switch (estado) {
      case 'ENVIADO_COCINA': return 'bg-red-500'
      case 'EN_PREPARACION': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  // Obtener icono del sector
  const IconoSector = sectorActual?.icono ? (ICONOS_DISPONIBLES[sectorActual.icono] || ChefHat) : ChefHat

  // Cambiar sector
  const cambiarSector = (nuevoSector) => {
    setSectorActual(nuevoSector)
    setLoadingItems(true)
    navigate(`/admin/buffet/kds/${nuevoSector.codigo.toLowerCase()}`, { replace: true })
  }

  if (loadingSectores) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (sectores.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <ChefHat size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-xl">No hay sectores configurados</p>
          <p className="text-sm text-gray-400 mt-2">Configure sectores en Impresoras</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <IconoSector size={32} style={{ color: sectorActual?.color || '#DC2626' }} />
          <div>
            <h1 className="text-2xl font-bold">{sectorActual?.nombre || 'KDS'}</h1>
            <p className="text-gray-400 text-sm">
              {items.length} pedidos pendientes
            </p>
          </div>
        </div>

        {/* Selector de Sectores */}
        <div className="flex flex-wrap items-center gap-2">
          {sectores.map(s => {
            const Icono = s.icono ? (ICONOS_DISPONIBLES[s.icono] || ChefHat) : ChefHat
            const esActivo = sectorActual?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => cambiarSector(s)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  esActivo
                    ? 'text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                style={esActivo ? { backgroundColor: s.color || '#DC2626' } : {}}
              >
                <Icono size={18} />
                <span className="hidden sm:inline">{s.nombre}</span>
              </button>
            )
          })}

          <div className="border-l border-gray-600 h-8 mx-2 hidden sm:block"></div>

          <NotificacionBuffet />
          <button
            onClick={cargarPendientes}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            <RefreshCw size={18} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-400">Nuevo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span className="text-gray-400">Preparando</span>
        </div>
      </div>

      {/* Grid de Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map(item => (
          <div
            key={`${item.tipo}-${item.id}`}
            className={`bg-gray-800 rounded-lg overflow-hidden border-l-4 ${
              item.estado === 'ENVIADO_COCINA' ? 'border-red-500 animate-pulse' : 'border-yellow-500'
            }`}
          >
            {/* Header del Item */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${
                    item.tipo === 'COMANDA' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {item.tipo === 'COMANDA' ? 'MESA' : 'TAKE AWAY'}
                  </span>
                  <h3 className="font-bold text-lg">{item.origen}</h3>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getColorTiempo(item.tiempoEspera)}`}>
                  <Clock size={14} className="inline mr-1" />
                  {item.tiempoEspera} min
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${getColorEstado(item.estado)}`}></span>
                <span className="text-gray-400 text-sm">
                  {item.estado === 'ENVIADO_COCINA' ? 'Nuevo' : 'Preparando'}
                </span>
              </div>

              <div className="text-2xl font-bold mb-1">
                {item.cantidad}x {item.producto}
              </div>

              {item.categoria && (
                <p className="text-gray-400 text-sm mb-2">{item.categoria}</p>
              )}

              {item.observaciones && (
                <div className="bg-yellow-900/50 text-yellow-300 text-sm p-2 rounded mt-2">
                  <strong>Nota:</strong> {item.observaciones}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="p-4 border-t border-gray-700">
              {item.estado === 'ENVIADO_COCINA' ? (
                <button
                  onClick={() => marcarPreparando(item)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg"
                >
                  <Play size={18} />
                  PREPARANDO
                </button>
              ) : (
                <button
                  onClick={() => marcarListo(item)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
                >
                  <Check size={18} />
                  LISTO
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !loadingItems && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <IconoSector size={64} className="mb-4 opacity-30" />
          <p className="text-xl">No hay pedidos pendientes en {sectorActual?.nombre || 'este sector'}</p>
          <p className="text-sm mt-2">Los nuevos pedidos aparecerán automáticamente</p>
        </div>
      )}

      {loadingItems && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  )
}
