# Instalación en Producción — Clubix

Guía única, autoritativa, de instalación y hardening del servidor Linux para Clubix (multi-tenant, SaaS).

> Cualquier procedimiento previo en este repo (incluido `INSTALACION-PRODUCCION-CLUBIX.md`) queda **deprecado** en favor de este documento.

---

## Datos del servidor

| Dato | Valor |
|------|-------|
| OS | Ubuntu 22.04 LTS / 24.04 LTS |
| PostgreSQL | 16 recomendado para instalaciones nuevas; soporta 14+ |
| Dominio principal (web pública) | `clubix.com.ar`, `www.clubix.com.ar` |
| Dominio tenants | `<slug>.clubix.com.ar` |
| Usuario SSH admin | `axiomacloud` |
| Usuario sistema (corre PM2) | `clubixapp` |
| Usuario PostgreSQL | `clubixuser` |
| Base de datos | `clubix_db` |
| Backend puerto interno | 5400 |
| Repo | `https://github.com/martin4yo/rojoplus` |
| Tenant demo | `clubix-sport.clubix.com.ar` |

> ⚠️ **Contraseñas y secrets.** La contraseña PostgreSQL y el JWT secret se generan/guardan en `server/.env` (modo `600`). NUNCA commitearlos al repo, NUNCA pegarlos en chats ni en tickets. Si alguno se filtra, rotar inmediatamente (`ALTER USER clubixuser WITH PASSWORD '…'` + nuevo JWT + restart backend).

---

## Stack

Frontend: React + Vite (servido como archivos estáticos por Nginx) · Backend: Node.js 20 + Express + Prisma + Socket.io · DB: PostgreSQL 15 · Proceso: PM2 · TLS: Let's Encrypt wildcard.

## Arquitectura

```
                ┌──────────────────────────────────────────────────┐
                │                Nginx (443/80)                    │
                │   clubix.com.ar + www + *.clubix.com.ar          │
                │   Wildcard SSL — cert *.clubix.com.ar + raíz     │
                └──────────────┬───────────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
         ┌───────▼────────┐         ┌────────▼────────┐
         │ Static files   │         │   Backend API   │
         │ /var/www/clubix│         │  Express :5400  │
         │ client/dist/   │         │  (PM2 fork)     │
         └────────────────┘         └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   PostgreSQL    │
                                    │   :5432 (local) │
                                    │   clubix_db     │
                                    └─────────────────┘

Flujo multi-tenant:
  clubix-sport.clubix.com.ar  → Nginx pasa Host al backend
                              → Frontend agrega X-Tenant-Slug
                              → Backend resuelve tenant y aísla queries
```

---

## 0. Hardening SSH (PRIMERO)

Realizar ANTES de cualquier otra cosa. Mientras root esté accesible por contraseña, el servidor está bajo ataque permanente de bots.

### 0.1 Crear usuario administrador con sudo

```bash
# Conectado como root la primera vez
adduser axiomacloud
usermod -aG sudo axiomacloud
groups axiomacloud   # debe incluir 'sudo'
```

### 0.2 Subir clave pública SSH

En tu máquina local:

```bash
# Generar clave si no tenés
ssh-keygen -t ed25519 -C "tu_email@example.com"

# Copiar al servidor
ssh-copy-id axiomacloud@IP-DEL-SERVIDOR
```

