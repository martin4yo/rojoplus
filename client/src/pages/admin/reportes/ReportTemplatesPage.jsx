import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Play, Edit, Trash2, BarChart3, Clock, Search } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import reportTemplatesApi, { CATEGORY_LABELS } from '../../../services/reportTemplatesApi'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import { useConfirm } from '../../../hooks/useConfirm'

const CATEGORY_COLORS = {
  socios: 'bg-blue-100 text-blue-700',
  finanzas: 'bg-green-100 text-green-700',
  actividades: 'bg-orange-100 text-orange-700',
  deportes: 'bg-purple-100 text-purple-700',
  general: 'bg-gray-100 text-gray-700',
}

export default function ReportTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const puedeDisenar = tienePermiso(PERMISOS.REPORTES_DISENAR)
  const { confirm, ConfirmDialog } = useConfirm()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => reportTemplatesApi.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => reportTemplatesApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['report-templates'] }); toast.success('Reporte eliminado') },
    onError: (err) => toast.error('No se pudo eliminar: ' + err.message),
  })

  const handleDelete = async (t) => {
    const ok = await confirm(`¿Eliminar "${t.name}"?`, 'Esta acción no se puede deshacer.')
    if (ok) deleteMutation.mutate(t.id)
  }

  const categories = [...new Set(templates.map(t => t.category || 'general'))]

  const filtered = templates.filter(t => {
    const q = search.toLowerCase()
    return (
      (!search || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) &&
      (!filterCategory || t.category === filterCategory)
    )
  })

  const grouped = {}
  for (const t of filtered) {
    const cat = t.category || 'general'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(t)
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Diseñador de Reportes</h1>
            <p className="text-sm text-gray-500">Creá y gestioná reportes personalizados con PDF</p>
          </div>
        </div>
        {puedeDisenar && (
          <button
            onClick={() => navigate('/admin/reportes/designer/nuevo')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Nuevo Reporte
          </button>
        )}
      </div>

      {/* Filters */}
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

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm text-center py-16">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-900">Sin reportes</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search || filterCategory ? 'Sin resultados.' : 'Creá tu primer reporte personalizado.'}
          </p>
          {!search && !filterCategory && (
            <button
              onClick={() => navigate('/admin/reportes/designer/nuevo')}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
            >
              <Plus className="h-4 w-4" /> Nuevo Reporte
            </button>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(template => (
                <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <h3 className="font-medium text-gray-900 text-sm truncate">{template.name}</h3>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${CATEGORY_COLORS[template.category || 'general'] || CATEGORY_COLORS.general}`}>
                        {CATEGORY_LABELS[template.category || 'general'] || template.category}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2 flex-1">{template.description}</p>
                    )}

                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(template.updatedAt), 'd MMM yyyy', { locale: es })}</span>
                      {!!template._count?.executions && (
                        <span className="ml-2">· {template._count.executions} ejecuciones</span>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => navigate(`/admin/reportes/designer/${template.id}/ejecutar`)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 transition"
                      >
                        <Play className="h-3.5 w-3.5" /> Ejecutar
                      </button>
                      {puedeDisenar && (<>
                        <button
                          onClick={() => navigate(`/admin/reportes/designer/${template.id}/editar`)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 transition"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="px-3 py-1.5 border border-red-200 rounded-md text-xs text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
    <ConfirmDialog />
    </>
  )
}
