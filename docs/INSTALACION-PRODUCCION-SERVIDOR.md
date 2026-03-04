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

## 0. Configurar Seguridad SSH (PRIMERO)

**⚠️ IMPORTANTE:** Realizar estos pasos ANTES de continuar con la instalación para evitar accesos no autorizados.

### Crear usuario administrador

```bash
# Conectado como root (primera vez)
# Crear usuario axiomacloud
adduser axiomacloud

# Agregar a grupo sudo
usermod -aG sudo axiomacloud

# Verificar
groups axiomacloud
# Debe mostrar: axiomacloud : axiomacloud sudo
```

### Configurar autenticación por clave SSH (Recomendado)

**En tu máquina local:**

```bash
# Generar par de claves SSH (si no tienes)
ssh-keygen -t ed25519 -C "tu_email@example.com"

# Copiar clave pública al servidor
ssh-copy-id axiomacloud@sportivo.axiomacloud.com

# O manualmente:
cat ~/.ssh/id_ed25519.pub
# Copiar el contenido
```

**En el servidor (como axiomacloud):**

```bash
# Cambiar a usuario axiomacloud
su - axiomacloud

# Crear directorio SSH
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Pegar clave pública
nano ~/.ssh/authorized_keys
# Pegar la clave copiada, guardar y salir

# Ajustar permisos
chmod 600 ~/.ssh/authorized_keys
```

### Deshabilitar login de root por SSH

```bash
# Volver a root o usar sudo
exit
# O continuar con sudo

# Editar configuración SSH
sudo nano /etc/ssh/sshd_config
```

**Modificar las siguientes líneas:**

```bash
# Buscar y cambiar estas directivas:
PermitRootLogin no                    # Era "yes", cambiar a "no"
PasswordAuthentication yes            # Mantener "yes" inicialmente
PubkeyAuthentication yes              # Debe estar en "yes"

# Opcional (más seguro - solo claves SSH):
# PasswordAuthentication no           # Descomentar después de probar con clave
```

**Guardar y cerrar (Ctrl+O, Enter, Ctrl+X)**

### Reiniciar servicio SSH

```bash
# Probar configuración
sudo sshd -t

# Si no hay errores, reiniciar
sudo systemctl restart sshd
```

### Verificar acceso

**⚠️ NO CERRAR la sesión actual de SSH. Abrir una NUEVA terminal y probar:**

```bash
# En otra terminal
ssh axiomacloud@sportivo.axiomacloud.com

# Probar sudo
sudo whoami
# Debe retornar: root
```

**Si funciona correctamente:**
- ✅ Puedes cerrar la sesión de root
- ✅ Continuar con el resto de la instalación como `axiomacloud`

**Si NO funciona:**
- ⚠️ NO cerrar la sesión de root original
- ⚠️ Revisar configuración en /etc/ssh/sshd_config
- ⚠️ Verificar permisos de ~/.ssh y ~/.ssh/authorized_keys

### Seguridad adicional (Opcional)

```bash
# Cambiar puerto SSH (evita bots)
sudo nano /etc/ssh/sshd_config
# Buscar: #Port 22
# Cambiar a: Port 2222

# Configurar firewall
sudo ufw allow 2222/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Reiniciar SSH
sudo systemctl restart sshd
```

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

## 10. Crear Usuario Super Administrador

```bash
# Como sportivouser
sudo su - sportivouser
cd /var/www/rojoplus/server

# Ejecutar script de creación de super admin
node createSuperAdmin.js
```

**Credenciales creadas:**
- **Email:** `admin@sportivopilar.com.ar`
- **Contraseña:** `Sportivo2026!`

**⚠️ IMPORTANTE:** Cambia esta contraseña después del primer login en:
`https://sportivo.axiomacloud.com/admin` → Perfil → Cambiar Contraseña

### Crear admin con contraseña personalizada

Si necesitas una contraseña diferente, edita el archivo antes de ejecutar:

```bash
nano /var/www/rojoplus/server/createSuperAdmin.js

# Buscar la línea:
const password = 'Sportivo2026!';

# Cambiar por tu contraseña deseada
const password = 'TuContraseñaSegura';

# Guardar (Ctrl+O, Enter, Ctrl+X) y ejecutar
node createSuperAdmin.js
```

---

## 11. Comandos de Mantenimiento

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

### SSL sirve certificado incorrecto (servidores con múltiples aplicaciones)

**Síntoma:** Al acceder a `https://sportivo.axiomacloud.com`, el navegador muestra error de certificado o sirve el certificado de otro sitio (ej: mediflow).

**Diagnóstico:**

```bash
# Verificar qué certificado está sirviendo
echo | openssl s_client -connect sportivo.axiomacloud.com:443 -servername sportivo.axiomacloud.com 2>/dev/null | openssl x509 -noout -subject

# Debe mostrar: subject=CN = sportivo.axiomacloud.com
# Si muestra otro dominio, hay un problema de configuración
```

**Causas comunes:**

1. **Múltiples sitios con `default_server` en puerto 443**
2. **Orden de carga de archivos de configuración** (conf.d carga antes que sites-enabled)
3. **IPv6 habilitado en servidor NO accesible por IPv6**

**Solución:**

