import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export default function AgregarFamiliares() {
  const { solicitudId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [solicitud, setSolicitud] = useState(null)
  const [familiares, setFamiliares] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    documento: '',
    fechaNacimiento: '',
    parentesco: '',
    actividadesSeleccionadas: []
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

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [resFamiliares] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiares`)
      ])

      if (!resFamiliares.ok) {
        throw new Error('Error al cargar los datos')
      }

      const dataFamiliares = await resFamiliares.json()
      setFamiliares(dataFamiliares.data || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar los datos')
    }
  }

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al agregar familiar')
      }

      toast.success('Familiar agregado correctamente')
      setShowForm(false)
      setFormData({
        apellidos: '',
        nombres: '',
        documento: '',
        fechaNacimiento: '',
        parentesco: '',
        actividadesSeleccionadas: []
      })
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEliminar = async (familiarId) => {
    if (!confirm('¿Estás seguro de eliminar este familiar?')) {
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/public/solicitud-socio/${solicitudId}/familiar/${familiarId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar familiar')
      }

      toast.success('Familiar eliminado')
      cargarDatos()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleFinalizar = () => {
    navigate('/')
    toast.success('Solicitud completada. Te contactaremos en las próximas 48 horas.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="/images/logo.png"
              alt="Club Sportivo Pilar"
              className="h-16 mx-auto mb-4"
            />
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ¡Solicitud Enviada!
            </h1>
            <p className="text-gray-600">
              Solicitud #{solicitudId}
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">¿Querés agregar familiares?</h3>
            <p className="text-blue-800">
              Podés agregar a tu cónyuge e hijos/as a esta solicitud. Todos serán dados de alta como un grupo familiar.
            </p>
          </div>

          {/* Lista de Familiares */}
          {familiares.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Familiares agregados ({familiares.length})
              </h3>
              <div className="space-y-3">
                {familiares.map((familiar) => (
                  <div key={familiar.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {familiar.apellidos} {familiar.nombres}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">DNI:</span> {familiar.documento}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Parentesco:</span> {familiar.parentesco === 'CONYUGE' ? 'Cónyuge' : 'Hijo/a'}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Edad:</span> {calcularEdad(familiar.fechaNacimiento)} años
                      </div>
                      {familiar.actividadesSeleccionadas && familiar.actividadesSeleccionadas.length > 0 && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Actividades:</span>{' '}
                          {familiar.actividadesSeleccionadas.join(', ')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleEliminar(familiar.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          {!showForm && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={() => setShowForm(true)}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Agregar Familiar
              </button>
              <button
                onClick={handleFinalizar}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                {familiares.length > 0 ? 'Finalizar y Enviar' : 'Continuar sin Familiares'}
              </button>
            </div>
          )}

          {/* Formulario de Agregar Familiar */}
          {showForm && (
            <form onSubmit={handleSubmit} className="border-t pt-6 space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Agregar Familiar</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellidos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="apellidos"
                    value={formData.apellidos}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombres <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombres"
                    value={formData.nombres}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="documento"
                    value={formData.documento}
                    onChange={handleChange}
                    required
                    minLength="7"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="fechaNacimiento"
                    value={formData.fechaNacimiento}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  {formData.fechaNacimiento && (
                    <p className="text-sm text-gray-500 mt-1">
                      Edad: {calcularEdad(formData.fechaNacimiento)} años
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parentesco <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="parentesco"
                    value={formData.parentesco}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="CONYUGE">Cónyuge</option>
                    <option value="HIJO">Hijo/a</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actividades <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {actividades.map(act => (
                      <label key={act} className="flex items-center p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.actividadesSeleccionadas.includes(act)}
                          onChange={() => handleActividadChange(act)}
                          className="mr-2"
                        />
                        <span className="text-sm">{act}</span>
                      </label>
                    ))}
                  </div>
                  {formData.actividadesSeleccionadas.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">Debes seleccionar al menos una actividad</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-6 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || formData.actividadesSeleccionadas.length === 0}
                  className="flex-1 bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Agregando...' : 'Agregar Familiar'}
                </button>
              </div>
            </form>
          )}

          {/* Info Final */}
          {!showForm && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="mb-2">
                <strong>Importante:</strong> Una vez que finalices, tu solicitud será revisada por nuestro equipo.
              </p>
              <p>
                Te enviaremos un correo electrónico en las próximas 48 horas con la respuesta y, si es aprobada,
                incluirá un link para pagar la primera cuota.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
