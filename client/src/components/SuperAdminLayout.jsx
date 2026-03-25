import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, X, Settings, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../services/api'

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    { path: '/super-admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/super-admin/tenants', label: 'Gestión de Tenants', icon: Building2 },
  ]

  function isActive(path) {
    if (path === '/super-admin') {
      return location.pathname === '/super-admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
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
        ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'} w-72
        bg-gray-800 shadow-lg flex flex-col h-screen
        transform transition-all duration-300 ease-in-out
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className={`flex-shrink-0 p-4 border-b border-gray-700 bg-gray-900 flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'justify-between'}`}>
          <Link to="/super-admin" className={`flex items-center gap-3 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
              SA
            </div>
            <div>
              <span className="font-bold text-white text-lg whitespace-nowrap">SuperAdmin</span>
              <p className="text-xs text-gray-400">Sistema Clubix</p>
            </div>
          </Link>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-2 hover:bg-gray-700 rounded md:hidden"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Menú */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition
                  ${active
                    ? 'bg-primary text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                  }
                  ${sidebarCollapsed ? 'md:justify-center md:p-3' : ''}
                `}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className={`p-4 border-t border-gray-700 bg-gray-900 ${sidebarCollapsed ? 'md:flex md:justify-center' : ''}`}>
          {!sidebarCollapsed && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Conectado como</p>
              <p className="text-sm font-medium text-white truncate">{admin?.nombre || 'Admin'}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full mt-3 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && 'Salir'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b flex items-center justify-between px-4 h-16">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 hover:bg-gray-100 rounded hidden md:block"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="text-sm text-gray-600 ml-auto">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
