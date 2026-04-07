import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { enviarEmail } from '../../services/email.js'
import { enviarWhatsApp, obtenerTelefonoSocio } from '../../services/whatsappService.js'

const router = Router()

// ============================================
// CAMPAÑAS DE COMUNICACIÓN
// ============================================

// GET /api/admin/comunicaciones/campanas - Listar campañas
router.get('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    tipo,
    estado,
    page = 1,
    limit = 20
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}
  if (tipo) where.tipo = tipo
  if (estado) where.estado = estado

  const [campanas, total] = await Promise.all([
    req.db.campanaComunicacion.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        admin: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        },
        emailTemplate: {
          select: {
            id: true,
            nombre: true,
            subject: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    req.db.campanaComunicacion.count({ where })
  ])

  res.json({
    success: true,
    data: campanas,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// POST /api/admin/comunicaciones/campanas - Crear campaña
router.post('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre,
    descripcion,
    tipo,
    canales,
    emailTemplateId,
    whatsappTemplate,
    smsTemplate,
    pushTemplate,
    segmentacion,
    fechaProgramada
  } = req.body

  // Validaciones
  if (!nombre || !tipo || !segmentacion) {
    throw new AppError('Faltan datos obligatorios', 400, 'VALIDATION_ERROR')
  }

  // Validar que tenga al menos un template según el canal
  const canalesArray = Array.isArray(canales) ? canales : JSON.parse(canales || '[]')

  if (canalesArray.includes('email') && !emailTemplateId) {
    throw new AppError('Debe seleccionar un template de email', 400, 'VALIDATION_ERROR')
  }

  if (canalesArray.includes('whatsapp') && !whatsappTemplate) {
    throw new AppError('Debe proporcionar un template de WhatsApp', 400, 'VALIDATION_ERROR')
  }

  // Calcular destinatarios según segmentación
  const segmentacionObj = typeof segmentacion === 'string' ? JSON.parse(segmentacion) : segmentacion
  const destinatarios = await calcularDestinatarios(req.db, segmentacionObj)

  const campana = await req.db.campanaComunicacion.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      tipo,
      canales: JSON.stringify(canalesArray),
      emailTemplateId: emailTemplateId || null,
      whatsappTemplate: whatsappTemplate || null,
      smsTemplate: smsTemplate || null,
      pushTemplate: pushTemplate || null,
      segmentacion: typeof segmentacion === 'string' ? segmentacion : JSON.stringify(segmentacion),
      destinatarios: JSON.stringify(destinatarios),
      totalDestinatarios: destinatarios.length,
      estado: fechaProgramada ? 'PROGRAMADA' : 'BORRADOR',
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
      enviados: 0,
      abiertos: 0,
      clicks: 0,
      rebotados: 0,
      errores: 0,
      creadoPor: req.admin.id
    },
    include: {
      admin: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      },
      emailTemplate: {
        select: {
          id: true,
          nombre: true,
          subject: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: campana,
    message: 'Campaña creada correctamente'
  })
}))

