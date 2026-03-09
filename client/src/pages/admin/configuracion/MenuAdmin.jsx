import { useState, useEffect } from 'react'
import {
  Menu, Plus, Edit2, Trash2, Save, X, ChevronRight, ChevronDown,
  GripVertical, Eye, EyeOff, Shield, AlertTriangle, RefreshCw,
  // Iconos disponibles para el menú
  LayoutDashboard, Users, UserPlus, ClipboardList, Receipt, TrendingUp,
  TrendingDown, Wallet, Package, Calculator, Trophy, UtensilsCrossed,
  Activity, Ticket, Newspaper, BarChart3, Settings, FileText, ShoppingCart,
  CreditCard, Building2, Briefcase, DollarSign, ArrowLeftRight, BoxesIcon,
  Tag, AlertCircle, BookOpen, Calendar, MapPin, ArrowUpCircle, Coffee,
  ChefHat, Printer, ShoppingBag, Smartphone, Megaphone, Store, Sliders,
  Mail, UserCheck, FileCheck
} from 'lucide-react'
import api from '../../../services/api'
import { useConfirm } from '../../../hooks/useConfirm'

// Mapeo de nombres de iconos a componentes
const ICONOS = {
  LayoutDashboard, Users, UserPlus, ClipboardList, Receipt, TrendingUp,
  TrendingDown, Wallet, Package, Calculator, Trophy, UtensilsCrossed,
  Activity, Ticket, Newspaper, BarChart3, Settings, FileText, ShoppingCart,
  CreditCard, Building2, Briefcase, DollarSign, ArrowLeftRight, BoxesIcon,
  Tag, AlertTriangle, BookOpen, Calendar, MapPin, ArrowUpCircle, Coffee,
  ChefHat, Printer, ShoppingBag, Smartphone, Megaphone, Store, Sliders,
  Mail, UserCheck, FileCheck, Menu, Shield, Eye, EyeOff
}

