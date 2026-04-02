import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// Configurar multer para fotos de productos
const uploadDir = path.join(__dirname, '../../uploads/productos')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) {
      return cb(null, true)
    }
    cb(new Error('Solo se permiten imagenes (jpeg, jpg, png, webp)'))
  }
})

// Todas las rutas requieren autenticacion de admin
router.use(authAdmin)

// =============================================================================
// CATEGORIAS DE PRODUCTO
// =============================================================================

// GET /api/admin/categorias-producto - Listar categorias
router.get('/categorias-producto', asyncHandler(async (req, res) => {
  const { activo } = req.query

  const where = {}
  if (activo !== undefined) where.activo = activo === 'true'

  const categorias = await prisma.categoriaProducto.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: {
      _count: { select: { productos: true } }
    }
  })

  res.json({ success: true, data: categorias })
}))

// POST /api/admin/categorias-producto - Crear categoria
router.post('/categorias-producto', asyncHandler(async (req, res) => {
  const { codigo, nombre } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400)
  }

  const existente = await prisma.categoriaProducto.findFirst({ where: { codigo } })
  if (existente) {
    throw new AppError('Ya existe una categoria con ese codigo', 400)
  }

  const categoria = await prisma.categoriaProducto.create({
    data: { codigo, nombre }
  })

  res.status(201).json({ success: true, data: categoria })
}))

// PUT /api/admin/categorias-producto/:id - Actualizar categoria
router.put('/categorias-producto/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, activo } = req.body

  const existente = await prisma.categoriaProducto.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Categoria no encontrada', 404)
  }

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.categoriaProducto.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe una categoria con ese codigo', 400)
    }
  }

  const categoria = await prisma.categoriaProducto.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      nombre: nombre || existente.nombre,
      activo: activo !== undefined ? activo : existente.activo
    }
  })

  res.json({ success: true, data: categoria })
}))

// =============================================================================
// PRODUCTOS
// =============================================================================

// GET /api/admin/productos - Listar productos
router.get('/productos', asyncHandler(async (req, res) => {
  const { categoriaId, activo, busqueda, page = 1, limit = 50 } = req.query

  const where = {}
  if (categoriaId) where.categoriaId = parseInt(categoriaId)
  if (activo !== undefined) where.activo = activo === 'true'
  if (busqueda) {
    where.OR = [
      { codigo: { contains: busqueda, mode: 'insensitive' } },
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { variantes: { some: { sku: { contains: busqueda, mode: 'insensitive' } } } }
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
      skip,
      take: parseInt(limit),
      include: {
        categoria: { select: { id: true, codigo: true, nombre: true } },
        conceptoCompra: { select: { id: true, codigo: true, nombre: true } },
        conceptoVenta: { select: { id: true, codigo: true, nombre: true } },
        fotos: {
          where: { esPrincipal: true },
          take: 1
        },
        variantes: {
          where: { activo: true },
          select: { id: true, talle: true, color: true, sku: true, stockActual: true, stockMinimo: true }
        },
        _count: { select: { variantes: true } }
      }
    }),
    prisma.producto.count({ where })
  ])

  // Formatear decimales y calcular stock total
  const productosFormateados = productos.map(p => ({
    ...p,
    precioCompra: p.precioCompra ? Number(p.precioCompra) : null,
    precioVenta: p.precioVenta ? Number(p.precioVenta) : null,
    stockTotal: p.variantes.reduce((sum, v) => sum + Number(v.stockActual), 0),
    variantes: p.variantes.map(v => ({
      ...v,
      stockActual: Number(v.stockActual)
    })),
    fotoPrincipal: p.fotos[0]?.url || null
  }))

  const totalPages = Math.ceil(total / parseInt(limit))
  const from = total > 0 ? skip + 1 : 0
  const to = Math.min(skip + parseInt(limit), total)

  res.json({
    success: true,
    data: productosFormateados,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      from,
      to
    }
  })
}))

// GET /api/admin/productos/:id - Detalle de producto
router.get('/productos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const producto = await prisma.producto.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoria: true,
      conceptoCompra: { select: { id: true, codigo: true, nombre: true } },
      conceptoVenta: { select: { id: true, codigo: true, nombre: true } },
      fotos: { orderBy: [{ esPrincipal: 'desc' }, { orden: 'asc' }] },
      variantes: {
        orderBy: { talle: 'asc' }
      }
    }
  })

  if (!producto) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json({
    success: true,
    data: {
      ...producto,
      precioCompra: producto.precioCompra ? Number(producto.precioCompra) : null,
      precioVenta: producto.precioVenta ? Number(producto.precioVenta) : null,
      variantes: producto.variantes.map(v => ({
        ...v,
        stockActual: Number(v.stockActual),
        stockMinimo: Number(v.stockMinimo)
      }))
    }
  })
}))

