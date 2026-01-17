# Instalación en Producción - RojoPlus

## Requisitos del Servidor

- Ubuntu 22.04 LTS o 24.04 LTS
- Node.js 20.x LTS
- PostgreSQL 15+ (compartido con otras apps)
- Nginx (compartido)
- PM2 (process manager)
- Certbot (SSL)

## Arquitectura

```
                    ┌─────────────────────────────────────┐
                    │           Nginx (443/80)            │
                    │      sportivo.axiomacloud.com       │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼───────┐           ┌────────▼────────┐
            │   Frontend    │           │    Backend      │
            │  (Vite/React) │           │   (Express)     │
            │  Puerto 8090  │           │   Puerto 5300   │
            └───────────────┘           └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │   PostgreSQL    │
                                        │   Puerto 5432   │
                                        │   rojoplus_db   │
                                        └─────────────────┘
```

## Puertos Utilizados

| Servicio | Puerto | Usuario |
|----------|--------|---------|
| RojoPlus Backend | 5300 | sportivouser |
| RojoPlus Frontend | 8090 | sportivouser |
| PostgreSQL | 5432 | postgres (compartido) |

---

## 1. Crear Usuario del Sistema

```bash
# Crear usuario sin shell interactivo
sudo useradd -r -m -d /var/www/rojoplus -s /bin/bash sportivouser

# Crear directorio de logs
sudo mkdir -p /var/log/rojoplus
sudo chown sportivouser:sportivouser /var/log/rojoplus
```

---

## 2. Configurar PostgreSQL

```bash
# Conectar como postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE rojoplus_db;
CREATE USER rojoplususer WITH ENCRYPTED PASSWORD 'CAMBIAR_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE rojoplus_db TO rojoplususer;

# Dar permisos en schema public
\c rojoplus_db
GRANT ALL ON SCHEMA public TO rojoplususer;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rojoplususer;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rojoplususer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rojoplususer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rojoplususer;

\q
```

---

## 3. Clonar Repositorio

```bash
# Cambiar a usuario sportivouser
sudo su - sportivouser

# Clonar repositorio
cd /var/www
git clone  https://github.com/martin4yo/rojoplus.git rojoplus
cd rojoplus
```

---

## 4. Configurar Variables de Entorno

### Backend (.env)

```bash
# Crear archivo de entorno del backend
cat > /var/www/rojoplus/server/.env << 'EOF'
# Base de datos PostgreSQL
DATABASE_URL=postgresql://rojoplususer:CAMBIAR_PASSWORD_SEGURO@localhost:5432/rojoplus_db?schema=public

# JWT para admin
JWT_SECRET=rojoplus-jwt-secret-key-CAMBIAR-POR-CLAVE-SEGURA-64-CHARS-MINIMO
JWT_EXPIRES_IN=8h

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=remoteaxioma@gmail.com
SMTP_PASS=CAMBIAR_APP_PASSWORD
SMTP_FROM=noreply@sportivopilar.com.ar

# General
NODE_ENV=production
PORT=5300
FRONTEND_URL=https://sportivo.axiomacloud.com

# Descuento default
DEFAULT_DISCOUNT_PERCENT=10
EOF

# Proteger archivo
chmod 600 /var/www/rojoplus/server/.env
```

### Frontend (.env)

```bash
# Crear archivo de entorno del frontend
cat > /var/www/rojoplus/client/.env << 'EOF'
VITE_API_URL=https://sportivo.axiomacloud.com/api
EOF

chmod 600 /var/www/rojoplus/client/.env
```

---

## 5. Instalar Dependencias y Compilar

```bash
# Como sportivouser
cd /var/www/rojoplus

# Backend (no requiere build, es JavaScript puro)
cd server
npm ci
npx prisma generate
npx prisma db push

# Frontend
cd ../client
npm ci
npm run build
```

---

## 6. Configurar PM2

### Crear ecosystem.config.js

```bash
cat > /var/www/rojoplus/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'rojoplus-backend',
      cwd: '/var/www/rojoplus/server',
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
      error_file: '/var/log/rojoplus/backend-error.log',
      out_file: '/var/log/rojoplus/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'rojoplus-frontend',
      cwd: '/var/www/rojoplus/client',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 8090 --host',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/rojoplus/frontend-error.log',
      out_file: '/var/log/rojoplus/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF
```

### Iniciar con PM2

```bash
# Iniciar aplicaciones
pm2 start /var/www/rojoplus/ecosystem.config.js

# Guardar configuración para auto-inicio
pm2 save

# Verificar estado
pm2 status
pm2 logs
```

### Configurar PM2 para inicio automático (como root)

```bash
# Salir de sportivouser
exit

# Configurar startup (como root)
sudo pm2 startup systemd -u sportivouser --hp /var/www/rojoplus
```

---

## 7. Configurar Nginx

### Crear configuración del sitio

