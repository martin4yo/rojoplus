import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { buildSocioSearchFilter } from '../../lib/socioSearch.js'

const router = Router()

// Construye el filtro Prisma de socios elegibles de una campaña (sin búsqueda):
// socios cuyo estado NO permite ingresar al club (bajas/bloqueados), que sean
// titulares o socios únicos (no miembros de familia), acotado por los estados de
// baja y la antigüedad de la baja configurados en la campaña.
function buildElegiblesWhere(campana) {
  const where = {
    estadoSocioRel: { permiteIngresoMolinete: false },
    titularFamiliaId: null,
  }

  // Filtro por estados de baja específicos (CSV de IDs de EstadoSocio en
  // campana.motivosBaja; el nombre del campo se mantiene por compatibilidad).
  if (campana.motivosBaja) {
    const estadoIds = campana.motivosBaja
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => Number.isFinite(n))
    if (estadoIds.length > 0) {
      where.estadoSocioId = { in: estadoIds }
      delete where.estadoSocioRel
    }
  }

  // Filtro por tiempo de baja (meses → días)
  if (campana.tiempoBajaMin != null || campana.tiempoBajaMax != null) {
    where.fechaBaja = {}
    const hoy = new Date()
    if (campana.tiempoBajaMin != null) {
      const hace = new Date(hoy)
      hace.setDate(hace.getDate() - campana.tiempoBajaMin * 30)
      where.fechaBaja.lte = hace // fechaBaja ≤ hoy - tiempoBajaMin meses
    }
    if (campana.tiempoBajaMax != null) {
      const hace = new Date(hoy)
      hace.setDate(hace.getDate() - campana.tiempoBajaMax * 30)
      where.fechaBaja.gte = hace // fechaBaja ≥ hoy - tiempoBajaMax meses
    }
    if (!where.fechaBaja.gte && !where.fechaBaja.lte) delete where.fechaBaja
  }

  return where
}

// ============================================
// ENCUESTAS DE BAJA
// ============================================

// POST /api/admin/recupero/encuestas-baja - Registrar encuesta de baja
router.post('/encuestas-baja', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    motivoPrincipal,
    motivoDetalle,
    satisfaccion,
    recomendaria,
    seVaOtroClub,
    nombreOtroClub,
    volveria,
    condicionesVolver,
    comentarios,
    aceptaContacto
  } = req.body

  // Validaciones
  if (!socioId || !motivoPrincipal || satisfaccion === undefined) {
    throw new AppError('Faltan datos obligatorios', 400, 'VALIDATION_ERROR')
  }

  const encuesta = await req.db.encuestaBaja.create({
    data: {
      socioId: parseInt(socioId),
      motivoPrincipal,
      motivoDetalle,
      satisfaccion: parseInt(satisfaccion),
      recomendaria: recomendaria !== undefined ? recomendaria : null,
      seVaOtroClub: seVaOtroClub || false,
      nombreOtroClub: nombreOtroClub || null,
      volveria: volveria !== undefined ? volveria : null,
      condicionesVolver: condicionesVolver || null,
      comentarios: comentarios || null,
      aceptaContacto: aceptaContacto !== undefined ? aceptaContacto : true
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          email: true,
          celular: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: encuesta,
    message: 'Encuesta de baja registrada correctamente'
  })
}))

