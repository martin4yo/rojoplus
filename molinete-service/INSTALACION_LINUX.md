# Instalación en Linux — Servicio de Molinete RojoPlus

> Guía para Ubuntu / Debian y derivados. En otras distribuciones reemplazar `apt` por el gestor correspondiente (`dnf`, `pacman`, etc.).

## Índice

0. [Copiar los archivos a Linux](#0-copiar-los-archivos-a-linux)
1. [Requisitos previos](#1-requisitos-previos)
2. [Instalar el servicio](#2-instalar-el-servicio)
3. [Modos de operación del lector USB](#3-modos-de-operación-del-lector-usb)
4. [Detectar el lector USB (solo modo hidraw)](#4-detectar-el-lector-usb-solo-modo-hidraw)
5. [Detectar el lector RFID](#5-detectar-el-lector-rfid)
6. [Configurar config.json](#6-configurar-configjson)
7. [Ejecutar el servicio](#7-ejecutar-el-servicio)
8. [Modo kiosco — pantalla completa al arrancar](#8-modo-kiosco--pantalla-completa-al-arrancar)
9. [Registrar como servicio del sistema](#9-registrar-como-servicio-del-sistema)
10. [Troubleshooting](#10-troubleshooting)
11. [Espiar señales de una aplicación existente](#11-espiar-señales-de-una-aplicación-existente)

---

## 0. Copiar los archivos a Linux

El proyecto está en Windows y hay que pasarlo a la PC Linux donde va a correr el molinete. Hay tres formas según el escenario.

---

### Opción A — USB (sin internet)

**En Windows:**

1. Copiar la carpeta `molinete-service` al USB. **No copiar `node_modules`** — esa carpeta pesa mucho y los binarios compilados en Windows no sirven en Linux. Solo copiar:
   ```
   molinete-service/
     index.js
     package.json
     config.json
     db/
     public/
     scripts/
   ```
   Para excluir `node_modules` fácilmente: copiar la carpeta entera al USB y luego borrar `node_modules` del USB antes de sacar.

2. Conectar el USB en la PC Linux.

**En Linux:**

3. Ver dónde montó el USB:
   ```bash
   lsblk
   # o
   ls /media/$USER/
   ```
   Suele aparecer en `/media/usuario/NOMBRE_DEL_USB`.

4. Copiar la carpeta al home:
   ```bash
   cp -r /media/$USER/NOMBRE_DEL_USB/molinete-service ~/molinete-service
   ```

5. Verificar que llegaron los archivos:
   ```bash
   ls ~/molinete-service
   # Debe mostrar: index.js  package.json  config.json  db  public  scripts
   ```

---

### Opción B — Red local (si ambas PCs están en la misma red)

Sin USB, directamente de Windows a Linux por la red.

**En Windows** — abrir PowerShell y ejecutar:

```powershell
# Copiar al Linux via SCP (requiere que Linux tenga SSH activo)
scp -r D:\Desarrollos\React\clubix\molinete-service usuario@192.168.1.XX:/home/usuario/
```

Reemplazar `usuario` y `192.168.1.XX` con los datos del Linux.

Si Linux no tiene SSH, activarlo:
```bash
sudo apt install -y openssh-server
sudo systemctl enable ssh
sudo systemctl start ssh
```

Luego ejecutar el `scp` desde Windows.

---

### Opción C — Git (recomendado si el proyecto está en un repositorio)

Si el proyecto está en GitHub u otro repositorio Git, es la forma más limpia — siempre trae la versión más actualizada y no necesita USB ni red local directa.

**En Linux:**

```bash
# Instalar git si no está
sudo apt install -y git

# Clonar solo la carpeta molinete-service (sparse checkout)
git clone --filter=blob:none --sparse https://github.com/usuario/clubix.git
cd clubix
git sparse-checkout set molinete-service

# Mover al home si preferís
cp -r molinete-service ~/molinete-service
```

O si querés clonar el repo completo:
```bash
git clone https://github.com/usuario/clubix.git
cd clubix/molinete-service
```

---

Una vez que los archivos están en Linux, continuar con el paso 1.

---

## 1. Requisitos previos

### Node.js y npm

No usar el Node.js del repositorio de Ubuntu — suele estar desactualizado. Instalar desde NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version
npm --version
```

### Herramientas de compilación

En Linux, `better-sqlite3` y `node-hid` tienen binarios precompilados para x64, por lo que en la mayoría de los casos `npm install` no necesita compilar nada. De todas formas, instalar las herramientas por si alguna dependencia lo requiere:

```bash
sudo apt install -y build-essential python3
```

### Permisos de dispositivos

Sin esto el servicio no puede acceder a los puertos seriales:

```bash
# Acceso a puertos seriales (lector RFID y relay del molinete)
sudo usermod -aG dialout $USER
```

> Solo si vas a usar el lector USB en **modo hidraw** (ver sección 3), además hacer:
> ```bash
> sudo usermod -aG plugdev $USER
> ```
> En **modo teclado** (por defecto) no hace falta porque los lectores se leen por el navegador — sin acceso directo a `/dev/hidrawX`.

**Importante:** los cambios de grupo aplican al cerrar sesión y volver a entrar. Para aplicarlos en la sesión actual sin reiniciar:

```bash
newgrp dialout
```

Verificar que los grupos quedaron asignados:

```bash
groups $USER
# Debe mostrar: ... dialout (y plugdev si vas a usar modo hidraw)
```

### Git (opcional)

```bash
sudo apt install -y git
```

---

## 2. Instalar el servicio

```bash
cd molinete-service
npm install
```

Si falla con errores de compilación:

```bash
sudo apt install -y build-essential python3
npm install
```

---

## 3. Modos de operación del lector USB

El servicio soporta dos formas de leer los códigos escaneados. Se elige con el flag `lectorUSB.modoTeclado` en `config.json`.

### Modo TECLADO (recomendado, por defecto)

```json
"lectorUSB": {
  "habilitado": true,
  "modoTeclado": true
}
```

Los lectores USB son teclados HID — escriben el código + Enter como si fueran teclas. En este modo:

- El **navegador** con el monitor web abierto (`http://localhost:3002`) captura las teclas.
- Lo manda al servicio por `POST /api/lectura-teclado`, entra al mismo flujo de validación que cualquier otra lectura.
- **No requiere** permisos hidraw, reglas udev, ni VID/PID. Funciona con cualquier lector que actúe como teclado HID.
- Soporta **varios lectores simultáneos** sin configuración extra — todos los lectores tipean al navegador.

**Requisito:** la PC tiene que estar en modo kiosco con el navegador mostrando el monitor web en pantalla completa y con foco. Ver sección 8 (Modo kiosco).

**Cuándo NO sirve este modo:**
- Si la PC tiene escritorio y el usuario puede cambiar de ventana — las lecturas se "tipean" en la app que tenga foco.
- Si el servicio corre sin display (headless). En ese caso → modo hidraw.

### Modo HIDRAW (alternativo)

```json
"lectorUSB": {
  "habilitado": true,
  "modoTeclado": false,
  "dispositivos": [
    { "vendorId": "0x0C2E", "productId": "0x0200", "descripcion": "Lector entrada" }
  ]
}
```

El servicio abre `/dev/hidrawX` directamente con `node-hid`. Requiere identificar cada lector por VID/PID (y opcionalmente `path` si son iguales) y configurar permisos. Si vas a usar este modo, continuar con la sección 4. Si usás modo teclado, saltar a sección 5.

---

## 4. Detectar el lector USB (solo modo hidraw)

> Esta sección solo es necesaria si `lectorUSB.modoTeclado = false`.

El lector de código de barras / QR se conecta por USB y es reconocido como dispositivo HID.

```bash
npm run detectar-usb
```

El script lista **todos** los dispositivos HID conectados: teclados, mouse, hubs, lectores, etc. Si hay varios lectores conectados al mismo tiempo, todos van a aparecer en la lista.

Ejemplo de salida con múltiples dispositivos:

```
Dispositivo #1
  Fabricante:   Logitech
  Producto:     USB Keyboard
  Vendor ID:    0x046D  (1133)
  Product ID:   0xC31C  (49948)
  Usage:        6  ← teclado HID
  UsagePage:    1
  Path:         /dev/hidraw0

Dispositivo #2
  Fabricante:   Logitech
  Producto:     USB Mouse
  Vendor ID:    0x046D  (1133)
  Product ID:   0xC077  (49271)
  Usage:        2  ← mouse HID
  UsagePage:    1
  Path:         /dev/hidraw1

Dispositivo #3
  Fabricante:   Honeywell
  Producto:     Barcode Scanner
  Vendor ID:    0x0C2E  (3118)
  Product ID:   0x0200  (512)
  Usage:        6  ← teclado HID (lector de barras)
  UsagePage:    1
  Path:         /dev/hidraw2

Dispositivo #4
  Fabricante:   Datalogic
  Producto:     QR Scanner
  Vendor ID:    0x05F9  (1529)
  Product ID:   0x2204  (8708)
  Usage:        6  ← teclado HID (lector QR)
  UsagePage:    1
  Path:         /dev/hidraw3
```

### Cómo identificar cuál es cuál cuando hay varios lectores

Los lectores de código de barras y QR aparecen igual que un teclado (`usage: 6`, `usagePage: 1`). Para distinguirlos:

**Método 1 — Por fabricante/producto:** Si el `Fabricante` y `Producto` son legibles, es suficiente para identificar el lector correcto.

**Método 2 — Desconectar y reconectar:** Ejecutar `npm run detectar-usb` con todos desconectados, luego conectar uno por vez y volver a ejecutar — el nuevo dispositivo que aparece es el que se acaba de conectar.

**Método 3 — Por Path (`/dev/hidrawX`):** Cada dispositivo tiene un path único. Para saber a cuál corresponde cada path:
```bash
# Ver qué dispositivo físico corresponde a cada hidraw
for dev in /dev/hidraw*; do
  echo -n "$dev → "
  udevadm info -q property -n $dev | grep -E "ID_MODEL=|ID_VENDOR="
done
```

### Si hay dos lectores del mismo modelo (mismo VID/PID)

Cuando dos lectores son idénticos (mismo fabricante y modelo), tienen el mismo `vendorId` y `productId`. Hay que **especificar el campo `path`** en cada entrada del config para que el servicio abra ambos dispositivos en vez de intentar abrir dos veces el mismo:

```json
"dispositivos": [
  {
    "vendorId": "0x0C2E",
    "productId": "0x0200",
    "path": "/dev/hidraw2",
    "descripcion": "Lector entrada"
  },
  {
    "vendorId": "0x0C2E",
    "productId": "0x0200",
    "path": "/dev/hidraw4",
    "descripcion": "Lector salida"
  }
]
```

El campo `path` es opcional — si no está, el servicio usa solo VID/PID y deduplica. Si está, matchea exactamente ese dispositivo.

**Cuidado:** `/dev/hidrawX` puede cambiar al reconectar o reiniciar. Para un path estable, crear symlinks udev basados en el puerto USB físico:

```bash
# Ver el puerto USB de cada lector
udevadm info -a -n /dev/hidraw2 | grep KERNELS | head -3
udevadm info -a -n /dev/hidraw4 | grep KERNELS | head -3
# Devuelve algo como KERNELS=="1-1.2" y KERNELS=="1-1.3"

# Crear regla con symlinks fijos
sudo tee /etc/udev/rules.d/99-molinete-lectores.rules <<'EOF'
SUBSYSTEM=="hidraw", KERNELS=="1-1.2", MODE="0666", SYMLINK+="lector_entrada"
SUBSYSTEM=="hidraw", KERNELS=="1-1.3", MODE="0666", SYMLINK+="lector_salida"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Luego en config: `"path": "/dev/lector_entrada"` y `"path": "/dev/lector_salida"`. Así el path es estable sin importar el orden de arranque.

### Qué anotar

Para cada lector, anotar `Vendor ID` y `Product ID`. Luego agregarlos en `config.json` dentro del array `dispositivos`:

```json
"lectorUSB": {
  "habilitado": true,
  "dispositivos": [
    {
      "vendorId": "0x0C2E",
      "productId": "0x0200",
      "descripcion": "Lector código de barras"
    },
    {
      "vendorId": "0x05F9",
      "productId": "0x2204",
      "descripcion": "Lector QR"
    }
  ]
}
```

El servicio abre todos los dispositivos de la lista simultáneamente. Cualquier lectura de cualquiera de ellos se procesa de la misma forma. Se pueden agregar tantos como sea necesario.

### Permisos HID

En Linux, `node-hid` puede abrir dispositivos HID directamente sin cambiar drivers (a diferencia de Windows). El único requisito es tener permisos sobre el archivo `/dev/hidrawX`.

Si el script detecta el lector pero aparece un error de permisos al iniciarlo:

```bash
# Verificar permisos del dispositivo
ls -la /dev/hidraw*
# Resultado esperado: crw-rw---- 1 root plugdev ...

# Si el grupo no es plugdev, crear una regla udev permanente:
# Reemplazar 0c2e y 0200 con el VID/PID real del lector
echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0c2e", ATTRS{idProduct}=="0200", MODE="0666", GROUP="plugdev"' \
  | sudo tee /etc/udev/rules.d/99-molinete.rules

sudo udevadm control --reload-rules
sudo udevadm trigger
```

Desconectar y reconectar el lector para que aplique la regla.

---

## 5. Detectar el lector RFID

El lector RFID puede venir de dos formas según el hardware:

- **USB con chip serial adentro** (más común) — aparece como `/dev/ttyUSB0` o `/dev/ttyACM0`. Se conecta por USB pero internamente un chip CH340/CP210x/FTDI lo convierte a serial.
- **RS232 puro** (DB9) — aparece como `/dev/ttyS0`, `/dev/ttyS1`, etc. Requiere que la PC tenga puerto serie físico (DB9 macho atrás del gabinete, placa PCIe, o adaptador USB-serial externo).

### Caso A — USB-serial (ttyUSB/ttyACM)

```bash
npm run detectar-rfid
```

En Linux los dispositivos aparecen como `/dev/ttyUSB0`, `/dev/ttyACM0`, etc.

Ejemplo de salida:

```
Puerto #1
  Path:         /dev/ttyUSB0
  Fabricante:   Silicon Labs
  Vendor ID:    10c4
  Serial:       0001
```

**Para identificar cuál es el lector RFID:**

```bash
# Listar puertos antes de conectar
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Conectar el lector y volver a listar — el nuevo es el correcto
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Ver detalles del dispositivo
udevadm info -a -n /dev/ttyUSB0 | grep -E "manufacturer|product|idVendor|idProduct"
```

El script también tiene una opción interactiva: ingresá el número del puerto, acercá una tarjeta RFID y verás los datos crudos recibidos.

**Nombres de puertos según el chip del dispositivo:**

| Chip | Puerto típico |
|------|---------------|
| CH340 / CH341 | `/dev/ttyUSB0` |
| CP210x (Silicon Labs) | `/dev/ttyUSB0` |
| FTDI | `/dev/ttyUSB0` |
| Arduino / ACM | `/dev/ttyACM0` |

Si hay varios dispositivos conectados, el número puede ser `ttyUSB1`, `ttyUSB2`, etc. Para que el puerto siempre tenga el mismo nombre sin importar el orden de conexión, ver la sección de reglas udev en Troubleshooting.

### Caso B — RS232 puro (ttyS)

Si el lector no aparece en `/dev/ttyUSB*` ni `/dev/ttyACM*` al enchufarlo, probablemente tenés un lector **RS232 nativo** conectado a un puerto serie físico de la PC. Aparecen como `/dev/ttyS0`, `/dev/ttyS1`, etc.

**1. Listar puertos físicos de la PC:**

```bash
ls /dev/ttyS*
dmesg | grep ttyS | head
```

Ejemplo:
```
[    1.234567] 00:03: ttyS0 at I/O 0x3f8 (irq = 4) is a 16550A
[    1.234568] 00:04: ttyS1 at I/O 0x2f8 (irq = 3) is a 16550A
```

Los que aparecen con `16550A` (o similar) son puertos reales. El kernel expone muchos `ttyS*` pero la mayoría son placeholders sin hardware detrás.

**2. Confirmar cuáles son reales:**

```bash
sudo apt install -y setserial
sudo setserial -g /dev/ttyS[0-7]
```

Resultado ejemplo:
- `/dev/ttyS0, UART: 16550A, Port: 0x03f8, IRQ: 4` → **puerto real, usable**.
- `/dev/ttyS2, UART: unknown, Port: 0x0000, IRQ: 0` → no existe físicamente.

**3. Verificar el hardware físico:**

| Hardware | Dónde está |
|----------|------------|
| DB9 macho atrás del gabinete | Placa madre con puerto serial. Típicamente es `/dev/ttyS0`. |
| Cable con DB9 que sale por ranura PCI/PCIe | Placa PCIe de puertos serie. Puede ser `/dev/ttyS4`, `/dev/ttyS5`, etc. |
| Sin DB9 pero con cable serial → USB | Hay un conversor RS232-USB en el cable (chip FTDI/CH340). Caé en el **Caso A** (`/dev/ttyUSB0`). |

**4. Permisos:**

Mismos que para `ttyUSB` — grupo `dialout`:
```bash
ls -la /dev/ttyS0
# Resultado esperado: crw-rw---- 1 root dialout ...

groups $USER
# Tiene que aparecer "dialout"
```

**5. Probar comunicación cruda:**

```bash
# Capturar datos al pasar una tarjeta
sudo cat /dev/ttyS0
# Tienen que aparecer bytes al pasar tarjeta. Ctrl+C para cortar.

# Si no aparece nada o aparecen caracteres raros, probar otros baudRate
sudo apt install -y minicom
sudo minicom -D /dev/ttyS0 -b 9600
# Si se ve basura: probar 4800, 19200, 115200
# Ctrl+A → X para salir
```

**6. Actualizar config.json:**

```json
"lectorRFID": {
  "habilitado": true,
  "dispositivos": [
    {
      "tipo": "SERIAL",
      "puerto": "/dev/ttyS0",
      "baudRate": 9600,
      "descripcion": "Lector RFID RS232"
    }
  ]
}
```

#### Sub-caso B.1 — Placa PCI/PCIe con varios puertos DB9

Si la PC tiene una placa PCI/PCIe agregada que expone 2 o más DB9, cada uno es un puerto serie independiente. El procedimiento es el mismo que el del Caso B, con algunos pasos extra para identificar qué `ttyS*` corresponde a qué DB9 físico.

**1. Verificar que Linux reconoce la placa:**

```bash
lspci | grep -i serial
# Ejemplo:
# 02:00.0 Serial controller: Oxford Semiconductor Ltd OXPCIe952 (rev 01)
# 02:00.1 Serial controller: Oxford Semiconductor Ltd OXPCIe952 (rev 01)
```

Si no aparece, la placa no está detectada — driver faltante, mal encastrada, o no compatible.

**2. Identificar los ttyS de la placa:**

```bash
sudo setserial -g /dev/ttyS[0-15] 2>/dev/null | grep -v "unknown"
```

Ejemplo con placa PCI de 2 puertos:
```
/dev/ttyS0, UART: 16550A, Port: 0x03f8, IRQ: 4    ← puerto del mother (si existe)
/dev/ttyS4, UART: 16950, Port: 0xe000, IRQ: 16   ← puerto 1 de la placa PCI
/dev/ttyS5, UART: 16950, Port: 0xe008, IRQ: 16   ← puerto 2 de la placa PCI
```

Los puertos de la placa suelen tener chip **16950** o **16C950** (Oxford/MosChip) mientras que los integrados a la motherboard son **16550A**. También se puede confirmar con `dmesg | grep -E "ttyS|serial"`.

**3. Saber cuál DB9 físico corresponde a cada ttyS:**

Los DB9 de la placa son físicamente distintos (arriba/abajo o izquierda/derecha). Para saber el mapeo, conectar el lector a uno y ver si recibe datos:

```bash
# Conectar el lector al DB9 #1 de la placa
sudo cat /dev/ttyS4
# Pasar una tarjeta. Si aparecen bytes, ese DB9 es ttyS4.
# Si no aparece nada, Ctrl+C y probar con ttyS5.

sudo cat /dev/ttyS5
# Pasar tarjeta de nuevo.
```

Alternativamente con minicom (más legible):
```bash
sudo apt install -y minicom
sudo minicom -D /dev/ttyS4 -b 9600
# Pasar tarjeta. Si aparecen caracteres → ese es el puerto.
# Ctrl+A → X para salir, probar con ttyS5.
```

**4. Permisos (igual que el Caso B):**

```bash
ls -la /dev/ttyS4 /dev/ttyS5
groups $USER  # debe incluir dialout
```

**5. Config con lector + molinete en la misma placa:**

Si el lector RFID está en un DB9 y el relay del molinete en el otro DB9 de la misma placa:

```json
"lectorRFID": {
  "habilitado": true,
  "dispositivos": [
    {
      "tipo": "SERIAL",
      "puerto": "/dev/ttyS4",
      "baudRate": 9600,
      "descripcion": "Lector RFID (DB9 superior)"
    }
  ]
},

"molinete": {
  "tipo": "USB_RELAY",
  "puerto": "/dev/ttyS5",
  "baudRate": 9600,
  "comandoON": "A0:01:01",
  "comandoOFF": "A0:01:00",
  "tiempoApertura": 3000,
  "descripcion": "Relay del molinete (DB9 inferior)"
}
```

> **Importante:** `ttyS4`/`ttyS5` son ejemplos. Usar los números reales que obtuviste con `setserial`.

### Caso C — El molinete completo (lector + relay) en un mismo cable serial

Algunos controladores integrados (Sebury, ZKTeco, ESSL, etc.) incluyen el lector RFID y la electrónica para abrir la traba en una sola placa, con un único cable serial (USB o RS232) hacia la PC. En ese caso el mismo puerto recibe las lecturas y también recibe los comandos de apertura.

La configuración actual del servicio asume **dos puertos distintos** (`lectorRFID.dispositivos[].puerto` y `molinete.puerto`). Apuntar ambos al mismo path **no funciona** — `SerialPort` no permite abrir el mismo puerto dos veces.

Si tenés este hardware, pasame la marca/modelo y el protocolo (bytes que envía al leer una tarjeta, bytes que espera para abrir) para refactorizar el servicio y que comparta un único puerto. Mientras tanto podés capturar el protocolo con:

```bash
npm run detectar-rfid
# Elegir el puerto del molinete
# Pasar varias tarjetas — anotar los bytes recibidos en hex

# Si ya existe otra app que abre el molinete, espiarla:
ps aux | grep <nombre_app>
sudo strace -p <PID> -e trace=read,write -s 256 2>&1 | grep tty
```

---

## 6. Configurar config.json

### Config recomendada (modo teclado)

```json
{
  "apiUrl": "http://IP_DEL_SERVIDOR:3001/api",
  "dispositivoId": 1,
  "puerto": 3002,

  "lectorUSB": {
    "habilitado": true,
    "modoTeclado": true
  },

  "lectorRFID": {
    "habilitado": true,
    "dispositivos": [
      {
        "tipo": "SERIAL",
        "puerto": "/dev/ttyUSB0",
        "baudRate": 9600,
        "descripcion": "Lector RFID"
      }
    ]
  },

  "molinete": {
    "tipo": "USB_RELAY",
    "puerto": "/dev/ttyUSB1",
    "baudRate": 9600,
    "comandoON": "A0:01:01",
    "comandoOFF": "A0:01:00",
    "tiempoApertura": 3000
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

### Config alternativa (modo hidraw)

Si no podés usar el kiosco web, reemplazar el bloque `lectorUSB` por:

```json
"lectorUSB": {
  "habilitado": true,
  "modoTeclado": false,
  "dispositivos": [
    {
      "vendorId": "0x0C2E",
      "productId": "0x0200",
      "descripcion": "Lector código de barras entrada"
    }
  ]
}
```

**Referencia de campos:**

| Campo | Descripción |
|-------|-------------|
| `apiUrl` | URL del servidor RojoPlus. Misma PC: `http://localhost:3001/api`. Otra máquina: `http://192.168.1.100:3001/api` |
| `dispositivoId` | ID del dispositivo configurado en el panel de administración |
| `lectorUSB.modoTeclado` | `true` (recomendado): captura por navegador. `false`: usa node-hid (requiere VID/PID y permisos) |
| `lectorUSB.dispositivos[].vendorId` / `productId` | Solo para modo hidraw. Obtenidos con `npm run detectar-usb`. Formato: `"0x0C2E"` |
| `lectorUSB.dispositivos[].path` | Opcional. Solo necesario si hay varios lectores con el mismo VID/PID |
| `lectorRFID.dispositivos[].puerto` | Path del puerto serial. Ej: `"/dev/ttyUSB0"` |
| `molinete.puerto` | Path del puerto serial del relay. Ej: `"/dev/ttyUSB1"` |
| `molinete.comandoON` | Bytes hex para abrir el relay. El relay CH340 usa `"A0:01:01"` |
| `molinete.comandoOFF` | Bytes hex para cerrar el relay. El relay CH340 usa `"A0:01:00"` |

---

## 7. Ejecutar el servicio

### Modo desarrollo (con auto-reload)

```bash
npm run dev
```

### Modo producción

```bash
npm start
```

Una vez iniciado, abrir el monitor web en: **http://localhost:3002**

Muestra el estado de todas las conexiones, los últimos accesos en tiempo real y permite abrir el molinete manualmente.

> **Si usás modo teclado:** el monitor web **tiene que estar abierto y con foco** para que los escaneos lleguen. Ver sección 8.

---

## 8. Modo kiosco — pantalla completa al arrancar

Requerido si usás `modoTeclado: true`. La idea es que al encender la PC, arranque directamente el navegador en pantalla completa mostrando el monitor web, sin escritorio ni nada que pueda robar el foco.

### Opción A — Chromium en modo kiosco con autologin

Funciona en Ubuntu/Debian con GNOME, XFCE, LXDE, etc.

**1. Instalar Chromium:**
```bash
sudo apt install -y chromium-browser
# o si preferís Chrome: descargar desde google.com/chrome
```

**2. Configurar autologin** (para que no pida contraseña al arrancar).

En Ubuntu con GDM, editar `/etc/gdm3/custom.conf`:
```ini
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=usuario
```

En LightDM (`/etc/lightdm/lightdm.conf`):
```ini
[Seat:*]
autologin-user=usuario
autologin-user-timeout=0
```

**3. Lanzar Chromium en kiosco al iniciar sesión.**

Crear `~/.config/autostart/molinete-kiosco.desktop`:
```ini
[Desktop Entry]
Type=Application
Name=Molinete Kiosco
Exec=/bin/bash -c "sleep 5 && chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble --disable-translate --autoplay-policy=no-user-gesture-required http://localhost:3002"
X-GNOME-Autostart-enabled=true
```

Flags importantes:
- `--kiosk`: pantalla completa sin chrome ni atajos para salir.
- `--noerrdialogs` + `--disable-session-crashed-bubble`: evita modales al reiniciar.
- `sleep 5`: espera a que el servicio haya levantado antes de abrir la página.

**4. Deshabilitar el bloqueo de pantalla / salvapantallas:**
```bash
# GNOME
gsettings set org.gnome.desktop.screensaver lock-enabled false
gsettings set org.gnome.desktop.session idle-delay 0

# XFCE: Settings → Power Manager → desactivar DPMS y salvapantallas
```

### Opción B — Openbox minimalista (más liviano)

Instalar un entorno mínimo que solo corre Chromium, sin escritorio:

```bash
sudo apt install -y xorg openbox chromium-browser
```

Crear `~/.config/openbox/autostart`:
```bash
# Desactivar ahorro de energía
xset s off
xset -dpms
xset s noblank

# Lanzar Chromium en kiosco
sleep 5 && chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --no-first-run --disable-session-crashed-bubble \
  http://localhost:3002 &
```

Y configurar autologin con `startx` automático en `~/.bash_profile`:
```bash
if [[ -z $DISPLAY && $(tty) == /dev/tty1 ]]; then
  startx
fi
```

### Salir del modo kiosco

Para mantenimiento, desde otra máquina por SSH o:
- **Ctrl + Alt + F2/F3**: cambia a una TTY de texto, podés ejecutar `sudo systemctl stop molinete` o matar Chromium.
- **Ctrl + Alt + F7** (o F1, según distro): volver a la sesión gráfica.

---

## 9. Registrar como servicio del sistema

Para que el servicio arranque automáticamente al encender la PC, sin necesidad de abrir una terminal.

### Paso 1 — Obtener rutas

```bash
# Ruta del ejecutable de Node
which node
# Ejemplo: /usr/bin/node

# Ruta absoluta del proyecto
realpath .
# Ejemplo: /home/usuario/molinete-service
```

### Paso 2 — Crear el archivo de servicio

```bash
sudo nano /etc/systemd/system/molinete.service
```

Pegar el siguiente contenido (reemplazar los valores entre `<>`):

```ini
[Unit]
Description=Molinete RojoPlus
After=network.target

[Service]
WorkingDirectory=<ruta_absoluta_del_proyecto>
ExecStart=<ruta_de_node> index.js
Restart=always
RestartSec=5
User=<tu_usuario>
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Ejemplo completo:

```ini
[Unit]
Description=Molinete RojoPlus
After=network.target

[Service]
WorkingDirectory=/home/usuario/molinete-service
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
User=usuario
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Paso 3 — Activar e iniciar

```bash
sudo systemctl daemon-reload
sudo systemctl enable molinete
sudo systemctl start molinete
```

### Paso 4 — Verificar estado

```bash
sudo systemctl status molinete
```

Resultado esperado:
```
● molinete.service - Molinete RojoPlus
     Loaded: loaded (/etc/systemd/system/molinete.service; enabled)
     Active: active (running) since ...
```

### Comandos de gestión

```bash
sudo systemctl stop molinete        # Detener
sudo systemctl restart molinete     # Reiniciar
sudo systemctl disable molinete     # Quitar del arranque automático
sudo journalctl -u molinete -f      # Ver logs en tiempo real
sudo journalctl -u molinete -n 100  # Ver últimas 100 líneas de log
```

---

## 10. Troubleshooting

### Los escaneos no llegan (modo teclado)

1. Verificar que el navegador tenga foco — hacer click en cualquier parte del monitor web.
2. Abrir la consola del navegador (F12 en desarrollo, o tocar pantalla con patrón específico en kiosco) y escanear — tiene que aparecer el POST a `/api/lectura-teclado` en la pestaña Network.
3. Si hay un campo `input` o `textarea` con foco, las teclas se tipean ahí en vez de ir al capturador. Hacer click fuera.
4. Si las lecturas son muy lentas, revisar `TECLADO_TIMEOUT_MS` en `public/index.html` (valor por defecto: 80ms entre teclas).
5. Verificar que el navegador es la ventana activa — si hay notificaciones o menús abiertos, roban el foco.

### "Permission denied" en /dev/ttyUSB0 o /dev/hidraw

```bash
# Verificar grupos del usuario
groups $USER

# Si no está en dialout o plugdev, agregarlo y cerrar sesión
sudo usermod -aG dialout $USER
sudo usermod -aG plugdev $USER
# Cerrar sesión y volver a entrar
```

### El puerto cambia de nombre al reconectar (ttyUSB0 pasa a ser ttyUSB1)

Crear una regla udev que asigne un nombre fijo basado en el VID/PID del dispositivo:

```bash
# Ver atributos del dispositivo (con el dispositivo conectado)
udevadm info -a -n /dev/ttyUSB0 | grep -E "idVendor|idProduct|serial"

# Crear regla con nombre fijo (reemplazar los valores)
echo 'SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", SYMLINK+="rfid_molinete"' \
  | sudo tee /etc/udev/rules.d/99-molinete-rfid.rules

sudo udevadm control --reload-rules
sudo udevadm trigger
```

Luego en `config.json` usar `/dev/rfid_molinete` en lugar de `/dev/ttyUSB0`.

### "Error en lector RFID"

1. Verificar que el puerto existe: `ls /dev/ttyUSB*`
2. Probar baudRates alternativos: `9600`, `115200`, `57600`.
3. Verificar que ningún otro proceso use el puerto: `lsof /dev/ttyUSB0`
4. Usar el script interactivo para probar la comunicación: `npm run detectar-rfid`

### "Lector USB no encontrado"

1. Verificar que el dispositivo aparece: `ls /dev/hidraw*`
2. Ejecutar `npm run detectar-usb` para obtener el VID/PID.
3. Verificar permisos: `ls -la /dev/hidraw*` — el grupo debe ser `plugdev`.
4. Si los permisos no son correctos, crear la regla udev (ver paso 3).

### El servicio systemd no arranca

```bash
# Ver el error exacto
sudo journalctl -u molinete -n 50 --no-pager

# Problemas comunes:
# - WorkingDirectory incorrecto → verificar la ruta con: ls /ruta/al/proyecto
# - ExecStart incorrecto → verificar con: which node
# - El usuario no tiene permisos → verificar grupos con: groups usuario
```

### "Error de conexión con API"

1. Verificar que el servidor backend esté corriendo.
2. Verificar `apiUrl` en `config.json`.
3. Si están en máquinas distintas, verificar que el firewall no bloquee el puerto 3001:
   ```bash
   # En el servidor
   sudo ufw allow 3001/tcp
   ```
4. El modo offline sigue funcionando con cache local.

---

## 11. Espiar señales de una aplicación existente

Si hay una aplicación que ya controla el molinete y los lectores, estas herramientas permiten capturar los bytes exactos que envía y recibe para replicar ese comportamiento en `config.json`.

### Espiar tráfico serial — RS232 (relay y RFID)

#### strace — capturar lecturas y escrituras de cualquier proceso

`strace` intercepta las llamadas al sistema de un proceso, incluyendo cada byte que escribe o lee en un puerto serial.

```bash
# Adjuntarse a un proceso existente (obtener el PID primero)
ps aux | grep nombre_aplicacion
sudo strace -p <PID> -e trace=read,write -s 256 2>&1 | grep ttyUSB

# O lanzar la aplicación directamente con strace
sudo strace -e trace=read,write -s 256 ./la_aplicacion 2>&1 | grep -A2 ttyUSB
```

La salida muestra cada operación:
```
write(5, "\xa0\x01\x01", 3)     ← 3 bytes escritos al relay (abrir)
write(5, "\xa0\x01\x00", 3)     ← 3 bytes escritos al relay (cerrar)
read(7, "4500F2AB\r\n", 10)     ← lectura del RFID
```

Los bytes de `write` al puerto del relay van directamente en `comandoON` y `comandoOFF`.

#### socat — puerto serial virtual intermediario

`socat` puede crear un par de puertos seriales virtuales donde uno es la aplicación y el otro es el dispositivo real, logueando todo lo que pasa entre ellos.

```bash
sudo apt install -y socat

# Crear par virtual: /tmp/relay_virtual ↔ /dev/ttyUSB1 (el relay real)
# Todo lo que se escriba a /tmp/relay_virtual se envía a /dev/ttyUSB1 y queda logueado
sudo socat -v /tmp/relay_virtual,raw,echo=0 /dev/ttyUSB1,raw,echo=0,b9600 2>&1 | tee /tmp/relay_log.txt
```

Luego apuntar la aplicación existente a `/tmp/relay_virtual` en lugar del puerto real. La opción `-v` muestra cada byte intercambiado con su dirección y timestamp.

#### minicom — probar comandos manualmente al relay

```bash
sudo apt install -y minicom
sudo minicom -D /dev/ttyUSB1 -b 9600
```

En minicom presionar `Ctrl+A` → `X` para salir. Para enviar bytes hex directamente:

```bash
# Enviar bytes A0 01 01 al relay y ver si abre
printf '\xa0\x01\x01' > /dev/ttyUSB1

# Enviar bytes A0 01 00 al relay y ver si cierra
printf '\xa0\x01\x00' > /dev/ttyUSB1
```

---

### Espiar tráfico USB (lector de código de barras / QR)

#### usbmon + Wireshark (gratuito)

Linux tiene soporte nativo para captura de tráfico USB a través del módulo `usbmon`.

```bash
# Cargar el módulo usbmon
sudo modprobe usbmon

# Verificar que está cargado
ls /sys/kernel/debug/usb/usbmon/

# Instalar Wireshark si no está
sudo apt install -y wireshark

# Agregar usuario al grupo wireshark para capturar sin root
sudo usermod -aG wireshark $USER
# Cerrar sesión y volver a entrar
```

En Wireshark:
1. Seleccionar la interfaz `usbmon1` (o el número del bus USB donde está el lector).
2. Iniciar captura y escanear un código.
3. Filtrar: `usb.transfer_type == 0x01` (interrupciones HID).
4. Los paquetes `URB_INTERRUPT in` contienen los keycodes del lector.

Para identificar en qué bus está el lector:
```bash
lsusb
# Bus 001 Device 004: ID 0c2e:0200 Honeywell Barcode Scanner
# → el lector está en el bus 1 → usar interfaz usbmon1 en Wireshark
```

#### evtest — capturar eventos del lector como teclado

Si el lector funciona como teclado HID, `evtest` captura los eventos de entrada directamente:

```bash
sudo apt install -y evtest
sudo evtest

# Lista los dispositivos disponibles. Seleccionar el lector por nombre.
# Al escanear un código verás los keycodes y los caracteres correspondientes.
```

Ejemplo de salida al escanear `12345678`:
```
Event: type 1 (EV_KEY), code 11 (KEY_2), value 1
Event: type 1 (EV_KEY), code 12 (KEY_3), value 1
...
Event: type 1 (EV_KEY), code 28 (KEY_ENTER), value 1
```

#### Capturar el string completo con Python

Script simple para ver exactamente qué produce el lector como dispositivo de input:

```python
# guardar como leer_lector.py y ejecutar con: python3 leer_lector.py /dev/input/eventX
import sys, evdev

device = evdev.InputDevice(sys.argv[1])
print(f"Leyendo de: {device.name}")
print("Escaneá un código...")

for event in device.read_loop():
    if event.type == evdev.ecodes.EV_KEY:
        key = evdev.categorize(event)
        if key.keystate == evdev.KeyEvent.key_down:
            print(key.keycode, end=" ", flush=True)
```

```bash
pip3 install evdev
# Encontrar el device del lector:
ls /dev/input/by-id/ | grep -i barcode
python3 leer_lector.py /dev/input/by-id/usb-Honeywell_Scanner-event-kbd
```
