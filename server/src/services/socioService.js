/**
 * Socio Service — lógica de negocio de socios reutilizable.
 *
 * Fuente ÚNICA del alta/cambios de socio: la usan tanto los routes de admin
 * (`routes/admin/socios.js`) como el asistente Axio (`actionExecutor.js`), para
 * que crear un socio desde el chat sea idéntico a crearlo desde la pantalla
 * (mismo nroSocio, misma cuota automática, misma auditoría). Recibe un cliente
 * Prisma tenant-scoped (`db`); NO setea tenantId (lo inyecta el extension).
 */
import { AppError } from '../middleware/errorHandler.js'
import { calcularProximoNroSocio } from '../lib/nroSocio.js'
import { resolverPeriodoAlta } from '../lib/cuotasPeriodoAlta.js'
import { registrarEvento } from './auditoriaService.js'

/**
 * Resuelve estado/categoria/tipoSocio del socio desde IDs (preferido) o strings
 * legacy. Sólo persiste FKs (estadoSocioId, categoriaSocioId, tipoSocioRelId).
 * Devuelve { estadoSocioId?, categoriaSocioId?, tipoSocioRelId?, tipoSocioRecord }.
 */
export async function resolverRelacionesSocio(db, tenantId, data) {
  const out = {}
  let tipoSocioRecord = null

  // Estado
  if (data.estadoSocioId !== undefined && data.estadoSocioId !== null && data.estadoSocioId !== '') {
    const est = await db.estadoSocio.findFirst({
      where: { id: parseInt(data.estadoSocioId), tenantId },
    })
    if (!est) throw new AppError('Estado de socio no encontrado', 400, 'INVALID_FK')
    out.estadoSocioId = est.id
  } else if (data.estado !== undefined) {
    if (data.estado) {
      const est = await db.estadoSocio.findFirst({ where: { tenantId, nombre: data.estado } })
      out.estadoSocioId = est?.id || null
    } else {
      out.estadoSocioId = null
    }
  }

  // Categoría
  if (data.categoriaSocioId !== undefined && data.categoriaSocioId !== null && data.categoriaSocioId !== '') {
    const cat = await db.categoriaSocio.findFirst({
      where: { id: parseInt(data.categoriaSocioId), tenantId },
    })
    if (!cat) throw new AppError('Categoría de socio no encontrada', 400, 'INVALID_FK')
    out.categoriaSocioId = cat.id
  } else if (data.categoria !== undefined) {
    if (data.categoria) {
      const cat = await db.categoriaSocio.findFirst({ where: { tenantId, nombre: data.categoria } })
      out.categoriaSocioId = cat?.id || null
    } else {
      out.categoriaSocioId = null
    }
  }

  // Tipo socio
  if (data.tipoSocioRelId !== undefined && data.tipoSocioRelId !== null && data.tipoSocioRelId !== '') {
    tipoSocioRecord = await db.tipoSocio.findFirst({
      where: { id: parseInt(data.tipoSocioRelId), tenantId },
    })
    if (!tipoSocioRecord) throw new AppError('Tipo de socio no encontrado', 400, 'INVALID_FK')
    out.tipoSocioRelId = tipoSocioRecord.id
  } else if (data.tipoSocio !== undefined) {
    if (data.tipoSocio) {
      tipoSocioRecord = await db.tipoSocio.findFirst({
        where: { tenantId, OR: [{ nombre: data.tipoSocio }, { codigo: data.tipoSocio }] },
      })
      out.tipoSocioRelId = tipoSocioRecord?.id || null
    } else {
      out.tipoSocioRelId = null
    }
  }

  return { ...out, tipoSocioRecord }
}

/**
 * Crea un socio con la misma lógica que el alta de admin: resuelve FKs, calcula
 * el nroSocio (respeta SOCIO_NRO_MIN/MAX), genera la cuota social automática
 * según el TipoSocio, y registra la auditoría.
 *
 * @param {*} db        Prisma tenant-scoped
 * @param {number} tenantId
 * @param {object} data  Payload del socio (mismos campos que POST /admin/socios)
 * @param {{ actorId?: number|null, origen?: string }} opts
 * @returns {Promise<{ socio, cuotaSocialGenerada }>}
 */
