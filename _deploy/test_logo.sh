#!/bin/bash
for t in tenant-1 tenant-3 tenant-4 tenant-6; do
  url="/uploads/tenants/${t}-logo.png"
  code=$(curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 "https://pilar.clubix.com.ar${url}" -o /dev/null -w "%{http_code}")
  ctype=$(curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 "https://pilar.clubix.com.ar${url}" -o /dev/null -w "%{content_type}")
  echo "${url} -> http=${code} type=${ctype}"
done
echo "=== Confirmar que la SPA sigue OK ==="
curl -sk --resolve pilar.clubix.com.ar:443:127.0.0.1 https://pilar.clubix.com.ar/ -o /dev/null -w "SPA root http=%{http_code}\n"
