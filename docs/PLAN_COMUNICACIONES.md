# Plan: Módulo de Comunicaciones Masivas

## Resumen

Módulo para enviar emails a grupos de socios filtrados por condiciones (edad, actividad, estado, zona, etc.).

**Enfoque:** UI completa en RojoPlus + **Brevo** (ex-Sendinblue) para envío.

| Responsabilidad | Quién lo maneja |
|-----------------|-----------------|
| Envío de emails (300/día gratis) | Brevo |
| Deliverability y reputación | Brevo |
| Bounces y unsubscribes | Brevo |
| Tracking opens/clicks | Brevo |
| Constructor de filtros | RojoPlus |
| Gestión de campañas | RojoPlus |
| Cola de envío diario | RojoPlus |
| Historial y estadísticas | RojoPlus |

---

## Progreso General

| Fase | Estado | Tareas |
|------|--------|--------|
| 1. Configuración Brevo | ⬜ Pendiente | 4 |
| 2. Base de Datos | ⬜ Pendiente | 6 |
| 3. Backend Servicios | ⬜ Pendiente | 12 |
| 4. Backend Rutas | ⬜ Pendiente | 8 |
| 5. Frontend Lista | ⬜ Pendiente | 5 |
| 6. Frontend Filtros | ⬜ Pendiente | 6 |
| 7. Frontend Wizard | ⬜ Pendiente | 8 |
| 8. Cron Job | ⬜ Pendiente | 4 |
| 9. Frontend Detalle | ⬜ Pendiente | 5 |
| 10. Testing | ⬜ Pendiente | 4 |

---

## FASE 1: Configuración Brevo

### Tareas:
- [ ] **1.1** Crear cuenta en https://www.brevo.com (free)
- [ ] **1.2** Obtener API Key desde Settings > API Keys
- [ ] **1.3** Agregar `BREVO_API_KEY=xkeysib-xxxxx` a `.env` del server
- [ ] **1.4** Instalar SDK: `cd server && npm install @getbrevo/brevo`

### Verificación:
```bash
# Probar que la API key funciona (desde Node REPL)
node -e "const brevo = require('@getbrevo/brevo'); console.log('Brevo SDK loaded')"
```

---

## FASE 2: Base de Datos

**Archivo:** `server/prisma/schema.prisma`

### Tareas:
- [ ] **2.1** Agregar modelo `Campana`
- [ ] **2.2** Agregar modelo `CampanaDestinatario`
- [ ] **2.3** Agregar modelo `FiltroGuardado`
- [ ] **2.4** Agregar modelo `ConfiguracionEnvio`
- [ ] **2.5** Agregar relación `campanaDestinatarios` al modelo `Socio`
- [ ] **2.6** Ejecutar migración: `npx prisma db push && npx prisma generate`

### Código - Modelo Campana:
```prisma
model Campana {
  id                Int       @id @default(autoincrement())
  codigo            String    @unique @default(cuid())
  nombre            String
  tipo              String    @default("EMAIL") // EMAIL
  estado            String    @default("BORRADOR") // BORRADOR, PROGRAMADA, EN_PROCESO, COMPLETADA, PAUSADA, CANCELADA

  asunto            String?
  contenidoHtml     String?   @db.Text
  contenidoTexto    String?   @db.Text

  filtroJson        String?   @db.Text @map("filtro_json")
  programadaPara    DateTime? @map("programada_para")
  iniciadaEn        DateTime? @map("iniciada_en")
  finalizadaEn      DateTime? @map("finalizada_en")

  // Estadísticas
  totalDestinatarios Int      @default(0) @map("total_destinatarios")
  enviados          Int       @default(0)
  entregados        Int       @default(0)
  fallidos          Int       @default(0)
  abiertos          Int       @default(0)
  rebotados         Int       @default(0)

  creadoPor         Int?      @map("creado_por")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  destinatarios     CampanaDestinatario[]
  creadoPorUsuario  Usuario?  @relation(fields: [creadoPor], references: [id])

  @@index([estado])
  @@index([createdAt])
  @@map("campanas")
}
```

