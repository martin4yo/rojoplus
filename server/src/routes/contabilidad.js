import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = Router()

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// CONCEPTOS (Preclasificacion contable)
// =============================================================================

// GET /api/admin/conceptos - Listar conceptos
router.get('/conceptos', asyncHandler(async (req, res) => {
  const { tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, activo } = req.query

  const where = {}
  if (tipo) where.tipo = tipo
  if (usaEnCompras !== undefined) where.usaEnCompras = usaEnCompras === 'true'
  if (usaEnVentas !== undefined) where.usaEnVentas = usaEnVentas === 'true'
  if (usaEnTesoreria !== undefined) where.usaEnTesoreria = usaEnTesoreria === 'true'
  if (activo !== undefined) where.activo = activo === 'true'

  const conceptos = await req.db.conceptoTesoreria.findMany({
    where,
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      cuentaContable: {
        select: { id: true, codigo: true, nombre: true }
      }
    }
  })

  res.json({ success: true, data: conceptos })
}))

// GET /api/admin/conceptos/:id - Detalle de concepto
router.get('/conceptos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const concepto = await req.db.conceptoTesoreria.findUnique({
    where: { id: parseInt(id) },
    include: {
      cuentaContable: true
    }
  })

  if (!concepto) {
    throw new AppError('Concepto no encontrado', 404)
  }

  res.json({ success: true, data: concepto })
}))

// POST /api/admin/conceptos - Crear concepto
router.post('/conceptos', asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, orden } = req.body

  if (!codigo || !nombre || !tipo) {
    throw new AppError('Codigo, nombre y tipo son requeridos', 400)
  }

  const existente = await req.db.conceptoTesoreria.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe un concepto con ese codigo', 400)
  }

  const concepto = await req.db.conceptoTesoreria.create({
    data: {
      codigo,
      nombre,
      descripcion,
      tipo,
      usaEnCompras: usaEnCompras || false,
      usaEnVentas: usaEnVentas || false,
      usaEnTesoreria: usaEnTesoreria || false,
      cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
      orden: orden || 0
    }
  })

  res.status(201).json({ success: true, data: concepto })
}))

// PUT /api/admin/conceptos/:id - Actualizar concepto
router.put('/conceptos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, tipo, usaEnCompras, usaEnVentas, usaEnTesoreria, cuentaContableId, orden, activo } = req.body

  const existente = await req.db.conceptoTesoreria.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Concepto no encontrado', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.conceptoTesoreria.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un concepto con ese codigo', 400)
    }
  }

  const concepto = await req.db.conceptoTesoreria.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      nombre: nombre || existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      tipo: tipo || existente.tipo,
      usaEnCompras: usaEnCompras !== undefined ? usaEnCompras : existente.usaEnCompras,
      usaEnVentas: usaEnVentas !== undefined ? usaEnVentas : existente.usaEnVentas,
      usaEnTesoreria: usaEnTesoreria !== undefined ? usaEnTesoreria : existente.usaEnTesoreria,
      cuentaContableId: cuentaContableId !== undefined ? (cuentaContableId ? parseInt(cuentaContableId) : null) : existente.cuentaContableId,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo
    }
  })

  res.json({ success: true, data: concepto })
}))

// =============================================================================
// CUENTAS CONTABLES (Plan de Cuentas)
// =============================================================================

// GET /api/admin/cuentas-contables - Listar cuentas contables (jerarquico)
router.get('/cuentas-contables', asyncHandler(async (req, res) => {
  const { esImputable, activo, tipo, flat } = req.query

  const where = {}
  if (esImputable !== undefined) where.esImputable = esImputable === 'true'
  if (activo !== undefined) where.activo = activo === 'true'
  if (tipo) where.tipo = tipo

  const cuentas = await req.db.cuentaContable.findMany({
    where,
    orderBy: [{ codigo: 'asc' }],
    include: {
      padre: { select: { id: true, codigo: true, nombre: true } },
      hijos: {
        where: activo !== undefined ? { activo: activo === 'true' } : {},
        orderBy: { codigo: 'asc' },
        select: { id: true, codigo: true, nombre: true, tipo: true, esImputable: true, activo: true }
      }
    }
  })

  // Si piden flat, devolver lista plana
  if (flat === 'true') {
    res.json({ success: true, data: cuentas })
    return
  }

  // Construir arbol jerarquico (solo cuentas raiz)
  const cuentasRaiz = cuentas.filter(c => !c.padreId)

  function construirArbol(cuenta, todasLasCuentas) {
    const hijos = todasLasCuentas.filter(c => c.padreId === cuenta.id)
    return {
      ...cuenta,
      hijos: hijos.map(h => construirArbol(h, todasLasCuentas))
    }
  }

  const arbol = cuentasRaiz.map(c => construirArbol(c, cuentas))

  res.json({ success: true, data: flat === 'true' ? cuentas : arbol })
}))

