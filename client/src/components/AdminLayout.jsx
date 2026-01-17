import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Store, Users, BarChart3, LogOut } from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    const adminData = localStorage.getItem('adminData')
    if (!token) {
      navigate('/admin/login')
    } else if (adminData) {
      setAdmin(JSON.parse(adminData))
    }
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    navigate('/admin/login')
  }

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/comercios', label: 'Comercios', icon: Store },
    { path: '/admin/socios', label: 'Socios', icon: Users },
    { path: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
  ]

  function isActive(path) {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg hidden md:block">
        <div className="p-4 border-b">
          <Link to="/admin" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Logo" className="h-14" />
            <div>
              <span className="font-bold text-primary text-lg whitespace-nowrap">Rojo Plus</span>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </Link>
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
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
          <div className="md:hidden">
            <Link to="/admin" className="flex items-center gap-2">
              <img src="/images/logo.png" alt="Logo" className="h-10" />
              <span className="font-bold text-primary whitespace-nowrap">Rojo Plus</span>
            </Link>
          </div>
          <div className="hidden md:block">
            <span className="text-2xl font-bold text-gray-400 italic">Tu pasión tiene recompensas</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">
              {admin?.nombre || 'Admin'}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-500 hover:text-primary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesion</span>
            </button>
          </div>
        </header>

        {/* Mobile menu */}
        <div className="md:hidden bg-white border-b flex overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap ${
                  isActive(item.path)
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
