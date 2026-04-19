import express from 'express'
import crypto from 'crypto'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { authDispositivo } from '../middleware/authDispositivo.js'
import { extractTenant } from '../middleware/extractTenant.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'

const router = express.Router()

// Middleware para rutas admin del panel: extrae tenant por subdomain + instancia req.db
const tenantForAdmin = (req, res, next) => {
  extractTenant(req, res, (err) => {
    if (err) return next(err)
    req.db = createTenantPrisma(req.tenantId)
    next()
  })
}

// ============================================
// VALIDACIÓN DE ACCESO
// ============================================

/**
 * POST /api/accesos/validar
 * Valida si una persona puede acceder al club
 *
 * Body: { dispositivoId, tipoLectura, valorLeido }
 * Returns: { permitido, motivo, persona, mensaje }
 */
router.post('/validar', authDispositivo, async (req, res) => {
  try {
    const { dispositivoId, tipoLectura, valorLeido } = req.body

    // Solo tipoLectura y valorLeido son obligatorios, dispositivoId es opcional
    if (!tipoLectura || !valorLeido) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos'
      })
    }

    let persona = null
    let permitido = false
    let motivo = ''
    let mensaje = ''
    let tipo = '' // 'SOCIO', 'HABILITACION', o 'ENTRADA_EVENTO'
    let entrada = null // Para entradas de eventos

    // 1. Buscar según el tipo de lectura
    if (tipoLectura === 'QR') {
      // Primero buscar por tokenPortal (Socios)
      persona = await req.db.socio.findUnique({
        where: { tokenPortal: valorLeido },
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          estado: true,
          rfidUid: true,
          tokenPortal: true
        }
      })

      if (persona) {
        tipo = 'SOCIO'
      } else {
        // Si no es un socio, buscar en entradas de eventos
        entrada = await req.db.entrada.findUnique({
          where: { codigo: valorLeido },
          include: {
            evento: true,
            categoria: true,
            ingreso: true
          }
        })

        if (entrada) {
          tipo = 'ENTRADA_EVENTO'
        }
      }
    } else if (tipoLectura === 'DNI') {
      // Buscar por documento en Socios
      persona = await req.db.socio.findFirst({
        where: { documento: valorLeido },
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          estado: true,
          rfidUid: true,
          tokenPortal: true
        }
      })

      if (persona) {
        tipo = 'SOCIO'
      } else {
        // Buscar en Habilitaciones Temporales
        const habilitacion = await req.db.habilitacionTemporal.findFirst({
          where: {
            documento: valorLeido,
            activo: true
          },
          orderBy: { createdAt: 'desc' }
        })

        if (habilitacion) {
          persona = habilitacion
          tipo = 'HABILITACION'
        }
      }
    } else if (tipoLectura === 'RFID') {
      // Buscar por rfidUid
      persona = await req.db.socio.findUnique({
        where: { rfidUid: valorLeido },
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          documento: true,
          estado: true,
          rfidUid: true,
          tokenPortal: true
        }
      })
      tipo = 'SOCIO'
    }

    // 2. Si no se encontró ni persona ni entrada
    if (!persona && !entrada) {
      return res.json({
        success: true,
        data: {
          permitido: false,
          motivo: 'NO_ENCONTRADO',
          mensaje: 'Código no registrado - Diríjase a Recepción',
          persona: null,
          tipo: null
        }
      })
    }

    // 3. Validar según el tipo
    if (tipo === 'ENTRADA_EVENTO') {
      // Validar estado de la entrada
      if (entrada.estado === 'ANULADA') {
        permitido = false
        motivo = 'ENTRADA_ANULADA'
        mensaje = 'Entrada anulada - No válida'
      } else if (entrada.estado === 'USADA' || entrada.ingreso) {
        permitido = false
        motivo = 'ENTRADA_USADA'
        mensaje = 'Esta entrada ya fue utilizada'
      } else if (entrada.estado === 'VALIDA') {
        // Validar fecha del evento (solo el día) - usar UTC para evitar problemas de timezone
        const ahora = new Date()
        const fechaEvento = new Date(entrada.evento.fecha)

        // Extraer día actual en UTC
        const hoy = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()))

        // Extraer día del evento en UTC
        const diaEvento = new Date(Date.UTC(
          fechaEvento.getUTCFullYear(),
          fechaEvento.getUTCMonth(),
          fechaEvento.getUTCDate()
        ))

        if (hoy.getTime() !== diaEvento.getTime()) {
          permitido = false
          motivo = 'FECHA_INVALIDA'
          // Formatear fecha del evento usando UTC
          const dia = String(fechaEvento.getUTCDate()).padStart(2, '0')
          const mes = String(fechaEvento.getUTCMonth() + 1).padStart(2, '0')
          const anio = fechaEvento.getUTCFullYear()
          mensaje = `Entrada válida para ${dia}/${mes}/${anio}`
        } else {
          permitido = true
          motivo = 'ENTRADA_VALIDA'
          mensaje = `${entrada.evento.nombre} - ${entrada.categoria.nombre}`
        }
      }

      persona = {
        id: entrada.id,
        nombre: entrada.nombreComprador,
        evento: entrada.evento.nombre,
        categoria: entrada.categoria.nombre,
        codigo: entrada.codigo
      }
    } else
    if (tipo === 'SOCIO') {
      // Validar estado VIGENTE
      if (persona.estado === 'VIGENTE') {
        permitido = true
        motivo = 'SOCIO_VIGENTE'
        mensaje = `Bienvenido/a ${persona.apellidoNombre}`
      } else {
        permitido = false
        motivo = 'NO_VIGENTE'
        mensaje = `Socio ${persona.estado} - Diríjase a Secretaría`
      }
    } else if (tipo === 'HABILITACION') {
      const ahora = new Date()
      const habilitacion = persona

      // Validar fecha
      if (ahora < habilitacion.fechaDesde || ahora > habilitacion.fechaHasta) {
        permitido = false
        motivo = 'VENCIDO'
        mensaje = 'Habilitación vencida - Diríjase a Recepción'
      }
      // Validar límite de accesos
      else if (habilitacion.accesosPermitidos && habilitacion.accesosUsados >= habilitacion.accesosPermitidos) {
        permitido = false
        motivo = 'LIMITE_ALCANZADO'
        mensaje = 'Límite de accesos alcanzado'
      }
      // Validar horario
      else if (habilitacion.horarioDesde && habilitacion.horarioHasta) {
        const horaActual = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0')
        if (horaActual < habilitacion.horarioDesde || horaActual > habilitacion.horarioHasta) {
          permitido = false
          motivo = 'HORARIO'
          mensaje = `Acceso permitido solo de ${habilitacion.horarioDesde} a ${habilitacion.horarioHasta}`
        } else {
          permitido = true
          motivo = 'HABILITACION_VIGENTE'
          mensaje = `Bienvenido/a ${habilitacion.nombreCompleto}`
        }
      } else {
        permitido = true
        motivo = 'HABILITACION_VIGENTE'
        mensaje = `Bienvenido/a ${habilitacion.nombreCompleto}`
      }
    }

    // 4. Formatear respuesta
    const personaFormateada = tipo === 'SOCIO'
      ? {
          id: persona.id,
          nombre: persona.apellidoNombre,
          nroSocio: persona.nroSocio,
          documento: persona.documento,
          estado: persona.estado
        }
      : {
          id: persona.id,
          nombre: persona.nombreCompleto,
          documento: persona.documento,
          motivo: persona.motivo
        }

    res.json({
      success: true,
      data: {
        permitido,
        motivo,
        mensaje,
        persona: personaFormateada,
        tipo
      }
    })

  } catch (error) {
    console.error('Error validando acceso:', error)
    res.status(500).json({
      success: false,
      error: 'Error validando acceso'
    })
  }
})

