import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { v4 as uuidv4 } from 'uuid'
import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import { enviarEmail } from '../services/email.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { generarAsientoAutomatico } from './asientos.js'
import { resolverCuentaCashId } from '../services/asientosContables.js'
import { crearPreferenciaPago } from '../services/mercadopago.js'
import { getMpAccessToken } from '../lib/mercadoPagoConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// import mercadopago from 'mercadopago' // TODO: FASE 2.5 - Implementar SDK v2

const router = express.Router()

// ============================================================================
// GESTIÓN ADMIN - CRUD EVENTOS
// ============================================================================

/**
 * GET /api/eventos
 * Listar eventos con filtros
 * Permisos: EVENTOS_VER
 */
router.get('/', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { tipo, fechaDesde, fechaHasta, estado, search, ventasHabilitadas } = req.query

    const where = {}

    if (tipo) {
      where.tipo = tipo
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) {
        where.fecha.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        where.fecha.lte = new Date(fechaHasta)
      }
    }

    if (estado) {
      // Soportar múltiples estados separados por coma
      const estados = estado.includes(',') ? estado.split(',').map(e => e.trim()) : [estado]
      where.estado = { in: estados }
    }

    if (ventasHabilitadas !== undefined) {
      where.ventasHabilitadas = ventasHabilitadas === 'true'
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } }
      ]
    }

    const eventos = await req.db.evento.findMany({
      where,
      include: {
        espacio: true,
        partido: {
          include: {
            categoriaActividad: true
          }
        },
        categorias: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        },
        creador: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        _count: {
          select: {
            entradas: true,
            ingresos: true
          }
        }
      },
      orderBy: [
        { fecha: 'desc' },
        { hora: 'desc' }
      ]
    })

    return res.json({ success: true, data: eventos })
  } catch (error) {
    console.error('Error al listar eventos:', error)
    return res.status(500).json({ error: 'Error al listar eventos' })
  }
})

/**
 * GET /api/eventos/:id
 * Detalle de evento con estadísticas
 * Permisos: EVENTOS_VER
 */
router.get('/:id', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) },
      include: {
        espacio: true,
        partido: {
          include: {
            categoriaActividad: true
          }
        },
        categorias: {
          orderBy: { orden: 'asc' }
        },
        conceptoTesoreria: true,
        centroCosto: true,
        creador: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        _count: {
          select: {
            entradas: true,
            ingresos: true
          }
        }
      }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    // Calcular estadísticas
    const estadisticas = await calcularEstadisticasEvento(evento.id, req.db)

    return res.json({
      success: true,
      data: {
        ...evento,
        estadisticas
      }
    })
  } catch (error) {
    console.error('Error al obtener evento:', error)
    return res.status(500).json({ error: 'Error al obtener evento' })
  }
})

/**
 * POST /api/eventos
 * Crear nuevo evento
 * Permisos: EVENTOS_GESTIONAR
 */
router.post('/', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      tipo,
      fecha,
      hora,
      horaApertura,
      horaFin,
      espacioId,
      ubicacion,
      capacidadTotal,
      permiteSobreventa,
      ventasHabilitadas,
      partidoId,
      imagen,
      conceptoTesoreriaId,
      centroCostoId
    } = req.body

    // Validaciones
    if (!codigo || !nombre || !tipo || !fecha || !hora || !capacidadTotal) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: codigo, nombre, tipo, fecha, hora, capacidadTotal'
      })
    }

    if (!centroCostoId) {
      return res.status(400).json({ error: 'El Centro de Costo es obligatorio' })
    }

    if (capacidadTotal <= 0) {
      return res.status(400).json({ error: 'La capacidad total debe ser mayor a 0' })
    }

    // Verificar que el código no exista (unique compuesto tenantId+codigo)
    const existeCodigo = await req.db.evento.findFirst({
      where: { codigo }
    })

    if (existeCodigo) {
      return res.status(400).json({ error: 'Ya existe un evento con ese código' })
    }

    // Si se vincula a un partido, verificar que exista y no tenga evento
    if (partidoId) {
      const partido = await req.db.partido.findUnique({
        where: { id: partidoId },
        include: { evento: true }
      })

      if (!partido) {
        return res.status(404).json({ error: 'Partido no encontrado' })
      }

      if (partido.evento) {
        return res.status(400).json({ error: 'El partido ya tiene un evento vinculado' })
      }
    }

    const evento = await req.db.evento.create({
      data: {
        codigo,
        nombre,
        descripcion,
        tipo,
        fecha: new Date(fecha),
        hora,
        horaApertura,
        horaFin,
        espacioId: espacioId ? parseInt(espacioId) : null,
        ubicacion,
        capacidadTotal: parseInt(capacidadTotal),
        permiteSobreventa: permiteSobreventa || false,
        ventasHabilitadas: ventasHabilitadas !== false,
        partidoId: partidoId ? parseInt(partidoId) : null,
        imagen,
        conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null,
        centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
        creadoPor: req.admin.id
      },
      include: {
        espacio: true,
        partido: true,
        conceptoTesoreria: true,
        centroCosto: true,
        creador: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    })

    return res.status(201).json(evento)
  } catch (error) {
    console.error('Error al crear evento:', error)
    return res.status(500).json({ error: 'Error al crear evento' })
  }
})

/**
 * PUT /api/eventos/:id
 * Editar evento
 * Permisos: EVENTOS_GESTIONAR
 */
router.put('/:id', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      codigo,
      nombre,
      descripcion,
      tipo,
      fecha,
      hora,
      horaApertura,
      horaFin,
      estado,
      espacioId,
      ubicacion,
      capacidadTotal,
      permiteSobreventa,
      ventasHabilitadas,
      partidoId,
      imagen,
      conceptoTesoreriaId,
      centroCostoId
    } = req.body

    const eventoExistente = await req.db.evento.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { entradas: true } } }
    })

    if (!eventoExistente) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    // Si se cambia la capacidad, validar que no sea menor a las entradas vendidas
    if (capacidadTotal && capacidadTotal < eventoExistente.entradasVendidas) {
      return res.status(400).json({
        error: `La capacidad no puede ser menor a las entradas vendidas (${eventoExistente.entradasVendidas})`
      })
    }

    // Si se cambia el código, verificar que no exista
    if (codigo && codigo !== eventoExistente.codigo) {
      const existeCodigo = await req.db.evento.findUnique({
        where: { codigo }
      })

      if (existeCodigo) {
        return res.status(400).json({ error: 'Ya existe un evento con ese código' })
      }
    }

    const dataUpdate = {}

    if (codigo) dataUpdate.codigo = codigo
    if (nombre) dataUpdate.nombre = nombre
    if (descripcion !== undefined) dataUpdate.descripcion = descripcion
    if (tipo) dataUpdate.tipo = tipo
    if (fecha) dataUpdate.fecha = new Date(fecha)
    if (hora) dataUpdate.hora = hora
    if (horaApertura !== undefined) dataUpdate.horaApertura = horaApertura
    if (horaFin !== undefined) dataUpdate.horaFin = horaFin
    if (estado) dataUpdate.estado = estado
    if (espacioId !== undefined) dataUpdate.espacioId = espacioId ? parseInt(espacioId) : null
    if (ubicacion !== undefined) dataUpdate.ubicacion = ubicacion
    if (capacidadTotal) dataUpdate.capacidadTotal = parseInt(capacidadTotal)
    if (permiteSobreventa !== undefined) dataUpdate.permiteSobreventa = permiteSobreventa
    if (ventasHabilitadas !== undefined) dataUpdate.ventasHabilitadas = ventasHabilitadas
    if (partidoId !== undefined) dataUpdate.partidoId = partidoId ? parseInt(partidoId) : null
    if (imagen !== undefined) dataUpdate.imagen = imagen
    if (conceptoTesoreriaId !== undefined) dataUpdate.conceptoTesoreriaId = conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null
    if (centroCostoId !== undefined) dataUpdate.centroCostoId = centroCostoId ? parseInt(centroCostoId) : null

    const eventoActualizado = await req.db.evento.update({
      where: { id: parseInt(id) },
      data: dataUpdate,
      include: {
        espacio: true,
        partido: true,
        categorias: true,
        conceptoTesoreria: true,
        centroCosto: true,
        creador: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    })

    return res.json(eventoActualizado)
  } catch (error) {
    console.error('Error al actualizar evento:', error)
    return res.status(500).json({ error: 'Error al actualizar evento' })
  }
})

/**
 * DELETE /api/eventos/:id
 * Cancelar evento (no se elimina, se marca como CANCELADO)
 * Permisos: EVENTOS_GESTIONAR
 */
