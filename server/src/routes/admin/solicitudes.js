import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin, generateToken } from '../../middleware/auth.js'
import { enviarEmailConTemplate } from '../../services/notificacionService.js'
import { getTenantFrontendUrl } from '../../lib/tenantUrl.js'
import { calcularProximoNroSocio } from '../../lib/nroSocio.js'

const router = Router()

// SOLICITUDES DE ALTA DE SOCIOS
// ========================================

/**
 * GET /api/admin/solicitudes
 * Listar solicitudes de alta de socios con filtros
 */
router.get('/solicitudes', asyncHandler(async (req, res) => {
  const { estado, desde, hasta, buscar, limite = 50, pagina = 1 } = req.query

  const where = {}

  if (estado) {
    where.estado = estado
  }

  if (desde) {
    where.fechaSolicitud = { gte: new Date(desde) }
  }

  if (hasta) {
    where.fechaSolicitud = {
      ...where.fechaSolicitud,
      lte: new Date(hasta)
    }
  }

  if (buscar) {
    where.OR = [
      { apellidos: { contains: buscar, mode: 'insensitive' } },
      { nombres: { contains: buscar, mode: 'insensitive' } },
      { documento: { contains: buscar } },
      { email: { contains: buscar, mode: 'insensitive' } }
    ]
  }

  const skip = (parseInt(pagina) - 1) * parseInt(limite)
  const take = parseInt(limite)

  const [solicitudes, total] = await Promise.all([
    req.db.solicitudSocio.findMany({
      where,
      include: {
        respondidoPorAdmin: {
          select: { nombre: true, apellido: true, email: true }
        },
        socioCreatedRel: {
          select: { nroSocio: true, apellidoNombre: true }
        }
      },
      orderBy: { fechaSolicitud: 'desc' },
      skip,
      take
    }),
    req.db.solicitudSocio.count({ where })
  ])

  res.json({
    success: true,
    data: solicitudes,
    pagination: {
      total,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      totalPaginas: Math.ceil(total / parseInt(limite))
    }
  })
}))

/**
 * GET /api/admin/solicitudes/:id
 * Obtener detalle de una solicitud
 */
router.get('/solicitudes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const solicitud = await req.db.solicitudSocio.findUnique({
    where: { id: parseInt(id) },
    include: {
      respondidoPorAdmin: {
        select: { nombre: true, apellido: true, email: true }
      },
      socioCreatedRel: {
        select: { nroSocio: true, apellidoNombre: true, email: true, celular: true }
      }
    }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  res.json({
    success: true,
    data: solicitud
  })
}))

/**
 * PUT /api/admin/solicitudes/:id/aprobar
 * Aprobar una solicitud y crear el socio
 */
