import { Router } from 'express'
import crypto from 'crypto'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { enviarMagicLinkSocio } from '../services/email.js'

const router = Router()

// ==============================================================================
// BÚSQUEDA PÚBLICA (para obtener QR) - DEBE IR PRIMERO
// ==============================================================================

// GET /api/socio/buscar - Buscar socio por DNI o nro socio (acceso público para QR)
router.get('/buscar', asyncHandler(async (req, res) => {
  const { q } = req.query

  if (!q) {
    throw new AppError('Parámetro de búsqueda requerido', 400, 'VALIDATION_ERROR')
  }

  const socio = await req.prisma.socio.findFirst({
    where: {
      OR: [
        { nroSocio: q.trim() },
        { documento: q.trim() },
      ],
    },
    select: {
      tokenPortal: true,
      estado: true,
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Verificar si está activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Regulariza tu situación en el club para acceder a los beneficios.', 403, 'SOCIO_INACTIVO')
  }

  if (!socio.tokenPortal) {
    throw new AppError('Error al obtener tu QR. Contacta al club.', 500, 'NO_TOKEN')
  }

  res.json({
    success: true,
    data: {
      tokenPortal: socio.tokenPortal,
    },
  })
}))

// ==============================================================================
// AUTENTICACIÓN - MAGIC LINK
// ==============================================================================

// POST /api/socio/enviar-link-acceso - Enviar Magic Link al socio
router.post('/enviar-link-acceso', asyncHandler(async (req, res) => {
  const { metodo, valor } = req.body // metodo: 'email' | 'dni'

  if (!metodo || !valor) {
    throw new AppError('Método y valor son requeridos', 400, 'VALIDATION_ERROR')
  }

  // Buscar socio según método
  const where = metodo === 'email'
    ? { email: valor.trim().toLowerCase() }
    : { documento: valor.trim() }

  const socio = await req.prisma.socio.findFirst({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      documento: true,
      estado: true,
    },
  })

  if (!socio) {
    throw new AppError('No se encontró un socio con esos datos', 404, 'SOCIO_NOT_FOUND')
  }

  if (!socio.email) {
    throw new AppError('Este socio no tiene email registrado. Contactá al club para actualizarlo', 400, 'NO_EMAIL')
  }

  // Verificar estado activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  if (!esActivo) {
    throw new AppError('Tu membresía no está activa. Contactá al club para regularizar tu situación', 403, 'SOCIO_INACTIVO')
  }

  // Generar token único con expiración de 24 horas
  const token = crypto.randomBytes(32).toString('hex')
  const expiracion = new Date()
  expiracion.setHours(expiracion.getHours() + 24)

  // Guardar token en BD (usaremos tokenPortal + tokenPortalExpira)
  await req.prisma.socio.update({
    where: { id: socio.id },
    data: {
      tokenPortal: token,
      tokenPortalExpira: expiracion,
    },
  })

  // Enviar email con Magic Link
  await enviarMagicLinkSocio(socio, token)

  res.json({
    success: true,
    message: 'Link de acceso enviado a tu email',
  })
}))

// GET /api/socio/validar-token/:token - Validar token de Magic Link
router.get('/validar-token/:token', asyncHandler(async (req, res) => {
  const { token } = req.params

  const socio = await req.prisma.socio.findFirst({
    where: {
      tokenPortal: token,
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      documento: true,
      fechaNacimiento: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
      estado: true,
      categoria: true,
      tipoSocio: true,
      tokenPortal: true,
      tokenPortalExpira: true,
      esTitular: true,
      grupoFamiliarId: true,
    },
  })

  if (!socio) {
    throw new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN')
  }

  // Verificar expiración (si existe el campo)
  if (socio.tokenPortalExpira && socio.tokenPortalExpira < new Date()) {
    throw new AppError('El link de acceso expiró. Solicitá uno nuevo', 401, 'EXPIRED_TOKEN')
  }

  // Verificar estado activo
  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      id: socio.id,
      nroSocio: socio.nroSocio,
      apellidoNombre: socio.apellidoNombre,
      email: socio.email,
      celular: socio.celular,
      documento: socio.documento,
      fechaNacimiento: socio.fechaNacimiento,
      domicilio: socio.domicilio,
      ciudad: socio.ciudad,
      provincia: socio.provincia,
      estado: socio.estado,
      categoria: socio.categoria,
      tipoSocio: socio.tipoSocio,
      tokenPortal: socio.tokenPortal,
      esActivo,
      esTitular: socio.esTitular,
      grupoFamiliarId: socio.grupoFamiliarId,
    },
  })
}))

// ==============================================================================
// DATOS DEL SOCIO
// ==============================================================================

