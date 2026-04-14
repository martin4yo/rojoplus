/**
 * ai-analisis.js
 *
 * Rutas de análisis con IA para el panel de administración de Clubix.
 * Soporta dos proveedores:
 *   - 'local'  → AXIO ML Hub (Ollama, datos nunca salen del servidor)
 *   - 'cloud'  → Anthropic Claude (mayor capacidad, consume créditos)
 *
 * El cliente elige el proveedor enviando { provider: 'local' | 'cloud' } en el body.
 * Default: 'local'
 *
 * Endpoints:
 *   GET  /api/admin/ai/disponible        — health check del ML Hub local
 *   POST /api/admin/ai/consulta          — consulta libre con contexto
 *   POST /api/admin/ai/resumen-mensual   — resumen ejecutivo del mes
 *   POST /api/admin/ai/socios-en-riesgo  — socios con riesgo de baja
 *   POST /api/admin/ai/actividades       — análisis de actividades
 */

import Anthropic from '@anthropic-ai/sdk'
import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { isAxioMLAvailable, consultarML, getScopeHint } from '../../services/axioMLService.js'
import { resolverModelo } from '../../config/aiModels.js'

/**
 * Lee el proveedor configurado por el super-admin para este tenant.
 * Fallback: 'local' (Ollama).
 */
async function leerProvider(db) {
  try {
    const cfg = await db.tenantConfiguracion.findFirst({
      where: { clave: 'AI_ANALISIS_PROVIDER' },
    })
    return cfg?.valor || 'local'
  } catch {
    return 'local'
  }
}

/**
 * Función unificada: rutea la consulta al proveedor elegido.
 * @param {'local'|'cloud'} provider
 * @param {string} question
 * @param {string} context
 * @returns {Promise<{ answer: string, model: string, time_ms: number }>}
 */
