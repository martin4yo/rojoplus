import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ScrollToTop from './components/ScrollToTop'
import ErrorBoundary from './components/ErrorBoundary'
import { TicketProvider } from './contexts/TicketContext'
import { NotificacionBuffetProvider } from './contexts/NotificacionBuffetContext'

// Páginas públicas - Sitio web del club
import PublicLayout from './pages/public/Layout/PublicLayout'
import HomePublic from './pages/public/Home'
import ActividadesPublic from './pages/public/Actividades'
import HistoriaPublic from './pages/public/Historia'
import ContactoPublic from './pages/public/Contacto'
import NoticiasPublic from './pages/public/Noticias'
import NoticiaDetallePublic from './pages/public/NoticiaDetalle'
import InstalacionesPublic from './pages/public/Instalaciones'
import AutoridadesPublic from './pages/public/Autoridades'
import MisionPublic from './pages/public/Mision'
import ActividadDetallePublic from './pages/public/ActividadDetalle'
import CalendarioPublic from './pages/public/Calendario'
import CronogramaPublic from './pages/public/Cronograma'
import GaleriaPublic from './pages/public/Galeria'
import NotFoundPublic from './pages/public/NotFound'

// Registro comercios
import Registro from './pages/registro/Registro'
import RegistroExito from './pages/registro/RegistroExito'

// Página del comerciante
import Comercio from './pages/comercio/Comercio'
import ComercioEditar from './pages/comercio/ComercioEditar'
import TokenInvalido from './pages/comercio/TokenInvalido'

// Página del socio
import SocioPortal from './pages/socio/SocioPortal'
import AccesoSocio from './pages/socio/AccesoSocio'
import LoginSocio from './pages/socio/LoginSocio'
import PortalSocioNuevo from './pages/socio/PortalSocioNuevo'
import ComerciosPublicos from './pages/public/Comercios'
import InscripcionSocio from './pages/public/InscripcionSocio'
import AgregarFamiliares from './pages/public/AgregarFamiliares'

// Páginas admin
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminDashboardEjecutivo from './pages/admin/DashboardEjecutivo'
import AdminComercios from './pages/admin/Comercios'
import AdminComercioDetalle from './pages/admin/ComercioDetalle'
import AdminSocios from './pages/admin/Socios'
import AdminSocioDetalle from './pages/admin/SocioDetalle'
import AdminSocioForm from './pages/admin/SocioForm'
import AdminSociosCargar from './pages/admin/SociosCargar'
import AdminReportes from './pages/admin/Reportes'
import AdminTablasAuxiliares from './pages/admin/TablasAuxiliares'
import AdminSolicitudes from './pages/admin/Solicitudes'
import AdminInscripciones from './pages/admin/Inscripciones'
import AdminCierreCaja from './pages/admin/CierreCaja'
import AdminDebitoAutomatico from './pages/admin/DebitoAutomatico'
import AdminPublicidad from './pages/admin/Publicidad'
import AdminNoticias from './pages/admin/Noticias'
import AdminAutoridades from './pages/admin/Autoridades'
import AdminConfiguracionLista from './pages/admin/ConfiguracionLista'
import AdminConfiguracionForm from './pages/admin/ConfiguracionForm'
import AdminConfiguracionPagos from './pages/admin/ConfiguracionPagos'
import EmailTemplates from './pages/admin/templates/EmailTemplates'
import PdfTemplates from './pages/admin/templates/PdfTemplates'
import AdminActividadesLista from './pages/admin/ActividadesLista'
import AdminActividadForm from './pages/admin/ActividadForm'
import AdminCategoriaActividadForm from './pages/admin/CategoriaActividadForm'
import AdminReporteActividades from './pages/admin/ReporteActividades'
import AdminReporteActividadDetalle from './pages/admin/ReporteActividadDetalle'
import AdminReporteCuotas from './pages/admin/ReporteCuotas'
import AdminReporteSocios from './pages/admin/ReporteSocios'
import AdminReporteComercios from './pages/admin/ReporteComercios'
import AdminReporteCentrosCosto from './pages/admin/ReporteCentrosCosto'
import AdminReporteMorosidad from './pages/admin/ReporteMorosidadAvanzado'
import AdminEntrenadoresLista from './pages/admin/EntrenadoresLista'
import AdminEntrenadorForm from './pages/admin/EntrenadorForm'
import AdminPeriodos from './pages/admin/Periodos'
import AdminCuotas from './pages/admin/Cuotas'
import PlaceholderPage from './pages/admin/PlaceholderPage'

