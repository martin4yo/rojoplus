#!/bin/bash

# Script para corregir errores en producción
# Ejecutar en el servidor como usuario sportivouser

echo "🔧 Corrigiendo errores de producción en RojoPlus..."
echo ""

# 1. Corregir permisos de Vite
echo "📁 Corrigiendo permisos de node_modules (cliente)..."
cd /var/www/rojoplus/client

# Limpiar cache de Vite
rm -rf node_modules/.vite
rm -rf node_modules/.vite-temp
rm -rf dist

# Dar permisos correctos al usuario sportivouser
chown -R sportivouser:sportivouser /var/www/rojoplus/client/node_modules
chmod -R 755 /var/www/rojoplus/client/node_modules

echo "✅ Permisos corregidos"
echo ""

# 2. Rebuild del cliente
echo "🔨 Rebuilding cliente..."
npm run build

echo "✅ Cliente rebuildeado"
echo ""

# 3. Reiniciar servicios PM2
echo "🔄 Reiniciando servicios PM2..."
pm2 restart rojoplus-client
pm2 restart rojoplus-server

echo "✅ Servicios reiniciados"
echo ""

# 4. Verificar logs
echo "📋 Verificando logs..."
pm2 logs rojoplus-client --lines 10 --nostream
pm2 logs rojoplus-server --lines 10 --nostream

echo ""
echo "✅ Script completado"
echo ""
echo "💡 Si persisten errores de permisos:"
echo "   chown -R sportivouser:sportivouser /var/www/rojoplus"
echo ""
echo "💡 Para verificar el estado:"
echo "   pm2 status"
echo "   pm2 logs rojoplus-client"
echo "   pm2 logs rojoplus-server"
