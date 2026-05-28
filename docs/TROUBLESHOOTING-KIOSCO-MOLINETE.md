# Troubleshooting — PC Kiosco Molinete (Linux Mint)

> Runbook de diagnóstico y recuperación de la PC dedicada al kiosco del molinete.
> PC de referencia: usuario `sportivo-kiosco`, hostname `sportivokiosco`. Linux Mint (Cinnamon).

---

## Arquitectura de la PC kiosco

| Componente | Qué es | Cómo arranca |
|---|---|---|
| **molinete.service** | Servidor web Node que sirve la UI del molinete en `http://localhost:3002` (**sin GUI**) | Servicio systemd |
| **Kiosco (chromium)** | Navegador en modo kiosk apuntando a `http://localhost:3002` | **Autostart de escritorio**: `~/.config/autostart/molinete-kiosco.desktop` (NO systemd) |
| **rojoplus-print-agent** | Agente Node de impresión (`/opt/rojoplus-print-agent/index.js`), detecta impresoras CUPS | Servicio systemd (root) |
| **RustDesk** | Escritorio remoto para soporte (`rustdesk --server`) | Servicio / autostart |

> ⚠️ El kiosco arranca por **autostart de escritorio**, no por `molinete.service`. Deshabilitar el servicio systemd **no** evita que chromium se abra.

---

## Caso resuelto (2026-05-27): la PC se colgaba al bootear

### Síntoma
Al iniciar, la PC se colgaba tan fuerte que **ni respondía al ingreso de contraseña en el login**. También se colgaba al abrir una terminal una vez en el escritorio, **incluso con `molinete.service` deshabilitado**.

### Causa real
**GPU lockup del driver `radeon`** (AMD integrada `0000:00:01.0`). NO era el servicio del molinete.

Log clave (`journalctl -b -1`):
```
radeon 0000:00:01.0: ring 6 stalled for more than 24694msec
radeon 0000:00:01.0: GPU lockup (current fence id ... on ring 6)
[drm:radeon_ib_ring_tests] *ERROR* radeon: failed testing IB on ring 5 (-110)
```

Como **todo el entorno gráfico depende de la GPU**, al trabarse se congelaba la pantalla entera (incluido el campo de contraseña del greeter). En modo texto (`multi-user.target`) la PC era estable porque no usa aceleración gráfica.

Descartados: sin OOM (`free` con swap en 0), disco sano (Toshiba DT01ACA050, link SATA 6 Gbps OK).

### Disparadores de la GPU
- **RustDesk** como `--server` usaba la **VCE (ring 6 = codificador de video por hardware)** para transmitir la pantalla → era el disparador principal (ring 6 = el que se trababa).
- **Chromium kiosk** (aceleración GPU / WebGL / video).

### Solución aplicada (defensa en profundidad)

**1. Auto-login sin contraseña** (para garantizar sesión gráfica, evitar cuelgue en el greeter)

Por archivo (LightDB/LightDM):
```bash
sudo mkdir -p /etc/lightdm/lightdm.conf.d
echo -e "[Seat:*]\nautologin-user=sportivo-kiosco\nautologin-user-timeout=0" \
  | sudo tee /etc/lightdm/lightdm.conf.d/50-autologin.conf
```
O por GUI: Menú → *Ventana de inicio de sesión* → pestaña *Usuarios* → *Inicio de sesión automático*.

> Efecto colateral: el llavero de GNOME pide desbloqueo al no tipear contraseña. Solución: borrar los llaveros (se recrean vacíos):
> ```bash
> rm -f ~/.local/share/keyrings/*
> ```

**2. Chromium sin aceleración GPU** (render por software)

Editar `~/.config/autostart/molinete-kiosco.desktop`, agregar `--disable-gpu --disable-gpu-compositing` al `Exec`:
```ini
[Desktop Entry]
Type=Application
Name=Molinete Clubix
Exec=/bin/bash -c "sleep 8 && chromium --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble --disable-translate --disable-gpu --disable-gpu-compositing http://localhost:3002"
X-GNOME-Autostart-enabled=true
```

**3. Blindar el driver radeon** (kernel param)

En `/etc/default/grub`, agregar `radeon.dpm=0` a `GRUB_CMDLINE_LINUX_DEFAULT`:
```
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash radeon.dpm=0"
```
Aplicar:
```bash
sudo update-grub
```

**4. RustDesk a codec por software** (no usar VCE)

Parar RustDesk antes de editar (sino pisa el cambio al cerrarse), agregar la opción y reiniciar:
```bash
sudo systemctl stop rustdesk 2>/dev/null; pkill -f rustdesk
echo "enable-hwcodec = 'N'" >> ~/.config/rustdesk/RustDesk2.toml
```
O por GUI: RustDesk → Configuración → desactivar *Habilitar codec por hardware*.

### Verificación
```bash
journalctl -k -b --no-pager | grep -i "GPU lockup"   # debe estar vacío
ps aux | grep -i chromium | grep -v grep              # kiosco corriendo
```
Confirmado estable tras reiniciar con `molinete.service` reactivado (`sudo systemctl enable --now molinete.service`).

---

## Procedimiento de recuperación (si se vuelve a colgar)

### Entrar sin entorno gráfico
1. **TTY**: `Ctrl+Alt+F2` (o F3..F6). Si también está colgado:
2. **GRUB → recovery mode**: encender, mantener `Shift` (o `Esc`) → *Advanced options* → entrada `(recovery mode)` → `root` (drop to root shell). Si el FS está en solo-lectura: `mount -o remount,rw /`.
3. **Arrancar en modo texto sin escritorio** (estable, no usa GPU): en GRUB apretar `e` sobre la entrada normal, agregar al final de la línea `linux` un espacio y `systemd.unit=multi-user.target`, luego `Ctrl+X`.

### Reinicio seguro de una máquina colgada (evita corromper el disco)
Magic SysRq "REISUB": mantener `Alt`+`SysRq` (PrintScreen) y tocar lento, de a una: **R · E · I · S · U · B**. Último recurso: botón de power 10 seg.

### Comandos de diagnóstico
```bash
# Últimas líneas antes del cuelgue (boot anterior)
journalctl -b -1 --no-pager | tail -n 80

# ¿OOM / falta de memoria?
journalctl -b -1 --no-pager | grep -iE "oom|out of memory|killed process|hung task"

# ¿Errores de hardware/GPU/disco (kernel)?
journalctl -b -1 -k --no-pager | grep -iE "gpu lockup|i/o error|ata[0-9]|nvme|fault|reset|usb disconnect"

# Estado actual
free -h
ps aux --sort=-%mem | head -n 12
ls -la ~/.config/autostart/
sudo smartctl -H /dev/sda        # salud disco (apt install smartmontools)
```

### Frenar el servicio del molinete (si se sospecha de él)
```bash
sudo systemctl stop molinete.service
sudo systemctl disable molinete.service   # no arranca en próximo boot
```

---

## Pendientes menores observados (no afectan estabilidad)
- **USB `4-2` se desconecta/reconecta en loop** (device 3→4→5 en los logs). Posible cable/puerto flojo del lector del molinete. Revisar si aparecen fallas de lectura.
- **Impresora `XPrinter_Kiosco`** deshabilitada en CUPS desde 2026-03 ("Unplugged or turned off"). Se decidió **dejarla** (una cola deshabilitada no consume CPU/RAM, solo genera ruido en el log del print-agent). Para borrarla: `sudo lpadmin -x XPrinter_Kiosco`.

---
*Documentado 2026-05-27. Ver también `INSTALACION-PRODUCCION-MOLINETE.md`.*
