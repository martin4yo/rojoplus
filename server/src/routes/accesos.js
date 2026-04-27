import express from 'express'
import crypto from 'crypto'
import { randomUUID } from 'crypto'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { authDispositivo } from '../middleware/authDispositivo.js'
import { extractTenant } from '../middleware/extractTenant.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { crearOrdenQRDinamica, borrarOrdenQRDinamica, obtenerPago, asegurarPOS } from '../services/mercadoPagoQR.js'

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
      // Si el QR contiene una URL del portal (https://.../s/<token>), extraer el token.
      // Esto permite reutilizar el mismo QR del carnet digital tanto para comercios
      // (que escanean con el celular y abren la URL) como para el lector del molinete
      // (que necesita el tokenPortal raw).
      let tokenBuscado = valorLeido
      const matchUrl = String(valorLeido).match(/\/s\/([a-f0-9-]{20,})/i)
      if (matchUrl) tokenBuscado = matchUrl[1]

      // Primero buscar por tokenPortal (Socios)
      persona = await req.db.socio.findFirst({
        where: { tokenPortal: tokenBuscado },
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
          where: { codigo: tokenBuscado },
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
      nombreCompleto,
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
        nombreCompleto: nombreCompleto || null,
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
          nombreCompleto: nombreCompleto || null,
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

/**
 * GET /api/accesos/tenant-info
 * Devuelve nombre y logo del tenant autenticado (para que el monitor del molinete
 * los muestre en su header). Usa el token del dispositivo.
 */
router.get('/tenant-info', authDispositivo, async (req, res) => {
  res.json({
    success: true,
    data: {
      nombre: req.tenant.nombre,
      subdomain: req.tenant.subdomain,
      logoUrl: req.tenant.logoUrl || null
    }
  })
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
          nombreCompleto: intento.nombreCompleto || null,
          primerIntento: intento.fecha,
          ultimoIntento: intento.fecha,
          cantidad: 0,
          dispositivo: intento.dispositivo,
          resuelto: intento.resuelto,
          habilitacion: intento.habilitacion,
          intentos: []
        }
      }
      // Si el grupo aún no tiene nombre pero este intento sí, heredarlo
      if (!acc[key].nombreCompleto && intento.nombreCompleto) {
        acc[key].nombreCompleto = intento.nombreCompleto
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
 * GET /api/accesos/buscar-socio?q=xxx
 * Busca socios por nombre, número de socio o documento — para el flujo de
 * "permitir acceso manual sin documento". Devuelve estado al día y cantidad
 * de olvidos de documento en los últimos 30 días.
 */
router.get('/buscar-socio', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] })
    }
    const term = q.trim()

    const socios = await req.db.socio.findMany({
      where: {
        OR: [
          { apellidoNombre: { contains: term, mode: 'insensitive' } },
          { nroSocio: { contains: term } },
          { documento: { contains: term } }
        ]
      },
      select: {
        id: true,
        nroSocio: true,
        apellidoNombre: true,
        documento: true,
        estado: true,
        fotoUrl: true,
      },
      take: 15,
      orderBy: { apellidoNombre: 'asc' }
    })

    // Para cada socio, contar olvidos en los últimos 30 días
    const hace30Dias = new Date(Date.now() - 30 * 86400000)
    const sociosConOlvidos = await Promise.all(socios.map(async (s) => {
      const olvidosUltimos30 = await req.db.olvidoDocumento.count({
        where: { socioId: s.id, fecha: { gte: hace30Dias } }
      })
      return { ...s, olvidosUltimos30 }
    }))

    res.json({ success: true, data: sociosConOlvidos })
  } catch (error) {
    console.error('Error buscando socios:', error)
    res.status(500).json({ success: false, error: 'Error en la búsqueda' })
  }
})

/**
 * POST /api/accesos/permitir-manual
 * Permite el acceso de un socio sin documento (lo registra como olvido).
 * Bloquea si el socio NO está vigente (moroso, suspendido, etc).
 * body: { socioId, dispositivoId, motivo (SIN_DNI|SIN_CARNET|OTRO), observaciones }
 */