// ============================================
// REGISTRO DE ACCESO
// ============================================

/**
 * POST /api/accesos/registrar
 * Registra un intento de acceso (permitido o denegado)
 *
 * Body: { dispositivoId, tipoLectura, valorLeido, resultado, motivo, socioId?, habilitacionTemporalId?, modoValidacion }
 */
router.post('/registrar', authDispositivo, async (req, res) => {
  try {
    const {
      tipoLectura,
      valorLeido,
      resultado,
      motivoRechazo,
      socioId,
      habilitacionTemporalId,
      modoValidacion
    } = req.body

    // El dispositivoId lo tomamos del middleware (token autenticado), no del body,
    // para evitar que un dispositivo registre accesos como si fuera otro.
    const dispositivoId = req.dispositivo.id

    // Crear registro de acceso
    const registro = await req.db.registroAcceso.create({
      data: {
        dispositivoId,
        socioId: socioId || null,
        habilitacionTemporalId: habilitacionTemporalId || null,
        tipoLectura,
        valorLeido,
        resultado,
        motivoRechazo: motivoRechazo || null,
        modoValidacion: modoValidacion || 'ONLINE'
      }
    })

    // Si fue denegado por NO_ENCONTRADO y es DNI, crear intento denegado
    if (resultado === 'DENEGADO' && motivoRechazo === 'NO_ENCONTRADO' && tipoLectura === 'DNI') {
      await req.db.intentoAccesoDenegado.create({
        data: {
          dispositivoId,
          tipoLectura,
          valorLeido,
          motivoRechazo
        }
      })
    }

    // Si fue permitido y es habilitación temporal, incrementar contador
    if (resultado === 'PERMITIDO' && habilitacionTemporalId) {
      await req.db.habilitacionTemporal.update({
        where: { id: habilitacionTemporalId },
        data: {
          accesosUsados: { increment: 1 }
        }
      })
    }

    res.json({
      success: true,
      data: registro
    })

  } catch (error) {
    console.error('Error registrando acceso:', error)
    res.status(500).json({
      success: false,
      error: 'Error registrando acceso'
    })
  }
})

