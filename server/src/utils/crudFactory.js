import prisma from '../lib/prisma.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

/**
 * Factory para crear endpoints CRUD genéricos
 *
 * @param {string} modelName - Nombre del modelo de Prisma (ej: 'tipoEspacio')
 * @param {Object} options - Opciones de configuración
 * @param {string} options.uniqueField - Campo único para verificar duplicados (default: null)
 * @param {string[]} options.requiredFields - Campos requeridos al crear
 * @param {Object} options.orderBy - Ordenamiento por defecto
 * @param {Object} options.include - Relaciones a incluir
 * @param {function} options.filterFn - Función para construir filtros personalizados
 * @param {function} options.beforeCreate - Hook antes de crear
 * @param {function} options.afterCreate - Hook después de crear
 * @param {function} options.beforeUpdate - Hook antes de actualizar
 * @param {function} options.afterUpdate - Hook después de actualizar
 * @param {function} options.beforeDelete - Hook antes de eliminar
 *
 * @returns {Object} Objeto con handlers para list, get, create, update, delete, toggleActive
 *
 * @example
 * // Uso básico
 * const tipoEspacioCrud = createCrudRoutes('tipoEspacio', {
 *   uniqueField: 'codigo',
 *   requiredFields: ['codigo', 'nombre'],
 *   orderBy: { orden: 'asc' }
 * })
 *
 * router.get('/tipos-espacio', authAdmin, tipoEspacioCrud.list)
 * router.post('/tipos-espacio', authAdmin, tipoEspacioCrud.create)
 * router.put('/tipos-espacio/:id', authAdmin, tipoEspacioCrud.update)
 * router.delete('/tipos-espacio/:id', authAdmin, tipoEspacioCrud.delete)
 */
