# 🤖 ROJO IA - Asistente Inteligente de RojoPlus

## 📋 Índice

- [¿Qué es ROJO IA?](#qué-es-rojo-ia)
- [Instalación Rápida](#instalación-rápida)
- [Funcionalidades](#funcionalidades)
- [Guía de Uso](#guía-de-uso)
- [Documentación Técnica](#documentación-técnica)

---

## ¿Qué es ROJO IA?

**ROJO IA** (pronunciado "Rojito") es el asistente inteligente conversacional de Club Sportivo Pilar que permite:

- ✅ **A los Socios:** Consultar deuda, generar links de pago, inscribirse en actividades, hacer pedidos en el buffet
- ✅ **A los Camareros:** Gestionar mesas, agregar items a comandas, ver cuentas, comandas pendientes
- ✅ **A los Admins:** Consultar estadísticas, reportes de ventas, gestión rápida

Todo mediante **lenguaje natural** sin necesidad de navegar por formularios complejos.

---

## 🚀 Instalación Rápida

### 1. Obtener API Key de Anthropic

1. Ir a https://console.anthropic.com/
2. Crear cuenta o iniciar sesión
3. En "API Keys", crear una nueva key
4. Copiar la clave (formato: `sk-ant-api03-...`)

### 2. Configurar Backend

```bash
cd server

# Instalar dependencia
npm install @anthropic-ai/sdk

# Configurar .env
echo "ANTHROPIC_API_KEY=sk-ant-api03-tu-clave-aqui" >> .env

# Iniciar servidor
npm run dev
```

### 3. Configurar Frontend

```bash
cd client

# Instalar dependencia
npm install react-markdown

# Ya está integrado en:
# - Portal Socio (PortalSocioNuevo.jsx)
# - Buffet Mesas (BuffetMesas.jsx)
# - Buffet Dashboard (BuffetDashboardNew.jsx)
```

### 4. Verificar Instalación

```bash
# Health check
curl http://localhost:3001/api/chat/health
```

Respuesta esperada:
```json
{
  "available": true,
  "service": "ROJO IA - Chat Assistant",
  "model": "claude-sonnet-4-20250514"
}
```

---

## 🎯 Funcionalidades

### Para Socios (Portal Socio)

#### Consultas
```
✅ "Cuál es mi deuda?"
✅ "Cuándo vence mi próxima cuota?"
✅ "En qué actividades estoy inscripto?"
✅ "Qué eventos tengo esta semana?"
```

#### Pagos
```
✅ "Generar link de pago para mi cuota"
✅ "Quiero pagar todas mis cuotas atrasadas"
✅ "Cómo puedo pagar?"
```

#### Actividades
```
✅ "Inscribirme en tenis adultos"
✅ "Qué actividades nuevas hay?"
✅ "Darme de baja de natación"
```

#### Buffet
```
✅ "Ver el menú del buffet"
✅ "Pedir 2 milanesas para llevar"
```

#### Grupo Familiar
```
✅ "Ver mi grupo familiar"
✅ "Agregar a mi hijo Juan a fútbol infantil"
```

### Para Camareros (Buffet)

#### Mesas
```
✅ "Qué mesas están ocupadas?"
✅ "Abrir mesa 5"
✅ "Ver cuenta de mesa 7"
✅ "Cerrar mesa 3 en efectivo"
```

#### Comandas
```
✅ "Agregar 2 cervezas y una pizza a la mesa 8"
✅ "Agregar 3 cafés a mesa 12"
✅ "Comandas pendientes"
```

### Para Admins

```
✅ "Cuántos socios morosos hay?"
✅ "Ventas del buffet hoy"
✅ "Recaudación de cuotas del mes"
```

---

## 📖 Guía de Uso

### Como Socio

1. **Acceder al Portal Socio** con tu link único (`/s/tu-token`)
2. **Hacer clic en el botón flotante rojo** (esquina inferior derecha)
3. **Escribir tu consulta** en lenguaje natural
4. **Seguir las instrucciones** del asistente

**Ejemplo práctico:**

```
Usuario: "Cuál es mi deuda?"

ROJO IA:
💳 Estado de Cuenta

📊 Resumen:
• Cuotas pendientes: 2
• Total a pagar: $45.000

📋 Detalle:
1. Cuota Social - Julio 2026: $20.000 (vence 10/07)
2. Cuota Social - Agosto 2026: $25.000 (vence 10/08)

¿Querés generar un link de pago?

Usuario: "Sí"

ROJO IA:
✅ Link de pago generado

💰 Monto total: $45.000
📝 Concepto: 2 cuota(s)

🔗 [Pagar con MercadoPago](https://mpago.la/xxx)

El link expira en 30 días.
```

### Como Camarero (Buffet)

1. **Acceder al Dashboard de Buffet** o **Gestión de Mesas**
2. **Hacer clic en el botón flotante rojo**
3. **Usar comandos de voz natural** para gestionar mesas

**Ejemplo práctico:**

```
Camarero: "Abrir mesa 8"

ROJO IA:
✅ Mesa 8 abierta
Podés agregar items ahora.

Camarero: "Agregar 2 cervezas, una pizza muzza y una coca"

ROJO IA:
✅ Items agregados a Mesa 8

• 2x Cerveza Quilmes - $4.000
• 1x Pizza Muzzarella - $6.500
• 1x Coca Cola 1.5L - $1.500

💰 Total mesa: $12.000

Camarero: "Ver cuenta de mesa 8"

ROJO IA:
📋 Cuenta Mesa 8

1. 2x Cerveza Quilmes - $4.000
2. 1x Pizza Muzzarella - $6.500
3. 1x Coca Cola 1.5L - $1.500

💰 Total: $12.000
```

---

## 🏗️ Arquitectura

```
┌─────────────────┐
│ Portal Socio    │ → ChatWidget (role="socio")
│ (Frontend)      │
└────────┬────────┘
         │
         │ POST /api/chat
         │ { message, tokenPortal, role }
         ▼
┌─────────────────┐
│ Express API     │ → /api/chat
│ (Backend)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Assistant    │ → Claude Sonnet 4
│ Service         │    (Anthropic)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Action Executor │ → Llama APIs de RojoPlus
│ Service         │    (Prisma + DB)
└─────────────────┘
```

### Archivos Principales

**Backend:**
- `server/src/services/aiAssistant.js` - Servicio principal de IA
- `server/src/services/actionExecutor.js` - Ejecutor de acciones
- `server/src/routes/chat.js` - Endpoints HTTP

**Frontend:**
- `client/src/components/chat/ChatWidget.jsx` - Widget principal
- `client/src/components/chat/ChatMessage.jsx` - Componente de mensaje
- `client/src/services/chatService.js` - Servicio HTTP

**Integraciones:**
- `client/src/pages/socio/PortalSocioNuevo.jsx` - Portal socio
- `client/src/pages/admin/buffet/BuffetMesas.jsx` - Buffet mesas
- `client/src/pages/admin/buffet/BuffetDashboardNew.jsx` - Buffet dashboard

---

## 💰 Costos

Con **500 socios activos** usando el asistente **2-4 veces/mes**:

- **Requests/mes:** ~1500-2000
- **Costo estimado:** USD 15-40/mes
- **Costo por request:** ~USD 0.01

Modelo usado: `claude-sonnet-4-20250514`
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens

---

## 🧪 Testing

### Endpoint de Health Check

```bash
curl http://localhost:3001/api/chat/health
```

### Test con Socio

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cuál es mi deuda?",
    "tokenPortal": "abc123",
    "role": "socio"
  }'
```

### Test con Camarero

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Qué mesas están ocupadas?",
    "role": "camarero"
  }'
```

---

## 📚 Documentación Técnica

- **Propuesta Completa:** [`docs/PROPUESTA_ASISTENTE_IA.md`](docs/PROPUESTA_ASISTENTE_IA.md)
- **Setup Técnico:** [`docs/ROJO_IA_SETUP.md`](docs/ROJO_IA_SETUP.md)
- **Anthropic Docs:** https://docs.anthropic.com/claude/reference

---

## 🔒 Seguridad

- ✅ Validación de `tokenPortal` para socios
- ✅ Confirmaciones para acciones críticas (pagos, bajas)
- ✅ Rate limiting (20 req/min socios, 60 req/min admins)
- ✅ No se guardan datos sensibles en logs
- ✅ Todas las acciones validadas contra base de datos

---

## ⚠️ Troubleshooting

### "AI Assistant no está configurado"

**Solución:** Verificar que `ANTHROPIC_API_KEY` esté en `.env` y reiniciar servidor

### "Token inválido"

**Solución:** Verificar que el `tokenPortal` existe en la tabla `socios`

### Widget no aparece

**Solución:** Verificar que `react-markdown` esté instalado: `npm install react-markdown`

---

## 🚀 Próximos Pasos

- [ ] Implementar autenticación para camareros (actualmente sin auth)
- [ ] Implementar autenticación para admins (actualmente sin auth)
- [ ] Completar funcionalidades pendientes (marcadas como TODO en actionExecutor.js)
- [ ] Agregar analytics de uso
- [ ] Testing con usuarios reales
- [ ] Mejoras de prompts basadas en feedback

---

## 🎉 ¡Listo para usar!

Ahora podés:

1. ✅ Iniciar el backend: `cd server && npm run dev`
2. ✅ Iniciar el frontend: `cd client && npm run dev`
3. ✅ Acceder al portal socio y probar el asistente
4. ✅ Acceder al buffet y usar comandos de voz

**¿Preguntas?** Consultá la documentación técnica completa en `docs/`

---

**Versión:** 1.0
**Fecha:** 2026-03-12
**Equipo:** RojoPlus + Claude Code
