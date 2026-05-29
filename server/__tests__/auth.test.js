/**
 * Tests de autenticacion: login, JWT, permisos
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app, mockPrisma, resetMocks } from './helpers/setup.js'
import { generateTestToken, generateExpiredToken, TEST_ADMIN, TEST_TENANT } from './helpers/auth.js'

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('debe devolver tempToken y tenants con credenciales validas (login paso 1)', async () => {
    const passwordHash = await bcrypt.hash('test123', 10)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      passwordHash,
      rol: { id: 1, codigo: 'ADMIN', nombre: 'Admin', esSuperAdmin: false },
    })
    mockPrisma.admin.update.mockResolvedValue({})
    // Login es en 2 pasos: paso 1 devuelve tempToken + la lista de tenants
    // accesibles. El token real sale de /api/admin/select-tenant.
    mockPrisma.tenantUsuario.findMany.mockResolvedValue([
      {
        rol: 'ADMIN',
        activo: true,
        tenant: { id: 1, slug: 'clubtest', subdomain: 'clubtest', nombre: 'Club Test', logoUrl: null, activo: true },
      },
    ])

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'test123' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.tempToken).toBeDefined()
    expect(res.body.data.admin.email).toBe('admin@test.com')
    expect(Array.isArray(res.body.data.tenants)).toBe(true)
    expect(res.body.data.tenants.length).toBeGreaterThan(0)
  })

  it('debe rechazar sin email o password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('debe rechazar credenciales invalidas (usuario no existe)', async () => {
    mockPrisma.admin.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'noexiste@test.com', password: 'test123' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID')
  })

  it('debe rechazar password incorrecto', async () => {
    const passwordHash = await bcrypt.hash('correcta', 10)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      passwordHash,
      rol: { esSuperAdmin: false },
    })

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'incorrecta' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID')
  })

  it('debe rechazar usuario inactivo', async () => {
    const passwordHash = await bcrypt.hash('test123', 10)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      activo: false,
      passwordHash,
    })

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'test123' })

    expect(res.status).toBe(401)
  })
})

describe('JWT Authentication middleware', () => {
  beforeEach(() => {
    resetMocks()
    // mis-permisos pasa por extractTenant: hay que resolver el tenant para que el
    // flujo llegue a authAdmin (sino devolvería 400 TENANT_REQUIRED).
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
  })

  it('debe rechazar request sin token', async () => {
    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).toBe(401)
  })

  it('debe rechazar token expirado', async () => {
    const token = generateExpiredToken()

    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).toBe(401)
  })

  it('debe rechazar token invalido', async () => {
    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', 'Bearer token-falso-12345')
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).toBe(401)
  })

  it('debe aceptar token valido', async () => {
    const token = generateTestToken(TEST_ADMIN)

    // Mock para la ruta mis-permisos (necesita admin con rol)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      rol: {
        id: 1,
        nombre: 'Admin',
        esSuperAdmin: false,
        permisos: [{ permiso: { codigo: 'SOCIOS_LISTAR' } }],
      },
    })

    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', 'clubtest')

    expect(res.status).not.toBe(401)
  })
})

describe('Health check', () => {
  it('GET /api/health debe responder ok', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('ok')
  })
})
