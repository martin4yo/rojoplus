import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Star, QrCode } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import QrScanner from '../../components/QrScanner'
import api from '../../services/api'

export default function Comercio() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [comercio, setComercio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Busqueda de socio
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [socio, setSocio] = useState(null)
  const [socioError, setSocioError] = useState(null)

  // Venta
  const [importe, setImporte] = useState('')
  const [descuento, setDescuento] = useState(null)
  const [registrando, setRegistrando] = useState(false)
  const [ventaExito, setVentaExito] = useState(false)

  // Scanner QR
  const [scannerOpen, setScannerOpen] = useState(false)

  // Cargar datos del comercio
  useEffect(() => {
    async function cargarComercio() {
      try {
        const data = await api.get(`/comercio/${token}`)
        setComercio(data)
      } catch (err) {
        navigate('/acceso-invalido')
      } finally {
        setLoading(false)
      }
    }
    cargarComercio()
  }, [token, navigate])

  // Buscar socio
  async function buscarSocio(e) {
    e.preventDefault()
    if (!busqueda.trim()) return

    setBuscando(true)
    setSocio(null)
    setSocioError(null)
    setImporte('')
    setDescuento(null)
    setVentaExito(false)

    try {
      const data = await api.get(`/comercio/${token}/socios/buscar?q=${encodeURIComponent(busqueda)}`)
      if (data) {
        setSocio(data)
      } else {
        setSocioError('No se encontro socio con ese numero o documento')
      }
    } catch (err) {
      setSocioError('Error al buscar socio')
    } finally {
      setBuscando(false)
    }
  }

  // Buscar socio por token QR
  async function buscarSocioPorQR(tokenSocio) {
    setBuscando(true)
    setSocio(null)
    setSocioError(null)
    setImporte('')
    setDescuento(null)
    setVentaExito(false)

    try {
      const data = await api.get(`/comercio/${token}/socios/buscar-qr?token=${encodeURIComponent(tokenSocio)}`)
      if (data) {
        setSocio(data)
        setBusqueda(data.nroSocio || '')
      } else {
        setSocioError('No se encontro socio con ese codigo QR')
      }
    } catch (err) {
      setSocioError('Error al buscar socio')
    } finally {
      setBuscando(false)
    }
  }

  // Calcular descuento cuando cambia el importe
  useEffect(() => {
    if (!socio?.esActivo || !importe || isNaN(parseFloat(importe))) {
      setDescuento(null)
      return
    }

    async function calcular() {
      try {
        const data = await api.post(`/comercio/${token}/ventas/calcular`, {
          socioId: socio.id,
          importeOriginal: parseFloat(importe),
        })
        setDescuento(data)
      } catch (err) {
        console.error('Error calculando descuento:', err)
      }
    }

    const timer = setTimeout(calcular, 300)
    return () => clearTimeout(timer)
  }, [importe, socio, token])

  // Registrar venta
  async function registrarVenta() {
    if (!descuento) return

    setRegistrando(true)
    try {
      // Ejecutar API y esperar mínimo 1.5 segundos para mostrar el spinner
      const [response] = await Promise.all([
        api.post(`/comercio/${token}/ventas`, {
          socioId: socio.id,
          importeOriginal: parseFloat(importe),
        }),
        new Promise(resolve => setTimeout(resolve, 1500))
      ])
      setRegistrando(false)
      setVentaExito(true)
      // Limpiar para nueva venta
      setTimeout(() => {
        setBusqueda('')
        setSocio(null)
        setImporte('')
        setDescuento(null)
        setVentaExito(false)
      }, 3000)
    } catch (err) {
      setRegistrando(false)
      setError('Error al registrar la venta')
    }
  }

  // Nueva busqueda
  function nuevaBusqueda() {
    setBusqueda('')
    setSocio(null)
    setSocioError(null)
    setImporte('')
    setDescuento(null)
    setVentaExito(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Logo" className="h-14" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-primary font-bold text-lg whitespace-nowrap">Rojo Plus</span>
                <span className="text-xs text-gray-400 italic whitespace-nowrap">Tu pasión tiene recompensas</span>
              </div>
              <span className="text-gray-700 font-semibold text-lg block">
                {comercio?.nombre}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay de procesamiento */}
      {registrando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center shadow-2xl">
            <img
              src="/images/logo.png"
              alt="Procesando"
              className="h-24 mx-auto animate-pulse"
              style={{ animation: 'heartbeat 1s ease-in-out infinite' }}
            />
            <p className="mt-4 text-lg font-semibold text-gray-700">Registrando venta...</p>
            <p className="text-sm text-gray-500">Por favor espere</p>
          </div>
        </div>
      )}

      {/* Contenido */}
      <main className="max-w-md mx-auto px-4 py-6">
        {/* Mensaje de exito */}
        {ventaExito && (
          <div className="text-center py-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2">Venta Registrada</h2>
            <p className="text-gray-600 mb-6">El descuento fue aplicado correctamente</p>
            <Button onClick={nuevaBusqueda} className="w-full">
              NUEVA VENTA
            </Button>
          </div>
        )}

        {/* Error general */}
        {error && (
          <Alert type="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Busqueda de socio - ocultar cuando hay éxito */}
        {!ventaExito && (
          <>
            <section className="mb-6">
              <form onSubmit={buscarSocio}>
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Buscar socio
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nro. de socio o DNI"
                    className="input-field flex-1"
                    disabled={buscando}
                  />
                  <Button type="submit" loading={buscando} className="px-4">
                    Buscar
                  </Button>
                </div>
              </form>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary transition"
              >
                <QrCode className="w-5 h-5" />
                <span>Escanear QR del socio</span>
              </button>
            </section>

            {/* Error de busqueda */}
            {socioError && (
              <Alert type="error" className="mb-6">
                {socioError}
              </Alert>
            )}

            {/* Resultado del socio */}
            {socio && (
          <>
            <section className="mb-6">
              {socio.esActivo ? (
                <div className="card-success">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-700 font-bold">SOCIO ACTIVO</span>
                  </div>
                  <p className="text-gray-800 font-semibold">{socio.apellidoNombre}</p>
                  <p className="text-gray-500 text-sm">Socio #{socio.nroSocio}</p>
                </div>
              ) : (
                <div className="card-error">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700 font-bold">SOCIO INACTIVO</span>
                  </div>
                  <p className="text-gray-800 font-semibold">{socio.apellidoNombre}</p>
                  <p className="text-gray-500 text-sm">Socio #{socio.nroSocio}</p>
                  <p className="text-red-600 text-sm mt-2">No aplica descuento</p>
                  <Button
                    variant="secondary"
                    className="mt-4 w-full"
                    onClick={nuevaBusqueda}
                  >
                    Nueva busqueda
                  </Button>
                </div>
              )}
            </section>

            {/* Importe y descuento (solo si socio activo) */}
            {socio.esActivo && (
              <>
                <section className="mb-6">
                  <Input
                    label="Importe de la venta"
                    type="number"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    placeholder="$ 0.00"
                    min="0"
                    step="0.01"
                  />
                </section>

                {/* Calculo de descuento */}
                {descuento && (
                  <section className="mb-6">
                    <div className="bg-gray-100 rounded-lg p-4">
                      {descuento.aplicaAcumulacion && (
                        <div className="bg-primary-light text-primary-dark rounded p-2 mb-3 text-center flex items-center justify-center gap-2">
                          <Star className="w-4 h-4" />
                          <div>
                            <span className="font-semibold">DESCUENTO ESPECIAL</span>
                            <br />
                            <span className="text-sm">
                              {descuento.comprasEnPeriodo + 1}a compra en {comercio?.acumPeriodoDias || 7} dias
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between text-gray-600 mb-1">
                        <span>Descuento ({descuento.descuentoBasePct}%):</span>
                        <span>$ {descuento.descuentoBaseMonto?.toLocaleString('es-AR')}</span>
                      </div>

                      {descuento.aplicaAcumulacion && (
                        <div className="flex justify-between text-primary mb-1">
                          <span>Descuento extra ({descuento.descuentoAcumPct}%):</span>
                          <span>$ {descuento.descuentoAcumMonto?.toLocaleString('es-AR')}</span>
                        </div>
                      )}

                      <div className="border-t border-gray-300 pt-2 mt-2">
                        <div className="flex justify-between text-gray-800 font-bold text-lg">
                          <span>TOTAL A COBRAR:</span>
                          <span>$ {descuento.importeFinal?.toLocaleString('es-AR')}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Boton registrar */}
                <Button
                  className="w-full"
                  onClick={registrarVenta}
                  loading={registrando}
                  disabled={!descuento || !importe}
                >
                  REGISTRAR VENTA
                </Button>
              </>
            )}
          </>
        )}
          </>
        )}
      </main>

      {/* Scanner QR */}
      <QrScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={buscarSocioPorQR}
      />
    </div>
  )
}