// GET /api/admin/recupero/encuestas-baja - Listar encuestas de baja
router.get('/encuestas-baja', authAdmin, asyncHandler(async (req, res) => {
  const {
    motivo,
    aceptaContacto,
    volveria,
    page = 1,
    limit = 50,
    search
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  // Construir filtros
  const where = {}

  if (motivo) {
    where.motivoPrincipal = motivo
  }

  if (aceptaContacto !== undefined) {
    where.aceptaContacto = aceptaContacto === 'true'
  }

  if (volveria !== undefined) {
    where.volveria = volveria === 'true'
  }

  const socioFilter = buildSocioSearchFilter(search)
  if (socioFilter) where.socio = socioFilter

  const [encuestas, total] = await Promise.all([
    req.db.encuestaBaja.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            email: true,
            celular: true,
            estadoSocioRel: { select: { nombre: true } }
          }
        }
      },
      orderBy: { fechaEncuesta: 'desc' }
    }),
    req.db.encuestaBaja.count({ where })
  ])

  res.json({
    success: true,
    data: encuestas,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/recupero/encuestas-baja/estadisticas - Estadísticas de encuestas
router.get('/encuestas-baja/estadisticas', authAdmin, asyncHandler(async (req, res) => {
  const [
    totalEncuestas,
    porMotivo,
    aceptanContacto,
    promedioSatisfaccion,
    volverianPorcentaje
  ] = await Promise.all([
    req.db.encuestaBaja.count(),
    req.db.encuestaBaja.groupBy({
      by: ['motivoPrincipal'],
      _count: true,
      orderBy: { _count: { motivoPrincipal: 'desc' } }
    }),
    req.db.encuestaBaja.count({
      where: { aceptaContacto: true }
    }),
    req.db.encuestaBaja.aggregate({
      _avg: { satisfaccion: true }
    }),
    req.db.encuestaBaja.count({
      where: { volveria: true }
    })
  ])

  res.json({
    success: true,
    data: {
      totalEncuestas,
      porMotivo,
      aceptanContacto,
      promedioSatisfaccion: promedioSatisfaccion._avg.satisfaccion || 0,
      volverianPorcentaje: totalEncuestas > 0 ? (volverianPorcentaje / totalEncuestas) * 100 : 0
    }
  })
}))

// GET /api/admin/recupero/encuestas-baja/:id - Detalle de encuesta
router.get('/encuestas-baja/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const encuesta = await req.db.encuestaBaja.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          email: true,
          celular: true,
          documento: true,
          estadoSocioRel: { select: { nombre: true } },
          fechaBaja: true
        }
      }
    }
  })

  if (!encuesta) {
    throw new AppError('Encuesta no encontrada', 404, 'NOT_FOUND')
  }

  res.json({
    success: true,
    data: encuesta
  })
}))

// ============================================
// CAMPAÑAS DE RECUPERO
// ============================================

