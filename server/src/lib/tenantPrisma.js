import prisma from './prisma.js';

/**
 * Modelos del sistema multi-tenant que NO deben ser filtrados por tenantId.
 * Son modelos globales compartidos entre todos los tenants.
 */
const GLOBAL_MODELS = new Set([
  'tenant',
  'tenantUsuario',
  'tenantConfiguracion',
  'admin',
  'rol',
  'permiso',
  'permisoRol',
  'cajaRol',
  'menuItem',
  'menuItemRol',
  'rubro',
]);

/**
 * Crea un cliente Prisma que filtra automáticamente por tenantId
 * en todos los modelos de negocio (excluyendo los modelos globales del sistema).
 */
export function createTenantPrisma(tenantId) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async findUnique({ model, args, query }) {
          return query(args);
        },

        async upsert({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.create = { ...args.create, tenantId };
          }
          return query(args);
        },

        async create({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },

        async createMany({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(item => ({ ...item, tenantId }));
            } else if (args.data && typeof args.data === 'object') {
              args.data.tenantId = tenantId;
            }
          }
          return query(args);
        },

        async update({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async delete({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async count({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async aggregate({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        }
      }
    }
  });
}