router.put('/solicitudes/:id/aprobar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { tipoSocioId, categoriaSocioId, observacionesInternas } = req.body

  const solicitud = await req.db.solicitudSocio.findUnique({
    where: { id: parseInt(id) },
    include: {
      familiares: true
    }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('Esta solicitud ya fue procesada', 400)
  }

  // Helper function para inscribir en actividades. También conecta el centroCosto
  // por defecto de la actividad si tiene uno cargado (para que el cargo lo herede).
  const inscribirEnActividades = async (socioId, actividades, edadSocio) => {
    const actividadesArray = Array.isArray(actividades) ? actividades : [actividades]

    for (const nombreActividad of actividadesArray) {
      if (nombreActividad === 'Socio sin actividad') continue

      try {
        const actividad = await req.db.actividad.findFirst({
          where: {
            nombre: { contains: nombreActividad, mode: 'insensitive' },
            activo: true
          },
          include: {
            categorias: {
              where: { activo: true },
              orderBy: { edadMinima: 'asc' }
            }
          }
        })

        if (actividad && actividad.categorias.length > 0) {
          const categoriaApropiada = actividad.categorias.find(cat => {
            const cumpleMinima = !cat.edadMinima || edadSocio >= cat.edadMinima
            const cumpleMaxima = !cat.edadMaxima || edadSocio <= cat.edadMaxima
            return cumpleMinima && cumpleMaxima
          })

          if (categoriaApropiada) {
            await req.db.inscripcion.create({
              data: {
                socio: { connect: { id: socioId } },
                categoriaActividad: { connect: { id: categoriaApropiada.id } },
                ...(actividad.centroCostoId ? {
                  centroCosto: { connect: { id: actividad.centroCostoId } }
                } : {}),
                fechaInicio: new Date(),
                estado: 'ACTIVA'
              }
            })
          }
        }
      } catch (error) {
        console.error(`Error inscribiendo en ${nombreActividad}:`, error)
      }
    }
  }

  // Calcular edad del titular
  const fechaNacTitular = new Date(solicitud.fechaNacimiento)
  const edadTitular = Math.floor((new Date() - fechaNacTitular) / (365.25 * 24 * 60 * 60 * 1000))
  const esMenorTitular = edadTitular < 18

  // PASO 1: Crear el socio titular
  // Usa la lógica de rangos (SOCIO_NRO_MIN/MAX) o legacy según configuración
  const nroTitular = await calcularProximoNroSocio(req.db)
  const nuevoSocio = await req.db.socio.create({
    data: {
      nroSocio: nroTitular,
      apellido: solicitud.apellidos,
      nombre: solicitud.nombres,
      apellidoNombre: `${solicitud.apellidos} ${solicitud.nombres}`,
      documento: solicitud.documento,
      fechaNacimiento: solicitud.fechaNacimiento,
      calle: solicitud.direccionCalle,
      numero: solicitud.direccionNumero,
      ciudad: solicitud.localidad,
      celular: solicitud.telefono,
      email: solicitud.email,
      condicionesMedicas: solicitud.detalleEnfermedades,
      esMenor: esMenorTitular,
      tipoSocioRelId: tipoSocioId ? parseInt(tipoSocioId) : null,
      categoriaSocioId: categoriaSocioId ? parseInt(categoriaSocioId) : null,
      estado: 'ACTIVO',
      fechaAlta: new Date(),
      tipoSocio: 'GRUPO_FAMILIAR' // Si tiene familiares, es grupo familiar
    }
  })

  // PASO 2: Inscribir al titular en sus actividades
  const actividadesTitular = JSON.parse(solicitud.actividadesSeleccionadas || '[]')
  if (actividadesTitular.length > 0) {
    await inscribirEnActividades(nuevoSocio.id, actividadesTitular, edadTitular)
  }

  // PASO 3: Crear socios familiares y establecer relación
  const sociosCreados = [nuevoSocio]

  for (const familiar of solicitud.familiares) {
    const fechaNacFamiliar = new Date(familiar.fechaNacimiento)
    const edadFamiliar = Math.floor((new Date() - fechaNacFamiliar) / (365.25 * 24 * 60 * 60 * 1000))
    const esMenorFamiliar = edadFamiliar < 18

    const nroFamiliar = await calcularProximoNroSocio(req.db)
    const socioFamiliar = await req.db.socio.create({
      data: {
        nroSocio: nroFamiliar,
        apellido: familiar.apellidos,
        nombre: familiar.nombres,
        apellidoNombre: `${familiar.apellidos} ${familiar.nombres}`,
        documento: familiar.documento,
        fechaNacimiento: familiar.fechaNacimiento,
        calle: solicitud.direccionCalle, // Mismo domicilio que titular
        numero: solicitud.direccionNumero,
        ciudad: solicitud.localidad,
        celular: solicitud.telefono, // Mismo teléfono
        email: solicitud.email, // Mismo email
        esMenor: esMenorFamiliar,
        parentescoTitular: familiar.parentesco,
        tipoSocioRelId: tipoSocioId ? parseInt(tipoSocioId) : null,
        categoriaSocioId: categoriaSocioId ? parseInt(categoriaSocioId) : null,
        estado: 'ACTIVO',
        fechaAlta: new Date(),
        titularFamiliaId: nuevoSocio.id // Establecer relación con titular
      }
    })

    // Actualizar el registro de FamiliarSolicitud con el socio creado
    await req.db.familiarSolicitud.update({
      where: { id: familiar.id },
      data: { socioCreado: socioFamiliar.id }
    })

    // Inscribir en actividades
    const actividadesFamiliar = JSON.parse(familiar.actividadesSeleccionadas || '[]')
    if (actividadesFamiliar.length > 0) {
      await inscribirEnActividades(socioFamiliar.id, actividadesFamiliar, edadFamiliar)
    }

    sociosCreados.push(socioFamiliar)
  }

  // PASO 4: Generar cuotas del mes actual
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()

  // Buscar el periodo actual
  const periodoActual = await req.db.periodo.findFirst({
    where: {
      mes: mesActual,
      anio: anioActual
    }
  })

  const cuotasGeneradas = []

  if (periodoActual) {
    const tipoSocio = await req.db.tipoSocio.findUnique({
      where: { id: parseInt(tipoSocioId) }
    })

    // GENERAR CUOTA SOCIAL: Solo para el titular (cubre a toda la familia)
    if (tipoSocio && tipoSocio.cuotaMensual && parseFloat(tipoSocio.cuotaMensual) > 0) {
      const cargoSocial = await req.db.cargo.create({
        data: {
          socio: { connect: { id: nuevoSocio.id } },
          periodo: { connect: { id: periodoActual.id } },
          categoria: 'CUOTA_SOCIAL',
          descripcion: `Cuota Social ${periodoActual.mes}/${periodoActual.anio}`,
          montoOriginal: tipoSocio.cuotaMensual,
          montoTotal: tipoSocio.cuotaMensual,
          fechaVencimiento: periodoActual.fechaVencimiento,
          estado: 'PENDIENTE'
        }
      })
      cuotasGeneradas.push(cargoSocial)
    }

    // GENERAR CUOTAS DE ACTIVIDADES: Para cada integrante (titular + familiares).
    // Misma lógica que POST /admin/inscripciones: cascade de monto + descuentos.
    for (const socio of sociosCreados) {
      // Cargar relación de categoría del socio para aplicar descuento
      const socioCompleto = await req.db.socio.findUnique({
        where: { id: socio.id },
        include: { categoriaSocioRel: true }
      })
      const descuentoPct = socioCompleto?.categoriaSocioRel?.porcentajeDescuento
        ? Number(socioCompleto.categoriaSocioRel.porcentajeDescuento)
        : 0

      const inscripciones = await req.db.inscripcion.findMany({
        where: {
          socioId: socio.id,
          estado: 'ACTIVA'
        },
        include: {
          categoriaActividad: {
            include: {
              actividad: { include: { conceptoTesoreria: true } }
            }
          }
        }
      })

      for (const insc of inscripciones) {
        if (insc.exentoCuota) continue

        const categoria = insc.categoriaActividad
        const actividad = categoria.actividad

        // Cascade de monto: conceptoTesoreria → categoria → actividad
        let montoBase = actividad.conceptoTesoreria?.cuotaMensual
          ? Number(actividad.conceptoTesoreria.cuotaMensual)
          : (categoria.cuotaMensual ? Number(categoria.cuotaMensual)
          : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

        if (montoBase <= 0) continue

        const pctInsc = parseFloat(insc.porcentajeCuota) || 100
        if (pctInsc !== 100) montoBase = montoBase * (pctInsc / 100)

        const montoBonificacion = montoBase * (descuentoPct / 100)
        const montoTotal = montoBase - montoBonificacion

        if (montoTotal <= 0) continue

        // Anti-duplicado por (socio, categoría, período)
        const yaExiste = await req.db.cargo.findFirst({
          where: {
            socioId: socio.id,
            categoriaActividadId: categoria.id,
            periodoId: periodoActual.id
          }
        })
        if (yaExiste) continue

        const cargoActividad = await req.db.cargo.create({
          data: {
            socio: { connect: { id: socio.id } },
            periodo: { connect: { id: periodoActual.id } },
            categoriaActividad: { connect: { id: categoria.id } },
            ...(actividad.conceptoTesoreriaId ? {
              conceptoTesoreria: { connect: { id: actividad.conceptoTesoreriaId } }
            } : {}),
            categoria: 'CUOTA_ACTIVIDAD',
            descripcion: `${actividad.nombre} - ${categoria.nombre} - ${socio.apellidoNombre} - ${periodoActual.mes}/${periodoActual.anio}`,
            montoOriginal: montoBase,
            montoBonificacion,
            montoTotal,
            fechaVencimiento: periodoActual.fechaVencimiento,
            estado: 'PENDIENTE',
            origen: 'ALTA_INSCRIPCION',
            motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
          }
        })
        cuotasGeneradas.push(cargoActividad)
      }
    }
  }

  // PASO 5: Crear LinkPago para la primera cuota
  let linkPago = null
  if (cuotasGeneradas.length > 0) {
    const montoTotal = cuotasGeneradas.reduce((sum, cargo) => sum + parseFloat(cargo.montoTotal), 0)

    linkPago = await req.db.linkPago.create({
      data: {
        socio: { connect: { id: nuevoSocio.id } },
        concepto: 'Primera cuota - Alta de socio',
        descripcion: 'Primera cuota - Alta de socio',
        montoTotal: montoTotal,
        cargosIds: cuotasGeneradas.map(c => c.id).join(','),
        plataforma: 'MERCADOPAGO',
        estado: 'PENDIENTE',
        fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      }
    })
  }

  // PASO 6: Actualizar la solicitud
  const solicitudActualizada = await req.db.solicitudSocio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'APROBADA',
      fechaRespuesta: new Date(),
      respondidoPor: req.admin.id,
      socioCreado: nuevoSocio.id,
      observacionesInternas
    }
  })

  // PASO 7: Enviar email de bienvenida
  try {
    const fechaAlta = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    const baseUrl = getTenantFrontendUrl(req.tenant)
    await enviarEmailConTemplate('BIENVENIDA', nuevoSocio.email, {
      socioNombre: nuevoSocio.apellidoNombre,
      nroSocio: nuevoSocio.nroSocio,
      fechaAlta,
      linkPortal: `${baseUrl}/mi-qr`,
      linkMiQR: `${baseUrl}/mi-qr`
    }, req.db)
  } catch (emailError) {
    console.error('Error enviando email de bienvenida:', emailError)
  }

  res.json({
    success: true,
    message: `Solicitud aprobada. ${sociosCreados.length} socio(s) creado(s) correctamente.`,
    data: {
      solicitud: solicitudActualizada,
      socioTitular: nuevoSocio,
      sociosFamiliares: sociosCreados.slice(1),
      cuotasGeneradas: cuotasGeneradas.length,
      linkPago: linkPago ? {
        codigo: linkPago.codigo,
        url: `${getTenantFrontendUrl(req.tenant)}/pagar/${linkPago.codigo}`,
        montoTotal: linkPago.montoTotal
      } : null
    }
  })
}))