// GET /api/admin/recupero/campanas - Listar campañas de recupero
router.get('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    activa,
    page = 1,
    limit = 20
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}
  if (activa !== undefined) {
    where.activa = activa === 'true'
  }

  const [campanas, total] = await Promise.all([
    req.db.campanaRecupero.findMany({
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
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    req.db.campanaRecupero.count({ where })
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

// POST /api/admin/recupero/campanas - Crear campaña de recupero
router.post('/campanas', authAdmin, asyncHandler(async (req, res) => {
  const {
    nombre,
    descripcion,
    motivosBaja,
    tiempoBajaMin,
    tiempoBajaMax,
    oferta,
    descuento,
    mesesDescuento,
    sinCuotaIngreso,
    fechaInicio,
    fechaFin
  } = req.body

  // Validaciones
  if (!nombre || !oferta || !fechaInicio || !fechaFin) {
    throw new AppError('Faltan datos obligatorios', 400, 'VALIDATION_ERROR')
  }

  const campana = await req.db.campanaRecupero.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      motivosBaja: motivosBaja || null,
      tiempoBajaMin: tiempoBajaMin ? parseInt(tiempoBajaMin) : null,
      tiempoBajaMax: tiempoBajaMax ? parseInt(tiempoBajaMax) : null,
      oferta,
      descuento: descuento ? parseFloat(descuento) : null,
      mesesDescuento: mesesDescuento ? parseInt(mesesDescuento) : null,
      sinCuotaIngreso: sinCuotaIngreso || false,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      activa: true,
      sociosObjetivo: 0,
      contactados: 0,
      interesados: 0,
      recuperados: 0,
      creadoPor: req.admin.id
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
    data: campana,
    message: 'Campaña de recupero creada correctamente'
  })
}))

// GET /api/admin/recupero/campanas/:id - Detalle de campaña
router.get('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const campana = await req.db.campanaRecupero.findUnique({
    where: { id: parseInt(id) },
    include: {
      admin: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true
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

// PUT /api/admin/recupero/campanas/:id - Actualizar campaña
router.put('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    nombre,
    descripcion,
    activa,
    fechaInicio,
    fechaFin,
    oferta,
    descuento,
    mesesDescuento,
    motivosBaja,
    tiempoBajaMin,
    tiempoBajaMax,
    sinCuotaIngreso,
  } = req.body

  const data = {
    nombre: nombre || undefined,
    descripcion: descripcion !== undefined ? (descripcion || null) : undefined,
    activa: activa !== undefined ? activa : undefined,
    fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
    fechaFin: fechaFin ? new Date(fechaFin) : undefined,
    oferta: oferta || undefined,
    descuento: descuento !== undefined ? (descuento === '' || descuento === null ? null : parseFloat(descuento)) : undefined,
    mesesDescuento: mesesDescuento !== undefined ? (mesesDescuento === '' || mesesDescuento === null ? null : parseInt(mesesDescuento)) : undefined,
    motivosBaja: motivosBaja !== undefined ? (motivosBaja || null) : undefined,
    tiempoBajaMin: tiempoBajaMin !== undefined ? (tiempoBajaMin === '' || tiempoBajaMin === null ? null : parseInt(tiempoBajaMin)) : undefined,
    tiempoBajaMax: tiempoBajaMax !== undefined ? (tiempoBajaMax === '' || tiempoBajaMax === null ? null : parseInt(tiempoBajaMax)) : undefined,
    sinCuotaIngreso: sinCuotaIngreso !== undefined ? !!sinCuotaIngreso : undefined,
  }

  const updated = await req.db.campanaRecupero.update({
    where: { id: parseInt(id) },
    data,
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

// DELETE /api/admin/recupero/campanas/:id - Eliminar campaña
router.delete('/campanas/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  await req.db.campanaRecupero.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Campaña eliminada correctamente'
  })
}))

// GET /api/admin/recupero/campanas/:id/socios-elegibles
// Devuelve los socios dados de baja que cumplen los criterios de la campaña,
// con la última acción de recupero registrada en esta campaña (si existe).
router.get('/campanas/:id/socios-elegibles', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { search } = req.query

  const campana = await req.db.campanaRecupero.findUnique({
    where: { id: parseInt(id) },
  })
  if (!campana) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')

  // Construir filtros: socios cuyo estado NO permite ingresar al club
  // (bajas, renuncias, fallecidos, bloqueados, etc.), titulares o socios únicos.
  // El recupero se hace al titular del grupo (que gestiona la cuota familiar).
  const where = buildElegiblesWhere(campana)

  // Búsqueda por nombre/nro
  if (search && String(search).trim()) {
    const term = String(search).trim()
    where.OR = [
      { apellidoNombre: { contains: term, mode: 'insensitive' } },
      ...(Number.isFinite(parseInt(term)) ? [{ nroSocio: parseInt(term) }] : []),
    ]
  }

  const socios = await req.db.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      celularSecundario: true,
      telefonoFijo: true,
      fechaBaja: true,
      motivoBaja: true,
      estadoSocioRel: { select: { nombre: true, color: true } },
      _count: { select: { miembrosFamilia: true } },
    },
    orderBy: [{ fechaBaja: 'desc' }, { apellidoNombre: 'asc' }],
    take: 500,
  })

  // Buscar última acción de cada socio en esta campaña (si existe)
  const sociosIds = socios.map(s => s.id)
  const ultimasAcciones = sociosIds.length > 0
    ? await req.db.accionRecupero.findMany({
        where: { campanaId: parseInt(id), socioId: { in: sociosIds } },
        orderBy: { fecha: 'desc' },
      })
    : []
  const accionPorSocio = new Map()
  for (const a of ultimasAcciones) {
    if (!accionPorSocio.has(a.socioId)) accionPorSocio.set(a.socioId, a)
  }

  const result = socios.map(s => {
    const cantMiembros = s._count?.miembrosFamilia || 0
    const { _count, ...rest } = s
    return {
      ...rest,
      tipoFamilia: cantMiembros > 0 ? 'TITULAR' : 'SOCIO_UNICO',
      cantMiembrosFamilia: cantMiembros,
      ultimaAccion: accionPorSocio.get(s.id) || null,
    }
  })

  res.json({
    success: true,
    data: result,
    total: result.length,
    criterios: {
      motivosBaja: campana.motivosBaja,
      tiempoBajaMin: campana.tiempoBajaMin,
      tiempoBajaMax: campana.tiempoBajaMax,
    },
  })
}))