### Código - Modelo CampanaDestinatario:
```prisma
model CampanaDestinatario {
  id              Int       @id @default(autoincrement())
  campanaId       Int       @map("campana_id")
  socioId         Int       @map("socio_id")
  email           String?
  celular         String?
  nombreCompleto  String    @map("nombre_completo")

  estado          String    @default("PENDIENTE") // PENDIENTE, ENVIADO, FALLIDO
  brevoMessageId  String?   @map("brevo_message_id")
  enviadoEn       DateTime? @map("enviado_en")
  abiertoEn       DateTime? @map("abierto_en")
  intentos        Int       @default(0)
  ultimoError     String?   @map("ultimo_error")

  createdAt       DateTime  @default(now()) @map("created_at")

  campana         Campana   @relation(fields: [campanaId], references: [id], onDelete: Cascade)
  socio           Socio     @relation(fields: [socioId], references: [id])

  @@unique([campanaId, socioId])
  @@index([campanaId])
  @@index([socioId])
  @@index([estado])
  @@map("campana_destinatarios")
}
```

### Código - Modelo FiltroGuardado:
```prisma
model FiltroGuardado {
  id          Int      @id @default(autoincrement())
  nombre      String
  descripcion String?
  filtroJson  String   @db.Text @map("filtro_json")
  esPublico   Boolean  @default(false) @map("es_publico")
  creadoPor   Int?     @map("creado_por")
  createdAt   DateTime @default(now()) @map("created_at")

  creadoPorUsuario Usuario? @relation(fields: [creadoPor], references: [id])

  @@map("filtros_guardados")
}
```

### Código - Modelo ConfiguracionEnvio:
```prisma
model ConfiguracionEnvio {
  id          Int      @id @default(autoincrement())
  clave       String   @unique
  valor       String
  descripcion String?
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("configuracion_envio")
}
```

### Código - Agregar a modelo Socio:
```prisma
// Agregar esta línea en las relaciones del modelo Socio
campanaDestinatarios  CampanaDestinatario[]
```

### Código - Agregar a modelo Usuario:
```prisma
// Agregar estas líneas en las relaciones del modelo Usuario
campanasCreadas       Campana[]
filtrosGuardados      FiltroGuardado[]
```

---

## FASE 3: Backend Servicios

### 3.1 Brevo Service
**Archivo:** `server/src/services/brevoService.js`

#### Tareas:
- [ ] **3.1.1** Crear archivo brevoService.js
- [ ] **3.1.2** Implementar `enviarEmail()`
- [ ] **3.1.3** Implementar `enviarBatch()`
- [ ] **3.1.4** Implementar `verificarQuotaDiaria()`

#### Código:
```javascript
import * as Brevo from '@getbrevo/brevo'

const apiInstance = new Brevo.TransactionalEmailsApi()
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY)

/**
 * Envía un email individual via Brevo
 */
export async function enviarEmail({ to, toName, subject, htmlContent, params = {} }) {
  const sendSmtpEmail = new Brevo.SendSmtpEmail()

  sendSmtpEmail.to = [{ email: to, name: toName }]
  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = htmlContent
  sendSmtpEmail.sender = {
    email: process.env.SMTP_FROM || 'noreply@rojoplus.com',
    name: process.env.SMTP_FROM_NAME || 'Club Sportivo Pilar'
  }
  sendSmtpEmail.params = params

  try {
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail)
    return { success: true, messageId: response.messageId }
  } catch (error) {
    console.error('Error enviando email via Brevo:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envía batch de emails (max 100 por llamada según Brevo)
 */
export async function enviarBatch(destinatarios, asunto, contenidoHtml) {
  const resultados = []

  for (const dest of destinatarios) {
    // Reemplazar variables en contenido
    let htmlPersonalizado = contenidoHtml
      .replace(/\{\{nombre\}\}/g, dest.nombreCompleto || '')
      .replace(/\{\{email\}\}/g, dest.email || '')
      .replace(/\{\{nroSocio\}\}/g, dest.socio?.nroSocio || '')

    const resultado = await enviarEmail({
      to: dest.email,
      toName: dest.nombreCompleto,
      subject: asunto,
      htmlContent: htmlPersonalizado
    })

    resultados.push({
      destinatarioId: dest.id,
      ...resultado
    })

    // Pequeña pausa entre emails para no saturar
    await new Promise(r => setTimeout(r, 100))
  }

  return resultados
}

/**
 * Verifica quota diaria disponible
 */
export async function verificarQuotaDiaria() {
  try {
    const accountApi = new Brevo.AccountApi()
    accountApi.setApiKey(Brevo.AccountApiApiKeys.apiKey, process.env.BREVO_API_KEY)
    const account = await accountApi.getAccount()

    return {
      plan: account.plan?.[0]?.type || 'free',
      emailsRestantes: account.plan?.[0]?.credits || 300,
      limite: 300
    }
  } catch (error) {
    console.error('Error verificando quota Brevo:', error)
    return { emailsRestantes: 0, limite: 300, error: error.message }
  }
}
```