// GET /api/admin/cuentas-contables/:id - Detalle de cuenta
router.get('/cuentas-contables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const cuenta = await req.db.cuentaContable.findUnique({
    where: { id: parseInt(id) },
    include: {
      padre: { select: { id: true, codigo: true, nombre: true } },
      hijos: {
        orderBy: { codigo: 'asc' },
        select: { id: true, codigo: true, nombre: true, tipo: true, esImputable: true, activo: true }
      },
      conceptosTesoreria: {
        select: { id: true, codigo: true, nombre: true, tipo: true }
      }
    }
  })

  if (!cuenta) {
    throw new AppError('Cuenta contable no encontrada', 404)
  }

  res.json({ success: true, data: cuenta })
}))

// POST /api/admin/cuentas-contables - Crear cuenta
router.post('/cuentas-contables', asyncHandler(async (req, res) => {
  const { codigo, nombre, tipo, nivel, padreId, esImputable, orden } = req.body

  if (!codigo || !nombre || !tipo) {
    throw new AppError('Codigo, nombre y tipo son requeridos', 400)
  }

  if (!['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO'].includes(tipo)) {
    throw new AppError('Tipo debe ser ACTIVO, PASIVO, PATRIMONIO, INGRESO o EGRESO', 400)
  }

  const existente = await req.db.cuentaContable.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe una cuenta con ese codigo', 400)
  }

  // Si tiene padre, calcular nivel automaticamente
  let nivelCalculado = nivel || 1
  if (padreId) {
    const padre = await req.db.cuentaContable.findUnique({ where: { id: parseInt(padreId) } })
    if (!padre) {
      throw new AppError('Cuenta padre no encontrada', 404)
    }
    nivelCalculado = padre.nivel + 1
  }

  const cuenta = await req.db.cuentaContable.create({
    data: {
      codigo,
      nombre,
      tipo,
      nivel: nivelCalculado,
      padreId: padreId ? parseInt(padreId) : null,
      esImputable: esImputable !== false,
      orden: orden || 0
    },
    include: {
      padre: { select: { id: true, codigo: true, nombre: true } }
    }
  })

  res.status(201).json({ success: true, data: cuenta })
}))

// PUT /api/admin/cuentas-contables/:id - Actualizar cuenta
router.put('/cuentas-contables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, tipo, padreId, esImputable, orden, activo } = req.body

  const existente = await req.db.cuentaContable.findUnique({
    where: { id: parseInt(id) },
    include: { hijos: true }
  })

  if (!existente) {
    throw new AppError('Cuenta contable no encontrada', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.cuentaContable.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe una cuenta con ese codigo', 400)
    }
  }

  // No permitir desactivar si tiene hijos activos
  if (activo === false && existente.hijos.some(h => h.activo)) {
    throw new AppError('No se puede desactivar una cuenta con subcuentas activas', 400)
  }

  // Calcular nivel si cambia el padre
  let nivel = existente.nivel
  if (padreId !== undefined && padreId !== existente.padreId) {
    if (padreId) {
      const padre = await req.db.cuentaContable.findUnique({ where: { id: parseInt(padreId) } })
      if (padre) nivel = padre.nivel + 1
    } else {
      nivel = 1
    }
  }

  const cuenta = await req.db.cuentaContable.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      nombre: nombre || existente.nombre,
      tipo: tipo || existente.tipo,
      nivel,
      padreId: padreId !== undefined ? (padreId ? parseInt(padreId) : null) : existente.padreId,
      esImputable: esImputable !== undefined ? esImputable : existente.esImputable,
      orden: orden !== undefined ? orden : existente.orden,
      activo: activo !== undefined ? activo : existente.activo
    },
    include: {
      padre: { select: { id: true, codigo: true, nombre: true } }
    }
  })

  res.json({ success: true, data: cuenta })
}))

// DELETE /api/admin/cuentas-contables/:id - Eliminar cuenta
router.delete('/cuentas-contables/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const cuenta = await req.db.cuentaContable.findUnique({
    where: { id: parseInt(id) },
    include: {
      hijos: true,
      conceptos: true,
      movimientos: { take: 1 }
    }
  })

  if (!cuenta) {
    throw new AppError('Cuenta contable no encontrada', 404)
  }

  if (cuenta.hijos.length > 0) {
    throw new AppError('No se puede eliminar una cuenta con subcuentas', 400)
  }

  if (cuenta.conceptos.length > 0) {
    throw new AppError('No se puede eliminar una cuenta vinculada a conceptos', 400)
  }

  if (cuenta.movimientos.length > 0) {
    throw new AppError('No se puede eliminar una cuenta con movimientos', 400)
  }

  await req.db.cuentaContable.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Cuenta eliminada correctamente' })
}))

// =============================================================================
// ENTIDADES (Proveedores, Clientes, Personal)
// =============================================================================