// ============================================
// CACHE PARA MODO OFFLINE
// ============================================

/**
 * GET /api/accesos/cache-socios
 * Retorna datos para cache local del molinete
 */
router.get('/cache-socios', authDispositivo, async (req, res) => {
  try {
    const dispositivoId = req.query.dispositivoId

    // Actualizar último ping del dispositivo
    if (dispositivoId) {
      await req.db.dispositivoAcceso.update({
        where: { id: parseInt(dispositivoId) },
        data: { ultimoPing: new Date() }
      }).catch(() => {}) // Ignorar si no existe
    }

    // Obtener socios VIGENTES
    const socios = await req.db.socio.findMany({
      where: {
        estado: 'VIGENTE'
      },
      select: {
        id: true,
        nroSocio: true,
        apellidoNombre: true,
        documento: true,
        estado: true,
        tokenPortal: true,
        rfidUid: true
      }
    })

    // Obtener habilitaciones vigentes
    const ahora = new Date()
    const habilitaciones = await req.db.habilitacionTemporal.findMany({
      where: {
        activo: true,
        fechaHasta: {
          gte: ahora
        }
      },
      select: {
        id: true,
        documento: true,
        nombreCompleto: true,
        fechaDesde: true,
        fechaHasta: true,
        accesosPermitidos: true,
        accesosUsados: true,
        horarioDesde: true,
        horarioHasta: true,
        motivo: true
      }
    })

    res.json({
      success: true,
      data: {
        socios,
        habilitaciones,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error obteniendo cache:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo cache'
    })
  }
})

// ============================================
// HABILITACIONES TEMPORALES - CRUD
// ============================================

/**
 * GET /api/accesos/habilitaciones
 * Lista todas las habilitaciones temporales
 */
router.get('/habilitaciones', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { activo, vencidas } = req.query

    const where = {}
    if (activo !== undefined) {
      where.activo = activo === 'true'
    }
    if (vencidas === 'false') {
      where.fechaHasta = { gte: new Date() }
    } else if (vencidas === 'true') {
      where.fechaHasta = { lt: new Date() }
    }

    const habilitaciones = await req.db.habilitacionTemporal.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      success: true,
      data: habilitaciones
    })

  } catch (error) {
    console.error('Error obteniendo habilitaciones:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo habilitaciones'
    })
  }
})

/**
 * POST /api/accesos/habilitaciones
 * Crea una nueva habilitación temporal
 */
