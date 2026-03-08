import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = express.Router()

// Todas las rutas requieren autenticación de admin
router.use(authAdmin)

// Secciones válidas del reglamento
const SECCIONES_VALIDAS = ['GENERAL', 'PADRES', 'JUGADORES', 'ENTRENADORES', 'SANCIONES', 'CONFLICTOS']

/**
 * GET /api/admin/reglamento
 * Listar artículos del reglamento con filtros
 */
router.get('/', checkPermiso('REGLAMENTO_VER'), asyncHandler(async (req, res) => {
  const { seccion, activo, requiereAceptacion } = req.query

  const where = {}

  if (seccion) {
    where.seccion = seccion
  }

  if (activo !== undefined) {
    where.activo = activo === 'true'
  }

  if (requiereAceptacion !== undefined) {
    where.requiereAceptacion = requiereAceptacion === 'true'
  }

  const articulos = await prisma.articuloReglamento.findMany({
    where,
    include: {
      _count: {
        select: {
          aceptaciones: true
        }
      }
    },
    orderBy: [
      { seccion: 'asc' },
      { orden: 'asc' }
    ]
  })

  // Agrupar por sección
  const porSeccion = articulos.reduce((acc, art) => {
    if (!acc[art.seccion]) {
      acc[art.seccion] = []
    }
    acc[art.seccion].push(art)
    return acc
  }, {})

  res.json({
    success: true,
    data: articulos,
    porSeccion
  })
}))

/**
 * GET /api/admin/reglamento/:id
 * Obtener detalle de un artículo
 */
router.get('/:id', checkPermiso('REGLAMENTO_VER'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const articulo = await prisma.articuloReglamento.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: {
          aceptaciones: true
        }
      },
      aceptaciones: {
        take: 10,
        orderBy: { fechaAceptacion: 'desc' },
        include: {
          socio: {
            select: {
              id: true,
              apellidoNombre: true,
              nroSocio: true
            }
          }
        }
      }
    }
  })

  if (!articulo) {
    throw new AppError('Artículo no encontrado', 404)
  }

  res.json({
    success: true,
    data: articulo
  })
}))

/**
 * POST /api/admin/reglamento
 * Crear artículo del reglamento
 */
router.post('/', checkPermiso('REGLAMENTO_EDITAR'), asyncHandler(async (req, res) => {
  const {
    seccion,
    titulo,
    contenido,
    orden,
    requiereAceptacion
  } = req.body

  // Validaciones
  if (!seccion || !titulo || !contenido) {
    throw new AppError('Sección, título y contenido son requeridos', 400)
  }

  if (!SECCIONES_VALIDAS.includes(seccion)) {
    throw new AppError(`Sección inválida. Debe ser una de: ${SECCIONES_VALIDAS.join(', ')}`, 400)
  }

  // Si no se especifica orden, poner al final de la sección
  let ordenFinal = orden
  if (ordenFinal === undefined) {
    const ultimo = await prisma.articuloReglamento.findFirst({
      where: { seccion },
      orderBy: { orden: 'desc' }
    })
    ordenFinal = (ultimo?.orden || 0) + 1
  }

  const articulo = await prisma.articuloReglamento.create({
    data: {
      seccion,
      titulo,
      contenido,
      orden: ordenFinal,
      requiereAceptacion: requiereAceptacion || false,
      version: 1
    }
  })

  res.status(201).json({
    success: true,
    message: 'Artículo del reglamento creado correctamente',
    data: articulo
  })
}))

/**
 * PUT /api/admin/reglamento/:id
 * Actualizar artículo del reglamento
 * IMPORTANTE: Al editar un artículo que requiere aceptación, se incrementa la versión
 */
router.put('/:id', checkPermiso('REGLAMENTO_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    seccion,
    titulo,
    contenido,
    orden,
    requiereAceptacion,
    activo
  } = req.body

  const existente = await prisma.articuloReglamento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!existente) {
    throw new AppError('Artículo no encontrado', 404)
  }

  // Validar sección si se proporciona
  if (seccion && !SECCIONES_VALIDAS.includes(seccion)) {
    throw new AppError(`Sección inválida. Debe ser una de: ${SECCIONES_VALIDAS.join(', ')}`, 400)
  }

  // Determinar si hay cambios significativos que requieren nueva versión
  const cambiosSignificativos =
    (titulo && titulo !== existente.titulo) ||
    (contenido && contenido !== existente.contenido)

  const nuevaVersion = (existente.requiereAceptacion && cambiosSignificativos)
    ? existente.version + 1
    : existente.version

  const articulo = await prisma.articuloReglamento.update({
    where: { id: parseInt(id) },
    data: {
      seccion: seccion || existente.seccion,
      titulo: titulo || existente.titulo,
      contenido: contenido || existente.contenido,
      orden: orden !== undefined ? orden : existente.orden,
      requiereAceptacion: requiereAceptacion !== undefined ? requiereAceptacion : existente.requiereAceptacion,
      activo: activo !== undefined ? activo : existente.activo,
      version: nuevaVersion,
      fechaVigencia: cambiosSignificativos ? new Date() : existente.fechaVigencia
    }
  })

  res.json({
    success: true,
    message: 'Artículo del reglamento actualizado correctamente',
    data: articulo,
    versionIncrementada: nuevaVersion > existente.version
  })
}))