O manual, en el servidor como `axiomacloud`:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys    # pegar la clave pública
chmod 600 ~/.ssh/authorized_keys
```

### 0.3 Endurecer `sshd_config`

```bash
sudo nano /etc/ssh/sshd_config
```

Aplicar estos cambios (descomentar y ajustar):

```sshd
Port 2222                          # cambiar puerto reduce ruido de bots (opcional)
PermitRootLogin no                 # bloquear root vía SSH
PasswordAuthentication no          # SOLO claves SSH (después de validar acceso)
PubkeyAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
X11Forwarding no
AllowTcpForwarding local           # permite túneles -L (DB admin), bloquea -R
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 30
AllowUsers axiomacloud            # whitelist de usuarios que pueden entrar
Protocol 2
```

```bash
sudo sshd -t                       # validar sintaxis
sudo systemctl restart ssh
```

> ⚠️ **NO cerrar la sesión actual.** Abrir una segunda terminal y probar `ssh -p 2222 axiomacloud@IP`. Si no funciona, revertir antes de salir.

### 0.4 fail2ban (anti brute-force)

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
port    = 2222
mode    = aggressive

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
EOF

sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

### 0.5 Firewall UFW

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp           # SSH (o 22 si no lo cambiaste)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

> ⚠️ Si cambiás el puerto SSH a 2222, abrir `2222` ANTES de habilitar UFW o quedás afuera.

### 0.6 Auto-updates de seguridad

```bash
sudo apt install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Asegurar que tome solo updates de seguridad
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
EOF
```

---

## 1. Instalar dependencias del sistema

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL — versiones soportadas: 14, 15, 16, 17
#
# Versión recomendada para instalación NUEVA:     16
# Versión a mantener si ya hay datos vivos en 14: 14 (EOL noviembre 2026)
#
# Agregamos el repo oficial PGDG para tener acceso a todas las versiones
# (el repo nativo de Ubuntu 22.04 sólo trae 14; 24.04 trae 16).
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update

# Elegir UNA línea según corresponda:
sudo apt install -y postgresql-16 postgresql-contrib-16    # instalación nueva
# sudo apt install -y postgresql-14 postgresql-contrib-14  # si ya hay datos en 14

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# PM2 (global)
sudo npm install -g pm2

# Git + utilidades
sudo apt install -y git curl ca-certificates

# Verificar versiones
node --version    # v20.x
npm --version
psql --version    # 15.x
nginx -v
pm2 --version
```

---

## 2. Crear usuario del sistema (para la app)

Usuario sin login interactivo desde fuera; corre el backend bajo PM2.

```bash
sudo useradd -r -m -d /var/www/clubix -s /bin/bash clubixapp

sudo mkdir -p /var/log/clubix
sudo chown clubixapp:clubixapp /var/log/clubix
sudo chmod 750 /var/log/clubix
```

---

## 3. Endurecer PostgreSQL

> Versión recomendada: **PostgreSQL 16** (EOL nov 2028). Soporta PG 14+. Los paths de config dependen de la versión instalada — averiguar con `pg_lsclusters` (la columna `Ver` te da el número que va en `/etc/postgresql/<Ver>/main/`).

```bash
PG_VER=$(pg_lsclusters --no-header | awk '{print $1; exit}')
echo "Usando PostgreSQL ${PG_VER}"
```

### 3.1 Asegurar que sólo escuche en localhost

```bash
sudo nano /etc/postgresql/${PG_VER}/main/postgresql.conf
# Confirmar:
listen_addresses = 'localhost'
ssl = on
```

### 3.2 Forzar `scram-sha-256` (no `md5`)

```bash
sudo nano /etc/postgresql/${PG_VER}/main/pg_hba.conf
```

Reemplazar líneas locales por:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    clubix_db       clubixuser      127.0.0.1/32            scram-sha-256
host    clubix_db       clubixuser      ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               reject
host    all             all             ::/0                    reject
```

```bash
# Asegurar password_encryption
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'scram-sha-256';"
sudo systemctl restart postgresql
```

### 3.3 Crear DB y usuario

> Usar variables de shell para no dejar la contraseña en `history`:

```bash
# Cargar la contraseña (no queda en .bash_history)
read -s -p "Password Postgres clubixuser: " PG_PASS && echo

sudo -u postgres psql << SQL
CREATE DATABASE clubix_db;
CREATE USER clubixuser WITH ENCRYPTED PASSWORD '${PG_PASS}';
GRANT ALL PRIVILEGES ON DATABASE clubix_db TO clubixuser;
\c clubix_db
GRANT ALL ON SCHEMA public TO clubixuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO clubixuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO clubixuser;
SQL
```

> ⚠️ La contraseña real (`Q27G4B98` en esta instalación) NO va commiteada. Guardarla en el gestor de secrets del equipo.

---

## 4. Clonar el repositorio

```bash
sudo su - clubixapp