// POST /api/admin/productos - Crear producto
router.post('/productos', asyncHandler(async (req, res) => {
  const { codigo, nombre, descripcion, categoriaId, precioCompra, precioVenta, conceptoCompraId, conceptoVentaId, variantes } = req.body

  if (!codigo || !nombre) {
    throw new AppError('Codigo y nombre son requeridos', 400)
  }

  const existente = await prisma.producto.findFirst({ where: { codigo, tenantId: req.tenantId } })
  if (existente) {
    throw new AppError('Ya existe un producto con ese codigo', 400)
  }

  // Crear producto con variantes si se proporcionan
  const producto = await prisma.producto.create({
    data: {
      codigo,
      nombre,
      descripcion,
      categoriaId: categoriaId ? parseInt(categoriaId) : null,
      precioCompra: precioCompra ? parseFloat(precioCompra) : null,
      precioVenta: precioVenta ? parseFloat(precioVenta) : null,
      conceptoCompraId: conceptoCompraId ? parseInt(conceptoCompraId) : null,
      conceptoVentaId: conceptoVentaId ? parseInt(conceptoVentaId) : null,
      tenantId: req.tenantId,
      variantes: variantes?.length ? {
        create: variantes.map(v => ({
          talle: v.talle,
          color: v.color || null,
          sku: v.sku || null,
          stockActual: v.stockActual ? parseFloat(v.stockActual) : 0,
          stockMinimo: v.stockMinimo ? parseFloat(v.stockMinimo) : 0,
          tenantId: req.tenantId
        }))
      } : undefined
    },
    include: {
      categoria: true,
      conceptoCompra: { select: { id: true, codigo: true, nombre: true } },
      conceptoVenta: { select: { id: true, codigo: true, nombre: true } },
      variantes: true
    }
  })

  res.status(201).json({
    success: true,
    data: {
      ...producto,
      precioCompra: producto.precioCompra ? Number(producto.precioCompra) : null,
      precioVenta: producto.precioVenta ? Number(producto.precioVenta) : null,
      variantes: producto.variantes.map(v => ({
        ...v,
        stockActual: Number(v.stockActual),
        stockMinimo: Number(v.stockMinimo)
      }))
    }
  })
}))

// PUT /api/admin/productos/:id - Actualizar producto
router.put('/productos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { codigo, nombre, descripcion, categoriaId, precioCompra, precioVenta, conceptoCompraId, conceptoVentaId, activo } = req.body

  const existente = await prisma.producto.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Producto no encontrado', 404)
  }

  if (codigo && codigo !== existente.codigo) {
    const duplicado = await prisma.producto.findFirst({ where: { codigo } })
    if (duplicado) {
      throw new AppError('Ya existe un producto con ese codigo', 400)
    }
  }

  const producto = await prisma.producto.update({
    where: { id: parseInt(id) },
    data: {
      codigo: codigo || existente.codigo,
      nombre: nombre || existente.nombre,
      descripcion: descripcion !== undefined ? descripcion : existente.descripcion,
      categoriaId: categoriaId !== undefined ? (categoriaId ? parseInt(categoriaId) : null) : existente.categoriaId,
      precioCompra: precioCompra !== undefined ? (precioCompra ? parseFloat(precioCompra) : null) : existente.precioCompra,
      precioVenta: precioVenta !== undefined ? (precioVenta ? parseFloat(precioVenta) : null) : existente.precioVenta,
      conceptoCompraId: conceptoCompraId !== undefined ? (conceptoCompraId ? parseInt(conceptoCompraId) : null) : existente.conceptoCompraId,
      conceptoVentaId: conceptoVentaId !== undefined ? (conceptoVentaId ? parseInt(conceptoVentaId) : null) : existente.conceptoVentaId,
      activo: activo !== undefined ? activo : existente.activo
    },
    include: {
      categoria: true,
      conceptoCompra: { select: { id: true, codigo: true, nombre: true } },
      conceptoVenta: { select: { id: true, codigo: true, nombre: true } },
      variantes: true,
      fotos: true
    }
  })

  res.json({
    success: true,
    data: {
      ...producto,
      precioCompra: producto.precioCompra ? Number(producto.precioCompra) : null,
      precioVenta: producto.precioVenta ? Number(producto.precioVenta) : null,
      variantes: producto.variantes.map(v => ({
        ...v,
        stockActual: Number(v.stockActual),
        stockMinimo: Number(v.stockMinimo)
      }))
    }
  })
}))

