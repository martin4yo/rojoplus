import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, Users, Clock, ChefHat, ShoppingBag, Coffee, AlertCircle, RefreshCw, Settings, UserCheck, Trash2, Receipt, Printer, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useNotificacionBuffet } from '../../../contexts/NotificacionBuffetContext'
import { useTicket } from '../../../contexts/TicketContext'
import NotificacionBuffet from '../../../components/buffet/NotificacionBuffet'
import Modal from '../../../components/Modal'

export default function BuffetDashboard() {
  const { imprimirTicket, generarTicketFiscal, generarTicketComanda } = useTicket()

  // Permisos del usuario
  const puedeVerKpis = tienePermiso(PERMISOS.BUFFET_VER) || tienePermiso(PERMISOS.BUFFET_CONFIG)
  const puedeAsignar = tienePermiso(PERMISOS.BUFFET_CONFIG)
  const puedeCobrar = tienePermiso(PERMISOS.BUFFET_COBRAR) || tienePermiso(PERMISOS.BUFFET_KIOSCO)
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

  // Últimas ventas
  const [ultimasVentas, setUltimasVentas] = useState([])
  const [mostrarVentas, setMostrarVentas] = useState(false)
  const [cargandoVentas, setCargandoVentas] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(null) // ID de la venta que se está imprimiendo

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

  // Cargar últimas ventas
  const cargarUltimasVentas = async () => {
    setCargandoVentas(true)
    try {
      const res = await api.get('/admin/buffet/ultimas-ventas?limit=15')
      const data = res?.data || res || []
      setUltimasVentas(data)
    } catch (err) {
      console.error('Error cargando últimas ventas:', err)
      toast.error('Error al cargar últimas ventas')
    } finally {
      setCargandoVentas(false)
    }
  }

  // Reimprimir ticket
  const reimprimirTicket = async (venta, tipoTicket) => {
    const ventaKey = `${venta.tipo}-${venta.id}-${tipoTicket}`
    setImprimiendo(ventaKey)
    try {
      const tipo = venta.tipo === 'COMANDA' ? 'comanda' : 'takeaway'
      const res = await api.post(`/admin/buffet/regenerar-ticket/${tipo}/${venta.id}`, { tipoTicket })
      const data = res?.data || res

      // Si es comprobante fiscal, generar ticket fiscal para el preview
      if (tipoTicket === 'comprobante' && data?.comprobante?.cae) {
        const ticketFiscal = generarTicketFiscal({
          comprobante: data.comprobante,
          items: data.items || [],
          qrUrl: data.qrUrl,
          empresa: data.empresa,
          medioPago: data.medioPago || 'EFECTIVO'
        })
        await imprimirTicket(ticketFiscal)
        toast.success('Factura lista para imprimir')
      } else if (tipoTicket === 'cuenta' && data?.comanda) {
        // Ticket de cuenta (pre-cuenta)
        const ticketCuenta = generarTicketComanda({
          numero: data.comanda.numero,
          mesa: data.comanda.mesa,
          items: data.items || [],
          subtotal: data.comanda.subtotal || data.comanda.total,
          total: data.comanda.total
        }, 'CUENTA')
        await imprimirTicket(ticketCuenta)
        toast.success('Ticket de cuenta listo')
      } else {
        // Ticket no fiscal (comanda sin factura o takeaway)
        const ticketNoFiscal = {
          tipo: venta.tipo === 'COMANDA' ? 'CUENTA' : 'TAKEAWAY',
          numero: data.comanda?.numero || data.pedido?.numero || venta.numero,
          mesa: data.comanda?.mesa?.numero || venta.mesa,
          cliente: data.comanda?.cliente || data.pedido?.nombreCliente || null,
          fecha: new Date(venta.fecha),
          items: data.items?.map(item => ({
            cantidad: item.cantidad,
            nombre: item.nombre,
            precio: Number(item.precioUnitario || item.precio || 0)
          })) || [],
          subtotal: data.comanda?.subtotal || data.pedido?.subtotal || venta.total,
          total: data.comanda?.total || data.pedido?.total || venta.total,
          medioPago: data.medioPago || 'EFECTIVO'
        }
        await imprimirTicket(ticketNoFiscal)
        toast.success('Ticket listo para imprimir')
      }
    } catch (err) {
      console.error('Error reimprimiendo ticket:', err)
      toast.error('Error al reimprimir ticket')
    } finally {
      setImprimiendo(null)
    }
  }

  // Toggle mostrar ventas
  const toggleMostrarVentas = () => {
    if (!mostrarVentas && ultimasVentas.length === 0) {
      cargarUltimasVentas()
    }
    setMostrarVentas(!mostrarVentas)
  }

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
    if (!confirm('¿Desasignar todas las mesas? (Limpiar turno)')) return

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buffet - Dashboard</h1>
          <p className="text-gray-600">Vista general del estado del buffet</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Notificaciones en tiempo real */}
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
        </div>
      </div>

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

      {/* Accesos Rápidos - Filtrados según permisos */}
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

      {/* Mapa de Mesas */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {verMisMesas ? 'Mis Mesas Asignadas' : 'Estado de Mesas'}
          </h2>
          {verMisMesas && mesas.length === 0 && (
            <span className="text-sm text-gray-500">No tenés mesas asignadas</span>
          )}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Sin items</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>En proceso / Cobro</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Para entregar</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
            <span>Lista</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Limpieza</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white text-[9px]">C</div>
            <span>Comunal</span>
          </div>
        </div>

        {/* Grid de Mesas */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {mesas.map(mesa => {
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

      {/* Últimas Ventas - Solo para usuarios con permiso de cobrar */}
      {puedeCobrar && (
        <div className="bg-white rounded-lg shadow">
          {/* Header colapsable */}
          <button
            onClick={toggleMostrarVentas}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Receipt className="text-green-600" size={20} />
              <h2 className="text-lg font-semibold">Últimas Ventas del Día</h2>
              {ultimasVentas.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  {ultimasVentas.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cargandoVentas && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              )}
              {mostrarVentas ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {/* Contenido colapsable */}
          {mostrarVentas && (
            <div className="border-t">
              {/* Botón de actualizar */}
              <div className="flex justify-end p-2 border-b bg-gray-50">
                <button
                  onClick={cargarUltimasVentas}
                  disabled={cargandoVentas}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={cargandoVentas ? 'animate-spin' : ''} />
                  Actualizar
                </button>
              </div>

              {/* Lista de ventas */}
              {ultimasVentas.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay ventas registradas hoy
                </p>
              ) : (
                <div className="divide-y max-h-96 overflow-y-auto">
                  {ultimasVentas.map(venta => (
                    <div key={`${venta.tipo}-${venta.id}`} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        {/* Info de la venta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              venta.tipo === 'COMANDA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {venta.tipo === 'COMANDA' ? `Mesa ${venta.mesa}` : 'TakeAway'}
                            </span>
                            <span className="font-medium">{venta.numero}</span>
                            <span className="text-green-600 font-semibold">
                              ${venta.total?.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                            <span>
                              {new Date(venta.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {venta.itemsCount > 0 && <span>{venta.itemsCount} items</span>}
                            {venta.socio && <span className="text-blue-600">{venta.socio}</span>}
                            {venta.cliente && <span>{venta.cliente}</span>}
                            {venta.cobradoPor && <span>por {venta.cobradoPor}</span>}
                            {venta.comprobante && (
                              <span className="text-green-600 flex items-center gap-0.5">
                                <FileText size={10} />
                                {venta.comprobante.tipo} {venta.comprobante.puntoVenta}-{venta.comprobante.numero}
                              </span>
                            )}
                            {venta.esVentaInterna && !venta.comprobante && (
                              <span className="text-amber-600">Venta Interna</span>
                            )}
                          </div>
                        </div>

                        {/* Botones de reimprimir */}
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {venta.tipo === 'COMANDA' && (
                            <button
                              onClick={() => reimprimirTicket(venta, 'cuenta')}
                              disabled={imprimiendo === `${venta.tipo}-${venta.id}-cuenta`}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                              title="Reimprimir ticket de cuenta"
                            >
                              {imprimiendo === `${venta.tipo}-${venta.id}-cuenta` ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              ) : (
                                <Receipt size={16} />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => reimprimirTicket(venta, 'comprobante')}
                            disabled={imprimiendo === `${venta.tipo}-${venta.id}-comprobante`}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                              venta.comprobante
                                ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                            title={venta.comprobante ? `Reimprimir ${venta.comprobante.tipo} ${venta.comprobante.puntoVenta}-${venta.comprobante.numero}` : 'Reimprimir ticket'}
                          >
                            {imprimiendo === `${venta.tipo}-${venta.id}-comprobante` ? (
                              <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${venta.comprobante ? 'border-green-600' : 'border-gray-600'}`}></div>
                            ) : venta.comprobante ? (
                              <FileText size={16} />
                            ) : (
                              <Receipt size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
    </div>
  )
}
