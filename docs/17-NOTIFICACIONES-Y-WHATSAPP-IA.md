# Notificaciones y Agente WhatsApp con IA - Análisis de Factibilidad

## Resumen Ejecutivo

Este documento analiza la implementación de un sistema de notificaciones multicanal (Email y WhatsApp) y un agente de IA conversacional para autogestión de socios vía WhatsApp.

### Objetivos
- **Notificaciones Email**: Alertas automáticas por eventos clave
- **Notificaciones WhatsApp**: Mensajes directos a socios
- **Agente IA WhatsApp**: Chatbot inteligente para consultas y gestiones 24/7

---

## 1. Sistema de Notificaciones por Email

### 1.1 Concepto

Sistema automatizado que envía emails a socios cuando ocurren eventos relevantes en el sistema.

### 1.2 Eventos a Notificar

| Evento | Trigger | Destinatario | Prioridad |
|--------|---------|--------------|-----------|
| **Cuota próxima a vencer** | 7 días antes del vencimiento | Socio | Alta |
| **Cuota vencida** | Día del vencimiento | Socio | Crítica |
| **Pago confirmado** | Pago registrado | Socio | Media |
| **Inscripción aprobada** | Nueva inscripción | Socio | Media |
| **Cambio de horario** | Modificación de categoría | Socios inscriptos | Alta |
| **Evento deportivo** | 48hs antes del partido | Equipo | Media |
| **Apto físico vence** | 30 días antes | Socio | Alta |
| **Recordatorio mensual** | 1ro de cada mes | Socios con deuda | Media |

### 1.3 Implementación Técnica

#### A. Arquitectura

```javascript
// Servicio de notificaciones (server/src/services/notificaciones.js)
import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'
import { enviarEmail } from './email.js'

// Cola de notificaciones (usar Bull Queue)
import Queue from 'bull'
const notificacionesQueue = new Queue('notificaciones', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
})

// Worker que procesa notificaciones
notificacionesQueue.process(async (job) => {
  const { tipo, socioId, data } = job.data

  const socio = await prisma.socio.findUnique({ where: { id: socioId } })

  switch (tipo) {
    case 'CUOTA_PROXIMA_VENCER':
      await enviarNotificacionCuotaPorVencer(socio, data)
      break
    case 'PAGO_CONFIRMADO':
      await enviarNotificacionPagoConfirmado(socio, data)
      break
    // ... más casos
  }
})

// Función para agendar notificación
export async function agendarNotificacion(tipo, socioId, data, delay = 0) {
  await notificacionesQueue.add(
    { tipo, socioId, data },
    { delay } // delay en milisegundos
  )
}
```

#### B. Cron Jobs para Notificaciones Programadas

```javascript
// server/src/jobs/notificacionesCron.js
import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { agendarNotificacion } from '../services/notificaciones.js'

const prisma = new PrismaClient()

// Ejecutar todos los días a las 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('🔔 Ejecutando job de notificaciones diarias...')

  // Cuotas que vencen en 7 días
  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() + 7)

  const cuotasPorVencer = await prisma.cargo.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVencimiento: {
        gte: new Date(),
        lte: fechaLimite,
      },
      socio: {
        email: { not: null },
      },
    },
    include: { socio: true },
  })

  for (const cuota of cuotasPorVencer) {
    await agendarNotificacion('CUOTA_PROXIMA_VENCER', cuota.socioId, {
      cuotaId: cuota.id,
      monto: cuota.montoTotal,
      fechaVencimiento: cuota.fechaVencimiento,
    })
  }

  console.log(`✅ ${cuotasPorVencer.length} notificaciones agendadas`)
})

// Ejecutar el 1ro de cada mes a las 10:00 AM
cron.schedule('0 10 1 * *', async () => {
  console.log('🔔 Ejecutando resumen mensual...')

  const sociosConDeuda = await prisma.socio.findMany({
    where: {
      email: { not: null },
      cargos: {
        some: {
          estado: { in: ['PENDIENTE', 'VENCIDO'] },
        },
      },
    },
    include: {
      cargos: {
        where: {
          estado: { in: ['PENDIENTE', 'VENCIDO'] },
        },
      },
    },
  })

  for (const socio of sociosConDeuda) {
    await agendarNotificacion('RESUMEN_MENSUAL', socio.id, {
      totalDeuda: socio.cargos.reduce((sum, c) => sum + Number(c.montoTotal), 0),
      cantidadCuotas: socio.cargos.length,
    })
  }
})
```

