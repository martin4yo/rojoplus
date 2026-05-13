import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * Multi-select de "estados de baja" para segmentar campañas de recupero.
 *
 * Carga los EstadoSocio del tenant que NO permiten ingresar al club
 * (permiteIngresoMolinete=false). El admin puede ampliar esta lista en
 * Tablas Auxiliares → Estados de Socio.
 *
 * `value`: string CSV con los IDs de EstadoSocio seleccionados (ej: "3,7,12").
 * Se mantiene el nombre del prop ("motivosBaja") en el form padre por
 * compatibilidad con la columna `CampanaRecupero.motivosBaja`, pero
 * semánticamente ahora son IDs de estado.
 */
export default function MotivosBajaSelector({ value, onChange }) {
  const [estados, setEstados] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarEstados()
  }, [])

  async function cargarEstados() {
    try {
      setLoading(true)
      const data = await api.get('/admin/estados-socio?activo=true')
      const lista = Array.isArray(data) ? data : []
      // Solo estados que representan baja (no permiten ingreso)
      const deBaja = lista.filter(e => !e.permiteIngresoMolinete)
      setEstados(deBaja)
    } catch (err) {
      console.error('Error cargando estados de socio:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectedSet = new Set(
    String(value || '').split(',').map(v => v.trim()).filter(Boolean)
  )

  function toggle(id) {
    const next = new Set(selectedSet)
    const idStr = String(id)
    if (next.has(idStr)) next.delete(idStr)
    else next.add(idStr)
    onChange(Array.from(next).join(','))
  }

  if (loading) {
    return <div className="text-sm text-gray-500 border border-gray-300 rounded-lg p-3">Cargando estados…</div>
  }

  if (estados.length === 0) {
    return (
      <div className="text-sm text-gray-500 border border-gray-300 rounded-lg p-3">
        No hay estados de baja configurados. Agregalos en <strong>Tablas Auxiliares → Estados de Socio</strong>.
      </div>
    )
  }

  return (
    <div className="border border-gray-300 rounded-lg p-2 space-y-1 bg-white max-h-64 overflow-y-auto">
      {estados.map(e => (
        <label key={e.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={selectedSet.has(String(e.id))}
            onChange={() => toggle(e.id)}
            className="w-4 h-4 text-red-600 rounded"
          />
          {e.color && (
            <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: e.color }} />
          )}
          <span className="text-gray-700 flex-1">{e.nombre}</span>
          {e.codigo && <span className="text-xs text-gray-400">{e.codigo}</span>}
        </label>
      ))}
      <p className="text-xs text-gray-500 pt-1 px-2 border-t border-gray-100">
        {selectedSet.size === 0
          ? 'Sin seleccionar = se incluyen socios con cualquier estado de baja'
          : `${selectedSet.size} estado${selectedSet.size > 1 ? 's' : ''} seleccionado${selectedSet.size > 1 ? 's' : ''}`}
      </p>
    </div>
  )
}
