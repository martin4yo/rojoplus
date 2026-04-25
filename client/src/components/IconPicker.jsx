import { useState, useMemo } from 'react'
import * as Icons from 'lucide-react'
import { Search, X } from 'lucide-react'

/**
 * Picker de íconos Lucide React.
 * Curo una lista de los más útiles para administración (~120 íconos).
 * El usuario puede buscar por nombre o tipear uno custom (cualquier ícono lucide).
 */
const ICONOS_CURADOS = [
  // Navegación / Generales
  'Home', 'Star', 'Heart', 'Bookmark', 'Pin', 'Flag', 'Tag', 'Link', 'ExternalLink', 'Globe',
  // Usuarios / Personas
  'User', 'Users', 'UserCheck', 'UserPlus', 'UserCog', 'UserCircle', 'Contact',
  // Dinero / Finanzas
  'DollarSign', 'CreditCard', 'Wallet', 'Banknote', 'Coins', 'Receipt', 'PiggyBank', 'Calculator',
  'TrendingUp', 'TrendingDown', 'BarChart', 'BarChart2', 'BarChart3', 'PieChart', 'LineChart',
  // Documentos
  'FileText', 'File', 'FilePlus', 'FileCheck', 'FileDown', 'FileUp', 'Folder', 'FolderOpen', 'FolderPlus',
  'Files', 'Archive', 'Clipboard', 'ClipboardCheck', 'ClipboardList',
  // Compras / Ventas
  'ShoppingCart', 'ShoppingBag', 'Store', 'Package', 'Box', 'Truck', 'PackageCheck',
  // Calendario / Tiempo
  'Calendar', 'CalendarDays', 'CalendarPlus', 'Clock', 'Timer', 'AlarmClock', 'Hourglass',
  // Configuración
  'Settings', 'Settings2', 'Cog', 'Sliders', 'Wrench', 'Tool', 'Filter',
  // Comunicación
  'Mail', 'Send', 'MessageCircle', 'MessageSquare', 'Bell', 'BellRing', 'Phone', 'PhoneCall',
  // Estadísticas / Reportes
  'Activity', 'Eye', 'Search', 'Award', 'Trophy', 'Medal',
  // Edición
  'Edit', 'Edit2', 'Edit3', 'Pencil', 'Save', 'Trash', 'Trash2', 'Copy', 'Plus', 'Minus',
  // Estado
  'Check', 'CheckCircle', 'XCircle', 'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
  // Deportes / Eventos
  'Trophy', 'Calendar', 'Ticket', 'Music', 'Volleyball', 'Dribbble',
  // Casa / Edificios
  'Building', 'Building2', 'Hotel', 'Warehouse',
  // Misc
  'Key', 'Lock', 'Unlock', 'Shield', 'ShieldCheck', 'Database', 'Server', 'Cloud',
  'Zap', 'Lightbulb', 'Coffee', 'Pizza', 'Camera', 'Image', 'Video', 'Mic',
  'BookOpen', 'Book', 'GraduationCap', 'Briefcase', 'MapPin', 'Map',
]

// Lista única (algunos están duplicados arriba intencionalmente por categoría)
const ICONOS_UNICOS = [...new Set(ICONOS_CURADOS)]

export default function IconPicker({ value, onChange }) {
  const [busqueda, setBusqueda] = useState('')
  const [open, setOpen] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ICONOS_UNICOS
    return ICONOS_UNICOS.filter(name => name.toLowerCase().includes(q))
  }, [busqueda])

  // Renderizar el ícono actual seleccionado
  const IconActual = value && Icons[value] ? Icons[value] : Icons.Star

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 w-full"
      >
        <IconActual className="w-5 h-5 text-primary" />
        <span className="text-sm text-gray-700 flex-1 text-left">{value || 'Star'}</span>
        <span className="text-xs text-gray-400">{open ? 'Cerrar' : 'Cambiar'}</span>
      </button>

      {open && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ícono (ej: User, DollarSign...)"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">
              <p>No hay íconos en la lista curada con ese nombre.</p>
              <p className="mt-1 text-xs">
                Probá tipear el nombre exacto del ícono Lucide (ej: <code>BadgeDollarSign</code>)
              </p>
              {busqueda && Icons[busqueda] && (
                <button
                  type="button"
                  onClick={() => { onChange(busqueda); setOpen(false); setBusqueda('') }}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs rounded-lg"
                >
                  Usar "{busqueda}"
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1 max-h-56 overflow-auto">
              {filtrados.map(name => {
                const Icon = Icons[name]
                if (!Icon) return null
                const selected = name === value
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { onChange(name); setOpen(false); setBusqueda('') }}
                    className={`p-2 rounded-lg flex items-center justify-center transition ${
                      selected
                        ? 'bg-primary text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-primary/10 hover:border-primary'
                    }`}
                    title={name}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper: obtener un ícono Lucide por nombre, fallback a Star
export function LucideIcon({ name, ...props }) {
  const Icon = (name && Icons[name]) || Icons.Star
  return <Icon {...props} />
}