// GET /api/admin/recupero/campanas/:id/efectividad
// Métricas de efectividad de la campaña, calculadas on-demand (NO usa los
// contadores incrementales de la campaña, que se inflan al registrar varias
// acciones por socio). Devuelve:
//   - embudo de gestión por socios únicos (objetivo → contactados → respondieron
//     → interesados → recuperados) con sus tasas de conversión
//   - índices monetarios: deuda histórica impaga, valor recurrente a recuperar,
//     recuperado efectivo (cuotas pagadas tras la reactivación) y rendimiento
//     neto del descuento ofrecido
//
// "Recuperado" se determina de forma automática: un socio contactado que registra
// un evento REACTIVADO_SOCIO en AuditoriaSocio posterior a su primer contacto y
// dentro de la vigencia de la campaña.
router.get('/campanas/:id/efectividad', authAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id)
  const campana = await req.db.campanaRecupero.findUnique({ where: { id } })
  if (!campana) throw new AppError('Campaña no encontrada', 404, 'NOT_FOUND')

  const fechaInicio = new Date(campana.fechaInicio)
  const fechaFin = new Date(campana.fechaFin)
  const mesesVigencia = Math.max(1, Math.round((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24 * 30)))

  // 1) Acciones de la campaña → embudo de gestión (contando socios únicos)
  const acciones = await req.db.accionRecupero.findMany({
    where: { campanaId: id },
    select: { socioId: true, tipo: true, resultado: true, nivelInteres: true, direccion: true, fecha: true },
  })

  const contactados = new Set()      // socios con al menos un contacto saliente
  const respondieron = new Set()     // socios con al menos una respuesta entrante
  const interesados = new Set()      // socios con interés declarado
  const primerContacto = new Map()   // socioId → fecha del primer contacto saliente
  const porCanal = {}                // tipo de acción → Set de socios contactados

  for (const a of acciones) {
    if (!a.socioId) continue
    if (a.direccion === 'ENTRANTE') {
      respondieron.add(a.socioId)
    } else {
      contactados.add(a.socioId)
      const prev = primerContacto.get(a.socioId)
      if (!prev || a.fecha < prev) primerContacto.set(a.socioId, a.fecha)
      if (a.tipo) {
        if (!porCanal[a.tipo]) porCanal[a.tipo] = new Set()
        porCanal[a.tipo].add(a.socioId)
      }
    }
    if (a.resultado === 'INTERESADO' || a.nivelInteres === 'ALTO' || a.nivelInteres === 'MEDIO') {
      interesados.add(a.socioId)
    }
  }

  // 2) Universo objetivo = elegibles actuales ∪ socios con acción en la campaña.
  //    Los recuperados ya no figuran como elegibles (cambió su estado), pero
  //    siguen siendo parte del objetivo, por eso se suman vía sus acciones.
  const sociosConAccion = [...new Set(acciones.map(a => a.socioId).filter(Boolean))]
  const objetivoSocios = await req.db.socio.findMany({
    where: { OR: [buildElegiblesWhere(campana), { id: { in: sociosConAccion } }] },
    select: {
      id: true,
      tipoSocioRel: { select: { cuotaMensual: true, conceptoTesoreria: { select: { cuotaMensual: true } } } },
      categoriaSocioRel: { select: { porcentajeDescuento: true } },
    },
  })
  const objetivoIds = objetivoSocios.map(s => s.id)

  // Cuota mensual neta esperada por socio (concepto > tipo, menos descuento de categoría)
  const cuotaMensualPorSocio = new Map()
  for (const s of objetivoSocios) {
    const base = Number(s.tipoSocioRel?.conceptoTesoreria?.cuotaMensual ?? s.tipoSocioRel?.cuotaMensual ?? 0)
    const desc = Number(s.categoriaSocioRel?.porcentajeDescuento ?? 0)
    cuotaMensualPorSocio.set(s.id, base * (1 - desc / 100))
  }

  // 3) Recuperados: contactados que reactivaron tras el primer contacto y dentro de la vigencia
  const reactivaciones = contactados.size > 0
    ? await req.db.auditoriaSocio.findMany({
        where: {
          socioId: { in: [...contactados] },
          evento: 'REACTIVADO_SOCIO',
          fecha: { gte: fechaInicio, lte: fechaFin },
        },
        select: { socioId: true, fecha: true },
        orderBy: { fecha: 'asc' },
      })
    : []
  const fechaReactivacion = new Map()
  for (const r of reactivaciones) {
    const fc = primerContacto.get(r.socioId)
    if (fc && r.fecha < fc) continue // reactivó antes de que lo contactáramos: no se atribuye
    if (!fechaReactivacion.has(r.socioId)) fechaReactivacion.set(r.socioId, r.fecha)
  }
  const recuperadosIds = [...fechaReactivacion.keys()]

  // 4) Índices monetarios
  // 4a) Deuda histórica impaga: cargos PENDIENTE vencidos antes del inicio de la campaña
  const deudaAgg = objetivoIds.length > 0
    ? await req.db.cargo.aggregate({
        where: { socioId: { in: objetivoIds }, estado: 'PENDIENTE', fechaVencimiento: { lt: fechaInicio } },
        _sum: { montoTotal: true },
      })
    : { _sum: { montoTotal: null } }
  const deudaVieja = Number(deudaAgg._sum.montoTotal ?? 0)

  // 4b) Valor recurrente proyectado: cuota mensual neta × meses de vigencia, por objetivo
  let valorRecurrente = 0
  for (const idSocio of objetivoIds) valorRecurrente += (cuotaMensualPorSocio.get(idSocio) || 0) * mesesVigencia

  // 4c) Recuperado efectivo: pagos confirmados de los recuperados desde su reactivación
  const pagos = recuperadosIds.length > 0
    ? await req.db.pago.findMany({
        where: { socioId: { in: recuperadosIds }, estado: 'CONFIRMADO', fecha: { gte: fechaInicio, lte: fechaFin } },
        select: { socioId: true, montoRecibido: true, fecha: true },
      })
    : []
  let recuperadoEfectivo = 0
  for (const p of pagos) {
    const fr = fechaReactivacion.get(p.socioId)
    if (fr && p.fecha < fr) continue
    recuperadoEfectivo += Number(p.montoRecibido || 0)
  }

  // 4d) Costo de la oferta (solo descuento mensual; se ignora la cuota de ingreso)
  let costoOferta = 0
  if (campana.descuento && campana.mesesDescuento) {
    const pctDesc = Number(campana.descuento) / 100
    const meses = Number(campana.mesesDescuento)
    for (const idSocio of recuperadosIds) costoOferta += (cuotaMensualPorSocio.get(idSocio) || 0) * pctDesc * meses
  }
  const rendimientoNeto = recuperadoEfectivo - costoOferta

  const objetivo = objetivoIds.length
  const nContactados = contactados.size
  const nRecuperados = recuperadosIds.length
  const tasa = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)
  const dec2 = n => Math.round(n * 100) / 100

  res.json({
    success: true,
    data: {
      vigencia: { fechaInicio, fechaFin, mesesVigencia },
      embudo: {
        objetivo,
        contactados: nContactados,
        respondieron: respondieron.size,
        interesados: interesados.size,
        recuperados: nRecuperados,
      },
      tasas: {
        contacto: tasa(nContactados, objetivo),
        respuesta: tasa(respondieron.size, nContactados),
        interes: tasa(interesados.size, nContactados),
        recupero: tasa(nRecuperados, nContactados),
        recuperoSobreObjetivo: tasa(nRecuperados, objetivo),
      },
      esfuerzo: {
        totalAcciones: acciones.length,
        accionesPorRecuperado: nRecuperados > 0 ? Math.round((acciones.length / nRecuperados) * 10) / 10 : null,
      },
      porCanal: Object.entries(porCanal)
        .map(([tipo, set]) => ({ tipo, socios: set.size }))
        .sort((a, b) => b.socios - a.socios),
      monetario: {
        deudaVieja: dec2(deudaVieja),
        valorRecurrente: dec2(valorRecurrente),
        recuperadoEfectivo: dec2(recuperadoEfectivo),
        costoOferta: dec2(costoOferta),
        rendimientoNeto: dec2(rendimientoNeto),
        tasaRecuperoMonetario: tasa(recuperadoEfectivo, valorRecurrente),
        roi: costoOferta > 0 ? dec2(rendimientoNeto / costoOferta) : null,
      },
    },
  })
}))

