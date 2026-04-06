#!/bin/bash

# Script para actualizar URL del frontend en producción
# Ejecutar en el servidor como sportivouser

echo "🔧 Actualizando configuración de producción..."
echo ""

# Ir al directorio del cliente
cd /var/www/rojoplus/client

# Backup del .env actual
if [ -f .env ]; then
  cp .env .env.backup
  echo "✓ Backup de .env creado"
fi

# Crear nuevo .env con la URL correcta
cat > .env << 'EOF'
VITE_API_URL=https://sportivo.axiomacloud.com/api
VITE_RECAPTCHA_SITE_KEY=6Ld-k08sAAAAAAJ28g-CUaty6gGZCq-wyP_iPEsx
EOF

echo "✓ .env actualizado con URL correcta"
echo ""

# Recompilar frontend
echo "📦 Recompilando frontend..."
npm run build

if [ $? -eq 0 ]; then
  echo "✓ Frontend compilado exitosamente"
else
  echo "❌ Error al compilar frontend"
  exit 1
fi

echo ""

# Reiniciar servicios PM2
echo "🔄 Reiniciando servicios..."
cd ..
pm2 restart all

echo ""
echo "✅ Actualización completada!"
echo ""
echo "Verifica que ahora apunte a: https://sportivo.axiomacloud.com"
