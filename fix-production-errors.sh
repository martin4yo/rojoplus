#!/bin/bash

# Script para corregir errores en producción
# Ejecutar en el servidor como ROOT (sudo bash fix-production-errors.sh)

echo "🔧 Corrigiendo errores de producción en RojoPlus..."
echo ""

# 1. Detener servicios PM2
echo "⏸️  Deteniendo servicios PM2..."
su - sportivouser -c "pm2 stop rojoplus-client rojoplus-server"
echo "✅ Servicios detenidos"
echo ""

# 2. Corregir permisos de TODO el proyecto
echo "📁 Corrigiendo permisos del proyecto completo..."
chown -R sportivouser:sportivouser /var/www/rojoplus
echo "✅ Owner corregido a sportivouser"
echo ""

# 3. Limpiar cache de Vite
echo "🗑️  Limpiando cache de Vite..."
cd /var/www/rojoplus/client
rm -rf node_modules/.vite
rm -rf node_modules/.vite-temp
rm -rf dist
echo "✅ Cache limpiado"
echo ""

# 4. Rebuild del cliente (como sportivouser)
echo "🔨 Rebuilding cliente..."
cd /var/www/rojoplus/client
su - sportivouser -c "cd /var/www/rojoplus/client && npm run build"
echo "✅ Cliente rebuildeado"
echo ""

# 5. Actualizar código del servidor (git pull)
echo "📥 Actualizando código desde Git..."
cd /var/www/rojoplus
su - sportivouser -c "cd /var/www/rojoplus && git pull"
echo "✅ Código actualizado"
echo ""

# 6. Reiniciar servicios PM2
echo "🔄 Reiniciando servicios PM2..."
su - sportivouser -c "pm2 restart rojoplus-client rojoplus-server"
echo "✅ Servicios reiniciados"
echo ""

# 7. Verificar logs
echo "📋 Verificando logs (últimas 20 líneas)..."
echo ""
echo "=== LOGS CLIENTE ==="
su - sportivouser -c "pm2 logs rojoplus-client --lines 20 --nostream"
echo ""
echo "=== LOGS SERVER ==="
su - sportivouser -c "pm2 logs rojoplus-server --lines 20 --nostream"

echo ""
echo "✅ Script completado exitosamente"
echo ""
echo "💡 Para monitorear en tiempo real:"
echo "   su - sportivouser"
echo "   pm2 logs"
echo ""
echo "💡 Para verificar el estado:"
echo "   su - sportivouser"
echo "   pm2 status"
