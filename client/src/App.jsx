import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ScrollToTop from './components/ScrollToTop'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionError from './components/ConnectionError'
import { errorStore, useConnectionError } from './stores/errorStore'
import TenantStyles from './components/TenantStyles'
import SWUpdateNotifier from './components/SWUpdateNotifier'
import { TenantProvider } from './contexts/TenantContext'
import { TicketProvider } from './contexts/TicketContext'
import { NotificacionBuffetProvider } from './contexts/NotificacionBuffetContext'
import { ShopCartProvider } from './contexts/ShopCartContext'
import { ShopAuthProvider } from './contexts/ShopAuthContext'

// Layouts (no lazy — son el shell, se necesitan siempre)
import PublicLayout from './pages/public/Layout/PublicLayout'
import AdminLayout from './components/AdminLayout'
import SuperAdminLayout from './components/SuperAdminLayout'

// Configuración global — Mercado Pago
const ConfiguracionMercadoPago = lazy(() => import('./pages/admin/configuracion/MercadoPago'))

// Tienda Online — Admin
const TiendaConfiguracion = lazy(() => import('./pages/admin/tienda/Configuracion'))
const TiendaEstados = lazy(() => import('./pages/admin/tienda/Estados'))
const TiendaPedidos = lazy(() => import('./pages/admin/tienda/Pedidos'))
const TiendaPedidoDetalle = lazy(() => import('./pages/admin/tienda/PedidoDetalle'))

// Tienda Online — Público
const TiendaPublica = lazy(() => import('./pages/public/tienda/Tienda'))
const TiendaProductoDetalle = lazy(() => import('./pages/public/tienda/ProductoDetalle'))
const TiendaCarrito = lazy(() => import('./pages/public/tienda/Carrito'))
const TiendaCheckout = lazy(() => import('./pages/public/tienda/Checkout'))
const TiendaCheckoutResultado = lazy(() => import('./pages/public/tienda/CheckoutResultado'))
const TiendaLogin = lazy(() => import('./pages/public/tienda/LoginTienda'))
const TiendaLoginMagic = lazy(() => import('./pages/public/tienda/LoginMagic'))
const TiendaVerificarEmail = lazy(() => import('./pages/public/tienda/VerificarEmail'))
const TiendaMisPedidos = lazy(() => import('./pages/public/tienda/MisPedidos'))

// Páginas públicas
const HomePublic = lazy(() => import('./pages/public/Home'))
const ActividadesPublic = lazy(() => import('./pages/public/Actividades'))
const HistoriaPublic = lazy(() => import('./pages/public/Historia'))
const ContactoPublic = lazy(() => import('./pages/public/Contacto'))
const NoticiasPublic = lazy(() => import('./pages/public/Noticias'))
const NoticiaDetallePublic = lazy(() => import('./pages/public/NoticiaDetalle'))
const InstalacionesPublic = lazy(() => import('./pages/public/Instalaciones'))
const AutoridadesPublic = lazy(() => import('./pages/public/Autoridades'))
const MisionPublic = lazy(() => import('./pages/public/Mision'))
const ActividadDetallePublic = lazy(() => import('./pages/public/ActividadDetalle'))
const CalendarioPublic = lazy(() => import('./pages/public/Calendario'))
const CronogramaPublic = lazy(() => import('./pages/public/Cronograma'))
const GaleriaPublic = lazy(() => import('./pages/public/Galeria'))
const NotFoundPublic = lazy(() => import('./pages/public/NotFound'))
const ComerciosPublicos = lazy(() => import('./pages/public/Comercios'))
const InscripcionSocio = lazy(() => import('./pages/public/InscripcionSocio'))
const AgregarFamiliares = lazy(() => import('./pages/public/AgregarFamiliares'))
const MenuBuffet = lazy(() => import('./pages/public/MenuBuffet'))
const ReservasPublico = lazy(() => import('./pages/public/ReservasPublico'))

// Registro
const Registro = lazy(() => import('./pages/registro/Registro'))
const RegistroExito = lazy(() => import('./pages/registro/RegistroExito'))
const RegistroClub = lazy(() => import('./pages/registro/RegistroClub'))

// Comercio
const Comercio = lazy(() => import('./pages/comercio/Comercio'))
const ComercioEditar = lazy(() => import('./pages/comercio/ComercioEditar'))
const TokenInvalido = lazy(() => import('./pages/comercio/TokenInvalido'))

// Portal Socio
const SocioPortal = lazy(() => import('./pages/socio/SocioPortal'))
const AccesoSocio = lazy(() => import('./pages/socio/AccesoSocio'))
const LoginSocio = lazy(() => import('./pages/socio/LoginSocio'))
const PortalSocioNuevo = lazy(() => import('./pages/socio/PortalSocioNuevo'))
const LoginEntrenador = lazy(() => import('./pages/entrenador/LoginEntrenador'))
const ValidarLinkEntrenador = lazy(() => import('./pages/entrenador/ValidarLinkEntrenador'))
const PortalEntrenador = lazy(() => import('./pages/entrenador/PortalEntrenador'))

