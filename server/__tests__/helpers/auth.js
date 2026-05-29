/**
 * Helpers de autenticacion para tests.
 * Genera tokens JWT validos para simular usuarios autenticados.
 */
import 'dotenv/config'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'rojoplus-secret'

export function generateTestToken(admin = {}) {
  const payload = {
    id: admin.id || 1,
    email: admin.email || 'test@clubix.com',
    // El JWT post multi-tenant debe llevar tenantId (authAdmin lo compara con el
    // tenant del request) y el flag de super-admin.
    tenantId: admin.tenantId ?? 1,
    esSuperAdmin: admin.esSuperAdmin ?? false,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

export function generateExpiredToken(admin = {}) {
  const payload = {
    id: admin.id || 1,
    email: admin.email || 'test@clubix.com',
    tenantId: admin.tenantId ?? 1,
    esSuperAdmin: admin.esSuperAdmin ?? false,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' })
}

export const TEST_ADMIN = {
  id: 1,
  email: 'admin@test.com',
  nombre: 'Admin',
  apellido: 'Test',
  activo: true,
  rolId: 1,
  passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12', // mock
}

export const TEST_TENANT = {
  id: 1,
  nombre: 'Club Test',
  subdomain: 'clubtest',
  activo: true,
  estado: 'ACTIVE',
  plan: 'PRO',
}

export const TEST_TENANT_2 = {
  id: 2,
  nombre: 'Club Otro',
  subdomain: 'clubotro',
  activo: true,
  estado: 'ACTIVE',
  plan: 'BASIC',
}
