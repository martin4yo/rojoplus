import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Tag, Activity, Dumbbell, UserCheck, Wallet, Mail, AlertTriangle, Settings, Table2, Calendar, Percent, Save, Shield, User, BookOpen, Briefcase } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'

export default function TablasAuxiliares() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [tiposSocio, setTiposSocio] = useState([])
  const [categoriasSocio, setCategoriasSocio] = useState([])
  const [estadosSocio, setEstadosSocio] = useState([])
  const [actividades, setActividades] = useState([])
  const [entrenadores, setEntrenadores] = useState([])
  const [cargosPersonal, setCargosPersonal] = useState([])
  const [conceptosTesoreria, setConceptosTesoreria] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])

  // Modo Demo
  const [modoDemo, setModoDemo] = useState({ activo: false, email: '' })
  const [guardandoDemo, setGuardandoDemo] = useState(false)

  // Configuración de cuotas
  const [diaVencimiento, setDiaVencimiento] = useState('10')
  const [venceMismomes, setVenceMismoMes] = useState(false)
  const [guardandoVencimiento, setGuardandoVencimiento] = useState(false)

  // Configuración de recargos
  const [recargo, setRecargo] = useState({ tipo: 'FIJO', porcentaje: '10', cadaDias: '15', topeMaximo: '' })
  const [guardandoRecargo, setGuardandoRecargo] = useState(false)

  useEffect(() => {
    cargarDatos()
    cargarModoDemo()
    cargarConfiguracion()
    cargarRecargo()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [tipos, categorias, estados, acts, entrens, cargos, conceptos, cuentas, usrs, rols] = await Promise.all([
        api.get('/admin/tipos-socio'),
        api.get('/admin/categorias-socio'),
        api.get('/admin/estados-socio'),
        api.get('/admin/actividades'),
        api.get('/admin/entrenadores'),
        api.getFull('/admin/cargos-personal').catch(() => ({ data: [] })),
        api.get('/admin/conceptos-tesoreria'),
        api.getFull('/admin/cuentas-contables?flat=true').catch(() => ({ data: [] })),
        api.get('/admin/usuarios').catch(() => ({ data: [] })),
        api.get('/admin/roles').catch(() => ({ data: [] })),
      ])
      setTiposSocio(tipos || [])
      setCategoriasSocio(categorias || [])
      setEstadosSocio(estados || [])
      setActividades(acts || [])
      setEntrenadores(entrens || [])
      setCargosPersonal(cargos?.data || [])
      setConceptosTesoreria(conceptos || [])
      setCuentasContables(cuentas?.data || [])
      setUsuarios(usrs?.data || usrs || [])
      setRoles(rols?.data || rols || [])
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  async function cargarModoDemo() {
    try {
      const data = await api.get('/admin/sistema/modo-demo')
      setModoDemo(data || { activo: false, email: '' })
    } catch (err) {
      console.error('Error cargando modo demo:', err)
    }
  }

  async function cargarConfiguracion() {
    try {
      const [configDia, configMes] = await Promise.all([
        api.get('/admin/sistema/configuracion/CUOTA_DIA_VENCIMIENTO'),
        api.get('/admin/sistema/configuracion/CUOTA_VENCE_MISMO_MES'),
      ])
      setDiaVencimiento(configDia?.valor || '10')
      setVenceMismoMes(configMes?.valor === 'true')
    } catch (err) {
      console.error('Error cargando configuración:', err)
    }
  }

  async function guardarModoDemo() {
    setGuardandoDemo(true)
    setError(null)
    try {
      await api.put('/admin/sistema/modo-demo', modoDemo)
      setSuccess(modoDemo.activo ? 'Modo demo activado' : 'Modo demo desactivado')
    } catch (err) {
      setError('Error al guardar configuración de modo demo')
    } finally {
      setGuardandoDemo(false)
    }
  }

  function toggleModoDemo() {
    const nuevoEstado = { ...modoDemo, activo: !modoDemo.activo }
    setModoDemo(nuevoEstado)
    setTimeout(() => {
      api.put('/admin/sistema/modo-demo', nuevoEstado)
        .then(() => setSuccess(nuevoEstado.activo ? 'Modo demo activado' : 'Modo demo desactivado'))
        .catch(() => setError('Error al guardar'))
    }, 100)
  }

  async function guardarConfigVencimiento() {
    setGuardandoVencimiento(true)
    setError(null)
    try {
      await Promise.all([
        api.put('/admin/sistema/configuracion/CUOTA_DIA_VENCIMIENTO', { valor: diaVencimiento }),
        api.put('/admin/sistema/configuracion/CUOTA_VENCE_MISMO_MES', { valor: venceMismomes ? 'true' : 'false' }),
      ])
      setSuccess('Configuración de vencimiento actualizada')
    } catch (err) {
      setError('Error al guardar configuración de vencimiento')
    } finally {
      setGuardandoVencimiento(false)
    }
  }

  async function cargarRecargo() {
    try {
      const data = await api.get('/admin/configuracion-recargo')
      if (data) {
        setRecargo({
          tipo: data.tipo || 'FIJO',
          porcentaje: String(data.porcentaje || '10'),
          cadaDias: String(data.cadaDias || '15'),
          topeMaximo: data.topeMaximo ? String(data.topeMaximo) : '',
        })
      }
    } catch (err) {
      console.error('Error cargando configuración de recargo:', err)
    }
  }

  async function guardarRecargo() {
    setGuardandoRecargo(true)
    setError(null)
    try {
      await api.put('/admin/configuracion-recargo', {
        tipo: recargo.tipo,
        porcentaje: parseFloat(recargo.porcentaje),
        cadaDias: recargo.tipo === 'ACUMULATIVO' ? parseInt(recargo.cadaDias) : null,
        topeMaximo: recargo.topeMaximo ? parseFloat(recargo.topeMaximo) : null,
      })
      setSuccess('Configuración de recargos actualizada')
    } catch (err) {
      setError(err.message || 'Error al guardar configuración de recargos')
    } finally {
      setGuardandoRecargo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const tarjetasSocios = [
    { tipo: 'tipos-socio', titulo: 'Tipos de Socio', icono: Tag, items: tiposSocio, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { tipo: 'categorias-socio', titulo: 'Categorías', icono: Users, items: categoriasSocio, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { tipo: 'estados-socio', titulo: 'Estados', icono: Activity, items: estadosSocio, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
  ]

  const totalCategorias = actividades.reduce((acc, a) => acc + (a.cantidadCategorias || 0), 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
          <p className="text-gray-500 text-sm">Administra la configuración y tablas del sistema</p>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configuración General
            </div>
          </button>
          <button
            onClick={() => setActiveTab('tablas')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'tablas'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4" />
              Tablas del Sistema
            </div>
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'usuarios'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuarios y Roles
            </div>
          </button>
        </nav>
      </div>

      {/* Tab: Configuración General */}
      {activeTab === 'general' && (
        <div className="flex flex-wrap gap-6">
          {/* Configuración de Cuotas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-96 relative min-h-[280px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Vencimiento de Cuotas</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Configura cuándo vencen las cuotas generadas
                </p>

                {/* Switch: Mes de vencimiento */}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Mes de vencimiento</label>
                    <p className="text-xs text-gray-500">
                      {venceMismomes ? 'Mismo mes del periodo' : 'Mes siguiente al periodo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVenceMismoMes(!venceMismomes)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      venceMismomes ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        venceMismomes ? 'translate-x-7' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Selector: Día del mes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Día del mes
                  </label>
                  <select
                    value={diaVencimiento}
                    onChange={(e) => setDiaVencimiento(e.target.value)}
                    className="input-field w-24"
                  >
                    {[...Array(28)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>

                {/* Ejemplo dinámico */}
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Ejemplo:</span> Las cuotas de Enero vencerán el{' '}
                    <span className="font-semibold text-primary">
                      {diaVencimiento} de {venceMismomes ? 'Enero' : 'Febrero'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            <button
              onClick={guardarConfigVencimiento}
              disabled={guardandoVencimiento}
              className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
              title="Guardar"
            >
              {guardandoVencimiento ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Configuración de Recargos por Mora */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-96 relative min-h-[320px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <Percent className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Recargos por Mora</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Configura el recargo para cuotas vencidas
                </p>

                {/* Tipo de recargo */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de recargo</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tipoRecargo"
                        checked={recargo.tipo === 'FIJO'}
                        onChange={() => setRecargo({ ...recargo, tipo: 'FIJO' })}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm">Fijo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tipoRecargo"
                        checked={recargo.tipo === 'ACUMULATIVO'}
                        onChange={() => setRecargo({ ...recargo, tipo: 'ACUMULATIVO' })}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm">Acumulativo</span>
                    </label>
                  </div>
                </div>

                {/* Porcentaje */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porcentaje
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={recargo.porcentaje}
                      onChange={(e) => setRecargo({ ...recargo, porcentaje: e.target.value })}
                      className="input-field w-20"
                      min="0"
                      step="0.5"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>

                {/* Campos para tipo ACUMULATIVO */}
                {recargo.tipo === 'ACUMULATIVO' && (
                  <>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cada cuántos días
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={recargo.cadaDias}
                          onChange={(e) => setRecargo({ ...recargo, cadaDias: e.target.value })}
                          className="input-field w-20"
                          min="1"
                        />
                        <span className="text-gray-500">días</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tope máximo (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={recargo.topeMaximo}
                          onChange={(e) => setRecargo({ ...recargo, topeMaximo: e.target.value })}
                          className="input-field w-20"
                          min="0"
                          placeholder="Sin tope"
                        />
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Ejemplo dinámico */}
                <div className="mt-3 p-2 bg-gray-50 rounded-lg mb-8">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Ejemplo:</span>{' '}
                    {recargo.tipo === 'FIJO' ? (
                      <>Cuota vencida = <span className="font-semibold text-red-600">{recargo.porcentaje}%</span> de recargo</>
                    ) : (
                      <>90 días de mora = {Math.floor(90 / (parseInt(recargo.cadaDias) || 15))} × {recargo.porcentaje}% = <span className="font-semibold text-red-600">{Math.floor(90 / (parseInt(recargo.cadaDias) || 15)) * parseFloat(recargo.porcentaje || 0)}%</span> de recargo</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            <button
              onClick={guardarRecargo}
              disabled={guardandoRecargo}
              className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
              title="Guardar"
            >
              {guardandoRecargo ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Modo Demo (Email) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[500px] relative min-h-[180px]">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${modoDemo.activo ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                <Mail className={`w-6 h-6 ${modoDemo.activo ? 'text-yellow-600' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Modo Demo (Email)</h3>
                  <button
                    onClick={toggleModoDemo}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      modoDemo.activo ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        modoDemo.activo ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Redirigir todas las notificaciones a un email de prueba
                </p>

                {modoDemo.activo && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-xs text-yellow-700">Los emails se enviarán solo a la dirección de prueba</span>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email de prueba
                    </label>
                    <input
                      type="email"
                      value={modoDemo.email}
                      onChange={(e) => setModoDemo({ ...modoDemo, email: e.target.value })}
                      placeholder="test@ejemplo.com"
                      className="input-field w-full"
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            {modoDemo.activo && (
              <button
                onClick={guardarModoDemo}
                disabled={guardandoDemo}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
                title="Guardar"
              >
                {guardandoDemo ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Tablas del Sistema */}
      {activeTab === 'tablas' && (
        <>
          {/* Sección: Socios */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Socios</h2>
            <div className="flex flex-wrap gap-6">
              {tarjetasSocios.map(t => (
                <div
                  key={t.tipo}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                  onClick={() => navigate(`/admin/configuracion/${t.tipo}`)}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl ${t.bgColor}`}>
                        <t.icono className={`w-6 h-6 ${t.iconColor}`} />
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/configuracion/${t.tipo}/nuevo`) }}
                        className="flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Nuevo
                      </Button>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-base font-semibold text-gray-800">{t.titulo}</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{t.items.length}</p>
                      <p className="text-xs text-gray-500">registros</p>
                    </div>
                  </div>
                  <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                    Ver listado →
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sección: Actividades */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Actividades</h2>
            <div className="flex flex-wrap gap-6">
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/actividades')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-orange-100">
                      <Dumbbell className="w-6 h-6 text-orange-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/actividades/nueva') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Actividades</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{actividades.length}</p>
                    <p className="text-xs text-gray-500">{totalCategorias} categorías</p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>

              {/* Entrenadores */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/entrenadores')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-teal-100">
                      <UserCheck className="w-6 h-6 text-teal-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/entrenadores/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Entrenadores</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{entrenadores.length}</p>
                    <p className="text-xs text-gray-500">
                      {entrenadores.filter(e => e.activo).length} activos
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>

              {/* Cargos de Personal */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/cargos-personal')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-rose-100">
                      <Briefcase className="w-6 h-6 text-rose-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/cargos-personal/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Cargos de Personal</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{cargosPersonal.length}</p>
                    <p className="text-xs text-gray-500">
                      {cargosPersonal.filter(c => c.activo).length} activos
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Tesorería */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Tesorería</h2>
            <div className="flex flex-wrap gap-6">
              {/* Conceptos de Tesorería */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/conceptos-tesoreria')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <Wallet className="w-6 h-6 text-emerald-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/conceptos-tesoreria/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Conceptos</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{conceptosTesoreria.length}</p>
                    <p className="text-xs text-gray-500">
                      {conceptosTesoreria.filter(c => c.activo).length} activos
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>

              {/* Plan de Cuentas */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/contabilidad/plan-cuentas')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-indigo-100">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/contabilidad/plan-cuentas/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Plan de Cuentas</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{cuentasContables.length}</p>
                    <p className="text-xs text-gray-500">
                      {cuentasContables.filter(c => c.activo).length} activas
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: Usuarios y Roles */}
      {activeTab === 'usuarios' && (
        <div className="flex flex-wrap gap-6">
          {/* Usuarios */}
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
            onClick={() => navigate('/admin/configuracion/usuarios')}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-blue-100">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/usuarios/nuevo') }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800">Usuarios</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{usuarios.length}</p>
                <p className="text-xs text-gray-500">
                  {usuarios.filter(u => u.activo).length} activos
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
              Ver listado →
            </div>
          </div>

          {/* Roles */}
          <div
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
            onClick={() => navigate('/admin/configuracion/roles')}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-purple-100">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/roles/nuevo') }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800">Roles</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{roles.length}</p>
                <p className="text-xs text-gray-500">
                  {roles.filter(r => r.activo).length} activos
                </p>
              </div>
            </div>
            <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
              Ver listado →
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
