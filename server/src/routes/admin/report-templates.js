import { Router } from 'express'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { listQueryDefinitions, getQueryDefinition, runQuery } from '../../services/reportQueries.js'
import { renderHtml, htmlToPdf, getDefaultTemplate } from '../../services/reportEngine.js'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

async function runCustomScript(script, db, tenantId, params) {
  try {
    const fn = new AsyncFunction('db', 'tenantId', 'params', script)
    const result = await fn(db, tenantId, params)
    if (!result || typeof result !== 'object') {
      throw new Error('El script debe retornar un objeto { items, summary }')
    }
    return result
  } catch (err) {
    throw new Error(`Error en script personalizado: ${err.message}`)
  }
}

/**
 * Rehidrata `template.parameters` para evitar IDs hardcodeados Y agregar
 * parámetros nuevos que el query def haya incorporado después de que el
 * reporte fue diseñado.
 *
 * Algoritmo:
 *   - Toma la lista de `fresh` (defaultParams del query actual) como autoridad
 *     de QUÉ parámetros existen y QUÉ opciones tienen.
 *   - Para cada uno, si el template tiene una versión guardada con el mismo
 *     `name`, usa el `defaultValue` del template (preserva customizaciones del
 *     diseñador) pero las `options` siempre vienen del fresh.
 *   - Parámetros que estaban en `template.parameters` pero ya NO existen en
 *     `fresh` se descartan (probablemente fueron removidos del query def).
 */
async function rehidratarParametros(template, db, tenantId) {
  if (!template?.queryKey) return template
  const def = getQueryDefinition(template.queryKey)
  if (!def || typeof def.defaultParams !== 'function') return template

  try {
    const fresh = await def.defaultParams(db, tenantId)
    const tplByName = Object.fromEntries(((template.parameters) || []).map(p => [p.name, p]))
    const merged = (fresh || []).map(f => {
      const tpl = tplByName[f.name]
      if (!tpl) return f // parámetro nuevo: usar tal cual del query def
      return {
        ...f,                              // base: fresh (label, type, options, dependsOn)
        defaultValue: tpl.defaultValue ?? f.defaultValue, // preservar customización
      }
    })
    return { ...template, parameters: merged }
  } catch (err) {
    console.error(`[reports] Error rehidratando parameters de ${template.queryKey}:`, err.message)
    return template
  }
}

const router = Router()

// ── Query definitions (must be before /:id to avoid route conflict) ─────────

router.get('/report-templates/query-definitions', authAdmin, async (req, res) => {
  res.json(await listQueryDefinitions(req.db, req.tenantId))
})

router.get('/report-templates/query-definitions/:key/default-template', authAdmin, (req, res) => {
  const html = getDefaultTemplate(req.params.key)
  res.json({ html })
})

router.get('/report-templates/query-definitions/:key/source', authAdmin, (req, res) => {
  const def = getQueryDefinition(req.params.key)
  if (!def) return res.status(404).json({ error: 'Query no encontrada' })
  const fullSource = def.run.toString()
  const bodyStart = fullSource.indexOf('{') + 1
  const bodyEnd = fullSource.lastIndexOf('}')
  const body = fullSource.slice(bodyStart, bodyEnd).trim()
  res.json({ source: body })
})

// ── Preview endpoints (before /:id) ───────────────────────────────────────

router.post('/report-templates/preview-data', authAdmin, async (req, res) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'Tiempo de espera agotado (20s)' })
  }, 20_000)
  try {
    const { queryKey, customScript, params = {} } = req.body
    if (!queryKey && !customScript) {
      clearTimeout(timeout)
      return res.status(400).json({ error: 'Se requiere queryKey o customScript' })
    }
    const data = customScript
      ? await runCustomScript(customScript, req.db, req.tenantId, params)
      : await runQuery(queryKey, req.db, req.tenantId, params)
    const preview = {
      ...data,
      items: Array.isArray(data.items) ? data.items.slice(0, 3) : data.items,
      _note: Array.isArray(data.items) && data.items.length > 3
        ? `Mostrando 3 de ${data.items.length} registros` : undefined,
    }
    clearTimeout(timeout)
    if (!res.headersSent) res.json({ data: preview })
  } catch (error) {
    clearTimeout(timeout)
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Error al ejecutar query' })
  }
})

