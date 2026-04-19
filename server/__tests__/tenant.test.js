/**
 * Tests de aislamiento multi-tenant
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import { app, mockPrisma, createTenantPrisma, tenantDbInstances, resetMocks } from './helpers/setup.js'
import { generateTestToken, TEST_ADMIN, TEST_TENANT, TEST_TENANT_2 } from './helpers/auth.js'

describe('Tenant extraction', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('debe extraer tenant del header X-Tenant-Slug', async () => {
    const token = generateTestToken(TEST_ADMIN)
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
    // Mock para la ruta admin que necesite tenant
    const tenantDb = { socio: { findMany: jest.fn().mockResolvedValue([]) } }
    createTenantPrisma.mockReturnValue(tenantDb)

    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    // No debe ser error de tenant
    expect(res.status).not.toBe(400)
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subdomain: 'clubtest' } })
    )
  })

  it('debe rechazar si no hay tenant y estamos en produccion', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const token = generateTestToken(TEST_ADMIN)

    // No devolver tenant para ningun lookup
    mockPrisma.tenant.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'clubix.com')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TENANT_REQUIRED')

    process.env.NODE_ENV = originalEnv
  })

  it('debe rechazar tenant suspendido', async () => {
    const token = generateTestToken(TEST_ADMIN)
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...TEST_TENANT,
      estado: 'SUSPENDED',
    })

    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('TENANT_SUSPENDED')
  })

  it('debe rechazar tenant inactivo', async () => {
    const token = generateTestToken(TEST_ADMIN)
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...TEST_TENANT,
      activo: false,
    })

    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('TENANT_NOT_FOUND')
  })
})

describe('Aislamiento multi-tenant', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('debe crear instancias de tenantPrisma separadas por tenant', async () => {
    const token = generateTestToken(TEST_ADMIN)

    // Request del tenant 1
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(TEST_TENANT)
    await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    // Request del tenant 2
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(TEST_TENANT_2)
    await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubotro')

    // Verificar que se llamo createTenantPrisma con IDs distintos
    const calls = createTenantPrisma.mock.calls
    const tenantIds = calls.map(c => c[0])
    expect(tenantIds).toContain(TEST_TENANT.id)
    expect(tenantIds).toContain(TEST_TENANT_2.id)
    expect(TEST_TENANT.id).not.toBe(TEST_TENANT_2.id)
  })

  it('rutas TENANT_FREE no deben requerir tenant', async () => {
    // Login no requiere tenant
    mockPrisma.admin.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'test@test.com', password: '123' })

    // Debe llegar al handler de login (401 por credenciales invalidas, NO 400 por tenant)
    expect(res.status).toBe(401)
  })

  it('mis-permisos no debe requerir tenant', async () => {
    const token = generateTestToken(TEST_ADMIN)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      rol: { id: 1, nombre: 'Admin', esSuperAdmin: false, permisos: [] },
    })

    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', `Bearer ${token}`)

    // No debe ser 400 TENANT_REQUIRED
    expect(res.status).not.toBe(400)
  })
})

describe('Rutas publicas con tenant opcional', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('rutas publicas deben funcionar sin tenant', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    mockPrisma.tenant.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/public/info')
      .set('Host', 'clubix.com')

    // No debe ser 400 TENANT_REQUIRED (puede ser 404 si la ruta no existe, pero no error de tenant)
    expect(res.body.code).not.toBe('TENANT_REQUIRED')

    process.env.NODE_ENV = originalEnv
  })
})
