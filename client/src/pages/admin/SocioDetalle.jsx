import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit, QrCode, Users, CreditCard, Activity,
  Phone, Mail, MapPin, Calendar, User, AlertCircle,
  Heart, Shield, FileText, Clock, DollarSign, Copy, Check, RefreshCw, ExternalLink, List, PlusCircle, FileDown
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import ConceptoTesoreriaModal from '../../components/ConceptoTesoreriaModal'
import { Alert } from '../../components/Alert'
import Modal from '../../components/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function SocioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [socio, setSocio] = useState(null)
  const [cuotasPendientes, setCuotasPendientes] = useState([])
  const [resumenPagos, setResumenPagos] = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  // Cuenta Corriente
  const [mostrarCtaCte, setMostrarCtaCte] = useState(false)
  const [cuentaCorriente, setCuentaCorriente] = useState(null)
  const [loadingCtaCte, setLoadingCtaCte] = useState(false)
  const [incluirFamilia, setIncluirFamilia] = useState(false)

  // Modal QR
  const [qrModal, setQrModal] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [copied, setCopied] = useState(false)

  // Foto
  const [fotoError, setFotoError] = useState(false)

  // Modal Cargo
  const [cargoModal, setCargoModal] = useState(false)
  const [cargoForm, setCargoForm] = useState({ conceptoTesoreriaId: '', montoOriginal: '', fechaVencimiento: '', observaciones: '' })
  const [conceptosCargo, setConceptosCargo] = useState([])
  const [showNuevoConceptoCargo, setShowNuevoConceptoCargo] = useState(false)
  const [savingCargo, setSavingCargo] = useState(false)
  const [errorCargo, setErrorCargo] = useState(null)

  // Actividades
  const [mostrarTodasActividades, setMostrarTodasActividades] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(null) // pagoId en descarga

  // Familia
  const [busquedaTitular, setBusquedaTitular] = useState('')
  const [titularesEncontrados, setTitularesEncontrados] = useState([])
  const [buscandoTitular, setBuscandoTitular] = useState(false)
  const [asignandoFamilia, setAsignandoFamilia] = useState(false)
  const [parentescoModal, setParentescoModal] = useState({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
  const [parentescoSeleccionado, setParentescoSeleccionado] = useState('')
  // Para agregar miembros (cuando es titular)
  const [busquedaMiembro, setBusquedaMiembro] = useState('')
  const [miembrosEncontrados, setMiembrosEncontrados] = useState([])
  const [buscandoMiembro, setBuscandoMiembro] = useState(false)
  // Hermanos de familia (cuando soy miembro)
  const [hermanosFamilia, setHermanosFamilia] = useState([])

  useEffect(() => {
    cargarSocio()
  }, [id])

  useEffect(() => {
    if (activeTab === 'familia' && socio?.titularFamilia) {
      api.get(`/admin/socios/${socio.titularFamilia.id}`)
        .then(data => setHermanosFamilia(data.socio?.miembrosFamilia || []))
        .catch(() => {})
    }
  }, [activeTab, socio?.titularFamilia?.id])

  async function cargarSocio() {
    setLoading(true)
    setFotoError(false)
    try {
      const data = await api.get(`/admin/socios/${id}`)
      setSocio(data.socio)
      setCuotasPendientes(data.cuotasPendientes || [])
      setResumenPagos(data.resumenPagos)
    } catch (err) {
      setError('Error al cargar el socio')
    } finally {
      setLoading(false)
    }
  }

  async function cargarCuentaCorriente() {
    setLoadingCtaCte(true)
    try {
      const params = new URLSearchParams()
      if (incluirFamilia) params.append('incluirFamilia', 'true')
      const data = await api.get(`/admin/socios/${id}/cuenta-corriente?${params}`)
      setCuentaCorriente(data)
    } catch (err) {
      console.error('Error al cargar cuenta corriente:', err)
    } finally {
      setLoadingCtaCte(false)
    }
  }

  useEffect(() => {
    if (mostrarCtaCte) {
      cargarCuentaCorriente()
    }
  }, [mostrarCtaCte, incluirFamilia])

  async function descargarReciboPdf(pagoId) {
    setDescargandoPdf(pagoId)
    try {
      const token = localStorage.getItem('adminToken')
      const apiUrl = import.meta.env.VITE_API_URL || '/api'
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const hostname = window.location.hostname
      const tenantMatch = hostname.match(/^([^.]+)\.localhost/) || (hostname.split('.').length > 2 ? [null, hostname.split('.')[0]] : null)
      if (tenantMatch) headers['X-Tenant-Slug'] = tenantMatch[1]
      const stored = localStorage.getItem('superadmin_tenant_slug')
      if (!tenantMatch && stored) headers['X-Tenant-Slug'] = stored

      const response = await fetch(`${apiUrl}/admin/pagos/${pagoId}/recibo-pdf`, { headers })
      if (!response.ok) throw new Error('Error al obtener el PDF')
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `recibo-${pagoId}.pdf`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => window.URL.revokeObjectURL(url), 5000)
    } catch (err) {
      toast.error('Error al descargar el recibo')
    } finally {
      setDescargandoPdf(null)
    }
  }

  function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null
    const hoy = new Date()
    const nacimiento = new Date(fechaNacimiento)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--
    }
    return edad
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto || 0)
  }

  function getQrUrl() {
    return `${window.location.origin}/s/${socio?.tokenPortal}`
  }

  async function regenerarToken() {
    const confirmed = await confirm('Regenerar token', 'El QR actual dejara de funcionar. ¿Desea continuar?', { variant: 'warning', confirmText: 'Regenerar' })
    if (!confirmed) return
    setRegenerando(true)
    try {
      const data = await api.post(`/admin/socios/${id}/regenerar-token`)
      setSocio({ ...socio, tokenPortal: data.tokenPortal })
      toast.success('Token regenerado correctamente')
    } catch (err) {
      toast.error('Error al regenerar token')
    } finally {
      setRegenerando(false)
    }
  }

  function copiarLink() {
    navigator.clipboard.writeText(getQrUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Buscar titulares de familia
  async function buscarTitulares(query) {
    setBusquedaTitular(query)
    if (query.length < 2) {
      setTitularesEncontrados([])
      return
    }
    setBuscandoTitular(true)
    try {
      const data = await api.get(`/admin/socios/titulares/buscar?q=${encodeURIComponent(query)}`)
      setTitularesEncontrados(data.filter(t => t.id !== socio.id))
    } catch (err) {
      console.error('Error buscando titulares:', err)
    } finally {
      setBuscandoTitular(false)
    }
  }

  // Asignar titular de familia
  async function asignarTitular(titular, parentesco) {
    setAsignandoFamilia(true)
    try {
      await api.put(`/admin/socios/${id}/familia`, {
        titularFamiliaId: titular.id,
        parentescoTitular: parentesco
      })
      await cargarSocio()
      setParentescoModal({ open: false, titular: null })
      setParentescoSeleccionado('')
      setBusquedaTitular('')
      setTitularesEncontrados([])
    } catch (err) {
      setError('Error al asignar titular')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  // Desvincular de familia
  async function desvincularFamilia() {
    const confirmed = await confirm('Desvincular de familia', '¿Desvincular a este socio de su familia?', { variant: 'danger', confirmText: 'Desvincular' })
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.put(`/admin/socios/${id}/familia`, {
        titularFamiliaId: null
      })
      await cargarSocio()
      toast.success('Socio desvinculado de la familia')
    } catch (err) {
      toast.error('Error al desvincular')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  // Buscar socios para agregar como miembros (cuando soy titular)
  async function buscarMiembros(query) {
    setBusquedaMiembro(query)
    if (query.length < 2) {
      setMiembrosEncontrados([])
      return
    }
    setBuscandoMiembro(true)
    try {
      const data = await api.get(`/admin/socios/miembros/buscar?q=${encodeURIComponent(query)}&titularId=${id}`)
      setMiembrosEncontrados(data)
    } catch (err) {
      console.error('Error buscando miembros:', err)
    } finally {
      setBuscandoMiembro(false)
    }
  }

  // Agregar miembro a mi familia (cuando soy titular)
  async function agregarMiembro(socioAAgregar, parentesco) {
    setAsignandoFamilia(true)
    try {
      await api.post(`/admin/socios/${id}/familia/miembro`, {
        socioId: socioAAgregar.id,
        parentesco
      })
      await cargarSocio()
      setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
      setParentescoSeleccionado('')
      setBusquedaMiembro('')
      setMiembrosEncontrados([])
    } catch (err) {
      setError('Error al agregar miembro')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  // Quitar miembro de mi familia (cuando soy titular)
  async function quitarMiembro(miembroId) {
    const confirmed = await confirm('Quitar miembro', '¿Quitar a este miembro de la familia?', { variant: 'danger', confirmText: 'Quitar' })
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.delete(`/admin/socios/${id}/familia/miembro/${miembroId}`)
      await cargarSocio()
      toast.success('Miembro quitado de la familia')
    } catch (err) {
      toast.error('Error al quitar miembro')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  // Desarmar familia (cuando soy titular)
  async function desarmarFamilia() {
    const cantidadMiembros = socio.miembrosFamilia?.length || 0
    const confirmed = await confirm(
      'Desarmar familia',
      `Esto desvinculara a los ${cantidadMiembros} miembro(s) y todos pasaran a ser "Socio Unico". Esta accion no se puede deshacer.`,
      { variant: 'danger', confirmText: 'Desarmar' }
    )
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.post(`/admin/socios/${id}/familia/desarmar`)
      await cargarSocio()
      toast.success('Familia desarmada correctamente')
    } catch (err) {
      toast.error('Error al desarmar familia')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  async function abrirCargoModal() {
    setCargoForm({ conceptoTesoreriaId: '', montoOriginal: '', fechaVencimiento: new Date().toISOString().split('T')[0], observaciones: '' })
    setErrorCargo(null)
    try {
      const res = await api.getFull('/admin/conceptos-tesoreria')
      setConceptosCargo(res.data || [])
    } catch {
      setConceptosCargo([])
    }
    setCargoModal(true)
  }

  async function handleGuardarCargo() {
    if (!cargoForm.conceptoTesoreriaId || !cargoForm.montoOriginal) {
      setErrorCargo('Concepto y monto son requeridos')
      return
    }
    setSavingCargo(true)
    setErrorCargo(null)
    try {
      await api.post('/admin/cargos', {
        socioId: parseInt(id),
        conceptoTesoreriaId: parseInt(cargoForm.conceptoTesoreriaId),
        montoOriginal: parseFloat(cargoForm.montoOriginal),
        fechaVencimiento: cargoForm.fechaVencimiento || undefined,
        observaciones: cargoForm.observaciones || undefined,
      })
      toast.success('Cargo generado correctamente')
      setCargoModal(false)
      cargarSocio()
    } catch (err) {
      setErrorCargo(err.message || 'Error al generar el cargo')
    } finally {
      setSavingCargo(false)
    }
  }

  const parentescoOptions = ['Conyuge', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Otro']

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  if (error || !socio) {
    return (
      <div>
        <Alert type="error">{error || 'Socio no encontrado'}</Alert>
        <Button variant="secondary" onClick={() => navigate('/admin/socios')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'contacto', label: 'Contacto', icon: Phone },
    { id: 'medico', label: 'Medico', icon: Heart },
    { id: 'debito', label: 'Debito', icon: CreditCard },
    { id: 'actividades', label: 'Actividades', icon: Activity },
    { id: 'cuotas', label: 'Cuotas', icon: DollarSign },
    { id: 'familia', label: 'Familia', icon: Users },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin/socios')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {socio.fotoUrl && !fotoError ? (
              <img
                src={socio.fotoUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover"
                onError={() => setFotoError(true)}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {socio.apellidoNombre?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{socio.apellidoNombre}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>#{socio.nroSocio}</span>
                <span>•</span>
                <span>DNI: {socio.documento || '-'}</span>
                {socio.esMenor && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600">
                      Menor ({calcularEdad(socio.fechaNacimiento)} años)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setQrModal(true)} className="flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR
          </Button>
          <Button variant="secondary" onClick={abrirCargoModal} className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            Cargo
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/admin/cuotas?cobrarSocioId=${id}`)} className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Cobrar
          </Button>
          {tienePermiso(PERMISOS.SOCIOS_EDITAR) && (
            <Button onClick={() => navigate(`/admin/socios/${id}/editar`)} className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Estado y badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <StatusBadge status={socio.estado} type="socio" size="md" />
        {(socio.tipoSocio?.toLowerCase().includes('titular') || socio.miembrosFamilia?.length > 0) && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
            <Users className="w-4 h-4" />
            Titular Familia ({socio.miembrosFamilia?.length || 0} miembros)
          </span>
        )}
        {socio.titularFamilia && (
          <Link
            to={`/admin/socios/${socio.titularFamilia.id}`}
            className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 flex items-center gap-1 hover:bg-purple-200"
          >
            <Users className="w-4 h-4" />
            Miembro de: {socio.titularFamilia.apellidoNombre}
          </Link>
        )}
        {socio.enviaDebito && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            Debito activo
          </span>
        )}
        {socio.esMenor && socio.responsable && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Responsable: {socio.responsable.apellidoNombre}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Tab General */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-800 mb-4">Datos Personales</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nombre completo</dt>
                  <dd className="text-gray-800">{socio.apellidoNombre}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Documento</dt>
                  <dd className="text-gray-800">{socio.tipoDocumento} {socio.documento || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">CUIL</dt>
                  <dd className="text-gray-800">{socio.cuil || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fecha de nacimiento</dt>
                  <dd className="text-gray-800">
                    {formatDate(socio.fechaNacimiento)}
                    {socio.fechaNacimiento && ` (${calcularEdad(socio.fechaNacimiento)} años)`}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Sexo</dt>
                  <dd className="text-gray-800">{socio.sexo || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nacionalidad</dt>
                  <dd className="text-gray-800">{socio.nacionalidad || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Estado civil</dt>
                  <dd className="text-gray-800">{socio.estadoCivil || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Profesion</dt>
                  <dd className="text-gray-800">{socio.profesion || '-'}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-4">Datos del Club</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nro. Socio</dt>
                  <dd className="text-gray-800 font-medium">#{socio.nroSocio}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Categoria</dt>
                  <dd className="text-gray-800">{socio.categoria || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tipo de socio</dt>
                  <dd className="text-gray-800">{socio.tipoSocio || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fecha de alta</dt>
                  <dd className="text-gray-800">{formatDate(socio.fechaAlta)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Zona</dt>
                  <dd className="text-gray-800">{socio.zona || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Libro/Folio</dt>
                  <dd className="text-gray-800">{socio.libro && socio.folio ? `${socio.libro}/${socio.folio}` : '-'}</dd>
                </div>
                {socio.cobrador && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cobrador</dt>
                    <dd className="text-gray-800">{socio.cobrador.nombre}</dd>
                  </div>
                )}
              </dl>
              {socio.observaciones && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Observaciones</p>
                  <p className="text-gray-800">{socio.observaciones}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Familia */}
        {activeTab === 'familia' && (
          <div className="space-y-6">
            {/* Si es Titular de Familia - mostrar miembros y buscador para agregar */}
            {(socio.tipoSocio?.toLowerCase().includes('titular') || socio.miembrosFamilia?.length > 0) && (
              <div>
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Miembros de la Familia ({socio.miembrosFamilia?.length || 0})
                </h3>
                {socio.miembrosFamilia?.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {socio.miembrosFamilia.map(miembro => (
                      <div
                        key={miembro.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <Link to={`/admin/socios/${miembro.id}`} className="flex-1 hover:text-primary">
                          <p className="font-medium text-gray-800">{miembro.apellidoNombre}</p>
                          <p className="text-sm text-gray-500">
                            #{miembro.nroSocio}
                            {miembro.parentescoTitular && ` • ${miembro.parentescoTitular}`}
                          </p>
                        </Link>
                        <button
                          onClick={() => quitarMiembro(miembro.id)}
                          disabled={asignandoFamilia}
                          className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 mb-4">No hay miembros asociados a esta familia</p>
                )}

                {/* Botón desarmar familia */}
                {socio.miembrosFamilia?.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={desarmarFamilia}
                      disabled={asignandoFamilia}
                      className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >
                      Desarmar Familia
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Todos los miembros pasarán a ser "Socio Unico"
                    </p>
                  </div>
                )}

                {/* Buscador para agregar miembros */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Agregar miembro</h4>
                  <div className="relative">
                    <input
                      type="text"
                      value={busquedaMiembro}
                      onChange={(e) => buscarMiembros(e.target.value)}
                      placeholder="Buscar socio por nombre, DNI o nro. socio..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    {buscandoMiembro && (
                      <div className="absolute right-3 top-2">
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  {miembrosEncontrados.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                      {miembrosEncontrados.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setParentescoModal({ open: true, titular: null, socioAAgregar: s, modo: 'agregar' })}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-left">
                            <p className="font-medium text-gray-800">{s.apellidoNombre}</p>
                            <p className="text-sm text-gray-500">#{s.nroSocio}</p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                            Agregar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Si es Miembro de Familia - mostrar grupo familiar completo */}
            {socio.titularFamilia && (
              <div>
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Grupo Familiar ({1 + hermanosFamilia.length} integrantes)
                </h3>
                <div className="space-y-2">
                  {/* Titular */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <Link to={`/admin/socios/${socio.titularFamilia.id}`} className="flex-1 hover:text-primary">
                      <p className="font-medium text-gray-800">{socio.titularFamilia.apellidoNombre}</p>
                      <p className="text-sm text-gray-500">#{socio.titularFamilia.nroSocio}</p>
                    </Link>
                    <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full font-medium">Titular</span>
                  </div>
                  {/* Otros miembros del grupo (hermanos) */}
                  {hermanosFamilia.filter(m => m.id !== socio.id).map(miembro => (
                    <div key={miembro.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <Link to={`/admin/socios/${miembro.id}`} className="flex-1 hover:text-primary">
                        <p className="font-medium text-gray-800">{miembro.apellidoNombre}</p>
                        <p className="text-sm text-gray-500">
                          #{miembro.nroSocio}
                          {miembro.parentescoTitular && ` • ${miembro.parentescoTitular}`}
                        </p>
                      </Link>
                    </div>
                  ))}
                  {/* Socio actual (yo) */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{socio.apellidoNombre}</p>
                      <p className="text-sm text-gray-500">
                        #{socio.nroSocio}
                        {socio.parentescoTitular && ` • ${socio.parentescoTitular}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-medium">Este socio</span>
                      <button
                        onClick={desvincularFamilia}
                        disabled={asignandoFamilia}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                      >
                        Desvincular
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Buscar y asignar titular (solo si no es titular y no tiene titular asignado) */}
            {!socio.tipoSocio?.toLowerCase().includes('titular') && !socio.titularFamilia && socio.miembrosFamilia?.length === 0 && (
              <div>
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Asignar a Familia
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    value={busquedaTitular}
                    onChange={(e) => buscarTitulares(e.target.value)}
                    placeholder="Buscar titular por nombre, DNI o nro. socio..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  {buscandoTitular && (
                    <div className="absolute right-3 top-2">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                {titularesEncontrados.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    {titularesEncontrados.map(titular => (
                      <button
                        key={titular.id}
                        onClick={() => setParentescoModal({ open: true, titular, socioAAgregar: null, modo: 'asignar' })}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-left">
                          <p className="font-medium text-gray-800">{titular.apellidoNombre}</p>
                          <p className="text-sm text-gray-500">
                            #{titular.nroSocio} • {titular.cantidadMiembros} miembros
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                          Seleccionar
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {busquedaTitular === '' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                    <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Este socio no pertenece a ninguna familia</p>
                    <p className="text-sm text-gray-400">Usa el buscador para asignarlo a un titular</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Contacto */}
        {activeTab === 'contacto' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4" /> Telefonos y Email
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Celular</dt>
                  <dd className="text-gray-800">{socio.celular || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Celular secundario</dt>
                  <dd className="text-gray-800">{socio.celularSecundario || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Telefono fijo</dt>
                  <dd className="text-gray-800">{socio.telefonoFijo || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-800">{socio.email || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email secundario</dt>
                  <dd className="text-gray-800">{socio.emailSecundario || '-'}</dd>
                </div>
              </dl>
              {/* Canales de notificación */}
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notificaciones</p>
                <div className="flex gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${socio.notifEmail !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Email {socio.notifEmail !== false ? 'activo' : 'desactivado'}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${socio.notifWhatsapp !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    WhatsApp {socio.notifWhatsapp !== false ? 'activo' : 'desactivado'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Domicilio
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Direccion</dt>
                  <dd className="text-gray-800">{socio.domicilio || socio.calle || '-'}</dd>
                </div>
                {socio.numero && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Numero</dt>
                    <dd className="text-gray-800">{socio.numero}</dd>
                  </div>
                )}
                {(socio.piso || socio.depto) && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Piso/Depto</dt>
                    <dd className="text-gray-800">{socio.piso} {socio.depto}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Barrio</dt>
                  <dd className="text-gray-800">{socio.barrio || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Ciudad</dt>
                  <dd className="text-gray-800">{socio.ciudad || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Provincia</dt>
                  <dd className="text-gray-800">{socio.provincia || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Codigo postal</dt>
                  <dd className="text-gray-800">{socio.codigoPostal || '-'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Tab Medico */}
        {activeTab === 'medico' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex justify-end mb-2">
              <button
                onClick={() => navigate(`/admin/socios/${id}/medico`)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition"
              >
                <Heart className="w-4 h-4" />
                Seguimiento médico completo
              </button>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4" /> Datos Medicos
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Grupo sanguineo</dt>
                  <dd className="text-gray-800">{socio.grupoSanguineo || '-'} {socio.factorRh || ''}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Obra social</dt>
                  <dd className="text-gray-800">{socio.obraSocial || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nro. afiliado</dt>
                  <dd className="text-gray-800">{socio.nroObraSocial || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Apta fisica</dt>
                  <dd className={socio.aptaFisicaVigente ? 'text-green-600' : 'text-red-600'}>
                    {socio.aptaFisicaVigente ? 'Vigente' : 'Vencida/Sin presentar'}
                    {socio.aptaFisicaVence && ` (vence ${formatDate(socio.aptaFisicaVence)})`}
                  </dd>
                </div>
              </dl>
              {socio.alergias && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600 font-medium mb-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Alergias
                  </p>
                  <p className="text-red-800">{socio.alergias}</p>
                </div>
              )}
              {socio.condicionesMedicas && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-700 font-medium mb-1">Condiciones medicas</p>
                  <p className="text-yellow-800">{socio.condicionesMedicas}</p>
                </div>
              )}
              {socio.medicamentos && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium mb-1">Medicamentos</p>
                  <p className="text-blue-800">{socio.medicamentos}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4" /> Contactos de Emergencia
              </h3>
              {socio.emergenciaNombre1 ? (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-800">{socio.emergenciaNombre1}</p>
                    <p className="text-sm text-gray-500">{socio.emergenciaParent1 || 'Familiar'}</p>
                    <p className="text-primary font-medium">{socio.emergenciaTel1}</p>
                  </div>
                  {socio.emergenciaNombre2 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-800">{socio.emergenciaNombre2}</p>
                      <p className="text-sm text-gray-500">{socio.emergenciaParent2 || 'Familiar'}</p>
                      <p className="text-primary font-medium">{socio.emergenciaTel2}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No hay contactos de emergencia registrados</p>
              )}
            </div>
          </div>
        )}

        {/* Tab Debito */}
        {activeTab === 'debito' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Configuracion de Debito
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Forma de pago preferida</dt>
                  <dd className="text-gray-800">{socio.formaPagoPref || 'MOSTRADOR'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Envia debito</dt>
                  <dd className={socio.enviaDebito ? 'text-green-600 font-medium' : 'text-gray-800'}>
                    {socio.enviaDebito ? 'Si' : 'No'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tipo de debito</dt>
                  <dd className="text-gray-800">{socio.debitoTipo || '-'}</dd>
                </div>
              </dl>
            </div>
            <div>
              {socio.debitoTipo === 'CBU' && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-4">Datos Bancarios</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Banco</dt>
                      <dd className="text-gray-800">{socio.bancoDebito || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">CBU</dt>
                      <dd className="text-gray-800 font-mono">{socio.cbuDebito || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Alias</dt>
                      <dd className="text-gray-800">{socio.aliasDebito || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Titular</dt>
                      <dd className="text-gray-800">{socio.titularCuenta || '-'}</dd>
                    </div>
                  </dl>
                </div>
              )}
              {socio.debitoTipo === 'TARJETA' && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-4">Datos de Tarjeta</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Marca</dt>
                      <dd className="text-gray-800">{socio.tarjetaMarca || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Numero</dt>
                      <dd className="text-gray-800 font-mono">{socio.tarjetaNumero || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Vencimiento</dt>
                      <dd className="text-gray-800">{socio.tarjetaVencimiento || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Titular</dt>
                      <dd className="text-gray-800">{socio.titularCuenta || '-'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Actividades */}
        {activeTab === 'actividades' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {mostrarTodasActividades ? 'Todas las Actividades' : 'Actividades Activas'}
              </h3>
              <button
                onClick={() => setMostrarTodasActividades(!mostrarTodasActividades)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                {mostrarTodasActividades ? 'Ver solo activas' : 'Ver historial completo'}
              </button>
            </div>
            {(() => {
              const inscripcionesFiltradas = mostrarTodasActividades
                ? socio.inscripciones
                : socio.inscripciones?.filter(i => i.estado === 'ACTIVA')

              return inscripcionesFiltradas?.length > 0 ? (
                <div className="space-y-3">
                  {inscripcionesFiltradas.map(insc => (
                    <div key={insc.id} className={`p-4 rounded-lg flex justify-between items-start ${
                      insc.estado === 'ACTIVA' ? 'bg-gray-50' : 'bg-gray-100 border border-gray-300'
                    }`}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {insc.categoriaActividad?.actividad?.nombre} - {insc.categoriaActividad?.nombre}
                        </p>
                        <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                          <p>
                            Desde {formatDate(insc.fechaInicio)}
                            {insc.fechaFin && ` hasta ${formatDate(insc.fechaFin)}`}
                          </p>
                          {(insc.becado || insc.federado || insc.exentoCuota) && (
                            <p className="flex gap-2 flex-wrap">
                              {insc.becado && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Becado</span>}
                              {insc.federado && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Federado</span>}
                              {insc.exentoCuota && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Exento de cuota</span>}
                            </p>
                          )}
                          {insc.motivoFin && (
                            <p className="text-gray-600 italic">
                              Motivo de baja: {insc.motivoFin}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                        insc.estado === 'ACTIVA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {insc.estado}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">
                  {mostrarTodasActividades
                    ? 'No tiene actividades registradas'
                    : 'No tiene actividades activas'}
                </p>
              )
            })()}
          </div>
        )}

        {/* Tab Cuotas */}
        {activeTab === 'cuotas' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total pagado</p>
                <p className="text-2xl font-bold text-gray-800">{formatMonto(resumenPagos?.montoTotal)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Pagos realizados</p>
                <p className="text-2xl font-bold text-gray-800">{resumenPagos?.totalPagos || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Ultimo pago</p>
                <p className="text-2xl font-bold text-gray-800">
                  {resumenPagos?.ultimoPago ? formatDate(resumenPagos.ultimoPago.fecha) : '-'}
                </p>
              </div>
            </div>

            {/* Toggle Cuotas Pendientes / Cuenta Corriente */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                {mostrarCtaCte ? (
                  <><List className="w-4 h-4" /> Cuenta Corriente</>
                ) : (
                  <><Clock className="w-4 h-4" /> Cuotas Pendientes</>
                )}
              </h3>
              <button
                onClick={() => setMostrarCtaCte(!mostrarCtaCte)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                {mostrarCtaCte ? 'Ver solo pendientes' : 'Ver Cuenta Corriente'}
              </button>
            </div>

            {/* Vista Cuotas Pendientes */}
            {!mostrarCtaCte && (
              <>
                {cuotasPendientes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Periodo</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Recargo</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cuotasPendientes.map(cuota => (
                          <tr key={cuota.id}>
                            <td className="px-4 py-3 text-gray-800">
                              {cuota.periodo?.nombre || `${cuota.periodo?.mes}/${cuota.periodo?.anio}`}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{cuota.tipoCuota?.nombre}</td>
                            <td className="px-4 py-3 text-right text-gray-800">{formatMonto(cuota.montoOriginal)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{formatMonto(cuota.montoRecargo)}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-800">{formatMonto(cuota.montoTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No tiene cuotas pendientes</p>
                )}
              </>
            )}

            {/* Vista Cuenta Corriente */}
            {mostrarCtaCte && (
              <div>
                {/* Opciones */}
                {(socio.tipoSocio?.toLowerCase().includes('titular') || socio.miembrosFamilia?.length > 0) && (
                  <div className="flex items-center gap-2 mb-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={incluirFamilia}
                        onChange={(e) => setIncluirFamilia(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      Incluir miembros de familia
                    </label>
                  </div>
                )}

                {loadingCtaCte ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : cuentaCorriente ? (
                  <>
                    {/* Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs text-red-600">Total Cargos</p>
                        <p className="text-lg font-bold text-red-700">{formatMonto(cuentaCorriente.resumen?.totalDebe)}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-green-600">Total Pagos</p>
                        <p className="text-lg font-bold text-green-700">{formatMonto(cuentaCorriente.resumen?.totalHaber)}</p>
                      </div>
                      <div className={`p-3 rounded-lg border ${cuentaCorriente.resumen?.saldoActual > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <p className={`text-xs ${cuentaCorriente.resumen?.saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Actual</p>
                        <p className={`text-lg font-bold ${cuentaCorriente.resumen?.saldoActual > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {formatMonto(Math.abs(cuentaCorriente.resumen?.saldoActual || 0))}
                          {cuentaCorriente.resumen?.saldoActual < 0 && ' a favor'}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500">Movimientos</p>
                        <p className="text-lg font-bold text-gray-700">{cuentaCorriente.movimientos?.length || 0}</p>
                      </div>
                    </div>

                    {/* Tabla de movimientos */}
                    {cuentaCorriente.movimientos?.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Concepto</th>
                              {incluirFamilia && (
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Socio</th>
                              )}
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Debe</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Haber</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Saldo</th>
                              <th className="px-3 py-2 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {cuentaCorriente.movimientos.map((mov, idx) => (
                              <tr key={idx} className={mov.tipo === 'CARGO' ? 'bg-white' : 'bg-green-50'}>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(mov.fecha)}</td>
                                <td className="px-3 py-2 text-gray-800">{mov.concepto}</td>
                                {incluirFamilia && (
                                  <td className="px-3 py-2 text-gray-600 text-xs">{mov.socio?.apellidoNombre || mov.socioNombre}</td>
                                )}
                                <td className="px-3 py-2 text-right text-red-600 font-medium">
                                  {mov.debe > 0 ? formatMonto(mov.debe) : ''}
                                </td>
                                <td className="px-3 py-2 text-right text-green-600 font-medium">
                                  {mov.haber > 0 ? formatMonto(mov.haber) : ''}
                                </td>
                                <td className={`px-3 py-2 text-right font-medium ${mov.saldo > 0 ? 'text-red-600' : mov.saldo < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                  {formatMonto(Math.abs(mov.saldo))}
                                  {mov.saldo < 0 && ' (F)'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {mov.tipo === 'PAGO' && mov.pagoId && (
                                    <button
                                      onClick={() => descargarReciboPdf(mov.pagoId)}
                                      disabled={descargandoPdf === mov.pagoId}
                                      title="Ver recibo PDF"
                                      className="p-1 rounded hover:bg-green-100 text-green-600 disabled:opacity-40 transition-colors"
                                    >
                                      {descargandoPdf === mov.pagoId
                                        ? <span className="inline-block w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                                        : <FileDown className="w-3.5 h-3.5" />
                                      }
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500">No hay movimientos registrados</p>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal QR */}
      <Modal
        isOpen={qrModal}
        onClose={() => setQrModal(false)}
        title="QR del Socio"
        maxWidth="max-w-md"
      >
        <div className="text-center">
          <p className="text-gray-800 font-semibold text-lg mb-1">{socio.apellidoNombre}</p>
          <p className="text-sm text-gray-500 mb-4">#{socio.nroSocio}</p>
          <div className="inline-block bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <QRCodeSVG value={getQrUrl()} size={180} level="H" includeMargin={true} />
          </div>
          <div className="mb-4">
            <p className="text-gray-500 text-sm mb-2">Link del portal:</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <input type="text" readOnly value={getQrUrl()} className="flex-1 bg-transparent text-sm text-gray-600 outline-none truncate" />
              <button onClick={copiarLink} className="p-2 rounded hover:bg-gray-200 transition">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
              <a href={getQrUrl()} target="_blank" rel="noopener noreferrer" className="p-2 rounded hover:bg-gray-200 transition">
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>
            </div>
          </div>
          <Button variant="secondary" onClick={regenerarToken} loading={regenerando} className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Regenerar Token
          </Button>
          <p className="text-gray-400 text-xs mt-3">Regenerar invalidara el QR actual</p>
        </div>
      </Modal>

      {/* Modal Parentesco */}
      <Modal
        isOpen={parentescoModal.open}
        onClose={() => {
          setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
          setParentescoSeleccionado('')
        }}
        title="Seleccionar Parentesco"
        maxWidth="max-w-md"
      >
        {parentescoModal.modo === 'asignar' ? (
          <p className="text-sm text-gray-500 mb-3">
            Asignando a familia de: <span className="font-medium text-gray-800">{parentescoModal.titular?.apellidoNombre}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            Agregando a: <span className="font-medium text-gray-800">{parentescoModal.socioAAgregar?.apellidoNombre}</span>
          </p>
        )}
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Parentesco con el titular
        </label>
        <select
          value={parentescoSeleccionado}
          onChange={(e) => setParentescoSeleccionado(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">Seleccionar...</option>
          {parentescoOptions.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
              setParentescoSeleccionado('')
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (parentescoModal.modo === 'asignar') {
                asignarTitular(parentescoModal.titular, parentescoSeleccionado)
              } else {
                agregarMiembro(parentescoModal.socioAAgregar, parentescoSeleccionado)
              }
            }}
            disabled={!parentescoSeleccionado || asignandoFamilia}
            loading={asignandoFamilia}
          >
            {parentescoModal.modo === 'asignar' ? 'Asignar' : 'Agregar'}
          </Button>
        </div>
      </Modal>
      {/* Modal Generar Cargo */}
      <ConceptoTesoreriaModal
        isOpen={showNuevoConceptoCargo}
        onClose={() => setShowNuevoConceptoCargo(false)}
        onCreated={(c) => {
          setConceptosCargo(prev => [...prev, c])
          setCargoForm(prev => ({ ...prev, conceptoTesoreriaId: String(c.id) }))
          setShowNuevoConceptoCargo(false)
        }}
        tipoDefault="INGRESO"
      />
      <Modal
        isOpen={cargoModal}
        onClose={() => setCargoModal(false)}
        title="Generar Cargo"
        maxWidth="max-w-md"
      >
        {errorCargo && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {errorCargo}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
            <div className="flex gap-2">
              <select
                value={cargoForm.conceptoTesoreriaId}
                onChange={(e) => setCargoForm(prev => ({ ...prev, conceptoTesoreriaId: e.target.value }))}
                className="input-field flex-1"
              >
                <option value="">Seleccionar concepto...</option>
                {conceptosCargo.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNuevoConceptoCargo(true)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
                title="Crear nuevo concepto"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
            <input
              type="number"
              value={cargoForm.montoOriginal}
              onChange={(e) => setCargoForm(prev => ({ ...prev, montoOriginal: e.target.value }))}
              className="input-field w-full"
              step="0.01"
              min="0.01"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
            <input
              type="date"
              value={cargoForm.fechaVencimiento}
              onChange={(e) => setCargoForm(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={cargoForm.observaciones}
              onChange={(e) => setCargoForm(prev => ({ ...prev, observaciones: e.target.value }))}
              className="input-field w-full"
              rows={2}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setCargoModal(false)} disabled={savingCargo}>
            Cancelar
          </Button>
          <Button onClick={handleGuardarCargo} loading={savingCargo}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Generar Cargo
          </Button>
        </div>
      </Modal>

      <ConfirmDialog />
    </div>
  )
}
