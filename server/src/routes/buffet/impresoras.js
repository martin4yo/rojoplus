/**
 * Rutas de Sectores e Impresoras del Buffet
 * - CRUD de sectores (cocina, barra, etc)
 * - CRUD de impresoras térmicas
 * - Configuración de destinos de impresión
 * - Gestión de puestos de impresión (print-agents)
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'
import { getIO } from '../../services/socketService.js'

const router = express.Router()

// Almacén temporal de puestos conectados y sus impresoras detectadas
const puestosConectados = new Map() // puestoId -> { socketId, impresoras, ultimaConexion }

// ============================================================================
// SECTORES DE BUFFET
// ============================================================================

/**
 * GET /sectores
 * Listar sectores
 */
router.get('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const sectores = await req.db.sectorBuffet.findMany({
      orderBy: { orden: 'asc' },
      include: { impresoras: true }
    })
    res.json({ success: true, data: sectores })
  } catch (error) {
    console.error('Error al listar sectores:', error)
    res.status(500).json({ success: false, error: 'Error al listar sectores' })
  }
})

/**
 * GET /sectores/activos
 * Listar sectores activos (para KDS)
 */
router.get('/sectores/activos', authAdmin, checkPermiso('BUFFET_VER'), async (req, res) => {
  try {
    const sectores = await req.db.sectorBuffet.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        impresoras: {
          where: { activo: true }
        }
      }
    })
    res.json({ success: true, data: sectores })
  } catch (error) {
    console.error('Error al listar sectores activos:', error)
    res.status(500).json({ success: false, error: 'Error al listar sectores' })
  }
})

/**
 * POST /sectores
 * Crear sector
 */
router.post('/sectores', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { codigo, nombre, icono, color, orden } = req.body

    const sector = await req.db.sectorBuffet.create({
      data: { codigo: codigo.toUpperCase(), nombre, icono, color, orden: orden || 0 }
    })

    res.status(201).json({ success: true, data: sector })
  } catch (error) {
    console.error('Error al crear sector:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Ya existe un sector con ese código' })
    }
    res.status(500).json({ success: false, error: 'Error al crear sector' })
  }
})

/**
 * PUT /sectores/:id
 * Actualizar sector
 */
router.put('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { codigo, nombre, icono, color, orden, activo } = req.body

    const sector = await req.db.sectorBuffet.update({
      where: { id: parseInt(id) },
      data: { codigo: codigo?.toUpperCase(), nombre, icono, color, orden, activo }
    })

    res.json({ success: true, data: sector })
  } catch (error) {
    console.error('Error al actualizar sector:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar sector' })
  }
})

/**
 * DELETE /sectores/:id
 * Eliminar sector
 */
router.delete('/sectores/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const impresoras = await req.db.impresoraTermica.count({ where: { sectorId: parseInt(id) } })
    if (impresoras > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar un sector con impresoras asociadas' })
    }

    await req.db.sectorBuffet.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Sector eliminado' })
  } catch (error) {
    console.error('Error al eliminar sector:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar sector' })
  }
})

// ============================================================================
// IMPRESORAS TÉRMICAS
// ============================================================================

/**
 * GET /impresoras
 * Listar impresoras
 */
router.get('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const impresoras = await req.db.impresoraTermica.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        sector: true,
        destinosImpresion: { include: { categoriaMenu: true } }
      }
    })

    res.json({ success: true, data: impresoras })
  } catch (error) {
    console.error('Error al listar impresoras:', error)
    res.status(500).json({ success: false, error: 'Error al listar impresoras' })
  }
})

/**
 * POST /impresoras
 * Crear impresora
 */
router.post('/impresoras', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { nombre, sectorId, tipoConexion, ip, puerto, destino, puestoId } = req.body

    // Validaciones según tipo de conexión
    if (tipoConexion === 'IP' && !ip) {
      return res.status(400).json({ success: false, error: 'IP requerida para conexión de red' })
    }
    if ((tipoConexion === 'USB' || tipoConexion === 'CUPS') && !destino) {
      return res.status(400).json({ success: false, error: 'Destino requerido para USB/CUPS' })
    }
    if ((tipoConexion === 'USB' || tipoConexion === 'CUPS') && !puestoId) {
      return res.status(400).json({ success: false, error: 'Debe seleccionar un puesto para USB/CUPS' })
    }

    const impresora = await req.db.impresoraTermica.create({
      data: {
        nombre,
        sectorId: sectorId ? parseInt(sectorId) : null,
        tipoConexion: tipoConexion || 'IP',
        ip: tipoConexion === 'IP' ? ip : null,
        puerto: tipoConexion === 'IP' ? (puerto || 9100) : 9100,
        destino: tipoConexion !== 'IP' ? destino : null,
        puestoId: tipoConexion !== 'IP' ? puestoId : null
      },
      include: { sector: true }
    })

    res.status(201).json({ success: true, data: impresora })
  } catch (error) {
    console.error('Error al crear impresora:', error)
    res.status(500).json({ success: false, error: 'Error al crear impresora' })
  }
})

