import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Users, Clock, ChefHat, ShoppingBag, Coffee, AlertCircle, RefreshCw, Settings, UserCheck, Trash2, Receipt, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import PageHeader from '../../../components/PageHeader'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'
import Modal from '../../../components/Modal'
import { useConfirm } from '../../../hooks/useConfirm'
import ChatWidget from '../../../components/chat/ChatWidget'
import LoadingSpinner from '../../../components/LoadingSpinner'

const RANGOS = [
  { label: 'Hoy',        key: 'hoy' },
  { label: 'Ayer',       key: 'ayer' },
  { label: 'Esta semana',key: 'semana' },
  { label: 'Este mes',   key: 'mes' },
]

function getRangoDates(key) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fmt = d => d.toISOString().slice(0, 10)
  switch (key) {
    case 'hoy':    return { desde: fmt(hoy), hasta: fmt(hoy) }
    case 'ayer': { const a = new Date(hoy); a.setDate(a.getDate() - 1); return { desde: fmt(a), hasta: fmt(a) } }
    case 'semana': { const s = new Date(hoy); s.setDate(s.getDate() - s.getDay()); return { desde: fmt(s), hasta: fmt(hoy) } }
    case 'mes':    return { desde: fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fmt(hoy) }
    default:       return { desde: fmt(hoy), hasta: fmt(hoy) }
  }
}

function fmtMonto(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)
}

