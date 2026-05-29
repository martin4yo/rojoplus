# Procedimiento: Dominio propio (custom domain) por tenant

Cómo hacer que el dominio propio de un cliente (ej. `sportivopilar.com.ar`) sirva
directamente la app del tenant, sin cambiar la URL (white-label), en lugar de
obligarlo a usar `<slug>.clubix.com.ar`.

> Ejemplo trabajado: `sportivopilar.com.ar` → tenant **Club Sportivo Pilar**
> (id 1, subdomain `sportivopilar`). Reemplazar el dominio en los comandos para
> otros tenants.

---

## 1. Cómo funciona (ya está implementado en el código)

No hace falta tocar código. La app ya resuelve el tenant por dominio propio:

- **Backend** — `server/src/middleware/extractTenant.js`: resuelve el tenant en
  este orden:
  1. Header `X-Tenant-Slug` (lo manda el frontend si hay subdominio).
  2. Subdominio del `Host` (`<slug>.clubix.com.ar`).
  3. **Si no encontró, busca por `dominioCustom` usando el `Host` completo**
     (ej. `Host: sportivopilar.com.ar` → `tenant.dominioCustom = 'sportivopilar.com.ar'`).
- **Modelo `tenant`**: campos `subdomain` y `dominioCustom`.
- **Super-admin** — `client/src/pages/super-admin/TenantForm.jsx`: input para
  cargar `dominioCustom`.
- **Frontend** — `services/api.js` / `contexts/TenantContext.jsx`: el branding cae
  a `resolved_tenant_slug` cuando se entra por dominio propio.
- **CORS** — `server/src/index.js`: el backend permite como origin cualquier
  `dominioCustom` cargado en BD (apex y `www`). La lista se cachea y se refresca
  cada 5 min, así que tras cargar el `dominioCustom` el origin queda habilitado
  sin tocar código ni `CORS_ORIGINS` (puede tardar hasta 5 min, o reiniciar el
  backend para tomarlo al instante).

Por lo tanto, dar de alta un dominio propio es **solo infraestructura**: DNS +
campo en BD + bloque Nginx + certificado TLS.

---

## 2. Prerrequisitos

### 2.1 DNS (lo hace el dueño del dominio)

Apuntar el dominio al server de producción de clubix:

```
A     <dominio>           -> 179.43.123.248
A     www.<dominio>       -> 179.43.123.248
```

> Server de prod clubix: IPv4 `179.43.123.248`, IPv6 `2800:6c0:5::2759`,
> SSH `axiomacloud@179.43.123.248 -p 2222`.

**⚠️ Cuidado con el split A/AAAA.** Si el dominio tiene un registro **AAAA (IPv6)**
apuntando a otra IP (o el `A` apunta a un server viejo), los visitantes IPv4 e
IPv6 caen en máquinas distintas y el sitio queda roto para una parte de los
usuarios. Verificar que **ambos** (A y AAAA) apunten a este server, o **borrar el
AAAA** y dejar solo el `A`.

Verificar propagación (contra resolvers públicos, no la caché local):

```bash
dig +short A    <dominio> @1.1.1.1
dig +short A    <dominio> @8.8.8.8
dig +short AAAA <dominio> @1.1.1.1
```

> La propagación puede tardar por el TTL. El authoritative actualizado alcanza
> para que `certbot` valide (Let's Encrypt consulta los authoritative, no la caché
> de Google/Cloudflare).

### 2.2 Campo en BD

Cargar `dominioCustom = "<dominio>"` en el tenant desde el panel **super-admin**
(o por SQL). Sin esto, el backend no puede mapear el `Host` al tenant.

---

## 3. Alta del dominio en el server (Nginx + TLS)

Se hace en **2 fases** para evitar el huevo-y-la-gallina: un bloque `443` no pasa
`nginx -t` si el certificado todavía no existe. Primero se levanta HTTP (puerto 80)
para el desafío ACME, se emite el cert, y recién después se agrega el bloque HTTPS.

> Todos los comandos asumen `sudo` sin password (usuario `axiomacloud`).

### Fase 1 — Bloque HTTP + emisión del certificado

