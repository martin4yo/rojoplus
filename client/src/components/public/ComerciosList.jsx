import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Phone, Navigation, Store, Percent } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

// Fix para el icono de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Icono personalizado para comercios
const comercioIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Icono para ubicacion del usuario
const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="32" height="32">
      <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// Coordenadas de Pilar, Buenos Aires
const PILAR_COORDS = [-34.4587, -58.9142]

// Funcion para formatear telefono para WhatsApp
function formatearTelefonoWhatsApp(telefono) {
  if (!telefono) return ''

  // Eliminar todos los caracteres no numericos
  let numeros = telefono.replace(/\D/g, '')

  // Si ya tiene codigo de pais, retornar
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

/**
 * Componente reutilizable para mostrar lista de comercios adheridos
 * @param {boolean} showHeader - Mostrar encabezado hero (default: true)
 * @param {boolean} showInfo - Mostrar seccion de info adicional (default: true)
 * @param {string} className - Clases CSS adicionales
 */
export default function ComerciosList({ showHeader = true, showInfo = true, className = '' }) {
  const [comercios, setComercios] = useState([])
  const [rubros, setRubros] = useState([])
  const [rubroSeleccionado, setRubroSeleccionado] = useState('')
  const [loading, setLoading] = useState(true)
  const [ubicacionUsuario, setUbicacionUsuario] = useState(null)
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false)
  const [vista, setVista] = useState('lista') // 'lista' o 'mapa'

  // Cargar comercios y rubros
  useEffect(() => {
    cargarComercios()
    cargarRubros()
  }, [])

  async function cargarRubros() {
    try {
      const data = await api.get('/rubros')
      setRubros(data)
    } catch (err) {
      console.error('Error cargando rubros:', err)
    }
  }

  async function cargarComercios(lat, lng) {
    setLoading(true)
    try {
      let url = '/comercios'
      if (lat && lng) {
        url += `?lat=${lat}&lng=${lng}`
      }
      const data = await api.get(url)
      setComercios(data)
    } catch (err) {
      console.error('Error cargando comercios:', err)
    } finally {
      setLoading(false)
    }
  }

  function obtenerUbicacion() {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalizacion')
      return
    }

    setObteniendoUbicacion(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUbicacionUsuario([latitude, longitude])
        cargarComercios(latitude, longitude)
        setObteniendoUbicacion(false)
      },
      (error) => {
        console.error('Error obteniendo ubicacion:', error)
        toast.error('No pudimos obtener tu ubicacion. Verifica los permisos del navegador.')
        setObteniendoUbicacion(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Filtrar comercios por rubro
  const comerciosFiltrados = rubroSeleccionado
    ? comercios.filter((c) => c.rubro === rubroSeleccionado)
    : comercios

  // Comercios con ubicacion para el mapa
  const comerciosConUbicacion = comerciosFiltrados.filter((c) => c.latitud && c.longitud)

  return (
    <div className={className}>
      {/* Hero */}
      {showHeader && (
        <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Beneficios para Socios
            </h1>
            <p className="text-base text-primary-100 max-w-2xl mx-auto">
              Descuentos exclusivos en comercios adheridos de Pilar y alrededores
            </p>
          </div>
        </section>
      )}

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Controles */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setVista('lista')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                vista === 'lista'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setVista('mapa')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                vista === 'mapa'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Mapa
            </button>
            <select
              value={rubroSeleccionado}
              onChange={(e) => setRubroSeleccionado(e.target.value)}
              className="h-[42px] px-4 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            {obteniendoUbicacion
              ? 'Obteniendo...'
              : ubicacionUsuario
              ? 'Actualizar ubicacion'
              : 'Ordenar por cercania'}
          </button>
        </div>

        {ubicacionUsuario && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-blue-700">
            <Navigation className="w-4 h-4" />
            <span className="text-sm">
              Mostrando comercios ordenados por cercania a tu ubicacion
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Cargando comercios...</p>
            </div>
          </div>
        ) : vista === 'lista' ? (
          /* Vista Lista */
          <div className="space-y-4">
            {comerciosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{rubroSeleccionado ? 'No hay comercios en este rubro' : 'No hay comercios adheridos todavia'}</p>
              </div>
            ) : (
              comerciosFiltrados.map((comercio) => (
                <div
                  key={comercio.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex gap-4"
                >
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
                        <Store className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 truncate">{comercio.nombre}</h3>
                      <span className="flex-shrink-0 bg-green-100 text-green-700 px-2 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {comercio.descuentoPct}%
                      </span>
                    </div>

                    {comercio.rubro && (
                      <p className="text-sm text-primary font-medium">{comercio.rubro}</p>
                    )}

                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{comercio.direccion}</span>
                      </p>
                      {comercio.telefono && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <a
                            href={`https://wa.me/${formatearTelefonoWhatsApp(comercio.telefono)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
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
              ))
            )}
          </div>
        ) : (
          /* Vista Mapa */
          <div className="h-[500px] rounded-lg overflow-hidden border border-gray-300">
            <MapContainer
              center={ubicacionUsuario || PILAR_COORDS}
              zoom={ubicacionUsuario ? 14 : 13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Marcador del usuario */}
              {ubicacionUsuario && <Marker position={ubicacionUsuario} icon={userIcon} />}

              {/* Marcadores de comercios */}
              {comerciosConUbicacion.map((comercio) => (
                <Marker
                  key={comercio.id}
                  position={[comercio.latitud, comercio.longitud]}
                  icon={comercioIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{comercio.nombre}</p>
                      <p className="text-green-600">{comercio.descuentoPct}% descuento</p>
                      <p className="text-gray-600">{comercio.direccion}</p>
                      {comercio.telefono && (
                        <a
                          href={`https://wa.me/${formatearTelefonoWhatsApp(comercio.telefono)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary"
                        >
                          {comercio.telefono}
                        </a>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Info adicional */}
        {showInfo && (
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <h3 className="text-gray-800 font-semibold mb-2">Como obtener descuentos?</h3>
            <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
              <li>Accede a tu QR desde el portal de socios</li>
              <li>Visita cualquiera de estos comercios adheridos</li>
              <li>Presenta tu QR al momento de pagar</li>
              <li>El comerciante aplicara automaticamente el descuento</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                to="/mi-qr"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium"
              >
                Obtener mi QR
              </Link>
              <Link
                to="/inscripcion-socio"
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary-50 font-medium"
              >
                Quiero ser Socio
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