router.post('/permitir-manual', tenantForAdmin, authAdmin, checkPermiso('ACCESOS_GESTIONAR'), async (req, res) => {
  try {
    const { socioId, dispositivoId, motivo, observaciones } = req.body
    const adminId = req.admin?.id

    if (!socioId) return res.status(400).json({ success: false, error: 'socioId es requerido' })
    if (!motivo) return res.status(400).json({ success: false, error: 'motivo es requerido' })

    const socio = await req.db.socio.findUnique({
      where: { id: parseInt(socioId) },
      select: { id: true, apellidoNombre: true, nroSocio: true, estado: true }
    })
    if (!socio) return res.status(404).json({ success: false, error: 'Socio no encontrado' })

    // Bloqueo: socio NO vigente no puede pasar
    const estadoUp = socio.estado?.toUpperCase() || ''
    const esVigente = estadoUp.includes('VIGENT') || estadoUp.includes('ACTIV')
    if (!esVigente) {
      return res.status(403).json({
        success: false,
        error: `Socio ${socio.estado} — no se puede permitir el acceso. Debe pasar por Secretaría.`,
        code: 'SOCIO_NO_VIGENTE'
      })
    }

    // Crear olvido + registro de acceso en transacción
    await req.db.$transaction(async (tx) => {
      await tx.olvidoDocumento.create({
        data: {
          socioId: socio.id,
          motivo,
          observaciones: observaciones || null,
          registradoPor: adminId
        }
      })

      if (dispositivoId) {
        await tx.registroAcceso.create({
          data: {
            dispositivoId: parseInt(dispositivoId),
            socioId: socio.id,
            tipoLectura: 'MANUAL',
            valorLeido: socio.nroSocio || socio.id.toString(),
            nombreCompleto: socio.apellidoNombre,
            resultado: 'PERMITIDO',
            motivoRechazo: null,
            modoValidacion: 'MANUAL_SIN_DOC'
          }
        })
      }
    })

    // Contar total de olvidos del socio para devolver al frontend
    const totalOlvidos = await req.db.olvidoDocumento.count({ where: { socioId: socio.id } })
    const hace30Dias = new Date(Date.now() - 30 * 86400000)
    const ultimos30 = await req.db.olvidoDocumento.count({
      where: { socioId: socio.id, fecha: { gte: hace30Dias } }
    })

    res.json({
      success: true,
      message: `Acceso permitido a ${socio.apellidoNombre}. Olvido registrado.`,
      data: { totalOlvidos, ultimos30 }
    })
  } catch (error) {
    console.error('Error permitiendo manual:', error)
    res.status(500).json({ success: false, error: 'Error registrando el acceso manual' })
  }
})

/**
 * GET /api/accesos/socios/:id/olvidos
 * Historial de olvidos de documento de un socio.
 */
