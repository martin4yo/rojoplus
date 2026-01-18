import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Upload, QrCode, ExternalLink, RefreshCw, X, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function AdminSocios() {
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [categoria, setCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [filtros, setFiltros] = useState({ estados: [], categorias: [] })

  // Modal QR
  const [qrModal, setQrModal] = useState(null)
  const [regenerando, setRegenerando] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    cargarSocios()
  }, [page, estado, categoria])

  async function cargarSocios(query = busqueda) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (query) params.append('q', query)
      if (estado) params.append('estado', estado)
      if (categoria) params.append('categoria', categoria)
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
    setPage(1)
  }

  function getEstadoColor(estado) {
    const upper = estado?.toUpperCase() || ''
    if (upper.includes('VIGENT') || upper.includes('ACTIV')) {
      return 'bg-green-100 text-green-800'
    }
    return 'bg-red-100 text-red-800'
  }

  function getQrUrl(tokenPortal) {
    // URL de produccion
    return `https://sportivo.axiomacloud.com/s/${tokenPortal}`
  }

  async function regenerarToken(socio) {
    if (!confirm(`¿Regenerar el token de ${socio.apellidoNombre}? El QR actual dejara de funcionar.`)) {
      return
    }

    setRegenerando(true)
    try {
      const data = await api.post(`/admin/socios/${socio.id}/regenerar-token`)
      // Actualizar en la lista
      setSocios(socios.map(s => s.id === socio.id ? { ...s, tokenPortal: data.tokenPortal } : s))
      // Actualizar modal
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Socios</h1>
        <Link to="/admin/socios/cargar" className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Cargar desde Excel
        </Link>
      </div>

      {/* Busqueda y filtros */}
      <form onSubmit={handleBuscar} className="mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, nro. socio o DNI"
            className="input-field flex-1"
          />
          <Button type="submit">Buscar</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPage(1) }}
            className="input-field w-auto"
          >
            <option value="">Todos los estados</option>
            {filtros.estados.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setPage(1) }}
            className="input-field w-auto"
          >
            <option value="">Todas las categorías</option>
            {filtros.categorias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(estado || categoria || busqueda) && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-sm text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
          {pagination && (
            <span className="text-sm text-gray-500 ml-auto">
              {pagination.total} socios encontrados
            </span>
          )}
        </div>
      </form>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : socios.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No hay socios para mostrar.
          <br />
          <Link to="/admin/socios/cargar" className="text-primary hover:underline">
            Carga socios desde Excel
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nro. Socio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    QR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {socios.map((socio) => (
                  <tr key={socio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      #{socio.nroSocio}
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      {socio.apellidoNombre}
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden md:table-cell">
                      {socio.documento || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(socio.estado)}`}>
                        {socio.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden md:table-cell">
                      {socio.categoria || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setQrModal(socio)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition"
                        title="Ver QR del socio"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacion */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-gray-600">
                Pagina {page} de {pagination.pages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.pages}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-50"
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
            <div className="p-6 text-center">
              <p className="text-gray-800 font-semibold text-lg mb-1">{qrModal.apellidoNombre}</p>
              <p className={`text-sm mb-4 ${getEstadoColor(qrModal.estado)} inline-block px-2 py-1 rounded-full`}>
                {qrModal.estado}
              </p>

              {/* QR */}
              <div className="inline-block bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <QRCodeSVG
                  value={getQrUrl(qrModal.tokenPortal)}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Link */}
              <div className="mb-4">
                <p className="text-gray-500 text-sm mb-2">Link del portal:</p>
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
              <div className="flex gap-2 justify-center">
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
              <p className="text-gray-400 text-xs mt-3">
                Regenerar invalidara el QR actual del socio
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
