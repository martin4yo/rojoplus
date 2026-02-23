#!/bin/bash
# Wrapper para Chromium que ignora errores de xdg-settings

# Redirigir stderr de xdg-settings a /dev/null
exec 2> >(grep -v "xdg-settings" >&2)

# Ejecutar Chromium con todos los argumentos
exec /usr/bin/chromium-browser "$@"
