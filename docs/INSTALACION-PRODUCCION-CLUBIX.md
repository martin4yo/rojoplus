# Instalación en Producción — Clubix

## Datos del servidor

| Dato | Valor |
|------|-------|
| IP | 66.97.45.210 |
| OS | Ubuntu 22.04 LTS |
| Dominio principal | www.clubix.com.ar |
| Dominio tenants | `<slug>`.clubix.com.ar |
| Usuario sistema | clubixapp |
| Usuario PostgreSQL | clubixuser |
| Base de datos | clubix_db |
| Backend puerto | 5300 |
| Repo | https://github.com/martin4yo/rojoplus |
| Tenant demo | clubix-sport.clubix.com.ar |

---

## Arquitectura

```
                    ┌──────────────────────────────────────────────────┐
                    │           Nginx (443/80)                          │
                    │   www.clubix.com.ar + *.clubix.com.ar            │
                    │   Wildcard SSL — certificado *.clubix.com.ar     │
                    └──────────────┬───────────────────────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
             ┌───────▼────────┐         ┌────────▼────────┐
             │ Static files   │         │   Backend API   │
             │ /var/www/clubix│         │  Express :5300  │
             │ client/dist/   │         │  (PM2)          │
             └────────────────┘         └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │   PostgreSQL    │
                                        │   :5432         │
                                        │   clubix_db     │
                                        └─────────────────┘

Flujo de tenant:
  clubix-sport.clubix.com.ar  → Nginx extrae "clubix-sport" del Host
                               → Frontend envía X-Tenant-Slug: clubix-sport
                               → Backend resuelve tenant y filtra DB
```

---

## 0. Conectarse al servidor

```bash
ssh root@66.97.45.210
```

---

## 1. Configurar usuario administrador y seguridad SSH

```bash
# Crear usuario administrador
adduser clubixadmin
usermod -aG sudo clubixadmin

# Copiar tu clave SSH pública al nuevo usuario
# (desde tu máquina local)
ssh-copy-id clubixadmin@66.97.45.210

# Deshabilitar login root por SSH
nano /etc/ssh/sshd_config
# Cambiar: PermitRootLogin yes  →  PermitRootLogin no
sudo systemctl restart sshd

# Verificar en OTRA terminal antes de cerrar la actual:
ssh clubixadmin@66.97.45.210
sudo whoami  # debe retornar: root
```

---

## 2. Instalar dependencias del sistema

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2 (global)
sudo npm install -g pm2

# Certbot (para SSL)
sudo apt install -y certbot python3-certbot-nginx

# Git
sudo apt install -y git

# Verificar versiones
node --version   # v20.x.x
npm --version
psql --version   # 15.x
nginx -v
pm2 --version
```

---

## 3. Crear usuario del sistema

```bash
# Usuario sin login interactivo, home en /var/www/clubix
sudo useradd -r -m -d /var/www/clubix -s /bin/bash clubixapp

# Directorio de logs
sudo mkdir -p /var/log/clubix
sudo chown clubixapp:clubixapp /var/log/clubix
```

---

## 4. Configurar PostgreSQL

```bash
sudo -u postgres psql << 'SQL'
CREATE DATABASE clubix_db;
CREATE USER clubixuser WITH ENCRYPTED PASSWORD 'Q27G4B98';
GRANT ALL PRIVILEGES ON DATABASE clubix_db TO clubixuser;
\c clubix_db
GRANT ALL ON SCHEMA public TO clubixuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO clubixuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO clubixuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO clubixuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO clubixuser;
\q
SQL
```

---

## 5. Clonar repositorio

```bash
sudo su - clubixapp

cd /var/www/clubix
git clone https://github.com/martin4yo/rojoplus.git app
cd app
```

---

## 6. Variables de entorno

### Backend

```bash
# Generar JWT_SECRET seguro
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "JWT_SECRET generado: $JWT_SECRET"
# Guardar este valor antes de continuar

