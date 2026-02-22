# 🚪 GUÍA COMPLETA - CONTROL DE ACCESOS ROJOPLUS

## 📖 Índice

1. [Visión General](#1-visión-general)
2. [Requisitos Previos](#2-requisitos-previos)
3. [Instalación Backend](#3-instalación-backend)
4. [Instalación Servicio Molinete](#4-instalación-servicio-molinete)
5. [Configuración Hardware](#5-configuración-hardware)
6. [Primer Uso](#6-primer-uso)
7. [Operación Diaria](#7-operación-diaria)
8. [Solución de Problemas](#8-solución-de-problemas)

---

## 1. Visión General

### ¿Qué es el Sistema de Control de Accesos?

Sistema automatizado para controlar el ingreso al club mediante molinetes que:
- Lee **3 tipos de identificación**: QR, código de barras DNI, tarjetas RFID
- Valida **automáticamente** si la persona puede ingresar
- **Abre/cierra el molinete** según corresponda
- Funciona **con o sin internet** (modo offline)
- Permite gestionar **visitantes temporales** desde el panel admin

### ¿Cómo Funciona?

```
┌─────────────┐      ┌──────────────┐      ┌────────────┐
│   Usuario   │──────│   Molinete   │──────│  Backend   │
│             │      │   + Lectores │      │  (Nube)    │
└─────────────┘      └──────────────┘      └────────────┘
      │                      │                     │
      │ 1. Escanea QR/DNI   │                     │
      │─────────────────────>│                     │
      │                      │ 2. Valida online    │
      │                      │────────────────────>│
      │                      │<────────────────────│
      │                      │ 3. Respuesta        │
      │                      │ (permitido/denegado)│
      │ 4. Señal LED         │                     │
      │<─────────────────────│                     │
      │ 5. Abre/No abre      │                     │
      │<─────────────────────│                     │
```

### Componentes del Sistema

1. **Backend (Servidor)**: API central con base de datos PostgreSQL
2. **Servicio Molinete (PC local)**: Aplicación Node.js que controla el hardware
3. **Hardware**: Lectores USB/Serial + Relay del molinete
4. **Panel Admin Web**: Gestión desde cualquier navegador
5. **PWA Móvil**: Control desde smartphone

---

## 2. Requisitos Previos

### Hardware Necesario

#### PC del Molinete
- CPU: Intel Core i3 o superior
- RAM: 4GB mínimo
- Disco: 10GB libres
- Sistema: Windows 10/11 o Linux
- Puertos: 2-3 USB o Serial disponibles

#### Lectores y Actuadores
- **Lector USB**: Código de barras/QR (HID keyboard wedge)
  - Ejemplos: Honeywell 1900, Zebra DS2208
- **Lector RFID**: Proximity card serial RS-232
  - Ejemplos: RC522, PN532, ACR122U
- **Relay**: Para controlar molinete (USB o Serial)
  - Ejemplo: Módulo relay USB 1 canal

#### Servidor Backend
- CPU: 2 cores
- RAM: 2GB mínimo
- Disco: 20GB
- SO: Linux (Ubuntu 20.04+ recomendado)
- Red: Conectividad estable

### Software Necesario

#### En el Servidor
- [x] PostgreSQL 14+
- [x] Node.js 18+
- [x] PM2 (gestor de procesos)
- [x] Nginx (opcional, para HTTPS)

#### En la PC del Molinete
- [x] Node.js 18+ ⚠️ **CRÍTICO**
- [x] Drivers USB (generalmente automáticos en Windows)

### Conexión de Red

- PC del molinete debe poder alcanzar el servidor backend
- Recomendado: Cable Ethernet (más estable que WiFi)
- Puerto del servidor: 3001 (backend API)

---

## 3. Instalación Backend

### Paso 1: Actualizar Base de Datos

```bash
cd server

# Aplicar cambios en schema
npx prisma db push

# Generar cliente Prisma
npx prisma generate
```

Verificar que se crearon las tablas:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN (
  'dispositivos_acceso',
  'registros_acceso',
  'habilitaciones_temporales',
  'intentos_acceso_denegado'
);
```

### Paso 2: Crear Permisos

Los permisos se crean automáticamente con el seed. Verificar:

```sql
SELECT * FROM permisos WHERE codigo LIKE 'ACCESOS%';
```

Debe retornar:
- `ACCESOS_VER`: Ver registros y monitor
- `ACCESOS_GESTIONAR`: Crear habilitaciones y gestionar dispositivos

### Paso 3: Asignar Permisos al Rol Admin

```sql
INSERT INTO permisos_rol (rol_id, permiso_id)
SELECT
  (SELECT id FROM roles WHERE codigo = 'ADMIN'),
  id
FROM permisos
WHERE codigo IN ('ACCESOS_VER', 'ACCESOS_GESTIONAR');
```

### Paso 4: Crear Dispositivo de Acceso

Ejecutar en PostgreSQL:

```sql
INSERT INTO dispositivos_acceso (
  codigo, nombre, ubicacion, ip_local, puerto,
  puerto_serial_rfid, tipo_relay, tiempo_apertura,
  modo_offline, intervalo_sync, activo,
  created_at, updated_at
) VALUES (
  'MOLINETE_PRINCIPAL',
  'Molinete Entrada Principal',
  'Hall de entrada',
  '192.168.1.100',  -- ⚠️ Cambiar por IP real de la PC del molinete
  3002,
  'COM3',           -- ⚠️ Cambiar según puerto detectado
  'USB_RELAY',
  3,
  true,
  5,
  true,
  NOW(),
  NOW()
) RETURNING id;
```

**IMPORTANTE:** Anotar el `id` retornado (ejemplo: `1`). Se usará en la configuración del servicio.

### Paso 5: Reiniciar Backend

```bash
pm2 restart rojoplus-api

# Verificar logs
pm2 logs rojoplus-api --lines 50
```

Buscar en logs:
```
✅ Rutas de accesos cargadas
✅ WebSocket de accesos iniciado en puerto 3001
```

---

## 4. Instalación Servicio Molinete

### Paso 1: Copiar Archivos a la PC del Molinete

**Windows:**
```powershell
# Crear directorio
mkdir C:\RojoPlus\molinete-service

# Copiar carpeta molinete-service/ del proyecto a C:\RojoPlus\
```

**Linux:**
```bash
sudo mkdir -p /opt/rojoplus/molinete-service
sudo chown -R $USER:$USER /opt/rojoplus
cd /opt/rojoplus
# Copiar archivos del repositorio
```

### Paso 2: Instalar Dependencias

```bash
cd C:\RojoPlus\molinete-service  # Windows
# o
cd /opt/rojoplus/molinete-service  # Linux

npm install
```

Esto instala:
- express (servidor HTTP)
- ws (WebSocket)
- node-hid (lector USB)
- serialport (lector RFID)
- better-sqlite3 (cache offline)
- winston (logging)

### Paso 3: Detectar Hardware

#### A. Lector USB (Código de Barras/QR)

```bash
npm run detectar-usb
```

Salida esperada:
```
🔍 Detectando dispositivos HID USB...

Dispositivo encontrado:
  Producto: Honeywell Barcode Scanner
  vendorId: 0x0c2e
  productId: 0x0b61
  Interface: 0

Copie estos valores a config.json:
"vendorId": "0x0c2e",
"productId": "0x0b61"
```

#### B. Lector RFID (Serial)

```bash
npm run detectar-rfid
```

Salida esperada (Windows):
```
🔍 Puertos seriales disponibles:

1. COM3 - USB Serial Port
2. COM4 - USB-SERIAL CH340

Ingrese el número del puerto a probar [1-2]: 1

Abriendo COM3 a 9600 baud...
✅ Puerto abierto. Acerque una tarjeta RFID...

Lectura recibida: 04:A3:2F:1A
✅ RFID detectado correctamente en COM3
```

**Linux:**
Si los puertos requieren permisos:
```bash
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0
```

### Paso 4: Configurar config.json

Editar `C:\RojoPlus\molinete-service\config.json` con valores reales:

```json
{
  "apiUrl": "http://192.168.1.50:3001/api",  // ⚠️ IP del servidor
  "dispositivoId": 1,  // ⚠️ ID del paso 3.4
  "puerto": 3002,
  "puertoWebSocket": 3003,

  "lectorUSB": {
    "tipo": "HID",
    "vendorId": "0x0c2e",  // ⚠️ Del paso 4.3.A
    "productId": "0x0b61",  // ⚠️ Del paso 4.3.A
    "habilitado": true
  },

  "lectorRFID": {
    "tipo": "SERIAL",
    "puerto": "COM3",      // ⚠️ Del paso 4.3.B (Windows: COMx, Linux: /dev/ttyUSBx)
    "baudRate": 9600,
    "habilitado": true
  },

  "molinete": {
    "tipo": "USB_RELAY",
    "puerto": "COM4",      // ⚠️ Puerto del relay
    "baudRate": 9600,
    "comandoON": "A0:01:01",   // ⚠️ Según manual del relay
    "comandoOFF": "A0:01:00",  // ⚠️ Según manual del relay
    "tiempoApertura": 3000
  },

  "habilitacion": {
    "modalAutomatico": false,
    "soloListaRemota": true
  },

  "sync": {
    "intervalo": 5,
    "autoSync": true
  },

  "offline": {
    "habilitado": true
  }
}
```

### Paso 5: Probar Manualmente

```bash
npm start
```

Verificar en consola:
```
✅ Base de datos SQLite inicializada
✅ Sincronización completada: 1250 socios, 5 habilitaciones
✅ Lector USB inicializado (VID: 0x0c2e, PID: 0x0b61)
✅ Lector RFID inicializado (Puerto: COM3, Baud: 9600)
✅ Relay molinete inicializado (Puerto: COM4)
✅ Servidor HTTP escuchando en http://localhost:3002
✅ WebSocket escuchando en ws://localhost:3003
```

**Abrir navegador:** http://localhost:3002

Debe mostrar el monitor web con:
- Estado de conexiones (verde = OK)
- Pantalla del molinete simulada
- Botón "Abrir Molinete" (para probar relay)
- Botón "Sincronizar Cache"

### Paso 6: Probar Lectores

#### Probar Lector USB (DNI/QR)
1. Escanear un código de barras o QR
2. Observar en consola:
   ```
   📖 Lectura USB recibida: 12345678
   🔍 Tipo detectado: DNI
   ✅ Validación online exitosa
   ```

#### Probar Lector RFID
1. Acercar tarjeta RFID al lector
2. Observar en consola:
   ```
   📡 Lectura RFID recibida: 04:A3:2F:1A
   🔍 Tipo detectado: RFID
   ✅ Validación online exitosa
   ```

#### Probar Relay (Molinete)
1. Desde el monitor web, click en **"Abrir Molinete"**
2. El relay debe activarse por 3 segundos
3. Verificar con multímetro o señal del molinete

### Paso 7: Instalar como Servicio (Producción)

#### Windows - NSSM

```powershell
# Descargar NSSM desde https://nssm.cc/download
# Extraer a C:\nssm

cd C:\nssm\win64
.\nssm.exe install RojoPlusMolinete

# En la ventana que se abre:
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\RojoPlus\molinete-service
# Arguments: index.js
# Click "Install service"

# Iniciar servicio
.\nssm.exe start RojoPlusMolinete

# Verificar estado
.\nssm.exe status RojoPlusMolinete
```

#### Linux - Systemd

Crear `/etc/systemd/system/rojoplus-molinete.service`:

```ini
[Unit]
Description=RojoPlus Molinete Service
After=network.target

[Service]
Type=simple
User=rojoplus
WorkingDirectory=/opt/rojoplus/molinete-service
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rojoplus-molinete

[Install]
WantedBy=multi-user.target
```

Activar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rojoplus-molinete
sudo systemctl start rojoplus-molinete
sudo systemctl status rojoplus-molinete
```

---

## 5. Configuración Hardware

### Conexión Física

```
┌──────────────────────────────────────────────┐
│              PC DEL MOLINETE                 │
│                                              │
│  USB 1 ──> Lector Código de Barras/QR       │
│  USB 2 ──> Conversor USB-Serial ──> RFID    │
│  USB 3 ──> Relay ──> Molinete               │
│                                              │
│  Ethernet ──> Router ──> Servidor Backend   │
└──────────────────────────────────────────────┘
```

### Lector USB (Código de Barras/QR)

**Configuración del lector** (usando manual del fabricante):
1. **Modo**: HID keyboard wedge (sin software adicional)
2. **Sufijo**: Enter (CR/LF) para detectar fin de lectura
3. **Prefijo**: Ninguno
4. **Formato**: Texto plano

**Verificación:**
- Abrir Notepad
- Escanear código de barras
- Debe aparecer el texto seguido de Enter automático

### Lector RFID

**Conexión Serial:**
```
Lector RFID ──> Conversor USB-Serial ──> PC

Pines:
  VCC (5V)  ──> 5V
  GND       ──> GND
  TX        ──> RX
  RX        ──> TX
```

**Configuración:**
- Protocolo: Serial RS-232
- Baud Rate: 9600 (más común) o 115200
- Formato de salida: UID hexadecimal (ej: `04:A3:2F:1A`)

### Relay del Molinete

**Opción 1: Relay USB (más simple)**

```
USB ──> Módulo Relay USB ──> Molinete

Relay COM ──> Cable común molinete
Relay NO  ──> Cable señal apertura molinete
```

**Opción 2: Relay GPIO (Raspberry Pi)**

```javascript
// En config.json:
"molinete": {
  "tipo": "GPIO",
  "pin": 17  // GPIO 17
}
```

Conexión:
```
Raspberry Pi GPIO 17 ──> IN (relay)
Raspberry Pi GND     ──> GND (relay)
Relay VCC            ──> 5V (fuente externa)
Relay COM            ──> Cable común molinete
Relay NO             ──> Cable señal apertura
```

### Calibración del Relay

Si el molinete no abre, encontrar comandos correctos:

1. **Instalar terminal serial** (PuTTY, RealTerm, o minicom en Linux)
2. **Conectar al puerto** del relay (ej: COM4)
3. **Probar comandos hex** comunes:
   ```
   A0 01 01  (ON)
   A0 01 00  (OFF)

   FF 01 01  (ON)
   FF 01 00  (OFF)

   FE 05 00 00 FF 00 98 35  (Modbus RTU ON)
   FE 05 00 00 00 00 D9 C5  (Modbus RTU OFF)
   ```
4. **Medir con multímetro** continuidad en relay (COM-NO)
5. **Actualizar config.json** con comandos que funcionaron

---

## 6. Primer Uso

### Verificación Inicial

#### 1. Monitor Web Local

Abrir: http://IP_PC_MOLINETE:3002

**Verificar:**
- ✅ Estado API: Verde (conectado)
- ✅ Estado USB: Verde
- ✅ Estado RFID: Verde
- ✅ Estado Molinete: Verde
- ✅ Cache sincronizado: "X socios en cache"

#### 2. Panel Admin Web

Abrir: https://tu-dominio.com/admin

Navegar a: **Accesos > Monitor de Accesos**

**Verificar:**
- ✅ Dispositivo "Molinete Entrada Principal" aparece
- ✅ Estado: Activo (punto verde)
- ✅ Último ping: Hace menos de 1 minuto

### Prueba de Acceso Completo

#### Escenario 1: Socio Vigente con DNI

1. **Preparación:**
   - Verificar que existe un socio con estado "VIGENTE" en BD
   - Anotar su DNI (ej: 12345678)

2. **Ejecución:**
   - Escanear DNI en el lector USB
   - Observar molinete y monitor web

3. **Resultado esperado:**
   - 🟢 LED VERDE encendido
   - 🔊 BEEP corto 1 vez
   - ✅ Molinete ABRE por 3 segundos
   - 📊 Monitor web muestra:
     ```
     PERMITIDO | Juan Pérez | DNI: 12345678 | Socio VIGENTE | 10:30:15
     ```

#### Escenario 2: DNI No Encontrado → Habilitación Remota

1. **Preparación:**
   - Usar un DNI que NO existe en BD (ej: 99999999)

2. **Ejecución (Intento 1):**
   - Escanear DNI desconocido
   - Observar molinete

3. **Resultado esperado:**
   - 🔴 LED ROJO encendido
   - 🔊 BEEP largo 2 veces
   - ❌ Molinete NO ABRE
   - 📊 Monitor web muestra:
     ```
     DENEGADO | DNI no registrado | DNI: 99999999 | NO_ENCONTRADO | 10:32:00
     ```

4. **Gestión Remota:**
   - Ir a **Accesos > Intentos Denegados**
   - Debe aparecer:
     ```
     DNI: 99999999 | Intentos: 1 | Último: Hace 10 segundos | [Habilitar]
     ```
   - Click en **"Habilitar"**
   - Modal abierto:
     ```
     DNI: 99999999
     Nombre completo: [Escribir: "Juan Visitante"]
     Motivo: [Seleccionar: "Invitado"]
     Días: [Seleccionar: "3 días"]
     ```
   - Click **"Crear Habilitación"**
   - Mensaje: "✅ Habilitación creada correctamente"

5. **Ejecución (Intento 2):**
   - Persona REGRESA al molinete
   - Escanear MISMO DNI (99999999) nuevamente

6. **Resultado esperado:**
   - 🟢 LED VERDE encendido
   - 🔊 BEEP corto 1 vez
   - ✅ Molinete ABRE
   - 📊 Monitor web muestra:
     ```
     PERMITIDO | Juan Visitante | DNI: 99999999 | Habilitación vigente | 10:35:20
     ```

#### Escenario 3: Modo Offline

1. **Preparación:**
   - Desconectar cable de red de la PC del molinete
   - O detener el backend: `pm2 stop rojoplus-api`

2. **Ejecución:**
   - Escanear DNI de socio VIGENTE

3. **Resultado esperado:**
   - ⚠️ Monitor web muestra: "Modo OFFLINE (cache local)"
   - ✅ Validación funciona igual (usa cache SQLite)
   - 🟢 Molinete ABRE normalmente
   - 📝 Registros guardados en cola de pendientes

4. **Reconexión:**
   - Reconectar cable de red
   - Observar consola:
     ```
     ✅ Conexión restaurada
     📤 Enviando 5 registros pendientes...
     ✅ Sincronización completada
     ```

---

## 7. Operación Diaria

### Panel Admin - Secciones

#### A. Monitor de Accesos
**Ruta:** `/admin/accesos/monitor`

**Uso:**
- Ver accesos en **tiempo real** (WebSocket)
- KPIs del día: Total, Permitidos, Denegados
- Stream de últimos 50 accesos
- Estado de dispositivos (último ping)

**Filtros disponibles:**
- Por resultado (todos/permitidos/denegados)
- Por dispositivo
- Por rango de fechas

#### B. Intentos Denegados ⭐
**Ruta:** `/admin/accesos/intentos-denegados`

**Uso principal:**
Gestionar DNIs que intentaron ingresar sin estar registrados.

**Flujo de trabajo:**
1. La lista se **auto-actualiza cada 10 segundos**
2. Cada DNI muestra:
   - Número de DNI
   - Cantidad de intentos (badge rojo)
   - Timestamp del último intento
   - Botón "Habilitar"
3. Click en "Habilitar" → Completar formulario:
   - Nombre completo del visitante
   - Motivo (invitado, profesional, proveedor, otro)
   - Días de vigencia (1, 3, 7, 30)
4. Al crear habilitación:
   - Se marca como "resuelto"
   - Desaparece de la lista
   - Persona puede volver y escanear → ingresará

**Toggle "Mostrar Resueltos":**
- Ver historial de DNIs ya habilitados

#### C. Habilitaciones Temporales
**Ruta:** `/admin/accesos/habilitaciones`

**Uso:**
- Ver todas las habilitaciones (vigentes y vencidas)
- Crear habilitación **manual** (sin necesidad de intento previo)
- Editar habilitación existente
- Eliminar habilitación
- Buscar por DNI o nombre

**Campos de una habilitación:**
- DNI
- Nombre completo
- Motivo
- Fecha desde / hasta
- Accesos permitidos (opcional, límite de veces que puede entrar)
- Accesos usados (se incrementa automáticamente)
- Horario desde/hasta (opcional, restricción de horario)
- Zonas permitidas (opcional, para futuro)

### Tareas Diarias del Operador

#### Al Inicio del Día
1. Abrir monitor: `/admin/accesos/monitor`
2. Verificar estado del dispositivo (debe estar verde)
3. Revisar accesos del día (debe haber registros si hay movimiento)

#### Durante el Día
1. Mantener pestaña `/admin/accesos/intentos-denegados` abierta
2. Cuando aparezca un nuevo DNI:
   - Verificar motivo (llamar a recepción si es necesario)
   - Habilitar si corresponde
3. Revisar periódicamente el monitor para detectar anomalías

#### Al Finalizar el Día
1. Revisar habilitaciones que vencen hoy: `/admin/accesos/habilitaciones`
2. Exportar reporte si es necesario (futuro feature)

### PWA - Control Móvil

#### Instalación PWA

**Android (Chrome):**
1. Abrir: https://tu-dominio.com/admin/accesos/control-pwa
2. Menú (⋮) → "Agregar a pantalla de inicio"
3. Confirmar instalación
4. Ícono aparece en home screen

**iOS (Safari):**
1. Abrir URL
2. Botón compartir (cuadrado con flecha)
3. "Agregar a pantalla de inicio"
4. Confirmar

#### Uso del PWA

1. Abrir app desde icono
2. Login con credenciales admin
3. Pantalla principal:
   - Botón "📷 Escanear QR" (activa cámara)
   - Botón "🚪 Abrir Molinete" (apertura manual)
4. Escanear QR de carnet digital:
   - Si es VIGENTE → Vibración corta + mensaje verde + molinete abre
   - Si NO vigente → Vibración larga + mensaje rojo

**Casos de uso:**
- Operador en la puerta sin PC
- Eventos especiales con validación móvil
- Backup si PC del molinete falla

---

## 8. Solución de Problemas

### Problema: Dispositivo Offline en Panel Admin

**Síntomas:**
- Monitor muestra dispositivo en rojo
- "Último ping: Hace 10 minutos"

**Diagnóstico:**
```bash
# En PC del molinete, verificar servicio
# Windows:
sc query RojoPlusMolinete

# Linux:
sudo systemctl status rojoplus-molinete
```

**Soluciones:**
1. **Servicio detenido:**
   ```bash
   # Windows:
   sc start RojoPlusMolinete

   # Linux:
   sudo systemctl start rojoplus-molinete
   ```

2. **Error de red:**
   - Verificar cable Ethernet
   - Ping al servidor: `ping IP_SERVIDOR`
   - Verificar firewall

3. **Error en servicio:**
   - Ver logs:
     ```bash
     # Windows:
     type C:\RojoPlus\molinete-service\logs\molinete.log

     # Linux:
     tail -f /opt/rojoplus/molinete-service/logs/molinete.log
     ```
   - Buscar errores y corregir

### Problema: Lector USB No Detectado

**Síntomas:**
- Monitor local muestra "USB: Desconectado (rojo)"
- Consola: "Error: No se pudo abrir dispositivo HID"

**Soluciones:**
1. **Verificar conexión física:**
   - Reconectar cable USB
   - Probar otro puerto USB
   - Verificar LED del lector (debe estar encendido)

2. **Detectar VID/PID nuevamente:**
   ```bash
   npm run detectar-usb
   ```
   - Copiar nuevos valores a `config.json`
   - Reiniciar servicio

3. **Probar lector en Notepad:**
   - Abrir Notepad
   - Escanear código de barras
   - Si no aparece texto → problema del lector (driver o hardware)

4. **Linux: permisos:**
   ```bash
   sudo chmod 666 /dev/hidraw0
   # O agregar regla udev permanente
   ```

### Problema: Lector RFID No Lee

**Síntomas:**
- Monitor local: "RFID: Error (rojo)"
- Al acercar tarjeta, no pasa nada

**Soluciones:**
1. **Verificar puerto serial:**
   ```bash
   npm run detectar-rfid
   ```
   - Confirmar puerto correcto
   - Probar diferentes baudRate (9600, 115200)

2. **Linux: permisos:**
   ```bash
   sudo usermod -a -G dialout $USER
   sudo chmod 666 /dev/ttyUSB0
   # Cerrar sesión y volver a entrar
   ```

3. **Probar con terminal serial:**
   - Abrir PuTTY (Windows) o minicom (Linux)
   - Conectar al puerto COM/tty
   - Acercar tarjeta
   - Debe aparecer UID hexadecimal

4. **Revisar alimentación:**
   - Lector RFID debe tener 5V en VCC
   - Medir con multímetro

### Problema: Molinete No Abre

**Síntomas:**
- Validación exitosa (verde, beep)
- Pero molinete no se activa físicamente

**Soluciones:**
1. **Verificar relay con multímetro:**
   - Medir continuidad COM-NO
   - Debe cambiar al enviar comando

2. **Probar desde monitor web:**
   - http://localhost:3002
   - Click "Abrir Molinete"
   - Si relay activa pero molinete no abre → cableado del molinete

3. **Calibrar comandos hex:**
   - Ver sección 5.3 (Calibración del Relay)
   - Probar comandos diferentes

4. **Verificar cableado:**
   ```
   Relay COM ──> Cable COMÚN del molinete (generalmente negro)
   Relay NO  ──> Cable SEÑAL APERTURA (generalmente verde o azul)
   ```
   - Verificar con manual del molinete

### Problema: "DNI no encontrado" para Socio Existente

**Síntomas:**
- Socio válido escanea DNI
- Sistema dice "DNI no registrado"

**Diagnóstico:**
1. **Verificar DNI en BD:**
   ```sql
   SELECT id, nro_socio, apellido_nombre, documento, estado
   FROM socios
   WHERE documento = '12345678';
   ```

2. **Verificar formato de lectura:**
   - Observar en consola del servicio qué valor se leyó
   - DNI argentino PDF417 devuelve string largo, el servicio debe extraer los 7-8 dígitos

**Soluciones:**
1. **DNI sin cargar en BD:**
   - Actualizar socio: `UPDATE socios SET documento = '12345678' WHERE id = X;`

2. **Formato incorrecto:**
   - Verificar parsing en `molinete-service/index.js`
   - Función `extraerDNIdePDF417()`

3. **Cache desactualizado:**
   - Forzar sincronización: Click "Sincronizar Cache" en monitor web
   - O esperar 5 minutos

### Problema: Cache No Sincroniza

**Síntomas:**
- Monitor web: "Última sincronización: Hace 30 minutos"
- Socio nuevo no valida en modo offline

**Soluciones:**
1. **Verificar conexión API:**
   - Abrir en navegador: `http://IP_SERVIDOR:3001/api/accesos/cache-socios`
   - Debe retornar JSON con socios

2. **Ver logs del servicio:**
   ```bash
   tail -f logs/molinete.log | grep "Sync"
   ```
   - Buscar errores

3. **Forzar sincronización manual:**
   - Monitor web → "Sincronizar Cache"
   - O reiniciar servicio

4. **Verificar SQLite:**
   ```bash
   # Instalar sqlite3 CLI
   sqlite3 db/cache.db "SELECT COUNT(*) FROM socios;"
   ```
   - Debe retornar número > 0

### Problema: WebSocket Desconectado en Monitor Admin

**Síntomas:**
- Monitor de accesos no actualiza en tiempo real
- Console del navegador: "WebSocket closed"

**Soluciones:**
1. **Verificar backend:**
   ```bash
   pm2 logs rojoplus-api | grep WebSocket
   ```

2. **Verificar firewall:**
   - Puerto 3001 debe estar abierto
   - Si hay proxy/nginx, configurar upgrade de WebSocket

3. **Recargar página:**
   - El cliente se reconecta automáticamente cada 3 segundos

### Problema: PWA No Se Instala

**Síntomas:**
- Botón "Agregar a pantalla de inicio" no aparece

**Soluciones:**
1. **HTTPS requerido:**
   - PWA solo funciona con HTTPS en producción
   - Verificar certificado SSL: https://tu-dominio.com

2. **Manifest.json:**
   - Abrir DevTools → Application → Manifest
   - Verificar que se carga sin errores

3. **Service Worker:**
   - DevTools → Application → Service Workers
   - Debe aparecer registrado

---

## 📞 Soporte

### Logs a Revisar

**Servicio Molinete:**
```bash
# Windows
type C:\RojoPlus\molinete-service\logs\molinete.log

# Linux
tail -f /opt/rojoplus/molinete-service/logs/molinete.log
```

**Backend:**
```bash
pm2 logs rojoplus-api --lines 100
```

**Base de Datos:**
```sql
-- Últimos accesos
SELECT * FROM registros_acceso ORDER BY fecha DESC LIMIT 20;

-- Intentos denegados no resueltos
SELECT * FROM intentos_acceso_denegado WHERE resuelto = false;

-- Estado del dispositivo
SELECT nombre, activo, ultimo_ping FROM dispositivos_acceso;
```

### Información para Reportar Problemas

Al reportar un problema, incluir:
1. Descripción del error
2. Logs del servicio molinete (últimas 50 líneas)
3. Logs del backend (si aplica)
4. Configuración `config.json` (sin datos sensibles)
5. Versión de Node.js: `node --version`
6. Sistema operativo y versión

---

## ✅ Checklist de Puesta en Marcha

### Backend
- [ ] Base de datos actualizada (prisma db push)
- [ ] Permisos creados y asignados
- [ ] Dispositivo de acceso creado en BD
- [ ] Backend reiniciado y sin errores en logs

### Servicio Molinete
- [ ] Node.js instalado (v18+)
- [ ] Dependencias instaladas (npm install)
- [ ] Hardware detectado (USB y RFID)
- [ ] config.json configurado con valores reales
- [ ] Servicio corriendo (manualmente o como servicio del SO)
- [ ] Monitor web accesible en http://localhost:3002
- [ ] Sincronización exitosa (socios en cache)

### Hardware
- [ ] Lector USB conectado y funcionando
- [ ] Lector RFID conectado y leyendo tarjetas
- [ ] Relay conectado y activando correctamente
- [ ] Molinete abre al recibir señal del relay
- [ ] Cables verificados y asegurados

### Frontend
- [ ] Panel admin accesible
- [ ] Monitor de accesos muestra dispositivo en verde
- [ ] Intentos denegados carga correctamente
- [ ] Habilitaciones CRUD funcional
- [ ] PWA instalable (si se requiere)

### Pruebas Funcionales
- [ ] Socio VIGENTE con DNI → Acceso permitido
- [ ] Socio NO_VIGENTE → Acceso denegado
- [ ] DNI desconocido → Aparece en intentos denegados
- [ ] Crear habilitación → Acceso permitido al reintentar
- [ ] Modo offline → Validación con cache local
- [ ] Reconexión → Sincronización automática

---

**¡Sistema listo para operar!** 🎉

Para más detalles técnicos, consultar:
- `INSTALACION_PRODUCCION.md` - Guía técnica completa
- `TESTING_CONTROL_ACCESOS.md` - 73 casos de prueba
- `molinete-service/README.md` - API y detalles del servicio
- `CONTROL_ACCESOS_COMPLETADO.md` - Resumen ejecutivo
