import { useState, useEffect } from 'react'
import api from '../../../services/api'
import toast from 'react-hot-toast'
import {
  MapPinIcon,
  PhoneIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import { TagIcon } from '@heroicons/react/24/solid'
import { Lightbulb, Navigation } from 'lucide-react'

// Función para formatear teléfono para WhatsApp
function formatearTelefonoWhatsApp(telefono) {
  if (!telefono) return ''

  // Eliminar todos los caracteres no numéricos
  let numeros = telefono.replace(/\D/g, '')

  // Si ya tiene código de país, retornar
  if (numeros.startsWith('549')) {
    return numeros
  }

  // Si empieza con 54, agregar 9
  if (numeros.startsWith('54')) {
    return '549' + numeros.substring(2)
  }

  // Si empieza con 15, quitar el 15 y agregar 549
  if (numeros.startsWith('15')) {
    return '549' + numeros.substring(2)
  }

  // Si empieza con 0, quitar el 0 y agregar 549
  if (numeros.startsWith('0')) {
    return '549' + numeros.substring(1)
  }

  // Sino, agregar 549 al principio
  return '549' + numeros
}

export default function BeneficiosSocio({ socio, tokenPortal }) {
  const [comercios, setComercios] = useState([])
  const [rubros, setRubros] = useState([])
  const [rubroSeleccionado, setRubroSeleccionado] = useState('')
  const [loading, setLoading] = useState(true)
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null)
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async (lat = null, lng = null) => {
    try {
      setLoading(true)
      let url = '/comercios'
      if (lat && lng) {
        url += `?lat=${lat}&lng=${lng}`
      }
      const [comerciosData, rubrosData] = await Promise.all([
        api.get(url),
        api.get('/comercios/rubros'),
      ])
      setComercios(comerciosData)
      setRubros(rubrosData)
    } catch (err) {
      console.error('Error cargando comercios:', err)
    } finally {
      setLoading(false)
    }
  }

  const obtenerUbicacion = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización')
      return
    }

    setObteniendoUbicacion(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUbicacionUsuario([latitude, longitude])
        cargarDatos(latitude, longitude)
        setObteniendoUbicacion(false)
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error)
        toast.error('No pudimos obtener tu ubicación. Verifica los permisos del navegador.')
        setObteniendoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Filtrar comercios por rubro
  const comerciosFiltrados = rubroSeleccionado
    ? comercios.filter((c) => c.rubro === rubroSeleccionado)
    : comercios

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header athletic */}
      <div>
        <div className="pub-eyebrow mb-3" style={{ color: 'var(--text-dim)' }}>
          Comunidad
        </div>
        <h1 className="font-display-sport" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 0.96, color: 'var(--text)' }}>
          Tus <span style={{ color: 'var(--color-primary)' }}>beneficios</span>
        </h1>
        <p className="mt-3 text-sm md:text-base" style={{ color: 'var(--text-dim)' }}>
          Descuentos exclusivos en {comercios.length} comercios adheridos.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrar por rubro
          </label>
          <select
            value={rubroSeleccionado}
            onChange={(e) => setRubroSeleccionado(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos los rubros</option>
            {rubros.map((rubro) => (
              <option key={rubro.id} value={rubro.nombre}>
                {rubro.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={obtenerUbicacion}
          disabled={obteniendoUbicacion}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Navigation className="w-4 h-4" />
          {obteniendoUbicacion
            ? 'Obteniendo ubicación...'
            : ubicacionUsuario
            ? 'Actualizar ubicación'
            : 'Ordenar por cercanía'}
        </button>

        {ubicacionUsuario && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-blue-700 text-sm">
            <Navigation className="w-4 h-4 flex-shrink-0" />
            <span>Mostrando comercios ordenados por cercanía</span>
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 font-semibold mb-2 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          Cómo usar tus beneficios
        </h3>
        <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
          <li>Visita cualquiera de estos comercios</li>
          <li>Presenta tu código QR desde la sección "Perfil"</li>
          <li>El comerciante aplicará automáticamente el descuento</li>
        </ol>
      </div>

      {/* Lista de comercios */}
      <div className="space-y-4">
        {comerciosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BuildingStorefrontIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {rubroSeleccionado
                ? 'No hay comercios en este rubro'
                : 'No hay comercios adheridos todavía'}
            </p>
          </div>
        ) : (
          comerciosFiltrados.map((comercio) => (
            <div
              key={comercio.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4 flex gap-4">
                {/* Logo */}
                <div className="flex-shrink-0">
                  {comercio.logo ? (
                    <img
                      src={comercio.logo}
                      alt={comercio.nombre}
                      className="w-20 h-20 object-contain rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                      <BuildingStorefrontIcon className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-900 truncate">
                      {comercio.nombre}
                    </h3>
                    <span className="flex-shrink-0 bg-green-100 text-green-700 px-3 py-1 rounded-full text-base font-bold flex items-center gap-1">
                      <TagIcon className="w-4 h-4" />
                      {comercio.descuentoPct}%
                    </span>
                  </div>

                  {comercio.rubro && (
                    <p className="text-sm text-green-600 font-medium mb-2">
                      {comercio.rubro}
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{comercio.direccion}</span>
                    </p>
                    {comercio.telefono && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <PhoneIcon className="w-4 h-4 flex-shrink-0" />
                        <a
                          href={`https://wa.me/${formatearTelefonoWhatsApp(comercio.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700 font-medium hover:underline"
                        >
                          {comercio.telefono}
                        </a>
                      </p>
                    )}
                  </div>

                  {comercio.distancia !== null && comercio.distancia !== undefined && (
                    <p className="mt-2 text-sm text-blue-600 font-medium flex items-center gap-1">
                      <Navigation className="w-4 h-4" />
                      {comercio.distancia < 1
                        ? `${Math.round(comercio.distancia * 1000)} m`
                        : `${comercio.distancia} km`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
