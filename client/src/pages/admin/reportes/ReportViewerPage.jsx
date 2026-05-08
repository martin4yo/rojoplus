import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, Download, Edit, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import reportTemplatesApi from '../../../services/reportTemplatesApi'
import reportPresetsApi from '../../../services/reportPresetsApi'

export default function ReportViewerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const presetId = searchParams.get('preset')
  const presetParams = location.state?.presetParams

  const [params, setParams] = useState({})
  const [pdfUrl, setPdfUrl] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)

  const { data: template, isLoading } = useQuery({
    queryKey: ['report-template', id],
    queryFn: () => reportTemplatesApi.getById(id),
    enabled: !!id,
  })

  const { data: preset } = useQuery({
    queryKey: ['report-preset-single', presetId],
    queryFn: () => reportPresetsApi.getAll().then(list => list.find(p => p.id === presetId)),
    enabled: !!presetId,
  })

  // Init params: preset > state preset > parameter defaults > date heuristics
  useEffect(() => {
    if (!template?.parameters) return
    if (presetId && !preset) return
    const init = {}
    for (const p of (template.parameters || [])) {
      if (preset?.params[p.name] !== undefined) {
        init[p.name] = preset.params[p.name]
      } else if (presetParams && presetParams[p.name] !== undefined) {
        init[p.name] = presetParams[p.name]
      } else if (p.defaultValue) {
        init[p.name] = p.defaultValue
      } else if (p.type === 'date') {
        const now = new Date()
        if (p.name.toLowerCase().includes('from') || p.name.toLowerCase().includes('desde')) {
          init[p.name] = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        } else {
          init[p.name] = now.toISOString().split('T')[0]
        }
      } else {
        init[p.name] = ''
      }
    }
    setParams(init)
  }, [template, preset, presetId])

  // Cuando un param padre (referenciado por dependsOn de otro) cambia, limpiar selecciones
  // hijas que ya no son válidas para evitar resultados incorrectos en backend.
  useEffect(() => {
    if (!template?.parameters) return
    let next = null
    for (const child of template.parameters) {
      if (!child.dependsOn?.param || !child.dependsOn?.field) continue
      const parentRaw = (next || params)[child.dependsOn.param]
      const parentArr = Array.isArray(parentRaw)
        ? parentRaw
        : (typeof parentRaw === 'string' && parentRaw ? parentRaw.split(',').filter(Boolean) : [])
      if (parentArr.length === 0) continue // sin filtro padre, todo válido
      const childRaw = (next || params)[child.name]
      const childArr = Array.isArray(childRaw)
        ? childRaw
        : (typeof childRaw === 'string' && childRaw ? childRaw.split(',').filter(Boolean) : [])
      if (childArr.length === 0) continue
      const parentSet = new Set(parentArr.map(String))
      const validValues = new Set(
        (child.options || [])
          .filter(o => parentSet.has(String(o[child.dependsOn.field])))
          .map(o => String(o.value))
      )
      const cleaned = childArr.filter(v => validValues.has(String(v)))
      if (cleaned.length !== childArr.length) {
        next = { ...(next || params), [child.name]: cleaned }
      }
    }
    if (next) setParams(next)
  }, [params, template])

  const handleRun = async () => {
    setIsRunning(true)
    setError('')
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl('')
    try {
      const blob = await reportTemplatesApi.runReport(id, params)
      setPdfUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err.message || 'Error al generar reporte')
    } finally {
      setIsRunning(false)
    }
  }

  const handleDownload = () => {
    if (!pdfUrl || !template) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${template.name.replace(/\s+/g, '_')}.pdf`
    a.click()
  }

  const renderParamInput = (p) => {
    const rawValue = params[p.name]
    const value = rawValue == null ? '' : rawValue
    const onChange = (v) => setParams(prev => ({ ...prev, [p.name]: v }))

    if (p.type === 'multiselect' && p.options) {
      const selected = Array.isArray(value)
        ? value
        : (typeof value === 'string' && value ? value.split(',').filter(Boolean) : [])

      // Cascada: si el param tiene `dependsOn`, filtra opciones según el valor del param padre.
      // Formato esperado: { param: 'actividadIds', field: 'actividadId' }
      let visibleOptions = p.options
      if (p.dependsOn && p.dependsOn.param && p.dependsOn.field) {
        const parentRaw = params[p.dependsOn.param]
        const parentArr = Array.isArray(parentRaw)
          ? parentRaw
          : (typeof parentRaw === 'string' && parentRaw ? parentRaw.split(',').filter(Boolean) : [])
        if (parentArr.length > 0) {
          const parentSet = new Set(parentArr.map(String))
          visibleOptions = p.options.filter(o => parentSet.has(String(o[p.dependsOn.field])))
        }
      }

      const toggle = (val) => {
        const next = selected.includes(val)
          ? selected.filter(v => v !== val)
          : [...selected, val]
        onChange(next)
      }
      return (
        <div className="border border-gray-300 rounded-md p-2 max-h-48 overflow-y-auto bg-white">
          {visibleOptions.length === 0 && (
            <span className="text-xs text-gray-400">
              {p.dependsOn && p.options.length > 0
                ? `Elegí primero ${p.dependsOn.param} para ver opciones`
                : 'Sin opciones'}
            </span>
          )}
          {visibleOptions.map(o => (
            <label key={o.value} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
              <input
                type="checkbox"
                checked={selected.includes(String(o.value))}
                onChange={() => toggle(String(o.value))}
                className="rounded border-gray-300"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    }

    if (p.type === 'date') return (
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    )
    if (p.type === 'number') return (
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    )
    if (p.type === 'boolean') return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} className="rounded border-gray-300" />
        {p.label}
      </label>
    )
    if (p.type === 'select' && p.options) return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">Todos</option>
        {p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
    return (
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={p.label}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    )
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  if (!template) return <div className="p-8 text-center text-gray-500">Reporte no encontrado</div>

  const visibleParams = (template.parameters || []).filter(p => p.visible !== false)

  return (
    <div className="flex h-screen flex-col -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={() => navigate('/admin/reportes/designer')}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">{template.name}</h1>
          {template.description && <p className="text-xs text-gray-500">{template.description}</p>}
        </div>
        <button onClick={() => navigate(`/admin/reportes/designer/${id}/editar`)}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50">
          <Edit className="h-3.5 w-3.5" /> Editar diseño
        </button>
        {pdfUrl && (
          <button onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" /> Descargar PDF
          </button>
        )}
        <button onClick={handleRun} disabled={isRunning}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
          {isRunning
            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generando...</>
            : <><Play className="h-3.5 w-3.5" /> Generar PDF</>
          }
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: params panel */}
        <div className={`relative border-r border-gray-200 bg-gray-50 flex-shrink-0 flex flex-col transition-all duration-200 ${panelOpen ? 'w-64' : 'w-10'}`}>
          <button onClick={() => setPanelOpen(o => !o)}
            className="absolute -right-3 top-4 z-10 bg-white border border-gray-300 rounded-full p-0.5 shadow-sm hover:bg-gray-100">
            {panelOpen ? <ChevronLeft className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
          </button>

          {panelOpen && (
            <div className="p-4 overflow-y-auto flex-1 flex flex-col">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Parámetros</h2>
              {visibleParams.length === 0 ? (
                <p className="text-xs text-gray-400">Sin parámetros configurables</p>
              ) : (
                <div className="space-y-4">
                  {visibleParams.map(p => (
                    <div key={p.name}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {p.label}{p.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {renderParamInput(p)}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6">
                <button onClick={handleRun} disabled={isRunning}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {isRunning ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generando...</> : <><Play className="h-4 w-4" /> Generar PDF</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: PDF viewer */}
        <div className="flex-1 bg-gray-200 overflow-hidden">
          {error ? (
            <div className="m-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0" title="Reporte PDF" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <Play className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-sm">
                  {visibleParams.length > 0
                    ? 'Completá los parámetros y presioná "Generar PDF"'
                    : 'Presioná "Generar PDF" para ver el reporte'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
