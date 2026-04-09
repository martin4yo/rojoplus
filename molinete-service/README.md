# Servicio de Control de Molinete - RojoPlus

Servicio standalone Node.js para control de acceso con molinete, lectores USB/Serial y validación online/offline.

## Características

- Lectura de QR, código de barras DNI (PDF417) y RFID
- Validación online con API central
- Modo offline con cache SQLite local
- Control automático de molinete (relay)
- Sincronización automática cada X minutos
- Interface web de monitoreo en tiempo real
- WebSocket para eventos en vivo
- Registro de intentos denegados para gestión remota
- Logging completo con rotación de archivos

---

## Guías de instalación

- [Instalación en Windows](INSTALACION_WINDOWS.md)
- [Instalación en Linux (Ubuntu/Debian)](INSTALACION_LINUX.md)

---

## Ejecución rápida (una vez instalado)

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

Monitor web: **http://localhost:3002**

---

## Integración con otras aplicaciones

El servicio expone una API REST y WebSocket locales en el puerto `3002`.

### API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/status` | GET | Estado del sistema y conexiones |
| `/api/sync` | POST | Forzar sincronización con el servidor |
| `/api/abrir` | POST | Abrir el molinete manualmente |

### WebSocket

Conectarse a `ws://localhost:3002/ws` para recibir eventos en tiempo real.

Eventos emitidos:

```javascript
const ws = new WebSocket('ws://localhost:3002/ws')

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)

  if (msg.tipo === 'ACCESO') {
    // msg.data: { resultado, persona, motivo, tipoLectura, valorLeido, fecha }
    // resultado: 'PERMITIDO' | 'DENEGADO'
  }

  if (msg.tipo === 'PANTALLA') {
    // msg.data: { estado, titulo, mensaje, color, duracion }
    // color: 'verde' | 'rojo'
  }
}
```

### Flujo de validación

El molinete consulta la API central por cada credencial leída. El servidor decide si permitir o denegar:

```
Lector escanea credencial
        ↓
POST /accesos/validar  →  Servidor RojoPlus
        ↓
  { permitido: true/false, motivo, persona }
        ↓
  true  → Activa relay → Molinete abre
  false → No activa relay → Molinete permanece cerrado
```

Respuesta esperada del servidor:
```json
{
  "success": true,
  "data": {
    "permitido": true,
    "motivo": "SOCIO_VIGENTE",
    "mensaje": "Bienvenido/a Juan García",
    "persona": {
      "id": 123,
      "nombre": "Juan García",
      "nroSocio": "00456",
      "documento": "28123456"
    }
  }
}
```

Motivos de rechazo:

| Motivo | Pantalla | Descripción |
|--------|----------|-------------|
| `SOCIO_VIGENTE` | Verde | Acceso permitido |
| `HABILITACION_VIGENTE` | Verde | Habilitación temporal válida |
| `NO_VIGENTE` | Rojo | Socio encontrado pero no habilitado |
| `NO_ENCONTRADO` | Rojo | DNI/QR desconocido |
| `VENCIDO` | Rojo | Habilitación temporal expirada |
| `LIMITE_ALCANZADO` | Rojo | Agotó los accesos permitidos |
| `HORARIO` | Rojo | Fuera del horario permitido |
| `ERROR_CONEXION` | Rojo | Sin conexión y sin modo offline |

---

## Base de Datos Local

SQLite en `db/cache.db`:

| Tabla | Contenido |
|-------|-----------|
| `socios` | Cache de socios VIGENTES para validación offline |
| `habilitaciones` | Cache de habilitaciones temporales vigentes |
| `registros_pendientes` | Accesos que no pudieron enviarse al servidor |
| `metadata` | Último sync, versión, etc. |

---

## Logs

Archivos en `logs/molinete.log` — rotación automática (10MB x 5 archivos).

---

## Licencia

Privado - RojoPlus © 2024