#### C. Plantillas de Email

```javascript
// server/src/services/email-templates.js
export function templateCuotaPorVencer(socio, cuota) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2>Hola ${socio.apellidoNombre}</h2>

        <p>Te recordamos que tenés una cuota próxima a vencer:</p>

        <div style="background: #fef2f2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
          <p><strong>Concepto:</strong> ${cuota.descripcion}</p>
          <p><strong>Monto:</strong> $${Number(cuota.montoTotal).toLocaleString('es-AR')}</p>
          <p><strong>Vence:</strong> ${new Date(cuota.fechaVencimiento).toLocaleDateString('es-AR')}</p>
        </div>

        <a href="${process.env.FRONTEND_URL}/portal-socio"
           style="display: inline-block; background: #DC2626; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  margin: 20px 0;">
          Pagar Online
        </a>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          💡 Pagá desde el Portal del Socio con MercadoPago o MODO
        </p>
      </div>
    </div>
  `
}

export function templatePagoConfirmado(socio, pago) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #16a34a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">✓ Pago Confirmado</h1>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2>Hola ${socio.apellidoNombre}</h2>

        <p>¡Tu pago fue procesado exitosamente!</p>

        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
          <p><strong>Recibo Nº:</strong> ${pago.numero}</p>
          <p><strong>Monto:</strong> $${Number(pago.montoTotal).toLocaleString('es-AR')}</p>
          <p><strong>Fecha:</strong> ${new Date(pago.fecha).toLocaleDateString('es-AR')}</p>
        </div>

        <p>Gracias por tu pago. Tu cuenta está al día.</p>
      </div>
    </div>
  `
}
```

### 1.4 Configuración en BD

```sql
-- Tabla de configuración de notificaciones
CREATE TABLE notificacion_config (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) UNIQUE NOT NULL,
  activa BOOLEAN DEFAULT true,
  dias_anticipacion INTEGER, -- Para notificaciones programadas
  hora_envio TIME, -- Hora preferida de envío
  template_email TEXT,
  template_whatsapp TEXT,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Configuraciones iniciales
INSERT INTO notificacion_config (tipo, activa, dias_anticipacion, descripcion) VALUES
('CUOTA_PROXIMA_VENCER', true, 7, 'Notificar 7 días antes del vencimiento'),
('CUOTA_VENCIDA', true, 0, 'Notificar el día del vencimiento'),
('PAGO_CONFIRMADO', true, NULL, 'Notificar inmediatamente al confirmar pago'),
('RESUMEN_MENSUAL', true, NULL, 'Enviar resumen el 1ro de cada mes');

-- Log de notificaciones enviadas
CREATE TABLE notificacion_log (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  socio_id INTEGER REFERENCES socios(id),
  canal VARCHAR(20) NOT NULL, -- 'EMAIL' | 'WHATSAPP'
  estado VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE' | 'ENVIADA' | 'ERROR'
  error_mensaje TEXT,
  enviada_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.5 Costos Email

| Servicio | Volumen | Costo Mensual (USD) | Notas |
|----------|---------|---------------------|-------|
| **Gmail SMTP** | Hasta 500/día | **$0** | Ya implementado |
| **SendGrid Free** | Hasta 100/día | **$0** | API robusta |
| **SendGrid Essentials** | Hasta 100k/mes | **$20** | Incluye analytics |
| **Amazon SES** | 62k emails/mes | **$6.20** | Pay-per-use |
| **Mailgun Flex** | Primeros 5k gratis | **$0.80/1k** | Flexible |

**Recomendación**: Comenzar con Gmail SMTP (ya implementado) y migrar a SendGrid o SES si se superan 500 emails/día.

### 1.6 Esfuerzo de Implementación

- **Servicio de notificaciones**: 8 horas
- **Templates de email**: 6 horas
- **Cron jobs**: 4 horas
- **Configuración y testing**: 4 horas
- **Total**: ~3 días de desarrollo

---

## 2. Sistema de Notificaciones por WhatsApp

### 2.1 Concepto

Envío de mensajes de WhatsApp automáticos a socios para eventos críticos (cuotas vencidas, recordatorios, confirmaciones).

### 2.2 Plataformas Disponibles

#### A. WhatsApp Business API (Oficial)

**Características**:
- API oficial de Meta
- Requiere verificación de negocio
- Plantillas pre-aprobadas por WhatsApp
- Alta confiabilidad

**Proveedores**:
1. **Twilio** (Más popular)
2. **MessageBird**
3. **360Dialog**
4. **Infobip**

**Limitaciones**:
- Solo mensajes de plantilla para inicio de conversación
- Plantillas deben ser aprobadas (24-48hs)
- Ventana de 24hs para respuestas libres
- No permite spam

#### B. Twilio WhatsApp Business API

```javascript
// server/src/services/whatsapp.js
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function enviarWhatsApp(telefono, mensaje) {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:+54${telefono}`,
      body: mensaje,
    })

    console.log(`✅ WhatsApp enviado: ${message.sid}`)
    return { success: true, sid: message.sid }
  } catch (error) {
    console.error('❌ Error enviando WhatsApp:', error.message)
    return { success: false, error: error.message }
  }
}

// Enviar con plantilla aprobada
export async function enviarWhatsAppConPlantilla(telefono, templateId, parametros) {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:+54${telefono}`,
      contentSid: templateId, // ID de plantilla aprobada
      contentVariables: JSON.stringify(parametros),
    })

    return { success: true, sid: message.sid }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

