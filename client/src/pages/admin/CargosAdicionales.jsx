import { useState, useEffect } from 'react'
import { Plus, Trash2, Search, Zap, Users, AlertCircle, CheckCircle, Loader2, Package } from 'lucide-react'
import { Button } from '../../components/Button'
import Modal from '../../components/Modal'
import ConceptoTesoreriaModal from '../../components/ConceptoTesoreriaModal'
import api from '../../services/api'

function ConceptoRow({ row, index, conceptos, categoriasCargo, onChange, onRemove, onNuevoConcepto }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* Concepto */}
        <div className="col-span-4">
          <label className="block text-xs text-gray-500 mb-1">Concepto</label>
          <div className="flex gap-1">
            <select
              value={row.conceptoTesoreriaId}
              onChange={e => onChange(index, 'conceptoTesoreriaId', e.target.value)}
              className="flex-1 border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Seleccionar...</option>
              {conceptos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onNuevoConcepto}
              className="text-xs text-primary hover:underline whitespace-nowrap px-1"
              title="Nuevo concepto"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Categoría */}
        <div className="col-span-3">
          <label className="block text-xs text-gray-500 mb-1">Categoría</label>
          <select
            value={row.categoria}
            onChange={e => onChange(index, 'categoria', e.target.value)}
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Seleccionar...</option>
            {categoriasCargo.map(c => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Monto */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Monto $</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={row.montoOriginal}
            onChange={e => onChange(index, 'montoOriginal', e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Fecha Vencimiento */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Vencimiento</label>
          <input
            type="date"
            value={row.fechaVencimiento}
            onChange={e => onChange(index, 'fechaVencimiento', e.target.value)}
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Eliminar */}
        <div className="col-span-1 flex justify-center">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <input
          type="text"
          value={row.observaciones}
          onChange={e => onChange(index, 'observaciones', e.target.value)}
          placeholder="Observaciones (opcional)"
          className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  )
}

// ── Tab Generar ──────────────────────────────────────────────────────────────
function TabGenerar({ conceptosDB, actividades, categoriasActividad, categoriasCargo, estadosSocio, onLoteGenerado }) {
  const [filas, setFilas] = useState([
    { conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '', observaciones: '' }
  ])
  const [filtros, setFiltros] = useState({ estado: [], actividadId: '', categoriaActividadId: '' })
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [showNuevoConcepto, setShowNuevoConcepto] = useState(false)
  const [conceptosLocal, setConceptosLocal] = useState(conceptosDB)

  useEffect(() => { setConceptosLocal(conceptosDB) }, [conceptosDB])

  function cambiarFila(index, campo, valor) {
    setFilas(prev => prev.map((f, i) => i === index ? { ...f, [campo]: valor } : f))
  }

  function agregarFila() {
    setFilas(prev => [...prev, { conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '', observaciones: '' }])
  }

  function eliminarFila(index) {
    if (filas.length === 1) return
    setFilas(prev => prev.filter((_, i) => i !== index))
  }

  function handleConceptoCreado(nuevo) {
    setConceptosLocal(prev => [...prev, nuevo])
    setShowNuevoConcepto(false)
    setFilas(prev => {
      const idx = prev.findIndex(f => !f.conceptoTesoreriaId)
      if (idx >= 0) return prev.map((f, i) => i === idx ? { ...f, conceptoTesoreriaId: String(nuevo.id) } : f)
      return prev
    })
  }

  function buildFiltros() {
    const f = {}
    if (filtros.estado.length > 0) f.estado = filtros.estado
    if (filtros.actividadId) f.actividadId = filtros.actividadId
    if (filtros.categoriaActividadId) f.categoriaActividadId = filtros.categoriaActividadId
    return f
  }

  function validarFilas() {
    return filas.every(f => f.conceptoTesoreriaId && f.montoOriginal && f.fechaVencimiento)
  }

  async function handlePreview() {
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res = await api.postFull('/admin/cargos/preview-masivo', { filtros: buildFiltros() })
      setPreview(res?.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleGenerar() {
    if (!validarFilas()) {
      setError('Completá todos los campos de cada concepto (concepto, monto, vencimiento)')
      return
    }
    if (!preview || preview.length === 0) {
      setError('Primero hacé una vista previa para confirmar los socios afectados')
      return
    }
    setGenerando(true)
    setError(null)
    setResultado(null)
    try {
      const res = await api.postFull('/admin/cargos/masivo', {
        conceptos: filas.map(f => ({
          conceptoTesoreriaId: parseInt(f.conceptoTesoreriaId),
          categoria: f.categoria,
          montoOriginal: parseFloat(f.montoOriginal),
          fechaVencimiento: f.fechaVencimiento,
          observaciones: f.observaciones || null
        })),
        filtros: buildFiltros()
      })
      const data = res?.data || res
      setResultado(data)
      setPreview(null)
      if (data?.loteId) onLoteGenerado(data.loteId)
    } catch (err) {
      setError(err.message || 'Error al generar los cargos')
    } finally {
      setGenerando(false)
    }
  }

  function resetear() {
    setFilas([{ conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '', observaciones: '' }])
    setFiltros({ estado: [], actividadId: '', categoriaActividadId: '' })
    setPreview(null)
    setResultado(null)
    setError(null)
  }

  function toggleEstado(est) {
    setFiltros(prev => ({
      ...prev,
      estado: prev.estado.includes(est) ? prev.estado.filter(e => e !== est) : [...prev.estado, est]
    }))
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">

          {/* Conceptos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Conceptos a generar</h2>
              <button
                onClick={agregarFila}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" /> Agregar concepto
              </button>
            </div>
            <div className="space-y-2">
              {filas.map((fila, idx) => (
                <ConceptoRow
                  key={idx}
                  row={fila}
                  index={idx}
                  conceptos={conceptosLocal}
                  categoriasCargo={categoriasCargo}
                  onChange={cambiarFila}
                  onRemove={eliminarFila}
                  onNuevoConcepto={() => setShowNuevoConcepto(true)}
                />
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Filtros de destinatarios</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado del socio</label>
              <div className="flex flex-wrap gap-2">
                {estadosSocio.map(est => (
                  <button
                    key={est.codigo}
                    onClick={() => toggleEstado(est.codigo)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      filtros.estado.includes(est.codigo)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {est.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actividad (opcional)</label>
                <select
                  value={filtros.actividadId}
                  onChange={e => setFiltros(prev => ({ ...prev, actividadId: e.target.value, categoriaActividadId: '' }))}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Todas las actividades</option>
                  {actividades.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (opcional)</label>
                <select
                  value={filtros.categoriaActividadId}
                  onChange={e => setFiltros(prev => ({ ...prev, categoriaActividadId: e.target.value }))}
                  disabled={!filtros.actividadId}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Todas las categorías</option>
                  {categoriasActividad.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Vista previa</h2>
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Ver socios afectados
            </button>

            {preview !== null && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {preview.length} socio{preview.length !== 1 ? 's' : ''} afectado{preview.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    × {filas.length} concepto{filas.length !== 1 ? 's' : ''} = {preview.length * filas.length} cargos
                  </span>
                </div>

                {preview.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                    {preview.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{s.apellidoNombre}</span>
                          <span className="text-gray-400 ml-1 text-xs">#{s.nroSocio}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          s.estado === 'ACTIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>{s.estado}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No hay socios que cumplan los filtros
                  </div>
                )}
              </div>
            )}
          </div>

          {preview && preview.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-2">Resumen</h3>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>• {preview.length} socios</li>
                <li>• {filas.length} concepto{filas.length !== 1 ? 's' : ''}</li>
                <li className="font-medium text-gray-800">→ {preview.length * filas.length} cargos a crear</li>
              </ul>
              <Button
                onClick={handleGenerar}
                disabled={generando}
                className="w-full flex items-center justify-center gap-2"
              >
                {generando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                  : <><Zap className="w-4 h-4" /> Generar Cargos</>}
              </Button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {resultado && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Completado</span>
              </div>
              <p className="text-sm text-green-700">
                Se crearon <strong>{resultado.creados}</strong> cargos para <strong>{resultado.totalSocios}</strong> socios.
              </p>
              {resultado.importeTotal != null && (
                <p className="text-sm text-green-700">
                  Importe total: <strong>${resultado.importeTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </p>
              )}
              {resultado.loteId && (
                <p className="text-xs text-green-600 mt-1 font-mono break-all">Lote: {resultado.loteId}</p>
              )}
              {resultado.errores?.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">{resultado.errores.length} registro(s) con error</p>
              )}
              <button onClick={resetear} className="text-sm text-green-700 hover:underline mt-3 block">
                Generar otra tanda
              </button>
            </div>
          )}
        </div>
      </div>

      <ConceptoTesoreriaModal
        isOpen={showNuevoConcepto}
        onClose={() => setShowNuevoConcepto(false)}
        onCreated={handleConceptoCreado}
      />
    </>
  )
}

// ── Tab Consultar ────────────────────────────────────────────────────────────
function TabConsultar({ loteInicial, conceptos, categoriasCargo }) {
  const [filtros, setFiltros] = useState({ fechaDesde: '', fechaHasta: '', conceptoTesoreriaId: '', categoria: '' })
  const [buscando, setBuscando] = useState(false)
  const [lotes, setLotes] = useState(null)
  const [loteId, setLoteId] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [error, setError] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  useEffect(() => {
    if (loteInicial) cargarDetalle(loteInicial)
  }, [loteInicial])

  async function buscarLotes() {
    setBuscando(true)
    setError(null)
    setLotes(null)
    setLoteId(null)
    setDetalle(null)
    try {
      const params = new URLSearchParams()
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)
      if (filtros.conceptoTesoreriaId) params.append('conceptoTesoreriaId', filtros.conceptoTesoreriaId)
      if (filtros.categoria) params.append('categoria', filtros.categoria)
      const res = await api.get(`/admin/cargos/lotes?${params}`)
      setLotes(res || [])
    } catch (err) {
      setError(err.message || 'Error al buscar lotes')
    } finally {
      setBuscando(false)
    }
  }

  async function cargarDetalle(id) {
    setCargandoDetalle(true)
    setError(null)
    try {
      const res = await api.get(`/admin/cargos/lote/${id}`)
      setLoteId(id)
      setDetalle(res)
    } catch (err) {
      setError(err.message || 'Lote no encontrado')
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function handleEliminar() {
    setEliminando(true)
    setError(null)
    try {
      await api.delete(`/admin/cargos/lote/${loteId}`)
      setConfirmEliminar(false)
      await cargarDetalle(loteId)
      // Actualizar el lote en la lista si está visible
      if (lotes) {
        setLotes(prev => prev.map(l =>
          l.loteId === loteId ? { ...l, pendientes: 0 } : l
        ))
      }
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  const estadoColor = {
    PENDIENTE: 'bg-yellow-100 text-yellow-700',
    PAGADO: 'bg-green-100 text-green-700',
    ANULADO: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Buscar lotes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={e => setFiltros(p => ({ ...p, fechaDesde: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={e => setFiltros(p => ({ ...p, fechaHasta: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Concepto</label>
            <select
              value={filtros.conceptoTesoreriaId}
              onChange={e => setFiltros(p => ({ ...p, conceptoTesoreriaId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos</option>
              {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Categoría</label>
            <select
              value={filtros.categoria}
              onChange={e => setFiltros(p => ({ ...p, categoria: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas</option>
              {categoriasCargo.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={buscarLotes}
          disabled={buscando}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-60"
        >
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar lotes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Lista de lotes */}
      {lotes !== null && !loteId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {lotes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No se encontraron lotes con esos filtros</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Concepto</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-right px-4 py-3">Cargos</th>
                  <th className="text-right px-4 py-3">Pendientes</th>
                  <th className="text-right px-4 py-3">Importe total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lotes.map(l => (
                  <tr key={l.loteId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(l.fechaCreacion).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{l.concepto || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{l.categoria || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{l.totalCargos}</td>
                    <td className="px-4 py-3 text-right">
                      {l.pendientes > 0
                        ? <span className="text-yellow-700 font-medium">{l.pendientes}</span>
                        : <span className="text-green-600">{l.pendientes}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      ${l.importeTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => cargarDetalle(l.loteId)}
                        className="text-primary text-xs hover:underline whitespace-nowrap"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Detalle del lote */}
      {cargandoDetalle && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {loteId && detalle && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {lotes && (
                <button
                  onClick={() => { setLoteId(null); setDetalle(null) }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Volver
                </button>
              )}
              <div>
                <h2 className="font-semibold text-gray-800">Detalle del lote</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{loteId}</p>
              </div>
            </div>
            {detalle.resumen.pendientes > 0 && (
              <button
                onClick={() => setConfirmEliminar(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar pendientes
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{detalle.resumen.total}</p>
              <p className="text-xs text-gray-500">Total cargos</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{detalle.resumen.pendientes}</p>
              <p className="text-xs text-yellow-600">Pendientes</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{detalle.resumen.pagados}</p>
              <p className="text-xs text-green-600">Pagados</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-700">
                ${detalle.resumen.importePendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600">Saldo pendiente</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Socio</th>
                  <th className="text-left px-3 py-2">Concepto</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-left px-3 py-2">Vencimiento</th>
                  <th className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detalle.cargos.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-800">{c.socio?.apellidoNombre}</span>
                      <span className="text-gray-400 ml-1 text-xs">#{c.socio?.nroSocio}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{c.conceptoTesoreria?.nombre || c.descripcion}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">
                      ${Number(c.montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[c.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={confirmEliminar}
        onClose={() => setConfirmEliminar(false)}
        title="Eliminar cargos pendientes"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Se van a eliminar <strong>{detalle?.resumen.pendientes}</strong> cargo{detalle?.resumen.pendientes !== 1 ? 's' : ''} pendiente{detalle?.resumen.pendientes !== 1 ? 's' : ''} de este lote.
            Los cargos ya pagados no se tocan.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmEliminar(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CargosAdicionales() {
  const [tab, setTab] = useState('generar')
  const [loteGenerado, setLoteGenerado] = useState(null)

  const [conceptosDB, setConceptosDB] = useState([])
  const [actividades, setActividades] = useState([])
  const [categoriasActividad, setCategoriasActividad] = useState([])
  const [categoriasCargo, setCategoriasCargo] = useState([])
  const [estadosSocio, setEstadosSocio] = useState([])
  const [filtroActividadId, setFiltroActividadId] = useState('')

  useEffect(() => {
    api.getFull('/admin/conceptos-tesoreria?limit=200').then(r => setConceptosDB(r?.data || r || []))
    api.getFull('/admin/actividades?limit=100').then(r => setActividades(r?.data || r || []))
    api.get('/admin/categorias-cargo').then(r => setCategoriasCargo(r || [])).catch(() => {})
    api.get('/admin/estados-socio?activo=true').then(r => setEstadosSocio(r || []))
  }, [])

  useEffect(() => {
    if (filtroActividadId) {
      api.getFull(`/admin/categorias-actividad?actividadId=${filtroActividadId}&limit=100`)
        .then(r => setCategoriasActividad(r?.data || r || []))
    } else {
      setCategoriasActividad([])
    }
  }, [filtroActividadId])

  function handleLoteGenerado(loteId) {
    setLoteGenerado(loteId)
  }

  const tabs = [
    { id: 'generar', label: 'Generar', icon: Zap },
    { id: 'consultar', label: 'Consultar lote', icon: Package },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Zap className="w-7 h-7 text-primary" />
          Cargos Adicionales Masivos
        </h1>
        <p className="text-gray-600 mt-1">Generá seguros, carnets, inscripciones y otros cargos para un grupo de socios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.id === 'consultar' && loteGenerado && (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </button>
          )
        })}
      </div>

      {tab === 'generar' && (
        <TabGenerar
          conceptosDB={conceptosDB}
          actividades={actividades}
          categoriasActividad={categoriasActividad}
          categoriasCargo={categoriasCargo}
          estadosSocio={estadosSocio}
          onLoteGenerado={handleLoteGenerado}
        />
      )}

      {tab === 'consultar' && (
        <TabConsultar
          loteInicial={loteGenerado}
          conceptos={conceptosDB}
          categoriasCargo={categoriasCargo}
        />
      )}
    </div>
  )
}