router.post('/habilitaciones', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const {
      documento,
      nombreCompleto,
      motivo,
      diasHabilitados,
      accesosPermitidos,
      horarioDesde,
      horarioHasta,
      observaciones
    } = req.body

    const adminId = req.admin?.id || 1

    const fechaDesde = new Date()
    const fechaHasta = new Date()
    fechaHasta.setDate(fechaHasta.getDate() + diasHabilitados)

    const habilitacion = await req.db.habilitacionTemporal.create({
      data: {
        documento,
        nombreCompleto,
        motivo,
        diasHabilitados,
        fechaDesde,
        fechaHasta,
        accesosPermitidos: accesosPermitidos || null,
        horarioDesde: horarioDesde || null,
        horarioHasta: horarioHasta || null,
        observaciones: observaciones || null,
        creadoPor: adminId,
        activo: true
      }
    })

    res.json({
      success: true,
      data: habilitacion
    })

  } catch (error) {
    console.error('Error creando habilitación:', error)
    res.status(500).json({
      success: false,
      error: 'Error creando habilitación'
    })
  }
})

/**
 * PUT /api/accesos/habilitaciones/:id
 * Actualiza una habilitación temporal
 */
router.put('/habilitaciones/:id', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      nombreCompleto,
      motivo,
      diasHabilitados,
      accesosPermitidos,
      horarioDesde,
      horarioHasta,
      observaciones,
      activo
    } = req.body

    const updateData = {}
    if (nombreCompleto !== undefined) updateData.nombreCompleto = nombreCompleto
    if (motivo !== undefined) updateData.motivo = motivo
    if (accesosPermitidos !== undefined) updateData.accesosPermitidos = accesosPermitidos
    if (horarioDesde !== undefined) updateData.horarioDesde = horarioDesde
    if (horarioHasta !== undefined) updateData.horarioHasta = horarioHasta
    if (observaciones !== undefined) updateData.observaciones = observaciones
    if (activo !== undefined) updateData.activo = activo

    if (diasHabilitados !== undefined) {
      updateData.diasHabilitados = diasHabilitados
      const fechaHasta = new Date()
      fechaHasta.setDate(fechaHasta.getDate() + diasHabilitados)
      updateData.fechaHasta = fechaHasta
    }

    const habilitacion = await req.db.habilitacionTemporal.update({
      where: { id: parseInt(id) },
      data: updateData
    })

    res.json({
      success: true,
      data: habilitacion
    })

  } catch (error) {
    console.error('Error actualizando habilitación:', error)
    res.status(500).json({
      success: false,
      error: 'Error actualizando habilitación'
    })
  }
})

/**
 * DELETE /api/accesos/habilitaciones/:id
 * Elimina (desactiva) una habilitación temporal
 */
router.delete('/habilitaciones/:id', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params

    const habilitacion = await req.db.habilitacionTemporal.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    })

    res.json({
      success: true,
      data: habilitacion
    })

  } catch (error) {
    console.error('Error eliminando habilitación:', error)
    res.status(500).json({
      success: false,
      error: 'Error eliminando habilitación'
    })
  }
})

// ============================================
// INTENTOS ACCESO DENEGADO - CLAVE PARA DNI NO ENCONTRADO
// ============================================

/**
 * GET /api/accesos/intentos-denegados
 * Lista DNIs que intentaron acceder pero no están registrados
 */
router.get('/intentos-denegados', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { resuelto } = req.query

    const where = {}
    if (resuelto !== undefined) {
      where.resuelto = resuelto === 'true'
    }

    const intentos = await req.db.intentoAccesoDenegado.findMany({
      where,
      include: {
        dispositivo: {
          select: {
            nombre: true,
            ubicacion: true
          }
        },
        habilitacion: {
          select: {
            nombreCompleto: true,
            fechaHasta: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    })

    // Agrupar por DNI y contar intentos
    const agrupados = intentos.reduce((acc, intento) => {
      const key = intento.valorLeido
      if (!acc[key]) {
        acc[key] = {
          dni: intento.valorLeido,
          primerIntento: intento.fecha,
          ultimoIntento: intento.fecha,
          cantidad: 0,
          dispositivo: intento.dispositivo,
          resuelto: intento.resuelto,
          habilitacion: intento.habilitacion,
          intentos: []
        }
      }
      acc[key].cantidad++
      acc[key].intentos.push(intento)
      if (intento.fecha > acc[key].ultimoIntento) {
        acc[key].ultimoIntento = intento.fecha
      }
      if (intento.fecha < acc[key].primerIntento) {
        acc[key].primerIntento = intento.fecha
      }
      return acc
    }, {})

    const resultado = Object.values(agrupados)

    res.json({
      success: true,
      data: resultado
    })

  } catch (error) {
    console.error('Error obteniendo intentos denegados:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo intentos denegados'
    })
  }
})