```bash
# Webroot para el desafío ACME (una sola vez; sirve para todos los dominios)
sudo mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/letsencrypt

# Bloque HTTP temporal (ACME + redirect a HTTPS)
sudo tee /etc/nginx/sites-available/<dominio> > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name <dominio> www.<dominio>;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }

    location / {
        return 301 https://<dominio>$request_uri;
    }
}
EOF

sudo ln -sfn /etc/nginx/sites-available/<dominio> /etc/nginx/sites-enabled/<dominio>
sudo nginx -t && sudo systemctl reload nginx

# Emitir certificado (HTTP-01 vía webroot)
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  -d <dominio> -d www.<dominio> \
  --non-interactive --agree-tos -m martin4yo@gmail.com
```

### Fase 2 — Bloque HTTPS completo (app + redirect www→apex)

Reemplazar el archivo por la versión final. Es un clon del bloque
`*.clubix.com.ar` (mismas cabeceras/CSP, proxy a `127.0.0.1:5400`), más el
redirect `www` → apex.

> ⚠️ El `www` debe redirigir al apex: `extractTenant` busca `dominioCustom` con el
> `Host` exacto, y en BD está cargado **sin** `www`. Si `www` sirviera la app
> directamente, no matchearía el tenant (400 TENANT_REQUIRED).

```bash
sudo tee /etc/nginx/sites-available/<dominio> > /dev/null <<'EOF'
# --- HTTP: ACME challenge + redirect a HTTPS ---
server {
    listen 80;
    listen [::]:80;
    server_name <dominio> www.<dominio>;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; default_type "text/plain"; }
    location / { return 301 https://<dominio>$request_uri; }
}

# --- HTTPS www -> apex ---
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.<dominio>;
    ssl_certificate     /etc/letsencrypt/live/<dominio>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<dominio>/privkey.pem;
    return 301 https://<dominio>$request_uri;
}

# --- HTTPS apex -> app SPA multi-tenant (mismo backend que *.clubix.com.ar) ---
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <dominio>;

    ssl_certificate     /etc/letsencrypt/live/<dominio>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<dominio>/privkey.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options              "SAMEORIGIN"          always;
    add_header X-Content-Type-Options       "nosniff"             always;
    add_header X-XSS-Protection             "1; mode=block"       always;
    add_header Referrer-Policy              "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy           "camera=(), microphone=(), geolocation=(self), payment=(self)" always;
    add_header Cross-Origin-Opener-Policy   "same-origin"         always;
    add_header Cross-Origin-Resource-Policy "same-site"           always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://sdk.mercadopago.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; connect-src 'self' https://api.mercadopago.com wss: https:; frame-src 'self' blob: https://www.google.com https://www.mercadopago.com; worker-src 'self' blob:; object-src 'self' blob:; base-uri 'self'; form-action 'self';" always;

    access_log /var/log/nginx/<dominio>-access.log;
    error_log  /var/log/nginx/<dominio>-error.log;

    client_max_body_size 20M;

    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; }
    location ~* \.(?:bak|sql|env|log|conf|ini|swp)$ { deny all; }
    include snippets/block-scanners.conf;

    location /api {
        limit_req  zone=api_zone burst=60 nodelay;
        limit_conn conn_zone 20;
        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout    120s;
        proxy_connect_timeout  60s;
        proxy_send_timeout    120s;
    }

    location = /api/admin/login {
        limit_req zone=login_zone burst=5 nodelay;
        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 3600s;
    }

    location ^~ /uploads {
        alias /var/www/clubix/server/uploads;
        expires 30d;
        add_header Cache-Control "public";
        location ~* \.(php|pl|py|sh|cgi|js|html?)$ { deny all; }
    }

    root /var/www/clubix/client/dist;
    index index.html;

    location / { try_files $uri $uri/ /index.html; }
    location ~* \.(js|css|woff|woff2|ttf|eot)$ { expires 1y;  add_header Cache-Control "public, immutable"; try_files $uri =404; }
    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ { expires 30d; add_header Cache-Control "public"; try_files $uri =404; }
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

> Las zonas de rate limit (`api_zone`, `conn_zone`, `login_zone`) están definidas
> en el contexto `http` de `nginx.conf` y son globales — no hay que redefinirlas.

---

## 4. Renovación automática del certificado

El certificado renueva solo (timer de certbot). Para que Nginx tome el cert nuevo
sin intervención, hay un **deploy-hook global** que recarga Nginx tras cada
renovación (se crea una sola vez, sirve para todos los dominios):

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Probar la renovación sin emitir de verdad:
sudo certbot renew --cert-name <dominio> --dry-run
```