/**
 * PUT /impresoras/:id
 * Actualizar impresora
 */
router.put('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, sectorId, tipoConexion, ip, puerto, destino, puestoId, activo, imprimirComanda } = req.body

    const impresora = await req.db.impresoraTermica.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        sectorId: sectorId !== undefined ? (sectorId ? parseInt(sectorId) : null) : undefined,
        tipoConexion,
        ip,
        puerto,
        destino,
        puestoId,
        activo,
        imprimirComanda: imprimirComanda !== undefined ? imprimirComanda : undefined
      },
      include: { sector: true }
    })

    res.json({ success: true, data: impresora })
  } catch (error) {
    console.error('Error al actualizar impresora:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar impresora' })
  }
})

/**
 * DELETE /impresoras/:id
 * Eliminar impresora
 */
router.delete('/impresoras/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await req.db.impresoraTermica.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Impresora eliminada' })
  } catch (error) {
    console.error('Error al eliminar impresora:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar impresora' })
  }
})

/**
 * POST /impresoras/:id/test
 * Test de conexión a impresora
 */
router.post('/impresoras/:id/test', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const impresora = await req.db.impresoraTermica.findUnique({ where: { id: parseInt(id) } })
    if (!impresora) {
      return res.status(404).json({ success: false, error: 'Impresora no encontrada' })
    }

    if (!impresora.activo) {
      return res.status(400).json({ success: false, error: 'Impresora inactiva' })
    }

    // Generar ticket de prueba simple (ESC/POS básico)
    const testData = Buffer.from([
      0x1B, 0x40,              // Inicializar impresora
      0x1B, 0x61, 0x01,        // Centrar texto
      ...Buffer.from('TEST DE IMPRESION\n'),
      ...Buffer.from('Clubix Print Agent\n'),
      ...Buffer.from('===================\n'),
      0x1B, 0x61, 0x00,        // Alinear a la izquierda
      ...Buffer.from(`Impresora: ${impresora.nombre}\n`),
      ...Buffer.from(`Tipo: ${impresora.tipoConexion}\n`),
      ...Buffer.from(`Fecha: ${new Date().toLocaleString()}\n`),
      0x1B, 0x64, 0x03,        // Feed 3 líneas
      0x1D, 0x56, 0x41, 0x00   // Cortar papel
    ])

    const testDataBase64 = testData.toString('base64')

    // Enviar a la impresora
    const resultado = await enviarImpresion(parseInt(id), testDataBase64, 'TEST')

    if (resultado.success) {
      res.json({ success: true, message: 'Test de impresión enviado. Verifica la impresora.' })
    } else {
      res.status(400).json({ success: false, error: resultado.error })
    }
  } catch (error) {
    console.error('Error en test de impresora:', error)
    res.status(500).json({ success: false, error: 'Error en test de conexión' })
  }
})

/**
 * GET /impresoras-tickets
 * Obtiene las impresoras configuradas para tickets (mesas, kiosco, takeaway)
 * Para uso en selector de impresora al imprimir
 */