export async function crearSocio(db, tenantId, data, { actorId = null, origen = 'UI' } = {}) {
  // Validaciones básicas
  if (!data.apellidoNombre) {
    throw new AppError('El nombre del socio es requerido', 400, 'VALIDATION_ERROR')
  }

  // Resolver FK + string legacy de estado/categoria/tipoSocio
  const rel = await resolverRelacionesSocio(db, tenantId, data)

  // Recalcular nroSocio al momento de guardar (respeta SOCIO_NRO_MIN/MAX).
  let nroSocioFinal = data.nroSocio ? String(data.nroSocio) : null
  if (nroSocioFinal) {
    const colision = await db.socio.findFirst({
      where: { nroSocio: nroSocioFinal },
      select: { id: true },
    })
    if (colision) nroSocioFinal = null
  }
  if (!nroSocioFinal) {
    nroSocioFinal = await calcularProximoNroSocio(db)
  }

  const socioData = {
    nroSocio: nroSocioFinal,
    tipoDocumento: data.tipoDocumento || 'DNI',
    documento: data.documento || null,
    cuil: data.cuil || null,
    apellido: data.apellido || null,
    nombre: data.nombre || null,
    apellidoNombre: data.apellidoNombre,
    fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
    lugarNacimiento: data.lugarNacimiento || null,
    sexo: data.sexo || null,
    nacionalidad: data.nacionalidad || 'Argentina',
    estadoCivil: data.estadoCivil || null,
    profesion: data.profesion || null,
    fotoUrl: data.fotoUrl || null,
    // Contacto
    email: data.email || null,
    emailSecundario: data.emailSecundario || null,
    telefonoFijo: data.telefonoFijo || null,
    celular: data.celular || null,
    celularSecundario: data.celularSecundario || null,
    // Domicilio
    domicilio: data.domicilio || null,
    calle: data.calle || null,
    numero: data.numero || null,
    piso: data.piso || null,
    depto: data.depto || null,
    barrio: data.barrio || null,
    codigoPostal: data.codigoPostal || null,
    ciudad: data.ciudad || null,
    provincia: data.provincia || 'Buenos Aires',
    // Club
    fechaAlta: data.fechaAlta ? new Date(data.fechaAlta) : new Date(),
    estadoSocioId: rel.estadoSocioId ?? null,
    categoriaSocioId: rel.categoriaSocioId ?? null,
    tipoSocioRelId: rel.tipoSocioRelId ?? null,
    zona: data.zona || null,
    libro: data.libro || null,
    folio: data.folio || null,
    antiguedadEstatutaria: data.antiguedadEstatutaria || null,
    // Menores
    esMenor: data.esMenor || false,
    responsableId: (data.esMenor && data.responsableId) ? parseInt(data.responsableId, 10) || null : null,
    parentescoResponsable: (data.esMenor && data.parentescoResponsable) ? data.parentescoResponsable : null,
    // Datos médicos
    grupoSanguineo: data.grupoSanguineo || null,
    factorRh: data.factorRh || null,
    obraSocial: data.obraSocial || null,
    nroObraSocial: data.nroObraSocial || null,
    alergias: data.alergias || null,
    condicionesMedicas: data.condicionesMedicas || null,
    medicamentos: data.medicamentos || null,
    aptaFisicaVigente: data.aptaFisicaVigente || false,
    aptaFisicaVence: data.aptaFisicaVence ? new Date(data.aptaFisicaVence) : null,
    // Emergencia
    emergenciaNombre1: data.emergenciaNombre1 || null,
    emergenciaTel1: data.emergenciaTel1 || null,
    emergenciaParent1: data.emergenciaParent1 || null,
    emergenciaNombre2: data.emergenciaNombre2 || null,
    emergenciaTel2: data.emergenciaTel2 || null,
    emergenciaParent2: data.emergenciaParent2 || null,
    // Cobranza
    formaPagoPref: data.formaPagoPref || null,
    cobradorId: data.cobradorId || null,
    // Débito
    debitoTipo: data.debitoTipo || null,
    bancoDebito: data.bancoDebito || null,
    cbuDebito: data.cbuDebito || null,
    aliasDebito: data.aliasDebito || null,
    titularCuenta: data.titularCuenta || null,
    enviaDebito: data.enviaDebito || false,
    // Tarjeta
    tarjetaMarca: data.tarjetaMarca || null,
    tarjetaNumero: data.tarjetaNumero || null,
    tarjetaUltimos4: data.tarjetaNumero ? data.tarjetaNumero.slice(-4) : null,
    tarjetaVencimiento: data.tarjetaVencimiento || null,
    tarjetaCvv: data.tarjetaCvv || null,
    // Fiscal
    condicionFiscal: data.condicionFiscal || null,
    // Observaciones
    observaciones: data.observaciones || null,
    observacionesInternas: data.observacionesInternas || null,
    // Auditoría
    creadoPor: actorId,
  }

  const socio = await db.socio.create({
    data: socioData,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      tokenPortal: true,
    },
  })

  // Generar cuota social automáticamente según el TipoSocio (si tiene cuotaMensual > 0).
  // No se genera si el socio es miembro de una familia (la cuota la paga el titular).
  // Aplica descuento de la CategoriaSocio; si el monto final es 0, no se crea.
  let cuotaSocialGenerada = null
  const tipoSocio = rel.tipoSocioRecord
  if (tipoSocio && !data.titularFamiliaId) {
    if (tipoSocio.cuotaMensual && Number(tipoSocio.cuotaMensual) > 0) {
      const fechaAlta = data.fechaAlta ? new Date(data.fechaAlta) : new Date()
      const periodo = await resolverPeriodoAlta(db, fechaAlta)
      if (periodo) {
        const montoBase = Number(tipoSocio.cuotaMensual)
        const categoriaSocio = rel.categoriaSocioId
          ? await db.categoriaSocio.findUnique({ where: { id: rel.categoriaSocioId } })
          : null
        const descuentoPct = categoriaSocio?.porcentajeDescuento ? Number(categoriaSocio.porcentajeDescuento) : 0
        const montoBonificacion = montoBase * (descuentoPct / 100)
        const montoTotal = montoBase - montoBonificacion
        if (montoTotal > 0) {
          cuotaSocialGenerada = await db.cargo.create({
            data: {
              socio: { connect: { id: socio.id } },
              periodo: { connect: { id: periodo.id } },
              ...(tipoSocio.conceptoTesoreriaId ? {
                conceptoTesoreria: { connect: { id: tipoSocio.conceptoTesoreriaId } }
              } : {}),
              categoria: 'CUOTA_SOCIAL',
              descripcion: `Cuota Social ${periodo.nombre || `${periodo.mes}/${periodo.anio}`}`,
              tipoCuota: tipoSocio.codigo || tipoSocio.nombre,
              montoOriginal: montoBase,
              montoBonificacion,
              montoTotal,
              estado: 'PENDIENTE',
              fechaVencimiento: periodo.fechaVencimiento,
              origen: 'ALTA_SOCIO',
              motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
            },
          })
        }
      }
    }
  }

  // Auditoría: alta de socio
  await registrarEvento(db, {
    socioId: socio.id, tenantId,
    evento: 'ALTA_SOCIO',
    detalle: { nroSocio: socio.nroSocio, apellidoNombre: socio.apellidoNombre, cuotaSocialGenerada },
    origen, usuarioId: actorId,
  })

  return { socio, cuotaSocialGenerada }
}

