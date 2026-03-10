/**
 * Rutas de Categorías y Productos del Buffet
 * - CRUD de categorías del menú
 * - CRUD de productos del menú
 * - Búsqueda por código de barras
 */
import express from 'express'
import prisma from '../../lib/prisma.js'
import { authAdmin, checkPermiso } from '../../middleware/auth.js'

const router = express.Router()

// ============================================================================
// CATEGORÍAS DEL MENÚ
// ============================================================================

/**
 * GET /categorias
 * Listar categorías del menú
 */
router.get('/categorias', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_KIOSCO', 'BUFFET_MESAS', 'BUFFET_COBRAR'), async (req, res) => {
  try {
    const { activo } = req.query

    const where = {}
    if (activo !== undefined) where.activo = activo === 'true'

    const categorias = await prisma.categoriaMenu.findMany({
      where,
      orderBy: { orden: 'asc' },
      include: {
        _count: { select: { productos: true } }
      }
    })

    res.json({ success: true, data: categorias })
  } catch (error) {
    console.error('Error al listar categorías:', error)
    res.status(500).json({ success: false, error: 'Error al listar categorías' })
  }
})

/**
 * POST /categorias
 * Crear categoría
 */
router.post('/categorias', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { codigo, nombre, descripcion, color, icono, orden } = req.body

    const categoria = await prisma.categoriaMenu.create({
      data: { codigo, nombre, descripcion, color, icono, orden: orden || 0 }
    })

    res.status(201).json({ success: true, data: categoria })
  } catch (error) {
    console.error('Error al crear categoría:', error)
    res.status(500).json({ success: false, error: 'Error al crear categoría' })
  }
})

/**
 * PUT /categorias/:id
 * Actualizar categoría
 */
router.put('/categorias/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { codigo, nombre, descripcion, color, icono, orden, activo } = req.body

    const categoria = await prisma.categoriaMenu.update({
      where: { id: parseInt(id) },
      data: { codigo, nombre, descripcion, color, icono, orden, activo }
    })

    res.json({ success: true, data: categoria })
  } catch (error) {
    console.error('Error al actualizar categoría:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar categoría' })
  }
})

/**
 * DELETE /categorias/:id
 * Eliminar categoría
 */
router.delete('/categorias/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const productos = await prisma.productoBuffet.count({ where: { categoriaMenuId: parseInt(id) } })
    if (productos > 0) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar una categoría con productos' })
    }

    await prisma.categoriaMenu.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Categoría eliminada' })
  } catch (error) {
    console.error('Error al eliminar categoría:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar categoría' })
  }
})

// ============================================================================
// PRODUCTOS DEL BUFFET
// ============================================================================

/**
 * GET /productos
 * Listar productos del buffet
 */
router.get('/productos', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_KIOSCO', 'BUFFET_MESAS', 'BUFFET_COBRAR'), async (req, res) => {
  try {
    const { categoriaId, disponible, activo, tipoVenta, busqueda } = req.query

    const where = {}
    if (categoriaId) where.categoriaMenuId = parseInt(categoriaId)
    if (disponible !== undefined) where.disponible = disponible === 'true'
    if (activo !== undefined) where.activo = activo === 'true'

    if (tipoVenta) {
      where.tiposVenta = { has: tipoVenta }
    }

    if (busqueda) {
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { descripcion: { contains: busqueda, mode: 'insensitive' } },
        { codigoBarras: { equals: busqueda } },
        // Buscar en nombres de ingredientes/opciones
        {
          gruposOpciones: {
            some: {
              opciones: {
                some: {
                  nombre: { contains: busqueda, mode: 'insensitive' }
                }
              }
            }
          }
        }
      ]
    }

    const productos = await prisma.productoBuffet.findMany({
      where,
      orderBy: [{ nombre: 'asc' }],
      include: {
        categoriaMenu: true,
        producto: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            variantes: {
              where: { activo: true },
              select: { id: true, talle: true, color: true, stockActual: true }
            }
          }
        },
        gruposOpciones: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: {
            opciones: {
              where: { activo: true },
              orderBy: { orden: 'asc' },
              select: {
                id: true,
                nombre: true,
                precioAdicional: true,
                orden: true,
                activo: true,
                productoRefId: true
              }
            }
          }
        }
      }
    })

    res.json({ success: true, data: productos })
  } catch (error) {
    console.error('Error al listar productos:', error)
    res.status(500).json({ success: false, error: 'Error al listar productos' })
  }
})

/**
 * GET /productos/barcode/:codigo
 * Buscar producto por código de barras
 */
router.get('/productos/barcode/:codigo', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_KIOSCO'), async (req, res) => {
  try {
    const { codigo } = req.params

    const producto = await prisma.productoBuffet.findFirst({
      where: {
        codigoBarras: codigo,
        activo: true,
        disponible: true,
        tiposVenta: { has: 'KIOSCO' }
      },
      include: { categoriaMenu: true }
    })

    if (!producto) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' })
    }

    res.json({ success: true, data: producto })
  } catch (error) {
    console.error('Error al buscar producto:', error)
    res.status(500).json({ success: false, error: 'Error al buscar producto' })
  }
})

/**
 * POST /productos/crear-completo
 * Crear producto completo (Stock + Buffet)
 */
