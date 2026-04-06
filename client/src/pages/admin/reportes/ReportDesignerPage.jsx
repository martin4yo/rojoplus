import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Editor from '@monaco-editor/react'
import { ArrowLeft, Save, Plus, Trash2, Play, Eye, Code, Database, Settings, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import reportTemplatesApi, { CATEGORY_LABELS } from '../../../services/reportTemplatesApi'

const PARAM_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Booleano' },
  { value: 'select', label: 'Selección' },
]

const PAGE_FORMATS = ['A4', 'A3', 'Letter', 'Legal']

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
  h1 { font-size: 18px; margin: 0 0 5px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { border: 1px solid #ddd; padding: 6px 8px; }
  tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 20px; color: #666; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    {{#if tenant.logoUrl}}<img src="{{tenant.logoUrl}}" style="height:50px"><br>{{/if}}
    <h1>{{tenant.nombre}}</h1>
  </div>

  <table>
    <thead>
      <tr>
        <!-- definí las columnas acá -->
      </tr>
    </thead>
    <tbody>
      {{#each rows}}
      <tr>
        <!-- celdas acá -->
      </tr>
      {{/each}}
    </tbody>
  </table>

  <p class="footer">Total: {{count rows}} registros</p>
</body>
</html>`

const TABS = [
  { id: 'query', label: 'Consulta', icon: Database },
  { id: 'params', label: 'Parámetros', icon: Settings },
  { id: 'html', label: 'Diseño HTML', icon: Code },
  { id: 'preview', label: 'Vista Previa', icon: Eye },
]

export default function ReportDesignerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id

  const [tab, setTab] = useState('query')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [queryKey, setQueryKey] = useState('')
  const [customScript, setCustomScript] = useState('')
  const [parameters, setParameters] = useState([])
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_HTML)
  const [pageSetup, setPageSetup] = useState({ format: 'A4', orientation: 'portrait' })
  const [isPublic, setIsPublic] = useState(false)

  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [testParams, setTestParams] = useState({})
  const [testData, setTestData] = useState(null)
  const [testDataLoading, setTestDataLoading] = useState(false)
  const [testDataError, setTestDataError] = useState('')

  const { data: template, isLoading } = useQuery({
    queryKey: ['report-template', id],
    queryFn: () => reportTemplatesApi.getById(id),
    enabled: !!id,
  })

  const { data: queryDefinitions = [] } = useQuery({
    queryKey: ['report-query-definitions'],
    queryFn: () => reportTemplatesApi.getQueryDefinitions(),
  })

  useEffect(() => {
    if (template) {
      setName(template.name || '')
      setDescription(template.description || '')
      setCategory(template.category || 'general')
      setQueryKey(template.queryKey || '')
      setCustomScript(template.customScript || '')
      setParameters(template.parameters || [])
      setHtmlTemplate(template.htmlTemplate || DEFAULT_HTML)
      setPageSetup(template.pageSetup || { format: 'A4', orientation: 'portrait' })
      setIsPublic(template.isPublic || false)
    }
  }, [template])

  const handleQueryKeyChange = async (key) => {
    setQueryKey(key)
    if (key) {
      try {
        const html = await reportTemplatesApi.getDefaultTemplate(key)
        if (html) setHtmlTemplate(html)
      } catch {}
      // Pre-populate parameters from defaultParams if none defined yet
      const def = queryDefinitions.find(q => q.key === key)
      if (def?.defaultParams?.length && parameters.length === 0) {
        setParameters(def.defaultParams)
      }
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { name, description, category, queryKey, customScript, parameters, htmlTemplate, pageSetup, isPublic }
      return isNew ? reportTemplatesApi.create(data) : reportTemplatesApi.update(id, data)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] })
      toast.success('Reporte guardado')
      if (isNew && saved?.id) {
        navigate(`/admin/reportes/designer/${saved.id}/editar`, { replace: true })
      }
    },
    onError: (err) => toast.error('Error al guardar: ' + err.message),
  })

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    try {
      const paramValues = {}
      for (const p of parameters) {
        paramValues[p.name] = testParams[p.name] ?? p.defaultValue ?? ''
      }
      const html = await reportTemplatesApi.preview({ queryKey, customScript, htmlTemplate, pageSetup, parameters: paramValues })
      const blob = new Blob([html], { type: 'text/html' })
      setPreviewUrl(URL.createObjectURL(blob))
      setTab('preview')
    } catch (err) {
      setPreviewError(err.message || 'Error al generar preview')
      setTab('preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleLoadTestData = async () => {
    if (!queryKey) return
    setTestDataLoading(true)
    setTestDataError('')
    try {
      const data = await reportTemplatesApi.previewData(queryKey, testParams)
      setTestData(data)
    } catch (err) {
      setTestDataError(err.message || 'Error al cargar datos')
    } finally {
      setTestDataLoading(false)
    }
  }

  const addParam = () => {
    setParameters(prev => [...prev, { name: '', label: '', type: 'text', required: false, visible: true, defaultValue: '' }])
  }

  const updateParam = (i, field, value) => {
    setParameters(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const removeParam = (i) => {
    setParameters(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!isNew && isLoading) return <div className="p-8 text-center text-gray-500">Cargando...</div>

  return (
    <div className="flex h-screen flex-col -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button onClick={() => navigate('/admin/reportes/designer')}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">{isNew ? 'Nuevo Reporte' : (name || 'Editar Reporte')}</h1>
        </div>
        {!isNew && (
          <button onClick={() => navigate(`/admin/reportes/designer/${id}/ejecutar`)}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50">
            <Play className="h-3.5 w-3.5" /> Ejecutar
          </button>
        )}
        <button onClick={handlePreview} disabled={previewLoading}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50">
          {previewLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Preview
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!name.trim() || saveMutation.isPending}
          className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: metadata */}
        <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre del reporte" autoFocus
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Descripción opcional" rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Formato</label>
              <select value={pageSetup.format} onChange={e => setPageSetup(p => ({ ...p, format: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {PAGE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Orientación</label>
              <select value={pageSetup.orientation} onChange={e => setPageSetup(p => ({ ...p, orientation: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                className="rounded border-gray-300" />
              <span className="text-xs font-medium text-gray-700">Reporte público (global)</span>
            </label>
          </div>
        </div>

        {/* Main area: tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-gray-200 bg-white px-4 flex flex-shrink-0">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">

            {/* Consulta tab */}
            {tab === 'query' && (
              <div className="h-full overflow-auto p-5 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Fuente de Datos</label>
                  <select value={queryKey} onChange={e => handleQueryKeyChange(e.target.value)}
                    className="w-full max-w-lg border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Sin consulta predefinida (usar script personalizado)</option>
                    {queryDefinitions.map(q => (
                      <option key={q.key} value={q.key}>{q.label}</option>
                    ))}
                  </select>
                  {queryKey && (
                    <p className="mt-1 text-xs text-gray-400">
                      {queryDefinitions.find(q => q.key === queryKey)?.description}
                    </p>
                  )}
                </div>

                {!queryKey && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Script personalizado</label>
                    <div className="h-52 border border-gray-300 rounded-md overflow-hidden">
                      <Editor
                        language="javascript"
                        value={customScript}
                        onChange={v => setCustomScript(v || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          lineNumbers: 'on',
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Función async. Parámetros disponibles: <code className="bg-gray-100 px-1 rounded">db</code>, <code className="bg-gray-100 px-1 rounded">tenantId</code>, <code className="bg-gray-100 px-1 rounded">params</code>. Retorná un objeto con los datos.
                    </p>
                  </div>
                )}

                {/* Test data */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Datos de prueba</h3>
                    <button onClick={handleLoadTestData} disabled={!queryKey || testDataLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                      {testDataLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Cargar datos
                    </button>
                  </div>

                  {parameters.filter(p => p.visible !== false && p.name).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {parameters.filter(p => p.visible !== false && p.name).map(p => (
                        <div key={p.name}>
                          <label className="block text-xs text-gray-500 mb-0.5">{p.label || p.name}</label>
                          <input
                            type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'}
                            value={testParams[p.name] || ''}
                            onChange={e => setTestParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {testDataError && <p className="text-xs text-red-600 mb-2">{testDataError}</p>}
                  {testData ? (
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-72 font-mono">
                      {JSON.stringify(testData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {queryKey ? 'Completá los parámetros y hacé clic en "Cargar datos".' : 'Seleccioná una fuente de datos para probarla.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Parámetros tab */}
            {tab === 'params' && (
              <div className="h-full overflow-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Parámetros del Reporte</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Definí los valores que el usuario ingresará al ejecutar.</p>
                  </div>
                  <button onClick={addParam}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90">
                    <Plus className="h-3.5 w-3.5" /> Agregar
                  </button>
                </div>

                {parameters.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Settings className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Sin parámetros. Los datos se cargarán automáticamente al ejecutar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {parameters.map((p, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre (clave)</label>
                            <input type="text" value={p.name} onChange={e => updateParam(i, 'name', e.target.value)}
                              placeholder="ej: fechaDesde"
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Etiqueta</label>
                            <input type="text" value={p.label} onChange={e => updateParam(i, 'label', e.target.value)}
                              placeholder="ej: Fecha desde"
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                            <select value={p.type} onChange={e => updateParam(i, 'type', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                              {PARAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Valor por defecto</label>
                            <input type="text" value={p.defaultValue || ''} onChange={e => updateParam(i, 'defaultValue', e.target.value)}
                              placeholder="Opcional"
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                        </div>
                        {p.type === 'select' && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Opciones <span className="font-normal text-gray-400">(JSON: [{'{'}value,label{'}'}])</span>
                            </label>
                            <input type="text"
                              value={typeof p.options === 'string' ? p.options : JSON.stringify(p.options || [])}
                              onChange={e => {
                                try { updateParam(i, 'options', JSON.parse(e.target.value)) }
                                catch { updateParam(i, 'options', e.target.value) }
                              }}
                              placeholder='[{"value":"1","label":"Opción 1"}]'
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={p.required || false}
                              onChange={e => updateParam(i, 'required', e.target.checked)} className="rounded" />
                            Obligatorio
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={p.visible !== false}
                              onChange={e => updateParam(i, 'visible', e.target.checked)} className="rounded" />
                            Visible al ejecutar
                          </label>
                          <button onClick={() => removeParam(i)} className="ml-auto p-1 text-red-500 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* HTML tab */}
            {tab === 'html' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
                  <p className="text-xs text-gray-400">
                    HTML + Handlebars:{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{#each rows}}'}</code>{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{formatCurrency val}}'}</code>{' '}
                    <code className="bg-gray-100 px-1 rounded">{'{{formatDate fecha}}'}</code>
                  </p>
                  <div className="flex items-center gap-2">
                    {queryKey && (
                      <button
                        onClick={async () => {
                          try {
                            const html = await reportTemplatesApi.getDefaultTemplate(queryKey)
                            if (html) setHtmlTemplate(html)
                          } catch {}
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-gray-50"
                        title="Reemplaza el HTML con el template por defecto de la consulta"
                      >
                        <RefreshCw className="h-3 w-3" /> Restablecer
                      </button>
                    )}
                    <button onClick={handlePreview} disabled={previewLoading}
                      className="flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">
                      {previewLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                      Preview
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <Editor
                    language="html"
                    value={htmlTemplate}
                    onChange={v => setHtmlTemplate(v || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      wordWrap: 'off',
                      lineNumbers: 'on',
                      tabSize: 2,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Preview tab */}
            {tab === 'preview' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
                  <button onClick={handlePreview} disabled={previewLoading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                    {previewLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {previewLoading ? 'Generando...' : 'Generar preview'}
                  </button>
                  {previewError && <p className="text-xs text-red-600">{previewError}</p>}
                </div>
                <div className="flex-1 bg-gray-200 overflow-hidden">
                  {previewUrl ? (
                    <iframe src={previewUrl} className="w-full h-full border-0" title="Preview PDF" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Hacé clic en "Generar preview" para ver el reporte</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