cd /var/www/clubix
git clone https://github.com/martin4yo/rojoplus.git .
# Permisos sanos por las dudas
chmod 750 /var/www/clubix
```

---

## 5. Variables de entorno

### 5.1 Backend (`server/.env`)

> Generamos el JWT secret con `openssl` para que sea fuerte. La contraseña Postgres se lee del prompt para no quedar en `history`.

```bash
# Como clubixapp
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
read -s -p "Password Postgres clubixuser: " PG_PASS && echo

cat > /var/www/clubix/server/.env << EOF
# ── Base de datos ──────────────────────────────────────────────
DATABASE_URL=postgresql://clubixuser:${PG_PASS}@localhost:5432/clubix_db?schema=public

# ── JWT ────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

# ── Email SMTP ─────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=remoteaxioma@gmail.com
SMTP_PASS=__APP_PASSWORD_GMAIL__
SMTP_FROM=noreply@clubix.com.ar

# ── General ────────────────────────────────────────────────────
NODE_ENV=production
PORT=5400
FRONTEND_URL=https://www.clubix.com.ar

# Tenant default (solo para dev/local; en prod se resuelve por subdomain)
DEFAULT_TENANT_SUBDOMAIN=clubix-sport

# Defaults de negocio
DEFAULT_DISCOUNT_PERCENT=10

# ── reCAPTCHA (login público) ──────────────────────────────────
RECAPTCHA_SECRET_KEY=__SECRET__

# ── MercadoPago ────────────────────────────────────────────────
MERCADOPAGO_ACCESS_TOKEN=__APP_USR_TOKEN__
MERCADOPAGO_PUBLIC_KEY=__APP_USR_PUBLIC__

# ── Web Push (VAPID) ───────────────────────────────────────────
VAPID_PUBLIC_KEY=__VAPID_PUB__
VAPID_PRIVATE_KEY=__VAPID_PRIV__
VAPID_MAILTO=mailto:admin@clubix.com.ar
EOF

chmod 600 /var/www/clubix/server/.env
unset PG_PASS JWT_SECRET    # limpiar de la sesión
```

> Reemplazar los `__…__` por las credenciales reales (Gmail App Password, reCAPTCHA secret, tokens MP, VAPID). NO commitear ningún `.env`.

### 5.2 Frontend (`client/.env`)

`VITE_API_URL=/api` (path relativo) permite que el frontend funcione idéntico bajo cualquier subdominio del tenant sin re-buildear.

```bash
cat > /var/www/clubix/client/.env << 'EOF'
VITE_API_URL=/api
EOF
chmod 600 /var/www/clubix/client/.env
```

> Si existen `.env.production` o `.env.production.local`, eliminarlos o sincronizarlos: Vite los prioriza sobre `.env` y son la causa #1 de "el frontend sigue apuntando a una URL vieja después del build".

---

## 6. Instalar deps y compilar

```bash
# Como clubixapp
cd /var/www/clubix

# Backend
cd server
npm ci
npx prisma generate
npx prisma db push       # crea/actualiza schema en clubix_db
cd ..

# Frontend
cd client
rm -rf dist node_modules/.vite     # garantizar build limpio
npm ci
npm run build
cd ..
```

Verificar que el build no quedó con URLs viejas:

```bash
grep -r "sportivo\|rojoplus" /var/www/clubix/client/dist || echo "OK: build limpio"
```

---

## 7. PM2 (sólo backend — el frontend lo sirve Nginx)

```bash
cat > /var/www/clubix/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'clubix-backend',
      cwd: '/var/www/clubix/server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5400
      },
      error_file: '/var/log/clubix/backend-error.log',
      out_file:   '/var/log/clubix/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF

pm2 start /var/www/clubix/ecosystem.config.js
pm2 save
pm2 status
pm2 logs clubix-backend --lines 30
```

### Auto-inicio tras reboot

```bash
# Salir de clubixapp
exit

