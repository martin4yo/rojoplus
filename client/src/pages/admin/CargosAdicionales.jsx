import { useState, useEffect } from 'react'
import { Plus, Trash2, Search, Zap, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import ConceptoTesoreriaModal from '../../components/ConceptoTesoreriaModal'
import api from '../../services/api'

const ESTADOS_SOCIO = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'SUSPENDIDO', label: 'Suspendido' },
  { value: 'DEUDOR', label: 'Deudor' },
]

const CATEGORIAS_CARGO = [
  { value: 'CUOTA_ACTIVIDAD', label: 'Cuota Actividad' },
  { value: 'CUOTA_SOCIAL', label: 'Cuota Social' },
  { value: 'CARNET', label: 'Carnet' },
  { value: 'MOROSIDAD', label: 'Morosidad' },
]

function ConceptoRow({ row, index, conceptos, onChange, onRemove, onNuevoConcepto }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end border border-gray-200 rounded-lg p-3 bg-gray-50">
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
          {CATEGORIAS_CARGO.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
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
  )
}

export default function CargosAdicionales() {
  const [conceptosDB, setConceptosDB] = useState([])
  const [actividades, setActividades] = useState([])
  const [categoriasActividad, setCategoriasActividad] = useState([])

  // Filas de conceptos a generar
  const [filas, setFilas] = useState([
    { conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '' }
  ])

  // Filtros
  const [filtros, setFiltros] = useState({
    estado: ['ACTIVO'],
    actividadId: '',
    categoriaActividadId: '',
  })

  // Preview
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Generación
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  // Modal nuevo concepto
  const [showNuevoConcepto, setShowNuevoConcepto] = useState(false)

  useEffect(() => {
    api.getFull('/admin/conceptos-tesoreria?limit=200').then(r => setConceptosDB(r?.data || r || []))
    api.getFull('/admin/actividades?limit=100').then(r => setActividades(r?.data || r || []))
  }, [])

  // Cuando cambia actividad filtro, cargar sus categorías
  useEffect(() => {
    if (filtros.actividadId) {
      api.getFull(`/admin/categorias-actividad?actividadId=${filtros.actividadId}&limit=100`)
        .then(r => setCategoriasActividad(r?.data || r || []))
    } else {
      setCategoriasActividad([])
      setFiltros(prev => ({ ...prev, categoriaActividadId: '' }))
    }
  }, [filtros.actividadId])

  function cambiarFila(index, campo, valor) {
    setFilas(prev => prev.map((f, i) => i === index ? { ...f, [campo]: valor } : f))
  }

  function agregarFila() {
    setFilas(prev => [...prev, { conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '' }])
  }

  function eliminarFila(index) {
    if (filas.length === 1) return
    setFilas(prev => prev.filter((_, i) => i !== index))
  }

  function handleConceptoCreado(nuevo) {
    setConceptosDB(prev => [...prev, nuevo])
    setShowNuevoConcepto(false)
    // Asignar al último row vacío
    setFilas(prev => {
      const idx = prev.findIndex(f => !f.conceptoTesoreriaId)
      if (idx >= 0) {
        return prev.map((f, i) => i === idx ? { ...f, conceptoTesoreriaId: String(nuevo.id) } : f)
      }
      return prev
    })
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

  function buildFiltros() {
    const f = {}
    if (filtros.estado.length > 0) f.estado = filtros.estado
    if (filtros.actividadId) f.actividadId = filtros.actividadId
    if (filtros.categoriaActividadId) f.categoriaActividadId = filtros.categoriaActividadId
    return f
  }

  function validarFilas() {
    for (const f of filas) {
      if (!f.conceptoTesoreriaId || !f.montoOriginal || !f.fechaVencimiento) return false
    }
    return true
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
          fechaVencimiento: f.fechaVencimiento
        })),
        filtros: buildFiltros()
      })
      setResultado(res?.data || res)
      setPreview(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(false)
    }
  }

  function resetear() {
    setFilas([{ conceptoTesoreriaId: '', categoria: 'CUOTA_ACTIVIDAD', montoOriginal: '', fechaVencimiento: '' }])
    setFiltros({ estado: ['ACTIVO'], actividadId: '', categoriaActividadId: '' })
    setPreview(null)
    setResultado(null)
    setError(null)
  }

  function toggleEstado(est) {
    setFiltros(prev => ({
      ...prev,
      estado: prev.estado.includes(est)
        ? prev.estado.filter(e => e !== est)
        : [...prev.estado, est]
    }))
  }

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

      {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />}

      {resultado && (
        <Alert
          type="success"
          message={`Se generaron ${resultado.creados} cargos para ${resultado.totalSocios} socios${resultado.errores?.length > 0 ? ` (${resultado.errores.length} errores)` : ''}`}
          className="mb-4"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Conceptos + Filtros */}
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
                  conceptos={conceptosDB}
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

            {/* Estado */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado del socio</label>
              <div className="flex flex-wrap gap-2">
                {ESTADOS_SOCIO.map(est => (
                  <button
                    key={est.value}
                    onClick={() => toggleEstado(est.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      filtros.estado.includes(est.value)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {est.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actividad */}
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

        {/* Columna derecha: Preview y acción */}
        <div className="space-y-4">
          {/* Vista previa */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Vista previa</h2>

            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingPreview
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
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

          {/* Resumen y generación */}
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

          {resultado && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Completado</span>
              </div>
              <p className="text-sm text-green-700 mb-3">
                Se crearon <strong>{resultado.creados}</strong> cargos para <strong>{resultado.totalSocios}</strong> socios.
              </p>
              {resultado.errores?.length > 0 && (
                <p className="text-xs text-amber-600">{resultado.errores.length} registro(s) con error</p>
              )}
              <button
                onClick={resetear}
                className="text-sm text-green-700 hover:underline mt-2"
              >
                Generar otra tanda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo concepto */}
      <ConceptoTesoreriaModal
        isOpen={showNuevoConcepto}
        onClose={() => setShowNuevoConcepto(false)}
        onCreated={handleConceptoCreado}
      />
    </div>
  )
}
