import { Routes, Route } from 'react-router-dom'

// Páginas públicas
import Home from './pages/Home'
import Registro from './pages/registro/Registro'
import RegistroExito from './pages/registro/RegistroExito'

// Página del comerciante
import Comercio from './pages/comercio/Comercio'
import TokenInvalido from './pages/comercio/TokenInvalido'

// Páginas admin
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminComercios from './pages/admin/Comercios'
import AdminComercioDetalle from './pages/admin/ComercioDetalle'
import AdminSocios from './pages/admin/Socios'
import AdminSociosCargar from './pages/admin/SociosCargar'
import AdminReportes from './pages/admin/Reportes'

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

      {/* Rutas admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="comercios" element={<AdminComercios />} />
        <Route path="comercios/:id" element={<AdminComercioDetalle />} />
        <Route path="socios" element={<AdminSocios />} />
        <Route path="socios/cargar" element={<AdminSociosCargar />} />
        <Route path="reportes" element={<AdminReportes />} />
      </Route>
    </Routes>
  )
}

export default App
