import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Calendar, DollarSign } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
]

export default function LiquidacionForm() {
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [saving, setSaving] = useState(false)

  // Mes y anio actual por defecto
  const fecha = new Date()
  const [mes, setMes] = useState(fecha.getMonth() + 1)
  const [anio, setAnio] = useState(fecha.getFullYear())
  const [observaciones, setObservaciones] = useState('')

  // Generar anios (actual y 2 anteriores)
  const anioActual = fecha.getFullYear()
  const anios = [anioActual, anioActual - 1]

  async function handleSubmit(e) {
    e.preventDefault()

    setSaving(true)
    try {
      const response = await api.post('/admin/liquidaciones', {
        mes,
        anio,
        observaciones: observaciones || null
      })

      showModal({
        type: 'success',
        message: `Liquidacion de ${MESES.find(m => m.value === mes)?.label} ${anio} generada correctamente con ${response?.items?.length || 0} empleados`,
        onConfirm: () => navigate(`/admin/liquidaciones/${response?.id}`)
      })
    } catch (err) {
      showModal({
        type: 'error',
        message: err.message || 'Error al generar la liquidacion'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {ModalComponent}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/liquidaciones')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Generar Liquidacion</h1>
            <p className="text-gray-500 text-sm">Se incluira todo el personal activo con sueldo configurado</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            Periodo a Liquidar
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mes *
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                className="input-field w-full"
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anio *
              </label>
              <select
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value))}
                className="input-field w-full"
              >
                {anios.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales sobre esta liquidacion..."
              rows={3}
              className="input-field w-full"
            />
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-medium text-purple-800 mb-2">Informacion</h3>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>- Se incluira automaticamente todo el personal activo con sueldo configurado</li>
              <li>- Se aplicaran los conceptos fijos configurados (presentismo, etc.)</li>
              <li>- Podra agregar conceptos adicionales por empleado despues de generar</li>
              <li>- Los pagos se pueden realizar individual o masivamente</li>
            </ul>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/liquidaciones')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Generando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Generar Liquidacion
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
