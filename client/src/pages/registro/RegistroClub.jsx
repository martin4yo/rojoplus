import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, MapPin, ChevronLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

const PROVINCIAS = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'CABA',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
  'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
  'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
  'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
]

export default function RegistroClub() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1, 2, 3
  const [loading, setLoading] = useState(false)
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
    razonSocial: '',
    cuit: '',
    adminNombre: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: ''
  })

  function validarStep(stepNum) {
    if (stepNum === 1) {
      if (!form.nombre.trim()) {
        toast.error('El nombre del club es requerido')
        return false
      }
      if (!form.subdomain.trim()) {
        toast.error('El subdomain es requerido')
        return false
      }
      if (!/^[a-z0-9-]+$/.test(form.subdomain)) {
        toast.error('El subdomain solo puede contener letras minúsculas, números y guiones')
        return false
      }
      if (!form.email.trim() || !form.email.includes('@')) {
        toast.error('Email válido requerido')
        return false
      }
      return true
    }

    if (stepNum === 2) {
      if (!form.direccion.trim()) {
        toast.error('La dirección es requerida')
        return false
      }
      if (!form.ciudad.trim()) {
        toast.error('La ciudad es requerida')
        return false
      }
      if (!form.provincia.trim()) {
        toast.error('La provincia es requerida')
        return false
      }
      return true
    }

    if (stepNum === 3) {
      if (!form.adminNombre.trim()) {
        toast.error('Nombre del administrador requerido')
        return false
      }
      if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) {
        toast.error('Email válido del administrador requerido')
        return false
      }
      if (!form.adminPassword || form.adminPassword.length < 6) {
        toast.error('La contraseña debe tener al menos 6 caracteres')
        return false
      }
      if (form.adminPassword !== form.adminPasswordConfirm) {
        toast.error('Las contraseñas no coinciden')
        return false
      }
      return true
    }

    return true
  }

  async function handleSubmit() {
    try {
      setLoading(true)

      const payload = {
        nombre: form.nombre,
        subdomain: form.subdomain,
        email: form.email,
        telefono: form.telefono,
        direccion: form.direccion,
        ciudad: form.ciudad,
        provincia: form.provincia,
        codigoPostal: form.codigoPostal,
        descripcion: form.descripcion,
        slogan: form.slogan,
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        adminData: {
          nombre: form.adminNombre,
          email: form.adminEmail,
          password: form.adminPassword,
          nombreUsuario: form.adminEmail.split('@')[0]
        }
      }

      const response = await api.post('/super-admin/tenants/register', payload)

      toast.success('Registro enviado. Pendiente de aprobación.')
      setStep(4) // Confirmation
    } catch (error) {
      toast.error('Error en el registro: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-6">
            <h1 className="text-3xl font-bold">Registro de Club</h1>
            <p className="text-primary-light mt-2">Únete a la plataforma Clubix</p>
          </div>

          {/* Progress */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold
                    ${s <= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {s < step ? <Check className="w-6 h-6" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-primary' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-6">
            {/* Step 1: Información básica */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Información del Club</h2>

                <div>
                  <label className="block text-sm font-medium mb-2">Nombre del Club *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Sportivo Pilar"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subdomain *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.subdomain}
                      onChange={(e) => setForm({
                        ...form,
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      placeholder="tu-club"
                    />
                    <span className="text-gray-600">.clubix.com</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Solo letras minúsculas, números y guiones</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email del Club *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descripción</label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Cuéntanos sobre tu club..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Slogan</label>
                  <input
                    type="text"
                    value={form.slogan}
                    onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Tu club, tu comunidad"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Ubicación */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Ubicación del Club</h2>

                <div>
                  <label className="block text-sm font-medium mb-2">Dirección *</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Ciudad *</label>
                    <input
                      type="text"
                      value={form.ciudad}
                      onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Provincia *</label>
                    <select
                      value={form.provincia}
                      onChange={(e) => setForm({ ...form, provincia: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Seleccionar...</option>
                      {PROVINCIAS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Código Postal</label>
                  <input
                    type="text"
                    value={form.codigoPostal}
                    onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold mb-3">Datos Fiscales (opcional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={form.razonSocial}
                      onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                      placeholder="Razón Social"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={form.cuit}
                      onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                      placeholder="CUIT"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Admin */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Administrador Principal</h2>

                <div>
                  <label className="block text-sm font-medium mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={form.adminNombre}
                    onChange={(e) => setForm({ ...form, adminNombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Contraseña *</label>
                  <input
                    type="password"
                    value={form.adminPassword}
                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirmar Contraseña *</label>
                  <input
                    type="password"
                    value={form.adminPasswordConfirm}
                    onChange={(e) => setForm({ ...form, adminPasswordConfirm: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Confirmación */}
            {step === 4 && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">¡Registro Completado!</h2>
                <p className="text-gray-600">
                  Tu solicitud de registro ha sido enviada. Un administrador la revisará en breve.
                </p>
                <p className="text-sm text-gray-500">
                  Recibirás un email de confirmación en <strong>{form.email}</strong>
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark mt-6"
                >
                  Volver al inicio
                </button>
              </div>
            )}
          </div>

          {/* Buttons */}
          {step < 4 && (
            <div className="border-t px-6 py-4 flex gap-4">
              <button
                onClick={() => step > 1 && setStep(step - 1)}
                disabled={step === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 inline mr-2" />
                Anterior
              </button>
              <div className="flex-1" />
              {step < 3 ? (
                <button
                  onClick={() => validarStep(step) && setStep(step + 1)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400"
                >
                  {loading ? 'Registrando...' : 'Registrar Club'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white mt-6 text-sm">
          ¿Ya tienes una cuenta? <a href="/admin/login" className="underline font-bold">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}
