import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChefHat, Clock, Check, AlertCircle, RefreshCw, Coffee, Flame, Package, UtensilsCrossed, FileText, Volume2, VolumeX, Eye, ArrowRight, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'

// Iconos disponibles para sectores
const ICONOS_DISPONIBLES = {
  ChefHat, Coffee, Flame, Package, UtensilsCrossed
}

// Sonido de notificación (beep simple)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3

    oscillator.start()
    setTimeout(() => {
      oscillator.stop()
      audioContext.close()
    }, 200)

    // Segundo beep
    setTimeout(() => {
      const ctx2 = new (window.AudioContext || window.webkitAudioContext)()
      const osc2 = ctx2.createOscillator()
      const gain2 = ctx2.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx2.destination)
      osc2.frequency.value = 1000
      osc2.type = 'sine'
      gain2.gain.value = 0.3
      osc2.start()
      setTimeout(() => {
        osc2.stop()
        ctx2.close()
      }, 200)
    }, 250)
  } catch (e) {
    console.log('Audio not supported')
  }
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
  const [sonidoActivo, setSonidoActivo] = useState(true)
  const [vistaExpo, setVistaExpo] = useState(false)
  const [vistaBatch, setVistaBatch] = useState(false)

  // Para detectar nuevos items
  const prevItemsCount = useRef(0)
  const prevNuevosIds = useRef(new Set())

  // Cargar lista de sectores
  useEffect(() => {
    async function cargarSectores() {
      try {
        const res = await api.get('/admin/buffet/kds/sectores')
        const data = res.data || res || []
        setSectores(data)

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
    if (!sectorActual && !vistaExpo) return

    try {
      setError(null)
      setLoadingItems(true)

      let res
      if (vistaExpo) {
        res = await api.get('/admin/buffet/kds/expo/todos')
      } else {
        res = await api.get(`/admin/buffet/kds/${sectorActual.codigo}/pendientes?incluirListos=true`)
      }

      const nuevosItems = res.data || res || []

      // Detectar nuevos items (estado ENVIADO_*)
      const nuevosIds = new Set(
        nuevosItems
          .filter(i => i.estado.startsWith('ENVIADO_'))
          .map(i => `${i.tipo}-${i.id}`)
      )

      // Si hay nuevos items que no estaban antes, reproducir sonido
      if (sonidoActivo && prevNuevosIds.current.size > 0) {
        const itemsNuevos = [...nuevosIds].filter(id => !prevNuevosIds.current.has(id))
        if (itemsNuevos.length > 0) {
          playNotificationSound()
        }
      }

      prevNuevosIds.current = nuevosIds
      prevItemsCount.current = nuevosItems.length
      setItems(nuevosItems)
    } catch (err) {
      console.error('Error cargando pendientes:', err)
      setError('Error al cargar pedidos pendientes')
    } finally {
      setLoadingItems(false)
    }
  }, [sectorActual, vistaExpo, sonidoActivo])

  useEffect(() => {
    cargarPendientes()
    const interval = setInterval(cargarPendientes, 5000) // Más frecuente para mejor UX
    return () => clearInterval(interval)
  }, [cargarPendientes])

  async function limpiarKDS() {
    try {
      const res = await api.postFull('/admin/buffet/kds/limpiar-sin-control')
      const actualizados = res?.actualizados ?? 0
      toast.success(actualizados > 0 ? `${actualizados} items limpiados del KDS` : 'KDS ya estaba limpio')
      await cargarPendientes()
    } catch (err) {
      console.error('Error limpiando KDS:', err)
      toast.error(err.message || 'Error al limpiar KDS')
    }
  }

  // Avanzar al siguiente estado con un solo tap
  async function avanzarEstado(item) {
    // Los items LISTOS no se tocan desde KDS - el camarero los marca entregados desde la comanda
    if (item.estado === 'LISTO') return

    try {
      if (item.estado.startsWith('ENVIADO_')) {
        // Nuevo → Preparando
        await api.put(`/admin/buffet/kds/items/${item.id}/preparando`, { tipo: item.tipo })
      } else if (item.estado === 'EN_PREPARACION') {
        // Preparando → Listo
        await api.put(`/admin/buffet/kds/items/${item.id}/listo`, { tipo: item.tipo })
      }
      cargarPendientes()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // Retroceder al estado anterior
  async function revertirEstado(item, e) {
    e.stopPropagation() // Evitar que se active el avanzarEstado

    // Solo se puede revertir desde PREPARANDO o LISTO
    if (!['EN_PREPARACION', 'LISTO'].includes(item.estado)) return

    try {
      await api.put(`/admin/buffet/kds/items/${item.id}/revertir`, { tipo: item.tipo })
      cargarPendientes()
    } catch (err) {
      console.error('Error al revertir:', err)
    }
  }

  const getColorTiempo = (minutos) => {
    if (minutos < 5) return 'text-green-400 bg-green-900/50'
    if (minutos < 10) return 'text-yellow-400 bg-yellow-900/50'
    if (minutos < 15) return 'text-orange-400 bg-orange-900/50'
    return 'text-red-400 bg-red-900/50'
  }

  // Separar items por estado para Kanban
  const itemsNuevos = items.filter(i => i.estado.startsWith('ENVIADO_'))
  const itemsPreparando = items.filter(i => i.estado === 'EN_PREPARACION')
  const itemsListos = items.filter(i => i.estado === 'LISTO')

  // Agrupar items por producto para vista Batch
  const agruparPorProducto = (items) => {
    const grupos = {}
    items.forEach(item => {
      const key = item.producto
      if (!grupos[key]) {
        grupos[key] = {
          producto: item.producto,
          categoria: item.categoria,
          cantidad: 0,
          origenes: [],
          items: []
        }
      }
      grupos[key].cantidad += item.cantidad
      grupos[key].origenes.push(item.origen)
      grupos[key].items.push(item)
    })
    return Object.values(grupos).sort((a, b) => b.cantidad - a.cantidad)
  }

  const batchNuevos = agruparPorProducto(itemsNuevos)
  const batchPreparando = agruparPorProducto(itemsPreparando)
  const batchListos = agruparPorProducto(itemsListos)

  const IconoSector = sectorActual?.icono ? (ICONOS_DISPONIBLES[sectorActual.icono] || ChefHat) : ChefHat

  const cambiarSector = (nuevoSector) => {
    setVistaExpo(false)
    setSectorActual(nuevoSector)
    setLoadingItems(true)
    navigate(`/admin/buffet/kds/${nuevoSector.codigo.toLowerCase()}`, { replace: true })
  }

  const toggleExpo = () => {
    setVistaExpo(!vistaExpo)
    setLoadingItems(true)
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

  // Componente de tarjeta de item
  const ItemCard = ({ item, columna }) => {
    const esClickeable = columna !== 'listos'
    const puedeRevertir = columna === 'preparando' || columna === 'listos'

    return (
      <div
        onClick={() => esClickeable && avanzarEstado(item)}
        className={`bg-gray-800 rounded-lg overflow-hidden transition-all ${
          esClickeable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]' : ''
        } ${
          columna === 'nuevos' ? 'border-l-4 border-red-500 animate-pulse' :
          columna === 'preparando' ? 'border-l-4 border-yellow-500' :
          'border-l-4 border-green-500'
        }`}
      >
        {/* Header */}
        <div className="p-3 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              item.tipo === 'COMANDA' ? 'bg-blue-600' : 'bg-purple-600'
            }`}>
              {item.tipo === 'COMANDA' ? 'MESA' : 'T.A.'}
            </span>
            <span className="font-bold">{item.origen}</span>
          </div>
          <div className="flex items-center gap-2">
            {puedeRevertir && (
              <button
                onClick={(e) => revertirEstado(item, e)}
                className="p-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Volver al estado anterior"
              >
                <Undo2 size={14} />
              </button>
            )}
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${getColorTiempo(item.tiempoEspera)}`}>
              <Clock size={12} className="inline mr-1" />
              {item.tiempoEspera}m
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-3">
          <div className="text-xl font-bold text-white mb-1">
            {item.cantidad}x {item.producto}
          </div>

          {item.categoria && (
            <p className="text-gray-400 text-xs mb-2">{item.categoria}</p>
          )}

          {/* Opciones seleccionadas */}
          {item.opciones && item.opciones.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.opciones.map((op, i) => (
                <span key={i} className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded">
                  + {op}
                </span>
              ))}
            </div>
          )}

          {/* Opciones removidas */}
          {item.opcionesRemovidas && item.opcionesRemovidas.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.opcionesRemovidas.map((op, i) => (
                <span key={i} className="text-sm bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                  SIN {op}
                </span>
              ))}
            </div>
          )}

          {item.observaciones && (
            <div className="bg-yellow-500 text-yellow-950 text-sm p-2 rounded mt-2 font-bold flex items-start gap-1">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{item.observaciones}</span>
            </div>
          )}
        </div>

        {/* Footer con acción */}
        <div className={`px-3 py-2 text-center text-sm font-bold flex items-center justify-center gap-1 ${
          columna === 'nuevos' ? 'bg-yellow-600 text-black' :
          columna === 'preparando' ? 'bg-green-600 text-white' :
          'bg-gray-600 text-gray-300'
        }`}>
          {columna === 'nuevos' && <>TAP = PREPARANDO <ArrowRight size={14} /></>}
          {columna === 'preparando' && <>TAP = LISTO <Check size={14} /></>}
          {columna === 'listos' && <>PARA ENTREGAR</>}
        </div>
      </div>
    )
  }

  // Componente de tarjeta agrupada para vista Batch
  const BatchCard = ({ grupo, columna }) => {
    const esClickeable = columna !== 'listos'
    const puedeRevertir = columna === 'preparando' || columna === 'listos'

    // Marcar todos los items del grupo
    const avanzarTodos = async () => {
      if (!esClickeable) return
      for (const item of grupo.items) {
        await avanzarEstado(item)
      }
    }

    // Revertir todos los items del grupo
    const revertirTodos = async (e) => {
      e.stopPropagation()
      for (const item of grupo.items) {
        try {
          await api.put(`/admin/buffet/kds/items/${item.id}/revertir`, { tipo: item.tipo })
        } catch (err) {
          console.error('Error al revertir:', err)
        }
      }
      cargarPendientes()
    }

    return (
      <div
        onClick={avanzarTodos}
        className={`bg-gray-800 rounded-lg overflow-hidden transition-all ${
          esClickeable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]' : ''
        } ${
          columna === 'nuevos' ? 'border-l-4 border-red-500' :
          columna === 'preparando' ? 'border-l-4 border-yellow-500' :
          'border-l-4 border-green-500'
        }`}
      >
        {/* Header con cantidad total */}
        <div className={`p-4 text-center relative ${
          columna === 'nuevos' ? 'bg-red-600' :
          columna === 'preparando' ? 'bg-yellow-600' :
          'bg-green-600'
        }`}>
          {puedeRevertir && (
            <button
              onClick={revertirTodos}
              className="absolute top-2 right-2 p-1.5 bg-black/30 hover:bg-black/50 rounded transition-colors"
              title="Revertir todos al estado anterior"
            >
              <Undo2 size={16} />
            </button>
          )}
          <div className="text-4xl font-black text-white">
            {grupo.cantidad}x
          </div>
        </div>

        {/* Producto */}
        <div className="p-4">
          <div className="text-xl font-bold text-white mb-1">
            {grupo.producto}
          </div>
          {grupo.categoria && (
            <p className="text-gray-400 text-xs mb-3">{grupo.categoria}</p>
          )}

          {/* Lista de orígenes */}
          <div className="flex flex-wrap gap-1">
            {grupo.origenes.map((origen, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
              >
                {origen}
              </span>
            ))}
          </div>
        </div>

        {/* Footer con acción */}
        {esClickeable && (
          <div className={`px-3 py-2 text-center text-sm font-bold ${
            columna === 'nuevos' ? 'bg-yellow-600 text-black' : 'bg-green-600 text-white'
          }`}>
            {columna === 'nuevos' && <>TAP = TODOS A PREPARANDO</>}
            {columna === 'preparando' && <>TAP = TODOS LISTOS</>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-900 text-white p-4 flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          {vistaExpo ? (
            <Eye size={32} className="text-purple-500" />
          ) : (
            <IconoSector size={32} style={{ color: sectorActual?.color || '#DC2626' }} />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {vistaExpo ? 'EXPO - Todos los Sectores' : sectorActual?.nombre || 'KDS'}
            </h1>
            <p className="text-gray-400 text-sm">
              {itemsNuevos.length} nuevos | {itemsPreparando.length} preparando | {itemsListos.length} listos
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Sectores */}
          {sectores.map(s => {
            const Icono = s.icono ? (ICONOS_DISPONIBLES[s.icono] || ChefHat) : ChefHat
            const esActivo = !vistaExpo && sectorActual?.id === s.id
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

          <div className="border-l border-gray-600 h-8 mx-1 hidden sm:block"></div>

          {/* Toggle EXPO */}
          <button
            onClick={toggleExpo}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              vistaExpo && !vistaBatch ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Vista Expo - Todos los items por mesa"
          >
            <Eye size={18} />
            <span className="hidden sm:inline">EXPO</span>
          </button>

          {/* Toggle BATCH */}
          <button
            onClick={() => { setVistaBatch(!vistaBatch); if (!vistaBatch) setVistaExpo(true) }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              vistaBatch ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Vista Batch - Agrupado por producto"
          >
            <Package size={18} />
            <span className="hidden sm:inline">BATCH</span>
          </button>

          {/* Toggle Sonido */}
          <button
            onClick={() => setSonidoActivo(!sonidoActivo)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              sonidoActivo ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-500'
            }`}
            title={sonidoActivo ? 'Sonido activado' : 'Sonido desactivado'}
          >
            {sonidoActivo ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <NotificacionBuffet />

          <button
            onClick={limpiarKDS}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            title="Limpiar items sin control de cocina"
          >
            Limpiar KDS
          </button>

          <button
            onClick={cargarPendientes}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            <RefreshCw size={18} className={loadingItems ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Vista Kanban - 3 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 pb-10">
        {/* Columna NUEVOS */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="font-bold text-lg">NUEVOS</h2>
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
              {vistaBatch ? batchNuevos.reduce((sum, g) => sum + g.cantidad, 0) : itemsNuevos.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {vistaBatch ? (
              <>
                {batchNuevos.map(grupo => (
                  <BatchCard key={grupo.producto} grupo={grupo} columna="nuevos" />
                ))}
                {batchNuevos.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <ChefHat size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Sin pedidos nuevos</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {itemsNuevos.map(item => (
                  <ItemCard key={`${item.tipo}-${item.id}`} item={item} columna="nuevos" />
                ))}
                {itemsNuevos.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <ChefHat size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Sin pedidos nuevos</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Columna PREPARANDO */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <h2 className="font-bold text-lg">PREPARANDO</h2>
            <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full">
              {vistaBatch ? batchPreparando.reduce((sum, g) => sum + g.cantidad, 0) : itemsPreparando.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {vistaBatch ? (
              <>
                {batchPreparando.map(grupo => (
                  <BatchCard key={grupo.producto} grupo={grupo} columna="preparando" />
                ))}
                {batchPreparando.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Flame size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Nada en preparación</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {itemsPreparando.map(item => (
                  <ItemCard key={`${item.tipo}-${item.id}`} item={item} columna="preparando" />
                ))}
                {itemsPreparando.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Flame size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Nada en preparación</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Columna LISTOS */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h2 className="font-bold text-lg">LISTOS</h2>
            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
              {vistaBatch ? batchListos.reduce((sum, g) => sum + g.cantidad, 0) : itemsListos.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {vistaBatch ? (
              <>
                {batchListos.map(grupo => (
                  <BatchCard key={grupo.producto} grupo={grupo} columna="listos" />
                ))}
                {batchListos.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Check size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Sin items listos</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {itemsListos.map(item => (
                  <ItemCard key={`${item.tipo}-${item.id}`} item={item} columna="listos" />
                ))}
                {itemsListos.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Check size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Sin items listos</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Instrucciones en footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-2 text-center text-sm text-gray-400">
        <span className="hidden sm:inline">
          Toca tarjeta = avanzar | <Undo2 size={12} className="inline" /> = retroceder |{' '}
        </span>
        <span className="text-red-400">NUEVO</span> ↔ <span className="text-yellow-400">PREPARANDO</span> ↔ <span className="text-green-400">LISTO</span>
        <span className="hidden sm:inline text-gray-500">{' '}(camarero entrega desde comanda)</span>
      </div>
    </div>
  )
}
