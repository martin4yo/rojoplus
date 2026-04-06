import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { getIO } from '../../services/socketService.js'

const router = Router()

// ============================================================
// CHAT ENTRENADORES — rutas admin
// ============================================================

// GET /api/admin/chat/conversaciones
// Lista todas las conversaciones (filtrado por entrenadorId si viene en query)
router.get('/conversaciones', authAdmin, asyncHandler(async (req, res) => {
  const { entrenadorId, soloNoLeidas } = req.query
  const where = {}
  if (entrenadorId) where.entrenadorId = parseInt(entrenadorId)
  if (soloNoLeidas === 'true') where.mensajesNoLeidos = { gt: 0 }

  const conversaciones = await req.db.conversacion.findMany({
    where,
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      entrenador: { select: { id: true, nombre: true, apellido: true } },
      categoriaActividad: {
        select: { nombre: true, actividad: { select: { nombre: true } } }
      },
      mensajes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { contenido: true, createdAt: true, emisorTipo: true }
      }
    },
    orderBy: { ultimoMensaje: 'desc' }
  })

  res.json({ success: true, data: conversaciones })
}))

// GET /api/admin/chat/conversaciones/:id/mensajes
router.get('/conversaciones/:id/mensajes', authAdmin, asyncHandler(async (req, res) => {
  const conversacion = await req.db.conversacion.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      entrenador: { select: { id: true, nombre: true, apellido: true } },
      categoriaActividad: {
        select: { nombre: true, actividad: { select: { nombre: true } } }
      }
    }
  })

  if (!conversacion) throw new AppError('Conversación no encontrada', 404, 'NOT_FOUND')

  const mensajes = await req.db.mensaje.findMany({
    where: { conversacionId: parseInt(req.params.id) },
    orderBy: { createdAt: 'asc' }
  })

  // Marcar como leídos los mensajes del socio
  await req.db.mensaje.updateMany({
    where: { conversacionId: parseInt(req.params.id), emisorTipo: 'SOCIO', leido: false },
    data: { leido: true, fechaLeido: new Date() }
  })
  await req.db.conversacion.update({
    where: { id: parseInt(req.params.id) },
    data: { mensajesNoLeidos: 0 }
  })

  res.json({ success: true, data: { conversacion, mensajes } })
}))

// POST /api/admin/chat/conversaciones/:id/mensajes — entrenador responde
router.post('/conversaciones/:id/mensajes', authAdmin, asyncHandler(async (req, res) => {
  const { contenido } = req.body
  const convId = parseInt(req.params.id)

  if (!contenido?.trim()) throw new AppError('El contenido no puede estar vacío', 400)

  const conversacion = await req.db.conversacion.findUnique({
    where: { id: convId },
    include: { entrenador: true, socio: true }
  })
  if (!conversacion) throw new AppError('Conversación no encontrada', 404, 'NOT_FOUND')

  const mensaje = await req.db.mensaje.create({
    data: {
      conversacionId: convId,
      emisorTipo: 'ENTRENADOR',
      emisorId: conversacion.entrenadorId,
      contenido: contenido.trim(),
      tenantId: req.tenantId
    }
  })

  await req.db.conversacion.update({
    where: { id: convId },
    data: { ultimoMensaje: new Date() }
  })

  // Emitir al portal del socio vía Socket.io namespace /socio
  try {
    const ioInstance = getIO()
    ioInstance.of('/socio').to(`socio:${conversacion.socio.tokenPortal}`).emit('nuevo:mensaje', {
      conversacionId: convId,
      mensaje: {
        id: mensaje.id,
        contenido: mensaje.contenido,
        emisorTipo: 'ENTRENADOR',
        esPropio: false,
        createdAt: mensaje.createdAt
      }
    })
  } catch (e) {
    console.warn('[Chat] Socket emit al socio falló:', e.message)
  }

  res.status(201).json({ success: true, data: { ...mensaje, esPropio: true } })
}))

// POST /api/admin/chat/broadcast — mensaje a todos los socios de una categoría
router.post('/broadcast', authAdmin, asyncHandler(async (req, res) => {
  const { entrenadorId, categoriaActividadId, contenido } = req.body

  if (!entrenadorId || !contenido?.trim()) {
    throw new AppError('entrenadorId y contenido son requeridos', 400)
  }

  // Buscar socios inscriptos en la categoría
  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : undefined,
      estado: 'ACTIVA'
    },
    select: { socioId: true }
  })

  const socioIds = [...new Set(inscripciones.map(i => i.socioId))]
  if (socioIds.length === 0) throw new AppError('No hay socios inscriptos en esa categoría', 400)

  const entrenadorIdInt = parseInt(entrenadorId)
  const catIdInt = categoriaActividadId ? parseInt(categoriaActividadId) : null

  let enviados = 0
  const ioInstance = getIO()

  for (const socioId of socioIds) {
    // Obtener o crear conversación
    let conv = await req.db.conversacion.findFirst({
      where: { socioId, entrenadorId: entrenadorIdInt, categoriaActividadId: catIdInt }
    })

    if (!conv) {
      conv = await req.db.conversacion.create({
        data: {
          socioId,
          entrenadorId: entrenadorIdInt,
          categoriaActividadId: catIdInt,
          estado: 'ACTIVA',
          tenantId: req.tenantId
        }
      })
    }

    const mensaje = await req.db.mensaje.create({
      data: {
        conversacionId: conv.id,
        emisorTipo: 'ENTRENADOR',
        emisorId: entrenadorIdInt,
        contenido: contenido.trim(),
        tenantId: req.tenantId
      }
    })

    await req.db.conversacion.update({
      where: { id: conv.id },
      data: { ultimoMensaje: new Date(), mensajesNoLeidos: { increment: 1 } }
    })

    // Notificar al socio
    const socio = await req.db.socio.findUnique({ where: { id: socioId }, select: { tokenPortal: true } })
    if (socio?.tokenPortal) {
      try {
        ioInstance.of('/socio').to(`socio:${socio.tokenPortal}`).emit('nuevo:mensaje', {
          conversacionId: conv.id,
          mensaje: {
            id: mensaje.id,
            contenido: mensaje.contenido,
            emisorTipo: 'ENTRENADOR',
            esPropio: false,
            createdAt: mensaje.createdAt
          }
        })
      } catch (e) {}
    }

    enviados++
  }

  res.json({
    success: true,
    data: { enviados },
    message: `Mensaje enviado a ${enviados} socios`
  })
}))

// GET /api/admin/chat/entrenadores — lista de entrenadores activos
router.get('/entrenadores', authAdmin, asyncHandler(async (req, res) => {
  const entrenadores = await req.db.entrenador.findMany({
    where: { activo: true },
    include: {
      categorias: {
        where: { activo: true },
        include: {
          categoriaActividad: {
            select: { id: true, nombre: true, actividad: { select: { nombre: true } } }
          }
        }
      }
    },
    orderBy: [{ nombre: 'asc' }]
  })
  res.json({ success: true, data: entrenadores })
}))

export default router