/**
 * POST /api/accesos/intentos-denegados/:dni/habilitar
 * Crea habilitación para un DNI denegado y marca intentos como resueltos
 */
router.post('/intentos-denegados/:dni/habilitar', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { dni } = req.params
    const {
      nombreCompleto,
      motivo,
      diasHabilitados,
      accesosPermitidos,
      observaciones
    } = req.body

    const adminId = req.admin?.id || 1

    const fechaDesde = new Date()
    const fechaHasta = new Date()
    fechaHasta.setDate(fechaHasta.getDate() + diasHabilitados)

    // Crear habilitación
    const habilitacion = await req.db.habilitacionTemporal.create({
      data: {
        documento: dni,
        nombreCompleto,
        motivo,
        diasHabilitados,
        fechaDesde,
        fechaHasta,
        accesosPermitidos: accesosPermitidos || null,
        observaciones: observaciones || null,
        creadoPor: adminId,
        activo: true
      }
    })

    // Marcar intentos como resueltos
    await req.db.intentoAccesoDenegado.updateMany({
      where: {
        valorLeido: dni,
        resuelto: false
      },
      data: {
        resuelto: true,
        habilitacionId: habilitacion.id,
        resueltoPor: adminId,
        fechaResolucion: new Date()
      }
    })

    res.json({
      success: true,
      data: habilitacion
    })

  } catch (error) {
    console.error('Error habilitando DNI:', error)
    res.status(500).json({
      success: false,
      error: 'Error habilitando DNI'
    })
  }
})

/**
 * DELETE /api/accesos/intentos-denegados/:dni
 * Descarta intentos de un DNI sin crear habilitación
 */
router.delete('/intentos-denegados/:dni', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { dni } = req.params

    await req.db.intentoAccesoDenegado.deleteMany({
      where: {
        valorLeido: dni
      }
    })

    res.json({
      success: true,
      message: 'Intentos descartados'
    })

  } catch (error) {
    console.error('Error descartando intentos:', error)
    res.status(500).json({
      success: false,
      error: 'Error descartando intentos'
    })
  }
})

// ============================================
// REGISTROS Y MONITOREO
// ============================================

/**
 * GET /api/accesos/registros
 * Obtiene el historial de accesos con filtros
 */
router.get('/registros', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_VER'), async (req, res) => {
  try {
    const { dispositivoId, resultado, fechaDesde, fechaHasta, page = 1, limit = 50 } = req.query

    const where = {}
    if (dispositivoId) where.dispositivoId = parseInt(dispositivoId)
    if (resultado) where.resultado = resultado
    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
      if (fechaHasta) where.fecha.lte = new Date(fechaHasta)
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [registros, total] = await Promise.all([
      req.db.registroAcceso.findMany({
        where,
        include: {
          dispositivo: {
            select: {
              nombre: true,
              ubicacion: true
            }
          },
          socio: {
            select: {
              nroSocio: true,
              apellidoNombre: true,
              documento: true
            }
          },
          habilitacionTemporal: {
            select: {
              nombreCompleto: true,
              documento: true
            }
          }
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      req.db.registroAcceso.count({ where })
    ])

    res.json({
      success: true,
      data: registros,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })

  } catch (error) {
    console.error('Error obteniendo registros:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo registros'
    })
  }
})

/**
 * POST /api/accesos/abrir-molinete
 * Apertura manual del molinete desde PWA
 */
router.post('/abrir-molinete', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { dispositivoId, valorLeido, socioId } = req.body
    const adminId = req.admin?.id || 1

    // Registrar acceso manual
    await req.db.registroAcceso.create({
      data: {
        dispositivoId,
        socioId: socioId || null,
        tipoLectura: 'QR',
        valorLeido,
        resultado: 'PERMITIDO',
        motivoRechazo: null,
        modoValidacion: 'MANUAL_PWA'
      }
    })

    // Aquí iría la lógica para enviar comando al molinete
    // Por ahora solo retornamos success

    res.json({
      success: true,
      message: 'Comando de apertura enviado'
    })

  } catch (error) {
    console.error('Error abriendo molinete:', error)
    res.status(500).json({
      success: false,
      error: 'Error abriendo molinete'
    })
  }
})