### 3.2 Filter Builder Service
**Archivo:** `server/src/services/filterBuilderService.js`

#### Tareas:
- [ ] **3.2.1** Crear archivo filterBuilderService.js
- [ ] **3.2.2** Definir CAMPOS_FILTRABLES
- [ ] **3.2.3** Implementar `buildPrismaWhere()`
- [ ] **3.2.4** Implementar `aplicarFiltro()`
- [ ] **3.2.5** Implementar `contarDestinatarios()`

#### Código:
```javascript
/**
 * Campos disponibles para filtrar socios
 */
export const CAMPOS_FILTRABLES = [
  { field: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'VIGENTE', 'INACTIVO', 'BAJA'] },
  { field: 'esMenor', label: 'Es Menor de Edad', type: 'boolean' },
  { field: 'sexo', label: 'Sexo', type: 'select', options: ['M', 'F'] },
  { field: 'zona', label: 'Zona', type: 'text' },
  { field: 'ciudad', label: 'Ciudad', type: 'text' },
  { field: 'fechaNacimiento', label: 'Fecha Nacimiento', type: 'date' },
  { field: 'fechaAlta', label: 'Fecha de Alta', type: 'date' },
  { field: 'aptaFisicaVigente', label: 'Apta Física Vigente', type: 'boolean' },
  { field: 'enviaDebito', label: 'Tiene Débito Automático', type: 'boolean' },
  { field: 'tieneEmail', label: 'Tiene Email', type: 'exists' },
  { field: 'tieneCelular', label: 'Tiene Celular', type: 'exists' },
  // Relaciones
  { field: 'categoriaSocioId', label: 'Categoría de Socio', type: 'relation', relation: 'categoriaSocio' },
  { field: 'tipoSocioRelId', label: 'Tipo de Socio', type: 'relation', relation: 'tipoSocioRel' },
  { field: 'actividadId', label: 'Actividad Inscripta', type: 'relation', relation: 'inscripciones.categoriaActividad.actividad' },
]

/**
 * Operadores disponibles por tipo de campo
 */
export const OPERADORES = {
  select: ['equals', 'in', 'not_in'],
  boolean: ['equals'],
  text: ['contains', 'equals', 'starts_with'],
  date: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
  number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between'],
  exists: ['exists', 'not_exists'],
  relation: ['equals', 'in'],
}

/**
 * Convierte filtroJson a cláusula WHERE de Prisma
 */
export function buildPrismaWhere(filtroJson) {
  if (!filtroJson || !filtroJson.conditions || filtroJson.conditions.length === 0) {
    return { estado: { in: ['ACTIVO', 'VIGENTE'] }, email: { not: null } }
  }

  const conditions = filtroJson.conditions.map(cond => {
    const { field, operator, value } = cond

    // Campos especiales
    if (field === 'tieneEmail') {
      return operator === 'exists'
        ? { email: { not: null } }
        : { email: null }
    }
    if (field === 'tieneCelular') {
      return operator === 'not_exists'
        ? { celular: null }
        : { celular: { not: null } }
    }
    if (field === 'actividadId') {
      return {
        inscripciones: {
          some: {
            estado: 'ACTIVA',
            categoriaActividad: {
              actividadId: operator === 'in' ? { in: value } : value
            }
          }
        }
      }
    }

    // Operadores estándar
    switch (operator) {
      case 'equals':
        return { [field]: value }
      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } }
      case 'not_in':
        return { [field]: { notIn: Array.isArray(value) ? value : [value] } }
      case 'contains':
        return { [field]: { contains: value, mode: 'insensitive' } }
      case 'starts_with':
        return { [field]: { startsWith: value, mode: 'insensitive' } }
      case 'gt':
        return { [field]: { gt: value } }
      case 'gte':
        return { [field]: { gte: value } }
      case 'lt':
        return { [field]: { lt: value } }
      case 'lte':
        return { [field]: { lte: value } }
      case 'between':
        return { [field]: { gte: value[0], lte: value[1] } }
      default:
        return { [field]: value }
    }
  })

  // Siempre requerir email no nulo para enviar
  const baseCondition = { email: { not: null } }

  if (filtroJson.logic === 'OR') {
    return { AND: [baseCondition, { OR: conditions }] }
  }
  return { AND: [baseCondition, ...conditions] }
}

/**
 * Aplica filtro y retorna socios
 */
export async function aplicarFiltro(prisma, filtroJson, options = {}) {
  const { preview = false, limit = 1000 } = options

  const where = buildPrismaWhere(filtroJson)

  const socios = await prisma.socio.findMany({
    where,
    select: {
      id: true,
      nroSocio: true,
      apellidoNombre: true,
      email: true,
      celular: true,
      estado: true,
    },
    take: preview ? 10 : limit,
    orderBy: { apellidoNombre: 'asc' }
  })

  return socios
}

/**
 * Cuenta socios que coinciden con el filtro
 */
export async function contarDestinatarios(prisma, filtroJson) {
  const where = buildPrismaWhere(filtroJson)
  return prisma.socio.count({ where })
}
```

