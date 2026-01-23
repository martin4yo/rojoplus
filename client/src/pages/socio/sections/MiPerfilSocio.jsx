import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  HomeIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

export default function MiPerfilSocio({ socio, tokenPortal, onUpdate }) {
  const qrRef = useRef(null)
  const [mostrarQR, setMostrarQR] = useState(false)

  const qrUrl = `${window.location.origin}/s/${tokenPortal}`

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
      link.download = `qr-socio-${socio.nroSocio}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return null
    const hoy = new Date()
    const nacimiento = new Date(fechaNac)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--
    }
    return edad
  }

  const datosPersonales = [
    {
      icon: UserIcon,
      label: 'Nombre completo',
      value: socio.apellidoNombre,
    },
    {
      icon: CalendarIcon,
      label: 'Fecha de nacimiento',
      value: socio.fechaNacimiento
        ? new Date(socio.fechaNacimiento).toLocaleDateString('es-AR') +
          ` (${calcularEdad(socio.fechaNacimiento)} años)`
        : 'No especificada',
    },
    {
      icon: EnvelopeIcon,
      label: 'Email',
      value: socio.email || 'No especificado',
    },
    {
      icon: PhoneIcon,
      label: 'Celular',
      value: socio.celular || 'No especificado',
    },
    {
      icon: HomeIcon,
      label: 'Domicilio',
      value: socio.domicilio || 'No especificado',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header de perfil */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center space-x-4">
          <div className="bg-white bg-opacity-20 rounded-full p-4">
            <UserIcon className="h-12 w-12" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{socio.apellidoNombre}</h2>
            <p className="text-red-100 mt-1">Socio N° {socio.nroSocio}</p>
            <div className="flex items-center space-x-4 mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white bg-opacity-20 text-sm">
                {socio.tipoSocio || 'Socio'}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white bg-opacity-20 text-sm">
                {socio.estado || 'Activo'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Datos Personales</h3>
          <button className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors">
            <PencilIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Editar</span>
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {datosPersonales.map((dato, index) => (
            <div key={index} className="px-6 py-4 flex items-start space-x-4">
              <div className="bg-gray-100 rounded-lg p-2">
                <dato.icon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500">{dato.label}</p>
                <p className="mt-1 text-base text-gray-900">{dato.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grupo familiar */}
      {socio.grupoFamiliar && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <UserGroupIcon className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Mi Grupo Familiar</h3>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600">
              Grupo: <span className="font-semibold">{socio.grupoFamiliar.nombre}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Titular: {socio.grupoFamiliar.titularNombre}
            </p>
          </div>
        </div>
      )}

      {/* Mi QR */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QrCodeIcon className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Mi Código QR</h3>
            </div>
            <button
              onClick={() => setMostrarQR(!mostrarQR)}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              {mostrarQR ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        {mostrarQR && (
          <div className="p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Presenta este código en comercios adheridos para obtener descuentos
              </p>
              <div
                ref={qrRef}
                className="inline-block bg-white p-4 rounded-lg shadow-md border-4 border-red-600"
              >
                <QRCodeSVG
                  value={qrUrl}
                  size={256}
                  level="H"
                  includeMargin={true}
                  fgColor="#DC2626"
                />
              </div>
              <div className="mt-4">
                <button
                  onClick={descargarQR}
                  className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Descargar QR
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Socio N° {socio.nroSocio}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botón de cerrar sesión */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <button className="w-full py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}
