import { useState, useEffect } from 'react'
import {
  CreditCard, FileText, Upload, Download, RefreshCw,
  Calendar, Users, DollarSign, CheckCircle, XCircle,
  AlertTriangle, Clock, Settings, ChevronRight, Eye,
  Search, Filter, Building, Send, RotateCcw, BarChart3,
  UserPlus, Check, X, Landmark, Mail, MessageCircle, Bell
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { formatCurrency, formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/StatusBadge'
import { useConfirm } from '../../hooks/useConfirm'

export default function DebitoAutomatico() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [activeTab, setActiveTab] = useState('adhesiones')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Estado para Configuraciones
  const [configuraciones, setConfiguraciones] = useState([])

  // Estado para Generar
  const [periodoAnio, setPeriodoAnio] = useState(new Date().getFullYear())
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth() + 1)
  const [configuracionId, setConfiguracionId] = useState('')
  const [sociosDisponibles, setSociosDisponibles] = useState([])
  const [sociosSeleccionados, setSociosSeleccionados] = useState([])
  const [resumenSocios, setResumenSocios] = useState(null)
  const [tipoArchivo, setTipoArchivo] = useState('VISA_CREDITO')

  // Estado para Archivos
  const [archivos, setArchivos] = useState([])
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null)
  const [showDetalleModal, setShowDetalleModal] = useState(false)

  // Estado para Importar (PRISMA)
  const [archivoImportar, setArchivoImportar] = useState(null)
  const [contenidoRespuesta, setContenidoRespuesta] = useState('')
  const [resultadoImportacion, setResultadoImportacion] = useState(null)

  // Estado para Importar Respuesta Bancaria (CBU)
  const [archivoBancoImportar, setArchivoBancoImportar] = useState(null)
  const [bancoSeleccionado, setBancoSeleccionado] = useState('GALICIA')
  const [contenidoRespuestaBanco, setContenidoRespuestaBanco] = useState('')
  const [nombreArchivoBanco, setNombreArchivoBanco] = useState('')
  const [resultadoImportacionBanco, setResultadoImportacionBanco] = useState(null)

  // Estado para Payway
  const [configsPayway, setConfigsPayway] = useState([])
  const [archivoPayway, setArchivoPayway] = useState(null)
  const [configPaywayId, setConfigPaywayId] = useState('')
  const [procesandoPayway, setProcesandoPayway] = useState(false)
  const [resultadoPayway, setResultadoPayway] = useState(null)
  const [progresoPayway, setProgresoPayway] = useState(null)

  // Estado para Estadísticas
  const [estadisticas, setEstadisticas] = useState(null)

  // Estado para Adhesiones
  const [adhesiones, setAdhesiones] = useState([])
  const [filtroAdhesion, setFiltroAdhesion] = useState('PENDIENTE')

  // Estado para Modal Nuevo Procesador
  const [showNuevoProcesador, setShowNuevoProcesador] = useState(false)
  // Catálogo global de procesadores (formato del registro; compartido entre tenants)
  const [procesadores, setProcesadores] = useState([])
  const [formProcesador, setFormProcesador] = useState({
    procesadorId: '',
    codigoEmpresa: '',
    codigoComercio: '',
    nombreEmpresa: '',
    cuitEmpresa: '',
    apiKey: '',
    apiSecret: '',
    ambiente: 'PRODUCCION'
  })
  const [savingProcesador, setSavingProcesador] = useState(false)

  useEffect(() => {
    cargarConfiguraciones()
    cargarProcesadores()
    cargarEstadisticas()
    cargarAdhesiones()
    cargarConfigsPayway()
  }, [])

  useEffect(() => {
    if (activeTab === 'archivos' || activeTab === 'banco' || activeTab === 'payway') {
      cargarArchivos()
    }
    if (activeTab === 'adhesiones') {
      cargarAdhesiones()
    }
  }, [activeTab, filtroAdhesion])

  useEffect(() => {
    if (periodoAnio && periodoMes && configuracionId) {
      cargarSociosDisponibles()
    }
  }, [periodoAnio, periodoMes, configuracionId])

  async function cargarConfiguraciones() {
    try {
      const data = await api.get('/admin/debito/configuraciones')
      const configs = Array.isArray(data) ? data : (data?.data || [])
      setConfiguraciones(configs)
      if (configs.length > 0 && !configuracionId) {
        setConfiguracionId(configs[0].id)
      }
    } catch (err) {
      console.error('Error cargando configuraciones:', err)
    }
  }

  async function cargarProcesadores() {
    try {
      const data = await api.get('/admin/debito/procesadores')
      setProcesadores(Array.isArray(data) ? data : (data?.data || []))
    } catch (err) {
      console.error('Error cargando procesadores:', err)
    }
  }

  async function guardarProcesador() {
    if (!formProcesador.procesadorId) {
      setError('Debe seleccionar un procesador')
      return
    }
    setSavingProcesador(true)
    setError(null)
    try {
      await api.post('/admin/debito/configuraciones', formProcesador)
      setShowNuevoProcesador(false)
      setFormProcesador({
        procesadorId: '',
        codigoEmpresa: '',
        codigoComercio: '',
        nombreEmpresa: '',
        cuitEmpresa: '',
        apiKey: '',
        apiSecret: '',
        ambiente: 'PRODUCCION'
      })
      cargarConfiguraciones()
    } catch (err) {
      setError(err.message || 'Error al guardar configuración')
    } finally {
      setSavingProcesador(false)
    }
  }

  async function cargarEstadisticas() {
    try {
      const data = await api.get('/admin/debito/estadisticas')
      setEstadisticas(data || null)
    } catch (err) {
      console.error('Error cargando estadísticas:', err)
      setEstadisticas(null)
    }
  }

  async function cargarSociosDisponibles() {
    setLoading(true)
    try {
      const data = await api.get('/admin/debito/socios-disponibles', {
        periodoAnio,
        periodoMes,
        configuracionId
      })
      const socios = data?.socios || []
      setSociosDisponibles(socios)
      setResumenSocios(data?.resumen || null)
      setSociosSeleccionados(socios.map(s => s.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cargarArchivos() {
    setLoading(true)
    try {
      const data = await api.get('/admin/debito/archivos', {
        periodoAnio
      })
      setArchivos(data?.archivos || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function generarArchivo() {
    if (sociosSeleccionados.length === 0) {
      setError('Seleccione al menos un socio')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.post('/admin/debito/archivos/generar', {
        configuracionId,
        periodoAnio,
        periodoMes,
        socioIds: sociosSeleccionados,
        tipoArchivo
      })

      // Descargar archivo
      const blob = new Blob([data.contenido], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.nombreArchivo
      a.click()
      URL.revokeObjectURL(url)

      toast.success(data.mensaje)
      cargarSociosDisponibles()
      cargarArchivos()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function verDetalleArchivo(id) {
    setLoading(true)
    try {
      const data = await api.get(`/admin/debito/archivos/${id}`)
      setArchivoSeleccionado(data)
      setShowDetalleModal(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function descargarArchivo(id) {
    try {
      const response = await fetch(`/api/admin/debito/archivos/${id}/descargar`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'archivo.txt'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function marcarEnviado(id) {
    try {
      await api.put(`/admin/debito/archivos/${id}/enviar`)
      cargarArchivos()
      if (archivoSeleccionado?.id === id) {
        verDetalleArchivo(id)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function importarRespuesta() {
    if (!archivoImportar || !contenidoRespuesta) {
      setError('Seleccione un archivo y pegue el contenido de la respuesta')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.post(`/admin/debito/archivos/${archivoImportar}/importar-respuesta`, {
        contenido: contenidoRespuesta,
        nombreArchivo: 'respuesta.txt'
      })
      setResultadoImportacion(data)
      cargarArchivos()
      cargarEstadisticas()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cargarConfigsPayway() {
    try {
      const data = await api.get('/admin/payway/configuraciones')
      setConfigsPayway(data?.data || [])
    } catch {
      // Silencioso — puede no tener configs aún
    }
  }

  async function cobrarLotePayway() {
    if (!archivoPayway || !configPaywayId) {
      setError('Seleccioná el archivo y la configuración Payway')
      return
    }
    setProcesandoPayway(true)
    setResultadoPayway(null)
    setError(null)
    try {
      const data = await api.post(`/admin/payway/cobrar-lote/${archivoPayway}`, {
        configuracionId: configPaywayId
      })
      setResultadoPayway(data)
      cargarArchivos()
      cargarEstadisticas()
      toast.success(`Payway: ${data.resumen.cobrados} cobrados, ${data.resumen.rechazados} rechazados`)
    } catch (err) {
      setError(err.message)
    } finally {
      setProcesandoPayway(false)
    }
  }

  async function importarRespuestaBanco() {
    if (!archivoBancoImportar || !contenidoRespuestaBanco) {
      setError('Seleccione el archivo de débito y cargue el archivo de respuesta bancaria')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.post(`/admin/debito/archivos/${archivoBancoImportar}/importar-respuesta-banco`, {
        contenido: contenidoRespuestaBanco,
        nombreArchivo: nombreArchivoBanco || `${bancoSeleccionado}_respuesta.txt`,
        banco: bancoSeleccionado
      })
      setResultadoImportacionBanco(data)
      cargarArchivos()
      cargarEstadisticas()
      toast.success(`Importación completada: ${data.resumen.cobrados} cobrados, ${data.resumen.rechazados} rechazados`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFileBancoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setNombreArchivoBanco(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setContenidoRespuestaBanco(ev.target.result)
    reader.readAsText(file, 'latin1')
  }

  async function reintentarRechazados(id) {
    setLoading(true)
    try {
      const data = await api.post(`/admin/debito/archivos/${id}/reintentar-rechazados`)
      toast.success(data.mensaje)
      cargarArchivos()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function reenviarRecibos(id) {
    setLoading(true)
    try {
      const data = await api.post(`/admin/debito/archivos/${id}/reenviar-recibos`)
      const n = data.notificaciones
      toast.success(
        `Recibos reenviados — Email: ${n.emailOk} ok / ${n.emailFail} fallaron · WhatsApp: ${n.waOk} ok / ${n.waFail} fallaron`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleSocio(id) {
    if (sociosSeleccionados.includes(id)) {
      setSociosSeleccionados(sociosSeleccionados.filter(s => s !== id))
    } else {
      setSociosSeleccionados([...sociosSeleccionados, id])
    }
  }

  function toggleTodos() {
    if (sociosSeleccionados.length === sociosDisponibles.length) {
      setSociosSeleccionados([])
    } else {
      setSociosSeleccionados(sociosDisponibles.map(s => s.id))
    }
  }

  async function cargarAdhesiones() {
    setLoading(true)
    try {
      const data = await api.get('/admin/debito/adhesiones', { estado: filtroAdhesion })
      setAdhesiones(Array.isArray(data) ? data : (data?.data || []))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function aprobarAdhesion(socioId) {
    const confirmed = await confirm('Aprobar adhesión', '¿Aprobar esta solicitud de adhesión al débito automático?')
    if (!confirmed) return
    try {
      await api.put(`/admin/debito/adhesiones/${socioId}/aprobar`)
      cargarAdhesiones()
      cargarEstadisticas()
    } catch (err) {
      setError(err.message)
    }
  }

  async function rechazarAdhesion(socioId) {
    const motivo = window.prompt('Motivo del rechazo (opcional):')
    if (motivo === null) return
    try {
      await api.put(`/admin/debito/adhesiones/${socioId}/rechazar`, { motivo })
      cargarAdhesiones()
    } catch (err) {
      setError(err.message)
    }
  }

  async function desactivarDebito(socioId) {
    const confirmed = await confirm('Desactivar débito', '¿Desactivar el débito automático para este socio?')
    if (!confirmed) return
    try {
      await api.put(`/admin/debito/adhesiones/${socioId}/desactivar`)
      cargarAdhesiones()
      cargarEstadisticas()
    } catch (err) {
      setError(err.message)
    }
  }

  const adhesionesPendientes = (adhesiones || []).filter(a => a.estadoAdhesion === 'PENDIENTE').length

  // Sub-componente inline: muestra stats de email + WA enviados
  function NotifStats({ stats }) {
    if (!stats) return null
    return (
      <div className="border-t border-green-200 pt-3 mt-1">
        <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
          <Bell className="w-3 h-3" /> Notificaciones enviadas
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-blue-700">
            <Mail className="w-3 h-3" />
            Email: <strong>{stats.emailOk}</strong> ok
            {stats.emailFail > 0 && <span className="text-red-500 ml-1">/ {stats.emailFail} fallaron</span>}
          </span>
          <span className="flex items-center gap-1 text-green-700">
            <MessageCircle className="w-3 h-3" />
            WhatsApp: <strong>{stats.waOk}</strong> ok
            {stats.waFail > 0 && <span className="text-red-500 ml-1">/ {stats.waFail} fallaron</span>}
          </span>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'adhesiones', label: 'Adhesiones', icon: UserPlus, badge: adhesionesPendientes > 0 ? adhesionesPendientes : null },
    { id: 'generar', label: 'Generar Archivo', icon: FileText },
    { id: 'archivos', label: 'Archivos', icon: Download },
    { id: 'importar', label: 'Importar Respuesta', icon: Upload },
    { id: 'payway', label: 'Payway', icon: CreditCard },
    { id: 'banco', label: 'Resp. Bancaria', icon: Landmark },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'configuracion', label: 'Configuración', icon: Settings }
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-primary" />
          Débito Automático
        </h1>
        <p className="text-gray-600 mt-1">
          Gestión de archivos de débito para Prisma, Payway y bancos
        </p>
      </div>

      {/* KPIs Rápidos */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Socios con Débito</p>
                <p className="text-xl font-bold text-gray-800">{estadisticas.sociosConDebito}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cobrados ({estadisticas.anio})</p>
                <p className="text-xl font-bold text-green-600">{estadisticas.detalles?.cobrados || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rechazados ({estadisticas.anio})</p>
                <p className="text-xl font-bold text-red-600">{estadisticas.detalles?.rechazados || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tasa de Éxito</p>
                <p className="text-xl font-bold text-purple-600">{estadisticas.tasaExito}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Tab: Adhesiones */}
          {activeTab === 'adhesiones' && (
            <div className="space-y-4">
              {/* Filtros */}
              <div className="flex gap-2 mb-4">
                {['PENDIENTE', 'ACTIVO', 'TODOS'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltroAdhesion(f === 'TODOS' ? '' : f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      (filtroAdhesion === f || (f === 'TODOS' && !filtroAdhesion))
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'PENDIENTE' && `Pendientes (${adhesiones.filter(a => a.estadoAdhesion === 'PENDIENTE').length})`}
                    {f === 'ACTIVO' && `Activos (${adhesiones.filter(a => a.estadoAdhesion === 'ACTIVO').length})`}
                    {f === 'TODOS' && `Todos (${adhesiones.length})`}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Cargando...</div>
              ) : adhesiones.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay solicitudes {filtroAdhesion === 'PENDIENTE' ? 'pendientes' : ''}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Socio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medio de Pago</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adhesiones.map(socio => (
                        <tr key={socio.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{socio.apellidoNombre}</p>
                              <p className="text-sm text-gray-500">#{socio.nroSocio} - DNI {socio.documento}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                              socio.debitoTipo === 'TARJETA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              <CreditCard className="w-3 h-3" />
                              {socio.debitoTipo || 'CBU'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {socio.debitoTipo === 'TARJETA' ? (
                              <div>
                                <p className="text-sm font-medium text-gray-900">{socio.tarjetaMarca}</p>
                                <p className="text-sm font-mono text-gray-500">**** {socio.tarjetaUltimos4} - Vto: {socio.tarjetaVencimiento}</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-medium text-gray-900">{socio.bancoDebito}</p>
                                <p className="text-sm font-mono text-gray-500">{socio.cbuMasked}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={socio.estadoAdhesion} type="generic" />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(socio.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {socio.estadoAdhesion === 'PENDIENTE' && (
                                <>
                                  <button
                                    onClick={() => aprobarAdhesion(socio.id)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Aprobar"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => rechazarAdhesion(socio.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Rechazar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {socio.estadoAdhesion === 'ACTIVO' && (
                                <button
                                  onClick={() => desactivarDebito(socio.id)}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title="Desactivar"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Generar Archivo */}
          {activeTab === 'generar' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procesador</label>
                  <select
                    value={configuracionId}
                    onChange={(e) => setConfiguracionId(e.target.value)}
                    className="input-field"
                  >
                    {configuraciones.map(c => (
                      <option key={c.id} value={c.id}>{c.procesador?.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                  <select
                    value={periodoAnio}
                    onChange={(e) => setPeriodoAnio(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {[2024, 2025, 2026, 2027].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                  <select
                    value={periodoMes}
                    onChange={(e) => setPeriodoMes(parseInt(e.target.value))}
                    className="input-field"
                  >
                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ].map((m, i) => (
                      <option key={i+1} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Tarjeta</label>
                  <select
                    value={tipoArchivo}
                    onChange={(e) => setTipoArchivo(e.target.value)}
                    className="input-field"
                  >
                    <option value="VISA_CREDITO">VISA Crédito</option>
                    <option value="VISA_DEBITO">VISA Débito</option>
                    <option value="MASTERCARD">Mastercard</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button onClick={cargarSociosDisponibles} loading={loading} variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                  </Button>
                </div>
              </div>

              {/* Resumen */}
              {resumenSocios && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-sm text-gray-500">Socios disponibles:</span>
                        <span className="ml-2 font-bold text-gray-800">{resumenSocios.total}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Por CBU:</span>
                        <span className="ml-2 font-medium text-blue-600">{resumenSocios.porCBU}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Por Tarjeta:</span>
                        <span className="ml-2 font-medium text-purple-600">{resumenSocios.porTarjeta}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Monto total:</span>
                        <span className="ml-2 font-bold text-green-600">
                          {formatCurrency(resumenSocios.montoTotal)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Seleccionados:</span>
                      <span className="ml-2 font-bold text-primary">{sociosSeleccionados.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Socios */}
              {sociosDisponibles.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={sociosSeleccionados.length === sociosDisponibles.length}
                            onChange={toggleTodos}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Socio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CBU/Tarjeta</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cuotas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sociosDisponibles.map(socio => (
                        <tr key={socio.id} className={sociosSeleccionados.includes(socio.id) ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={sociosSeleccionados.includes(socio.id)}
                              onChange={() => toggleSocio(socio.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{socio.apellidoNombre}</div>
                            <div className="text-sm text-gray-500">#{socio.nroSocio} - DNI {socio.dni}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              socio.medioPago === 'CBU' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {socio.medioPago === 'CBU' ? (
                                <><Building className="w-3 h-3 mr-1" /> CBU</>
                              ) : (
                                <><CreditCard className="w-3 h-3 mr-1" /> {socio.tarjetaMarca || 'Tarjeta'}</>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                            {socio.medioPago === 'CBU'
                              ? (socio.cbuDebito?.slice(-8) || '-')
                              : `****${socio.tarjetaUltimos4 || '****'}`
                            }
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            {socio.cantidadCargos}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(socio.totalDebitar)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay socios con débito activo y cuotas pendientes para este período</p>
                </div>
              )}

              {/* Botón Generar */}
              {sociosDisponibles.length > 0 && tienePermiso(PERMISOS.DEBITO_AUTOMATICO) && (
                <div className="flex justify-end">
                  <Button
                    onClick={generarArchivo}
                    loading={loading}
                    disabled={sociosSeleccionados.length === 0}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generar Archivo ({sociosSeleccionados.length} socios)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tab: Archivos */}
          {activeTab === 'archivos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-800">Archivos Generados</h3>
                <Button onClick={cargarArchivos} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>

              {archivos.length > 0 ? (
                <div className="space-y-3">
                  {archivos.map(archivo => (
                    <div
                      key={archivo.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-900">{archivo.numero}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              archivo.estado === 'GENERADO' ? 'bg-yellow-100 text-yellow-800' :
                              archivo.estado === 'ENVIADO' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {archivo.estado === 'GENERADO' && <Clock className="w-3 h-3 mr-1" />}
                              {archivo.estado === 'ENVIADO' && <Send className="w-3 h-3 mr-1" />}
                              {archivo.estado === 'PROCESADO' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {archivo.estado}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span>{archivo.configuracion?.procesador?.nombre}</span>
                            <span>•</span>
                            <span>{String(archivo.periodoMes).padStart(2, '0')}/{archivo.periodoAnio}</span>
                            <span>•</span>
                            <span>{archivo.cantidadRegistros} registros</span>
                            <span>•</span>
                            <span className="font-medium text-gray-700">
                              {formatCurrency(archivo.montoTotal)}
                            </span>
                          </div>

                          {archivo.estadisticas && (
                            <div className="mt-2 flex items-center gap-4 text-sm">
                              <span className="text-yellow-600">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {archivo.estadisticas.pendientes} pendientes
                              </span>
                              <span className="text-green-600">
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                {archivo.estadisticas.cobrados} cobrados
                              </span>
                              <span className="text-red-600">
                                <XCircle className="w-3 h-3 inline mr-1" />
                                {archivo.estadisticas.rechazados} rechazados
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verDetalleArchivo(archivo.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => descargarArchivo(archivo.id)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {archivo.estado === 'GENERADO' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => marcarEnviado(archivo.id)}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {archivo.estadisticas?.rechazados > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reintentarRechazados(archivo.id)}
                              title="Reintentar rechazados"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {archivo.estado === 'PROCESADO' && archivo.estadisticas?.cobrados > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reenviarRecibos(archivo.id)}
                              title="Reenviar recibos (email + WhatsApp)"
                            >
                              <Bell className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay archivos generados</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Importar Respuesta */}
          {activeTab === 'importar' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Instrucciones</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Seleccione el archivo de débito original</li>
                  <li>Pegue el contenido del archivo de respuesta del procesador</li>
                  <li>Haga clic en "Procesar Respuesta"</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivo de Débito Original
                  </label>
                  <select
                    value={archivoImportar || ''}
                    onChange={(e) => setArchivoImportar(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Seleccionar archivo...</option>
                    {archivos.filter(a => a.estado !== 'PROCESADO').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.numero} - {a.cantidadRegistros} registros ({formatCurrency(a.montoTotal)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenido del Archivo de Respuesta
                </label>
                <textarea
                  value={contenidoRespuesta}
                  onChange={(e) => setContenidoRespuesta(e.target.value)}
                  rows={10}
                  className="input-field font-mono text-sm"
                  placeholder="Pegue aquí el contenido del archivo de respuesta..."
                />
              </div>

              {tienePermiso(PERMISOS.DEBITO_AUTOMATICO) && (
                <div className="flex justify-end">
                  <Button
                    onClick={importarRespuesta}
                    loading={loading}
                    disabled={!archivoImportar || !contenidoRespuesta}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Procesar Respuesta
                  </Button>
                </div>
              )}

              {resultadoImportacion && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3">Resultado de la Importación</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Total procesados:</span>
                      <span className="ml-2 font-bold text-gray-900">{resultadoImportacion.resumen.total}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cobrados:</span>
                      <span className="ml-2 font-bold text-green-600">{resultadoImportacion.resumen.cobrados}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Rechazados:</span>
                      <span className="ml-2 font-bold text-red-600">{resultadoImportacion.resumen.rechazados}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Monto cobrado:</span>
                      <span className="ml-2 font-bold text-green-600">
                        {formatCurrency(resultadoImportacion.resumen.montoCobrado)}
                      </span>
                    </div>
                  </div>
                  {resultadoImportacion.resumen.notificaciones && (
                    <NotifStats stats={resultadoImportacion.resumen.notificaciones} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Payway */}
          {activeTab === 'payway' && (
            <div className="space-y-6">
              {configsPayway.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900">Sin configuración Payway</p>
                      <p className="text-sm text-yellow-800 mt-1">
                        Creá una configuración con plataforma "PAYWAY" desde el tab Configuración,
                        ingresando el <strong>site_id</strong> en "Código Comercio",
                        la <strong>private key</strong> en "API Key" y la <strong>public key</strong> en "API Secret".
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Cobro via API Payway</h4>
                    <p className="text-sm text-blue-800">
                      A diferencia de PRISMA, Payway procesa cada cobro en tiempo real por API.
                      Cada socio debe tener su tarjeta tokenizada en Payway previamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Configuración Payway</label>
                      <select
                        value={configPaywayId}
                        onChange={e => setConfigPaywayId(e.target.value)}
                        className="input-field"
                      >
                        <option value="">Seleccionar...</option>
                        {configsPayway.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.procesador?.nombre} — site_id: {c.codigoComercio}
                            {c.ambiente === 'SANDBOX' ? ' (Sandbox)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Archivo de Débito</label>
                      <select
                        value={archivoPayway || ''}
                        onChange={e => setArchivoPayway(e.target.value)}
                        className="input-field"
                      >
                        <option value="">Seleccionar archivo...</option>
                        {archivos.filter(a => a.estado !== 'PROCESADO').map(a => (
                          <option key={a.id} value={a.id}>
                            {a.numero} — {a.cantidadRegistros} registros ({formatCurrency(a.montoTotal)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {tienePermiso(PERMISOS.DEBITO_AUTOMATICO) && (
                    <div className="flex justify-end">
                      <Button
                        onClick={cobrarLotePayway}
                        loading={procesandoPayway}
                        disabled={!archivoPayway || !configPaywayId}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Cobrar via Payway
                      </Button>
                    </div>
                  )}

                  {resultadoPayway && (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-3">Resultado Payway</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Total:</span>
                            <span className="ml-2 font-bold text-gray-900">{resultadoPayway.resumen.total}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Cobrados:</span>
                            <span className="ml-2 font-bold text-green-600">{resultadoPayway.resumen.cobrados}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Rechazados:</span>
                            <span className="ml-2 font-bold text-red-600">{resultadoPayway.resumen.rechazados}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Monto cobrado:</span>
                            <span className="ml-2 font-bold text-green-600">{formatCurrency(resultadoPayway.resumen.montoCobrado)}</span>
                          </div>
                        </div>
                        {resultadoPayway.resumen.notificaciones && (
                          <NotifStats stats={resultadoPayway.resumen.notificaciones} />
                        )}
                      </div>

                      {/* Detalle por socio */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Socio</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Tarjeta</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Importe</th>
                              <th className="px-4 py-2 text-center font-medium text-gray-600">Estado</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Detalle</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {resultadoPayway.detalles.map((d, i) => (
                              <tr key={i} className={d.estado === 'RECHAZADO' ? 'bg-red-50' : ''}>
                                <td className="px-4 py-2 text-gray-900">{d.nombre}</td>
                                <td className="px-4 py-2 font-mono text-gray-500">{d.tarjeta}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(d.importe)}</td>
                                <td className="px-4 py-2 text-center">
                                  {d.estado === 'COBRADO'
                                    ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                                    : <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                                  }
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-500">
                                  {d.autorizacion ? `Aut: ${d.autorizacion}` : d.motivoRechazo || ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: Respuesta Bancaria (CBU) */}
          {activeTab === 'banco' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Débito bancario por CBU</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Seleccione el banco que devuelve el archivo de respuesta</li>
                  <li>Seleccione el archivo de débito original generado</li>
                  <li>Suba el archivo de retorno del banco (texto posición fija)</li>
                  <li>Haga clic en "Procesar Respuesta Bancaria"</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banco</label>
                  <select
                    value={bancoSeleccionado}
                    onChange={(e) => setBancoSeleccionado(e.target.value)}
                    className="input-field"
                  >
                    <option value="GALICIA">Banco Galicia</option>
                    <option value="MACRO">Banco Macro</option>
                    <option value="SANTANDER">Banco Santander</option>
                    <option value="PROVINCIA">Banco Provincia</option>
                    <option value="GENERICO">Genérico (CSV/separado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivo de Débito Original
                  </label>
                  <select
                    value={archivoBancoImportar || ''}
                    onChange={(e) => setArchivoBancoImportar(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Seleccionar archivo...</option>
                    {archivos.filter(a => a.estado !== 'PROCESADO').map(a => (
                      <option key={a.id} value={a.id}>
                        {a.numero} - {a.cantidadRegistros} registros ({formatCurrency(a.montoTotal)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Archivo de Retorno del Banco
                  </label>
                  <input
                    type="file"
                    accept=".txt,.dat,.ret,.rsp,.csv"
                    onChange={handleFileBancoUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {nombreArchivoBanco && (
                    <p className="mt-1 text-xs text-gray-500">{nombreArchivoBanco}</p>
                  )}
                </div>
              </div>

              {contenidoRespuestaBanco && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vista previa (primeras líneas)
                  </label>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-40">
                    {contenidoRespuestaBanco.split('\n').slice(0, 10).join('\n')}
                    {contenidoRespuestaBanco.split('\n').length > 10 && '\n...'}
                  </pre>
                </div>
              )}

              {tienePermiso(PERMISOS.DEBITO_AUTOMATICO) && (
                <div className="flex justify-end">
                  <Button
                    onClick={importarRespuestaBanco}
                    loading={loading}
                    disabled={!archivoBancoImportar || !contenidoRespuestaBanco}
                  >
                    <Landmark className="w-4 h-4 mr-2" />
                    Procesar Respuesta Bancaria
                  </Button>
                </div>
              )}

              {resultadoImportacionBanco && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3">Resultado de la Importación Bancaria</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Total procesados:</span>
                      <span className="ml-2 font-bold text-gray-900">{resultadoImportacionBanco.resumen.total}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cobrados:</span>
                      <span className="ml-2 font-bold text-green-600">{resultadoImportacionBanco.resumen.cobrados}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Rechazados:</span>
                      <span className="ml-2 font-bold text-red-600">{resultadoImportacionBanco.resumen.rechazados}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Monto cobrado:</span>
                      <span className="ml-2 font-bold text-green-600">
                        {formatCurrency(resultadoImportacionBanco.resumen.montoCobrado)}
                      </span>
                    </div>
                  </div>
                  {resultadoImportacionBanco.resumen.notificaciones && (
                    <NotifStats stats={resultadoImportacionBanco.resumen.notificaciones} />
                  )}
                  {resultadoImportacionBanco.resumen.detalles?.filter(d => d.estado === 'RECHAZADO').length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-700 mb-2">Rechazos:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {resultadoImportacionBanco.resumen.detalles
                          .filter(d => d.estado === 'RECHAZADO')
                          .map((d, i) => (
                            <div key={i} className="text-xs text-red-800 bg-red-50 rounded px-3 py-1 flex justify-between">
                              <span>CBU ...{d.cbu}</span>
                              <span>{d.motivoRechazo || d.codigoRechazo}</span>
                              <span>{formatCurrency(d.importe)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Estadísticas */}
          {activeTab === 'estadisticas' && estadisticas && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resumen de Archivos */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-4">Archivos {estadisticas.anio}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Generados</span>
                      <span className="font-medium">{estadisticas.archivos.generados}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Enviados</span>
                      <span className="font-medium">{estadisticas.archivos.enviados}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Procesados</span>
                      <span className="font-medium">{estadisticas.archivos.procesados}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-800 font-medium">Monto Total</span>
                      <span className="font-bold text-primary">
                        {formatCurrency(estadisticas.archivos.montoTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resumen de Débitos */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-4">Débitos {estadisticas.anio}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-yellow-600">Pendientes</span>
                      <span className="font-medium">{estadisticas.detalles.pendientes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Cobrados</span>
                      <span className="font-medium">{estadisticas.detalles.cobrados}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Rechazados</span>
                      <span className="font-medium">{estadisticas.detalles.rechazados}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-800 font-medium">Monto Cobrado</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(estadisticas.detalles.montoCobrado)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Rechazos */}
              {estadisticas.rechazosPorCodigo?.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-4">Motivos de Rechazo más Frecuentes</h4>
                  <div className="space-y-2">
                    {estadisticas.rechazosPorCodigo.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-500">{r.codigoRechazo}</span>
                          <span className="text-sm text-gray-700">{r.motivoRechazo || 'Sin descripción'}</span>
                        </div>
                        <span className="text-sm font-medium text-red-600">{r._count} rechazos</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Configuración */}
          {activeTab === 'configuracion' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex-1 mr-4">
                  <h4 className="font-medium text-amber-900 mb-2">Configuración de Procesadores</h4>
                  <p className="text-sm text-amber-800">
                    Configure los procesadores de débito automático (Prisma, Payway, bancos).
                  </p>
                </div>
                <Button onClick={() => setShowNuevoProcesador(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nuevo Procesador
                </Button>
              </div>

              <div className="space-y-4">
                {configuraciones.map(config => (
                  <div key={config.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{config.procesador?.nombre}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Código: {config.procesador?.codigo} | Tipo: {config.procesador?.tipo} | Formato: {config.procesador?.formatoArchivo}
                        </p>
                        {config.codigoEmpresa && (
                          <p className="text-sm text-gray-500">
                            Código Empresa: {config.codigoEmpresa}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        config.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {config.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Archivos generados: {config._count?.archivos || 0}
                    </div>
                  </div>
                ))}

                {configuraciones.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay procesadores configurados</p>
                    <p className="text-sm mt-2">
                      Se crearán configuraciones de ejemplo al iniciar el sistema
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalle Archivo */}
      {showDetalleModal && archivoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{archivoSeleccionado.numero}</h3>
                <p className="text-sm text-gray-500">
                  {archivoSeleccionado.configuracion?.procesador?.nombre} - {archivoSeleccionado.cantidadRegistros} registros
                </p>
              </div>
              <button onClick={() => setShowDetalleModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{archivoSeleccionado.estadisticas?.pendientes || 0}</p>
                  <p className="text-sm text-yellow-800">Pendientes</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{archivoSeleccionado.estadisticas?.cobrados || 0}</p>
                  <p className="text-sm text-green-800">Cobrados</p>
                  <p className="text-xs text-green-600 mt-1">
                    {formatCurrency(archivoSeleccionado.estadisticas?.montoCobrado)}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{archivoSeleccionado.estadisticas?.rechazados || 0}</p>
                  <p className="text-sm text-red-800">Rechazados</p>
                </div>
              </div>

              {/* Tabla de detalles */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Socio</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">CBU/Tarjeta</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Importe</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {archivoSeleccionado.detalles?.map(d => (
                      <tr key={d.id}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">{d.socio?.apellidoNombre}</div>
                          <div className="text-xs text-gray-500">#{d.socio?.nroSocio}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                          {d.cbuEnviado?.slice(-8) || '****'}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium">
                          {formatCurrency(d.importeEnviado)}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={d.estado} type="pago" size="sm" />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {d.codigoRechazo && (
                            <span className="font-mono text-red-600">{d.codigoRechazo}: </span>
                          )}
                          {d.motivoRechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              {archivoSeleccionado.estado === 'GENERADO' && (
                <Button variant="outline" onClick={() => marcarEnviado(archivoSeleccionado.id)}>
                  <Send className="w-4 h-4 mr-2" />
                  Marcar como Enviado
                </Button>
              )}
              <Button variant="outline" onClick={() => descargarArchivo(archivoSeleccionado.id)}>
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
              <Button onClick={() => setShowDetalleModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ConfirmDialog */}
      <ConfirmDialog />

      {/* Modal Nuevo Procesador */}
      {showNuevoProcesador && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Nueva Configuración de Débito</h3>
              <button onClick={() => setShowNuevoProcesador(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Procesador *</label>
                <select
                  value={formProcesador.procesadorId}
                  onChange={e => setFormProcesador({ ...formProcesador, procesadorId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">Seleccioná un procesador…</option>
                  {procesadores.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.plataforma} · {p.formatoArchivo})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  El formato del archivo lo define el procesador. Acá cargás los datos de tu club.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                <select
                  value={formProcesador.ambiente}
                  onChange={e => setFormProcesador({ ...formProcesador, ambiente: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="PRODUCCION">Producción</option>
                  <option value="TEST">Test / Homologación</option>
                </select>
              </div>

              <hr className="my-4" />
              <h4 className="font-medium text-gray-700">Datos del Comercio</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Empresa</label>
                  <input
                    type="text"
                    value={formProcesador.codigoEmpresa}
                    onChange={e => setFormProcesador({ ...formProcesador, codigoEmpresa: e.target.value })}
                    className="input-field w-full"
                    placeholder="Asignado por el procesador"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código Comercio</label>
                  <input
                    type="text"
                    value={formProcesador.codigoComercio}
                    onChange={e => setFormProcesador({ ...formProcesador, codigoComercio: e.target.value })}
                    className="input-field w-full"
                    placeholder="Nro. de establecimiento"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa</label>
                  <input
                    type="text"
                    value={formProcesador.nombreEmpresa}
                    onChange={e => setFormProcesador({ ...formProcesador, nombreEmpresa: e.target.value })}
                    className="input-field w-full"
                    placeholder="Razón social"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CUIT Empresa</label>
                  <input
                    type="text"
                    value={formProcesador.cuitEmpresa}
                    onChange={e => setFormProcesador({ ...formProcesador, cuitEmpresa: e.target.value })}
                    className="input-field w-full"
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNuevoProcesador(false)}>
                Cancelar
              </Button>
              <Button onClick={guardarProcesador} loading={savingProcesador}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Guardar Procesador
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
