import { Navigate } from 'react-router-dom'

// La gestión de entrenadores se unificó con Personal (Entidades tipo PERSONAL).
// Esta ruta queda como redirect para no romper bookmarks ni links viejos.
export default function EntrenadoresLista() {
  return <Navigate to="/admin/egresos/personal" replace />
}
