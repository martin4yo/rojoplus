import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function TenantForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const logoInputRef = useRef()
  const heroInputRef = useRef()
  const [form, setForm] = useState({
    nombre: '',
    subdomain: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigoPostal: '',
    descripcion: '',
    slogan: '',
    plan: 'TRIAL',
    maxSocios: 100,
    maxAdmins: 5,
    timezone: 'America/Argentina/Buenos_Aires',
    moneda: 'ARS'
  })

  useEffect(() => {
    if (id) {
      cargarTenant()
    }
  }, [id])

  async function cargarTenant() {
    try {
      const data = await api.getFull(`/super-admin/tenants/${id}`)
      setForm(data)
    } catch (error) {
      toast.error('Error cargando tenant: ' + error.message)
      navigate('/admin/tenants')
    } finally {
      setLoading(false)
    }
  }

  async function guardar() {
    try {
      setSaving(true)

      // Validaciones básicas
      if (!form.nombre.trim()) {
        toast.error('El nombre es requerido')
        return
      }
      if (!form.subdomain.trim()) {
        toast.error('El subdomain es requerido')
        return
      }
      if (!/^[a-z0-9-]+$/.test(form.subdomain)) {
        toast.error('El subdomain solo puede contener letras minúsculas, números y guiones')
        return
      }

      const data = id
        ? await api.put(`/super-admin/tenants/${id}`, form)
        : await api.post('/super-admin/tenants', form)

      toast.success(id ? 'Tenant actualizado' : 'Tenant creado')
      navigate('/admin/tenants')
    } catch (error) {
      toast.error('Error guardando tenant: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function subirHero(file) {
    if (!id) { toast.error('Guardá el tenant primero'); return }
    try {
      setUploadingHero(true)
      const formData = new FormData()
      formData.append('hero', file)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/super-admin/tenants/${id}/hero`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(prev => ({ ...prev, heroImageUrl: data.heroImageUrl }))
      toast.success('Imagen de fondo actualizada')
    } catch (error) {
      toast.error('Error subiendo imagen: ' + error.message)
    } finally {
      setUploadingHero(false)
    }
  }

  async function subirLogo(file) {
    if (!id) {
      toast.error('Guardá el tenant primero para poder subir el logo')
      return
    }
    try {
      setUploadingLogo(true)
      const formData = new FormData()
      formData.append('logo', file)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/super-admin/tenants/${id}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(prev => ({ ...prev, logoUrl: data.logoUrl }))
      toast.success('Logo actualizado')
    } catch (error) {
      toast.error('Error subiendo logo: ' + error.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/tenants')}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold">{id ? 'Editar Tenant' : 'Crear Nuevo Tenant'}</h1>
          <p className="text-gray-600">{id ? 'Modifica los datos del club' : 'Registra un nuevo club en el sistema'}</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Datos básicos */}
        <div>
          <h2 className="text-xl font-bold mb-4">Información Básica</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre del Club</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Ej: Sportivo Pilar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subdomain</label>
              <input
                type="text"
                value={form.subdomain}
                onChange={(e) => setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                disabled={!!id}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                placeholder="ej: sportivo-pilar"
              />
              <p className="text-xs text-gray-500 mt-1">URL: {form.subdomain}.clubix.com</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dominio personalizado <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={form.dominioCustom || ''}
                onChange={(e) => setForm({ ...form, dominioCustom: e.target.value.toLowerCase().trim() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="ej: sportivopilar.com.ar"
              />
              <p className="text-xs text-gray-500 mt-1">El club podrá ingresar usando su propio dominio</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="contacto@club.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <input
                type="tel"
                value={form.telefono || ''}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Slogan</label>
              <input
                type="text"
                value={form.slogan || ''}
                onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Ej: Tu club, tu comunidad"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <textarea
                value={form.descripcion || ''}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="Descripción del club..."
              />
            </div>
          </div>
        </div>

        {/* Logo */}
        {id && (
          <div>
            <h2 className="text-xl font-bold mb-4">Logo</h2>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-2">Sin logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && subirLogo(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current.click()}
                  disabled={uploadingLogo}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                </button>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logoUrl: null }))}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Quitar logo
                  </button>
                )}
                <p className="text-xs text-gray-500">PNG, JPG o SVG. Máx 2MB.</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Imagen de fondo (Hero)</label>
              <div className="flex items-center gap-6">
                <div className="w-40 h-24 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                  {form.heroImageUrl ? (
                    <img src={form.heroImageUrl} alt="Hero" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400 text-center px-2">Sin imagen</span>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && subirHero(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => heroInputRef.current.click()}
                    disabled={uploadingHero}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingHero ? 'Subiendo...' : 'Subir imagen'}
                  </button>
                  {form.heroImageUrl && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, heroImageUrl: null }))}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Quitar imagen
                    </button>
                  )}
                  <p className="text-xs text-gray-500">JPG, PNG. Máx 5MB.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ubicación */}
        <div>
          <h2 className="text-xl font-bold mb-4">Ubicación</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <input
                type="text"
                value={form.direccion || ''}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ciudad</label>
              <input
                type="text"
                value={form.ciudad || ''}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Provincia</label>
              <input
                type="text"
                value={form.provincia || ''}
                onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Código Postal</label>
              <input
                type="text"
                value={form.codigoPostal || ''}
                onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Contacto y Redes */}
        <div>
          <h2 className="text-xl font-bold mb-4">Contacto y Redes</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Horarios de atención</label>
              <textarea
                value={form.horarios || ''}
                onChange={(e) => setForm({ ...form, horarios: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder={"Lunes a Viernes: 9 a 20hs\nSábados: 9 a 13hs"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Facebook (URL)</label>
              <input
                type="url"
                value={form.redesSociales?.facebook || ''}
                onChange={(e) => setForm({ ...form, redesSociales: { ...form.redesSociales, facebook: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="https://facebook.com/miclub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Instagram (URL)</label>
              <input
                type="url"
                value={form.redesSociales?.instagram || ''}
                onChange={(e) => setForm({ ...form, redesSociales: { ...form.redesSociales, instagram: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="https://instagram.com/miclub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">WhatsApp (número con código de país)</label>
              <input
                type="text"
                value={form.redesSociales?.whatsapp || ''}
                onChange={(e) => setForm({ ...form, redesSociales: { ...form.redesSociales, whatsapp: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                placeholder="5491112345678"
              />
            </div>
          </div>
        </div>

        {/* Plan y Límites */}
        <div>
          <h2 className="text-xl font-bold mb-4">Plan y Límites</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="TRIAL">Trial</option>
                <option value="BASIC">Basic</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Máx Socios</label>
              <input
                type="number"
                value={form.maxSocios || 0}
                onChange={(e) => setForm({ ...form, maxSocios: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Máx Admins</label>
              <input
                type="number"
                value={form.maxAdmins || 0}
                onChange={(e) => setForm({ ...form, maxAdmins: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Configuración */}
        <div>
          <h2 className="text-xl font-bold mb-4">Configuración</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
                <option value="America/Argentina/Cordoba">Córdoba</option>
                <option value="America/Argentina/Mendoza">Mendoza</option>
                <option value="America/Argentina/La_Rioja">La Rioja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Moneda</label>
              <select
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="ARS">ARS (Peso Argentino)</option>
                <option value="USD">USD (Dólar)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2 justify-end pt-6 border-t">
          <button
            onClick={() => navigate('/admin/tenants')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