// Función auxiliar para calcular destinatarios
async function calcularDestinatarios(prisma, segmentacion) {
  const where = {}

  // Si vienen números de socio específicos, ignorar el resto de filtros
  if (segmentacion.nrosSocio && segmentacion.nrosSocio.length > 0) {
    const nros = (Array.isArray(segmentacion.nrosSocio) ? segmentacion.nrosSocio : segmentacion.nrosSocio.split(','))
      .map(n => n.toString().trim())
      .filter(Boolean)
    where.nroSocio = { in: nros }
    return prisma.socio.findMany({
      where,
      select: { id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true }
    })
  }

  if (segmentacion.estado && segmentacion.estado.length > 0) {
    where.estado = { in: Array.isArray(segmentacion.estado) ? segmentacion.estado : [segmentacion.estado] }
  }

  if (segmentacion.actividadId) {
    where.inscripciones = {
      some: {
        categoriaActividad: { actividadId: parseInt(segmentacion.actividadId) },
        estado: 'ACTIVA'
      }
    }
  }

  if (segmentacion.categoriaActividadId) {
    where.inscripciones = {
      some: {
        categoriaActividadId: parseInt(segmentacion.categoriaActividadId),
        estado: 'ACTIVA'
      }
    }
  }

  if (segmentacion.edadMin || segmentacion.edadMax) {
    const hoy = new Date()
    where.fechaNacimiento = {}
    if (segmentacion.edadMax) {
      const fechaMin = new Date(hoy.getFullYear() - parseInt(segmentacion.edadMax), hoy.getMonth(), hoy.getDate())
      where.fechaNacimiento.gte = fechaMin
    }
    if (segmentacion.edadMin) {
      const fechaMax = new Date(hoy.getFullYear() - parseInt(segmentacion.edadMin), hoy.getMonth(), hoy.getDate())
      where.fechaNacimiento.lte = fechaMax
    }
  }

  if (segmentacion.deudores === true) {
    where.cargos = {
      some: { estado: 'PENDIENTE', fechaVencimiento: { lt: new Date() } }
    }
  }

  if (segmentacion.deudores === false) {
    where.OR = [
      { cargos: { none: {} } },
      {
        cargos: {
          every: {
            OR: [
              { estado: { not: 'PENDIENTE' } },
              { fechaVencimiento: { gte: new Date() } }
            ]
          }
        }
      }
    ]
  }

  const socios = await prisma.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      celularSecundario: true,
      telefonoFijo: true
    }
  })

  return socios
}

// GET /api/admin/comunicaciones/campanas/:id - Detalle de campaña
router.get('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    include: {
      admin: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
        }
      },
      emailTemplate: {
        select: {
          id: true,
          nombre: true,
          subject: true,
          bodyHtml: true
        }
      },
      envios: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true
            }
          }
        }
      }
    }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: campana
  })
}))

// PUT /api/admin/comunicaciones/campanas/:id - Actualizar campaña
router.put('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre,
    descripcion,
    estado,
    fechaProgramada
  } = req.body

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  // No permitir editar campañas ya enviadas
  if (campana.estado === 'COMPLETADA') {
    throw new AppError('No se puede modificar una campaña ya enviada', 400, 'INVALID_STATE')
  }

  const updated = await req.db.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: {
      nombre: nombre || undefined,
      descripcion: descripcion !== undefined ? descripcion : undefined,
      estado: estado || undefined,
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : undefined
    },
    include: {
      admin: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: updated,
    message: 'Campaña actualizada correctamente'
  })
}))