// GET /api/socio/:tokenPortal - Obtener datos completos del socio
router.get('/:tokenPortal', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      documento: true,
      fechaNacimiento: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
      estado: true,
      categoria: true,
      tipoSocio: true,
      tokenPortal: true,
      esTitular: true,
      grupoFamiliarId: true,
      grupoFamiliar: {
        select: {
          id: true,
          integrantes: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              documento: true,
              fechaNacimiento: true,
            },
            where: {
              estado: {
                contains: 'ACTIV',
              },
            },
          },
        },
      },
    },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const estadoUpper = socio.estado?.toUpperCase() || ''
  const esActivo = estadoUpper.includes('ACTIV') || estadoUpper.includes('VIGENT')

  res.json({
    success: true,
    data: {
      ...socio,
      esActivo,
      grupoFamiliar: socio.grupoFamiliar ? {
        id: socio.grupoFamiliar.id,
        integrantes: socio.grupoFamiliar.integrantes,
      } : null,
    },
  })
}))

// PUT /api/socio/:tokenPortal/perfil - Actualizar datos del socio
router.put('/:tokenPortal/perfil', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { email, celular, domicilio, ciudad, provincia } = req.body

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Actualizar datos permitidos
  const updated = await req.prisma.socio.update({
    where: { id: socio.id },
    data: {
      email: email?.trim().toLowerCase(),
      celular: celular?.trim(),
      domicilio: domicilio?.trim(),
      ciudad: ciudad?.trim(),
      provincia: provincia?.trim(),
    },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      domicilio: true,
      ciudad: true,
      provincia: true,
    },
  })

  res.json({
    success: true,
    data: updated,
    message: 'Datos actualizados correctamente',
  })
}))

// ==============================================================================
// ACTIVIDADES E INSCRIPCIONES
// ==============================================================================

// GET /api/socio/:tokenPortal/inscripciones - Obtener actividades del socio
router.get('/:tokenPortal/inscripciones', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const inscripciones = await req.prisma.inscripcion.findMany({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              descripcion: true,
            },
          },
          entrenadores: {
            include: {
              entrenador: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  celular: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      fechaInscripcion: 'desc',
    },
  })

  const result = inscripciones.map(insc => ({
    id: insc.id,
    fechaInscripcion: insc.fechaInscripcion,
    fechaInicio: insc.fechaInicio,
    estado: insc.estado,
    actividad: insc.categoriaActividad.actividad.nombre,
    categoria: insc.categoriaActividad.nombre,
    descripcion: insc.categoriaActividad.descripcion,
    horarios: insc.categoriaActividad.horarios,
    cuotaMensual: insc.categoriaActividad.cuotaMensual,
    entrenador: insc.categoriaActividad.entrenadores[0]?.entrenador?.nombre || null,
    entrenadorEmail: insc.categoriaActividad.entrenadores[0]?.entrenador?.email || null,
    entrenadorCelular: insc.categoriaActividad.entrenadores[0]?.entrenador?.celular || null,
  }))

  res.json({
    success: true,
    data: result,
  })
}))

// GET /api/socio/:tokenPortal/actividades-disponibles - Obtener actividades disponibles
router.get('/:tokenPortal/actividades-disponibles', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Obtener IDs de categorías en las que ya está inscripto
  const inscripciones = await req.prisma.inscripcion.findMany({
    where: {
      socioId: socio.id,
      estado: 'ACTIVA',
    },
    select: {
      categoriaActividadId: true,
    },
  })

  const categoriasInscriptas = inscripciones.map(i => i.categoriaActividadId)

  // Obtener categorías disponibles (no inscriptas, activas, con cupos)
  const categoriasDisponibles = await req.prisma.categoriaActividad.findMany({
    where: {
      activa: true,
      id: {
        notIn: categoriasInscriptas,
      },
      OR: [
        { cupoMaximo: null },
        {
          cupoMaximo: {
            gt: await req.prisma.inscripcion.count({
              where: {
                categoriaActividadId: { in: undefined }, // Se calculará por categoría
                estado: 'ACTIVA',
              },
            }),
          },
        },
      ],
    },
    include: {
      actividad: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          descripcion: true,
        },
      },
      entrenadores: {
        include: {
          entrenador: {
            select: {
              nombre: true,
            },
          },
        },
      },
      _count: {
        select: {
          inscripciones: {
            where: {
              estado: 'ACTIVA',
            },
          },
        },
      },
    },
    orderBy: [
      { actividad: { nombre: 'asc' } },
      { nombre: 'asc' },
    ],
  })

  const result = categoriasDisponibles
    .filter(cat => {
      // Filtrar las que tienen cupos disponibles
      const inscriptos = cat._count.inscripciones
      return !cat.cupoMaximo || inscriptos < cat.cupoMaximo
    })
    .map(cat => ({
      id: cat.id,
      actividad: cat.actividad.nombre,
      categoria: cat.nombre,
      descripcion: cat.descripcion,
      horarios: cat.horarios,
      cuotaMensual: cat.cuotaMensual,
      entrenador: cat.entrenadores[0]?.entrenador?.nombre || null,
      cuposDisponibles: cat.cupoMaximo ? cat.cupoMaximo - cat._count.inscripciones : null,
      cupoMaximo: cat.cupoMaximo,
    }))

  res.json({
    success: true,
    data: result,
  })
}))