// ============================================
// ACCIONES DE RECUPERO
// ============================================

// GET /api/admin/recupero/acciones - Listar acciones de recupero
router.get('/acciones', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    campanaId,
    resultado,
    nivelInteres,
    page = 1,
    limit = 50
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = {}

  if (socioId) {
    where.socioId = parseInt(socioId)
  }

  if (campanaId) {
    where.campanaId = parseInt(campanaId)
  }

  if (resultado) {
    where.resultado = resultado
  }

  if (nivelInteres) {
    where.nivelInteres = nivelInteres
  }

  const [acciones, total] = await Promise.all([
    req.db.accionRecupero.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            email: true,
            celular: true
          }
        },
        campana: {
          select: {
            id: true,
            nombre: true
          }
        },
        responsable: {
          select: {
            id: true,
            nombre: true,
            apellido: true
          }
        }
      },
      orderBy: { fecha: 'desc' }
    }),
    req.db.accionRecupero.count({ where })
  ])

  res.json({
    success: true,
    data: acciones,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// POST /api/admin/recupero/acciones - Registrar acción de recupero
router.post('/acciones', authAdmin, asyncHandler(async (req, res) => {
  const {
    socioId,
    campanaId,
    tipo,
    resultado,
    nivelInteres,
    observaciones,
    objeciones,
    ofertaRealizada,
    proximaAccion,
    fechaProxima,
    recordatorio
  } = req.body

  // Validaciones
  if (!socioId || !tipo || !resultado) {
    throw new AppError('Faltan datos obligatorios', 400, 'VALIDATION_ERROR')
  }

  const accion = await req.db.accionRecupero.create({
    data: {
      socioId: parseInt(socioId),
      campanaId: campanaId ? parseInt(campanaId) : null,
      tipo,
      resultado,
      nivelInteres: nivelInteres || null,
      observaciones: observaciones || null,
      objeciones: objeciones || null,
      ofertaRealizada: ofertaRealizada || null,
      proximaAccion: proximaAccion || null,
      fechaProxima: fechaProxima ? new Date(fechaProxima) : null,
      recordatorio: recordatorio || false,
      responsableId: req.admin.id
    },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true
        }
      },
      campana: {
        select: {
          id: true,
          nombre: true
        }
      },
      responsable: {
        select: {
          id: true,
          nombre: true,
          apellido: true
        }
      }
    }
  })

  // Actualizar contadores de campaña si corresponde
  if (campanaId) {
    const updateData = {
      contactados: { increment: 1 }
    }

    if (resultado === 'INTERESADO' || nivelInteres === 'ALTO' || nivelInteres === 'MEDIO') {
      updateData.interesados = { increment: 1 }
    }

    if (resultado === 'RECUPERADO') {
      updateData.recuperados = { increment: 1 }
    }

    await req.db.campanaRecupero.update({
      where: { id: parseInt(campanaId) },
      data: updateData
    })
  }

  res.json({
    success: true,
    data: accion,
    message: 'Acción de recupero registrada correctamente'
  })
}))