export function createCrudRoutes(modelName, options = {}) {
  const {
    uniqueField = null,
    requiredFields = [],
    orderBy = { id: 'desc' },
    include = undefined,
    select = undefined,
    filterFn = null,
    beforeCreate = null,
    afterCreate = null,
    beforeUpdate = null,
    afterUpdate = null,
    beforeDelete = null,
    softDelete = false, // Si true, usa activo = false en lugar de delete
    itemName = 'registro' // Para mensajes de error
  } = options

  const model = prisma[modelName]

  if (!model) {
    throw new Error(`Modelo '${modelName}' no existe en Prisma`)
  }

  return {
    /**
     * Listar todos los registros
     * Query params: activo, page, limit, orderBy, orderDir
     */
    list: asyncHandler(async (req, res) => {
      const { activo, page, limit, orderBy: orderField, orderDir, ...filters } = req.query

      // Construir where
      let where = {}

      if (activo !== undefined) {
        where.activo = activo === 'true'
      }

      // Filtros personalizados
      if (filterFn) {
        where = { ...where, ...filterFn(req, filters) }
      }

      // Paginación opcional
      const pagination = {}
      if (page && limit) {
        pagination.skip = (parseInt(page) - 1) * parseInt(limit)
        pagination.take = parseInt(limit)
      }

      // Ordenamiento dinámico
      let finalOrderBy = orderBy
      if (orderField) {
        finalOrderBy = { [orderField]: orderDir === 'desc' ? 'desc' : 'asc' }
      }

      const [items, total] = await Promise.all([
        model.findMany({
          where,
          orderBy: finalOrderBy,
          include,
          select,
          ...pagination
        }),
        pagination.take ? model.count({ where }) : null
      ])

      const response = { success: true, data: items }
      if (total !== null) {
        response.total = total
        response.page = parseInt(page)
        response.totalPages = Math.ceil(total / parseInt(limit))
      }

      res.json(response)
    }),

    /**
     * Obtener un registro por ID
     */
    get: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const item = await model.findUnique({
        where: { id },
        include
      })

      if (!item) {
        throw new AppError(`${itemName} no encontrado`, 404, 'NOT_FOUND')
      }

      res.json({ success: true, data: item })
    }),

    /**
     * Crear un nuevo registro
     */
    create: asyncHandler(async (req, res) => {
      let data = { ...req.body }

      // Validar campos requeridos
      for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          throw new AppError(`El campo '${field}' es requerido`, 400, 'VALIDATION_ERROR')
        }
      }

      // Verificar unicidad si aplica
      if (uniqueField && data[uniqueField]) {
        const existing = await model.findFirst({
          where: { [uniqueField]: data[uniqueField] }
        })
        if (existing) {
          throw new AppError(`Ya existe un ${itemName} con ese ${uniqueField}`, 400, 'DUPLICATE')
        }
      }

      // Hook beforeCreate
      if (beforeCreate) {
        data = await beforeCreate(data, req)
      }

      const item = await model.create({ data, include })

      // Hook afterCreate
      if (afterCreate) {
        await afterCreate(item, req)
      }

      res.status(201).json({ success: true, data: item })
    }),

    /**
     * Actualizar un registro existente
     */
    update: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)
      let data = { ...req.body }

      // Verificar existencia
      const existing = await model.findUnique({ where: { id } })
      if (!existing) {
        throw new AppError(`${itemName} no encontrado`, 404, 'NOT_FOUND')
      }

      // Verificar unicidad si cambió el campo único
      if (uniqueField && data[uniqueField] && data[uniqueField] !== existing[uniqueField]) {
        const duplicate = await model.findFirst({
          where: {
            [uniqueField]: data[uniqueField],
            id: { not: id }
          }
        })
        if (duplicate) {
          throw new AppError(`Ya existe un ${itemName} con ese ${uniqueField}`, 400, 'DUPLICATE')
        }
      }

      // Hook beforeUpdate
      if (beforeUpdate) {
        data = await beforeUpdate(data, existing, req)
      }

      const item = await model.update({
        where: { id },
        data,
        include
      })

      // Hook afterUpdate
      if (afterUpdate) {
        await afterUpdate(item, existing, req)
      }

      res.json({ success: true, data: item })
    }),

    /**
     * Eliminar un registro
     */
    delete: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const existing = await model.findUnique({ where: { id } })
      if (!existing) {
        throw new AppError(`${itemName} no encontrado`, 404, 'NOT_FOUND')
      }

      // Hook beforeDelete
      if (beforeDelete) {
        await beforeDelete(existing, req)
      }

      if (softDelete) {
        // Soft delete: marcar como inactivo
        await model.update({
          where: { id },
          data: { activo: false }
        })
      } else {
        // Hard delete
        await model.delete({ where: { id } })
      }

      res.json({ success: true, message: `${itemName} eliminado correctamente` })
    }),

    /**
     * Toggle estado activo/inactivo
     */
    toggleActive: asyncHandler(async (req, res) => {
      const id = parseInt(req.params.id)

      const existing = await model.findUnique({ where: { id } })
      if (!existing) {
        throw new AppError(`${itemName} no encontrado`, 404, 'NOT_FOUND')
      }

      const item = await model.update({
        where: { id },
        data: { activo: !existing.activo },
        include
      })

      res.json({
        success: true,
        data: item,
        message: `${itemName} ${item.activo ? 'activado' : 'desactivado'}`
      })
    }),

    /**
     * Reordenar registros (si tienen campo 'orden')
     */
    reorder: asyncHandler(async (req, res) => {
      const { items } = req.body // Array de { id, orden }

      if (!Array.isArray(items)) {
        throw new AppError('Se requiere un array de items', 400)
      }

      await prisma.$transaction(
        items.map(({ id, orden }) =>
          model.update({
            where: { id: parseInt(id) },
            data: { orden: parseInt(orden) }
          })
        )
      )

      res.json({ success: true, message: 'Orden actualizado' })
    })
  }
}

/**
 * Crea rutas CRUD y las registra automáticamente en un router
 *
 * @param {Router} router - Express router
 * @param {string} path - Path base (ej: '/tipos-espacio')
 * @param {string} modelName - Nombre del modelo Prisma
 * @param {Object} options - Opciones del CRUD
 * @param {Object} middleware - Middleware a aplicar { auth, permiso }
 */
export function registerCrudRoutes(router, path, modelName, options = {}, middleware = {}) {
  const crud = createCrudRoutes(modelName, options)
  const { auth = [], permiso = null } = middleware

  const middlewares = [...(Array.isArray(auth) ? auth : [auth])]
  if (permiso) {
    middlewares.push(permiso)
  }

  router.get(path, ...middlewares, crud.list)
  router.get(`${path}/:id`, ...middlewares, crud.get)
  router.post(path, ...middlewares, crud.create)
  router.put(`${path}/:id`, ...middlewares, crud.update)
  router.delete(`${path}/:id`, ...middlewares, crud.delete)
  router.patch(`${path}/:id/toggle`, ...middlewares, crud.toggleActive)

  return crud
}

export default createCrudRoutes
