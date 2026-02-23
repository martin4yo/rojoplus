import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Store, Users, BarChart3, LogOut, Settings, Menu, X, Receipt,
  TrendingUp, TrendingDown, Wallet, Package, ChevronDown, ChevronRight,
  UserCheck, FileText, FileCheck, Building2, Briefcase, CreditCard, ArrowLeftRight, BoxesIcon, Tag, AlertTriangle, ShoppingCart, DollarSign, BookOpen, Calculator, Trophy, MapPin, Calendar, ClipboardList, Mail, Sliders, UserPlus, Megaphone, Newspaper, ArrowUpCircle, User,
  UtensilsCrossed, Coffee, ChefHat, Printer, ShoppingBag, ExternalLink, Activity, Smartphone, Ticket
} from 'lucide-react'
import api from '../services/api'
import { cargarPermisos, limpiarPermisos, tieneAlgunPermiso, getPermisos, PERMISOS } from '../services/permisos'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [admin, setAdmin] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState([])
  const [pagosPendientesCount, setPagosPendientesCount] = useState(0)
  const [permisosLoaded, setPermisosLoaded] = useState(false)

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

  // Cargar contador de pagos pendientes
  useEffect(() => {
    async function cargarContador() {
      try {
        const data = await api.getFull('/admin/pagos-informados/count')
        setPagosPendientesCount(data?.count || 0)
      } catch (err) {
        // Silenciar error si el endpoint no existe aún
        setPagosPendientesCount(0)
      }
    }

    // Solo cargar si hay admin autenticado
    const token = localStorage.getItem('adminToken')
    if (token) {
      cargarContador()
      // Recargar cada 30 segundos
      const interval = setInterval(cargarContador, 30000)
      return () => clearInterval(interval)
    }
  }, [admin])

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

  // Definición de items del menú con permisos requeridos
  // permisos: array de permisos - el usuario debe tener AL MENOS UNO para ver el item
  // Si no tiene permisos definidos, es visible para todos los usuarios autenticados
  const menuItemsBase = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/dashboard-ejecutivo', label: 'Dashboard Ejecutivo', icon: BarChart3, permisos: [PERMISOS.REPORTES_VER] },
    {
      label: 'Socios', icon: Users, permisos: [PERMISOS.SOCIOS_VER],
      submenu: [
        { path: '/admin/socios', label: 'Listado Socios', icon: Users },
        { path: '/admin/solicitudes', label: 'Solicitudes Alta', icon: UserPlus, permisos: [PERMISOS.SOCIOS_CREAR] },
        { path: '/admin/inscripciones', label: 'Inscripciones', icon: ClipboardList, permisos: [PERMISOS.INSCRIPCIONES_VER] },
        { path: '/admin/periodos', label: 'Cuotas y Periodos', icon: Receipt, permisos: [PERMISOS.CUOTAS_VER] },
      ]
    },
    {
      label: 'Ingresos', icon: TrendingUp, permisos: [PERMISOS.INGRESOS_VER],
      submenu: [
        { path: '/admin/ingresos/clientes', label: 'Clientes', icon: UserCheck },
        { path: '/admin/ingresos/pedidos', label: 'Pedidos', icon: ShoppingCart },
        { path: '/admin/ingresos/facturas', label: 'Facturas Emitidas', icon: FileText },
        { path: '/admin/ingresos/recibos', label: 'Recibos de Cobro', icon: FileCheck },
      ]
    },
    {
      label: 'Egresos', icon: TrendingDown, permisos: [PERMISOS.EGRESOS_VER],
      submenu: [
        { path: '/admin/egresos/proveedores', label: 'Proveedores', icon: Building2 },
        { path: '/admin/egresos/ordenes-compra', label: 'Ordenes de Compra', icon: ShoppingCart },
        { path: '/admin/egresos/facturas', label: 'Facturas Recibidas', icon: FileText },
        { path: '/admin/egresos/ordenes-pago', label: 'Ordenes de Pago', icon: CreditCard },
      ]
    },
    {
      label: 'Sueldos', icon: DollarSign, permisos: [PERMISOS.SUELDOS_VER],
      submenu: [
        { path: '/admin/egresos/personal', label: 'Personal', icon: Briefcase },
        { path: '/admin/liquidaciones', label: 'Liquidaciones', icon: FileText },
        { path: '/admin/liquidaciones/conceptos', label: 'Conceptos', icon: Settings },
      ]
    },
    {
      label: 'Tesoreria', icon: Wallet, permisos: [PERMISOS.CAJA_VER],
      submenu: [
        { path: '/admin/tesoreria/cajas', label: 'Cajas', icon: Wallet },
        { path: '/admin/cierres-caja', label: 'Cierre de Caja', icon: ClipboardList, permisos: [PERMISOS.CAJA_CIERRE] },
        { path: '/admin/debito-automatico', label: 'Debito Automatico', icon: CreditCard, permisos: [PERMISOS.DEBITO_AUTOMATICO] },
        { path: '/admin/tesoreria/movimientos', label: 'Movimientos', icon: ArrowLeftRight, permisos: [PERMISOS.CAJA_MOVIMIENTOS] },
        { path: '/admin/tesoreria/transferencias', label: 'Transferencias', icon: ArrowLeftRight, permisos: [PERMISOS.CAJA_MOVIMIENTOS] },
        { path: '/admin/tesoreria/pendientes-conciliar', label: 'Valores Pendientes', icon: CreditCard, permisos: [PERMISOS.CAJA_MOVIMIENTOS] },
        { path: '/admin/tesoreria/conciliacion', label: 'Conciliacion Bancaria', icon: FileCheck, permisos: [PERMISOS.CAJA_MOVIMIENTOS] },
      ]
    },
    {
      label: 'Stock', icon: Package, permisos: [PERMISOS.STOCK_VER],
      submenu: [
        { path: '/admin/stock/productos', label: 'Productos', icon: BoxesIcon },
        { path: '/admin/stock/categorias', label: 'Categorias', icon: Tag },
        { path: '/admin/stock/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
        { path: '/admin/stock/alertas', label: 'Alertas Stock', icon: AlertTriangle },
      ]
    },
    {
      label: 'Contabilidad', icon: Calculator, permisos: [PERMISOS.CONTABILIDAD_VER],
      submenu: [
        { path: '/admin/contabilidad/plan-cuentas', label: 'Plan de Cuentas', icon: BookOpen },
        { path: '/admin/contabilidad/asientos', label: 'Libro Diario', icon: FileText, permisos: [PERMISOS.CONTABILIDAD_ASIENTOS] },
        { path: '/admin/contabilidad/libro-mayor', label: 'Libro Mayor', icon: BookOpen },
        { path: '/admin/contabilidad/presupuestos', label: 'Presupuestos', icon: BarChart3, permisos: [PERMISOS.CONTABILIDAD_PRESUPUESTO] },
      ]
    },
    {
      label: 'Deportes', icon: Trophy, permisos: [PERMISOS.DEPORTES_VER],
      submenu: [
        { path: '/admin/partidos', label: 'Partidos', icon: Trophy, permisos: [PERMISOS.DEPORTES_PARTIDOS] },
        { path: '/admin/deportes/entrenamientos', label: 'Entrenamientos', icon: Calendar, permisos: [PERMISOS.DEPORTES_ENTRENAMIENTOS] },
        { path: '/admin/deportes/horarios', label: 'Horarios', icon: ClipboardList },
        { path: '/admin/deportes/espacios', label: 'Espacios', icon: MapPin },
        { path: '/admin/deportes/tipos-espacio', label: 'Tipos de Espacio', icon: Settings },
        { path: '/admin/reportes/deportivos', label: 'Reportes Deportivos', icon: BarChart3, permisos: [PERMISOS.REPORTES_VER] },
        { path: '/admin/deportes/pasaje-categoria', label: 'Pasaje Categoría', icon: ArrowUpCircle, permisos: [PERMISOS.DEPORTES_PASAJE] },
      ]
    },
    {
      label: 'Buffet', icon: UtensilsCrossed, permisos: [PERMISOS.BUFFET_VER],
      submenu: [
        { path: '/admin/buffet', label: 'Dashboard', icon: LayoutDashboard, permisos: [PERMISOS.BUFFET_VER] },
        { path: '/admin/buffet/mesas', label: 'Mesas', icon: UtensilsCrossed, permisos: [PERMISOS.BUFFET_MESAS] },
        { path: '/admin/buffet/takeaway', label: 'Pedidos', icon: ShoppingBag, permisos: [PERMISOS.BUFFET_MESAS] },
        { path: '/admin/buffet/kiosco', label: 'Kiosco', icon: Coffee, permisos: [PERMISOS.BUFFET_KIOSCO] },
        { path: '/admin/buffet/cocina', label: 'Cocina (KDS)', icon: ChefHat, permisos: [PERMISOS.BUFFET_COCINA] },
        { path: '/admin/buffet/productos', label: 'Productos', icon: Package, permisos: [PERMISOS.BUFFET_CONFIG] },
        { path: '/admin/buffet/categorias', label: 'Categorías', icon: Tag, permisos: [PERMISOS.BUFFET_CONFIG] },
        { path: '/admin/buffet/impresoras', label: 'Impresoras', icon: Printer, permisos: [PERMISOS.BUFFET_CONFIG] },
      ]
    },
    {
      label: 'Control de Accesos', icon: Activity, permisos: [PERMISOS.ACCESOS_VER],
      submenu: [
        { path: '/admin/accesos/monitor', label: 'Monitor en Vivo', icon: Activity, permisos: [PERMISOS.ACCESOS_VER] },
        { path: '/admin/accesos/intentos-denegados', label: 'DNIs Denegados', icon: AlertTriangle, permisos: [PERMISOS.ACCESOS_GESTIONAR] },
        { path: '/admin/accesos/habilitaciones', label: 'Habilitaciones', icon: UserPlus, permisos: [PERMISOS.ACCESOS_GESTIONAR] },
        { path: '/admin/accesos/control-pwa', label: 'Control Móvil', icon: Smartphone, permisos: [PERMISOS.ACCESOS_GESTIONAR] },
      ]
    },
    {
      label: 'Eventos', icon: Ticket, permisos: [PERMISOS.EVENTOS_VER],
      submenu: [
        { path: '/admin/eventos', label: 'Gestión de Eventos', icon: Ticket, permisos: [PERMISOS.EVENTOS_VER] },
        { path: '/admin/eventos/vender', label: 'Vender Entradas', icon: ShoppingCart, permisos: [PERMISOS.EVENTOS_VENDER] },
      ]
    },
    {
      label: 'Contenido', icon: Newspaper, permisos: [PERMISOS.CONTENIDO_VER],
      submenu: [
        { path: '/admin/noticias', label: 'Noticias', icon: Newspaper },
        { path: '/admin/publicidad', label: 'Banners', icon: Megaphone },
        { path: '/admin/comercios', label: 'Comercios', icon: Store, permisos: [PERMISOS.COMERCIOS_GESTIONAR] },
      ]
    },
    { path: '/admin/reportes', label: 'Reportes', icon: BarChart3, permisos: [PERMISOS.REPORTES_VER] },
    {
      label: 'Configuracion', icon: Settings, permisos: [PERMISOS.CONFIG_VER],
      submenu: [
        { path: '/admin/configuracion', label: 'General', icon: Sliders },
        { path: '/admin/configuracion/pagos', label: 'Datos Bancarios', icon: CreditCard },
        { path: '/admin/configuracion/autoridades', label: 'Autoridades', icon: Users, permisos: [PERMISOS.CONTENIDO_GESTIONAR] },
        { path: '/admin/configuracion/usuarios', label: 'Usuarios', icon: Users, permisos: [PERMISOS.USUARIOS_GESTIONAR] },
        { path: '/admin/configuracion/templates/email', label: 'Templates Email', icon: Mail },
        { path: '/admin/configuracion/templates/pdf', label: 'Templates PDF', icon: FileText },
      ]
    },
  ]

  // Función para verificar si el usuario tiene permiso para ver un item
  function tieneAcceso(item) {
    // Si no tiene permisos definidos, es visible para todos
    if (!item.permisos || item.permisos.length === 0) {
      return true
    }
    // Verificar si tiene alguno de los permisos requeridos
    return tieneAlgunPermiso(...item.permisos)
  }

  // Filtrar items del menú según permisos
  const menuItems = menuItemsBase
    .filter(item => tieneAcceso(item))
    .map(item => {
      // Si tiene submenu, filtrar también los subitems
      if (item.submenu) {
        const submenuFiltrado = item.submenu.filter(subItem => tieneAcceso(subItem))
        // Si no quedan subitems, no mostrar el menú padre
        if (submenuFiltrado.length === 0) return null
        return { ...item, submenu: submenuFiltrado }
      }
      return item
    })
    .filter(Boolean) // Eliminar nulls

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
          })}
        </nav>

        {/* Link al sitio público */}
        <div className="px-3 py-4 border-t border-gray-700">
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