function fmtHora(s) {
  return new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(s) {
  return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function BuffetMesas() {
  const { confirm, ConfirmDialog } = useConfirm()
  // Permisos del usuario
  const puedeVerKpis = tienePermiso(PERMISOS.BUFFET_VER) || tienePermiso(PERMISOS.BUFFET_CONFIG)
  const puedeAsignar = tienePermiso(PERMISOS.BUFFET_CONFIG)
  const soloMesas = tienePermiso(PERMISOS.BUFFET_MESAS) && !puedeVerKpis // Camarero simple

  const [kpis, setKpis] = useState(null)
  const [mesas, setMesas] = useState([])
  const [todasLasMesas, setTodasLasMesas] = useState([]) // Para el modal de asignación
  const [mozos, setMozos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verMisMesas, setVerMisMesas] = useState(soloMesas) // Auto-activar para camareros
  const [modalAsignacion, setModalAsignacion] = useState(false)
  const [asignaciones, setAsignaciones] = useState({}) // { mesaId: mozoId }

  // Ventas del período
  const [rangoVentas, setRangoVentas] = useState('hoy')
  const [ventas, setVentas] = useState([])
  const [loadingVentas, setLoadingVentas] = useState(false)

  // Filtro de estado de mesas (solo uno a la vez, o null para ver todas)
  const [estadoFiltro, setEstadoFiltro] = useState(null)

  const cargarDatos = useCallback(async () => {
    try {
      setError(null)

      // Camareros simples: solo cargar sus mesas asignadas
      if (soloMesas) {
        const mesasRes = await api.get('/admin/buffet/mesas/estado?misMesas=true')
        const mesasData = mesasRes.data || mesasRes || []
        setMesas(mesasData)
        setLoading(false)
        return
      }

      // Usuarios con más permisos: cargar todo
      const [dashRes, mesasRes, todasMesasRes] = await Promise.all([
        puedeVerKpis ? api.get('/admin/buffet/dashboard') : Promise.resolve(null),
        api.get(`/admin/buffet/mesas/estado${verMisMesas ? '?misMesas=true' : ''}`),
        puedeAsignar ? api.get('/admin/buffet/mesas/estado') : Promise.resolve({ data: [] })
      ])

      if (dashRes) {
        setKpis(dashRes.data || dashRes)
      }

      const mesasData = mesasRes.data || mesasRes || []
      setMesas(mesasData)

      const todasData = todasMesasRes?.data || todasMesasRes || []
      setTodasLasMesas(todasData)

      // Inicializar asignaciones con las actuales (de todas las mesas)
      const asignacionesActuales = {}
      todasData.forEach(m => {
        asignacionesActuales[m.id] = m.mozoAsignado?.id || ''
      })
      setAsignaciones(asignacionesActuales)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
      setError('Error al cargar datos del buffet')
    } finally {
      setLoading(false)
    }
  }, [verMisMesas, soloMesas, puedeVerKpis, puedeAsignar])

  const cargarMozos = async () => {
    try {
      const res = await api.get('/admin/buffet/mozos')
      setMozos(res.data || res || [])
    } catch (err) {
      console.error('Error cargando mozos:', err)
    }
  }

  const cargarVentas = useCallback(async (rango) => {
    if (!puedeVerKpis) return
    try {
      setLoadingVentas(true)
      const { desde, hasta } = getRangoDates(rango)
      const res = await api.get(`/admin/buffet/ultimas-ventas?desde=${desde}&hasta=${hasta}&limit=100`)
      setVentas(res.data || res || [])
    } catch (err) {
      console.error('Error cargando ventas:', err)
    } finally {
      setLoadingVentas(false)
    }
  }, [puedeVerKpis])

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 30000)
    return () => clearInterval(interval)
  }, [cargarDatos])

  useEffect(() => {
    if (puedeAsignar) {
      cargarMozos()
    }
  }, [puedeAsignar])

  useEffect(() => {
    cargarVentas(rangoVentas)
  }, [rangoVentas, cargarVentas])


  const handleAsignacionChange = (mesaId, mozoId) => {
    setAsignaciones(prev => ({
      ...prev,
      [mesaId]: mozoId
    }))
  }

  const guardarAsignaciones = async () => {
    try {
      const asignacionesArray = Object.entries(asignaciones).map(([mesaId, mozoId]) => ({
        mesaId: parseInt(mesaId),
        mozoId: mozoId ? parseInt(mozoId) : null
      }))

      await api.post('/admin/buffet/mesas/asignar-masivo', { asignaciones: asignacionesArray })
      toast.success('Asignaciones guardadas')
      setModalAsignacion(false)
      cargarDatos()
    } catch (err) {
      console.error('Error guardando asignaciones:', err)
      toast.error('Error al guardar asignaciones')
    }
  }

  const limpiarAsignaciones = async () => {
    const confirmed = await confirm(
      '¿Limpiar turno?',
      'Se desasignarán todas las mesas de los mozos.',
      { variant: 'warning', confirmText: 'Limpiar' }
    )
    if (!confirmed) return

    try {
      await api.post('/admin/buffet/mesas/desasignar-todas')
      toast.success('Todas las mesas desasignadas')
      setModalAsignacion(false)
      cargarDatos()
    } catch (err) {
      console.error('Error limpiando asignaciones:', err)
      toast.error('Error al limpiar asignaciones')
    }
  }

  // Toggle filtro de estado (solo uno a la vez)
  const toggleFiltroEstado = (estado) => {
    // Si se clickea el mismo estado, se deselecciona (muestra todas)
    setEstadoFiltro(prev => prev === estado ? null : estado)
  }

  // Clasificar mesa según estado para filtrado
  const clasificarMesa = (mesa) => {
    if (mesa.estado === 'LIBRE') return 'libre'
    if (mesa.estado === 'LIMPIEZA') return 'limpieza'

    const comandasActivas = mesa.comandas?.filter(c =>
      ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
    ) || []

    if (comandasActivas.length === 0) return 'sinItems'

    const todosLosItems = comandasActivas.flatMap(c => c.items || [])
    const hayComandaEsperandoCobro = comandasActivas.some(c => c.estado === 'CUENTA_PEDIDA')

    if (todosLosItems.length === 0) return 'sinItems'

    const hayItemsListos = todosLosItems.some(item => item.estado === 'LISTO')
    const hayItemsEnProceso = todosLosItems.some(item =>
      ['PENDIENTE', 'ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION'].includes(item.estado)
    )
    const todosEntregadosOAnulados = todosLosItems.every(item =>
      ['ENTREGADO', 'ANULADO'].includes(item.estado)
    )

    if (hayItemsListos) return 'paraEntregar'
    if (hayItemsEnProceso || hayComandaEsperandoCobro) return 'enProceso'
    if (todosEntregadosOAnulados) return 'lista'

    return 'sinItems'
  }

  // Filtrar mesas según estado seleccionado (o todas si no hay filtro)
  const mesasFiltradas = estadoFiltro === null
    ? mesas
    : mesas.filter(mesa => clasificarMesa(mesa) === estadoFiltro)

  const getColorEstadoMesa = (mesa) => {
    // Mesa disponible - verde
    if (mesa.estado === 'LIBRE') {
      return 'bg-green-500'
    }

    // Mesa en limpieza - gris
    if (mesa.estado === 'LIMPIEZA') {
      return 'bg-gray-400'
    }

    // Mesa ocupada - analizar items de comandas activas
    const comandasActivas = mesa.comandas?.filter(c =>
      ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
    ) || []

    // Si no hay comandas activas pero está ocupada, retornar gris
    if (comandasActivas.length === 0) {
      return 'bg-gray-300'
    }

    // Verificar si alguna comanda está esperando cobro
    const hayComandaEsperandoCobro = comandasActivas.some(c => c.estado === 'CUENTA_PEDIDA')

    // Obtener todos los items de todas las comandas activas
    const todosLosItems = comandasActivas.flatMap(c => c.items || [])

    // Mesa abierta sin items - amarillo
    if (todosLosItems.length === 0) {
      return 'bg-yellow-500'
    }

    // Contar items por estado
    const hayItemsListos = todosLosItems.some(item => item.estado === 'LISTO')
    const hayItemsEnProceso = todosLosItems.some(item =>
      ['PENDIENTE', 'ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION'].includes(item.estado)
    )
    const todosEntregadosOAnulados = todosLosItems.every(item =>
      ['ENTREGADO', 'ANULADO'].includes(item.estado)
    )

    // Prioridad 1: Items listos para entregar - rojo
    if (hayItemsListos) {
      return 'bg-red-500'
    }

    // Prioridad 2: Items en proceso (cocina/barra/pendientes) - naranja
    if (hayItemsEnProceso) {
      return 'bg-orange-500'
    }

    // Prioridad 3: Comanda esperando cobro - naranja
    if (hayComandaEsperandoCobro) {
      return 'bg-orange-500'
    }

    // Prioridad 4: Todos los items entregados pero mesa no cerrada - celeste
    if (todosEntregadosOAnulados) {
      return 'bg-cyan-500'
    }

    // Default - gris
    return 'bg-gray-300'
  }

  const getTextoEstado = (mesa) => {
    if (mesa.estado === 'LIBRE') return 'Libre'
    if (mesa.estado === 'LIMPIEZA') return 'Limpieza'

    const comandasActivas = mesa.comandas?.filter(c =>
      ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
    ) || []

    const todosLosItems = comandasActivas.flatMap(c => c.items || [])
    const hayComandaEsperandoCobro = comandasActivas.some(c => c.estado === 'CUENTA_PEDIDA')

    if (todosLosItems.length === 0) return 'Sin items'

    const hayItemsListos = todosLosItems.some(item => item.estado === 'LISTO')
    const hayItemsEnProceso = todosLosItems.some(item =>
      ['PENDIENTE', 'ENVIADO_COCINA', 'ENVIADO_BARRA', 'EN_PREPARACION'].includes(item.estado)
    )

    if (hayItemsListos) return 'Para entregar'
    if (hayItemsEnProceso) return 'En proceso'
    if (hayComandaEsperandoCobro) return 'Esperando cobro'

    return 'Lista'
  }

  // Determina si la mesa necesita efecto de parpadeo (atención urgente)
  const necesitaAnimacion = (mesa) => {
    if (mesa.estado === 'LIBRE' || mesa.estado === 'LIMPIEZA') return false

    const comandasActivas = mesa.comandas?.filter(c =>
      ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
    ) || []

    if (comandasActivas.length === 0) return false

    const todosLosItems = comandasActivas.flatMap(c => c.items || [])
    const hayComandaEsperandoCobro = comandasActivas.some(c => c.estado === 'CUENTA_PEDIDA')
    const hayItemsListos = todosLosItems.some(item => item.estado === 'LISTO')

    // Parpadea si hay items listos para entregar O si está esperando cobro
    return hayItemsListos || hayComandaEsperandoCobro
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={UtensilsCrossed} title="Buffet" subtitle="Estado de mesas">
        {/* Toggle Mis Mesas / Todas - Solo para usuarios con permiso de ver todo */}
        {!soloMesas && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setVerMisMesas(false)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !verMisMesas ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setVerMisMesas(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                verMisMesas ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mis Mesas
            </button>
          </div>
        )}

        <NotificacionBuffet />

        {puedeAsignar && (
          <button
            onClick={() => setModalAsignacion(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
          >
            <Settings size={16} />
            <span className="hidden md:inline">Asignar Mozos</span>
          </button>
        )}

        <button
          onClick={cargarDatos}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
        >
          <RefreshCw size={16} />
          <span className="hidden md:inline">Actualizar</span>
        </button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* KPIs - Solo para usuarios con permiso */}
      {puedeVerKpis && kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="text-blue-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Mesas Ocupadas</p>
                <p className="text-2xl font-bold">{kpis.mesas?.ocupadas || 0}/{kpis.mesas?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <Users className="text-orange-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Comandas Activas</p>
                <p className="text-2xl font-bold">{kpis.comandas?.activas || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-purple-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Pedidos</p>
                <p className="text-2xl font-bold">{kpis.takeAway?.pendientes || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <ChefHat className="text-red-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">En Cocina</p>
                <p className="text-2xl font-bold">{kpis.cocina?.itemsPendientes || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
            <div className="flex items-center gap-3">
              <Clock className="text-gray-500" size={24} />
              <div>
                <p className="text-sm text-gray-600">Cerradas Hoy</p>
                <p className="text-2xl font-bold">{kpis.comandas?.cerradasHoy || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accesos Rápidos - OCULTOS por pedido del usuario */}
      {/*
      <div className={`grid grid-cols-2 ${soloMesas ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4`}>
        {tienePermiso(PERMISOS.BUFFET_CONFIG) && (
          <Link
            to="/admin/buffet/mesas"
            className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg text-center transition-colors"
          >
            <UtensilsCrossed size={32} className="mx-auto mb-2" />
            <span className="font-medium">Mesas</span>
          </Link>
        )}

        {!soloMesas && tienePermiso(PERMISOS.BUFFET_TAKEAWAY) && (
          <Link
            to="/admin/buffet/takeaway"
            className="bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-lg text-center transition-colors"
          >
            <ShoppingBag size={32} className="mx-auto mb-2" />
            <span className="font-medium">Pedidos</span>
          </Link>
        )}

        {!soloMesas && tienePermiso(PERMISOS.BUFFET_KIOSCO) && (
          <Link
            to="/admin/buffet/kiosco"
            className="bg-orange-600 hover:bg-orange-700 text-white p-6 rounded-lg text-center transition-colors"
          >
            <Coffee size={32} className="mx-auto mb-2" />
            <span className="font-medium">Kiosco</span>
          </Link>
        )}

        {tienePermiso(PERMISOS.BUFFET_COCINA) && (
          <Link
            to="/admin/buffet/cocina"
            className="bg-red-600 hover:bg-red-700 text-white p-6 rounded-lg text-center transition-colors"
          >
            <ChefHat size={32} className="mx-auto mb-2" />
            <span className="font-medium">Cocina</span>
          </Link>
        )}
      </div>
      */}

      {/* Mapa de Mesas */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Título y Filtros de Estado en la misma línea */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            {verMisMesas ? 'Mis Mesas Asignadas' : 'Estado de Mesas'}
          </h2>

          {/* Botones de filtro por estado */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
            <button
              onClick={() => toggleFiltroEstado('libre')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'libre'
                  ? 'bg-green-600 text-white border-green-700 shadow-md ring-2 ring-green-300'
                  : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
              }`}
            >
              Libre
            </button>

            <button
              onClick={() => toggleFiltroEstado('sinItems')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'sinItems'
                  ? 'bg-yellow-500 text-white border-yellow-600 shadow-md ring-2 ring-yellow-300'
                  : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
              }`}
            >
              Sin items
            </button>

            <button
              onClick={() => toggleFiltroEstado('enProceso')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'enProceso'
                  ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-300'
                  : 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'
              }`}
            >
              En proceso
            </button>

            <button
              onClick={() => toggleFiltroEstado('paraEntregar')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'paraEntregar'
                  ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-300'
                  : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
              }`}
            >
              Para entregar
            </button>

            <button
              onClick={() => toggleFiltroEstado('lista')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'lista'
                  ? 'bg-cyan-500 text-white border-cyan-600 shadow-md ring-2 ring-cyan-300'
                  : 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200'
              }`}
            >
              Lista
            </button>

            <button
              onClick={() => toggleFiltroEstado('limpieza')}
              className={`px-3 py-2 rounded-lg border-2 transition-all font-medium truncate ${
                estadoFiltro === 'limpieza'
                  ? 'bg-gray-500 text-white border-gray-600 shadow-md ring-2 ring-gray-300'
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              Limpieza
            </button>
          </div>
        </div>

        {/* Grid de Mesas */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {mesasFiltradas.map(mesa => {
            const comandasActivas = mesa.comandas?.filter(c =>
              ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'].includes(c.estado)
            ) || []
            const animar = necesitaAnimacion(mesa)

            // Obtener nombre del cliente (socio o nombre ingresado)
            const primerComanda = comandasActivas[0]
            const nombreCliente = primerComanda?.socio?.apellidoNombre
              || primerComanda?.observaciones
              || null

            return (
              <Link
                key={mesa.id}
                to={`/admin/buffet/comanda/${mesa.id}`}
                className={`${getColorEstadoMesa(mesa)} text-white p-3 md:p-4 rounded-lg text-center hover:opacity-90 transition-opacity relative`}
                style={animar ? { animation: 'blink 1.5s ease-in-out infinite' } : undefined}
              >
                {mesa.esComunal && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-[10px]" title="Mesa Comunal">
                    C
                  </div>
                )}
                <div className="font-bold text-xl">{mesa.numero}</div>
                <div className="text-sm font-semibold">{getTextoEstado(mesa)}</div>
                {nombreCliente && (
                  <div className="text-[11px] mt-1 opacity-90 truncate" title={nombreCliente}>
                    {nombreCliente.length > 12 ? nombreCliente.substring(0, 12) + '...' : nombreCliente}
                  </div>
                )}
                {mesa.esComunal && comandasActivas.length > 1 && (
                  <div className="text-[10px] opacity-75 mt-0.5">({comandasActivas.length} grupos)</div>
                )}
              </Link>
            )
          })}
        </div>

        {mesasFiltradas.length === 0 && mesas.length > 0 && estadoFiltro !== null && (
          <p className="text-center text-gray-500 py-8">
            No hay mesas en estado "{estadoFiltro === 'libre' ? 'Libre' : estadoFiltro === 'sinItems' ? 'Sin items' : estadoFiltro === 'enProceso' ? 'En proceso' : estadoFiltro === 'paraEntregar' ? 'Para entregar' : estadoFiltro === 'lista' ? 'Lista' : 'Limpieza'}".
          </p>
        )}

        {mesas.length === 0 && !verMisMesas && (
          <p className="text-center text-gray-500 py-8">
            No hay mesas configuradas.{' '}
            <Link to="/admin/buffet/mesas" className="text-blue-600 hover:underline">
              Configurar mesas
            </Link>
          </p>
        )}

        {mesas.length === 0 && verMisMesas && (
          <p className="text-center text-gray-500 py-8">
            No tenés mesas asignadas para este turno.
            <button
              onClick={() => setVerMisMesas(false)}
              className="block mx-auto mt-2 text-blue-600 hover:underline"
            >
              Ver todas las mesas
            </button>
          </p>
        )}
      </div>

      {/* Lista de Ventas del Período */}
      {puedeVerKpis && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt size={20} className="text-gray-500" />
              Ventas del período
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {RANGOS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRangoVentas(r.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    rangoVentas === r.key
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <button
                onClick={() => cargarVentas(rangoVentas)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                title="Actualizar"
              >
                <RefreshCw size={15} className={loadingVentas ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loadingVentas ? (
            <div className="py-8 text-center text-gray-500 text-sm">Cargando ventas...</div>
          ) : ventas.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              <FileText size={32} className="mx-auto mb-2 opacity-40" />
              Sin ventas en el período seleccionado
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="flex flex-wrap gap-4 mb-4 text-sm">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{ventas.length}</span> ventas
                </span>
                <span className="text-gray-600">
                  Total: <span className="font-semibold text-gray-900">{fmtMonto(ventas.reduce((s, v) => s + (v.total || 0), 0))}</span>
                </span>
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Hora</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">N°</th>
                      <th className="px-3 py-2 text-left font-medium">Detalle</th>
                      <th className="px-3 py-2 text-left font-medium">Items</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-left font-medium">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventas.map((v) => (
                      <tr key={`${v.tipo}-${v.id}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {rangoVentas !== 'hoy' && <span className="text-gray-400 mr-1">{fmtFecha(v.fecha)}</span>}
                          {fmtHora(v.fecha)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            v.tipo === 'COMANDA' ? 'bg-blue-100 text-blue-700' :
                            v.tipo === 'TAKEAWAY' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {v.tipo === 'COMANDA' ? 'Mesa' : v.tipo === 'TAKEAWAY' ? 'TakeAway' : 'Kiosco'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-600">{v.numero}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {v.mesa ? `Mesa ${v.mesa}` : ''}
                          {v.cliente ? v.cliente : ''}
                          {v.socio ? <span className="text-xs text-gray-500"> · {v.socio}</span> : ''}
                          {v.cobradoPor ? <span className="text-xs text-gray-400 ml-1">({v.cobradoPor})</span> : ''}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center">{v.itemsCount}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtMonto(v.total)}</td>
                        <td className="px-3 py-2">
                          {v.comprobante ? (
                            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              {v.comprobante.tipo} {v.comprobante.puntoVenta?.toString().padStart(4,'0')}-{v.comprobante.numero?.toString().padStart(8,'0')}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No fiscal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Asignación de Mozos */}
      <Modal
        isOpen={modalAsignacion}
        onClose={() => setModalAsignacion(false)}
        title="Asignar Mozos a Mesas"
        maxWidth="max-w-3xl"
      >
        {/* Mozos disponibles */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 mb-2">Mozos disponibles</h3>
          <div className="flex flex-wrap gap-2">
            {mozos.map(mozo => (
              <div key={mozo.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                <UserCheck size={14} className="text-purple-600" />
                <span>{mozo.nombreCompleto}</span>
                <span className="text-xs text-gray-500">({mozo.mesasAsignadas} mesas)</span>
              </div>
            ))}
            {mozos.length === 0 && (
              <p className="text-gray-500 text-sm">No hay mozos con permiso BUFFET_MESAS</p>
            )}
          </div>
        </div>

        {/* Tabla de asignaciones */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mesa</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Zona</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mozo Asignado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {todasLasMesas.map(mesa => (
                <tr key={mesa.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className="font-medium">Mesa {mesa.numero}</span>
                    {mesa.esComunal && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Comunal</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{mesa.zona || '-'}</td>
                  <td className="px-4 py-2">
                    <select
                      value={asignaciones[mesa.id] || ''}
                      onChange={e => handleAsignacionChange(mesa.id, e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Sin asignar</option>
                      {mozos.map(mozo => (
                        <option key={mozo.id} value={mozo.id}>{mozo.nombreCompleto}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {todasLasMesas.length === 0 && (
          <p className="text-center text-gray-500 py-4">No hay mesas configuradas</p>
        )}

        {/* Footer con botones */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <button
            onClick={limpiarAsignaciones}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={18} />
            Limpiar Turno
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setModalAsignacion(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={guardarAsignaciones}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Guardar Asignaciones
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog />

      {/* Xavi - Chat Widget para Camareros */}
      <ChatWidget role="camarero" position="bottom-right" />
    </div>
  )
}
