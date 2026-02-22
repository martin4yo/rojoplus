# 🚪 Servicio de Control de Molinete - RojoPlus

Servicio standalone Node.js para control de acceso con molinete, lectores USB/Serial y validación online/offline.

## 📋 Características

- ✅ Lectura de QR, código de barras DNI (PDF417) y RFID
- ✅ Validación online con API central
- ✅ Modo offline con cache SQLite local
- ✅ Control automático de molinete (relay)
- ✅ Señalización LED y buzzer
- ✅ Sincronización automática cada X minutos
- ✅ Interface web de monitoreo en tiempo real
- ✅ WebSocket para eventos en vivo
- ✅ Registro de intentos denegados para gestión remota
- ✅ Logging completo con rotación de archivos

## 🔧 Instalación

### 1. Instalar dependencias

```bash
cd molinete-service
npm install
```

### 2. Configurar hardware

#### Detectar lector USB (código de barras/QR)

```bash
npm run detectar-usb
```

Copie el `vendorId` y `productId` del lector en `config.json`.

#### Detectar lector RFID (puerto serial)

```bash
npm run detectar-rfid
```

Copie el nombre del puerto (ej: COM3) en `config.json`.

### 3. Configurar `config.json`

Edite `config.json` con los valores correctos:

```json
{
  "apiUrl": "http://localhost:3001/api",
  "dispositivoId": 1,

  "lectorUSB": {
    "vendorId": "0x05FE",  // Cambiar según su lector
    "productId": "0x1010",  // Cambiar según su lector
    "habilitado": true
  },

  "lectorRFID": {
    "puerto": "COM3",  // Cambiar según su sistema
    "baudRate": 9600,
    "habilitado": true
  },

  "molinete": {
    "tipo": "USB_RELAY",
    "puerto": "COM4",  // Puerto del relay
    "baudRate": 9600,
    "comandoON": "A0:01:01",  // Comando hex para abrir
    "comandoOFF": "A0:01:00",  // Comando hex para cerrar
    "tiempoApertura": 3000
  }
}
```

## 🚀 Ejecución

### Modo desarrollo (con auto-reload)

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

### Como servicio de Windows

```bash
# Instalar como servicio (requiere permisos de administrador)
npm install -g node-windows
node install-service.js
```

## 🌐 Interfaces

### Monitor Web Local

Abrir en navegador: `http://localhost:3002`

Muestra:
- Estado de conexiones (API, USB, RFID, Molinete)
- Pantalla simulada del molinete (verde/rojo)
- Stream de últimos 50 accesos en tiempo real
- Estadísticas del cache
- Botones para abrir molinete y sincronizar manualmente

### WebSocket

Conectarse en: `ws://localhost:3002/ws`

Eventos emitidos:
- `ACCESO`: Cada vez que alguien intenta acceder
- `PANTALLA`: Cambios en la pantalla del molinete

## 📡 API Local

El servicio expone una API HTTP local:

### `GET /api/status`

Obtiene el estado del sistema.

```json
{
  "version": "1.0.0",
  "dispositivo": 1,
  "conexion": {
    "api": true,
    "usb": true,
    "rfid": true,
    "molinete": true
  },
  "cache": {
    "sociosEnCache": 1250,
    "habilitacionesEnCache": 15,
    "registrosPendientes": 0,
    "ultimoSync": "2024-01-15T10:30:00.000Z"
  },
  "uptime": 3600
}
```

### `POST /api/sync`

Fuerza una sincronización inmediata con el servidor.

### `POST /api/abrir`

Abre el molinete manualmente.

## 🗄️ Base de Datos Local

El servicio usa SQLite (`db/cache.db`) para:

- **socios**: Cache de socios VIGENTES para validación offline
- **habilitaciones**: Cache de habilitaciones temporales vigentes
- **registros_pendientes**: Registros que no pudieron enviarse (offline)
- **metadata**: Información del sistema (último sync, etc.)

## 📊 Flujo de Operación

### 1. Lectura de Credencial

```
Usuario acerca:
- QR del portal socio → Lector USB
- DNI con código de barras → Lector USB (extrae número de PDF417)
- Tarjeta RFID → Lector Serial (lee UID)
```

### 2. Validación

```
┌─ Intenta ONLINE (API)
│  ├─ ✅ Éxito → Usa respuesta del servidor
│  └─ ❌ Error → Fallback a OFFLINE
│
└─ Validación OFFLINE (SQLite cache)
   ├─ Busca en tabla 'socios' (si es QR/RFID)
   ├─ Busca en tabla 'habilitaciones' (si es DNI y no es socio)
   └─ Valida reglas (estado VIGENTE, fechas, límites)
```

### 3. Resultado

#### ✅ PERMITIDO
- LED verde + beep corto
- Abre molinete (relay ON por 3 segundos)
- Registra en BD
- Muestra mensaje de bienvenida

#### ❌ DENEGADO
- LED rojo + beep largo 2x
- NO abre molinete
- Registra en BD
- Si es "NO_ENCONTRADO" + DNI → Crea IntentoDenegado
- Muestra motivo del rechazo

### 4. Sincronización

Cada 5 minutos (configurable):
- Descarga socios VIGENTES del servidor
- Descarga habilitaciones temporales vigentes
- Actualiza cache SQLite
- Envía registros pendientes al servidor

## 🔍 Detección de Tipo de Lectura

El servicio detecta automáticamente:

- **QR Portal**: UUID de 36 caracteres con guiones (ej: `a1b2c3d4-...`)
- **DNI Simple**: 7-8 dígitos numéricos (ej: `12345678`)
- **DNI PDF417**: String largo (>20 chars) que contiene el DNI
- **RFID**: UID hexadecimal del lector serial

## 🛠️ Troubleshooting

### "Lector USB no encontrado"

1. Ejecute `npm run detectar-usb`
2. Verifique que el lector esté conectado
3. Copie el VID/PID correcto en `config.json`
4. Reinicie el servicio

### "Error en lector RFID"

1. Ejecute `npm run detectar-rfid`
2. Verifique el puerto COM correcto
3. Pruebe diferentes baudRate (9600, 115200)
4. En Linux, asegúrese de tener permisos en `/dev/ttyUSB0`

### "Error de conexión con API"

1. Verifique que el servidor backend esté corriendo
2. Verifique la URL en `config.json`
3. El modo offline seguirá funcionando con cache local

### "Molinete no abre"

1. Verifique el puerto COM del relay
2. Revise los comandos hex en `config.json`
3. Pruebe manualmente desde el monitor web
4. Verifique el cableado del relay

## 📝 Logs

Los logs se guardan en `logs/molinete.log` con rotación automática (máximo 10MB x 5 archivos).

Niveles de log:
- `info`: Operaciones normales
- `warn`: Advertencias (conexión perdida, fallback offline)
- `error`: Errores críticos

## 🔒 Seguridad

- El servicio corre en `localhost` por defecto
- No expone credenciales sensibles
- Los tokens de validación se manejan en memoria
- La base de datos SQLite es local y no se comparte

## 📄 Licencia

Privado - RojoPlus © 2024