/**
 * PUT /api/admin/solicitudes/:id/rechazar
 * Rechazar una solicitud
 */
router.put('/solicitudes/:id/rechazar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivoRechazo } = req.body

  if (!motivoRechazo) {
    throw new AppError('Debe especificar el motivo del rechazo', 400)
  }

  const solicitud = await req.db.solicitudSocio.findUnique({
    where: { id: parseInt(id) }
  })

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.estado !== 'PENDIENTE') {
    throw new AppError('Esta solicitud ya fue procesada', 400)
  }

  // Actualizar la solicitud
  const solicitudActualizada = await req.db.solicitudSocio.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'RECHAZADA',
      fechaRespuesta: new Date(),
      respondidoPor: req.admin.id,
      motivoRechazo
    }
  })

  // Enviar email de rechazo
  try {
    const clubNombre = (await req.db.configuracion.findFirst({
      where: { clave: 'CLUB_NOMBRE' }
    }))?.valor || 'Club Sportivo Pilar'

    await enviarEmailConTemplate('SOLICITUD_RECHAZADA', solicitud.email, {
      nombreCompleto: `${solicitud.nombres} ${solicitud.apellidos}`,
      clubNombre,
      motivoRechazo,
      telefonoContacto: process.env.CLUB_TELEFONO || '+54 9 230 434 6897'
    }, req.db)
  } catch (emailError) {
    console.error('Error enviando email de rechazo:', emailError)
  }

  res.json({
    success: true,
    message: 'Solicitud rechazada correctamente',
    data: solicitudActualizada
  })
}))

/**
 * GET /api/admin/solicitudes/estadisticas
 * Obtener estadísticas de solicitudes
 */
router.get('/solicitudes-stats', asyncHandler(async (req, res) => {
  const [pendientes, aprobadas, rechazadas, totalMes] = await Promise.all([
    req.db.solicitudSocio.count({ where: { estado: 'PENDIENTE' } }),
    req.db.solicitudSocio.count({ where: { estado: 'APROBADA' } }),
    req.db.solicitudSocio.count({ where: { estado: 'RECHAZADA' } }),
    req.db.solicitudSocio.count({
      where: {
        fechaSolicitud: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    })
  ])

  res.json({
    success: true,
    data: {
      pendientes,
      aprobadas,
      rechazadas,
      total: pendientes + aprobadas + rechazadas,
      totalMes
    }
  })
}))

export default router
