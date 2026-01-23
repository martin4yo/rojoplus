# Sistema de Notificaciones y Chat - RojoPlus

## 📋 Resumen Ejecutivo

Sistema completo de comunicación entre el club y los socios, incluyendo:
- **Email**: Comprobantes, recordatorios, confirmaciones
- **WhatsApp**: Notificaciones importantes, estado de pagos
- **Chat en vivo**: Comunicación directa Portal ↔ Admin

---

## 🎯 Objetivos

### Funcionales
1. Automatizar comunicaciones recurrentes (emails de comprobantes, recordatorios)
2. Notificar eventos importantes por WhatsApp (pago confirmado/rechazado)
3. Proveer canal de comunicación directa entre socios y administración
4. Reducir consultas telefónicas y presenciales

### No Funcionales
1. Sistema escalable (soportar envíos masivos)
2. Logs completos de todas las notificaciones
3. Templates personalizables
4. Bajo costo operativo
5. Fácil mantenimiento

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    RojoPlus Backend                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ NotificationQueue│─────▶│ NotificationWorker│        │
│  │  (Bull + Redis)  │      │   (Procesador)    │        │
│  └──────────────────┘      └──────────────────┘        │
│            │                         │                   │
│            ├─────────────────────────┼──────────────────┤
│            │                         │                   │
│            ▼                         ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Email Service   │      │ WhatsApp Service │        │
│  │   (Nodemailer)   │      │    (Twilio)      │        │
│  └──────────────────┘      └──────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘
           │                            │
           ▼                            ▼
    ┌──────────┐                ┌──────────┐
    │  Gmail   │                │  Twilio  │
    │   SMTP   │                │   API    │
    └──────────┘                └──────────┘

┌─────────────────────────────────────────────────────────┐
│                    Chat en Tiempo Real                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Socket.io       │◀────▶│    Redis Pub/Sub │        │
│  │  (WebSockets)    │      │   (Multi-server) │        │
│  └──────────────────┘      └──────────────────┘        │
│           │                                              │
│           ├──────────────────┬──────────────────┐      │
│           ▼                  ▼                  ▼       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │Portal Socio  │  │Admin Panel   │  │  Base de     │ │
│  │  (Cliente)   │  │  (Cliente)   │  │   Datos      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Módulos del Sistema

### 1. Sistema de Email ✉️

#### Casos de Uso
1. **Comprobante de Pago** (al confirmar pago)
2. **Recordatorio de Vencimiento** (5 días antes)
3. **Pago Rechazado** (transferencia rechazada con motivo)
4. **Pago Confirmado** (transferencia aprobada)
5. **Bienvenida de Nuevo Socio**
6. **Reseteo de Contraseña Admin**
7. **Cuotas Generadas** (inicio de mes)
8. **Inscripción a Actividad Confirmada**

#### Stack Tecnológico
- **Nodemailer** (ya instalado)
- **Handlebars** (templates HTML)
- **Juice** (inline CSS para emails)
- **Bull Queue** (cola de envíos)

#### Estructura de Templates

```handlebars
<!-- templates/email/comprobante-pago.hbs -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Estilos inline compilados */
  </style>
</head>
<body>
  <div class="container">
    <img src="{{clubLogo}}" alt="{{clubNombre}}">
    <h1>Comprobante de Pago</h1>

    <div class="info">
      <p><strong>Socio:</strong> {{socioNombre}}</p>
      <p><strong>Fecha:</strong> {{fechaPago}}</p>
      <p><strong>Monto:</strong> {{monto}}</p>
      <p><strong>Comprobante:</strong> {{numeroComprobante}}</p>
    </div>

    <table class="cuotas">
      {{#each cuotas}}
      <tr>
        <td>{{concepto}}</td>
        <td>{{periodo}}</td>
        <td>{{monto}}</td>
      </tr>
      {{/each}}
    </table>

    <div class="footer">
      <p>{{clubNombre}}</p>
      <p>{{clubDireccion}}</p>
      <p>{{clubTelefono}}</p>
    </div>
  </div>
</body>
</html>
```

#### Configuración

```javascript
// server/src/config/email.js
export default {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  from: {
    name: process.env.CLUB_NOMBRE || 'Club Sportivo Pilar',
    email: process.env.EMAIL_USER
  }
}
```

---

### 2. Sistema de WhatsApp 📱

#### Casos de Uso
1. **Pago Confirmado** (transferencia aprobada)
2. **Pago Rechazado** (transferencia rechazada)
3. **Recordatorio Urgente** (vencimiento en 24hs)
4. **Cambio de Estado Socio** (suspendido por mora)
5. **Respuesta a Consulta del Chat**

