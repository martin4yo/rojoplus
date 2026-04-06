import { Router } from 'express'
import { authAdmin } from '../../middleware/auth.js'

const router = Router()

router.get('/report-presets', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const presets = await req.db.reportPreset.findMany({
      where: { tenantId },
      include: {
        template: {
          select: { id: true, name: true, category: true, queryKey: true, parameters: true, isPublic: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(presets)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/report-presets', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const { templateId, name, description, params, sortOrder } = req.body
    if (!templateId || !name?.trim()) {
      return res.status(400).json({ error: 'templateId y name son requeridos' })
    }
    const template = await req.db.reportTemplate.findFirst({
      where: { id: templateId, isActive: true, OR: [{ tenantId }, { isPublic: true }] },
    })
    if (!template) return res.status(404).json({ error: 'Template no encontrado' })

    const preset = await req.db.reportPreset.create({
      data: {
        tenantId,
        templateId,
        name: name.trim(),
        description: description?.trim() || null,
        params: params || {},
        sortOrder: sortOrder ?? 0,
      },
      include: {
        template: { select: { id: true, name: true, category: true, queryKey: true, parameters: true, isPublic: true } },
      },
    })
    res.status(201).json(preset)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/report-presets/:id', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const { name, description, params, sortOrder } = req.body
    const existing = await req.db.reportPreset.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) return res.status(404).json({ error: 'Preset no encontrado' })

    const preset = await req.db.reportPreset.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        params: params ?? existing.params,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
      include: {
        template: { select: { id: true, name: true, category: true, queryKey: true, parameters: true, isPublic: true } },
      },
    })
    res.json(preset)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/report-presets/:id', authAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId
    const existing = await req.db.reportPreset.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) return res.status(404).json({ error: 'Preset no encontrado' })
    await req.db.reportPreset.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
