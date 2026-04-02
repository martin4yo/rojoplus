/**
 * Servicio de permisos para el frontend
 *
 * Uso:
 * import { tienePermiso, cargarPermisos } from './services/permisos'
 *
 * // Cargar permisos al inicio de la sesión
 * await cargarPermisos()
 *
 * // Verificar permisos
 * if (tienePermiso('SOCIOS_EDITAR')) {
 *   // mostrar botón de editar
 * }
 */

// Cache local de permisos del usuario actual
let permisosUsuario = []
let cajasPermitidas = []
let esSuperAdmin = false
let usuarioActual = null
let rolActual = null
let _subscribers = []

export function onPermisosLoaded(fn) {
  _subscribers.push(fn)
  return () => { _subscribers = _subscribers.filter(s => s !== fn) }
}

/**
 * Cargar permisos del usuario actual desde el servidor
 * Debe llamarse después del login
 */
export async function cargarPermisos() {
  try {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      limpiarPermisos()
      return false
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

    const res = await fetch(`${API_URL}/admin/mis-permisos`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!res.ok) {
      console.error('Error cargando permisos:', res.status, res.statusText)
      limpiarPermisos()
      return false
    }

    const data = await res.json()
    console.log('[Permisos] Datos recibidos:', data)

    if (data.success && data.data) {
      permisosUsuario = data.data.permisos || []
      cajasPermitidas = data.data.cajasPermitidas || []
      esSuperAdmin = data.data.esSuperAdmin || false
      usuarioActual = data.data.usuario
      rolActual = data.data.rol
      console.log('[Permisos] Cargados:', { permisos: permisosUsuario.length, esSuperAdmin })
      _subscribers.forEach(fn => fn())
      return true
    }

    return false
  } catch (err) {
    console.error('Error cargando permisos:', err)
    limpiarPermisos()
    return false
  }
}

/**
 * Limpiar permisos (al cerrar sesión)
 */
export function limpiarPermisos() {
  permisosUsuario = []
  cajasPermitidas = []
  esSuperAdmin = false
  usuarioActual = null
  rolActual = null
}

/**
 * Verificar si el usuario tiene un permiso específico
 * @param {string} permiso - Código del permiso a verificar
 * @returns {boolean}
 */
export function tienePermiso(permiso) {
  // Super admin tiene todos los permisos
  if (esSuperAdmin || permisosUsuario.includes('*')) {
    return true
  }

  return permisosUsuario.includes(permiso)
}

/**
 * Verificar si el usuario tiene al menos uno de los permisos
 * @param {...string} permisos - Códigos de permisos a verificar
 * @returns {boolean}
 */
export function tieneAlgunPermiso(...permisos) {
  if (esSuperAdmin || permisosUsuario.includes('*')) {
    return true
  }

  return permisos.some(p => permisosUsuario.includes(p))
}

/**
 * Verificar si el usuario tiene todos los permisos
 * @param {...string} permisos - Códigos de permisos a verificar
 * @returns {boolean}
 */
export function tieneTodosLosPermisos(...permisos) {
  if (esSuperAdmin || permisosUsuario.includes('*')) {
    return true
  }

  return permisos.every(p => permisosUsuario.includes(p))
}

/**
 * Verificar si el usuario es super admin
 * @returns {boolean}
 */
export function esAdmin() {
  return esSuperAdmin
}

/**
 * Obtener información del usuario actual
 * @returns {Object|null}
 */
export function getUsuarioActual() {
  return usuarioActual
}

/**
 * Obtener información del rol actual
 * @returns {Object|null}
 */
export function getRolActual() {
  return rolActual
}

/**
 * Obtener lista de permisos del usuario
 * @returns {string[]}
 */
export function getPermisos() {
  return [...permisosUsuario]
}

/**
 * Verificar si el usuario tiene acceso a una caja específica
 * @param {number} cajaId - ID de la caja a verificar
 * @returns {boolean}
 */
export function tieneCajaPermitida(cajaId) {
  // Super admin tiene acceso a todas las cajas
  if (esSuperAdmin || cajasPermitidas.includes('*')) {
    return true
  }

  // Si no hay cajas asignadas al rol, permitir todas (comportamiento por defecto)
  if (cajasPermitidas.length === 0) {
    return true
  }

  return cajasPermitidas.includes(cajaId)
}

/**
 * Obtener lista de IDs de cajas permitidas
 * @returns {(number|string)[]} Array de IDs o ['*'] si tiene acceso a todas
 */
export function getCajasPermitidas() {
  if (esSuperAdmin || cajasPermitidas.includes('*')) {
    return ['*']
  }
  return [...cajasPermitidas]
}

/**
 * Verificar si el usuario tiene restricción de cajas
 * @returns {boolean}
 */
export function tieneRestriccionCajas() {
  return !esSuperAdmin && !cajasPermitidas.includes('*') && cajasPermitidas.length > 0
}

