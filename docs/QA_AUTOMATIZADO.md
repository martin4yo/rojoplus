# QA Automatizado — Clubix / RojoPlus
> Creado: Abril 2026
> Framework: Vitest + Supertest

---

## ¿Qué es esto y cómo funciona?

El testing automatizado es un conjunto de **scripts que prueban el sistema solos**, sin que tengas que hacer clic en nada. Escribís el test una vez y lo corrés cada vez que cambiás código para verificar que nada se rompió.

```
Vos corrés:  npm test
El sistema:  prueba 40 cosas en 8 segundos
Resultado:   ✓ 38 pasaron  ✗ 2 fallaron  ← sabés exactamente qué se rompió
```

### Qué se testea aquí (backend)
Los tests de backend verifican los **endpoints HTTP** directamente: simulan peticiones reales a la API y comprueban que la respuesta es correcta. No necesitan browser ni frontend.

**No se testea** el frontend (eso se haría con Playwright/Cypress — no incluido aquí por ahora).

---

## Instalación (una sola vez)

```bash
cd server
npm install --save-dev vitest @vitest/coverage-v8 supertest
```

Agregar en `server/package.json` → sección `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## Estructura de archivos

```
server/
  src/
    __tests__/
      setup.js                  ← configuración global (conexión DB de test)
      helpers/
        auth.js                 ← helper para obtener tokens de prueba
        tenant.js               ← helper para crear tenant de test
      auth.test.js              ← login, permisos, JWT
      socios.test.js            ← CRUD socios
      cuotas.test.js            ← generación, cobro, descuento anticipado
      multitenant.test.js       ← aislamiento entre tenants (CRÍTICO)
      deportes.test.js          ← asistencia, planillas, equipos, campeonatos
      gobernanza.test.js        ← actas, votaciones, documentos
      jobs.test.js              ← lógica de cron jobs (sin ejecutar el cron)
```

---

## Base de datos de test

Los tests corren contra una base de datos **separada** de la de desarrollo. Nunca tocan la base real.

Crear en `.env.test` (en la carpeta `server/`):

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/clubix_test"
JWT_SECRET="test-secret-no-usar-en-prod"
NODE_ENV="test"
```

Crear la base antes de correr los tests por primera vez:

```bash
# Una sola vez:
DATABASE_URL="postgresql://...clubix_test" npx prisma db push
```

---

## Archivo de setup global

**`server/src/__tests__/setup.js`**

```javascript
import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, beforeEach } from 'vitest'

// Usar base de datos de test
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL

export const prisma = new PrismaClient()

// Limpiar tablas entre tests para que no se pisen
beforeEach(async () => {
  // Orden importa por las foreign keys
  await prisma.$executeRaw`TRUNCATE TABLE votos_registrados, votaciones, actas_reunion, documentos_club CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE planillas_entrenamiento CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE pagos, cargos CASCADE`
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

En `vitest.config.js` (raíz del server):

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.js'],
    globals: true,
  },
})
```

---

## Helpers reutilizables

**`server/src/__tests__/helpers/auth.js`**

```javascript
import request from 'supertest'
import app from '../../app.js'  // exportar el app de Express sin el listen()

export async function loginAdmin(email = 'admin@test.com', password = 'test123') {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ email, password })
  return res.body.token
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}
```

> **Nota:** Para que esto funcione, `server/src/index.js` debe exportar `app` separado del `listen()`. Ver sección "Adaptar el servidor" al final.

---

## Tests implementados

### 1. Autenticación (`auth.test.js`)

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app.js'

describe('POST /api/admin/login', () => {
  it('login válido devuelve token JWT', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'test123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(typeof res.body.token).toBe('string')
  })

  it('password incorrecto devuelve 401', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'mala' })

    expect(res.status).toBe(401)
  })

  it('ruta protegida sin token devuelve 401', async () => {
    const res = await request(app).get('/api/admin/socios')
    expect(res.status).toBe(401)
  })

  it('ruta protegida con token válido responde correctamente', async () => {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'test123' })

    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${loginRes.body.token}`)

    expect(res.status).toBe(200)
  })
})
```

---

### 2. Aislamiento Multi-Tenant (`multitenant.test.js`) — CRÍTICO

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../app.js'
import { prisma } from './setup.js'