### 3.3 Campaign Service
**Archivo:** `server/src/services/campanaService.js`

#### Tareas:
- [ ] **3.3.1** Crear archivo campanaService.js
- [ ] **3.3.2** Implementar `crearCampana()`
- [ ] **3.3.3** Implementar `confirmarDestinatarios()`

#### Código:
```javascript
import { aplicarFiltro } from './filterBuilderService.js'

/**
 * Crea una nueva campaña en estado BORRADOR
 */
export async function crearCampana(prisma, data, usuarioId) {
  return prisma.campana.create({
    data: {
      nombre: data.nombre,
      tipo: data.tipo || 'EMAIL',
      asunto: data.asunto,
      contenidoHtml: data.contenidoHtml,
      contenidoTexto: data.contenidoTexto,
      filtroJson: data.filtroJson ? JSON.stringify(data.filtroJson) : null,
      creadoPor: usuarioId,
      estado: 'BORRADOR'
    }
  })
}

/**
 * Confirma destinatarios basados en el filtro
 * Crea snapshot de los socios que recibirán la campaña
 */
export async function confirmarDestinatarios(prisma, campanaId, filtroJson) {
  // Obtener socios que coinciden
  const socios = await aplicarFiltro(prisma, filtroJson, { limit: 10000 })

  // Crear registros de destinatarios
  const destinatariosData = socios.map(socio => ({
    campanaId,
    socioId: socio.id,
    email: socio.email,
    celular: socio.celular,
    nombreCompleto: socio.apellidoNombre,
    estado: 'PENDIENTE'
  }))

  // Eliminar destinatarios previos si los hay
  await prisma.campanaDestinatario.deleteMany({ where: { campanaId } })

  // Crear nuevos destinatarios
  await prisma.campanaDestinatario.createMany({ data: destinatariosData })

  // Actualizar total en campaña
  await prisma.campana.update({
    where: { id: campanaId },
    data: {
      totalDestinatarios: socios.length,
      filtroJson: JSON.stringify(filtroJson)
    }
  })

  return { total: socios.length }
}

/**
 * Inicia el envío de una campaña
 */
export async function iniciarCampana(prisma, campanaId) {
  return prisma.campana.update({
    where: { id: campanaId },
    data: {
      estado: 'EN_PROCESO',
      iniciadaEn: new Date()
    }
  })
}

/**
 * Pausa una campaña en proceso
 */
export async function pausarCampana(prisma, campanaId) {
  return prisma.campana.update({
    where: { id: campanaId },
    data: { estado: 'PAUSADA' }
  })
}

/**
 * Reanuda una campaña pausada
 */
export async function reanudarCampana(prisma, campanaId) {
  return prisma.campana.update({
    where: { id: campanaId },
    data: { estado: 'EN_PROCESO' }
  })
}

/**
 * Cancela una campaña
 */
export async function cancelarCampana(prisma, campanaId) {
  return prisma.campana.update({
    where: { id: campanaId },
    data: {
      estado: 'CANCELADA',
      finalizadaEn: new Date()
    }
  })
}
```

