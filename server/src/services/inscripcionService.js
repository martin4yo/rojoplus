/**
 * Inscripcion Service — alta de inscripción a actividad reutilizable.
 *
 * Copia fiel de la lógica de POST /api/admin/inscripciones (valida socio activo,
 * edad, cupo, centro de costo obligatorio, anti-duplicado, y genera el cargo de
 * la cuota de actividad para el período correspondiente). La usa el asistente
 * Axio para que inscribir desde el chat sea idéntico a hacerlo desde la pantalla.
 * Recibe Prisma tenant-scoped (`db`); los IDs (socioId, categoriaActividadId,
 * centroCostoId) ya vienen resueltos por el caller.
 */
import { AppError } from '../middleware/errorHandler.js'
import { resolverPeriodoAlta } from '../lib/cuotasPeriodoAlta.js'
import { esSocioActivo, SELECT_ESTADO_SOCIO_REL } from '../lib/socioEstado.js'
import { registrarEvento } from './auditoriaService.js'

/**
 * Inscribe a un socio en una categoría de actividad.
 *
 * @param {*} db        Prisma tenant-scoped
 * @param {number} tenantId
 * @param {object} data  { socioId, categoriaActividadId, centroCostoId, exentoCuota?, porcentajeCuota?, fechaInicio? }
 * @param {{ actorId?: number|null, origen?: string }} opts
 * @returns {Promise<{ inscripcion, cargoGenerado }>}
 */
export async function inscribirActividad(db, tenantId, data, { actorId = null, origen = 'UI' } = {}) {
  const {
    socioId,
    categoriaActividadId,
    centroCostoId,
    exentoCuota = false,
    porcentajeCuota = 100,
    fechaInicio,
  } = data

  // Validaciones básicas
  if (!socioId || !categoriaActividadId) {
    throw new AppError('socioId y categoriaActividadId son requeridos', 400, 'VALIDATION_ERROR')
  }
  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }

  // Verificar que el socio existe y está activo
  const socio = await db.socio.findUnique({
    where: { id: parseInt(socioId) },
    include: { categoriaSocioRel: true, estadoSocioRel: SELECT_ESTADO_SOCIO_REL },
  })
  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }
  if (!esSocioActivo(socio)) {
    throw new AppError(`El socio no está activo (estado: ${socio.estadoSocioRel?.nombre || 'sin estado'})`, 400)
  }

  // Verificar que la categoría existe y está activa
  const categoria = await db.categoriaActividad.findUnique({
    where: { id: parseInt(categoriaActividadId) },
    include: { actividad: { include: { conceptoTesoreria: true } } },
  })
  if (!categoria) {
    throw new AppError('Categoría de actividad no encontrada', 404)
  }
  if (!categoria.activo) {
    throw new AppError('La categoría no está activa', 400)
  }

  // Validar edad del socio
  const edad = Math.floor((new Date() - new Date(socio.fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
  if (categoria.edadMinima && edad < categoria.edadMinima) {
    throw new AppError(`El socio tiene ${edad} años. Edad mínima requerida: ${categoria.edadMinima} años`, 400)
  }
  if (categoria.edadMaxima && edad > categoria.edadMaxima) {
    throw new AppError(`El socio tiene ${edad} años. Edad máxima permitida: ${categoria.edadMaxima} años`, 400)
  }

  // Validar cupo máximo
  if (categoria.cupoMaximo && categoria.cupoMaximo > 0) {
    const inscriptosActivos = await db.inscripcion.count({
      where: { categoriaActividadId: parseInt(categoriaActividadId), estado: 'ACTIVA' },
    })
    if (inscriptosActivos >= categoria.cupoMaximo) {
      throw new AppError(`Cupo completo para ${categoria.nombre}. Máximo: ${categoria.cupoMaximo} inscriptos`, 400)
    }
  }

  // Verificar que no esté ya inscripto en esta categoría
  const inscripcionExistente = await db.inscripcion.findFirst({
    where: {
      socioId: parseInt(socioId),
      categoriaActividadId: parseInt(categoriaActividadId),
      estado: 'ACTIVA',
    },
  })
  if (inscripcionExistente) {
    throw new AppError('El socio ya está inscripto en esta categoría', 400)
  }

  const exento = exentoCuota === true || exentoCuota === 'true'

  // Crear la inscripción
  const inscripcion = await db.inscripcion.create({
    data: {
      socioId: parseInt(socioId),
      categoriaActividadId: parseInt(categoriaActividadId),
      centroCostoId: parseInt(centroCostoId),
      fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
      estado: 'ACTIVA',
      exentoCuota: exento,
      porcentajeCuota: parseFloat(porcentajeCuota) || 100,
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true } },
      categoriaActividad: { include: { actividad: true } },
    },
  })

  // Generar cargo de la cuota de actividad para el período correspondiente
  // según el día de corte configurado (mes corriente o siguiente).
  let cargoGenerado = null
  if (!exento) {
    const periodo = await resolverPeriodoAlta(db)
    const actividad = categoria.actividad

    // Determinar monto: concepto de tesorería de la actividad → categoría → actividad
    let montoBase = actividad.conceptoTesoreria?.cuotaMensual
      ? Number(actividad.conceptoTesoreria.cuotaMensual)
      : (categoria.cuotaMensual ? Number(categoria.cuotaMensual)
      : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

    if (montoBase > 0) {
      const pctInsc = parseFloat(porcentajeCuota) || 100
      if (pctInsc !== 100) montoBase = montoBase * (pctInsc / 100)

      const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
        ? Number(socio.categoriaSocioRel.porcentajeDescuento)
        : 0
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      // Verificar que no exista ya un cargo para esa categoría + período (anti-duplicado)
      const yaExiste = await db.cargo.findFirst({
        where: {
          socioId: parseInt(socioId),
          categoriaActividadId: parseInt(categoriaActividadId),
          periodoId: periodo.id,
        },
      })

      if (!yaExiste && montoTotal > 0) {
        cargoGenerado = await db.cargo.create({
          data: {
            socio: { connect: { id: parseInt(socioId) } },
            periodo: { connect: { id: periodo.id } },
            categoriaActividad: { connect: { id: parseInt(categoriaActividadId) } },
            ...(actividad.conceptoTesoreriaId ? {
              conceptoTesoreria: { connect: { id: actividad.conceptoTesoreriaId } }
            } : {}),
            categoria: 'CUOTA_ACTIVIDAD',
            descripcion: `${actividad.nombre} - ${categoria.nombre} - ${periodo.nombre}`,
            montoOriginal: montoBase,
            montoBonificacion,
            montoTotal,
            estado: 'PENDIENTE',
            fechaVencimiento: periodo.fechaVencimiento,
            origen: 'ALTA_INSCRIPCION',
            motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
          },
        })
      }
    }
  }

  // Auditoría
  await registrarEvento(db, {
    socioId: parseInt(socioId), tenantId,
    evento: 'INSCRIPCION_ACT',
    detalle: {
      inscripcionId: inscripcion.id,
      actividad: categoria.actividad?.nombre,
      categoria: categoria.nombre,
      cargoGeneradoId: cargoGenerado?.id || null,
    },
    origen, usuarioId: actorId,
  })

  return { inscripcion, cargoGenerado }
}