#### C. Plantillas WhatsApp (Ejemplos)

```
PLANTILLA: cuota_vencida
---------------------------------------
Hola {{1}},

Tu cuota de {{2}} vence el {{3}}.

Monto: ${{4}}

Pagá online: {{5}}

- Club Sportivo Pilar

VARIABLES:
1. Nombre del socio
2. Concepto de la cuota
3. Fecha de vencimiento
4. Monto
5. Link de pago
```

```
PLANTILLA: pago_confirmado
---------------------------------------
✅ Pago confirmado

Hola {{1}},

Tu pago fue acreditado exitosamente.

Recibo: {{2}}
Monto: ${{3}}

¡Gracias!

- Club Sportivo Pilar
```

### 2.3 Costos WhatsApp

#### Twilio Pricing (Argentina - 2026)

| Tipo de Mensaje | Costo (USD) | Notas |
|-----------------|-------------|-------|
| **Conversation Utility** | $0.0085/msg | Notificaciones OTP, alertas |
| **Conversation Marketing** | $0.0500/msg | Promociones, ofertas |
| **Conversation Service** | $0.0380/msg | Soporte, consultas |
| **Template Message** | $0.0085/msg | Mensaje inicial con plantilla |

**Ejemplo Mensual** (100 socios activos):
- 100 recordatorios de cuota: $0.85
- 50 confirmaciones de pago: $0.42
- 20 mensajes de soporte: $0.76
- **Total**: ~$2/mes

**Escalado** (1000 socios):
- ~$20/mes

#### Comparativa de Proveedores

| Proveedor | Costo/Mensaje (USD) | Setup Fee | Min. Mensual |
|-----------|---------------------|-----------|--------------|
| **Twilio** | $0.0085-0.05 | $0 | Pay-per-use |
| **360Dialog** | $0.0055-0.04 | €0 | €0 |
| **MessageBird** | $0.0070-0.045 | $0 | $0 |
| **Infobip** | Custom | $0 | Negociable |

**Recomendación**: Twilio por su documentación, soporte y facilidad de integración.

### 2.4 Configuración Requerida

1. **Cuenta Meta Business Manager**
2. **Verificación de negocio** (~2-3 semanas)
3. **Número de WhatsApp Business** (dedicado)
4. **Aprobación de plantillas** (24-48hs cada una)
5. **Configuración webhook** para respuestas

### 2.5 Integración con Sistema

```javascript
// Modificar servicio de notificaciones
export async function enviarNotificacion(tipo, socio, data, canal = 'EMAIL') {
  if (canal === 'EMAIL' && socio.email) {
    await enviarEmail({
      to: socio.email,
      subject: getSubject(tipo),
      html: getTemplate(tipo, socio, data),
    })
  }

  if (canal === 'WHATSAPP' && socio.celular) {
    // Verificar si socio tiene WhatsApp habilitado
    const config = await prisma.socio.findUnique({
      where: { id: socio.id },
      select: { notificacionesWhatsApp: true },
    })

    if (config.notificacionesWhatsApp) {
      const templateId = getWhatsAppTemplate(tipo)
      const params = getWhatsAppParams(tipo, socio, data)

      await enviarWhatsAppConPlantilla(socio.celular, templateId, params)
    }
  }

  // Registrar en log
  await prisma.notificacionLog.create({
    data: {
      tipo,
      socioId: socio.id,
      canal,
      estado: 'ENVIADA',
      enviadaAt: new Date(),
    },
  })
}
```

