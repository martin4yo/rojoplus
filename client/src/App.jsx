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
      </Route>
    </Routes>
  )
}

export default App