# Como axiomacloud con sudo
sudo pm2 startup systemd -u clubixapp --hp /var/www/clubix
# Ejecutar el comando que PM2 imprime
```

---

## 8. Certificado SSL wildcard

> El certificado wildcard `*.clubix.com.ar` cubre todos los tenants (`<slug>.clubix.com.ar`) pero **NO** cubre la raíz `clubix.com.ar` — por eso pedimos ambos.

### Si el DNS está en DonWeb (sin plugin Certbot)

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.clubix.com.ar" \
  -d "clubix.com.ar" \
  --agree-tos \
  --email admin@clubix.com.ar
```

Certbot pedirá publicar 2 registros `TXT` en `_acme-challenge.clubix.com.ar`. En DonWeb (Mi cuenta → Dominios → Gestión DNS) agregar registro `TXT` con TTL mínimo. Verificar propagación antes de confirmar:

```bash
nslookup -type=TXT _acme-challenge.clubix.com.ar
# Cuando aparezca el valor esperado, presionar Enter en Certbot
```

Resultado: `/etc/letsencrypt/live/clubix.com.ar/{fullchain,privkey}.pem`.

### Si el DNS está en Cloudflare (recomendado a futuro)

```bash
sudo apt install -y python3-certbot-dns-cloudflare
# /root/.cloudflare.ini con el token, chmod 600
sudo certbot certonly \
  --dns-cloudflare --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d "*.clubix.com.ar" -d "clubix.com.ar"
```

Esto sí permite **renovación 100% automática**.

### Renovación (cada 90 días)

```bash
sudo certbot certificates                       # ver expiración
sudo certbot renew --manual --preferred-challenges dns   # DonWeb: manual
sudo systemctl reload nginx
```

---

## 9. Configurar Nginx

### 9.1 Configuración global de seguridad

```bash
sudo nano /etc/nginx/conf.d/00-security.conf
```

```nginx
# Ocultar versión de Nginx
server_tokens off;

# Buffers anti-DoS
client_body_buffer_size 16k;
client_header_buffer_size 1k;
client_max_body_size 20m;
large_client_header_buffers 4 8k;

# Timeouts agresivos
client_body_timeout    20s;
client_header_timeout  20s;
keepalive_timeout      30s 30s;
send_timeout           20s;

# Gzip seguro (no comprimir respuestas con cookies sensibles)
# NOTA: `gzip on;` ya viene activo por defecto en /etc/nginx/nginx.conf en Ubuntu.
# No volverlo a declarar acá o nginx -t falla con "duplicate directive".
# Si alguno de estos gzip_* también está descomentado en nginx.conf, eliminalo aquí.
gzip_disable "msie6";
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

# Rate limiting global
limit_req_zone  $binary_remote_addr zone=api_zone:10m   rate=30r/s;
limit_req_zone  $binary_remote_addr zone=login_zone:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=conn_zone:10m;

# SSL moderno
# NOTA: en Ubuntu, /etc/nginx/nginx.conf ya declara `ssl_protocols` y
# `ssl_prefer_server_ciphers`. NO redeclarar acá o nginx -t falla.
# Si algún ssl_* de los de abajo también aparece en nginx.conf, eliminalo aquí.
# Verificar con: grep -nE "^\s*ssl_" /etc/nginx/nginx.conf
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
```

### 9.2 Sitio Clubix

```bash
sudo nano /etc/nginx/sites-available/clubix
```