### 2.6 Esfuerzo de Implementación

- **Setup cuenta Twilio/Meta**: 4 horas
- **Servicio WhatsApp**: 8 horas
- **Plantillas y aprobación**: 8 horas
- **Integración con notificaciones**: 4 horas
- **Testing**: 4 horas
- **Total**: ~3.5 días de desarrollo

---

## 3. Agente de IA para WhatsApp

### 3.1 Concepto

Chatbot conversacional inteligente que permite a los socios realizar consultas y gestiones simples vía WhatsApp 24/7 sin intervención humana.

### 3.2 Capacidades del Agente

#### Nivel 1 - Consultas (Solo lectura)
- ✅ "¿Cuáles son las actividades disponibles?"
- ✅ "¿Cuánto debo?"
- ✅ "¿En qué actividades estoy inscripto?"
- ✅ "¿Cuándo entrenan los infantiles de fútbol?"
- ✅ "¿Cuándo vence mi próxima cuota?"
- ✅ "Mostrame mi historial de pagos"

#### Nivel 2 - Gestiones Simples (Acciones)
- ✅ "Generá un link de pago para mis cuotas"
- ✅ "Inscribime en básquet juvenil"
- ✅ "Darme de baja de paddle"
- ✅ "Actualizá mi email a nuevo@email.com"
- ✅ "Enviame mi QR de socio"

#### Nivel 3 - Interacciones Complejas
- ❌ Consultas con múltiples pasos
- ❌ Negociación de planes de pago
- ❌ Resolución de problemas contables

### 3.3 Arquitectura Técnica

#### Stack Recomendado

```
┌─────────────────────────────────────────┐
│         WhatsApp (Usuario)              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Twilio WhatsApp Business API       │
│     (Recibe mensajes, envía respuestas) │
└──────────────┬──────────────────────────┘
               │ Webhook
               ▼
┌─────────────────────────────────────────┐
│      Servidor Express (Backend)         │
│   POST /webhooks/whatsapp-incoming      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Servicio de IA (OpenAI GPT-4)     │
│    + Function Calling para acciones     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Base de Datos Prisma              │
│   (Consultas y actualizaciones)         │
└─────────────────────────────────────────┘
```

#### Implementación con OpenAI GPT-4

