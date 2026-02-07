import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit, QrCode, Users, CreditCard, Activity,
  Phone, Mail, MapPin, Calendar, User, AlertCircle,
  Heart, Shield, FileText, Clock, DollarSign, X, Copy, Check, RefreshCw, ExternalLink
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function SocioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [socio, setSocio] = useState(null)
  const [cuotasPendientes, setCuotasPendientes] = useState([])
  const [resumenPagos, setResumenPagos] = useState(null)
  const [activeTab, setActiveTab] = useState('general')

  // Modal QR
  const [qrModal, setQrModal] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [copied, setCopied] = useState(false)

  // Foto
  const [fotoError, setFotoError] = useState(false)

  // Actividades
  const [mostrarTodasActividades, setMostrarTodasActividades] = useState(false)

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

  useEffect(() => {
    cargarSocio()
  }, [id])

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

  function getEstadoColor(estado) {
    const upper = estado?.toUpperCase() || ''
    if (upper.includes('VIGENT') || upper.includes('ACTIV')) {
      return 'bg-green-100 text-green-800'
    }
    if (upper.includes('BAJA') || upper.includes('INACTIV')) {
      return 'bg-red-100 text-red-800'
    }
    return 'bg-yellow-100 text-yellow-800'
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

  function formatFecha(fecha) {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  function formatMonto(monto) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto || 0)
  }

  function getQrUrl() {
    return `https://sportivo.axiomacloud.com/s/${socio?.tokenPortal}`
  }

  async function regenerarToken() {
    if (!confirm(`¿Regenerar el token? El QR actual dejara de funcionar.`)) return
    setRegenerando(true)
    try {
      const data = await api.post(`/admin/socios/${id}/regenerar-token`)
      setSocio({ ...socio, tokenPortal: data.tokenPortal })
    } catch (err) {
      setError('Error al regenerar token')
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
    if (!confirm('¿Desvincular a este socio de su familia?')) return
    setAsignandoFamilia(true)
    try {
      await api.put(`/admin/socios/${id}/familia`, {
        titularFamiliaId: null
      })
      await cargarSocio()
    } catch (err) {
      setError('Error al desvincular')
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
    if (!confirm('¿Quitar a este miembro de la familia?')) return
    setAsignandoFamilia(true)
    try {
      await api.delete(`/admin/socios/${id}/familia/miembro/${miembroId}`)
      await cargarSocio()
    } catch (err) {
      setError('Error al quitar miembro')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  // Desarmar familia (cuando soy titular)
  async function desarmarFamilia() {
    const cantidadMiembros = socio.miembrosFamilia?.length || 0
    if (!confirm(`¿Desarmar esta familia?\n\nEsto desvinculará a los ${cantidadMiembros} miembro(s) y todos pasarán a ser "Socio Unico".\n\nEsta acción no se puede deshacer.`)) {
      return
    }
    setAsignandoFamilia(true)
    try {
      await api.post(`/admin/socios/${id}/familia/desarmar`)
      await cargarSocio()
    } catch (err) {
      setError('Error al desarmar familia')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  const parentescoOptions = ['Conyuge', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Otro']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
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
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(socio.estado)}`}>
          {socio.estado}
        </span>
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
                    {formatFecha(socio.fechaNacimiento)}
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
                  <dd className="text-gray-800">{formatFecha(socio.fechaAlta)}</dd>
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

            {/* Si es Miembro de Familia - mostrar titular y opcion de cambiar */}
            {socio.titularFamilia && (
              <div>
                <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Titular de Familia
                </h3>
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Link to={`/admin/socios/${socio.titularFamilia.id}`} className="flex-1">
                    <p className="font-medium text-gray-800">{socio.titularFamilia.apellidoNombre}</p>
                    <p className="text-sm text-gray-500">
                      #{socio.titularFamilia.nroSocio}
                      {socio.parentescoTitular && ` • Parentesco: ${socio.parentescoTitular}`}
                    </p>
                  </Link>
                  <button
                    onClick={desvincularFamilia}
                    disabled={asignandoFamilia}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                  >
                    Desvincular
                  </button>
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
                    {socio.aptaFisicaVence && ` (vence ${formatFecha(socio.aptaFisicaVence)})`}
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
                            Desde {formatFecha(insc.fechaInicio)}
                            {insc.fechaFin && ` hasta ${formatFecha(insc.fechaFin)}`}
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
                  {resumenPagos?.ultimoPago ? formatFecha(resumenPagos.ultimoPago.fecha) : '-'}
                </p>
              </div>
            </div>

            <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Cuotas Pendientes
            </h3>
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
          </div>
        )}
      </div>

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">QR del Socio</span>
              <button onClick={() => setQrModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 text-center">
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
          </div>
        </div>
      )}

      {/* Modal Parentesco */}
      {parentescoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">Seleccionar Parentesco</span>
              <button
                onClick={() => {
                  setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
                  setParentescoSeleccionado('')
                }}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