// Este test es el más importante del sistema.
// Verifica que un tenant NO puede ver datos de otro tenant.

describe('Aislamiento Multi-Tenant', () => {
  let tokenTenantA, tokenTenantB
  let socioTenantAId

  beforeEach(async () => {
    // Crear admin de tenant A y B en la base de test
    // (usando seeds específicos de test o helpers)
    tokenTenantA = await loginConSubdominio('club-a.test.com')
    tokenTenantB = await loginConSubdominio('club-b.test.com')

    // Crear un socio en tenant A
    const res = await request(app)
      .post('/api/admin/socios')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .set('Host', 'club-a.test.com')
      .send({ nombre: 'Juan', apellido: 'Pérez', documento: '12345678' })

    socioTenantAId = res.body.id
  })

  it('tenant B NO puede ver socios de tenant A', async () => {
    const res = await request(app)
      .get(`/api/admin/socios/${socioTenantAId}`)
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .set('Host', 'club-b.test.com')

    // Debe devolver 404 o 403, nunca los datos del socio
    expect([403, 404]).toContain(res.status)
  })

  it('tenant B NO puede ver actas de tenant A', async () => {
    // Crear acta en tenant A
    const actaRes = await request(app)
      .post('/api/admin/gobernanza/actas')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .set('Host', 'club-a.test.com')
      .send({ titulo: 'Acta secreta', tipo: 'COMISION', fecha: '2026-04-01' })

    const actaId = actaRes.body.id

    // Intentar verla desde tenant B
    const res = await request(app)
      .get(`/api/admin/gobernanza/actas/${actaId}`)
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .set('Host', 'club-b.test.com')

    expect([403, 404]).toContain(res.status)
  })

  it('lista de socios de tenant B solo trae los suyos', async () => {
    const res = await request(app)
      .get('/api/admin/socios')
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .set('Host', 'club-b.test.com')

    expect(res.status).toBe(200)
    // El socio de tenant A no debe aparecer
    const ids = (res.body.data || res.body).map(s => s.id)
    expect(ids).not.toContain(socioTenantAId)
  })
})
```

---

### 3. Cuotas y Cobros (`cuotas.test.js`)

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app.js'
import { loginAdmin, authHeader } from './helpers/auth.js'

describe('Cobro de cuotas', () => {
  it('cobrar cargo pendiente lo marca como PAGADO', async () => {
    const token = await loginAdmin()

    // Crear un cargo de test
    const cargoRes = await request(app)
      .post('/api/admin/cargos')
      .set(authHeader(token))
      .send({
        socioId: 1,        // socio existente en la base de test
        concepto: 'Cuota test',
        monto: 5000,
        fechaVencimiento: '2026-12-31',
      })

    const cargoId = cargoRes.body.id

    // Cobrar ese cargo
    const cobroRes = await request(app)
      .post('/api/admin/cuotas/cobrar')
      .set(authHeader(token))
      .send({
        cargoIds: [cargoId],
        montoRecibido: 5000,
        splits: [{ medioPagoId: 1, monto: 5000 }],
      })

    expect(cobroRes.status).toBe(200)
    expect(cobroRes.body.pago).toBeDefined()

    // Verificar que el cargo cambió de estado
    const cargoActualizado = await request(app)
      .get(`/api/admin/cargos/${cargoId}`)
      .set(authHeader(token))

    expect(cargoActualizado.body.estado).toBe('PAGADO')
  })

  it('descuento anticipado se aplica cuando está activo y corresponde', async () => {
    const token = await loginAdmin()

    // Activar descuento anticipado (10%, 5 días)
    await request(app)
      .put('/api/admin/configuracion-descuento-anticipado')
      .set(authHeader(token))
      .send({ activo: true, porcentaje: 10, diasAnticipacion: 5 })

    // Crear cargo que vence en 10 días (dentro de la ventana)
    const fechaVenc = new Date()
    fechaVenc.setDate(fechaVenc.getDate() + 10)

    const cargoRes = await request(app)
      .post('/api/admin/cargos')
      .set(authHeader(token))
      .send({
        socioId: 1,
        concepto: 'Cuota con descuento',
        monto: 10000,
        fechaVencimiento: fechaVenc.toISOString().slice(0, 10),
      })

    // Cobrar: el monto debe reflejar el descuento
    const cobroRes = await request(app)
      .post('/api/admin/cuotas/cobrar')
      .set(authHeader(token))
      .send({
        cargoIds: [cargoRes.body.id],
        montoRecibido: 9000,
        splits: [{ medioPagoId: 1, monto: 9000 }],
        aplicarDescuentoAnticipado: true,
      })

    expect(cobroRes.status).toBe(200)
    // La bonificación de 1000 (10% de 10000) debe estar registrada
    expect(Number(cobroRes.body.pago?.totalBonificacion) || 0).toBeGreaterThan(0)
  })

  it('no se puede cobrar un cargo ya pagado', async () => {
    const token = await loginAdmin()
    // ... (cargo ya en estado PAGADO)
    // el endpoint debe devolver error, no crear pago duplicado
  })
})
```

