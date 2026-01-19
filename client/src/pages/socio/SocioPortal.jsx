import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Download, CheckCircle, XCircle, Store } from 'lucide-react'
import { Button } from '../../components/Button'
import api from '../../services/api'

export default function SocioPortal() {
  const { tokenPortal } = useParams()
  const qrRef = useRef(null)

  const [socio, setSocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // URL que contiene el QR
  const qrUrl = `${window.location.origin}/s/${tokenPortal}`

  useEffect(() => {
    async function cargarSocio() {
      try {
        const data = await api.get(`/socio/${tokenPortal}`)
        setSocio(data)
      } catch (err) {
        setError('No se pudo cargar la informacion del socio')
      } finally {
        setLoading(false)
      }
    }
    cargarSocio()
  }, [tokenPortal])

  // Descargar QR como imagen
  function descargarQR() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = 400
      canvas.height = 400
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, 400, 400)

      const link = document.createElement('a')
      link.download = `qr-socio-${socio?.nroSocio || 'rojoplus'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
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

  if (error || !socio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Enlace no valido</h1>
          <p className="text-gray-600">El enlace que seguiste no es valido o ha expirado.</p>
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
                <span className="text-xs text-gray-400 italic whitespace-nowrap">Tu pasion tiene recompensas</span>
              </div>
              <span className="text-gray-600 text-sm block">Portal del Socio</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-md mx-auto px-4 py-6">
        {/* Estado del socio */}
        <section className="mb-6">
          {socio.esActivo ? (
            <div className="card-success">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-bold">SOCIO ACTIVO</span>
              </div>
              <p className="text-gray-800 font-semibold text-lg">{socio.apellidoNombre}</p>
              <p className="text-gray-500">Socio #{socio.nroSocio}</p>
              {socio.categoria && (
                <p className="text-gray-500 text-sm mt-1">Categoria: {socio.categoria}</p>
              )}
            </div>
          ) : (
            <div className="card-error">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-bold">SOCIO INACTIVO</span>
              </div>
              <p className="text-gray-800 font-semibold text-lg">{socio.apellidoNombre}</p>
              <p className="text-gray-500">Socio #{socio.nroSocio}</p>
              <p className="text-red-600 text-sm mt-2">
                Regulariza tu situacion en el club para acceder a los descuentos
              </p>
            </div>
          )}
        </section>

        {/* QR Code */}
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <h2 className="text-gray-800 font-semibold mb-4">Tu codigo QR</h2>
            <p className="text-gray-500 text-sm mb-4">
              Presenta este codigo en los comercios adheridos para obtener tu descuento
            </p>
            <div ref={qrRef} className="inline-block bg-white p-4 rounded-lg">
              <QRCodeSVG
                value={qrUrl}
                size={200}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: '/images/logo.png',
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={descargarQR} className="inline-flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Descargar QR
              </Button>
              <Link
                to="/comercios"
                className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium"
              >
                <Store className="w-4 h-4" />
                Ver comercios adheridos
              </Link>
            </div>
          </div>
        </section>

        {/* Instrucciones */}
        <section>
          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="text-gray-800 font-semibold mb-2">Como usar tu QR</h3>
            <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
              <li>Guarda este enlace o descarga el QR en tu celular</li>
              <li>Al momento de pagar, muestra el QR al comerciante</li>
              <li>El comerciante escaneara tu codigo y aplicara el descuento</li>
            </ol>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto px-4 py-6 text-center">
        <p className="text-gray-400 text-sm">
          Club Sportivo Pilar - El Rojo de la Avenida
        </p>
      </footer>
    </div>
  )
}