// Admin — generales
const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminLoginAlt = lazy(() => import('./pages/admin/LoginAlt'))
const AdminDashboard = lazy(() => import('./pages/admin/DashboardEjecutivo'))
const AdminComercios = lazy(() => import('./pages/admin/Comercios'))
const AdminComercioDetalle = lazy(() => import('./pages/admin/ComercioDetalle'))
const AdminSocios = lazy(() => import('./pages/admin/Socios'))
const AdminSocioDetalle = lazy(() => import('./pages/admin/SocioDetalle'))
const AdminSocioForm = lazy(() => import('./pages/admin/SocioForm'))
const AdminSociosCargar = lazy(() => import('./pages/admin/SociosCargar'))
const AdminReportes = lazy(() => import('./pages/admin/Reportes'))
const ReportTemplatesPage = lazy(() => import('./pages/admin/reportes/ReportTemplatesPage'))
const ReportDesignerPage = lazy(() => import('./pages/admin/reportes/ReportDesignerPage'))
const ReportViewerPage = lazy(() => import('./pages/admin/reportes/ReportViewerPage'))
const RunReportsPage = lazy(() => import('./pages/admin/reportes/RunReportsPage'))
const AdminTablasAuxiliares = lazy(() => import('./pages/admin/TablasAuxiliares'))
const AdminSolicitudes = lazy(() => import('./pages/admin/Solicitudes'))
const AdminInscripciones = lazy(() => import('./pages/admin/Inscripciones'))
const AdminCierreCaja = lazy(() => import('./pages/admin/CierreCaja'))
const AdminDebitoAutomatico = lazy(() => import('./pages/admin/DebitoAutomatico'))
const AdminPublicidad = lazy(() => import('./pages/admin/Publicidad'))
const AdminNoticias = lazy(() => import('./pages/admin/Noticias'))
const ContenidoPaginas = lazy(() => import('./pages/admin/ContenidoPaginas'))
const AdminAutoridades = lazy(() => import('./pages/admin/Autoridades'))
const AdminConfiguracionLista = lazy(() => import('./pages/admin/ConfiguracionLista'))
const AdminConfiguracionForm = lazy(() => import('./pages/admin/ConfiguracionForm'))
const AdminConfiguracionPagos = lazy(() => import('./pages/admin/ConfiguracionPagos'))
const EmailTemplates = lazy(() => import('./pages/admin/templates/EmailTemplates'))
const PdfTemplates = lazy(() => import('./pages/admin/templates/PdfTemplates'))
const AdminActividadesLista = lazy(() => import('./pages/admin/ActividadesLista'))
const AdminActividadForm = lazy(() => import('./pages/admin/ActividadForm'))
const AdminCategoriaActividadForm = lazy(() => import('./pages/admin/CategoriaActividadForm'))
const AdminReporteActividades = lazy(() => import('./pages/admin/ReporteActividades'))
const AdminReporteActividadDetalle = lazy(() => import('./pages/admin/ReporteActividadDetalle'))
const AdminReporteCuotas = lazy(() => import('./pages/admin/ReporteCuotas'))
const AdminReporteSocios = lazy(() => import('./pages/admin/ReporteSocios'))
const AdminReporteComercios = lazy(() => import('./pages/admin/ReporteComercios'))
const AdminReporteCentrosCosto = lazy(() => import('./pages/admin/ReporteCentrosCosto'))
const DashboardEjecutivoCentros = lazy(() => import('./pages/admin/centros-costo/DashboardEjecutivo'))
const EvolucionTemporalCentros = lazy(() => import('./pages/admin/centros-costo/EvolucionTemporal'))
const RentabilidadActividades = lazy(() => import('./pages/admin/centros-costo/RentabilidadActividades'))
const PresupuestoVsReal = lazy(() => import('./pages/admin/centros-costo/PresupuestoVsReal'))
const MovimientosCentroCosto = lazy(() => import('./pages/admin/centros-costo/MovimientosCentroCosto'))
const ReporteMatrizCentros = lazy(() => import('./pages/admin/centros-costo/ReporteMatriz'))
const AdminReporteMorosidad = lazy(() => import('./pages/admin/ReporteMorosidadAvanzado'))
const AdminEntrenadoresLista = lazy(() => import('./pages/admin/EntrenadoresLista'))
const AdminEntrenadorForm = lazy(() => import('./pages/admin/EntrenadorForm'))
const AdminPeriodos = lazy(() => import('./pages/admin/Periodos'))
const AdminPreviewGeneracionCuotas = lazy(() => import('./pages/admin/PreviewGeneracionCuotas'))
const AdminCuotas = lazy(() => import('./pages/admin/Cuotas'))
const AdminCargosAdicionales = lazy(() => import('./pages/admin/CargosAdicionales'))
const PlaceholderPage = lazy(() => import('./pages/admin/PlaceholderPage'))
const Branding = lazy(() => import('./pages/admin/Branding'))
const MiPerfil = lazy(() => import('./pages/admin/MiPerfil'))
const AccesosRapidos = lazy(() => import('./pages/admin/AccesosRapidos'))
const IAMetricas = lazy(() => import('./pages/admin/IAMetricas'))

// Usuarios y Roles
const UsuariosLista = lazy(() => import('./pages/admin/usuarios/UsuariosLista'))
const UsuarioForm = lazy(() => import('./pages/admin/usuarios/UsuarioForm'))
const RolesLista = lazy(() => import('./pages/admin/usuarios/RolesLista'))
const RolForm = lazy(() => import('./pages/admin/usuarios/RolForm'))

// Entidades
const EntidadesLista = lazy(() => import('./pages/admin/entidades/EntidadesLista'))
const EntidadForm = lazy(() => import('./pages/admin/entidades/EntidadForm'))
const EntidadDetalle = lazy(() => import('./pages/admin/entidades/EntidadDetalle'))

// Tesoreria
const CajasLista = lazy(() => import('./pages/admin/tesoreria/CajasLista'))
const CajaForm = lazy(() => import('./pages/admin/tesoreria/CajaForm'))
const CajaDetalle = lazy(() => import('./pages/admin/tesoreria/CajaDetalle'))
const MovimientosCajaLista = lazy(() => import('./pages/admin/tesoreria/MovimientosCajaLista'))
const MovimientoCajaForm = lazy(() => import('./pages/admin/tesoreria/MovimientoCajaForm'))
const TransferenciasLista = lazy(() => import('./pages/admin/tesoreria/TransferenciasLista'))
const TransferenciaForm = lazy(() => import('./pages/admin/tesoreria/TransferenciaForm'))
const PendientesConciliar = lazy(() => import('./pages/admin/tesoreria/PendientesConciliar'))
const ConciliacionBancaria = lazy(() => import('./pages/admin/tesoreria/ConciliacionBancaria'))
const ConciliacionDetalle = lazy(() => import('./pages/admin/tesoreria/ConciliacionDetalle'))

