/**
 * Tests de Control de Accesos
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import { app, mockPrisma, createTenantPrisma, resetMocks } from './helpers/setup.js'
import { TEST_TENANT } from './helpers/auth.js'

// Mock del tenant db que se usara en accesos
const mockTenantDb = {
  socio: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  accesoLog: {
    create: jest.fn(),
  },
  habilitacion: {
    findFirst: jest.fn(),
  },
}

describe('POST /api/accesos/validar', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
    // Setup tenant para accesos
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
    createTenantPrisma.mockReturnValue(mockTenantDb)
  })

  it('debe rechazar sin datos requeridos', async () => {
    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({})

    expect(res.status).toBe(400)
  })

  it('debe rechazar sin tipoLectura', async () => {
    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({ valorLeido: 'abc123' })

    expect(res.status).toBe(400)
  })

  it('debe rechazar sin valorLeido', async () => {
    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({ tipoLectura: 'QR' })

    expect(res.status).toBe(400)
  })

  it('debe buscar socio por QR (tokenPortal)', async () => {
    const socioActivo = {
      id: 1,
      nroSocio: '001',
      apellidoNombre: 'Perez Juan',
      documento: '12345678',
      estado: 'ACTIVO',
      rfidUid: null,
      tokenPortal: 'token-qr-123',
    }
    mockTenantDb.socio.findUnique.mockResolvedValue(socioActivo)

    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({ tipoLectura: 'QR', valorLeido: 'token-qr-123' })

    expect(res.status).toBe(200)
    expect(mockTenantDb.socio.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenPortal: 'token-qr-123' },
      })
    )
  })

  it('debe buscar socio por DNI', async () => {
    const socioActivo = {
      id: 1,
      nroSocio: '001',
      apellidoNombre: 'Perez Juan',
      documento: '12345678',
      estado: 'ACTIVO',
    }
    mockTenantDb.socio.findFirst.mockResolvedValue(socioActivo)

    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({ tipoLectura: 'DNI', valorLeido: '12345678' })

    expect(res.status).toBe(200)
    expect(mockTenantDb.socio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documento: '12345678' },
      })
    )
  })

  it('debe devolver no permitido si socio no encontrado por QR', async () => {
    mockTenantDb.socio.findUnique.mockResolvedValue(null)
    // Tambien mockear entrada (busqueda secundaria en QR)
    mockPrisma.entrada.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .send({ tipoLectura: 'QR', valorLeido: 'token-inexistente' })

    expect(res.status).toBe(200)
    expect(res.body.permitido).toBe(false)
  })
})
