import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle, AlertTriangle, X, Eye, FileText, Calendar, DollarSign, TrendingUp, TrendingDown, Download } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'

export default function CierreCaja() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Obtener el ID del admin actual
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}')
  const adminActualId = adminData.id

  // Datos
  const [cajasPendientes, setCajasPendientes] = useState([])
  const [cierresRecientes, setCierresRecientes] = useState([])

  // Modales
  const [modalCerrar, setModalCerrar] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(false)
  const [cierreSeleccionado, setCierreSeleccionado] = useState(null)
  const [confirmarFirma, setConfirmarFirma] = useState(null) // ID del cierre a firmar

  // Formulario de cierre
  const [formCierre, setFormCierre] = useState({
    cajaId: '',
    saldoReal: '',
    observaciones: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    setError(null)
    try {
      const [pendientes, recientes] = await Promise.all([
        api.getFull('/admin/cierres-caja/pendientes'),
        api.getFull('/admin/cierres-caja?limit=10')
      ])

      setCajasPendientes(pendientes.data || [])
      setCierresRecientes(recientes.data || [])
    } catch (err) {
      setError('Error al cargar datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function abrirModalCerrar(caja) {
    setFormCierre({
      cajaId: caja.id,
      saldoReal: '',
      observaciones: ''
    })
    setModalCerrar(caja)
  }

  async function handleCerrarCaja(e) {
    e.preventDefault()
    setError(null)

    if (!formCierre.saldoReal || formCierre.saldoReal === '') {
      setError('El saldo real es obligatorio')
      return
    }

    try {
      await api.post('/admin/cierres-caja', formCierre)
      setSuccess('Cierre de caja registrado exitosamente')
      setModalCerrar(false)
      setFormCierre({ cajaId: '', saldoReal: '', observaciones: '' })
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar cierre')
    }
  }

  async function verDetalle(cierre) {
    setLoading(true)
    try {
      const data = await api.getFull(`/admin/cierres-caja/${cierre.id}`)
      setCierreSeleccionado(data.data)
      setModalDetalle(true)
    } catch (err) {
      setError('Error al cargar detalle del cierre')
    } finally {
      setLoading(false)
    }
  }

  async function firmarCierre(cierreId) {
    try {
      await api.post(`/admin/cierres-caja/${cierreId}/firmar`)
      setSuccess('Cierre firmado exitosamente')
      setModalDetalle(false)
      setConfirmarFirma(null)
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al firmar cierre')
    }
  }

  async function descargarPDF(cierreId) {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/cierres-caja/${cierreId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al generar PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cierre-caja-${cierreId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setSuccess('PDF generado exitosamente')
    } catch (err) {
      setError('Error al generar PDF del cierre')
    }
  }

  async function descargarInformePrevio(caja) {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/cierres-caja/informe-previo/${caja.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      })

      if (!response.ok) {
        throw new Error('Error al generar informe')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `informe-previo-${caja.nombre}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setSuccess('Informe generado exitosamente')
    } catch (err) {
      setError('Error al generar informe previo')
    }
  }

  if (loading && cajasPendientes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const diferencia = modalCerrar ? parseFloat(formCierre.saldoReal || 0) - modalCerrar.saldoEsperado : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100">
            <Lock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cierre de Caja Diario</h1>
            <p className="text-gray-500 text-sm">
              Control y arqueo de efectivo
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/cierres-caja/historico')}
        >
          <FileText className="w-4 h-4 mr-2" />
          Ver Histórico Completo
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} className="mb-4">
          {success}
        </Alert>
      )}

      {/* Cajas Pendientes de Cierre */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Cajas Pendientes de Cierre Hoy
        </h2>

        {cajasPendientes.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-medium">Todas las cajas han sido cerradas</p>
            <p className="text-green-600 text-sm mt-1">No hay cierres pendientes para el día de hoy</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cajasPendientes.map((caja) => (
              <div
                key={caja.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">{caja.nombre}</h3>
                  <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded">
                    Pendiente
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Saldo Sistema:</span>
                    <span className="font-semibold text-gray-900">
                      ${caja.saldoEsperado?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Movimientos:</span>
                    <span className="font-medium text-gray-900">{caja.cantidadMovimientos}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-gray-600">Ingresos:</span>
                    <span className="font-medium text-green-600">
                      ${caja.totalIngresos?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-gray-600">Egresos:</span>
                    <span className="font-medium text-red-600">
                      ${caja.totalEgresos?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => descargarInformePrevio(caja)}
                    variant="outline"
                    className="flex-1 flex items-center justify-center"
                    size="sm"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Ver Informe
                  </Button>
                  {tienePermiso(PERMISOS.CAJA_CIERRE) && (
                    <Button
                      onClick={() => abrirModalCerrar(caja)}
                      className="flex-1 flex items-center justify-center"
                      size="sm"
                    >
                      <Lock className="w-5 h-5 mr-2" />
                      Cerrar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cierres Recientes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Cierres Recientes
        </h2>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Caja
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Saldo Sistema
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Saldo Real
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Diferencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cierresRecientes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No hay cierres registrados
                    </td>
                  </tr>
                ) : (
                  cierresRecientes.map((cierre) => {
                    const dif = parseFloat(cierre.diferencia)
                    return (
                      <tr key={cierre.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(cierre.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {cierre.caja.nombre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${parseFloat(cierre.saldoSistema).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${parseFloat(cierre.saldoReal).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${
                            dif === 0 ? 'text-green-600' :
                            dif > 0 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {dif === 0 ? 'Sin diferencia' :
                             dif > 0 ? `+$${dif.toLocaleString()}` : `-$${Math.abs(dif).toLocaleString()}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {cierre.firmadoPor ? (
                            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                              Firmado
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                              Pendiente Firma
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => verDetalle(cierre)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Cerrar Caja */}
      {modalCerrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Cerrar Caja: {modalCerrar.nombre}</h2>
              <button
                onClick={() => {
                  setModalCerrar(false)
                  setFormCierre({ cajaId: '', saldoReal: '', observaciones: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCerrarCaja} className="p-6">
              {/* Resumen de Movimientos */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Resumen del Día</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Movimientos</p>
                    <p className="text-lg font-bold text-gray-900">{modalCerrar.cantidadMovimientos}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Saldo Esperado</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${modalCerrar.saldoEsperado?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Ingresos
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      ${modalCerrar.totalIngresos?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      Egresos
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      ${modalCerrar.totalEgresos?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Saldo Real */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Real (efectivo contado) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formCierre.saldoReal}
                    onChange={(e) => setFormCierre(prev => ({ ...prev, saldoReal: e.target.value }))}
                    className="w-full pl-8 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Diferencia Calculada */}
              {formCierre.saldoReal && formCierre.saldoReal !== '' && (
                <div className={`p-4 rounded-lg mb-4 ${
                  diferencia === 0 ? 'bg-green-50 border border-green-200' :
                  diferencia > 0 ? 'bg-blue-50 border border-blue-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {diferencia === 0 ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    )}
                    <span className="font-semibold text-gray-900">
                      {diferencia === 0 ? 'Caja balanceada' :
                       diferencia > 0 ? 'Sobrante de efectivo' : 'Faltante de efectivo'}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    diferencia === 0 ? 'text-green-700' :
                    diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {diferencia === 0 ? '$0' :
                     diferencia > 0 ? `+$${diferencia.toLocaleString()}` : `-$${Math.abs(diferencia).toLocaleString()}`}
                  </p>
                </div>
              )}

              {/* Observaciones */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formCierre.observaciones}
                  onChange={(e) => setFormCierre(prev => ({ ...prev, observaciones: e.target.value }))}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Notas sobre el cierre (opcional)..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalCerrar(false)
                    setFormCierre({ cajaId: '', saldoReal: '', observaciones: '' })
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  <Lock className="w-4 h-4 mr-2" />
                  Registrar Cierre
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Cierre */}
      {modalDetalle && cierreSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                Detalle de Cierre - {cierreSeleccionado.caja.nombre}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => descargarPDF(cierreSeleccionado.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Descargar PDF"
                >
                  <Download className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => {
                    setModalDetalle(false)
                    setCierreSeleccionado(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Información General */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Fecha del Cierre</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(cierreSeleccionado.fecha).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Realizado por</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {cierreSeleccionado.adminCerrado.nombre} {cierreSeleccionado.adminCerrado.apellido}
                  </p>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Resumen Financiero</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Saldo Sistema</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${parseFloat(cierreSeleccionado.saldoSistema).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Saldo Real</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${parseFloat(cierreSeleccionado.saldoReal).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Diferencia</p>
                    <p className={`text-xl font-bold ${
                      parseFloat(cierreSeleccionado.diferencia) === 0 ? 'text-green-600' :
                      parseFloat(cierreSeleccionado.diferencia) > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {parseFloat(cierreSeleccionado.diferencia) === 0 ? '$0' :
                       parseFloat(cierreSeleccionado.diferencia) > 0 ?
                       `+$${parseFloat(cierreSeleccionado.diferencia).toLocaleString()}` :
                       `-$${Math.abs(parseFloat(cierreSeleccionado.diferencia)).toLocaleString()}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-600">Movimientos</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {cierreSeleccionado.cantidadMovimientos}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Ingresos
                    </p>
                    <p className="text-lg font-semibold text-green-600">
                      ${parseFloat(cierreSeleccionado.totalIngresos).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      Egresos
                    </p>
                    <p className="text-lg font-semibold text-red-600">
                      ${parseFloat(cierreSeleccionado.totalEgresos).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {cierreSeleccionado.observaciones && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">Observaciones</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-gray-900">
                    {cierreSeleccionado.observaciones}
                  </div>
                </div>
              )}

              {/* Desglose por Medio de Pago */}
              {cierreSeleccionado.desgloseMedioPago && cierreSeleccionado.desgloseMedioPago.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Desglose por Medio de Pago</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Medio de Pago</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Ingresos</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Egresos</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cierreSeleccionado.desgloseMedioPago.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{item.nombre}</td>
                            <td className="px-4 py-2 text-right text-green-600 font-medium">
                              ${item.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right text-red-600 font-medium">
                              ${item.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">
                              ${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Desglose por Concepto */}
              {cierreSeleccionado.desgloseConcepto && cierreSeleccionado.desgloseConcepto.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Desglose por Concepto</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Concepto</th>
                          <th className="px-4 py-2 text-center font-medium text-gray-700">Cantidad</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Ingresos</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-700">Egresos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cierreSeleccionado.desgloseConcepto.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{item.concepto}</td>
                            <td className="px-4 py-2 text-center text-gray-700">{item.cantidad}</td>
                            <td className="px-4 py-2 text-right text-green-600 font-medium">
                              ${item.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2 text-right text-red-600 font-medium">
                              ${item.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Firma */}
              <div className="mb-6">
                {cierreSeleccionado.firmadoPor ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">Cierre Firmado</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Firmado por {cierreSeleccionado.adminFirmado.nombre} {cierreSeleccionado.adminFirmado.apellido}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {new Date(cierreSeleccionado.fechaFirma).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <span className="font-semibold text-yellow-800">Pendiente de Firma</span>
                    </div>
                    <p className="text-sm text-yellow-700 mb-3">
                      Este cierre requiere firma de un supervisor
                    </p>
                    {tienePermiso(PERMISOS.CAJA_CIERRE) && cierreSeleccionado.cerradoPor !== adminActualId ? (
                      <Button
                        onClick={() => setConfirmarFirma(cierreSeleccionado.id)}
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Firmar Cierre
                      </Button>
                    ) : tienePermiso(PERMISOS.CAJA_CIERRE) && cierreSeleccionado.cerradoPor === adminActualId ? (
                      <p className="text-xs text-gray-500 italic">
                        No puede firmar un cierre realizado por usted mismo
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3">
                <Button
                  onClick={() => descargarPDF(cierreSeleccionado.id)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalDetalle(false)
                    setCierreSeleccionado(null)
                  }}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Firma */}
      {confirmarFirma && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-primary/10">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Confirmar Firma</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Desea firmar este cierre de caja? Esta acción valida el arqueo realizado.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmarFirma(null)}
              >
                Cancelar
              </Button>
              <Button onClick={() => firmarCierre(confirmarFirma)}>
                Sí, Firmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