/**
 * POST /api/accesos/registrar-ingreso-entrada
 * Registra el ingreso de una entrada de evento
 */
router.post('/registrar-ingreso-entrada', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { entradaId, dispositivoId, codigoEntrada } = req.body
    const adminId = req.admin?.id || 1

    // Obtener la entrada
    const entrada = await req.db.entrada.findUnique({
      where: { id: entradaId },
      include: { evento: true }
    })

    if (!entrada) {
      return res.status(404).json({
        success: false,
        error: 'Entrada no encontrada'
      })
    }

    // Verificar que no haya sido usada
    const ingresoExistente = await req.db.ingresoEntrada.findUnique({
      where: { entradaId }
    })

    if (ingresoExistente) {
      return res.status(400).json({
        success: false,
        error: 'Esta entrada ya fue utilizada'
      })
    }

    // Registrar el ingreso
    await req.db.ingresoEntrada.create({
      data: {
        entradaId,
        eventoId: entrada.eventoId,
        dispositivoId: dispositivoId || null,
        validadoPor: adminId,
        modoValidacion: 'MANUAL_PWA'
      }
    })

    // Actualizar estado de la entrada
    await req.db.entrada.update({
      where: { id: entradaId },
      data: { estado: 'USADA' }
    })

    // Registrar en log de accesos (si existe la tabla)
    try {
      await req.db.registroAcceso.create({
        data: {
          dispositivoId: dispositivoId || null,
          socioId: entrada.socioId || null,
          tipoLectura: 'QR',
          valorLeido: codigoEntrada,
          resultado: 'PERMITIDO',
          motivoRechazo: null,
          modoValidacion: 'MANUAL_PWA'
        }
      })
    } catch (err) {
      // Si no existe la tabla o hay error, continuar
      console.log('No se pudo registrar en RegistroAcceso:', err.message)
    }

    res.json({
      success: true,
      message: 'Ingreso registrado correctamente'
    })

  } catch (error) {
    console.error('Error registrando ingreso:', error)
    res.status(500).json({
      success: false,
      error: 'Error registrando ingreso'
    })
  }
})

// ============================================
// DISPOSITIVOS
// ============================================

/**
 * GET /api/accesos/dispositivos
 * Lista todos los dispositivos de acceso
 */
router.get('/dispositivos', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_VER'), async (req, res) => {
  try {
    const dispositivos = await req.db.dispositivoAcceso.findMany({
      orderBy: { nombre: 'asc' }
    })

    // Nunca exponer el token en el listado — solo indicar si existe
    const safe = dispositivos.map(({ apiToken, ...d }) => ({
      ...d,
      tieneToken: !!apiToken
    }))

    res.json({ success: true, data: safe })

  } catch (error) {
    console.error('Error obteniendo dispositivos:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo dispositivos'
    })
  }
})

/**
 * POST /api/accesos/dispositivos
 * Crea un nuevo dispositivo de acceso
 */
