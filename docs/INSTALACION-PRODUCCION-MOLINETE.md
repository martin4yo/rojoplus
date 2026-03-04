# 🚀 GUÍA DE INSTALACIÓN EN PRODUCCIÓN - CONTROL DE ACCESOS

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación Backend](#instalación-backend)
3. [Instalación Servicio Molinete](#instalación-servicio-molinete)
4. [Configuración Hardware](#configuración-hardware)
5. [Configuración PWA](#configuración-pwa)
6. [Optimizaciones](#optimizaciones)
7. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)

---

## 📦 Requisitos Previos

### Hardware Mínimo - PC del Molinete

- **CPU:** Intel Core i3 o equivalente
- **RAM:** 4GB mínimo
- **Sistema Operativo:** Windows 10/11, Linux (Ubuntu 20.04+), o Raspberry Pi OS
- **Puertos:**
  - 1x USB para lector código de barras/QR
  - 1x Serial (COM o USB-Serial) para lector RFID
  - 1x Serial o GPIO para relay del molinete
- **Red:** Ethernet 100Mbps o WiFi estable

### Hardware del Sistema

- **Molinete:** Con entrada de señal digital (relay/GPIO)
- **Lector USB:** Compatible HID (keyboard wedge)
  - Modelos probados: Honeywell 1900/1902, Zebra DS2208
- **Lector RFID:** Serial RS-232 a 9600 baud
  - Modelos probados: RC522, PN532
- **Relay:** USB, Serial, o GPIO (para Raspberry Pi)
  - Ejemplo: Módulo relay 1 canal 5V

### Software - Servidor

- **Node.js:** v18 o superior
- **PostgreSQL:** v14 o superior
- **Nginx:** Para reverse proxy (opcional pero recomendado)
- **PM2:** Para gestión de procesos

---

## 🟢 Instalación de Node.js en PC del Molinete

**⚠️ CRÍTICO:** El servicio del molinete es una aplicación Node.js standalone que se ejecuta 24/7 en la PC conectada al hardware. Node.js es obligatorio y debe instalarse antes de continuar.

### ¿Por qué Node.js?

El servicio del molinete está escrito en JavaScript/Node.js porque:
- **Manejo de puertos serial/USB:** Librerías robustas (`serialport`, `node-hid`)
- **Operación asíncrona:** Procesa múltiples lecturas simultáneas
- **WebSocket integrado:** Comunicación en tiempo real con backend
- **Multiplataforma:** Funciona en Windows, Linux, y Raspberry Pi
- **Bajo consumo:** ~50MB RAM en operación normal

### Requisitos de Sistema

- **Espacio en disco:** 350MB (Node.js 150MB + dependencias 200MB)
- **RAM:** 100MB mínimo (el servicio usa ~50MB)
- **Descarga:** ~30MB (instalador de Node.js)
- **Versión requerida:** Node.js v18 o superior

---

### 📥 Instalación en Windows 10/11

**Paso 1: Descargar Node.js**

1. Abrir navegador web
2. Ir a: **https://nodejs.org/**
3. Descargar la versión **LTS (Long Term Support)**
   - Botón verde que dice "**Recommended For Most Users**"
   - Archivo: `node-v20.x.x-x64.msi` (aprox. 30MB)
   - **No descargar** la versión "Current" (puede ser inestable)

**Paso 2: Ejecutar el Instalador**

1. Doble clic en el archivo `.msi` descargado
2. **Setup wizard:**
   - Click "Next" en pantalla de bienvenida
   - Aceptar licencia → "Next"
   - **Destination Folder:** Dejar default `C:\Program Files\nodejs\` → "Next"
   - **Custom Setup:**
     - ✅ Node.js runtime
     - ✅ npm package manager
     - ✅ Add to PATH
     - ✅ Online documentation shortcuts
     - Click "Next"
   - **Tools for Native Modules:**
     - ⚠️ **MARCAR** la opción "Automatically install the necessary tools"
     - Esto instala Python y Visual Studio Build Tools (necesarios para `serialport` y `node-hid`)
     - Click "Next"
   - Click "**Install**"
   - Esperar 2-3 minutos
3. Si se abre una ventana de PowerShell pidiendo instalar tools adicionales:
   - **Presionar cualquier tecla** para continuar
   - Esperar 5-10 minutos (descarga ~1GB de herramientas)
   - La ventana se cerrará automáticamente al terminar

**Paso 3: Verificar Instalación**

1. Abrir **Command Prompt** (CMD):
   - Windows + R → escribir `cmd` → Enter
2. Ejecutar:
   ```cmd
   node --version
   ```
   Debe mostrar: `v20.x.x` o similar
3. Ejecutar:
   ```cmd
   npm --version
   ```
   Debe mostrar: `10.x.x` o similar

Si ambos comandos muestran versiones, **la instalación fue exitosa** ✅

**Paso 4: Configurar Permisos USB/Serial (si es necesario)**

Windows 10/11 generalmente detecta automáticamente dispositivos USB y COM. Sin embargo:

1. **Verificar drivers USB:**
   - Conectar lector USB
   - Abrir "Administrador de dispositivos"
   - Buscar en "Teclados" o "Dispositivos de interfaz humana (HID)"
   - Si aparece con signo de exclamación amarillo: instalar driver del fabricante

2. **Verificar puertos COM:**
   - Abrir "Administrador de dispositivos"
   - Expandir "Puertos (COM y LPT)"
   - Anotar número de puerto (ej: COM3, COM4)
   - Estos números se usarán en `config.json`

---

### 🐧 Instalación en Linux (Ubuntu/Debian)

**Paso 1: Actualizar Sistema**

```bash
sudo apt update
sudo apt upgrade -y
```

**Paso 2: Instalar Node.js v20 LTS**

Usar NodeSource para obtener la última versión LTS:

```bash
# Descargar script de instalación
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js y npm
sudo apt install -y nodejs

# Instalar herramientas de compilación (necesarias para módulos nativos)
sudo apt install -y build-essential python3
```

**Paso 3: Verificar Instalación**

```bash
node --version
# Debe mostrar: v20.x.x

npm --version
# Debe mostrar: 10.x.x
```

**Paso 4: Configurar Permisos USB/Serial**

Linux requiere permisos especiales para acceder a dispositivos USB y serial:

```bash
# Agregar usuario al grupo dialout (acceso a puertos serial)
sudo usermod -a -G dialout $USER

# Agregar usuario al grupo plugdev (acceso a dispositivos USB)
sudo usermod -a -G plugdev $USER

# Aplicar cambios (cerrar sesión y volver a entrar, o ejecutar)
newgrp dialout

# Verificar permisos de puertos serial
ls -l /dev/ttyUSB* /dev/ttyACM*
# Debe mostrar: crw-rw---- 1 root dialout ...

# Si no existen, conectar dispositivo USB-Serial y volver a verificar
```

**Paso 5: Crear Reglas udev (Opcional pero Recomendado)**

Para que dispositivos siempre tengan el mismo nombre:

```bash
# Crear archivo de reglas
sudo nano /etc/udev/rules.d/99-rojoplus-serial.rules
```

Agregar:
```
# Lector RFID
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="rfid-reader"

# Relay Molinete
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", SYMLINK+="molinete-relay"
```

Recargar reglas:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Ahora puedes usar `/dev/rfid-reader` en vez de `/dev/ttyUSB0` (que puede cambiar).

---

### 🥧 Instalación en Raspberry Pi (Raspbian/Raspberry Pi OS)

**Paso 1: Actualizar Sistema**

```bash
sudo apt update
sudo apt full-upgrade -y
```

**Paso 2: Instalar Node.js**

Para Raspberry Pi 3/4 (ARM64 o ARMv7):

```bash
# Usar NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Herramientas de compilación
sudo apt install -y build-essential python3 python3-dev
```

Para Raspberry Pi Zero/1 (ARMv6), usar versión precompilada:

```bash
# Descargar binario ARMv6
wget https://unofficial-builds.nodejs.org/download/release/v20.11.0/node-v20.11.0-linux-armv6l.tar.xz

# Extraer
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJf node-v20.11.0-linux-armv6l.tar.xz -C /usr/local/lib/nodejs

# Agregar a PATH
echo 'export PATH=/usr/local/lib/nodejs/node-v20.11.0-linux-armv6l/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Paso 3: Verificar**

```bash
node --version
npm --version
```

**Paso 4: Habilitar GPIO y Serial**

```bash
# Abrir configuración
sudo raspi-config

# Navegar a:
# - "Interface Options"
#   - "Serial Port"
#     - "Login shell over serial": NO
#     - "Serial port hardware enabled": YES
#   - "I2C": YES (si usas I2C para RFID)
#   - "SPI": YES (si usas SPI)

# Guardar y reiniciar
sudo reboot
```

**Paso 5: Permisos**

```bash
sudo usermod -a -G dialout pi
sudo usermod -a -G gpio pi
sudo usermod -a -G i2c pi
sudo usermod -a -G spi pi
```

**Optimización para Raspberry Pi:**

Reducir consumo de RAM:

```bash
# En config.json del servicio molinete:
"sync": {
  "intervalo": 10,  // Sincronizar cada 10 min (en vez de 5)
  "autoSync": true
}
```

---

### ✅ Verificación Completa

Después de instalar Node.js, verificar que todo esté listo:

**1. Versiones correctas:**
```bash
node --version
# Debe ser >= v18.0.0

npm --version
# Debe ser >= 9.0.0
```

**2. Capacidad de compilar módulos nativos:**
```bash
# Crear proyecto de prueba
mkdir test-native
cd test-native
npm init -y

# Intentar instalar módulo con código C++ (serialport)
npm install serialport

# Si se instala sin errores, todo está correcto ✅
# Si falla, instalar build tools (ver troubleshooting abajo)
```

**3. Acceso a puertos (Linux/Raspberry Pi):**
```bash
groups
# Debe incluir: dialout, plugdev (y gpio en Raspberry Pi)

ls -l /dev/ttyUSB0
# Debe mostrar: crw-rw---- 1 root dialout ...
```

---

### 🔧 Troubleshooting

#### Problema: `node: command not found`

**Windows:**
- Reiniciar CMD (o PowerShell) después de instalar
- Verificar que `C:\Program Files\nodejs\` esté en PATH:
  ```cmd
  echo %PATH%
  ```
- Si no está, agregar manualmente:
  1. Windows + R → `sysdm.cpl` → Enter
  2. Pestaña "Avanzado" → "Variables de entorno"
  3. En "Variables del sistema" → Seleccionar "Path" → "Editar"
  4. "Nuevo" → Agregar: `C:\Program Files\nodejs\`
  5. OK → Reiniciar CMD

**Linux/Raspberry Pi:**
- Verificar instalación:
  ```bash
  which node
  # Debe mostrar: /usr/bin/node
  ```
- Recargar bash:
  ```bash
  source ~/.bashrc
  ```

#### Problema: Error al instalar `serialport` o `node-hid`

**Error típico:**
```
gyp ERR! stack Error: Python executable "python" is not found
```

**Solución Windows:**
- Ejecutar CMD como Administrador:
  ```cmd
  npm install --global windows-build-tools
  ```
- O instalar manualmente:
  - Python 3: https://www.python.org/downloads/
  - Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/ (sección "Tools for Visual Studio")

**Solución Linux:**
```bash
sudo apt install -y build-essential python3 python3-dev
```

#### Problema: `EACCES` al instalar paquetes (Linux)

```bash
# NO usar sudo npm install (puede causar problemas)
# En su lugar, configurar directorio global de npm:

mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Problema: Puerto serial "Permission denied" (Linux)

```bash
# Verificar pertenencia al grupo
groups | grep dialout

# Si no aparece dialout:
sudo usermod -a -G dialout $USER

# Cerrar sesión y volver a entrar (o ejecutar)
newgrp dialout

# Dar permisos temporales al puerto (solo para testing)
sudo chmod 666 /dev/ttyUSB0
```

#### Problema: Raspberry Pi se queda sin memoria

```bash
# Aumentar swap
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Cambiar: CONF_SWAPSIZE=1024 (de 100 a 1024)
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

---

### 📦 Siguiente Paso

Una vez que Node.js esté instalado y verificado, continuar con la sección **"Instalación Servicio Molinete"** de este documento.

**Checklist antes de continuar:**
- ✅ `node --version` muestra v18 o superior
- ✅ `npm --version` muestra v9 o superior
- ✅ Módulos nativos se pueden compilar (test con `npm install serialport`)
- ✅ (Linux/RPi) Usuario pertenece a grupos `dialout` y `plugdev`
- ✅ (Windows) Puertos COM visibles en Administrador de dispositivos

---

## 🔧 Instalación Backend

### 1. Actualizar Base de Datos

```bash
cd server

# Aplicar migraciones
npx prisma db push

# Generar cliente Prisma
npx prisma generate

# Ejecutar seed para permisos
npx prisma db seed
```

**Verificar:**
```sql
SELECT * FROM permisos WHERE codigo LIKE 'ACCESOS%';
```
Debe retornar 2 permisos: `ACCESOS_VER` y `ACCESOS_GESTIONAR`.

### 2. Crear Dispositivo de Acceso

Desde Prisma Studio o SQL:

```sql
INSERT INTO dispositivos_acceso (
  codigo, nombre, ubicacion, ip_local, puerto,
  puerto_serial_rfid, tipo_relay, pin_relay,
  tiempo_apertura, modo_offline, intervalo_sync,
  activo, created_at, updated_at
) VALUES (
  'MOLINETE_PRINCIPAL',
  'Molinete Entrada Principal',
  'Hall de entrada',
  '192.168.1.100',
  3002,
  'COM3',
  'USB_RELAY',
  NULL,
  3,
  true,
  5,
  true,
  NOW(),
  NOW()
);
```

Obtener el ID generado (será el `dispositivoId` en la config del servicio).

### 3. Asignar Permisos a Roles

```sql
-- Asignar al rol ADMIN
INSERT INTO permisos_rol (rol_id, permiso_id)
SELECT
  (SELECT id FROM roles WHERE codigo = 'ADMIN'),
  id
FROM permisos
WHERE codigo IN ('ACCESOS_VER', 'ACCESOS_GESTIONAR');
```

### 4. Configurar Nginx (Opcional)

```nginx
# /etc/nginx/sites-available/rojoplus

server {
    listen 80;
    server_name sportivo.axiomacloud.com;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sportivo.axiomacloud.com;

    ssl_certificate /etc/letsencrypt/live/sportivo.axiomacloud.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sportivo.axiomacloud.com/privkey.pem;

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket para monitor de accesos
    location /accesos/monitor {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Frontend
    location / {
        root /var/www/rojoplus/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Service Worker y Manifest para PWA
    location ~ ^/(service-worker\.js|manifest\.json)$ {
        root /var/www/rojoplus/client/dist;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
```

Reiniciar Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Iniciar Backend con PM2

```bash
cd server

# Instalar PM2 globalmente (si no está instalado)
npm install -g pm2

# Iniciar aplicación
pm2 start src/index.js --name rojoplus-api

# Guardar configuración
pm2 save

# Auto-inicio en boot
pm2 startup
```

---

## 🖥️ Instalación Servicio Molinete

### 1. Preparar PC del Molinete

**En Windows:**
```powershell
# Crear directorio
mkdir C:\RojoPlus\molinete-service
cd C:\RojoPlus\molinete-service

# Copiar archivos del proyecto
# (Transferir carpeta molinete-service/ del repositorio)
```

**En Linux/Raspberry Pi:**
```bash
sudo mkdir -p /opt/rojoplus/molinete-service
cd /opt/rojoplus/molinete-service

# Copiar archivos
sudo chown -R $USER:$USER .
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Detectar Hardware

**Lector USB:**
```bash
npm run detectar-usb
```

Copiar `vendorId` y `productId` del lector identificado.

**Lector RFID:**
```bash
npm run detectar-rfid
```

Identificar el puerto (ej: COM3 en Windows, /dev/ttyUSB0 en Linux).

**Nota para Linux:** Dar permisos al puerto serial:
```bash
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0
```

### 4. Configurar config.json

Editar `config.json` con valores reales:

```json
{
  "apiUrl": "https://sportivo.axiomacloud.com/api",
  "dispositivoId": 1,
  "puerto": 3002,
  "puertoWebSocket": 3003,

  "lectorUSB": {
    "tipo": "HID",
    "vendorId": "0x05FE",  // ← Cambiar con valor real
    "productId": "0x1010",  // ← Cambiar con valor real
    "habilitado": true
  },

  "lectorRFID": {
    "tipo": "SERIAL",
    "puerto": "COM3",  // ← Windows: COM3, Linux: /dev/ttyUSB0
    "baudRate": 9600,
    "habilitado": true
  },

  "molinete": {
    "tipo": "USB_RELAY",
    "puerto": "COM4",  // ← Puerto del relay
    "baudRate": 9600,
    "comandoON": "A0:01:01",  // ← Cambiar según relay
    "comandoOFF": "A0:01:00",  // ← Cambiar según relay
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

### 5. Probar Manualmente

```bash
npm start
```

**Verificar en consola:**
- ✓ Base de datos SQLite inicializada
- ✓ Sincronización completada
- ✓ Lector USB inicializado (si habilitado)
- ✓ Lector RFID inicializado (si habilitado)
- ✓ Relay molinete inicializado
- ✓ Servidor HTTP en puerto 3002
- ✓ WebSocket en puerto 3003

**Abrir navegador:** http://localhost:3002

Debe mostrar el monitor web.

### 6. Configurar como Servicio

**Windows - NSSM (Non-Sucking Service Manager):**

```powershell
# Descargar NSSM desde https://nssm.cc/download
# Extraer y ejecutar:

nssm install RojoPlusMolinete

# En el GUI:
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\RojoPlus\molinete-service
# Arguments: index.js

# Iniciar servicio
nssm start RojoPlusMolinete

# Configurar auto-inicio
nssm set RojoPlusMolinete Start SERVICE_AUTO_START
```

**Linux - Systemd:**

Crear archivo `/etc/systemd/system/rojoplus-molinete.service`:

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
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rojoplus-molinete
sudo systemctl start rojoplus-molinete

# Ver status
sudo systemctl status rojoplus-molinete

# Ver logs
sudo journalctl -u rojoplus-molinete -f
```

---

## 🔌 Configuración Hardware

### Lector USB (Código de Barras/QR)

**Configuración del lector:**
1. Modo HID (keyboard wedge) - sin software adicional
2. Sufijo: Enter (CR/LF) - para detectar fin de lectura
3. Prefijo: Ninguno
4. Formato: Texto plano

**Modelos recomendados:**
- Honeywell Voyager 1200g/1400g/1900
- Zebra DS2208/DS4308
- Datalogic QuickScan QD2430

### Lector RFID

**Configuración:**
- Protocolo: Wiegand o Serial
- Si Serial: 9600 baud, 8N1
- Formato de salida: UID hexadecimal

**Modelos recomendados:**
- MFRC522 (módulo económico)
- PN532 (más versátil)
- ACR122U (USB, más caro)

**Conexión típica (Serial):**
```
Lector    →  Conversor USB-Serial
VCC (5V)  →  5V
GND       →  GND
TX        →  RX
RX        →  TX
```

### Relay Molinete

**Opciones de conexión:**

**1. USB Relay (Más simple):**
- Comprar módulo relay USB (ej: DSD TECH SH-U01A)
- Conectar USB a PC
- Configurar comandos hex en config.json

**2. GPIO (Raspberry Pi):**
```javascript
// En config.json:
"molinete": {
  "tipo": "GPIO",
  "pin": 17,  // GPIO 17 (pin físico 11)
}
```

**Conexión relay:**
```
Raspberry Pi GPIO 17 → IN (relay)
Raspberry Pi GND    → GND (relay)
Relay VCC           → 5V (fuente externa)
Relay COM           → Cable común molinete
Relay NO            → Cable señal molinete
```

**3. Serial Relay:**
```javascript
"molinete": {
  "tipo": "USB_RELAY",
  "puerto": "COM4",
  "baudRate": 9600,
  "comandoON": "A0:01:01",   // Hex específico del relay
  "comandoOFF": "A0:01:00"
}
```

**Calibración:**

Para encontrar los comandos correctos:
1. Usar software serial monitor (PuTTY, RealTerm)
2. Probar comandos hex comunes:
   - `A0 01 01` (ON), `A0 01 00` (OFF)
   - `FF 01 01` (ON), `FF 01 00` (OFF)
3. Medir con multímetro continuidad en relay

### LED y Buzzer (Opcional)

Si se desean señales visuales/sonoras adicionales:

**GPIO Raspberry Pi:**
```javascript
"señalizacion": {
  "ledVerde": {
    "tipo": "GPIO",
    "pin": 23
  },
  "ledRojo": {
    "tipo": "GPIO",
    "pin": 24
  },
  "buzzer": {
    "tipo": "GPIO",
    "pin": 25
  }
}
```

**Conexión:**
```
GPIO 23 → LED Verde (+ resistencia 220Ω) → GND
GPIO 24 → LED Rojo (+ resistencia 220Ω) → GND
GPIO 25 → Buzzer (+) → GND
```

---

## 📱 Configuración PWA

### 1. HTTPS Obligatorio

PWA requiere HTTPS en producción. Usar Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d sportivo.axiomacloud.com
```

### 2. Verificar manifest.json

Editar `client/public/manifest.json` con URLs de producción:

```json
{
  "start_url": "https://sportivo.axiomacloud.com/admin/accesos/control-pwa",
  "scope": "/admin/",
  ...
}
```

### 3. Generar Iconos

Crear iconos en tamaños requeridos:

```bash
# Desde logo original (logo.png)
convert logo.png -resize 192x192 public/logo192.png
convert logo.png -resize 512x512 public/logo512.png
```

### 4. Probar Instalación

**En Chrome DevTools:**
1. Application → Manifest
2. Verificar que se carga correctamente
3. Application → Service Workers
4. Verificar que se registra

**En móvil:**
1. Abrir https://tu-dominio.com/admin/accesos/control-pwa
2. Chrome menú → "Agregar a pantalla de inicio"
3. Verificar ícono y nombre

---

## ⚙️ Optimizaciones

### Performance Backend

**Índices adicionales (si muchos accesos):**

```sql
CREATE INDEX idx_registros_acceso_dispositivo_fecha
ON registros_acceso(dispositivo_id, fecha DESC);

CREATE INDEX idx_intentos_denegados_valor_fecha
ON intentos_acceso_denegado(valor_leido, fecha DESC)
WHERE resuelto = false;
```

**Limpieza periódica (cron job):**

```sql
-- Eliminar registros de acceso antiguos (> 6 meses)
DELETE FROM registros_acceso
WHERE fecha < NOW() - INTERVAL '6 months';

-- Eliminar intentos denegados resueltos (> 30 días)
DELETE FROM intentos_acceso_denegado
WHERE resuelto = true
  AND fecha_resolucion < NOW() - INTERVAL '30 days';
```

### Servicio Molinete

**Aumentar intervalo de sync si red lenta:**

```json
"sync": {
  "intervalo": 10,  // 10 minutos en lugar de 5
  "autoSync": true
}
```

**Reducir tamaño de cache SQLite:**

```javascript
// En db/cache.js, agregar vacuum periódico
setInterval(() => {
  db.exec('VACUUM')
}, 24 * 60 * 60 * 1000) // 1 vez al día
```

### Frontend

**Lazy loading de páginas pesadas:**

```javascript
// En App.jsx
const MonitorAccesos = lazy(() => import('./pages/admin/accesos/MonitorAccesos'))
const IntentosDenegados = lazy(() => import('./pages/admin/accesos/IntentosDenegados'))
```

**WebSocket reconnect automático:**

Ya implementado en MonitorAccesos.jsx, pero verificar timeout:

```javascript
ws.onclose = () => {
  setTimeout(conectar, 3000) // Reconectar después de 3s
}
```

---

## 📊 Monitoreo y Mantenimiento

### Logs a Monitorear

**Backend (PM2):**
```bash
pm2 logs rojoplus-api --lines 100
```

**Servicio Molinete:**
```bash
# Windows
type C:\RojoPlus\molinete-service\logs\molinete.log

# Linux
tail -f /opt/rojoplus/molinete-service/logs/molinete.log
```

**Nginx:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Métricas Importantes

**Dashboard de PostgreSQL:**
```sql
-- Cantidad de accesos por día
SELECT
  DATE(fecha) as dia,
  COUNT(*) as total,
  SUM(CASE WHEN resultado = 'PERMITIDO' THEN 1 ELSE 0 END) as permitidos,
  SUM(CASE WHEN resultado = 'DENEGADO' THEN 1 ELSE 0 END) as denegados
FROM registros_acceso
WHERE fecha >= NOW() - INTERVAL '7 days'
GROUP BY DATE(fecha)
ORDER BY dia DESC;

-- Intentos denegados pendientes
SELECT COUNT(*) as pendientes
FROM intentos_acceso_denegado
WHERE resuelto = false;

-- Estado de dispositivos
SELECT
  nombre,
  ubicacion,
  ultimo_ping,
  EXTRACT(EPOCH FROM (NOW() - ultimo_ping)) / 60 as minutos_inactivo
FROM dispositivos_acceso
WHERE activo = true;
```

### Backups

**Base de datos (diario):**
```bash
#!/bin/bash
# backup-rojoplus.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/rojoplus"

# Backup PostgreSQL
pg_dump -U postgres rojoplus > "$BACKUP_DIR/rojoplus_$DATE.sql"

# Comprimir
gzip "$BACKUP_DIR/rojoplus_$DATE.sql"

# Mantener solo últimos 30 días
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

**SQLite del molinete (semanal):**
```bash
# Copiar cache.db
cp /opt/rojoplus/molinete-service/db/cache.db \
   /backups/molinete/cache_$(date +%Y%m%d).db
```

### Alertas

**Configurar email para errores críticos:**

En `molinete-service/index.js`, agregar:

```javascript
process.on('uncaughtException', (error) => {
  logger.error(`Error crítico: ${error.message}`)

  // Enviar email (usar nodemailer)
  enviarAlertaEmail({
    asunto: 'Error Crítico - Molinete',
    mensaje: error.stack
  })
})
```

**Monitoreo de dispositivo offline:**

```sql
-- Crear función que envíe alerta si dispositivo lleva > 10 min sin ping
CREATE OR REPLACE FUNCTION check_dispositivo_offline()
RETURNS void AS $$
BEGIN
  -- Lógica de alerta
END;
$$ LANGUAGE plpgsql;

-- Ejecutar cada 5 minutos con cron o pg_cron
```

---

## ✅ Checklist de Producción

Antes de ir a producción, verificar:

### Backend
- [ ] Base de datos con índices optimizados
- [ ] Backups automáticos configurados
- [ ] PM2 con auto-restart
- [ ] Nginx con HTTPS
- [ ] CORS configurado correctamente
- [ ] Variables de entorno protegidas

### Servicio Molinete
- [ ] Config.json con valores de producción
- [ ] Hardware detectado y probado
- [ ] Servicio configurado con auto-inicio
- [ ] Logs rotando correctamente
- [ ] Sincronización funcionando
- [ ] Cache SQLite operativo

### Frontend
- [ ] Build de producción optimizado
- [ ] Service Worker registrado
- [ ] Manifest.json correcto
- [ ] PWA instalable
- [ ] Iconos de todos los tamaños

### Testing
- [ ] Todos los escenarios de TESTING_CONTROL_ACCESOS.md pasados
- [ ] Pruebas de carga realizadas
- [ ] Modo offline probado
- [ ] Recuperación de errores probada

### Documentación
- [ ] Manual de usuario creado
- [ ] Procedimientos de troubleshooting documentados
- [ ] Contactos de soporte definidos

---

## 🎯 Próximos Pasos Post-Implementación

1. **Período de prueba (1 semana):**
   - Monitorear logs diariamente
   - Recolectar feedback de operadores
   - Ajustar timings si es necesario

2. **Capacitación:**
   - Entrenar operadores en uso de /admin/accesos/intentos-denegados
   - Demostrar PWA móvil
   - Explicar procedimientos de emergencia

3. **Optimizaciones:**
   - Ajustar intervalos de sincronización según carga
   - Configurar alertas basadas en métricas reales
   - Implementar features adicionales según necesidad

---

**Sistema listo para producción** ✨🚀
