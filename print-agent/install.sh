#!/bin/bash
#
# RojoPlus Print Agent - Script de Instalación
#
# Uso: sudo ./install.sh
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "=============================================="
echo "  RojoPlus Print Agent - Instalación"
echo "=============================================="
echo -e "${NC}"

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Este script debe ejecutarse como root (sudo)${NC}"
  exit 1
fi

# Verificar Node.js
echo -e "${YELLOW}Verificando Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js no está instalado.${NC}"
  echo "Instalando Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js instalado: ${NODE_VERSION}${NC}"

# Crear directorio de instalación
INSTALL_DIR="/opt/rojoplus-print-agent"
echo -e "${YELLOW}Creando directorio ${INSTALL_DIR}...${NC}"
mkdir -p "$INSTALL_DIR"

# Copiar archivos
echo -e "${YELLOW}Copiando archivos...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/index.js" "$INSTALL_DIR/"

# Instalar dependencias
echo -e "${YELLOW}Instalando dependencias...${NC}"
cd "$INSTALL_DIR"
npm install --production

# Configurar permisos USB
echo -e "${YELLOW}Configurando permisos USB...${NC}"
cat > /etc/udev/rules.d/99-usb-printer.rules << 'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="*", MODE="0666"
KERNEL=="lp[0-9]*", MODE="0666"
EOF
udevadm control --reload-rules
udevadm trigger

# Solicitar configuración
echo ""
echo -e "${YELLOW}Configuración del agente:${NC}"
echo ""

read -p "URL del servidor RojoPlus [https://app.ejemplo.com]: " SERVER_URL
SERVER_URL=${SERVER_URL:-"https://app.ejemplo.com"}

read -p "Token de autenticación [rojoplus-print-agent]: " PRINT_TOKEN
PRINT_TOKEN=${PRINT_TOKEN:-"rojoplus-print-agent"}

read -p "ID del puesto [$(hostname)]: " PUESTO_ID
PUESTO_ID=${PUESTO_ID:-$(hostname)}

read -p "Nombre del puesto [$(hostname)]: " PUESTO_NOMBRE
PUESTO_NOMBRE=${PUESTO_NOMBRE:-$(hostname)}

# Crear archivo de servicio systemd
echo -e "${YELLOW}Creando servicio systemd...${NC}"
cat > /etc/systemd/system/rojoplus-print-agent.service << EOF
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

Environment=NODE_ENV=production
Environment=ROJOPLUS_SERVER_URL=${SERVER_URL}
Environment=ROJOPLUS_PRINT_TOKEN=${PRINT_TOKEN}
Environment=ROJOPLUS_PUESTO_ID=${PUESTO_ID}
Environment=ROJOPLUS_PUESTO_NOMBRE=${PUESTO_NOMBRE}

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd y habilitar servicio
echo -e "${YELLOW}Habilitando servicio...${NC}"
systemctl daemon-reload
systemctl enable rojoplus-print-agent
systemctl start rojoplus-print-agent

# Verificar estado
echo ""
echo -e "${GREEN}=============================================="
echo "  Instalación completada!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "El servicio está corriendo. Verificar con:"
echo "  sudo systemctl status rojoplus-print-agent"
echo ""
echo "Ver logs en tiempo real:"
echo "  sudo journalctl -u rojoplus-print-agent -f"
echo ""
echo "Configuración guardada en:"
echo "  /etc/systemd/system/rojoplus-print-agent.service"
echo ""

# Mostrar estado
systemctl status rojoplus-print-agent --no-pager || true