router.delete('/:id', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params

    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { entradas: true, ingresos: true }
          }
      }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    if (evento._count.ingresos > 0) {
      return res.status(400).json({
        error: 'No se puede cancelar un evento que ya tiene ingresos registrados'
      })
    }

    // Anular todas las entradas vendidas
    if (evento._count.entradas > 0) {
      await req.db.entrada.updateMany({
        where: {
          eventoId: parseInt(id),
          estado: 'VALIDA'
        },
        data: {
          estado: 'ANULADA',
          fechaAnulacion: new Date(),
          motivoAnulacion: 'Evento cancelado'
        }
      })
    }

    const eventoCancelado = await req.db.evento.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'CANCELADO',
        ventasHabilitadas: false
      }
    })

    return res.json({
      mensaje: 'Evento cancelado exitosamente',
      evento: eventoCancelado,
      entradasAnuladas: evento._count.entradas
    })
  } catch (error) {
    console.error('Error al cancelar evento:', error)
    return res.status(500).json({ error: 'Error al cancelar evento' })
  }
})

// ============================================================================
// GESTIÓN ADMIN - CATEGORÍAS DE ENTRADA
// ============================================================================

/**
 * GET /api/eventos/:id/categorias
 * Listar categorías de un evento
 * Permisos: EVENTOS_VER
 */
router.get('/:id/categorias', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const categorias = await req.db.categoriaEntrada.findMany({
      where: { eventoId: parseInt(id) },
      orderBy: { orden: 'asc' }
    })

    return res.json({ success: true, data: categorias })
  } catch (error) {
    console.error('Error al listar categorías:', error)
    return res.status(500).json({ error: 'Error al listar categorías' })
  }
})

/**
 * POST /api/eventos/:id/categorias
 * Crear categoría de entrada
 * Permisos: EVENTOS_GESTIONAR
 */
router.post('/:id/categorias', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombre,
      descripcion,
      precioSocio,
      precioNoSocio,
      capacidad,
      activo,
      orden
    } = req.body

    if (!nombre || precioSocio === undefined || precioNoSocio === undefined) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: nombre, precioSocio, precioNoSocio'
      })
    }

    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    const categoria = await req.db.categoriaEntrada.create({
      data: {
        eventoId: parseInt(id),
        nombre,
        descripcion,
        precioSocio: parseFloat(precioSocio),
        precioNoSocio: parseFloat(precioNoSocio),
        capacidad: capacidad ? parseInt(capacidad) : null,
        activo: activo !== false,
        orden: orden !== undefined ? parseInt(orden) : 0
      }
    })

    return res.status(201).json({ success: true, data: categoria })
  } catch (error) {
    console.error('Error al crear categoría:', error)
    return res.status(500).json({ error: 'Error al crear categoría' })
  }
})

/**
 * PUT /api/eventos/categorias/:id
 * Editar categoría de entrada
 * Permisos: EVENTOS_GESTIONAR
 */
router.put('/categorias/:id', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombre,
      descripcion,
      precioSocio,
      precioNoSocio,
      capacidad,
      activo,
      orden
    } = req.body

    const categoriaExistente = await req.db.categoriaEntrada.findUnique({
      where: { id: parseInt(id) }
    })

    if (!categoriaExistente) {
      return res.status(404).json({ error: 'Categoría no encontrada' })
    }

    // Si se cambia la capacidad, validar que no sea menor a las entradas vendidas
    if (capacidad && capacidad < categoriaExistente.entradasVendidas) {
      return res.status(400).json({
        error: `La capacidad no puede ser menor a las entradas vendidas (${categoriaExistente.entradasVendidas})`
      })
    }

    const dataUpdate = {}

    if (nombre) dataUpdate.nombre = nombre
    if (descripcion !== undefined) dataUpdate.descripcion = descripcion
    if (precioSocio !== undefined) dataUpdate.precioSocio = parseFloat(precioSocio)
    if (precioNoSocio !== undefined) dataUpdate.precioNoSocio = parseFloat(precioNoSocio)
    if (capacidad !== undefined) dataUpdate.capacidad = capacidad ? parseInt(capacidad) : null
    if (activo !== undefined) dataUpdate.activo = activo
    if (orden !== undefined) dataUpdate.orden = parseInt(orden)

    const categoriaActualizada = await req.db.categoriaEntrada.update({
      where: { id: parseInt(id) },
      data: dataUpdate
    })

    return res.json({ success: true, data: categoriaActualizada })
  } catch (error) {
    console.error('Error al actualizar categoría:', error)
    return res.status(500).json({ error: 'Error al actualizar categoría' })
  }
})

/**
 * DELETE /api/eventos/categorias/:id
 * Eliminar categoría de entrada
 * Permisos: EVENTOS_GESTIONAR
 */
router.delete('/categorias/:id', authAdmin, checkPermiso('EVENTOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params

    const categoria = await req.db.categoriaEntrada.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: { select: { entradas: true } }
      }
    })

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' })
    }

    if (categoria._count.entradas > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una categoría que tiene entradas vendidas. Puede desactivarla.'
      })
    }

    await req.db.categoriaEntrada.delete({
      where: { id: parseInt(id) }
    })

    return res.json({ mensaje: 'Categoría eliminada exitosamente' })
  } catch (error) {
    console.error('Error al eliminar categoría:', error)
    return res.status(500).json({ error: 'Error al eliminar categoría' })
  }
})

// ============================================================================
// VENTA DE ENTRADAS
// ============================================================================

/**
 * POST /api/eventos/:id/vender
 * Venta presencial de entradas (Admin)
 * Permisos: EVENTOS_VENDER
 */
