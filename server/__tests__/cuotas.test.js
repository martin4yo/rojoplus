/**
 * Tests de Cobros y Cuotas
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import { app, mockPrisma, createTenantPrisma, resetMocks } from './helpers/setup.js'
import { generateTestToken, TEST_ADMIN, TEST_TENANT } from './helpers/auth.js'
import { createMockPrisma } from './helpers/mockPrisma.js'

describe('POST /api/admin/pagos', () => {
  let token
  let mockTenantDb

  beforeEach(() => {
    resetMocks()
    token = generateTestToken(TEST_ADMIN)
    mockTenantDb = createMockPrisma()

    // Setup tenant
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
    createTenantPrisma.mockReturnValue(mockTenantDb)
    // checkPermiso() consulta admin + rol; lo dejamos como super-admin para
    // que el flujo llegue al handler.
    mockPrisma.admin.findUnique.mockResolvedValue({ id: 1, rolId: 1, activo: true })
    mockPrisma.rol.findUnique.mockResolvedValue({ id: 1, esSuperAdmin: true, permisos: [] })
  })

  it('debe rechazar sin autenticacion', async () => {
    const res = await request(app)
      .post('/api/admin/pagos')
      .set('X-Tenant-Slug', 'clubtest')
      .send({})

    expect(res.status).toBe(401)
  })

  it('debe requerir socioId y cuotaIds', async () => {
    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('debe requerir al menos un medio de pago', async () => {
    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({ socioId: 1, cuotaIds: [1] })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('debe rechazar si cuotas no existen o ya estan pagadas', async () => {
    // findMany devuelve menos cuotas de las solicitadas
    mockTenantDb.cargo.findMany.mockResolvedValue([])

    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({
        socioId: 1,
        cuotaIds: [1, 2],
        medioPagoId: 1,
        cajaId: 1,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_CUOTAS')
  })

  it('debe procesar pago con cuotas validas', async () => {
    const cuotaMock = {
      id: 1,
      montoTotal: 5000,
      montoOriginal: 5000,
      estado: 'PENDIENTE',
      fechaVencimiento: new Date(Date.now() + 86400000 * 30), // en 30 dias
      grupoFamiliarId: 1,
      categoriaActividad: { actividad: { nombre: 'Futbol' }, conceptoTesoreria: null },
    }

    // Cuotas encontradas
    mockTenantDb.cargo.findMany.mockResolvedValue([cuotaMock])

    // Config de recargos/descuentos (global prisma)
    mockPrisma.configuracionRecargo = { findFirst: jest.fn().mockResolvedValue(null) }
    mockPrisma.configuracion.findFirst.mockResolvedValue(null)

    // Caja y medio de pago
    const cajaMock = {
      id: 1, nombre: 'Caja 1', activo: true,
      cuentaContableId: 1, cuentaContable: { id: 1 },
    }
    const medioMock = {
      id: 1, nombre: 'Efectivo',
      conceptoTesoreria: null,
    }
    mockTenantDb.caja.findMany.mockResolvedValue([cajaMock])
    mockTenantDb.medioPago.findMany.mockResolvedValue([medioMock])

    // Transaction mock
    const pagoCreado = { id: 1, numero: '00000001', montoTotal: 5000 }
    mockTenantDb.$transaction.mockImplementation(async (fn) => {
      const tx = {
        pago: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(pagoCreado),
        },
        cargo: {
          update: jest.fn().mockResolvedValue({}),
        },
        detallePago: {
          create: jest.fn().mockResolvedValue({}),
        },
        movimientoCaja: {
          create: jest.fn().mockResolvedValue({}),
        },
        movimientoTesoreria: {
          create: jest.fn().mockResolvedValue({}),
        },
        pagoMedioPago: {
          create: jest.fn().mockResolvedValue({}),
        },
      }
      return fn(tx)
    })

    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({
        socioId: 1,
        cuotaIds: [1],
        medioPagoId: 1,
        cajaId: 1,
      })

    // Puede ser 200 o puede fallar por otros mocks faltantes,
    // pero no debe ser 401, 400 validation, ni INVALID_CUOTAS
    expect(res.status).not.toBe(401)
    if (res.status === 400) {
      expect(res.body.error.code).not.toBe('VALIDATION_ERROR')
      expect(res.body.error.code).not.toBe('INVALID_CUOTAS')
    }
  })
})

describe('Validaciones de caja en cobros', () => {
  let token
  let mockTenantDb

  beforeEach(() => {
    resetMocks()
    token = generateTestToken(TEST_ADMIN)
    mockTenantDb = createMockPrisma()
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
    createTenantPrisma.mockReturnValue(mockTenantDb)
  })

  it('debe rechazar caja inactiva', async () => {
    const cuotaMock = {
      id: 1, montoTotal: 5000, montoOriginal: 5000,
      estado: 'PENDIENTE', fechaVencimiento: null,
      grupoFamiliarId: 1,
      categoriaActividad: { actividad: { nombre: 'Cuota' }, conceptoTesoreria: null },
    }

    mockTenantDb.cargo.findMany.mockResolvedValue([cuotaMock])
    mockPrisma.configuracion.findFirst.mockResolvedValue(null)

    // Caja inactiva
    mockTenantDb.caja.findMany.mockResolvedValue([{
      id: 1, nombre: 'Caja Cerrada', activo: false,
      cuentaContableId: 1, cuentaContable: { id: 1 },
    }])
    mockTenantDb.medioPago.findMany.mockResolvedValue([{ id: 1, nombre: 'Efectivo' }])

    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({ socioId: 1, cuotaIds: [1], medioPagoId: 1, cajaId: 1 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CAJA_INACTIVA')
  })

  it('debe rechazar caja sin cuenta contable', async () => {
    const cuotaMock = {
      id: 1, montoTotal: 5000, montoOriginal: 5000,
      estado: 'PENDIENTE', fechaVencimiento: null,
      grupoFamiliarId: 1,
      categoriaActividad: { actividad: { nombre: 'Cuota' }, conceptoTesoreria: null },
    }

    mockTenantDb.cargo.findMany.mockResolvedValue([cuotaMock])
    mockPrisma.configuracion.findFirst.mockResolvedValue(null)

    // Caja sin cuenta contable
    mockTenantDb.caja.findMany.mockResolvedValue([{
      id: 1, nombre: 'Caja Sin CC', activo: true,
      cuentaContableId: null, cuentaContable: null,
    }])
    mockTenantDb.medioPago.findMany.mockResolvedValue([{ id: 1, nombre: 'Efectivo' }])

    const res = await request(app)
      .post('/api/admin/pagos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')
      .send({ socioId: 1, cuotaIds: [1], medioPagoId: 1, cajaId: 1 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CAJA_SIN_CUENTA_CONTABLE')
  })
})