---

## FASE 4: Backend Rutas

**Archivo:** `server/src/routes/comunicaciones.js`

### Tareas:
- [ ] **4.1** Crear archivo comunicaciones.js
- [ ] **4.2** Implementar GET /campanas (listar)
- [ ] **4.3** Implementar GET /campanas/:id (detalle)
- [ ] **4.4** Implementar POST /campanas (crear)
- [ ] **4.5** Implementar PUT /campanas/:id (editar)
- [ ] **4.6** Implementar DELETE /campanas/:id (eliminar)
- [ ] **4.7** Implementar endpoints de acciones (enviar, pausar, etc.)
- [ ] **4.8** Registrar rutas en index.js

### Código:
```javascript
import express from 'express'
import { authAdmin, checkPermiso } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { CAMPOS_FILTRABLES, contarDestinatarios, aplicarFiltro } from '../services/filterBuilderService.js'
import { crearCampana, confirmarDestinatarios, iniciarCampana, pausarCampana, cancelarCampana } from '../services/campanaService.js'

const router = express.Router()

// GET /admin/comunicaciones/filtros/campos - Campos disponibles para filtrar
router.get('/filtros/campos', authAdmin, asyncHandler(async (req, res) => {
  res.json({ success: true, data: CAMPOS_FILTRABLES })
}))

// POST /admin/comunicaciones/filtros/preview - Preview de filtro
router.post('/filtros/preview', authAdmin, asyncHandler(async (req, res) => {
  const { filtro } = req.body
  const total = await contarDestinatarios(req.prisma, filtro)
  const preview = await aplicarFiltro(req.prisma, filtro, { preview: true })
  res.json({ success: true, data: { total, preview } })
}))

// GET /admin/comunicaciones/campanas - Listar campañas
router.get('/campanas', authAdmin, checkPermiso('COMUNICACIONES_VER'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, estado } = req.query

  const where = {}
  if (estado) where.estado = estado

  const [campanas, total] = await Promise.all([
    req.prisma.campana.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        creadoPorUsuario: { select: { nombre: true } }
      }
    }),
    req.prisma.campana.count({ where })
  ])

  res.json({
    success: true,
    data: campanas,
    pagination: { page: parseInt(page), limit: parseInt(limit), total }
  })
}))

// GET /admin/comunicaciones/campanas/:id - Detalle de campaña
router.get('/campanas/:id', authAdmin, checkPermiso('COMUNICACIONES_VER'), asyncHandler(async (req, res) => {
  const campana = await req.prisma.campana.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      creadoPorUsuario: { select: { nombre: true } },
      _count: { select: { destinatarios: true } }
    }
  })

  if (!campana) {
    return res.status(404).json({ success: false, error: 'Campaña no encontrada' })
  }

  res.json({ success: true, data: campana })
}))

// POST /admin/comunicaciones/campanas - Crear campaña
router.post('/campanas', authAdmin, checkPermiso('COMUNICACIONES_CREAR'), asyncHandler(async (req, res) => {
  const campana = await crearCampana(req.prisma, req.body, req.user.id)
  res.json({ success: true, data: campana })
}))

// PUT /admin/comunicaciones/campanas/:id - Editar campaña
router.put('/campanas/:id', authAdmin, checkPermiso('COMUNICACIONES_EDITAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const campana = await req.prisma.campana.findUnique({ where: { id: parseInt(id) } })

  if (!campana) {
    return res.status(404).json({ success: false, error: 'Campaña no encontrada' })
  }
  if (campana.estado !== 'BORRADOR') {
    return res.status(400).json({ success: false, error: 'Solo se pueden editar campañas en borrador' })
  }

  const updated = await req.prisma.campana.update({
    where: { id: parseInt(id) },
    data: {
      nombre: req.body.nombre,
      asunto: req.body.asunto,
      contenidoHtml: req.body.contenidoHtml,
      contenidoTexto: req.body.contenidoTexto,
      filtroJson: req.body.filtroJson ? JSON.stringify(req.body.filtroJson) : campana.filtroJson
    }
  })

  res.json({ success: true, data: updated })
}))

// DELETE /admin/comunicaciones/campanas/:id - Eliminar campaña
router.delete('/campanas/:id', authAdmin, checkPermiso('COMUNICACIONES_ELIMINAR'), asyncHandler(async (req, res) => {
  const { id } = req.params
  const campana = await req.prisma.campana.findUnique({ where: { id: parseInt(id) } })

  if (!campana) {
    return res.status(404).json({ success: false, error: 'Campaña no encontrada' })
  }
  if (campana.estado !== 'BORRADOR') {
    return res.status(400).json({ success: false, error: 'Solo se pueden eliminar campañas en borrador' })
  }

  await req.prisma.campana.delete({ where: { id: parseInt(id) } })
  res.json({ success: true })
}))

// POST /admin/comunicaciones/campanas/:id/confirmar - Confirmar destinatarios
router.post('/campanas/:id/confirmar', authAdmin, checkPermiso('COMUNICACIONES_EDITAR'), asyncHandler(async (req, res) => {
  const { filtro } = req.body
  const result = await confirmarDestinatarios(req.prisma, parseInt(req.params.id), filtro)
  res.json({ success: true, data: result })
}))

// POST /admin/comunicaciones/campanas/:id/enviar - Enviar campaña
router.post('/campanas/:id/enviar', authAdmin, checkPermiso('COMUNICACIONES_ENVIAR'), asyncHandler(async (req, res) => {
  const campana = await iniciarCampana(req.prisma, parseInt(req.params.id))
  res.json({ success: true, data: campana, message: 'Campaña iniciada. Los emails se enviarán en segundo plano.' })
}))

// POST /admin/comunicaciones/campanas/:id/pausar
router.post('/campanas/:id/pausar', authAdmin, checkPermiso('COMUNICACIONES_ENVIAR'), asyncHandler(async (req, res) => {
  const campana = await pausarCampana(req.prisma, parseInt(req.params.id))
  res.json({ success: true, data: campana })
}))

// POST /admin/comunicaciones/campanas/:id/reanudar
router.post('/campanas/:id/reanudar', authAdmin, checkPermiso('COMUNICACIONES_ENVIAR'), asyncHandler(async (req, res) => {
  const campana = await reanudarCampana(req.prisma, parseInt(req.params.id))
  res.json({ success: true, data: campana })
}))

// POST /admin/comunicaciones/campanas/:id/cancelar
router.post('/campanas/:id/cancelar', authAdmin, checkPermiso('COMUNICACIONES_ENVIAR'), asyncHandler(async (req, res) => {
  const campana = await cancelarCampana(req.prisma, parseInt(req.params.id))
  res.json({ success: true, data: campana })
}))

// GET /admin/comunicaciones/campanas/:id/destinatarios - Lista de destinatarios
router.get('/campanas/:id/destinatarios', authAdmin, checkPermiso('COMUNICACIONES_VER'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, estado } = req.query
  const campanaId = parseInt(req.params.id)

  const where = { campanaId }
  if (estado) where.estado = estado

  const [destinatarios, total] = await Promise.all([
    req.prisma.campanaDestinatario.findMany({
      where,
      orderBy: { nombreCompleto: 'asc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    }),
    req.prisma.campanaDestinatario.count({ where })
  ])

  res.json({
    success: true,
    data: destinatarios,
    pagination: { page: parseInt(page), limit: parseInt(limit), total }
  })
}))

export default router
```