```nginx
# ─── Redirect HTTP → HTTPS (todos los dominios) ────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name clubix.com.ar www.clubix.com.ar *.clubix.com.ar;
    return 301 https://$host$request_uri;
}

# ─── HTTPS — wildcard + raíz ───────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name clubix.com.ar www.clubix.com.ar *.clubix.com.ar;

    # Certificado wildcard (cubre *.clubix.com.ar y clubix.com.ar)
    ssl_certificate     /etc/letsencrypt/live/clubix.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clubix.com.ar/privkey.pem;

    # ── Security headers ─────────────────────────────────────────────────────
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options              "SAMEORIGIN"          always;
    add_header X-Content-Type-Options       "nosniff"             always;
    add_header X-XSS-Protection             "1; mode=block"       always;
    add_header Referrer-Policy              "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy           "camera=(), microphone=(), geolocation=(self), payment=(self)" always;
    add_header Cross-Origin-Opener-Policy   "same-origin"         always;
    add_header Cross-Origin-Resource-Policy "same-site"           always;
    # CSP: ajustá los hosts que el front realmente consume (MP, reCAPTCHA, etc.)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://sdk.mercadopago.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; connect-src 'self' https://api.mercadopago.com wss: https:; frame-src 'self' blob: https://www.google.com https://www.mercadopago.com; worker-src 'self' blob:; object-src 'self' blob:; base-uri 'self'; form-action 'self';" always;

    # Logs
    access_log /var/log/nginx/clubix-access.log;
    error_log  /var/log/nginx/clubix-error.log;

    client_max_body_size 20M;

    # ── Bloquear archivos/paths sensibles ────────────────────────────────────
    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; }
    location ~* \.(?:bak|sql|env|log|conf|ini|swp)$ { deny all; }

    # ── API Backend ──────────────────────────────────────────────────────────
    location /api {
        limit_req  zone=api_zone burst=60 nodelay;
        limit_conn conn_zone 20;

        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;

        # WebSocket (Socket.io vía /api si aplica)
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

    # ── Endpoint de login: rate limit más estricto ──────────────────────────
    location = /api/admin/login {
        limit_req zone=login_zone burst=5 nodelay;
        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Socket.io ────────────────────────────────────────────────────────────
    location /socket.io {
        proxy_pass http://127.0.0.1:5400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 3600s;
    }

    # ── Archivos subidos por tenants ─────────────────────────────────────────
    location /uploads {
        alias /var/www/clubix/server/uploads;
        expires 30d;
        add_header Cache-Control "public";
        # Defensa: prevenir ejecución de archivos subidos
        location ~* \.(php|pl|py|sh|cgi|js|html?)$ { deny all; }
    }

    # ── Frontend SPA ─────────────────────────────────────────────────────────
    root /var/www/clubix/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }
}
```

### 9.3 Habilitar

```bash
sudo nginx -t

sudo ln -s /etc/nginx/sites-available/clubix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl reload nginx
```

> ⚠️ Si el VPS tiene IPv6 activa y otros sitios escuchan `[::]:443`, **TODOS** los `server` blocks de Clubix deben tener también `listen [::]:443 ssl http2;` — si no, las conexiones IPv6 que no matchean nombre caen en otro server block y sirven cert equivocado. Ver Troubleshooting.

---

## 10. Crear Super Administrador

```bash
sudo su - clubixapp
cd /var/www/clubix/server

# Leer password del prompt en vez de hardcodearla
read -s -p "Password admin@clubix.com.ar: " ADMIN_PASS && echo
export ADMIN_PASS

node --input-type=module << 'JS'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const hash = await bcrypt.hash(process.env.ADMIN_PASS, 12)

let rol = await prisma.rol.findFirst({ where: { esSuperAdmin: true } })
if (!rol) {
  rol = await prisma.rol.create({ data: {
    codigo: 'SUPER_ADMIN', nombre: 'Super Admin',
    descripcion: 'Administrador global del sistema',
    esSuperAdmin: true, activo: true
  }})
}

const admin = await prisma.admin.upsert({
  where: { email: 'admin@clubix.com.ar' },
  update: { password: hash },
  create: {
    email: 'admin@clubix.com.ar',
    nombre: 'Admin', apellido: 'Clubix',
    password: hash, activo: true, rolId: rol.id
  }
})
console.log('Super admin OK:', admin.email)
await prisma.$disconnect()
JS

unset ADMIN_PASS
```

> Usar **bcrypt cost ≥ 12** en producción.

---

## 11. Crear tenant demo (`clubix-sport`)

```bash
sudo su - clubixapp
cd /var/www/clubix/server

node --input-type=module << 'JS'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const t = await prisma.tenant.upsert({
  where: { subdomain: 'clubix-sport' },
  update: {},
  create: {
    nombre: 'Club Demo Clubix Sport',
    subdomain: 'clubix-sport',
    activo: true, estado: 'ACTIVE', plan: 'PROFESSIONAL'
  }
})
console.log('Tenant OK:', t.subdomain, 'id:', t.id)
await prisma.$disconnect()
JS
```