router.post('/productos/crear-completo', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const {
      codigo,
      categoriaStockId,
      nombre,
      descripcion,
      codigoBarras,
      precio,
      categoriaMenuId,
      imagen,
      tiposVenta,
      disponible,
      destacado,
      orden
    } = req.body

    if (!codigo || !nombre || !precio || !categoriaMenuId) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' })
    }

    const existente = await prisma.producto.findUnique({ where: { codigo } })
    if (existente) {
      return res.status(400).json({ success: false, error: 'Ya existe un producto con ese código' })
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const productoStock = await tx.producto.create({
        data: {
          codigo,
          nombre,
          descripcion,
          categoriaId: categoriaStockId || null,
          precioVenta: precio,
          activo: true
        }
      })

      const productoBuffet = await tx.productoBuffet.create({
        data: {
          productoId: productoStock.id,
          categoriaMenuId,
          nombre,
          descripcion,
          codigoBarras: codigoBarras || null,
          precio,
          imagen,
          tiposVenta: tiposVenta || ['BUFFET', 'KIOSCO'],
          disponible: disponible !== false,
          destacado: destacado || false,
          orden: orden || 0
        },
        include: { categoriaMenu: true, producto: true }
      })

      return productoBuffet
    })

    res.status(201).json({ success: true, data: resultado })
  } catch (error) {
    console.error('Error al crear producto completo:', error)
    res.status(500).json({ success: false, error: 'Error al crear producto' })
  }
})

/**
 * POST /productos
 * Vincular producto existente del stock al buffet
 */
router.post('/productos', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { productoId, categoriaMenuId, nombre, descripcion, codigoBarras, precio, imagen, tiposVenta, disponible, destacado, orden } = req.body

    const productoStock = await prisma.producto.findUnique({ where: { id: productoId } })
    if (!productoStock) {
      return res.status(400).json({ success: false, error: 'Producto del stock no encontrado' })
    }

    const yaVinculado = await prisma.productoBuffet.findUnique({ where: { productoId } })
    if (yaVinculado) {
      return res.status(400).json({ success: false, error: 'Este producto ya está en el menú del buffet' })
    }

    const producto = await prisma.productoBuffet.create({
      data: {
        productoId,
        categoriaMenuId,
        nombre: nombre || productoStock.nombre,
        descripcion,
        codigoBarras: codigoBarras || null,
        precio,
        imagen,
        tiposVenta: tiposVenta || ['BUFFET', 'KIOSCO'],
        disponible: disponible !== false,
        destacado: destacado || false,
        orden: orden || 0
      },
      include: { categoriaMenu: true, producto: true }
    })

    res.status(201).json({ success: true, data: producto })
  } catch (error) {
    console.error('Error al crear producto:', error)
    res.status(500).json({ success: false, error: 'Error al crear producto' })
  }
})

/**
 * PUT /productos/precios
 * Actualizar precios masivamente
 */
router.put('/productos/precios', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { productos } = req.body

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar un array de productos con id y precio' })
    }

    const actualizaciones = await prisma.$transaction(
      productos.map(({ id, precio }) =>
        prisma.productoBuffet.update({
          where: { id: parseInt(id) },
          data: { precio: parseFloat(precio) }
        })
      )
    )

    res.json({ success: true, data: actualizaciones, count: actualizaciones.length })
  } catch (error) {
    console.error('Error al actualizar precios:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar precios' })
  }
})

/**
 * PUT /productos/:id
 * Actualizar producto del buffet
 */
router.put('/productos/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params
    const { categoriaMenuId, nombre, descripcion, codigoBarras, precio, imagen, tiposVenta, disponible, destacado, orden, activo } = req.body

    const producto = await prisma.productoBuffet.update({
      where: { id: parseInt(id) },
      data: {
        categoriaMenuId,
        nombre,
        descripcion,
        codigoBarras: codigoBarras || null,
        precio,
        imagen,
        tiposVenta: tiposVenta || undefined,
        disponible,
        destacado,
        orden,
        activo
      },
      include: { categoriaMenu: true, producto: true }
    })

    res.json({ success: true, data: producto })
  } catch (error) {
    console.error('Error al actualizar producto:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar producto' })
  }
})

/**
 * DELETE /productos/:id
 * Eliminar producto del buffet
 */
router.delete('/productos/:id', authAdmin, checkPermiso('BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    await prisma.productoBuffet.delete({ where: { id: parseInt(id) } })

    res.json({ success: true, message: 'Producto eliminado' })
  } catch (error) {
    console.error('Error al eliminar producto:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar producto' })
  }
})

/**
 * PUT /productos/:id/disponibilidad
 * Cambiar disponibilidad rápido
 */
router.put('/productos/:id/disponibilidad', authAdmin, checkPermiso('BUFFET_MESAS'), async (req, res) => {
  try {
    const { id } = req.params
    const { disponible } = req.body

    const producto = await prisma.productoBuffet.update({
      where: { id: parseInt(id) },
      data: { disponible }
    })

    res.json({ success: true, data: producto })
  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error)
    res.status(500).json({ success: false, error: 'Error al cambiar disponibilidad' })
  }
})

/**
 * GET /productos/:id/detalle
 * Obtener un producto por ID con sus opciones (para página de edición de opciones)
 */
router.get('/productos/:id/detalle', authAdmin, checkPermiso('BUFFET_VER', 'BUFFET_CONFIG'), async (req, res) => {
  try {
    const { id } = req.params

    const producto = await prisma.productoBuffet.findUnique({
      where: { id: parseInt(id) },
      include: {
        categoriaMenu: true,
        producto: { select: { id: true, codigo: true, nombre: true } },
        gruposOpciones: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: {
            opciones: {
              where: { activo: true },
              orderBy: { orden: 'asc' }
            }
          }
        }
      }
    })

    if (!producto) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' })
    }

    res.json({ success: true, data: producto })
  } catch (error) {
    console.error('Error al obtener producto:', error)
    res.status(500).json({ success: false, error: 'Error al obtener producto' })
  }
})

export default router