```javascript
// server/src/services/whatsapp-ai.js
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const prisma = new PrismaClient()

// Definir funciones disponibles para el agente
const FUNCIONES_DISPONIBLES = [
  {
    name: 'consultar_deuda',
    description: 'Consulta el saldo pendiente y cuotas adeudadas de un socio',
    parameters: {
      type: 'object',
      properties: {
        socio_id: {
          type: 'number',
          description: 'ID del socio',
        },
      },
      required: ['socio_id'],
    },
  },
  {
    name: 'listar_actividades_disponibles',
    description: 'Lista todas las actividades deportivas disponibles para inscripción',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'generar_link_pago',
    description: 'Genera un link de pago para las cuotas pendientes del socio',
    parameters: {
      type: 'object',
      properties: {
        socio_id: { type: 'number' },
        metodo: {
          type: 'string',
          enum: ['MERCADOPAGO', 'MODO'],
          description: 'Método de pago preferido',
        },
      },
      required: ['socio_id'],
    },
  },
  {
    name: 'consultar_inscripciones',
    description: 'Lista las actividades en las que está inscripto el socio',
    parameters: {
      type: 'object',
      properties: {
        socio_id: { type: 'number' },
      },
      required: ['socio_id'],
    },
  },
  {
    name: 'inscribir_actividad',
    description: 'Inscribe al socio en una actividad específica',
    parameters: {
      type: 'object',
      properties: {
        socio_id: { type: 'number' },
        categoria_actividad_id: { type: 'number' },
      },
      required: ['socio_id', 'categoria_actividad_id'],
    },
  },
]

// Implementación de funciones
async function ejecutarFuncion(nombre, args) {
  switch (nombre) {
    case 'consultar_deuda':
      return await consultarDeuda(args.socio_id)

    case 'listar_actividades_disponibles':
      return await listarActividadesDisponibles()

    case 'generar_link_pago':
      return await generarLinkPago(args.socio_id, args.metodo)

    case 'consultar_inscripciones':
      return await consultarInscripciones(args.socio_id)

    case 'inscribir_actividad':
      return await inscribirActividad(args.socio_id, args.categoria_actividad_id)

    default:
      throw new Error(`Función ${nombre} no implementada`)
  }
}

async function consultarDeuda(socioId) {
  const cargos = await prisma.cargo.findMany({
    where: {
      socioId,
      estado: { in: ['PENDIENTE', 'VENCIDO'] },
    },
    include: { periodo: true },
  })

  const total = cargos.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  return {
    total,
    cantidad: cargos.length,
    cargos: cargos.map(c => ({
      concepto: c.descripcion || c.categoria,
      monto: Number(c.montoTotal),
      vencimiento: c.fechaVencimiento,
    })),
  }
}

async function listarActividadesDisponibles() {
  const categorias = await prisma.categoriaActividad.findMany({
    where: { activa: true },
    include: {
      actividad: true,
      _count: {
        select: {
          inscripciones: { where: { estado: 'ACTIVA' } },
        },
      },
    },
  })

  return categorias.map(cat => ({
    id: cat.id,
    nombre: `${cat.actividad.nombre} - ${cat.nombre}`,
    horarios: cat.horarios,
    cuota: Number(cat.cuotaMensual),
    cupos: cat.cupoMaximo ? cat.cupoMaximo - cat._count.inscripciones : 'Ilimitados',
  }))
}

async function generarLinkPago(socioId, metodo = 'MERCADOPAGO') {
  const cargos = await prisma.cargo.findMany({
    where: {
      socioId,
      estado: { in: ['PENDIENTE', 'VENCIDO'] },
    },
  })

  if (cargos.length === 0) {
    return { mensaje: 'No tenés cuotas pendientes' }
  }

  const total = cargos.reduce((sum, c) => sum + Number(c.montoTotal), 0)

  const linkPago = await prisma.linkPago.create({
    data: {
      socioId,
      concepto: `Pago de ${cargos.length} cuota(s)`,
      montoTotal: total,
      cargosIds: JSON.stringify(cargos.map(c => c.id)),
      plataforma: metodo,
      estado: 'PENDIENTE',
      initPoint: `${process.env.FRONTEND_URL}/pagar/${metodo.toLowerCase()}`,
      fechaExpiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return {
    link: linkPago.initPoint,
    monto: total,
    concepto: linkPago.concepto,
  }
}

async function consultarInscripciones(socioId) {
  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      socioId,
      estado: 'ACTIVA',
    },
    include: {
      categoriaActividad: {
        include: {
          actividad: true,
        },
      },
    },
  })

  return inscripciones.map(i => ({
    actividad: i.categoriaActividad.actividad.nombre,
    categoria: i.categoriaActividad.nombre,
    horarios: i.categoriaActividad.horarios,
  }))
}

async function inscribirActividad(socioId, categoriaActividadId) {
  // Validaciones
  const categoria = await prisma.categoriaActividad.findUnique({
    where: { id: categoriaActividadId },
    include: {
      _count: {
        select: {
          inscripciones: { where: { estado: 'ACTIVA' } },
        },
      },
      actividad: true,
    },
  })

  if (!categoria || !categoria.activa) {
    throw new Error('Actividad no disponible')
  }

  if (categoria.cupoMaximo && categoria._count.inscripciones >= categoria.cupoMaximo) {
    throw new Error('No hay cupos disponibles')
  }

  const yaInscripto = await prisma.inscripcion.findFirst({
    where: {
      socioId,
      categoriaActividadId,
      estado: 'ACTIVA',
    },
  })

  if (yaInscripto) {
    throw new Error('Ya estás inscripto en esta actividad')
  }

  await prisma.inscripcion.create({
    data: {
      socioId,
      categoriaActividadId,
      fechaInicio: new Date(),
      estado: 'ACTIVA',
    },
  })

  return {
    mensaje: `Te inscribiste exitosamente en ${categoria.actividad.nombre} - ${categoria.nombre}`,
    horarios: categoria.horarios,
    cuota: Number(categoria.cuotaMensual),
  }
}

// Procesar mensaje del socio
export async function procesarMensajeWhatsApp(telefono, mensaje) {
  // Buscar socio por teléfono
  const socio = await prisma.socio.findFirst({
    where: {
      OR: [
        { celular: telefono },
        { celular: telefono.replace('+54', '') },
      ],
    },
  })

  if (!socio) {
    return 'No encontramos tu número en nuestro sistema. Contactá al club para registrarte.'
  }

  // Obtener historial de conversación (últimos 10 mensajes)
  const historial = await prisma.mensajeWhatsApp.findMany({
    where: { socioId: socio.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const mensajes = [
    {
      role: 'system',
      content: `Sos un asistente virtual del Club Sportivo Pilar.