// Usuarios y Roles
import UsuariosLista from './pages/admin/usuarios/UsuariosLista'
import UsuarioForm from './pages/admin/usuarios/UsuarioForm'
import RolesLista from './pages/admin/usuarios/RolesLista'
import RolForm from './pages/admin/usuarios/RolForm'

// Entidades (Proveedores, Clientes, Personal)
import EntidadesLista from './pages/admin/entidades/EntidadesLista'
import EntidadForm from './pages/admin/entidades/EntidadForm'
import EntidadDetalle from './pages/admin/entidades/EntidadDetalle'

// Tesoreria
import CajasLista from './pages/admin/tesoreria/CajasLista'
import CajaForm from './pages/admin/tesoreria/CajaForm'
import CajaDetalle from './pages/admin/tesoreria/CajaDetalle'
import MovimientosCajaLista from './pages/admin/tesoreria/MovimientosCajaLista'
import MovimientoCajaForm from './pages/admin/tesoreria/MovimientoCajaForm'
import TransferenciasLista from './pages/admin/tesoreria/TransferenciasLista'
import TransferenciaForm from './pages/admin/tesoreria/TransferenciaForm'
import PendientesConciliar from './pages/admin/tesoreria/PendientesConciliar'
import ConciliacionBancaria from './pages/admin/tesoreria/ConciliacionBancaria'
import ConciliacionDetalle from './pages/admin/tesoreria/ConciliacionDetalle'

// Contabilidad
import PlanCuentasLista from './pages/admin/contabilidad/PlanCuentasLista'
import CuentaContableForm from './pages/admin/contabilidad/CuentaContableForm'
import CentrosCostoLista from './pages/admin/configuracion/CentrosCostoLista'
import ConfiguracionFiscal from './pages/admin/configuracion/ConfiguracionFiscal'
import MenuAdmin from './pages/admin/configuracion/MenuAdmin'
import AsientosLista from './pages/admin/contabilidad/AsientosLista'
import AsientoForm from './pages/admin/contabilidad/AsientoForm'
import AsientoDetalle from './pages/admin/contabilidad/AsientoDetalle'
import LibroMayor from './pages/admin/contabilidad/LibroMayor'
import PresupuestosLista from './pages/admin/contabilidad/PresupuestosLista'
import PresupuestoEditor from './pages/admin/contabilidad/PresupuestoEditor'
import PresupuestoEjecucion from './pages/admin/contabilidad/PresupuestoEjecucion'
import PresupuestoVigente from './pages/admin/contabilidad/PresupuestoVigente'

// Stock
import ProductosLista from './pages/admin/stock/ProductosLista'
import ProductoForm from './pages/admin/stock/ProductoForm'
import CategoriasProducto from './pages/admin/stock/CategoriasProducto'
import MovimientosStockLista from './pages/admin/stock/MovimientosStockLista'
import AjusteStockForm from './pages/admin/stock/AjusteStockForm'
import AlertasStock from './pages/admin/stock/AlertasStock'

// Egresos - Ordenes de Compra
import OrdenesCompraLista from './pages/admin/egresos/OrdenesCompraLista'
import OrdenCompraForm from './pages/admin/egresos/OrdenCompraForm'
import OrdenCompraDetalle from './pages/admin/egresos/OrdenCompraDetalle'

// Egresos - Facturas de Compra
import FacturasCompraLista from './pages/admin/egresos/FacturasCompraLista'
import FacturaCompraForm from './pages/admin/egresos/FacturaCompraForm'
import FacturaCompraDetalle from './pages/admin/egresos/FacturaCompraDetalle'