router.get('/socios/:id/olvidos', tenantForAdmin, authAdmin, async (req, res) => {
  try {
    const socioId = parseInt(req.params.id)
    const olvidos = await req.db.olvidoDocumento.findMany({
      where: { socioId },
      orderBy: { fecha: 'desc' }
    })

    // Resolver nombres de admins (consulta separada)
    const adminIds = [...new Set(olvidos.map(o => o.registradoPor))]
    const admins = adminIds.length
      ? await req.db.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, nombre: true, apellido: true, email: true }
        })
      : []
    const adminMap = new Map(admins.map(a => [a.id, a]))

    const conAdmin = olvidos.map(o => ({
      ...o,
      registradoPorNombre: (() => {
        const a = adminMap.get(o.registradoPor)
        if (!a) return 'Sistema'
        return `${a.nombre || ''} ${a.apellido || ''}`.trim() || a.email
      })()
    }))

    res.json({ success: true, data: conAdmin })
  } catch (error) {
    console.error('Error obteniendo historial de olvidos:', error)
    res.status(500).json({ success: false, error: 'Error obteniendo historial' })
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

// ============================================
// VENTA EN VENTANILLA - PAGO CON QR MERCADO PAGO
// ============================================

const QR_EXPIRES_MINUTES = 5

/**
 * POST /api/admin/accesos/venta-ventanilla/qr
 * Crea una venta en estado PENDIENTE + solicita QR dinámico a MP.
 * Body: { eventoId, items: [{categoriaId, cantidad}], cajaId, medioPagoId, nombreComprador?, dispositivoId? }
 */
router.post('/venta-ventanilla/qr', tenantForAdmin, authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const { eventoId, items, cajaId, medioPagoId, nombreComprador, dispositivoId, socioId } = req.body

    if (!eventoId || !Array.isArray(items) || items.length === 0 || !cajaId || !medioPagoId) {
      return res.status(400).json({ success: false, error: 'Faltan campos: eventoId, items, cajaId, medioPagoId' })
    }

    // Cargar evento y categorías para calcular monto y validar capacidad
    const categoriasIds = items.map(i => parseInt(i.categoriaId))
    const evento = await req.db.evento.findUnique({
      where: { id: parseInt(eventoId) },
      include: { categorias: { where: { id: { in: categoriasIds } } } }
    })
    if (!evento) return res.status(404).json({ success: false, error: 'Evento no encontrado' })
    if (!evento.ventasHabilitadas) return res.status(400).json({ success: false, error: 'Ventas deshabilitadas' })
    if (evento.estado === 'CANCELADO' || evento.estado === 'FINALIZADO') {
      return res.status(400).json({ success: false, error: `Evento ${evento.estado}` })
    }

    // Validar capacidad global (sumando pendientes también para evitar oversell en carrera con webhook)
    const cantidadTotal = items.reduce((s, i) => s + parseInt(i.cantidad), 0)
    if (!evento.permiteSobreventa) {
      const pendientesAgg = await req.db.ventaEventoQRPendiente.aggregate({
        where: { eventoId: parseInt(eventoId), estado: 'PENDIENTE' },
        _count: true,
      })
      // nota: monto no suma capacidad, se usa el count de entradas pendientes de forma conservadora
      const disponibles = evento.capacidadTotal - evento.entradasVendidas
      if (cantidadTotal > disponibles) {
        return res.status(400).json({ success: false, error: `Capacidad: ${disponibles} disponibles` })
      }
    }

    // Calcular monto e items detallados
    const itemsDetalle = []
    let monto = 0
    for (const item of items) {
      const cat = evento.categorias.find(c => c.id === parseInt(item.categoriaId))
      if (!cat || !cat.activo) {
        return res.status(400).json({ success: false, error: `Categoría ${item.categoriaId} no disponible` })
      }
      const cantidad = parseInt(item.cantidad)
      const precio = Number(cat.precioNoSocio)
      itemsDetalle.push({ categoriaId: cat.id, nombre: cat.nombre, cantidad, precio })
      monto += cantidad * precio
    }

    // Crear venta pendiente
    const externalReference = `clubix-ventanilla-${req.tenantId}-${randomUUID()}`
    const expiresAt = new Date(Date.now() + QR_EXPIRES_MINUTES * 60 * 1000)

    const venta = await req.db.ventaEventoQRPendiente.create({
      data: {
        externalReference,
        eventoId: parseInt(eventoId),
        items: itemsDetalle,
        monto,
        estado: 'PENDIENTE',
        cajaId: parseInt(cajaId),
        medioPagoId: parseInt(medioPagoId),
        dispositivoId: dispositivoId ? parseInt(dispositivoId) : null,
        nombreComprador: nombreComprador || 'Venta ventanilla',
        socioId: socioId ? parseInt(socioId) : null,
        expiresAt,
        creadoPor: req.admin.id,
      }
    })

    // Asegurar que el POS exista en MP y generar QR
    try {
      await asegurarPOS({ name: 'Clubix Ventanilla' })
    } catch (err) {
      console.warn('[MP] No se pudo verificar/crear POS (sigue igual):', err.message)
    }

    let mpResp
    try {
      mpResp = await crearOrdenQRDinamica({
        externalReference,
        monto,
        title: `${evento.nombre} - ${cantidadTotal} entrada(s)`,
        items: itemsDetalle.map(i => ({
          title: `${evento.nombre} - ${i.nombre}`,
          quantity: i.cantidad,
          unit_price: i.precio,
        })),
      })
    } catch (err) {
      // Si MP falla, marcar venta como CANCELADA para no dejar basura
      await req.db.ventaEventoQRPendiente.update({
        where: { id: venta.id },
        data: { estado: 'CANCELADA' }
      })
      return res.status(502).json({ success: false, error: `Error generando QR MP: ${err.message}` })
    }

    const updated = await req.db.ventaEventoQRPendiente.update({
      where: { id: venta.id },
      data: {
        mpOrderId: String(mpResp.in_store_order_id || ''),
        mpExternalPosId: mpResp.external_pos_id || null,
        qrData: mpResp.qr_data || null,
      }
    })

    res.json({
      success: true,
      data: {
        id: updated.id,
        externalReference,
        qrData: updated.qrData,
        monto,
        expiresAt: updated.expiresAt,
        estado: updated.estado,
      }
    })
  } catch (error) {
    console.error('Error creando venta QR ventanilla:', error)
    res.status(500).json({ success: false, error: error.message || 'Error interno' })
  }
})