router.post('/report-templates/preview', authAdmin, async (req, res) => {
  try {
    const { queryKey, customScript, htmlTemplate, params = {} } = req.body
    if (!htmlTemplate) return res.status(400).json({ error: 'htmlTemplate es requerido' })
    if (!queryKey && !customScript) return res.status(400).json({ error: 'Se requiere queryKey o customScript' })

    const data = customScript
      ? await runCustomScript(customScript, req.db, req.tenantId, params)
      : await runQuery(queryKey, req.db, req.tenantId, params)

    const tenant = await req.db.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, nombre: true, logoUrl: true, direccion: true, telefono: true, email: true, cuit: true },
    }).catch(() => ({ id: req.tenantId, nombre: 'Club' }))

    const html = renderHtml(htmlTemplate, {
      reportName: 'Vista Previa', tenant, params, paramLabels: [],
      data, generatedAt: new Date().toLocaleString('es-AR'), userName: 'Preview',
    })
    res.setHeader('Content-Type', 'text/html').send(html)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error en preview' })
  }
})

// ── List & Create ──────────────────────────────────────────────────────────

router.get('/report-templates', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const templates = await req.db.reportTemplate.findMany({
      where: { isActive: true, OR: [{ tenantId }, { isPublic: true }] },
      select: {
        id: true, name: true, description: true, category: true,
        queryKey: true, parameters: true, pageSetup: true, sortOrder: true,
        isPublic: true, tenantId: true, createdAt: true, updatedAt: true,
        _count: { select: { executions: true } },
      },
      orderBy: [{ isPublic: 'desc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json(templates)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener reportes' })
  }
})

router.post('/report-templates', authAdmin, checkPermiso('REPORTES_DISENAR'), async (req, res) => {
  try {
    const { name, description, category, queryKey, customScript, parameters, htmlTemplate, pageSetup, sortOrder } = req.body
    if (!name) return res.status(400).json({ error: 'name es requerido' })
    if (!queryKey && !customScript) return res.status(400).json({ error: 'Se requiere queryKey o customScript' })
    if (queryKey && !getQueryDefinition(queryKey)) return res.status(400).json({ error: `queryKey "${queryKey}" no existe` })

    const template = await req.db.reportTemplate.create({
      data: {
        tenantId: req.tenantId,
        name,
        description: description || null,
        category: category || 'general',
        queryKey: queryKey || null,
        customScript: customScript || null,
        parameters: parameters || [],
        htmlTemplate: htmlTemplate || (queryKey ? getDefaultTemplate(queryKey) : ''),
        pageSetup: pageSetup || {},
        sortOrder: sortOrder || 0,
        isPublic: false,
      },
    })
    res.status(201).json(template)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear reporte' })
  }
})

// ── Get / Update / Delete by ID ────────────────────────────────────────────

router.get('/report-templates/:id', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const template = await req.db.reportTemplate.findFirst({
      where: { id: req.params.id, isActive: true, OR: [{ tenantId }, { isPublic: true }] },
    })
    if (!template) return res.status(404).json({ error: 'Reporte no encontrado' })
    // Rehidratar options para el tenant actual (evita IDs hardcodeados del tenant origen)
    const rehidratado = await rehidratarParametros(template, req.db, tenantId)
    res.json(rehidratado)
  } catch (error) {
    console.error('Error al obtener reporte:', error)
    res.status(500).json({ error: 'Error al obtener reporte' })
  }
})

