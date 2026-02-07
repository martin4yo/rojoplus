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
let esSuperAdmin = false
let usuarioActual = null
let rolActual = null

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

    const res = await fetch('/api/admin/mis-permisos', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!res.ok) {
      limpiarPermisos()
      return false
    }

    const data = await res.json()
    if (data.success && data.data) {
      permisosUsuario = data.data.permisos || []
      esSuperAdmin = data.data.esSuperAdmin || false
      usuarioActual = data.data.usuario
      rolActual = data.data.rol
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
}
