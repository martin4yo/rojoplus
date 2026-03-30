import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import ImageUpload from '../../components/ImageUpload'
import api from '../../services/api'
import { MapPin, ChevronLeft, ChevronRight, Check, ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'

// Fix para el icono de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Coordenadas de Pilar, Buenos Aires
const PILAR_COORDS = [-34.4587, -58.9142]

// Componente para manejar clicks en el mapa
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
    },
  })
  return position ? <Marker position={position} /> : null
}

const DIAS = [
  { value: 'LUN', label: 'Lunes' },
  { value: 'MAR', label: 'Martes' },
  { value: 'MIE', label: 'Miércoles' },
  { value: 'JUE', label: 'Jueves' },
  { value: 'VIE', label: 'Viernes' },
  { value: 'SAB', label: 'Sábado' },
  { value: 'DOM', label: 'Domingo' },
]

export default function ComercioEditar() {
  const { token } = useParams()
  const navigate = useNavigate()

  // Estado del wizard
  const [paso, setPaso] = useState(1)
  const [rubros, setRubros] = useState([])
  const [descuentosDisponibles, setDescuentosDisponibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Paso 1: Datos básicos
  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    rubroId: '',
    telefono: '',
    email: '',
    cuit: '',
    responsable: '',
  })

  // Paso 2: Logo y ubicación
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoBase64, setLogoBase64] = useState(null)
  const [logoChanged, setLogoChanged] = useState(false)
  const [ubicacion, setUbicacion] = useState(null)

  // Paso 3: Descuento y días
  const [descuentoSeleccionado, setDescuentoSeleccionado] = useState('')
  const [diasSeleccionados, setDiasSeleccionados] = useState([])

  // Cargar datos del comercio y listas
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [comercioData, rubrosData, descuentosData] = await Promise.all([
          api.get(`/comercio/${token}`),
          api.get('/rubros'),
          api.get('/comercios/descuentos-disponibles'),
        ])

        // Cargar datos del formulario
        setForm({
          nombre: comercioData.nombre || '',
          direccion: comercioData.direccion || '',
          rubroId: comercioData.rubroId?.toString() || '',
          telefono: comercioData.telefono || '',
          email: comercioData.email || '',
          cuit: comercioData.cuit || '',
          responsable: comercioData.responsable || '',
        })

        // Cargar logo si existe
        if (comercioData.logo) {
          // Usar ruta relativa para que Vite maneje el proxy automáticamente
          setLogoPreview(comercioData.logo)
        }

        // Cargar ubicación si existe
        if (comercioData.latitud && comercioData.longitud) {
          setUbicacion([parseFloat(comercioData.latitud), parseFloat(comercioData.longitud)])
        }

        // Cargar descuento seleccionado
        if (comercioData.descuentoDisponibleId) {
          setDescuentoSeleccionado(comercioData.descuentoDisponibleId)
        }

        // Cargar días seleccionados
        if (comercioData.diasAplicacion && Array.isArray(comercioData.diasAplicacion)) {
          setDiasSeleccionados(comercioData.diasAplicacion)
        }

        setRubros(rubrosData || [])
        setDescuentosDisponibles(descuentosData || [])
      } catch (err) {
        setError('Error al cargar datos del comercio')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargarDatos()
  }, [token])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleLogoChange(base64) {
    if (base64) {
      setLogoPreview(base64)
      setLogoBase64(base64)
      setLogoChanged(true)
    } else {
      setLogoPreview(null)
      setLogoBase64(null)
      setLogoChanged(true)
    }
  }

  function toggleDia(dia) {
    if (diasSeleccionados.includes(dia)) {
      setDiasSeleccionados(diasSeleccionados.filter(d => d !== dia))
    } else {
      setDiasSeleccionados([...diasSeleccionados, dia])
    }
  }

  function validarPaso1() {
    if (!form.nombre || !form.direccion || !form.rubroId || !form.telefono || !form.email || !form.cuit || !form.responsable) {
      setError('Por favor, completá todos los campos obligatorios')
      return false
    }
    setError(null)
    return true
  }

  function siguientePaso() {
    if (paso === 1 && !validarPaso1()) return
    if (paso === 3) return
    setPaso(paso + 1)
    setError(null)
    setSuccess(null)
  }

  function pasoAnterior() {
    if (paso === 1) return
    setPaso(paso - 1)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        ...form,
        rubroId: parseInt(form.rubroId),
        latitud: ubicacion ? ubicacion[0] : null,
        longitud: ubicacion ? ubicacion[1] : null,
        descuentoDisponibleId: descuentoSeleccionado ? parseInt(descuentoSeleccionado) : null,
        diasAplicacion: diasSeleccionados.length > 0 ? diasSeleccionados : null,
      }

      // Solo enviar logo si cambió
      if (logoChanged) {
        payload.logo = logoBase64
      }

      await api.put(`/comercios/${token}/actualizar`, payload)
      setSuccess('Datos actualizados correctamente')
      setTimeout(() => {
        navigate(`/c/${token}`)
      }, 2000)
    } catch (err) {
      setError(err.message || 'Error al actualizar los datos')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/c/${token}`)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Logo" className="h-10" />
              <div>
                <h1 className="font-bold text-gray-800">Editar Datos</h1>
                <p className="text-xs text-gray-500">Actualiza la informacion de tu comercio</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${
                    paso > num
                      ? 'bg-green-500 text-white'
                      : paso === num
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {paso > num ? <Check className="w-5 h-5" /> : num}
                </div>
                {num < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition ${
                      paso > num ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span className={paso === 1 ? 'text-primary font-medium' : ''}>Datos básicos</span>
            <span className={paso === 2 ? 'text-primary font-medium' : ''}>Logo y ubicación</span>
            <span className={paso === 3 ? 'text-primary font-medium' : ''}>Descuento</span>
          </div>
        </div>

        {error && (
          <Alert type="error" className="mb-6" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert type="success" className="mb-6">
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PASO 1: Datos Básicos */}
          {paso === 1 && (
            <div className="space-y-4 animate-fade-in">
              <Input
                label="Nombre del comercio *"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Panadería Don Juan"
                required
              />

              <Input
                label="Dirección *"
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                placeholder="Ej: Av. San Martín 1234"
                required
              />

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Rubro *
                </label>
                <select
                  name="rubroId"
                  value={form.rubroId}
                  onChange={handleChange}
                  className="input-field"
                  required
                >
                  <option value="">Seleccionar rubro</option>
                  {rubros.map((rubro) => (
                    <option key={rubro.id} value={rubro.id}>
                      {rubro.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Teléfono *"
                name="telefono"
                type="tel"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: 0230-4551234"
                required
              />

              <Input
                label="Email *"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="comercio@email.com"
                required
              />

              <Input
                label="CUIT *"
                name="cuit"
                value={form.cuit}
                onChange={handleChange}
                placeholder="Ej: 20-12345678-9"
                required
              />

              <Input
                label="Nombre del responsable *"
                name="responsable"
                value={form.responsable}
                onChange={handleChange}
                placeholder="Nombre y apellido"
                required
              />
            </div>
          )}

          {/* PASO 2: Logo y Ubicación */}
          {paso === 2 && (
            <div className="space-y-4 animate-fade-in">
              {/* Logo del comercio */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Logo del comercio
                </label>
                <ImageUpload
                  value={logoPreview}
                  onChange={handleLogoChange}
                  returnBase64={true}
                  returnFile={false}
                  maxSize={2 * 1024 * 1024}
                  accept="image/*"
                  placeholder="Subir logo del comercio"
                  previewSize="sm"
                  onError={(error) => setError(error)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Formato JPG, PNG o GIF. Máx 2MB.
                </p>
              </div>

              {/* Ubicación en mapa */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Ubicación en el mapa
                  </div>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Hacé click en el mapa para actualizar la ubicación de tu comercio
                </p>
                <div className="h-64 rounded-lg overflow-hidden border border-gray-300">
                  <MapContainer
                    center={ubicacion || PILAR_COORDS}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker position={ubicacion} setPosition={setUbicacion} />
                  </MapContainer>
                </div>
                {ubicacion && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-green-600">
                      ✓ Ubicación configurada
                    </p>
                    <button
                      type="button"
                      onClick={() => setUbicacion(null)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Quitar ubicación
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PASO 3: Descuento y Días */}
          {paso === 3 && (
            <div className="space-y-4 animate-fade-in">
              {/* Selección de descuento */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Descuento a ofrecer
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Seleccioná el porcentaje de descuento que ofrecerás a los socios
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {descuentosDisponibles.map((desc) => (
                    <button
                      key={desc.id}
                      type="button"
                      onClick={() => setDescuentoSeleccionado(desc.id)}
                      className={`p-4 rounded-lg border-2 text-center transition ${
                        descuentoSeleccionado === desc.id
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl font-bold text-primary">{desc.porcentaje}%</div>
                      <div className="text-xs text-gray-600 mt-1">{desc.nombre}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selección de días */}
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Días de aplicación del descuento
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Si no seleccionás ningún día, el descuento aplicará todos los días
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIAS.map((dia) => (
                    <button
                      key={dia.value}
                      type="button"
                      onClick={() => toggleDia(dia.value)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                        diasSeleccionados.includes(dia.value)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
                {diasSeleccionados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiasSeleccionados([])}
                    className="text-xs text-red-500 hover:underline mt-2"
                  >
                    Limpiar selección (aplicará todos los días)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex gap-3 pt-4">
            {paso > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={pasoAnterior}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
            )}
            {paso < 3 ? (
              <Button
                type="button"
                onClick={siguientePaso}
                className="flex-1 flex items-center justify-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="flex-1"
                loading={saving}
              >
                GUARDAR CAMBIOS
              </Button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
