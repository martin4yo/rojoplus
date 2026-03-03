# RojoPlus Print Agent

Agente de impresión para conectar impresoras locales (USB, CUPS, IP de red) con el servidor RojoPlus en la nube.

## Arquitectura

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   App en Nube   │ ◄─────────────────► │  Puesto Linux    │
│   (RojoPlus)    │                     │  (Print Agent)   │
└─────────────────┘                     └────────┬─────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
                    ▼                            ▼                            ▼
           ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
           │ Impresora IP │            │ Impresora USB│            │ Impresora    │
           │ 192.168.1.x  │            │ /dev/usb/lp0 │            │ CUPS         │
           └──────────────┘            └──────────────┘            └──────────────┘
```

## Tipos de Impresoras Soportadas

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **IP** | Impresora con IP propia en la red local | `192.168.1.100:9100` |
| **USB** | Impresora conectada por USB al puesto | `/dev/usb/lp0` |
| **CUPS** | Impresora configurada en CUPS (Linux) | `EPSON_TM_T20` |

## Requisitos

- **Sistema Operativo:** Linux (Ubuntu, Debian, Raspberry Pi OS, etc.)
- **Node.js:** v18 o superior
- **Para USB:** Permisos de escritura en `/dev/usb/lp*`
- **Para CUPS:** Paquete `cups` instalado y configurado

## Instalación Paso a Paso

### 1. Instalar Node.js (si no está instalado)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
```

### 2. Crear directorio e instalar el agente

```bash
# Crear directorio
sudo mkdir -p /opt/rojoplus-print-agent
cd /opt/rojoplus-print-agent

# Copiar archivos (desde el proyecto o descargar)
# Opción A: Copiar desde el proyecto
sudo cp /ruta/al/proyecto/print-agent/* .

# Opción B: Crear los archivos manualmente
# (Copiar contenido de package.json e index.js)

# Instalar dependencias
sudo npm install
```

### 3. Configurar permisos USB (si usarás impresoras USB)

```bash
# Crear regla udev para acceso a impresoras USB
sudo tee /etc/udev/rules.d/99-usb-printer.rules << 'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="*", MODE="0666"
KERNEL=="lp[0-9]*", MODE="0666"
EOF

# Recargar reglas
sudo udevadm control --reload-rules
sudo udevadm trigger

# Verificar que el dispositivo es accesible
ls -la /dev/usb/lp*
```

### 4. Configurar CUPS (si usarás impresoras CUPS)

```bash
# Instalar CUPS
sudo apt-get install cups

# Agregar tu usuario al grupo lpadmin
sudo usermod -a -G lpadmin $USER

# Habilitar administración web (opcional)
sudo cupsctl --remote-admin

# Agregar impresora via web: http://localhost:631
# O via comando:
sudo lpadmin -p NOMBRE_IMPRESORA -E -v usb://FABRICANTE/MODELO

# Verificar impresoras instaladas
lpstat -p
```

### 5. Configurar variables de entorno

Editar el archivo de servicio systemd:

```bash
sudo nano /etc/systemd/system/rojoplus-print-agent.service
```

Contenido:

```ini
[Unit]
Description=RojoPlus Print Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rojoplus-print-agent
ExecStart=/usr/bin/node /opt/rojoplus-print-agent/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rojoplus-print-agent

# ⚠️ CONFIGURAR ESTAS VARIABLES:
Environment=NODE_ENV=production
Environment=ROJOPLUS_SERVER_URL=https://tu-servidor-rojoplus.com
Environment=ROJOPLUS_PRINT_TOKEN=rojoplus-print-agent
Environment=ROJOPLUS_PUESTO_ID=cocina-01
Environment=ROJOPLUS_PUESTO_NOMBRE=Puesto Cocina

[Install]
WantedBy=multi-user.target
```

### 6. Habilitar e iniciar el servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable rojoplus-print-agent

# Iniciar el servicio
sudo systemctl start rojoplus-print-agent

