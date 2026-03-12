# ROJO IA - Asistente Inteligente para RojoPlus

## 🎯 Resumen Ejecutivo

**ROJO IA** es el asistente conversacional inteligente para Club Sportivo Pilar que permite a los socios gestionar sus actividades, consultar información y realizar transacciones mediante comandos en lenguaje natural.

**Nombre:** **ROJO IA** (pronunciado: "Rojo IA" o "Rojito")
- Relacionado con el lema del club: "El Rojo de la Avenida"
- Fácil de recordar y pronunciar
- Refuerza la identidad del club

---

## 🌟 Funcionalidades Principales

### Para Socios (Portal Socio)

#### 📋 Consultas de Información
```
✓ "Cuál es mi deuda?" → Muestra cuenta corriente con saldo
✓ "Cuándo vence mi próxima cuota?" → Fecha de vencimiento
✓ "En qué actividades estoy inscripto?" → Lista de inscripciones
✓ "Qué eventos tengo esta semana?" → Calendario de entrenamientos
✓ "Cuáles son los horarios de fútbol infantil?" → Info de actividades disponibles
✓ "Quiero ver mi grupo familiar" → Miembros del grupo
```

#### 💳 Gestión de Pagos
```
✓ "Generar link de pago para mi cuota" → Botón de MercadoPago
✓ "Quiero pagar todas mis cuotas atrasadas" → Link de pago múltiple
✓ "Cómo puedo pagar?" → Info de métodos de pago (MP, transferencia, CBU/Alias)
✓ "Dame un QR para transferir" → Muestra QR con CBU del club
✓ "Quiero descargar mi recibo del pago #1234" → PDF del recibo
```

#### 🏃 Actividades Deportivas
```
✓ "Inscribirme en tenis adultos" → Proceso de inscripción guiado
✓ "Darme de baja de natación" → Confirma y da de baja
✓ "Agregar a mi hijo Juan a fútbol infantil" → Inscripción de familiar
✓ "Qué actividades nuevas hay?" → Lista de actividades disponibles
✓ "Confirmar mi asistencia al partido del sábado" → Respuesta a convocatoria
✓ "Hablar con el entrenador de básquet" → Inicia chat con entrenador
```

#### 🍔 Buffet / Takeaway
```
✓ "Ver el menú del buffet" → Muestra menú con precios
✓ "Pedir una milanesa napolitana con papas para llevar" → Pedido takeaway
✓ "Hacer un pedido en mesa 5" → Crea comanda para mesa
✓ "Quiero 2 pizzas muzza y una coca" → Agrega al carrito
✓ "Cancelar mi pedido" → Cancela comanda activa
```

#### 📄 Gestión de Documentos
```
✓ "Subir comprobante de pago" → Upload de imagen + OCR
✓ "Descargar mi última factura" → PDF de factura
✓ "Ver mis recibos del último mes" → Historial de recibos
```

#### 👨‍👩‍👧 Grupo Familiar
```
✓ "Agregar a mi esposa María DNI 12345678" → Alta de miembro familiar
✓ "Ver la deuda de toda mi familia" → Cuenta corriente grupal
✓ "Dar de baja a mi hijo del grupo familiar" → Baja de integrante
```

### Para Admins (Panel Admin)

#### 📊 Consultas Rápidas
```
✓ "Cuántos socios morosos hay?" → Estadísticas
✓ "Ventas del buffet hoy" → Dashboard de ventas
✓ "Socios inscriptos en fútbol masculino" → Reportes
✓ "Recaudación de cuotas del mes" → Finanzas
```

#### ⚡ Acciones Rápidas
```
✓ "Crear cuota social julio 2026" → Generación de cuotas
✓ "Enviar recordatorio de pago a morosos" → Email masivo
✓ "Dar de alta socio Juan Pérez DNI 98765432" → Alta de socio
✓ "Cerrar mesa 8 del buffet" → Cierre de mesa
```

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

```
┌────────────────────────────────────────────┐
│          Usuario (Socio/Admin)             │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│  Chat Widget (React + shadcn/ui)           │
│  - Botón flotante en portal socio          │
│  - Panel lateral en admin                   │
│  - Voice input (opcional)                   │
└──────────────────┬─────────────────────────┘
                   │ POST /api/chat
                   ▼
┌────────────────────────────────────────────┐
│  Backend API (Express.js)                  │
│  - Endpoint: /api/chat                     │
│  - Autenticación: tokenPortal (socio)      │
│  - Autenticación: JWT (admin)              │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│  AI Service (Anthropic Claude)             │
│  - Model: claude-sonnet-4                  │
│  - Procesa lenguaje natural                │
│  - Extrae intención + entidades            │
│  - Retorna JSON estructurado               │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│  Action Executor Service                   │
│  - Valida permisos                         │
│  - Llama APIs de RojoPlus                  │
│  - Genera respuestas contextuales          │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│  APIs de RojoPlus                          │
│  - /api/socio/*                            │
│  - /api/admin/*                            │
│  - /api/buffet/*                           │
│  - /api/cobranzas/*                        │
└────────────────────────────────────────────┘
```