// Componente de vista previa del menú
function MenuPreview({ items, selectedRolId, roles, IconComponent }) {
  const [expandedItems, setExpandedItems] = useState([])
  const selectedRol = roles.find(r => r.id === selectedRolId)
  const esSuperAdmin = selectedRol?.esSuperAdmin || false

  // Filtrar items según el rol seleccionado
  function canAccess(item) {
    if (esSuperAdmin) return true
    if (item.soloSuperAdmin) return false
    if (!item.activo) return false
    return (item.rolesIds || []).includes(selectedRolId)
  }

  // Filtrar el menú recursivamente
  function filterMenu(items) {
    return items
      .filter(item => {
        // Si el item tiene acceso directo
        if (canAccess(item)) return true
        // Si es un padre, verificar si algún hijo tiene acceso
        if (item.children?.length > 0) {
          return item.children.some(child => canAccess(child))
        }
        return false
      })
      .map(item => ({
        ...item,
        children: item.children ? item.children.filter(child => canAccess(child)) : []
      }))
      // Eliminar padres sin URL y sin hijos
      .filter(item => item.url || (item.children && item.children.length > 0))
  }

  const filteredMenu = filterMenu(items)

  function toggleExpand(itemId) {
    setExpandedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    )
  }

  if (filteredMenu.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <EyeOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Sin acceso al menú</p>
        <p className="text-xs mt-1">Este rol no tiene permisos asignados</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {filteredMenu.map(item => {
        const Icon = ICONOS[item.icono] || Menu
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expandedItems.includes(item.id)

        return (
          <div key={item.id}>
            {/* Item principal */}
            <div
              onClick={() => hasChildren && toggleExpand(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                hasChildren ? 'hover:bg-gray-700' : 'hover:bg-gray-700'
              } text-gray-300`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium">{item.titulo}</span>
              {hasChildren && (
                isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>

            {/* Subitems */}
            {hasChildren && isExpanded && (
              <div className="ml-4 border-l-2 border-gray-700 pl-2 mt-1 space-y-1">
                {item.children.map(child => {
                  const ChildIcon = ICONOS[child.icono] || Menu
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-gray-200 cursor-pointer transition-colors"
                    >
                      <ChildIcon className="w-4 h-4" />
                      <span className="text-sm">{child.titulo}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Contador */}
      <div className="mt-4 pt-3 border-t border-gray-700 text-center">
        <span className="text-xs text-gray-500">
          {filteredMenu.length} secciones visibles
        </span>
      </div>
    </div>
  )
}

export default function MenuAdmin() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [menuItems, setMenuItems] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Tabs
  const [activeTab, setActiveTab] = useState('estructura') // 'estructura' | 'permisos'

  // Edición de item
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    titulo: '',
    icono: 'Menu',
    url: '',
    descripcion: '',
    orden: 0,
    activo: true,
    soloSuperAdmin: false,
    parentId: null
  })

  // Rol seleccionado para asignar permisos
  const [selectedRolId, setSelectedRolId] = useState(null)

  // Items expandidos en el árbol
  const [expandedItems, setExpandedItems] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    setError(null)
    try {
      const [menuRes, rolesRes] = await Promise.all([
        api.get('/admin/menu/admin'),
        api.get('/admin/menu/roles')
      ])
      setMenuItems(menuRes || [])
      setRoles(rolesRes || [])
      // Expandir todos los items por defecto
      setExpandedItems((menuRes || []).map(item => item.id))
    } catch (err) {
      setError('Error al cargar datos: ' + (err.message || 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!formData.titulo || !formData.icono) {
      setError('Título e ícono son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editingItem) {
        await api.put(`/admin/menu/${editingItem.id}`, formData)
      } else {
        await api.post('/admin/menu', formData)
      }
      await cargarDatos()
      resetForm()
    } catch (err) {
      setError('Error al guardar: ' + (err.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`¿Eliminar "${item.titulo}"${item.children?.length > 0 ? ` y sus ${item.children.length} subitems` : ''}?`)) {
      return
    }

    try {
      await api.delete(`/admin/menu/${item.id}`)
      await cargarDatos()
      if (editingItem?.id === item.id) {
        resetForm()
      }
    } catch (err) {
      setError('Error al eliminar: ' + (err.message || 'Error desconocido'))
    }
  }

  async function handleToggleRol(itemId, rolId, currentlyHasRole) {
    // Calcular nuevos roles
    const item = findItemById(menuItems, itemId)
    if (!item) return

    let newRolesIds = [...(item.rolesIds || [])]
    if (currentlyHasRole) {
      newRolesIds = newRolesIds.filter(r => r !== rolId)
    } else {
      newRolesIds.push(rolId)
    }

    // Actualizar estado local inmediatamente (optimistic update)
    setMenuItems(prev => updateItemRoles(prev, itemId, newRolesIds))

    // Guardar en el servidor en segundo plano
    try {
      await api.patch(`/admin/menu/${itemId}/roles`, { rolesIds: newRolesIds })
    } catch (err) {
      // Si falla, revertir el cambio
      setMenuItems(prev => updateItemRoles(prev, itemId, item.rolesIds || []))
      setError('Error al actualizar permisos: ' + (err.message || 'Error desconocido'))
    }
  }

  // Función auxiliar para actualizar roles de un item en el árbol
  function updateItemRoles(items, itemId, newRolesIds) {
    return items.map(item => {
      if (item.id === itemId) {
        return { ...item, rolesIds: newRolesIds }
      }
      if (item.children) {
        return { ...item, children: updateItemRoles(item.children, itemId, newRolesIds) }
      }
      return item
    })
  }

  async function handleSeedMenu() {
    if (!confirm('¿Crear el menú inicial? Solo funciona si la tabla está vacía.')) {
      return
    }

    try {
      await api.post('/admin/menu/seed')
      await cargarDatos()
    } catch (err) {
      setError('Error al crear menú: ' + (err.message || 'Error desconocido'))
    }
  }

  function findItemById(items, id) {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children) {
        const found = findItemById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  function resetForm() {
    setEditingItem(null)
    setFormData({
      titulo: '',
      icono: 'Menu',
      url: '',
      descripcion: '',
      orden: 0,
      activo: true,
      soloSuperAdmin: false,
      parentId: null
    })
  }

  function editItem(item) {
    setEditingItem(item)
    setFormData({
      titulo: item.titulo,
      icono: item.icono,
      url: item.url || '',
      descripcion: item.descripcion || '',
      orden: item.orden,
      activo: item.activo,
      soloSuperAdmin: item.soloSuperAdmin,
      parentId: item.parentId
    })
  }

  function addChild(parentId) {
    resetForm()
    setFormData(prev => ({ ...prev, parentId }))
  }

  function toggleExpand(itemId) {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const IconComponent = ({ name, className }) => {
    const Icon = ICONOS[name] || Menu
    return <Icon className={className} />
  }

  // Renderizar árbol de items
  function renderMenuItem(item, level = 0) {
    const isExpanded = expandedItems.includes(item.id)
    const hasChildren = item.children && item.children.length > 0
    const isEditing = editingItem?.id === item.id

    return (
      <div key={item.id} className="select-none">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group ${
            isEditing ? 'bg-primary/10 ring-1 ring-primary' : ''
          } ${!item.activo ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => hasChildren && toggleExpand(item.id)}
            className={`w-5 h-5 flex items-center justify-center ${hasChildren ? 'text-gray-400 hover:text-gray-600' : ''}`}
          >
            {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
          </button>

          {/* Icono */}
          <IconComponent name={item.icono} className="w-4 h-4 text-gray-500" />

          {/* Título */}
          <span className="flex-1 text-sm font-medium truncate">
            {item.titulo}
            {item.url && <span className="text-xs text-gray-400 ml-2">{item.url}</span>}
          </span>

          {/* Indicadores */}
          {item.soloSuperAdmin && (
            <Shield className="w-4 h-4 text-yellow-500" title="Solo Super Admin" />
          )}
          {!item.activo && (
            <EyeOff className="w-4 h-4 text-red-400" title="Inactivo" />
          )}

          {/* Acciones */}
          <div className="hidden group-hover:flex items-center gap-1">
            {level === 0 && (
              <button
                onClick={() => addChild(item.id)}
                className="p-1 text-gray-400 hover:text-primary"
                title="Agregar subitem"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => editItem(item)}
              className="p-1 text-gray-400 hover:text-primary"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="p-1 text-gray-400 hover:text-red-500"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {item.children.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Renderizar item con switch de permiso para el rol seleccionado
  function renderMenuItemWithPermissions(item, level = 0) {
    const isExpanded = expandedItems.includes(item.id)
    const hasChildren = item.children && item.children.length > 0
    const hasRole = selectedRolId && (item.rolesIds || []).includes(selectedRolId)

    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-3 p-3 border-b ${!item.activo ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => hasChildren && toggleExpand(item.id)}
            className={`w-5 h-5 flex items-center justify-center ${hasChildren ? 'text-gray-400 hover:text-gray-600' : ''}`}
          >
            {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
          </button>

          {/* Icono y título */}
          <IconComponent name={item.icono} className="w-5 h-5 text-gray-500" />
          <span className="flex-1 font-medium">{item.titulo}</span>

          {/* Switch de permiso */}
          {selectedRolId && !item.soloSuperAdmin && (
            <button
              onClick={() => handleToggleRol(item.id, selectedRolId, hasRole)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hasRole ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hasRole ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
          {item.soloSuperAdmin && (
            <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
              Solo Super Admin
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {item.children.map(child => renderMenuItemWithPermissions(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Administración de Menú</h1>
          <p className="text-gray-500">Configura la estructura del menú y asigna permisos por rol</p>
        </div>
        <div className="flex gap-2">
          {menuItems.length === 0 && (
            <button
              onClick={handleSeedMenu}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              <RefreshCw className="w-4 h-4" />
              Crear Menú Inicial
            </button>
          )}
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('estructura')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'estructura'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Estructura del Menú
          </button>
          <button
            onClick={() => setActiveTab('permisos')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'permisos'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Permisos por Rol
          </button>
        </nav>
      </div>

      {/* Tab: Estructura */}
      {activeTab === 'estructura' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de items */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Items del Menú</h2>
              <button
                onClick={resetForm}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                Nuevo Item Principal
              </button>
            </div>
            <div className="p-2 max-h-[600px] overflow-y-auto">
              {menuItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Menu className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay items de menú</p>
                  <p className="text-sm">Usa "Crear Menú Inicial" para comenzar</p>
                </div>
              ) : (
                menuItems.map(item => renderMenuItem(item))
              )}
            </div>
          </div>

          {/* Formulario de edición */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700">
                {editingItem ? `Editar: ${editingItem.titulo}` : 'Nuevo Item'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Ej: Dashboard"
                />
              </div>

              {/* Icono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icono *</label>
                <select
                  value={formData.icono}
                  onChange={e => setFormData({ ...formData, icono: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {Object.keys(ICONOS).sort().map(iconName => (
                    <option key={iconName} value={iconName}>{iconName}</option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <IconComponent name={formData.icono} className="w-5 h-5" />
                  <span>Vista previa</span>
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="/admin/ruta"
                />
                <p className="mt-1 text-xs text-gray-500">Dejar vacío si es un menú padre sin ruta propia</p>
              </div>

              {/* Parent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menú Padre</label>
                <select
                  value={formData.parentId || ''}
                  onChange={e => setFormData({ ...formData, parentId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  disabled={editingItem && editingItem.children?.length > 0}
                >
                  <option value="">-- Ninguno (Item Principal) --</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id} disabled={editingItem?.id === item.id}>
                      {item.titulo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Orden */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                <input
                  type="number"
                  value={formData.orden}
                  onChange={e => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Switches */}
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.soloSuperAdmin}
                    onChange={e => setFormData({ ...formData, soloSuperAdmin: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Solo visible para Super Admin</span>
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                {editingItem && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Permisos */}
      {activeTab === 'permisos' && (
        <div className="space-y-4">
          {/* Selector de rol */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Rol</label>
            <select
              value={selectedRolId || ''}
              onChange={e => setSelectedRolId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full md:w-80 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">-- Seleccionar un rol --</option>
              {roles.map(rol => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre} {rol.esSuperAdmin && '(Super Admin)'}
                </option>
              ))}
            </select>
            {selectedRolId && (
              <p className="mt-2 text-sm text-gray-500">
                Activa o desactiva el acceso a cada sección del menú para este rol
              </p>
            )}
          </div>

          {/* Grid: Permisos + Vista Previa */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de items con switches */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-700">Asignación de Permisos</h3>
              </div>
              <div className="max-h-[550px] overflow-y-auto">
                {!selectedRolId ? (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Selecciona un rol para asignar permisos</p>
                  </div>
                ) : (
                  menuItems.map(item => renderMenuItemWithPermissions(item))
                )}
              </div>
            </div>

            {/* Vista previa del menú */}
            <div className="bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-700">
                <h3 className="font-medium text-gray-300 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Vista Previa del Menú
                </h3>
                {selectedRolId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Así verá el menú un usuario con rol "{roles.find(r => r.id === selectedRolId)?.nombre}"
                  </p>
                )}
              </div>
              <div className="p-2 max-h-[550px] overflow-y-auto">
                {!selectedRolId ? (
                  <div className="text-center py-12 text-gray-500">
                    <Menu className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selecciona un rol</p>
                  </div>
                ) : (
                  <MenuPreview
                    items={menuItems}
                    selectedRolId={selectedRolId}
                    roles={roles}
                    IconComponent={IconComponent}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