// Egresos - Ordenes de Pago
import OrdenesPagoLista from './pages/admin/egresos/OrdenesPagoLista'
import OrdenPagoForm from './pages/admin/egresos/OrdenPagoForm'
import OrdenPagoDetalle from './pages/admin/egresos/OrdenPagoDetalle'

// Ingresos - Pedidos
import PedidosLista from './pages/admin/ingresos/PedidosLista'
import PedidoForm from './pages/admin/ingresos/PedidoForm'
import PedidoDetalle from './pages/admin/ingresos/PedidoDetalle'

// Ingresos - Facturas de Venta
import FacturasVentaLista from './pages/admin/ingresos/FacturasVentaLista'
import FacturaVentaForm from './pages/admin/ingresos/FacturaVentaForm'
import FacturaVentaDetalle from './pages/admin/ingresos/FacturaVentaDetalle'

// Ingresos - Recibos de Cobro
import RecibosCobroLista from './pages/admin/ingresos/RecibosCobroLista'
import ReciboCobroForm from './pages/admin/ingresos/ReciboCobroForm'
import ReciboCobroDetalle from './pages/admin/ingresos/ReciboCobroDetalle'

// Liquidaciones de Sueldos
import LiquidacionesLista from './pages/admin/liquidaciones/LiquidacionesLista'
import LiquidacionForm from './pages/admin/liquidaciones/LiquidacionForm'
import LiquidacionDetalle from './pages/admin/liquidaciones/LiquidacionDetalle'
import ConceptosLiquidacion from './pages/admin/liquidaciones/ConceptosLiquidacion'

// Deportes
import EspaciosLista from './pages/admin/deportes/EspaciosLista'
import EspacioForm from './pages/admin/deportes/EspacioForm'
import TiposEspacioConfig from './pages/admin/deportes/TiposEspacioConfig'
import HorariosRecurrentes from './pages/admin/deportes/HorariosRecurrentes'
import EntrenamientosCalendario from './pages/admin/deportes/EntrenamientosCalendario'
import AsistenciaEntrenamiento from './pages/admin/deportes/AsistenciaEntrenamiento'
import Partidos from './pages/admin/Partidos'
import PartidoDetalle from './pages/admin/PartidoDetalle'
import ReportesDeportivos from './pages/admin/ReportesDeportivos'
import PasajeCategoria from './pages/admin/PasajeCategoria'
import MiPerfil from './pages/admin/MiPerfil'

// Buffet
import BuffetDashboard from './pages/admin/buffet/BuffetDashboardNew'
import BuffetEstadoMesas from './pages/admin/buffet/BuffetDashboard'
import BuffetMesas from './pages/admin/buffet/BuffetMesas'
import BuffetCategorias from './pages/admin/buffet/BuffetCategorias'
import BuffetProductos from './pages/admin/buffet/BuffetProductos'
import BuffetPrecios from './pages/admin/buffet/BuffetPrecios'
import ImportarProductos from './pages/admin/buffet/ImportarProductos'
import BuffetComanda from './pages/admin/buffet/BuffetComanda'
import BuffetCocina from './pages/admin/buffet/BuffetCocina'
import BuffetKiosco from './pages/admin/buffet/BuffetKiosco'
import BuffetTakeAway from './pages/admin/buffet/BuffetTakeAway'
import BuffetBarra from './pages/admin/buffet/BuffetBarra'
import BuffetImpresoras from './pages/admin/buffet/BuffetImpresoras'
import MenuBuffet from './pages/public/MenuBuffet'

// Control de Accesos
import MonitorAccesos from './pages/admin/accesos/MonitorAccesos'
import IntentosDenegados from './pages/admin/accesos/IntentosDenegados'
import Habilitaciones from './pages/admin/accesos/Habilitaciones'
import ControlPWA from './pages/admin/accesos/ControlPWA'

// Eventos
import EventosLista from './pages/admin/eventos/EventosLista'
import EventoForm from './pages/admin/eventos/EventoForm'
import EventoDetalle from './pages/admin/eventos/EventoDetalle'
import VentaEntradas from './pages/admin/eventos/VentaEntradas'

// Layout admin
import AdminLayout from './components/AdminLayout'