// GET /api/admin/entidades - Listar entidades
router.get('/entidades', asyncHandler(async (req, res) => {
  const { tipo, activo, busqueda, page = 1, limit = 50 } = req.query

  const where = {}
  if (tipo) where.tipo = tipo
  if (activo !== undefined) where.activo = activo === 'true'
  if (busqueda) {
    where.OR = [
      { codigo: { contains: busqueda, mode: 'insensitive' } },
      { razonSocial: { contains: busqueda, mode: 'insensitive' } },
      { nombreFantasia: { contains: busqueda, mode: 'insensitive' } },
      { documento: { contains: busqueda, mode: 'insensitive' } }
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [entidades, total] = await Promise.all([
    req.db.entidad.findMany({
      where,
      orderBy: { razonSocial: 'asc' },
      skip,
      take: parseInt(limit)
    }),
    req.db.entidad.count({ where })
  ])

  res.json({
    success: true,
    data: entidades,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/entidades/:id - Detalle de entidad
router.get('/entidades/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const entidad = await req.db.entidad.findUnique({
    where: { id: parseInt(id) },
    include: {
      ordenesCompra: {
        orderBy: { fecha: 'desc' },
        take: 10,
        select: {
          id: true,
          numero: true,
          fecha: true,
          estado: true,
          total: true
        }
      },
      entrenador: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          especialidad: true
        }
      },
      cargoPersonal: true
    }
  })

  if (!entidad) {
    throw new AppError('Entidad no encontrada', 404)
  }

  res.json({ success: true, data: entidad })
}))

// POST /api/admin/entidades - Crear entidad
router.post('/entidades', asyncHandler(async (req, res) => {
  const {
    codigo, tipo, razonSocial, nombreFantasia, tipoDocumento, documento,
    email, telefono, direccion, ciudad, provincia, codigoPostal, condicionIva,
    banco, cbu, alias, legajo, cargoPersonalId, sueldoBasico, fechaIngreso, observaciones, foto,
    centroCostoId
  } = req.body

  if (!codigo || !tipo || !razonSocial) {
    throw new AppError('Codigo, tipo y razon social son requeridos', 400)
  }

  if (!['PROVEEDOR', 'CLIENTE', 'PERSONAL'].includes(tipo)) {
    throw new AppError('Tipo debe ser PROVEEDOR, CLIENTE o PERSONAL', 400)
  }

  const existente = await req.db.entidad.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe una entidad con ese codigo', 400)
  }

  const entidad = await req.db.entidad.create({
    data: {
      codigo,
      tipo,
      razonSocial,
      nombreFantasia,
      tipoDocumento: tipoDocumento || 'CUIT',
      documento,
      email,
      telefono,
      direccion,
      ciudad,
      provincia,
      codigoPostal,
      condicionIva,
      banco,
      cbu,
      alias,
      legajo: tipo === 'PERSONAL' ? legajo : null,
      cargoPersonalId: tipo === 'PERSONAL' && cargoPersonalId ? parseInt(cargoPersonalId) : null,
      sueldoBasico: tipo === 'PERSONAL' && sueldoBasico ? parseFloat(sueldoBasico) : null,
      fechaIngreso: tipo === 'PERSONAL' && fechaIngreso ? new Date(fechaIngreso) : null,
      foto: tipo === 'PERSONAL' ? (foto || null) : null,
      centroCostoId: centroCostoId ? parseInt(centroCostoId) : null,
      observaciones
    }
  })

  res.status(201).json({ success: true, data: entidad })
}))

// PUT /api/admin/entidades/:id - Actualizar entidad
router.put('/entidades/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    codigo, razonSocial, nombreFantasia, tipoDocumento, documento,
    email, telefono, direccion, ciudad, provincia, codigoPostal, condicionIva,
    banco, cbu, alias, legajo, cargoPersonalId, sueldoBasico, fechaIngreso, observaciones, activo, foto,
    centroCostoId
  } = req.body

  const existente = await req.db.entidad.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Entidad no encontrada', 404)
  }

  // Verificar codigo unico si cambio
  if (codigo && codigo !== existente.codigo) {
    const duplicado = await req.db.entidad.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe una entidad con ese codigo', 400)
    }
  }

  const entidad = await req.db.entidad.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      razonSocial: razonSocial || existente.razonSocial,
      nombreFantasia: nombreFantasia !== undefined ? nombreFantasia : existente.nombreFantasia,
      tipoDocumento: tipoDocumento || existente.tipoDocumento,
      documento: documento !== undefined ? documento : existente.documento,
      email: email !== undefined ? email : existente.email,
      telefono: telefono !== undefined ? telefono : existente.telefono,
      direccion: direccion !== undefined ? direccion : existente.direccion,
      ciudad: ciudad !== undefined ? ciudad : existente.ciudad,
      provincia: provincia !== undefined ? provincia : existente.provincia,
      codigoPostal: codigoPostal !== undefined ? codigoPostal : existente.codigoPostal,
      condicionIva: condicionIva !== undefined ? condicionIva : existente.condicionIva,
      banco: banco !== undefined ? banco : existente.banco,
      cbu: cbu !== undefined ? cbu : existente.cbu,
      alias: alias !== undefined ? alias : existente.alias,
      legajo: existente.tipo === 'PERSONAL' ? (legajo !== undefined ? legajo : existente.legajo) : null,
      cargoPersonalId: existente.tipo === 'PERSONAL' && cargoPersonalId !== undefined
        ? (cargoPersonalId ? parseInt(cargoPersonalId) : null)
        : existente.cargoPersonalId,
      sueldoBasico: existente.tipo === 'PERSONAL' && sueldoBasico !== undefined
        ? (sueldoBasico ? parseFloat(sueldoBasico) : null)
        : existente.sueldoBasico,
      fechaIngreso: existente.tipo === 'PERSONAL' && fechaIngreso !== undefined
        ? (fechaIngreso ? new Date(fechaIngreso) : null)
        : existente.fechaIngreso,
      observaciones: observaciones !== undefined ? observaciones : existente.observaciones,
      activo: activo !== undefined ? activo : existente.activo,
      foto: existente.tipo === 'PERSONAL' && foto !== undefined ? (foto || null) : existente.foto,
      centroCostoId: centroCostoId !== undefined
        ? (centroCostoId ? parseInt(centroCostoId) : null)
        : existente.centroCostoId,
    }
  })

  res.json({ success: true, data: entidad })
}))