// GET /api/admin/recupero/pendientes
// Listado de acciones entrantes pendientes de revisión (respuestas WA/email
// que llegan automáticamente y necesitan atención humana).
router.get('/pendientes', authAdmin, asyncHandler(async (req, res) => {
  const acciones = await req.db.accionRecupero.findMany({
    where: { pendienteRevision: true },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true } },
      campana: { select: { id: true, nombre: true } },
      responsable: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { fecha: 'desc' },
    take: 200,
  })
  res.json({ success: true, data: acciones, total: acciones.length })
}))

// GET /api/admin/recupero/pendientes/count
// Solo el contador (para el badge del menú)
router.get('/pendientes/count', authAdmin, asyncHandler(async (req, res) => {
  const total = await req.db.accionRecupero.count({ where: { pendienteRevision: true } })
  res.json({ success: true, total })
}))

// POST /api/admin/recupero/inbox/test
// Test de conexión IMAP del tenant actual (sin procesar mensajes)
router.post('/inbox/test', authAdmin, asyncHandler(async (req, res) => {
  const { ImapFlow } = await import('imapflow')
  const claves = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS', 'IMAP_SECURE', 'SMTP_USER', 'SMTP_PASS']
  const rows = await req.db.configuracion.findMany({ where: { clave: { in: claves } } })
  const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
  if (!cfg.IMAP_HOST) {
    return res.status(400).json({ success: false, error: { message: 'Falta IMAP_HOST' } })
  }
  const client = new ImapFlow({
    host: cfg.IMAP_HOST,
    port: parseInt(cfg.IMAP_PORT || '993'),
    secure: (cfg.IMAP_SECURE ?? 'true') === 'true',
    auth: {
      user: cfg.IMAP_USER || cfg.SMTP_USER,
      pass: cfg.IMAP_PASS || cfg.SMTP_PASS,
    },
    logger: false,
  })
  try {
    await client.connect()
    const mailboxes = await client.list()
    await client.logout()
    res.json({ success: true, mensaje: 'Conexión OK', mailboxes: mailboxes.map(m => m.path).slice(0, 10) })
  } catch (err) {
    try { await client.logout() } catch {}
    res.status(400).json({ success: false, error: { message: err.message } })
  }
}))