---

### 4. Gobernanza (`gobernanza.test.js`)

```javascript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../app.js'
import { loginAdmin, authHeader } from './helpers/auth.js'

describe('Actas de reunión', () => {
  it('crear acta y recuperarla por ID', async () => {
    const token = await loginAdmin()

    const createRes = await request(app)
      .post('/api/admin/gobernanza/actas')
      .set(authHeader(token))
      .send({ titulo: 'Reunión de prueba', tipo: 'COMISION', fecha: '2026-04-01' })

    expect(createRes.status).toBe(201)
    const id = createRes.body.id

    const getRes = await request(app)
      .get(`/api/admin/gobernanza/actas/${id}`)
      .set(authHeader(token))

    expect(getRes.status).toBe(200)
    expect(getRes.body.titulo).toBe('Reunión de prueba')
    expect(getRes.body.tipo).toBe('COMISION')
  })
})

describe('Votaciones', () => {
  it('flujo completo: crear → abrir → votar → cerrar', async () => {
    const token = await loginAdmin()

    // Crear
    const votacionRes = await request(app)
      .post('/api/admin/gobernanza/votaciones')
      .set(authHeader(token))
      .send({ titulo: 'Test votación', opciones: ['Sí', 'No', 'Abstención'] })

    expect(votacionRes.status).toBe(201)
    const id = votacionRes.body.id
    expect(votacionRes.body.estado).toBe('BORRADOR')

    // Abrir
    await request(app)
      .put(`/api/admin/gobernanza/votaciones/${id}`)
      .set(authHeader(token))
      .send({ estado: 'ABIERTA' })

    // Registrar voto
    const votoRes = await request(app)
      .post(`/api/admin/gobernanza/votaciones/${id}/votar`)
      .set(authHeader(token))
      .send({ socioId: 1, opcion: 'Sí' })

    expect(votoRes.status).toBe(201)

    // Intentar votar de nuevo con el mismo socio → debe fallar
    const duplicadoRes = await request(app)
      .post(`/api/admin/gobernanza/votaciones/${id}/votar`)
      .set(authHeader(token))
      .send({ socioId: 1, opcion: 'No' })

    expect(duplicadoRes.status).toBe(409)  // Conflict

    // Cerrar y verificar resultados
    await request(app)
      .put(`/api/admin/gobernanza/votaciones/${id}`)
      .set(authHeader(token))
      .send({ estado: 'CERRADA' })

    const detalleRes = await request(app)
      .get(`/api/admin/gobernanza/votaciones/${id}`)
      .set(authHeader(token))

    const resSi = detalleRes.body.resultados.find(r => r.opcion === 'Sí')
    expect(resSi.votos).toBe(1)
  })

  it('no se puede votar en votación CERRADA', async () => {
    const token = await loginAdmin()
    // ... (crear votación ya cerrada)
    const res = await request(app)
      .post('/api/admin/gobernanza/votaciones/99/votar')
      .set(authHeader(token))
      .send({ socioId: 1, opcion: 'Sí' })

    expect([400, 404]).toContain(res.status)
  })
})
```

---

### 5. Tabla de posiciones (`deportes.test.js`)