### Registrar en index.js:
```javascript
// En server/src/routes/index.js agregar:
import comunicacionesRoutes from './comunicaciones.js'
router.use('/admin/comunicaciones', comunicacionesRoutes)
```

---

## FASE 5: Frontend Lista de Campañas

**Archivo:** `client/src/pages/admin/comunicaciones/CampanasLista.jsx`

### Tareas:
- [ ] **5.1** Crear directorio `client/src/pages/admin/comunicaciones/`
- [ ] **5.2** Crear archivo CampanasLista.jsx
- [ ] **5.3** Implementar tabla con filtros y paginación
- [ ] **5.4** Agregar acciones (ver, editar, eliminar)
- [ ] **5.5** Agregar ruta en App.jsx

---

## FASE 6: Frontend Constructor de Filtros

**Archivos:**
- `client/src/components/comunicaciones/FilterBuilder.jsx`
- `client/src/components/comunicaciones/FilterCondition.jsx`

### Tareas:
- [ ] **6.1** Crear directorio `client/src/components/comunicaciones/`
- [ ] **6.2** Crear FilterCondition.jsx (una fila de condición)
- [ ] **6.3** Crear FilterBuilder.jsx (contenedor con + agregar)
- [ ] **6.4** Implementar selector de campo
- [ ] **6.5** Implementar selector de operador dinámico
- [ ] **6.6** Implementar contador de destinatarios en tiempo real

