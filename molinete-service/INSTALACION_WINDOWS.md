# Instalación en Windows — Servicio de Molinete RojoPlus

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalar el servicio](#2-instalar-el-servicio)
3. [Detectar el lector USB](#3-detectar-el-lector-usb)
4. [Detectar el lector RFID](#4-detectar-el-lector-rfid)
5. [Configurar config.json](#5-configurar-configjson)
6. [Ejecutar el servicio](#6-ejecutar-el-servicio)
7. [Arranque automático con Windows](#7-arranque-automático-con-windows)
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

Dispositivo #2
  Fabricante:   Logitech
  Producto:     USB Mouse
  Vendor ID:    0x046D  (1133)
  Product ID:   0xC077  (49271)
  Usage:        2  ← mouse HID
  UsagePage:    1

Dispositivo #3
  Fabricante:   Honeywell
  Producto:     Barcode Scanner
  Vendor ID:    0x0C2E  (3118)
  Product ID:   0x0200  (512)
  Usage:        6  ← teclado HID (lector de barras)
  UsagePage:    1

Dispositivo #4
  Fabricante:   Datalogic
  Producto:     QR Scanner
  Vendor ID:    0x05F9  (1529)
  Product ID:   0x2204  (8708)
  Usage:        6  ← teclado HID (lector QR)
  UsagePage:    1
```

### Cómo identificar cuál es cuál cuando hay varios lectores

Los lectores de código de barras y QR aparecen igual que un teclado (`usage: 6`, `usagePage: 1`). Para distinguirlos:

**Método 1 — Por fabricante/producto:** Si el `Fabricante` y `Producto` son legibles, es suficiente.

**Método 2 — Desconectar y reconectar:** Ejecutar `npm run detectar-usb` con todos desconectados, luego conectar uno por vez y volver a ejecutar — el nuevo dispositivo que aparece es el que se acaba de conectar.

**Método 3 — Administrador de Dispositivos:** Abrir `devmgmt.msc`, expandir "Dispositivos de interfaz humana" (HID). Al conectar cada lector, aparece el nuevo dispositivo resaltado.

### Si hay dos lectores del mismo modelo (mismo VID/PID)

Cuando dos lectores son idénticos (mismo fabricante y modelo), tienen el mismo `vendorId` y `productId`. En ese caso, el campo `Path` del script identifica a cada uno de forma única:

```
  Path:  \\?\HID#VID_0C2E&PID_0200#7&1234abcd&0&0000#{...}
```

El segmento `7&1234abcd` es el identificador de la instancia — diferente para cada dispositivo aunque tengan el mismo VID/PID. Ese path puede usarse directamente en el código para abrir el dispositivo correcto.

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

## 7. Arranque automático con Windows

El objetivo es que la PC del molinete sea autónoma: al encenderla, el servicio levanta solo y, cuando el operador inicia sesión, el panel de control se abre automáticamente en pantalla completa. Son dos cosas independientes que se combinan:

- **A)** Registrar el backend (`node index.js`) como **servicio de Windows** — corre desde que arranca la PC, sin necesidad de loguearse y sin terminal abierta.
- **B)** Configurar un **acceso directo en la carpeta de Inicio** del usuario que abra el navegador apuntando a `http://localhost:3002`.

### 7.1. Registrar el backend como servicio con NSSM (recomendado)

[NSSM](https://nssm.cc) (Non-Sucking Service Manager) es la forma más simple y robusta de correr una app Node.js como servicio de Windows. No requiere agregar código al proyecto y reinicia automáticamente el proceso si crashea.

1. Descargar NSSM desde https://nssm.cc/download (versión 2.24).
2. Descomprimir y copiar `nssm.exe` (carpeta `win64`) a `C:\Windows\System32` o cualquier ubicación del `PATH`.
3. Abrir **CMD como Administrador** y ejecutar:
   ```cmd
   nssm install MolineteRojoPlus
   ```
4. En la GUI que aparece, completar la pestaña **Application:**
   - **Path:** ruta completa a `node.exe` (verificar con `where node`, normalmente `C:\Program Files\nodejs\node.exe`).
   - **Startup directory:** ruta absoluta a la carpeta `molinete-service` (ej: `C:\clubix\molinete-service`).
   - **Arguments:** `index.js`.
5. Pestaña **Details:**
   - **Display name:** `Molinete RojoPlus`.
   - **Description:** `Servicio de control de molinete y lectores`.
   - **Startup type:** `Automatic`.
6. Pestaña **I/O** (recomendado para diagnosticar):
   - **Output (stdout):** ruta a `logs/stdout.log` (ej: `C:\clubix\molinete-service\logs\stdout.log`).
   - **Error (stderr):** ruta a `logs/stderr.log`.
7. Pestaña **Exit actions:** dejar valores por defecto — NSSM reinicia el proceso si termina inesperadamente.
8. Clic en **Install service**.

Iniciar el servicio:
```cmd
nssm start MolineteRojoPlus
```

Verificación:
- Abrir `services.msc` y confirmar que **Molinete RojoPlus** está en estado **En ejecución**.
- Probar `http://localhost:3002` en el navegador.

Comandos útiles:
```cmd
nssm stop MolineteRojoPlus       :: detener
nssm restart MolineteRojoPlus    :: reiniciar (luego de tocar config.json)
nssm edit MolineteRojoPlus       :: editar la configuración del servicio
nssm remove MolineteRojoPlus     :: desinstalar (confirmar con "y")
```

> **Nota sobre permisos a dispositivos USB/COM:** NSSM corre el servicio por defecto como `LocalSystem`, que tiene acceso a puertos COM y dispositivos HID en la mayoría de los casos. Si el servicio no logra abrir el lector USB o el puerto del molinete cuando corre como servicio (pero sí desde la terminal), abrir `services.msc` → propiedades de Molinete RojoPlus → pestaña **Iniciar sesión** → marcar **Esta cuenta** y poner el usuario que sí tiene acceso (por ejemplo, el usuario que se loguea normalmente en la PC del molinete).

### 7.2. Alternativa — node-windows (sin instalar NSSM)

Si se prefiere una solución JS-only, [node-windows](https://github.com/coreybutler/node-windows) registra el servicio desde un script Node.

1. Instalar globalmente (como Administrador):
   ```cmd
   cd molinete-service
   npm install -g node-windows
   npm link node-windows
   ```

2. Crear `install-service.js` en la raíz del proyecto:
   ```javascript
   import { Service } from 'node-windows'
   import path from 'path'
   import { fileURLToPath } from 'url'

   const __dirname = path.dirname(fileURLToPath(import.meta.url))

   const svc = new Service({
     name: 'Molinete RojoPlus',
     description: 'Servicio de control de molinete y lectores',
     script: path.join(__dirname, 'index.js'),
     workingDirectory: __dirname
   })

   svc.on('install', () => {
     console.log('✓ Servicio instalado')
     svc.start()
   })

   svc.install()
   ```

3. Crear `uninstall-service.js` en la raíz del proyecto:
   ```javascript
   import { Service } from 'node-windows'
   import path from 'path'
   import { fileURLToPath } from 'url'

   const __dirname = path.dirname(fileURLToPath(import.meta.url))

   const svc = new Service({
     name: 'Molinete RojoPlus',
     script: path.join(__dirname, 'index.js')
   })

   svc.on('uninstall', () => console.log('✓ Servicio desinstalado'))
   svc.uninstall()
   ```

4. Ejecutar como Administrador:
   ```cmd
   node install-service.js
   ```

Para quitarlo:
```cmd
node uninstall-service.js
```

### 7.3. Mostrar el panel de control automáticamente al iniciar sesión

El servicio corre en segundo plano y no tiene interfaz propia — el "panel de control" es la página web servida en `http://localhost:3002`. Para que se abra sola cuando el operador inicia sesión en Windows hay tres opciones según el escenario.

#### Opción A — Modo kiosco (pantalla completa, recomendado para PC dedicada)

1. Crear un acceso directo en el escritorio:
   - Clic derecho → **Nuevo → Acceso directo**.
   - Ubicación del elemento (ajustar la ruta del navegador instalado):
     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=http://localhost:3002
     ```
     Si solo hay Edge:
     ```
     "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk http://localhost:3002
     ```
   - Nombre: `Panel Molinete`.

2. Moverlo a la carpeta de Inicio del usuario:
   - Tecla `Win + R` → escribir `shell:startup` → Enter.
   - Pegar el acceso directo en la carpeta que se abre.

3. Reiniciar la PC e iniciar sesión — el panel debe aparecer en pantalla completa.

> Para salir del modo kiosco: `Alt + F4` o `Ctrl + Shift + W`.

#### Opción B — Ventana normal del navegador

Si la PC se usa también para otras tareas y no se quiere kiosco:

1. Mismo procedimiento que en la Opción A, pero sin `--kiosk`:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3002
   ```
   `--app=` abre la URL en una ventana sin barra de direcciones, aislada del resto del navegador.

2. Pegar el acceso directo en `shell:startup`.

#### Opción C — Tarea programada con retraso (si el navegador abre antes que el servicio)

Si al loguearse aparece "No se puede acceder al sitio" porque el servicio todavía está terminando de levantar, conviene retrasar la apertura del navegador con el Programador de Tareas:

1. Abrir **Programador de Tareas** (`taskschd.msc`).
2. **Crear tarea básica** → nombre `Panel Molinete`.
3. **Desencadenador:** *Al iniciar sesión*.
4. **Acción:** *Iniciar un programa*.
   - Programa o script: `chrome.exe` (o ruta completa al ejecutable).
   - Agregar argumentos: `--kiosk --app=http://localhost:3002`.
5. Finalizar y abrir las propiedades de la tarea recién creada → pestaña **Desencadenadores** → editar el desencadenador → tildar **Retrasar tarea durante** y poner `30 segundos`.

### 7.4. Verificación end-to-end

1. Reiniciar la PC.
2. **Sin loguearse**, desde otra máquina en la red, abrir `http://IP_DE_LA_PC_DEL_MOLINETE:3002` — si responde, el servicio arrancó por sí solo.
3. Iniciar sesión en la PC del molinete: el navegador debe abrir directamente el panel de control.
4. Confirmar en `services.msc` que **Molinete RojoPlus** sigue en estado **En ejecución**.
5. Probar desconectar y volver a conectar un lector — revisar `logs/molinete.log` para verificar que el servicio reconecta solo.
6. Cortar y restablecer la red para confirmar que el modo offline (cache SQLite) sigue resolviendo accesos sin conexión al servidor.

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
