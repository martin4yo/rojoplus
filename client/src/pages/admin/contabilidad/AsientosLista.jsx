import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, Eye, XCircle, BookOpen, Calendar, ChevronDown } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function AsientosLista() {
  const [asientos, setAsientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    estado: '',
    desde: '',
    hasta: '',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const { showModal, ModalComponent } = useModal()

  useEffect(() => {
    cargarAsientos()
  }, [filters.estado, filters.desde, filters.hasta])

  async function cargarAsientos() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.estado) params.append('estado', filters.estado)
      if (filters.desde) params.append('desde', filters.desde)
      if (filters.hasta) params.append('hasta', filters.hasta)

      const url = `/admin/asientos${params.toString() ? '?' + params.toString() : ''}`
      const res = await api.getFull(url)
      setAsientos(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function anularAsiento(id) {
    showModal({
      type: 'warning',
      title: 'Anular Asiento',
      message: 'Ingrese el motivo de anulación:',
      prompt: true,
      promptLabel: 'Motivo',
      promptPlaceholder: 'Ej: Error en la imputación',
      confirmText: 'Anular',
      onConfirm: async (motivo) => {
        if (!motivo) return
        try {
          await api.post(`/admin/asientos/${id}/anular`, { motivo })
          cargarAsientos()
          showModal({
            type: 'success',
            message: 'Asiento anulado correctamente'
          })
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al anular asiento'
          })
        }
      }
    })
  }

  const asientosFiltrados = asientos.filter(a => {
    if (!filters.search) return true
    const search = filters.search.toLowerCase()
    return (
      a.numero.toLowerCase().includes(search) ||
      a.concepto.toLowerCase().includes(search)
    )
  })

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount || 0)
  }

  const getEstadoBadge = (estado) => {
    const estilos = {
      BORRADOR: 'bg-yellow-100 text-yellow-800',
      CONFIRMADO: 'bg-green-100 text-green-800',
      ANULADO: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${estilos[estado] || 'bg-gray-100 text-gray-800'}`}>
        {estado}
      </span>
    )
  }

  const getTipoOrigenLabel = (tipo) => {
    const labels = {
      MANUAL: 'Manual',
      PAGO: 'Pago',
      COBRANZA: 'Cobranza',
      VENTA: 'Venta',
      COMPRA: 'Compra',
      AJUSTE: 'Ajuste'
    }
    return labels[tipo] || tipo || 'Manual'
  }

  if (loading && asientos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Libro Diario</h1>
            <p className="text-sm text-gray-500">Asientos contables</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/contabilidad/libro-mayor">
            <Button variant="secondary">
              <BookOpen className="w-4 h-4 mr-2" />
              Libro Mayor
            </Button>
          </Link>
          <Link to="/admin/contabilidad/asientos/nuevo">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Asiento
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Buscador */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o concepto..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-10 w-full"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filtros
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filters.estado}
                onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="CONFIRMADO">Confirmado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={filters.desde}
                onChange={(e) => setFilters({ ...filters, desde: e.target.value })}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={filters.hasta}
                onChange={(e) => setFilters({ ...filters, hasta: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Número
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Concepto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Debe
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Haber
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No hay asientos para mostrar
                  </td>
                </tr>
              ) : (
                asientosFiltrados.map((asiento) => {
                  const totalDebe = asiento.lineas?.reduce((sum, l) => sum + Number(l.debe || 0), 0) || 0
                  const totalHaber = asiento.lineas?.reduce((sum, l) => sum + Number(l.haber || 0), 0) || 0

                  return (
                    <tr key={asiento.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {asiento.numero}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(asiento.fecha)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{asiento.concepto}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{getTipoOrigenLabel(asiento.tipoOrigen)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-green-600">{formatMoney(totalDebe)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-red-600">{formatMoney(totalHaber)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getEstadoBadge(asiento.estado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/admin/contabilidad/asientos/${asiento.id}`}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {asiento.estado === 'CONFIRMADO' && (
                            <button
                              onClick={() => anularAsiento(asiento.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Anular"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales */}
      {asientosFiltrados.length > 0 && (
        <div className="text-sm text-gray-500 text-right">
          Mostrando {asientosFiltrados.length} asiento(s)
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
