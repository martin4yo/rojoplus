import { useState, useEffect } from 'react'
import api from '../services/api'

/**
 * Componente selector de Centro de Costo
 *
 * Uso:
 * <CentroCostoSelector
 *   value={centroCostoId}
 *   onChange={(id) => setCentroCostoId(id)}
 *   label="Centro de Costo"
 *   required={false}
 *   tipo="OPERATIVO" // opcional: filtrar por tipo
 * />
 *
 * Agregar este selector en:
 * - MovimientoCajaForm
 * - FacturaCompraForm / FacturaVentaForm (nivel documento e ítems)
 * - OrdenPagoForm
 * - ReciboCobro Form
 */
export default function CentroCostoSelector({
  value,
  onChange,
  label = null,
  required = false,
  tipo = null, // OPERATIVO, ADMINISTRATIVO, o null para todos
  className = '',
  disabled = false
}) {
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarCentros()
  }, [tipo])

  const cargarCentros = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ activo: true })
      if (tipo) params.set('tipo', tipo)

      const response = await api.get(`/admin/centros-costo?${params}`)
      setCentros(Array.isArray(response) ? response : (response?.data || []))
    } catch (err) {
      console.error('Error cargando centros de costo:', err)
      setCentros([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        required={required}
        disabled={disabled || loading}
        className="input-field w-full"
      >
        <option value="">Seleccionar centro de costo...</option>
        {centros
          .filter(c => c.tipo === 'OPERATIVO')
          .map(centro => (
            <option key={centro.id} value={centro.id}>
              {centro.nombre} ({centro.codigo})
            </option>
          ))}
        {centros.filter(c => c.tipo === 'OPERATIVO').length > 0 &&
         centros.filter(c => c.tipo === 'ADMINISTRATIVO').length > 0 && (
          <option disabled>────────────────</option>
        )}
        {centros
          .filter(c => c.tipo === 'ADMINISTRATIVO')
          .map(centro => (
            <option key={centro.id} value={centro.id}>
              {centro.nombre} ({centro.codigo})
            </option>
          ))}
      </select>
    </div>
  )
}
