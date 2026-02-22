import { useState, useEffect } from 'react'
import api from '../services/api'

/**
 * Componente selector de Centro de Costo reutilizable
 *
 * @param {Object} props
 * @param {string|number} props.value - ID del centro de costo seleccionado
 * @param {function} props.onChange - Callback cuando cambia la selección
 * @param {string} props.name - Nombre del campo (para formularios)
 * @param {boolean} props.required - Si el campo es obligatorio
 * @param {boolean} props.disabled - Si el campo está deshabilitado
 * @param {string} props.className - Clases CSS adicionales
 * @param {boolean} props.showEmpty - Mostrar opción "Sin centro de costo"
 * @param {string} props.emptyLabel - Texto para la opción vacía
 */
export default function SelectCentroCosto({
  value,
  onChange,
  name = 'centroCostoId',
  required = false,
  disabled = false,
  className = '',
  showEmpty = true,
  emptyLabel = '-- Sin centro de costo --'
}) {
  const [centrosCosto, setCentrosCosto] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarCentrosCosto()
  }, [])

  const cargarCentrosCosto = async () => {
    try {
      setLoading(true)
      const data = await api.get('/admin/centros-costo?activo=true')
      setCentrosCosto(data?.data || data || [])
    } catch (err) {
      console.error('Error cargando centros de costo:', err)
      setError('Error al cargar centros de costo')
      setCentrosCosto([])
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    if (onChange) {
      // Si es onChange estándar (e), pasar el evento
      if (typeof onChange === 'function' && onChange.length === 1) {
        onChange(e)
      } else {
        // Si espera solo el valor
        onChange(val ? parseInt(val) : null)
      }
    }
  }

  if (error) {
    return (
      <select
        name={name}
        disabled
        className={`px-3 py-2 border border-red-300 rounded-lg bg-red-50 ${className}`}
      >
        <option>Error al cargar</option>
      </select>
    )
  }

  return (
    <select
      name={name}
      value={value || ''}
      onChange={handleChange}
      required={required}
      disabled={disabled || loading}
      className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
        disabled ? 'bg-gray-100 cursor-not-allowed' : ''
      } ${className}`}
    >
      {loading ? (
        <option>Cargando...</option>
      ) : (
        <>
          {showEmpty && <option value="">{emptyLabel}</option>}
          {centrosCosto.map(cc => (
            <option key={cc.id} value={cc.id}>
              {cc.codigo} - {cc.nombre}
            </option>
          ))}
        </>
      )}
    </select>
  )
}
