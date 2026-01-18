# RojoPlus - Sistema de Gestion Club Sportivo Pilar

Este archivo contiene el contexto necesario para retomar el desarrollo del proyecto.

## Descripcion

**RojoPlus** es un sistema integral de gestion para el Club Sportivo Pilar ("El Rojo de la Avenida") que incluye:
- **Fidelizacion**: Descuentos en comercios adheridos para socios
- **Gestion de Socios**: ABM completo con grupos familiares y menores
- **Actividades Deportivas**: Deportes, categorias e inscripciones
- **Sistema de Cuotas**: Generacion, recargos y cobranza
- **Debito Automatico**: Integracion con Prisma y Payway
- **Portal de Socio**: Pagos online con MercadoPago y MODO
- **Caja y Movimientos**: Plan de cuentas y conciliacion bancaria

## Stack Tecnologico

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Base de datos**: PostgreSQL
- **Email**: Nodemailer con Gmail
- **QR**: qrcode.react (generacion) + @yudiel/react-qr-scanner (escaneo)
- **Pagos**: MercadoPago + MODO

## Estructura del Proyecto

```
RojoPlus/
├── docs/                           # Documentacion completa
│   ├── 01-ESPECIFICACION-FUNCIONAL.md
│   ├── 08-SCHEMA-COMPLETO-CLUB.prisma
│   ├── 12-PLAN-DE-TRABAJO.md
│   ├── 13-DEBITO-AUTOMATICO.md
│   ├── 14-CONCILIACION-BANCARIA.md
│   ├── 15-PORTAL-PAGOS-ONLINE.md
│   └── 16-CONFIGURACION-BRANDING.md
├── brio/                           # Archivos de referencia (sistema anterior)
├── client/                         # Frontend React
│   └── src/
│       ├── components/
│       │   └── QrScanner.jsx
│       └── pages/
│           ├── comercio/
│           ├── socio/
│           └── admin/
├── server/                         # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma           # Schema completo (30+ modelos)
│   │   └── seed.js                 # Seeds iniciales
│   └── src/
│       └── routes/
└── CLAUDE.md                       # Este archivo
```

## Estado Actual del Desarrollo

### Fase 0: Base de Datos - EN PROGRESO

- [x] Rama `feature/gestion-club` creada
- [x] Schema completo diseñado (30+ modelos)
- [x] Seeds iniciales creados y ejecutados
- [x] Migracion aplicada en desarrollo
- [ ] Regenerar Prisma Client (detener servidor primero)
- [ ] Deploy a produccion

### Modelos Principales del Schema

| Modulo | Modelos |
|--------|---------|
| Socios | Socio, GrupoFamiliar, AutorizacionMenor, Cobrador |
| Deportes | Deporte, Categoria, Inscripcion, EntrenadorCategoria |
| Cuotas | TipoCuota, ConfiguracionCuota, ConfiguracionRecargo, PeriodoCuota, Cuota |
| Pagos | MedioPago, Pago, SaldoFavor, AplicacionSaldo, LinkPago |
| Caja | Caja, CuentaBancaria, CuentaContable, MovimientoCaja |
| Debito | ConfiguracionDebito, ArchivoDebito, DetalleDebito, ImportacionCobranza |
| Conciliacion | ExtractoBancario, MovimientoExtracto, Conciliacion |
| Usuarios | Admin, Rol, Permiso, PermisoRol |
| Comercios | Comercio, Rubro, Venta |
| Sistema | Configuracion, AuditLog |

## Funcionalidades del Sistema

### Ya Implementadas (RojoPlus v1)
- Identificacion de socios por QR
- Portal de comercios adheridos
- Gestion basica de socios
- Sistema de descuentos

### En Desarrollo (v2)
- Gestion completa de socios con datos medicos
- Grupos familiares
- Deportes y categorias
- Sistema de cuotas con recargos acumulativos
- Debito automatico (Prisma/Payway)
- Conciliacion bancaria
- Portal de socio con pagos online
- Configuracion de branding

## URLs y Rutas

| URL | Descripcion |
|-----|-------------|
| `/mi-qr` | Socio obtiene su QR |
| `/s/{tokenPortal}` | Portal del socio |
| `/c/{token}` | Portal del comerciante |
| `/admin` | Panel de administracion |
| `/registro` | Registro de comercios |

## Comandos Utiles

```bash
# Desarrollo
cd server && npm run dev
cd client && npm run dev

# Base de datos
npx prisma db push              # Aplicar schema
npx prisma db seed              # Seeds
npx prisma generate             # Regenerar client
npx prisma studio               # Ver datos

# Despues de migrar schema
# 1. Detener servidor
# 2. npx prisma generate
# 3. Reiniciar servidor
```

## Configuracion de Branding

Los colores y logo del club son configurables desde BD:

| Clave | Default |
|-------|---------|
| COLOR_PRIMARIO | #DC2626 |
| COLOR_SECUNDARIO | #1F2937 |
| COLOR_FONDO | #F9FAFB |
| CLUB_LOGO_URL | /images/logo.png |

## Credenciales de Desarrollo

```
Admin: admin@rojoplus.com / admin123
```

## Proximos Pasos

1. **Fase 1**: Completar CRUD de socios con nuevos campos
2. **Fase 2**: ABM de deportes y sistema de inscripciones
3. **Fase 3**: Generacion de cuotas y recargos
4. **Fase 4**: Sistema de cobranza
5. **Fase 5**: Caja y movimientos
6. **Fase 5.5**: Debito automatico
7. **Fase 5.6**: Conciliacion bancaria
8. **Fase 6**: Portal de socio con pagos online

Ver `docs/12-PLAN-DE-TRABAJO.md` para el plan detallado.

---

*Ultima actualizacion: Enero 2026 - Fase 0 en progreso*
