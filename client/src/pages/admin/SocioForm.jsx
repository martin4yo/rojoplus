import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, User, Phone, MapPin, Heart, CreditCard, AlertCircle, Users, X, ListPlus, Wallet, Receipt, Smartphone
} from 'lucide-react'
import SaldoFavorTab from './socio/SaldoFavorTab'
import DispositivosTab from './socio/DispositivosTab'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { Modal } from '../../components/Modal'
import { useConfirm } from '../../hooks/useConfirm'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const PROVINCIAS_AR = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

function calcularEsMenor(fecha) {
  if (!fecha) return false
  const hoy = new Date()
  const nac = new Date(fecha)
  const edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  return edad < 18 || (edad === 18 && m < 0) || (edad === 18 && m === 0 && hoy.getDate() < nac.getDate())
}

export default function SocioForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('personal')
  const [fieldErrors, setFieldErrors] = useState({})

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

  // Cuota social individual
  const hoyCuota = new Date()
  const [cuotaSocialModal, setCuotaSocialModal] = useState({
    open: false,
    anio: hoyCuota.getFullYear(),
    mes: hoyCuota.getMonth() + 1,
    preview: null,
    loadingPreview: false,
    generando: false,
  })

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
    estadoSocioId: '',
    categoriaSocioId: '',
    tipoSocioRelId: '',
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
    } else {
      api.get('/admin/socios/proximo-numero')
        .then(data => setForm(f => ({ ...f, nroSocio: data.proximo })))
        .catch(() => {})
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
      const fechaNac = socio.fechaNacimiento ? socio.fechaNacimiento.split('T')[0] : ''
      setForm({
        ...sanitizado,
        fechaNacimiento: fechaNac,
        fechaAlta: socio.fechaAlta ? socio.fechaAlta.split('T')[0] : '',
        aptaFisicaVence: socio.aptaFisicaVence ? socio.aptaFisicaVence.split('T')[0] : '',
        responsableId: socio.responsableId || '',
        cobradorId: socio.cobradorId || '',
        estadoSocioId: socio.estadoSocioId ? String(socio.estadoSocioId) : '',
        categoriaSocioId: socio.categoriaSocioId ? String(socio.categoriaSocioId) : '',
        tipoSocioRelId: socio.tipoSocioRelId ? String(socio.tipoSocioRelId) : '',
        esMenor: calcularEsMenor(fechaNac),
      })

      // Si la relación apunta a un registro inactivo, agregarlo al dropdown para poder mostrarlo
      if (socio.estadoSocioRel) {
        setEstadosSocio(prev => prev.find(x => x.id === socio.estadoSocioRel.id) ? prev : [...prev, socio.estadoSocioRel])
      }
      if (socio.categoriaSocioRel) {
        setCategoriasSocio(prev => prev.find(x => x.id === socio.categoriaSocioRel.id) ? prev : [...prev, socio.categoriaSocioRel])
      }
      if (socio.tipoSocioRel) {
        setTiposSocio(prev => prev.find(x => x.id === socio.tipoSocioRel.id) ? prev : [...prev, socio.tipoSocioRel])
      }
    } catch (err) {
      setError('Error al cargar el socio')
    } finally {
      setLoading(false)
    }
  }

  // Campos que se guardan siempre en mayúsculas
  const CAMPOS_MAYUSCULA = ['apellido', 'nombre', 'apellidoNombre']

  function handleChange(e) {
    const { name, type, checked } = e.target
    let { value } = e.target
    if (type !== 'checkbox' && CAMPOS_MAYUSCULA.includes(name)) {
      value = (value || '').toUpperCase()
    }
    // Limpiar error del campo al editarlo
    if (fieldErrors[name]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n })
    }
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
        if (fieldErrors.apellidoNombre) {
          setFieldErrors(prev => { const n = { ...prev }; delete n.apellidoNombre; return n })
        }
      }
      // Auto-calcular esMenor
      if (name === 'fechaNacimiento') {
        newForm.esMenor = calcularEsMenor(value)
      }
      return newForm
    })
  }

  const REQUIRED_FIELDS = [
    // Personal
    { field: 'estadoSocioId', tab: 'personal', label: 'Estado' },
    { field: 'categoriaSocioId', tab: 'personal', label: 'Categoría' },
    { field: 'tipoSocioRelId', tab: 'personal', label: 'Tipo de Socio' },
    { field: 'apellido', tab: 'personal', label: 'Apellido' },
    { field: 'nombre', tab: 'personal', label: 'Nombre' },
    { field: 'documento', tab: 'personal', label: 'Documento' },
    { field: 'fechaNacimiento', tab: 'personal', label: 'Fecha Nac.' },
    { field: 'sexo', tab: 'personal', label: 'Sexo' },
    { field: 'estadoCivil', tab: 'personal', label: 'Estado Civil' },
    // Contacto
    { field: 'celular', tab: 'contacto', label: 'Celular' },
    { field: 'email', tab: 'contacto', label: 'Email' },
    // Domicilio
    { field: 'calle', tab: 'domicilio', label: 'Calle' },
    { field: 'numero', tab: 'domicilio', label: 'Nro' },
    { field: 'codigoPostal', tab: 'domicilio', label: 'C.P.' },
    { field: 'ciudad', tab: 'domicilio', label: 'Ciudad' },
    { field: 'provincia', tab: 'domicilio', label: 'Provincia' },
  ]

  function validarFormulario() {
    const errors = {}
    for (const { field, label } of REQUIRED_FIELDS) {
      if (!form[field] || String(form[field]).trim() === '') {
        errors[field] = `${label} es requerido`
      }
    }
    // Contacto de emergencia obligatorio si es menor
    if (calcularEsMenor(form.fechaNacimiento)) {
      const c1 = form.emergenciaNombre1?.trim() && form.emergenciaTel1?.trim()
      const c2 = form.emergenciaNombre2?.trim() && form.emergenciaTel2?.trim()
      if (!c1 && !c2) {
        errors.emergencia = 'Al menos 1 contacto de emergencia es requerido para menores de edad'
      }
    }
    return errors
  }

  function erroresPorTab(tabId) {
    let count = REQUIRED_FIELDS.filter(
      ({ field, tab }) => tab === tabId && fieldErrors[field]
    ).length
    if (tabId === 'contacto' && fieldErrors.emergencia) count++
    return count
  }

  function inputClass(field) {
    return `input-field w-full${fieldErrors[field] ? ' border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const errors = validarFormulario()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      // Ir al primer tab con error
      const primerCampoConError = REQUIRED_FIELDS.find(({ field }) => errors[field])
      if (primerCampoConError) setActiveTab(primerCampoConError.tab)
      return
    }
    setFieldErrors({})

    setSaving(true)
    try {
      if (isEditing) {
        await api.put(`/admin/socios/${id}`, { ...form, esMenor: calcularEsMenor(form.fechaNacimiento) })
        toast.success('Cambios guardados correctamente')
      } else {
        const resultado = await api.post('/admin/socios', { ...form, esMenor: calcularEsMenor(form.fechaNacimiento) })
        toast.success(`Socio #${resultado?.nroSocio || form.nroSocio} creado correctamente`)
        navigate('/admin/inscripciones', {
          state: {
            nuevoSocio: {
              id: resultado.id,
              nroSocio: resultado.nroSocio,
              apellidoNombre: resultado.apellidoNombre,
              documento: resultado.documento,
            }
          }
        })
        return
      }
      navigate('/admin/socios')
    } catch (err) {
      setError(err.message || 'Error al guardar')
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

  // === Cuota Social Individual ===
  const estadoSeleccionado = estadosSocio.find(e => String(e.id) === String(form.estadoSocioId))
  const puedeGenerarCuotaSocial = isEditing && estadoSeleccionado?.permiteIngresoMolinete === true

  function abrirCuotaSocialModal() {
    const ahora = new Date()
    setCuotaSocialModal({
      open: true,
      anio: ahora.getFullYear(),
      mes: ahora.getMonth() + 1,
      preview: null,
      loadingPreview: false,
      generando: false,
    })
  }

  async function cargarPreviewCuotaSocial(anio, mes) {
    setCuotaSocialModal(prev => ({ ...prev, loadingPreview: true, preview: null }))
    try {
      const data = await api.get(`/admin/cuotas/preview-cuota-social/${id}?anio=${anio}&mes=${mes}`)
      setCuotaSocialModal(prev => ({ ...prev, preview: data, loadingPreview: false }))
    } catch (err) {
      toast.error(err.message || 'Error al obtener preview')
      setCuotaSocialModal(prev => ({ ...prev, loadingPreview: false }))
    }
  }

  async function generarCuotaSocial() {
    const { anio, mes, preview } = cuotaSocialModal
    if (!preview || !preview.puedeGenerar || preview.yaExiste) return
    setCuotaSocialModal(prev => ({ ...prev, generando: true }))
    try {
      await api.post(`/admin/cuotas/generar-cuota-social/${id}`, { anio, mes })
      toast.success(`Cuota social generada para ${String(mes).padStart(2, '0')}/${anio}`)
      setCuotaSocialModal(prev => ({ ...prev, open: false, generando: false }))
    } catch (err) {
      toast.error(err.message || 'Error al generar la cuota social')
      setCuotaSocialModal(prev => ({ ...prev, generando: false }))
      // Refrescar preview por si ahora ya existe
      cargarPreviewCuotaSocial(anio, mes)
    }
  }

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'contacto', label: 'Contacto', icon: Phone },
    { id: 'domicilio', label: 'Domicilio', icon: MapPin },
    { id: 'medico', label: 'Medico', icon: Heart },
    { id: 'debito', label: 'Debito', icon: CreditCard },
    ...(isEditing ? [{ id: 'familia', label: 'Familia', icon: Users }] : []),
    ...(isEditing ? [{ id: 'saldo', label: 'Saldo a favor', icon: Wallet }] : []),
    ...(isEditing ? [{ id: 'dispositivos', label: 'Dispositivos', icon: Smartphone }] : []),
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
        {isEditing && socioData && (
          <div className="ml-auto flex gap-2">
            {puedeGenerarCuotaSocial && (
              <Button
                type="button"
                variant="secondary"
                onClick={abrirCuotaSocialModal}
              >
                <Receipt className="w-4 h-4 mr-2" />
                Generar Cuota Social
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/inscripciones', {
                state: {
                  nuevoSocio: {
                    id: socioData.id,
                    nroSocio: socioData.nroSocio,
                    apellidoNombre: socioData.apellidoNombre,
                    documento: socioData.documento,
                  }
                }
              })}
            >
              <ListPlus className="w-4 h-4 mr-2" />
              Inscribir en actividad
            </Button>
          </div>
        )}
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const errCount = erroresPorTab(tab.id)
              return (
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
                  {errCount > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {errCount}
                    </span>
                  )}
                </button>
              )
            })}
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
                    Nro. Socio
                    {!isEditing && <span className="ml-1 text-xs text-gray-400 font-normal">(auto)</span>}
                  </label>
                  <input
                    type="text"
                    name="nroSocio"
                    value={form.nroSocio}
                    readOnly
                    className="input-field w-full bg-gray-50 text-gray-600 cursor-default"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.estadoSocioId ? 'text-red-600' : 'text-gray-700'}`}>Estado <span className="text-red-500">*</span></label>
                  <select name="estadoSocioId" value={form.estadoSocioId} onChange={handleChange} className={inputClass('estadoSocioId')}>
                    <option value="">Seleccionar</option>
                    {estadosSocio.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}{e.activo === false ? ' (inactivo)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.categoriaSocioId ? 'text-red-600' : 'text-gray-700'}`}>Categoría <span className="text-red-500">*</span></label>
                  <select name="categoriaSocioId" value={form.categoriaSocioId} onChange={handleChange} className={inputClass('categoriaSocioId')}>
                    <option value="">Seleccionar</option>
                    {categoriasSocio.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}{c.activo === false ? ' (inactivo)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.tipoSocioRelId ? 'text-red-600' : 'text-gray-700'}`}>Tipo de Socio <span className="text-red-500">*</span></label>
                  <select name="tipoSocioRelId" value={form.tipoSocioRelId} onChange={handleChange} className={inputClass('tipoSocioRelId')}>
                    <option value="">Seleccionar</option>
                    {tiposSocio.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}{t.activo === false ? ' (inactivo)' : ''}</option>
                    ))}
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.apellido ? 'text-red-600' : 'text-gray-700'}`}>Apellido <span className="text-red-500">*</span></label>
                  <input type="text" name="apellido" value={form.apellido} onChange={handleChange} className={inputClass('apellido')} />
                  {fieldErrors.apellido && <p className="mt-1 text-xs text-red-600">{fieldErrors.apellido}</p>}
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.nombre ? 'text-red-600' : 'text-gray-700'}`}>Nombre <span className="text-red-500">*</span></label>
                  <input type="text" name="nombre" value={form.nombre} onChange={handleChange} className={inputClass('nombre')} />
                  {fieldErrors.nombre && <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p>}
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.apellidoNombre ? 'text-red-600' : 'text-gray-700'}`}>
                    Apellido y Nombre (completo) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="apellidoNombre"
                    value={form.apellidoNombre}
                    onChange={handleChange}
                    className={inputClass('apellidoNombre')}
                  />
                  {fieldErrors.apellidoNombre && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.apellidoNombre}</p>
                  )}
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.documento ? 'text-red-600' : 'text-gray-700'}`}>Documento <span className="text-red-500">*</span></label>
                  <input type="text" name="documento" value={form.documento} onChange={handleChange} className={inputClass('documento')} />
                  {fieldErrors.documento && <p className="mt-1 text-xs text-red-600">{fieldErrors.documento}</p>}
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.fechaNacimiento ? 'text-red-600' : 'text-gray-700'}`}>Fecha Nac. <span className="text-red-500">*</span></label>
                  <input type="date" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} className={inputClass('fechaNacimiento')} />
                  {fieldErrors.fechaNacimiento && <p className="mt-1 text-xs text-red-600">{fieldErrors.fechaNacimiento}</p>}
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.sexo ? 'text-red-600' : 'text-gray-700'}`}>Sexo <span className="text-red-500">*</span></label>
                  <select name="sexo" value={form.sexo} onChange={handleChange} className={inputClass('sexo')}>
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.estadoCivil ? 'text-red-600' : 'text-gray-700'}`}>Estado Civil <span className="text-red-500">*</span></label>
                  <select name="estadoCivil" value={form.estadoCivil} onChange={handleChange} className={inputClass('estadoCivil')}>
                    <option value="">Seleccionar</option>
                    <option value="SOLTERO">Soltero/a</option>
                    <option value="CASADO">Casado/a</option>
                    <option value="DIVORCIADO">Divorciado/a</option>
                    <option value="VIUDO">Viudo/a</option>
                    <option value="UNION_CONVIVENCIAL">Unión conv.</option>
                  </select>
                </div>
              </div>

              {calcularEsMenor(form.fechaNacimiento) && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="font-medium text-amber-800 text-sm">Menor de edad (calculado por fecha de nacimiento)</p>
                </div>
              )}

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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.celular ? 'text-red-600' : 'text-gray-700'}`}>Celular <span className="text-red-500">*</span></label>
                  <input type="tel" name="celular" value={form.celular} onChange={handleChange} className={inputClass('celular')} />
                  {fieldErrors.celular && <p className="mt-1 text-xs text-red-600">{fieldErrors.celular}</p>}
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.email ? 'text-red-600' : 'text-gray-700'}`}>Email <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass('email')} />
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
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

              <h3 className={`font-medium flex items-center gap-2 ${fieldErrors.emergencia ? 'text-red-600' : 'text-gray-800'}`}>
                <AlertCircle className="w-4 h-4 text-red-500" />
                Contactos de Emergencia
                {calcularEsMenor(form.fechaNacimiento) && <span className="text-xs font-normal text-red-600">(obligatorio para menores)</span>}
              </h3>
              {fieldErrors.emergencia && (
                <p className="text-sm text-red-600">{fieldErrors.emergencia}</p>
              )}

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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.calle ? 'text-red-600' : 'text-gray-700'}`}>Calle <span className="text-red-500">*</span></label>
                  <input type="text" name="calle" value={form.calle} onChange={handleChange} className={inputClass('calle')} />
                  {fieldErrors.calle && <p className="mt-1 text-xs text-red-600">{fieldErrors.calle}</p>}
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.numero ? 'text-red-600' : 'text-gray-700'}`}>Nro <span className="text-red-500">*</span></label>
                  <input type="text" name="numero" value={form.numero} onChange={handleChange} className={inputClass('numero')} />
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
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.codigoPostal ? 'text-red-600' : 'text-gray-700'}`}>C.P. <span className="text-red-500">*</span></label>
                  <input type="text" name="codigoPostal" value={form.codigoPostal} onChange={handleChange} className={inputClass('codigoPostal')} />
                </div>
              </div>

              {/* Ciudad, Provincia */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-3">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.ciudad ? 'text-red-600' : 'text-gray-700'}`}>Ciudad <span className="text-red-500">*</span></label>
                  <input type="text" name="ciudad" value={form.ciudad} onChange={handleChange} className={inputClass('ciudad')} />
                  {fieldErrors.ciudad && <p className="mt-1 text-xs text-red-600">{fieldErrors.ciudad}</p>}
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className={`block text-sm font-medium mb-1 ${fieldErrors.provincia ? 'text-red-600' : 'text-gray-700'}`}>Provincia <span className="text-red-500">*</span></label>
                  <select name="provincia" value={form.provincia} onChange={handleChange} className={inputClass('provincia')}>
                    <option value="">Seleccionar...</option>
                    {PROVINCIAS_AR.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
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

          {activeTab === 'saldo' && isEditing && socioData && (
            <SaldoFavorTab socioId={socioData.id} socioNombre={socioData.apellidoNombre} />
          )}

          {activeTab === 'dispositivos' && isEditing && socioData && (
            <DispositivosTab socioId={socioData.id} />
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
      {/* Modal Generar Cuota Social */}
      <Modal
        isOpen={cuotaSocialModal.open}
        onClose={() => setCuotaSocialModal(prev => ({ ...prev, open: false }))}
        title="Generar Cuota Social"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Seleccione el período para el cual desea generar la cuota social del socio
            <span className="font-medium text-gray-800"> {socioData?.apellidoNombre}</span>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
              <select
                value={cuotaSocialModal.mes}
                onChange={(e) => setCuotaSocialModal(prev => ({ ...prev, mes: parseInt(e.target.value), preview: null }))}
                className="input-field w-full"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={cuotaSocialModal.anio}
                onChange={(e) => setCuotaSocialModal(prev => ({ ...prev, anio: parseInt(e.target.value) || prev.anio, preview: null }))}
                className="input-field w-full"
                min={2000}
                max={2100}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => cargarPreviewCuotaSocial(cuotaSocialModal.anio, cuotaSocialModal.mes)}
            loading={cuotaSocialModal.loadingPreview}
            className="w-full"
          >
            Calcular importe
          </Button>

          {cuotaSocialModal.preview && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              {cuotaSocialModal.preview.yaExiste ? (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">
                    La cuota social ya esta generada para {String(cuotaSocialModal.mes).padStart(2, '0')}/{cuotaSocialModal.anio}.
                  </p>
                </div>
              ) : !cuotaSocialModal.preview.puedeGenerar ? (
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{cuotaSocialModal.preview.motivo}</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Importe base:</span>
                    <span className="font-medium text-gray-800">
                      $ {Number(cuotaSocialModal.preview.montoBase).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {Number(cuotaSocialModal.preview.montoBonificacion) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Bonificación ({Number(cuotaSocialModal.preview.descuentoPct)}%):
                      </span>
                      <span className="font-medium text-green-700">
                        - $ {Number(cuotaSocialModal.preview.montoBonificacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base border-t pt-2">
                    <span className="font-semibold text-gray-800">Total:</span>
                    <span className="font-bold text-primary">
                      $ {Number(cuotaSocialModal.preview.montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-600">Vencimiento:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(cuotaSocialModal.preview.fechaVencimiento).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCuotaSocialModal(prev => ({ ...prev, open: false }))}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={generarCuotaSocial}
              loading={cuotaSocialModal.generando}
              disabled={
                !cuotaSocialModal.preview ||
                !cuotaSocialModal.preview.puedeGenerar ||
                cuotaSocialModal.preview.yaExiste ||
                cuotaSocialModal.generando
              }
            >
              Generar Cuota
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog />
    </div>
  )
}
