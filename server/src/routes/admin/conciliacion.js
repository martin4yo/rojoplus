import { Router } from 'express'
import { asyncHandler, AppError } from '../../middleware/errorHandler.js'
import { authAdmin } from '../../middleware/auth.js'
import { generarAsientoPagoCuota } from '../../services/asientosContables.js'

const router = Router()

// PAGOS INFORMADOS (Conciliación de transferencias)
// ==============================================================================

// GET /api/admin/pagos-informados - Listar pagos informados
router.get('/pagos-informados', authAdmin, asyncHandler(async (req, res) => {
  const { estado = 'PENDIENTE', page = 1 } = req.query
  const limit = 50
  const skip = (parseInt(page) - 1) * limit

  const where = {}
  if (estado && estado !== 'TODOS') {
    where.estado = estado
  }

  const [pagos, total] = await Promise.all([
    req.db.pagoInformado.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaInformado: 'desc' },
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellidoNombre: true,
            email: true,
            celular: true,
          },
        },
        admin: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
    }),
    req.db.pagoInformado.count({ where }),
  ])

  // Parse cuotasIds (JSON string to array)
  const pagosConCuotas = await Promise.all(
    pagos.map(async (pago) => {
      const cuotasIds = JSON.parse(pago.cuotasIds)
      const cuotas = await req.db.cargo.findMany({
        where: { id: { in: cuotasIds } },
        select: {
          id: true,
          categoria: true,
          descripcion: true,
          montoTotal: true,
          estado: true,
          periodo: { select: { nombre: true, anio: true, mes: true } },
          categoriaActividad: {
            select: {
              nombre: true,
              actividad: { select: { nombre: true } },
            },
          },
        },
      })

      return {
        ...pago,
        cuotas,
      }
    })
  )

  res.json({
    success: true,
    data: pagosConCuotas,
    pagination: {
      page: parseInt(page),
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}))

// GET /api/admin/pagos-informados/count - Contador de pendientes
router.get('/pagos-informados/count', authAdmin, asyncHandler(async (req, res) => {
  const count = await req.db.pagoInformado.count({
    where: { estado: 'PENDIENTE' },
  })

  res.json({
    success: true,
    count,
  })
}))

// POST /api/admin/pagos-informados/:id/confirmar - Confirmar pago
router.post('/pagos-informados/:id/confirmar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { cajaId, medioPagoId } = req.body

  // Validaciones
  if (!cajaId || !medioPagoId) {
    throw new AppError('Caja y medio de pago son obligatorios', 400, 'VALIDATION_ERROR')
  }

  // Obtener pago informado
  const pagoInformado = await req.db.pagoInformado.findUnique({
    where: { id: parseInt(id) },
    include: {
      socio: {
        select: {
          id: true,
          nroSocio: true,
          apellidoNombre: true,
          titularFamiliaId: true,
        },
      },
    },
  })

  if (!pagoInformado) {
    throw new AppError('Pago informado no encontrado', 404, 'NOT_FOUND')
  }

  if (pagoInformado.estado !== 'PENDIENTE') {
    throw new AppError('El pago ya fue procesado', 400, 'ALREADY_PROCESSED')
  }

  // Parse cuotas IDs
  const cuotasIds = JSON.parse(pagoInformado.cuotasIds)

  // Obtener cuotas con centro de costos
  const cuotas = await req.db.cargo.findMany({
    where: { id: { in: cuotasIds } },
    include: {
      categoriaActividad: {
        select: {
          actividad: {
            select: {
              centroCostoId: true,
            },
          },
        },
      },
    },
  })

  // Verificar que todas las cuotas existen y están PENDIENTES
  if (cuotas.length !== cuotasIds.length) {
    throw new AppError('Algunas cuotas no existen', 400, 'INVALID_CUOTAS')
  }

  const pendientes = cuotas.filter((c) => c.estado === 'PENDIENTE')
  if (pendientes.length === 0) {
    throw new AppError('No hay cuotas pendientes para confirmar', 400, 'NO_PENDING_CUOTAS')
  }

  // Crear pago real en la BD
  const montoTotal = pendientes.reduce((sum, c) => sum + parseFloat(c.montoTotal), 0)

  const pago = await req.db.pago.create({
    data: {
      numero: `P-${Date.now()}`,
      fecha: new Date(),
      socioId: pagoInformado.socioId,
      grupoFamiliarId: pagoInformado.socio.titularFamiliaId,
      montoTotal,
      montoRecibido: montoTotal,
      montoACuenta: 0,
      medioPagoId: parseInt(medioPagoId),
      cajaId: parseInt(cajaId),
      origen: 'PORTAL_SOCIO',
      observaciones: `Pago confirmado desde transferencia informada. Comprobante: ${pagoInformado.comprobante}`,
      registradoPor: req.adminId,
    },
  })

  // Marcar cuotas como PAGADAS y crear cargos
  await Promise.all(
    pendientes.map(async (cuota) => {
      // Actualizar estado de cuota
      await req.db.cargo.update({
        where: { id: cuota.id },
        data: {
          estado: 'PAGADO',
          pagoId: pago.id,
        },
      })

      // Determinar centro de costos (de la actividad o null)
      const centroCostoId = cuota.categoriaActividad?.actividad?.centroCostoId || null

      // Crear movimiento de caja
      await req.db.movimientoCaja.create({
        data: {
          fecha: new Date(),
          tipo: 'INGRESO',
          cajaId: parseInt(cajaId),
          monto: parseFloat(cuota.montoTotal),
          concepto: `Cobro cuota: ${cuota.descripcion}`,
          referencia: `Pago ${pago.numero} - Cargo #${cuota.id}`,
          registradoPor: req.adminId,
          centroCostoId,
        },
      })
    })
  )

  // Marcar pago informado como CONFIRMADO
  await req.db.pagoInformado.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'CONFIRMADO',
      fechaProcesado: new Date(),
      procesadoPor: req.adminId,
      pagoId: pago.id,
    },
  })

  res.json({
    success: true,
    message: 'Pago confirmado correctamente',
    data: {
      pagoId: pago.id,
      numero: pago.numero,
    },
  })
}))

// POST /api/admin/pagos-informados/:id/rechazar - Rechazar pago
router.post('/pagos-informados/:id/rechazar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { motivo } = req.body

  if (!motivo) {
    throw new AppError('El motivo de rechazo es obligatorio', 400, 'VALIDATION_ERROR')
  }

  const pagoInformado = await req.db.pagoInformado.findUnique({
    where: { id: parseInt(id) },
  })

  if (!pagoInformado) {
    throw new AppError('Pago informado no encontrado', 404, 'NOT_FOUND')
  }

  if (pagoInformado.estado !== 'PENDIENTE') {
    throw new AppError('El pago ya fue procesado', 400, 'ALREADY_PROCESSED')
  }

  await req.db.pagoInformado.update({
    where: { id: parseInt(id) },
    data: {
      estado: 'RECHAZADO',
      fechaProcesado: new Date(),
      procesadoPor: req.adminId,
      motivoRechazo: motivo,
    },
  })

  res.json({
    success: true,
    message: 'Pago rechazado correctamente',
  })
}))

export default router
