import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
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
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import api from '../../../services/api'

export default function MiPerfilSocio({ socio, tokenPortal, onUpdate }) {
  const qrRef = useRef(null)
  const [mostrarQR, setMostrarQR] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [datosEditados, setDatosEditados] = useState({
    email: socio.email || '',
    celular: socio.celular || '',
    domicilio: socio.domicilio || '',
  })

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

  const handleGuardar = async () => {
    try {
      setGuardando(true)
      await api.put(`/socio/${tokenPortal}/perfil`, datosEditados)
      setModoEdicion(false)
      toast.success('Cambios guardados correctamente')
      onUpdate?.()
    } catch (err) {
      console.error('Error actualizando datos:', err)
      toast.error('Error al guardar los cambios. Por favor, intenta nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  const handleCancelar = () => {
    setDatosEditados({
      email: socio.email || '',
      celular: socio.celular || '',
      domicilio: socio.domicilio || '',
    })
    setModoEdicion(false)
  }

  return (
    <div className="space-y-8">
      {/* Header athletic */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Cuenta
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Mi <span style={{ color: 'var(--color-primary)' }}>perfil</span>
        </h1>
      </div>

      {/* Datos personales */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Datos Personales</h3>
          {!modoEdicion ? (
            <button
              onClick={() => setModoEdicion(true)}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Editar</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancelar}
                className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
              >
                <XMarkIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Cancelar</span>
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors rounded-lg disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {/* Nombre completo - No editable */}
          <div className="px-6 py-4 flex items-start space-x-4">
            <div className="bg-gray-100 rounded-lg p-2">
              <UserIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Nombre completo</p>
              <p className="mt-1 text-base text-gray-900">{socio.apellidoNombre}</p>
            </div>
          </div>

          {/* Fecha de nacimiento - No editable */}
          <div className="px-6 py-4 flex items-start space-x-4">
            <div className="bg-gray-100 rounded-lg p-2">
              <CalendarIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Fecha de nacimiento</p>
              <p className="mt-1 text-base text-gray-900">
                {socio.fechaNacimiento
                  ? new Date(socio.fechaNacimiento).toLocaleDateString('es-AR') +
                    ` (${calcularEdad(socio.fechaNacimiento)} años)`
                  : 'No especificada'}
              </p>
            </div>
          </div>

          {/* Email - Editable */}
          <div className="px-6 py-4 flex items-start space-x-4">
            <div className="bg-gray-100 rounded-lg p-2">
              <EnvelopeIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Email</p>
              {modoEdicion ? (
                <input
                  type="email"
                  value={datosEditados.email}
                  onChange={(e) =>
                    setDatosEditados({ ...datosEditados, email: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="tu-email@ejemplo.com"
                />
              ) : (
                <p className="mt-1 text-base text-gray-900">{socio.email || 'No especificado'}</p>
              )}
            </div>
          </div>

          {/* Celular - Editable */}
          <div className="px-6 py-4 flex items-start space-x-4">
            <div className="bg-gray-100 rounded-lg p-2">
              <PhoneIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Celular</p>
              {modoEdicion ? (
                <input
                  type="tel"
                  value={datosEditados.celular}
                  onChange={(e) =>
                    setDatosEditados({ ...datosEditados, celular: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="11 1234 5678"
                />
              ) : (
                <p className="mt-1 text-base text-gray-900">{socio.celular || 'No especificado'}</p>
              )}
            </div>
          </div>

          {/* Domicilio - Editable */}
          <div className="px-6 py-4 flex items-start space-x-4">
            <div className="bg-gray-100 rounded-lg p-2">
              <HomeIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Domicilio</p>
              {modoEdicion ? (
                <input
                  type="text"
                  value={datosEditados.domicilio}
                  onChange={(e) =>
                    setDatosEditados({ ...datosEditados, domicilio: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Calle 123, Pilar"
                />
              ) : (
                <p className="mt-1 text-base text-gray-900">{socio.domicilio || 'No especificado'}</p>
              )}
            </div>
          </div>
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
