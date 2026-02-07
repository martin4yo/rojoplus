import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet, Upload, Settings, CheckCircle2, AlertCircle,
  Calendar, Search, RefreshCw, FileText, Link2, Eye, Trash2, Plus
} from 'lucide-react'
import { Button } from '../../../components/Button'
import api from '../../../services/api'

function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount || 0)
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR')
}

const ESTADO_BADGE = {
  IMPORTADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Importado' },
  EN_CONCILIACION: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En Conciliacion' },
  CONCILIADO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Conciliado' }
}

export default function ConciliacionBancaria() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('extractos')
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState(null)
  const [extractos, setExtractos] = useState([])
  const [formatos, setFormatos] = useState([])
  const [cajas, setCajas] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1 })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Modal importar
  const [showImportModal, setShowImportModal] = useState(false)
  const [importForm, setImportForm] = useState({
    cajaId: '',
    formatoId: '',
    contenido: '',
    nombreArchivo: '',
    periodoDesde: '',
    periodoHasta: ''
  })
  const [importing, setImporting] = useState(false)

  // Modal formato
  const [showFormatoModal, setShowFormatoModal] = useState(false)
  const [formatoForm, setFormatoForm] = useState({
    id: null,
    nombre: '',
    banco: '',
    tipoArchivo: 'CSV',
    descripcion: '',
    configuracion: {
      delimitador: ';',
      primeraFila: 1,
      formatoFecha: 'DD/MM/YYYY',
      columnas: {}
    }
  })
  const [savingFormato, setSavingFormato] = useState(false)

  const [filtros, setFiltros] = useState({
    cajaId: '',
    estado: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (tab === 'extractos') {
      cargarExtractos()
    } else if (tab === 'formatos') {
      cargarFormatos()
    }
  }, [tab, filtros])

  async function cargarDatos() {
    try {
      const [cajasRes, resumenRes, formatosRes] = await Promise.all([
        api.getFull('/admin/cajas?activo=true'),
        api.getFull('/admin/conciliacion/resumen'),
        api.getFull('/admin/conciliacion/formatos')
      ])
      setCajas(cajasRes.data || [])
      setResumen(resumenRes.data)
      setFormatos(formatosRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
    cargarExtractos()
  }

  async function cargarExtractos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.cajaId) params.append('cajaId', filtros.cajaId)
      if (filtros.estado) params.append('estado', filtros.estado)
      params.append('page', pagination.page)

      const response = await api.getFull(`/admin/conciliacion/extractos?${params}`)
      setExtractos(response.data || [])
      setPagination(response.pagination || { page: 1, pages: 1 })
    } catch (err) {
      setError('Error cargando extractos')
    } finally {
      setLoading(false)
    }
  }

  async function cargarFormatos() {
    setLoading(true)
    try {
      const response = await api.getFull('/admin/conciliacion/formatos')
      setFormatos(response.data || [])
    } catch (err) {
      setError('Error cargando formatos')
    } finally {
      setLoading(false)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setImportForm(prev => ({
        ...prev,
        contenido: event.target.result,
        nombreArchivo: file.name
      }))
    }
    reader.readAsText(file)
  }

  async function handleImportar() {
    if (!importForm.cajaId || !importForm.formatoId || !importForm.contenido) {
      setError('Complete todos los campos requeridos')
      return
    }

    setImporting(true)
    setError(null)
    try {
      const response = await api.post('/admin/conciliacion/extractos/importar', importForm)
      setSuccess(response.message)
      setShowImportModal(false)
      setImportForm({
        cajaId: '',
        formatoId: '',
        contenido: '',
        nombreArchivo: '',
        periodoDesde: '',
        periodoHasta: ''
      })
      cargarExtractos()
      cargarDatos()
    } catch (err) {
      setError(err.message || 'Error importando extracto')
    } finally {
      setImporting(false)
    }
  }

  async function handleEliminarExtracto(id) {
    if (!confirm('Eliminar este extracto?')) return
    try {
      await api.delete(`/admin/conciliacion/extractos/${id}`)
      setSuccess('Extracto eliminado')
      cargarExtractos()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleEditFormato(formato) {
    setFormatoForm({
      id: formato.id,
      nombre: formato.nombre,
      banco: formato.banco || '',
      tipoArchivo: formato.tipoArchivo,
      descripcion: formato.descripcion || '',
      configuracion: formato.configuracion || {}
    })
    setShowFormatoModal(true)
  }

  function handleNuevoFormato() {
    setFormatoForm({
      id: null,
      nombre: '',
      banco: '',
      tipoArchivo: 'CSV',
      descripcion: '',
      configuracion: {
        delimitador: ';',
        primeraFila: 1,
        formatoFecha: 'DD/MM/YYYY',
        columnas: {}
      }
    })
    setShowFormatoModal(true)
  }

  async function handleGuardarFormato() {
    if (!formatoForm.nombre || !formatoForm.tipoArchivo) {
      setError('Nombre y tipo de archivo son requeridos')
      return
    }

    setSavingFormato(true)
    setError(null)
    try {
      if (formatoForm.id) {
        await api.put(`/admin/conciliacion/formatos/${formatoForm.id}`, formatoForm)
        setSuccess('Formato actualizado')
      } else {
        await api.post('/admin/conciliacion/formatos', formatoForm)
        setSuccess('Formato creado')
      }
      setShowFormatoModal(false)
      cargarFormatos()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingFormato(false)
    }
  }

  async function handleEliminarFormato(id) {
    if (!confirm('Eliminar este formato?')) return
    try {
      await api.delete(`/admin/conciliacion/formatos/${id}`)
      setSuccess('Formato eliminado')
      cargarFormatos()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Link2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Conciliacion Bancaria</h1>
            <p className="text-sm text-gray-500">Importe extractos y concilie con movimientos de caja</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Extracto
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* KPIs */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-600">Extractos Importados</p>
            <p className="text-2xl font-bold text-blue-700">{resumen.extractosPorEstado?.IMPORTADO || 0}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <p className="text-sm text-yellow-600">En Conciliacion</p>
            <p className="text-2xl font-bold text-yellow-700">{resumen.extractosPorEstado?.EN_CONCILIACION || 0}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm text-green-600">Conciliados</p>
            <p className="text-2xl font-bold text-green-700">{resumen.extractosPorEstado?.CONCILIADO || 0}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm text-amber-600">Movimientos Pendientes</p>
            <p className="text-2xl font-bold text-amber-700">{resumen.movimientosCajaPendientes?.cantidad || 0}</p>
            <p className="text-xs text-amber-500">{formatMoney(resumen.movimientosCajaPendientes?.monto)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('extractos')}
          className={`px-4 py-2 font-medium transition-colors ${
            tab === 'extractos' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-2" />
          Extractos
        </button>
        <button
          onClick={() => setTab('formatos')}
          className={`px-4 py-2 font-medium transition-colors ${
            tab === 'formatos' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Formatos
        </button>
      </div>

      {/* Tab Extractos */}
      {tab === 'extractos' && (
        <>
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta/Caja</label>
                <select
                  value={filtros.cajaId}
                  onChange={(e) => setFiltros(prev => ({ ...prev, cajaId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Todas</option>
                  {cajas.filter(c => c.tipo === 'BANCO').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={filtros.estado}
                  onChange={(e) => setFiltros(prev => ({ ...prev, estado: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  <option value="IMPORTADO">Importado</option>
                  <option value="EN_CONCILIACION">En Conciliacion</option>
                  <option value="CONCILIADO">Conciliado</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={cargarExtractos} variant="secondary" className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla Extractos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : extractos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay extractos importados</p>
                <Button onClick={() => setShowImportModal(true)} className="mt-4">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Extracto
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Numero</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Cuenta</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Periodo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Movimientos</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Saldo Final</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {extractos.map(ext => {
                    const badge = ESTADO_BADGE[ext.estado] || ESTADO_BADGE.IMPORTADO
                    return (
                      <tr key={ext.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{ext.numero}</span>
                          {ext.formato && (
                            <p className="text-xs text-gray-400">{ext.formato.nombre}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{ext.caja?.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(ext.periodoDesde)} - {formatDate(ext.periodoHasta)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {ext.cantidadMovimientos}
                          <span className="text-gray-400 ml-1">
                            ({ext._count?.conciliaciones || 0} conc.)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatMoney(ext.saldoFinal)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/tesoreria/conciliacion/${ext.id}`)}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                              title="Ver/Conciliar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {ext.estado === 'IMPORTADO' && (
                              <button
                                onClick={() => handleEliminarExtracto(ext.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Tab Formatos */}
      {tab === 'formatos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleNuevoFormato}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Formato
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {formatos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay formatos configurados</p>
                <Button onClick={handleNuevoFormato} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Formato
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Banco</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Descripcion</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formatos.map(fmt => (
                    <tr key={fmt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{fmt.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmt.banco || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {fmt.tipoArchivo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{fmt.descripcion || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditFormato(fmt)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminarFormato(fmt.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Importar Extracto Bancario
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Bancaria *</label>
                <select
                  value={importForm.cajaId}
                  onChange={(e) => setImportForm(prev => ({ ...prev, cajaId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Seleccione...</option>
                  {cajas.filter(c => c.tipo === 'BANCO').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formato *</label>
                <select
                  value={importForm.formatoId}
                  onChange={(e) => setImportForm(prev => ({ ...prev, formatoId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Seleccione...</option>
                  {formatos.filter(f => f.activo).map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivo *</label>
                <input
                  type="file"
                  accept=".csv,.ofx,.txt,.xlsx"
                  onChange={handleFileUpload}
                  className="input-field w-full"
                />
                {importForm.nombreArchivo && (
                  <p className="text-sm text-green-600 mt-1">
                    <FileText className="w-4 h-4 inline mr-1" />
                    {importForm.nombreArchivo}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodo Desde</label>
                  <input
                    type="date"
                    value={importForm.periodoDesde}
                    onChange={(e) => setImportForm(prev => ({ ...prev, periodoDesde: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodo Hasta</label>
                  <input
                    type="date"
                    value={importForm.periodoHasta}
                    onChange={(e) => setImportForm(prev => ({ ...prev, periodoHasta: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setShowImportModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleImportar} loading={importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formato */}
      {showFormatoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 m-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              {formatoForm.id ? 'Editar Formato' : 'Nuevo Formato'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formatoForm.nombre}
                    onChange={(e) => setFormatoForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Ej: Banco Galicia CSV"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input
                    type="text"
                    value={formatoForm.banco}
                    onChange={(e) => setFormatoForm(prev => ({ ...prev, banco: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Ej: Banco Galicia"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Archivo *</label>
                  <select
                    value={formatoForm.tipoArchivo}
                    onChange={(e) => setFormatoForm(prev => ({ ...prev, tipoArchivo: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="CSV">CSV (valores separados)</option>
                    <option value="OFX">OFX (estandar bancario)</option>
                    <option value="TXT">TXT (posicional)</option>
                    <option value="XLSX">Excel (XLSX)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                  <input
                    type="text"
                    value={formatoForm.descripcion}
                    onChange={(e) => setFormatoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Descripcion opcional"
                  />
                </div>
              </div>

              {formatoForm.tipoArchivo === 'CSV' && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium text-gray-700">Configuracion CSV</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Delimitador</label>
                      <select
                        value={formatoForm.configuracion.delimitador || ';'}
                        onChange={(e) => setFormatoForm(prev => ({
                          ...prev,
                          configuracion: { ...prev.configuracion, delimitador: e.target.value }
                        }))}
                        className="input-field w-full"
                      >
                        <option value=";">Punto y coma (;)</option>
                        <option value=",">Coma (,)</option>
                        <option value="\t">Tabulador</option>
                        <option value="|">Pipe (|)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Primera fila datos</label>
                      <input
                        type="number"
                        min="0"
                        value={formatoForm.configuracion.primeraFila || 1}
                        onChange={(e) => setFormatoForm(prev => ({
                          ...prev,
                          configuracion: { ...prev.configuracion, primeraFila: parseInt(e.target.value) }
                        }))}
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Formato fecha</label>
                      <select
                        value={formatoForm.configuracion.formatoFecha || 'DD/MM/YYYY'}
                        onChange={(e) => setFormatoForm(prev => ({
                          ...prev,
                          configuracion: { ...prev.configuracion, formatoFecha: e.target.value }
                        }))}
                        className="input-field w-full"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                        <option value="YYYYMMDD">YYYYMMDD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">Mapeo de Columnas (numero de columna, empezando en 0)</h5>
                    <div className="grid grid-cols-3 gap-3">
                      {['fecha', 'concepto', 'descripcion', 'referencia', 'debito', 'credito', 'importe', 'saldo'].map(campo => (
                        <div key={campo}>
                          <label className="block text-xs text-gray-500 mb-1 capitalize">{campo}</label>
                          <input
                            type="number"
                            min="-1"
                            value={formatoForm.configuracion.columnas?.[campo] ?? ''}
                            onChange={(e) => {
                              const valor = e.target.value === '' ? undefined : parseInt(e.target.value)
                              setFormatoForm(prev => ({
                                ...prev,
                                configuracion: {
                                  ...prev.configuracion,
                                  columnas: {
                                    ...prev.configuracion.columnas,
                                    [campo]: valor
                                  }
                                }
                              }))
                            }}
                            className="input-field w-full text-sm"
                            placeholder="-"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Deje vacio los campos que no aplican. Use debito/credito O importe (no ambos).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowFormatoModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleGuardarFormato} loading={savingFormato}>
                  {formatoForm.id ? 'Guardar Cambios' : 'Crear Formato'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
