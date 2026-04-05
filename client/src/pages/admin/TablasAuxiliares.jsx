import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Tag, Activity, Dumbbell, UserCheck, Wallet, Mail, AlertTriangle, Settings, Table2, Calendar, Percent, Save, Shield, User, BookOpen, Briefcase, Building2, Store, CreditCard, ArrowRight, Calculator, Server, Eye, EyeOff, Bell, MessageCircle, Wifi, WifiOff, Smartphone, CheckCircle, XCircle, Bot, Cpu, Key } from 'lucide-react'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import api from '../../services/api'
import { tienePermiso, PERMISOS } from '../../services/permisos'
import LoadingSpinner from '../../components/LoadingSpinner'

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
  const [descuentosDisponibles, setDescuentosDisponibles] = useState([])
  const [rubros, setRubros] = useState([])
  const [cuentasContables, setCuentasContables] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [mediosPago, setMediosPago] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])

  // Modo Demo
  const [modoDemo, setModoDemo] = useState({ activo: false, email: '' })
  const [guardandoDemo, setGuardandoDemo] = useState(false)

  // Configuración de cuotas
  const [diaVencimiento, setDiaVencimiento] = useState('10')
  const [venceMismoMes, setVenceMismoMes] = useState(false)
  const [guardandoVencimiento, setGuardandoVencimiento] = useState(false)

  // Configuración de tesorería
  const [conceptoCobranzaCuotas, setConceptoCobranzaCuotas] = useState('')
  const [guardandoConceptoCobranza, setGuardandoConceptoCobranza] = useState(false)

  // Configuración de recargos
  const [recargo, setRecargo] = useState({ tipo: 'FIJO', porcentaje: '10', cadaDias: '15', topeMaximo: '' })
  const [guardandoRecargo, setGuardandoRecargo] = useState(false)

  // Configuración fiscal
  const [configFiscal, setConfigFiscal] = useState({
    cuit: '',
    condicionIva: 'INSCRIPTO',
    razonSocial: '',
    domicilioFiscal: ''
  })
  const [guardandoFiscal, setGuardandoFiscal] = useState(false)

  // Configuración SMTP
  const [configSmtp, setConfigSmtp] = useState({
    host: '',
    port: '587',
    user: '',
    pass: '',
    secure: 'false',
    from: '',
    fromName: '',
    emailContacto: '',
  })
  const [guardandoSmtp, setGuardandoSmtp] = useState(false)
  const [testeandoSmtp, setTesteandoSmtp] = useState(false)
  const [resultadoTestSmtp, setResultadoTestSmtp] = useState(null) // null | 'ok' | 'error'
  const [mostrarPassSmtp, setMostrarPassSmtp] = useState(false)

  // Configuración WhatsApp
  const [configWa, setConfigWa] = useState({
    enabled: 'false', apiUrl: '', instance: '', apiKey: '',
    delayMs: '3000', horaInicio: '8', horaFin: '21',
  })
  const [guardandoWa, setGuardandoWa] = useState(false)
  const [statusWa, setStatusWa] = useState(null)
  const [verificandoWa, setVerificandoWa] = useState(false)
  const [mostrarApiKey, setMostrarApiKey] = useState(false)
  const [resultadoWebhook, setResultadoWebhook] = useState(null) // null | 'ok' | 'error'

  // Configuración Agente IA WhatsApp
  const [configWaAgent, setConfigWaAgent] = useState({
    enabled: 'false', horarioInicio: '7', horarioFin: '23', msgFueraHorario: '', whitelist: '',
    nombre: '', promptExtra: '', prompt: '', chatEnabled: 'true',
  })
  const [guardandoWaAgent, setGuardandoWaAgent] = useState(false)

  // Eventos de notificación WhatsApp
  const [notifEventos, setNotifEventos] = useState({
    WHATSAPP_NOTIF_PAGO: 'true',
    WHATSAPP_NOTIF_VENCIMIENTO: 'true',
    WHATSAPP_NOTIF_MORA: 'true',
    WHATSAPP_NOTIF_MAGIC_LINK: 'true',
  })
  const [guardandoNotifEventos] = useState(false) // mantenido por compatibilidad

  // Feature flags del plan (activados por super-admin)
  const [planFeatures, setPlanFeatures] = useState({ whatsapp: false, waAgent: false })

  // Textos de notificaciones WhatsApp
  const [notifTextos, setNotifTextos] = useState({
    NOTIF_WA_PAGO: '',
    NOTIF_WA_VENCIMIENTO: '',
    NOTIF_WA_MORA: '',
    NOTIF_WA_PORTAL: '',
  })
  const [guardandoNotifWA, setGuardandoNotifWA] = useState(false)

  // Configuración de proveedor de IA
  const [configAI, setConfigAI] = useState({ provider: 'anthropic', tier: 'rapido', apiKey: '', modelOverride: '' })
  const [guardandoAI, setGuardandoAI] = useState(false)
  const [mostrarApiKeyAI, setMostrarApiKeyAI] = useState(false)

  // Prueba de envío WhatsApp
  const [testWa, setTestWa] = useState({ telefono: '', texto: 'Hola! Esto es un mensaje de prueba desde el panel.' })
  const [enviandoTestWa, setEnviandoTestWa] = useState(false)
  const [resultadoTestWa, setResultadoTestWa] = useState(null)

  useEffect(() => {
    cargarDatos()
    cargarModoDemo()
    cargarConfiguracion()
    cargarRecargo()
    cargarConfigFiscal()
    cargarConfigSmtp()
    cargarConfigWa()
    cargarConfigWaAgent()
    cargarConfigAI()
    cargarNotifTextos()
    cargarNotifEventos()
    cargarPlanFeatures()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [tipos, categorias, estados, acts, entrens, cargos, conceptos, descuentos, rubrosData, cuentas, usrs, rols, medios, centros] = await Promise.all([
        api.get('/admin/tipos-socio'),
        api.get('/admin/categorias-socio'),
        api.get('/admin/estados-socio'),
        api.get('/admin/actividades'),
        api.get('/admin/entrenadores'),
        api.getFull('/admin/cargos-personal').catch(() => ({ data: [] })),
        api.get('/admin/conceptos-tesoreria'),
        api.get('/admin/descuentos-disponibles').catch(() => ({ data: [] })),
        api.get('/admin/rubros').catch(() => ({ data: [] })),
        api.getFull('/admin/cuentas-contables?flat=true').catch(() => ({ data: [] })),
        api.get('/admin/usuarios').catch(() => ({ data: [] })),
        api.get('/admin/roles').catch(() => ({ data: [] })),
        api.getFull('/admin/medios-pago').catch(() => ({ data: [] })),
        api.getFull('/admin/centros-costo').catch(() => ({ data: [] })),
      ])
      setTiposSocio(tipos || [])
      setCategoriasSocio(categorias || [])
      setEstadosSocio(estados || [])
      setActividades(acts || [])
      setEntrenadores(entrens || [])
      setCargosPersonal(cargos?.data || [])
      setConceptosTesoreria(conceptos || [])
      setDescuentosDisponibles(descuentos?.data || descuentos || [])
      setRubros(rubrosData?.data || rubrosData || [])
      setCuentasContables(cuentas?.data || [])
      setUsuarios(usrs?.data || usrs || [])
      setRoles(rols?.data || rols || [])
      setMediosPago(medios?.data || medios || [])
      setCentrosCosto(centros?.data || centros || [])
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
      const [configDia, configMes, configConcepto] = await Promise.all([
        api.get('/admin/sistema/configuracion/CUOTA_DIA_VENCIMIENTO'),
        api.get('/admin/sistema/configuracion/CUOTA_VENCE_MISMO_MES'),
        api.get('/admin/sistema/configuracion/CONCEPTO_COBRANZA_CUOTAS'),
      ])
      setDiaVencimiento(configDia?.valor || '10')
      setVenceMismoMes(configMes?.valor === 'true')
      setConceptoCobranzaCuotas(configConcepto?.valor || '')
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
        api.put('/admin/sistema/configuracion/CUOTA_VENCE_MISMO_MES', { valor: venceMismoMes ? 'true' : 'false' }),
      ])
      setSuccess('Configuración de vencimiento actualizada')
    } catch (err) {
      setError('Error al guardar configuración de vencimiento')
    } finally {
      setGuardandoVencimiento(false)
    }
  }

  async function guardarConceptoCobranza() {
    setGuardandoConceptoCobranza(true)
    setError(null)
    try {
      await api.put('/admin/sistema/configuracion/CONCEPTO_COBRANZA_CUOTAS', {
        valor: conceptoCobranzaCuotas,
        tipo: 'NUMBER',
        modulo: 'TESORERIA',
        descripcion: 'ID del concepto de tesorería para cobranza de cuotas'
      })
      setSuccess('Concepto de cobranza actualizado')
    } catch (err) {
      setError('Error al guardar concepto de cobranza')
    } finally {
      setGuardandoConceptoCobranza(false)
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

  async function cargarConfigFiscal() {
    try {
      const [cuit, condicionIva, razonSocial, domicilioFiscal] = await Promise.all([
        api.get('/admin/sistema/configuracion/FISCAL_CUIT').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_CONDICION_IVA').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_RAZON_SOCIAL').catch(() => null),
        api.get('/admin/sistema/configuracion/FISCAL_DOMICILIO').catch(() => null),
      ])
      setConfigFiscal({
        cuit: cuit?.valor || '',
        condicionIva: condicionIva?.valor || 'INSCRIPTO',
        razonSocial: razonSocial?.valor || '',
        domicilioFiscal: domicilioFiscal?.valor || ''
      })
    } catch (err) {
      console.error('Error cargando configuración fiscal:', err)
    }
  }

  async function guardarConfigFiscal() {
    setGuardandoFiscal(true)
    setError(null)
    try {
      await Promise.all([
        api.put('/admin/sistema/configuracion/FISCAL_CUIT', {
          valor: configFiscal.cuit,
          tipo: 'STRING',
          modulo: 'FACTURACION',
          descripcion: 'CUIT del emisor'
        }),
        api.put('/admin/sistema/configuracion/FISCAL_CONDICION_IVA', {
          valor: configFiscal.condicionIva,
          tipo: 'STRING',
          modulo: 'FACTURACION',
          descripcion: 'Condición de IVA del emisor'
        }),
        api.put('/admin/sistema/configuracion/FISCAL_RAZON_SOCIAL', {
          valor: configFiscal.razonSocial,
          tipo: 'STRING',
          modulo: 'FACTURACION',
          descripcion: 'Razón social del emisor'
        }),
        api.put('/admin/sistema/configuracion/FISCAL_DOMICILIO', {
          valor: configFiscal.domicilioFiscal,
          tipo: 'STRING',
          modulo: 'FACTURACION',
          descripcion: 'Domicilio fiscal del emisor'
        }),
      ])
      setSuccess('Configuración fiscal actualizada')
    } catch (err) {
      setError(err.message || 'Error al guardar configuración fiscal')
    } finally {
      setGuardandoFiscal(false)
    }
  }

  async function cargarConfigSmtp() {
    try {
      const claves = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM', 'SMTP_FROM_NAME', 'EMAIL_CONTACTO']
      const results = await Promise.all(
        claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null))
      )
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setConfigSmtp({
        host: cfg.SMTP_HOST,
        port: cfg.SMTP_PORT || '587',
        user: cfg.SMTP_USER,
        pass: cfg.SMTP_PASS,
        secure: cfg.SMTP_SECURE || 'false',
        from: cfg.SMTP_FROM,
        fromName: cfg.SMTP_FROM_NAME,
        emailContacto: cfg.EMAIL_CONTACTO,
      })
    } catch (err) {
      console.error('Error cargando configuración SMTP:', err)
    }
  }

  async function testearSmtp() {
    setTesteandoSmtp(true)
    setResultadoTestSmtp(null)
    try {
      await api.post('/admin/sistema/smtp/test')
      setResultadoTestSmtp('ok')
    } catch (err) {
      setResultadoTestSmtp('error')
    } finally {
      setTesteandoSmtp(false)
    }
  }

  async function guardarConfigSmtp() {
    setGuardandoSmtp(true)
    setError(null)
    try {
      const campos = [
        { clave: 'SMTP_HOST', valor: configSmtp.host, descripcion: 'Servidor SMTP' },
        { clave: 'SMTP_PORT', valor: configSmtp.port, descripcion: 'Puerto SMTP' },
        { clave: 'SMTP_USER', valor: configSmtp.user, descripcion: 'Usuario SMTP' },
        { clave: 'SMTP_PASS', valor: configSmtp.pass, descripcion: 'Contraseña SMTP' },
        { clave: 'SMTP_SECURE', valor: configSmtp.secure, descripcion: 'Usar TLS (puerto 465)' },
        { clave: 'SMTP_FROM', valor: configSmtp.from, descripcion: 'Email remitente' },
        { clave: 'SMTP_FROM_NAME', valor: configSmtp.fromName, descripcion: 'Nombre remitente' },
        { clave: 'EMAIL_CONTACTO', valor: configSmtp.emailContacto, descripcion: 'Email de contacto' },
      ]
      await Promise.all(
        campos.map(({ clave, valor, descripcion }) =>
          api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'EMAIL', descripcion })
        )
      )
      setSuccess('Configuración de email actualizada')
    } catch (err) {
      setError(err.message || 'Error al guardar configuración de email')
    } finally {
      setGuardandoSmtp(false)
    }
  }

  async function enviarTestWa() {
    setEnviandoTestWa(true)
    setResultadoTestWa(null)
    try {
      const data = await api.postFull('/admin/whatsapp/test', { telefono: testWa.telefono, texto: testWa.texto })
      setResultadoTestWa(data.enviado ? 'ok' : 'error')
    } catch (err) {
      setResultadoTestWa('error')
    } finally {
      setEnviandoTestWa(false)
    }
  }

  async function cargarPlanFeatures() {
    try {
      const [wa, agent] = await Promise.all([
        api.get('/admin/sistema/configuracion/PLAN_FEATURE_WHATSAPP').catch(() => null),
        api.get('/admin/sistema/configuracion/PLAN_FEATURE_WA_AGENT').catch(() => null),
      ])
      setPlanFeatures({ whatsapp: wa?.valor === 'true', waAgent: agent?.valor === 'true' })
    } catch (err) { console.error('Error cargando plan features:', err) }
  }

  async function cargarConfigWa() {
    try {
      const claves = ['WHATSAPP_ENABLED', 'WHATSAPP_API_URL', 'WHATSAPP_INSTANCE', 'WHATSAPP_API_KEY', 'WHATSAPP_DELAY_MS', 'WHATSAPP_HORA_INICIO', 'WHATSAPP_HORA_FIN']
      const results = await Promise.all(claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null)))
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setConfigWa({
        enabled: cfg.WHATSAPP_ENABLED || 'false',
        apiUrl: cfg.WHATSAPP_API_URL || '',
        instance: cfg.WHATSAPP_INSTANCE || '',
        apiKey: cfg.WHATSAPP_API_KEY || '',
        delayMs: cfg.WHATSAPP_DELAY_MS || '3000',
        horaInicio: cfg.WHATSAPP_HORA_INICIO || '8',
        horaFin: cfg.WHATSAPP_HORA_FIN || '21',
      })
    } catch (err) { console.error('Error cargando config WA:', err) }
  }

  async function guardarConfigWa() {
    setGuardandoWa(true)
    setError(null)
    setResultadoWebhook(null)
    try {
      const campos = [
        { clave: 'WHATSAPP_ENABLED', valor: configWa.enabled, descripcion: 'WhatsApp habilitado' },
        { clave: 'WHATSAPP_API_URL', valor: configWa.apiUrl, descripcion: 'URL de la API de WhatsApp' },
        { clave: 'WHATSAPP_INSTANCE', valor: configWa.instance, descripcion: 'Nombre de la instancia' },
        { clave: 'WHATSAPP_API_KEY', valor: configWa.apiKey, descripcion: 'API Key de Evolution API' },
        { clave: 'WHATSAPP_DELAY_MS', valor: configWa.delayMs, descripcion: 'Delay entre mensajes (ms)' },
        { clave: 'WHATSAPP_HORA_INICIO', valor: configWa.horaInicio, descripcion: 'Hora inicio envío' },
        { clave: 'WHATSAPP_HORA_FIN', valor: configWa.horaFin, descripcion: 'Hora fin envío' },
      ]
      await Promise.all(campos.map(({ clave, valor, descripcion }) =>
        api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'WHATSAPP', descripcion })
      ))
      setSuccess('Configuración de WhatsApp actualizada')

      // Registrar webhook automáticamente si está habilitado y los campos están completos
      if (configWa.enabled === 'true' && configWa.apiUrl && configWa.instance && configWa.apiKey) {
        api.postFull('/admin/whatsapp/configurar-webhook', {})
          .then(r => setResultadoWebhook({ ok: true, url: r.webhookUrl }))
          .catch(e => setResultadoWebhook({ ok: false, error: e.message }))
      }
    } catch (err) {
      setError(err.message || 'Error al guardar configuración de WhatsApp')
    } finally { setGuardandoWa(false) }
  }

  async function verificarEstadoWa() {
    setVerificandoWa(true)
    setStatusWa(null)
    try {
      const data = await api.getFull('/admin/whatsapp/status')
      setStatusWa(data)
    } catch (err) {
      setStatusWa({ conectado: false, motivo: err.message })
    } finally { setVerificandoWa(false) }
  }

  async function cargarConfigWaAgent() {
    try {
      const claves = ['WA_AGENT_ENABLED', 'WA_AGENT_HORARIO_INICIO', 'WA_AGENT_HORARIO_FIN', 'WA_AGENT_MSG_FUERA_HORARIO', 'WA_AGENT_WHITELIST', 'WA_AGENT_NOMBRE', 'WA_AGENT_SYSTEM_PROMPT_EXTRA', 'WA_AGENT_SYSTEM_PROMPT', 'CHAT_AGENT_ENABLED']
      const results = await Promise.all(claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null)))
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setConfigWaAgent({
        enabled: cfg.WA_AGENT_ENABLED || 'false',
        horarioInicio: cfg.WA_AGENT_HORARIO_INICIO || '7',
        horarioFin: cfg.WA_AGENT_HORARIO_FIN || '23',
        msgFueraHorario: cfg.WA_AGENT_MSG_FUERA_HORARIO || '',
        whitelist: cfg.WA_AGENT_WHITELIST || '',
        nombre: cfg.WA_AGENT_NOMBRE || '',
        promptExtra: cfg.WA_AGENT_SYSTEM_PROMPT_EXTRA || '',
        prompt: cfg.WA_AGENT_SYSTEM_PROMPT || '',
        chatEnabled: cfg.CHAT_AGENT_ENABLED !== '' ? cfg.CHAT_AGENT_ENABLED : 'true',
      })
    } catch (err) { console.error('Error cargando config WA Agent:', err) }
  }

  async function guardarConfigWaAgent() {
    setGuardandoWaAgent(true)
    setError(null)
    try {
      const campos = [
        { clave: 'WA_AGENT_ENABLED', valor: configWaAgent.enabled, descripcion: 'Agente IA WhatsApp habilitado' },
        { clave: 'CHAT_AGENT_ENABLED', valor: configWaAgent.chatEnabled, descripcion: 'Asistente de chat interno habilitado' },
        { clave: 'WA_AGENT_HORARIO_INICIO', valor: configWaAgent.horarioInicio, descripcion: 'Hora inicio agente' },
        { clave: 'WA_AGENT_HORARIO_FIN', valor: configWaAgent.horarioFin, descripcion: 'Hora fin agente' },
        { clave: 'WA_AGENT_MSG_FUERA_HORARIO', valor: configWaAgent.msgFueraHorario, descripcion: 'Mensaje fuera de horario' },
        { clave: 'WA_AGENT_WHITELIST', valor: configWaAgent.whitelist, descripcion: 'Lista blanca de números (vacío = todos)' },
        { clave: 'WA_AGENT_NOMBRE', valor: configWaAgent.nombre, descripcion: 'Nombre del asistente virtual' },
        { clave: 'WA_AGENT_SYSTEM_PROMPT_EXTRA', valor: configWaAgent.promptExtra, descripcion: 'Instrucciones adicionales para el agente' },
        { clave: 'WA_AGENT_SYSTEM_PROMPT', valor: configWaAgent.prompt, descripcion: 'Prompt completo personalizado (reemplaza el base)' },
      ]
      await Promise.all(campos.map(({ clave, valor, descripcion }) =>
        api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'WHATSAPP', descripcion })
      ))
      setSuccess('Configuración del agente actualizada')
    } catch (err) {
      setError(err.message || 'Error al guardar configuración del agente')
    } finally { setGuardandoWaAgent(false) }
  }

  async function cargarNotifTextos() {
    try {
      const claves = ['NOTIF_WA_PAGO', 'NOTIF_WA_VENCIMIENTO', 'NOTIF_WA_MORA', 'NOTIF_WA_PORTAL']
      const results = await Promise.all(claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null)))
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setNotifTextos(cfg)
    } catch (err) { console.error('Error cargando textos de notificación:', err) }
  }

  async function guardarNotifWA() {
    setGuardandoNotifWA(true)
    setError(null)
    try {
      await Promise.all([
        ...Object.entries(notifEventos).map(([clave, valor]) =>
          api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'BOOLEAN', modulo: 'WHATSAPP', descripcion: `Notificación WA: ${clave}` })
        ),
        ...Object.entries(notifTextos).map(([clave, valor]) =>
          api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'WHATSAPP', descripcion: `Template WA: ${clave}` })
        ),
      ])
      setSuccess('Notificaciones de WhatsApp actualizadas')
    } catch (err) {
      setError(err.message || 'Error al guardar notificaciones')
    } finally { setGuardandoNotifWA(false) }
  }

  async function cargarConfigAI() {
    try {
      const claves = ['AI_PROVIDER', 'AI_MODEL_TIER', 'AI_API_KEY', 'AI_MODEL_OVERRIDE']
      const results = await Promise.all(claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null)))
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor || '']))
      setConfigAI({
        provider: cfg.AI_PROVIDER || 'anthropic',
        tier: cfg.AI_MODEL_TIER || 'rapido',
        apiKey: cfg.AI_API_KEY || '',
        modelOverride: cfg.AI_MODEL_OVERRIDE || '',
      })
    } catch (err) { console.error('Error cargando config IA:', err) }
  }

  async function guardarConfigAI() {
    setGuardandoAI(true)
    setError(null)
    try {
      const campos = [
        { clave: 'AI_PROVIDER', valor: configAI.provider, descripcion: 'Proveedor de IA' },
        { clave: 'AI_MODEL_TIER', valor: configAI.tier, descripcion: 'Tier de modelo IA' },
        { clave: 'AI_API_KEY', valor: configAI.apiKey, descripcion: 'API key del proveedor de IA' },
        { clave: 'AI_MODEL_OVERRIDE', valor: configAI.modelOverride, descripcion: 'Modelo exacto (override del tier)' },
      ]
      await Promise.all(campos.map(({ clave, valor, descripcion }) =>
        api.put(`/admin/sistema/configuracion/${clave}`, { valor, tipo: 'STRING', modulo: 'IA', descripcion })
      ))
      setSuccess('Configuración de IA actualizada')
    } catch (err) {
      setError(err.message || 'Error al guardar configuración de IA')
    } finally { setGuardandoAI(false) }
  }

  async function cargarNotifEventos() {
    try {
      const claves = ['WHATSAPP_NOTIF_PAGO', 'WHATSAPP_NOTIF_VENCIMIENTO', 'WHATSAPP_NOTIF_MORA', 'WHATSAPP_NOTIF_MAGIC_LINK']
      const results = await Promise.all(claves.map(c => api.get(`/admin/sistema/configuracion/${c}`).catch(() => null)))
      const cfg = Object.fromEntries(claves.map((c, i) => [c, results[i]?.valor ?? 'true']))
      setNotifEventos(cfg)
    } catch (err) { console.error('Error cargando eventos notificacion:', err) }
  }


  if (loading) {
    return (
      <LoadingSpinner />
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
          <button
            onClick={() => setActiveTab('notificaciones')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'notificaciones'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificaciones
            </div>
          </button>
          {planFeatures.waAgent && (
            <button
              onClick={() => setActiveTab('agente')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'agente'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agente IA
              </div>
            </button>
          )}
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
                      {venceMismoMes ? 'Mismo mes del periodo' : 'Mes siguiente al periodo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVenceMismoMes(!venceMismoMes)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      venceMismoMes ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        venceMismoMes ? 'translate-x-7' : ''
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
                      {diaVencimiento} de {venceMismoMes ? 'Enero' : 'Febrero'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
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
            )}
          </div>

          {/* Concepto de Cobranza de Cuotas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-96 relative min-h-[200px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Concepto de Cobranza</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Concepto de tesorería para registrar cobranzas de cuotas
                </p>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Concepto de tesorería
                  </label>
                  <select
                    value={conceptoCobranzaCuotas}
                    onChange={(e) => setConceptoCobranzaCuotas(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">Seleccionar concepto...</option>
                    {conceptosTesoreria
                      .filter(c => c.activo && c.tipo === 'INGRESO')
                      .map(concepto => (
                        <option key={concepto.id} value={concepto.id}>
                          {concepto.codigo} - {concepto.nombre}
                        </option>
                      ))
                    }
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Este concepto se usará para registrar todos los movimientos de caja por cobranza de cuotas
                  </p>
                </div>
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
              <button
                onClick={guardarConceptoCobranza}
                disabled={guardandoConceptoCobranza || !conceptoCobranzaCuotas}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
                title="Guardar"
              >
                {guardandoConceptoCobranza ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            )}
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
            {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
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
            )}
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
            {modoDemo.activo && tienePermiso(PERMISOS.CONFIG_EDITAR) && (
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

          {/* Configuración Fiscal */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px] relative min-h-[450px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Configuración Fiscal</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Datos fiscales para facturación
                </p>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CUIT
                      </label>
                      <input
                        type="text"
                        value={configFiscal.cuit}
                        onChange={(e) => setConfigFiscal({ ...configFiscal, cuit: e.target.value })}
                        placeholder="XX-XXXXXXXX-X"
                        className="input-field w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condición de IVA
                      </label>
                      <select
                        value={configFiscal.condicionIva}
                        onChange={(e) => setConfigFiscal({ ...configFiscal, condicionIva: e.target.value })}
                        className="input-field w-full"
                      >
                        <option value="INSCRIPTO">Responsable Inscripto</option>
                        <option value="MONOTRIBUTISTA">Monotributista</option>
                        <option value="EXENTO">Exento</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      {configFiscal.condicionIva === 'INSCRIPTO' && 'Emite Facturas A (a inscriptos) y B (a otros). Discrimina IVA.'}
                      {configFiscal.condicionIva === 'MONOTRIBUTISTA' && 'Emite Facturas C para todos. No discrimina IVA.'}
                      {configFiscal.condicionIva === 'EXENTO' && 'Emite Facturas B para todos. No discrimina IVA.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razón Social
                    </label>
                    <input
                      type="text"
                      value={configFiscal.razonSocial}
                      onChange={(e) => setConfigFiscal({ ...configFiscal, razonSocial: e.target.value })}
                      placeholder="Club Sportivo Pilar"
                      className="input-field w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domicilio Fiscal
                    </label>
                    <input
                      type="text"
                      value={configFiscal.domicilioFiscal}
                      onChange={(e) => setConfigFiscal({ ...configFiscal, domicilioFiscal: e.target.value })}
                      placeholder="Av. Principal 123, Pilar"
                      className="input-field w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Botón guardar fijo abajo a la derecha */}
            {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
              <button
                onClick={guardarConfigFiscal}
                disabled={guardandoFiscal}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
                title="Guardar"
              >
                {guardandoFiscal ? (
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

          {/* Sección: Beneficios */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Beneficios</h2>
            <div className="flex flex-wrap gap-6">
              {/* Rubros */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/rubros')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-cyan-100">
                      <Store className="w-6 h-6 text-cyan-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/rubros/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Rubros</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{rubros.length}</p>
                    <p className="text-xs text-gray-500">
                      {rubros.filter(r => r.activo).length} activos
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>

              {/* Descuentos Disponibles */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/descuentos-disponibles')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-amber-100">
                      <Percent className="w-6 h-6 text-amber-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/descuentos-disponibles/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Descuentos Disponibles</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{descuentosDisponibles.length}</p>
                    <p className="text-xs text-gray-500">
                      {descuentosDisponibles.filter(d => d.activo).length} activos
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

              {/* Medios de Pago */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/medios-pago')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-violet-100">
                      <CreditCard className="w-6 h-6 text-violet-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/medios-pago/nuevo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Medios de Pago</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{mediosPago.length}</p>
                    <p className="text-xs text-gray-500">
                      {mediosPago.filter(m => m.activo).length} activos
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-xs text-primary font-medium">
                  Ver listado →
                </div>
              </div>

              {/* Centros de Costo */}
              <div
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition cursor-pointer w-72"
                onClick={() => navigate('/admin/configuracion/centros-costo')}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-xl bg-cyan-100">
                      <Calculator className="w-6 h-6 text-cyan-600" />
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate('/admin/configuracion/centros-costo') }}
                      className="flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-gray-800">Centros de Costo</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{centrosCosto.length}</p>
                    <p className="text-xs text-gray-500">
                      {centrosCosto.filter(c => c.activo).length} activos
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

      {/* Tab: Notificaciones */}
      {activeTab === 'notificaciones' && (
        <div className="flex flex-wrap gap-6">

          {/* Configuración SMTP / Email */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Configuración de Email (SMTP)</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Servidor de correo para el envío de notificaciones del club. Si no se configura, se usa el servidor global.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Servidor (host)</label>
                      <input type="text" value={configSmtp.host} onChange={e => setConfigSmtp({ ...configSmtp, host: e.target.value })} placeholder="smtp.gmail.com" className="input-field w-full" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
                      <input type="number" value={configSmtp.port} onChange={e => setConfigSmtp({ ...configSmtp, port: e.target.value })} placeholder="587" className="input-field w-full" />
                    </div>
                    <div className="col-span-2 flex flex-col justify-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={configSmtp.secure === 'true'} onChange={e => setConfigSmtp({ ...configSmtp, secure: e.target.checked ? 'true' : 'false', port: e.target.checked ? '465' : '587' })} className="rounded border-gray-300 text-primary" />
                        <span className="text-sm text-gray-700">TLS (puerto 465)</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                      <input type="email" value={configSmtp.user} onChange={e => setConfigSmtp({ ...configSmtp, user: e.target.value })} placeholder="club@gmail.com" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                      <div className="relative">
                        <input type={mostrarPassSmtp ? 'text' : 'password'} value={configSmtp.pass} onChange={e => setConfigSmtp({ ...configSmtp, pass: e.target.value })} placeholder="App password" className="input-field w-full pr-10" />
                        <button type="button" onClick={() => setMostrarPassSmtp(!mostrarPassSmtp)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {mostrarPassSmtp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre remitente</label>
                      <input type="text" value={configSmtp.fromName} onChange={e => setConfigSmtp({ ...configSmtp, fromName: e.target.value })} placeholder="Club Sportivo Pilar" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email remitente (from)</label>
                      <input type="email" value={configSmtp.from} onChange={e => setConfigSmtp({ ...configSmtp, from: e.target.value })} placeholder="noreply@club.com.ar" className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
                    <input type="email" value={configSmtp.emailContacto} onChange={e => setConfigSmtp({ ...configSmtp, emailContacto: e.target.value })} placeholder="contacto@club.com.ar" className="input-field w-full" />
                    <p className="text-xs text-gray-500 mt-1">Destinatario de los formularios de contacto del sitio</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {resultadoTestSmtp === 'ok' && <span className="text-sm text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Conexión exitosa</span>}
                {resultadoTestSmtp === 'error' && <span className="text-sm text-red-600 font-medium flex items-center gap-1"><XCircle className="w-4 h-4" /> Error de conexión</span>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={testearSmtp} disabled={testeandoSmtp || !configSmtp.host || !configSmtp.user} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
                  {testeandoSmtp ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
                  Testear
                </button>
                {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                  <button onClick={guardarConfigSmtp} disabled={guardandoSmtp} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                    {guardandoSmtp ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conexión WhatsApp — solo si el plan lo habilita */}
          {!planFeatures.whatsapp && (
            <div className="w-full py-6 px-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-gray-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-sm">WhatsApp no habilitado en este plan</p>
              <p className="text-xs mt-1">Contactá al soporte para activar las notificaciones por WhatsApp.</p>
            </div>
          )}
          {planFeatures.whatsapp && <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-100">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Conexión WhatsApp (Evolution API)</h3>
                    <p className="text-sm text-gray-500 mt-1">Configura la instancia de WhatsApp para envío de mensajes</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigWa({ ...configWa, enabled: configWa.enabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${configWa.enabled === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configWa.enabled === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL de la API</label>
                    <input type="url" value={configWa.apiUrl} onChange={e => setConfigWa({ ...configWa, apiUrl: e.target.value })} placeholder="https://evolution.tu-dominio.com" className="input-field w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instancia</label>
                      <input type="text" value={configWa.instance} onChange={e => setConfigWa({ ...configWa, instance: e.target.value })} placeholder="club-pilar" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <div className="relative">
                        <input type={mostrarApiKey ? 'text' : 'password'} value={configWa.apiKey} onChange={e => setConfigWa({ ...configWa, apiKey: e.target.value })} placeholder="••••••••••" className="input-field w-full pr-10" />
                        <button type="button" onClick={() => setMostrarApiKey(!mostrarApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {mostrarApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delay entre mensajes</label>
                      <div className="flex items-center gap-2">
                        <input type="number" value={configWa.delayMs} onChange={e => setConfigWa({ ...configWa, delayMs: e.target.value })} className="input-field w-full" />
                        <span className="text-xs text-gray-500 whitespace-nowrap">ms</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                      <input type="number" value={configWa.horaInicio} onChange={e => setConfigWa({ ...configWa, horaInicio: e.target.value })} min="0" max="23" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                      <input type="number" value={configWa.horaFin} onChange={e => setConfigWa({ ...configWa, horaFin: e.target.value })} min="0" max="23" className="input-field w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Prueba de envío */}
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Enviar mensaje de prueba</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={testWa.telefono}
                  onChange={e => { setTestWa(t => ({ ...t, telefono: e.target.value })); setResultadoTestWa(null) }}
                  placeholder="549XXXXXXXXXX"
                  className="input-field w-44"
                />
                <input
                  type="text"
                  value={testWa.texto}
                  onChange={e => setTestWa(t => ({ ...t, texto: e.target.value }))}
                  placeholder="Mensaje..."
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={enviarTestWa}
                  disabled={enviandoTestWa || !testWa.telefono || !testWa.texto}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition whitespace-nowrap"
                >
                  {enviandoTestWa ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  Enviar
                </button>
              </div>
              {resultadoTestWa === 'ok' && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Mensaje enviado</p>}
              {resultadoTestWa === 'error' && <p className="text-xs text-red-600 font-medium flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Error al enviar — verificá la configuración</p>}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                {statusWa?.conectado === true && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <Wifi className="w-4 h-4" /> Conectado
                  </span>
                )}
                {statusWa?.conectado === false && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                    <WifiOff className="w-4 h-4" /> Desconectado {statusWa.motivo ? `— ${statusWa.motivo}` : `(${statusWa.estado})`}
                  </span>
                )}
                {resultadoWebhook?.ok && (
                  <span className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle className="w-3.5 h-3.5" /> Webhook registrado: <code className="ml-1 bg-green-50 px-1 rounded">{resultadoWebhook.url}</code>
                  </span>
                )}
                {resultadoWebhook?.ok === false && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600">
                    <XCircle className="w-3.5 h-3.5" /> Error al registrar webhook: {resultadoWebhook.error}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={verificarEstadoWa} disabled={verificandoWa} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
                  {verificandoWa ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Wifi className="w-4 h-4" />}
                  Testear
                </button>
                {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                  <button onClick={guardarConfigWa} disabled={guardandoWa} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                    {guardandoWa ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </div>}


          {/* Notificaciones automáticas WhatsApp */}
          {planFeatures.whatsapp && <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 w-[750px]">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <Smartphone className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Notificaciones Automáticas (WhatsApp)</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Activá cada evento y personalizá el texto. Dejá el texto vacío para usar el mensaje por defecto.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Variables: <span className="font-mono bg-gray-100 px-1 rounded">{'{{nombre}}'}</span> <span className="font-mono bg-gray-100 px-1 rounded">{'{{monto}}'}</span> <span className="font-mono bg-gray-100 px-1 rounded">{'{{vencimiento}}'}</span> <span className="font-mono bg-gray-100 px-1 rounded">{'{{total}}'}</span> <span className="font-mono bg-gray-100 px-1 rounded">{'{{link}}'}</span>
                </p>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      eventoKey: 'WHATSAPP_NOTIF_PAGO',
                      textoKey: 'NOTIF_WA_PAGO',
                      label: 'Confirmación de pago',
                      desc: 'Al registrar un pago del socio',
                      placeholder: '*{{nombre}}*, registramos tu pago de *{{monto}}*. Gracias!',
                      vars: '{{nombre}}, {{monto}}',
                    },
                    {
                      eventoKey: 'WHATSAPP_NOTIF_VENCIMIENTO',
                      textoKey: 'NOTIF_WA_VENCIMIENTO',
                      label: 'Aviso de vencimiento',
                      desc: 'Días antes del vencimiento de cuota',
                      placeholder: '*{{nombre}}*, tu cuota de *{{monto}}* vence el *{{vencimiento}}*. Podés pagar desde el portal del club.',
                      vars: '{{nombre}}, {{monto}}, {{vencimiento}}',
                    },
                    {
                      eventoKey: 'WHATSAPP_NOTIF_MORA',
                      textoKey: 'NOTIF_WA_MORA',
                      label: 'Aviso de mora',
                      desc: 'Al tener cuotas vencidas',
                      placeholder: '*{{nombre}}*, tenés cuotas vencidas por un total de *{{total}}*. Por favor regularizá tu situación.',
                      vars: '{{nombre}}, {{total}}',
                    },
                    {
                      eventoKey: 'WHATSAPP_NOTIF_MAGIC_LINK',
                      textoKey: 'NOTIF_WA_PORTAL',
                      label: 'Link del portal',
                      desc: 'Al generar acceso al portal del socio',
                      placeholder: '*{{nombre}}*, acá está tu acceso al portal del club:\n{{link}}\n\nEste link es personal y expira en 7 días.',
                      vars: '{{nombre}}, {{link}}',
                    },
                  ].map(({ eventoKey, textoKey, label, desc, placeholder, vars }) => {
                    const activo = notifEventos[eventoKey] === 'true'
                    return (
                      <div key={eventoKey} className={`border rounded-lg p-3 transition-colors ${activo ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{label}</p>
                            <p className="text-xs text-gray-500">{desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifEventos({ ...notifEventos, [eventoKey]: activo ? 'false' : 'true' })}
                            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${activo ? 'bg-emerald-500' : 'bg-gray-300'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-6' : ''}`} />
                          </button>
                        </div>
                        {activo && (
                          <div className="mt-2">
                            <textarea
                              value={notifTextos[textoKey] || ''}
                              onChange={e => setNotifTextos({ ...notifTextos, [textoKey]: e.target.value })}
                              placeholder={placeholder}
                              className="input-field w-full resize-none text-sm mt-1"
                              rows={3}
                            />
                            <p className="text-xs text-gray-400 mt-0.5">Variables: <span className="font-mono">{vars}</span></p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                <button onClick={guardarNotifWA} disabled={guardandoNotifWA} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                  {guardandoNotifWA ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              )}
            </div>
          </div>}

        </div>
      )}

      {/* Tab: Agente IA */}
      {activeTab === 'agente' && (
        <div className="space-y-6 max-w-3xl">

          {/* Chat interno (Portal del Socio) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Asistente de chat (Portal del Socio)</h3>
                    <p className="text-sm text-gray-500 mt-1">Widget de chat con IA disponible dentro del portal web del socio</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigWaAgent({ ...configWaAgent, chatEnabled: configWaAgent.chatEnabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${configWaAgent.chatEnabled === 'true' ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configWaAgent.chatEnabled === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                <button onClick={guardarConfigWaAgent} disabled={guardandoWaAgent} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                  {guardandoWaAgent ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              )}
            </div>
          </div>

          {/* Agente IA WhatsApp */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Agente de IA (WhatsApp)</h3>
                    <p className="text-sm text-gray-500 mt-1">Asistente virtual que responde consultas de socios por WhatsApp</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigWaAgent({ ...configWaAgent, enabled: configWaAgent.enabled === 'true' ? 'false' : 'true' })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${configWaAgent.enabled === 'true' ? 'bg-purple-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configWaAgent.enabled === 'true' ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio atención</label>
                      <input type="number" value={configWaAgent.horarioInicio} onChange={e => setConfigWaAgent({ ...configWaAgent, horarioInicio: e.target.value })} min="0" max="23" className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin atención</label>
                      <input type="number" value={configWaAgent.horarioFin} onChange={e => setConfigWaAgent({ ...configWaAgent, horarioFin: e.target.value })} min="0" max="23" className="input-field w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del asistente</label>
                    <input
                      type="text"
                      value={configWaAgent.nombre}
                      onChange={e => setConfigWaAgent({ ...configWaAgent, nombre: e.target.value })}
                      placeholder="Asistente"
                      className="input-field w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cómo se presenta el bot al saludar en WhatsApp y en el chat interno.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje fuera de horario</label>
                    <textarea
                      value={configWaAgent.msgFueraHorario}
                      onChange={e => setConfigWaAgent({ ...configWaAgent, msgFueraHorario: e.target.value })}
                      placeholder="Hola! Nuestro asistente atiende de 7 a 23hs. Te respondemos pronto."
                      className="input-field w-full resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">Se envía automáticamente cuando el socio escribe fuera del horario</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lista blanca de números <span className="text-gray-400 font-normal">(solo para pruebas)</span></label>
                    <input
                      type="text"
                      value={configWaAgent.whitelist}
                      onChange={e => setConfigWaAgent({ ...configWaAgent, whitelist: e.target.value })}
                      placeholder="5491112345678, 5491187654321"
                      className="input-field w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Números separados por coma. <strong>Si está vacío, el agente responde a todos.</strong> Útil para probar sin afectar a todos los socios.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones adicionales <span className="text-gray-400 font-normal">(se agregan al prompt base)</span></label>
                    <textarea
                      value={configWaAgent.promptExtra}
                      onChange={e => setConfigWaAgent({ ...configWaAgent, promptExtra: e.target.value })}
                      placeholder="Ej: No informes precios. Si preguntan por inscripciones nuevas, derivá siempre a administración."
                      className="input-field w-full resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">Reglas o contexto extra que el agente debe tener en cuenta.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prompt completo personalizado <span className="text-gray-400 font-normal">(reemplaza todo el comportamiento base)</span>
                    </label>
                    <textarea
                      value={configWaAgent.prompt}
                      onChange={e => setConfigWaAgent({ ...configWaAgent, prompt: e.target.value })}
                      placeholder="Dejá vacío para usar el comportamiento estándar. Solo completá esto si necesitás control total sobre el prompt."
                      className="input-field w-full resize-none font-mono text-xs"
                      rows={6}
                    />
                    <p className="text-xs text-amber-600 mt-1">⚠ Si completás este campo, las instrucciones adicionales se ignoran.</p>
                  </div>
                  {configWaAgent.enabled === 'true' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700">
                        <span className="font-medium">Requiere:</span> WhatsApp conectado y API key de IA configurada abajo.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                <button onClick={guardarConfigWaAgent} disabled={guardandoWaAgent} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                  {guardandoWaAgent ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              )}
            </div>
          </div>

          {/* Proveedor de IA */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-indigo-100">
                <Cpu className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Proveedor de IA</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Configurá qué modelo de IA usa el agente. Si tenés tu propia API key, el costo se factura a tu cuenta.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                      <select value={configAI.provider} onChange={e => setConfigAI({ ...configAI, provider: e.target.value })} className="input-field w-full">
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (GPT)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de modelo</label>
                      <select value={configAI.tier} onChange={e => setConfigAI({ ...configAI, tier: e.target.value })} className="input-field w-full">
                        <option value="rapido">Rápido — Haiku / GPT-4o mini (~$0.001/msg)</option>
                        <option value="estandar">Estándar — Sonnet / GPT-4o (~$0.012/msg)</option>
                        <option value="premium">Premium — Opus / GPT-4o (~$0.06/msg)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key propia</label>
                    <div className="relative">
                      <input
                        type={mostrarApiKeyAI ? 'text' : 'password'}
                        value={configAI.apiKey}
                        onChange={e => setConfigAI({ ...configAI, apiKey: e.target.value })}
                        placeholder="sk-ant-... o sk-..."
                        className="input-field w-full pr-10"
                      />
                      <button type="button" onClick={() => setMostrarApiKeyAI(!mostrarApiKeyAI)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {mostrarApiKeyAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Si no se configura, se usa la key global del servidor (compartida)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modelo exacto (opcional)</label>
                    <input
                      type="text"
                      value={configAI.modelOverride}
                      onChange={e => setConfigAI({ ...configAI, modelOverride: e.target.value })}
                      placeholder="Dejar vacío para usar el nivel seleccionado"
                      className="input-field w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ej: <span className="font-mono">claude-haiku-4-5-20251001</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              {tienePermiso(PERMISOS.CONFIG_EDITAR) && (
                <button onClick={guardarConfigAI} disabled={guardandoAI} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50 transition">
                  {guardandoAI ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