Tu nombre es Rojo Bot y ayudás a los socios con consultas y gestiones.
Respondé de forma amigable, breve y en español argentino.

INFORMACIÓN DEL SOCIO:
- Nombre: ${socio.apellidoNombre}
- Nro Socio: ${socio.nroSocio}
- ID: ${socio.id}

INSTRUCCIONES:
- Para consultas de deuda, usá la función consultar_deuda
- Para listar actividades, usá listar_actividades_disponibles
- Para generar links de pago, usá generar_link_pago
- Para inscripciones, primero mostrá actividades con listar_actividades_disponibles
- Siempre confirmá antes de hacer cambios (inscripciones, bajas)
- Sé breve en tus respuestas (máx 2-3 oraciones)`,
    },
    ...historial.reverse().map(m => ({
      role: m.esDelSocio ? 'user' : 'assistant',
      content: m.mensaje,
    })),
    {
      role: 'user',
      content: mensaje,
    },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: mensajes,
    functions: FUNCIONES_DISPONIBLES,
    function_call: 'auto',
  })

  const { message } = response.choices[0]

  // Si el modelo quiere ejecutar una función
  if (message.function_call) {
    const nombreFuncion = message.function_call.name
    const args = JSON.parse(message.function_call.arguments)

    try {
      const resultado = await ejecutarFuncion(nombreFuncion, args)

      // Segunda llamada a la IA con el resultado de la función
      const segundaRespuesta = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          ...mensajes,
          message,
          {
            role: 'function',
            name: nombreFuncion,
            content: JSON.stringify(resultado),
          },
        ],
      })

      const respuestaFinal = segundaRespuesta.choices[0].message.content

      // Guardar en historial
      await prisma.mensajeWhatsApp.createMany({
        data: [
          {
            socioId: socio.id,
            mensaje,
            esDelSocio: true,
          },
          {
            socioId: socio.id,
            mensaje: respuestaFinal,
            esDelSocio: false,
            funcionEjecutada: nombreFuncion,
          },
        ],
      })

      return respuestaFinal
    } catch (error) {
      return `Ups, tuve un problema: ${error.message}. ¿Podés reformular tu consulta?`
    }
  }

  // Respuesta directa sin función
  const respuestaTexto = message.content

  await prisma.mensajeWhatsApp.createMany({
    data: [
      { socioId: socio.id, mensaje, esDelSocio: true },
      { socioId: socio.id, mensaje: respuestaTexto, esDelSocio: false },
    ],
  })

  return respuestaTexto
}
```

#### Webhook para Recibir Mensajes

```javascript
// server/src/routes/webhooks.js
import { Router } from 'express'
import { procesarMensajeWhatsApp } from '../services/whatsapp-ai.js'
import { enviarWhatsApp } from '../services/whatsapp.js'

const router = Router()

// POST /webhooks/whatsapp-incoming
router.post('/whatsapp-incoming', async (req, res) => {
  const { From, Body } = req.body

  const telefono = From.replace('whatsapp:', '')
  const mensaje = Body.trim()

  console.log(`📱 Mensaje de ${telefono}: ${mensaje}`)

  try {
    const respuesta = await procesarMensajeWhatsApp(telefono, mensaje)

    await enviarWhatsApp(telefono, respuesta)

    res.status(200).send('OK')
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error)
    res.status(500).send('Error')
  }
})

// GET /webhooks/whatsapp-incoming (Validación de Twilio)
router.get('/whatsapp-incoming', (req, res) => {
  res.status(200).send('Webhook activo')
})

export default router
```