// =============================================================================
// VARIANTES DE PRODUCTO
// =============================================================================

// POST /api/admin/productos/:id/variantes - Agregar variante
router.post('/productos/:id/variantes', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { talle, color, sku, stockActual, stockMinimo } = req.body

  if (!talle) {
    throw new AppError('Talle es requerido', 400)
  }

  const producto = await prisma.producto.findUnique({ where: { id: parseInt(id) } })
  if (!producto) {
    throw new AppError('Producto no encontrado', 404)
  }

  // Verificar que no exista la combinacion talle-color
  const existente = await prisma.productoVariante.findFirst({
    where: {
      productoId: parseInt(id),
      talle,
      color: color || null
    }
  })
  if (existente) {
    throw new AppError('Ya existe una variante con ese talle y color', 400)
  }

  // Verificar SKU unico si se proporciona
  if (sku) {
    const skuExistente = await prisma.productoVariante.findFirst({ where: { sku } })
    if (skuExistente) {
      throw new AppError('Ya existe una variante con ese SKU', 400)
    }
  }

  const variante = await prisma.productoVariante.create({
    data: {
      productoId: parseInt(id),
      tenantId: req.tenantId,
      talle,
      color: color || null,
      sku: sku || null,
      stockActual: stockActual ? parseFloat(stockActual) : 0,
      stockMinimo: stockMinimo ? parseFloat(stockMinimo) : 0
    }
  })

  res.status(201).json({
    success: true,
    data: {
      ...variante,
      stockActual: Number(variante.stockActual),
      stockMinimo: Number(variante.stockMinimo)
    }
  })
}))

// PUT /api/admin/producto-variantes/:id - Actualizar variante
router.put('/producto-variantes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const { talle, color, sku, stockMinimo, activo } = req.body

  const existente = await prisma.productoVariante.findUnique({ where: { id: parseInt(id) } })
  if (!existente) {
    throw new AppError('Variante no encontrada', 404)
  }

  // Verificar combinacion unica si cambia
  if ((talle && talle !== existente.talle) || (color !== undefined && color !== existente.color)) {
    const duplicado = await prisma.productoVariante.findFirst({
      where: {
        productoId: existente.productoId,
        talle: talle || existente.talle,
        color: color !== undefined ? (color || null) : existente.color,
        id: { not: parseInt(id) }
      }
    })
    if (duplicado) {
      throw new AppError('Ya existe una variante con ese talle y color', 400)
    }
  }

  // Verificar SKU unico si cambia
  if (sku && sku !== existente.sku) {
    const skuExistente = await prisma.productoVariante.findFirst({ where: { sku } })
    if (skuExistente) {
      throw new AppError('Ya existe una variante con ese SKU', 400)
    }
  }

  const variante = await prisma.productoVariante.update({
    where: { id: parseInt(id) },
    data: {
      talle: talle || existente.talle,
      color: color !== undefined ? (color || null) : existente.color,
      sku: sku !== undefined ? (sku || null) : existente.sku,
      stockMinimo: stockMinimo !== undefined ? parseFloat(stockMinimo) : existente.stockMinimo,
      activo: activo !== undefined ? activo : existente.activo
    }
  })

  res.json({
    success: true,
    data: {
      ...variante,
      stockActual: Number(variante.stockActual),
      stockMinimo: Number(variante.stockMinimo)
    }
  })
}))

// DELETE /api/admin/producto-variantes/:id - Eliminar variante
router.delete('/producto-variantes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const variante = await prisma.productoVariante.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { movimientos: true } } }
  })

  if (!variante) {
    throw new AppError('Variante no encontrada', 404)
  }

  // No permitir eliminar si tiene movimientos asociados
  if (variante._count.movimientos > 0) {
    throw new AppError('No se puede eliminar una variante con movimientos asociados. Desactivela en su lugar.', 400)
  }

  await prisma.productoVariante.delete({ where: { id: parseInt(id) } })

  res.json({ success: true, message: 'Variante eliminada correctamente' })
}))

