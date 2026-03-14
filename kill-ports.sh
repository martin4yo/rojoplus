#!/bin/bash

# Script para liberar puertos usados por RojoPlus
# Puertos: 3000 (backend), 5173 (frontend Vite)

echo "🔍 Liberando puertos de RojoPlus..."

# Liberar puerto 3000 (Backend)
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "❌ Matando proceso en puerto 3000 (Backend)"
  lsof -ti:3000 | xargs kill -9 2>/dev/null
  echo "✅ Puerto 3000 liberado"
else
  echo "✓ Puerto 3000 ya está libre"
fi

# Liberar puerto 5173 (Frontend Vite)
if lsof -ti:5173 > /dev/null 2>&1; then
  echo "❌ Matando proceso en puerto 5173 (Frontend)"
  lsof -ti:5173 | xargs kill -9 2>/dev/null
  echo "✅ Puerto 5173 liberado"
else
  echo "✓ Puerto 5173 ya está libre"
fi

echo ""
echo "✅ Todos los puertos verificados y liberados"
