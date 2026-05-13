import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
let io = null

// Importar registro de eventos de print-agent
let registrarEventosPrintAgent = null
import('./socketService.js').then(() => {
  // Importación dinámica para evitar dependencia circular
  import('../routes/buffet/impresoras.js').then(mod => {
    registrarEventosPrintAgent = mod.registrarEventosPrintAgent
    if (io && registrarEventosPrintAgent) {
      registrarEventosPrintAgent(io)
    }
  }).catch(() => {
    console.log('[Socket] Print-agent module not loaded')
  })
})

// Inicializar Socket.io
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  // Middleware de autenticación
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      const isPrintAgent = socket.handshake.auth.isPrintAgent

      // Permitir conexiones de print-agent sin token JWT
      if (isPrintAgent) {
        socket.isPrintAgent = true
        return next()
      }

      if (!token) {
        return next(new Error('Token requerido'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        include: {
          rol: {
            include: {
              permisos: {
                include: { permiso: true }
              }
            }
          }
        }
      })

      if (!admin || !admin.activo) {
        return next(new Error('Usuario no válido'))
      }

      // Extraer códigos de permisos
      const permisos = admin.rol?.permisos?.map(p => p.permiso.codigo) || []
      socket.admin = { ...admin, permisos }
      next()
    } catch (err) {
      console.error('Socket auth error:', err.message)
      next(new Error('Token inválido'))
    }
  })

  // Conexión de cliente
  io.on('connection', (socket) => {
    // Si es print-agent, no hacer nada aquí (lo maneja registrarEventosPrintAgent)
    if (socket.isPrintAgent) {
      console.log('[Socket] Print-agent conectado (esperando registro)')
      return
    }

    const admin = socket.admin
    console.log(`[Socket] Conectado: ${admin.nombre} (ID: ${admin.id})`)

    // Unir a sala personal
    socket.join(`user:${admin.id}`)

    // Unir a sala del tenant para notificaciones globales (ej: respuestas de recupero)
    if (admin.tenantId) {
      socket.join(`tenant:${admin.tenantId}`)
    }

    // Unir a salas según permisos
    const permisos = admin.permisos || []

    if (permisos.includes('BUFFET_COCINA')) {
      socket.join('destino:COCINA')
      console.log(`[Socket] ${admin.nombre} unido a destino:COCINA`)
    }

    if (permisos.includes('BUFFET_BARRA')) {
      socket.join('destino:BARRA')
      console.log(`[Socket] ${admin.nombre} unido a destino:BARRA`)
    }

    if (permisos.includes('BUFFET_COBRAR')) {
      socket.join('destino:CAJA')
      console.log(`[Socket] ${admin.nombre} unido a destino:CAJA`)
    }

    // Unir a sala general del buffet si tiene algún permiso
    if (permisos.some(p => p.startsWith('BUFFET_'))) {
      socket.join('buffet')
    }

    // Tienda: cualquier admin con permiso TIENDA_* o esSuperAdmin se une
    if (admin.esSuperAdmin || permisos.some(p => p.startsWith('TIENDA_'))) {
      socket.join('destino:TIENDA')
      console.log(`[Socket] ${admin.nombre} unido a destino:TIENDA`)
    }

    // Manejar desconexión
    socket.on('disconnect', () => {
      console.log(`[Socket] Desconectado: ${admin.nombre}`)
    })

    // Evento para marcar notificación como vista
    socket.on('notificacion:vista', async (notificacionId) => {
      try {
        await prisma.notificacionVista.upsert({
          where: {
            notificacionId_adminId: {
              notificacionId: parseInt(notificacionId),
              adminId: admin.id
            }
          },
          create: {
            notificacionId: parseInt(notificacionId),
            adminId: admin.id
          },
          update: {}
        })
      } catch (err) {
        console.error('Error marcando notificación vista:', err)
      }
    })
  })

  // Registrar eventos de print-agent si el módulo está cargado
  if (registrarEventosPrintAgent) {
    registrarEventosPrintAgent(io)
  }

  // ── Namespace /socio para portal del socio ──
  const socioNS = io.of('/socio')

  socioNS.use(async (socket, next) => {
    try {
      const tokenPortal = socket.handshake.auth.tokenPortal
      if (!tokenPortal) return next(new Error('tokenPortal requerido'))

      // Resolución lazy del tenant: buscar el socio en cualquier tenant
      const socio = await prisma.socio.findFirst({
        where: { tokenPortal },
        select: { id: true, apellidoNombre: true, tokenPortal: true }
      })

      if (!socio) return next(new Error('Token inválido'))
      socket.socio = socio
      next()
    } catch (err) {
      next(new Error('Error de autenticación'))
    }
  })

  socioNS.on('connection', (socket) => {
    const socio = socket.socio
    socket.join(`socio:${socio.tokenPortal}`)
    console.log(`[Socket/socio] ${socio.apellidoNombre} conectado`)

    socket.on('disconnect', () => {
      console.log(`[Socket/socio] ${socio.apellidoNombre} desconectado`)
    })
  })

  console.log('[Socket.io] Inicializado (+ namespace /socio)')
  return io
}