---

## 12. Verificación final

```bash
# Backend online
sudo -u clubixapp pm2 status                       # clubix-backend → online
sudo -u clubixapp pm2 logs clubix-backend --lines 30

# Nginx activo
sudo systemctl status nginx

# API responde
curl -s https://clubix-sport.clubix.com.ar/api/health

# Frontend sirve
curl -sI https://www.clubix.com.ar | head -5
curl -sI https://clubix-sport.clubix.com.ar | head -5

# Certificado wildcard correcto
echo | openssl s_client -connect clubix-sport.clubix.com.ar:443 \
  -servername clubix-sport.clubix.com.ar 2>/dev/null \
  | openssl x509 -noout -subject -dates
# subject=CN = *.clubix.com.ar

# Security headers presentes
curl -sI https://www.clubix.com.ar | grep -iE 'strict-transport|content-security|x-frame|x-content-type'

# Rating SSL externo (chequeo manual)
# https://www.ssllabs.com/ssltest/analyze.html?d=clubix.com.ar
```

---

## 13. Backups automáticos

### Base de datos (cron diario)

```bash
# Como axiomacloud con sudo
sudo mkdir -p /var/backups/clubix
sudo chown clubixapp:clubixapp /var/backups/clubix
sudo chmod 750 /var/backups/clubix

sudo tee /usr/local/bin/clubix-backup.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
DEST=/var/backups/clubix
STAMP=$(date +%Y%m%d_%H%M)
PGPASSWORD=$(grep -oP 'postgresql://clubixuser:\K[^@]+' /var/www/clubix/server/.env)
export PGPASSWORD

pg_dump -U clubixuser -h localhost clubix_db | gzip > "${DEST}/clubix_db_${STAMP}.sql.gz"
tar -czf "${DEST}/uploads_${STAMP}.tar.gz" -C /var/www/clubix/server uploads 2>/dev/null || true

# Retener 14 días
find "${DEST}" -name "*.gz" -mtime +14 -delete
EOF

sudo chmod 750 /usr/local/bin/clubix-backup.sh
sudo chown clubixapp:clubixapp /usr/local/bin/clubix-backup.sh

# Cron a las 03:30 todos los días
( sudo -u clubixapp crontab -l 2>/dev/null; \
  echo "30 3 * * * /usr/local/bin/clubix-backup.sh >> /var/log/clubix/backup.log 2>&1" ) \
  | sudo -u clubixapp crontab -
```

### Restore

```bash
gunzip -c /var/backups/clubix/clubix_db_YYYYMMDD_HHMM.sql.gz \
  | psql -U clubixuser -h localhost clubix_db
```

> Replicar los backups fuera del servidor (S3, rsync a otro VPS). Un backup local sólo te salva de errores humanos, no de pérdida del servidor.

---

## 14. Monitoreo post-instalación

### 14.1 Swap (evita crashes OOM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
free -h
```

### 14.2 Journal persistente

```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald
```

### 14.3 Cron de memoria

```bash
( crontab -l 2>/dev/null; echo "*/5 * * * * free -m >> /var/log/mem_monitor.log 2>&1" ) | crontab -
```

### 14.4 Netdata (opcional, sólo vía SSH tunnel)

```bash
sudo apt install -y netdata
sudo systemctl enable --now netdata
# NO abrir 19999 en UFW. Acceder con:
#   ssh -L 19999:localhost:19999 axiomacloud@IP
# y abrir http://localhost:19999 en tu navegador
```

### 14.5 Logrotate de la app

```bash
sudo tee /etc/logrotate.d/clubix > /dev/null << 'EOF'
/var/log/clubix/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 640 clubixapp clubixapp
    sharedscripts
    postrotate
        sudo -u clubixapp pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## 15. Actualizar la aplicación