router.post('/:id/vender', authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      items, // Nuevo: array de { categoriaId, cantidad }
      categoriaId, // Mantener compatibilidad
      cantidad, // Mantener compatibilidad
      socioId,
      nombreComprador,
      documentoComprador,
      emailComprador,
      celularComprador,
      cajaId,
      medioPagoId,
      pagosParciales,
      ingresoDirecto = false, // Ventanilla: marca entradas USADA + registra ingreso
      canalVenta = 'ADMIN',   // ADMIN por default; VENTANILLA cuando es venta en puerta
      dispositivoId           // Opcional: para trazar el punto de control de ventanilla
    } = req.body

    // Validaciones
    if (!nombreComprador || !cajaId) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: nombreComprador, cajaId'
      })
    }

    // Convertir a formato de items si vienen campos individuales
    let itemsArray = items
    if (!itemsArray && categoriaId && cantidad) {
      itemsArray = [{ categoriaId, cantidad }]
    }

    if (!itemsArray || itemsArray.length === 0) {
      return res.status(400).json({
        error: 'Debe proporcionar al menos un item (categoría con cantidad)'
      })
    }

    // Validar cantidades
    for (const item of itemsArray) {
      if (!item.categoriaId || !item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({ error: 'Cada item debe tener categoriaId y cantidad mayor a 0' })
      }
    }

    // Obtener evento con todas las categorías necesarias
    const categoriasIds = itemsArray.map(i => parseInt(i.categoriaId))
    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) },
      include: {
        categorias: {
          where: { id: { in: categoriasIds } }
        }
      }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    if (!evento.ventasHabilitadas) {
      return res.status(400).json({ error: 'Las ventas para este evento están deshabilitadas' })
    }

    if (evento.estado === 'CANCELADO') {
      return res.status(400).json({ error: 'El evento está cancelado' })
    }

    if (evento.estado === 'FINALIZADO') {
      return res.status(400).json({ error: 'El evento ya finalizó' })
    }

    // Validar que todas las categorías existan y estén activas
    for (const item of itemsArray) {
      const categoria = evento.categorias.find(c => c.id === parseInt(item.categoriaId))
      if (!categoria) {
        return res.status(404).json({ error: `Categoría ${item.categoriaId} no encontrada` })
      }
      if (!categoria.activo) {
        return res.status(400).json({ error: `La categoría ${categoria.nombre} no está activa` })
      }
    }

    // Calcular cantidad total
    const cantidadTotal = itemsArray.reduce((sum, item) => sum + parseInt(item.cantidad), 0)

    // Validar capacidad del evento
    if (!evento.permiteSobreventa) {
      const nuevasVentas = evento.entradasVendidas + cantidadTotal
      if (nuevasVentas > evento.capacidadTotal) {
        return res.status(400).json({
          error: `Capacidad agotada. Disponibles: ${evento.capacidadTotal - evento.entradasVendidas}`
        })
      }
    }

    // Validar capacidad de cada categoría
    for (const item of itemsArray) {
      const categoria = evento.categorias.find(c => c.id === parseInt(item.categoriaId))
      if (categoria.capacidad) {
        const nuevasVentasCategoria = categoria.entradasVendidas + parseInt(item.cantidad)
        if (nuevasVentasCategoria > categoria.capacidad) {
          return res.status(400).json({
            error: `Capacidad de ${categoria.nombre} agotada. Disponibles: ${categoria.capacidad - categoria.entradasVendidas}`
          })
        }
      }
    }

    // Buscar socio si se proporciona documento
    let socio = null
    let esSocio = false

    if (socioId) {
      socio = await req.db.socio.findUnique({
        where: { id: parseInt(socioId) },
        include: { estadoSocioRel: { select: { esSocioActivo: true, nombre: true } } }
      })

      if (socio && socio.estadoSocioRel?.esSocioActivo === true) {
        // Verificar si tiene deudas
        const cargosImpagos = await req.db.cargo.aggregate({
          where: {
            OR: [
              { socioId: socio.id },
              { grupoFamiliarId: socio.grupoFamiliarId }
            ],
            estado: { in: ['PENDIENTE', 'VENCIDO'] }
          },
          _sum: { montoTotal: true }
        })

        const pagos = await req.db.pago.aggregate({
          where: {
            OR: [
              { socioId: socio.id },
              ...(socio.grupoFamiliarId ? [{ grupo_familiar_id: socio.grupoFamiliarId }] : []),
            ],
            estado: { not: 'ANULADO' },
          },
          _sum: { montoTotal: true }
        })

        const saldo = parseFloat(pagos._sum.montoTotal || 0) - parseFloat(cargosImpagos._sum.montoTotal || 0)

        // Solo aplicar precio socio si NO tiene deuda (saldo >= 0)
        esSocio = saldo >= 0
      }
    } else if (documentoComprador) {
      socio = await req.db.socio.findFirst({
        where: {
          documento: documentoComprador,
          estadoSocioRel: { esSocioActivo: true }
        }
      })

      if (socio) {
        // Verificar si tiene deudas
        const cargosImpagos = await req.db.cargo.aggregate({
          where: {
            OR: [
              { socioId: socio.id },
              { grupoFamiliarId: socio.grupoFamiliarId }
            ],
            estado: { in: ['PENDIENTE', 'VENCIDO'] }
          },
          _sum: { montoTotal: true }
        })

        const pagos = await req.db.pago.aggregate({
          where: {
            OR: [
              { socioId: socio.id },
              ...(socio.grupoFamiliarId ? [{ grupo_familiar_id: socio.grupoFamiliarId }] : []),
            ],
            estado: { not: 'ANULADO' },
          },
          _sum: { montoTotal: true }
        })

        const saldo = parseFloat(pagos._sum.montoTotal || 0) - parseFloat(cargosImpagos._sum.montoTotal || 0)

        // Solo aplicar precio socio si NO tiene deuda (saldo >= 0)
        esSocio = saldo >= 0
      }
    }

    // Calcular total antes de la transacción
    let total = 0
    for (const item of itemsArray) {
      const categoria = evento.categorias.find(c => c.id === parseInt(item.categoriaId))
      const precio = esSocio ? categoria.precioSocio : categoria.precioNoSocio
      total += parseFloat(precio) * parseInt(item.cantidad)
    }

    // Obtener concepto de tesorería y cuenta contable desde el evento
    let conceptoTesoreriaId = evento.conceptoTesoreriaId
    let cuentaContableId = null
    let centroCostoId = evento.centroCostoId

    // Si el evento tiene concepto de tesorería, obtener su cuenta contable
    if (conceptoTesoreriaId) {
      const concepto = await req.db.conceptoTesoreria.findUnique({
        where: { id: conceptoTesoreriaId },
        include: { cuentaContable: true }
      })
      cuentaContableId = concepto?.cuentaContableId
    }

    // Si no tiene concepto o cuenta, buscar por defecto
    if (!conceptoTesoreriaId || !cuentaContableId) {
      const conceptoDefault = await req.db.conceptoTesoreria.findFirst({
        where: {
          OR: [
            { codigo: { contains: 'EVENTOS', mode: 'insensitive' } },
            { nombre: { contains: 'Eventos', mode: 'insensitive' } }
          ]
        },
        include: { cuentaContable: true }
      })

      if (conceptoDefault) {
        conceptoTesoreriaId = conceptoDefault.id
        cuentaContableId = conceptoDefault.cuentaContableId
      }

      if (!cuentaContableId) {
        return res.status(400).json({
          error: 'No se pudo determinar la cuenta contable para este evento. Configure el concepto de tesorería en el evento.'
        })
      }
    }

    // Si no tiene centro de costos, buscar por defecto según el tipo
    if (!centroCostoId) {
      const centroCosto = await req.db.centroCosto.findFirst({
        where: { codigo: `EVENTOS_${evento.tipo}` }
      })
      centroCostoId = centroCosto?.id
    }

    // Crear transacción
    const resultado = await req.db.$transaction(async (tx) => {
      // 1. Crear MovimientoCaja
      const numeroMovimiento = `MOV-${Date.now()}`

      const medioPago = medioPagoId
        ? await req.db.medioPago.findUnique({ where: { id: parseInt(medioPagoId) }, include: { conceptoTesoreria: true } })
        : null

      const movimientoCaja = await tx.movimientoCaja.create({
        data: {
          numero: numeroMovimiento,
          cajaId: parseInt(cajaId),
          tipo: 'INGRESO',
          cuentaContableId: cuentaContableId,
          centroCostoId: centroCostoId,
          monto: total,
          concepto: `Entradas - ${evento.nombre}${medioPago ? ` - ${medioPago.nombre}` : ''}`,
          registradoPor: req.admin.id
        }
      })

      // 1.1 Crear Asiento Contable
      // Obtener la caja y su cuenta contable (para el DEBE)
      const caja = await tx.caja.findUnique({
        where: { id: parseInt(cajaId) },
        select: { cuentaContableId: true, nombre: true }
      })

      if (!caja?.cuentaContableId) {
        throw new Error('La caja seleccionada no tiene una cuenta contable asociada')
      }

      // Generar el asiento contable
      const asiento = await generarAsientoAutomatico(tx, {
        fecha: new Date(),
        concepto: `Venta Entradas - ${evento.nombre}`,
        tipoOrigen: 'VENTA_ENTRADAS',
        origenId: movimientoCaja.id,
        registradoPor: req.admin.id,
        lineas: [
          {
            // DEBE: Cuenta del medio de pago o de la caja (fallback)
            cuentaContableId: resolverCuentaCashId(medioPago, caja),
            descripcion: `${caja.nombre}${medioPago ? ` - ${medioPago.nombre}` : ''}`,
            debe: total,
            haber: 0,
            centroCostoId: centroCostoId
          },
          {
            // HABER: Cuenta de ingreso (concepto tesorería del evento)
            cuentaContableId: cuentaContableId,
            descripcion: evento.nombre,
            debe: 0,
            haber: total,
            centroCostoId: centroCostoId
          }
        ]
      })

      // 2. Crear Entradas para cada item
      const todasLasEntradas = []
      for (const item of itemsArray) {
        const categoria = evento.categorias.find(c => c.id === parseInt(item.categoriaId))
        const precio = esSocio ? categoria.precioSocio : categoria.precioNoSocio
        const cantidad = parseInt(item.cantidad)

        for (let i = 0; i < cantidad; i++) {
          const entrada = await tx.entrada.create({
            data: {
              codigo: uuidv4(),
              eventoId: parseInt(id),
              categoriaId: parseInt(item.categoriaId),
              socioId: socio?.id,
              nombreComprador,
              documentoComprador,
              emailComprador,
              celularComprador,
              precio,
              esSocio,
              estado: ingresoDirecto ? 'USADA' : 'VALIDA',
              canalVenta,
              vendidoPor: req.admin.id,
              movimientoCajaId: movimientoCaja.id
            },
            include: {
              categoria: {
                include: {
                  evento: true
                }
              }
            }
          })

          // Si es venta en ventanilla, registrar ingreso directo
          if (ingresoDirecto) {
            await tx.ingresoEntrada.create({
              data: {
                entradaId: entrada.id,
                eventoId: parseInt(id),
                dispositivoId: dispositivoId || null,
                validadoPor: req.admin.id,
                modoValidacion: 'VENTANILLA'
              }
            })
          }

          todasLasEntradas.push(entrada)
        }

        // 3. Actualizar contador de categoría
        await tx.categoriaEntrada.update({
          where: { id: parseInt(item.categoriaId) },
          data: { entradasVendidas: { increment: cantidad } }
        })
      }

      // 4. Actualizar contadores del evento
      await tx.evento.update({
        where: { id: parseInt(id) },
        data: {
          entradasVendidas: { increment: cantidadTotal },
          ...(ingresoDirecto && { entradasIngresadas: { increment: cantidadTotal } }),
        }
      })

      return { entradas: todasLasEntradas, movimientoCaja, asiento }
    })

    return res.status(201).json({
      success: true,
      data: {
        mensaje: 'Entradas vendidas exitosamente',
        entradas: resultado.entradas,
        movimiento: resultado.movimientoCaja,
        asiento: resultado.asiento,
        total
      }
    })
  } catch (error) {
    console.error('Error al vender entradas:', error)
    return res.status(500).json({ error: error.message || 'Error al vender entradas' })
  }
})