```bash
sudo nano /etc/nginx/sites-available/sportivo
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sportivo.axiomacloud.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sportivo.axiomacloud.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/sportivo.axiomacloud.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sportivo.axiomacloud.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Logs
    access_log /var/log/nginx/sportivo-access.log;
    error_log /var/log/nginx/sportivo-error.log;

    # Max upload size
    client_max_body_size 10M;

    # API Backend
    location /api {
        proxy_pass http://127.0.0.1:5300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
    }

    # Frontend (React/Vite)
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Habilitar sitio

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/sportivo /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

---

## 8. Obtener Certificado SSL

```bash
# Obtener certificado con Certbot
sudo certbot --nginx -d sportivo.axiomacloud.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

---

## 9. Verificar Instalación

```bash
# Estado de PM2
sudo -u sportivouser pm2 status

# Logs
sudo -u sportivouser pm2 logs

# Test endpoints
curl -I https://sportivo.axiomacloud.com
curl https://sportivo.axiomacloud.com/api/health
curl https://sportivo.axiomacloud.com/api/rubros
```

---

## 10. Comandos de Mantenimiento

### Actualizar aplicación

```bash
# Como sportivouser
sudo su - sportivouser
cd /var/www/rojoplus

# Pull cambios
git pull origin main

# Actualizar backend
cd server
npm ci
npx prisma generate
npx prisma db push
npm run build

# Actualizar frontend
cd ../client
npm ci
npm run build

# Reiniciar servicios
pm2 restart all
pm2 save
```

### Ver logs

```bash
# Logs en tiempo real
sudo -u sportivouser pm2 logs

# Logs específicos
sudo -u sportivouser pm2 logs rojoplus-backend
sudo -u sportivouser pm2 logs rojoplus-frontend

# Últimas líneas
tail -100 /var/log/rojoplus/backend-error.log
tail -100 /var/log/rojoplus/frontend-out.log
```

### Reiniciar servicios

```bash
# Reiniciar todo
sudo -u sportivouser pm2 restart all

# Reiniciar específico
sudo -u sportivouser pm2 restart rojoplus-backend
sudo -u sportivouser pm2 restart rojoplus-frontend

# Detener
sudo -u sportivouser pm2 stop all

# Iniciar
sudo -u sportivouser pm2 start all
```

### Monitoreo

```bash
# Monitor interactivo
sudo -u sportivouser pm2 monit

# Estado detallado
sudo -u sportivouser pm2 show rojoplus-backend
```

---

## 11. Troubleshooting

### Error de conexión a base de datos

```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
psql -U rojoplususer -d rojoplus_db -h localhost
```

### Error de permisos

```bash
# Verificar ownership
ls -la /var/www/rojoplus
ls -la /var/log/rojoplus

# Corregir permisos
sudo chown -R sportivouser:sportivouser /var/www/rojoplus
sudo chown -R sportivouser:sportivouser /var/log/rojoplus
```

### Puerto en uso

```bash
# Ver qué usa el puerto
sudo lsof -i :5300
sudo lsof -i :8090

# Matar proceso si es necesario
sudo kill -9 PID
```

### Nginx no inicia

```bash
# Ver errores
sudo nginx -t
sudo journalctl -u nginx -f
```

---

## 12. Backup

### Base de datos

```bash
# Backup
pg_dump -U rojoplususer -h localhost rojoplus_db > backup_rojoplus_$(date +%Y%m%d).sql

# Restore
psql -U rojoplususer -h localhost rojoplus_db < backup_rojoplus_YYYYMMDD.sql
```

### Archivos

```bash
# Backup completo
tar -czvf rojoplus_backup_$(date +%Y%m%d).tar.gz /var/www/rojoplus
```

---

## Resumen de Directorios

```
/var/www/rojoplus/          # Aplicación
├── server/                 # Backend Express
│   ├── src/
│   ├── prisma/
│   └── .env
├── client/                 # Frontend React/Vite
│   ├── src/
│   ├── dist/              # Build producción
│   └── .env
└── ecosystem.config.js    # Config PM2

/var/log/rojoplus/         # Logs
├── backend-error.log
├── backend-out.log
├── frontend-error.log
└── frontend-out.log

/etc/nginx/sites-available/sportivo  # Config Nginx
```

---

## Checklist de Deployment

- [ ] Usuario sportivouser creado
- [ ] Base de datos rojoplus_db creada
- [ ] Usuario rojoplususer con permisos
- [ ] Repositorio clonado en /var/www/rojoplus
- [ ] Variables de entorno configuradas (server/.env, client/.env)
- [ ] Dependencias instaladas (npm ci)
- [ ] Prisma generado y migrado
- [ ] Backend compilado
- [ ] Frontend compilado (npm run build)
- [ ] PM2 configurado y corriendo
- [ ] PM2 guardado para auto-inicio
- [ ] Nginx configurado
- [ ] Certificado SSL obtenido
- [ ] Health check funcionando
- [ ] Admin creado en base de datos
