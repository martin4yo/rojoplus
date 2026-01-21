import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Store, Users, BarChart3, LogOut, Settings, Menu, X, Receipt,
  TrendingUp, TrendingDown, Wallet, Package, ChevronDown, ChevronRight,
  UserCheck, FileText, FileCheck, Building2, Briefcase, CreditCard, ArrowLeftRight, BoxesIcon, Tag, AlertTriangle, ShoppingCart, DollarSign, BookOpen, Calculator, Trophy, MapPin, Calendar, ClipboardList
} from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState([])

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
  }, [location.pathname])

  function handleLogout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    navigate('/admin/login')
  }

  function toggleSubmenu(label) {
    setExpandedMenus(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    )
  }

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/socios', label: 'Socios', icon: Users },
    { path: '/admin/periodos', label: 'Cuotas', icon: Receipt },
    {
      label: 'Ingresos', icon: TrendingUp,
      submenu: [
        { path: '/admin/ingresos/clientes', label: 'Clientes', icon: UserCheck },
        { path: '/admin/ingresos/pedidos', label: 'Pedidos', icon: ShoppingCart },
        { path: '/admin/ingresos/facturas', label: 'Facturas Emitidas', icon: FileText },
        { path: '/admin/ingresos/recibos', label: 'Recibos de Cobro', icon: FileCheck },
      ]
    },
    {
      label: 'Egresos', icon: TrendingDown,
      submenu: [
        { path: '/admin/egresos/proveedores', label: 'Proveedores', icon: Building2 },
        { path: '/admin/egresos/personal', label: 'Personal', icon: Briefcase },
        { path: '/admin/egresos/ordenes-compra', label: 'Ordenes de Compra', icon: ShoppingCart },
        { path: '/admin/egresos/facturas', label: 'Facturas Recibidas', icon: FileText },
        { path: '/admin/egresos/ordenes-pago', label: 'Ordenes de Pago', icon: CreditCard },
      ]
    },
    {
      label: 'Sueldos', icon: DollarSign,
      submenu: [
        { path: '/admin/liquidaciones', label: 'Liquidaciones', icon: FileText },
        { path: '/admin/liquidaciones/conceptos', label: 'Conceptos', icon: Settings },
      ]
    },
    {
      label: 'Tesoreria', icon: Wallet,
      submenu: [
        { path: '/admin/tesoreria/cajas', label: 'Cajas', icon: Wallet },
        { path: '/admin/tesoreria/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
        { path: '/admin/tesoreria/transferencias', label: 'Transferencias', icon: ArrowLeftRight },
      ]
    },
    {
      label: 'Stock', icon: Package,
      submenu: [
        { path: '/admin/stock/productos', label: 'Productos', icon: BoxesIcon },
        { path: '/admin/stock/categorias', label: 'Categorias', icon: Tag },
        { path: '/admin/stock/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
        { path: '/admin/stock/alertas', label: 'Alertas Stock', icon: AlertTriangle },
      ]
    },
    {
      label: 'Contabilidad', icon: Calculator,
      submenu: [
        { path: '/admin/contabilidad/plan-cuentas', label: 'Plan de Cuentas', icon: BookOpen },
        { path: '/admin/contabilidad/asientos', label: 'Libro Diario', icon: FileText },
        { path: '/admin/contabilidad/libro-mayor', label: 'Libro Mayor', icon: BookOpen },
        { path: '/admin/contabilidad/presupuestos', label: 'Presupuestos', icon: BarChart3 },
      ]
    },
    {
      label: 'Deportes', icon: Trophy,
      submenu: [
        { path: '/admin/deportes/entrenamientos', label: 'Entrenamientos', icon: Calendar },
        { path: '/admin/deportes/horarios', label: 'Horarios', icon: ClipboardList },
        { path: '/admin/deportes/espacios', label: 'Espacios', icon: MapPin },
        { path: '/admin/deportes/tipos-espacio', label: 'Tipos de Espacio', icon: Settings },
      ]
    },
    { path: '/admin/comercios', label: 'Comercios', icon: Store },
    { path: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
    { path: '/admin/configuracion', label: 'Configuracion', icon: Settings },
  ]

  function isActive(path) {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    const currentPath = location.pathname
    // Coincidencia exacta
    if (currentPath === path) {
      return true
    }
    // Para rutas hijas (ej: /admin/liquidaciones/123 o /admin/liquidaciones/nueva)
    // pero NO para rutas hermanas (ej: /admin/liquidaciones/conceptos cuando path es /admin/liquidaciones)
    if (currentPath.startsWith(path + '/')) {
      const nextSegment = currentPath.slice(path.length + 1).split('/')[0]
      // Si el siguiente segmento es un numero (ID) o una accion conocida, es ruta hija
      if (/^\d+$/.test(nextSegment) || ['nueva', 'nuevo', 'editar', 'pagar', 'recibir'].includes(nextSegment)) {
        return true
      }
      // Si no, podria ser una ruta hermana del menu (como /conceptos)
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
            <img src="/images/logo.png" alt="Logo" className="h-14" />
            <div>
              <span className="font-bold text-primary text-lg whitespace-nowrap">Sportivo Pilar</span>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </Link>
          {/* Logo pequeño cuando está colapsado */}
          <Link to="/admin" className={`hidden ${sidebarCollapsed ? 'md:block' : 'md:hidden'}`}>
            <img src="/images/logo.png" alt="Logo" className="h-10" />
          </Link>
          {/* Botón hamburguesa para colapsar (desktop) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex p-2 text-gray-500 hover:bg-gray-100 rounded-lg ${sidebarCollapsed ? 'absolute top-4 right-2' : ''}`}
            title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Menu className="w-5 h-5" />
          </button>
          {/* Botón cerrar en móvil */}
          <button
            onClick={() => setMenuOpen(false)}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 pb-20">
          {menuItems.map((item) => {
            const Icon = item.icon

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
                        const SubIcon = subItem.icon
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
                        const SubIcon = subItem.icon
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
                {/* Tooltip cuando está colapsado */}
                {sidebarCollapsed && (
                  <div className="hidden md:group-hover:block absolute left-full ml-2 px-3 py-2 bg-gray-800 rounded-lg shadow-lg whitespace-nowrap z-50">
                    <span className="text-sm text-white">{item.label}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
        {/* Info del usuario en sidebar móvil */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">{admin?.nombre || 'Admin'}</span>
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
              <span className="text-2xl font-bold text-gray-400 italic">El equipo de la ciudad</span>
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
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
