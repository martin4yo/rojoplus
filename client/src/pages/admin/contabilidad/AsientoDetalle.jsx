import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Calendar, User, XCircle, Edit, Printer } from 'lucide-react'
import { Button } from '../../../components/Button'
import { useModal } from '../../../components/Modal'
import api from '../../../services/api'

export default function AsientoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showModal, ModalComponent } = useModal()
  const [asiento, setAsiento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarAsiento()
  }, [id])

  async function cargarAsiento() {
    try {
      setLoading(true)
      const res = await api.getFull(`/admin/asientos/${id}`)
      setAsiento(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function anularAsiento() {
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
          cargarAsiento()
          showModal({
            type: 'success',
            message: 'Asiento anulado correctamente'
          })
        } catch (err) {
          showModal({
            type: 'error',
            message: err.message || 'Error al anular'
          })
        }
      }
    })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      BORRADOR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      CONFIRMADO: 'bg-green-100 text-green-800 border-green-200',
      ANULADO: 'bg-red-100 text-red-800 border-red-200'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${estilos[estado] || 'bg-gray-100 text-gray-800'}`}>
        {estado}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !asiento) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Asiento no encontrado'}</p>
        <Link to="/admin/contabilidad/asientos">
          <Button variant="secondary">Volver</Button>
        </Link>
      </div>
    )
  }

  const totalDebe = asiento.lineas?.reduce((sum, l) => sum + Number(l.debe || 0), 0) || 0
  const totalHaber = asiento.lineas?.reduce((sum, l) => sum + Number(l.haber || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/contabilidad/asientos"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{asiento.numero}</h1>
                {getEstadoBadge(asiento.estado)}
              </div>
              <p className="text-sm text-gray-500">{asiento.concepto}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {asiento.estado === 'BORRADOR' && (
            <Link to={`/admin/contabilidad/asientos/${id}/editar`}>
              <Button variant="secondary">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
          {asiento.estado === 'CONFIRMADO' && (
            <Button variant="danger" onClick={anularAsiento}>
              <XCircle className="w-4 h-4 mr-2" />
              Anular
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-medium">{formatDate(asiento.fecha)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Registrado por</p>
              <p className="font-medium">{asiento.registrador?.nombre || 'Sistema'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tipo de origen</p>
              <p className="font-medium">{asiento.tipoOrigen || 'Manual'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Si está anulado, mostrar info */}
      {asiento.estado === 'ANULADO' && asiento.fechaAnulacion && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 mb-2">Asiento Anulado</h3>
          <div className="text-sm text-red-700 space-y-1">
            <p><strong>Fecha:</strong> {formatDate(asiento.fechaAnulacion)}</p>
            <p><strong>Motivo:</strong> {asiento.motivoAnulacion}</p>
            {asiento.anulador && <p><strong>Anulado por:</strong> {asiento.anulador.nombre}</p>}
          </div>
        </div>
      )}

      {/* Tabla de líneas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">Detalle del Asiento</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Cuenta
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Debe
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Haber
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asiento.lineas?.map((linea, idx) => (
                <tr key={linea.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-mono text-xs text-gray-500">{linea.cuentaContable?.codigo}</span>
                      <p className="font-medium text-gray-900">{linea.cuentaContable?.nombre}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {linea.descripcion || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(linea.debe) > 0 && (
                      <span className="font-mono text-green-600 font-medium">
                        {formatMoney(linea.debe)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(linea.haber) > 0 && (
                      <span className="font-mono text-red-600 font-medium">
                        {formatMoney(linea.haber)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right">
                  Totales:
                </td>
                <td className="px-4 py-3 text-right text-green-600 font-mono">
                  {formatMoney(totalDebe)}
                </td>
                <td className="px-4 py-3 text-right text-red-600 font-mono">
                  {formatMoney(totalHaber)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-400 text-right">
        Creado: {formatDate(asiento.createdAt)}
        {asiento.updatedAt !== asiento.createdAt && (
          <> | Modificado: {formatDate(asiento.updatedAt)}</>
        )}
      </div>

      {ModalComponent}
    </div>
  )
}
