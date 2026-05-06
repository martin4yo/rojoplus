import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { buildSocioSearchFilter } from '../../lib/socioSearch.js'

const router = Router()

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
            estado: true
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
          estado: true,
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
      creadoPor: req.user.id
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
    mesesDescuento
  } = req.body

  const updated = await req.db.campanaRecupero.update({
    where: { id: parseInt(id) },
    data: {
      nombre: nombre || undefined,
      descripcion: descripcion !== undefined ? descripcion : undefined,
      activa: activa !== undefined ? activa : undefined,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
      oferta: oferta || undefined,
      descuento: descuento ? parseFloat(descuento) : undefined,
      mesesDescuento: mesesDescuento ? parseInt(mesesDescuento) : undefined
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
      responsableId: req.user.id
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

    if (nivelInteres === 'ALTO' || nivelInteres === 'MEDIO') {
      updateData.interesados = { increment: 1 }
    }

    if (resultado === 'REINGRESO') {
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
