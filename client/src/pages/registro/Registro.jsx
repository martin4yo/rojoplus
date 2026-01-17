import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function Registro() {
  const navigate = useNavigate()
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await api.post('/comercios/registro', {
        ...form,
        rubroId: parseInt(form.rubroId),
      })
      navigate('/registro/exito')
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud')
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

          <Button type="submit" className="w-full mt-6" loading={loading}>
            ENVIAR SOLICITUD
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Tu solicitud será revisada por el club.
            <br />
            Te enviaremos un email cuando sea aprobada.
          </p>
        </form>
      </main>
    </div>
  )
}
