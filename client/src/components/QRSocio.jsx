import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

/**
 * Componente reutilizable para mostrar y descargar el QR del socio
 *
 * Uso:
 * <QRSocio tokenPortal={tokenPortal} nroSocio={nroSocio} size={256} />
 */
export default function QRSocio({
  tokenPortal,
  nroSocio,
  size = 200,
  showDownloadButton = true,
  showInstructions = false,
  className = '',
}) {
  const qrRef = useRef(null)
  const qrUrl = `${window.location.origin}/portal-socio/${tokenPortal}`

  const descargarQR = () => {
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
      link.download = `qr-socio-${nroSocio}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className={`text-center ${className}`}>
      <div
        ref={qrRef}
        className="inline-block bg-white p-4 rounded-lg shadow-md border-4 border-red-600"
      >
        <QRCodeSVG
          value={qrUrl}
          size={size}
          level="H"
          includeMargin={true}
          imageSettings={{
            src: '/images/logo.png',
            x: undefined,
            y: undefined,
            height: size * 0.2,
            width: size * 0.2,
            excavate: true,
          }}
        />
      </div>

      {showDownloadButton && (
        <div className="mt-4">
          <button
            onClick={descargarQR}
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Descargar QR
          </button>
        </div>
      )}

      {showInstructions && (
        <div className="mt-6 bg-gray-100 rounded-lg p-4 text-left">
          <h3 className="text-gray-800 font-semibold mb-2">Cómo usar tu QR</h3>
          <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
            <li>Guarda este enlace o descarga el QR en tu celular</li>
            <li>Al momento de pagar, muestra el QR al comerciante</li>
            <li>El comerciante escaneará tu código y aplicará el descuento</li>
          </ol>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-4">Socio N° {nroSocio}</p>
    </div>
  )
}
