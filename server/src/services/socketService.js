import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
let io = null

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
    const admin = socket.admin
    console.log(`[Socket] Conectado: ${admin.nombre} (ID: ${admin.id})`)

    // Unir a sala personal
    socket.join(`user:${admin.id}`)

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

  console.log('[Socket.io] Inicializado')
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
  paraDestino = null // COCINA, BARRA, CAJA
}) {
  try {
    const config = TIPOS_NOTIFICACION[tipo] || { sonido: 'default', titulo: tipo }

    // Guardar en BD
    const notificacion = await prisma.notificacionBuffet.create({
      data: {
        tipo,
        titulo: config.titulo,
        mensaje,
        datos,
        sonido: config.sonido,
        paraUsuarioId,
        paraDestino
      }
    })

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
        paraDestino: destino
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
      paraUsuarioId: mozoId
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
      paraDestino: 'CAJA'
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
      paraUsuarioId: mozoId
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
