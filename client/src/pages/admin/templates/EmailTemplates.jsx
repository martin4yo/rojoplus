import { useState, useEffect } from 'react'
import { Mail, Save, RefreshCw, Eye, Send, ChevronDown, ChevronUp, Loader, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'
import LoadingSpinner from '../../../components/LoadingSpinner'

const EVENT_TYPE_LABELS = {
  COMPROBANTE_PAGO: {
    label: 'Comprobante de Pago',
    category: 'Pagos',
    description: 'Se envía después de realizar un pago exitoso'
  },
  PAGO_CONFIRMADO: {
    label: 'Pago Manual Confirmado',
    category: 'Pagos',
    description: 'Se envía cuando el admin confirma un pago por transferencia'
  },
  PAGO_RECHAZADO: {
    label: 'Pago Manual Rechazado',
    category: 'Pagos',
    description: 'Se envía cuando el admin rechaza un pago informado'
  },
  RECORDATORIO_VENCIMIENTO: {
    label: 'Recordatorio de Vencimiento',
    category: 'Cuotas',
    description: 'Se envía 5 días antes del vencimiento de una cuota'
  },
  CUOTA_GENERADA: {
    label: 'Cuota Generada',
    category: 'Cuotas',
    description: 'Se envía cuando se genera una nueva cuota mensual'
  }
}

const CATEGORIES = ['Pagos', 'Cuotas']

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [editedTemplate, setEditedTemplate] = useState({})
  const [isSaving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState(CATEGORIES)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const data = await api.get('/admin/templates/email')
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template)
    setEditedTemplate({
      nombre: template.nombre,
      descripcion: template.descripcion,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText,
      isActive: template.isActive
    })
    setShowPreview(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return

    setSaving(true)
    try {
      const updated = await api.put(`/admin/templates/email/${selectedTemplate.id}`, editedTemplate)
      setTemplates(templates.map(t => t.id === updated.id ? updated : t))
      setSelectedTemplate(updated)
      toast.success('Template guardado correctamente')
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Error al guardar template')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!testEmail || !selectedTemplate) return

    setSendingTest(true)
    try {
      await api.post(`/admin/templates/email/${selectedTemplate.id}/test`, { email: testEmail })
      toast.success(`Email de prueba enviado a ${testEmail}`)
      setTestEmail('')
    } catch (error) {
      console.error('Error sending test:', error)
      toast.error('Error al enviar email de prueba')
    } finally {
      setSendingTest(false)
    }
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getTemplatesByCategory = (category) => {
    return templates.filter(t => {
      const config = EVENT_TYPE_LABELS[t.eventType]
      return config?.category === category
    })
  }

  const getEventConfig = (eventType) => {
    return EVENT_TYPE_LABELS[eventType] || {
      label: eventType,
      category: 'Otros',
      description: ''
    }
  }

  const parseVariables = (variablesStr) => {
    try {
      return JSON.parse(variablesStr || '[]')
    } catch {
      return []
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
            <p className="text-sm text-gray-500">Personaliza los emails que se envían automáticamente</p>
          </div>
        </div>
        <button
          onClick={fetchTemplates}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar - Lista de templates */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <LoadingSpinner />
              <p className="mt-4 text-gray-500">Cargando templates...</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {CATEGORIES.map(category => {
                const categoryTemplates = getTemplatesByCategory(category)
                const isExpanded = expandedCategories.includes(category)

                if (categoryTemplates.length === 0) return null

                return (
                  <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-900">{category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {categoryTemplates.length}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {categoryTemplates.map(template => {
                          const config = getEventConfig(template.eventType)
                          const isSelected = selectedTemplate?.id === template.id

                          return (
                            <button
                              key={template.id}
                              onClick={() => handleSelectTemplate(template)}
                              className={`w-full px-4 py-3 text-left border-b border-gray-50 last:border-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                  {config.label}
                                </span>
                                {!template.isActive && (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                    Inactivo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {template.subject}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Main content - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {selectedTemplate ? (
            <>
              {/* Template header */}
              <div className="p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {getEventConfig(selectedTemplate.eventType).label}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {getEventConfig(selectedTemplate.eventType).description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedTemplate.isActive ?? selectedTemplate.isActive}
                        onChange={(e) => setEditedTemplate({ ...editedTemplate, isActive: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Activo</span>
                    </label>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        showPreview
                          ? 'bg-blue-100 text-blue-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Editor' : 'Vista Previa'}
                    </button>
                    {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor / Preview */}
              <div className="flex-1 overflow-y-auto p-6">
                {showPreview ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <p className="text-sm text-gray-600">
                        <strong>Asunto:</strong> {editedTemplate.subject || selectedTemplate.subject}
                      </p>
                    </div>
                    <div
                      className="p-4"
                      dangerouslySetInnerHTML={{
                        __html: editedTemplate.bodyHtml || selectedTemplate.bodyHtml,
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Asunto del Email
                      </label>
                      <input
                        type="text"
                        value={editedTemplate.subject ?? selectedTemplate.subject}
                        onChange={(e) => setEditedTemplate({ ...editedTemplate, subject: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Asunto del email..."
                      />
                    </div>

                    {/* Body HTML */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contenido HTML
                      </label>
                      <textarea
                        value={editedTemplate.bodyHtml ?? selectedTemplate.bodyHtml}
                        onChange={(e) => setEditedTemplate({ ...editedTemplate, bodyHtml: e.target.value })}
                        rows={20}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="HTML del email..."
                      />
                    </div>

                    {/* Variables info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Variables Disponibles</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {parseVariables(selectedTemplate.variables).map(v => (
                          <code key={v} className="bg-blue-100 px-2 py-1 rounded">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>

                    {/* Test email */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Enviar Email de Prueba</h4>
                      <div className="flex gap-3">
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="email@ejemplo.com"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                          <button
                            onClick={handleSendTest}
                            disabled={sendingTest || !testEmail}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                          >
                            {sendingTest ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Enviar Prueba
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Selecciona un template para editarlo</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
