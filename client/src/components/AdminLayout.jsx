import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Store, Users, BarChart3, LogOut, Settings, Menu, X, Receipt } from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    const adminData = localStorage.getItem('adminData')
    if (!token) {
      navigate('/admin/login')
    } else if (adminData) {
      setAdmin(JSON.parse(adminData))
    }
  }, [navigate])

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  function handleLogout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    navigate('/admin/login')
  }

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/comercios', label: 'Comercios', icon: Store },
    { path: '/admin/socios', label: 'Socios', icon: Users },
    { path: '/admin/periodos', label: 'Cuotas', icon: Receipt },
    { path: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
    { path: '/admin/configuracion', label: 'Configuración', icon: Settings },
  ]

  function isActive(path) {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Overlay para móvil */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white shadow-lg
        transform transition-transform duration-300 ease-in-out
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-4 border-b flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Logo" className="h-14" />
            <div>
              <span className="font-bold text-primary text-lg whitespace-nowrap">Rojo Plus</span>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </Link>
          {/* Botón cerrar en móvil */}
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        {/* Info del usuario en sidebar móvil */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{admin?.nombre || 'Admin'}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-500 hover:text-red-600 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Botón hamburguesa en móvil */}
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="md:hidden">
              <Link to="/admin" className="flex items-center gap-2">
                <img src="/images/logo.png" alt="Logo" className="h-8" />
                <span className="font-bold text-primary whitespace-nowrap">Rojo Plus</span>
              </Link>
            </div>
            <div className="hidden md:block">
              <span className="text-2xl font-bold text-gray-400 italic">Tu pasión tiene recompensas</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-gray-600 text-sm">
              {admin?.nombre || 'Admin'}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