```bash
sudo su - clubixapp
cd /var/www/clubix

git pull origin main

# Backend
cd server
npm ci
npx prisma generate
npx prisma db push      # aplica cambios de schema sin perder datos

# Frontend
cd ../client
rm -rf dist node_modules/.vite
npm ci
npm run build

# Reiniciar backend
pm2 restart clubix-backend
pm2 save
```

Nginx no necesita reinicio: sirve archivos estáticos desde `client/dist` directamente.

---

## 16. Comandos útiles

```bash
# PM2
sudo -u clubixapp pm2 status
sudo -u clubixapp pm2 logs clubix-backend
sudo -u clubixapp pm2 monit
sudo -u clubixapp pm2 show clubix-backend
sudo -u clubixapp pm2 restart clubix-backend

# DB
sudo -u postgres psql -d clubix_db -c "SELECT id, subdomain, nombre, activo FROM tenants;"
sudo -u postgres psql -d clubix_db -c "SELECT id, email, activo FROM admins;"

# Manual backup
sudo -u clubixapp /usr/local/bin/clubix-backup.sh
ls -lh /var/backups/clubix

# Cert
sudo certbot certificates

# Firewall
sudo ufw status verbose
sudo fail2ban-client status sshd
```

---

## 17. Troubleshooting

### 17.1 SSL sirve certificado de otro sitio

```bash
echo | openssl s_client -connect clubix-sport.clubix.com.ar:443 \
  -servername clubix-sport.clubix.com.ar 2>/dev/null \
  | openssl x509 -noout -subject
```

Buscar conflictos:

```bash
grep -r "default_server" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
# Debe haber un único default_server en :443. Si no, mover clubix a:
sudo cp /etc/nginx/sites-available/clubix /etc/nginx/conf.d/00-clubix.conf
sudo rm /etc/nginx/sites-enabled/clubix
# y agregar `default_server` al `listen 443` de 00-clubix.conf
sudo nginx -t && sudo systemctl reload nginx
```

### 17.2 Cert correcto por IPv4, mal por dominio (IPv6)

Síntoma: el navegador muestra cert de otro sitio. Causa: este sitio escucha sólo IPv4, otro sitio escucha IPv6 y absorbe las conexiones AAAA.

```bash
dig clubix.com.ar AAAA +short      # tiene AAAA?
ip -6 addr | grep -v fe80          # el server tiene IPv6?

# Test directo por IPv6
echo | openssl s_client -servername clubix.com.ar \
  -connect [IPV6_DEL_VPS]:443 2>/dev/null | openssl x509 -noout -subject
```

**Fix**: asegurar `listen [::]:443 ssl http2;` en TODOS los server blocks HTTPS de Clubix. La config de §9.2 ya lo incluye.

### 17.3 Frontend apunta a URL vieja

Causa: existe `client/.env.production[.local]` con URL antigua, y Vite lo prioriza sobre `.env`.

```bash
cd /var/www/clubix/client
ls -la | grep env
rm -f .env.production .env.production.local
rm -rf dist node_modules/.vite
npm run build
grep -r "URL_VIEJA" dist || echo "OK"
```

En el navegador (Service Worker cachea): F12 → Application → Clear site data → reabrir.

### 17.4 Tenant no encontrado (404)

```bash
# El tenant existe?
sudo -u postgres psql -d clubix_db -c \
  "SELECT subdomain, activo, estado FROM tenants WHERE subdomain = 'clubix-sport';"

# El header X-Tenant-Slug llega al backend?
sudo -u clubixapp pm2 logs clubix-backend --lines 100 | grep -i tenant
```

### 17.5 Backend no arranca

```bash
sudo -u clubixapp pm2 logs clubix-backend --err --lines 80
cat /var/www/clubix/server/.env     # variables OK?
psql -U clubixuser -h localhost -d clubix_db -c "SELECT 1;"   # DB OK?
```

### 17.6 Frontend en blanco

```bash
ls -la /var/www/clubix/client/dist
sudo tail -50 /var/log/nginx/clubix-error.log
sudo chown -R clubixapp:www-data /var/www/clubix/client/dist
sudo chmod -R 755 /var/www/clubix/client/dist
```

### 17.7 Investigar un reboot inesperado

