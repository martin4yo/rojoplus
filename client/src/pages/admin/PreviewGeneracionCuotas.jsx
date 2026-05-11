import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Filter, Play, X } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import LoadingSpinner from '../../components/LoadingSpinner'
import api from '../../services/api'
import { formatCurrency } from '../../utils/formatters'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function PreviewGeneracionCuotas() {
  const { id } = useParams()
  const periodoId = parseInt(id)
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()

  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  // Filtros UI
  const [filtroSocio, setFiltroSocio] = useState('')
  const [filtroTipoSocio, setFiltroTipoSocio] = useState('')
  const [filtroCategoriaSocio, setFiltroCategoriaSocio] = useState('')
  const [filtroActividad, setFiltroActividad] = useState('')
  const [filtroCategoriaActividad, setFiltroCategoriaActividad] = useState('')
  const [filtroConcepto, setFiltroConcepto] = useState('') // CUOTA_SOCIAL | CUOTA_ACTIVIDAD | ''

  // Selección
  const [seleccionados, setSeleccionados] = useState(new Set()) // Set<clave>

  useEffect(() => {
    cargarPreview()
  }, [periodoId])

  async function cargarPreview() {
    setLoading(true)
    setError(null)
    try {
      // Pedimos sin filtros — filtramos en cliente para feedback instantáneo
      const result = await api.post(`/admin/periodos/${periodoId}/preview`, {})
      setData(result)
      // Por defecto: todos los nuevos seleccionados (los ya generados no se pueden seleccionar)
      setSeleccionados(new Set(result.cargos.filter(c => !c.yaGenerado).map(c => c.clave)))
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Error al cargar la vista previa')
    } finally {
      setLoading(false)
    }
  }

  // Opciones de filtros derivadas de los cargos
  const opciones = useMemo(() => {
    if (!data?.cargos) return { tipos: [], categoriasSocio: [], actividades: [], categoriasActividad: [] }
    const tipos = new Map()
    const categoriasSocio = new Map()
    const actividades = new Map()
    const categoriasActividad = new Map()
    for (const c of data.cargos) {
      if (c.tipoSocioId) tipos.set(c.tipoSocioId, c.tipoSocioNombre)
      if (c.categoriaSocioId) categoriasSocio.set(c.categoriaSocioId, c.categoriaSocioNombre)
      if (c.actividadId) actividades.set(c.actividadId, c.actividadNombre)
      if (c.categoriaActividadId) categoriasActividad.set(c.categoriaActividadId, `${c.actividadNombre} – ${c.categoriaActividadNombre}`)
    }
    return {
      tipos: [...tipos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
      categoriasSocio: [...categoriasSocio].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
      actividades: [...actividades].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
      categoriasActividad: [...categoriasActividad].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    }
  }, [data])

  // Filtrado
  const cargosFiltrados = useMemo(() => {
    if (!data?.cargos) return []
    const q = filtroSocio.trim().toLowerCase()
    return data.cargos.filter(c => {
      if (q) {
        const enNombre = (c.socioNombre || '').toLowerCase().includes(q)
        const enNumero = String(c.socioNumero || '').includes(q)
        if (!enNombre && !enNumero) return false
      }
      if (filtroTipoSocio && String(c.tipoSocioId) !== filtroTipoSocio) return false
      if (filtroCategoriaSocio && String(c.categoriaSocioId) !== filtroCategoriaSocio) return false
      if (filtroActividad && String(c.actividadId) !== filtroActividad) return false
      if (filtroCategoriaActividad && String(c.categoriaActividadId) !== filtroCategoriaActividad) return false
      if (filtroConcepto && c.categoria !== filtroConcepto) return false
      return true
    })
  }, [data, filtroSocio, filtroTipoSocio, filtroCategoriaSocio, filtroActividad, filtroCategoriaActividad, filtroConcepto])

  // Totales del filtro
  const totalesFiltrados = useMemo(() => {
    const visiblesNuevos = cargosFiltrados.filter(c => !c.yaGenerado)
    const visiblesYaGen = cargosFiltrados.filter(c => c.yaGenerado)
    const seleccionEnFiltro = visiblesNuevos.filter(c => seleccionados.has(c.clave))
    const sociosUnicos = new Set(seleccionEnFiltro.map(c => c.socioId))
    return {
      visiblesCount: cargosFiltrados.length,
      visiblesNuevosCount: visiblesNuevos.length,
      visiblesYaGenCount: visiblesYaGen.length,
      seleccionadosCount: seleccionEnFiltro.length,
      sociosCount: sociosUnicos.size,
      montoTotal: seleccionEnFiltro.reduce((s, c) => s + Number(c.montoTotal), 0),
    }
  }, [cargosFiltrados, seleccionados])

  function toggleCargo(clave, yaGenerado) {
    if (yaGenerado) return
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(clave)) next.delete(clave)
      else next.add(clave)
      return next
    })
  }

  function toggleTodosVisibles(checked) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      for (const c of cargosFiltrados) {
        if (c.yaGenerado) continue
        if (checked) next.add(c.clave)
        else next.delete(c.clave)
      }
      return next
    })
  }

  function limpiarFiltros() {
    setFiltroSocio('')
    setFiltroTipoSocio('')
    setFiltroCategoriaSocio('')
    setFiltroActividad('')
    setFiltroCategoriaActividad('')
    setFiltroConcepto('')
  }

  function confirmarGenerar() {
    const claves = [...seleccionados]
    if (claves.length === 0) {
      setError('No hay cuotas seleccionadas para generar.')
      return
    }
    showModal({
      type: 'warning',
      title: 'Confirmar generación',
      message: `Vas a generar ${claves.length} cuota(s) seleccionada(s). Esta acción no se puede deshacer.`,
      confirmText: 'Generar',
      cancelText: 'Cancelar',
      onConfirm: () => generar(claves),
    })
  }

  async function generar(claves) {
    setGenerando(true)
    setError(null)
    try {
      const result = await api.post(`/admin/periodos/${periodoId}/generar`, { claves })
      navigate('/admin/periodos', { state: { success: result.mensaje || `Se generaron ${result.cuotasGeneradas} cuotas` } })
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Error al generar')
    } finally {
      setGenerando(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const periodo = data?.periodo
  const visiblesSeleccionables = cargosFiltrados.filter(c => !c.yaGenerado)
  const todosVisiblesSeleccionados = visiblesSeleccionables.length > 0 && visiblesSeleccionables.every(c => seleccionados.has(c.clave))
  const algunoSeleccionado = visiblesSeleccionables.some(c => seleccionados.has(c.clave))

  return (
    <div className="space-y-4">
      <ModalComponent />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/periodos')}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vista previa de generación</h1>
            <p className="text-gray-500 text-sm">
              Período {periodo ? `${MESES[periodo.mes - 1]} ${periodo.anio}` : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={confirmarGenerar}
          loading={generando}
          disabled={generando || seleccionados.size === 0}
          className="flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          Aprobar y generar ({seleccionados.size})
        </Button>
      </div>

      {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Resumen / KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="A generar"
          value={data?.totales.cargosCount ?? 0}
          sub={data?.totales.yaGeneradosCount ? `+ ${data.totales.yaGeneradosCount} ya generadas` : `${data?.totales.sociosCount ?? 0} socios`}
        />
        <Kpi
          label="Filtrados"
          value={totalesFiltrados.visiblesCount}
          sub={`${totalesFiltrados.seleccionadosCount} seleccionados${totalesFiltrados.visiblesYaGenCount ? ` · ${totalesFiltrados.visiblesYaGenCount} ya gen.` : ''}`}
        />
        <Kpi label="Socios afectados" value={totalesFiltrados.sociosCount} />
        <Kpi label="Monto seleccionado" value={formatCurrency(totalesFiltrados.montoTotal)} highlight />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filtros</span>
          </div>
          {(filtroSocio || filtroTipoSocio || filtroCategoriaSocio || filtroActividad || filtroCategoriaActividad || filtroConcepto) && (
            <button onClick={limpiarFiltros} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filtroSocio}
              onChange={(e) => setFiltroSocio(e.target.value)}
              placeholder="Buscar socio (nombre o nº)"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <Select label="Concepto" value={filtroConcepto} onChange={setFiltroConcepto} options={[
            { value: '', label: 'Todos' },
            { value: 'CUOTA_SOCIAL', label: 'Cuota Social' },
            { value: 'CUOTA_ACTIVIDAD', label: 'Cuota Actividad' },
          ]} />

          <Select label="Tipo de socio" value={filtroTipoSocio} onChange={setFiltroTipoSocio} options={[
            { value: '', label: 'Todos' },
            ...opciones.tipos.map(t => ({ value: String(t.id), label: t.nombre || `#${t.id}` })),
          ]} />

          <Select label="Categoría de socio" value={filtroCategoriaSocio} onChange={setFiltroCategoriaSocio} options={[
            { value: '', label: 'Todas' },
            ...opciones.categoriasSocio.map(c => ({ value: String(c.id), label: c.nombre || `#${c.id}` })),
          ]} />

          <Select label="Actividad" value={filtroActividad} onChange={(v) => { setFiltroActividad(v); setFiltroCategoriaActividad('') }} options={[
            { value: '', label: 'Todas' },
            ...opciones.actividades.map(a => ({ value: String(a.id), label: a.nombre || `#${a.id}` })),
          ]} />

          <Select label="Categoría de actividad" value={filtroCategoriaActividad} onChange={setFiltroCategoriaActividad} options={[
            { value: '', label: 'Todas' },
            ...opciones.categoriasActividad
              .filter(c => !filtroActividad || data.cargos.some(d => d.categoriaActividadId === c.id && String(d.actividadId) === filtroActividad))
              .map(c => ({ value: String(c.id), label: c.nombre || `#${c.id}` })),
          ]} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={todosVisiblesSeleccionados}
                    ref={el => { if (el) el.indeterminate = !todosVisiblesSeleccionados && algunoSeleccionado }}
                    onChange={(e) => toggleTodosVisibles(e.target.checked)}
                  />
                </th>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Socio</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-right">Bonif</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {cargosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    No hay cuotas que coincidan con los filtros
                  </td>
                </tr>
              ) : cargosFiltrados.map(c => {
                const seleccionado = !c.yaGenerado && seleccionados.has(c.clave)
                const rowClass = c.yaGenerado
                  ? 'bg-amber-50/40 text-gray-500'
                  : seleccionado ? '' : 'bg-gray-50/60 text-gray-400'
                return (
                  <tr key={c.clave} className={`border-t border-gray-100 ${rowClass}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        disabled={c.yaGenerado}
                        title={c.yaGenerado ? 'Ya generada' : ''}
                        onChange={() => toggleCargo(c.clave, c.yaGenerado)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{c.socioNumero ?? '—'}</td>
                    <td className="px-3 py-2">{c.socioNombre}</td>
                    <td className="px-3 py-2">{c.tipoSocioNombre || '—'}</td>
                    <td className="px-3 py-2">{c.categoriaSocioNombre || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.categoria === 'CUOTA_SOCIAL'
                          ? <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">Cuota Social</span>
                          : <span>
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs mr-2">Actividad</span>
                              {c.actividadNombre} – {c.categoriaActividadNombre}
                            </span>}
                        {c.yaGenerado && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium" title={c.cargoExistenteEstado ? `Estado: ${c.cargoExistenteEstado}` : ''}>
                            Ya generada{c.cargoExistenteEstado === 'PAGADO' ? ' · pagada' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(c.montoOriginal)}</td>
                    <td className="px-3 py-2 text-right">{c.montoBonificacion > 0 ? `-${formatCurrency(c.montoBonificacion)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.montoTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advertencias */}
      {data?.advertencias && (
        <div className="text-xs text-gray-500 space-y-1">
          {data.advertencias.sociosSaltadosYaConCuota > 0 && <div>• {data.advertencias.sociosSaltadosYaConCuota} socio(s) ya tenían cuota social en este período (omitidos).</div>}
          {data.advertencias.inscripcionesSaltadasYaConCargo > 0 && <div>• {data.advertencias.inscripcionesSaltadasYaConCargo} inscripción(es) ya tenían cuota de actividad (omitidas).</div>}
          {data.advertencias.sociosNoTitulares > 0 && <div>• {data.advertencias.sociosNoTitulares} socio(s) son miembros de familia (no titulares) — no se les genera cuota social.</div>}
          {data.advertencias.sociosSinCuotaMensual > 0 && <div>• {data.advertencias.sociosSinCuotaMensual} socio(s) tienen tipo sin cuota mensual configurada.</div>}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-white border-gray-200'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-primary' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
