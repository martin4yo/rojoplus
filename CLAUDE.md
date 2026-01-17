# RojoPlus - Contexto del Proyecto

Este archivo contiene el contexto necesario para retomar el desarrollo del proyecto.

## Descripcion

**RojoPlus** es un sistema de fidelizacion para el Club Sportivo Pilar ("El Rojo de la Avenida"). Permite a los socios del club obtener descuentos en comercios adheridos presentando su numero de socio o DNI.

## Stack Tecnologico

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Base de datos**: PostgreSQL
- **Email**: Nodemailer con Gmail

## Estructura del Proyecto

```
RojoPlus/
├── docs/                    # Documentacion completa
│   ├── 01-ESPECIFICACION-FUNCIONAL.md
│   ├── 02-ARQUITECTURA-TECNICA.md
│   ├── 03-MODELO-DE-DATOS.md
│   ├── 04-FLUJOS-DE-USUARIO.md
│   ├── 05-API-ENDPOINTS.md
│   └── 06-ESTILOS-BRANDING.md
├── client/                  # Frontend React (por crear)
├── server/                  # Backend Express (por crear)
├── Socios.xlsx             # Archivo de socios del club
└── CLAUDE.md               # Este archivo
```

## Decisiones Tecnicas

1. **Autenticacion de comerciantes**: Token UUID en URL (sin login tradicional)
2. **Autenticacion de admin**: JWT con httpOnly cookies
3. **Carga de socios**: Importacion desde Excel (.xlsx)
4. **Descuentos**: Porcentaje configurable por comercio + acumulacion opcional

## Colores y Estilos

- **Primario**: Rojo #DC2626
- **Hover**: Rojo oscuro #B91C1C
- **Fondo**: Gris claro #F9FAFB
- **Logo**: LogoAxiomaCloud.png

## Flujo Principal

1. Comerciante accede via link con token: `/c/{token}`
2. Ingresa nro. de socio o DNI
3. Sistema valida si socio esta ACTIVO
4. Comerciante ingresa importe de venta
5. Sistema calcula descuento y muestra total
6. Comerciante confirma y se registra la venta

## Columnas del Excel de Socios (relevantes)

- Nro.Socio → nro_socio
- ApellidoNombre → apellido_nombre
- Estado → estado
- Documento → documento
- Email → email
- Celular → celular
- Categoria → categoria
- TipoSocio → tipo_socio

## Proximos Pasos

1. Crear estructura de carpetas client/ y server/
2. Configurar Prisma con el schema definido
3. Implementar backend (rutas, controladores)
4. Implementar frontend (pantallas)
5. Integrar servicio de email
6. Testing y deploy

## Comandos Utiles (cuando este implementado)

```bash
# Desarrollo
cd server && npm run dev
cd client && npm run dev

# Base de datos
npx prisma migrate dev
npx prisma db seed

# Build
cd client && npm run build
```

---

*Ultima actualizacion: Enero 2026*
