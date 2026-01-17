# RojoPlus - Arquitectura Tecnica

---

## 1. Stack Tecnologico

### 1.1 Frontend
- **Framework**: React 18+ con Vite
- **Estilos**: Tailwind CSS (simple y responsive)
- **Routing**: React Router DOM
- **HTTP Client**: Fetch API nativo (simple, sin axios)
- **Estado**: React Context (sin Redux, mantenerlo simple)

### 1.2 Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js (simple y probado)
- **ORM**: Prisma (excelente con PostgreSQL, tipado, migraciones)
- **Validacion**: Zod (validacion de schemas)
- **Auth**: JWT para admin, tokens UUID para comerciantes

### 1.3 Base de Datos
- **Motor**: PostgreSQL
- **Migraciones**: Prisma Migrate

### 1.4 Servicios Externos
- **Email**: Nodemailer con Gmail (SMTP)
- **Excel**: xlsx (libreria para leer archivos Excel)

---

## 2. Estructura del Proyecto

```
RojoPlus/
├── docs/                    # Documentacion
├── client/                  # Frontend React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Paginas/Vistas
│   │   │   ├── comercio/    # Pantalla del comerciante
│   │   │   ├── admin/       # Panel de administracion
│   │   │   └── registro/    # Registro de comercios
│   │   ├── context/         # React Context (auth, etc)
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # Llamadas a API
│   │   └── utils/           # Utilidades
│   ├── public/
│   │   └── flyer/           # Flyers descargables
│   └── index.html
├── server/                  # Backend Node.js
│   ├── src/
│   │   ├── routes/          # Rutas Express
│   │   ├── controllers/     # Logica de negocio
│   │   ├── middleware/      # Auth, validacion, etc
│   │   ├── services/        # Servicios (email, excel)
│   │   └── utils/           # Utilidades
│   └── prisma/
│       ├── schema.prisma    # Modelo de datos
│       └── seed.js          # Datos iniciales
├── uploads/                 # Archivos subidos (Excel)
├── .env                     # Variables de entorno
├── .env.example             # Ejemplo de variables
└── package.json
```

---

## 3. Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Comercio   │  │   Admin     │  │    Registro     │  │
│  │  (1 pant.)  │  │  (panel)    │  │   (formulario)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────▼─────────────────────────────┐
│                      BACKEND API                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   Express.js                     │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │  Auth    │ │  Socios  │ │  Comercios       │ │    │
│  │  │Middleware│ │  Routes  │ │  Routes          │ │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │  Ventas  │ │ Reportes │ │  Upload Excel    │ │    │
│  │  │  Routes  │ │  Routes  │ │  Service         │ │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────┘
                            │ Prisma ORM
┌───────────────────────────▼─────────────────────────────┐
│                     PostgreSQL                           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐  │
│  │ Socios │ │Comercio│ │ Ventas │ │ Rubros │ │Config │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └───────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Autenticacion y Seguridad

### 4.1 Comerciantes
- Acceso via **token UUID** en la URL
- El token se genera al aprobar el comercio
- URL ejemplo: `https://rojoplus.club/comercio/abc123-def456-...`
- El token se valida en cada request
- No requiere login tradicional (usuario/contraseña)

### 4.2 Administradores
- Login tradicional con **email y contraseña**
- Password hasheado con bcrypt
- Session via **JWT** almacenado en httpOnly cookie
- Expiacion configurable (ej: 8 horas)

### 4.3 Seguridad General
- HTTPS obligatorio en produccion
- Rate limiting en endpoints sensibles
- Validacion de input con Zod
- Sanitizacion de datos del Excel

---

## 5. Flujo de Datos

### 5.1 Registro de Comercio
```
Comerciante          Frontend            Backend              DB
    │                   │                   │                  │
    │─ Completa form ──▶│                   │                  │
    │                   │─ POST /comercios ▶│                  │
    │                   │                   │─ INSERT ────────▶│
    │                   │                   │◀─ OK ────────────│
    │                   │◀─ 201 Created ────│                  │
    │◀─ Confirmacion ───│                   │                  │
    │                   │                   │─ Email a admin ─▶│
```

### 5.2 Registro de Venta
```
Comerciante          Frontend            Backend              DB
    │                   │                   │                  │
    │─ Busca socio ────▶│                   │                  │
    │                   │─ GET /socios?q= ─▶│                  │
    │                   │                   │─ SELECT ────────▶│
    │                   │                   │◀─ Socio ─────────│
    │                   │◀─ Datos socio ────│                  │
    │◀─ Muestra socio ──│                   │                  │
    │                   │                   │                  │
    │─ Ingresa monto ──▶│                   │                  │
    │                   │─ Calcula local ──▶│                  │
    │◀─ Muestra total ──│                   │                  │
    │                   │                   │                  │
    │─ Confirma venta ─▶│                   │                  │
    │                   │─ POST /ventas ───▶│                  │
    │                   │                   │─ INSERT ────────▶│
    │                   │                   │◀─ OK ────────────│
    │                   │◀─ 201 Created ────│                  │
    │◀─ Confirmacion ───│                   │                  │
```

---

## 6. Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/rojoplus

# JWT para admin
JWT_SECRET=tu-secret-muy-largo-y-seguro
JWT_EXPIRES_IN=8h

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=clubsportivospilar@gmail.com
SMTP_PASS=tu-app-password

# General
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://rojoplus.club

# Descuento default
DEFAULT_DISCOUNT_PERCENT=10
```

---

## 7. Deployment

### 7.1 Opcion Recomendada: Monorepo con PM2

```bash
# Estructura en el servidor
/var/www/rojoplus/
├── client/dist/     # Build de React (servido por Nginx)
├── server/          # Backend Node.js
└── uploads/         # Archivos subidos

# PM2 para el backend
pm2 start server/src/index.js --name rojoplus-api

# Nginx como reverse proxy
location /api {
    proxy_pass http://localhost:3000;
}
location / {
    root /var/www/rojoplus/client/dist;
    try_files $uri /index.html;
}
```

### 7.2 Base de Datos
- PostgreSQL en el mismo servidor o servicio externo
- Backups automaticos recomendados (cron + pg_dump)

---

## 8. Consideraciones de Performance

### 8.1 Optimizaciones Simples
- Indices en campos de busqueda (nro_socio, documento, token)
- Paginacion en listados del admin
- Cache de rubros en memoria (no cambian frecuentemente)

### 8.2 No Necesario (mantener simple)
- Redis (no hace falta para este volumen)
- CDN (archivos estaticos son minimos)
- Microservicios (monolito es suficiente)

---

## 9. Dependencias Principales

### 9.1 Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.x",
    "@prisma/client": "^5.x",
    "bcryptjs": "^2.4.x",
    "jsonwebtoken": "^9.x",
    "nodemailer": "^6.x",
    "xlsx": "^0.18.x",
    "zod": "^3.x",
    "uuid": "^9.x",
    "multer": "^1.4.x",
    "cors": "^2.8.x",
    "helmet": "^7.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "nodemon": "^3.x"
  }
}
```

### 9.2 Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

---

*Documento creado: Enero 2026*
*Version: 1.0*