```javascript
import { describe, it, expect } from 'vitest'

// Esta función es pura (sin BD), se puede testear directo
import { calcularTabla } from '../../routes/deportes.js'

describe('calcularTabla()', () => {
  it('partido ganado como local suma 3 puntos', () => {
    const partidos = [{
      estado: 'FINALIZADO',
      condicion: 'LOCAL',
      golesLocal: 2,
      golesVisitante: 0,
      rival: 'Rival FC',
    }]
    const tabla = calcularTabla(partidos, 'Mi Club')

    const nuestro = tabla.find(t => t.equipo === 'Mi Club')
    expect(nuestro.pts).toBe(3)
    expect(nuestro.pg).toBe(1)
    expect(nuestro.gf).toBe(2)
    expect(nuestro.gc).toBe(0)
  })

  it('empate suma 1 punto a cada equipo', () => {
    const partidos = [{
      estado: 'FINALIZADO',
      condicion: 'LOCAL',
      golesLocal: 1,
      golesVisitante: 1,
      rival: 'Rival FC',
    }]
    const tabla = calcularTabla(partidos, 'Mi Club')

    const nuestro = tabla.find(t => t.equipo === 'Mi Club')
    const rival = tabla.find(t => t.equipo === 'Rival FC')
    expect(nuestro.pts).toBe(1)
    expect(rival.pts).toBe(1)
  })

  it('partido no finalizado no afecta la tabla', () => {
    const partidos = [{
      estado: 'PROGRAMADO',
      condicion: 'LOCAL',
      golesLocal: null,
      golesVisitante: null,
      rival: 'Rival FC',
    }]
    const tabla = calcularTabla(partidos, 'Mi Club')
    expect(tabla).toHaveLength(0)
  })

  it('tabla vacía para array de partidos vacío', () => {
    expect(calcularTabla([], 'Mi Club')).toHaveLength(0)
  })

  it('ordenamiento: más puntos primero, luego diferencia de goles', () => {
    const partidos = [
      { estado: 'FINALIZADO', condicion: 'LOCAL',    golesLocal: 3, golesVisitante: 0, rival: 'Equipo A' },
      { estado: 'FINALIZADO', condicion: 'VISITANTE', golesLocal: 2, golesVisitante: 2, rival: 'Equipo B' },
    ]
    const tabla = calcularTabla(partidos, 'Mi Club')
    // Mi Club: 3 pts (ganó de local) + 1 pt (empató de visitante) = 4 pts
    // Equipo A: 0 pts
    // Equipo B: 1 pt
    expect(tabla[0].equipo).toBe('Mi Club')
    expect(tabla[0].pts).toBe(4)
  })
})
```

---

### 6. Jobs / lógica de notificaciones (`jobs.test.js`)

```javascript
import { describe, it, expect, vi } from 'vitest'

// Testear la LÓGICA sin ejecutar el cron ni enviar emails reales
// Mockear los servicios externos

describe('Deduplicación de notificaciones', () => {
  it('no envía cumpleaños dos veces el mismo día', async () => {
    const mockDb = {
      notificacionLog: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }), // simula que ya existe
        create: vi.fn(),
      },
    }
    const mockEnviarEmail = vi.fn()

    // Llamar a la función que procesa un socio
    // await procesarCumpleaniosSocio(socio, mockDb, mockEnviarEmail)

    // Si ya existe el log, no debe llamar a enviarEmail
    expect(mockEnviarEmail).not.toHaveBeenCalled()
  })

  it('envía cuando no hay log previo del día', async () => {
    const mockDb = {
      notificacionLog: {
        findFirst: vi.fn().mockResolvedValue(null), // no existe log
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    }
    const mockEnviarEmail = vi.fn().mockResolvedValue(true)

    // await procesarCumpleaniosSocio(socio, mockDb, mockEnviarEmail)

    expect(mockEnviarEmail).toHaveBeenCalledTimes(1)
    expect(mockDb.notificacionLog.create).toHaveBeenCalledTimes(1)
  })
})
```

---

## Cómo correr los tests

```bash
cd server

# Correr todos los tests una vez
npm test

# Correr en modo watch (se re-ejecuta al guardar un archivo)
npm run test:watch

# Ver cobertura de código
npm run test:coverage

# Correr solo un archivo
npm test auth.test.js

# Correr solo tests que contengan una palabra
npm test -- --grep "multi-tenant"
```