#### Opciones de Integración

##### Opción A: Twilio (Recomendado)
**Pros:**
- ✅ API oficial de WhatsApp Business
- ✅ Muy confiable
- ✅ Excelente documentación
- ✅ Templates pre-aprobados
- ✅ SDK para Node.js

**Contras:**
- 💰 Costo: ~USD 0.005-0.01 por mensaje (Argentina)
- 📝 Requiere proceso de aprobación de templates

**Implementación:**
```javascript
// server/src/services/whatsapp-twilio.js
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function enviarWhatsApp({ to, template, params }) {
  return await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${to}`,
    body: renderTemplate(template, params)
  })
}
```

##### Opción B: WhatsApp Business API (Directo)
**Pros:**
- ✅ Sin intermediarios
- ✅ Gratis (solo hosting)

**Contras:**
- ⚠️ Requiere Facebook Business Manager
- ⚠️ Proceso de verificación complejo
- ⚠️ Requiere servidor con IP fija
- ⚠️ Mantenimiento más complejo

##### Opción C: Baileys (No Oficial)
**Pros:**
- ✅ Gratis
- ✅ No requiere API oficial

**Contras:**
- ❌ Riesgo de baneo
- ❌ No recomendado para producción
- ❌ Puede dejar de funcionar en cualquier momento

**Recomendación:** **Twilio** para producción, es la opción más confiable y profesional.

#### Templates de WhatsApp

```javascript
// Templates pre-aprobados en Twilio
const TEMPLATES = {
  PAGO_CONFIRMADO: {
    name: 'pago_confirmado',
    params: ['{{socioNombre}}', '{{monto}}', '{{fecha}}']
  },
  PAGO_RECHAZADO: {
    name: 'pago_rechazado',
    params: ['{{socioNombre}}', '{{motivo}}']
  },
  RECORDATORIO: {
    name: 'recordatorio_vencimiento',
    params: ['{{socioNombre}}', '{{monto}}', '{{fechaVencimiento}}']
  }
}
```

---

### 3. Chat en Tiempo Real 💬

#### Funcionalidades

**Para el Socio (Portal):**
- Ver historial de conversaciones
- Enviar mensajes al club
- Ver estado: "Escribiendo...", "Visto"
- Notificación de nuevos mensajes
- Adjuntar archivos (opcional)

**Para el Admin:**
- Vista de todas las conversaciones activas
- Badge con contador de mensajes no leídos
- Responder desde panel admin
- Ver datos del socio (cuotas, pagos, etc.)
- Marcar conversación como resuelta
- Buscar conversaciones

#### Stack Tecnológico

```javascript
// Backend
- Socket.io (WebSockets)
- Redis Adapter (multi-server)
- Bull Queue (notificaciones asíncronas)

// Frontend
- Socket.io-client
- React Context (estado global del chat)
- Notificaciones de navegador (Web Push API)
```

#### Arquitectura de Base de Datos

```prisma
// Schema para Chat
model Conversacion {
  id            Int       @id @default(autoincrement())
  socioId       Int       @map("socio_id")
  asunto        String?
  estado        String    @default("ABIERTA") // ABIERTA, EN_PROCESO, RESUELTA
  prioridad     String    @default("NORMAL")  // BAJA, NORMAL, ALTA, URGENTE
  ultimoMensaje DateTime? @map("ultimo_mensaje")
  creadaEn      DateTime  @default(now()) @map("creada_en")
  resueltaEn    DateTime? @map("resuelta_en")

  socio         Socio     @relation(fields: [socioId], references: [id])
  mensajes      Mensaje[]

  @@index([socioId])
  @@index([estado])
  @@map("conversaciones")
}

model Mensaje {
  id             Int          @id @default(autoincrement())
  conversacionId Int          @map("conversacion_id")
  remitente      String       // SOCIO, ADMIN
  remitenteId    Int          @map("remitente_id")
  contenido      String       @db.Text
  adjunto        String?
  leido          Boolean      @default(false)
  creadoEn       DateTime     @default(now()) @map("creado_en")

  conversacion   Conversacion @relation(fields: [conversacionId], references: [id])

  @@index([conversacionId])
  @@index([leido])
  @@map("mensajes")
}

model Notificacion {
  id        Int      @id @default(autoincrement())
  tipo      String   // EMAIL, WHATSAPP, PUSH
  destino   String   // email, telefono, userId
  asunto    String?
  contenido String   @db.Text
  estado    String   @default("PENDIENTE") // PENDIENTE, ENVIADO, FALLIDO
  error     String?  @db.Text
  enviadoEn DateTime? @map("enviado_en")
  creadoEn  DateTime @default(now()) @map("creado_en")

  @@index([estado])
  @@index([tipo])
  @@map("notificaciones")
}
```

#### Implementación Socket.io

```javascript
// server/src/services/socket.js
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