router.get('/impresoras-tickets', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    // Obtener configuración de impresoras
    const configs = await req.db.configuracion.findMany({
      where: {
        clave: {
          in: ['BUFFET_IMPRESORA_TICKETS', 'BUFFET_IMPRESORA_KIOSCO', 'BUFFET_IMPRESORA_TAKEAWAY']
        }
      }
    })

    const configMap = {}
    configs.forEach(c => {
      configMap[c.clave] = c.valor ? parseInt(c.valor) : null
    })

    // Obtener IDs de impresoras configuradas
    const impresoraIds = [
      configMap['BUFFET_IMPRESORA_TICKETS'],
      configMap['BUFFET_IMPRESORA_KIOSCO'],
      configMap['BUFFET_IMPRESORA_TAKEAWAY']
    ].filter(id => id !== null)

    // Si no hay ninguna configurada, devolver todas las activas
    let impresoras
    if (impresoraIds.length === 0) {
      impresoras = await req.db.impresoraTermica.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
      })
    } else {
      impresoras = await req.db.impresoraTermica.findMany({
        where: {
          id: { in: impresoraIds },
          activo: true
        },
        orderBy: { nombre: 'asc' }
      })
    }

    // Agregar etiqueta descriptiva a cada impresora
    const impresorasConEtiqueta = impresoras.map(imp => {
      const etiquetas = []
      if (configMap['BUFFET_IMPRESORA_TICKETS'] === imp.id) etiquetas.push('Mesas')
      if (configMap['BUFFET_IMPRESORA_KIOSCO'] === imp.id) etiquetas.push('Kiosco')
      if (configMap['BUFFET_IMPRESORA_TAKEAWAY'] === imp.id) etiquetas.push('Pedidos')

      return {
        id: imp.id,
        nombre: imp.nombre,
        etiqueta: etiquetas.length > 0 ? etiquetas.join(', ') : null,
        tipoConexion: imp.tipoConexion
      }
    })

    res.json({ success: true, data: impresorasConEtiqueta })
  } catch (error) {
    console.error('Error obteniendo impresoras de tickets:', error)
    res.status(500).json({ success: false, error: 'Error al obtener impresoras' })
  }
})

/**
 * POST /imprimir-imagen
 * Imprimir una imagen PNG/JPEG como bitmap en impresora térmica
 * Recibe imagen en base64 y la envía al print-agent para procesamiento
 */
router.post('/imprimir-imagen', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { imagen, impresoraId } = req.body

    if (!imagen) {
      return res.status(400).json({ success: false, error: 'Imagen requerida' })
    }

    // Obtener impresora por defecto o la especificada
    let impresora
    if (impresoraId) {
      impresora = await req.db.impresoraTermica.findUnique({
        where: { id: parseInt(impresoraId) }
      })
    } else {
      // Buscar impresora por defecto (la primera activa)
      impresora = await req.db.impresoraTermica.findFirst({
        where: { activo: true },
        orderBy: { id: 'asc' }
      })
    }

    if (!impresora) {
      return res.status(400).json({ success: false, error: 'No hay impresora configurada' })
    }

    const io = getIO()
    const trabajo = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tipo: 'IMAGEN',
      tipoConexion: impresora.tipoConexion,
      destino: impresora.tipoConexion === 'IP'
        ? `${impresora.ip}:${impresora.puerto}`
        : impresora.destino,
      imagen: imagen, // Imagen en base64 (data:image/png;base64,...)
      timestamp: new Date().toISOString()
    }

    if (impresora.tipoConexion === 'IP') {
      io.to('print-agents').emit('imprimir-imagen', trabajo)
      console.log(`[Print] Imagen ${trabajo.id} enviada a print-agents (IP: ${impresora.ip})`)
    } else {
      if (!impresora.puestoId) {
        return res.status(400).json({ success: false, error: 'Impresora sin puesto asignado' })
      }
      io.to(`puesto:${impresora.puestoId}`).emit('imprimir-imagen', trabajo)
      console.log(`[Print] Imagen ${trabajo.id} enviada a puesto:${impresora.puestoId}`)
    }

    res.json({ success: true, trabajoId: trabajo.id, impresora: impresora.nombre })
  } catch (error) {
    console.error('Error enviando imagen a imprimir:', error)
    res.status(500).json({ success: false, error: 'Error al enviar imagen' })
  }
})

// ============================================================================
// DESTINOS DE IMPRESIÓN
// ============================================================================

/**
 * GET /destinos-impresion
 * Listar destinos de impresión
 */
router.get('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const destinos = await req.db.destinoImpresion.findMany({
      include: {
        categoriaMenu: true,
        impresora: true
      }
    })

    res.json({ success: true, data: destinos })
  } catch (error) {
    console.error('Error al listar destinos:', error)
    res.status(500).json({ success: false, error: 'Error al listar destinos' })
  }
})

/**
 * POST /destinos-impresion
 * Crear/Actualizar destino de impresión
 */
router.post('/destinos-impresion', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { categoriaMenuId, impresoraId } = req.body

    const destino = await req.db.destinoImpresion.upsert({
      where: {
        categoriaMenuId_impresoraId: { categoriaMenuId, impresoraId }
      },
      update: {},
      create: { categoriaMenuId, impresoraId }
    })

    res.json({ success: true, data: destino })
  } catch (error) {
    console.error('Error al crear destino:', error)
    res.status(500).json({ success: false, error: 'Error al crear destino' })
  }
})