---

## FASE 7: Frontend Wizard de Campaña

**Archivo:** `client/src/pages/admin/comunicaciones/CampanaForm.jsx`

### Tareas:
- [ ] **7.1** Crear archivo CampanaForm.jsx
- [ ] **7.2** Implementar tabs/pasos (Destinatarios, Contenido, Preview, Envío)
- [ ] **7.3** Paso 1: Integrar FilterBuilder
- [ ] **7.4** Paso 2: Crear EmailEditor con variables
- [ ] **7.5** Paso 3: Preview de destinatarios y mensaje
- [ ] **7.6** Paso 4: Botones enviar ahora / programar
- [ ] **7.7** Navegación entre pasos con validación
- [ ] **7.8** Agregar ruta en App.jsx

---

## FASE 8: Cron Job de Procesamiento

**Archivo:** `server/src/jobs/campanas.js`

### Tareas:
- [ ] **8.1** Crear archivo campanas.js
- [ ] **8.2** Implementar `procesarCampanasEnProceso()`
- [ ] **8.3** Respetar límite de 300/día
- [ ] **8.4** Registrar job en index.js

### Código:
```javascript
import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { enviarBatch } from '../services/brevoService.js'

const prisma = new PrismaClient()
const LIMITE_DIARIO = 300
const BATCH_SIZE = 50

/**
 * Procesa campañas en estado EN_PROCESO
 * Ejecuta cada 5 minutos
 */
async function procesarCampanasEnProceso() {
  console.log('[Campañas] Verificando campañas en proceso...')

  const campanasEnProceso = await prisma.campana.findMany({
    where: { estado: 'EN_PROCESO' }
  })

  if (campanasEnProceso.length === 0) {
    return
  }

  // Contar emails enviados hoy
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const enviadosHoy = await prisma.campanaDestinatario.count({
    where: {
      estado: 'ENVIADO',
      enviadoEn: { gte: hoy }
    }
  })

  const disponibles = Math.max(0, LIMITE_DIARIO - enviadosHoy)

  if (disponibles === 0) {
    console.log('[Campañas] Límite diario alcanzado. Continuará mañana.')
    return
  }

  console.log(`[Campañas] Emails disponibles hoy: ${disponibles}`)

  for (const campana of campanasEnProceso) {
    // Obtener destinatarios pendientes
    const destinatarios = await prisma.campanaDestinatario.findMany({
      where: {
        campanaId: campana.id,
        estado: 'PENDIENTE'
      },
      take: Math.min(BATCH_SIZE, disponibles),
      include: {
        socio: { select: { nroSocio: true } }
      }
    })

    if (destinatarios.length === 0) {
      // Campaña completada
      await prisma.campana.update({
        where: { id: campana.id },
        data: {
          estado: 'COMPLETADA',
          finalizadaEn: new Date()
        }
      })
      console.log(`[Campañas] Campaña ${campana.id} completada`)
      continue
    }

    console.log(`[Campañas] Enviando ${destinatarios.length} emails de campaña ${campana.id}`)

    // Enviar batch
    const resultados = await enviarBatch(destinatarios, campana.asunto, campana.contenidoHtml)

    // Actualizar estados
    let enviados = 0
    let fallidos = 0

    for (const resultado of resultados) {
      if (resultado.success) {
        await prisma.campanaDestinatario.update({
          where: { id: resultado.destinatarioId },
          data: {
            estado: 'ENVIADO',
            brevoMessageId: resultado.messageId,
            enviadoEn: new Date()
          }
        })
        enviados++
      } else {
        await prisma.campanaDestinatario.update({
          where: { id: resultado.destinatarioId },
          data: {
            estado: 'FALLIDO',
            ultimoError: resultado.error,
            intentos: { increment: 1 }
          }
        })
        fallidos++
      }
    }

    // Actualizar estadísticas de campaña
    await prisma.campana.update({
      where: { id: campana.id },
      data: {
        enviados: { increment: enviados },
        fallidos: { increment: fallidos }
      }
    })

    console.log(`[Campañas] Campaña ${campana.id}: ${enviados} enviados, ${fallidos} fallidos`)
  }
}

// Ejecutar cada 5 minutos
const jobProcesarCampanas = cron.schedule('*/5 * * * *', procesarCampanasEnProceso, {
  scheduled: false
})

export function iniciarJobsCampanas() {
  jobProcesarCampanas.start()
  console.log('[Campañas] Job de procesamiento iniciado (cada 5 min)')
}

export function detenerJobsCampanas() {
  jobProcesarCampanas.stop()
}
```

