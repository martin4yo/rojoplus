import { useState } from 'react'
import { Star, Send } from 'lucide-react'
import { Button } from './Button'
import Modal from './Modal'
import { Alert } from './Alert'
import api from '../services/api'

export function EncuestaBajaModal({ isOpen, onClose, socio }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [form, setForm] = useState({
    motivoPrincipal: '',
    motivoDetalle: '',
    satisfaccion: 0,
    recomendaria: null,
    seVaOtroClub: false,
    nombreOtroClub: '',
    volveria: null,
    condicionesVolver: '',
    comentarios: '',
    aceptaContacto: true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.motivoPrincipal || form.satisfaccion === 0) {
      setError('Por favor completa los campos obligatorios')
      return
    }

    try {
      setGuardando(true)
      setError(null)

      const payload = {
        socioId: socio.id,
        ...form
      }

      await api.post('/admin/recupero/encuestas-baja', payload)

      setSuccess('Encuesta de baja registrada correctamente')

      setTimeout(() => {
        onClose()
        // Reset form
        setForm({
          motivoPrincipal: '',
          motivoDetalle: '',
          satisfaccion: 0,
          recomendaria: null,
          seVaOtroClub: false,
          nombreOtroClub: '',
          volveria: null,
          condicionesVolver: '',
          comentarios: '',
          aceptaContacto: true
        })
      }, 1500)
    } catch (err) {
      console.error('Error guardando encuesta:', err)
      setError(err.response?.data?.message || 'Error al guardar la encuesta')
    } finally {
      setGuardando(false)
    }
  }

  const renderSatisfaccion = () => {
    return (
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => setForm({ ...form, satisfaccion: rating })}
            className="focus:outline-none transition-colors"
          >
            <Star
              className={`w-8 h-8 ${
                rating <= form.satisfaccion
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {form.satisfaccion === 0 && 'No seleccionado'}
          {form.satisfaccion === 1 && 'Muy insatisfecho'}
          {form.satisfaccion === 2 && 'Insatisfecho'}
          {form.satisfaccion === 3 && 'Neutral'}
          {form.satisfaccion === 4 && 'Satisfecho'}
          {form.satisfaccion === 5 && 'Muy satisfecho'}
        </span>
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Encuesta de Baja de Socio"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {/* Info del socio */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600">Socio</p>
          <p className="font-medium text-gray-900">
            {socio?.apellidoNombre} - Nro: {socio?.nroSocio}
          </p>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Motivo Principal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo Principal de la Baja *
            </label>
            <select
              value={form.motivoPrincipal}
              onChange={(e) => setForm({ ...form, motivoPrincipal: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar motivo...</option>
              <option value="ECONOMICO">Económico</option>
              <option value="MUDANZA">Mudanza</option>
              <option value="FALTA_TIEMPO">Falta de Tiempo</option>
              <option value="INSATISFACCION_SERVICIO">Insatisfacción con el Servicio</option>
              <option value="PROBLEMAS_SALUD">Problemas de Salud</option>
              <option value="CAMBIO_CLUB">Se va a otro Club</option>
              <option value="PERSONAL">Motivos Personales</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          {/* Detalle del motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Detalle del Motivo
            </label>
            <textarea
              value={form.motivoDetalle}
              onChange={(e) => setForm({ ...form, motivoDetalle: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Describe en detalle el motivo de la baja..."
            />
          </div>

          {/* Satisfacción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel de Satisfacción General *
            </label>
            {renderSatisfaccion()}
          </div>

          {/* Recomendaría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Recomendaría el club a otros?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recomendaria"
                  checked={form.recomendaria === true}
                  onChange={() => setForm({ ...form, recomendaria: true })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Sí</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recomendaria"
                  checked={form.recomendaria === false}
                  onChange={() => setForm({ ...form, recomendaria: false })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">No</span>
              </label>
            </div>
          </div>

          {/* Se va a otro club */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.seVaOtroClub}
                onChange={(e) => setForm({ ...form, seVaOtroClub: e.target.checked })}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Se va a otro club
              </span>
            </label>
          </div>

          {/* Nombre otro club */}
          {form.seVaOtroClub && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿A qué club?
              </label>
              <input
                type="text"
                value={form.nombreOtroClub}
                onChange={(e) => setForm({ ...form, nombreOtroClub: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Nombre del club..."
              />
            </div>
          )}

          {/* Volvería */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Volvería al club en el futuro?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="volveria"
                  checked={form.volveria === true}
                  onChange={() => setForm({ ...form, volveria: true })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Sí</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="volveria"
                  checked={form.volveria === false}
                  onChange={() => setForm({ ...form, volveria: false })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">No</span>
              </label>
            </div>
          </div>

          {/* Condiciones para volver */}
          {form.volveria === true && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Bajo qué condiciones volvería?
              </label>
              <textarea
                value={form.condicionesVolver}
                onChange={(e) => setForm({ ...form, condicionesVolver: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ej: Mejora económica, oferta especial, etc."
              />
            </div>
          )}

          {/* Comentarios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comentarios Adicionales
            </label>
            <textarea
              value={form.comentarios}
              onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Cualquier otro comentario que desee agregar..."
            />
          </div>

          {/* Acepta contacto */}
          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.aceptaContacto}
                onChange={(e) => setForm({ ...form, aceptaContacto: e.target.checked })}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Acepta ser contactado para futuras campañas de recupero
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={guardando || success}
          >
            {guardando ? (
              'Guardando...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Encuesta
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