/**
 * DELETE /api/admin/reglamento/:id
 * Eliminar artículo del reglamento (soft delete)
 * IMPORTANTE: No se eliminan físicamente si tienen aceptaciones
 */
router.delete('/:id', checkPermiso('REGLAMENTO_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params

  const existente = await prisma.articuloReglamento.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: {
          aceptaciones: true
        }
      }
    }
  })

  if (!existente) {
    throw new AppError('Artículo no encontrado', 404)
  }

  if (existente._count.aceptaciones > 0) {
    // Soft delete si tiene aceptaciones
    await prisma.articuloReglamento.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    })

    return res.json({
      success: true,
      message: 'Artículo desactivado (tiene aceptaciones registradas)'
    })
  }

  // Eliminación física si no tiene aceptaciones
  await prisma.articuloReglamento.delete({
    where: { id: parseInt(id) }
  })

  res.json({
    success: true,
    message: 'Artículo del reglamento eliminado correctamente'
  })
}))

/**
 * POST /api/admin/reglamento/:id/reordenar
 * Reordenar artículos dentro de una sección
 */
router.post('/:id/reordenar', checkPermiso('REGLAMENTO_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nuevoOrden } = req.body

  if (nuevoOrden === undefined) {
    throw new AppError('Nuevo orden es requerido', 400)
  }

  const articulo = await prisma.articuloReglamento.findUnique({
    where: { id: parseInt(id) }
  })

  if (!articulo) {
    throw new AppError('Artículo no encontrado', 404)
  }

  // Actualizar orden
  await prisma.articuloReglamento.update({
    where: { id: parseInt(id) },
    data: { orden: parseInt(nuevoOrden) }
  })

  res.json({
    success: true,
    message: 'Orden actualizado correctamente'
  })
}))

/**
 * GET /api/admin/reglamento/estadisticas/aceptacion
 * Estadísticas de aceptación del reglamento
 */
router.get('/estadisticas/aceptacion', checkPermiso('REGLAMENTO_VER'), asyncHandler(async (req, res) => {
  // Total de artículos que requieren aceptación
  const articulosConAceptacion = await prisma.articuloReglamento.findMany({
    where: {
      activo: true,
      requiereAceptacion: true
    },
    include: {
      _count: {
        select: {
          aceptaciones: true
        }
      }
    }
  })

  // Total de socios activos
  const totalSociosActivos = await prisma.socio.count({
    where: { estado: 'ACTIVO' }
  })

  // Aceptaciones por artículo
  const estadisticasPorArticulo = articulosConAceptacion.map(art => ({
    id: art.id,
    seccion: art.seccion,
    titulo: art.titulo,
    version: art.version,
    totalAceptaciones: art._count.aceptaciones,
    porcentajeAceptacion: totalSociosActivos > 0
      ? ((art._count.aceptaciones / totalSociosActivos) * 100).toFixed(2)
      : 0
  }))

  // Aceptaciones recientes
  const aceptacionesRecientes = await prisma.aceptacionReglamento.findMany({
    take: 20,
    orderBy: { fechaAceptacion: 'desc' },
    include: {
      socio: {
        select: {
          id: true,
          apellidoNombre: true,
          nroSocio: true
        }
      },
      articulo: {
        select: {
          id: true,
          seccion: true,
          titulo: true,
          version: true
        }
      }
    }
  })

  res.json({
    success: true,
    data: {
      totalArticulosConAceptacion: articulosConAceptacion.length,
      totalSociosActivos,
      estadisticasPorArticulo,
      aceptacionesRecientes
    }
  })
}))

/**
 * GET /api/admin/reglamento/socios-sin-aceptar
 * Listar socios que no han aceptado el reglamento
 */
router.get('/socios-sin-aceptar', checkPermiso('REGLAMENTO_VER'), asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query

  // Obtener artículos que requieren aceptación
  const articulosConAceptacion = await prisma.articuloReglamento.findMany({
    where: {
      activo: true,
      requiereAceptacion: true
    },
    select: { id: true }
  })

  const articuloIds = articulosConAceptacion.map(a => a.id)

  if (articuloIds.length === 0) {
    return res.json({
      success: true,
      data: [],
      pagination: { total: 0, limit: parseInt(limit), offset: parseInt(offset) }
    })
  }

  // Obtener socios activos que NO tienen aceptación de algún artículo
  const sociosActivos = await prisma.socio.findMany({
    where: { estado: 'ACTIVO' },
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      aceptacionesReglamento: {
        where: {
          articuloId: { in: articuloIds }
        },
        select: {
          articuloId: true,
          version: true
        }
      }
    },
    take: parseInt(limit),
    skip: parseInt(offset)
  })

  // Filtrar socios que no han aceptado todos los artículos requeridos
  const sociosSinAceptar = sociosActivos
    .map(socio => {
      const articulosSinAceptar = articuloIds.filter(artId =>
        !socio.aceptacionesReglamento.some(a => a.articuloId === artId)
      )

      return {
        ...socio,
        articulosSinAceptar: articulosSinAceptar.length,
        totalArticulosRequeridos: articuloIds.length
      }
    })
    .filter(s => s.articulosSinAceptar > 0)

  res.json({
    success: true,
    data: sociosSinAceptar,
    pagination: {
      total: sociosSinAceptar.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  })
}))

export default router