// GET /api/admin/entidades/:id/cuenta-corriente - Estado de cuenta
router.get('/entidades/:id/cuenta-corriente', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { desde, hasta } = req.query

  const entidad = await req.db.entidad.findUnique({
    where: { id: parseInt(id) }
  })

  if (!entidad) {
    throw new AppError('Entidad no encontrada', 404)
  }

  const whereMovimientos = {
    entidadId: parseInt(id),
    estado: { not: 'ANULADO' }
  }

  if (desde) whereMovimientos.fecha = { gte: new Date(desde) }
  if (hasta) whereMovimientos.fecha = { ...whereMovimientos.fecha, lte: new Date(hasta) }

  const movimientos = await req.db.movimientoContable.findMany({
    where: whereMovimientos,
    orderBy: { fecha: 'asc' },
    select: {
      id: true,
      numero: true,
      tipo: true,
      fecha: true,
      concepto: { select: { nombre: true } },
      montoTotal: true,
      montoPagado: true,
      saldoPendiente: true,
      estado: true
    }
  })

  // Calcular saldo total pendiente
  const saldoPendiente = movimientos.reduce((sum, m) => {
    if (['FACTURA_COMPRA', 'NOTA_DEBITO'].includes(m.tipo)) {
      return sum + parseFloat(m.saldoPendiente || 0)
    } else if (['NOTA_CREDITO', 'PAGO'].includes(m.tipo)) {
      return sum - parseFloat(m.montoTotal || 0)
    }
    return sum
  }, 0)

  res.json({
    success: true,
    data: {
      entidad,
      movimientos,
      saldoPendiente
    }
  })
}))

// =============================================================================
// ORDENES DE COMPRA
// =============================================================================

