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

### Completado

- [x] Sistema base de gestion de socios
- [x] Cuotas y recargos por mora
- [x] Planes de pago (financiacion)
- [x] Reportes de cobranza con KPIs
- [x] Portal del socio con pagos online (MercadoPago/MODO)
- [x] Sistema de caja y movimientos
- [x] Actividades deportivas e inscripciones

### Ultima Sesion (20 Enero 2026)

- [x] ReporteCuotas: Layout optimizado (graficos izq, tabla der)
- [x] ReporteActividades: Layout optimizado con tarjetas
- [x] ReporteSocios: Filtro por estado, metricas avanzadas, selector de periodo
- [x] Header: "El equipo de la ciudad"

### Pendiente - Plan Modulos Financieros

Ver plan detallado: `C:\Users\marti\.claude\plans\linear-cooking-gosling.md`

1. **Ingresos**: Clientes, Facturas emitidas, Recibos de cobro
2. **Egresos**: Proveedores, Personal, Facturas recibidas, Ordenes de pago
3. **Tesoreria**: Cajas, Movimientos, Transferencias
4. **Stock**: Productos con talles, fotos, control de inventario

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

### Prioridad Alta - Modulos Financieros
1. **Fase 7**: Modulo de Entidades (Proveedores, Clientes, Personal)
2. **Fase 8**: MovimientoContable unificado (facturas, pagos, cobros)
3. **Fase 9**: Tesoreria avanzada (transferencias entre cajas)
4. **Fase 10**: Stock con variantes/talles y fotos

### Futuro
- Debito automatico (Prisma/Payway)
- Conciliacion bancaria
- Reportes exportables PDF/Excel

Ver plan completo en `docs/12-PLAN-DE-TRABAJO.md`

---

*Ultima actualizacion: 20 Enero 2026*
