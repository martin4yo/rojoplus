import prisma from './prisma.js';

/**
 * Expande selectores de claves compuestas de Prisma a campos individuales.
 * Ejemplo: { tenantId_clave: { tenantId: 4, clave: 'X' } } → { tenantId: 4, clave: 'X' }
 * Necesario porque findUnique acepta compound keys pero findFirst no.
 */
function expandCompoundSelectors(where) {
  if (!where) return where
  const result = {}
  for (const [key, value] of Object.entries(where)) {
    const isCompound =
      key.includes('_') &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !('gte' in value || 'lte' in value || 'gt' in value || 'lt' in value ||
        'in' in value || 'notIn' in value || 'not' in value ||
        'contains' in value || 'startsWith' in value || 'endsWith' in value)
    if (isCompound) {
      Object.assign(result, value)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Modelos del sistema multi-tenant que NO deben ser filtrados por tenantId.
 * Son modelos globales compartidos entre todos los tenants.
 */
const GLOBAL_MODELS = new Set([
  'Tenant',
  'TenantUsuario',
  'TenantConfiguracion',
  'Admin',
  'Rol',
  'Permiso',
  'PermisoRol',
  'CajaRol',
  'MenuItem',
  'MenuItemRol',
  'Rubro',
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
          if (!GLOBAL_MODELS.has(model)) {
            // findUnique no admite filtros extra en where (requiere constraint único),
            // por eso se redirige a findFirst que sí acepta tenantId arbitrario.
            // Los selectores compuestos (e.g. tenantId_clave) se expanden a campos individuales.
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            return prisma[modelName].findFirst({
              ...args,
              where: { ...expandCompoundSelectors(args.where), tenantId },
            });
          }
          return query(args);
        },

        async findUniqueOrThrow({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            const modelName = model.charAt(0).toLowerCase() + model.slice(1);
            const result = await prisma[modelName].findFirst({
              ...args,
              where: { ...expandCompoundSelectors(args.where), tenantId },
            });
            if (!result) {
              const err = new Error(`No ${model} record found`);
              err.code = 'P2025';
              throw err;
            }
            return result;
          }
          return query(args);
        },

        async groupBy({ model, args, query }) {
          if (!GLOBAL_MODELS.has(model)) {
            args.where = { ...args.where, tenantId };
          }
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