/**
 * POST /api/eventos/venta-kiosco
 * Venta de entradas desde BuffetKiosco (carrito mixto)
 * Permisos: BUFFET_COBRAR
 */
router.post('/venta-kiosco', authAdmin, checkPermiso('BUFFET_COBRAR'), async (req, res) => {
  try {
    const {
      entradas, // [{ eventoId, categoriaId, cantidad }]
      cajaId,
      medioPagoId,
      socioId,
      nombreComprador,
      documentoComprador,
      emailComprador,
      celularComprador
    } = req.body

    if (!entradas || entradas.length === 0) {
      return res.status(400).json({ error: 'No hay entradas en el carrito' })
    }

    if (!cajaId) {
      return res.status(400).json({ error: 'Falta el campo cajaId' })
    }

    // Procesar cada entrada del carrito
    const resultados = []
    let totalGeneral = 0

    for (const item of entradas) {
      const { eventoId, categoriaId, cantidad } = item

      // Validar evento y categoría
      const evento = await req.db.evento.findUnique({
        where: { id: parseInt(eventoId) },
        include: {
          categorias: {
            where: { id: parseInt(categoriaId) }
          }
        }
      })

      if (!evento || !evento.ventasHabilitadas || evento.estado === 'CANCELADO') {
        throw new Error(`Evento ${evento?.nombre || eventoId} no disponible para venta`)
      }

      const categoria = evento.categorias[0]
      if (!categoria || !categoria.activo) {
        throw new Error(`Categoría no disponible`)
      }

      // Validar capacidad
      if (!evento.permiteSobreventa) {
        const nuevasVentas = evento.entradasVendidas + cantidad
        if (nuevasVentas > evento.capacidadTotal) {
          throw new Error(`Capacidad agotada en evento ${evento.nombre}`)
        }
      }

      if (categoria.capacidad) {
        const nuevasVentasCategoria = categoria.entradasVendidas + cantidad
        if (nuevasVentasCategoria > categoria.capacidad) {
          throw new Error(`Capacidad agotada en categoría ${categoria.nombre}`)
        }
      }

      // Determinar precio
      let socio = null
      let esSocio = false
      let precio = categoria.precioNoSocio

      if (socioId) {
        socio = await req.db.socio.findUnique({
          where: { id: parseInt(socioId) },
          include: { estadoSocioRel: { select: { esSocioActivo: true } } }
        })

        if (socio && socio.estadoSocioRel?.esSocioActivo === true) {
          esSocio = true
          precio = categoria.precioSocio
        }
      }

      const total = precio * cantidad
      totalGeneral += total

      resultados.push({
        evento,
        categoria,
        cantidad,
        precio,
        total,
        esSocio,
        socio
      })
    }

    // Crear transacción
    const entradasCreadas = await req.db.$transaction(async (tx) => {
      const cuentaContable = await tx.cuentaContable.findFirst({
        where: {
          OR: [
            { codigo: { contains: 'EVENTOS' } },
            { nombre: { contains: 'Eventos', mode: 'insensitive' } }
          ]
        }
      })

      if (!cuentaContable) {
        throw new Error('No se encontró una cuenta contable para eventos')
      }

      // Crear MovimientoCaja único para todas las entradas
      const cajaKiosco = await tx.caja.findUnique({
        where: { id: parseInt(cajaId) },
        select: { cuentaContableId: true, nombre: true, centroCostoId: true }
      })

      const ccEvento = resultados[0]?.evento?.centroCostoId ?? cajaKiosco?.centroCostoId ?? null

      const numeroMovimiento = `MOV-${Date.now()}`
      const movimientoCaja = await tx.movimientoCaja.create({
        data: {
          numero: numeroMovimiento,
          cajaId: parseInt(cajaId),
          tipo: 'INGRESO',
          cuentaContableId: cuentaContable.id,
          monto: totalGeneral,
          concepto: `Venta Entradas Kiosco`,
          medioPagoId: medioPagoId ? parseInt(medioPagoId) : null,
          centroCostoId: ccEvento,
          registradoPor: req.admin.id
        }
      })

      // Crear Asiento Contable
      const caja = cajaKiosco

      if (!caja?.cuentaContableId) {
        throw new Error('La caja seleccionada no tiene una cuenta contable asociada')
      }

      const medioPago = medioPagoId
        ? await tx.medioPago.findUnique({ where: { id: parseInt(medioPagoId) }, include: { conceptoTesoreria: true } })
        : null

      const asiento = await generarAsientoAutomatico(tx, {
        fecha: new Date(),
        concepto: 'Venta Entradas Kiosco',
        tipoOrigen: 'VENTA_ENTRADAS_KIOSCO',
        origenId: movimientoCaja.id,
        registradoPor: req.admin.id,
        lineas: [
          {
            // DEBE: Cuenta del medio de pago o de la caja (fallback)
            cuentaContableId: resolverCuentaCashId(medioPago, caja),
            descripcion: `${caja.nombre}${medioPago ? ` - ${medioPago.nombre}` : ''}`,
            debe: totalGeneral,
            haber: 0
          },
          {
            // HABER: Cuenta de ingreso (eventos)
            cuentaContableId: cuentaContable.id,
            descripcion: 'Venta Entradas Eventos',
            debe: 0,
            haber: totalGeneral
          }
        ]
      })

      const todasLasEntradas = []

      // Crear entradas para cada item
      for (const resultado of resultados) {
        const { evento, categoria, cantidad, precio, esSocio, socio } = resultado

        const centroCosto = await tx.centroCosto.findFirst({
          where: { codigo: `EVENTOS_${evento.tipo}` }
        })

        for (let i = 0; i < cantidad; i++) {
          const entrada = await tx.entrada.create({
            data: {
              codigo: uuidv4(),
              eventoId: evento.id,
              categoriaId: categoria.id,
              socioId: socio?.id,
              nombreComprador: nombreComprador || socio?.nombre || 'Comprador',
              documentoComprador: documentoComprador || socio?.documento,
              emailComprador: emailComprador || socio?.email,
              celularComprador: celularComprador || socio?.celular,
              precio,
              esSocio,
              canalVenta: 'BUFFET',
              vendidoPor: req.admin.id,
              movimientoCajaId: i === 0 ? movimientoCaja.id : null // Solo la primera entrada se vincula
            }
          })
          todasLasEntradas.push(entrada)
        }

        // Actualizar contadores
        await tx.evento.update({
          where: { id: evento.id },
          data: { entradasVendidas: { increment: cantidad } }
        })

        await tx.categoriaEntrada.update({
          where: { id: categoria.id },
          data: { entradasVendidas: { increment: cantidad } }
        })
      }

      return { entradas: todasLasEntradas, asiento }
    })

    return res.status(201).json({
      mensaje: 'Entradas vendidas exitosamente desde kiosco',
      entradas: entradasCreadas.entradas,
      asiento: entradasCreadas.asiento,
      total: totalGeneral
    })
  } catch (error) {
    console.error('Error al vender entradas desde kiosco:', error)
    return res.status(500).json({ error: error.message || 'Error al vender entradas desde kiosco' })
  }
})

/**
 * POST /api/socio/:token/eventos/:eventoId/comprar
 * Compra de entradas desde Portal Socio (cargo a cuenta corriente)
 */
