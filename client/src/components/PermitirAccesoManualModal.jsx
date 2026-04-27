import { useState, useEffect, useRef } from 'react'
import { X, Search, AlertTriangle, AlertCircle, CheckCircle2, User, Loader2 } from 'lucide-react'
import { Button } from './Button'
import api from '../services/api'

const MOTIVOS = [
  { value: 'SIN_DNI',     label: 'Sin DNI' },
  { value: 'SIN_CARNET',  label: 'Sin carnet' },
  { value: 'OTRO',        label: 'Otro' },
]

/**
 * Modal para permitir el acceso manual a un socio que se olvidó el documento.
 * Al confirmar registra el olvido y abre el molinete (vía /accesos/permitir-manual).
 *
 * Props:
 *   isOpen, onClose
 *   dispositivos      - array de dispositivos disponibles (opcional, para elegir cuál abrir)
 *   onPermitido       - callback (socio, datosOlvido) cuando se permitió OK
 */
export default function PermitirAccesoManualModal({ isOpen, onClose, dispositivos = [], onPermitido }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [motivo, setMotivo] = useState('SIN_DNI')
  const [observaciones, setObservaciones] = useState('')
  const [dispositivoId, setDispositivoId] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState(null)
  const [mensajeOk, setMensajeOk] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      // reset al cerrar
      setQuery('')
      setResultados([])
      setSeleccionado(null)
      setMotivo('SIN_DNI')
      setObservaciones('')
      setError(null)
      setMensajeOk(null)
      return
    }
    // Si hay un solo dispositivo, preseleccionarlo
    if (dispositivos.length === 1) setDispositivoId(String(dispositivos[0].id))
  }, [isOpen, dispositivos])

  // Buscar con debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.trim().length < 2 || seleccionado) {
      setResultados([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await api.get(`/accesos/buscar-socio?q=${encodeURIComponent(query.trim())}`)
        setResultados(res?.data || [])
      } catch (err) {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, seleccionado])

  function elegir(socio) {
    setSeleccionado(socio)
    setError(null)
  }

  function quitarSeleccion() {
    setSeleccionado(null)
    setQuery('')
    setError(null)
    setMensajeOk(null)
  }

  async function permitir() {
    if (!seleccionado) return
    setError(null)
    setConfirmando(true)
    try {
      const body = {
        socioId: seleccionado.id,
        dispositivoId: dispositivoId ? parseInt(dispositivoId) : undefined,
        motivo,
        observaciones: observaciones.trim() || null,
      }
      const res = await api.post('/accesos/permitir-manual', body)
      setMensajeOk(res?.message || 'Acceso permitido — olvido registrado')
      if (onPermitido) onPermitido(seleccionado, res?.data || null)
      // cerrar a los 1.5s
      setTimeout(() => { onClose() }, 1500)
    } catch (err) {
      setError(err?.message || 'No se pudo permitir el acceso')
    } finally {
      setConfirmando(false)
    }
  }

  if (!isOpen) return null

  const esVigente = seleccionado && (
    seleccionado.estado?.toUpperCase().includes('VIGENT') ||
    seleccionado.estado?.toUpperCase().includes('ACTIV')
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Permitir acceso sin documento</h2>
            <p className="text-xs text-gray-500">Buscá al socio y registrá el motivo del olvido</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Buscador o socio seleccionado */}
          {!seleccionado ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar socio *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre, N° de socio o DNI"
                  className="input-field w-full pl-9"
                  autoFocus
                />
                {buscando && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Resultados */}
              {resultados.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {resultados.map(s => {
                    const vigente = s.estado?.toUpperCase().includes('VIGENT') || s.estado?.toUpperCase().includes('ACTIV')
                    return (
                      <button
                        key={s.id}
                        onClick={() => elegir(s)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {s.fotoUrl
                            ? <img src={s.fotoUrl} alt="" className="w-full h-full object-cover" />
                            : <User className="w-5 h-5 text-gray-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800 truncate">{s.apellidoNombre}</p>
                            {!vigente && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                                {s.estado}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            N° {s.nroSocio} {s.documento && `· DNI ${s.documento}`}
                          </p>
                          {s.olvidosUltimos30 > 0 && (
                            <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {s.olvidosUltimos30} olvido{s.olvidosUltimos30 !== 1 ? 's' : ''} en últimos 30 días
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {query.length >= 2 && !buscando && resultados.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No se encontraron socios.</p>
              )}
            </>
          ) : (
            <>
              {/* Ficha del seleccionado */}
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-white flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
                  {seleccionado.fotoUrl
                    ? <img src={seleccionado.fotoUrl} alt="" className="w-full h-full object-cover" />
                    : <User className="w-7 h-7 text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{seleccionado.apellidoNombre}</p>
                  <p className="text-sm text-gray-500">
                    N° {seleccionado.nroSocio} {seleccionado.documento && `· DNI ${seleccionado.documento}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {esVigente ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{seleccionado.estado}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {seleccionado.estado}
                      </span>
                    )}
                    {seleccionado.olvidosUltimos30 > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {seleccionado.olvidosUltimos30} olvido{seleccionado.olvidosUltimos30 !== 1 ? 's' : ''} (30d)
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={quitarSeleccion} className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Cambiar
                </button>
              </div>

              {!esVigente && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>El socio no está vigente. <strong>No se puede permitir el acceso.</strong> Debe pasar por Secretaría.</span>
                  </p>
                </div>
              )}

              {esVigente && (
                <>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                    <select
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="input-field w-full"
                    >
                      {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  {dispositivos.length > 1 && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dispositivo</label>
                      <select
                        value={dispositivoId}
                        onChange={(e) => setDispositivoId(e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="">Solo registrar (sin abrir molinete)</option>
                        {dispositivos.map(d => <option key={d.id} value={d.id}>{d.nombre || `Dispositivo ${d.id}`}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows="2"
                      placeholder="Opcional"
                      className="input-field w-full"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
                  {error}
                </div>
              )}

              {mensajeOk && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {mensajeOk}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          {seleccionado && esVigente && (
            <Button onClick={permitir} disabled={confirmando || mensajeOk}>
              {confirmando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Permitir y registrar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
