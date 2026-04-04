# Agente IA por WhatsApp

Sistema de atención automática vía WhatsApp para socios, con soporte multi-proveedor de IA y notificaciones automáticas por evento.

---

## Arquitectura General

```
Socio WhatsApp
    │
    ▼
Evolution API (instancia por tenant)
    │  webhook POST /api/whatsapp/webhook
    ▼
server/src/routes/whatsapp/webhook.js
    │  verificaciones: rate limit, tenant, horario, agente habilitado
    ▼
server/src/routes/whatsapp/agente.js  — procesarMensajeAgente()
    │  carga config IA, historial, system prompt, tools
    ├─► Anthropic SDK (claude-haiku / sonnet / opus)
    └─► fetch → OpenAI API (gpt-4o-mini / gpt-4o)
         │
         ▼  herramientas: consultarEstadoCuenta, buscarActividades, consultarHorarios
         │
         ▼
server/src/services/whatsappService.js  — enviarWhatsApp()
    │
    ▼
Evolution API  →  Socio
```

---

## Archivos

| Archivo | Rol |
|---------|-----|
| `server/src/routes/whatsapp/webhook.js` | Entry point de mensajes y endpoints de configuración |
| `server/src/routes/whatsapp/agente.js` | Lógica del agente IA (multi-proveedor, tools, historial) |
| `server/src/services/whatsappService.js` | Envío de mensajes, configuración Evolution API, templates, notificaciones |
| `server/src/config/aiModels.js` | Mapa de tiers → modelos por proveedor |

---

## Configuración por Tenant (tabla `Configuracion`)

### WhatsApp / Evolution API
| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| `WHATSAPP_ENABLED` | Habilita el envío de mensajes | `true` |
| `WHATSAPP_API_URL` | URL base de Evolution API | `https://evo.clubix.com.ar` |
| `WHATSAPP_INSTANCE` | Nombre de la instancia | `clubpilar` |
| `WHATSAPP_API_KEY` | API key de Evolution API | `abc123...` |
| `WHATSAPP_DELAY_MS` | Delay entre mensajes (masivo) | `3000` |
| `WHATSAPP_HORA_INICIO` | Hora inicio envíos (0–23) | `8` |
| `WHATSAPP_HORA_FIN` | Hora fin envíos (0–23) | `21` |

### Agente IA
| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| `WA_AGENT_ENABLED` | Activa el agente IA | `true` |
| `WA_AGENT_HORARIO_INICIO` | Hora inicio atención agente | `7` |
| `WA_AGENT_HORARIO_FIN` | Hora fin atención agente | `23` |
| `WA_AGENT_MSG_FUERA_HORARIO` | Mensaje fuera de horario | `Hola! Nuestro horario de atención es...` |

### Proveedor de IA
| Clave | Descripción | Valores |
|-------|-------------|---------|
| `AI_PROVIDER` | Proveedor de IA | `anthropic` \| `openai` |
| `AI_MODEL_TIER` | Tier de modelo | `rapido` \| `estandar` \| `premium` |
| `AI_API_KEY` | API key del proveedor (opcional, usa env var si no está) | `sk-ant-...` |
| `AI_MODEL_OVERRIDE` | Forzar un modelo específico (omitir tier) | `claude-haiku-4-5-20251001` |

### Notificaciones Automáticas (flags globales)
| Clave | Controla | Default |
|-------|----------|---------|
| `WHATSAPP_NOTIF_PAGO` | Confirmación de pago | `true` |
| `WHATSAPP_NOTIF_VENCIMIENTO` | Cuota próxima a vencer y vencida | `true` |
| `WHATSAPP_NOTIF_MORA` | Recordatorio de morosidad | `true` |
| `WHATSAPP_NOTIF_MAGIC_LINK` | Link de acceso al portal | `true` |

### Templates de Notificaciones (personalizables)
| Clave | Variables disponibles |
|-------|----------------------|
| `NOTIF_WA_PAGO` | `{{nombre}}`, `{{monto}}` |
| `NOTIF_WA_VENCIMIENTO` | `{{nombre}}`, `{{monto}}`, `{{vencimiento}}` |
| `NOTIF_WA_MORA` | `{{nombre}}`, `{{total}}` |
| `NOTIF_WA_PORTAL` | `{{nombre}}`, `{{link}}` |