---

## 5. Verificación

```bash
# 1) HTTPS del apex sirve la SPA (forzando este server para evitar caché DNS)
curl -s -o /dev/null -w 'http=%{http_code} ssl=%{ssl_verify_result}\n' \
  --resolve <dominio>:443:179.43.123.248 https://<dominio>/

# 2) www -> apex
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  --resolve www.<dominio>:443:179.43.123.248 https://www.<dominio>/

# 3) http -> https
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  --resolve <dominio>:80:179.43.123.248 http://<dominio>/

# 4) El backend resuelve el tenant correcto por dominioCustom
curl -s --resolve <dominio>:443:179.43.123.248 https://<dominio>/api/tenant/current | head -c 300
#   Debe devolver el tenant esperado (mismo "id"/"nombre" que por el subdominio).
```

Probar también por IPv6 si el dominio tiene AAAA:

```bash
curl -s -o /dev/null -w 'http=%{http_code} ip=%{remote_ip}\n' \
  --resolve <dominio>:443:[2800:6c0:5::2759] https://<dominio>/
```

---

## 6. Troubleshooting (problemas reales encontrados)

| Síntoma | Causa | Solución |
|---|---|---|
| El challenge ACME devuelve `301` en vez del archivo | El `Host` resolvía a otro server por **caché DNS vieja** del propio VPS | Esperar a que limpie la caché, o validar con `--resolve` forzando la IP correcta |
| `ssl_verify_result=1` / cert no coincide al entrar por el dominio | El dominio resuelve a **otra IP** (split A/AAAA o `A` apuntando a server viejo) | Corregir DNS: A y AAAA al mismo server, o borrar el AAAA |
| `400 TENANT_REQUIRED` al entrar por `www.<dominio>` | `dominioCustom` en BD está sin `www`; `extractTenant` no matchea | Redirigir `www` → apex (ya contemplado en el bloque) |
| `400 TENANT_REQUIRED` en el apex | Falta cargar `dominioCustom` en el tenant | Cargarlo en super-admin / BD |
| `CORS: origin no permitido: https://<dominio>` | Falta `dominioCustom` en BD, o el backend no refrescó la cache aún | Cargar `dominioCustom` y esperar ≤5 min, o `pm2 restart clubix-backend` |
| `certbot` falla la validación | DNS aún no propaga al authoritative | Verificar con `dig @1.1.1.1`; reintentar cuando propague |

---

## 7. Escalabilidad (varios custom domains)

Con Nginx puro, **cada dominio propio necesita su bloque + su cert** (no se puede
cubrir dominios raíz distintos con un wildcard). Opciones según volumen:

- **Pocos dominios** → automatizar este procedimiento en un script
  `add-custom-domain.sh <dominio>` (genera el bloque desde template + `certbot` +
  `nginx -t && reload`). Sigue habiendo un archivo por dominio, pero el alta es un
  comando.
- **Self-service / muchos dominios** → certs **on-demand**, con uno de:
  - **OpenResty + `lua-resty-auto-ssl`**: un solo bloque, emite el cert la primera
    vez que entra un dominio nuevo, validando contra un callback que consulta la BD
    (`¿existe este dominioCustom?`).
  - **Caddy** como reverse proxy adelante: HTTPS automático con `on_demand` + un
    endpoint `ask` que pregunta a la API si el dominio es un tenant válido.

---

## Referencia rápida

- Server prod clubix: `axiomacloud@179.43.123.248 -p 2222` (IPv6 `2800:6c0:5::2759`)
- Backend (PM2): `clubix-backend` en `127.0.0.1:5400`
- App: `/var/www/clubix` (SPA en `client/dist`, backend en `server`)
- Nginx sites: `/etc/nginx/sites-available/` (symlinks en `sites-enabled/`)
- Certs: `/etc/letsencrypt/live/<dominio>/`
- Webroot ACME: `/var/www/letsencrypt`
- Resolución de tenant: `server/src/middleware/extractTenant.js`
