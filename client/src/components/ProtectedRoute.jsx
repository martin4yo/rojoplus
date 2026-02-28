import { Navigate } from 'react-router-dom'
import { tieneAlgunPermiso, tienePermiso } from '../services/permisos'

/**
 * Componente para proteger rutas según permisos del usuario
 *
 * Uso:
 * <Route path="/admin/socios" element={
 *   <ProtectedRoute permisos={[PERMISOS.SOCIOS_VER]}>
 *     <AdminSocios />
 *   </ProtectedRoute>
 * } />
 *
 * Props:
 * - permisos: Array de permisos requeridos (el usuario debe tener AL MENOS UNO)
 * - requiereTodos: Si es true, el usuario debe tener TODOS los permisos (default: false)
 * - redirectTo: Ruta a la que redirigir si no tiene permiso (default: /admin)
 * - children: Componente a renderizar si tiene permiso
 */
export default function ProtectedRoute({
  children,
  permisos = [],
  requiereTodos = false,
  redirectTo = '/admin'
}) {
  // Si no hay permisos requeridos, mostrar el contenido
  if (!permisos || permisos.length === 0) {
    return children
  }

  // Verificar permisos
  const tieneAcceso = requiereTodos
    ? permisos.every(p => tienePermiso(p))
    : tieneAlgunPermiso(...permisos)

  if (!tieneAcceso) {
    // Redirigir si no tiene permiso
    return <Navigate to={redirectTo} replace />
  }

  return children
}