// GET /api/admin/ordenes-compra - Listar ordenes de compra
router.get('/ordenes-compra', asyncHandler(async (req, res) => {
  const { estado, entidadId, desde, hasta, busqueda, page = 1, limit = 50 } = req.query

  const where = {}
  if (estado) where.estado = estado
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }
  if (busqueda) {
    where.OR = [
      { numero: { contains: busqueda, mode: 'insensitive' } },
      { entidad: { razonSocial: { contains: busqueda, mode: 'insensitive' } } },
      { observaciones: { contains: busqueda, mode: 'insensitive' } }
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [ordenes, total] = await Promise.all([
    req.db.ordenCompra.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: {
          select: { id: true, codigo: true, razonSocial: true, nombreFantasia: true }
        },
        items: {
          include: {
            productoVariante: {
              include: {
                producto: { select: { codigo: true, nombre: true } }
              }
            }
          }
        }
      }
    }),
    req.db.ordenCompra.count({ where })
  ])

  res.json({
    success: true,
    data: ordenes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/ordenes-compra/:id - Detalle de orden de compra
router.get('/ordenes-compra/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const orden = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: {
      entidad: true,
      items: {
        include: {
          productoVariante: {
            include: {
              producto: {
                include: {
                  categoria: { select: { nombre: true } },
                  fotos: { where: { esPrincipal: true }, take: 1 }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!orden) {
    throw new AppError('Orden de compra no encontrada', 404)
  }

  res.json({ success: true, data: orden })
}))

// POST /api/admin/ordenes-compra - Crear orden de compra
router.post('/ordenes-compra', asyncHandler(async (req, res) => {
  const { entidadId, fechaEntrega, observaciones, items } = req.body

  if (!entidadId) {
    throw new AppError('El proveedor es requerido', 400)
  }

  if (!items || items.length === 0) {
    throw new AppError('La orden debe tener al menos un item', 400)
  }

  // Verificar que la entidad existe y es proveedor
  const entidad = await req.db.entidad.findUnique({ where: { id: parseInt(entidadId) } })
  if (!entidad) {
    throw new AppError('Proveedor no encontrado', 404)
  }
  if (entidad.tipo !== 'PROVEEDOR') {
    throw new AppError('La entidad seleccionada no es un proveedor', 400)
  }

  // Generar numero de orden
  const anio = new Date().getFullYear()
  const ultimaOrden = await req.db.ordenCompra.findFirst({
    where: { numero: { startsWith: `OC-${anio}-` } },
    orderBy: { numero: 'desc' }
  })
  let siguiente = 1
  if (ultimaOrden) {
    const partes = ultimaOrden.numero.split('-')
    siguiente = parseInt(partes[2]) + 1
  }
  const numero = `OC-${anio}-${String(siguiente).padStart(5, '0')}`

  // Calcular totales
  let subtotal = 0
  const itemsData = items.map(item => {
    const itemSubtotal = parseFloat(item.cantidad) * parseFloat(item.precioUnitario)
    subtotal += itemSubtotal
    return {
      productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
      descripcion: item.descripcion || null,
      cantidad: parseFloat(item.cantidad),
      precioUnitario: parseFloat(item.precioUnitario),
      subtotal: itemSubtotal,
      tenantId: req.tenantId
    }
  })

  const iva = subtotal * 0.21
  const total = subtotal + iva

  const orden = await req.db.ordenCompra.create({
    data: {
      numero,
      entidadId: parseInt(entidadId),
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      observaciones,
      subtotal,
      iva,
      total,
      registradoPor: req.admin.id,
      items: {
        create: itemsData
      }
    },
    include: {
      entidad: { select: { razonSocial: true } },
      items: {
        include: {
          productoVariante: {
            include: { producto: { select: { codigo: true, nombre: true } } }
          }
        }
      }
    }
  })

  res.status(201).json({ success: true, data: orden })
}))

// PUT /api/admin/ordenes-compra/:id - Actualizar orden de compra
router.put('/ordenes-compra/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fechaEntrega, observaciones, items } = req.body

  const orden = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!orden) {
    throw new AppError('Orden de compra no encontrada', 404)
  }

  if (orden.estado !== 'PENDIENTE') {
    throw new AppError('Solo se pueden editar ordenes en estado PENDIENTE', 400)
  }

  // Si vienen items, actualizar items y recalcular totales
  let updateData = {
    fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : orden.fechaEntrega,
    observaciones: observaciones !== undefined ? observaciones : orden.observaciones
  }

  if (items && items.length > 0) {
    // Eliminar items anteriores
    await req.db.itemOrdenCompra.deleteMany({
      where: { ordenCompraId: parseInt(id) }
    })

    // Calcular nuevos totales
    let subtotal = 0
    const itemsData = items.map(item => {
      const itemSubtotal = parseFloat(item.cantidad) * parseFloat(item.precioUnitario)
      subtotal += itemSubtotal
      return {
        ordenCompraId: parseInt(id),
        productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
        descripcion: item.descripcion || null,
        cantidad: parseFloat(item.cantidad),
        precioUnitario: parseFloat(item.precioUnitario),
        subtotal: itemSubtotal,
        tenantId: req.tenantId
      }
    })

    const iva = subtotal * 0.21
    const total = subtotal + iva

    // Crear nuevos items
    await req.db.itemOrdenCompra.createMany({ data: itemsData })

    updateData.subtotal = subtotal
    updateData.iva = iva
    updateData.total = total
  }

  const ordenActualizada = await req.db.ordenCompra.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      entidad: { select: { razonSocial: true } },
      items: {
        include: {
          productoVariante: {
            include: { producto: { select: { codigo: true, nombre: true } } }
          }
        }
      }
    }
  })

  res.json({ success: true, data: ordenActualizada })
}))

