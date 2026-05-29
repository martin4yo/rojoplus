/**
 * Tests de Control de Accesos
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import request from 'supertest'
import { app, mockPrisma, createTenantPrisma, resetMocks } from './helpers/setup.js'
import { createMockPrisma } from './helpers/mockPrisma.js'
import { TEST_TENANT } from './helpers/auth.js'

// /api/accesos/validar usa authDispositivoOrAdmin: si viene X-Tenant-Slug, valida
// como dispositivo (molinete-service) con un apiToken en Authorization Bearer.
const DEVICE_TOKEN = 'device-api-token-123'

describe('POST /api/accesos/validar', () => {
  let mockTenantDb

  beforeEach(() => {
    resetMocks()
    mockTenantDb = createMockPrisma()
    // Tenant + dispositivo válidos (autenticación de dispositivo)
    mockPrisma.tenant.findUnique.mockResolvedValue(TEST_TENANT)
    mockPrisma.dispositivoAcceso.findUnique.mockResolvedValue({ id: 1, tenantId: TEST_TENANT.id, activo: true })
    createTenantPrisma.mockReturnValue(mockTenantDb)
  })

  function validar(body) {
    return request(app)
      .post('/api/accesos/validar')
      .set('X-Tenant-Slug', 'clubtest')
      .set('Authorization', `Bearer ${DEVICE_TOKEN}`)
      .send(body)
  }

  it('debe rechazar sin datos requeridos', async () => {
    const res = await validar({})
    expect(res.status).toBe(400)
  })

  it('debe rechazar sin tipoLectura', async () => {
    const res = await validar({ valorLeido: 'abc123' })
    expect(res.status).toBe(400)
  })

  it('debe rechazar sin valorLeido', async () => {
    const res = await validar({ tipoLectura: 'QR' })
    expect(res.status).toBe(400)
  })

  it('debe buscar socio por QR (tokenPortal)', async () => {
    const socioActivo = {
      id: 1,
      nroSocio: '001',
      apellidoNombre: 'Perez Juan',
      documento: '12345678',
      rfidUid: null,
      tokenPortal: 'token-qr-123',
      estadoSocioRel: { permiteIngresoMolinete: true, nombre: 'ACTIVO' },
    }
    mockTenantDb.socio.findFirst.mockResolvedValue(socioActivo)

    const res = await validar({ tipoLectura: 'QR', valorLeido: 'token-qr-123' })

    expect(res.status).toBe(200)
    expect(mockTenantDb.socio.findFirst).toHaveBeenCalledWith(
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
      rfidUid: null,
      tokenPortal: null,
      estadoSocioRel: { permiteIngresoMolinete: true, nombre: 'ACTIVO' },
    }
    mockTenantDb.socio.findFirst.mockResolvedValue(socioActivo)

    const res = await validar({ tipoLectura: 'DNI', valorLeido: '12345678' })

    expect(res.status).toBe(200)
    expect(mockTenantDb.socio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documento: '12345678' },
      })
    )
  })

  it('debe devolver no permitido si socio no encontrado por QR', async () => {
    mockTenantDb.socio.findFirst.mockResolvedValue(null)
    mockTenantDb.entrada.findUnique.mockResolvedValue(null)

    const res = await validar({ tipoLectura: 'QR', valorLeido: 'token-inexistente' })

    expect(res.status).toBe(200)
    expect(res.body.data.permitido).toBe(false)
  })
})