// Obtener instancia de io
export function getIO() {
  if (!io) {
    throw new Error('Socket.io no inicializado')
  }
  return io
}

// Tipos de notificación con sus sonidos
const TIPOS_NOTIFICACION = {
  NUEVA_COMANDA: { sonido: 'bell', titulo: 'Nueva comanda' },
  ITEM_LISTO: { sonido: 'chime', titulo: 'Pedido listo' },
  CUENTA_PEDIDA: { sonido: 'alert', titulo: 'Cuenta pedida' },
  MESA_COBRADA: { sonido: 'default', titulo: 'Mesa cobrada' }
}

// Crear y emitir notificación
export async function emitirNotificacion({
  tipo,
  mensaje,
  datos = {},
  paraUsuarioId = null,
  paraDestino = null, // COCINA, BARRA, CAJA
  tenantId = null,
}) {
  try {
    const config = TIPOS_NOTIFICACION[tipo] || { sonido: 'default', titulo: tipo }

    if (!tenantId) {
      console.warn(`[Notif] emitirNotificacion sin tenantId — no se persiste (tipo=${tipo}, mensaje=${mensaje})`)
    }

    // Guardar en BD (sólo si tenemos tenantId)
    const notificacion = tenantId
      ? await prisma.notificacionBuffet.create({
          data: {
            tenantId,
            tipo,
            titulo: config.titulo,
            mensaje,
            datos,
            sonido: config.sonido,
            paraUsuarioId,
            paraDestino,
          },
        })
      : {
          id: null,
          tipo,
          titulo: config.titulo,
          mensaje,
          datos,
          sonido: config.sonido,
          createdAt: new Date(),
        }

    // Emitir por socket
    const payload = {
      id: notificacion.id,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      datos: notificacion.datos,
      sonido: notificacion.sonido,
      createdAt: notificacion.createdAt
    }

    if (io) {
      if (paraUsuarioId) {
        // A usuario específico
        io.to(`user:${paraUsuarioId}`).emit('notificacion', payload)
        console.log(`[Notif] → user:${paraUsuarioId}: ${mensaje}`)
      } else if (paraDestino) {
        // A destino (COCINA, BARRA, CAJA)
        io.to(`destino:${paraDestino}`).emit('notificacion', payload)
        console.log(`[Notif] → destino:${paraDestino}: ${mensaje}`)
      } else {
        // A todos los del buffet
        io.to('buffet').emit('notificacion', payload)
        console.log(`[Notif] → buffet: ${mensaje}`)
      }
    }

    return notificacion
  } catch (err) {
    console.error('Error emitiendo notificación:', err)
    throw err
  }
}

