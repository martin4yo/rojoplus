# Guía de Implementación — Evolution API (WhatsApp)

## Índice
1. [Instalación en el servidor](#1-instalación-en-el-servidor)
2. [Configuración del .env](#2-configuración-del-env)
3. [Levantar con PM2](#3-levantar-con-pm2)
4. [Configuración nginx](#4-configuración-nginx)
5. [Certificado SSL](#5-certificado-ssl)
6. [Crear una instancia por tenant](#6-crear-una-instancia-por-tenant)
7. [Conectar WhatsApp (QR)](#7-conectar-whatsapp-qr)
8. [Parámetros de configuración por tenant](#8-parámetros-de-configuración-por-tenant)
9. [Configurar desde el panel de administración](#9-configurar-desde-el-panel-de-administración)
10. [Operaciones comunes](#10-operaciones-comunes)
11. [Buenas prácticas para no ser baneado](#11-buenas-prácticas-para-no-ser-baneado)
12. [Troubleshooting — problemas comunes durante la puesta en marcha](#12-troubleshooting--problemas-comunes-durante-la-puesta-en-marcha)

---

## 1. Instalación en el servidor

### Crear usuario y base de datos PostgreSQL

```bash
# Crear usuario dedicado para Evolution API
sudo -u postgres psql -c "CREATE USER evolutionapp WITH PASSWORD 'CAMBIAR_POR_PASSWORD';"

# Crear la base de datos con ese usuario como dueño
sudo -u postgres psql -c "CREATE DATABASE evolution OWNER evolutionapp;"
```

### Crear usuario del sistema

```bash
# Crear usuario Linux sin shell de login
useradd --system --no-create-home --shell /usr/sbin/nologin evolutionapp

# Crear directorio de la app
mkdir -p /var/www/evolution-api
chown evolutionapp:evolutionapp /var/www/evolution-api
```

### Clonar e instalar como usuario evolutionapp

```bash
sudo -u evolutionapp git clone https://github.com/EvolutionAPI/evolution-api.git /var/www/evolution-api
cd /var/www/evolution-api
sudo -u evolutionapp npm install

# Copiar archivo de configuración
sudo -u evolutionapp cp .env.example .env
```

---

## 2. Configuración del .env

Editar `/var/www/evolution-api/.env` como usuario evolutionapp:

```bash
sudo -u evolutionapp nano /var/www/evolution-api/.env
```

```env
# Servidor
SERVER_PORT=8080
SERVER_URL=https://evolution.axiomacloud.com

# Autenticación — cambiar por una clave larga y segura
AUTHENTICATION_API_KEY=CAMBIAR_POR_CLAVE_SECRETA_LARGA

# Base de datos — usuario dedicado, no postgres
DATABASE_ENABLED=true
DATABASE_CONNECTION_URI=postgresql://evolutionapp:CAMBIAR_POR_PASSWORD@localhost:5432/evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false

# Redis (deshabilitado por ahora)
REDIS_ENABLED=false

# Logs
LOG_LEVEL=ERROR
LOG_COLOR=true

# Webhooks globales (opcional)
WEBHOOK_GLOBAL_ENABLED=false
```

Luego inicializar la base de datos como usuario evolutionapp:

```bash
cd /var/www/evolution-api
sudo -u evolutionapp npx prisma generate
sudo -u evolutionapp npx prisma db push
```

---

## 3. Levantar con PM2

PM2 debe correr como usuario `evolutionapp`, no como root.

```bash
# Instalar PM2 globalmente si no está (una sola vez)
npm install -g pm2

# Levantar la app como usuario evolutionapp
sudo -u evolutionapp bash -c "cd /var/www/evolution-api && pm2 start npm --name evolution-api -- start"

# Guardar la lista de procesos
sudo -u evolutionapp pm2 save

# Configurar startup para que arranque con el sistema
# Este comando lo ejecutás como root y te da un comando a copiar y ejecutar
sudo -u evolutionapp pm2 startup systemd -u evolutionapp --hp /home/evolutionapp
```

> El comando `pm2 startup` devuelve algo como:
> `sudo env PATH=... pm2 startup systemd -u evolutionapp --hp /home/evolutionapp`
> Copiarlo y ejecutarlo como root para registrar el servicio systemd.

Verificar que esté corriendo:

```bash
sudo -u evolutionapp pm2 status
sudo -u evolutionapp pm2 logs evolution-api --lines 50
```

---

## 4. Configuración nginx

Crear `/etc/nginx/sites-available/evolution.conf`:

```nginx
server {
    listen 80;
    server_name evolution.axiomacloud.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name evolution.axiomacloud.com;

    ssl_certificate /etc/letsencrypt/live/evolution.axiomacloud.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evolution.axiomacloud.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }
}
```

Habilitar y recargar:

```bash
ln -s /etc/nginx/sites-available/evolution.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 5. Certificado SSL

Primero crear el registro DNS:

```
Tipo:   A
Nombre: evolution
Valor:  (IP del servidor)
```

Esperar a que propague y luego:

```bash
certbot --nginx -d evolution.axiomacloud.com
```

---

## 6. Crear una instancia por tenant

Cada tenant necesita su propia instancia (su propio número de WhatsApp).

```bash
curl -X POST https://evolution.axiomacloud.com/instance/create \
  -H "apikey: TU_API_KEY_GLOBAL" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "sportivo-pilar",
    "integration": "WHATSAPP-BAILEYS"
  }'
```

La respuesta incluye un `token` propio de esa instancia — guardarlo en la config del tenant.

---

## 7. Conectar WhatsApp (QR)

Una vez creada la instancia, obtener el QR para que el admin del club escanee con su celular:

```bash
curl https://evolution.axiomacloud.com/instance/connect/sportivo-pilar \
  -H "apikey: TU_API_KEY_GLOBAL"
```

Responde con una URL de imagen QR o el código base64. El admin lo escanea desde **WhatsApp > Dispositivos vinculados > Vincular dispositivo**.

Verificar estado de conexión:

```bash
curl https://evolution.axiomacloud.com/instance/connectionState/sportivo-pilar \
  -H "apikey: TU_API_KEY_GLOBAL"
```

Respuesta esperada: `{ "state": "open" }` = conectado.

---

## 8. Parámetros de configuración por tenant

Estos parámetros se guardan en la tabla `Configuracion` de cada tenant desde el panel de administración:

| Clave | Descripción | Ejemplo |
|-------|-------------|---------|
| `WHATSAPP_ENABLED` | Habilitar envío de WhatsApp | `true` |
| `WHATSAPP_API_URL` | URL base de Evolution API | `https://evolution.axiomacloud.com` |
| `WHATSAPP_INSTANCE` | Nombre de la instancia del tenant | `sportivo-pilar` |
| `WHATSAPP_API_KEY` | Token de la instancia (no el global) | `abc123...` |
| `WHATSAPP_DELAY_MS` | Delay entre mensajes en ms | `3000` |
| `WHATSAPP_HORA_INICIO` | Hora mínima de envío | `8` |
| `WHATSAPP_HORA_FIN` | Hora máxima de envío | `21` |

### Eventos configurables (activar/desactivar por tenant)

| Clave | Descripción | Default |
|-------|-------------|---------|
| `WHATSAPP_NOTIF_PAGO` | Confirmación de pago de cuota | `true` |
| `WHATSAPP_NOTIF_VENCIMIENTO` | Aviso de cuota por vencer | `true` |
| `WHATSAPP_NOTIF_MORA` | Aviso de cuota vencida | `true` |
| `WHATSAPP_NOTIF_MAGIC_LINK` | Envío de link de acceso al portal | `false` |
| `WHATSAPP_NOTIF_RESERVA` | Confirmación de reserva de cancha | `false` |
| `WHATSAPP_NOTIF_TAKEAWAY` | Aviso de pedido listo (TakeAway) | `false` |

---

## 9. Configurar desde el panel de administración

### Paso 1 — Habilitar la funcionalidad (Super-admin)

Desde el panel de super-administración (**Gestión de Tenants → [Tenant] → Funcionalidades**):

- Activar el switch **"Notificaciones por WhatsApp"** → escribe `PLAN_FEATURE_WHATSAPP=true`
- Activar el switch **"Agente de IA"** (solo si WhatsApp está habilitado) → escribe `PLAN_FEATURE_WA_AGENT=true`

Estos switches son del nivel del plan contratado. Si no están activos, el tenant no verá las tarjetas de configuración.

### Paso 2 — Configurar la conexión (Admin del tenant)

Ir a **Configuración → Notificaciones → tarjeta "Conexión WhatsApp"**:

| Campo | Valor |
|-------|-------|
| URL de la API | `https://evolution.axiomacloud.com` |
| Instancia | nombre creado en el paso 6 (ej: `sportivo-pilar`) |
| API Key | token devuelto al crear la instancia (**no** la clave global) |
| Delay entre mensajes | `3000` ms recomendado |
| Hora inicio / Hora fin | rango horario de envío permitido |

> **Importante:** activar el switch de habilitado en la tarjeta y hacer click en **Guardar** antes de verificar el estado. Si el switch está en `false`, la verificación devolverá "No configurado" aunque los datos sean correctos.

### Paso 3 — Verificar la conexión

Hacer click en **Verificar estado**. El resultado esperado es:

- **Conectado** (verde): la instancia está online y lista para enviar mensajes
- **Desconectado**: la instancia está creada pero no hay QR escaneado → repetir paso 7
- **No configurado**: faltan datos o el switch de habilitado está en `false`

### Paso 4 — Enviar un mensaje de prueba

En la misma tarjeta, sección **"Enviar mensaje de prueba"**:
1. Ingresar el número en formato `549XXXXXXXXXX`
2. Escribir el texto
3. Click en **Enviar**

Si el mensaje llega al celular, la integración está funcionando correctamente.

### Paso 5 — Configurar el Agente de IA (opcional)

Si está habilitado en el plan, aparece la tarjeta **"Agente de IA"**:

| Campo | Descripción |
|-------|-------------|
| Switch | Activa/desactiva el agente (la instancia sigue conectada; solo deja de responder automáticamente) |
| Hora inicio / fin | Rango horario en que el agente responde |
| Mensaje fuera de horario | Texto automático cuando el socio escribe fuera del horario |

> Requiere que `ANTHROPIC_API_KEY` esté configurada en el `.env` del servidor backend.

### Paso 6 — Configurar eventos de notificación

En la tarjeta **"Eventos de Notificación"**, activar/desactivar qué acciones disparan un mensaje automático al socio:

| Evento | Cuándo se dispara |
|--------|-------------------|
| Confirmación de pago | Al registrar un pago |
| Aviso de vencimiento | Días antes del vencimiento de cuota |
| Aviso de mora | Al tener cuotas vencidas |
| Link del portal | Al generar acceso al portal del socio |

---

## 10. Operaciones comunes

### Enviar un mensaje de prueba

```bash
curl -X POST https://evolution.axiomacloud.com/message/sendText/sportivo-pilar \
  -H "apikey: TOKEN_DE_LA_INSTANCIA" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5491112345678",
    "text": "Hola! Este es un mensaje de prueba desde Clubix."
  }'
```

El número debe incluir código de país sin `+` ni `0`: `549` + código de área + número.

### Ver todas las instancias

```bash
curl https://evolution.axiomacloud.com/instance/fetchInstances \
  -H "apikey: TU_API_KEY_GLOBAL"
```

### Desconectar una instancia

```bash
curl -X DELETE https://evolution.axiomacloud.com/instance/logout/sportivo-pilar \
  -H "apikey: TU_API_KEY_GLOBAL"
```

### Reconectar (nuevo QR)

```bash
curl https://evolution.axiomacloud.com/instance/connect/sportivo-pilar \
  -H "apikey: TU_API_KEY_GLOBAL"
```

### Reiniciar Evolution API

```bash
sudo -u evolutionapp pm2 restart evolution-api
sudo -u evolutionapp pm2 logs evolution-api --lines 100
```

### Actualizar a nueva versión

```bash
cd /var/www/evolution-api
sudo -u evolutionapp git pull
sudo -u evolutionapp npm install
sudo -u evolutionapp npx prisma generate
sudo -u evolutionapp pm2 restart evolution-api
```

---

## 11. Buenas prácticas para no ser baneado

### Reglas estrictas
- **Solo enviar a números que dieron su número voluntariamente** (socios registrados)
- **Nunca enviar el mismo texto idéntico** a muchos números seguidos — personalizar siempre con nombre, número de socio, monto, etc.
- **Respetar el horario** configurado en `WHATSAPP_HORA_INICIO` / `WHATSAPP_HORA_FIN`
- **Delay entre mensajes**: mínimo 3 segundos entre cada envío (`WHATSAPP_DELAY_MS`)
- **No usar para campañas masivas** — solo notificaciones transaccionales (pago, vencimiento, etc.)

### Calentamiento del número nuevo
Un número recién conectado no debe enviar muchos mensajes el primer día.

| Semana | Máximo por día |
|--------|---------------|
| 1 | 20 mensajes |
| 2 | 50 mensajes |
| 3 | 100 mensajes |
| 4+ | Sin límite estricto |

### Si WhatsApp banea la cuenta
1. La instancia quedará en estado `close` o `conflict`
2. El sistema debe detectarlo y no seguir enviando
3. Hay que usar un número diferente y reconectar
4. Los baneos temporales se levantan solos en 24-72 horas en casos leves

### Formato del número
```
✓ 5491112345678    (código país + área + número, sin espacios ni símbolos)
✗ +54 9 11 1234-5678
✗ 011 1234-5678
```

---

## 12. Troubleshooting — problemas comunes durante la puesta en marcha

### `npm install` falla con EACCES `/home/evolutionapp`

El usuario `evolutionapp` no tiene directorio home. Solución:

```bash
mkdir -p /home/evolutionapp
chown evolutionapp:evolutionapp /home/evolutionapp
usermod -d /home/evolutionapp evolutionapp
# Reintentar:
sudo -u evolutionapp npm install
```

### `npm install` falla con EACCES en `package-lock.json`

Los archivos fueron clonados como `root`. Solución:

```bash
chown -R evolutionapp:evolutionapp /var/www/evolution-api
sudo -u evolutionapp npm install
```

### `prisma generate` falla con "Could not find Prisma Schema"

Evolution API v2 usa un schema en ubicación no estándar. Hay que especificarlo:

```bash
sudo -u evolutionapp npx prisma generate --schema ./prisma/postgresql-schema.prisma
sudo -u evolutionapp npx prisma db push --schema ./prisma/postgresql-schema.prisma
```

### PM2 falla con `MODULE_NOT_FOUND @opentelemetry/api-logs`

La instalación de `node_modules` quedó incompleta o corrompida. Solución:

```bash
cd /var/www/evolution-api
sudo -u evolutionapp rm -rf node_modules package-lock.json
sudo -u evolutionapp npm install
sudo -u evolutionapp npx prisma generate --schema ./prisma/postgresql-schema.prisma
sudo -u evolutionapp pm2 restart evolution-api
```

### `POST /instance/create` devuelve 401 Unauthorized

La `apikey` en el header es incorrecta o no coincide con `AUTHENTICATION_API_KEY` en el `.env`.

Verificar:
```bash
grep AUTHENTICATION_API_KEY /var/www/evolution-api/.env
```

El curl debe usar la clave exacta, sin espacios ni saltos de línea:
```bash
curl --http1.1 -X POST https://evolution.axiomacloud.com/instance/create \
  -H "apikey:TU_CLAVE_SIN_ESPACIO_DESPUES_DE_LOS_DOS_PUNTOS" \
  -H "Content-Type:application/json" \
  -d '{"instanceName":"nombre","integration":"WHATSAPP-BAILEYS"}'
```

> Nota: algunos clientes curl en versiones antiguas rompen headers multilínea. Usar siempre todo en una sola línea.

### `POST /instance/create` devuelve 400 "Invalid integration"

El valor correcto es `"WHATSAPP-BAILEYS"` (con guion, no underscore). Confirmado leyendo el enum en el fuente de Evolution API v2:

```typescript
// src/api/types/wa.types.ts
export enum Integration {
  WHATSAPP_BAILEYS = 'WHATSAPP-BAILEYS',
}
```

### Error HTTP/2 stream en curl

Forzar HTTP/1.1:

```bash
curl --http1.1 -X POST ...
```

### El QR no se puede escanear desde WhatsApp

- Verificar que el QR no haya expirado (tienen ~60 segundos de vida)
- Pedir un nuevo QR con `GET /instance/connect/{instancia}`
- Asegurarse de usar **WhatsApp → Dispositivos vinculados → Vincular un dispositivo** (no "Vincular por número")

### La verificación de estado dice "No configurado" o "Desconectado"

Causas más comunes:

1. **El switch de habilitado en la tarjeta de configuración está en `false`** → activarlo y hacer click en **Guardar** antes de verificar
2. **Falta algún campo requerido** (URL, instancia o API key) → completar y guardar
3. **La instancia no tiene QR escaneado** → repetir el paso de conexión QR
4. **La API key usada en el panel es la clave global** del servidor, no el token de la instancia → usar el token devuelto al crear la instancia

### Preferencias de notificación del socio

Los socios tienen dos flags individuales que controlan si reciben notificaciones:
- `notifEmail` (default: `false`)
- `notifWhatsapp` (default: `false`)

Si un mensaje no llega al socio, verificar que tenga `notifWhatsapp = true` en su ficha. El socio puede activarlo desde su portal en **Notificaciones → Canales**. El admin puede verlo en la ficha del socio tab **Contacto** y editarlo desde el formulario de edición.