async function consultar(provider, question, context, scopeHint = null, tenantId = null) {
  if (provider === 'cloud') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new AppError('ANTHROPIC_API_KEY no configurada', 503)

    const client = new Anthropic({ apiKey })
    const model = resolverModelo('anthropic', 'rapido', null) // haiku — rápido y económico
    const inicio = Date.now()

    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${question}\n\nContexto:\n${context}`,
      }],
      system: 'Sos un asistente de gestión deportiva. Respondé en español, de forma clara y concisa. Usá listas cuando sea útil.',
    })

    return {
      answer: msg.content[0]?.text || '',
      model,
      time_ms: Date.now() - inicio,
    }
  }

  // Default: local (Ollama)
  return consultarML(question, context, 'phi3:mini', scopeHint, tenantId)
}

const router = Router()

// ─────────────────────────────────────────────────────────────
// GET /api/admin/ai/disponible
// Verifica si el AXIO ML Hub está accesible
// ─────────────────────────────────────────────────────────────
router.get('/disponible', authAdmin, asyncHandler(async (req, res) => {
  const disponible = await isAxioMLAvailable()
  res.json({ success: true, data: { disponible } })
}))

// ─────────────────────────────────────────────────────────────
// POST /api/admin/ai/consulta
// Consulta libre: el frontend envía question + context opcional
// ─────────────────────────────────────────────────────────────
router.post('/consulta', authAdmin, asyncHandler(async (req, res) => {
  const { question, context } = req.body
  if (!question?.trim()) throw new AppError('El campo question es requerido', 400)

  const provider = await leerProvider(req.db)
  const scopeHint = await getScopeHint(req.db)
  const resultado = await consultar(provider, question, context || '', scopeHint, req.tenantId)
  res.json({ success: true, data: { ...resultado, provider } })
}))

// ─────────────────────────────────────────────────────────────
// POST /api/admin/ai/resumen-mensual
// Genera un resumen ejecutivo del mes con los datos reales del tenant
// ─────────────────────────────────────────────────────────────
router.post('/resumen-mensual', authAdmin, asyncHandler(async (req, res) => {
  const provider = await leerProvider(req.db)
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const inicioMes = new Date(anioActual, mesActual - 1, 1)
  const inicioMesAnterior = new Date(anioActual, mesActual - 2, 1)

  const db = req.db

  // Recopilar datos del tenant en paralelo
  const [
    sociosActivos,
    sociosNuevos,
    bajasMes,
    inscripcionesActivas,
    ingresosMes,
    egresosMes,
    cuotasPendientes,
    topActividades,
  ] = await Promise.all([
    db.socio.count({
      where: { OR: [{ estado: { contains: 'Activ', mode: 'insensitive' } }, { estado: { contains: 'Vigent', mode: 'insensitive' } }] }
    }),
    db.socio.count({ where: { createdAt: { gte: inicioMes } } }),
    db.socio.count({ where: { estado: { contains: 'Baja', mode: 'insensitive' }, updatedAt: { gte: inicioMes } } }),
    db.inscripcion.count({ where: { estado: 'ACTIVA' } }),
    db.movimientoCaja.aggregate({
      where: { tipo: 'INGRESO', fecha: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    db.movimientoCaja.aggregate({
      where: { tipo: 'EGRESO', fecha: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    db.cargo.count({ where: { estado: 'PENDIENTE' } }),
    db.categoriaActividad.findMany({
      where: { activo: true },
      include: {
        actividad: { select: { nombre: true } },
        _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } },
      },
      orderBy: { inscripciones: { _count: 'desc' } },
      take: 5,
    }),
  ])

  const ingresos = Number(ingresosMes._sum.monto) || 0
  const egresos = Number(egresosMes._sum.monto) || 0

  const topActividadesTexto = topActividades
    .map(c => `${c.actividad?.nombre || 'Sin nombre'} - ${c.nombre}: ${c._count.inscripciones} inscriptos`)
    .join('\n')

  const mes = hoy.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  const context = `
App: Clubix — Sistema de gestión de entidades deportivas
Período: ${mes}

=== SOCIOS ===
Socios activos: ${sociosActivos}
Socios nuevos este mes: ${sociosNuevos}
Bajas este mes: ${bajasMes}
Inscripciones activas en actividades: ${inscripcionesActivas}

=== FINANZAS ===
Ingresos del mes: $${ingresos.toLocaleString('es-AR')}
Egresos del mes: $${egresos.toLocaleString('es-AR')}
Resultado: $${(ingresos - egresos).toLocaleString('es-AR')}
Cuotas/cargos pendientes de cobro: ${cuotasPendientes}

=== ACTIVIDADES MÁS POPULARES ===
${topActividadesTexto || 'Sin datos'}
`.trim()

  const resultado = await consultar(
    provider,
    `Generá un resumen ejecutivo del mes ${mes} con los principales indicadores y 3 sugerencias concretas de mejora para la institución. Sé conciso y usa lenguaje claro para el administrador del club.`,
    context
  )

  res.json({
    success: true,
    data: {
      ...resultado,
      metricas: { sociosActivos, sociosNuevos, bajasMes, inscripcionesActivas, ingresos, egresos, cuotasPendientes },
      provider,
    },
  })
}))

// ─────────────────────────────────────────────────────────────
// POST /api/admin/ai/socios-en-riesgo
// Identifica socios con posible riesgo de baja
// ─────────────────────────────────────────────────────────────
router.post('/socios-en-riesgo', authAdmin, asyncHandler(async (req, res) => {
  const provider = await leerProvider(req.db)
  const hace60Dias = new Date()
  hace60Dias.setDate(hace60Dias.getDate() - 60)

  const db = req.db

  const [sociosMorosos, sociosSinActividad, cuotasVencidas] = await Promise.all([
    // Socios con cargos pendientes de más de 60 días
    db.cargo.findMany({
      where: {
        estado: 'PENDIENTE',
        createdAt: { lte: hace60Dias },
      },
      include: {
        socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      },
      take: 20,
    }),
    // Socios activos sin inscripciones en actividades
    db.socio.findMany({
      where: {
        OR: [{ estado: { contains: 'Activ', mode: 'insensitive' } }, { estado: { contains: 'Vigent', mode: 'insensitive' } }],
        inscripciones: { none: { estado: 'ACTIVA' } },
      },
      select: { id: true, nroSocio: true, apellidoNombre: true },
      take: 20,
    }),
    // Total de cuotas vencidas
    db.cargo.count({ where: { estado: 'PENDIENTE', createdAt: { lte: hace60Dias } } }),
  ])

  const nombresMorosos = [...new Set(sociosMorosos.map(c => c.socio?.apellidoNombre).filter(Boolean))]
  const nombresSinAct = sociosSinActividad.map(s => s.apellidoNombre)

  const context = `
App: Clubix — Sistema de gestión de entidades deportivas

=== SOCIOS EN RIESGO ===
Socios con cuotas/cargos vencidos hace más de 60 días: ${cuotasVencidas}
Ejemplos: ${nombresMorosos.slice(0, 5).join(', ') || 'ninguno'}

Socios activos sin inscripción en ninguna actividad: ${sociosSinActividad.length}
Ejemplos: ${nombresSinAct.slice(0, 5).join(', ') || 'ninguno'}
`.trim()

  const resultado = await consultar(
    provider,
    `Analizá la situación de socios en riesgo de baja y sugerí 3 acciones concretas para retenerlos (ofertas, comunicaciones, incentivos).`,
    context
  )

  res.json({
    success: true,
    data: {
      ...resultado,
      metricas: {
        sociosMorosos: cuotasVencidas,
        sociosSinActividad: sociosSinActividad.length,
      },
      provider,
    },
  })
}))

// ─────────────────────────────────────────────────────────────
// POST /api/admin/ai/actividades
// Análisis de actividades e inscripciones
// ─────────────────────────────────────────────────────────────
router.post('/actividades', authAdmin, asyncHandler(async (req, res) => {
  const provider = await leerProvider(req.db)
  const db = req.db

  const categorias = await db.categoriaActividad.findMany({
    where: { activo: true },
    include: {
      actividad: { select: { nombre: true } },
      _count: {
        select: {
          inscripciones: { where: { estado: 'ACTIVA' } },
        },
      },
    },
    orderBy: { inscripciones: { _count: 'desc' } },
  })

  const resumenActividades = categorias
    .map(c => `${c.actividad?.nombre || 'Sin actividad'} — ${c.nombre}: ${c._count.inscripciones} inscriptos activos`)
    .join('\n')

  const context = `
App: Clubix — Sistema de gestión de entidades deportivas

=== ACTIVIDADES Y CATEGORÍAS ===
${resumenActividades || 'Sin actividades cargadas'}

Total de categorías activas: ${categorias.length}
Total de inscripciones activas: ${categorias.reduce((acc, c) => acc + c._count.inscripciones, 0)}
`.trim()

  const resultado = await consultar(
    provider,
    `Analizá la distribución de socios entre actividades e identificá oportunidades: actividades con poca participación, posibles nuevas categorías o ajustes de horarios.`,
    context
  )

  res.json({ success: true, data: { ...resultado, provider } })
}))

// ─────────────────────────────────────────────────────────────
// GET /api/admin/ia/metricas
// Métricas de uso del agente IA (tokens, costo, por modelo/día)
// ─────────────────────────────────────────────────────────────
function calcularCostoIA(model, inp, out) {
  const m = model.toLowerCase()
  if (m.includes('haiku'))       return (inp * 0.80  + out * 4.00)  / 1_000_000
  if (m.includes('sonnet'))      return (inp * 3.00  + out * 15.00) / 1_000_000
  if (m.includes('opus'))        return (inp * 15.00 + out * 75.00) / 1_000_000
  if (m.includes('gpt-4o-mini')) return (inp * 0.15  + out * 0.60)  / 1_000_000
  if (m.includes('gpt-4o'))      return (inp * 5.00  + out * 15.00) / 1_000_000
  return (inp * 3.00 + out * 15.00) / 1_000_000
}

router.get('/metricas', authAdmin, asyncHandler(async (req, res) => {
  const { desde, hasta } = req.query
  const fechaDesde = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const fechaHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date()
  const tenantId = req.tenantId

  const tableExists = await req.db.aiUsageLog.count({ where: { tenantId } }).catch(() => null)
  if (tableExists === null) {
    return res.json({ mensajes: 0, inputTokens: 0, outputTokens: 0, costoUSD: 0, porDia: [], porModelo: [] })
  }

  const [porModelo, porDia] = await Promise.all([
    req.db.aiUsageLog.groupBy({
      by: ['provider', 'model'],
      where: { tenantId, createdAt: { gte: fechaDesde, lte: fechaHasta } },
      _count: { id: true },
      _sum: { inputTokens: true, outputTokens: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    req.db.$queryRaw`
      SELECT
        DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
        COUNT(*)::int AS mensajes,
        SUM(input_tokens)::int AS input_tokens,
        SUM(output_tokens)::int AS output_tokens
      FROM ai_usage_logs
      WHERE tenant_id = ${tenantId}
        AND created_at >= ${fechaDesde}
        AND created_at <= ${fechaHasta}
      GROUP BY dia
      ORDER BY dia ASC
    `.catch(() => []),
  ])

  const costosPorModelo = porModelo.map(g => {
    const inp = g._sum.inputTokens || 0
    const out = g._sum.outputTokens || 0
    return { provider: g.provider, model: g.model, mensajes: g._count.id, inputTokens: inp, outputTokens: out, costoUSD: calcularCostoIA(g.model, inp, out) }
  })

  const totales = costosPorModelo.reduce(
    (acc, r) => ({ mensajes: acc.mensajes + r.mensajes, inputTokens: acc.inputTokens + r.inputTokens, outputTokens: acc.outputTokens + r.outputTokens, costoUSD: acc.costoUSD + r.costoUSD }),
    { mensajes: 0, inputTokens: 0, outputTokens: 0, costoUSD: 0 }
  )

  res.json({ ...totales, porModelo: costosPorModelo, porDia })
}))

export default router