export function setupSocket(httpServer, prisma) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true
    }
  })

  // Redis adapter para multi-server (opcional pero recomendado)
  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient))
    })
  }

  // Namespace para socios
  const socioNamespace = io.of('/socio')

  socioNamespace.on('connection', (socket) => {
    const { token } = socket.handshake.auth

    // Validar token del socio
    const socio = await validateSocioToken(token)
    if (!socio) {
      socket.disconnect()
      return
    }

    // Unirse a room personal
    socket.join(`socio-${socio.id}`)

    // Evento: socio envía mensaje
    socket.on('enviar-mensaje', async (data) => {
      const mensaje = await prisma.mensaje.create({
        data: {
          conversacionId: data.conversacionId,
          remitente: 'SOCIO',
          remitenteId: socio.id,
          contenido: data.contenido
        }
      })

      // Notificar a admins
      io.of('/admin').emit('nuevo-mensaje-socio', {
        conversacionId: data.conversacionId,
        socioId: socio.id,
        socioNombre: socio.nombre,
        mensaje
      })

      // Confirmar al socio
      socket.emit('mensaje-enviado', mensaje)
    })

    // Evento: socio está escribiendo
    socket.on('escribiendo', (conversacionId) => {
      io.of('/admin').emit('socio-escribiendo', {
        conversacionId,
        socioNombre: socio.nombre
      })
    })
  })

  // Namespace para admins
  const adminNamespace = io.of('/admin')

  adminNamespace.on('connection', (socket) => {
    const { token } = socket.handshake.auth

    // Validar token del admin
    const admin = await validateAdminToken(token)
    if (!admin) {
      socket.disconnect()
      return
    }

    // Unirse a room de admins
    socket.join('admins')

    // Evento: admin responde mensaje
    socket.on('responder-mensaje', async (data) => {
      const mensaje = await prisma.mensaje.create({
        data: {
          conversacionId: data.conversacionId,
          remitente: 'ADMIN',
          remitenteId: admin.id,
          contenido: data.contenido
        }
      })

      // Obtener conversación para saber el socio
      const conversacion = await prisma.conversacion.findUnique({
        where: { id: data.conversacionId },
        include: { socio: true }
      })

      // Notificar al socio
      socioNamespace.to(`socio-${conversacion.socioId}`).emit('nuevo-mensaje-admin', mensaje)

      // Confirmar al admin
      socket.emit('mensaje-enviado', mensaje)

      // Enviar WhatsApp si socio no está online (opcional)
      if (!isSocketConnected(socioNamespace, `socio-${conversacion.socioId}`)) {
        await enviarWhatsApp({
          to: conversacion.socio.telefono,
          template: 'nueva_respuesta_chat',
          params: [conversacion.socio.nombre]
        })
      }
    })
  })

  return io
}
```

#### UI del Chat - Portal del Socio

```jsx
// client/src/components/ChatWidget.jsx
import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function ChatWidget({ socio, tokenPortal }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [noLeidos, setNoLeidos] = useState(0)
  const socketRef = useRef(null)

  useEffect(() => {
    // Conectar socket
    socketRef.current = io(`${import.meta.env.VITE_API_URL}/socio`, {
      auth: { token: tokenPortal }
    })

    // Cargar conversación existente
    cargarConversacion()

    // Escuchar nuevos mensajes
    socketRef.current.on('nuevo-mensaje-admin', (mensaje) => {
      setMensajes(prev => [...prev, mensaje])
      if (!isOpen) {
        setNoLeidos(prev => prev + 1)
        // Notificación de navegador
        if (Notification.permission === 'granted') {
          new Notification('Nuevo mensaje del club', {
            body: mensaje.contenido,
            icon: '/logo.png'
          })
        }
      }
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [tokenPortal])

  const enviarMensaje = () => {
    if (!nuevoMensaje.trim()) return

    socketRef.current.emit('enviar-mensaje', {
      conversacionId: conversacion?.id,
      contenido: nuevoMensaje
    })

    setNuevoMensaje('')
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setNoLeidos(0)
        }}
        className="fixed bottom-4 right-4 w-16 h-16 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all"
      >
        <ChatIcon className="w-6 h-6" />
        {noLeidos > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {noLeidos}
          </span>
        )}
      </button>

      {/* Ventana de chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col">
          {/* Header */}
          <div className="bg-red-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-bold">Chat con el Club</h3>
            <button onClick={() => setIsOpen(false)}>
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.map(mensaje => (
              <div
                key={mensaje.id}
                className={`flex ${mensaje.remitente === 'SOCIO' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    mensaje.remitente === 'SOCIO'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm">{mensaje.contenido}</p>
                  <span className="text-xs opacity-75">
                    {formatHora(mensaje.creadoEn)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <button
                onClick={enviarMensaje}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

---

## 📅 Plan de Implementación

### Fase 1: Email (1 semana)
**Duración: 5 días**

#### Día 1-2: Setup y Templates
- [x] Instalar dependencias (handlebars, juice)
- [ ] Crear servicio de email
- [ ] Diseñar templates HTML base
- [ ] Crear helpers de Handlebars
- [ ] Configurar variables de entorno

#### Día 3-4: Integración
- [ ] Email de comprobante de pago
- [ ] Email de pago confirmado/rechazado
- [ ] Email de recordatorio de vencimiento
- [ ] Cola de envíos con Bull

#### Día 5: Testing
- [ ] Probar envíos en desarrollo
- [ ] Validar templates en diferentes clientes
- [ ] Logs de notificaciones

---

### Fase 2: WhatsApp (3-4 días)
**Duración: 3-4 días**

#### Día 1: Setup Twilio
- [ ] Crear cuenta Twilio
- [ ] Configurar WhatsApp Business
- [ ] Aprobar templates
- [ ] Credenciales en .env

#### Día 2: Integración
- [ ] Servicio de WhatsApp
- [ ] Notificación de pago confirmado
- [ ] Notificación de pago rechazado
- [ ] Recordatorio urgente

#### Día 3: Testing y Logs
- [ ] Pruebas de envío
- [ ] Manejo de errores
- [ ] Logs en BD

---

### Fase 3: Chat (1 semana)
**Duración: 7 días**

#### Día 1-2: Backend
- [ ] Migración de schema (Conversacion, Mensaje)
- [ ] Setup Socket.io
- [ ] Endpoints REST de chat
- [ ] Autenticación de sockets

#### Día 3-4: Frontend Portal
- [ ] Componente ChatWidget
- [ ] Integración con Socket.io
- [ ] Notificaciones de navegador
- [ ] UI responsive

#### Día 5-6: Frontend Admin
- [ ] Página de Chat en admin
- [ ] Lista de conversaciones
- [ ] Vista de mensajes
- [ ] Badge con contador

#### Día 7: Testing
- [ ] Pruebas end-to-end
- [ ] Múltiples conversaciones simultáneas
- [ ] Manejo de desconexiones

---

## 💰 Costos Estimados

### Twilio WhatsApp
- **Setup**: Gratis
- **Mensajes salientes**: USD 0.005-0.01 cada uno
- **Estimado mensual** (500 mensajes): USD 2.5-5

### Email
- **Gmail**: Gratis (límite 500 emails/día)
- **SendGrid** (si se necesita más): USD 15/mes (40,000 emails)

### Redis (para Socket.io en multi-server)
- **Local/desarrollo**: Gratis
- **Redis Cloud**: Gratis hasta 30MB
- **Producción**: USD 5-15/mes

**Total mensual**: USD 10-25

---

## ✅ Criterios de Aceptación

### Email
- [ ] Comprobantes se envían automáticamente al confirmar pago
- [ ] Templates profesionales con logo del club
- [ ] Emails llegan a bandeja de entrada (no spam)
- [ ] Logs de todos los envíos en BD

### WhatsApp
- [ ] Notificaciones de pago confirmado/rechazado
- [ ] Solo se envía si el socio tiene teléfono registrado
- [ ] Templates aprobados por Twilio
- [ ] Manejo de errores (número inválido, etc.)

### Chat
- [ ] Comunicación en tiempo real (< 1 seg de latencia)
- [ ] Badge con contador de mensajes no leídos
- [ ] Historial persistente en BD
- [ ] Notificaciones de navegador
- [ ] Funciona en mobile y desktop

---

## 🚀 Próximos Pasos

1. **Decidir prioridades**: ¿Empezamos con Email, WhatsApp o Chat?
2. **Crear cuenta Twilio** (si vamos con WhatsApp)
3. **Diseñar templates** de email con branding del club
4. **Ejecutar migraciones** de BD
5. **Implementar módulo por módulo**

---

**¿Por dónde querés empezar?**
- A) Email (lo más simple, impacto inmediato)
- B) Chat (lo más solicitado por usuarios)
- C) WhatsApp (requiere setup de Twilio primero)
- D) Todo en paralelo (2 semanas full)