### Componentes Principales

**1. Frontend - Chat Widget (client/src/components/chat/)**
```javascript
// Componentes principales:
- ChatWidget.jsx           // Widget flotante principal
- ChatMessage.jsx          // Mensaje individual
- ChatInput.jsx            // Input con voice support
- QuickActions.jsx         // Botones de acción rápida
- DocumentUploader.jsx     // Upload de comprobantes
- PaymentButton.jsx        // Botón de pago MP
```

**2. Backend - AI Service (server/src/services/aiAssistant.js)**
```javascript
class AIAssistantService {
  // Método principal: interpreta comandos
  async processCommand(message, context) {
    // context: { userId, socioId, token, role }
  }

  // Prompt específico para socios
  buildSocioPrompt(socio) {
    // Define acciones disponibles para socios
  }

  // Prompt específico para admins
  buildAdminPrompt(user) {
    // Define acciones disponibles para admins
  }
}
```

**3. Action Executor (server/src/services/actionExecutor.js)**
```javascript
class ActionExecutor {
  async executeAction(action, context) {
    switch(action.accion) {
      case 'consultar_deuda':
        return this.consultarDeuda(context);
      case 'generar_link_pago':
        return this.generarLinkPago(action.entidades, context);
      case 'inscribir_actividad':
        return this.inscribirActividad(action.entidades, context);
      // ... más acciones
    }
  }
}
```

---

## 📝 Formato de Respuesta del AI

El asistente siempre responde con JSON estructurado:

```json
{
  "accion": "consultar_deuda" | "generar_link_pago" | "inscribir_actividad" | ...,
  "entidades": {
    // Datos extraídos del mensaje
    "cuotasIds": [1, 2, 3],
    "actividad": "Tenis",
    "categoria": "Adultos",
    "metodoPago": "MERCADOPAGO"
  },
  "requiresUserAction": "payment" | "confirmation" | "upload" | null,
  "error": "mensaje de error" // si hay error
}
```

---

## 🎨 Experiencia de Usuario

### Interfaz del Chat

