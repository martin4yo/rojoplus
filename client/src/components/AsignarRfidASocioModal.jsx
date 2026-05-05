import { useState, useEffect, useRef } from 'react'
import { X, Search, AlertCircle, CheckCircle2, User, Loader2, Radio } from 'lucide-react'
import { Button } from './Button'
import api from '../services/api'

/**
 * Modal para asociar el PIN/UID de un carnet RFID a un socio.
 * Se invoca desde el monitor de accesos cuando una lectura RFID viene como NO_ENCONTRADO.
 *
 * Props:
 *   isOpen, onClose
 *   valorLeido     - PIN convertido (lo que se guarda en socio.rfidUid)
 *   onAsignado     - callback (socio) cuando se guardó OK
 */
export default function AsignarRfidASocioModal({ isOpen, onClose, valorLeido, onAsignado }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [mensajeOk, setMensajeOk] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResultados([])
      setSeleccionado(null)
      setError(null)
      setMensajeOk(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.trim().length < 2 || seleccionado) {
      setResultados([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await api.get(`/accesos/buscar-socio?q=${encodeURIComponent(query.trim())}`)
        setResultados(Array.isArray(data) ? data : [])
      } catch (_) {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, seleccionado])

  async function asignar() {
    if (!seleccionado || !valorLeido) return
    setError(null)
    setGuardando(true)
    try {
      const res = await api.put(`/admin/socios/${seleccionado.id}/rfid`, { rfidUid: valorLeido })
      setMensajeOk(`PIN asignado a ${res?.apellidoNombre || seleccionado.apellidoNombre}`)
      if (onAsignado) onAsignado(res || seleccionado)
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setError(err?.message || 'No se pudo asignar el PIN')
    } finally {
      setGuardando(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" /> Asignar carnet a socio
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              PIN del carnet: <code className="font-mono font-semibold text-gray-700">{valorLeido}</code>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
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

              {resultados.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {resultados.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSeleccionado(s)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {s.fotoUrl
                          ? <img src={s.fotoUrl} alt="" className="w-full h-full object-cover" />
                          : <User className="w-5 h-5 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{s.apellidoNombre}</p>
                        <p className="text-xs text-gray-500">
                          N° {s.nroSocio} {s.documento && `· DNI ${s.documento}`}
                        </p>
                        {s.rfidUid && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Ya tiene PIN asignado: {s.rfidUid} (será reemplazado)
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {query.length >= 2 && !buscando && resultados.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No se encontraron socios.</p>
              )}
            </>
          ) : (
            <>
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
                </div>
                <button
                  onClick={() => { setSeleccionado(null); setQuery(''); setError(null) }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Cambiar
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                Se guardará el PIN <code className="font-mono font-bold">{valorLeido}</code> en la ficha del socio.
                Las próximas lecturas del carnet le abrirán el molinete (si está habilitado).
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mt-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {mensajeOk && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mt-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {mensajeOk}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          {seleccionado && (
            <Button onClick={asignar} disabled={guardando || mensajeOk}>
              {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Asignar PIN
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
