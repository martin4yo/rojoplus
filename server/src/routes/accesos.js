import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authAdmin, checkPermiso } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

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
router.post('/validar', async (req, res) => {
  try {
    const { dispositivoId, tipoLectura, valorLeido } = req.body

    if (!dispositivoId || !tipoLectura || !valorLeido) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos'
      })
    }

    let persona = null
    let permitido = false
    let motivo = ''
    let mensaje = ''
    let tipo = '' // 'SOCIO' o 'HABILITACION'

    // 1. Buscar según el tipo de lectura
    if (tipoLectura === 'QR') {
      // Buscar por tokenPortal
      persona = await prisma.socio.findUnique({
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
      tipo = 'SOCIO'
    } else if (tipoLectura === 'DNI') {
      // Buscar por documento en Socios
      persona = await prisma.socio.findFirst({
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
        const habilitacion = await prisma.habilitacionTemporal.findFirst({
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
      persona = await prisma.socio.findUnique({
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

    // 2. Si no se encontró la persona
    if (!persona) {
      return res.json({
        success: true,
        data: {
          permitido: false,
          motivo: 'NO_ENCONTRADO',
          mensaje: 'DNI no registrado - Diríjase a Recepción',
          persona: null,
          tipo: null
        }
      })
    }

    // 3. Validar según el tipo
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
router.post('/registrar', async (req, res) => {
  try {
    const {
      dispositivoId,
      tipoLectura,
      valorLeido,
      resultado,
      motivoRechazo,
      socioId,
      habilitacionTemporalId,
      modoValidacion
    } = req.body

    // Crear registro de acceso
    const registro = await prisma.registroAcceso.create({
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
      await prisma.intentoAccesoDenegado.create({
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
      await prisma.habilitacionTemporal.update({
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
router.get('/cache-socios', async (req, res) => {
  try {
    const dispositivoId = req.query.dispositivoId

    // Actualizar último ping del dispositivo
    if (dispositivoId) {
      await prisma.dispositivoAcceso.update({
        where: { id: parseInt(dispositivoId) },
        data: { ultimoPing: new Date() }
      }).catch(() => {}) // Ignorar si no existe
    }

    // Obtener socios VIGENTES
    const socios = await prisma.socio.findMany({
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
    const habilitaciones = await prisma.habilitacionTemporal.findMany({
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
router.get('/habilitaciones', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
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

    const habilitaciones = await prisma.habilitacionTemporal.findMany({
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
router.post('/habilitaciones', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
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

    const habilitacion = await prisma.habilitacionTemporal.create({
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
router.put('/habilitaciones/:id', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
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

    const habilitacion = await prisma.habilitacionTemporal.update({
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
router.delete('/habilitaciones/:id', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { id } = req.params

    const habilitacion = await prisma.habilitacionTemporal.update({
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
router.get('/intentos-denegados', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { resuelto } = req.query

    const where = {}
    if (resuelto !== undefined) {
      where.resuelto = resuelto === 'true'
    }

    const intentos = await prisma.intentoAccesoDenegado.findMany({
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
router.post('/intentos-denegados/:dni/habilitar', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
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
    const habilitacion = await prisma.habilitacionTemporal.create({
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
    await prisma.intentoAccesoDenegado.updateMany({
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
router.delete('/intentos-denegados/:dni', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { dni } = req.params

    await prisma.intentoAccesoDenegado.deleteMany({
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
router.get('/registros', authAdmin, checkPermiso('ACCESOS_VER'), async (req, res) => {
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
      prisma.registroAcceso.findMany({
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
      prisma.registroAcceso.count({ where })
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
router.post('/abrir-molinete', authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { dispositivoId, valorLeido, socioId } = req.body
    const adminId = req.admin?.id || 1

    // Registrar acceso manual
    await prisma.registroAcceso.create({
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

// ============================================
// DISPOSITIVOS
// ============================================

/**
 * GET /api/accesos/dispositivos
 * Lista todos los dispositivos de acceso
 */
router.get('/dispositivos', authAdmin, checkPermiso('ACCESOS_VER'), async (req, res) => {
  try {
    const dispositivos = await prisma.dispositivoAcceso.findMany({
      orderBy: { nombre: 'asc' }
    })

    res.json({
      success: true,
      data: dispositivos
    })

  } catch (error) {
    console.error('Error obteniendo dispositivos:', error)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo dispositivos'
    })
  }
})

export default router