# Verificar estado
sudo systemctl status rojoplus-print-agent

# Ver logs en tiempo real
sudo journalctl -u rojoplus-print-agent -f
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `ROJOPLUS_SERVER_URL` | URL del servidor RojoPlus | `http://localhost:3000` |
| `ROJOPLUS_PRINT_TOKEN` | Token de autenticación | `rojoplus-print-agent` |
| `ROJOPLUS_PUESTO_ID` | ID único del puesto | `puesto-{hostname}` |
| `ROJOPLUS_PUESTO_NOMBRE` | Nombre descriptivo | `{hostname}` |

## Verificar Funcionamiento

### 1. Verificar conexión al servidor

```bash
sudo journalctl -u rojoplus-print-agent -f
```

Deberías ver:
```
[Socket] Conectando a https://tu-servidor.com...
[Socket] Conectado!
[Socket] Registrado exitosamente
[Detectar] USB: 1, CUPS: 2
```

### 2. Verificar en la interfaz web

1. Ir a **Buffet → Impresoras** en el panel de administración
2. Hacer clic en "Nueva Impresora"
3. Seleccionar tipo **USB** o **CUPS**
4. El puesto debería aparecer en el selector con sus impresoras detectadas

### 3. Probar impresión

1. Configurar una impresora en el sistema
2. Crear una comanda de prueba
3. Verificar que se imprime correctamente

## Solución de Problemas

### El puesto no aparece en la interfaz

1. Verificar que el servicio está corriendo:
   ```bash
   sudo systemctl status rojoplus-print-agent
   ```

2. Verificar la URL del servidor:
   ```bash
   # Probar conectividad
   curl -v https://tu-servidor.com/api/health
   ```

3. Verificar el token:
   - El token debe coincidir con `PRINT_AGENT_TOKEN` en el servidor
   - Por defecto es `rojoplus-print-agent`

### No detecta impresoras USB

1. Verificar permisos:
   ```bash
   ls -la /dev/usb/lp*
   ```

2. Verificar que la impresora está conectada:
   ```bash
   lsusb | grep -i printer
   ```

3. Ejecutar el agente como root o agregar permisos udev

### No detecta impresoras CUPS

1. Verificar que CUPS está corriendo:
   ```bash
   systemctl status cups
   ```

2. Listar impresoras:
   ```bash
   lpstat -p -d
   ```

3. Agregar impresora si no está:
   ```bash
   # Via web
   firefox http://localhost:631
   ```

### Error de impresión

1. Verificar los logs:
   ```bash
   sudo journalctl -u rojoplus-print-agent --since "5 minutes ago"
   ```

2. Probar impresión manual:
   ```bash
   # USB
   echo "Test" > /dev/usb/lp0

   # CUPS
   echo "Test" | lp -d NOMBRE_IMPRESORA

   # IP
   echo "Test" | nc 192.168.1.100 9100
   ```

## Desinstalar

```bash
# Detener y deshabilitar servicio
sudo systemctl stop rojoplus-print-agent
sudo systemctl disable rojoplus-print-agent

# Eliminar archivos
sudo rm /etc/systemd/system/rojoplus-print-agent.service
sudo rm -rf /opt/rojoplus-print-agent

# Recargar systemd
sudo systemctl daemon-reload
```

## Desarrollo

Para ejecutar en modo desarrollo:

```bash
cd print-agent

# Instalar dependencias
npm install

# Configurar variables (crear archivo .env o exportar)
export ROJOPLUS_SERVER_URL=http://localhost:3000
export ROJOPLUS_PUESTO_ID=dev-test
export ROJOPLUS_PUESTO_NOMBRE="Puesto Desarrollo"

# Ejecutar con watch
npm run dev
```

## Soporte

Si tenés problemas, verificá:
1. Los logs del servicio: `journalctl -u rojoplus-print-agent -f`
2. La conectividad al servidor
3. Los permisos de las impresoras

Para reportar bugs, contactar al equipo de desarrollo.
