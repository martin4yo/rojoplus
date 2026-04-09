# Instalación en Windows — Servicio de Molinete RojoPlus

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalar el servicio](#2-instalar-el-servicio)
3. [Detectar el lector USB](#3-detectar-el-lector-usb)
4. [Detectar el lector RFID](#4-detectar-el-lector-rfid)
5. [Configurar config.json](#5-configurar-configjson)
6. [Ejecutar el servicio](#6-ejecutar-el-servicio)
7. [Registrar como servicio de Windows](#7-registrar-como-servicio-de-windows)
8. [Troubleshooting](#8-troubleshooting)
9. [Espiar señales de una aplicación existente](#9-espiar-señales-de-una-aplicación-existente)

---

## 1. Requisitos previos

### Node.js y npm

1. Descargar Node.js LTS desde https://nodejs.org (versión 18 o superior).
2. Instalar con las opciones por defecto. `npm` se incluye automáticamente.
3. Verificar:
   ```cmd
   node --version
   npm --version
   ```

### Herramientas de compilación (obligatorio)

Los paquetes `node-hid` y `better-sqlite3` tienen módulos nativos en C++ que se compilan durante `npm install`. Sin estas herramientas la instalación falla.

**Caso A — No tenés Visual Studio instalado:**

1. Descargar [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022).
2. Durante la instalación tildar el workload **"Desarrollo de escritorio con C++"**.
3. Descargar e instalar [Python 3.x](https://www.python.org/downloads/) — tildar **"Add Python to PATH"**.

**Caso B — Ya tenés Visual Studio 2022 instalado:**

El error más común es tener VS instalado pero sin el workload de C++. Si al instalar aparece `missing any VC++ toolset`:

1. Abrir **Instalador de Visual Studio** desde el menú inicio.
2. En la tarjeta de VS 2022 clic en **Modificar**.
3. Tildar el workload **"Desarrollo de escritorio con C++"**.
4. Clic en **Modificar** y esperar que instale.

Verificar que Python esté disponible:
```cmd
python --version
```

### Git (opcional)

Para clonar o actualizar el repositorio: https://git-scm.com

---

## 2. Instalar el servicio

```cmd
cd molinete-service
npm install
```

Si falla con errores de `node-gyp`, revisar la sección de [Requisitos previos](#1-requisitos-previos) y el [Troubleshooting](#8-troubleshooting).

---

## 3. Detectar el lector USB

El lector de código de barras / QR se conecta por USB y es reconocido como dispositivo HID.

```cmd
npm run detectar-usb
```

El script lista todos los dispositivos HID con su `vendorId` y `productId`. Ejemplo de salida:

```
Dispositivo #3
  Fabricante:   Honeywell
  Producto:     Barcode Scanner
  Vendor ID:    0x0C2E  (3118)
  Product ID:   0x0200  (512)
  Interface:    0
  Usage:        6
  UsagePage:    1
```

El lector es el que tiene `usagePage: 1` y `usage: 6` (teclado HID). Anotar el `Vendor ID` y `Product ID`.

### Problema con lectores en modo teclado

La mayoría de los lectores USB se presentan como teclado HID. Windows ya tiene un driver para ellos, lo que puede impedir que `node-hid` los abra en modo exclusivo.

**Si el script detecta el lector pero el servicio no puede leerlo**, hay dos opciones:

**Opción 1 — Zadig (recomendado para producción):**

1. Descargar [Zadig](https://zadig.akeo.ie/).
2. En el menú `Options` → `List All Devices`.
3. Seleccionar el lector en el desplegable.
4. Cambiar el driver a `libusb-win32` o `WinUSB`.
5. Clic en **Replace Driver**.

> Atención: con este cambio el lector deja de funcionar como teclado en otras aplicaciones. Solo lo usa el servicio del molinete.

**Opción 2 — Sin cambiar driver:**

Si el lector actúa como teclado y la PC del molinete no tiene otras aplicaciones, el servicio puede capturar la entrada simulando que es la ventana activa. Esta opción es menos confiable.

---

## 4. Detectar el lector RFID

El lector RFID se conecta por USB pero expone un puerto COM serial.

```cmd
npm run detectar-rfid
```

El script lista los puertos COM disponibles. Ejemplo:

```
Puerto #2
  Path:         COM3
  Fabricante:   Silicon Labs
  Vendor ID:    10c4
  Serial:       0001
```

Para identificar cuál es el lector RFID:
1. Desconectar el lector.
2. Ejecutar `npm run detectar-rfid` y anotar los puertos listados.
3. Conectar el lector.
4. Ejecutar de nuevo — el puerto nuevo es el del lector.

También se puede verificar en el **Administrador de Dispositivos** (`devmgmt.msc`) → "Puertos (COM y LPT)".

El script tiene una opción interactiva para probar el puerto: ingresar el número del puerto, acercar una tarjeta RFID y ver los datos crudos recibidos.

---

## 5. Configurar config.json

Editar `config.json` con los valores obtenidos en los pasos anteriores:

```json
{
  "apiUrl": "http://IP_DEL_SERVIDOR:3001/api",
  "dispositivoId": 1,
  "puerto": 3002,

  "lectorUSB": {
    "vendorId": "0x0C2E",
    "productId": "0x0200",
    "habilitado": true
  },

  "lectorRFID": {
    "puerto": "COM3",
    "baudRate": 9600,
    "habilitado": true
  },

  "molinete": {
    "tipo": "USB_RELAY",
    "puerto": "COM4",
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
| `lectorRFID.puerto` | Puerto COM del lector RFID. Ej: `"COM3"` |
| `molinete.puerto` | Puerto COM del relay que controla el molinete. Ej: `"COM4"` |
| `molinete.comandoON` | Bytes hex para abrir el relay. El relay CH340 usa `"A0:01:01"` |
| `molinete.comandoOFF` | Bytes hex para cerrar el relay. El relay CH340 usa `"A0:01:00"` |

---

## 6. Ejecutar el servicio

### Modo desarrollo (con auto-reload)

```cmd
npm run dev
```

### Modo producción

```cmd
npm start
```

Una vez iniciado, abrir el monitor web en: **http://localhost:3002**

Muestra el estado de todas las conexiones, los últimos accesos en tiempo real y permite abrir el molinete manualmente.

---

## 7. Registrar como servicio de Windows

Para que el servicio arranque automáticamente con Windows sin abrir una terminal:

```cmd
:: Ejecutar como Administrador
npm install -g node-windows
node install-service.js
```

Esto registra el proceso en el **Administrador de Servicios** (`services.msc`) bajo el nombre "Molinete RojoPlus".

Para desinstalar:
```cmd
node uninstall-service.js
```

---

## 8. Troubleshooting

### "Lector USB no encontrado"

1. Ejecutar `npm run detectar-usb` con el lector conectado.
2. Verificar que el VID/PID en `config.json` coincida exactamente con la salida del script.
3. Si aparece en el listado pero el servicio no puede abrirlo, instalar el driver con Zadig (ver paso 3).
4. Reiniciar el servicio.

### "Error en lector RFID"

1. Ejecutar `npm run detectar-rfid` para confirmar el puerto.
2. Verificar en el Administrador de Dispositivos que el puerto aparece.
3. Probar baudRates alternativos: `9600`, `115200`, `57600`.
4. Verificar que ningún otro programa (Putty, Arduino IDE, etc.) tenga el puerto abierto.

### "Molinete no abre"

1. Verificar el puerto COM del relay.
2. Confirmar los bytes de los comandos (ver sección 9 — Espiar señales).
3. Probar desde el monitor web: http://localhost:3002 → botón "Abrir molinete".
4. Usar RealTerm para enviar los bytes manualmente y verificar que el relay responde.

### "npm install falla — missing any VC++ toolset"

Error completo:
```
gyp ERR! find VS - found "Visual Studio C++ core features"
gyp ERR! find VS - missing any VC++ toolset
```

Solución: abrir el Instalador de VS → Modificar → tildar "Desarrollo de escritorio con C++".

### "npm install falla — no encuentra Python"

```cmd
npm config get python
```

Si está vacío: instalar Python 3 desde https://www.python.org y tildar "Add to PATH".

### "Error de conexión con API"

1. Verificar que el servidor backend esté corriendo.
2. Verificar `apiUrl` en `config.json`.
3. Si están en máquinas distintas: verificar que el firewall de Windows no bloquee el puerto 3001.
4. El modo offline sigue funcionando con cache local mientras el servidor no esté disponible.

---

## 9. Espiar señales de una aplicación existente

Si hay una aplicación que ya controla el molinete y los lectores, estas herramientas permiten capturar exactamente qué bytes envía y recibe para replicar ese comportamiento en `config.json`.

### Espiar tráfico serial — RS232 / COM (relay y RFID)

#### Portmon — Sysinternals (recomendado, gratuito)

Descarga: https://learn.microsoft.com/en-us/sysinternals/downloads/portmon

Captura todas las operaciones de lectura/escritura sobre cualquier puerto COM, de cualquier proceso.

1. Ejecutar `Portmon.exe` como Administrador.
2. Menú `Computer` → `Connect Local`.
3. Verificar que `Capture` → `Capture Events` esté activo.
4. Iniciar la aplicación existente y operar el molinete.
5. El log muestra los bytes exactos:
   ```
   IRP_MJ_WRITE  COM4  Length 3: A0 01 01   ← comando abrir relay
   IRP_MJ_WRITE  COM4  Length 3: A0 01 00   ← comando cerrar relay
   IRP_MJ_READ   COM3  Length 5: 31 45 F2   ← lectura RFID
   ```
6. Los bytes de escritura al COM del relay van directamente en `comandoON` y `comandoOFF`.

#### com0com + hub4com — puerto virtual intermediario

Si Portmon no captura los datos de la aplicación específica:

1. Descargar e instalar [com0com](https://sourceforge.net/projects/com0com/).
2. Crear un par de puertos virtuales: `COM10 ↔ COM11`.
3. Apuntar la aplicación existente al `COM10` en lugar del COM real.
4. Usar [hub4com](https://sourceforge.net/projects/com0com/files/hub4com/) para reenviar `COM10 → COM4` (dispositivo real) y loguear todo.
5. La aplicación no nota el cambio y todo el tráfico queda registrado.

#### RealTerm — para probar comandos manualmente

Descarga: https://realterm.sourceforge.io/

Útil para identificar los bytes correctos del relay enviándolos a mano:

1. Abrir RealTerm → pestaña `Port` → seleccionar el COM del relay → velocidad 9600 → `Open`.
2. Pestaña `Send` → escribir `A0 01 01` → tipo `Hex` → clic en `Send Numbers`.
3. Si el molinete abre, esos son los bytes correctos para `comandoON`.
4. Repetir con `A0 01 00` para confirmar `comandoOFF`.

#### Process Monitor — identificar qué COM usa la aplicación

Si no sabés en qué puerto opera la aplicación existente:

Descarga: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon

1. Abrir Process Monitor como Administrador.
2. Filtro: `Path contains COM` + `Operation is WriteFile`.
3. Iniciar la aplicación y operar el molinete.
4. El log muestra el proceso, el puerto COM y el contenido exacto de cada escritura.

---

### Espiar tráfico USB (lector de código de barras / QR)

#### USBPcap + Wireshark (gratuito)

Captura el tráfico USB a nivel de driver.

Descarga USBPcap: https://desowin.org/usbpcap/

1. Instalar USBPcap — seleccionar el hub USB donde está el lector.
2. Abrir Wireshark → seleccionar interfaz `USBPcap1`.
3. Iniciar captura → escanear un código con el lector.
4. Filtrar: `usb.transfer_type == 0x01` (interrupciones HID).
5. En los paquetes `URB_INTERRUPT in` verás los keycodes crudos del lector.

> El lector en modo teclado HID envía keycodes, no texto ASCII directo. El byte `0x28` al final es Enter. Los keycodes se mapean a caracteres según el estándar USB HID keyboard.

#### AutoHotkey — capturar el string final del lector

Si el lector funciona como teclado y solo querés ver qué texto produce cada escaneo:

1. Instalar [AutoHotkey](https://www.autohotkey.com/).
2. Crear un archivo `lector_log.ahk` con este contenido:
   ```autohotkey
   #InstallKeybdHook
   ~*Enter::
     FileAppend, %A_PriorKey%`n, C:\lector_log.txt
   return
   ```
3. Ejecutar el script como Administrador.
4. Escanear varios códigos — el archivo `C:\lector_log.txt` registra cada lectura completa.

Esto muestra el string final que el lector produce por cada escaneo, incluyendo prefijos o sufijos especiales que pueda agregar.