### 3.4 Modelo de Datos para Mensajería

```prisma
// prisma/schema.prisma

model MensajeWhatsApp {
  id                Int       @id @default(autoincrement())
  socioId           Int       @map("socio_id")
  mensaje           String
  esDelSocio        Boolean   @map("es_del_socio") // true = mensaje del socio, false = del bot
  funcionEjecutada  String?   @map("funcion_ejecutada") // Nombre de la función si se ejecutó
  createdAt         DateTime  @default(now()) @map("created_at")

  socio             Socio     @relation(fields: [socioId], references: [id])

  @@index([socioId])
  @@index([createdAt])
  @@map("mensajes_whatsapp")
}
```

### 3.5 Costos del Agente IA

#### OpenAI GPT-4 Turbo (Enero 2026)

| Modelo | Input (1M tokens) | Output (1M tokens) | Uso Típico |
|--------|-------------------|-------------------|-----------|
| **GPT-4 Turbo** | $10 | $30 | Recomendado |
| **GPT-3.5 Turbo** | $0.50 | $1.50 | Alternativa económica |

**Cálculo de Costos por Conversación**:

- Mensaje promedio: ~500 tokens (input + output + funciones)
- Costo GPT-4 Turbo: ~$0.02 por conversación
- Costo GPT-3.5 Turbo: ~$0.001 por conversación

**Ejemplo Mensual**:
- 100 socios x 10 mensajes/mes = 1000 conversaciones
- GPT-4 Turbo: **$20/mes**
- GPT-3.5 Turbo: **$1/mes**

**Escalado** (1000 socios activos):
- GPT-4 Turbo: **$200/mes**
- GPT-3.5 Turbo: **$10/mes**

#### Costos Totales (Agente + WhatsApp)

**Para 100 socios activos**:
| Concepto | Costo Mensual (USD) |
|----------|---------------------|
| WhatsApp (Twilio) | $2 |
| OpenAI GPT-4 Turbo | $20 |
| **TOTAL** | **$22/mes** |

**Para 1000 socios activos**:
| Concepto | Costo Mensual (USD) |
|----------|---------------------|
| WhatsApp (Twilio) | $20 |
| OpenAI GPT-4 Turbo | $200 |
| **TOTAL** | **$220/mes** |

**Optimización de Costos**:
- Usar GPT-3.5 para consultas simples (90% de casos)
- Reservar GPT-4 para casos complejos o críticos
- Cachear respuestas frecuentes
- **Ahorro potencial**: 80-90%

### 3.6 Alternativas Tecnológicas

#### A. Rasa (Open Source)

**Pros**:
- Gratis (self-hosted)
- Control total
- Sin límites de uso

**Contras**:
- Requiere entrenamiento del modelo
- Infraestructura propia (servidores)
- Menor capacidad conversacional
- Mayor complejidad de setup

**Costo**: $50-100/mes (servidor) + 20-40 horas de desarrollo

#### B. Dialogflow (Google)

**Pros**:
- Integración nativa con WhatsApp
- Buena NLU (Natural Language Understanding)
- Escalable

**Contras**:
- Menos flexible que GPT
- Requiere entrenamiento
- Costos por solicitud

**Costo**: $0.002-0.006 por request + infraestructura

#### C. LangChain + Modelo Local (Llama 3)

**Pros**:
- Sin costos de API
- Control total de datos
- Privacidad

**Contras**:
- Requiere GPU potente
- Mantenimiento complejo
- Latencia mayor

**Costo**: $200-400/mes (servidor GPU) + complejidad técnica alta

### 3.7 Esfuerzo de Implementación

| Fase | Descripción | Horas |
|------|-------------|-------|
| **1. Configuración Inicial** | Twilio + OpenAI + Webhook | 8 |
| **2. Servicio Base IA** | Integración GPT + Function Calling | 16 |
| **3. Funciones de Negocio** | 6-8 funciones principales | 24 |
| **4. Testing y Ajustes** | Prompts, edge cases, errores | 16 |
| **5. Modelo BD y Logs** | Historial de mensajes | 8 |
| **6. Deploy y Monitoreo** | Producción + alertas | 8 |
| **TOTAL** | | **~80 horas (10 días)** |

---