// Notificar nueva comanda a cocina/barra según categorías
export async function notificarNuevaComanda(comanda, items) {
  try {
    // Agrupar items por destino de impresión
    const itemsPorDestino = {}

    for (const item of items) {
      // Buscar el destino de impresión de la categoría
      const producto = await prisma.productoBuffet.findUnique({
        where: { id: item.productoBuffetId },
        include: {
          categoriaMenu: {
            include: {
              destinosImpresion: {
                include: { impresora: true }
              }
            }
          }
        }
      })

      if (producto?.categoriaMenu?.destinosImpresion) {
        for (const destino of producto.categoriaMenu.destinosImpresion) {
          const tipoImpresora = destino.impresora.tipo // COCINA, BARRA, CAJA
          if (!itemsPorDestino[tipoImpresora]) {
            itemsPorDestino[tipoImpresora] = []
          }
          itemsPorDestino[tipoImpresora].push({
            cantidad: item.cantidad,
            nombre: producto.nombre,
            observaciones: item.observaciones
          })
        }
      }
    }

    // Emitir notificación a cada destino
    for (const [destino, itemsDestino] of Object.entries(itemsPorDestino)) {
      const itemsTexto = itemsDestino.map(i =>
        `${i.cantidad}x ${i.nombre}${i.observaciones ? ` (${i.observaciones})` : ''}`
      ).join(', ')

      await emitirNotificacion({
        tipo: 'NUEVA_COMANDA',
        mensaje: `Mesa ${comanda.mesa?.numero || '?'}: ${itemsTexto}`,
        datos: {
          mesaId: comanda.mesaId,
          comandaId: comanda.id,
          mesaNumero: comanda.mesa?.numero,
          items: itemsDestino
        },
        paraDestino: destino,
        tenantId: comanda.tenantId || comanda.mesa?.tenantId || null,
      })
    }
  } catch (err) {
    console.error('Error notificando nueva comanda:', err)
  }
}

// Notificar item listo al mozo que cargó la comanda
export async function notificarItemListo(item, comanda) {
  try {
    // El mozo que atiende es el que cargó la comanda
    const mozoId = comanda.atendidoPorId

    if (!mozoId) {
      console.log('[Notif] No hay mozo asignado a la comanda')
      return
    }

    await emitirNotificacion({
      tipo: 'ITEM_LISTO',
      mensaje: `Mesa ${comanda.mesa?.numero}: ${item.productoBuffet?.nombre} listo para servir`,
      datos: {
        mesaId: comanda.mesaId,
        comandaId: comanda.id,
        itemId: item.id,
        mesaNumero: comanda.mesa?.numero,
        itemNombre: item.productoBuffet?.nombre
      },
      paraUsuarioId: mozoId,
      tenantId: comanda.tenantId || comanda.mesa?.tenantId || null,
    })
  } catch (err) {
    console.error('Error notificando item listo:', err)
  }
}

// Notificar cuenta pedida al cajero
export async function notificarCuentaPedida(comanda) {
  try {
    await emitirNotificacion({
      tipo: 'CUENTA_PEDIDA',
      mensaje: `Mesa ${comanda.mesa?.numero} pidió la cuenta - $${Number(comanda.total).toLocaleString()}`,
      datos: {
        mesaId: comanda.mesaId,
        comandaId: comanda.id,
        mesaNumero: comanda.mesa?.numero,
        total: comanda.total
      },
      paraDestino: 'CAJA',
      tenantId: comanda.tenantId || comanda.mesa?.tenantId || null,
    })
  } catch (err) {
    console.error('Error notificando cuenta pedida:', err)
  }
}

// Notificar mesa cobrada al mozo asignado
export async function notificarMesaCobrada(mesa, comanda) {
  try {
    const mozoId = mesa.mozoAsignadoId || comanda?.atendidoPorId

    if (!mozoId) {
      console.log('[Notif] No hay mozo asignado a la mesa')
      return
    }

    await emitirNotificacion({
      tipo: 'MESA_COBRADA',
      mensaje: `Mesa ${mesa.numero} cobrada - Lista para limpiar`,
      datos: {
        mesaId: mesa.id,
        mesaNumero: mesa.numero
      },
      paraUsuarioId: mozoId,
      tenantId: mesa.tenantId || comanda?.tenantId || null,
    })
  } catch (err) {
    console.error('Error notificando mesa cobrada:', err)
  }
}

export default {
  initSocket,
  getIO,
  emitirNotificacion,
  notificarNuevaComanda,
  notificarItemListo,
  notificarCuentaPedida,
  notificarMesaCobrada
}