cat > /var/www/clubix/app/server/.env << EOF
# Base de datos
DATABASE_URL=postgresql://clubixuser:Q27G4B98@localhost:5432/clubix_db?schema=public

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=remoteaxioma@gmail.com
SMTP_PASS=axvpahcmzqkhcjjr
SMTP_FROM=noreply@clubix.com.ar

# General
NODE_ENV=production
PORT=5300
FRONTEND_URL=https://www.clubix.com.ar

# Tenant default (cuando no hay subdomain, solo en dev)
DEFAULT_TENANT_SUBDOMAIN=clubix-sport

# Descuento default
DEFAULT_DISCOUNT_PERCENT=10

# reCaptcha
RECAPTCHA_SECRET_KEY=6Ld-k08sAAAAAGDVCwN8s80-YC_yLZ_2yQ0IFX6q

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-5351165382963961-012308-2cbcfad4234117d1e6fbc1cbafea0293-3154302506
MERCADOPAGO_PUBLIC_KEY=APP_USR-929183a0-8453-435c-8967-a9a366306e91

# Web Push (VAPID)
VAPID_PUBLIC_KEY=BGUYnO_0hzBI6x07Vm5qnyuFuQququrcA-BzO3NnPK2joP9hU5-nR9ok57FzBwV0V4wHeZXeRCsMuzRnc6ByzOc
VAPID_PRIVATE_KEY=xiN8gl8k8tixQKXKdW4i9x6YgwEtZq4gFsAjhWaj-5U
VAPID_MAILTO=mailto:admin@clubix.com.ar
EOF

chmod 600 /var/www/clubix/app/server/.env
```

### Frontend

```bash
# VITE_API_URL vacío = usa /api relativo al mismo dominio
# Funciona para TODOS los subdominios automáticamente
cat > /var/www/clubix/app/client/.env << 'EOF'
VITE_API_URL=/api
EOF

chmod 600 /var/www/clubix/app/client/.env
```

---

## 7. Instalar dependencias y compilar

```bash
# Como clubixapp
cd /var/www/clubix/app

# Backend
cd server
npm ci
npx prisma generate
npx prisma db push
cd ..

# Frontend
cd client
npm ci
npm run build
# El build queda en client/dist/
cd ..
```

---

## 8. Configurar PM2 (solo backend)

El frontend lo sirve Nginx directamente desde `client/dist/` — no necesita proceso PM2.

```bash
cat > /var/www/clubix/app/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'clubix-backend',
      cwd: '/var/www/clubix/app/server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5300
      },
      error_file: '/var/log/clubix/backend-error.log',
      out_file:   '/var/log/clubix/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF

# Iniciar
pm2 start /var/www/clubix/app/ecosystem.config.js
pm2 save

# Verificar
pm2 status
pm2 logs clubix-backend --lines 20
```

### Auto-inicio al reiniciar el servidor

```bash
# Salir de clubixapp
exit

# Como clubixadmin con sudo:
sudo pm2 startup systemd -u clubixapp --hp /var/www/clubix
# Ejecutar el comando que PM2 imprime en pantalla
```

---

## 9. Obtener certificado SSL wildcard (DonWeb — DNS manual)

DonWeb no tiene plugin de Certbot. Se usa el desafío DNS manual.

> ⚠️ El certificado wildcard `*.clubix.com.ar` cubre todos los subdominios de un nivel
> (tenant1.clubix.com.ar, clubix-sport.clubix.com.ar, etc.) pero NO cubre
> `clubix.com.ar` raíz ni `www.clubix.com.ar` — por eso pedimos ambos.

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.clubix.com.ar" \
  -d "clubix.com.ar" \
  --agree-tos \
  --email admin@clubix.com.ar
```

Certbot va a mostrar algo así:

```
Please deploy a DNS TXT record under the name:
_acme-challenge.clubix.com.ar
with the following value:
XxXxXxXxXxXxXxXxXxXxXxXxXxXxXx

(Este paso debe repetirse DOS veces — una para *.clubix.com.ar y otra para clubix.com.ar)
```

**En el panel de DonWeb:**

