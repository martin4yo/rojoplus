import prisma from './prisma.js';

/**
 * Crea un cliente Prisma scoped a un tenant específico
 * Automáticamente filtra y agrega tenantId a todas las queries
 *
 * Uso:
 *   const db = createTenantPrisma(req.tenantId)
 *   const socios = await db.socio.findMany() // Solo de este tenant
 */
export function createTenantPrisma(tenantId) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async findUnique({ args, query }) {
          const result = await query(args);
          // Validar que el resultado pertenece a este tenant
          if (result && result.tenantId !== undefined && result.tenantId !== tenantId) {
            return null; // No devolver datos de otro tenant
          }
          return result;
        },

        async create({ args, query }) {
          // Inyectar tenantId automáticamente
          args.data = { ...args.data, tenantId };
          return query(args);
        },

        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map(item => ({ ...item, tenantId }));
          } else if (args.data && typeof args.data === 'object') {
            args.data.tenantId = tenantId;
          }
          return query(args);
        },

        async update({ args, query }) {
          // Validar propiedad antes de actualizar
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async delete({ args, query }) {
          // Validar propiedad antes de eliminar
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },

        async aggregate({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        }
      }
    }
  });
}