/**
 * DELETE /destinos-impresion/:id
 * Eliminar destino de impresión
 */
router.delete('/destinos-impresion/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await req.db.destinoImpresion.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Destino eliminado' })
  } catch (error) {
    console.error('Error al eliminar destino:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar destino' })
  }
})

// ============================================================================
// PUESTOS DE IMPRESIÓN (PRINT-AGENTS)
// ============================================================================

/**
 * GET /puestos
 * Listar puestos conectados con sus impresoras detectadas
 */
router.get('/puestos', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const puestos = []
    const ahora = Date.now()

    for (const [puestoId, datos] of puestosConectados.entries()) {
      // Considerar desconectado si no reportó en los últimos 30 segundos
      const conectado = (ahora - datos.ultimaConexion) < 30000
      puestos.push({
        puestoId,
        nombre: datos.nombre || puestoId,
        conectado,
        impresoras: datos.impresoras || [],
        ultimaConexion: new Date(datos.ultimaConexion)
      })
    }

    res.json({ success: true, data: puestos })
  } catch (error) {
    console.error('Error al listar puestos:', error)
    res.status(500).json({ success: false, error: 'Error al listar puestos' })
  }
})

/**
 * POST /puestos/registrar
 * Registrar un puesto de impresión (llamado desde print-agent)
 * No requiere autenticación admin, usa token de puesto
 */
router.post('/puestos/registrar', async (req, res) => {
  try {
    const { puestoId, nombre, impresoras, token } = req.body

    // Validar token de puesto (simple para no complicar)
    const tokenEsperado = process.env.PRINT_AGENT_TOKEN || 'rojoplus-print-agent'
    if (token !== tokenEsperado) {
      return res.status(401).json({ success: false, error: 'Token inválido' })
    }

    if (!puestoId) {
      return res.status(400).json({ success: false, error: 'puestoId requerido' })
    }

    // Registrar o actualizar puesto
    puestosConectados.set(puestoId, {
      nombre: nombre || puestoId,
      impresoras: impresoras || [],
      ultimaConexion: Date.now()
    })

    console.log(`[PrintAgent] Puesto registrado: ${puestoId} con ${impresoras?.length || 0} impresoras`)

    res.json({ success: true, message: 'Puesto registrado' })
  } catch (error) {
    console.error('Error al registrar puesto:', error)
    res.status(500).json({ success: false, error: 'Error al registrar puesto' })
  }
})

/**
 * POST /puestos/heartbeat
 * Heartbeat de puesto (mantener conexión activa)
 */
router.post('/puestos/heartbeat', async (req, res) => {
  try {
    const { puestoId, token } = req.body

    const tokenEsperado = process.env.PRINT_AGENT_TOKEN || 'rojoplus-print-agent'
    if (token !== tokenEsperado) {
      return res.status(401).json({ success: false, error: 'Token inválido' })
    }

    if (puestosConectados.has(puestoId)) {
      const datos = puestosConectados.get(puestoId)
      datos.ultimaConexion = Date.now()
      puestosConectados.set(puestoId, datos)
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error en heartbeat' })
  }
})

/**
 * POST /imprimir-ticket-directo
 * Envía un ticket pre-generado (base64) directamente a la impresora
 * Usado cuando el backend ya generó el ticket completo con QR
 */
router.post('/imprimir-ticket-directo', authAdmin, checkPermiso('BUFFET_COBRAR', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { ticketBase64, tipoTicket } = req.body

    if (!ticketBase64) {
      return res.status(400).json({ success: false, error: 'Ticket requerido' })
    }

    // Buscar impresora según configuración
    let impresora = null
    let configKey = 'BUFFET_IMPRESORA_TICKETS'
    if (tipoTicket === 'KIOSCO') {
      configKey = 'BUFFET_IMPRESORA_KIOSCO'
    } else if (tipoTicket === 'TAKEAWAY') {
      configKey = 'BUFFET_IMPRESORA_TAKEAWAY'
    }

    const config = await req.db.configuracion.findFirst({
      where: { clave: configKey }
    })

    if (config?.valor) {
      impresora = await req.db.impresoraTermica.findUnique({
        where: { id: parseInt(config.valor) }
      })
    }

    // Fallback: buscar impresora por sector
    if (!impresora) {
      impresora = await req.db.impresoraTermica.findFirst({
        where: {
          activo: true,
          OR: [
            { sector: { codigo: 'CAJA' } },
            { sector: { codigo: 'TICKET' } },
            { sectorId: null }
          ]
        }
      })
    }

    if (!impresora) {
      return res.status(400).json({
        success: false,
        error: 'No hay impresora de tickets configurada'
      })
    }

    // Enviar directamente a la impresora
    const resultado = await enviarImpresion(impresora.id, ticketBase64, tipoTicket || 'FISCAL')

    if (resultado.success) {
      res.json({
        success: true,
        message: 'Ticket enviado a impresora',
        impresora: impresora.nombre,
        trabajoId: resultado.trabajoId
      })
    } else {
      res.status(400).json({ success: false, error: resultado.error })
    }
  } catch (error) {
    console.error('Error imprimiendo ticket directo:', error)
    res.status(500).json({ success: false, error: 'Error al imprimir ticket' })
  }
})