```bash
# 1. Buscar conflictos de default_server
grep -r "default_server" /etc/nginx/
# Debe haber SOLO UNO en puerto 443

# 2. Verificar orden de carga
sudo nginx -T 2>/dev/null | grep "# configuration file /etc/nginx" | grep -E "(conf.d|sites-enabled)"
# Los archivos en conf.d/ cargan ANTES que sites-enabled/

# 3. Verificar accesibilidad IPv6
curl -6 -I http://sportivo.axiomacloud.com
# Si falla, el servidor NO es accesible por IPv6

# 4. Si el servidor NO soporta IPv6, deshabilitar en TODOS los sitios
grep -r "listen \[::\]:443" /etc/nginx/sites-enabled/

# Comentar líneas IPv6 en cada sitio:
sudo sed -i 's/listen \[::\]:443/# listen [::]:443/g' /etc/nginx/sites-enabled/*

# 5. Mover sportivo a conf.d para que cargue primero
sudo cp /etc/nginx/sites-available/sportivo /etc/nginx/conf.d/00-sportivo.conf
sudo rm /etc/nginx/sites-enabled/sportivo

# 6. Asegurar que solo sportivo tenga default_server
sudo nano /etc/nginx/conf.d/00-sportivo.conf
# Buscar: listen 443 ssl http2;
# Cambiar a: listen 443 ssl http2 default_server;

# 7. Quitar default_server de otros sitios
grep -r "default_server" /etc/nginx/conf.d/
# Editar archivos y quitar default_server excepto de 00-sportivo.conf

# 8. Verificar y reiniciar
sudo nginx -t
sudo systemctl restart nginx

# 9. Probar
curl -I https://sportivo.axiomacloud.com
echo | openssl s_client -connect sportivo.axiomacloud.com:443 -servername sportivo.axiomacloud.com 2>/dev/null | openssl x509 -noout -subject
```

**Verificación final:**

```bash
# Por IPv4 debe funcionar
curl -4 -I https://sportivo.axiomacloud.com

# Certificado correcto
echo | openssl s_client -connect sportivo.axiomacloud.com:443 -servername sportivo.axiomacloud.com 2>/dev/null | openssl x509 -noout -subject
# Debe mostrar: subject=CN = sportivo.axiomacloud.com

# Solo debe escuchar en IPv4:443 (no IPv6)
sudo netstat -tulpn | grep nginx | grep 443
# Debe mostrar: tcp  0.0.0.0:443  (sin tcp6 :::443)
```

**Nota:** En servidores con múltiples aplicaciones, se recomienda:
- Usar prefijos numéricos en nombres de archivos: `00-principal.conf`, `01-app1.conf`
- Solo UNA aplicación con `default_server`
- Deshabilitar IPv6 si el servidor no es accesible por IPv6

### Frontend apunta a URL incorrecta (ej: sportivodemo en vez de sportivo)

**Síntoma:** El navegador intenta conectarse a una URL incorrecta aunque el `.env` esté correcto.

**Diagnóstico:**

```bash
# Ver en la consola del navegador (F12)
# POST https://sportivodemo.axiomacloud.com/api/admin/login 401 (Unauthorized)

# En el servidor, verificar que el build tenga la URL correcta
cd /var/www/rojoplus/client
grep -r "sportivodemo" dist/
# Si aparece resultados = build tiene URL vieja
```

**Causa:** Vite usa múltiples archivos `.env` con **orden de prioridad**:

1. `.env.production.local` (MAYOR prioridad - sobrescribe todo)
2. `.env.production`
3. `.env.local`
4. `.env` (MENOR prioridad)

Si `.env.production` o `.env.production.local` tienen la URL vieja, esos tienen prioridad sobre `.env`.

**Solución:**

```bash
cd /var/www/rojoplus/client

# 1. Listar TODOS los archivos .env
ls -la | grep env

# 2. Verificar contenido de cada uno
cat .env
cat .env.production 2>/dev/null
cat .env.production.local 2>/dev/null
cat .env.local 2>/dev/null

# 3. Eliminar archivos con URL incorrecta o corregirlos
# Opción A: Eliminar .env.production si tiene URL vieja
rm .env.production

# Opción B: Corregir .env.production
nano .env.production
# Cambiar a: VITE_API_URL=https://sportivo.axiomacloud.com/api

# 4. Asegurar que .env tenga la URL correcta
cat > .env << 'EOF'
VITE_API_URL=https://sportivo.axiomacloud.com/api
VITE_RECAPTCHA_SITE_KEY=6Ld-k08sAAAAAAJ28g-CUaty6gGZCq-wyP_iPEsx
EOF

# 5. Limpiar caché de Vite y rebuild
rm -rf dist node_modules/.vite
npm run build

# 6. Verificar que NO aparezca la URL vieja
grep -r "sportivodemo" dist/
# Debe estar vacío (sin resultados)

# 7. Verificar que SÍ aparezca la URL correcta
grep -r "sportivo.axiomacloud.com" dist/assets/*.js | head -3
# Debe mostrar resultados

# 8. Reiniciar servicios
cd ..
pm2 restart all
```

**En el navegador:**

Después de rebuild, el Service Worker puede seguir cacheando la versión vieja:

```
1. F12 → Application → Storage → Clear site data (marcar todo)
2. Ctrl + Shift + Delete → Borrar caché de última hora
3. Cerrar y reabrir el navegador
4. Ctrl + Shift + R (recarga forzada)
```

**Prevención:** En producción, solo usar `.env` y evitar crear `.env.production` a menos que sea necesario.

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

### Seguridad
- [ ] Usuario axiomacloud creado con permisos sudo
- [ ] Autenticación SSH por clave configurada
- [ ] Login de root por SSH deshabilitado
- [ ] Acceso con axiomacloud verificado
- [ ] Firewall UFW configurado (opcional)

### Sistema
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
- [ ] SSL sirviendo certificado correcto (no de otro sitio)
- [ ] Health check funcionando
- [ ] Super Admin creado (admin@sportivopilar.com.ar)
- [ ] Contraseña del admin cambiada desde el panel