## 4. Roadmap de Implementación Recomendado

### Fase 1: Notificaciones Email (ALTA PRIORIDAD)
- **Duración**: 3 días
- **Costo**: $0/mes (Gmail SMTP)
- **ROI**: Alto - Reduce carga de atención al cliente

**Tareas**:
1. Servicio de notificaciones con Bull Queue
2. Cron jobs para notificaciones programadas
3. Templates HTML para emails
4. Configuración en BD
5. Testing

### Fase 2: Notificaciones WhatsApp (MEDIA PRIORIDAD)
- **Duración**: 3.5 días
- **Costo**: $2-20/mes según volumen
- **ROI**: Medio-Alto - Mayor tasa de apertura que email

**Tareas**:
1. Setup Twilio WhatsApp Business
2. Verificación de negocio en Meta
3. Plantillas y aprobación
4. Integración con servicio de notificaciones
5. Testing con socios piloto

### Fase 3: Agente IA WhatsApp (BAJA PRIORIDAD - OPCIONAL)
- **Duración**: 10 días
- **Costo**: $22-220/mes según volumen
- **ROI**: Bajo-Medio en fase inicial (puede crecer)

**Tareas**:
1. Setup OpenAI + Webhook
2. Desarrollo de funciones de negocio
3. Ajuste de prompts y testing
4. Deploy y monitoreo
5. Iteración basada en feedback

---

## 5. Recomendaciones Finales

### Priorización

**Implementar YA**:
✅ **Notificaciones por Email** - ROI inmediato, costo $0

**Implementar en 3-6 meses**:
⚠️ **Notificaciones por WhatsApp** - Esperar a tener 200+ socios activos

**Evaluar en 6-12 meses**:
❓ **Agente IA WhatsApp** - Solo si hay demanda comprobada

### Estrategia de Costos

1. **Empezar Gratis**: Email notifications con Gmail SMTP
2. **Escalar Gradual**: WhatsApp solo cuando email sea insuficiente
3. **IA como Lujo**: Solo si el volumen de consultas justifica la inversión

### Métricas de Éxito

Para justificar WhatsApp IA:
- Más de 500 consultas/mes por WhatsApp manual
- Tiempo de respuesta > 2 horas
- Consultas repetitivas > 70%
- Disponibilidad 24/7 requerida

### Alternativa Low-Code

**Considerar**: Chatbot de WhatsApp con **Botpress** o **ManyChat**
- **Costo**: $15-50/mes
- **Setup**: 2-3 días
- **Pros**: Sin código, plantillas pre-hechas
- **Contras**: Menos inteligente que GPT-4

---

## 6. Tabla de Decisión Rápida

| Solución | Complejidad | Tiempo | Costo Mensual | Cuándo Usar |
|----------|-------------|--------|---------------|-------------|
| **Email Notif** | Baja | 3 días | $0 | Siempre (base) |
| **WhatsApp Notif** | Media | 3.5 días | $2-20 | >200 socios activos |
| **IA GPT-4** | Alta | 10 días | $22-220 | >500 consultas/mes |
| **IA GPT-3.5** | Alta | 10 días | $1-10 | Alternativa económica |
| **Botpress** | Baja | 2 días | $15-50 | Presupuesto ajustado |
| **Rasa (OSS)** | Muy Alta | 20 días | $50-100 | Control total, recursos IT |

---

## 7. Documentación de Referencia

### APIs y SDKs
- **Twilio WhatsApp**: https://www.twilio.com/docs/whatsapp
- **OpenAI Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **Bull Queue**: https://github.com/OptimalBits/bull
- **Node Cron**: https://www.npmjs.com/package/node-cron

### Tutoriales
- WhatsApp Business API con Twilio: https://www.twilio.com/blog/whatsapp-chatbot
- OpenAI Function Calling Tutorial: https://cookbook.openai.com/examples/how_to_call_functions_with_chat_models
- WhatsApp AI Agent con LangChain: https://python.langchain.com/docs/use_cases/chatbots

### Pricing
- Twilio WhatsApp: https://www.twilio.com/en-us/whatsapp/pricing
- OpenAI: https://openai.com/pricing
- Twilio Conversations API: https://www.twilio.com/en-us/pricing/conversations-api

---

**Última actualización**: Enero 2026
**Autor**: Martín + Claude Sonnet 4.5