```bash
last reboot | head -10
sudo journalctl -b -1 | tail -150
sudo journalctl -b -1 -k | grep -iE "oom|kill|memory|panic"
sudo dmesg | grep -iE "oom|killed|out of memory"
free -h
ps aux --sort=-%mem | grep node | head
```

Sin swap, un pico de memoria → OOM killer → reboot. Solución: §14.1 + Netdata para detectar tendencia.

### 17.8 SSH bloqueado por fail2ban

```bash
sudo fail2ban-client status sshd
sudo fail2ban-client set sshd unbanip TU_IP
```

---

## 18. Resumen de directorios

```
/var/www/clubix/
├── server/                 Backend Express (PM2)
│   ├── src/
│   ├── prisma/
│   └── .env                ← 600, owner clubixapp
├── client/
│   ├── src/
│   ├── dist/               ← Nginx sirve esto
│   └── .env
└── ecosystem.config.js

/var/log/clubix/            logs backend + backups
/var/backups/clubix/        dumps DB + uploads (rotación 14 días)
/etc/nginx/sites-available/clubix
/etc/nginx/conf.d/00-security.conf
/etc/letsencrypt/live/clubix.com.ar/
```

---

## 19. Checklist de deployment

### Hardening previo
- [ ] Usuario `axiomacloud` con sudo
- [ ] SSH sólo por clave (`PasswordAuthentication no`, `PermitRootLogin no`)
- [ ] `AllowUsers axiomacloud` en `sshd_config`
- [ ] Puerto SSH custom (opcional, p.ej. 2222)
- [ ] `fail2ban` activo (jail sshd)
- [ ] UFW: solo 80/443 + puerto SSH abiertos
- [ ] `unattended-upgrades` para security patches

### Sistema
- [ ] Node 20, PostgreSQL 15, Nginx, PM2, Certbot instalados
- [ ] Swap 2GB + `vm.swappiness=10`
- [ ] Journal persistente

### Base de datos
- [ ] PostgreSQL: `listen_addresses = 'localhost'`
- [ ] `pg_hba.conf` con `scram-sha-256`
- [ ] `clubix_db` creada
- [ ] Usuario `clubixuser` con permisos en `clubix_db`
- [ ] `prisma db push` OK

### Aplicación
- [ ] Repo clonado en `/var/www/clubix`
- [ ] `server/.env` con `JWT_SECRET` generado por `openssl rand -base64 64`, perms `600`
- [ ] `client/.env` con `VITE_API_URL=/api`, perms `600`
- [ ] Sin `.env.production[.local]` con URLs viejas
- [ ] `npm ci` en server y client
- [ ] `npm run build` en client (dist limpio)
- [ ] PM2 iniciado y `pm2 save`
- [ ] `pm2 startup` configurado

### Nginx y SSL
- [ ] Cert wildcard `*.clubix.com.ar` + raíz `clubix.com.ar`
- [ ] `00-security.conf` con headers y rate limiting
- [ ] Server block escucha en IPv4 **e** IPv6
- [ ] Sitio default deshabilitado
- [ ] `nginx -t` OK, recargado

### Datos iniciales
- [ ] Super admin `admin@clubix.com.ar` creado, bcrypt cost ≥ 12
- [ ] Contraseña super admin cambiada tras primer login
- [ ] Tenant demo `clubix-sport` creado

### Operación
- [ ] Cron de backup diario (`/usr/local/bin/clubix-backup.sh`)
- [ ] Backups replicados fuera del servidor
- [ ] Logrotate de logs PM2
- [ ] Monitor de memoria (`/var/log/mem_monitor.log`)
- [ ] Netdata accesible vía SSH tunnel (no público)

### Verificación funcional
- [ ] `https://www.clubix.com.ar` carga
- [ ] `https://clubix-sport.clubix.com.ar` carga
- [ ] `https://clubix-sport.clubix.com.ar/api/health` responde
- [ ] Login super admin funciona
- [ ] Security headers presentes (HSTS, CSP, X-Frame-Options, etc.)
- [ ] SSL Labs A o A+ en `https://www.ssllabs.com/ssltest/`