function App() {
  return (
    <ErrorBoundary>
      <TicketProvider>
        <NotificacionBuffetProvider>
          <ScrollToTop />
          <Toaster position="top-right" />
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
          <Route path="*" element={<NotFoundPublic />} />
        </Route>
      <Route path="/registro" element={<Registro />} />
      <Route path="/registro/exito" element={<RegistroExito />} />
      <Route path="/inscripcion-socio" element={<InscripcionSocio />} />
      <Route path="/inscripcion-socio/:solicitudId/familiares" element={<AgregarFamiliares />} />

      {/* Ruta del comerciante */}
      <Route path="/comercio/:token" element={<Comercio />} />
      <Route path="/comercio/:token/editar" element={<ComercioEditar />} />
      <Route path="/c/:token" element={<Comercio />} />
      <Route path="/c/:token/editar" element={<ComercioEditar />} />
      <Route path="/acceso-invalido" element={<TokenInvalido />} />

      {/* Rutas del socio */}
      <Route path="/mi-qr" element={<AccesoSocio />} />
      <Route path="/s/:tokenPortal" element={<SocioPortal />} />
      <Route path="/login-socio" element={<LoginSocio />} />
      <Route path="/portal-socio/:tokenPortal" element={<PortalSocioNuevo />} />

      {/* Menú Buffet Público */}
      <Route path="/buffet/menu" element={<MenuBuffet />} />
      <Route path="/menu-buffet" element={<MenuBuffet />} />

      {/* Rutas admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="mi-perfil" element={<MiPerfil />} />
        <Route path="dashboard-ejecutivo" element={<AdminDashboardEjecutivo />} />
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
        <Route path="reportes" element={<AdminReportes />} />
        <Route path="reportes/actividades" element={<AdminReporteActividades />} />
        <Route path="reportes/actividades/:id" element={<AdminReporteActividadDetalle />} />
        <Route path="reportes/cuotas" element={<AdminReporteCuotas />} />
        <Route path="reportes/socios" element={<AdminReporteSocios />} />
        <Route path="reportes/comercios" element={<AdminReporteComercios />} />
        <Route path="reportes/centros-costo" element={<AdminReporteCentrosCosto />} />
        <Route path="reportes/morosidad" element={<AdminReporteMorosidad />} />
        <Route path="configuracion" element={<AdminTablasAuxiliares />} />
        <Route path="configuracion/pagos" element={<AdminConfiguracionPagos />} />
        <Route path="configuracion/autoridades" element={<AdminAutoridades />} />
        <Route path="configuracion/centros-costo" element={<CentrosCostoLista />} />
        <Route path="configuracion/fiscal" element={<ConfiguracionFiscal />} />
        <Route path="configuracion/menu" element={<MenuAdmin />} />
        <Route path="configuracion/templates/email" element={<EmailTemplates />} />
        <Route path="configuracion/templates/pdf" element={<PdfTemplates />} />
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
        <Route path="periodos" element={<AdminPeriodos />} />

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

        {/* Deportes */}
        <Route path="deportes/tipos-espacio" element={<TiposEspacioConfig />} />
        <Route path="deportes/espacios" element={<EspaciosLista />} />
        <Route path="deportes/espacios/nuevo" element={<EspacioForm />} />
        <Route path="deportes/espacios/:id" element={<EspacioForm />} />
        <Route path="deportes/horarios" element={<HorariosRecurrentes />} />
        <Route path="deportes/entrenamientos" element={<EntrenamientosCalendario />} />
        <Route path="deportes/asistencia/:id" element={<AsistenciaEntrenamiento />} />
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

        {/* Eventos */}
        <Route path="eventos" element={<EventosLista />} />
        <Route path="eventos/vender" element={<VentaEntradas />} />
        <Route path="eventos/nuevo" element={<EventoForm />} />
        <Route path="eventos/:id" element={<EventoDetalle />} />
        <Route path="eventos/:id/editar" element={<EventoForm />} />
      </Route>
        </Routes>
        </NotificacionBuffetProvider>
      </TicketProvider>
    </ErrorBoundary>
  )
}

export default App