// =============================================================================
// FOTOS DE PRODUCTO
// =============================================================================

// POST /api/admin/productos/:id/fotos - Subir foto
router.post('/productos/:id/fotos', upload.single('foto'), asyncHandler(async (req, res) => {
  const { id } = req.params

  if (!req.file) {
    throw new AppError('No se proporciono una imagen', 400)
  }

  const producto = await prisma.producto.findUnique({ where: { id: parseInt(id) } })
  if (!producto) {
    // Eliminar archivo subido
    fs.unlinkSync(req.file.path)
    throw new AppError('Producto no encontrado', 404)
  }

  // Contar fotos existentes para determinar orden
  const fotosCount = await prisma.productoFoto.count({
    where: { productoId: parseInt(id) }
  })

  const foto = await prisma.productoFoto.create({
    data: {
      productoId: parseInt(id),
      url: `/uploads/productos/${req.file.filename}`,
      orden: fotosCount,
      esPrincipal: fotosCount === 0 // Primera foto es principal
    }
  })

  res.status(201).json({ success: true, data: foto })
}))

// PUT /api/admin/producto-fotos/:id/principal - Marcar como principal
router.put('/producto-fotos/:id/principal', asyncHandler(async (req, res) => {
  const { id } = req.params

  const foto = await prisma.productoFoto.findUnique({ where: { id: parseInt(id) } })
  if (!foto) {
    throw new AppError('Foto no encontrada', 404)
  }

  // Quitar principal de otras fotos del producto
  await prisma.$transaction([
    prisma.productoFoto.updateMany({
      where: { productoId: foto.productoId },
      data: { esPrincipal: false }
    }),
    prisma.productoFoto.update({
      where: { id: parseInt(id) },
      data: { esPrincipal: true }
    })
  ])

  res.json({ success: true, message: 'Foto marcada como principal' })
}))

// DELETE /api/admin/producto-fotos/:id - Eliminar foto
router.delete('/producto-fotos/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const foto = await prisma.productoFoto.findUnique({ where: { id: parseInt(id) } })
  if (!foto) {
    throw new AppError('Foto no encontrada', 404)
  }

  // Eliminar archivo fisico
  const filePath = path.join(__dirname, '../..', foto.url)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  await prisma.productoFoto.delete({ where: { id: parseInt(id) } })

  // Si era la principal, marcar la siguiente como principal
  if (foto.esPrincipal) {
    const siguiente = await prisma.productoFoto.findFirst({
      where: { productoId: foto.productoId },
      orderBy: { orden: 'asc' }
    })
    if (siguiente) {
      await prisma.productoFoto.update({
        where: { id: siguiente.id },
        data: { esPrincipal: true }
      })
    }
  }

  res.json({ success: true, message: 'Foto eliminada correctamente' })
}))

// =============================================================================
// MOVIMIENTOS DE STOCK
// =============================================================================

// GET /api/admin/movimientos-stock - Listar movimientos
router.get('/movimientos-stock', asyncHandler(async (req, res) => {
  const { varianteId, productoId, tipo, desde, hasta, page = 1, limit = 50 } = req.query

  const where = {}
  if (varianteId) where.productoVarianteId = parseInt(varianteId)
  if (tipo) where.tipo = tipo

  if (productoId) {
    where.productoVariante = { productoId: parseInt(productoId) }
  }

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta)
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [movimientos, total] = await Promise.all([
    prisma.movimientoStock.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        productoVariante: {
          include: {
            producto: { select: { id: true, codigo: true, nombre: true } }
          }
        }
      }
    }),
    prisma.movimientoStock.count({ where })
  ])

  const movimientosFormateados = movimientos.map(m => ({
    ...m,
    cantidad: Number(m.cantidad),
    stockAnterior: Number(m.stockAnterior),
    stockPosterior: Number(m.stockPosterior)
  }))

  res.json({
    success: true,
    data: movimientosFormateados,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  })
}))

