import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
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
    </div>
  )
}