// Reemplaza variables {{variable}} en texto con los datos del socio enriquecido
function compilarTemplate(texto, socio) {
  if (!texto) return ''
  const vars = {
    nombre:          socio.apellidoNombre || '',
    nroSocio:        socio.nroSocio || '',
    email:           socio.email || '',
    celular:         socio.celular || '',
    deuda_total:     socio._deudaTotal != null
                       ? `$${Number(socio._deudaTotal).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
                       : '',
    cuotas_vencidas: socio._cuotasVencidas != null ? String(socio._cuotasVencidas) : '',
    actividad:       socio._actividad || '',
  }
  return texto.replace(/\{\{(\w+)\}\}/gi, (_, key) => vars[key] ?? `{{${key}}}`)
}

// Enriquece la lista de socios con datos de deuda y actividad (batch, una query por campo)
async function enriquecerSocios(prisma, socios) {
  if (!socios.length) return socios

  const ids = socios.map(s => s.id)
  const hoy = new Date()

  const [cargos, inscripciones] = await Promise.all([
    prisma.cargo.groupBy({
      by: ['socioId'],
      where: {
        socioId: { in: ids },
        estado: 'PENDIENTE',
        fechaVencimiento: { lt: hoy }
      },
      _sum: { montoTotal: true },
      _count: { id: true }
    }),
    prisma.inscripcion.findMany({
      where: { socioId: { in: ids }, estado: 'ACTIVA' },
      include: { categoriaActividad: { include: { actividad: true } } },
      orderBy: { createdAt: 'asc' }
    })
  ])

  const deudaMap = Object.fromEntries(cargos.map(c => [c.socioId, { total: Number(c._sum.montoTotal) || 0, count: c._count.id }]))
  const actividadMap = {}
  for (const ins of inscripciones) {
    if (!actividadMap[ins.socioId]) {
      actividadMap[ins.socioId] = ins.categoriaActividad?.actividad?.nombre || ''
    }
  }

  return socios.map(s => ({
    ...s,
    _deudaTotal:     deudaMap[s.id]?.total ?? null,
    _cuotasVencidas: deudaMap[s.id]?.count ?? null,
    _actividad:      actividadMap[s.id] || '',
  }))
}

// Lee config anti-ban para campañas
async function getConfigEnvio(db) {
  const claves = [
    'WHATSAPP_DELAY_MS', 'WHATSAPP_PAUSA_CADA_N', 'WHATSAPP_PAUSA_DURACION_MS',
    'WHATSAPP_MAX_POR_HORA', 'WHATSAPP_MAX_POR_DIA',
    'EMAIL_DELAY_MS', 'EMAIL_BATCH_SIZE', 'EMAIL_BATCH_DELAY_MS', 'EMAIL_MAX_POR_DIA'
  ]
  const rows = await db.configuracion.findMany({ where: { clave: { in: claves } } })
  const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
  return {
    wa: {
      delayMs:       parseInt(cfg.WHATSAPP_DELAY_MS)          || 3000,
      pausaCadaN:    parseInt(cfg.WHATSAPP_PAUSA_CADA_N)      || 20,
      pausaDuracion: parseInt(cfg.WHATSAPP_PAUSA_DURACION_MS) || 30000,
      maxPorHora:    parseInt(cfg.WHATSAPP_MAX_POR_HORA)      || 30,
      maxPorDia:     parseInt(cfg.WHATSAPP_MAX_POR_DIA)       || 150,
    },
    email: {
      delayMs:       parseInt(cfg.EMAIL_DELAY_MS)             || 400,
      batchSize:     parseInt(cfg.EMAIL_BATCH_SIZE)           || 50,
      batchDelay:    parseInt(cfg.EMAIL_BATCH_DELAY_MS)       || 60000,
      maxPorDia:     parseInt(cfg.EMAIL_MAX_POR_DIA)          || 500,
    }
  }
}

// Cuenta mensajes enviados en la última hora y en el día (WhatsApp)
async function contarWaEnviados(db) {
  const ahora = new Date()
  const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000)
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  const [porHora, porDia] = await Promise.all([
    db.envioCampana.count({ where: { canal: 'whatsapp', estado: 'ENVIADO', createdAt: { gte: haceUnaHora } } }),
    db.envioCampana.count({ where: { canal: 'whatsapp', estado: 'ENVIADO', createdAt: { gte: inicioDia } } }),
  ])
  return { porHora, porDia }
}

async function contarEmailEnviados(db) {
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)
  return db.envioCampana.count({ where: { canal: 'email', estado: 'ENVIADO', createdAt: { gte: inicioDia } } })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function jitter(base) { return base + Math.floor(Math.random() * base * 0.5) }

// POST /api/admin/comunicaciones/campanas/:id/enviar - Enviar campaña
router.post('/campanas/:id/enviar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    include: { emailTemplate: true }
  })

  if (!campana) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  if (campana.estado === 'COMPLETADA') throw new AppError('Esta campaña ya fue enviada', 400, 'ALREADY_SENT')

  const destinatariosRaw = JSON.parse(campana.destinatarios || '[]')
  if (destinatariosRaw.length === 0) throw new AppError('No hay destinatarios para esta campaña', 400, 'NO_RECIPIENTS')

  const canales = JSON.parse(campana.canales || '[]')
  const cfg = await getConfigEnvio(req.db)

  // Enriquecer socios con datos de deuda y actividad
  const destinatarios = await enriquecerSocios(req.db, destinatariosRaw)

  await req.db.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: { estado: 'EN_CURSO', fechaEnvio: new Date() }
  })

  let enviados = 0
  let errores = 0
  let waEnviadosEnLoop = 0
  let emailEnviadosEnLoop = 0

  for (const socio of destinatarios) {
    for (const canal of canales) {
      const telSocio = obtenerTelefonoSocio(socio)
      let destinatario = ''

      if (canal === 'email' && socio.email) {
        destinatario = socio.email
      } else if ((canal === 'whatsapp' || canal === 'sms') && telSocio) {
        destinatario = telSocio
      } else {
        continue
      }

      // Verificar límites diarios antes de enviar
      if (canal === 'whatsapp') {
        const { porHora, porDia } = await contarWaEnviados(req.db)
        if (porDia >= cfg.wa.maxPorDia) {
          const envio = await req.db.envioCampana.create({ data: { campanaId: campana.id, socioId: socio.id, canal, destinatario, estado: 'ERROR', abierto: false, clickeo: false, rebotado: false, intentos: 0 } })
          await req.db.envioCampana.update({ where: { id: envio.id }, data: { error: `Límite diario de WhatsApp alcanzado (${cfg.wa.maxPorDia}/día)` } })
          errores++
          continue
        }
        if (porHora >= cfg.wa.maxPorHora) {
          console.log(`[Campaña] Límite por hora WA (${cfg.wa.maxPorHora}), esperando 60s...`)
          await sleep(60000)
        }
      } else if (canal === 'email') {
        const emailsHoy = await contarEmailEnviados(req.db)
        if (emailsHoy >= cfg.email.maxPorDia) {
          const envio = await req.db.envioCampana.create({ data: { campanaId: campana.id, socioId: socio.id, canal, destinatario, estado: 'ERROR', abierto: false, clickeo: false, rebotado: false, intentos: 0 } })
          await req.db.envioCampana.update({ where: { id: envio.id }, data: { error: `Límite diario de email alcanzado (${cfg.email.maxPorDia}/día)` } })
          errores++
          continue
        }
      }

      const envio = await req.db.envioCampana.create({
        data: { campanaId: campana.id, socioId: socio.id, canal, destinatario, estado: 'PENDIENTE', abierto: false, clickeo: false, rebotado: false, intentos: 0 }
      })

      let enviado = false
      let errorMsg = null

      try {
        if (canal === 'email' && campana.emailTemplate) {
          const html = compilarTemplate(campana.emailTemplate.bodyHtml, socio)
          const subject = compilarTemplate(campana.emailTemplate.subject, socio)
          await enviarEmail({ to: destinatario, subject, html, db: req.db })
          enviado = true
          emailEnviadosEnLoop++

          // Delay entre emails + pausa por batch
          if (emailEnviadosEnLoop % cfg.email.batchSize === 0) {
            console.log(`[Campaña] Pausa de batch email (${cfg.email.batchDelay}ms)...`)
            await sleep(cfg.email.batchDelay)
          } else {
            await sleep(jitter(cfg.email.delayMs))
          }
        } else if (canal === 'whatsapp' && campana.whatsappTemplate) {
          const texto = compilarTemplate(campana.whatsappTemplate, socio)
          const resultado = await enviarWhatsApp({ db: req.db, telefono: destinatario, texto })
          if (resultado?.enviado) {
            enviado = true
            waEnviadosEnLoop++

            // Pausa larga cada N mensajes WA
            if (waEnviadosEnLoop % cfg.wa.pausaCadaN === 0) {
              console.log(`[Campaña] Pausa anti-ban WA cada ${cfg.wa.pausaCadaN} msgs (${cfg.wa.pausaDuracion}ms)...`)
              await sleep(cfg.wa.pausaDuracion)
            } else {
              await sleep(jitter(cfg.wa.delayMs))
            }
          } else {
            errorMsg = resultado?.motivo || 'No enviado'
            errores++
          }
        }
      } catch (err) {
        errorMsg = err.message
        errores++
      }

      if (enviado) enviados++

      await req.db.envioCampana.update({
        where: { id: envio.id },
        data: { estado: enviado ? 'ENVIADO' : 'ERROR', intentos: 1, ...(errorMsg && { error: errorMsg }) }
      })
    }
  }

  await req.db.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: { estado: 'COMPLETADA', enviados, errores }
  })

  res.json({
    success: true,
    message: `Campaña enviada: ${enviados} enviados, ${errores} errores`,
    data: { totalDestinatarios: destinatarios.length, enviados, errores, canales }
  })
}))

// POST /api/admin/comunicaciones/campanas/:id/reenviar - Reenviar campaña completada
router.post('/campanas/:id/reenviar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { modo = 'todos' } = req.body // 'todos' | 'errores'

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    include: { emailTemplate: true }
  })

  if (!campana) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  // EN_CURSO puede pasar si un envío anterior quedó trabado — se permite reenviar para recuperarla

  const canales = JSON.parse(campana.canales || '[]')
  let destinatarios

  if (modo === 'errores') {
    // Obtener socios de envíos que fallaron
    const enviosError = await req.db.envioCampana.findMany({
      where: { campanaId: parseInt(id), estado: 'ERROR' },
      select: { socioId: true, canal: true }
    })
    if (enviosError.length === 0) throw new AppError('No hay envíos con error para reenviar', 400, 'NO_ERRORS')

    const socioIds = [...new Set(enviosError.map(e => e.socioId))]
    destinatarios = await req.db.socio.findMany({
      where: { id: { in: socioIds } },
      select: { id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true, celularSecundario: true, telefonoFijo: true }
    })
  } else {
    destinatarios = JSON.parse(campana.destinatarios || '[]')
  }

  if (destinatarios.length === 0) throw new AppError('No hay destinatarios para reenviar', 400, 'NO_RECIPIENTS')

  await req.db.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: { estado: 'EN_CURSO' }
  })

  let enviados = 0
  let errores = 0

  for (const socio of destinatarios) {
    for (const canal of canales) {
      const telSocio = obtenerTelefonoSocio(socio)
      let destinatario = ''

      if (canal === 'email' && socio.email) {
        destinatario = socio.email
      } else if ((canal === 'whatsapp' || canal === 'sms') && telSocio) {
        destinatario = telSocio
      } else {
        continue
      }

      const envio = await req.db.envioCampana.create({
        data: { campanaId: campana.id, socioId: socio.id, canal, destinatario, estado: 'PENDIENTE', abierto: false, clickeo: false, rebotado: false, intentos: 0 }
      })

      let enviado = false
      let errorMsg = null

      try {
        if (canal === 'email' && campana.emailTemplate) {
          const html = compilarTemplate(campana.emailTemplate.bodyHtml, socio)
          const subject = compilarTemplate(campana.emailTemplate.subject, socio)
          await enviarEmail({ to: destinatario, subject, html, db: req.db })
          enviado = true
        } else if (canal === 'whatsapp' && campana.whatsappTemplate) {
          const texto = compilarTemplate(campana.whatsappTemplate, socio)
          const resultado = await enviarWhatsApp({ db: req.db, telefono: destinatario, texto })
          if (resultado?.enviado) {
            enviado = true
          } else {
            errorMsg = resultado?.motivo || 'No enviado'
            errores++
          }
        }
      } catch (err) {
        errorMsg = err.message
        errores++
      }

      if (enviado) enviados++

      await req.db.envioCampana.update({
        where: { id: envio.id },
        data: { estado: enviado ? 'ENVIADO' : 'ERROR', intentos: 1, ...(errorMsg && { error: errorMsg }) }
      })
    }
  }

  await req.db.campanaComunicacion.update({
    where: { id: parseInt(id) },
    data: { estado: 'COMPLETADA', enviados: { increment: enviados }, errores: { increment: errores } }
  })

  res.json({
    success: true,
    message: `Reenvío completado: ${enviados} enviados, ${errores} errores`,
    data: { totalDestinatarios: destinatarios.length, enviados, errores, modo }
  })
}))

// POST /api/admin/comunicaciones/campanas/:id/duplicar - Duplicar campaña
router.post('/campanas/:id/duplicar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const original = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!original) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')

  const copia = await req.db.campanaComunicacion.create({
    data: {
      nombre: `${original.nombre} (copia)`,
      descripcion: original.descripcion,
      tipo: original.tipo,
      canales: original.canales,
      emailTemplateId: original.emailTemplateId,
      whatsappTemplate: original.whatsappTemplate,
      smsTemplate: original.smsTemplate,
      pushTemplate: original.pushTemplate,
      segmentacion: original.segmentacion,
      destinatarios: original.destinatarios,
      totalDestinatarios: original.totalDestinatarios,
      estado: 'BORRADOR',
      fechaProgramada: null,
      enviados: 0,
      abiertos: 0,
      clicks: 0,
      rebotados: 0,
      errores: 0,
      creadoPor: req.admin.id
    }
  })

  res.json({ success: true, data: copia, message: 'Campaña duplicada correctamente' })
}))

// DELETE /api/admin/comunicaciones/campanas/:id - Eliminar campaña
router.delete('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  if (campana.estado === 'EN_CURSO' || campana.estado === 'COMPLETADA') {
    throw new AppError('No se puede eliminar una campaña en curso o ya enviada', 400, 'INVALID_STATE')
  }

  await req.db.campanaComunicacion.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Campaña eliminada correctamente'
  })
}))

// GET /api/admin/comunicaciones/campanas/:id/destinatarios - Lista de destinatarios guardada
router.get('/campanas/:id/destinatarios', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) },
    select: { destinatarios: true, canales: true, totalDestinatarios: true }
  })

  if (!campana) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')

  const destinatarios = JSON.parse(campana.destinatarios || '[]')
  const canales = JSON.parse(campana.canales || '[]')

  const lista = destinatarios.map(s => ({
    id: s.id,
    nroSocio: s.nroSocio,
    apellidoNombre: s.apellidoNombre,
    email: s.email || null,
    telefono: obtenerTelefonoSocio(s) || null,
  }))

  res.json({ success: true, data: lista, total: campana.totalDestinatarios })
}))

// POST /api/admin/comunicaciones/previsualizar-destinatarios - Calcular destinatarios sin crear campaña
router.post('/previsualizar-destinatarios', authAdmin, asyncHandler(async (req, res) => {
  const { segmentacion, canales } = req.body

  if (!segmentacion) throw new AppError('Falta segmentación', 400, 'VALIDATION_ERROR')

  const segmentacionObj = typeof segmentacion === 'string' ? JSON.parse(segmentacion) : segmentacion
  const canalesArr = Array.isArray(canales) ? canales : JSON.parse(canales || '[]')

  const destinatarios = await calcularDestinatarios(req.db, segmentacionObj)

  const lista = destinatarios.map(s => ({
    id: s.id,
    nroSocio: s.nroSocio,
    apellidoNombre: s.apellidoNombre,
    email: s.email || null,
    telefono: obtenerTelefonoSocio(s) || null,
  }))

  res.json({ success: true, data: lista, total: lista.length })
}))

// GET /api/admin/comunicaciones/campanas/:id/estadisticas - Estadísticas de campaña
router.get('/campanas/:id/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaComunicacion.findUnique({
    where: { id: parseInt(id) }
  })

  if (!campana) {
    throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')
  }

  const [
    totalEnvios,
    porCanal,
    porEstado,
    tasaApertura,
    tasaClicks
  ] = await Promise.all([
    req.db.envioCampana.count({
      where: { campanaId: parseInt(id) }
    }),
    req.db.envioCampana.groupBy({
      by: ['canal'],
      where: { campanaId: parseInt(id) },
      _count: true
    }),
    req.db.envioCampana.groupBy({
      by: ['estado'],
      where: { campanaId: parseInt(id) },
      _count: true
    }),
    req.db.envioCampana.count({
      where: {
        campanaId: parseInt(id),
        abierto: true
      }
    }),
    req.db.envioCampana.count({
      where: {
        campanaId: parseInt(id),
        clickeo: true
      }
    })
  ])

  const tasaAperturaPorc = totalEnvios > 0 ? (tasaApertura / totalEnvios) * 100 : 0
  const tasaClicksPorc = totalEnvios > 0 ? (tasaClicks / totalEnvios) * 100 : 0

  res.json({
    success: true,
    data: {
      totalEnvios,
      porCanal,
      porEstado,
      tasaApertura: tasaAperturaPorc.toFixed(2),
      tasaClicks: tasaClicksPorc.toFixed(2)
    }
  })
}))

export default router