// Contabilidad
const PlanCuentasLista = lazy(() => import('./pages/admin/contabilidad/PlanCuentasLista'))
const CuentaContableForm = lazy(() => import('./pages/admin/contabilidad/CuentaContableForm'))
const CentrosCostoLista = lazy(() => import('./pages/admin/configuracion/CentrosCostoLista'))
const ConfiguracionFiscal = lazy(() => import('./pages/admin/configuracion/ConfiguracionFiscal'))
const MenuAdmin = lazy(() => import('./pages/admin/configuracion/MenuAdmin'))
const AsientosLista = lazy(() => import('./pages/admin/contabilidad/AsientosLista'))
const AsientoForm = lazy(() => import('./pages/admin/contabilidad/AsientoForm'))
const AsientoDetalle = lazy(() => import('./pages/admin/contabilidad/AsientoDetalle'))
const LibroMayor = lazy(() => import('./pages/admin/contabilidad/LibroMayor'))
const PresupuestosLista = lazy(() => import('./pages/admin/contabilidad/PresupuestosLista'))
const PresupuestoEditor = lazy(() => import('./pages/admin/contabilidad/PresupuestoEditor'))
const PresupuestoEjecucion = lazy(() => import('./pages/admin/contabilidad/PresupuestoEjecucion'))
const PresupuestoVigente = lazy(() => import('./pages/admin/contabilidad/PresupuestoVigente'))

// Stock
const ProductosLista = lazy(() => import('./pages/admin/stock/ProductosLista'))
const ProductoForm = lazy(() => import('./pages/admin/stock/ProductoForm'))
const CategoriasProducto = lazy(() => import('./pages/admin/stock/CategoriasProducto'))
const MovimientosStockLista = lazy(() => import('./pages/admin/stock/MovimientosStockLista'))
const AjusteStockForm = lazy(() => import('./pages/admin/stock/AjusteStockForm'))
const AlertasStock = lazy(() => import('./pages/admin/stock/AlertasStock'))

// Egresos - Ordenes de Compra
const OrdenesCompraLista = lazy(() => import('./pages/admin/egresos/OrdenesCompraLista'))
const OrdenCompraForm = lazy(() => import('./pages/admin/egresos/OrdenCompraForm'))
const OrdenCompraDetalle = lazy(() => import('./pages/admin/egresos/OrdenCompraDetalle'))

// Egresos - Facturas de Compra
const FacturasCompraLista = lazy(() => import('./pages/admin/egresos/FacturasCompraLista'))
const FacturaCompraForm = lazy(() => import('./pages/admin/egresos/FacturaCompraForm'))
const FacturaCompraDetalle = lazy(() => import('./pages/admin/egresos/FacturaCompraDetalle'))

// Egresos - Ordenes de Pago
const OrdenesPagoLista = lazy(() => import('./pages/admin/egresos/OrdenesPagoLista'))
const OrdenPagoForm = lazy(() => import('./pages/admin/egresos/OrdenPagoForm'))
const OrdenPagoDetalle = lazy(() => import('./pages/admin/egresos/OrdenPagoDetalle'))

// Ingresos - Pedidos
const PedidosLista = lazy(() => import('./pages/admin/ingresos/PedidosLista'))
const PedidoForm = lazy(() => import('./pages/admin/ingresos/PedidoForm'))
const PedidoDetalle = lazy(() => import('./pages/admin/ingresos/PedidoDetalle'))

// Ingresos - Facturas de Venta
const FacturasVentaLista = lazy(() => import('./pages/admin/ingresos/FacturasVentaLista'))
const FacturaVentaForm = lazy(() => import('./pages/admin/ingresos/FacturaVentaForm'))
const FacturaVentaDetalle = lazy(() => import('./pages/admin/ingresos/FacturaVentaDetalle'))

// Ingresos - Recibos de Cobro
const RecibosCobroLista = lazy(() => import('./pages/admin/ingresos/RecibosCobroLista'))
const ReciboCobroForm = lazy(() => import('./pages/admin/ingresos/ReciboCobroForm'))
const ReciboCobroDetalle = lazy(() => import('./pages/admin/ingresos/ReciboCobroDetalle'))

// Liquidaciones de Sueldos
const LiquidacionesLista = lazy(() => import('./pages/admin/liquidaciones/LiquidacionesLista'))
const LiquidacionForm = lazy(() => import('./pages/admin/liquidaciones/LiquidacionForm'))
const LiquidacionDetalle = lazy(() => import('./pages/admin/liquidaciones/LiquidacionDetalle'))
const ConceptosLiquidacion = lazy(() => import('./pages/admin/liquidaciones/ConceptosLiquidacion'))
const NovedadesLiquidacion = lazy(() => import('./pages/admin/liquidaciones/NovedadesLiquidacion'))
const MantenimientoLista = lazy(() => import('./pages/admin/mantenimiento/MantenimientoLista'))
const OrdenTrabajoForm = lazy(() => import('./pages/admin/mantenimiento/OrdenTrabajoForm'))
const OrdenTrabajoDetalle = lazy(() => import('./pages/admin/mantenimiento/OrdenTrabajoDetalle'))