router.post('/socio/:token/eventos/:eventoId/comprar', asyncHandler(async (req, res) => {
  const { token, eventoId } = req.params
  const { categoriaId, cantidad } = req.body

  if (!categoriaId || !cantidad) {
    throw new AppError('Faltan campos requeridos: categoriaId, cantidad', 400)
  }

  if (cantidad <= 0) {
    throw new AppError('La cantidad debe ser mayor a 0', 400)
  }

  // Validar token y obtener socio
  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 404, 'INVALID_TOKEN')
  }

  // Obtener evento
  const evento = await req.db.evento.findUnique({
    where: { id: parseInt(eventoId) },
    include: {
      categorias: {
        where: { id: parseInt(categoriaId) }
      }
    }
  })

  if (!evento) {
    throw new AppError('Evento no encontrado', 404)
  }

  if (!evento.ventasHabilitadas) {
    throw new AppError('Las ventas para este evento están deshabilitadas', 400)
  }

  if (evento.estado === 'CANCELADO') {
    throw new AppError('El evento está cancelado', 400)
  }

  const categoria = evento.categorias[0]

  if (!categoria || !categoria.activo) {
    throw new AppError('Categoría no disponible', 400)
  }

  // Validar capacidad
  if (!evento.permiteSobreventa) {
    const nuevasVentas = evento.entradasVendidas + cantidad
    if (nuevasVentas > evento.capacidadTotal) {
      throw new AppError(
        `Capacidad agotada. Disponibles: ${evento.capacidadTotal - evento.entradasVendidas}`,
        400
      )
    }
  }

  if (categoria.capacidad) {
    const nuevasVentasCategoria = categoria.entradasVendidas + cantidad
    if (nuevasVentasCategoria > categoria.capacidad) {
      throw new AppError(
        `Capacidad de categoría agotada. Disponibles: ${categoria.capacidad - categoria.entradasVendidas}`,
        400
      )
    }
  }

  const precio = categoria.precioSocio
  const total = precio * cantidad

  // Crear LinkPago con datos de la compra de entradas
  const linkPago = await req.db.linkPago.create({
    data: {
      socioId: socio.id,
      concepto: `Entradas - ${evento.nombre}`,
      descripcion: `${categoria.nombre} (x${cantidad})`,
      montoTotal: total,
      plataforma: 'MERCADOPAGO',
      estado: 'PENDIENTE',
      // Guardar datos de la compra en formato JSON
      cargosIds: JSON.stringify({
        tipo: 'ENTRADAS',
        eventoId: parseInt(eventoId),
        categoriaId: parseInt(categoriaId),
        cantidad: parseInt(cantidad),
        precio: parseFloat(precio),
        esSocio: true
      })
    }
  })

  // Crear preferencia de MercadoPago
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const preferencia = await crearPreferenciaPago({
    accessToken: await getMpAccessToken(req.db),
    title: `Entradas - ${evento.nombre}`,
    description: `${categoria.nombre} (x${cantidad})`,
    amount: parseFloat(total),
    quantity: 1,
    externalReference: linkPago.id.toString(),
    payer: {
      email: socio.email || 'socio@club.com',
      name: socio.apellidoNombre
    },
    notificationUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/pagos/webhook/mercadopago`,
    successUrl: `${baseUrl}/portal-socio/${token}?pago=exito&seccion=eventos`,
    failureUrl: `${baseUrl}/portal-socio/${token}?pago=error&seccion=eventos`,
    pendingUrl: `${baseUrl}/portal-socio/${token}?pago=pendiente&seccion=eventos`
  })

  // Actualizar LinkPago con datos de la preferencia
  await req.db.linkPago.update({
    where: { id: linkPago.id },
    data: {
      preferenceId: preferencia.id,
      initPoint: preferencia.init_point
    }
  })

  return res.status(201).json({
    success: true,
    data: {
      mensaje: 'Preferencia de pago creada',
      linkPago: {
        id: linkPago.id,
        codigo: linkPago.codigo,
        initPoint: preferencia.init_point
      },
      total
    }
  })
}))

/**
 * GET /api/socio/:token/eventos
 * Listar eventos disponibles para compra desde Portal Socio
 */
router.get('/socio/:token/eventos', asyncHandler(async (req, res) => {
  const { token } = req.params

  // Validar token y obtener socio
  const socio = await req.db.socio.findFirst({
    where: { tokenPortal: token }
  })

  if (!socio) {
    throw new AppError('Token inválido', 404, 'INVALID_TOKEN')
  }

  // Obtener eventos con ventas habilitadas y no finalizados
  const eventos = await req.db.evento.findMany({
    where: {
      ventasHabilitadas: true,
      estado: {
        not: 'CANCELADO'
      },
      fecha: {
        gte: new Date() // Solo eventos futuros o del día
      }
    },
    include: {
      categorias: {
        where: { activo: true },
        orderBy: { orden: 'asc' }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  return res.json({
    success: true,
    data: eventos
  })
}))

// ============================================================================
// MERCADO PAGO - INTEGRACIÓN - TODO: FASE 2.5
// ============================================================================

// TODO: FASE 2.5 - Implementar con Mercado Pago SDK v2.x
// El SDK v2 usa una API diferente (MercadoPagoConfig + PreferenceClient)
// Ver: https://github.com/mercadopago/sdk-nodejs
// Endpoints necesarios:
// - POST /mercadopago/crear-preferencia (crear link de pago)
// - POST /mercadopago/webhook (recibir notificaciones de MP)
// - GET /entradas-por-pago/:paymentId (consultar entradas compradas)

// ============================================================================
// CONTROL DE ACCESO
// ============================================================================

/**
 * POST /api/eventos/validar-entrada
 * Validar entrada por código QR
 * Permisos: EVENTOS_VALIDAR
 */
router.post('/validar-entrada', authAdmin, checkPermiso('EVENTOS_VALIDAR'), async (req, res) => {
  try {
    const { codigo, eventoId } = req.body

    if (!codigo) {
      return res.status(400).json({ error: 'Falta el código de entrada' })
    }

    const entrada = await req.db.entrada.findUnique({
      where: { codigo },
      include: {
        evento: true,
        categoria: true,
        socio: {
          select: {
            id: true,
            nombre: true,
            documento: true,
            fotoUrl: true
          }
        },
        ingreso: true
      }
    })

    if (!entrada) {
      return res.json({
        valida: false,
        motivo: 'ENTRADA_NO_ENCONTRADA',
        mensaje: 'Código de entrada no encontrado'
      })
    }

    // Validar evento si se proporciona
    if (eventoId && entrada.eventoId !== parseInt(eventoId)) {
      return res.json({
        valida: false,
        motivo: 'EVENTO_INCORRECTO',
        mensaje: `Esta entrada es para ${entrada.evento.nombre}`,
        entrada,
        evento: entrada.evento
      })
    }

    // Validar estado
    if (entrada.estado === 'ANULADA') {
      return res.json({
        valida: false,
        motivo: 'ENTRADA_ANULADA',
        mensaje: entrada.motivoAnulacion || 'Entrada anulada',
        entrada,
        evento: entrada.evento
      })
    }

    if (entrada.estado === 'USADA') {
      return res.json({
        valida: false,
        motivo: 'YA_INGRESADA',
        mensaje: `Ya ingresó el ${entrada.ingreso?.fecha ? new Date(entrada.ingreso.fecha).toLocaleString('es-AR') : 'fecha desconocida'}`,
        entrada,
        evento: entrada.evento,
        ingreso: entrada.ingreso
      })
    }

    // Entrada válida
    return res.json({
      valida: true,
      motivo: 'OK',
      mensaje: `Bienvenido ${entrada.nombreComprador}`,
      entrada,
      evento: entrada.evento,
      categoria: entrada.categoria,
      socio: entrada.socio
    })
  } catch (error) {
    console.error('Error al validar entrada:', error)
    return res.status(500).json({ error: 'Error al validar entrada' })
  }
})

/**
 * POST /api/eventos/registrar-ingreso
 * Registrar ingreso de entrada (marca como USADA)
 * Permisos: EVENTOS_VALIDAR
 */
router.post('/registrar-ingreso', authAdmin, checkPermiso('EVENTOS_VALIDAR'), async (req, res) => {
  try {
    const { codigo, eventoId, dispositivoId, modoValidacion } = req.body

    if (!codigo) {
      return res.status(400).json({ error: 'Falta el código de entrada' })
    }

    const entrada = await req.db.entrada.findUnique({
      where: { codigo },
      include: {
        evento: true,
        categoria: true,
        socio: {
          select: {
            id: true,
            nombre: true,
            documento: true
          }
        }
      }
    })

    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' })
    }

    if (entrada.estado !== 'VALIDA') {
      return res.status(400).json({
        error: `No se puede registrar ingreso. Estado: ${entrada.estado}`
      })
    }

    if (eventoId && entrada.eventoId !== parseInt(eventoId)) {
      return res.status(400).json({
        error: 'La entrada no corresponde a este evento'
      })
    }

    // Crear ingreso y marcar entrada como USADA
    const ingreso = await req.db.$transaction(async (tx) => {
      const nuevoIngreso = await tx.ingresoEntrada.create({
        data: {
          entradaId: entrada.id,
          eventoId: entrada.eventoId,
          dispositivoId: dispositivoId ? parseInt(dispositivoId) : null,
          validadoPor: req.admin.id,
          modoValidacion: modoValidacion || 'QR'
        }
      })

      await tx.entrada.update({
        where: { id: entrada.id },
        data: { estado: 'USADA' }
      })

      await tx.evento.update({
        where: { id: entrada.eventoId },
        data: { entradasIngresadas: { increment: 1 } }
      })

      return nuevoIngreso
    })

    return res.status(201).json({
      mensaje: 'Ingreso registrado exitosamente',
      ingreso,
      entrada: {
        ...entrada,
        estado: 'USADA'
      }
    })
  } catch (error) {
    console.error('Error al registrar ingreso:', error)
    return res.status(500).json({ error: error.message || 'Error al registrar ingreso' })
  }
})

// ============================================================================
// CONSULTAS PÚBLICAS
// ============================================================================

/**
 * GET /api/public/eventos
 * Listar eventos futuros públicos (sin auth)
 */
router.get('/public/eventos', async (req, res) => {
  try {
    const { tipo } = req.query

    const where = {
      ventasHabilitadas: true,
      estado: { in: ['PROGRAMADO', 'EN_CURSO'] },
      fecha: { gte: new Date() }
    }

    if (tipo) {
      where.tipo = tipo
    }

    const eventos = await req.db.evento.findMany({
      where,
      include: {
        espacio: true,
        partido: {
          include: {
            categoriaActividad: true
          }
        },
        categorias: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        }
      },
      orderBy: [
        { fecha: 'asc' },
        { hora: 'asc' }
      ]
    })

    return res.json(eventos)
  } catch (error) {
    console.error('Error al listar eventos públicos:', error)
    return res.status(500).json({ error: 'Error al listar eventos' })
  }
})

/**
 * GET /api/public/eventos/:id
 * Detalle de evento público (sin auth)
 */
router.get('/public/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params

    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) },
      include: {
        espacio: true,
        partido: {
          include: {
            categoriaActividad: true
          }
        },
        categorias: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        }
      }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    if (!evento.ventasHabilitadas || evento.estado === 'CANCELADO') {
      return res.status(404).json({ error: 'Evento no disponible' })
    }

    return res.json(evento)
  } catch (error) {
    console.error('Error al obtener evento público:', error)
    return res.status(500).json({ error: 'Error al obtener evento' })
  }
})

// ============================================================================
// REPORTES
// ============================================================================

/**
 * GET /api/eventos/:id/ventas
 * Reporte de ventas por categoría/canal
 * Permisos: EVENTOS_VER
 */
router.get('/:id/ventas', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const entradas = await req.db.entrada.findMany({
      where: { eventoId: parseInt(id) },
      include: {
        categoria: true,
        socio: {
          select: {
            id: true,
            nombre: true,
            documento: true
          }
        },
        vendedor: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: { fechaVenta: 'desc' }
    })

    // Agrupar por categoría
    const porCategoria = entradas.reduce((acc, entrada) => {
      const catNombre = entrada.categoria.nombre
      if (!acc[catNombre]) {
        acc[catNombre] = {
          categoria: entrada.categoria,
          cantidad: 0,
          total: 0,
          socios: 0,
          noSocios: 0
        }
      }
      acc[catNombre].cantidad++
      acc[catNombre].total += parseFloat(entrada.precio)
      if (entrada.esSocio) {
        acc[catNombre].socios++
      } else {
        acc[catNombre].noSocios++
      }
      return acc
    }, {})

    // Agrupar por canal
    const porCanal = entradas.reduce((acc, entrada) => {
      const canal = entrada.canalVenta
      if (!acc[canal]) {
        acc[canal] = {
          canal,
          cantidad: 0,
          total: 0
        }
      }
      acc[canal].cantidad++
      acc[canal].total += parseFloat(entrada.precio)
      return acc
    }, {})

    return res.json({
      entradas,
      resumen: {
        porCategoria: Object.values(porCategoria),
        porCanal: Object.values(porCanal),
        total: entradas.length,
        recaudado: entradas.reduce((sum, e) => sum + parseFloat(e.precio), 0)
      }
    })
  } catch (error) {
    console.error('Error al obtener reporte de ventas:', error)
    return res.status(500).json({ error: 'Error al obtener reporte de ventas' })
  }
})

/**
 * GET /api/eventos/:id/ingresos
 * Reporte de ingresos reales
 * Permisos: EVENTOS_VER
 */
router.get('/:id/ingresos', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const ingresos = await req.db.ingresoEntrada.findMany({
      where: { eventoId: parseInt(id) },
      include: {
        entrada: {
          include: {
            categoria: true,
            socio: {
              select: {
                id: true,
                nombre: true,
                documento: true
              }
            }
          }
        },
        dispositivo: true,
        validador: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    return res.json({
      success: true,
      data: ingresos
    })
  } catch (error) {
    console.error('Error al obtener reporte de ingresos:', error)
    return res.status(500).json({ error: 'Error al obtener reporte de ingresos' })
  }
})

/**
 * GET /api/eventos/:id/entradas
 * Listar entradas de un evento
 * Permisos: EVENTOS_VER
 */
router.get('/:id/entradas', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params
    const { estado, categoriaId, canal } = req.query

    const where = { eventoId: parseInt(id) }

    if (estado) {
      where.estado = estado
    }

    if (categoriaId) {
      where.categoriaId = parseInt(categoriaId)
    }

    if (canal) {
      where.canalVenta = canal
    }

    const entradas = await req.db.entrada.findMany({
      where,
      include: {
        categoria: true,
        socio: {
          select: {
            id: true,
            nombre: true,
            documento: true,
            fotoUrl: true
          }
        },
        ingreso: {
          include: {
            dispositivo: true
          }
        }
      },
      orderBy: { fechaVenta: 'desc' }
    })

    return res.json({
      success: true,
      data: entradas
    })
  } catch (error) {
    console.error('Error al listar entradas:', error)
    return res.status(500).json({ error: 'Error al listar entradas' })
  }
})

/**
 * GET /api/eventos/:id/estadisticas
 * Estadísticas del evento
 * Permisos: EVENTOS_VER
 */
router.get('/:id/estadisticas', authAdmin, checkPermiso('EVENTOS_VER'), async (req, res) => {
  try {
    const { id } = req.params

    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(id) }
    })

    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' })
    }

    const estadisticas = await calcularEstadisticasEvento(parseInt(id), req.db)

    return res.json({
      success: true,
      data: estadisticas
    })
  } catch (error) {
    console.error('Error al obtener estadísticas:', error)
    return res.status(500).json({ error: 'Error al obtener estadísticas' })
  }
})

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Calcular estadísticas de un evento
 */
async function calcularEstadisticasEvento(eventoId, db) {
  const entradas = await db.entrada.findMany({
    where: { eventoId },
    include: {
      categoria: true,
      ingreso: true
    }
  })

  const totalVendidas = entradas.length
  const totalIngresadas = entradas.filter(e => e.estado === 'USADA').length
  const totalAnuladas = entradas.filter(e => e.estado === 'ANULADA').length
  const totalValidas = entradas.filter(e => e.estado === 'VALIDA').length

  const recaudado = entradas
    .filter(e => e.estado !== 'ANULADA')
    .reduce((sum, e) => sum + parseFloat(e.precio), 0)

  const porCategoria = entradas.reduce((acc, entrada) => {
    const catId = entrada.categoriaId
    if (!acc[catId]) {
      acc[catId] = {
        categoria: entrada.categoria,
        vendidas: 0,
        ingresadas: 0,
        recaudado: 0
      }
    }
    if (entrada.estado !== 'ANULADA') {
      acc[catId].vendidas++
      acc[catId].recaudado += parseFloat(entrada.precio)
    }
    if (entrada.estado === 'USADA') {
      acc[catId].ingresadas++
    }
    return acc
  }, {})

  const porCanal = entradas.reduce((acc, entrada) => {
    const canal = entrada.canalVenta
    if (!acc[canal]) {
      acc[canal] = {
        canal,
        cantidad: 0,
        total: 0
      }
    }
    if (entrada.estado !== 'ANULADA') {
      acc[canal].cantidad++
      acc[canal].total += parseFloat(entrada.precio)
    }
    return acc
  }, {})

  // Formatear porCategoria para el frontend
  const porCategoriaArray = Object.values(porCategoria).map(cat => ({
    categoriaId: cat.categoria.id,
    nombre: cat.categoria.nombre,
    cantidad: cat.vendidas,
    total: cat.recaudado,
    ingresadas: cat.ingresadas
  }))

  return {
    totalVendidas,
    totalIngresadas,
    totalAnuladas,
    totalValidas,
    totalRecaudado: recaudado, // Alias para que coincida con el frontend
    recaudado, // Mantener ambos por compatibilidad
    porcentajeIngreso: totalVendidas > 0 ? ((totalIngresadas / totalVendidas) * 100).toFixed(2) : 0,
    porCategoria: porCategoriaArray,
    porCanal: Object.values(porCanal)
  }
}

/**
 * POST /api/eventos/actualizar-contabilidad
 * Actualizar eventos sin cuenta contable/centro de costos
 * TEMPORAL - Ejecutar una vez para migrar eventos existentes
 */
router.post('/actualizar-contabilidad', authAdmin, async (req, res) => {
  try {
    // Buscar cuenta contable de eventos
    const cuentaContable = await req.db.cuentaContable.findFirst({
      where: {
        OR: [
          { codigo: { contains: 'EVENTOS' } },
          { nombre: { contains: 'Eventos', mode: 'insensitive' } }
        ]
      }
    })

    if (!cuentaContable) {
      return res.status(400).json({
        error: 'No se encontró cuenta contable para eventos'
      })
    }

    // Buscar centros de costo
    const centrosDeportivo = await req.db.centroCosto.findFirst({
      where: { codigo: 'EVENTOS_DEPORTIVO' }
    })
    const centrosSocial = await req.db.centroCosto.findFirst({
      where: { codigo: 'EVENTOS_SOCIAL' }
    })
    const centrosRecreativo = await req.db.centroCosto.findFirst({
      where: { codigo: 'EVENTOS_RECREATIVO' }
    })

    // Actualizar eventos sin cuenta contable
    const actualizados = []

    // Deportivos
    if (centrosDeportivo) {
      const deportivos = await req.db.evento.updateMany({
        where: {
          tipo: 'DEPORTIVO',
          cuentaContableId: null
        },
        data: {
          cuentaContableId: cuentaContable.id,
          centroCostoId: centrosDeportivo.id
        }
      })
      actualizados.push({ tipo: 'DEPORTIVO', count: deportivos.count })
    }

    // Sociales
    if (centrosSocial) {
      const sociales = await req.db.evento.updateMany({
        where: {
          tipo: 'SOCIAL',
          cuentaContableId: null
        },
        data: {
          cuentaContableId: cuentaContable.id,
          centroCostoId: centrosSocial.id
        }
      })
      actualizados.push({ tipo: 'SOCIAL', count: sociales.count })
    }

    // Recreativos
    if (centrosRecreativo) {
      const recreativos = await req.db.evento.updateMany({
        where: {
          tipo: 'RECREATIVO',
          cuentaContableId: null
        },
        data: {
          cuentaContableId: cuentaContable.id,
          centroCostoId: centrosRecreativo.id
        }
      })
      actualizados.push({ tipo: 'RECREATIVO', count: recreativos.count })
    }

    return res.json({
      success: true,
      message: 'Eventos actualizados correctamente',
      actualizados
    })
  } catch (error) {
    console.error('Error actualizando eventos:', error)
    return res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/eventos/generar-pdf-entradas
 * Generar PDF de entradas para descarga directa
 * Permisos: EVENTOS_VENDER
 */
router.post('/generar-pdf-entradas', authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const { codigos, nombreComprador } = req.body

    if (!codigos || !Array.isArray(codigos) || codigos.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un código de entrada' })
    }

    // Obtener las entradas con sus datos completos
    const entradas = await req.db.entrada.findMany({
      where: {
        codigo: { in: codigos }
      },
      include: {
        evento: true,
        categoria: true,
        socio: true
      }
    })

    if (entradas.length === 0) {
      return res.status(404).json({ error: 'No se encontraron entradas' })
    }

    const archivo = await generarEntradasArchivo(entradas, nombreComprador, entradas[0].evento.codigo)

    res.setHeader('Content-Type', archivo.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${archivo.filename}"`)
    res.setHeader('Content-Length', archivo.buffer.length)
    res.end(archivo.buffer, 'binary')
  } catch (error) {
    console.error('Error generando PDF:', error)
    res.status(500).json({ error: error.message || 'Error al generar PDF' })
  }
})

