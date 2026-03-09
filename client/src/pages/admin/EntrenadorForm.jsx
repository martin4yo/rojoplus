import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X, Dumbbell, Building2, CreditCard, ChevronDown, ChevronUp, User } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import StatusBadge from '../../components/StatusBadge'
import ImageUpload from '../../components/ImageUpload'
import { formatCurrency, formatDateForInput } from '../../utils/formatters'
import { useApiData } from '../../hooks/useApiData'
import api from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'

export default function EntrenadorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(isEditing)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Datos del entrenador
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    telefono: '',
    email: '',
    especialidad: '',
    observaciones: '',
    activo: true,
    // Datos de Personal (Entidad)
    legajo: '',
    cargoPersonalId: '',
    fechaIngreso: '',
    sueldoBasico: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigoPostal: '',
    banco: '',
    cbu: '',
    alias: '',
    // Datos de Staff Público
    mostrarEnWeb: false,
    fotoStaff: '',
    biografiaStaff: '',
    emailPublico: '',
    telefonoPublico: '',
    ordenStaff: 0,
  })

  // Cargar actividades y cargos con useApiData
  const { data: actividades = [] } = useApiData('/admin/actividades', {
    params: { activo: true },
    initialData: []
  })

  const { data: cargosPersonal = [] } = useApiData('/admin/cargos-personal', {
    params: { activo: true },
    initialData: [],
    transform: (response) => response?.data || []
  })

  // Control para mostrar/ocultar secciones
  const [mostrarDatosPersonal, setMostrarDatosPersonal] = useState(false)
  const [mostrarDatosBancarios, setMostrarDatosBancarios] = useState(false)
  const [mostrarDatosStaff, setMostrarDatosStaff] = useState(false)

  // Upload foto
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Categorías asignadas
  const [categoriasAsignadas, setCategoriasAsignadas] = useState([])

  // Para agregar categoría
  const [actividadSeleccionada, setActividadSeleccionada] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState('ENTRENADOR')
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)

  useEffect(() => {
    if (isEditing) {
      cargarEntrenador()
    }
  }, [id])

  async function cargarEntrenador() {
    setLoadingData(true)
    try {
      const data = await api.get(`/admin/entrenadores/${id}`)
      const entidad = data.entidad || {}
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        documento: data.documento || '',
        telefono: data.telefono || '',
        email: data.email || '',
        especialidad: data.especialidad || '',
        observaciones: data.observaciones || '',
        activo: data.activo,
        // Datos de Personal (desde Entidad)
        legajo: entidad.legajo || '',
        cargoPersonalId: entidad.cargoPersonalId || '',
        fechaIngreso: formatDateForInput(entidad.fechaIngreso),
        sueldoBasico: entidad.sueldoBasico || '',
        direccion: entidad.direccion || '',
        ciudad: entidad.ciudad || '',
        provincia: entidad.provincia || '',
        codigoPostal: entidad.codigoPostal || '',
        banco: entidad.banco || '',
        cbu: entidad.cbu || '',
        alias: entidad.alias || '',
        // Datos de Staff Público
        mostrarEnWeb: data.mostrarEnWeb || false,
        fotoStaff: data.fotoStaff || '',
        biografiaStaff: data.biografiaStaff || '',
        emailPublico: data.emailPublico || '',
        telefonoPublico: data.telefonoPublico || '',
        ordenStaff: data.ordenStaff || 0,
      })
      setCategoriasAsignadas(data.categorias?.filter(c => c.activo) || [])
      // Expandir secciones si tienen datos
      if (entidad.sueldoBasico || entidad.legajo) setMostrarDatosPersonal(true)
      if (entidad.banco || entidad.cbu) setMostrarDatosBancarios(true)
      if (data.mostrarEnWeb || data.fotoStaff || data.biografiaStaff) setMostrarDatosStaff(true)
    } catch (err) {
      setError('Error al cargar entrenador')
    } finally {
      setLoadingData(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (isEditing) {
        await api.put(`/admin/entrenadores/${id}`, form)
        setSuccess('Entrenador actualizado correctamente')
      } else {
        const data = await api.post('/admin/entrenadores', form)
        setSuccess('Entrenador creado correctamente')
        // Redirigir al edit para poder asignar categorías
        setTimeout(() => navigate(`/admin/entrenadores/${data.id}`), 1000)
      }
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  async function agregarCategoria() {
    if (!categoriaSeleccionada) return

    setAgregandoCategoria(true)
    try {
      const data = await api.post(`/admin/entrenadores/${id}/categorias`, {
        categoriaActividadId: parseInt(categoriaSeleccionada),
        rol: rolSeleccionado,
      })
      setCategoriasAsignadas(prev => [...prev, data])
      setCategoriaSeleccionada('')
      setActividadSeleccionada('')
      setRolSeleccionado('ENTRENADOR')
      setSuccess('Categoría asignada')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err.message || 'Error al asignar categoría')
    } finally {
      setAgregandoCategoria(false)
    }
  }

  async function quitarCategoria(categoriaId) {
    const confirmed = await confirm('Quitar categoría', '¿Quitar esta categoría del entrenador?')
    if (!confirmed) return

    try {
      await api.delete(`/admin/entrenadores/${id}/categorias/${categoriaId}`)
      setCategoriasAsignadas(prev => prev.filter(c => c.categoriaActividad.id !== categoriaId))
      setSuccess('Categoría desasignada')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError('Error al quitar categoría')
    }
  }

  async function handleUploadWithFile(file) {
    if (!file || !isEditing) return

    setUploadingFoto(true)
    const formData = new FormData()
    formData.append('foto', file)

    try {
      const response = await fetch('/api/admin/entrenadores/upload-foto', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setForm(prev => ({ ...prev, fotoStaff: result.data.preview }))
        setSuccess('Foto subida correctamente')
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError(result.message || 'Error al subir foto')
      }
    } catch (err) {
      setError('Error al subir foto')
    } finally {
      setUploadingFoto(false)
    }
  }

  // Obtener categorías de la actividad seleccionada
  const categoriasDisponibles = actividadSeleccionada
    ? actividades.find(a => a.id === parseInt(actividadSeleccionada))?.categorias?.filter(
        c => !categoriasAsignadas.some(ca => ca.categoriaActividad.id === c.id)
      ) || []
    : []

  const roles = [
    { value: 'ENTRENADOR', label: 'Entrenador' },
    { value: 'ASISTENTE', label: 'Asistente' },
    { value: 'PREPARADOR_FISICO', label: 'Preparador Fisico' },
  ]

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/entrenadores')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              {isEditing ? 'Editar Entrenador' : 'Nuevo Entrenador'}
            </h1>
            {isEditing && (
              <StatusBadge status={form.activo ? 'ACTIVO' : 'INACTIVO'} type="generic" />
            )}
          </div>
          <p className="text-gray-500 text-sm">
            {isEditing ? 'Modifica los datos y categorías del entrenador' : 'Completa los datos del nuevo entrenador'}
          </p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de datos */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Entrenador</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
                <input
                  type="text"
                  name="documento"
                  value={form.documento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="text"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                <input
                  type="text"
                  name="especialidad"
                  value={form.especialidad}
                  onChange={handleChange}
                  placeholder="Ej: Basquet, Futbol, Preparacion Fisica"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {isEditing && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={form.activo}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">Entrenador activo</span>
                  </label>
                </div>
              )}
            </div>

            {/* Seccion: Datos de Personal (colapsable) */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setMostrarDatosPersonal(!mostrarDatosPersonal)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  <span className="text-lg font-semibold text-gray-800">Datos de Personal</span>
                </div>
                {mostrarDatosPersonal ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              <p className="text-sm text-gray-500 mt-1 ml-7">Datos para liquidacion de sueldos</p>

              {mostrarDatosPersonal && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legajo</label>
                    <input
                      type="text"
                      name="legajo"
                      value={form.legajo}
                      onChange={handleChange}
                      placeholder="Ej: 001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <select
                      name="cargoPersonalId"
                      value={form.cargoPersonalId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Seleccionar cargo...</option>
                      {cargosPersonal.map(cargo => (
                        <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                    <input
                      type="date"
                      name="fechaIngreso"
                      value={form.fechaIngreso}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Basico</label>
                    <input
                      type="number"
                      name="sueldoBasico"
                      value={form.sueldoBasico}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    {form.sueldoBasico > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatCurrency(form.sueldoBasico)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                    <input
                      type="text"
                      name="direccion"
                      value={form.direccion}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      name="ciudad"
                      value={form.ciudad}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                    <input
                      type="text"
                      name="provincia"
                      value={form.provincia}
                      onChange={handleChange}
                      placeholder="Ej: Buenos Aires"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codigo Postal</label>
                    <input
                      type="text"
                      name="codigoPostal"
                      value={form.codigoPostal}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seccion: Datos Bancarios (colapsable) */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setMostrarDatosBancarios(!mostrarDatosBancarios)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                  <span className="text-lg font-semibold text-gray-800">Datos Bancarios</span>
                </div>
                {mostrarDatosBancarios ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              <p className="text-sm text-gray-500 mt-1 ml-7">Para transferencias de pago</p>

              {mostrarDatosBancarios && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                    <input
                      type="text"
                      name="banco"
                      value={form.banco}
                      onChange={handleChange}
                      placeholder="Ej: Banco Nacion"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
                    <input
                      type="text"
                      name="alias"
                      value={form.alias}
                      onChange={handleChange}
                      placeholder="Ej: nombre.apellido.mp"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">CBU</label>
                    <input
                      type="text"
                      name="cbu"
                      value={form.cbu}
                      onChange={handleChange}
                      maxLength={22}
                      placeholder="22 digitos"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seccion: Datos de Staff Público (colapsable) */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setMostrarDatosStaff(!mostrarDatosStaff)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-lg font-semibold text-gray-800">Datos de Staff Público</span>
                </div>
                {mostrarDatosStaff ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              <p className="text-sm text-gray-500 mt-1 ml-7">Información que se mostrará en la página web pública</p>

              {mostrarDatosStaff && (
                <div className="space-y-4 mt-4">
                  {/* Mostrar en web */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="mostrarEnWeb"
                        checked={form.mostrarEnWeb}
                        onChange={handleChange}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="block font-medium text-gray-900">Mostrar en la web pública</span>
                        <span className="block text-sm text-gray-600">
                          Este entrenador aparecerá en la sección de Staff de las actividades asignadas
                        </span>
                      </div>
                    </label>
                  </div>

                  {form.mostrarEnWeb && (
                    <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                      {/* Foto */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Foto del staff
                        </label>
                        {uploadingFoto && (
                          <p className="text-xs text-blue-600 mb-2">Subiendo foto...</p>
                        )}
                        <ImageUpload
                          value={form.fotoStaff}
                          onChange={(file) => handleUploadWithFile(file)}
                          maxSize={2 * 1024 * 1024}
                          accept="image/*"
                          previewSize="lg"
                          placeholder="Subir foto del staff"
                          disabled={uploadingFoto || !isEditing}
                          onError={(error) => setError(error)}
                        />
                        {!isEditing && (
                          <p className="text-xs text-gray-500 mt-2">
                            Guarda el entrenador primero para poder subir una foto
                          </p>
                        )}
                      </div>

                      {/* Biografía */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Biografía / Descripción
                        </label>
                        <textarea
                          name="biografiaStaff"
                          value={form.biografiaStaff}
                          onChange={handleChange}
                          rows={4}
                          placeholder="Descripción breve para mostrar en la web. Ej: Experiencia, logros, especialidades..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Email público */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email público
                          </label>
                          <input
                            type="email"
                            name="emailPublico"
                            value={form.emailPublico}
                            onChange={handleChange}
                            placeholder="email@ejemplo.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Visible en la web (puede ser diferente al email interno)
                          </p>
                        </div>

                        {/* Teléfono público */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Teléfono público
                          </label>
                          <input
                            type="text"
                            name="telefonoPublico"
                            value={form.telefonoPublico}
                            onChange={handleChange}
                            placeholder="+54 9 11 1234-5678"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Visible en la web (puede ser diferente al teléfono interno)
                          </p>
                        </div>
                      </div>

                      {/* Orden de visualización */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Orden de visualización
                        </label>
                        <input
                          type="number"
                          name="ordenStaff"
                          value={form.ordenStaff}
                          onChange={handleChange}
                          min="0"
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Menor número = aparece primero
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button type="submit" loading={loading} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {isEditing ? 'Guardar Cambios' : 'Crear Entrenador'}
              </Button>
            </div>
          </form>
        </div>

        {/* Panel de categorías (solo en edición) */}
        {isEditing && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Categorías Asignadas
              </h2>

              {/* Lista de categorías asignadas */}
              {categoriasAsignadas.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {categoriasAsignadas.map(cat => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {cat.categoriaActividad.actividad.nombre}
                        </p>
                        <p className="text-xs text-gray-500">
                          {cat.categoriaActividad.nombre}
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                            {cat.rol}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => quitarCategoria(cat.categoriaActividad.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">No hay categorías asignadas</p>
              )}

              {/* Agregar categoría */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar Categoría</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Actividad</label>
                    <select
                      value={actividadSeleccionada}
                      onChange={(e) => {
                        setActividadSeleccionada(e.target.value)
                        setCategoriaSeleccionada('')
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                    >
                      <option value="">Seleccionar actividad...</option>
                      {actividades.map(act => (
                        <option key={act.id} value={act.id}>{act.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {actividadSeleccionada && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                      <select
                        value={categoriaSeleccionada}
                        onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      >
                        <option value="">Seleccionar categoría...</option>
                        {categoriasDisponibles.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {categoriaSeleccionada && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rol</label>
                      <select
                        value={rolSeleccionado}
                        onChange={(e) => setRolSeleccionado(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                      >
                        {roles.map(rol => (
                          <option key={rol.value} value={rol.value}>{rol.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={agregarCategoria}
                    disabled={!categoriaSeleccionada || agregandoCategoria}
                    loading={agregandoCategoria}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ConfirmDialog */}
      <ConfirmDialog />
    </div>
  )
}
