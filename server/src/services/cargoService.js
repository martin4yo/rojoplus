/**
 * Cargo Service — generación de cargos reutilizable.
 *
 * Copia fiel de la lógica de POST /api/admin/cargos (categoría default,
 * validación de categoría, descripción desde concepto, montoTotal, grupo
 * familiar, origen MANUAL). La usa el asistente Axio para que un cargo generado
 * desde el chat sea idéntico al de la pantalla. Recibe Prisma tenant-scoped;
 * los IDs (socioId, centroCostoId) ya vienen resueltos por el caller.
 */
import { AppError } from '../middleware/errorHandler.js'

export async function crearCargo(db, tenantId, data, { actorId = null } = {}) {
  const {
    socioId,
    categoria,
    periodoId,
    categoriaActividadId,
    conceptoTesoreriaId,
    centroCostoId,
    descripcion,
    montoOriginal,
    montoRecargo = 0,
    montoBonificacion = 0,
    fechaVencimiento,
    cargoOrigenId,
  } = data

  if (!socioId || montoOriginal == null) {
    throw new AppError('socioId y montoOriginal son requeridos', 400, 'VALIDATION_ERROR')
  }
  if (!centroCostoId) {
    throw new AppError('El Centro de Costo es obligatorio', 400, 'CC_REQUIRED')
  }

  // Categoría default + validación
  const categoriaFinal = categoria || 'CUOTA_ACTIVIDAD'
  const catValida = await db.categoriaCargo.findFirst({ where: { codigo: categoriaFinal } })
  if (!catValida) {
    throw new AppError(`Categoría inválida: ${categoriaFinal}`, 400, 'INVALID_CATEGORIA')
  }

  // Descripción desde el concepto si no viene explícita
  let descripcionFinal = descripcion
  if (conceptoTesoreriaId && !descripcionFinal) {
    const concepto = await db.conceptoTesoreria.findUnique({
      where: { id: parseInt(conceptoTesoreriaId) },
      select: { nombre: true },
    })
    if (concepto) descripcionFinal = concepto.nombre
  }

  // Verificar que exista el socio
  const socio = await db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: { id: true, titularFamiliaId: true },
  })
  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const montoTotal = parseFloat(montoOriginal) + parseFloat(montoRecargo) - parseFloat(montoBonificacion)

  return db.cargo.create({
    data: {
      socioId: parseInt(socioId),
      grupoFamiliarId: socio.titularFamiliaId || socio.id,
      categoria: categoriaFinal,
      periodoId: periodoId ? parseInt(periodoId) : null,
      categoriaActividadId: categoriaActividadId ? parseInt(categoriaActividadId) : null,
      conceptoTesoreriaId: conceptoTesoreriaId ? parseInt(conceptoTesoreriaId) : null,
      centroCostoId: parseInt(centroCostoId),
      descripcion: descripcionFinal,
      montoOriginal: parseFloat(montoOriginal),
      montoRecargo: parseFloat(montoRecargo),
      montoBonificacion: parseFloat(montoBonificacion),
      montoTotal,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : new Date(),
      cargoOrigenId: cargoOrigenId ? parseInt(cargoOrigenId) : null,
      origen: 'MANUAL',
    },
    include: {
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
      periodo: { select: { nombre: true } },
    },
  })
}
