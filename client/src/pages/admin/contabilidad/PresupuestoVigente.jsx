import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

// Este componente busca el presupuesto vigente (principal del año actual)
// y redirige a su vista de ejecución
export default function PresupuestoVigente() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarPresupuestoVigente()
  }, [])

  async function buscarPresupuestoVigente() {
    try {
      const anioActual = new Date().getFullYear()
      const res = await api.getFull('/admin/presupuestos/anios')
      const anios = res.data || []

      // Buscar el año actual
      const grupoAnioActual = anios.find(g => g.anio === anioActual)

      if (grupoAnioActual) {
        // Buscar la versión principal
        const principal = grupoAnioActual.versiones.find(v => v.esPrincipal)
        if (principal) {
          navigate(`/admin/contabilidad/presupuestos/${principal.id}/ejecucion`, { replace: true })
          return
        }
        // Si no hay principal, usar la primera versión
        if (grupoAnioActual.versiones.length > 0) {
          navigate(`/admin/contabilidad/presupuestos/${grupoAnioActual.versiones[0].id}/ejecucion`, { replace: true })
          return
        }
      }

      // Si no hay presupuesto del año actual, buscar el más reciente
      if (anios.length > 0) {
        const primerAnio = anios[0] // Ya viene ordenado desc
        const principal = primerAnio.versiones.find(v => v.esPrincipal) || primerAnio.versiones[0]
        if (principal) {
          navigate(`/admin/contabilidad/presupuestos/${principal.id}/ejecucion`, { replace: true })
          return
        }
      }

      // No hay presupuestos
      setError('No hay presupuestos cargados')
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertTriangle className="w-8 h-8" />
          <span className="text-lg">{error}</span>
        </div>
        <Button onClick={() => navigate('/admin/contabilidad/presupuestos')}>
          Ir a Presupuestos
        </Button>
      </div>
    )
  }

  return null
}