router.put('/report-templates/:id', authAdmin, checkPermiso('REPORTES_DISENAR'), async (req, res) => {
  try {
    const tenantId = req.tenantId
    const exists = await req.db.reportTemplate.findFirst({
      where: { id: req.params.id, isActive: true, OR: [{ tenantId }, { isPublic: true }] },
    })
    if (!exists) return res.status(404).json({ error: 'Reporte no encontrado' })
    if (exists.isPublic && exists.tenantId !== tenantId) {
      return res.status(403).json({ error: 'No tenés permiso para editar este reporte' })
    }

    const { name, description, category, queryKey, customScript, parameters, htmlTemplate, pageSetup, sortOrder } = req.body
    const template = await req.db.reportTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(queryKey !== undefined && { queryKey: queryKey || null }),
        ...(customScript !== undefined && { customScript: customScript || null }),
        ...(parameters !== undefined && { parameters }),
        ...(htmlTemplate !== undefined && { htmlTemplate }),
        ...(pageSetup !== undefined && { pageSetup }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })
    res.json(template)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar reporte' })
  }
})

router.delete('/report-templates/:id', authAdmin, checkPermiso('REPORTES_DISENAR'), async (req, res) => {
  try {
    const tenantId = req.tenantId
    const exists = await req.db.reportTemplate.findFirst({
      where: { id: req.params.id, isActive: true, OR: [{ tenantId }, { isPublic: true }] },
    })
    if (!exists) return res.status(404).json({ error: 'Reporte no encontrado' })
    if (exists.tenantId !== tenantId) return res.status(403).json({ error: 'No tenés permiso para eliminar este reporte' })
    await req.db.reportTemplate.update({ where: { id: req.params.id }, data: { isActive: false } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar reporte' })
  }
})

// ── Execute (PDF) ──────────────────────────────────────────────────────────

router.post('/report-templates/:id/run', authAdmin, async (req, res) => {
  const start = Date.now()
  const templateId = req.params.id
  const userId = req.admin?.id || null

  const requestTimeout = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'Tiempo de espera agotado (90s)' })
  }, 90_000)

  try {
    const tenantId = req.tenantId
    const template = await req.db.reportTemplate.findFirst({
      where: { id: templateId, isActive: true, OR: [{ tenantId }, { isPublic: true }] },
    })
    if (!template) {
      clearTimeout(requestTimeout)
      return res.status(404).json({ error: 'Reporte no encontrado' })
    }

    const params = req.body.params || {}
    const data = template.customScript
      ? await runCustomScript(template.customScript, req.db, tenantId, params)
      : await runQuery(template.queryKey, req.db, tenantId, params)

    const paramDef = template.queryKey ? getQueryDefinition(template.queryKey) : null
    const paramLabels = ((template.parameters) || paramDef?.defaultParams || []).map(p => ({
      label: p.label,
      value: params[p.name] != null ? String(params[p.name]) : '—',
    }))

    const tenant = await req.db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, logoUrl: true, direccion: true, telefono: true, email: true, cuit: true },
    }).catch(() => ({ id: tenantId, nombre: 'Club' }))

    const templateData = {
      reportName: template.name,
      tenant,
      params,
      paramLabels,
      data,
      generatedAt: new Date().toLocaleString('es-AR'),
      userName: req.admin?.nombre || req.admin?.email || '',
    }

    const format = req.query.format === 'html' ? 'html' : 'pdf'
    const html = renderHtml(template.htmlTemplate, templateData)

    // Log execution (non-blocking)
    req.db.reportExecution.create({
      data: { tenantId, templateId, userId, parameters: params, durationMs: Date.now() - start },
    }).catch(() => {})

    if (format === 'html') {
      clearTimeout(requestTimeout)
      return res.setHeader('Content-Type', 'text/html').send(html)
    }

    const pdf = await htmlToPdf(html, template.pageSetup || {})
    clearTimeout(requestTimeout)
    if (res.headersSent) return
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${template.name.replace(/\s+/g, '_')}.pdf"`)
    res.send(pdf)
  } catch (error) {
    clearTimeout(requestTimeout)
    console.error('Report execution error:', error)
    req.db.reportExecution.create({
      data: { tenantId: req.tenantId, templateId, userId, parameters: req.body.params || {}, durationMs: Date.now() - start, error: error.message },
    }).catch(() => {})
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Error al generar reporte' })
  }
})

export default router