// POST /api/socio/:tokenPortal/inscripciones - Inscribirse en una actividad
router.post('/:tokenPortal/inscripciones', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { categoriaActividadId } = req.body

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  // Verificar que la categoría existe y está activa
  const categoria = await req.prisma.categoriaActividad.findUnique({
    where: { id: parseInt(categoriaActividadId) },
    include: {
      _count: {
        select: {
          inscripciones: {
            where: { estado: 'ACTIVA' },
          },
        },
      },
    },
  })

  if (!categoria || !categoria.activa) {
    throw new AppError('Categoría no disponible', 400, 'CATEGORIA_NO_DISPONIBLE')
  }

  // Verificar cupos
  if (categoria.cupoMaximo && categoria._count.inscripciones >= categoria.cupoMaximo) {
    throw new AppError('No hay cupos disponibles', 400, 'SIN_CUPOS')
  }

  // Verificar que no esté ya inscripto
  const inscripcionExistente = await req.prisma.inscripcion.findFirst({
    where: {
      socioId: socio.id,
      categoriaActividadId: parseInt(categoriaActividadId),
      estado: 'ACTIVA',
    },
  })

  if (inscripcionExistente) {
    throw new AppError('Ya estás inscripto en esta actividad', 400, 'YA_INSCRIPTO')
  }

  // Crear inscripción
  const inscripcion = await req.prisma.inscripcion.create({
    data: {
      socioId: socio.id,
      categoriaActividadId: parseInt(categoriaActividadId),
      fechaInicio: new Date(),
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  res.json({
    success: true,
    data: inscripcion,
    message: `Te inscribiste exitosamente en ${inscripcion.categoriaActividad.actividad.nombre} - ${inscripcion.categoriaActividad.nombre}`,
  })
}))

// POST /api/socio/:tokenPortal/inscripciones/:id/baja - Darse de baja de una actividad
router.post('/:tokenPortal/inscripciones/:id/baja', asyncHandler(async (req, res) => {
  const { tokenPortal, id } = req.params
  const { motivo } = req.body

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const inscripcion = await req.prisma.inscripcion.findFirst({
    where: {
      id: parseInt(id),
      socioId: socio.id,
      estado: 'ACTIVA',
    },
  })

  if (!inscripcion) {
    throw new AppError('Inscripción no encontrada', 404, 'INSCRIPCION_NOT_FOUND')
  }

  // Dar de baja
  await req.prisma.inscripcion.update({
    where: { id: inscripcion.id },
    data: {
      estado: 'BAJA',
      fechaFin: new Date(),
      motivoFin: motivo || 'Baja solicitada por el socio desde el portal',
    },
  })

  res.json({
    success: true,
    message: 'Baja registrada correctamente',
  })
}))

// ==============================================================================
// PAGOS Y CUOTAS
// ==============================================================================

// GET /api/socio/:tokenPortal/cuotas/pendientes - Obtener cuotas pendientes
router.get('/:tokenPortal/cuotas/pendientes', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const cargos = await req.prisma.cargo.findMany({
    where: {
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
    include: {
      periodo: true,
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
    orderBy: {
      fechaVencimiento: 'asc',
    },
  })

  const result = cargos.map(cargo => {
    // Determinar si está vencido
    const hoy = new Date()
    const vencido = cargo.fechaVencimiento && new Date(cargo.fechaVencimiento) < hoy

    return {
      id: cargo.id,
      concepto: cargo.descripcion || cargo.categoria,
      periodo: cargo.periodo?.nombre || null,
      anio: cargo.periodo?.anio || null,
      montoOriginal: cargo.montoOriginal,
      recargo: cargo.montoRecargo,
      bonificacion: cargo.montoBonificacion,
      montoTotal: cargo.montoTotal,
      fechaVencimiento: cargo.fechaVencimiento,
      estado: vencido ? 'VENCIDO' : 'PENDIENTE',
      tipo: cargo.categoria,
      actividad: cargo.categoriaActividad?.actividad?.nombre || null,
    }
  })

  res.json({
    success: true,
    data: result,
  })
}))

// GET /api/socio/:tokenPortal/pagos/historial - Obtener historial de pagos
router.get('/:tokenPortal/pagos/historial', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const pagos = await req.prisma.pago.findMany({
    where: {
      socioId: socio.id,
      estado: 'CONFIRMADO',
    },
    include: {
      medioPago: true,
      cargos: {
        include: {
          periodo: true,
          categoriaActividad: {
            include: {
              actividad: true,
            },
          },
        },
      },
    },
    orderBy: {
      fecha: 'desc',
    },
    take: 50,
  })

  const result = pagos.map(pago => ({
    id: pago.id,
    numero: pago.numero,
    fecha: pago.fecha,
    monto: pago.montoTotal,
    metodoPago: pago.medioPago?.nombre || 'No especificado',
    comprobante: pago.numero,
    concepto: pago.cargos.map(c => c.descripcion || c.categoria).join(', '),
    cargos: pago.cargos.map(c => ({
      concepto: c.descripcion || c.categoria,
      periodo: c.periodo?.nombre || null,
      monto: c.montoTotal,
    })),
  }))

  res.json({
    success: true,
    data: result,
  })
}))