1. Ir a **Mi cuenta → Dominios → clubix.com.ar → Gestión DNS**
2. Agregar registro **TXT**:
   - Nombre/Host: `_acme-challenge`
   - Valor: el string que mostró Certbot
   - TTL: 300 (o el mínimo disponible)
3. Esperar ~2 minutos que propague
4. Verificar desde otra terminal antes de confirmar:
   ```bash
   nslookup -type=TXT _acme-challenge.clubix.com.ar
   # Debe mostrar el valor que pusiste
   ```
5. Volver a la terminal de Certbot y presionar **Enter** para continuar
6. Repetir el proceso si pide un segundo TXT (para el segundo dominio)

**Resultado esperado:**
```
Certificate is saved at: /etc/letsencrypt/live/clubix.com.ar/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/clubix.com.ar/privkey.pem
```

### Renovación (cada 90 días)

La renovación de wildcard requiere DNS manual nuevamente. Agregar recordatorio en crontab:

```bash
# Ver fecha de expiración
sudo certbot certificates

# Renovar (cuando falten ~30 días — requiere intervención manual en DonWeb)
sudo certbot renew --manual --preferred-challenges dns
```

> **Alternativa**: Si el servidor tiene acceso a la API de DonWeb (o en el futuro migran a Cloudflare), se puede automatizar con `acme.sh` y el plugin correspondiente.

---

## 10. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/clubix
```

```nginx
# ─── Redirect HTTP → HTTPS (todos los dominios) ───────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name clubix.com.ar www.clubix.com.ar *.clubix.com.ar;
    return 301 https://$host$request_uri;
}

