import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Building2, UserCheck, Briefcase, Upload, User } from 'lucide-react'
import { Button } from '../../../components/Button'
import CentroCostoSelector from '../../../components/CentroCostoSelector'
import ConceptosFijosEmpleado from '../../../components/ConceptosFijosEmpleado'
import EntrenadorTab from './EntrenadorTab'
import api from '../../../services/api'
import LoadingSpinner from '../../../components/LoadingSpinner'

const TIPO_CONFIG = {
  PROVEEDOR: {
    titulo: 'Proveedor',
    icon: Building2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/proveedores'
  },
  CLIENTE: {
    titulo: 'Cliente',
    icon: UserCheck,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/ingresos/clientes'
  },
  PERSONAL: {
    titulo: 'Personal',
    icon: Briefcase,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ruta: '/admin/egresos/personal'
  }
}

const CONDICIONES_IVA = [
  'RESPONSABLE INSCRIPTO',
  'MONOTRIBUTISTA',
  'EXENTO',
  'CONSUMIDOR FINAL',
  'NO RESPONSABLE'
]

export default function EntidadForm({ tipo }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const config = TIPO_CONFIG[tipo]
  const Icon = config.icon
  const isEditing = !!id
  const usarTabs = tipo === 'PERSONAL'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('datos')
  const [entidadInfo, setEntidadInfo] = useState({ esEntrenador: false, tieneEntrenador: false })

  const [form, setForm] = useState({
    codigo: '',
    razonSocial: '',
    nombreFantasia: '',
    tipoDocumento: 'CUIT',
    documento: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    condicionIva: '',
    banco: '',
    cbu: '',
    alias: '',
    // Solo para PERSONAL
    legajo: '',
    cargo: '',
    sueldoBasico: '',
    centroCostoId: null,
    foto: '',
    activo: true
  })

  useEffect(() => {
    if (isEditing) {
      cargarEntidad()
    } else {
      obtenerProximoCodigo()
    }
  }, [id, tipo])

  async function cargarEntidad() {
    setLoading(true)
    try {
      const entidad = await api.get(`/admin/entidades/${id}`)
      setForm({
        codigo: entidad.codigo || '',
        razonSocial: entidad.razonSocial || '',
        nombreFantasia: entidad.nombreFantasia || '',
        tipoDocumento: entidad.tipoDocumento || 'CUIT',
        documento: entidad.documento || '',
        email: entidad.email || '',
        telefono: entidad.telefono || '',
        direccion: entidad.direccion || '',
        ciudad: entidad.ciudad || '',
        condicionIva: entidad.condicionIva || '',
        banco: entidad.banco || '',
        cbu: entidad.cbu || '',
        alias: entidad.alias || '',
        legajo: entidad.legajo || '',
        cargo: entidad.cargo || '',
        sueldoBasico: entidad.sueldoBasico ? String(entidad.sueldoBasico) : '',
        centroCostoId: entidad.centroCostoId || null,
        foto: entidad.foto || '',
        activo: entidad.activo
      })
      setEntidadInfo({
        esEntrenador: entidad.cargoPersonal?.esEntrenador === true,
        tieneEntrenador: !!entidad.entrenador,
      })
    } catch (err) {
      setError('Error al cargar la entidad')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function obtenerProximoCodigo() {
    try {
      const data = await api.get(`/admin/proximo-numero/ENT?subtipo=${tipo}`)
      if (data?.numero) {
        setForm(prev => ({ ...prev, codigo: data.numero }))
      } else {
        console.warn('Próximo código no recibido:', data)
      }
    } catch (err) {
      console.error('Error obteniendo proximo codigo:', err)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function handleFotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setForm(prev => ({ ...prev, foto: reader.result }))
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.codigo || !form.razonSocial) {
      setError('Codigo y Razon Social son requeridos')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        tipo,
        sueldoBasico: form.sueldoBasico ? parseFloat(form.sueldoBasico) : null,
        centroCostoId: form.centroCostoId ? parseInt(form.centroCostoId) : null
      }

      if (isEditing) {
        await api.put(`/admin/entidades/${id}`, payload)
      } else {
        await api.post('/admin/entidades', payload)
      }

      navigate(config.ruta)
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(config.ruta)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditing ? `Editar ${config.titulo}` : `Nuevo ${config.titulo}`}
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Tabs (solo para PERSONAL) */}
      {usarTabs && (
        <div className="border-b border-gray-200 mb-6">
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'datos', label: 'Datos Básicos' },
              { id: 'contacto', label: 'Contacto' },
              { id: 'bancarios', label: 'Bancarios' },
              { id: 'laborales', label: 'Laborales' },
              ...(isEditing ? [{ id: 'conceptos', label: 'Conceptos Fijos' }] : []),
              ...(isEditing && (entidadInfo.esEntrenador || entidadInfo.tieneEntrenador)
                ? [{ id: 'entrenador', label: 'Entrenador' }] : []),
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos basicos */}
        {(!usarTabs || tab === 'datos') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Basicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo *
              </label>
              <input
                type="text"
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                className="input-field w-full"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razon Social *
              </label>
              <input
                type="text"
                name="razonSocial"
                value={form.razonSocial}
                onChange={handleChange}
                className="input-field w-full"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Fantasia
              </label>
              <input
                type="text"
                name="nombreFantasia"
                value={form.nombreFantasia}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo Documento
              </label>
              <select
                name="tipoDocumento"
                value={form.tipoDocumento}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="CUIT">CUIT</option>
                <option value="CUIL">CUIL</option>
                <option value="DNI">DNI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero de Documento
              </label>
              <input
                type="text"
                name="documento"
                value={form.documento}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condicion IVA
              </label>
              <select
                name="condicionIva"
                value={form.condicionIva}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="">Seleccionar...</option>
                {CONDICIONES_IVA.map(cond => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Contacto */}
        {(!usarTabs || tab === 'contacto') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Contacto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono
              </label>
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                name="ciudad"
                value={form.ciudad}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direccion
              </label>
              <input
                type="text"
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>
        )}

        {/* Datos bancarios */}
        {(!usarTabs || tab === 'bancarios') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Bancarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banco
              </label>
              <input
                type="text"
                name="banco"
                value={form.banco}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CBU
              </label>
              <input
                type="text"
                name="cbu"
                value={form.cbu}
                onChange={handleChange}
                className="input-field w-full"
                maxLength={22}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alias
              </label>
              <input
                type="text"
                name="alias"
                value={form.alias}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>
        )}

        {/* Datos de personal (solo para tipo PERSONAL) */}
        {tipo === 'PERSONAL' && (!usarTabs || tab === 'laborales') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos Laborales</h2>

            {/* Foto */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border border-gray-200 flex-shrink-0">
                {form.foto ? (
                  <img src={form.foto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">
                  <Upload className="w-4 h-4" />
                  {form.foto ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                </label>
                {form.foto && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, foto: '' }))}
                    className="ml-2 text-sm text-red-500 hover:text-red-700"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Legajo
                </label>
                <input
                  type="text"
                  name="legajo"
                  value={form.legajo}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  name="cargo"
                  value={form.cargo}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sueldo Basico
                </label>
                <input
                  type="number"
                  name="sueldoBasico"
                  value={form.sueldoBasico}
                  onChange={handleChange}
                  className="input-field w-full"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Costo
                </label>
                <CentroCostoSelector
                  value={form.centroCostoId}
                  onChange={(id) => setForm(prev => ({ ...prev, centroCostoId: id }))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se usa para imputar la provisión de sueldo al centro de costo correspondiente.
                </p>
              </div>
              {isEditing && (
                <div className="md:col-span-3 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="activo"
                      checked={form.activo}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-gray-700">Empleado activo</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Estado (solo si NO usa tabs — para CLIENTE/PROVEEDOR) */}
        {!usarTabs && isEditing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="activo"
                checked={form.activo}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-gray-700">Activo</span>
            </label>
          </div>
        )}

        {/* Conceptos fijos del empleado (tab dedicado en PERSONAL) */}
        {tipo === 'PERSONAL' && isEditing && tab === 'conceptos' && (
          <ConceptosFijosEmpleado entidadId={parseInt(id)} sueldoBasico={form.sueldoBasico} />
        )}

        {/* Tab Entrenador (solo cuando el cargo es de entrenador o ya tiene perfil) */}
        {tipo === 'PERSONAL' && isEditing && tab === 'entrenador' && (
          <EntrenadorTab entidadId={parseInt(id)} />
        )}

        {/* Botones (ocultos en tabs que guardan solos) */}
        {(!usarTabs || (tab !== 'conceptos' && tab !== 'entrenador')) && (
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(config.ruta)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              {isEditing ? 'Guardar Cambios' : 'Crear ' + config.titulo}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