// Deportes
const EspaciosLista = lazy(() => import('./pages/admin/deportes/EspaciosLista'))
const EspacioForm = lazy(() => import('./pages/admin/deportes/EspacioForm'))
const TiposEspacioConfig = lazy(() => import('./pages/admin/deportes/TiposEspacioConfig'))
const HorariosRecurrentes = lazy(() => import('./pages/admin/deportes/HorariosRecurrentes'))
const EntrenamientosCalendario = lazy(() => import('./pages/admin/deportes/EntrenamientosCalendario'))
const AsistenciaEntrenamiento = lazy(() => import('./pages/admin/deportes/AsistenciaEntrenamiento'))
const EquiposLista = lazy(() => import('./pages/admin/deportes/EquiposLista'))
const EquipoDetalle = lazy(() => import('./pages/admin/deportes/EquipoDetalle'))
const CampeonatosLista = lazy(() => import('./pages/admin/deportes/CampeonatosLista'))
const CampeonatoDetalle = lazy(() => import('./pages/admin/deportes/CampeonatoDetalle'))
const PlanillaEntrenamiento = lazy(() => import('./pages/admin/deportes/PlanillaEntrenamiento'))
const SeguimientoMedico = lazy(() => import('./pages/admin/SeguimientoMedico'))
const Partidos = lazy(() => import('./pages/admin/Partidos'))
const PartidoDetalle = lazy(() => import('./pages/admin/PartidoDetalle'))
const ReportesDeportivos = lazy(() => import('./pages/admin/ReportesDeportivos'))
const PasajeCategoria = lazy(() => import('./pages/admin/PasajeCategoria'))

// Gobernanza
const ActasLista = lazy(() => import('./pages/admin/gobernanza/ActasLista'))
const ActaDetalle = lazy(() => import('./pages/admin/gobernanza/ActaDetalle'))
const Votaciones = lazy(() => import('./pages/admin/gobernanza/Votaciones'))
const VotacionDetalle = lazy(() => import('./pages/admin/gobernanza/VotacionDetalle'))
const DocumentosClub = lazy(() => import('./pages/admin/gobernanza/DocumentosClub'))

// Buffet
const BuffetDashboard = lazy(() => import('./pages/admin/buffet/BuffetDashboardNew'))
const BuffetEstadoMesas = lazy(() => import('./pages/admin/buffet/BuffetEstadoMesas'))
const BuffetMesas = lazy(() => import('./pages/admin/buffet/BuffetMesas'))
const BuffetCategorias = lazy(() => import('./pages/admin/buffet/BuffetCategorias'))
const BuffetProductos = lazy(() => import('./pages/admin/buffet/BuffetProductos'))
const BuffetProductoOpciones = lazy(() => import('./pages/admin/buffet/BuffetProductoOpciones'))
const BuffetPrecios = lazy(() => import('./pages/admin/buffet/BuffetPrecios'))
const ImportarProductos = lazy(() => import('./pages/admin/buffet/ImportarProductos'))
const BuffetComanda = lazy(() => import('./pages/admin/buffet/BuffetComanda'))
const BuffetCocina = lazy(() => import('./pages/admin/buffet/BuffetCocina'))
const BuffetKiosco = lazy(() => import('./pages/admin/buffet/BuffetKiosco'))
const BuffetTakeAway = lazy(() => import('./pages/admin/buffet/BuffetTakeAway'))
const BuffetBarra = lazy(() => import('./pages/admin/buffet/BuffetBarra'))
const BuffetImpresoras = lazy(() => import('./pages/admin/buffet/BuffetImpresoras'))

// Control de Accesos
const MonitorAccesos = lazy(() => import('./pages/admin/accesos/MonitorAccesos'))
const IntentosDenegados = lazy(() => import('./pages/admin/accesos/IntentosDenegados'))
const Habilitaciones = lazy(() => import('./pages/admin/accesos/Habilitaciones'))
const ControlPWA = lazy(() => import('./pages/admin/accesos/ControlPWA'))
const VentaVentanilla = lazy(() => import('./pages/admin/accesos/VentaVentanilla'))
const Dispositivos = lazy(() => import('./pages/admin/accesos/Dispositivos'))

// Eventos
const EventosLista = lazy(() => import('./pages/admin/eventos/EventosLista'))
const EventoForm = lazy(() => import('./pages/admin/eventos/EventoForm'))
const EventoDetalle = lazy(() => import('./pages/admin/eventos/EventoDetalle'))
const VentaEntradas = lazy(() => import('./pages/admin/eventos/VentaEntradas'))

// Reservas
const ReservasCalendario = lazy(() => import('./pages/admin/reservas/ReservasCalendario'))
const ConfigReservas = lazy(() => import('./pages/admin/reservas/ConfigReservas'))

// Cobranzas / Recupero / Comunicaciones
const GestionCobranzas = lazy(() => import('./pages/admin/GestionCobranzas'))
const DetalleGestion = lazy(() => import('./pages/admin/DetalleGestion'))
const GestionRecupero = lazy(() => import('./pages/admin/GestionRecupero'))
const GestionComunicaciones = lazy(() => import('./pages/admin/GestionComunicaciones'))
const DetalleCampana = lazy(() => import('./pages/admin/DetalleCampana'))
const AdminChatEntrenadores = lazy(() => import('./pages/admin/ChatEntrenadores'))

// Super-Admin
const SuperAdminDashboard = lazy(() => import('./pages/super-admin/Dashboard'))
const TenantsList = lazy(() => import('./pages/super-admin/TenantsList'))
const TenantForm = lazy(() => import('./pages/super-admin/TenantForm'))
const TenantDetail = lazy(() => import('./pages/super-admin/TenantDetail'))
const TenantUsage = lazy(() => import('./pages/super-admin/TenantUsage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
    </div>
  )
}

