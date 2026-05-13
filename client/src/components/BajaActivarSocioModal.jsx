import { useEffect, useState } from 'react'
import { UserMinus, UserCheck, AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import Switch from './Switch'
import LoadingSpinner from './LoadingSpinner'
import api from '../services/api'
import toast from 'react-hot-toast'

/**
 * Modal para dar de baja o reactivar un socio.
 *
 * Si el socio es titular de un grupo familiar, permite propagar la acción a
 * todos los integrantes. En el caso de reactivación, además permite generar
 * las cuotas del período vigente (cuota social + cuotas de actividades).
 *
 * Props:
 *   - socio: { id, apellidoNombre, nroSocio }
 *   - modo: 'baja' | 'activar'
 *   - isOpen, onClose
 *   - onDone: callback tras éxito (recibe data del backend)
 */
export default function BajaActivarSocioModal({ socio, modo, isOpen, onClose, onDone }) {
  const esBaja = modo === 'baja'

  const [loadingResumen, setLoadingResumen] = useState(false)
  const [resumen, setResumen] = useState(null) // { esTitular, integrantes }
  const [estadosBaja, setEstadosBaja] = useState([])

  // Form
  const [motivoBaja, setMotivoBaja] = useState('')
  const [fechaBaja, setFechaBaja] = useState(() => new Date().toISOString().slice(0, 10))
  const [estadoBajaId, setEstadoBajaId] = useState('')
  const [propagarFamilia, setPropagarFamilia] = useState(false)
  const [generarCuotas, setGenerarCuotas] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen || !socio?.id) return
    setLoadingResumen(true)
    setResumen(null)
    setMotivoBaja('')
    setFechaBaja(new Date().toISOString().slice(0, 10))
    setEstadoBajaId('')
    setPropagarFamilia(false)
    setGenerarCuotas(true)

    const calls = [api.get(`/admin/socios/${socio.id}/grupo-familiar-resumen`)]
    if (esBaja) {
      calls.push(api.get('/admin/estados-socio').catch(() => []))
    }

    Promise.all(calls)
      .then(([data, estadosLista]) => {
        const resumenData = data || { esTitular: false, integrantes: [] }
        setResumen(resumenData)
        setPropagarFamilia(resumenData.esTitular === true)
        if (esBaja && estadosLista) {
          const lista = Array.isArray(estadosLista) ? estadosLista : []
          setEstadosBaja(lista.filter(e => e.esSocioActivo === false))
        }
      })
      .catch(() => toast.error('No se pudo cargar el resumen del grupo familiar'))
      .finally(() => setLoadingResumen(false))
  }, [isOpen, socio?.id, esBaja])

  async function handleSubmit() {
    if (!socio?.id) return
    setSubmitting(true)
    try {
      if (esBaja) {
        const payload = {
          motivoBaja: motivoBaja || undefined,
          fechaBaja,
          estadoBajaId: estadoBajaId ? parseInt(estadoBajaId) : undefined,
          propagarFamilia,
        }
        const data = await api.post(`/admin/socios/${socio.id}/desactivar`, payload)
        toast.success(data?.mensaje || 'Socio desactivado')
        onDone?.(data)
      } else {
        const payload = { propagarFamilia, generarCuotas }
        const data = await api.post(`/admin/socios/${socio.id}/activar`, payload)
        const cuotasMsg = data?.cuotas?.cuotasGeneradas
          ? ` · ${data.cuotas.cuotasGeneradas} cuota(s) generada(s) en ${data.cuotas.periodoNombre}`
          : ''
        toast.success((data?.mensaje || 'Socio reactivado') + cuotasMsg)
        onDone?.(data)
      }
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Error en la operación')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const icono = esBaja
    ? <UserMinus className="w-6 h-6 text-red-600" />
    : <UserCheck className="w-6 h-6 text-emerald-600" />

  const titulo = esBaja ? 'Dar de baja socio' : 'Reactivar socio'
  const integrantes = resumen?.integrantes || []
  const esTitular = !!resumen?.esTitular

  // Integrantes que se verían afectados al propagar
  const integrantesPropagables = esBaja
    ? integrantes.filter(i => i.esSocioActivo) // bajar sólo los activos
    : integrantes.filter(i => i.esSocioActivo === false) // reactivar sólo los inactivos

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titulo}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {icono}
          <div>
            <div className="font-semibold text-gray-800">{socio?.apellidoNombre}</div>
            <div className="text-sm text-gray-500">#{socio?.nroSocio}</div>
          </div>
        </div>

        {loadingResumen ? (
          <div className="py-6"><LoadingSpinner /></div>
        ) : (
          <>
            {esBaja && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de baja
                  </label>
                  <input
                    type="date"
                    value={fechaBaja}
                    onChange={e => setFechaBaja(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {estadosBaja.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado de baja
                    </label>
                    <select
                      value={estadoBajaId}
                      onChange={e => setEstadoBajaId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="">(default: primer estado de baja)</option>
                      {estadosBaja.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo de baja (opcional)
                  </label>
                  <textarea
                    value={motivoBaja}
                    onChange={e => setMotivoBaja(e.target.value)}
                    rows={2}
                    placeholder="Ej: traslado, falta de pago, baja voluntaria..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Propagación a la familia */}
            {esTitular && integrantesPropagables.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    Este socio es <strong>titular</strong> de un grupo familiar con{' '}
                    <strong>{integrantesPropagables.length}</strong>{' '}
                    integrante(s) {esBaja ? 'activo(s)' : 'de baja'}.
                  </div>
                </div>
                <Switch
                  checked={propagarFamilia}
                  onChange={setPropagarFamilia}
                  label={esBaja
                    ? 'Dar de baja también a los integrantes'
                    : 'Reactivar también a los integrantes'}
                />
                {propagarFamilia && (
                  <ul className="mt-2 ml-7 text-xs text-amber-900 space-y-0.5 max-h-32 overflow-y-auto">
                    {integrantesPropagables.map(i => (
                      <li key={i.id}>
                        #{i.nroSocio} — {i.apellidoNombre}
                        {i.estadoNombre && (
                          <span className="text-amber-700"> ({i.estadoNombre})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!esBaja && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <Switch
                  checked={generarCuotas}
                  onChange={setGenerarCuotas}
                  label="Generar cuotas del período vigente"
                />
                <p className="text-xs text-emerald-800 mt-1 ml-14">
                  Crea la cuota social y las cuotas de actividades activas del período
                  actual para cada socio reactivado (si no existen ya).
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant={esBaja ? 'danger' : 'primary'}
            onClick={handleSubmit}
            disabled={submitting || loadingResumen}
          >
            {submitting
              ? 'Procesando...'
              : esBaja ? 'Dar de baja' : 'Reactivar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
