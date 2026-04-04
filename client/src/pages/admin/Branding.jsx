import { useState, useEffect } from 'react'
import { Palette, Upload, RotateCcw, Save, Plus, Trash2, Images, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function Branding() {
  const { tenant } = useTenant()
  const [loading, setLoading] = useState(false)
  const [colores, setColores] = useState({})
  const [defaultColors, setDefaultColors] = useState({})
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [changed, setChanged] = useState(false)
  const [heroImages, setHeroImages] = useState([])
  const [heroChanged, setHeroChanged] = useState(false)
  const [fechaFundacion, setFechaFundacion] = useState('')
  const [fechaChanged, setFechaChanged] = useState(false)

  // Cargar datos iniciales
  useEffect(() => {
    if (tenant?.id) {
      cargarDatos()
    }
  }, [tenant])

  async function cargarDatos() {
    try {
      setLoading(true)

      const [res, defaultRes, heroRes, fechaRes] = await Promise.all([
        api.get('/admin/branding'),
        api.getFull('/admin/branding/default-colors'),
        api.get('/admin/branding/hero-images'),
        api.get('/admin/branding/fecha-fundacion'),
      ])

      setColores(res?.colores || {})
      setLogoUrl(res?.logoUrl || '')
      setFaviconUrl(res?.faviconUrl || '')
      setDefaultColors(defaultRes || {})
      setHeroImages(Array.isArray(heroRes) ? heroRes : [])
      setFechaFundacion(fechaRes || '')
    } catch (error) {
      toast.error('Error cargando branding: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleColorChange(key, value) {
    setColores(prev => ({
      ...prev,
      [key]: value
    }))
    setChanged(true)
  }

  function handleLogoChange(value) {
    setLogoUrl(value)
    setChanged(true)
  }

  function handleFaviconChange(value) {
    setFaviconUrl(value)
    setChanged(true)
  }

  async function guardarColores() {
    try {
      setLoading(true)
      await api.put('/admin/branding/colores', { colores })
      toast.success('Colores guardados')
      setChanged(false)
    } catch (error) {
      toast.error('Error guardando colores: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function guardarLogo() {
    try {
      setLoading(true)
      await api.put('/admin/branding/logo', { logoUrl })
      toast.success('Logo guardado')
      setChanged(false)
    } catch (error) {
      toast.error('Error guardando logo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function guardarFavicon() {
    try {
      setLoading(true)
      await api.put('/admin/branding/favicon', { faviconUrl })
      toast.success('Favicon guardado')
      setChanged(false)
    } catch (error) {
      toast.error('Error guardando favicon: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function guardarHeroImages() {
    try {
      setLoading(true)
      await api.put('/admin/branding/hero-images', { images: heroImages })
      toast.success('Imágenes del hero guardadas')
      setHeroChanged(false)
    } catch (error) {
      toast.error('Error guardando imágenes: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function agregarHeroImage() {
    setHeroImages(prev => [...prev, ''])
    setHeroChanged(true)
  }

  function updateHeroImage(idx, val) {
    setHeroImages(prev => prev.map((img, i) => i === idx ? val : img))
    setHeroChanged(true)
  }

  function removeHeroImage(idx) {
    setHeroImages(prev => prev.filter((_, i) => i !== idx))
    setHeroChanged(true)
  }

  async function guardarFechaFundacion() {
    try {
      setLoading(true)
      await api.put('/admin/branding/fecha-fundacion', { fecha: fechaFundacion })
      toast.success('Fecha de fundación guardada')
      setFechaChanged(false)
    } catch (error) {
      toast.error('Error guardando fecha: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function restaurarColores() {
    setColores(defaultColors)
    setChanged(true)
    toast.success('Colores restaurados a por defecto')
  }

  if (loading && Object.keys(colores).length === 0) {
    return (
      <LoadingSpinner />
    )
  }

  const colorGroups = {
    'Primarios': ['primario', 'primarioOscuro', 'primarioClaro'],
    'Secundarios': ['secundario', 'secundarioOscuro', 'secundarioClaro'],
    'Estados': ['exito', 'advertencia', 'error', 'info'],
    'Fondos y Texto': ['fondoPrincipal', 'fondoSecundario', 'textoPrincipal', 'textoSecundario'],
    'Otros': ['acento', 'borde']
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Palette className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Personalización Visual</h1>
          <p className="text-gray-600">Configura los colores y logos de tu club</p>
        </div>
      </div>

      {/* Sección Hero Carousel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Images className="w-5 h-5" /> Imágenes del Hero (Carousel)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Agregá las URLs de las imágenes que rotarán en el banner principal del sitio público. Se avanza automáticamente cada 5 segundos.
        </p>

        <div className="space-y-3 mb-4">
          {heroImages.map((url, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>
              <input
                type="url"
                value={url}
                onChange={e => updateHeroImage(idx, e.target.value)}
                placeholder="https://example.com/imagen.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              />
              {url && (
                <img src={url} alt="" className="w-12 h-8 object-cover rounded border border-gray-200 flex-shrink-0" onError={e => e.target.style.display='none'} />
              )}
              <button
                onClick={() => removeHeroImage(idx)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={agregarHeroImage}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Agregar imagen
          </button>
          <button
            onClick={guardarHeroImages}
            disabled={loading || !heroChanged}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Guardar carousel
          </button>
        </div>
      </div>

      {/* Sección Fecha de Fundación */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Fecha de Fundación
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Se usa para calcular los años de historia que se muestran en el hero del sitio público.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={fechaFundacion}
            onChange={e => { setFechaFundacion(e.target.value); setFechaChanged(true) }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm"
          />
          <button
            onClick={guardarFechaFundacion}
            disabled={loading || !fechaChanged}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Guardar
          </button>
        </div>
      </div>

      {/* Sección Logo */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" /> Logo del Club
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">URL del Logo</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => handleLogoChange(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>

          {logoUrl && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Preview:</p>
              <img src={logoUrl} alt="Logo" className="h-20" onError={() => {}} />
            </div>
          )}

          <button
            onClick={guardarLogo}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Logo
          </button>
        </div>
      </div>

      {/* Sección Favicon */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" /> Favicon
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">URL del Favicon</label>
            <input
              type="url"
              value={faviconUrl}
              onChange={(e) => handleFaviconChange(e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={guardarFavicon}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Favicon
          </button>
        </div>
      </div>

      {/* Sección Colores */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Palette className="w-5 h-5" /> Paleta de Colores
          </h2>
          <button
            onClick={restaurarColores}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(colorGroups).map(([groupName, keys]) => (
            <div key={groupName} className="border-l-4 border-primary pl-4">
              <h3 className="font-semibold text-gray-700 mb-3">{groupName}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {keys.map(key => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colores[key] || defaultColors[key] || '#000000'}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                      />
                      <input
                        type="text"
                        value={colores[key] || defaultColors[key] || ''}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        placeholder="#000000"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={guardarColores}
            disabled={loading || !changed}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Colores
          </button>
          {changed && (
            <div className="text-sm text-orange-600 flex items-center gap-2">
              ⚠️ Hay cambios sin guardar
            </div>
          )}
        </div>
      </div>

      {/* Información */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Información</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Los colores se aplican automáticamente en toda la aplicación</li>
          <li>• Usa formatos de color en hexadecimal (#RRGGBB)</li>
          <li>• El logo debe ser una URL válida (HTTPS recomendado)</li>
          <li>• Los cambios se reflejan al recargar la página</li>
        </ul>
      </div>
    </div>
  )
}