function ConnectionErrorOverlay() {
  const { hasConnectionError, detail } = useConnectionError()
  if (!hasConnectionError) return null
  return (
    <ConnectionError
      error={detail}
      onRetry={() => {
        errorStore.setConnectionError(false)
        window.location.reload()
      }}
    />
  )
}

function App() {
  return (
    <ErrorBoundary>
      <TenantProvider>
        <TenantStyles />
        <ConnectionErrorOverlay />
        <ShopAuthProvider>
        <ShopCartProvider>
        <TicketProvider>
          <NotificacionBuffetProvider>
            <ScrollToTop />
            <Toaster
              position="top-right"
              containerStyle={{ zIndex: 100000 }}
              toastOptions={{ style: { zIndex: 100000 } }}
            />
            <SWUpdateNotifier />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Sitio web público del club */}
                <Route path="/" element={<PublicLayout />}>
                  <Route index element={<HomePublic />} />
                  <Route path="actividades" element={<ActividadesPublic />} />
                  <Route path="actividades/:id" element={<ActividadDetallePublic />} />
                  <Route path="calendario" element={<CalendarioPublic />} />
                  <Route path="cronograma" element={<CronogramaPublic />} />
                  <Route path="galeria" element={<GaleriaPublic />} />
                  <Route path="historia" element={<HistoriaPublic />} />
                  <Route path="mision" element={<MisionPublic />} />
                  <Route path="autoridades" element={<AutoridadesPublic />} />
                  <Route path="instalaciones" element={<InstalacionesPublic />} />
                  <Route path="contacto" element={<ContactoPublic />} />
                  <Route path="noticias" element={<NoticiasPublic />} />
                  <Route path="noticias/:slug" element={<NoticiaDetallePublic />} />
                  <Route path="comercios" element={<ComerciosPublicos />} />
                  <Route path="menu-buffet" element={<MenuBuffet />} />
                  <Route path="buffet/menu" element={<MenuBuffet />} />
                  <Route path="login-socio" element={<LoginSocio />} />
                  <Route path="login-entrenador" element={<LoginEntrenador />} />
                  <Route path="mi-qr" element={<AccesoSocio />} />

                  {/* Tienda Online — Público */}
                  <Route path="tienda" element={<TiendaPublica />} />
                  <Route path="tienda/carrito" element={<TiendaCarrito />} />
                  <Route path="tienda/checkout" element={<TiendaCheckout />} />
                  <Route path="tienda/checkout/exito" element={<TiendaCheckoutResultado />} />
                  <Route path="tienda/checkout/error" element={<TiendaCheckoutResultado />} />
                  <Route path="tienda/checkout/pendiente" element={<TiendaCheckoutResultado />} />
                  <Route path="tienda/login" element={<TiendaLogin />} />
                  <Route path="tienda/login-magic" element={<TiendaLoginMagic />} />
                  <Route path="tienda/verificar-email" element={<TiendaVerificarEmail />} />
                  <Route path="tienda/mis-pedidos" element={<TiendaMisPedidos />} />
                  <Route path="tienda/:id" element={<TiendaProductoDetalle />} />

                  <Route path="*" element={<NotFoundPublic />} />
                </Route>

                <Route path="/registro" element={<Registro />} />
                <Route path="/registro/exito" element={<RegistroExito />} />
                <Route path="/registro-club" element={<RegistroClub />} />
                <Route path="/inscripcion-socio" element={<InscripcionSocio />} />
                <Route path="/inscripcion-socio/:solicitudId/familiares" element={<AgregarFamiliares />} />

                {/* Ruta del comerciante */}
                <Route path="/comercio/:token" element={<Comercio />} />
                <Route path="/comercio/:token/editar" element={<ComercioEditar />} />
                <Route path="/c/:token" element={<Comercio />} />
                <Route path="/c/:token/editar" element={<ComercioEditar />} />
                <Route path="/acceso-invalido" element={<TokenInvalido />} />

                {/* Rutas del socio (login-socio y mi-qr ahora viven dentro de PublicLayout) */}
                <Route path="/s/:tokenPortal" element={<SocioPortal />} />
                <Route path="/portal-socio/:tokenPortal" element={<PortalSocioNuevo />} />
                <Route path="/portal-entrenador/:token" element={<ValidarLinkEntrenador />} />
                <Route path="/portal-entrenador" element={<PortalEntrenador />} />

                {/* Reservas públicas */}
                <Route path="/reservas" element={<ReservasPublico />} />
                <Route path="/reservas/confirmacion" element={<ReservasPublico />} />

                {/* Rutas admin */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/login-alt" element={<AdminLoginAlt />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="mi-perfil" element={<MiPerfil />} />
                  <Route path="accesos-rapidos" element={<AccesosRapidos />} />
                  <Route path="dashboard-ejecutivo" element={<Navigate to="/admin" replace />} />
                  <Route path="comercios" element={<AdminComercios />} />
                  <Route path="comercios/:id" element={<AdminComercioDetalle />} />
                  <Route path="socios" element={<AdminSocios />} />
                  <Route path="socios/nuevo" element={<AdminSocioForm />} />
                  <Route path="socios/cargar" element={<AdminSociosCargar />} />
                  <Route path="socios/:id" element={<AdminSocioDetalle />} />
                  <Route path="socios/:id/editar" element={<AdminSocioForm />} />
                  <Route path="solicitudes" element={<AdminSolicitudes />} />
                  <Route path="inscripciones" element={<AdminInscripciones />} />
                  <Route path="cierres-caja" element={<AdminCierreCaja />} />
                  <Route path="debito-automatico" element={<AdminDebitoAutomatico />} />
                  <Route path="publicidad" element={<AdminPublicidad />} />
                  <Route path="noticias" element={<AdminNoticias />} />
                  <Route path="contenido/paginas/:slug" element={<ContenidoPaginas />} />
                  <Route path="contenido/paginas" element={<ContenidoPaginas />} />
                  <Route path="reportes" element={<AdminReportes />} />
                  <Route path="reportes/designer" element={<ReportTemplatesPage />} />
                  <Route path="reportes/designer/nuevo" element={<ReportDesignerPage />} />
                  <Route path="reportes/designer/:id/editar" element={<ReportDesignerPage />} />
                  <Route path="reportes/designer/:id/ejecutar" element={<ReportViewerPage />} />
                  <Route path="reportes/ejecutar" element={<RunReportsPage />} />
                  <Route path="reportes/actividades" element={<AdminReporteActividades />} />
                  <Route path="reportes/actividades/:id" element={<AdminReporteActividadDetalle />} />
                  <Route path="reportes/cuotas" element={<AdminReporteCuotas />} />
                  <Route path="reportes/socios" element={<AdminReporteSocios />} />
                  <Route path="reportes/comercios" element={<AdminReporteComercios />} />
                  <Route path="reportes/centros-costo" element={<AdminReporteCentrosCosto />} />
                  <Route path="reportes/centros-costo/dashboard" element={<DashboardEjecutivoCentros />} />
                  <Route path="reportes/centros-costo/evolucion" element={<EvolucionTemporalCentros />} />
                  <Route path="reportes/centros-costo/rentabilidad" element={<RentabilidadActividades />} />
                  <Route path="reportes/centros-costo/presupuesto" element={<PresupuestoVsReal />} />
                  <Route path="reportes/centros-costo/movimientos" element={<MovimientosCentroCosto />} />
                  <Route path="reportes/centros-costo/matriz" element={<ReporteMatrizCentros />} />
                  <Route path="reportes/morosidad" element={<AdminReporteMorosidad />} />
                  <Route path="configuracion" element={<AdminTablasAuxiliares />} />
                  <Route path="configuracion/pagos" element={<AdminConfiguracionPagos />} />
                  <Route path="configuracion/pagos/mercadopago" element={<ConfiguracionMercadoPago />} />
                  <Route path="configuracion/autoridades" element={<AdminAutoridades />} />
                  <Route path="configuracion/centros-costo" element={<CentrosCostoLista />} />
                  <Route path="configuracion/fiscal" element={<ConfiguracionFiscal />} />
                  <Route path="configuracion/menu" element={<MenuAdmin />} />
                  <Route path="configuracion/templates/email" element={<EmailTemplates />} />
                  <Route path="configuracion/templates/pdf" element={<PdfTemplates />} />
                  <Route path="configuracion/branding" element={<Branding />} />
                  <Route path="configuracion/:tabla" element={<AdminConfiguracionLista />} />
                  <Route path="configuracion/:tabla/nuevo" element={<AdminConfiguracionForm />} />
                  <Route path="configuracion/:tabla/:id" element={<AdminConfiguracionForm />} />

                  {/* Usuarios y Roles */}
                  <Route path="configuracion/usuarios" element={<UsuariosLista />} />
                  <Route path="configuracion/usuarios/nuevo" element={<UsuarioForm />} />
                  <Route path="configuracion/usuarios/:id" element={<UsuarioForm />} />
                  <Route path="configuracion/roles" element={<RolesLista />} />
                  <Route path="configuracion/roles/nuevo" element={<RolForm />} />
                  <Route path="configuracion/roles/:id" element={<RolForm />} />
                  <Route path="actividades" element={<AdminActividadesLista />} />
                  <Route path="actividades/nueva" element={<AdminActividadForm />} />
                  <Route path="actividades/:id" element={<AdminActividadForm />} />
                  <Route path="actividades/:id/categoria/nueva" element={<AdminCategoriaActividadForm />} />
                  <Route path="actividades/:id/categoria/:catId" element={<AdminCategoriaActividadForm />} />
                  <Route path="entrenadores" element={<AdminEntrenadoresLista />} />
                  <Route path="entrenadores/nuevo" element={<AdminEntrenadorForm />} />
                  <Route path="entrenadores/:id" element={<AdminEntrenadorForm />} />
                  <Route path="cuotas" element={<AdminCuotas />} />
                  <Route path="cargos-adicionales" element={<AdminCargosAdicionales />} />
                  <Route path="periodos" element={<AdminPeriodos />} />
                  <Route path="periodos/:id/preview-generacion" element={<AdminPreviewGeneracionCuotas />} />

                  {/* Ingresos */}
                  <Route path="ingresos/clientes" element={<EntidadesLista tipo="CLIENTE" />} />
                  <Route path="ingresos/clientes/nuevo" element={<EntidadForm tipo="CLIENTE" />} />
                  <Route path="ingresos/clientes/:id" element={<EntidadDetalle tipo="CLIENTE" />} />
                  <Route path="ingresos/clientes/:id/editar" element={<EntidadForm tipo="CLIENTE" />} />
                  <Route path="ingresos/pedidos" element={<PedidosLista />} />
                  <Route path="ingresos/pedidos/nuevo" element={<PedidoForm />} />
                  <Route path="ingresos/pedidos/:id" element={<PedidoDetalle />} />
                  <Route path="ingresos/pedidos/:id/editar" element={<PedidoForm />} />
                  <Route path="ingresos/facturas" element={<FacturasVentaLista />} />
                  <Route path="ingresos/facturas/nueva" element={<FacturaVentaForm />} />
                  <Route path="ingresos/facturas/:id" element={<FacturaVentaDetalle />} />
                  <Route path="ingresos/recibos" element={<RecibosCobroLista />} />
                  <Route path="ingresos/recibos/nuevo" element={<ReciboCobroForm />} />
                  <Route path="ingresos/recibos/:id" element={<ReciboCobroDetalle />} />

                  {/* Egresos */}
                  <Route path="egresos/proveedores" element={<EntidadesLista tipo="PROVEEDOR" />} />
                  <Route path="egresos/proveedores/nuevo" element={<EntidadForm tipo="PROVEEDOR" />} />
                  <Route path="egresos/proveedores/:id" element={<EntidadDetalle tipo="PROVEEDOR" />} />
                  <Route path="egresos/proveedores/:id/editar" element={<EntidadForm tipo="PROVEEDOR" />} />
                  <Route path="egresos/personal" element={<EntidadesLista tipo="PERSONAL" />} />
                  <Route path="egresos/personal/nuevo" element={<EntidadForm tipo="PERSONAL" />} />
                  <Route path="egresos/personal/:id" element={<EntidadDetalle tipo="PERSONAL" />} />
                  <Route path="egresos/personal/:id/editar" element={<EntidadForm tipo="PERSONAL" />} />
                  <Route path="egresos/ordenes-compra" element={<OrdenesCompraLista />} />
                  <Route path="egresos/ordenes-compra/nueva" element={<OrdenCompraForm />} />
                  <Route path="egresos/ordenes-compra/:id" element={<OrdenCompraDetalle />} />
                  <Route path="egresos/ordenes-compra/:id/editar" element={<OrdenCompraForm />} />
                  <Route path="egresos/ordenes-compra/:id/recibir" element={<OrdenCompraDetalle />} />
                  <Route path="egresos/facturas" element={<FacturasCompraLista />} />
                  <Route path="egresos/facturas/nueva" element={<FacturaCompraForm />} />
                  <Route path="egresos/facturas/:id" element={<FacturaCompraDetalle />} />
                  <Route path="egresos/facturas/:id/pagar" element={<FacturaCompraDetalle />} />
                  <Route path="egresos/ordenes-pago" element={<OrdenesPagoLista />} />
                  <Route path="egresos/ordenes-pago/nueva" element={<OrdenPagoForm />} />
                  <Route path="egresos/ordenes-pago/:id" element={<OrdenPagoDetalle />} />

                  {/* Tesoreria */}
                  <Route path="tesoreria/cajas" element={<CajasLista />} />
                  <Route path="tesoreria/cajas/nueva" element={<CajaForm />} />
                  <Route path="tesoreria/cajas/:id" element={<CajaDetalle />} />
                  <Route path="tesoreria/cajas/:id/editar" element={<CajaForm />} />
                  <Route path="tesoreria/movimientos" element={<MovimientosCajaLista />} />
                  <Route path="tesoreria/movimientos/nuevo" element={<MovimientoCajaForm />} />
                  <Route path="tesoreria/movimientos/:id" element={<MovimientoCajaForm />} />
                  <Route path="tesoreria/transferencias" element={<TransferenciasLista />} />
                  <Route path="tesoreria/transferencias/nueva" element={<TransferenciaForm />} />
                  <Route path="tesoreria/pendientes-conciliar" element={<PendientesConciliar />} />
                  <Route path="tesoreria/conciliacion" element={<ConciliacionBancaria />} />
                  <Route path="tesoreria/conciliacion/:id" element={<ConciliacionDetalle />} />

                  {/* Contabilidad */}
                  <Route path="contabilidad/plan-cuentas" element={<PlanCuentasLista />} />
                  <Route path="contabilidad/plan-cuentas/nuevo" element={<CuentaContableForm />} />
                  <Route path="contabilidad/plan-cuentas/:id" element={<CuentaContableForm />} />
                  <Route path="contabilidad/asientos" element={<AsientosLista />} />
                  <Route path="contabilidad/asientos/nuevo" element={<AsientoForm />} />
                  <Route path="contabilidad/asientos/:id" element={<AsientoDetalle />} />
                  <Route path="contabilidad/asientos/:id/editar" element={<AsientoForm />} />
                  <Route path="contabilidad/libro-mayor" element={<LibroMayor />} />
                  <Route path="contabilidad/presupuestos" element={<PresupuestosLista />} />
                  <Route path="contabilidad/presupuestos/vigente" element={<PresupuestoVigente />} />
                  <Route path="contabilidad/presupuestos/:id" element={<PresupuestoEditor />} />
                  <Route path="contabilidad/presupuestos/:id/ejecucion" element={<PresupuestoEjecucion />} />

                  {/* Tienda Online */}
                  <Route path="tienda/pedidos" element={<TiendaPedidos />} />
                  <Route path="tienda/pedidos/:id" element={<TiendaPedidoDetalle />} />
                  <Route path="tienda/estados" element={<TiendaEstados />} />
                  <Route path="tienda/configuracion" element={<TiendaConfiguracion />} />

                  {/* Stock */}
                  <Route path="stock/productos" element={<ProductosLista />} />
                  <Route path="stock/productos/nuevo" element={<ProductoForm />} />
                  <Route path="stock/productos/:id" element={<ProductoForm />} />
                  <Route path="stock/categorias" element={<CategoriasProducto />} />
                  <Route path="stock/movimientos" element={<MovimientosStockLista />} />
                  <Route path="stock/movimientos/ajuste" element={<AjusteStockForm />} />
                  <Route path="stock/alertas" element={<AlertasStock />} />

                  {/* Liquidaciones de Sueldos */}
                  <Route path="liquidaciones" element={<LiquidacionesLista />} />
                  <Route path="liquidaciones/nueva" element={<LiquidacionForm />} />
                  <Route path="liquidaciones/:id" element={<LiquidacionDetalle />} />
                  <Route path="liquidaciones/conceptos" element={<ConceptosLiquidacion />} />
                  <Route path="liquidaciones/novedades" element={<NovedadesLiquidacion />} />

                  {/* Mantenimiento */}
                  <Route path="mantenimiento" element={<MantenimientoLista />} />
                  <Route path="mantenimiento/nueva" element={<OrdenTrabajoForm />} />
                  <Route path="mantenimiento/:id" element={<OrdenTrabajoDetalle />} />
                  <Route path="mantenimiento/:id/editar" element={<OrdenTrabajoForm />} />

                  {/* Deportes */}
                  <Route path="deportes/tipos-espacio" element={<TiposEspacioConfig />} />
                  <Route path="deportes/espacios" element={<EspaciosLista />} />
                  <Route path="deportes/espacios/nuevo" element={<EspacioForm />} />
                  <Route path="deportes/espacios/:id" element={<EspacioForm />} />
                  <Route path="deportes/horarios" element={<HorariosRecurrentes />} />
                  <Route path="deportes/entrenamientos" element={<EntrenamientosCalendario />} />
                  <Route path="deportes/asistencia/:id" element={<AsistenciaEntrenamiento />} />
                  <Route path="deportes/equipos" element={<EquiposLista />} />
                  <Route path="deportes/equipos/:id" element={<EquipoDetalle />} />
                  <Route path="deportes/campeonatos" element={<CampeonatosLista />} />
                  <Route path="deportes/campeonatos/:id" element={<CampeonatoDetalle />} />
                  <Route path="deportes/planilla/:id" element={<PlanillaEntrenamiento />} />
                  <Route path="socios/:id/medico" element={<SeguimientoMedico />} />

                  {/* Gobernanza */}
                  <Route path="gobernanza/actas" element={<ActasLista />} />
                  <Route path="gobernanza/actas/:id" element={<ActaDetalle />} />
                  <Route path="gobernanza/votaciones" element={<Votaciones />} />
                  <Route path="gobernanza/votaciones/:id" element={<VotacionDetalle />} />
                  <Route path="gobernanza/documentos" element={<DocumentosClub />} />

                  <Route path="partidos" element={<Partidos />} />
                  <Route path="partidos/:id" element={<PartidoDetalle />} />
                  <Route path="reportes/deportivos" element={<ReportesDeportivos />} />
                  <Route path="deportes/pasaje-categoria" element={<PasajeCategoria />} />

                  {/* Buffet */}
                  <Route path="buffet" element={<BuffetDashboard />} />
                  <Route path="buffet/estado" element={<BuffetEstadoMesas />} />
                  <Route path="buffet/mesas" element={<BuffetMesas />} />
                  <Route path="buffet/categorias" element={<BuffetCategorias />} />
                  <Route path="buffet/productos" element={<BuffetProductos />} />
                  <Route path="buffet/productos/importar" element={<ImportarProductos />} />
                  <Route path="buffet/productos/:productoId/opciones" element={<BuffetProductoOpciones />} />
                  <Route path="buffet/precios" element={<BuffetPrecios />} />
                  <Route path="buffet/comanda/:mesaId" element={<BuffetComanda />} />
                  <Route path="buffet/kds" element={<BuffetCocina />} />
                  <Route path="buffet/kds/:sector" element={<BuffetCocina />} />
                  <Route path="buffet/cocina" element={<BuffetCocina />} />
                  <Route path="buffet/kiosco" element={<BuffetKiosco />} />
                  <Route path="buffet/takeaway" element={<BuffetTakeAway />} />
                  <Route path="buffet/barra" element={<BuffetBarra />} />
                  <Route path="buffet/impresoras" element={<BuffetImpresoras />} />

                  {/* Control de Accesos */}
                  <Route path="accesos/monitor" element={<MonitorAccesos />} />
                  <Route path="accesos/intentos-denegados" element={<IntentosDenegados />} />
                  <Route path="accesos/habilitaciones" element={<Habilitaciones />} />
                  <Route path="accesos/control-pwa" element={<ControlPWA />} />
                  <Route path="accesos/venta-ventanilla" element={<VentaVentanilla />} />
                  <Route path="accesos/dispositivos" element={<Dispositivos />} />

                  {/* Eventos */}
                  <Route path="eventos" element={<EventosLista />} />
                  <Route path="eventos/vender" element={<VentaEntradas />} />
                  <Route path="eventos/nuevo" element={<EventoForm />} />
                  <Route path="eventos/:id" element={<EventoDetalle />} />
                  <Route path="eventos/:id/editar" element={<EventoForm />} />

                  {/* Reservas */}
                  <Route path="reservas" element={<ReservasCalendario />} />
                  <Route path="reservas/config" element={<ConfigReservas />} />

                  {/* Gestión de Cobranzas */}
                  <Route path="cobranzas" element={<GestionCobranzas />} />
                  <Route path="cobranzas/:id" element={<DetalleGestion />} />

                  {/* Gestión de Recupero */}
                  <Route path="recupero" element={<GestionRecupero />} />

                  {/* Gestión de Comunicaciones */}
                  <Route path="comunicaciones" element={<GestionComunicaciones />} />
                  <Route path="comunicaciones/campanas/:id" element={<DetalleCampana />} />

                  {/* Chat Entrenadores */}
                  <Route path="chat-entrenadores" element={<AdminChatEntrenadores />} />

                  {/* Gestión de Tenants (solo superadmin) */}
                  <Route path="tenants" element={<TenantsList />} />
                  <Route path="tenants/nuevo" element={<TenantForm />} />
                  <Route path="tenants/:id" element={<TenantDetail />} />
                  <Route path="tenants/:id/editar" element={<TenantForm />} />
                  <Route path="uso" element={<TenantUsage />} />
                  <Route path="ia-metricas" element={<IAMetricas />} />
                </Route>
              </Routes>
            </Suspense>
          </NotificacionBuffetProvider>
        </TicketProvider>
        </ShopCartProvider>
        </ShopAuthProvider>
      </TenantProvider>
    </ErrorBoundary>
  )
}

export default App