router.post('/dispositivos', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const {
      codigo, nombre, ubicacion, ipLocal, puerto, puertoSerialRFID,
      tipoRelay, pinRelay, tiempoApertura, modoOffline, intervaloSync, activo
    } = req.body

    if (!codigo || !nombre || !ubicacion) {
      return res.status(400).json({ success: false, error: 'codigo, nombre y ubicacion son obligatorios' })
    }

    const dispositivo = await req.db.dispositivoAcceso.create({
      data: {
        codigo, nombre, ubicacion,
        ipLocal: ipLocal || null,
        puerto: puerto ?? 3002,
        puertoSerialRFID: puertoSerialRFID || null,
        tipoRelay: tipoRelay || 'GPIO',
        pinRelay: pinRelay ?? null,
        tiempoApertura: tiempoApertura ?? 3,
        modoOffline: modoOffline ?? true,
        intervaloSync: intervaloSync ?? 5,
        activo: activo ?? true
      }
    })

    const { apiToken, ...safe } = dispositivo
    res.json({ success: true, data: { ...safe, tieneToken: false } })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ya existe un dispositivo con ese código' })
    }
    console.error('Error creando dispositivo:', error)
    res.status(500).json({ success: false, error: 'Error creando dispositivo' })
  }
})

/**
 * PUT /api/accesos/dispositivos/:id
 * Actualiza un dispositivo
 */
router.put('/dispositivos/:id', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const {
      codigo, nombre, ubicacion, ipLocal, puerto, puertoSerialRFID,
      tipoRelay, pinRelay, tiempoApertura, modoOffline, intervaloSync, activo
    } = req.body

    const dispositivo = await req.db.dispositivoAcceso.update({
      where: { id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(nombre !== undefined && { nombre }),
        ...(ubicacion !== undefined && { ubicacion }),
        ...(ipLocal !== undefined && { ipLocal: ipLocal || null }),
        ...(puerto !== undefined && { puerto }),
        ...(puertoSerialRFID !== undefined && { puertoSerialRFID: puertoSerialRFID || null }),
        ...(tipoRelay !== undefined && { tipoRelay }),
        ...(pinRelay !== undefined && { pinRelay }),
        ...(tiempoApertura !== undefined && { tiempoApertura }),
        ...(modoOffline !== undefined && { modoOffline }),
        ...(intervaloSync !== undefined && { intervaloSync }),
        ...(activo !== undefined && { activo })
      }
    })

    const { apiToken, ...safe } = dispositivo
    res.json({ success: true, data: { ...safe, tieneToken: !!apiToken } })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Dispositivo no encontrado' })
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Ya existe un dispositivo con ese código' })
    }
    console.error('Error actualizando dispositivo:', error)
    res.status(500).json({ success: false, error: 'Error actualizando dispositivo' })
  }
})

/**
 * DELETE /api/accesos/dispositivos/:id
 * Elimina un dispositivo
 */
router.delete('/dispositivos/:id', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await req.db.dispositivoAcceso.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Dispositivo no encontrado' })
    }
    if (error.code === 'P2003') {
      return res.status(409).json({ success: false, error: 'No se puede eliminar: el dispositivo tiene registros de acceso' })
    }
    console.error('Error eliminando dispositivo:', error)
    res.status(500).json({ success: false, error: 'Error eliminando dispositivo' })
  }
})

/**
 * POST /api/accesos/dispositivos/:id/regenerar-token
 * Genera (o rota) el API token del dispositivo.
 * Devuelve el token en claro UNA SOLA VEZ — el admin debe copiarlo ahora.
 */
router.post('/dispositivos/:id/regenerar-token', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const token = `tok_${crypto.randomBytes(24).toString('hex')}`

    const dispositivo = await req.db.dispositivoAcceso.update({
      where: { id },
      data: { apiToken: token }
    })

    res.json({
      success: true,
      data: {
        id: dispositivo.id,
        codigo: dispositivo.codigo,
        nombre: dispositivo.nombre,
        apiToken: token
      }
    })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Dispositivo no encontrado' })
    }
    console.error('Error regenerando token:', error)
    res.status(500).json({ success: false, error: 'Error regenerando token' })
  }
})

/**
 * POST /api/accesos/dispositivos/:id/revocar-token
 * Revoca el token actual del dispositivo (lo deja sin token).
 */
router.post('/dispositivos/:id/revocar-token', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await req.db.dispositivoAcceso.update({
      where: { id },
      data: { apiToken: null }
    })
    res.json({ success: true })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Dispositivo no encontrado' })
    }
    console.error('Error revocando token:', error)
    res.status(500).json({ success: false, error: 'Error revocando token' })
  }
})

export default router
