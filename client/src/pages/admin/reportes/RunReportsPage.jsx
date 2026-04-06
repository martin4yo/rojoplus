import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Play, Search, BarChart3, Globe, Plus, Pencil, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import reportTemplatesApi, { CATEGORY_LABELS } from '../../../services/reportTemplatesApi'
import reportPresetsApi from '../../../services/reportPresetsApi'
import PresetModal from './PresetModal'
import { resolvePresetParams } from '../../../utils/reportTokens'

const CATEGORY_COLORS = {
  socios: 'bg-blue-100 text-blue-700',
  finanzas: 'bg-green-100 text-green-700',
  actividades: 'bg-orange-100 text-orange-700',
  deportes: 'bg-purple-100 text-purple-700',
  general: 'bg-gray-100 text-gray-700',
}

export default function RunReportsPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [presetModal, setPresetModal] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [t, p] = await Promise.all([reportTemplatesApi.getAll(), reportPresetsApi.getAll()])
      setTemplates(Array.isArray(t) ? t : [])
      setPresets(Array.isArray(p) ? p : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleCollapsed = (cat) => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))

  const categories = [...new Set(templates.map(t => t.category || 'general'))]

  const filteredTemplates = templates.filter(t => {
    const q = search.toLowerCase()
    return (
      (!search || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) &&
      (!filterCategory || t.category === filterCategory)
    )
  })

  const filteredPresets = presets.filter(p => {
    const q = search.toLowerCase()
    const cat = p.template?.category || 'general'
    return (
      (!search || p.name.toLowerCase().includes(q) || p.template?.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) &&
      (!filterCategory || cat === filterCategory)
    )
  })

  const grouped = {}
  for (const t of filteredTemplates) {
    const cat = t.category || 'general'
    if (!grouped[cat]) grouped[cat] = { templates: [], presets: [] }
    grouped[cat].templates.push(t)
  }
  for (const p of filteredPresets) {
    const cat = p.template?.category || 'general'
    if (!grouped[cat]) grouped[cat] = { templates: [], presets: [] }
    grouped[cat].presets.push(p)
  }

  const runPreset = (preset) => {
    const resolved = resolvePresetParams(preset.params || {})
    navigate(`/admin/reportes/designer/${preset.templateId}/ejecutar`, { state: { presetParams: resolved } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ejecutar Reportes</h1>
          <p className="text-sm text-gray-500">Seleccioná un reporte para ejecutar</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" placeholder="Buscar reportes..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="w-48 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm text-center py-16">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {search || filterCategory ? 'Sin resultados.' : 'No hay reportes disponibles.'}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, { templates: catTemplates, presets: catPresets }]) => {
          const isCollapsed = collapsed[category] ?? false
          const total = catTemplates.length + catPresets.length
          return (
            <div key={category}>
              <button
                onClick={() => toggleCollapsed(category)}
                className="flex items-center gap-2 w-full text-left mb-3 group"
              >
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />
                  : <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />
                }
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-700">
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-xs text-gray-400">({total})</span>
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Preset cards */}
                  {catPresets.map(preset => (
                    <div key={`preset-${preset.id}`}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
                      <div className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-amber-50 flex-shrink-0">
                              <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm leading-tight">{preset.name}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">{preset.template?.name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setPresetModal({ templateId: preset.templateId, templateName: preset.template?.name, parameters: preset.template?.parameters || [], preset })}
                            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {preset.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">{preset.description}</p>}
                        <button
                          onClick={() => runPreset(preset)}
                          className="w-full mt-auto flex items-center justify-center gap-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-medium transition"
                        >
                          <Play className="h-3.5 w-3.5" /> Ejecutar
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Template cards */}
                  {catTemplates.map(template => (
                    <div key={`tpl-${template.id}`}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${template.isPublic ? 'bg-green-50' : 'bg-blue-50'}`}>
                              <FileText className={`h-5 w-5 ${template.isPublic ? 'text-green-600' : 'text-blue-600'}`} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm leading-tight">{template.name}</h3>
                              {template.isPublic && (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium mt-0.5">
                                  <Globe className="h-3 w-3" /> Global
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${CATEGORY_COLORS[template.category || 'general'] || CATEGORY_COLORS.general}`}>
                            {CATEGORY_LABELS[template.category || 'general'] || template.category}
                          </span>
                        </div>
                        {template.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">{template.description}</p>}
                        <div className="flex gap-2 mt-auto">
                          <button
                            onClick={() => navigate(`/admin/reportes/designer/${template.id}/ejecutar`)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 transition"
                          >
                            <Play className="h-3.5 w-3.5" /> Ejecutar
                          </button>
                          <button
                            onClick={() => setPresetModal({ templateId: template.id, templateName: template.name, parameters: template.parameters || [] })}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:border-amber-400 hover:text-amber-600 transition"
                          >
                            <Plus className="h-3.5 w-3.5" /> Acceso rápido
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {presetModal && (
        <PresetModal
          templateId={presetModal.templateId}
          templateName={presetModal.templateName}
          parameters={presetModal.parameters}
          preset={presetModal.preset}
          onClose={() => setPresetModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