// POST /api/admin/movimientos-stock/ajuste - Ajuste manual de stock
router.post('/movimientos-stock/ajuste', asyncHandler(async (req, res) => {
  const { varianteId, tipo, cantidad, concepto } = req.body

  if (!varianteId || !tipo || !cantidad) {
    throw new AppError('Variante, tipo y cantidad son requeridos', 400)
  }

  if (!['INGRESO', 'EGRESO', 'AJUSTE'].includes(tipo)) {
    throw new AppError('Tipo debe ser INGRESO, EGRESO o AJUSTE', 400)
  }

  const cantidadNum = parseFloat(cantidad)
  if (cantidadNum <= 0) {
    throw new AppError('La cantidad debe ser mayor a cero', 400)
  }

  const variante = await prisma.productoVariante.findUnique({
    where: { id: parseInt(varianteId) },
    include: { producto: true }
  })

  if (!variante) {
    throw new AppError('Variante no encontrada', 404)
  }

  const stockActual = Number(variante.stockActual)

  // Calcular nuevo stock
  let nuevoStock
  if (tipo === 'INGRESO') {
    nuevoStock = stockActual + cantidadNum
  } else if (tipo === 'EGRESO') {
    if (stockActual < cantidadNum) {
      throw new AppError('Stock insuficiente para realizar el egreso', 400)
    }
    nuevoStock = stockActual - cantidadNum
  } else {
    // AJUSTE: la cantidad es el nuevo stock absoluto
    nuevoStock = cantidadNum
  }

  // Crear movimiento y actualizar stock
  const resultado = await prisma.$transaction(async (tx) => {
    const movimiento = await tx.movimientoStock.create({
      data: {
        productoVarianteId: parseInt(varianteId),
        fecha: new Date(),
        tipo,
        cantidad: tipo === 'AJUSTE' ? Math.abs(nuevoStock - stockActual) : cantidadNum,
        stockAnterior: stockActual,
        stockPosterior: nuevoStock,
        concepto: concepto || `Ajuste manual - ${tipo}`,
        registradoPor: req.admin.id,
        tenantId: req.tenantId
      },
      include: {
        productoVariante: {
          include: { producto: true }
        }
      }
    })

    await tx.productoVariante.update({
      where: { id: parseInt(varianteId) },
      data: { stockActual: nuevoStock }
    })

    return movimiento
  })

  res.status(201).json({
    success: true,
    data: {
      ...resultado,
      cantidad: Number(resultado.cantidad),
      stockAnterior: Number(resultado.stockAnterior),
      stockPosterior: Number(resultado.stockPosterior)
    }
  })
}))

// =============================================================================
// ALERTAS DE STOCK
// =============================================================================

// GET /api/admin/stock/alertas - Productos bajo stock minimo
router.get('/stock/alertas', asyncHandler(async (req, res) => {
  const variantes = await prisma.$queryRaw`
    SELECT
      pv.id,
      pv.talle,
      pv.color,
      pv.sku,
      pv.stock_actual as "stockActual",
      pv.stock_minimo as "stockMinimo",
      p.id as "productoId",
      p.codigo as "productoCodigo",
      p.nombre as "productoNombre"
    FROM producto_variantes pv
    JOIN productos p ON pv.producto_id = p.id
    WHERE pv.activo = true
      AND p.activo = true
      AND pv.stock_actual <= pv.stock_minimo
    ORDER BY (pv.stock_actual / NULLIF(pv.stock_minimo, 0)) ASC, p.nombre ASC
  `

  res.json({
    success: true,
    data: variantes.map(v => ({
      ...v,
      stockActual: Number(v.stockActual),
      stockMinimo: Number(v.stockMinimo)
    })),
    total: variantes.length
  })
}))

// GET /api/admin/stock/resumen - Resumen general de stock
router.get('/stock/resumen', asyncHandler(async (req, res) => {
  const [totalProductos, totalVariantes, variantesBajoMinimo, valorStock] = await Promise.all([
    prisma.producto.count({ where: { activo: true } }),
    prisma.productoVariante.count({ where: { activo: true } }),
    prisma.productoVariante.count({
      where: {
        activo: true,
        producto: { activo: true },
        stockActual: { lte: prisma.productoVariante.fields.stockMinimo }
      }
    }),
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(pv.stock_actual * COALESCE(p.precio_venta, 0)), 0) as "valorVenta",
        COALESCE(SUM(pv.stock_actual * COALESCE(p.precio_compra, 0)), 0) as "valorCompra"
      FROM producto_variantes pv
      JOIN productos p ON pv.producto_id = p.id
      WHERE pv.activo = true AND p.activo = true
    `
  ])

  res.json({
    success: true,
    data: {
      totalProductos,
      totalVariantes,
      variantesBajoMinimo,
      valorStockVenta: Number(valorStock[0]?.valorVenta || 0),
      valorStockCompra: Number(valorStock[0]?.valorCompra || 0)
    }
  })
}))

export default router