// POST /api/socio/:tokenPortal/cuotas/:cuotaId/generar-link-pago - Generar link de pago
router.post('/:tokenPortal/cuotas/:cuotaId/generar-link-pago', asyncHandler(async (req, res) => {
  const { tokenPortal, cuotaId } = req.params
  const { metodoPago } = req.body // 'MERCADOPAGO' | 'MODO'

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  const cargo = await req.prisma.cargo.findFirst({
    where: {
      id: parseInt(cuotaId),
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
  })

  if (!cargo) {
    throw new AppError('Cuota no encontrada', 404, 'CUOTA_NOT_FOUND')
  }

  // TODO: Integrar con MercadoPago o MODO para generar link real
  // Por ahora retornamos un link de ejemplo
  const linkPago = await req.prisma.linkPago.create({
    data: {
      socioId: socio.id,
      concepto: cargo.descripcion || cargo.categoria,
      descripcion: `Pago de ${cargo.descripcion || cargo.categoria}`,
      montoTotal: cargo.montoTotal,
      cargosIds: JSON.stringify([cargo.id]),
      plataforma: metodoPago,
      estado: 'PENDIENTE',
      initPoint: `https://ejemplo.com/pagar/${metodoPago.toLowerCase()}`, // Mock URL
      fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    },
  })

  res.json({
    success: true,
    data: {
      linkPago: linkPago.initPoint,
      linkPagoId: linkPago.id,
    },
  })
}))

// POST /api/socio/:tokenPortal/cuotas/pagar-multiples - Generar link para pagar múltiples cuotas
router.post('/:tokenPortal/cuotas/pagar-multiples', asyncHandler(async (req, res) => {
  const { tokenPortal } = req.params
  const { cuotasIds, metodoPago } = req.body

  const socio = await req.prisma.socio.findUnique({
    where: { tokenPortal },
  })

  if (!socio) {
    throw new AppError('Socio no encontrado', 404, 'SOCIO_NOT_FOUND')
  }

  if (!cuotasIds || cuotasIds.length === 0) {
    throw new AppError('Debe seleccionar al menos una cuota', 400, 'NO_CUOTAS')
  }

  const cargos = await req.prisma.cargo.findMany({
    where: {
      id: {
        in: cuotasIds.map(id => parseInt(id)),
      },
      socioId: socio.id,
      estado: {
        in: ['PENDIENTE', 'VENCIDO'],
      },
    },
  })

  if (cargos.length === 0) {
    throw new AppError('No se encontraron cuotas pendientes', 404, 'NO_CUOTAS')
  }

  const montoTotal = cargos.reduce((sum, c) => sum + parseFloat(c.montoTotal), 0)

  // TODO: Integrar con MercadoPago o MODO para generar link real
  const linkPago = await req.prisma.linkPago.create({
    data: {
      socioId: socio.id,
      concepto: `Pago de ${cargos.length} cuota(s)`,
      descripcion: cargos.map(c => c.descripcion || c.categoria).join(', '),
      montoTotal: montoTotal,
      cargosIds: JSON.stringify(cargos.map(c => c.id)),
      plataforma: metodoPago,
      estado: 'PENDIENTE',
      initPoint: `https://ejemplo.com/pagar/${metodoPago.toLowerCase()}`, // Mock URL
      fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    },
  })

  res.json({
    success: true,
    data: {
      linkPago: linkPago.initPoint,
      linkPagoId: linkPago.id,
      montoTotal,
    },
  })
}))

export default router
