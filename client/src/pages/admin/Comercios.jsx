import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Store } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useModal } from '../../components/Modal'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function AdminComercios() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [comercios, setComercios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState({}) // { id: true/false }
  const { showModal, ModalComponent } = useModal()

  const estadoFiltro = searchParams.get('estado') || ''

  useEffect(() => {
    cargarComercios()
  }, [estadoFiltro])

  async function cargarComercios() {
    setLoading(true)
    try {
      const params = estadoFiltro ? `?estado=${estadoFiltro}` : ''
      const data = await api.get(`/admin/comercios${params}`)
      setComercios(data.comercios || [])
    } catch (err) {
      setError('Error al cargar comercios')
    } finally {
      setLoading(false)
    }
  }

  function filtrarPorEstado(estado) {
    if (estado) {
      setSearchParams({ estado })
    } else {
      setSearchParams({})
    }
  }

  async function aprobar(id) {
    setProcesando(prev => ({ ...prev, [id]: true }))
    try {
      await api.post(`/admin/comercios/${id}/aprobar`)
      showModal({
        type: 'success',
        title: 'Comercio aprobado',
        message: 'El comercio ha sido aprobado y recibirá un email con su link de acceso.',
      })
      cargarComercios()
    } catch (err) {
      showModal({
        type: 'error',
        message: 'Error al aprobar comercio',
      })
    } finally {
      setProcesando(prev => ({ ...prev, [id]: false }))
    }
  }

  function rechazar(id) {
    showModal({
      type: 'warning',
      title: 'Rechazar comercio',
      message: 'Ingrese el motivo del rechazo:',
      prompt: true,
      promptPlaceholder: 'Motivo del rechazo...',
      confirmText: 'Rechazar',
      onConfirm: async (motivo) => {
        setProcesando(prev => ({ ...prev, [id]: true }))
        try {
          await api.post(`/admin/comercios/${id}/rechazar`, { motivo })
          showModal({
            type: 'success',
            title: 'Comercio rechazado',
            message: 'El comercio ha sido rechazado.',
          })
          cargarComercios()
        } catch (err) {
          showModal({
            type: 'error',
            message: 'Error al rechazar comercio',
          })
        } finally {
          setProcesando(prev => ({ ...prev, [id]: false }))
        }
      },
    })
  }

  const estadoColor = {
    PENDIENTE: 'bg-yellow-100 text-yellow-800',
    ACTIVO: 'bg-green-100 text-green-800',
    RECHAZADO: 'bg-red-100 text-red-800',
    INACTIVO: 'bg-gray-100 text-gray-800',
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Comercios</h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'PENDIENTE', 'ACTIVO', 'RECHAZADO', 'INACTIVO'].map((estado) => (
          <button
            key={estado}
            onClick={() => filtrarPorEstado(estado)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              estadoFiltro === estado
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {estado || 'Todos'}
          </button>
        ))}
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <LoadingSpinner />
      ) : comercios.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No hay comercios para mostrar
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Comercio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Rubro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Descuento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comercios.map((comercio) => (
                <tr key={comercio.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/comercios/${comercio.id}`}
                      className="font-medium text-gray-800 hover:text-primary"
                    >
                      {comercio.nombre}
                    </Link>
                    <p className="text-sm text-gray-500">{comercio.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 hidden md:table-cell">
                    {comercio.rubro}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor[comercio.estado]}`}>
                      {comercio.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 hidden md:table-cell">
                    {comercio.descuentoPct}%
                  </td>
                  <td className="px-6 py-4 text-right">
                    {comercio.estado === 'PENDIENTE' && tienePermiso(PERMISOS.COMERCIOS_GESTIONAR) && (
                      <div className="flex gap-2 justify-end items-center">
                        <button
                          onClick={() => aprobar(comercio.id)}
                          disabled={procesando[comercio.id]}
                          className="text-green-600 hover:text-green-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {procesando[comercio.id] ? (
                            <>
                              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              <span>Aprobando...</span>
                            </>
                          ) : (
                            'Aprobar'
                          )}
                        </button>
                        <button
                          onClick={() => rechazar(comercio.id)}
                          disabled={procesando[comercio.id]}
                          className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    {comercio.estado !== 'PENDIENTE' && (
                      <Link
                        to={`/admin/comercios/${comercio.id}`}
                        className="text-primary hover:text-primary-dark font-medium text-sm"
                      >
                        Ver detalle
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ModalComponent}
    </div>
  )
}