// Códigos de permisos disponibles (para referencia)
export const PERMISOS = {
  // Socios
  SOCIOS_VER: 'SOCIOS_VER',
  SOCIOS_CREAR: 'SOCIOS_CREAR',
  SOCIOS_EDITAR: 'SOCIOS_EDITAR',
  SOCIOS_ELIMINAR: 'SOCIOS_ELIMINAR',

  // Inscripciones
  INSCRIPCIONES_VER: 'INSCRIPCIONES_VER',
  INSCRIPCIONES_GESTIONAR: 'INSCRIPCIONES_GESTIONAR',

  // Actividades
  ACTIVIDADES_VER: 'ACTIVIDADES_VER',
  ACTIVIDADES_GESTIONAR: 'ACTIVIDADES_GESTIONAR',

  // Deportes
  DEPORTES_VER: 'DEPORTES_VER',
  DEPORTES_PARTIDOS: 'DEPORTES_PARTIDOS',
  DEPORTES_ENTRENAMIENTOS: 'DEPORTES_ENTRENAMIENTOS',
  DEPORTES_PASAJE: 'DEPORTES_PASAJE',

  // Buffet
  BUFFET_VER: 'BUFFET_VER',
  BUFFET_MESAS: 'BUFFET_MESAS',
  BUFFET_COBRAR: 'BUFFET_COBRAR',
  BUFFET_COCINA: 'BUFFET_COCINA',
  BUFFET_KIOSCO: 'BUFFET_KIOSCO',
  BUFFET_CONFIG: 'BUFFET_CONFIG',

  // Cuotas
  CUOTAS_VER: 'CUOTAS_VER',
  CUOTAS_GENERAR: 'CUOTAS_GENERAR',
  CUOTAS_BONIFICAR: 'CUOTAS_BONIFICAR',
  DEBITO_AUTOMATICO: 'DEBITO_AUTOMATICO',

  // Tesorería
  CAJA_VER: 'CAJA_VER',
  CAJA_COBRAR: 'CAJA_COBRAR',
  CAJA_MOVIMIENTOS: 'CAJA_MOVIMIENTOS',
  CAJA_ANULAR: 'CAJA_ANULAR',
  CAJA_CIERRE: 'CAJA_CIERRE',

  // Contabilidad
  CONTABILIDAD_VER: 'CONTABILIDAD_VER',
  CONTABILIDAD_ASIENTOS: 'CONTABILIDAD_ASIENTOS',
  CONTABILIDAD_PRESUPUESTO: 'CONTABILIDAD_PRESUPUESTO',

  // Stock
  STOCK_VER: 'STOCK_VER',
  STOCK_GESTIONAR: 'STOCK_GESTIONAR',

  // Ingresos
  INGRESOS_VER: 'INGRESOS_VER',
  INGRESOS_GESTIONAR: 'INGRESOS_GESTIONAR',

  // Egresos
  EGRESOS_VER: 'EGRESOS_VER',
  EGRESOS_GESTIONAR: 'EGRESOS_GESTIONAR',

  // Sueldos
  SUELDOS_VER: 'SUELDOS_VER',
  SUELDOS_GESTIONAR: 'SUELDOS_GESTIONAR',

  // Reportes
  REPORTES_VER: 'REPORTES_VER',
  REPORTES_EXPORTAR: 'REPORTES_EXPORTAR',

  // Contenido
  CONTENIDO_VER: 'CONTENIDO_VER',
  CONTENIDO_GESTIONAR: 'CONTENIDO_GESTIONAR',

  // Configuración
  CONFIG_VER: 'CONFIG_VER',
  CONFIG_EDITAR: 'CONFIG_EDITAR',

  // Sistema
  USUARIOS_GESTIONAR: 'USUARIOS_GESTIONAR',
  COMERCIOS_GESTIONAR: 'COMERCIOS_GESTIONAR',

  // Control de Accesos
  ACCESOS_VER: 'ACCESOS_VER',
  ACCESOS_GESTIONAR: 'ACCESOS_GESTIONAR',

  // Eventos
  EVENTOS_VER: 'EVENTOS_VER',
  EVENTOS_GESTIONAR: 'EVENTOS_GESTIONAR',
  EVENTOS_VENDER: 'EVENTOS_VENDER',
  EVENTOS_VALIDAR: 'EVENTOS_VALIDAR',

  // Facturación
  FACTURACION_EMITIR: 'FACTURACION_EMITIR',
  FACTURACION_ANULAR: 'FACTURACION_ANULAR',
  FACTURACION_CONFIG: 'FACTURACION_CONFIG',

  // Dashboard
  DASHBOARD_VER: 'DASHBOARD_VER',
  DASHBOARD_EJECUTIVO: 'DASHBOARD_EJECUTIVO',
}
