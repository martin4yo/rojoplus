import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Upload, QrCode, ExternalLink, RefreshCw, X, Copy, Check,
  Plus, Eye, Edit, Users, CreditCard, Search, Filter, ChevronDown, DollarSign,
  UserCheck, ChevronRight
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import StatusBadge from '../../components/StatusBadge'
import Pagination from '../../components/Pagination'
import Table from '../../components/Table'
import { useConfirm } from '../../hooks/useConfirm'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import { usePagination } from '../../hooks/usePagination'
import ChatWidget from '../../components/chat/ChatWidget'
import LoadingSpinner from '../../components/LoadingSpinner'

// Componente Avatar con fallback si la imagen no carga
function AvatarSocio({ foto, nombre }) {
  const [error, setError] = useState(false)
  const inicial = nombre?.charAt(0) || '?'

  if (!foto || error) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
        {inicial}
      </div>
    )
  }

  return (
    <img
      src={foto}
      alt={nombre}
      className="w-10 h-10 rounded-full object-cover bg-gray-200"
      onError={() => setError(true)}
    />
  )
}

export default function AdminSocios() {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [vista, setVista] = useState('socios') // 'socios' | 'grupos'
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [estado, setEstado] = useState('VIGENTE')
  const [categoria, setCategoria] = useState('')
  const [tipoSocio, setTipoSocio] = useState('')
  const [zona, setZona] = useState('')
  const [esMenor, setEsMenor] = useState('')
  const { page, pagination, setPagination, goToPage } = usePagination()
  const [filtros, setFiltros] = useState({ estados: [], categorias: [], tiposSocio: [], zonas: [] })
  const [showFilters, setShowFilters] = useState(false)

  // Estado para grupos familiares
  const [grupos, setGrupos] = useState([])
  const [loadingGrupos, setLoadingGrupos] = useState(false)
  const [busquedaGrupos, setBusquedaGrupos] = useState('')
  const [terminoBusquedaGrupos, setTerminoBusquedaGrupos] = useState('')
  const [pageGrupos, setPageGrupos] = useState(1)
  const [paginationGrupos, setPaginationGrupos] = useState(null)
  const [expandidos, setExpandidos] = useState(new Set())
  const [showFiltersGrupos, setShowFiltersGrupos] = useState(false)
  const [estadoGrupos, setEstadoGrupos] = useState('')
  const [categoriaGrupos, setCategoriaGrupos] = useState('')
  const [tipoSocioGrupos, setTipoSocioGrupos] = useState('')
  const [zonaGrupos, setZonaGrupos] = useState('')

  // Modal QR
  const [qrModal, setQrModal] = useState(null)
  const [regenerando, setRegenerando] = useState(false)
  const [copied, setCopied] = useState(false)

  // Debounce para búsqueda automática
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerminoBusqueda(busqueda)
    }, 500) // Esperar 500ms después de que el usuario deje de escribir

    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    cargarSocios()
  }, [page, estado, categoria, tipoSocio, zona, esMenor, terminoBusqueda])

  async function cargarSocios() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (terminoBusqueda) params.append('q', terminoBusqueda)
      if (estado) params.append('estado', estado)
      if (categoria) params.append('categoria', categoria)
      if (tipoSocio) params.append('tipoSocio', tipoSocio)
      if (zona) params.append('zona', zona)
      if (esMenor) params.append('esMenor', esMenor)
      const response = await api.getFull(`/admin/socios?${params}`)
      setSocios(response.data.socios || [])
      setPagination(response.data.pagination)
      if (response.data.filtros) setFiltros(response.data.filtros)
    } catch (err) {
      setError('Error al cargar socios')
      console.error('Error cargando socios:', err)
    } finally {
      setLoading(false)
    }
  }

  // Debounce para búsqueda de grupos
  useEffect(() => {
    const timer = setTimeout(() => setTerminoBusquedaGrupos(busquedaGrupos), 500)
    return () => clearTimeout(timer)
  }, [busquedaGrupos])

  useEffect(() => {
    if (vista === 'grupos') cargarGrupos()
  }, [vista, pageGrupos, terminoBusquedaGrupos, estadoGrupos, categoriaGrupos, tipoSocioGrupos, zonaGrupos])

  async function cargarGrupos() {
    setLoadingGrupos(true)
    try {
      const params = new URLSearchParams({ page: pageGrupos.toString() })
      if (terminoBusquedaGrupos) params.append('q', terminoBusquedaGrupos)
      if (estadoGrupos) params.append('estado', estadoGrupos)
      if (categoriaGrupos) params.append('categoria', categoriaGrupos)
      if (tipoSocioGrupos) params.append('tipoSocio', tipoSocioGrupos)
      if (zonaGrupos) params.append('zona', zonaGrupos)
      const response = await api.getFull(`/admin/socios/grupos-familiares?${params}`)
      setGrupos(response.data.grupos || [])
      setPaginationGrupos(response.data.pagination)
    } catch (err) {
      console.error('Error cargando grupos:', err)
    } finally {
      setLoadingGrupos(false)
    }
  }

  function limpiarFiltrosGrupos() {
    setBusquedaGrupos('')
    setTerminoBusquedaGrupos('')
    setEstadoGrupos('')
    setCategoriaGrupos('')
    setTipoSocioGrupos('')
    setZonaGrupos('')
    setPageGrupos(1)
  }

  function toggleExpandido(id) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBuscar(e) {
    e.preventDefault()
    setTerminoBusqueda(busqueda)
    goToPage(1)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setTerminoBusqueda('') // Limpiar búsqueda activa
    setEstado('')
    setCategoria('')
    setTipoSocio('')
    setZona('')
    setEsMenor('')
    goToPage(1)
  }

  const hayFiltrosActivos = estado || categoria || tipoSocio || zona || esMenor || terminoBusqueda

  function getQrUrl(tokenPortal) {
    return `${window.location.origin}/s/${tokenPortal}`
  }

  async function regenerarToken(socio) {
    const confirmed = await confirm(
      'Regenerar token',
      `El QR actual de ${socio.apellidoNombre} dejara de funcionar. ¿Desea continuar?`,
      { variant: 'warning', confirmText: 'Regenerar' }
    )
    if (!confirmed) return

    setRegenerando(true)
    try {
      const data = await api.post(`/admin/socios/${socio.id}/regenerar-token`)
      setSocios(socios.map(s => s.id === socio.id ? { ...s, tokenPortal: data.tokenPortal } : s))
      setQrModal({ ...socio, tokenPortal: data.tokenPortal })
      toast.success('Token regenerado correctamente')
    } catch (err) {
      toast.error('Error al regenerar token')
    } finally {
      setRegenerando(false)
    }
  }

  function copiarLink(tokenPortal) {
    navigator.clipboard.writeText(getQrUrl(tokenPortal))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const columns = [
    {
      key: 'socio',
      label: 'Socio',
      sortable: false,
      render: (socio) => (
        <div className="flex items-center gap-3">
          <AvatarSocio foto={socio.fotoUrl} nombre={socio.apellidoNombre} />
          <div>
            <div className="font-medium text-gray-800">
              {socio.apellidoNombre}
            </div>
            <div className="text-sm text-gray-500">
              #{socio.nroSocio} • DNI: {socio.documento || '-'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'contacto',
      label: 'Contacto',
      sortable: false,
      className: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (socio) => (
        <div className="text-sm text-gray-600">
          <div>{socio.email || '-'}</div>
          <div>{socio.celular || '-'}</div>
        </div>
      )
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: false,
      render: (socio) => (
        <div>
          <StatusBadge status={socio.estado} type="socio" />
          {socio.esMenor && (
            <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Menor
              {socio.fechaNacimiento && ` (${calcularEdad(socio.fechaNacimiento)})`}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'categoria',
      label: 'Categoria',
      sortable: false,
      className: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      render: (socio) => (
        <div className="text-sm text-gray-600">
          <div>{socio.categoria || '-'}</div>
          <div className="text-gray-400">{socio.tipoSocio || '-'}</div>
        </div>
      )
    },
    {
      key: 'info',
      label: 'Info',
      sortable: false,
      className: 'hidden sm:table-cell text-center',
      cellClassName: 'hidden sm:table-cell',
      render: (socio) => (
        <div className="flex justify-center gap-1">
          {(socio.titularFamiliaId || socio.miembrosFamilia?.length > 0) && (
            <span
              title={socio.titularFamiliaId ? 'Miembro de grupo familiar' : 'Titular de grupo familiar'}
              className="p-1 rounded bg-purple-100 text-purple-600"
            >
              <Users className="w-4 h-4" />
            </span>
          )}
          {socio.enviaDebito && (
            <span title="Debito automatico activo" className="p-1 rounded bg-green-100 text-green-600">
              <CreditCard className="w-4 h-4" />
            </span>
          )}
          {socio.tieneDeuda && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/cuotas?cobrarSocioId=${socio.id}`)
              }}
              title="Cobrar cuotas pendientes"
              className="p-1 rounded bg-orange-100 text-orange-600 hover:bg-orange-200 transition"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    },
    {
      key: 'acciones',
      label: 'Acciones',
      sortable: false,
      className: 'text-center',
      render: (socio) => (
        <div className="flex justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/socios/${socio.id}`)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
            title="Ver detalle"
          >
            <Eye className="w-5 h-5" />
          </button>
          {tienePermiso(PERMISOS.SOCIOS_EDITAR) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/socios/${socio.id}/editar`)
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
              title="Editar"
            >
              <Edit className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setQrModal(socio)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
            title="Ver QR del socio"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Socios</h1>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Toggle de vistas */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setVista('socios')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                vista === 'socios' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Socios
            </button>
            <button
              onClick={() => setVista('grupos')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                vista === 'grupos' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Grupos Familiares
            </button>
          </div>

          {vista === 'socios' && tienePermiso(PERMISOS.SOCIOS_CREAR) && (
            <Button onClick={() => navigate('/admin/socios/nuevo')} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Socio
            </Button>
          )}
          {vista === 'socios' && tienePermiso(PERMISOS.SOCIOS_CREAR) && (
            <Link to="/admin/socios/cargar" className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Cargar Excel
            </Link>
          )}
        </div>
      </div>

      {/* ── VISTA GRUPOS FAMILIARES ── */}
      {vista === 'grupos' && (
        <div>
          {/* Búsqueda + filtros */}
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={busquedaGrupos}
                onChange={e => { setBusquedaGrupos(e.target.value); setPageGrupos(1) }}
                placeholder="Buscar titular por nombre, nro. socio o DNI..."
                className="input-field pl-10 pr-10 w-full"
              />
              {busquedaGrupos && (
                <button type="button" onClick={() => setBusquedaGrupos('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFiltersGrupos(!showFiltersGrupos)}
              className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition relative ${
                showFiltersGrupos ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {(estadoGrupos || categoriaGrupos || tipoSocioGrupos || zonaGrupos) && !showFiltersGrupos && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
              )}
              <ChevronDown className={`w-4 h-4 transition ${showFiltersGrupos ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFiltersGrupos && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select value={estadoGrupos} onChange={e => { setEstadoGrupos(e.target.value); setPageGrupos(1) }} className="input-field">
                  <option value="">Todos los estados</option>
                  {filtros.estados.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={categoriaGrupos} onChange={e => { setCategoriaGrupos(e.target.value); setPageGrupos(1) }} className="input-field">
                  <option value="">Todas las categorías</option>
                  {filtros.categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={tipoSocioGrupos} onChange={e => { setTipoSocioGrupos(e.target.value); setPageGrupos(1) }} className="input-field">
                  <option value="">Todos los tipos</option>
                  {filtros.tiposSocio.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={zonaGrupos} onChange={e => { setZonaGrupos(e.target.value); setPageGrupos(1) }} className="input-field">
                  <option value="">Todas las zonas</option>
                  {filtros.zonas.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              {(estadoGrupos || categoriaGrupos || tipoSocioGrupos || zonaGrupos || terminoBusquedaGrupos) && (
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-sm text-gray-500">{paginationGrupos?.total || 0} grupos encontrados</span>
                  <button type="button" onClick={limpiarFiltrosGrupos} className="text-sm text-primary hover:underline">
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}

          {!showFiltersGrupos && paginationGrupos && (
            <div className="mb-4 text-sm text-gray-500">
              {paginationGrupos.total} grupos familiares
            </div>
          )}

          {loadingGrupos ? (
            <LoadingSpinner />
          ) : grupos.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
              No hay grupos familiares registrados.
            </div>
          ) : (
            <div className="space-y-3">
              {grupos.map(titular => (
                <div key={titular.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  {/* Titular */}
                  <button
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition text-left"
                    onClick={() => toggleExpandido(titular.id)}
                  >
                    <AvatarSocio foto={titular.fotoUrl} nombre={titular.apellidoNombre} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{titular.apellidoNombre}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Titular</span>
                        <StatusBadge status={titular.estado} type="socio" />
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        #{titular.nroSocio}
                        {titular.documento && ` · DNI ${titular.documento}`}
                        {titular.categoria && ` · ${titular.categoria}`}
                        <span className="ml-2 text-purple-600 font-medium">
                          {titular.miembrosFamilia.length} {titular.miembrosFamilia.length === 1 ? 'integrante' : 'integrantes'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/admin/socios/${titular.id}`) }}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-primary transition"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandidos.has(titular.id) ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {/* Miembros expandidos */}
                  {expandidos.has(titular.id) && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {titular.miembrosFamilia.map(miembro => (
                        <div
                          key={miembro.id}
                          className="flex items-center gap-4 px-4 py-2.5 pl-14 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                          onClick={() => navigate(`/admin/socios/${miembro.id}`)}
                        >
                          <AvatarSocio foto={miembro.fotoUrl} nombre={miembro.apellidoNombre} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-800 text-sm">{miembro.apellidoNombre}</span>
                              {miembro.parentescoTitular && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                  {miembro.parentescoTitular}
                                </span>
                              )}
                              {miembro.esMenor && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Menor</span>
                              )}
                              <StatusBadge status={miembro.estado} type="socio" />
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              #{miembro.nroSocio}
                              {miembro.categoria && ` · ${miembro.categoria}`}
                            </div>
                          </div>
                          <Eye className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginación grupos */}
          {paginationGrupos && paginationGrupos.pages > 1 && (
            <Pagination
              pagination={paginationGrupos}
              page={pageGrupos}
              onPageChange={setPageGrupos}
              className="mt-6"
            />
          )}
        </div>
      )}

      {/* ── VISTA SOCIOS ── */}
      {vista === 'socios' && <>

      {/* Busqueda */}
      <form onSubmit={handleBuscar} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, nro. socio, DNI, email o celular (búsqueda automática)"
              className="input-field pl-10 pr-10 w-full"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <Button type="submit">Buscar</Button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition relative ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hayFiltrosActivos && !showFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            )}
            <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </form>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Todos los estados</option>
              {filtros.estados.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select
              value={categoria}
              onChange={(e) => { setCategoria(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Todas las categorias</option>
              {filtros.categorias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={tipoSocio}
              onChange={(e) => { setTipoSocio(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Todos los tipos</option>
              {filtros.tiposSocio.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={zona}
              onChange={(e) => { setZona(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Todas las zonas</option>
              {filtros.zonas.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <select
              value={esMenor}
              onChange={(e) => { setEsMenor(e.target.value); goToPage(1) }}
              className="input-field"
            >
              <option value="">Mayores y menores</option>
              <option value="true">Solo menores</option>
              <option value="false">Solo mayores</option>
            </select>
          </div>
          {hayFiltrosActivos && (
            <div className="mt-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {pagination?.total || 0} socios encontrados
              </span>
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-sm text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contador si no hay filtros abiertos */}
      {!showFilters && pagination && (
        <div className="mb-4 text-sm text-gray-500">
          {pagination?.total || 0} socios encontrados
        </div>
      )}

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <LoadingSpinner />
      ) : socios.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
          No hay socios para mostrar.
          <br />
          <Link to="/admin/socios/cargar" className="text-primary hover:underline">
            Carga socios desde Excel
          </Link>
          {' '}o{' '}
          <Link to="/admin/socios/nuevo" className="text-primary hover:underline">
            crea uno nuevo
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <Table
              columns={columns}
              data={socios}
              keyField="id"
              sortable={false}
              onRowClick={(socio) => navigate(`/admin/socios/${socio.id}`)}
              emptyMessage="No se encontraron socios"
            />
          </div>

          {/* Paginacion */}
          <Pagination
            pagination={pagination}
            page={page}
            onPageChange={goToPage}
            className="mt-6"
          />
        </>
      )}

      </> /* fin vista socios */}

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <span className="font-semibold text-gray-800">QR del Socio</span>
                <span className="text-gray-500 text-sm ml-2">#{qrModal.nroSocio}</span>
              </div>
              <button
                onClick={() => setQrModal(null)}
                className="p-1 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6">
              <div className="text-center">
                <p className="text-gray-800 font-semibold text-lg mb-2">{qrModal.apellidoNombre}</p>
                <div className="flex justify-center mb-4">
                  <StatusBadge status={qrModal.estado} type="socio" size="md" />
                </div>
              </div>

              {/* Mostrar QR solo si está vigente/activo */}
              {qrModal.estado?.toUpperCase().includes('VIGENT') || qrModal.estado?.toUpperCase().includes('ACTIV') ? (
                <>
                  {/* QR */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <QRCodeSVG
                        value={getQrUrl(qrModal.tokenPortal)}
                        size={180}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>

                  {/* Link */}
                  <div className="mb-4">
                    <p className="text-gray-500 text-sm mb-2 text-center">Link del portal:</p>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <input
                        type="text"
                        readOnly
                        value={getQrUrl(qrModal.tokenPortal)}
                        className="flex-1 bg-transparent text-sm text-gray-600 outline-none truncate"
                      />
                      <button
                        onClick={() => copiarLink(qrModal.tokenPortal)}
                        className="p-2 rounded hover:bg-gray-200 transition"
                        title="Copiar link"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                      <a
                        href={getQrUrl(qrModal.tokenPortal)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded hover:bg-gray-200 transition"
                        title="Abrir portal"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </a>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      onClick={() => regenerarToken(qrModal)}
                      loading={regenerando}
                      className="inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Regenerar Token
                    </Button>
                  </div>
                  <p className="text-gray-400 text-xs mt-3 text-center">
                    Regenerar invalidara el QR actual del socio
                  </p>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-gray-800 font-medium mb-2">QR no disponible</p>
                  <p className="text-gray-500 text-sm">
                    El socio no se encuentra activo/vigente.<br />
                    No puede utilizar el QR para descuentos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />

      {/* Axio - Chat Widget para Admins */}
      <ChatWidget role="admin" position="bottom-right" />
    </div>
  )
}
