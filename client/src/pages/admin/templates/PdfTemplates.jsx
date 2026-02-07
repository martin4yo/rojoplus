import { useState, useEffect } from 'react'
import { FileText, Save, RefreshCw, Eye, Download, Loader, Code } from 'lucide-react'
import api from '../../../services/api'
import { tienePermiso, PERMISOS } from '../../../services/permisos'

const TIPO_LABELS = {
  RECIBO: {
    label: 'Recibo de Pago',
    description: 'Comprobante de pago estándar para socios'
  },
  FACTURA: {
    label: 'Factura',
    description: 'Factura para actividades comerciales (buffet, etc)'
  },
  COMPROBANTE_PAGO: {
    label: 'Comprobante de Pago',
    description: 'Comprobante detallado de pago de cuotas'
  }
}

export default function PdfTemplates() {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [editedTemplate, setEditedTemplate] = useState({})
  const [isSaving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [downloadingTest, setDownloadingTest] = useState(false)
  const [activeTab, setActiveTab] = useState('html') // html | css

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const data = await api.get('/admin/templates/pdf')
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
      htmlContent: template.htmlContent,
      cssContent: template.cssContent,
      pageFormat: template.pageFormat,
      orientation: template.orientation,
      isActive: template.isActive
    })
    setShowPreview(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return

    setSaving(true)
    try {
      const updated = await api.put(`/admin/templates/pdf/${selectedTemplate.id}`, editedTemplate)
      setTemplates(templates.map(t => t.id === updated.id ? updated : t))
      setSelectedTemplate(updated)
      alert('Template guardado correctamente')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Error al guardar template')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadTest = async () => {
    if (!selectedTemplate) return

    setDownloadingTest(true)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/templates/pdf/${selectedTemplate.id}/test`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (!response.ok) throw new Error('Error descargando PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prueba-${selectedTemplate.tipo.toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (error) {
      console.error('Error downloading test PDF:', error)
      alert('Error al descargar PDF de prueba')
    } finally {
      setDownloadingTest(false)
    }
  }

  const handlePreview = async () => {
    if (!selectedTemplate || showPreview) {
      setShowPreview(!showPreview)
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/templates/pdf/${selectedTemplate.id}/preview`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: {} })
        }
      )

      const html = await response.text()
      const iframe = document.getElementById('pdf-preview-frame')
      if (iframe) {
        iframe.srcdoc = html
      }
      setShowPreview(true)
    } catch (error) {
      console.error('Error loading preview:', error)
    }
  }

  const getTipoConfig = (tipo) => {
    return TIPO_LABELS[tipo] || {
      label: tipo,
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates de PDF</h1>
            <p className="text-gray-600">
              Personaliza los PDFs que se generan automáticamente
            </p>
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
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Lista de templates */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader className="w-8 h-8 animate-spin mx-auto text-gray-500" />
              <p className="mt-4 text-gray-500">Cargando templates...</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {templates.map(template => {
                const config = getTipoConfig(template.tipo)
                const isSelected = selectedTemplate?.id === template.id

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-gray-50 border-red-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isSelected ? 'text-gray-700' : 'text-gray-700'}`}>
                        {config.label}
                      </span>
                      {!template.isActive && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {config.description}
                    </p>
                  </button>
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
                      {getTipoConfig(selectedTemplate.tipo).label}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {getTipoConfig(selectedTemplate.tipo).description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedTemplate.isActive ?? selectedTemplate.isActive}
                        onChange={(e) => setEditedTemplate({ ...editedTemplate, isActive: e.target.checked })}
                        className="w-4 h-4 text-gray-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Activo</span>
                    </label>
                    <button
                      onClick={handlePreview}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        showPreview
                          ? 'bg-gray-100 text-gray-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Editor' : 'Vista Previa'}
                    </button>
                    <button
                      onClick={handleDownloadTest}
                      disabled={downloadingTest}
                      className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {downloadingTest ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Descargar Prueba
                    </button>
                    {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
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
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
                    <iframe
                      id="pdf-preview-frame"
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                      <div className="flex gap-4">
                        <button
                          onClick={() => setActiveTab('html')}
                          className={`pb-2 px-1 border-b-2 transition-colors ${
                            activeTab === 'html'
                              ? 'border-red-600 text-gray-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          HTML
                        </button>
                        <button
                          onClick={() => setActiveTab('css')}
                          className={`pb-2 px-1 border-b-2 transition-colors ${
                            activeTab === 'css'
                              ? 'border-red-600 text-gray-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          CSS
                        </button>
                      </div>
                    </div>

                    {/* HTML Editor */}
                    {activeTab === 'html' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contenido HTML
                        </label>
                        <textarea
                          value={editedTemplate.htmlContent ?? selectedTemplate.htmlContent}
                          onChange={(e) => setEditedTemplate({ ...editedTemplate, htmlContent: e.target.value })}
                          rows={25}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-red-500 font-mono text-sm"
                          placeholder="HTML del PDF..."
                        />
                      </div>
                    )}

                    {/* CSS Editor */}
                    {activeTab === 'css' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estilos CSS
                        </label>
                        <textarea
                          value={editedTemplate.cssContent ?? selectedTemplate.cssContent}
                          onChange={(e) => setEditedTemplate({ ...editedTemplate, cssContent: e.target.value })}
                          rows={25}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-red-500 font-mono text-sm"
                          placeholder="CSS del PDF..."
                        />
                      </div>
                    )}

                    {/* Page Settings */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Formato de Página
                        </label>
                        <select
                          value={editedTemplate.pageFormat ?? selectedTemplate.pageFormat}
                          onChange={(e) => setEditedTemplate({ ...editedTemplate, pageFormat: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-red-500"
                        >
                          <option value="A4">A4</option>
                          <option value="Letter">Letter</option>
                          <option value="Legal">Legal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Orientación
                        </label>
                        <select
                          value={editedTemplate.orientation ?? selectedTemplate.orientation}
                          onChange={(e) => setEditedTemplate({ ...editedTemplate, orientation: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-red-500"
                        >
                          <option value="portrait">Vertical</option>
                          <option value="landscape">Horizontal</option>
                        </select>
                      </div>
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
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Selecciona un template para editarlo</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