// ============================================================================
// FUNCIONES DE IMPRESIÓN
// ============================================================================

/**
 * Enviar trabajo de impresión a una impresora
 * @param {number} impresoraId - ID de la impresora
 * @param {string} datosBase64 - Datos ESC/POS en base64
 * @param {string} tipo - Tipo de ticket (COMANDA, CUENTA, FISCAL)
 */
export async function enviarImpresion(impresoraId, datosBase64, tipo = 'TICKET') {
  try {
    const impresora = await prisma.impresoraTermica.findUnique({
      where: { id: impresoraId },
      include: { sector: true }
    })

    if (!impresora || !impresora.activo) {
      console.log(`[Print] Impresora ${impresoraId} no encontrada o inactiva`)
      return { success: false, error: 'Impresora no disponible' }
    }

    const io = getIO()
    const trabajo = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tipo,
      tipoConexion: impresora.tipoConexion,
      destino: impresora.tipoConexion === 'IP'
        ? `${impresora.ip}:${impresora.puerto}`
        : impresora.destino,
      datos: datosBase64,
      timestamp: new Date().toISOString()
    }

    if (impresora.tipoConexion === 'IP') {
      // Para IP, emitir a todos los puestos (cualquiera puede imprimir)
      io.to('print-agents').emit('imprimir', trabajo)
      console.log(`[Print] Trabajo ${trabajo.id} enviado a print-agents (IP: ${impresora.ip})`)
    } else {
      // Para USB/CUPS, emitir solo al puesto específico
      if (!impresora.puestoId) {
        return { success: false, error: 'Impresora sin puesto asignado' }
      }
      io.to(`puesto:${impresora.puestoId}`).emit('imprimir', trabajo)
      console.log(`[Print] Trabajo ${trabajo.id} enviado a puesto:${impresora.puestoId}`)
    }

    return { success: true, trabajoId: trabajo.id }
  } catch (error) {
    console.error('[Print] Error enviando impresión:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Registrar eventos de Socket.io para print-agents
 * Llamar desde socketService después de inicializar io
 */
export function registrarEventosPrintAgent(io) {
  io.on('connection', (socket) => {
    // Evento para que un print-agent se registre
    socket.on('print-agent:registrar', (data) => {
      const { puestoId, nombre, impresoras, token } = data

      const tokenEsperado = process.env.PRINT_AGENT_TOKEN || 'rojoplus-print-agent'
      if (token !== tokenEsperado) {
        socket.emit('print-agent:error', { error: 'Token inválido' })
        return
      }

      // Unir a salas
      socket.join('print-agents')
      socket.join(`puesto:${puestoId}`)

      // Registrar puesto
      puestosConectados.set(puestoId, {
        socketId: socket.id,
        nombre: nombre || puestoId,
        impresoras: impresoras || [],
        ultimaConexion: Date.now()
      })

      console.log(`[PrintAgent] Conectado via Socket: ${puestoId}`)
      socket.emit('print-agent:registrado', { success: true })
    })

    // Evento de confirmación de impresión
    socket.on('print-agent:impreso', (data) => {
      const { trabajoId, success, error } = data
      console.log(`[PrintAgent] Trabajo ${trabajoId}: ${success ? 'OK' : error}`)
    })

    // Actualizar impresoras detectadas
    socket.on('print-agent:impresoras', (data) => {
      const { puestoId, impresoras } = data
      if (puestosConectados.has(puestoId)) {
        const datos = puestosConectados.get(puestoId)
        datos.impresoras = impresoras
        datos.ultimaConexion = Date.now()
        puestosConectados.set(puestoId, datos)
      }
    })
  })
}

export { puestosConectados }
export default router