---

## FASE 9: Frontend Detalle de Campaña

**Archivo:** `client/src/pages/admin/comunicaciones/CampanaDetalle.jsx`

### Tareas:
- [ ] **9.1** Crear archivo CampanaDetalle.jsx
- [ ] **9.2** Mostrar info y estadísticas
- [ ] **9.3** Barra de progreso para EN_PROCESO
- [ ] **9.4** Tabla de destinatarios con filtro por estado
- [ ] **9.5** Agregar ruta en App.jsx

---

## FASE 10: Testing

### Tareas:
- [ ] **10.1** Test de filtros: crear filtro complejo y verificar count
- [ ] **10.2** Test de envío: crear campaña con 5 destinatarios de prueba
- [ ] **10.3** Verificar emails recibidos y stats en Brevo dashboard
- [ ] **10.4** Test de cola: crear campaña grande y verificar procesamiento diario

---

## Permisos a Agregar

**Archivo:** `server/prisma/seeds/permisos.js`

```javascript
// Agregar al array de permisos:
{ codigo: 'COMUNICACIONES_VER', nombre: 'Ver Comunicaciones', modulo: 'COMUNICACIONES' },
{ codigo: 'COMUNICACIONES_CREAR', nombre: 'Crear Campañas', modulo: 'COMUNICACIONES' },
{ codigo: 'COMUNICACIONES_EDITAR', nombre: 'Editar Campañas', modulo: 'COMUNICACIONES' },
{ codigo: 'COMUNICACIONES_ENVIAR', nombre: 'Enviar Campañas', modulo: 'COMUNICACIONES' },
{ codigo: 'COMUNICACIONES_ELIMINAR', nombre: 'Eliminar Campañas', modulo: 'COMUNICACIONES' },
```

---

## Variables de Entorno

```env
# Agregar a server/.env
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Estructura de Archivos Final

```
server/src/
  routes/
    comunicaciones.js           # NUEVO
  services/
    brevoService.js             # NUEVO
    filterBuilderService.js     # NUEVO
    campanaService.js           # NUEVO
  jobs/
    campanas.js                 # NUEVO

client/src/
  pages/admin/comunicaciones/
    CampanasLista.jsx           # NUEVO
    CampanaForm.jsx             # NUEVO
    CampanaDetalle.jsx          # NUEVO
  components/comunicaciones/
    FilterBuilder.jsx           # NUEVO
    FilterCondition.jsx         # NUEVO
    EmailEditor.jsx             # NUEVO
```

---

## Notas de Implementación

1. **Límite Brevo Free:** 300 emails/día. El cron job respeta este límite.
2. **Cola automática:** Si hay más de 300 destinatarios, se envían 300/día hasta completar.
3. **Variables en emails:** Usar `{{nombre}}`, `{{nroSocio}}`, `{{email}}` en el contenido.
4. **Brevo maneja:** Bounces, unsubscribes, tracking de opens/clicks automáticamente.