/**
 * GET /api/admin/accesos/venta-ventanilla/qr/:id
 * Consulta el estado de una venta pendiente (polling).
 * Si está expirada, la marca como EXPIRADA.
 * Como fallback, si aún está pendiente pero pasó tiempo, intenta consultar MP por externalReference.
 */
router.get('/venta-ventanilla/qr/:id', tenantForAdmin, authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const venta = await req.db.ventaEventoQRPendiente.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!venta) return res.status(404).json({ success: false, error: 'Venta no encontrada' })

    let estado = venta.estado

    // Si está PENDIENTE y expiró, marcarla como EXPIRADA y cancelar el QR en MP
    if (estado === 'PENDIENTE' && venta.expiresAt < new Date()) {
      try { await borrarOrdenQRDinamica({ externalPosId: venta.mpExternalPosId }) } catch {}
      await req.db.ventaEventoQRPendiente.update({
        where: { id: venta.id },
        data: { estado: 'EXPIRADA' }
      })
      estado = 'EXPIRADA'
    }

    res.json({
      success: true,
      data: {
        id: venta.id,
        estado,
        monto: Number(venta.monto),
        expiresAt: venta.expiresAt,
        pagadoEn: venta.pagadoEn,
      }
    })
  } catch (error) {
    console.error('Error consultando venta QR:', error)
    res.status(500).json({ success: false, error: 'Error interno' })
  }
})

/**
 * POST /api/admin/accesos/venta-ventanilla/qr/:id/cancelar
 * Cancela manualmente una venta pendiente.
 */
router.post('/venta-ventanilla/qr/:id/cancelar', tenantForAdmin, authAdmin, checkPermiso('EVENTOS_VENDER'), async (req, res) => {
  try {
    const venta = await req.db.ventaEventoQRPendiente.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!venta) return res.status(404).json({ success: false, error: 'Venta no encontrada' })
    if (venta.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, error: `Venta en estado ${venta.estado}, no se puede cancelar` })
    }

    try { await borrarOrdenQRDinamica({ externalPosId: venta.mpExternalPosId }) } catch {}

    await req.db.ventaEventoQRPendiente.update({
      where: { id: venta.id },
      data: { estado: 'CANCELADA' }
    })
    res.json({ success: true })
  } catch (error) {
    console.error('Error cancelando venta QR:', error)
    res.status(500).json({ success: false, error: 'Error interno' })
  }
})

export default router
