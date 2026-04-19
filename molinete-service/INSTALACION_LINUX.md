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

Sin esto el servicio no puede acceder a los puertos seriales ni a los dispositivos HID sin ejecutarse como root.

```bash
# Acceso a puertos seriales (lector RFID y relay del molinete)
sudo usermod -aG dialout $USER

# Acceso a dispositivos HID (lector USB de código de barras / QR)
sudo usermod -aG plugdev $USER
```

**Importante:** los cambios de grupo aplican al cerrar sesión y volver a entrar. Para aplicarlos en la sesión actual sin reiniciar:

```bash
newgrp dialout
```

Verificar que los grupos quedaron asignados:

```bash
groups $USER
# Debe mostrar: ... dialout plugdev ...
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

## 3. Detectar el lector USB

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

Cuando dos lectores son idénticos (mismo fabricante y modelo), tienen el mismo `vendorId` y `productId`. En ese caso, usar el `Path` para diferenciarlos:

- El `path` en Linux es estable mientras el dispositivo esté conectado al mismo puerto USB físico.
- Si se desconecta y reconecta en el mismo puerto, suele mantener el mismo path.
- Si se cambia de puerto USB, el path puede cambiar.

Para que el path sea siempre el mismo independientemente del puerto, crear una regla udev basada en el número de serie del dispositivo (ver sección de Troubleshooting).

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

## 4. Detectar el lector RFID

El lector RFID se conecta por USB pero expone un puerto serial.

```bash
npm run detectar-rfid
```

En Linux los dispositivos seriales aparecen como `/dev/ttyUSB0`, `/dev/ttyACM0`, etc.

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

---

## 5. Configurar config.json

Editar `config.json` con los valores obtenidos en los pasos anteriores:

```json
{
  "apiUrl": "http://IP_DEL_SERVIDOR:3001/api",
  "dispositivoId": 1,
  "puerto": 3002,

  "lectorUSB": {
    "habilitado": true,
    "dispositivos": [
      {
        "vendorId": "0x0C2E",
        "productId": "0x0200",
        "descripcion": "Lector código de barras entrada"
      }
    ]
  },

  "lectorRFID": {
    "puerto": "/dev/ttyUSB0",
    "baudRate": 9600,
    "habilitado": true
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

**Referencia de campos:**

| Campo | Descripción |
|-------|-------------|
| `apiUrl` | URL del servidor RojoPlus. Misma PC: `http://localhost:3001/api`. Otra máquina: `http://192.168.1.100:3001/api` |
| `dispositivoId` | ID del dispositivo configurado en el panel de administración |
| `lectorUSB.vendorId` / `productId` | Obtenidos en el paso 3. Formato: `"0x0C2E"` |
| `lectorRFID.puerto` | Path del puerto serial. Ej: `"/dev/ttyUSB0"` |
| `molinete.puerto` | Path del puerto serial del relay. Ej: `"/dev/ttyUSB1"` |
| `molinete.comandoON` | Bytes hex para abrir el relay. El relay CH340 usa `"A0:01:01"` |
| `molinete.comandoOFF` | Bytes hex para cerrar el relay. El relay CH340 usa `"A0:01:00"` |

---

## 6. Ejecutar el servicio

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

---

## 7. Registrar como servicio del sistema

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

## 8. Troubleshooting

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

## 9. Espiar señales de una aplicación existente

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
