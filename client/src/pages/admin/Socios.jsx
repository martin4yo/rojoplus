import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Upload, QrCode, ExternalLink, RefreshCw, X, Copy, Check,
  Plus, Eye, Edit, Users, CreditCard, Search, Filter, ChevronDown
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

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
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tipoSocio, setTipoSocio] = useState('')
  const [zona, setZona] = useState('')
  const [esMenor, setEsMenor] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [filtros, setFiltros] = useState({ estados: [], categorias: [], tiposSocio: [], zonas: [] })
  const [showFilters, setShowFilters] = useState(false)

  // Modal QR
  const [qrModal, setQrModal] = useState(null)
  const [regenerando, setRegenerando] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    cargarSocios()
  }, [page, estado, categoria, tipoSocio, zona, esMenor])

  async function cargarSocios(query = busqueda) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (query) params.append('q', query)
      if (estado) params.append('estado', estado)
      if (categoria) params.append('categoria', categoria)
      if (tipoSocio) params.append('tipoSocio', tipoSocio)
      if (zona) params.append('zona', zona)
      if (esMenor) params.append('esMenor', esMenor)
      const data = await api.get(`/admin/socios?${params}`)
      setSocios(data.socios || [])
      setPagination(data.pagination)
      if (data.filtros) setFiltros(data.filtros)
    } catch (err) {
      setError('Error al cargar socios')
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar(e) {
    e.preventDefault()
    setPage(1)
    cargarSocios(busqueda)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setEstado('')
    setCategoria('')
    setTipoSocio('')
    setZona('')
    setEsMenor('')
    setPage(1)
  }

  const hayFiltrosActivos = estado || categoria || tipoSocio || zona || esMenor || busqueda

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

  function getQrUrl(tokenPortal) {
    return `https://sportivo.axiomacloud.com/s/${tokenPortal}`
  }

  async function regenerarToken(socio) {
    if (!confirm(`¿Regenerar el token de ${socio.apellidoNombre}? El QR actual dejara de funcionar.`)) {
      return
    }

    setRegenerando(true)
    try {
      const data = await api.post(`/admin/socios/${socio.id}/regenerar-token`)
      setSocios(socios.map(s => s.id === socio.id ? { ...s, tokenPortal: data.tokenPortal } : s))
      setQrModal({ ...socio, tokenPortal: data.tokenPortal })
    } catch (err) {
      setError('Error al regenerar token')
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Socios</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/admin/socios/nuevo')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Socio
          </Button>
          <Link to="/admin/socios/cargar" className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Cargar Excel
          </Link>
        </div>
      </div>

      {/* Busqueda */}
      <form onSubmit={handleBuscar} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, nro. socio, DNI, email o celular"
              className="input-field pl-10 w-full"
            />
          </div>
          <Button type="submit">Buscar</Button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
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
              onChange={(e) => { setEstado(e.target.value); setPage(1) }}
              className="input-field"
            >
              <option value="">Todos los estados</option>
              {filtros.estados.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <select
              value={categoria}
              onChange={(e) => { setCategoria(e.target.value); setPage(1) }}
              className="input-field"
            >
              <option value="">Todas las categorias</option>
              {filtros.categorias.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={tipoSocio}
              onChange={(e) => { setTipoSocio(e.target.value); setPage(1) }}
              className="input-field"
            >
              <option value="">Todos los tipos</option>
              {filtros.tiposSocio.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={zona}
              onChange={(e) => { setZona(e.target.value); setPage(1) }}
              className="input-field"
            >
              <option value="">Todas las zonas</option>
              {filtros.zonas.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <select
              value={esMenor}
              onChange={(e) => { setEsMenor(e.target.value); setPage(1) }}
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
          {pagination.total} socios encontrados
        </div>
      )}

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Socio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                      Contacto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                      Info
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {socios.map((socio) => (
                    <tr key={socio.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                        <div>{socio.email || '-'}</div>
                        <div>{socio.celular || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(socio.estado)}`}>
                          {socio.estado}
                        </span>
                        {socio.esMenor && (
                          <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Menor
                            {socio.fechaNacimiento && ` (${calcularEdad(socio.fechaNacimiento)})`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        <div>{socio.categoria || '-'}</div>
                        <div className="text-gray-400">{socio.tipoSocio || '-'}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex justify-center gap-1">
                          {socio.grupoFamiliarId && (
                            <span
                              title={socio.esTitularGrupo ? 'Titular de grupo familiar' : 'Miembro de grupo familiar'}
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
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => navigate(`/admin/socios/${socio.id}`)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/socios/${socio.id}/editar`)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setQrModal(socio)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
                            title="Ver QR del socio"
                          >
                            <QrCode className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginacion */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-gray-600">
                Pagina {page} de {pagination.pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.pages}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 transition"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

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
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${getEstadoColor(qrModal.estado)}`}>
                    {qrModal.estado}
                  </span>
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
    </div>
  )
}