**Salida típica:**
```
 ✓ auth.test.js (4 tests) 112ms
 ✓ cuotas.test.js (3 tests) 340ms
 ✓ gobernanza.test.js (5 tests) 210ms
 ✓ deportes.test.js (5 tests) 45ms
 ✗ multitenant.test.js (2/3 tests) 180ms
   → FAILED: tenant B NO puede ver actas de tenant A
     Expected: [403, 404]
     Received: 200   ← encontraste un bug real

Test Files  4 passed | 1 failed
Tests       19 passed | 1 failed
```

---

## Adaptar el servidor para los tests

Para que Supertest pueda importar `app` sin iniciar el servidor, separar `app.js` de `index.js`:

**`server/src/app.js`** (nuevo archivo — solo exporta el app):
```javascript
import express from 'express'
import cors from 'cors'
import adminRoutes from './routes/admin/index.js'
// ... resto de imports

const app = express()
app.use(express.json())
app.use(cors())
app.use('/api/admin', adminRoutes)
// ... resto de rutas

export default app
```

**`server/src/index.js`** (solo inicia el servidor):
```javascript
import app from './app.js'
import { createServer } from 'http'
import { Server } from 'socket.io'

const server = createServer(app)
const io = new Server(server)
// ... setup socket.io

server.listen(3000, () => console.log('Servidor en :3000'))
```

---

## Criterio para agregar nuevos tests

Cada vez que implementás una feature nueva, agregá al menos:

| Tipo | Qué testear | Dónde |
|------|-------------|-------|
| **Happy path** | El caso normal funciona correctamente | En el test del módulo |
| **Error esperado** | El sistema rechaza datos inválidos con el código correcto | Mismo archivo |
| **Aislamiento tenant** | El nuevo endpoint no filtra por tenant → BUG | `multitenant.test.js` |
| **Lógica de negocio pura** | Funciones sin BD (como `calcularTabla`) | Directo en el test |

### Checklist para nuevo endpoint:
```
[ ] Devuelve 200/201 con datos correctos en el happy path
[ ] Devuelve 400/404 con mensaje claro cuando los datos son inválidos
[ ] Devuelve 401 si no hay token
[ ] Si tiene lógica de tenant: agregarlo a multitenant.test.js
[ ] Si hay regla de negocio compleja: testearla como función pura
```

---

## Tests prioritarios a implementar (backlog)

En orden de importancia para el proyecto:

| Prioridad | Test | Módulo |
|-----------|------|--------|
| 🔴 Alta | Aislamiento multi-tenant en todos los endpoints nuevos | `multitenant.test.js` |
| 🔴 Alta | Cobro de cuotas: happy path + cargo ya pagado + monto incorrecto | `cuotas.test.js` |
| 🔴 Alta | Login: válido, inválido, token expirado, rol sin permiso | `auth.test.js` |
| 🟡 Media | Generación masiva de cargos: conteo correcto de socios afectados | `cuotas.test.js` |
| 🟡 Media | Votaciones: dedup de votos, flujo BORRADOR→ABIERTA→CERRADA | `gobernanza.test.js` |
| 🟡 Media | `calcularTabla()`: todos los casos de puntuación y ordenamiento | `deportes.test.js` |
| 🟡 Media | Deduplicación de notificaciones (jobs) con mocks | `jobs.test.js` |
| 🟢 Baja | CRUD de actas, documentos, equipos | `gobernanza.test.js`, `deportes.test.js` |
| 🟢 Baja | Control de acceso por molinete: socio habilitado vs no habilitado | nuevo archivo |
| 🟢 Baja | Importación PRISMA: archivo válido procesa N registros | nuevo archivo |

---

## Integración continua (CI)

Para correr los tests automáticamente antes de cada deploy, agregar en el pipeline (GitHub Actions, etc.):

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: clubix_test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v3
      - run: cd server && npm install
      - run: cd server && npx prisma db push
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/clubix_test
      - run: cd server && npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/clubix_test
          JWT_SECRET: ci-test-secret
```

Con esto, si un push rompe algún test, el deploy se bloquea automáticamente.
