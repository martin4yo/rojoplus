import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// La edición/alta de entrenadores se hace desde Personal (Entidad tipo PERSONAL).
// Resolvemos el entidadId del entrenador y redirigimos a la pantalla unificada.
export default function EntrenadorForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [destino, setDestino] = useState(isEditing ? null : '/admin/egresos/personal/nuevo')

  useEffect(() => {
    if (!isEditing) return
    let cancel = false
    ;(async () => {
      try {
        const data = await api.get(`/admin/entrenadores/${id}`)
        const entidadId = data?.entidad?.id || data?.entidadId
        if (cancel) return
        setDestino(entidadId ? `/admin/egresos/personal/${entidadId}/editar` : '/admin/egresos/personal')
      } catch {
        if (!cancel) setDestino('/admin/egresos/personal')
      }
    })()
    return () => { cancel = true }
  }, [id, isEditing])

  if (!destino) return <LoadingSpinner />
  return <Navigate to={destino} replace />
}
