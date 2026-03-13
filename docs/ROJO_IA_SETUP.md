# ROJO IA - Setup e Instalación

## 🚀 Configuración Inicial

### 1. Instalar Dependencias

El SDK de Anthropic ya está instalado:

```bash
cd server
npm install @anthropic-ai/sdk
```

### 2. Obtener API Key de Anthropic

1. Ir a https://console.anthropic.com/
2. Crear una cuenta o iniciar sesión
3. Ir a "API Keys"
4. Crear una nueva API key
5. Copiar la clave (empieza con `sk-ant-api03-...`)

### 3. Configurar Variables de Entorno

Agregar en `server/.env`:

```env
# Anthropic Claude API (para ROJO IA)
ANTHROPIC_API_KEY=sk-ant-api03-tu-clave-aqui
```

### 4. Verificar Instalación

```bash
# Iniciar el servidor
cd server
npm run dev

# En otra terminal, hacer un health check
curl http://localhost:3001/api/chat/health
```

Deberías ver:
```json
{
  "available": true,
  "service": "ROJO IA - Chat Assistant",
  "model": "claude-sonnet-4-20250514"
}
```

---

## 📡 Testing de la API

### Endpoint Principal

**POST** `/api/chat`

#### Request Body:

```json
{
  "message": "Cuál es mi deuda?",
  "tokenPortal": "token-del-socio",
  "role": "socio"
}
```

#### Roles disponibles:
- `socio` - Para socios del club (requiere `tokenPortal`)
- `camarero` - Para camareros del buffet
- `admin` - Para administradores

### Ejemplos con cURL

#### 1. Consultar deuda (Socio)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cuál es mi deuda?",
    "tokenPortal": "abc123xyz",
    "role": "socio"
  }'
```

#### 2. Generar link de pago (Socio)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Generar link de pago para todas mis cuotas",
    "tokenPortal": "abc123xyz",
    "role": "socio"
  }'
```

#### 3. Ver mesas (Camarero)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Qué mesas están ocupadas?",
    "role": "camarero"
  }'
```

#### 4. Agregar items a mesa (Camarero)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Agregar 2 cervezas y una pizza a la mesa 5",
    "role": "camarero"
  }'
```

#### 5. Ver cuenta de mesa (Camarero)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Ver cuenta de mesa 8",
    "role": "camarero"
  }'
```

---

## 🎨 Integración Frontend

### React Component Básico

```jsx
import { useState } from 'react'

function ChatAssistant({ tokenPortal }) {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          tokenPortal,
          role: 'socio'
        })
      })

      const data = await res.json()
      setResponse(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe tu consulta..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>

      {response && (
        <div>
          <p>{response.message}</p>
        </div>
      )}
    </div>
  )
}
```

---

## 🧪 Casos de Prueba

### Para Socios

| Comando | Acción Esperada |
|---------|----------------|
| "Cuál es mi deuda?" | Muestra cuenta corriente |
| "Generar link de pago" | Crea link de MercadoPago |
| "Inscribirme en tenis" | Procesa inscripción |
| "Ver menú del buffet" | Muestra menú con precios |
| "Pedir 2 milanesas para llevar" | Crea pedido takeaway |

### Para Camareros

| Comando | Acción Esperada |
|---------|----------------|
| "Qué mesas están ocupadas?" | Lista mesas ocupadas |
| "Abrir mesa 5" | Activa la mesa 5 |
| "Agregar 3 cervezas a mesa 8" | Agrega items a comanda |
| "Ver cuenta de mesa 7" | Muestra cuenta completa |
| "Comandas pendientes" | Lista comandas en cocina |

### Para Admins

| Comando | Acción Esperada |
|---------|----------------|
| "Cuántos socios morosos hay?" | Estadísticas de morosidad |
| "Ventas del buffet hoy" | Reporte de ventas |

---

## 🔧 Troubleshooting

### Error: "AI Assistant no está configurado"

**Causa:** No se configuró la API key de Anthropic

**Solución:**
1. Verificar que existe `ANTHROPIC_API_KEY` en `.env`
2. Verificar que la key es válida (empieza con `sk-ant-api03-`)
3. Reiniciar el servidor

### Error: "Token inválido"

**Causa:** El `tokenPortal` no existe en la base de datos

**Solución:**
1. Verificar que el socio existe: `SELECT * FROM socios WHERE token_portal = 'abc123'`
2. Usar un token válido de un socio existente

### Error: "No se pudo parsear la respuesta de IA"

**Causa:** Claude no respondió con JSON válido (raro)

**Solución:**
1. Verificar logs del servidor para ver la respuesta cruda
2. Puede ser que el prompt necesite ajustes
3. Reintentar el comando

---

## 💰 Costos Estimados

Con **500 socios activos** usando el asistente **2-4 veces/mes**:

- **Requests/mes:** ~1500-2000
- **Costo aproximado:** USD 15-40/mes
- **Costo por request:** ~USD 0.01-0.02

El modelo usado es `claude-sonnet-4-20250514`:
- **Input:** $3 / 1M tokens
- **Output:** $15 / 1M tokens

Promedio por request:
- Input: ~500 tokens
- Output: ~300 tokens
- **Costo/request:** ~$0.006

---

## 📊 Monitoreo

### Logs del Servidor

El asistente loguea cada interacción:

```
🤖 [ROJO IA] Procesando comando...
   Usuario: Juan Pérez (socio)
   Rol: socio
   Mensaje: "Cuál es mi deuda?"
📤 Respuesta de Claude recibida (245 caracteres)
✅ Acción identificada: consultar_deuda
🎬 [ActionExecutor] Ejecutando: consultar_deuda
✅ ===== SOLICITUD COMPLETADA =====
```

### Métricas a Trackear

- Total de comandos procesados
- Comandos por rol (socio/camarero/admin)
- Acciones más usadas
- Tasa de error
- Tiempo de respuesta promedio

---

## 🚀 Próximos Pasos

1. **Crear ChatWidget frontend** (componente React)
2. **Implementar autenticación para camareros**
3. **Implementar autenticación para admins**
4. **Agregar funcionalidades faltantes** (marcar como TODO en actionExecutor.js)
5. **Testing con usuarios reales**
6. **Recopilar feedback y mejorar prompts**

---

## 📚 Referencias

- **Anthropic Claude Docs:** https://docs.anthropic.com/claude/reference
- **Propuesta completa:** `docs/PROPUESTA_ASISTENTE_IA.md`
- **Código Backend:**
  - `server/src/services/aiAssistant.js` - Servicio AI
  - `server/src/services/actionExecutor.js` - Ejecutor de acciones
  - `server/src/routes/chat.js` - Endpoints HTTP

---

**Creado:** 2026-03-12
**Versión:** 1.0
**Autor:** Equipo RojoPlus