/**
 * Cambia el estado de un socio. Si el nuevo estado da de baja al socio
 * (esSocioActivo=false) setea fechaBaja/motivoBaja; si lo reactiva, los limpia.
 * NOTA: es un cambio directo — NO propaga a la familia ni regenera cuotas en la
 * reactivación (eso vive en los flujos POST /socios/:id/desactivar|activar). Para
 * bajas/reactivaciones con esos efectos, usar la pantalla.
 */
export async function cambiarEstadoSocio(db, tenantId, { socioId, estadoSocioId, motivo = null }, { actorId = null } = {}) {
  const estado = await db.estadoSocio.findFirst({
    where: { id: estadoSocioId },
    select: { id: true, nombre: true, esSocioActivo: true },
  })
  if (!estado) throw new AppError('Estado de socio no encontrado', 400, 'INVALID_FK')

  const esBaja = estado.esSocioActivo === false
  const updateData = { estadoSocioId: estado.id, actualizadoPor: actorId }
  if (esBaja) {
    updateData.fechaBaja = new Date()
    updateData.motivoBaja = motivo || 'Cambio de estado desde el asistente'
  } else {
    updateData.fechaBaja = null
    updateData.motivoBaja = null
  }

  const socio = await db.socio.update({
    where: { id: socioId },
    data: updateData,
    select: { id: true, nroSocio: true, apellidoNombre: true },
  })

  await registrarEvento(db, {
    socioId: socio.id, tenantId,
    evento: esBaja ? 'BAJA_SOCIO' : 'CAMBIO_ESTADO',
    detalle: { estado: estado.nombre, motivo: updateData.motivoBaja || null },
    origen: 'CHAT', usuarioId: actorId,
  })

  return { socio, estado }
}

/**
 * Actualiza el tipo y/o la categoría de un socio (los IDs ya vienen resueltos).
 */
export async function actualizarTipoSocio(db, tenantId, { socioId, tipoSocioRelId = null, categoriaSocioId = null }, { actorId = null } = {}) {
  const updateData = { actualizadoPor: actorId }
  if (tipoSocioRelId != null) updateData.tipoSocioRelId = tipoSocioRelId
  if (categoriaSocioId != null) updateData.categoriaSocioId = categoriaSocioId

  const socio = await db.socio.update({
    where: { id: socioId },
    data: updateData,
    select: { id: true, nroSocio: true, apellidoNombre: true },
  })

  await registrarEvento(db, {
    socioId: socio.id, tenantId,
    evento: 'CAMBIO_TIPO_SOCIO',
    detalle: { tipoSocioRelId, categoriaSocioId },
    origen: 'CHAT', usuarioId: actorId,
  })

  return { socio }
}