// POST /api/admin/recupero/inbox/run
// Ejecuta el polling IMAP del tenant actual on-demand
router.post('/inbox/run', authAdmin, asyncHandler(async (req, res) => {
  const { procesarInboxRecuperoTenant } = await import('../../services/inboxService.js')
  const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } })
  if (!tenant) {
    return res.status(404).json({ success: false, error: { message: 'Tenant no encontrado' } })
  }
  const resultado = await procesarInboxRecuperoTenant(tenant)
  res.json({ success: true, ...resultado })
}))

// PATCH /api/admin/recupero/acciones/:id/atender
// Marca una acción entrante como atendida (saca el flag pendienteRevision).
// Opcionalmente acepta un nuevo resultado y observaciones de cierre.
router.patch('/acciones/:id/atender', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { resultado, observaciones } = req.body
  const updated = await req.db.accionRecupero.update({
    where: { id: parseInt(id) },
    data: {
      pendienteRevision: false,
      ...(resultado ? { resultado } : {}),
      ...(observaciones != null ? { observaciones } : {}),
    },
  })
  res.json({ success: true, data: updated, message: 'Acción marcada como atendida' })
}))

// GET /api/admin/recupero/candidatos - Obtener socios candidatos para recupero
router.get('/candidatos', authAdmin, asyncHandler(async (req, res) => {
  const {
    motivoBaja,
    tiempoBajaMin,
    tiempoBajaMax,
    aceptaContacto,
    page = 1,
    limit = 50
  } = req.query

  const skip = (parseInt(page) - 1) * parseInt(limit)

  // Construir filtros
  const where = {
    estado: 'BAJA',
    fechaBaja: { not: null }
  }

  // Calcular rango de fechas si se especifica tiempo de baja
  if (tiempoBajaMin || tiempoBajaMax) {
    const hoy = new Date()
    const fechaMax = tiempoBajaMin ? new Date(hoy.getTime() - (parseInt(tiempoBajaMin) * 30 * 24 * 60 * 60 * 1000)) : undefined
    const fechaMin = tiempoBajaMax ? new Date(hoy.getTime() - (parseInt(tiempoBajaMax) * 30 * 24 * 60 * 60 * 1000)) : undefined

    where.fechaBaja = {}
    if (fechaMin) where.fechaBaja.gte = fechaMin
    if (fechaMax) where.fechaBaja.lte = fechaMax
  }

  // Si se filtra por motivo de baja o acepta contacto, buscar en encuestas
  let sociosConEncuesta = null
  if (motivoBaja || aceptaContacto !== undefined) {
    const encuestaWhere = {}
    if (motivoBaja) encuestaWhere.motivoPrincipal = motivoBaja
    if (aceptaContacto !== undefined) encuestaWhere.aceptaContacto = aceptaContacto === 'true'

    const encuestas = await req.db.encuestaBaja.findMany({
      where: encuestaWhere,
      select: { socioId: true }
    })

    sociosConEncuesta = encuestas.map(e => e.socioId)
    if (sociosConEncuesta.length > 0) {
      where.id = { in: sociosConEncuesta }
    } else {
      // No hay socios que cumplan con los criterios de encuesta
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      })
    }
  }

  const [candidatos, total] = await Promise.all([
    req.db.socio.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        encuestasBaja: {
          orderBy: { fechaEncuesta: 'desc' },
          take: 1
        },
        accionesRecupero: {
          orderBy: { fecha: 'desc' },
          take: 3,
          include: {
            responsable: {
              select: {
                nombre: true,
                apellido: true
              }
            }
          }
        }
      },
      orderBy: { fechaBaja: 'desc' }
    }),
    req.db.socio.count({ where })
  ])

  res.json({
    success: true,
    data: candidatos,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

export default router