**Portal Socio:**
- Botón flotante fijo en esquina inferior derecha
- Color: Rojo (#DC2626) - identidad del club
- Ícono: ⚽ + 💬 (fusión)
- Al abrir: Panel deslizable desde la derecha (mobile) o modal centrado (desktop)

**Panel Admin:**
- Panel lateral colapsable en el sidebar
- Siempre accesible con atajo de teclado: `Ctrl+K` o `/`
- Integrado con el theme del dashboard

### Mensajes de Bienvenida

**Socio:**
```markdown
👋 ¡Hola! Soy **ROJO IA**, tu asistente del Club Sportivo Pilar.

Puedo ayudarte con:
• 💳 Consultar tu deuda y generar links de pago
• 🏃 Inscribirte en actividades
• 📅 Ver tu calendario de entrenamientos
• 🍔 Hacer pedidos en el buffet
• 👨‍👩‍👧 Gestionar tu grupo familiar

**Ejemplos:**
• "Cuál es mi deuda?"
• "Generar link de pago"
• "Inscribirme en tenis"
• "Ver menú del buffet"
```

**Admin:**
```markdown
👋 ¡Hola! Soy **ROJO IA**, tu asistente administrativo.

Puedo ayudarte con:
• 📊 Consultas y reportes
• ⚡ Acciones rápidas (crear cuotas, enviar mails)
• 💰 Estado de cobranzas
• 🏃 Gestión de actividades

**Ejemplos:**
• "Cuántos socios morosos hay?"
• "Crear cuota social julio 2026"
• "Ventas del buffet hoy"
```

---

## 🔐 Seguridad y Permisos

### Validaciones

**Nivel 1 - Autenticación:**
- Portal Socio: validar `tokenPortal` (ya existente)
- Admin: validar JWT + rol de usuario

**Nivel 2 - Contexto:**
- Socio solo puede ver/modificar sus propios datos
- Socio titular puede gestionar grupo familiar
- Admin: permisos según rol (viewer, editor, admin)

**Nivel 3 - Confirmaciones:**
- Acciones críticas requieren confirmación:
  - Pagos > $10.000
  - Baja de actividades
  - Eliminación de datos

### Rate Limiting
```javascript
// Límites por usuario
const limits = {
  socio: 20 // requests por minuto
  admin: 60 // requests por minuto
}
```

---

## 💡 Casos de Uso Detallados

### Caso 1: Socio consulta deuda y paga

**Input usuario:**
> "Cuál es mi deuda?"

**Respuesta AI:**
```json
{
  "accion": "consultar_deuda",
  "entidades": {}
}
```

**Respuesta al usuario:**
```markdown
💳 **Estado de Cuenta**

📊 **Resumen:**
• Cuotas pendientes: 2
• Total a pagar: $45.000

📋 **Detalle:**
1. Cuota Social - Julio 2026: $20.000 (vence 10/07)
2. Cuota Social - Agosto 2026: $25.000 (vence 10/08)

¿Querés generar un link de pago?
```

**Usuario responde:**
> "Sí, generar link"

**Acción AI:**
```json
{
  "accion": "generar_link_pago",
  "entidades": {
    "cuotasIds": [123, 124],
    "metodoPago": "MERCADOPAGO"
  }
}
```

**Respuesta final:**
```markdown
✅ **Link de pago generado**

💰 Monto total: $45.000
📝 Concepto: 2 cuota(s)

[🔗 **Pagar con MercadoPago**](https://mpago.la/xxx)

El link expira en 30 días.
```

---

### Caso 2: Inscripción en actividad

**Input usuario:**
> "Quiero inscribirme en tenis adultos"

**Acción AI:**
```json
{
  "accion": "inscribir_actividad",
  "entidades": {
    "actividad": "Tenis",
    "categoria": "Adultos"
  }
}
```

**Backend verifica:**
1. Actividad existe y está activa ✅
2. Hay cupos disponibles ✅
3. Socio no está ya inscripto ✅
4. No tiene deuda mayor a 2 cuotas ❌

**Respuesta:**
```markdown
⚠️ **No se puede completar la inscripción**

Tenés deuda de 3 cuotas vencidas. Para inscribirte en una actividad nueva, debés regularizar tu situación.

¿Querés generar un link de pago para ponerte al día?
```

---

### Caso 3: Pedido Takeaway

**Input usuario:**
> "Quiero pedir 2 milanesas napolitanas con papas para llevar"

**Acción AI:**
```json
{
  "accion": "crear_pedido_takeaway",
  "entidades": {
    "items": [
      {
        "producto": "Milanesa Napolitana con Papas",
        "cantidad": 2
      }
    ]
  }
}
```

**Respuesta:**
```markdown
🍔 **Pedido TakeAway**

📋 **Items:**
1. Milanesa Napolitana c/Papas x2 - $18.000

💰 **Total: $18.000**

🕐 **Tiempo estimado:** 20-25 minutos

¿Confirmar pedido?
```

**Usuario:**
> "Sí, confirmar"

**Backend:**
- Crea comanda en estado PENDIENTE
- Envía a cocina/impresora
- Retorna número de pedido

**Respuesta:**
```markdown
✅ **Pedido confirmado**

🎫 **Número:** #T-042
🕐 **Listo en:** 20 minutos
📍 **Retirá en:** Buffet (Mostrador Takeaway)

Te avisamos cuando esté listo.
```

---

## 📊 Métricas de Éxito

### KPIs (3 meses post-lanzamiento)

**Adopción:**
- \>30% de socios activos usan ROJO IA al menos 1 vez/mes
- \>50% de nuevos socios lo usan en primera semana

**Engagement:**
- Promedio 5+ interacciones por usuario activo/mes
- \>70% de comandos correctamente interpretados
- \<5% de mensajes respondidos con "no entendí"

**Impacto en Negocio:**
- +20% en tasa de conversión de pagos (link generado → pago efectuado)
- -30% en consultas al personal administrativo
- +15% en inscripciones a actividades

**Calidad:**
- NPS del feature \>60
- Tiempo promedio de respuesta \<2 segundos

---

## 🛠️ Plan de Implementación

### Fase 1: MVP (3-4 semanas)

**Backend:**
- [ ] Integración con Anthropic Claude API
- [ ] Service `aiAssistant.js` con prompts para socios
- [ ] Service `actionExecutor.js` con acciones principales:
  - consultar_deuda
  - generar_link_pago
  - listar_actividades
  - consultar_inscripciones
- [ ] Endpoint `POST /api/chat` con autenticación

**Frontend:**
- [ ] Componente `ChatWidget.jsx` básico
- [ ] Integración con API `/api/chat`
- [ ] Manejo de estados (loading, error)
- [ ] Botones de acción rápida (pago, ver más)

**Testing:**
- [ ] Beta con 20 socios seleccionados
- [ ] Recopilación de feedback

### Fase 2: Expansión (3-4 semanas)

**Nuevas Acciones:**
- [ ] Inscripción/baja de actividades
- [ ] Gestión de grupo familiar
- [ ] Upload de comprobantes con OCR
- [ ] Pedidos takeaway
- [ ] Confirmación de convocatorias

**UX:**
- [ ] Voice input (opcional)
- [ ] Sugerencias automáticas
- [ ] Historial de conversaciones
- [ ] Notificaciones proactivas

**Admin:**
- [ ] Prompts y acciones para admins
- [ ] Panel lateral en dashboard
- [ ] Shortcuts de teclado

### Fase 3: Inteligencia (2-3 semanas)

**Aprendizaje:**
- [ ] Análisis de patrones de uso
- [ ] Mejora continua de prompts
- [ ] Respuestas contextuales basadas en historial

**Analytics:**
- [ ] Dashboard de uso
- [ ] Métricas de satisfacción
- [ ] A/B testing de prompts

---

## 💰 Estimación de Costos

### Desarrollo

| Fase | Horas | Costo Estimado |
|------|-------|----------------|
| Fase 1 (MVP) | 80-100h | - |
| Fase 2 (Expansión) | 60-80h | - |
| Fase 3 (Inteligencia) | 40-50h | - |
| **TOTAL** | **180-230h** | - |

### Infraestructura (mensual)

| Servicio | Costo Estimado |
|----------|----------------|
| Anthropic Claude API (1000-2000 requests/mes) | USD 15-40 |
| Hosting adicional | USD 0 (incluido) |
| **TOTAL** | **USD 15-40/mes** |

**Nota:** Con ~500 socios activos usando 2-4 veces/mes = ~1500 requests/mes

---

## 🎯 Diferenciación Competitiva

### Ventajas de ROJO IA

✅ **Accesibilidad:**
- Lenguaje natural vs formularios complejos
- Disponible 24/7
- Mobile-first

✅ **Eficiencia:**
- Respuestas instantáneas
- Una sola interfaz para todo
- Menos clicks para completar tareas

✅ **Innovación:**
- Pocos clubes tienen IA conversacional
- Feature premium que justifica cuota social
- Marketing: "Club Sportivo Pilar con IA"

✅ **Escalabilidad:**
- Maneja múltiples consultas simultáneas
- Sin costo marginal por usuario adicional
- Mejora con el tiempo (machine learning)

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| IA malinterpreta comandos | Media | Medio | Confirmaciones para acciones críticas, opción "Hablar con persona" |
| Costos de API exceden estimado | Baja | Bajo | Rate limiting, caché agresivo, alertas de uso |
| Usuarios no lo adoptan | Media | Alto | Onboarding proactivo, incentivos (10% off en buffet por usar IA) |
| Problemas de privacidad | Baja | Alto | No guardar datos sensibles, encriptar logs, política de retención |
| Alucinaciones del modelo | Media | Medio | Validar todas las respuestas contra BD, nunca inventar datos |

---

## 📈 Roadmap Futuro

### Post-MVP (6+ meses)

**Multimodal:**
- [ ] Reconocimiento de voz (Speech-to-Text)
- [ ] Respuestas con voz (Text-to-Speech)
- [ ] Upload de fotos/videos (ej: "subir foto del comprobante")

**Integraciones:**
- [ ] WhatsApp Business API (chatbot por WA)
- [ ] Telegram Bot
- [ ] Email: responder emails automáticamente

**Personalización:**
- [ ] Recordatorios inteligentes ("Vence tu cuota en 3 días")
- [ ] Sugerencias proactivas ("Hay un torneo de tenis, ¿te interesa?")
- [ ] Aprendizaje de preferencias ("Siempre pedís milanesa, ¿la de siempre?")

**Gamificación:**
- [ ] Puntos por usar el asistente
- [ ] Badges/logros ("Pagó 12 cuotas seguidas")
- [ ] Ranking de actividad

---

## 📚 Referencias Técnicas

- **Anthropic Claude:** https://docs.anthropic.com/claude
- **shadcn/ui Chat:** https://ui.shadcn.com/examples/chat
- **MercadoPago API:** https://www.mercadopago.com.ar/developers
- **React Voice Input:** https://github.com/speechly/react-client

---

## 🚀 Próximos Pasos

1. **Aprobación de la propuesta** → Reunión con stakeholders
2. **Definir prioridades del MVP** → Qué acciones incluir primero
3. **Setup técnico:**
   - Crear cuenta en Anthropic
   - Obtener API keys
   - Configurar ambiente de desarrollo
4. **Prototipo funcional** → 1 semana
   - Widget básico
   - 3-4 acciones core (deuda, pago, inscripciones)
5. **Beta privada** → 2 semanas con usuarios seleccionados
6. **Launch gradual** → Rollout por segmentos (primero jóvenes tech-savvy, luego resto)

---

**Documento creado:** 2026-03-12
**Versión:** 1.0
**Autores:** Equipo RojoPlus + Claude Code