/**
 * POST /api/eventos/enviar-entradas
 * Generar PDF de entradas y enviar por email
 * Permisos: EVENTOS_VENDER
 */
router.post('/enviar-entradas', authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const { codigos, email, nombreComprador } = req.body

    if (!codigos || !Array.isArray(codigos) || codigos.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un código de entrada' })
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' })
    }

    // Obtener las entradas con sus datos completos
    const entradas = await req.db.entrada.findMany({
      where: {
        codigo: { in: codigos }
      },
      include: {
        evento: true,
        categoria: true,
        socio: true
      }
    })

    if (entradas.length === 0) {
      return res.status(404).json({ error: 'No se encontraron entradas' })
    }

    // Generar un PDF por entrada
    const evento = entradas[0].evento
    const archivo = await generarEntradasArchivo(entradas, nombreComprador, evento.codigo)

    // Adjuntar un PDF separado por entrada (no zip — Gmail los muestra mejor)
    const attachments = archivo.pdfs.map(p => ({
      filename: `entrada-${p.codigo}.pdf`,
      content: p.buffer,
      contentType: 'application/pdf',
    }))

    await enviarEmail({
      to: email,
      subject: `Tus entradas para ${evento.nombre}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">Gracias por tu compra!</h2>
          <p>Hola <strong>${nombreComprador}</strong>,</p>
          <p>Adjunto encontraras ${entradas.length} entrada${entradas.length > 1 ? 's' : ''} para:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #111827;">${evento.nombre}</h3>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(evento.fecha).toLocaleDateString('es-AR')}</p>
            <p style="margin: 5px 0;"><strong>Hora:</strong> ${evento.hora}</p>
            <p style="margin: 5px 0;"><strong>Ubicacion:</strong> ${evento.ubicacion || 'Ver entrada'}</p>
          </div>
          <p>Cada entrada va como PDF separado. Presentá el código QR de cada una al ingresar al evento.</p>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            Este es un correo automatico, por favor no responder.
          </p>
        </div>
      `,
      db: req.db,
      attachments,
    })

    res.json({
      success: true,
      message: `Entradas enviadas a ${email}`
    })
  } catch (error) {
    console.error('Error enviando entradas:', error)
    res.status(500).json({ error: error.message || 'Error al enviar entradas' })
  }
})

