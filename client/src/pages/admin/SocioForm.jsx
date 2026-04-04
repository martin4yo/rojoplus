import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, User, Phone, MapPin, Heart, CreditCard, AlertCircle, Users, X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { useConfirm } from '../../hooks/useConfirm'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function SocioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('personal')

  // Datos auxiliares
  const [cobradores, setCobradores] = useState([])
  const [tiposSocio, setTiposSocio] = useState([])
  const [categoriasSocio, setCategoriasSocio] = useState([])
  const [estadosSocio, setEstadosSocio] = useState([])

  // Familia
  const [socioData, setSocioData] = useState(null) // Datos completos del socio para familia
  const [busquedaMiembro, setBusquedaMiembro] = useState('')
  const [miembrosEncontrados, setMiembrosEncontrados] = useState([])
  const [buscandoMiembro, setBuscandoMiembro] = useState(false)
  const [busquedaTitular, setBusquedaTitular] = useState('')
  const [titularesEncontrados, setTitularesEncontrados] = useState([])
  const [buscandoTitular, setBuscandoTitular] = useState(false)
  const [asignandoFamilia, setAsignandoFamilia] = useState(false)
  const [parentescoModal, setParentescoModal] = useState({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
  const [parentescoSeleccionado, setParentescoSeleccionado] = useState('')
  const parentescoOptions = ['Conyuge', 'Hijo/a', 'Padre', 'Madre', 'Hermano/a', 'Otro']

  // Datos del formulario
  const [form, setForm] = useState({
    // Identificacion
    nroSocio: '',
    tipoDocumento: 'DNI',
    documento: '',
    cuil: '',
    // Personales
    apellido: '',
    nombre: '',
    apellidoNombre: '',
    fechaNacimiento: '',
    lugarNacimiento: '',
    sexo: '',
    nacionalidad: 'Argentina',
    estadoCivil: '',
    profesion: '',
    fotoUrl: '',
    // Contacto
    email: '',
    emailSecundario: '',
    telefonoFijo: '',
    celular: '',
    celularSecundario: '',
    notifEmail: false,
    notifWhatsapp: false,
    // Domicilio
    domicilio: '',
    calle: '',
    numero: '',
    piso: '',
    depto: '',
    barrio: '',
    codigoPostal: '',
    ciudad: '',
    provincia: 'Buenos Aires',
    // Club
    fechaAlta: new Date().toISOString().split('T')[0],
    estado: 'ACTIVO',
    categoria: '',
    tipoSocio: '',
    zona: '',
    libro: '',
    folio: '',
    // Menores
    esMenor: false,
    responsableId: '',
    parentescoResponsable: '',
    // Medicos
    grupoSanguineo: '',
    factorRh: '',
    obraSocial: '',
    nroObraSocial: '',
    alergias: '',
    condicionesMedicas: '',
    medicamentos: '',
    aptaFisicaVigente: false,
    aptaFisicaVence: '',
    // Emergencia
    emergenciaNombre1: '',
    emergenciaTel1: '',
    emergenciaParent1: '',
    emergenciaNombre2: '',
    emergenciaTel2: '',
    emergenciaParent2: '',
    // Cobranza
    formaPagoPref: 'MOSTRADOR',
    cobradorId: '',
    // Debito
    debitoTipo: '',
    bancoDebito: '',
    cbuDebito: '',
    aliasDebito: '',
    titularCuenta: '',
    enviaDebito: false,
    // Tarjeta
    tarjetaMarca: '',
    tarjetaNumero: '',
    tarjetaVencimiento: '',
    tarjetaCvv: '',
    // Fiscal
    condicionFiscal: '',
    // Observaciones
    observaciones: '',
    observacionesInternas: '',
  })

  useEffect(() => {
    cargarDatosAuxiliares()
    if (isEditing) {
      cargarSocio()
    }
  }, [id])

  async function cargarDatosAuxiliares() {
    // Cargar cada dato de forma independiente para que un error no afecte a los demás
    try {
      const tiposData = await api.get('/admin/tipos-socio?activo=true')
      setTiposSocio(Array.isArray(tiposData) ? tiposData : [])
    } catch (err) {
      console.error('Error cargando tipos de socio:', err)
    }

    try {
      const categoriasData = await api.get('/admin/categorias-socio?activo=true')
      setCategoriasSocio(Array.isArray(categoriasData) ? categoriasData : [])
    } catch (err) {
      console.error('Error cargando categorías de socio:', err)
    }

    try {
      const estadosData = await api.get('/admin/estados-socio?activo=true')
      setEstadosSocio(Array.isArray(estadosData) ? estadosData : [])
    } catch (err) {
      console.error('Error cargando estados de socio:', err)
    }

    try {
      const cobradoresData = await api.get('/admin/cobradores')
      setCobradores(Array.isArray(cobradoresData) ? cobradoresData : [])
    } catch (err) {
      console.error('Error cargando cobradores:', err)
    }
  }

  async function cargarSocio() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/socios/${id}`)
      const socio = data.socio

      // Guardar datos completos para la sección de familia
      setSocioData(socio)

      // Sanitizar valores null a strings vacíos para inputs
      const sanitizado = {}
      for (const key in form) {
        if (socio[key] === null || socio[key] === undefined) {
          // Mantener valores por defecto del form para nulls
          sanitizado[key] = form[key]
        } else if (typeof form[key] === 'boolean') {
          sanitizado[key] = Boolean(socio[key])
        } else {
          sanitizado[key] = socio[key]
        }
      }

      // Convertir fechas a formato de input
      setForm({
        ...sanitizado,
        fechaNacimiento: socio.fechaNacimiento ? socio.fechaNacimiento.split('T')[0] : '',
        fechaAlta: socio.fechaAlta ? socio.fechaAlta.split('T')[0] : '',
        aptaFisicaVence: socio.aptaFisicaVence ? socio.aptaFisicaVence.split('T')[0] : '',
        responsableId: socio.responsableId || '',
        cobradorId: socio.cobradorId || '',
      })
    } catch (err) {
      setError('Error al cargar el socio')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => {
      const newForm = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }
      // Auto-completar apellidoNombre
      if (name === 'apellido' || name === 'nombre') {
        const apellido = name === 'apellido' ? value : prev.apellido
        const nombre = name === 'nombre' ? value : prev.nombre
        newForm.apellidoNombre = `${apellido}, ${nombre}`.trim().replace(/^,\s*|,\s*$/g, '')
      }
      return newForm
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validaciones
    if (!form.nroSocio) {
      setError('El numero de socio es requerido')
      return
    }
    if (!form.apellidoNombre) {
      setError('El nombre es requerido')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await api.put(`/admin/socios/${id}`, form)
      } else {
        await api.post('/admin/socios', form)
      }
      navigate('/admin/socios')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // === Funciones de Familia ===
  async function buscarMiembros(query) {
    setBusquedaMiembro(query)
    if (query.length < 2) {
      setMiembrosEncontrados([])
      return
    }
    setBuscandoMiembro(true)
    try {
      const data = await api.get(`/admin/socios/miembros/buscar?q=${encodeURIComponent(query)}&titularId=${id}`)
      setMiembrosEncontrados(data)
    } catch (err) {
      console.error('Error buscando miembros:', err)
    } finally {
      setBuscandoMiembro(false)
    }
  }

  async function buscarTitulares(query) {
    setBusquedaTitular(query)
    if (query.length < 2) {
      setTitularesEncontrados([])
      return
    }
    setBuscandoTitular(true)
    try {
      const data = await api.get(`/admin/socios/titulares/buscar?q=${encodeURIComponent(query)}`)
      setTitularesEncontrados(data.filter(t => t.id !== parseInt(id)))
    } catch (err) {
      console.error('Error buscando titulares:', err)
    } finally {
      setBuscandoTitular(false)
    }
  }

  async function agregarMiembro(socioAAgregar, parentesco) {
    setAsignandoFamilia(true)
    try {
      await api.post(`/admin/socios/${id}/familia/miembro`, {
        socioId: socioAAgregar.id,
        parentesco
      })
      await cargarSocio()
      setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
      setParentescoSeleccionado('')
      setBusquedaMiembro('')
      setMiembrosEncontrados([])
    } catch (err) {
      setError(err.message || 'Error al agregar miembro')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  async function quitarMiembro(miembroId) {
    const confirmed = await confirm('Quitar miembro', '¿Quitar a este miembro de la familia?', { variant: 'danger', confirmText: 'Quitar' })
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.delete(`/admin/socios/${id}/familia/miembro/${miembroId}`)
      await cargarSocio()
      toast.success('Miembro quitado de la familia')
    } catch (err) {
      toast.error('Error al quitar miembro')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  async function asignarTitular(titular, parentesco) {
    setAsignandoFamilia(true)
    try {
      await api.put(`/admin/socios/${id}/familia`, {
        titularFamiliaId: titular.id,
        parentescoTitular: parentesco
      })
      await cargarSocio()
      setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
      setParentescoSeleccionado('')
      setBusquedaTitular('')
      setTitularesEncontrados([])
    } catch (err) {
      setError(err.message || 'Error al asignar titular')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  async function desvincularFamilia() {
    const confirmed = await confirm('Desvincular de familia', '¿Desvincular a este socio de su familia?', { variant: 'danger', confirmText: 'Desvincular' })
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.put(`/admin/socios/${id}/familia`, { titularFamiliaId: null })
      await cargarSocio()
      toast.success('Socio desvinculado de la familia')
    } catch (err) {
      toast.error('Error al desvincular')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  async function desarmarFamilia() {
    const cantidadMiembros = socioData?.miembrosFamilia?.length || 0
    const confirmed = await confirm(
      'Desarmar familia',
      `Esto desvinculara a los ${cantidadMiembros} miembro(s) y todos pasaran a ser "Socio Unico". Esta accion no se puede deshacer.`,
      { variant: 'danger', confirmText: 'Desarmar' }
    )
    if (!confirmed) return
    setAsignandoFamilia(true)
    try {
      await api.post(`/admin/socios/${id}/familia/desarmar`)
      await cargarSocio()
      toast.success('Familia desarmada correctamente')
    } catch (err) {
      toast.error('Error al desarmar familia')
    } finally {
      setAsignandoFamilia(false)
    }
  }

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'contacto', label: 'Contacto', icon: Phone },
    { id: 'domicilio', label: 'Domicilio', icon: MapPin },
    { id: 'medico', label: 'Medico', icon: Heart },
    { id: 'debito', label: 'Debito', icon: CreditCard },
    ...(isEditing ? [{ id: 'familia', label: 'Familia', icon: Users }] : []),
  ]

  if (loading) {
    return (
      <LoadingSpinner />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin/socios')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Editar Socio' : 'Nuevo Socio'}
        </h1>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Tab Personal */}
          {activeTab === 'personal' && (
            <div className="space-y-4">
              {/* Fila 1: Nro Socio, Estado, Categoria, Tipo, Fecha Alta */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nro. Socio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nroSocio"
                    value={form.nroSocio}
                    onChange={handleChange}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select name="estado" value={form.estado} onChange={handleChange} className="input-field w-full">
                    <option value="">Seleccionar</option>
                    {estadosSocio.map(e => (
                      <option key={e.id} value={e.nombre}>{e.nombre}</option>
                    ))}
                    {/* Si el valor actual no está en la lista, mostrarlo igual */}
                    {form.estado && !estadosSocio.find(e => e.nombre === form.estado) && (
                      <option value={form.estado}>{form.estado}</option>
                    )}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select name="categoria" value={form.categoria} onChange={handleChange} className="input-field w-full">
                    <option value="">Seleccionar</option>
                    {categoriasSocio.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                    {form.categoria && !categoriasSocio.find(c => c.nombre === form.categoria) && (
                      <option value={form.categoria}>{form.categoria}</option>
                    )}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Socio</label>
                  <select name="tipoSocio" value={form.tipoSocio} onChange={handleChange} className="input-field w-full">
                    <option value="">Seleccionar</option>
                    {tiposSocio.map(t => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                    {form.tipoSocio && !tiposSocio.find(t => t.nombre === form.tipoSocio) && (
                      <option value={form.tipoSocio}>{form.tipoSocio}</option>
                    )}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Alta</label>
                  <input
                    type="date"
                    name="fechaAlta"
                    value={form.fechaAlta}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <hr />

              {/* Fila 2: Apellido, Nombre, Apellido y Nombre completo */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    type="text"
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido y Nombre (completo) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="apellidoNombre"
                    value={form.apellidoNombre}
                    onChange={handleChange}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              {/* Fila 3: Tipo Doc, Documento, CUIL, Fecha Nac, Sexo */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select name="tipoDocumento" value={form.tipoDocumento} onChange={handleChange} className="input-field w-full">
                    <option value="DNI">DNI</option>
                    <option value="CI">CI</option>
                    <option value="PAS">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-8 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
                  <input
                    type="text"
                    name="documento"
                    value={form.documento}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CUIL</label>
                  <input
                    type="text"
                    name="cuil"
                    value={form.cuil}
                    onChange={handleChange}
                    className="input-field w-full"
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Nac.</label>
                  <input
                    type="date"
                    name="fechaNacimiento"
                    value={form.fechaNacimiento}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select name="sexo" value={form.sexo} onChange={handleChange} className="input-field w-full">
                    <option value="">-</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="X">X</option>
                  </select>
                </div>
                <div className="col-span-8 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidad</label>
                  <input
                    type="text"
                    name="nacionalidad"
                    value={form.nacionalidad}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                  <select name="estadoCivil" value={form.estadoCivil} onChange={handleChange} className="input-field w-full">
                    <option value="">Seleccionar</option>
                    <option value="SOLTERO">Soltero/a</option>
                    <option value="CASADO">Casado/a</option>
                    <option value="DIVORCIADO">Divorciado/a</option>
                    <option value="VIUDO">Viudo/a</option>
                    <option value="UNION_CONVIVENCIAL">Unión conv.</option>
                  </select>
                </div>
              </div>

              {/* Fila 4: Zona */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                  <input
                    type="text"
                    name="zona"
                    value={form.zona}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="esMenor"
                    checked={form.esMenor}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium text-blue-800">Es menor de edad</span>
                </label>
                {form.esMenor && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID del Responsable</label>
                      <input
                        type="number"
                        name="responsableId"
                        value={form.responsableId}
                        onChange={handleChange}
                        className="input-field w-full"
                        placeholder="ID del socio responsable"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label>
                      <select name="parentescoResponsable" value={form.parentescoResponsable} onChange={handleChange} className="input-field w-full">
                        <option value="">Seleccionar</option>
                        <option value="PADRE">Padre</option>
                        <option value="MADRE">Madre</option>
                        <option value="TUTOR">Tutor legal</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={form.observaciones}
                  onChange={handleChange}
                  rows={3}
                  className="input-field w-full"
                />
              </div>
            </div>
          )}

          {/* Tab Contacto */}
          {activeTab === 'contacto' && (
            <div className="space-y-4">
              {/* Telefonos y Emails en una fila compacta */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                  <input
                    type="tel"
                    name="celular"
                    value={form.celular}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cel. Secundario</label>
                  <input
                    type="tel"
                    name="celularSecundario"
                    value={form.celularSecundario}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tel. Fijo</label>
                  <input
                    type="tel"
                    name="telefonoFijo"
                    value={form.telefonoFijo}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Secundario</label>
                  <input
                    type="email"
                    name="emailSecundario"
                    value={form.emailSecundario}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                {/* Canales de notificación */}
                <div className="col-span-12">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Canales de notificación</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="notifEmail"
                        checked={form.notifEmail !== false}
                        onChange={e => setForm(f => ({ ...f, notifEmail: e.target.checked }))}
                        className="rounded border-gray-300 text-primary"
                      />
                      <span className="text-sm text-gray-700">Recibir notificaciones por Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="notifWhatsapp"
                        checked={form.notifWhatsapp !== false}
                        onChange={e => setForm(f => ({ ...f, notifWhatsapp: e.target.checked }))}
                        className="rounded border-gray-300 text-primary"
                      />
                      <span className="text-sm text-gray-700">Recibir notificaciones por WhatsApp</span>
                    </label>
                  </div>
                </div>
              </div>

              <hr />

              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Contactos de Emergencia
              </h3>

              {/* Emergencia 1 */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    name="emergenciaNombre1"
                    value={form.emergenciaNombre1}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    name="emergenciaTel1"
                    value={form.emergenciaTel1}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label>
                  <input
                    type="text"
                    name="emergenciaParent1"
                    value={form.emergenciaParent1}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              {/* Emergencia 2 */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (2do)</label>
                  <input
                    type="text"
                    name="emergenciaNombre2"
                    value={form.emergenciaNombre2}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    name="emergenciaTel2"
                    value={form.emergenciaTel2}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label>
                  <input
                    type="text"
                    name="emergenciaParent2"
                    value={form.emergenciaParent2}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Domicilio */}
          {activeTab === 'domicilio' && (
            <div className="space-y-4">
              {/* Calle, Numero, Piso, Depto */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
                  <input
                    type="text"
                    name="calle"
                    value={form.calle}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nro</label>
                  <input
                    type="text"
                    name="numero"
                    value={form.numero}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                  <input
                    type="text"
                    name="piso"
                    value={form.piso}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dpto</label>
                  <input
                    type="text"
                    name="depto"
                    value={form.depto}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
                  <input
                    type="text"
                    name="barrio"
                    value={form.barrio}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">C.P.</label>
                  <input
                    type="text"
                    name="codigoPostal"
                    value={form.codigoPostal}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              {/* Ciudad, Provincia */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    name="ciudad"
                    value={form.ciudad}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    name="provincia"
                    value={form.provincia}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion completa (legacy)</label>
                <input
                  type="text"
                  name="domicilio"
                  value={form.domicilio}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Solo si no se completaron los campos anteriores"
                />
              </div>
            </div>
          )}

          {/* Tab Medico */}
          {activeTab === 'medico' && (
            <div className="space-y-4">
              {/* Sangre, Obra Social, Apta Fisica */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                  <select name="grupoSanguineo" value={form.grupoSanguineo} onChange={handleChange} className="input-field w-full">
                    <option value="">-</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">RH</label>
                  <select name="factorRh" value={form.factorRh} onChange={handleChange} className="input-field w-full">
                    <option value="">-</option>
                    <option value="+">+</option>
                    <option value="-">-</option>
                  </select>
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obra Social</label>
                  <input
                    type="text"
                    name="obraSocial"
                    value={form.obraSocial}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nro. Afiliado</label>
                  <input
                    type="text"
                    name="nroObraSocial"
                    value={form.nroObraSocial}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vto. Apta Física</label>
                  <input
                    type="date"
                    name="aptaFisicaVence"
                    value={form.aptaFisicaVence}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3 flex items-end pb-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="aptaFisicaVigente"
                      checked={form.aptaFisicaVigente}
                      onChange={handleChange}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Apta física vigente</span>
                  </label>
                </div>
              </div>

              {/* Alergias y Condiciones en dos columnas */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
                  <textarea
                    name="alergias"
                    value={form.alergias}
                    onChange={handleChange}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Medicamentos, alimentos, etc."
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones Médicas</label>
                  <textarea
                    name="condicionesMedicas"
                    value={form.condicionesMedicas}
                    onChange={handleChange}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Diabetes, asma, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicamentos</label>
                  <textarea
                    name="medicamentos"
                    value={form.medicamentos}
                    onChange={handleChange}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Medicación habitual"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Debito */}
          {activeTab === 'debito' && (
            <div className="space-y-4">
              {/* Forma de pago, Cobrador, Tipo Débito, Checkbox */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma Pago</label>
                  <select name="formaPagoPref" value={form.formaPagoPref} onChange={handleChange} className="input-field w-full">
                    <option value="MOSTRADOR">Mostrador</option>
                    <option value="DEBITO">Débito auto</option>
                    <option value="COBRADOR">Cobrador</option>
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cobrador</label>
                  <select name="cobradorId" value={form.cobradorId} onChange={handleChange} className="input-field w-full">
                    <option value="">Sin cobrador</option>
                    {cobradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Débito</label>
                  <select name="debitoTipo" value={form.debitoTipo} onChange={handleChange} className="input-field w-full">
                    <option value="">-</option>
                    <option value="CBU">CBU</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3 flex items-end pb-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="enviaDebito"
                      checked={form.enviaDebito}
                      onChange={handleChange}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Enviar a débito automático</span>
                  </label>
                </div>
              </div>

              {form.debitoTipo === 'CBU' && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-800">Datos Bancarios</h4>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                      <input
                        type="text"
                        name="bancoDebito"
                        value={form.bancoDebito}
                        onChange={handleChange}
                        className="input-field w-full"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CBU</label>
                      <input
                        type="text"
                        name="cbuDebito"
                        value={form.cbuDebito}
                        onChange={handleChange}
                        className="input-field w-full font-mono"
                        maxLength={22}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
                      <input
                        type="text"
                        name="aliasDebito"
                        value={form.aliasDebito}
                        onChange={handleChange}
                        className="input-field w-full"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                      <input
                        type="text"
                        name="titularCuenta"
                        value={form.titularCuenta}
                        onChange={handleChange}
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {form.debitoTipo === 'TARJETA' && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-800">Datos de Tarjeta</h4>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                      <select name="tarjetaMarca" value={form.tarjetaMarca} onChange={handleChange} className="input-field w-full">
                        <option value="">-</option>
                        <option value="VISA">Visa</option>
                        <option value="MASTERCARD">Master</option>
                        <option value="AMEX">Amex</option>
                        <option value="CABAL">Cabal</option>
                        <option value="NARANJA">Naranja</option>
                      </select>
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                      <input
                        type="text"
                        name="tarjetaNumero"
                        value={form.tarjetaNumero}
                        onChange={handleChange}
                        className="input-field w-full font-mono"
                        maxLength={19}
                        placeholder="XXXX XXXX XXXX XXXX"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vto</label>
                      <input
                        type="text"
                        name="tarjetaVencimiento"
                        value={form.tarjetaVencimiento}
                        onChange={handleChange}
                        className="input-field w-full"
                        maxLength={5}
                        placeholder="MM/YY"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                      <input
                        type="text"
                        name="tarjetaCvv"
                        value={form.tarjetaCvv}
                        onChange={handleChange}
                        className="input-field w-full"
                        maxLength={4}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
                      <input
                        type="text"
                        name="titularCuenta"
                        value={form.titularCuenta}
                        onChange={handleChange}
                        className="input-field w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Familia (solo en edición) */}
          {activeTab === 'familia' && isEditing && socioData && (
            <div className="space-y-6">
              {/* Si es Titular de Familia - mostrar miembros */}
              {(socioData.tipoSocio?.toLowerCase().includes('titular') || socioData.miembrosFamilia?.length > 0) && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Miembros de la Familia ({socioData.miembrosFamilia?.length || 0})
                  </h3>
                  {socioData.miembrosFamilia?.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {socioData.miembrosFamilia.map(miembro => (
                        <div key={miembro.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <Link to={`/admin/socios/${miembro.id}`} className="flex-1 hover:text-primary">
                            <p className="font-medium text-gray-800">{miembro.apellidoNombre}</p>
                            <p className="text-sm text-gray-500">
                              #{miembro.nroSocio}
                              {miembro.parentescoTitular && ` • ${miembro.parentescoTitular}`}
                            </p>
                          </Link>
                          <button
                            type="button"
                            onClick={() => quitarMiembro(miembro.id)}
                            disabled={asignandoFamilia}
                            className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mb-4">No hay miembros asociados a esta familia</p>
                  )}

                  {/* Botón desarmar familia */}
                  {socioData.miembrosFamilia?.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <button
                        type="button"
                        onClick={desarmarFamilia}
                        disabled={asignandoFamilia}
                        className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                      >
                        Desarmar Familia
                      </button>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        Todos los miembros pasarán a ser "Socio Unico"
                      </p>
                    </div>
                  )}

                  {/* Buscador para agregar miembros */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Agregar miembro</h4>
                    <div className="relative">
                      <input
                        type="text"
                        value={busquedaMiembro}
                        onChange={(e) => buscarMiembros(e.target.value)}
                        placeholder="Buscar socio por nombre, DNI o nro. socio..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      {buscandoMiembro && (
                        <div className="absolute right-3 top-2">
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      )}
                    </div>
                    {miembrosEncontrados.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                        {miembrosEncontrados.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setParentescoModal({ open: true, titular: null, socioAAgregar: s, modo: 'agregar' })}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-left">
                              <p className="font-medium text-gray-800">{s.apellidoNombre}</p>
                              <p className="text-sm text-gray-500">#{s.nroSocio}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Agregar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Si es Miembro de Familia - mostrar titular */}
              {socioData.titularFamilia && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Titular de Familia
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <Link to={`/admin/socios/${socioData.titularFamilia.id}`} className="flex-1">
                      <p className="font-medium text-gray-800">{socioData.titularFamilia.apellidoNombre}</p>
                      <p className="text-sm text-gray-500">
                        #{socioData.titularFamilia.nroSocio}
                        {socioData.parentescoTitular && ` • Parentesco: ${socioData.parentescoTitular}`}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={desvincularFamilia}
                      disabled={asignandoFamilia}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                    >
                      Desvincular
                    </button>
                  </div>
                </div>
              )}

              {/* Buscar y asignar titular (si no es titular y no tiene titular) */}
              {!socioData.tipoSocio?.toLowerCase().includes('titular') && !socioData.titularFamilia && socioData.miembrosFamilia?.length === 0 && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Asignar a Familia
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      value={busquedaTitular}
                      onChange={(e) => buscarTitulares(e.target.value)}
                      placeholder="Buscar titular por nombre, DNI o nro. socio..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    {buscandoTitular && (
                      <div className="absolute right-3 top-2">
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  {titularesEncontrados.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                      {titularesEncontrados.map(titular => (
                        <button
                          key={titular.id}
                          type="button"
                          onClick={() => setParentescoModal({ open: true, titular, socioAAgregar: null, modo: 'asignar' })}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-left">
                            <p className="font-medium text-gray-800">{titular.apellidoNombre}</p>
                            <p className="text-sm text-gray-500">#{titular.nroSocio} • {titular.cantidadMiembros} miembros</p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">Seleccionar</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {busquedaTitular === '' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                      <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Este socio no pertenece a ninguna familia</p>
                      <p className="text-sm text-gray-400">Usa el buscador para asignarlo a un titular</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/socios')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isEditing ? 'Guardar Cambios' : 'Crear Socio'}
          </Button>
        </div>
      </form>

      {/* Modal Parentesco */}
      {parentescoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">Seleccionar Parentesco</span>
              <button
                type="button"
                onClick={() => {
                  setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
                  setParentescoSeleccionado('')
                }}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              {parentescoModal.modo === 'asignar' ? (
                <p className="text-sm text-gray-500 mb-3">
                  Asignando a familia de: <span className="font-medium text-gray-800">{parentescoModal.titular?.apellidoNombre}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500 mb-3">
                  Agregando a: <span className="font-medium text-gray-800">{parentescoModal.socioAAgregar?.apellidoNombre}</span>
                </p>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parentesco con el titular
              </label>
              <select
                value={parentescoSeleccionado}
                onChange={(e) => setParentescoSeleccionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Seleccionar...</option>
                {parentescoOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setParentescoModal({ open: false, titular: null, socioAAgregar: null, modo: 'asignar' })
                    setParentescoSeleccionado('')
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (parentescoModal.modo === 'asignar') {
                      asignarTitular(parentescoModal.titular, parentescoSeleccionado)
                    } else {
                      agregarMiembro(parentescoModal.socioAAgregar, parentescoSeleccionado)
                    }
                  }}
                  disabled={!parentescoSeleccionado || asignandoFamilia}
                  loading={asignandoFamilia}
                >
                  {parentescoModal.modo === 'asignar' ? 'Asignar' : 'Agregar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  )
}
