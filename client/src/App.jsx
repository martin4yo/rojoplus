import { Routes, Route } from 'react-router-dom'

// Páginas públicas
import Home from './pages/Home'
import Registro from './pages/registro/Registro'
import RegistroExito from './pages/registro/RegistroExito'

// Página del comerciante
import Comercio from './pages/comercio/Comercio'
import TokenInvalido from './pages/comercio/TokenInvalido'

// Página del socio
import SocioPortal from './pages/socio/SocioPortal'
import AccesoSocio from './pages/socio/AccesoSocio'
import ComerciosPublicos from './pages/public/Comercios'

// Páginas admin
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminComercios from './pages/admin/Comercios'
import AdminComercioDetalle from './pages/admin/ComercioDetalle'
import AdminSocios from './pages/admin/Socios'
import AdminSocioDetalle from './pages/admin/SocioDetalle'
import AdminSocioForm from './pages/admin/SocioForm'
import AdminSociosCargar from './pages/admin/SociosCargar'
import AdminReportes from './pages/admin/Reportes'
import AdminTablasAuxiliares from './pages/admin/TablasAuxiliares'
import AdminConfiguracionLista from './pages/admin/ConfiguracionLista'
import AdminConfiguracionForm from './pages/admin/ConfiguracionForm'
import AdminActividadesLista from './pages/admin/ActividadesLista'
import AdminActividadForm from './pages/admin/ActividadForm'
import AdminCategoriaActividadForm from './pages/admin/CategoriaActividadForm'
import AdminReporteActividades from './pages/admin/ReporteActividades'
import AdminReporteActividadDetalle from './pages/admin/ReporteActividadDetalle'
import AdminReporteCuotas from './pages/admin/ReporteCuotas'
import AdminReporteSocios from './pages/admin/ReporteSocios'
import AdminReporteComercios from './pages/admin/ReporteComercios'
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

// Contabilidad
import PlanCuentasLista from './pages/admin/contabilidad/PlanCuentasLista'
import CuentaContableForm from './pages/admin/contabilidad/CuentaContableForm'

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

// Layout admin
import AdminLayout from './components/AdminLayout'

function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/" element={<Home />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/registro/exito" element={<RegistroExito />} />

      {/* Ruta del comerciante */}
      <Route path="/comercio/:token" element={<Comercio />} />
      <Route path="/c/:token" element={<Comercio />} />
      <Route path="/acceso-invalido" element={<TokenInvalido />} />

      {/* Rutas del socio */}
      <Route path="/mi-qr" element={<AccesoSocio />} />
      <Route path="/s/:tokenPortal" element={<SocioPortal />} />
      <Route path="/comercios" element={<ComerciosPublicos />} />

      {/* Rutas admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="comercios" element={<AdminComercios />} />
        <Route path="comercios/:id" element={<AdminComercioDetalle />} />
        <Route path="socios" element={<AdminSocios />} />
        <Route path="socios/nuevo" element={<AdminSocioForm />} />
        <Route path="socios/cargar" element={<AdminSociosCargar />} />
        <Route path="socios/:id" element={<AdminSocioDetalle />} />
        <Route path="socios/:id/editar" element={<AdminSocioForm />} />
        <Route path="reportes" element={<AdminReportes />} />
        <Route path="reportes/actividades" element={<AdminReporteActividades />} />
        <Route path="reportes/actividades/:id" element={<AdminReporteActividadDetalle />} />
        <Route path="reportes/cuotas" element={<AdminReporteCuotas />} />
        <Route path="reportes/socios" element={<AdminReporteSocios />} />
        <Route path="reportes/comercios" element={<AdminReporteComercios />} />
        <Route path="configuracion" element={<AdminTablasAuxiliares />} />
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
        <Route path="ingresos/facturas" element={<PlaceholderPage title="Facturas Emitidas" description="Facturas de venta a clientes y socios" />} />
        <Route path="ingresos/facturas/nueva" element={<PlaceholderPage title="Nueva Factura de Venta" />} />
        <Route path="ingresos/facturas/:id" element={<PlaceholderPage title="Detalle de Factura" />} />
        <Route path="ingresos/recibos" element={<PlaceholderPage title="Recibos de Cobro" description="Recibos de cobro emitidos" />} />
        <Route path="ingresos/recibos/nuevo" element={<PlaceholderPage title="Nuevo Recibo de Cobro" />} />
        <Route path="ingresos/recibos/:id" element={<PlaceholderPage title="Detalle de Recibo" />} />

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
        <Route path="egresos/facturas" element={<PlaceholderPage title="Facturas Recibidas" description="Facturas de compra a proveedores" />} />
        <Route path="egresos/facturas/nueva" element={<PlaceholderPage title="Nueva Factura de Compra" />} />
        <Route path="egresos/facturas/:id" element={<PlaceholderPage title="Detalle de Factura" />} />
        <Route path="egresos/ordenes-pago" element={<PlaceholderPage title="Ordenes de Pago" description="Ordenes de pago a proveedores" />} />
        <Route path="egresos/ordenes-pago/nueva" element={<PlaceholderPage title="Nueva Orden de Pago" />} />
        <Route path="egresos/ordenes-pago/:id" element={<PlaceholderPage title="Detalle de Orden de Pago" />} />

        {/* Tesoreria */}
        <Route path="tesoreria/cajas" element={<CajasLista />} />
        <Route path="tesoreria/cajas/nueva" element={<CajaForm />} />
        <Route path="tesoreria/cajas/:id" element={<CajaDetalle />} />
        <Route path="tesoreria/cajas/:id/editar" element={<CajaForm />} />
        <Route path="tesoreria/movimientos" element={<MovimientosCajaLista />} />
        <Route path="tesoreria/movimientos/nuevo" element={<MovimientoCajaForm />} />
        <Route path="tesoreria/transferencias" element={<TransferenciasLista />} />
        <Route path="tesoreria/transferencias/nueva" element={<TransferenciaForm />} />

        {/* Contabilidad */}
        <Route path="contabilidad/plan-cuentas" element={<PlanCuentasLista />} />
        <Route path="contabilidad/plan-cuentas/nuevo" element={<CuentaContableForm />} />
        <Route path="contabilidad/plan-cuentas/:id" element={<CuentaContableForm />} />

        {/* Stock */}
        <Route path="stock/productos" element={<ProductosLista />} />
        <Route path="stock/productos/nuevo" element={<ProductoForm />} />
        <Route path="stock/productos/:id" element={<ProductoForm />} />
        <Route path="stock/categorias" element={<CategoriasProducto />} />
        <Route path="stock/movimientos" element={<MovimientosStockLista />} />
        <Route path="stock/movimientos/ajuste" element={<AjusteStockForm />} />
        <Route path="stock/alertas" element={<AlertasStock />} />
      </Route>
    </Routes>
  )
}

export default App
