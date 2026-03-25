import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Store, Users, BarChart3, LogOut, Settings, Menu, X, Receipt,
  TrendingUp, TrendingDown, Wallet, Package, ChevronDown, ChevronRight,
  UserCheck, FileText, FileCheck, Building2, Briefcase, CreditCard, ArrowLeftRight, BoxesIcon, Tag, AlertTriangle, ShoppingCart, DollarSign, BookOpen, Calculator, Trophy, MapPin, Calendar, ClipboardList, Mail, Sliders, UserPlus, Megaphone, Newspaper, ArrowUpCircle, User,
  UtensilsCrossed, Coffee, ChefHat, Printer, ShoppingBag, ExternalLink, Activity, Smartphone, Ticket, Shield, AlertCircle, UserX, Target
} from 'lucide-react'
import api from '../services/api'
import { cargarPermisos, limpiarPermisos, getPermisos, esAdmin } from '../services/permisos'
import TenantLogo from './TenantLogo'
import { useTenant } from '../contexts/TenantContext'

// Mapeo de nombres de iconos a componentes
const ICONOS = {
  LayoutDashboard, Store, Users, BarChart3, LogOut, Settings, Menu, X, Receipt,
  TrendingUp, TrendingDown, Wallet, Package, ChevronDown, ChevronRight,
  UserCheck, FileText, FileCheck, Building2, Briefcase, CreditCard, ArrowLeftRight, BoxesIcon, Tag, AlertTriangle, ShoppingCart, DollarSign, BookOpen, Calculator, Trophy, MapPin, Calendar, ClipboardList, Mail, Sliders, UserPlus, Megaphone, Newspaper, ArrowUpCircle, User,
  UtensilsCrossed, Coffee, ChefHat, Printer, ShoppingBag, ExternalLink, Activity, Smartphone, Ticket, Shield, AlertCircle, UserX, Target
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tenant } = useTenant()
  const [admin, setAdmin] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState([])
  const [pagosPendientesCount, setPagosPendientesCount] = useState(0)
  const [permisosLoaded, setPermisosLoaded] = useState(false)
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)

  // Cargar sesión y permisos
  useEffect(() => {
    async function initSession() {
      const token = localStorage.getItem('adminToken')
      const adminData = localStorage.getItem('adminData')
      if (!token) {
        navigate('/admin/login')
      } else {
        if (adminData) {
          setAdmin(JSON.parse(adminData))
        }
        // Cargar permisos si no están cargados
        if (getPermisos().length === 0) {
          await cargarPermisos()
        }
        setPermisosLoaded(true)
      }
    }
    initSession()
  }, [navigate])

  // Cargar menú desde la BD
  useEffect(() => {
    async function cargarMenu() {
      console.log('[Menu] Iniciando carga de menú...')
      const token = localStorage.getItem('adminToken')
      if (!token) {
        console.log('[Menu] No hay token')
        return
      }

      try {
        console.log('[Menu] Llamando a /admin/menu...')
        const data = await api.get('/admin/menu')
        console.log('[Menu] Respuesta:', data)
        // Transformar al formato esperado por el componente
        const items = (data || []).map(item => ({
          path: item.url,
          label: item.titulo,
          iconName: item.icono,
          submenu: item.children?.length > 0 ? item.children.map(child => ({
            path: child.url,
            label: child.titulo,
            iconName: child.icono
          })) : undefined
        }))
        console.log('[Menu] Items procesados:', items.length)
        setMenuItems(items)
      } catch (err) {
        console.error('[Menu] Error cargando menú:', err)
        setMenuItems([])
      } finally {
        setMenuLoading(false)
      }
    }

    console.log('[Menu] useEffect - permisosLoaded:', permisosLoaded)
    if (permisosLoaded) {
      cargarMenu()
    }
  }, [permisosLoaded])

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Expandir automáticamente el menú que contiene la ruta actual
  useEffect(() => {
    const currentPath = location.pathname
    menuItems.forEach(item => {
      if (item.submenu) {
        const isInSubmenu = item.submenu.some(sub => currentPath.startsWith(sub.path))
        if (isInSubmenu && !expandedMenus.includes(item.label)) {
          setExpandedMenus(prev => [...prev, item.label])
        }
      }
    })
  }, [location.pathname, menuItems])

  // Cargar contador de pagos pendientes
  useEffect(() => {
    async function cargarContador() {
      try {
        const data = await api.getFull('/admin/pagos-informados/count')
        setPagosPendientesCount(data?.count || 0)
      } catch (err) {
        setPagosPendientesCount(0)
      }
    }

    const token = localStorage.getItem('adminToken')
    if (token) {
      cargarContador()
      const interval = setInterval(cargarContador, 30000)
      return () => clearInterval(interval)
    }
  }, [admin])

  // Validar acceso a la ruta actual (basado en el menú cargado)
  useEffect(() => {
    if (!permisosLoaded || menuLoading) return

    // Super Admin tiene acceso a todo
    if (esAdmin()) return

    const path = location.pathname

    // Rutas que siempre están permitidas
    const rutasPermitidas = ['/admin/login', '/admin/mi-perfil']
    if (rutasPermitidas.some(r => path.startsWith(r))) return

    // Construir lista de URLs permitidas desde el menú
    const urlsPermitidas = new Set()
    menuItems.forEach(item => {
      if (item.path) urlsPermitidas.add(item.path)
      if (item.submenu) {
        item.submenu.forEach(sub => {
          if (sub.path) urlsPermitidas.add(sub.path)
        })
      }
    })

    // Verificar si la ruta actual está permitida
    // Considerar rutas hijas (ej: /admin/socios/123)
    const tieneAcceso = Array.from(urlsPermitidas).some(url =>
      path === url || path.startsWith(url + '/')
    )

    // Si no tiene acceso y hay items en el menú, redirigir
    if (!tieneAcceso && menuItems.length > 0) {
      console.warn(`Acceso denegado a ${path}`)
      navigate('/admin/mi-perfil', { replace: true })
    }
  }, [location.pathname, permisosLoaded, menuLoading, menuItems, navigate])

  function handleLogout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    limpiarPermisos()
    navigate('/admin/login')
  }

  function toggleSubmenu(label) {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    )
  }

  // Obtener componente de icono por nombre
  function getIcon(iconName) {
    return ICONOS[iconName] || Menu
  }

  function isActive(path) {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    const currentPath = location.pathname
    if (currentPath === path) {
      return true
    }
    if (currentPath.startsWith(path + '/')) {
      const nextSegment = currentPath.slice(path.length + 1).split('/')[0]
      if (/^\d+$/.test(nextSegment) || ['nueva', 'nuevo', 'editar', 'pagar', 'recibir'].includes(nextSegment)) {
        return true
      }
      return false
    }
    return false
  }

  function isSubmenuActive(submenu) {
    return submenu.some(item => {
      const currentPath = location.pathname
      if (currentPath === item.path) return true
      if (currentPath.startsWith(item.path + '/')) {
        const nextSegment = currentPath.slice(item.path.length + 1).split('/')[0]
        if (/^\d+$/.test(nextSegment) || ['nueva', 'nuevo', 'editar', 'pagar', 'recibir'].includes(nextSegment)) {
          return true
        }
      }
      return false
    })
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
        <div className={`flex-shrink-0 p-4 border-b border-gray-200 bg-white flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'justify-between'}`}>
          <Link to="/admin" className={`flex items-center gap-3 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <TenantLogo className="h-14" />
            <div>
              <span className="font-bold text-primary text-lg whitespace-nowrap">{tenant?.nombre || 'Admin'}</span>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </Link>
          <Link to="/admin" className={`hidden ${sidebarCollapsed ? 'md:block' : 'md:hidden'}`}>
            <TenantLogo className="h-10" />
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex p-2 text-gray-500 hover:bg-gray-100 rounded-lg ${sidebarCollapsed ? 'absolute top-4 right-2' : ''}`}
            title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 pb-20">
          {menuLoading ? (
            <div className="text-gray-400 text-center py-8">Cargando menú...</div>
          ) : menuItems.length === 0 ? (
            <div className="text-gray-400 text-center py-8">Sin acceso al menú</div>
          ) : (
            menuItems.map((item) => {
              const Icon = getIcon(item.iconName)

              // Item con submenu
              if (item.submenu) {
                const isExpanded = expandedMenus.includes(item.label)
                const hasActiveChild = isSubmenuActive(item.submenu)

                return (
                  <div key={item.label} className="mb-1 relative group">
                    <button
                      onClick={() => !sidebarCollapsed && toggleSubmenu(item.label)}
                      className={`w-full flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'justify-between'} px-4 py-3 rounded-lg transition-colors ${
                        hasActiveChild
                          ? 'bg-primary text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                      </div>
                      {!sidebarCollapsed && (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )
                      )}
                    </button>
                    {/* Submenu expandido normal */}
                    {isExpanded && !sidebarCollapsed && (
                      <div className="ml-4 mt-1 border-l-2 border-gray-600 pl-2">
                        {item.submenu.map((subItem) => {
                          const SubIcon = getIcon(subItem.iconName)
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg mb-1 text-sm transition-colors ${
                                isActive(subItem.path)
                                  ? 'bg-primary text-white'
                                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              }`}
                            >
                              <SubIcon className="w-4 h-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    {/* Tooltip/Popup submenu cuando está colapsado */}
                    {sidebarCollapsed && (
                      <div className="hidden md:group-hover:block absolute left-full top-0 ml-2 bg-gray-800 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                        <div className="px-4 py-2 text-sm font-medium text-gray-300 border-b border-gray-700">
                          {item.label}
                        </div>
                        {item.submenu.map((subItem) => {
                          const SubIcon = getIcon(subItem.iconName)
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                                isActive(subItem.path)
                                  ? 'bg-primary text-white'
                                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                              }`}
                            >
                              <SubIcon className="w-4 h-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              // Item simple
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${sidebarCollapsed ? 'md:justify-center' : ''} ${
                    isActive(item.path)
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } relative group`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                  {/* Badge de pagos pendientes en Cuotas */}
                  {item.label === 'Cuotas' && pagosPendientesCount > 0 && !sidebarCollapsed && (
                    <span className="ml-auto px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                      {pagosPendientesCount}
                    </span>
                  )}
                  {/* Tooltip cuando está colapsado */}
                  {sidebarCollapsed && (
                    <div className="hidden md:group-hover:block absolute left-full ml-2 px-3 py-2 bg-gray-800 rounded-lg shadow-lg whitespace-nowrap z-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{item.label}</span>
                        {item.label === 'Cuotas' && pagosPendientesCount > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                            {pagosPendientesCount}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              )
            })
          )}
          {admin?.esSuperAdmin && (
            <a
              href="/admin/tenants"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${sidebarCollapsed ? 'md:justify-center' : ''} text-yellow-400 hover:bg-gray-700 hover:text-yellow-300 relative group`}
              title={sidebarCollapsed ? 'Gestión de Tenants' : ''}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarCollapsed ? 'md:hidden' : ''}`}>Gestión de Tenants</span>
              {sidebarCollapsed && (
                <div className="hidden md:group-hover:block absolute left-full ml-2 px-3 py-2 bg-gray-800 rounded-lg shadow-lg whitespace-nowrap z-50">
                  <span className="text-sm text-white">Gestión de Tenants</span>
                </div>
              )}
            </a>
          )}
        </nav>

        {/* Links de pie de sidebar */}
        <div className="px-3 py-4 border-t border-gray-700 space-y-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5 flex-shrink-0" />
            <span className={`whitespace-nowrap ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              Ver sitio web
            </span>
          </a>
        </div>

        {/* Info del usuario en sidebar móvil */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between">
            <Link
              to="/admin/mi-perfil"
              className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">{admin?.nombre || 'Admin'}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="md:hidden">
              <Link to="/admin" className="flex items-center gap-2">
                <TenantLogo className="h-8" />
                <span className="font-bold text-primary whitespace-nowrap">{tenant?.nombre || 'Admin'}</span>
              </Link>
            </div>
            <div className="hidden md:block">
              <span className="text-2xl font-bold text-gray-400 italic">{tenant?.slogan || ''}</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/admin/mi-perfil"
              className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">{admin?.nombre || 'Admin'}</span>
            </Link>
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
        <main className={`flex-1 overflow-y-auto ${
          location.pathname.includes('/buffet/kds') || location.pathname.includes('/buffet/cocina')
            ? ''
            : 'p-4 md:p-6'
        }`}>
          {permisosLoaded && getPermisos().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Sin acceso</h2>
                <p className="text-gray-600 mb-4">
                  Tu usuario no tiene permisos asignados para acceder al panel de administración.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Comunicate con el club a través de los medios disponibles en la página web para solicitar acceso.
                </p>
                <div className="flex gap-3 justify-center">
                  <a
                    href="/contacto"
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Ir a Contacto
                  </a>
                  <button
                    onClick={handleLogout}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
