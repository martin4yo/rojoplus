/**
 * Tests de autenticacion: login, JWT, permisos
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app, mockPrisma, resetMocks } from './helpers/setup.js'
import { generateTestToken, generateExpiredToken, TEST_ADMIN } from './helpers/auth.js'

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('debe devolver token con credenciales validas', async () => {
    const passwordHash = await bcrypt.hash('test123', 10)
    mockPrisma.admin.findUnique.mockResolvedValue({
      ...TEST_ADMIN,
      passwordHash,
      rol: { esSuperAdmin: false },
    })
    mockPrisma.admin.update.mockResolvedValue({})

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'test123' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.admin.email).toBe('admin@test.com')
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
  })

  it('debe rechazar request sin token', async () => {
    const res = await request(app)
      .get('/api/admin/mis-permisos')

    expect(res.status).toBe(401)
  })

  it('debe rechazar token expirado', async () => {
    const token = generateExpiredToken()

    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
  })

  it('debe rechazar token invalido', async () => {
    const res = await request(app)
      .get('/api/admin/mis-permisos')
      .set('Authorization', 'Bearer token-falso-12345')

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