// PUT /api/admin/ordenes-compra/:id/recibir - Registrar recepcion de mercaderia
router.put('/ordenes-compra/:id/recibir', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { itemsRecibidos } = req.body
  // itemsRecibidos: [{ itemId: 1, cantidadRecibida: 5 }, ...]

  const orden = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!orden) {
    throw new AppError('Orden de compra no encontrada', 404)
  }

  if (orden.estado === 'CANCELADA') {
    throw new AppError('No se puede recibir mercaderia de una orden cancelada', 400)
  }

  // Actualizar cantidades recibidas y stock
  await req.db.$transaction(async (tx) => {
    for (const itemRecibido of itemsRecibidos) {
      const item = orden.items.find(i => i.id === itemRecibido.itemId)
      if (!item) continue

      const cantidadRecibida = parseFloat(itemRecibido.cantidadRecibida)
      const nuevaCantidadRecibida = parseFloat(item.cantidadRecibida) + cantidadRecibida

      // Actualizar item de la orden
      await tx.itemOrdenCompra.update({
        where: { id: item.id },
        data: { cantidadRecibida: nuevaCantidadRecibida }
      })

      // Si tiene variante de producto, actualizar stock
      if (item.productoVarianteId && cantidadRecibida > 0) {
        const variante = await tx.productoVariante.findUnique({
          where: { id: item.productoVarianteId }
        })

        if (variante) {
          const stockAnterior = parseFloat(variante.stockActual)
          const stockNuevo = stockAnterior + cantidadRecibida

          await tx.productoVariante.update({
            where: { id: item.productoVarianteId },
            data: { stockActual: stockNuevo }
          })

          // Registrar movimiento de stock
          await tx.movimientoStock.create({
            data: {
              productoVarianteId: item.productoVarianteId,
              tipo: 'INGRESO',
              cantidad: cantidadRecibida,
              stockAnterior,
              stockPosterior: stockNuevo,
              concepto: `Recepcion OC ${orden.numero}`,
              registradoPor: req.admin.id
            }
          })
        }
      }
    }

    // Determinar nuevo estado de la orden
    const itemsActualizados = await tx.itemOrdenCompra.findMany({
      where: { ordenCompraId: parseInt(id) }
    })

    const todosRecibidos = itemsActualizados.every(
      i => parseFloat(i.cantidadRecibida) >= parseFloat(i.cantidad)
    )
    const algunoRecibido = itemsActualizados.some(
      i => parseFloat(i.cantidadRecibida) > 0
    )

    let nuevoEstado = orden.estado
    if (todosRecibidos) {
      nuevoEstado = 'RECIBIDA'
    } else if (algunoRecibido) {
      nuevoEstado = 'PARCIAL'
    }

    await tx.ordenCompra.update({
      where: { id: parseInt(id) },
      data: { estado: nuevoEstado }
    })
  })

  // Obtener orden actualizada
  const ordenActualizada = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: {
      entidad: { select: { razonSocial: true } },
      items: {
        include: {
          productoVariante: {
            include: { producto: { select: { codigo: true, nombre: true } } }
          }
        }
      }
    }
  })

  res.json({ success: true, data: ordenActualizada })
}))

// PUT /api/admin/ordenes-compra/:id/cancelar - Cancelar orden de compra
router.put('/ordenes-compra/:id/cancelar', asyncHandler(async (req, res) => {
  const { id } = req.params

  const orden = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!orden) {
    throw new AppError('Orden de compra no encontrada', 404)
  }

  // Solo cancelar si no se ha recibido nada
  const tieneRecepcion = orden.items.some(i => parseFloat(i.cantidadRecibida) > 0)
  if (tieneRecepcion) {
    throw new AppError('No se puede cancelar una orden con mercaderia recibida', 400)
  }

  const ordenCancelada = await req.db.ordenCompra.update({
    where: { id: parseInt(id) },
    data: { estado: 'CANCELADA' },
    include: {
      entidad: { select: { razonSocial: true } },
      items: true
    }
  })

  res.json({ success: true, data: ordenCancelada })
}))

// DELETE /api/admin/ordenes-compra/:id - Eliminar orden de compra
router.delete('/ordenes-compra/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const orden = await req.db.ordenCompra.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!orden) {
    throw new AppError('Orden de compra no encontrada', 404)
  }

  // Solo eliminar si esta pendiente y sin recepciones
  if (orden.estado !== 'PENDIENTE') {
    throw new AppError('Solo se pueden eliminar ordenes en estado PENDIENTE', 400)
  }

  const tieneRecepcion = orden.items.some(i => parseFloat(i.cantidadRecibida) > 0)
  if (tieneRecepcion) {
    throw new AppError('No se puede eliminar una orden con mercaderia recibida', 400)
  }

  await req.db.ordenCompra.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Orden de compra eliminada correctamente' })
}))

// =============================================================================
// PEDIDOS (VENTAS)
// =============================================================================

