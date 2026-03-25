import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TenantLogo from '../../components/TenantLogo'

export default function InscripcionSocio() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    documento: '',
    fechaNacimiento: '',
    direccionCalle: '',
    direccionNumero: '',
    localidad: '',
    telefono: '',
    email: '',
    actividadesSeleccionadas: [], // Cambiado a array para múltiples actividades
    tieneEnfermedades: 'No',
    detalleEnfermedades: '',
    tutorApellidos: '',
    tutorNombres: '',
    tutorDocumento: '',
    tutorTelefono: ''
  })

  const actividades = [
    'Basquet',
    'Futbol 11',
    'Futsal',
    'Gimnasio',
    'Kickboxing',
    'Liga Argentina de Baby Futbol',
    'Natación',
    'Socio sin actividad',
    'Taekwondo',
    'Voley'
  ]

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

  const esMenor = calcularEdad(formData.fechaNacimiento) < 18

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleActividadChange = (actividad) => {
    setFormData(prev => {
      const actividades = prev.actividadesSeleccionadas
      const index = actividades.indexOf(actividad)

      if (index > -1) {
        // Si ya está seleccionada, la removemos
        return {
          ...prev,
          actividadesSeleccionadas: actividades.filter(a => a !== actividad)
        }
      } else {
        // Si no está seleccionada, la agregamos
        return {
          ...prev,
          actividadesSeleccionadas: [...actividades, actividad]
        }
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validaciones básicas
    if (esMenor && (!formData.tutorApellidos || !formData.tutorNombres || !formData.tutorDocumento || !formData.tutorTelefono)) {
      setError('Los menores de 18 años deben completar los datos del tutor')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al enviar la solicitud')
      }

      // Redirigir a la página de agregar familiares
      navigate(`/inscripcion-socio/${data.solicitud.id}/familiares`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-300 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Botón volver */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al sitio web
        </Link>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <TenantLogo className="h-12 w-auto mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              ¡Bienvenido a la gran familia de Sportivo!
            </h1>
            <p className="text-gray-600">
              Completa el siguiente formulario para solicitar tu alta como socio
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-primary-50 border-l-4 border-primary p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-primary-dark">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos Personales */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Datos Personales</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellidos <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="apellidos"
                    value={formData.apellidos}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombres <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombres"
                    value={formData.nombres}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="documento"
                    value={formData.documento}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento <span className="text-primary">*</span>
                  </label>
                  <input
                    type="date"
                    name="fechaNacimiento"
                    value={formData.fechaNacimiento}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {formData.fechaNacimiento && (
                    <p className="text-sm text-gray-500 mt-1">
                      Edad: {calcularEdad(formData.fechaNacimiento)} años
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono <span className="text-primary">*</span>
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Domicilio */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Domicilio</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calle <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="direccionCalle"
                    value={formData.direccionCalle}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="direccionNumero"
                    value={formData.direccionNumero}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Localidad <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    name="localidad"
                    value={formData.localidad}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Actividades */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Actividades</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Seleccioná las actividades en las que querés inscribirte
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actividades.map(actividad => (
                    <label key={actividad} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.actividadesSeleccionadas.includes(actividad)}
                        onChange={() => handleActividadChange(actividad)}
                        className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">{actividad}</span>
                    </label>
                  ))}
                </div>
                {formData.actividadesSeleccionadas.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    {formData.actividadesSeleccionadas.length} actividad(es) seleccionada(s)
                  </p>
                )}
              </div>
            </div>

            {/* Salud */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Información de Salud</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Tenés enfermedades que debamos conocer? <span className="text-primary">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tieneEnfermedades"
                        value="Si"
                        checked={formData.tieneEnfermedades === 'Si'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      Sí
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="tieneEnfermedades"
                        value="No"
                        checked={formData.tieneEnfermedades === 'No'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>

                {formData.tieneEnfermedades === 'Si' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Detalle de enfermedades
                    </label>
                    <textarea
                      name="detalleEnfermedades"
                      value={formData.detalleEnfermedades}
                      onChange={handleChange}
                      rows="4"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Por favor, describe las condiciones médicas que debamos conocer..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tutor (si es menor) */}
            {esMenor && (
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Datos del Padre/Madre/Tutor</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Como sos menor de 18 años, necesitamos los datos de tu padre, madre o tutor legal.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos del Tutor <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      name="tutorApellidos"
                      value={formData.tutorApellidos}
                      onChange={handleChange}
                      required={esMenor}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombres del Tutor <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      name="tutorNombres"
                      value={formData.tutorNombres}
                      onChange={handleChange}
                      required={esMenor}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Documento del Tutor <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      name="tutorDocumento"
                      value={formData.tutorDocumento}
                      onChange={handleChange}
                      required={esMenor}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono del Tutor <span className="text-primary">*</span>
                    </label>
                    <input
                      type="tel"
                      name="tutorTelefono"
                      value={formData.tutorTelefono}
                      onChange={handleChange}
                      required={esMenor}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
              <p className="text-sm text-gray-500 text-center mt-4">
                Al enviar esta solicitud, aceptás cumplir con los estatutos y reglamentos del club.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