# ─── HTTPS — wildcard *.clubix.com.ar + raíz ──────────────────────────────────
server {
    listen 443 ssl http2;
    # IPv6 solo si el servidor lo soporta; comentar si no:
    # listen [::]:443 ssl http2;

    server_name clubix.com.ar www.clubix.com.ar *.clubix.com.ar;

    # Certificado wildcard (cubre *.clubix.com.ar y clubix.com.ar)
    ssl_certificate     /etc/letsencrypt/live/clubix.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clubix.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Headers de seguridad
    add_header X-Frame-Options        "SAMEORIGIN"    always;
    add_header X-Content-Type-Options "nosniff"       always;
    add_header X-XSS-Protection       "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Logs
    access_log /var/log/nginx/clubix-access.log;
    error_log  /var/log/nginx/clubix-error.log;

    # Tamaño máximo de upload (logos, imágenes)
    client_max_body_size 20M;

    # ── API Backend ──────────────────────────────────────────────────────────
    location /api {
        proxy_pass http://127.0.0.1:5300;
        proxy_http_version 1.1;

        # WebSocket (Socket.io)
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

    # ── Socket.io (WebSocket nativo) ─────────────────────────────────────────
    location /socket.io {
        proxy_pass http://127.0.0.1:5300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 3600s;
    }

    # ── Archivos subidos por tenants ──────────────────────────────────────────
    location /uploads {
        alias /var/www/clubix/app/server/uploads;
        expires 30d;
        add_header Cache-Control "public";
    }

    # ── Frontend (React SPA — archivos estáticos) ────────────────────────────
    root /var/www/clubix/app/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache agresivo para assets con hash en el nombre
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

```bash
# Verificar que no haya errores de sintaxis
sudo nginx -t

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/clubix /etc/nginx/sites-enabled/

# Deshabilitar el site default de Nginx (evita conflictos)
sudo rm -f /etc/nginx/sites-enabled/default

# Recargar
sudo systemctl reload nginx
```

> ⚠️ **Nota sobre múltiples apps en el mismo servidor:**
> Si hay otros sitios en el servidor, asegurarse de que solo `clubix` tenga `default_server`.
> Ver sección Troubleshooting para resolver conflictos de certificados.

---

## 11. Crear Super Administrador

```bash
sudo su - clubixapp
cd /var/www/clubix/app/server

node << 'JS'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('clubix@2026', 10)

  // Buscar o crear rol super-admin
  let rol = await prisma.rol.findFirst({ where: { esSuperAdmin: true } })
  if (!rol) {
    rol = await prisma.rol.create({
      data: {
        nombre: 'Super Admin',
        descripcion: 'Administrador global del sistema',
        esSuperAdmin: true,
        activo: true
      }
    })
  }

  // Crear admin
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@clubix.com.ar' },
    update: { password: hash },
    create: {
      email: 'admin@clubix.com.ar',
      nombre: 'Admin',
      apellido: 'Clubix',
      password: hash,
      activo: true,
      rolId: rol.id
    }
  })
  console.log('Super admin creado:', admin.email)
  await prisma.$disconnect()
}

main().catch(console.error)
JS
```

**Credenciales:**
- Email: `admin@clubix.com.ar`
- Contraseña: `clubix@2026`

> ⚠️ Cambiar la contraseña después del primer login.

---

## 12. Crear tenant demo (clubix-sport)

```bash
sudo su - clubixapp
cd /var/www/clubix/app/server

node << 'JS'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'clubix-sport' },
    update: {},
    create: {
      nombre: 'Club Demo Clubix Sport',
      subdomain: 'clubix-sport',
      activo: true,
      estado: 'ACTIVE',
      plan: 'PROFESSIONAL'
    }
  })
  console.log('Tenant creado:', tenant.subdomain, '(id:', tenant.id + ')')
  await prisma.$disconnect()
}

main().catch(console.error)
JS
```

---

## 13. Verificación final

```bash
# Backend corriendo
sudo -u clubixapp pm2 status
# Debe mostrar: clubix-backend  online

# Logs backend (sin errores)
sudo -u clubixapp pm2 logs clubix-backend --lines 30

# Nginx activo
sudo systemctl status nginx

# Test API
curl -s https://clubix-sport.clubix.com.ar/api/health
# Esperado: {"status":"ok"} o similar

# Test frontend (debe devolver HTML)
curl -sI https://clubix-sport.clubix.com.ar | head -5
curl -sI https://www.clubix.com.ar | head -5

# Certificado wildcard correcto
echo | openssl s_client -connect clubix-sport.clubix.com.ar:443 \
  -servername clubix-sport.clubix.com.ar 2>/dev/null \
  | openssl x509 -noout -subject -dates
# Debe mostrar: CN = *.clubix.com.ar
```

---

## 14. Actualizar la aplicación

```bash
sudo su - clubixapp
cd /var/www/clubix/app

# Traer cambios
git pull origin main

# Backend
cd server
npm ci
npx prisma generate
npx prisma db push   # aplica cambios de schema sin perder datos

# Frontend
cd ../client
npm ci
npm run build

# Reiniciar backend
pm2 restart clubix-backend
pm2 save

# Nginx no necesita reinicio (sirve archivos estáticos directamente)
```

---

## 15. Comandos útiles

```bash
# Logs en tiempo real
sudo -u clubixapp pm2 logs clubix-backend

# Estado detallado
sudo -u clubixapp pm2 show clubix-backend

# Monitoreo interactivo
sudo -u clubixapp pm2 monit

# Ver todos los tenants
sudo -u postgres psql -d clubix_db -c "SELECT id, subdomain, nombre, activo FROM tenants;"

# Ver admins
sudo -u postgres psql -d clubix_db -c "SELECT id, email, activo FROM admins;"

# Backup base de datos
pg_dump -U clubixuser -h localhost clubix_db > backup_clubix_$(date +%Y%m%d_%H%M).sql

# Restore
psql -U clubixuser -h localhost clubix_db < backup_clubix_YYYYMMDD_HHMM.sql
```

---

## 16. Troubleshooting

### Nginx sirve certificado equivocado (conflicto con otro sitio)

```bash
# Ver qué cert sirve para un subdominio
echo | openssl s_client -connect clubix-sport.clubix.com.ar:443 \
  -servername clubix-sport.clubix.com.ar 2>/dev/null \
  | openssl x509 -noout -subject

# Buscar conflictos default_server
grep -r "default_server" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/

# Mover clubix a conf.d para que cargue primero
sudo cp /etc/nginx/sites-available/clubix /etc/nginx/conf.d/00-clubix.conf
sudo rm /etc/nginx/sites-enabled/clubix
# Agregar default_server al listen 443 en /etc/nginx/conf.d/00-clubix.conf

sudo nginx -t && sudo systemctl restart nginx
```

### Tenant no encontrado (error 404)

```bash
# Verificar que el tenant existe en DB
sudo -u postgres psql -d clubix_db -c \
  "SELECT subdomain, activo, estado FROM tenants WHERE subdomain = 'clubix-sport';"

# Verificar que el header X-Tenant-Slug llega al backend
sudo -u clubixapp pm2 logs clubix-backend --lines 50 | grep -i tenant
```

### Backend no inicia

```bash
# Ver error completo
sudo -u clubixapp pm2 logs clubix-backend --err --lines 50

# Verificar .env
cat /var/www/clubix/app/server/.env

# Verificar DB
psql -U clubixuser -h localhost -d clubix_db -c "SELECT 1;"
```

### Frontend muestra pantalla en blanco

```bash
# Verificar que el build existe
ls -la /var/www/clubix/app/client/dist/

# Ver errores Nginx
sudo tail -50 /var/log/nginx/clubix-error.log

# Verificar permisos
sudo chown -R clubixapp:www-data /var/www/clubix/app/client/dist
sudo chmod -R 755 /var/www/clubix/app/client/dist
```

### Certificado SSL expirado o renovación

```bash
# Ver expiración
sudo certbot certificates

# Renovar manualmente (DonWeb — DNS manual)
sudo certbot renew --manual --preferred-challenges dns \
  --cert-name clubix.com.ar

# Recargar Nginx tras renovar
sudo systemctl reload nginx
```

---

## Resumen de directorios

```
/var/www/clubix/
└── app/
    ├── server/             Backend Express (PM2)
    │   ├── src/
    │   ├── prisma/
    │   └── .env            ← credenciales, NO commitear
    ├── client/
    │   ├── src/
    │   ├── dist/           ← build de producción (Nginx lo sirve)
    │   └── .env
    └── ecosystem.config.js

/var/log/clubix/
├── backend-error.log
└── backend-out.log

/etc/nginx/sites-available/clubix   ← config Nginx
/etc/letsencrypt/live/clubix.com.ar/ ← certificados SSL
```

---

## Checklist de deployment

### Servidor
- [ ] Usuario `clubixadmin` creado con sudo
- [ ] Clave SSH configurada
- [ ] Login root SSH deshabilitado
- [ ] Node.js 20, PostgreSQL 15, Nginx, PM2 instalados

### Base de datos
- [ ] `clubix_db` creada
- [ ] Usuario `clubixuser` con permisos completos
- [ ] `prisma db push` ejecutado sin errores

### Aplicación
- [ ] Repo clonado en `/var/www/clubix/app`
- [ ] `server/.env` configurado y con permisos 600
- [ ] `client/.env` configurado (`VITE_API_URL=/api`)
- [ ] `npm ci` en server y client
- [ ] `prisma generate` ejecutado
- [ ] `npm run build` en client (dist generado)
- [ ] PM2 iniciado y guardado (`pm2 save`)
- [ ] PM2 startup configurado

### Nginx y SSL
- [ ] Cert wildcard `*.clubix.com.ar` + `clubix.com.ar` obtenido (DNS manual DonWeb)
- [ ] `/etc/letsencrypt/options-ssl-nginx.conf` existe (si no: `sudo certbot install-certificate`)
- [ ] Config Nginx creada y testeada (`nginx -t`)
- [ ] Site default deshabilitado
- [ ] Nginx activo y recargado

### Verificación funcional
- [ ] `https://www.clubix.com.ar` carga el frontend
- [ ] `https://clubix-sport.clubix.com.ar` carga el frontend
- [ ] `https://clubix-sport.clubix.com.ar/api/health` responde
- [ ] Login super admin: admin@clubix.com.ar / clubix@2026
- [ ] Contraseña super admin cambiada tras primer login
- [ ] Tenant `clubix-sport` creado en DB