// GET /api/admin/pedidos - Listar pedidos
router.get('/pedidos', asyncHandler(async (req, res) => {
  const { estado, entidadId, socioId, desde, hasta, busqueda, page = 1, limit = 50 } = req.query

  const where = {}
  if (estado) where.estado = estado
  if (entidadId) where.entidadId = parseInt(entidadId)
  if (socioId) where.socioId = parseInt(socioId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }
  if (busqueda) {
    where.OR = [
      { numero: { contains: busqueda, mode: 'insensitive' } },
      { entidad: { razonSocial: { contains: busqueda, mode: 'insensitive' } } },
      { socio: { apellidoNombre: { contains: busqueda, mode: 'insensitive' } } },
      { observaciones: { contains: busqueda, mode: 'insensitive' } }
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [pedidos, total] = await Promise.all([
    req.db.pedido.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        entidad: {
          select: { id: true, codigo: true, razonSocial: true, nombreFantasia: true }
        },
        socio: {
          select: { id: true, nroSocio: true, apellidoNombre: true }
        },
        items: {
          include: {
            productoVariante: {
              include: {
                producto: { select: { codigo: true, nombre: true } }
              }
            }
          }
        }
      }
    }),
    req.db.pedido.count({ where })
  ])

  res.json({
    success: true,
    data: pedidos.map(p => ({
      ...p,
      subtotal: Number(p.subtotal),
      iva21: Number(p.iva21),
      iva105: Number(p.iva105),
      total: Number(p.total),
      items: p.items.map(i => ({
        ...i,
        cantidad: Number(i.cantidad),
        cantidadFacturada: Number(i.cantidadFacturada),
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal)
      }))
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// GET /api/admin/pedidos/:id - Detalle de pedido
router.get('/pedidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const pedido = await req.db.pedido.findUnique({
    where: { id: parseInt(id) },
    include: {
      entidad: true,
      socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true } },
      items: {
        include: {
          productoVariante: {
            include: {
              producto: {
                include: {
                  categoria: { select: { nombre: true } },
                  fotos: { where: { esPrincipal: true }, take: 1 }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404)
  }

  res.json({
    success: true,
    data: {
      ...pedido,
      subtotal: Number(pedido.subtotal),
      iva21: Number(pedido.iva21),
      iva105: Number(pedido.iva105),
      total: Number(pedido.total),
      items: pedido.items.map(i => ({
        ...i,
        cantidad: Number(i.cantidad),
        cantidadFacturada: Number(i.cantidadFacturada),
        precioUnitario: Number(i.precioUnitario),
        subtotal: Number(i.subtotal)
      }))
    }
  })
}))

// POST /api/admin/pedidos - Crear pedido
router.post('/pedidos', asyncHandler(async (req, res) => {
  const { entidadId, socioId, fechaEntrega, observaciones, items } = req.body

  if (!entidadId && !socioId) {
    throw new AppError('Debe especificar un cliente o socio', 400)
  }

  if (!items || items.length === 0) {
    throw new AppError('El pedido debe tener al menos un item', 400)
  }

  // Verificar entidad si se proporciona
  if (entidadId) {
    const entidad = await req.db.entidad.findUnique({ where: { id: parseInt(entidadId) } })
    if (!entidad) {
      throw new AppError('Cliente no encontrado', 404)
    }
    if (entidad.tipo !== 'CLIENTE') {
      throw new AppError('La entidad seleccionada no es un cliente', 400)
    }
  }

  // Verificar socio si se proporciona
  if (socioId) {
    const socio = await req.db.socio.findUnique({ where: { id: parseInt(socioId) } })
    if (!socio) {
      throw new AppError('Socio no encontrado', 404)
    }
  }

  // Generar numero de pedido
  const anio = new Date().getFullYear()
  const ultimoPedido = await req.db.pedido.findFirst({
    where: { numero: { startsWith: `PED-${anio}-` } },
    orderBy: { numero: 'desc' }
  })
  let siguiente = 1
  if (ultimoPedido) {
    const partes = ultimoPedido.numero.split('-')
    siguiente = parseInt(partes[2]) + 1
  }
  const numero = `PED-${anio}-${String(siguiente).padStart(5, '0')}`

  // Calcular totales
  let subtotal = 0
  let iva21 = 0
  let iva105 = 0

  const itemsData = items.map(item => {
    const cantidad = parseFloat(item.cantidad)
    const precio = parseFloat(item.precioUnitario)
    const itemSubtotal = cantidad * precio
    subtotal += itemSubtotal

    // Asumir IVA 21% por defecto
    const tasaIva = item.iva || 21
    if (tasaIva === 21) {
      iva21 += itemSubtotal * 0.21
    } else if (tasaIva === 10.5) {
      iva105 += itemSubtotal * 0.105
    }

    return {
      productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
      descripcion: item.descripcion || null,
      cantidad,
      precioUnitario: precio,
      subtotal: itemSubtotal
    }
  })

  const total = subtotal + iva21 + iva105

  const pedido = await req.db.pedido.create({
    data: {
      numero,
      entidadId: entidadId ? parseInt(entidadId) : null,
      socioId: socioId ? parseInt(socioId) : null,
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      subtotal,
      iva21,
      iva105,
      total,
      observaciones: observaciones || null,
      registradoPor: req.admin.id,
      items: {
        create: itemsData
      }
    },
    include: {
      entidad: { select: { razonSocial: true } },
      socio: { select: { nroSocio: true, apellidoNombre: true } },
      items: true
    }
  })

  res.status(201).json({
    success: true,
    data: {
      ...pedido,
      subtotal: Number(pedido.subtotal),
      iva21: Number(pedido.iva21),
      iva105: Number(pedido.iva105),
      total: Number(pedido.total)
    },
    message: 'Pedido creado correctamente'
  })
}))

// PUT /api/admin/pedidos/:id - Actualizar pedido
router.put('/pedidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { fechaEntrega, observaciones, items } = req.body

  const pedido = await req.db.pedido.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404)
  }

  if (pedido.estado !== 'PENDIENTE') {
    throw new AppError('Solo se pueden editar pedidos en estado PENDIENTE', 400)
  }

  let updateData = {
    fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : pedido.fechaEntrega,
    observaciones: observaciones !== undefined ? observaciones : pedido.observaciones
  }

  if (items && items.length > 0) {
    // Eliminar items anteriores
    await req.db.itemPedido.deleteMany({
      where: { pedidoId: parseInt(id) }
    })

    // Calcular nuevos totales
    let subtotal = 0
    let iva21 = 0
    let iva105 = 0

    const itemsData = items.map(item => {
      const cantidad = parseFloat(item.cantidad)
      const precio = parseFloat(item.precioUnitario)
      const itemSubtotal = cantidad * precio
      subtotal += itemSubtotal

      const tasaIva = item.iva || 21
      if (tasaIva === 21) {
        iva21 += itemSubtotal * 0.21
      } else if (tasaIva === 10.5) {
        iva105 += itemSubtotal * 0.105
      }

      return {
        pedidoId: parseInt(id),
        productoVarianteId: item.productoVarianteId ? parseInt(item.productoVarianteId) : null,
        descripcion: item.descripcion || null,
        cantidad,
        precioUnitario: precio,
        subtotal: itemSubtotal
      }
    })

    await req.db.itemPedido.createMany({ data: itemsData })

    updateData.subtotal = subtotal
    updateData.iva21 = iva21
    updateData.iva105 = iva105
    updateData.total = subtotal + iva21 + iva105
  }

  const pedidoActualizado = await req.db.pedido.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      entidad: { select: { razonSocial: true } },
      socio: { select: { nroSocio: true, apellidoNombre: true } },
      items: true
    }
  })

  res.json({
    success: true,
    data: pedidoActualizado,
    message: 'Pedido actualizado correctamente'
  })
}))

