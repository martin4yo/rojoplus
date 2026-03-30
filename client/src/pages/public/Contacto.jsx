import { useState } from 'react'
import { MapPin, Phone, Mail, Clock, Send, Instagram, Facebook, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import BannerPublicitario from '../../components/public/BannerPublicitario'
import api from '../../services/api'
import { useTenant } from '../../contexts/TenantContext'

export default function Contacto() {
  const { tenant } = useTenant()
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    asunto: '',
    mensaje: '',
  })
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.nombre || !formData.email || !formData.mensaje) {
      toast.error('Por favor completa los campos obligatorios')
      return
    }

    if (formData.mensaje.length < 10) {
      toast.error('El mensaje debe tener al menos 10 caracteres')
      return
    }

    setEnviando(true)

    try {
      await api.post('/public/contacto', formData)
      toast.success('Mensaje enviado correctamente. Te responderemos pronto.')
      setFormData({ nombre: '', email: '', telefono: '', asunto: '', mensaje: '' })
    } catch (error) {
      toast.error(error.message || 'Error al enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-gray-300">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-primary-dark py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Contacto
          </h1>
          <p className="text-base text-primary-100 max-w-2xl mx-auto">
            Estamos para ayudarte. Escribinos y te responderemos a la brevedad.
          </p>
        </div>
      </section>

      {/* Contenido principal */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Info de contacto */}
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Información de Contacto
              </h2>

              {/* Dirección */}
              {(tenant?.direccion || tenant?.ciudad) && (
                <div className="bg-gray-200 rounded-xl p-5 flex gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Dirección</h3>
                    {tenant.direccion && <p className="text-gray-600">{tenant.direccion}</p>}
                    {tenant.ciudad && (
                      <p className="text-gray-500 text-sm">
                        {[tenant.ciudad, tenant.provincia].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Teléfono */}
              {tenant?.telefono && (
                <div className="bg-gray-200 rounded-xl p-5 flex gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Teléfono</h3>
                    <a href={`tel:${tenant.telefono.replace(/\D/g, '')}`} className="text-primary hover:underline">
                      {tenant.telefono}
                    </a>
                  </div>
                </div>
              )}

              {/* Email */}
              {tenant?.email && (
                <div className="bg-gray-200 rounded-xl p-5 flex gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Email</h3>
                    <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                      {tenant.email}
                    </a>
                  </div>
                </div>
              )}

              {/* Horarios */}
              {tenant?.horarios && (
                <div className="bg-gray-200 rounded-xl p-5 flex gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Horarios</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-line">{tenant.horarios}</p>
                  </div>
                </div>
              )}

              {/* Redes Sociales */}
              {tenant?.redesSociales && Object.values(tenant.redesSociales).some(Boolean) && (
                <div className="pt-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Seguinos</h3>
                  <div className="flex gap-3">
                    {tenant.redesSociales.instagram && (
                      <a
                        href={tenant.redesSociales.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                      >
                        <Instagram className="w-6 h-6" />
                      </a>
                    )}
                    {tenant.redesSociales.facebook && (
                      <a
                        href={tenant.redesSociales.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                      >
                        <Facebook className="w-6 h-6" />
                      </a>
                    )}
                    {tenant.redesSociales.whatsapp && (
                      <a
                        href={`https://wa.me/${tenant.redesSociales.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                      >
                        <MessageCircle className="w-6 h-6" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Formulario */}
            <div className="lg:col-span-2">
              <div className="bg-gray-200 rounded-2xl p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Envianos un mensaje
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                        placeholder="Tu nombre"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                        placeholder="Tu teléfono (opcional)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Asunto
                      </label>
                      <select
                        value={formData.asunto}
                        onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="inscripcion">Inscripción de socio</option>
                        <option value="actividades">Consulta sobre actividades</option>
                        <option value="eventos">Alquiler de instalaciones</option>
                        <option value="sugerencia">Sugerencia</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje *
                    </label>
                    <textarea
                      value={formData.mensaje}
                      onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white resize-none"
                      placeholder="¿En qué podemos ayudarte?"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full md:w-auto px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {enviando ? (
                      'Enviando...'
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Enviar Mensaje
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner publicitario */}
      <BannerPublicitario tipo="FOOTER" ubicacion="CONTACTO" />

      {/* Mapa — se muestra si el tenant tiene dirección configurada */}
      {tenant?.direccion && (
        <section className="pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              ¿Cómo llegar?
            </h2>
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent([tenant.direccion, tenant.ciudad, tenant.provincia].filter(Boolean).join(', '))}&output=embed`}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Ubicación de ${tenant.nombre}`}
                className="w-full"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
