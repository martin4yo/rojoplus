#!/bin/bash
echo "=== apex clubix.com.ar ==="
curl -sk --resolve clubix.com.ar:443:127.0.0.1 https://clubix.com.ar/ -o /tmp/apex.html -w "http=%{http_code}\n"
echo -n "marca sitio web (styles.css refs): "; grep -c "styles.css" /tmp/apex.html

echo "=== www.clubix.com.ar ==="
curl -sk --resolve www.clubix.com.ar:443:127.0.0.1 https://www.clubix.com.ar/ -o /dev/null -w "http=%{http_code}\n"

echo "=== subdominio pilar.clubix.com.ar ==="
curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 https://pilar.clubix.com.ar/ -o /tmp/sub.html -w "http=%{http_code}\n"
echo -n "marca SPA (refs a assets): "; grep -c "assets" /tmp/sub.html

echo -n "api health via pilar: "
curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 https://pilar.clubix.com.ar/api/health -o /dev/null -w "%{http_code}\n"
