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

# 6. Detener procesos PM2 antiguos (si existen)
echo "🛑 Deteniendo procesos PM2 antiguos..."
su - sportivouser -c "pm2 delete rojoplus-backend 2>/dev/null || true"
su - sportivouser -c "pm2 delete rojoplus-frontend 2>/dev/null || true"
su - sportivouser -c "pm2 delete rojoplus-client 2>/dev/null || true"
su - sportivouser -c "pm2 delete rojoplus-server 2>/dev/null || true"
echo "✅ Procesos antiguos eliminados"
echo ""

# 7. Iniciar PM2 con ecosystem.config.js (carga .env automáticamente)
echo "🚀 Iniciando servicios PM2 con configuración actualizada..."
su - sportivouser -c "cd /var/www/rojoplus && pm2 start ecosystem.config.js"
su - sportivouser -c "pm2 save"
echo "✅ Servicios iniciados con variables de entorno cargadas"
echo ""

# 8. Verificar logs
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