// Función para generar PDF de entradas con PDFKit
/**
 * Genera UN PDF por entrada, con tamaño compacto (sin sobrar hoja).
 * Page size = 595pt (A4 width) × 280pt aprox — un ticket entero.
 * Devuelve { codigo, buffer } para empaquetar después.
 */
async function generarPDFUnaEntrada(entrada, nombreComprador, logoPath) {
  const PAGE_WIDTH = 595
  const PAGE_HEIGHT = 280
  const TICKET_MARGIN = 15

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: TICKET_MARGIN })
      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const evento = entrada.evento

      const ticketX = TICKET_MARGIN
      const ticketY = TICKET_MARGIN
      const ticketWidth = PAGE_WIDTH - TICKET_MARGIN * 2
      const ticketHeight = PAGE_HEIGHT - TICKET_MARGIN * 2
      const pad = 10

      // Borde del ticket
      doc.roundedRect(ticketX, ticketY, ticketWidth, ticketHeight, 6)
         .lineWidth(2)
         .strokeColor('#DC2626')
         .stroke()

      // --- Sección izquierda: Logo + info ---
      const leftColW = 320
      const rightColX = ticketX + leftColW
      const rightColW = ticketWidth - leftColW

      // Logo
      const logoBoxX = ticketX + pad
      const logoBoxY = ticketY + pad
      const logoSize = 60
      if (logoPath) {
        try {
          doc.image(logoPath, logoBoxX, logoBoxY, { fit: [logoSize, logoSize], align: 'center', valign: 'center' })
        } catch {
          doc.fontSize(20).fillColor('#DC2626').font('Helvetica-Bold')
             .text('CSP', logoBoxX, logoBoxY + 18, { width: logoSize, align: 'center' })
        }
      } else {
        doc.fontSize(20).fillColor('#DC2626').font('Helvetica-Bold')
           .text('CSP', logoBoxX, logoBoxY + 18, { width: logoSize, align: 'center' })
      }

      // Línea divisoria vertical después del logo
      const dividerVX = logoBoxX + logoSize + 10
      doc.moveTo(dividerVX, ticketY + pad)
         .lineTo(dividerVX, ticketY + ticketHeight - pad)
         .strokeColor('#DC2626')
         .lineWidth(1)
         .stroke()

      // Info textual
      const infoX = dividerVX + 12
      const infoW = leftColW - (infoX - ticketX) - pad
      let infoY = ticketY + pad + 2

      // Título
      doc.fontSize(13).fillColor('#DC2626').font('Helvetica-Bold')
         .text(`ENTRADA - ${(evento.nombre || '').toUpperCase()}`, infoX, infoY, {
           width: infoW,
           lineBreak: false,
           ellipsis: true,
         })
      infoY += 22

      // Helper para campo (label + valor)
      const renderCampo = (label, value, x, y, w = 130) => {
        doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Bold').text(label, x, y, { width: w })
        doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(value || '-', x, y + 9, { width: w, lineBreak: false, ellipsis: true })
      }

      const fechaFmt = new Date(evento.fecha).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
      })

      // Fila 1: Fecha + Hora
      renderCampo('FECHA', fechaFmt, infoX, infoY, 100)
      renderCampo('HORA', evento.hora || '-', infoX + 110, infoY, 80)
      infoY += 30

      // Fila 2: Categoría + Precio
      renderCampo('CATEGORÍA', entrada.categoria?.nombre || '-', infoX, infoY, 130)
      doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Bold').text('PRECIO', infoX + 140, infoY)
      doc.fontSize(13).fillColor('#DC2626').font('Helvetica-Bold')
         .text(`$${Number(entrada.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
           infoX + 140, infoY + 8, { width: infoW - 140 })
      infoY += 32

      // Fila 3: Ubicación si existe
      if (evento.ubicacion) {
        renderCampo('UBICACIÓN', evento.ubicacion, infoX, infoY, infoW)
        infoY += 28
      }

      // Fila 4: Comprador si existe
      if (nombreComprador) {
        renderCampo('COMPRADOR', nombreComprador, infoX, infoY, infoW)
        infoY += 28
      }

      // --- Sección derecha: QR + código ---
      // QR Code (usamos qrcode local en lugar de servicio externo)
      try {
        const QRCode = await import('qrcode')
        const qrSize = 150
        const qrX = rightColX + (rightColW - qrSize) / 2
        const qrY = ticketY + pad + 5

        const qrDataUrl = await QRCode.default.toDataURL(entrada.codigo, {
          width: 400, margin: 1, errorCorrectionLevel: 'M',
        })
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
        doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] })

        // Código abajo del QR
        doc.fontSize(7).fillColor('#374151').font('Courier-Bold')
           .text(entrada.codigo, rightColX, qrY + qrSize + 8, { width: rightColW, align: 'center' })

        // Nota al pie
        doc.fontSize(8).fillColor('#6b7280').font('Helvetica')
           .text('Presente este código QR al ingresar al evento',
             rightColX, qrY + qrSize + 22, { width: rightColW, align: 'center' })
      } catch (err) {
        console.error('Error generando QR:', err)
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera un ZIP con un PDF por cada entrada, o un solo PDF si entradas.length === 1.
 * Devuelve { buffer, contentType, filename, isZip }.
 */
async function generarEntradasArchivo(entradas, nombreComprador, eventoCodigo = 'evento') {
  // Cargar logo del club una sola vez
  let logoPath = null
  try {
    logoPath = path.join(__dirname, '../../../client/public/images/logo.png')
    await fs.access(logoPath)
  } catch {
    logoPath = null
  }

  // Generar PDFs en paralelo
  const pdfs = await Promise.all(
    entradas.map(async (e) => ({
      codigo: e.codigo,
      buffer: await generarPDFUnaEntrada(e, nombreComprador, logoPath),
    }))
  )

  // Si es 1 sola entrada → devolver el PDF directo (no zip)
  if (pdfs.length === 1) {
    return {
      buffer: pdfs[0].buffer,
      contentType: 'application/pdf',
      filename: `entrada-${eventoCodigo}-${pdfs[0].codigo}.pdf`,
      isZip: false,
      pdfs,
    }
  }

  // Múltiples entradas: empaquetar en ZIP
  const zipBuffer = await new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks = []
    archive.on('data', c => chunks.push(c))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
    for (const p of pdfs) {
      archive.append(p.buffer, { name: `entrada-${p.codigo}.pdf` })
    }
    archive.finalize()
  })

  return {
    buffer: zipBuffer,
    contentType: 'application/zip',
    filename: `entradas-${eventoCodigo}.zip`,
    isZip: true,
    pdfs,
  }
}

// Función para generar HTML de tickets con diseño horizontal compacto
async function generarHTMLTickets(entradas, nombreComprador) {
  // Cargar el logo del club
  let logoBase64 = ''
  try {
    const logoPath = path.join(__dirname, '../../../client/public/images/logo.png')
    const logoBuffer = await fs.readFile(logoPath)
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
  } catch (error) {
    console.error('Error cargando logo:', error)
    // Si no se puede cargar, usar un placeholder
    logoBase64 = ''
  }

  const ticketsHTML = entradas.map(entrada => {
    const evento = entrada.evento
    const qrData = entrada.codigo

    // Formatear fecha y hora
    const fechaFormateada = new Date(evento.fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    return `
      <div style="page-break-inside: avoid; margin-bottom: 15px;">
        <div style="
          border: 2px solid #DC2626;
          border-radius: 6px;
          padding: 10px;
          background: white;
          display: flex;
          align-items: stretch;
          min-height: 140px;
        ">
          <!-- Logo del Club -->
          <div style="
            width: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: 2px solid #DC2626;
            padding-right: 10px;
            flex-shrink: 0;
          ">
            <div style="text-align: center;">
              ${logoBase64 ? `
                <img
                  src="${logoBase64}"
                  alt="Logo Club"
                  style="width: 70px; height: auto; max-height: 70px; object-fit: contain; margin: 0 auto;"
                />
              ` : `
                <div style="
                  width: 60px;
                  height: 60px;
                  background: #DC2626;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto;
                ">
                  <span style="color: white; font-size: 24px; font-weight: bold;">CSP</span>
                </div>
              `}
            </div>
          </div>

          <!-- Información del Evento -->
          <div style="
            flex: 1;
            padding: 0 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          ">
            <h1 style="
              margin: 0 0 8px 0;
              color: #DC2626;
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
              line-height: 1.1;
            ">ENTRADA DE ${evento.nombre.toUpperCase()}</h1>

            <div style="margin-bottom: 5px;">
              <p style="margin: 0; color: #6b7280; font-size: 8px; text-transform: uppercase; font-weight: 600;">Fecha</p>
              <p style="margin: 1px 0 0 0; color: #111827; font-size: 11px; font-weight: 600;">${fechaFormateada}</p>
            </div>

            <div style="margin-bottom: 5px;">
              <p style="margin: 0; color: #6b7280; font-size: 8px; text-transform: uppercase; font-weight: 600;">Hora</p>
              <p style="margin: 1px 0 0 0; color: #111827; font-size: 11px; font-weight: 600;">${evento.hora}</p>
            </div>

            ${evento.ubicacion ? `
              <div style="margin-bottom: 5px;">
                <p style="margin: 0; color: #6b7280; font-size: 8px; text-transform: uppercase; font-weight: 600;">Ubicación</p>
                <p style="margin: 1px 0 0 0; color: #111827; font-size: 10px; font-weight: 600;">${evento.ubicacion}</p>
              </div>
            ` : ''}

            <div style="display: flex; gap: 15px; margin-top: 5px;">
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 8px; text-transform: uppercase; font-weight: 600;">Categoría</p>
                <p style="margin: 1px 0 0 0; color: #111827; font-size: 10px; font-weight: 600;">${entrada.categoria.nombre}</p>
              </div>
              <div>
                <p style="margin: 0; color: #6b7280; font-size: 8px; text-transform: uppercase; font-weight: 600;">Precio</p>
                <p style="margin: 1px 0 0 0; color: #DC2626; font-size: 12px; font-weight: bold;">
                  $${Number(entrada.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            ${nombreComprador ? `
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 7px; text-transform: uppercase; font-weight: 600;">Comprador</p>
                <p style="margin: 1px 0 0 0; color: #111827; font-size: 9px; font-weight: 600;">${nombreComprador}</p>
              </div>
            ` : ''}
          </div>

          <!-- QR Code -->
          <div style="
            width: 120px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f9fafb;
            border-left: 2px solid #DC2626;
            padding: 8px;
            flex-shrink: 0;
          ">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${qrData}"
              alt="QR Code"
              style="width: 90px; height: 90px; margin-bottom: 5px;"
            />
            <p style="
              margin: 0;
              font-family: 'Courier New', monospace;
              color: #374151;
              font-size: 7px;
              font-weight: bold;
              text-align: center;
              word-break: break-all;
              line-height: 1.2;
            ">${entrada.codigo}</p>
          </div>
        </div>

        <!-- Nota al pie -->
        <p style="
          text-align: center;
          margin: 3px 0 0 0;
          color: #6b7280;
          font-size: 8px;
        ">Presente este código QR al ingresar al evento</p>
      </div>
    `
  }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { margin: 10mm; }
        body {
          margin: 0;
          padding: 10px;
          font-family: Arial, sans-serif;
        }
      </style>
    </head>
    <body>
      ${ticketsHTML}
    </body>
    </html>
  `
}

export { generarPDFUnaEntrada }
export default router

