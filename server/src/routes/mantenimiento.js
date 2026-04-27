import { Router } from 'express'
import { authAdmin, checkPermiso } from '../middleware/auth.js'

const router = Router()

const ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'CANCELADA']
const TIPOS = ['CORRECTIVO', 'PREVENTIVO', 'MEJORA']
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE']

async function generarNumeroOT(db) {
  const anio = new Date().getFullYear()
  const prefix = `OT-${anio}-`

  const ultima = await db.ordenTrabajo.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  })

  let next = 1
  if (ultima?.numero) {
    const match = ultima.numero.match(/-(\d+)$/)
    if (match) next = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

// GET /admin/mantenimiento - listar con filtros
router.get('/mantenimiento', authAdmin, checkPermiso('MANTENIMIENTO_VER'), async (req, res) => {
  try {
    const { estado, prioridad, tipo, responsableId, espacioId, desde, hasta, q } = req.query

    const where = {}
    if (estado) where.estado = estado
    if (prioridad) where.prioridad = prioridad
    if (tipo) where.tipo = tipo
    if (responsableId) where.responsableId = parseInt(responsableId)
    if (espacioId) where.espacioId = parseInt(espacioId)
    if (desde || hasta) {
      where.fechaApertura = {}
      if (desde) where.fechaApertura.gte = new Date(desde)
      if (hasta) where.fechaApertura.lte = new Date(hasta)
    }
    if (q) {
      where.OR = [
        { titulo: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
        { numero: { contains: q, mode: 'insensitive' } },
        { ubicacion: { contains: q, mode: 'insensitive' } }
      ]
    }

    const ordenes = await req.db.ordenTrabajo.findMany({
      where,
      include: {
        responsable: { select: { id: true, razonSocial: true, tipo: true } },
        espacio: { select: { id: true, nombre: true } },
        centroCosto: { select: { id: true, nombre: true } }
      },
      orderBy: [{ estado: 'asc' }, { fechaApertura: 'desc' }]
    })

    res.json(ordenes)
  } catch (error) {
    console.error('Error listando órdenes de trabajo:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /admin/mantenimiento/:id
router.get('/mantenimiento/:id', authAdmin, checkPermiso('MANTENIMIENTO_VER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const orden = await req.db.ordenTrabajo.findUnique({
      where: { id },
      include: {
        responsable: { select: { id: true, razonSocial: true, tipo: true } },
        espacio: { select: { id: true, nombre: true } },
        centroCosto: { select: { id: true, nombre: true } },
        historial: { orderBy: { fecha: 'desc' } }
      }
    })

    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    // Cargar nombres de admin para el historial (consulta separada para evitar el join)
    const adminIds = [...new Set(orden.historial.map(h => h.adminId))]
    const admins = adminIds.length
      ? await req.db.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, nombre: true, apellido: true, email: true }
        })
      : []
    const adminMap = new Map(admins.map(a => [a.id, a]))
    orden.historial = orden.historial.map(h => ({
      ...h,
      admin: adminMap.get(h.adminId) || null
    }))

    res.json(orden)
  } catch (error) {
    console.error('Error obteniendo orden:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/mantenimiento
router.post('/mantenimiento', authAdmin, checkPermiso('MANTENIMIENTO_GESTIONAR'), async (req, res) => {
  try {
    const {
      titulo, descripcion, tipo, prioridad,
      ubicacion, espacioId, responsableId, centroCostoId,
      costoEstimado
    } = req.body

    if (!titulo || titulo.trim().length === 0) {
      return res.status(400).json({ error: 'El título es requerido' })
    }
    if (tipo && !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' })
    if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' })

    const numero = await generarNumeroOT(req.db)

    const orden = await req.db.$transaction(async (tx) => {
      const creada = await tx.ordenTrabajo.create({
        data: {
          numero,
          titulo: titulo.trim(),
          descripcion: descripcion || null,
          tipo: tipo || 'CORRECTIVO',
          prioridad: prioridad || 'MEDIA',
          estado: 'PENDIENTE',
          ubicacion: ubicacion || null,
          espacioId: espacioId ? parseInt(espacioId) : null,
          responsableId: responsableId ? parseInt(responsableId) : null,
          centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
          costoEstimado: costoEstimado != null && costoEstimado !== '' ? parseFloat(costoEstimado) : null,
          registradoPor: req.admin.id
        },
        include: {
          responsable: { select: { id: true, razonSocial: true, tipo: true } },
          espacio: { select: { id: true, nombre: true } },
          centroCosto: { select: { id: true, nombre: true } }
        }
      })

      await tx.historialOrdenTrabajo.create({
        data: {
          ordenId: creada.id,
          adminId: req.admin.id,
          tipo: 'CAMBIO_ESTADO',
          estadoNuevo: 'PENDIENTE',
          comentario: 'Orden creada'
        }
      })

      return creada
    })

    res.status(201).json(orden)
  } catch (error) {
    console.error('Error creando orden:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /admin/mantenimiento/:id - editar campos generales (no cambia estado)
router.put('/mantenimiento/:id', authAdmin, checkPermiso('MANTENIMIENTO_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existente = await req.db.ordenTrabajo.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Orden no encontrada' })
    if (existente.estado === 'RESUELTA' || existente.estado === 'CANCELADA') {
      return res.status(400).json({ error: 'No se puede editar una orden cerrada. Reabra cambiando el estado.' })
    }

    const {
      titulo, descripcion, tipo, prioridad,
      ubicacion, espacioId, responsableId, centroCostoId,
      costoEstimado
    } = req.body

    if (tipo && !TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' })
    if (prioridad && !PRIORIDADES.includes(prioridad)) return res.status(400).json({ error: 'Prioridad inválida' })

    const responsableAnterior = existente.responsableId

    const data = {
      titulo: titulo !== undefined ? titulo : undefined,
      descripcion: descripcion !== undefined ? (descripcion || null) : undefined,
      tipo: tipo !== undefined ? tipo : undefined,
      prioridad: prioridad !== undefined ? prioridad : undefined,
      ubicacion: ubicacion !== undefined ? (ubicacion || null) : undefined,
      espacioId: espacioId !== undefined ? (espacioId ? parseInt(espacioId) : null) : undefined,
      responsableId: responsableId !== undefined ? (responsableId ? parseInt(responsableId) : null) : undefined,
      centroCostoId: centroCostoId !== undefined ? (centroCostoId ? parseInt(centroCostoId) : null) : undefined,
      costoEstimado: costoEstimado !== undefined ? (costoEstimado === '' || costoEstimado === null ? null : parseFloat(costoEstimado)) : undefined
    }

    const actualizada = await req.db.$transaction(async (tx) => {
      const updated = await tx.ordenTrabajo.update({
        where: { id },
        data,
        include: {
          responsable: { select: { id: true, razonSocial: true, tipo: true } },
          espacio: { select: { id: true, nombre: true } },
          centroCosto: { select: { id: true, nombre: true } }
        }
      })

      // Registrar asignación de responsable si cambió
      if (data.responsableId !== undefined && data.responsableId !== responsableAnterior) {
        await tx.historialOrdenTrabajo.create({
          data: {
            ordenId: id,
            adminId: req.admin.id,
            tipo: 'ASIGNACION',
            comentario: data.responsableId
              ? `Responsable asignado: ${updated.responsable?.razonSocial || data.responsableId}`
              : 'Responsable removido'
          }
        })
      }

      return updated
    })

    res.json(actualizada)
  } catch (error) {
    console.error('Error actualizando orden:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/mantenimiento/:id/estado - cambiar estado
router.post('/mantenimiento/:id/estado', authAdmin, checkPermiso('MANTENIMIENTO_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { estado, comentario, resolucion, costoReal } = req.body

    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

    const existente = await req.db.ordenTrabajo.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Orden no encontrada' })
    if (existente.estado === estado) return res.status(400).json({ error: 'La orden ya está en ese estado' })

    if (estado === 'RESUELTA' && (!resolucion || resolucion.trim().length === 0)) {
      return res.status(400).json({ error: 'Para resolver la orden debe indicar qué se hizo (resolución)' })
    }

    const data = { estado }
    if (estado === 'EN_PROCESO' && !existente.fechaInicio) {
      data.fechaInicio = new Date()
    }
    if (estado === 'RESUELTA') {
      data.fechaResolucion = new Date()
      data.resolucion = resolucion.trim()
      if (costoReal != null && costoReal !== '') data.costoReal = parseFloat(costoReal)
    }
    if (estado === 'CANCELADA') {
      data.fechaResolucion = new Date()
    }
    // Reapertura desde RESUELTA / CANCELADA
    if ((existente.estado === 'RESUELTA' || existente.estado === 'CANCELADA') && estado !== 'RESUELTA' && estado !== 'CANCELADA') {
      data.fechaResolucion = null
    }

    const actualizada = await req.db.$transaction(async (tx) => {
      const updated = await tx.ordenTrabajo.update({
        where: { id },
        data
      })

      await tx.historialOrdenTrabajo.create({
        data: {
          ordenId: id,
          adminId: req.admin.id,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior: existente.estado,
          estadoNuevo: estado,
          comentario: comentario || null
        }
      })

      return updated
    })

    res.json(actualizada)
  } catch (error) {
    console.error('Error cambiando estado:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/mantenimiento/:id/comentario
router.post('/mantenimiento/:id/comentario', authAdmin, checkPermiso('MANTENIMIENTO_VER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { comentario } = req.body
    if (!comentario || comentario.trim().length === 0) {
      return res.status(400).json({ error: 'El comentario es requerido' })
    }

    const existente = await req.db.ordenTrabajo.findUnique({ where: { id }, select: { id: true } })
    if (!existente) return res.status(404).json({ error: 'Orden no encontrada' })

    const entrada = await req.db.historialOrdenTrabajo.create({
      data: {
        ordenId: id,
        adminId: req.admin.id,
        tipo: 'COMENTARIO',
        comentario: comentario.trim()
      }
    })

    res.status(201).json(entrada)
  } catch (error) {
    console.error('Error agregando comentario:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /admin/mantenimiento/:id - solo si está PENDIENTE y sin actividad real
router.delete('/mantenimiento/:id', authAdmin, checkPermiso('MANTENIMIENTO_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existente = await req.db.ordenTrabajo.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Orden no encontrada' })
    if (existente.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden eliminar órdenes en estado PENDIENTE. Cancelar en lugar de eliminar.' })
    }
    await req.db.ordenTrabajo.delete({ where: { id } })
    res.json({ message: 'Orden eliminada' })
  } catch (error) {
    console.error('Error eliminando orden:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