// PUT /api/admin/pedidos/:id/cancelar - Cancelar pedido
router.put('/pedidos/:id/cancelar', asyncHandler(async (req, res) => {
  const { id } = req.params

  const pedido = await req.db.pedido.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404)
  }

  // Solo cancelar si no tiene items facturados
  const tieneFacturado = pedido.items.some(i => Number(i.cantidadFacturada) > 0)
  if (tieneFacturado) {
    throw new AppError('No se puede cancelar un pedido con items facturados', 400)
  }

  const pedidoCancelado = await req.db.pedido.update({
    where: { id: parseInt(id) },
    data: { estado: 'CANCELADO' },
    include: {
      entidad: { select: { razonSocial: true } },
      socio: { select: { apellidoNombre: true } },
      items: true
    }
  })

  res.json({ success: true, data: pedidoCancelado })
}))

// DELETE /api/admin/pedidos/:id - Eliminar pedido
router.delete('/pedidos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const pedido = await req.db.pedido.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  })

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404)
  }

  if (pedido.estado !== 'PENDIENTE') {
    throw new AppError('Solo se pueden eliminar pedidos en estado PENDIENTE', 400)
  }

  const tieneFacturado = pedido.items.some(i => Number(i.cantidadFacturada) > 0)
  if (tieneFacturado) {
    throw new AppError('No se puede eliminar un pedido con items facturados', 400)
  }

  await req.db.pedido.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Pedido eliminado correctamente' })
}))

// =============================================================================
// PROXIMO NUMERO
// =============================================================================

// GET /api/admin/proximo-numero/:tipo - Obtener proximo numero de documento
router.get('/proximo-numero/:tipo', asyncHandler(async (req, res) => {
  const { tipo } = req.params
  const anio = new Date().getFullYear()

  const prefijos = {
    'MC': 'MC', // MovimientoContable
    'TC': 'TC', // TransferenciaCaja
    'ENT': 'ENT' // Entidad
  }

  const prefijo = prefijos[tipo] || tipo

  // Buscar el ultimo numero del tipo
  let ultimoNumero = null

  if (tipo === 'MC') {
    const ultimo = await req.db.movimientoContable.findFirst({
      where: { numero: { startsWith: `${prefijo}-${anio}-` } },
      orderBy: { numero: 'desc' }
    })
    ultimoNumero = ultimo?.numero
  } else if (tipo === 'TC') {
    const ultimo = await req.db.transferenciaCaja.findFirst({
      where: { numero: { startsWith: `${prefijo}-${anio}-` } },
      orderBy: { numero: 'desc' }
    })
    ultimoNumero = ultimo?.numero
  } else if (tipo === 'ENT') {
    const ultimo = await req.db.entidad.findFirst({
      where: { codigo: { startsWith: `${prefijo}-` } },
      orderBy: { codigo: 'desc' }
    })
    ultimoNumero = ultimo?.codigo
  }

  let siguiente = 1
  if (ultimoNumero) {
    const partes = ultimoNumero.split('-')
    const ultimo = parseInt(partes[partes.length - 1]) || 0
    siguiente = ultimo + 1
  }

  const numero = `${prefijo}-${anio}-${String(siguiente).padStart(5, '0')}`

  res.json({ success: true, data: { numero } })
}))

export default router
