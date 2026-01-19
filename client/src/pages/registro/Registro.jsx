import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { Upload, MapPin, X } from 'lucide-react'

// Fix para el icono de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Clave pública de reCAPTCHA (v2 checkbox)
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' // Clave de prueba de Google

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

export default function Registro() {
  const navigate = useNavigate()
  const recaptchaRef = useRef(null)
  const fileInputRef = useRef(null)
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoBase64, setLogoBase64] = useState(null)
  const [ubicacion, setUbicacion] = useState(null)

  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    rubroId: '',
    telefono: '',
    email: '',
    cuit: '',
    responsable: '',
  })

  // Cargar rubros
  useEffect(() => {
    async function cargarRubros() {
      try {
        const data = await api.get('/rubros')
        setRubros(data)
      } catch (err) {
        console.error('Error cargando rubros:', err)
      }
    }
    cargarRubros()
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleCaptchaChange(token) {
    setCaptchaToken(token)
  }

  function handleCaptchaExpired() {
    setCaptchaToken(null)
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen')
      return
    }

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar los 2MB')
      return
    }

    // Crear preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result)
      setLogoBase64(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function removeLogo() {
    setLogoPreview(null)
    setLogoBase64(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validar captcha
    if (!captchaToken) {
      setError('Por favor, completá el captcha para verificar que no sos un robot.')
      return
    }

    setLoading(true)

    try {
      await api.post('/comercios/registro', {
        ...form,
        rubroId: parseInt(form.rubroId),
        captchaToken,
        logo: logoBase64,
        latitud: ubicacion ? ubicacion[0] : null,
        longitud: ubicacion ? ubicacion[1] : null,
      })
      navigate('/registro/exito')
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud')
      // Resetear captcha en caso de error
      recaptchaRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Logo" className="h-10" />
            <div>
              <h1 className="font-bold text-gray-800">Rojo Plus</h1>
              <p className="text-xs text-gray-500">Club Sportivo Pilar</p>
            </div>
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Adherí tu comercio
        </h2>
        <p className="text-gray-600 mb-6">
          Completá el formulario para sumarte al programa de beneficios.
          <br />
          <span className="text-primary font-medium">
            Rojo Plus no es un gasto, es una herramienta para vender más.
          </span>
        </p>

        {error && (
          <Alert type="error" className="mb-6">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Logo del comercio */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Logo del comercio (opcional)
            </label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Preview"
                    className="w-24 h-24 object-contain rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Subir</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <p className="text-xs text-gray-500">
                Formato JPG, PNG o GIF. Máx 2MB.
              </p>
            </div>
          </div>

          {/* Ubicación en mapa */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ubicación en el mapa (opcional)
              </div>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Hacé click en el mapa para marcar la ubicación de tu comercio
            </p>
            <div className="h-64 rounded-lg overflow-hidden border border-gray-300">
              <MapContainer
                center={PILAR_COORDS}
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
                  ✓ Ubicación seleccionada
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

          {/* Aviso importante sobre aprobación */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 my-6">
            <p className="text-amber-800 text-center font-medium">
              ⚠️ Tu solicitud requiere aprobación del Club
            </p>
            <p className="text-amber-700 text-sm text-center mt-1">
              Una vez enviada, será revisada por la administración.
              <br />
              Recibirás un email con tu link de acceso cuando sea aprobada.
            </p>
          </div>

          {/* reCAPTCHA */}
          <div className="flex justify-center my-6">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={RECAPTCHA_SITE_KEY}
              onChange={handleCaptchaChange}
              onExpired={handleCaptchaExpired}
              hl="es"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={loading}
            disabled={!captchaToken}
          >
            ENVIAR SOLICITUD
          </Button>
        </form>
      </main>
    </div>
  )
}
