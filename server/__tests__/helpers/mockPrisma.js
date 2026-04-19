/**
 * Mock de PrismaClient para tests.
 * Reemplaza todas las llamadas a la DB con funciones jest.fn()
 * que se pueden configurar con mockResolvedValue/mockImplementation.
 */
import { jest } from '@jest/globals'

const modelMethods = [
  'findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow',
  'create', 'createMany', 'update', 'updateMany',
  'delete', 'deleteMany', 'upsert', 'count', 'aggregate', 'groupBy',
]

function createMockModel() {
  const model = {}
  for (const method of modelMethods) {
    model[method] = jest.fn().mockResolvedValue(null)
  }
  return model
}

// Modelos usados en los tests (agregar mas segun necesidad)
const models = [
  'admin', 'socio', 'rol', 'permiso', 'permisoRol',
  'tenant', 'tenantUsuario', 'tenantConfiguracion',
  'configuracion', 'comanda', 'itemComanda', 'productoBuffet',
  'mesa', 'caja', 'movimientoCaja', 'pago', 'cargo',
  'cuota', 'inscripcion', 'grupoFamiliar',
  'comercio', 'entrada', 'evento', 'accesoLog',
  'rubro', 'menuItem', 'menuItemRol', 'cajaRol',
  'importacionCobranza',
]

export function createMockPrisma() {
  const mock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(async (fn) => {
      if (typeof fn === 'function') {
        return fn(mock)
      }
      return Promise.all(fn)
    }),
    $extends: jest.fn().mockReturnThis(),
  }

  for (const model of models) {
    mock[model] = createMockModel()
  }

  return mock
}

/**
 * Crea un mock de tenantPrisma (req.db) que funciona igual
 * pero es una instancia separada para verificar aislamiento.
 */
export function createMockTenantDb() {
  return createMockPrisma()
}
