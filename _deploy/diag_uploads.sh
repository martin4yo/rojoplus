#!/bin/bash
echo "=== Permisos cadena server/uploads ==="
namei -l /var/www/clubix/server/uploads 2>&1 | sed 's/^/  /'

echo "=== Contenido uploads (top) ==="
ls -la /var/www/clubix/server/uploads/ 2>&1 | head -25

echo "=== Buscar carpeta branding/logos ==="
find /var/www/clubix/server/uploads -maxdepth 2 -type d 2>/dev/null | head -20

echo "=== logo_url / favicon_url en BD (clubixuser) ==="
export PGPASSWORD='Q27G4B98'
psql -h localhost -p 5432 -U clubixuser -d clubix_db -tA -c \
  "SELECT id||' | '||COALESCE(slug,subdomain,'?')||' | logo='||COALESCE(logo_url,'NULL')||' | favicon='||COALESCE(favicon_url,'NULL') FROM tenants ORDER BY id;" 2>&1 | sed 's/^/  /'

echo "=== Test HTTP de un logo via nginx (primer logo_url no nulo) ==="
LOGO=$(psql -h localhost -p 5432 -U clubixuser -d clubix_db -tA -c \
  "SELECT logo_url FROM tenants WHERE logo_url IS NOT NULL AND logo_url LIKE '/uploads/%' ORDER BY id LIMIT 1;" 2>/dev/null)
echo "  logo_url de prueba: ${LOGO:-<ninguno con /uploads/>}"
if [ -n "$LOGO" ]; then
  echo -n "  archivo existe en disco: "; [ -f "/var/www/clubix/server$LOGO" ] && echo "SI" || echo "NO ($LOGO)"
  curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 "https://pilar.clubix.com.ar$LOGO" -o /dev/null -w "  http via nginx=%{http_code} type=%{content_type}\n"
fi