Si la clave no existe, se usa el template default definido en `whatsappService.js`.

---

## Sistema de Tiers de Modelos

`server/src/config/aiModels.js` centraliza el mapa tier → modelo:

```javascript
export const AI_MODEL_MAP = {
  anthropic: {
    rapido:    'claude-haiku-4-5-20251001',
    estandar:  'claude-sonnet-4-6',
    premium:   'claude-opus-4-6',
  },
  openai: {
    rapido:    'gpt-4o-mini',
    estandar:  'gpt-4o',
    premium:   'gpt-4o',
  },
}
```

Cuando un modelo se depreca, se actualiza **una sola línea** en este archivo + redeploy. Los tenants no necesitan cambiar su configuración.

`AI_MODEL_OVERRIDE` permite forzar un modelo específico para un tenant sin cambiar el tier.

---

## Historial de Conversación

- Se almacena **en memoria** (Map keyed por teléfono) durante la sesión del servidor.
- Formato provider-agnostic: `[{ role: 'user'|'assistant', content: string }]`
- Máximo 20 intercambios, luego se descarta el más antiguo.
- Al reiniciar el servidor se pierde — intencional para mantener conversaciones frescas.

---

## Herramientas (Tools) disponibles para el agente

| Tool | Descripción |
|------|-------------|
| `consultarEstadoCuenta` | Cuotas pendientes, vencidas y últimos pagos del socio |
| `buscarActividades` | Actividades disponibles en el club con categorías |
| `consultarHorarios` | Horarios de atención del club |

---

## Flujo de Configuración Automática (webhook)

Al guardar la configuración de WhatsApp en el panel admin con `enabled=true`:

1. Frontend llama `POST /api/admin/whatsapp/configurar-webhook`
2. Backend ejecuta `configurarWebhookEvolution(db)`:
   - `GET {apiUrl}/instance/fetchInstances` — verifica si la instancia existe
   - Si no existe: `POST {apiUrl}/instance/create` con `integration: WHATSAPP-BAILEYS`
   - `POST {apiUrl}/webhook/set/{instance}` — registra la URL del webhook
3. Devuelve `{ ok: true, webhookUrl }` o el error correspondiente

La URL del webhook se forma como: `${API_URL}/api/whatsapp/webhook`
(`API_URL` se configura en `.env` del servidor, ej: `https://api.clubix.com.ar`)

---

## Flujo de Notificaciones Automáticas

Las notificaciones respetan **dos capas de control**:

1. **Flag global del tenant** (`WHATSAPP_NOTIF_*`): si es `'false'`, nunca se envía ese tipo.
2. **Preferencia del socio** (`notifWhatsapp: true/false`): si el socio deshabilitó WA, no recibe nada.

```
notifWhatsapp === true  &&  celular presente
        │
        ▼
  leer WHATSAPP_NOTIF_XXX del tenant
        │  !== 'false' (default: enviar)
        ▼
  enviarWhatsApp() → respeta WHATSAPP_HORA_INICIO/FIN
```

Los emails también respetan `socio.notifEmail` en el procesador de cola (`procesarNotificacionesPendientes`).

---

## Endpoints WhatsApp

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/whatsapp/webhook` | Recibe mensajes de Evolution API |
| `GET` | `/api/whatsapp/status` | Estado de conexión de la instancia |
| `POST` | `/api/admin/whatsapp/configurar-webhook` | Auto-setup del webhook en Evolution API |
| `POST` | `/api/whatsapp/test` | Envía mensaje de prueba (admin) |

---

## Variables de Entorno

```env
ANTHROPIC_API_KEY=sk-ant-...    # Fallback si el tenant no tiene AI_API_KEY
OPENAI_API_KEY=sk-...           # Fallback para provider openai
API_URL=https://api.clubix.com.ar        # URL pública del backend (para webhook)
FRONTEND_URL=https://app.clubix.com.ar   # URL del portal (para magic links)
```

---

## Rate Limiting

El webhook incluye un rate limit en memoria: **máx. 5 mensajes por minuto por número de teléfono**. Se limpia automáticamente cada 5 minutos. Previene abuso en el agente IA.
