# RojoPlus - Roadmap de Implementacion

---

## Configuracion de Base de Datos

```
Host: localhost
Puerto: 5432
Usuario: postgres
Password: Q27G4B98
Base de datos: rojoplus
```

**Admin creado:** admin@sportivo.com.ar / 123456

---

## FASE 1: Setup Inicial
> Configuracion del proyecto y estructura base

- [x] **1.1** Crear estructura de carpetas (client/, server/)
- [x] **1.2** Inicializar proyecto Node.js (server/package.json)
- [x] **1.3** Instalar dependencias del backend
- [x] **1.4** Configurar Prisma y schema
- [x] **1.5** Crear archivo .env con variables de entorno
- [x] **1.6** Ejecutar migracion inicial de Prisma
- [x] **1.7** Crear seed con rubros y admin inicial
- [x] **1.8** Inicializar proyecto Vite + React (client/)
- [x] **1.9** Instalar y configurar Tailwind CSS
- [x] **1.10** Configurar colores personalizados en Tailwind

---

## FASE 2: Backend - Estructura Base
> Configuracion de Express y middlewares

- [x] **2.1** Crear servidor Express basico (server/src/index.js)
- [x] **2.2** Configurar middlewares (cors, helmet, json)
- [x] **2.3** Crear cliente Prisma singleton
- [x] **2.4** Crear estructura de rutas (routes/)
- [x] **2.5** Crear middleware de manejo de errores
- [x] **2.6** Crear utilidades de respuesta (success/error)

---

## FASE 3: Backend - Autenticacion
> Sistema de auth para admin y comerciantes

- [x] **3.1** Crear middleware de auth JWT (admin)
- [x] **3.2** Crear middleware de auth por token (comerciantes)
- [x] **3.3** Implementar POST /admin/login
- [x] **3.4** Implementar validacion de token de comercio

---

## FASE 4: Backend - Modulo Rubros
> CRUD de rubros (simple)

- [x] **4.1** Implementar GET /rubros (publico)

---

## FASE 5: Backend - Modulo Comercios
> Registro, aprobacion y gestion de comercios

- [x] **5.1** Implementar POST /comercios/registro
- [x] **5.2** Implementar GET /comercio/{token} (info comercio)
- [x] **5.3** Implementar GET /admin/comercios (listado)
- [x] **5.4** Implementar GET /admin/comercios/{id} (detalle)
- [x] **5.5** Implementar POST /admin/comercios/{id}/aprobar
- [x] **5.6** Implementar POST /admin/comercios/{id}/rechazar
- [x] **5.7** Implementar PATCH /admin/comercios/{id} (editar)
- [x] **5.8** Implementar POST /admin/comercios/{id}/desactivar
- [x] **5.9** Implementar POST /admin/comercios/{id}/reenviar-link

---

## FASE 6: Backend - Modulo Socios
> Importacion desde Excel y busqueda

- [x] **6.1** Crear servicio de lectura de Excel
- [x] **6.2** Implementar GET /admin/socios (listado)
- [x] **6.3** Implementar POST /admin/socios/upload (preview)
- [x] **6.4** Implementar POST /admin/socios/upload/{id}/confirmar
- [x] **6.5** Implementar GET /comercio/{token}/socios/buscar

---

## FASE 7: Backend - Modulo Ventas
> Registro de ventas y calculo de descuentos

- [x] **7.1** Crear servicio de calculo de descuentos
- [x] **7.2** Crear servicio de verificacion de acumulacion
- [x] **7.3** Implementar POST /comercio/{token}/ventas/calcular
- [x] **7.4** Implementar POST /comercio/{token}/ventas

---

## FASE 8: Backend - Modulo Reportes
> Reportes y estadisticas

- [x] **8.1** Implementar GET /admin/dashboard (stats)
- [x] **8.2** Implementar GET /admin/reportes/ventas
- [ ] **8.3** Implementar GET /admin/reportes/ventas/export

---

## FASE 9: Backend - Servicio de Email
> Envio de notificaciones

- [ ] **9.1** Configurar Nodemailer con Gmail
- [ ] **9.2** Crear template email: solicitud recibida
- [ ] **9.3** Crear template email: comercio aprobado (con link)
- [ ] **9.4** Crear template email: comercio rechazado
- [ ] **9.5** Crear template email: notificacion a admin

---

## FASE 10: Frontend - Estructura Base
> Setup de React y componentes base

- [x] **10.1** Configurar React Router
- [x] **10.2** Crear layout base
- [x] **10.3** Crear componentes UI reutilizables:
  - [x] Button (primario, secundario, texto)
  - [x] Input
  - [x] Card
  - [x] Alert (success, error, warning)
  - [x] Loading spinner
- [x] **10.4** Crear servicio de API (fetch wrapper)
- [x] **10.5** Agregar logo del club

---

## FASE 11: Frontend - Registro de Comercio
> Pantalla publica de registro

- [x] **11.1** Crear pagina /registro
- [x] **11.2** Implementar formulario de registro
- [x] **11.3** Implementar selector de rubros
- [x] **11.4** Crear pantalla de confirmacion
- [x] **11.5** Agregar boton descarga de flyer

---

## FASE 12: Frontend - Pantalla del Comerciante
> Pantalla principal para registrar ventas

- [x] **12.1** Crear pagina /c/{token}
- [x] **12.2** Validar token al cargar
- [x] **12.3** Implementar busqueda de socio
- [x] **12.4** Mostrar card de socio (activo/inactivo)
- [x] **12.5** Implementar input de importe
- [x] **12.6** Mostrar calculo de descuento
- [x] **12.7** Mostrar descuento por acumulacion (si aplica)
- [x] **12.8** Implementar boton registrar venta
- [x] **12.9** Mostrar confirmacion de venta
- [x] **12.10** Pantalla de error (token invalido)

---

## FASE 13: Frontend - Panel Admin (Auth)
> Login y proteccion de rutas

- [x] **13.1** Crear contexto de autenticacion
- [x] **13.2** Crear pagina /admin/login
- [x] **13.3** Implementar formulario de login
- [x] **13.4** Crear componente ProtectedRoute
- [x] **13.5** Crear layout del admin (sidebar + header)
- [x] **13.6** Sidebar responsive con menu hamburguesa (movil)

---

## FASE 14: Frontend - Admin Dashboard
> Pantalla principal del admin

- [x] **14.1** Crear pagina /admin/dashboard
- [x] **14.2** Mostrar cards con estadisticas
- [x] **14.3** Mostrar alerta de comercios pendientes
- [x] **14.4** Mostrar ultimas ventas

---

## FASE 15: Frontend - Admin Comercios
> Gestion de comercios

- [x] **15.1** Crear pagina /admin/comercios
- [x] **15.2** Implementar listado con filtros
- [x] **15.3** Crear pagina /admin/comercios/pendientes
- [x] **15.4** Crear pagina /admin/comercios/{id} (detalle)
- [x] **15.5** Implementar botones aprobar/rechazar
- [x] **15.6** Implementar edicion de descuento
- [x] **15.7** Implementar config de acumulacion

---

## FASE 16: Frontend - Admin Socios
> Gestion de socios

- [x] **16.1** Crear pagina /admin/socios
- [x] **16.2** Implementar listado con busqueda
- [x] **16.3** Crear pagina /admin/socios/cargar
- [x] **16.4** Implementar upload de Excel
- [x] **16.5** Mostrar preview de carga
- [x] **16.6** Implementar confirmacion de carga
- [x] **16.7** Crear ficha completa de socio con tabs
- [x] **16.8** Mostrar inicial en circulo si no carga foto

---

## FASE 17: Frontend - Admin Reportes
> Visualizacion de reportes

- [x] **17.1** Crear pagina /admin/reportes
- [x] **17.2** Implementar filtros de fecha
- [x] **17.3** Mostrar resumen de ventas
- [x] **17.4** Mostrar tabla de ventas por comercio
- [ ] **17.5** Implementar boton exportar

---

## FASE 18: Integracion y Testing
> Pruebas de funcionamiento

- [ ] **18.1** Probar flujo completo de registro de comercio
- [ ] **18.2** Probar flujo de aprobacion
- [ ] **18.3** Probar flujo de registro de venta
- [ ] **18.4** Probar carga de Excel de socios
- [ ] **18.5** Probar descuento por acumulacion
- [ ] **18.6** Probar envio de emails
- [ ] **18.7** Probar responsive en celular

---

## FASE 19: Produccion
> Preparacion para deploy

- [x] **19.1** Configurar build de produccion
- [x] **19.2** Configurar variables de entorno produccion
- [x] **19.3** Deploy en servidor
- [x] **19.4** Configurar Nginx
- [x] **19.5** Configurar SSL/HTTPS
- [x] **19.6** Crear admin inicial en produccion
- [x] **19.7** Cargar socios iniciales

---

## FASE 20: QR e Identificacion de Socios
> Sistema de identificacion por QR

- [x] **20.1** Agregar campo tokenPortal al modelo Socio
- [x] **20.2** Crear endpoint GET /api/socio/:tokenPortal
- [x] **20.3** Crear endpoint POST /admin/socios/:id/regenerar-token
- [x] **20.4** Crear pagina /s/:tokenPortal (portal del socio)
- [x] **20.5** Mostrar QR con datos del socio
- [x] **20.6** Permitir descargar QR como imagen
- [x] **20.7** Crear pagina /mi-qr (acceso por DNI)
- [x] **20.8** Integrar escaner QR en portal comerciante
- [x] **20.9** Mostrar QR en ficha de socio (admin)

---

## FASE 21: Grupos Familiares
> Gestion de familias de socios

- [x] **21.1** Agregar campos titularFamiliaId y parentescoTitular al modelo Socio
- [x] **21.2** Crear endpoints para buscar titulares
- [x] **21.3** Crear endpoint para asignar/desvincular familia
- [x] **21.4** Crear endpoint para agregar miembros (como titular)
- [x] **21.5** Crear endpoint para desarmar familia
- [x] **21.6** Implementar tab Familia en ficha de socio
- [x] **21.7** UI para asignar socio a familia existente
- [x] **21.8** UI para agregar miembros siendo titular
- [x] **21.9** Mostrar badges de familia en ficha

---

## FASE 22: Actividades e Inscripciones
> Sistema de actividades deportivas

- [x] **22.1** Crear modelo Actividad (padre)
- [x] **22.2** Crear modelo CategoriaActividad (hijo con herencia de precio)
- [x] **22.3** Actualizar modelo Inscripcion
- [x] **22.4** Crear endpoints CRUD de actividades
- [x] **22.5** Crear endpoints CRUD de categorias
- [x] **22.6** Crear pagina admin/actividades (listado con categorias colapsables)
- [x] **22.7** Crear formulario de actividad
- [x] **22.8** Crear formulario de categoria
- [x] **22.9** Script de importacion de actividades desde Excel
- [x] **22.10** Script de importacion de inscripciones desde Excel
- [x] **22.11** Mostrar actividades en ficha de socio (tab)

---

## FASE 23: Reportes de Actividades
> Reportes jerarquicos de actividades

- [x] **23.1** Crear pagina /admin/reportes/actividades (tarjetas por actividad)
- [x] **23.2** Crear pagina /admin/reportes/actividades/:id (detalle con categorias)
- [x] **23.3** Mostrar categorias colapsables con inscriptos
- [x] **23.4** Buscador de inscriptos en reporte general
- [x] **23.5** Buscador de inscriptos en detalle de actividad
- [x] **23.6** Click en inscripto navega a ficha del socio

---

## FASE 24: Tablas Auxiliares / Configuracion
> Configuracion de tablas del sistema

- [x] **24.1** Crear pagina /admin/configuracion (tarjetas de tablas)
- [x] **24.2** CRUD de Cobradores
- [x] **24.3** CRUD de Tipos de Cuota
- [x] **24.4** CRUD de Periodos
- [x] **24.5** CRUD de Entrenadores (nombre, apellido, documento, telefono, email, especialidad)
- [x] **24.6** Asignar categorias desde ficha de entrenador (filtro por actividad)
- [x] **24.7** Asignar entrenadores desde reporte de actividades (en cada categoria)
- [x] **24.8** Mostrar entrenadores asignados en cada categoria del reporte

---

## FASE 25: Cuotas y Pagos - Configuracion Base
> Configuracion de conceptos y precios para el sistema de cuotas

- [x] **25.1** Crear modelo ConceptoTesoreria
- [x] **25.2** Agregar cuotaMensual y conceptoTesoreriaId a TipoSocio
- [x] **25.3** Cambiar cuotaMensual por porcentajeDescuento en CategoriaSocio
- [x] **25.4** Vincular Actividad y CategoriaActividad con ConceptoTesoreria
- [x] **25.5** Crear modelo DocumentoSocio para archivos de socios
- [x] **25.6** Crear endpoints CRUD para ConceptoTesoreria
- [x] **25.7** Actualizar endpoints de TipoSocio y CategoriaSocio
- [x] **25.8** Agregar seccion Tesoreria en TablasAuxiliares
- [x] **25.9** Actualizar formularios para nuevos campos

---

## FASE 26: Cuotas y Pagos - Generacion y Cobranza
> Sistema de generacion y cobranza de cuotas

- [x] **26.1** Crear endpoint de generacion de cuotas por periodo
- [x] **26.2** Logica: Cuota social solo para Titular y Socio Unico
- [x] **26.3** Logica: Aplicar porcentajeDescuento de CategoriaSocio
- [x] **26.4** Logica: Cuotas de actividades segun inscripciones activas
- [x] **26.5** Pantalla de periodos de cuota (crear, ver estado)
- [x] **26.6** Pantalla de cuotas con filtros y paginacion
- [x] **26.7** Registro de pagos con seleccion multiple de cuotas
- [x] **26.8** Envio automatico de recibo por email
- [x] **26.9** Menu Cuotas en sidebar del admin
- [x] **26.10** Endpoints de cuotas por socio y familia
- [ ] **26.11** Reportes de cobranza global, por cuota social y por actividades

---

## FASE 27: Entidades y Cuentas Corrientes
> Gestion de proveedores, personal y cuentas corrientes

- [ ] **27.1** Crear modelo Entidad (tipo: PROVEEDOR, PERSONAL, OTRO)
- [ ] **27.2** Crear modelo CuentaCorriente vinculado a Entidad
- [ ] **27.3** Crear modelo MovimientoCuentaCorriente (FACTURA, CREDITO, PAGO)
- [ ] **27.4** Endpoints CRUD de Entidades
- [ ] **27.5** Endpoints de movimientos de cuenta corriente
- [ ] **27.6** Endpoint de emision de pagos (egreso de caja)
- [ ] **27.7** Pagina admin/entidades (listado con saldo)
- [ ] **27.8** Ficha de entidad con cuenta corriente
- [ ] **27.9** Registrar factura/credito en cuenta corriente
- [ ] **27.10** Emitir pago desde cuenta corriente
- [ ] **27.11** Reporte de cuentas corrientes (saldos, vencimientos)

---

## FASE 28: Plan de Cuentas Contable
> Estructura contable para asociar a movimientos

- [ ] **28.1** Disenar estructura de plan de cuentas (activo, pasivo, ingresos, egresos)
- [ ] **28.2** Crear interfaz CRUD de cuentas contables (jerarquico)
- [ ] **28.3** Asociar cuentas a ConceptoTesoreria
- [ ] **28.4** Asociar cuentas a TipoSocio (cuota social)
- [ ] **28.5** Asociar cuentas a Actividad/CategoriaActividad
- [ ] **28.6** Asociar cuentas a tipos de movimiento de entidades
- [ ] **28.7** Generar asientos automaticos en pagos y cobranzas

---

## FASE 29: Presupuesto Anual
> Planificacion y control presupuestario

- [ ] **29.1** Crear modelo Presupuesto (anio, estado)
- [ ] **29.2** Crear modelo LineaPresupuesto (cuentaContableId, mes, montoPresupuestado)
- [ ] **29.3** Pantalla de creacion de presupuesto anual
- [ ] **29.4** Carga de montos por cuenta y mes
- [ ] **29.5** Calculo automatico de ejecucion (real vs presupuestado)
- [ ] **29.6** Dashboard de control presupuestario
- [ ] **29.7** Alertas de desvios significativos
- [ ] **29.8** Reporte comparativo mensual y acumulado

---

## FASE 30: Control de Accesos
> Sistema de control de acceso con molinetes

- [ ] **30.1** Investigar dispositivos/lectores de molinetes compatibles
- [ ] **30.2** Crear modelo DispositivoAcceso (tipo, ubicacion, ip, estado)
- [ ] **30.3** Crear modelo RegistroAcceso (socioId, dispositivo, fecha, tipo: ENTRADA/SALIDA)
- [ ] **30.4** Endpoint para recibir lecturas de dispositivos
- [ ] **30.5** Validar estado de socio y cuotas al dia para permitir acceso
- [ ] **30.6** Pantalla de configuracion de dispositivos
- [ ] **30.7** Monitor en tiempo real de accesos
- [ ] **30.8** Reporte de accesos por socio/periodo
- [ ] **30.9** Alertas de accesos denegados
- [ ] **30.10** Integracion con QR de socios como metodo de identificacion

---

## Progreso General

| Fase | Descripcion | Estado |
|------|-------------|--------|
| 1 | Setup Inicial | ✅ Completado |
| 2 | Backend Base | ✅ Completado |
| 3 | Auth | ✅ Completado |
| 4 | Rubros | ✅ Completado |
| 5 | Comercios | ✅ Completado |
| 6 | Socios | ✅ Completado |
| 7 | Ventas | ✅ Completado |
| 8 | Reportes | 🔶 Parcial |
| 9 | Email | ⏳ Pendiente |
| 10 | Frontend Base | ✅ Completado |
| 11 | Registro Comercio | ✅ Completado |
| 12 | Pantalla Comerciante | ✅ Completado |
| 13 | Admin Auth | ✅ Completado |
| 14 | Admin Dashboard | ✅ Completado |
| 15 | Admin Comercios | ✅ Completado |
| 16 | Admin Socios | ✅ Completado |
| 17 | Admin Reportes | 🔶 Parcial |
| 18 | Testing | ⏳ Pendiente |
| 19 | Produccion | ✅ Completado |
| 20 | QR e Identificacion | ✅ Completado |
| 21 | Grupos Familiares | ✅ Completado |
| 22 | Actividades | ✅ Completado |
| 23 | Reportes Actividades | ✅ Completado |
| 24 | Tablas Auxiliares | ✅ Completado |
| 25 | Cuotas Config Base | ✅ Completado |
| 26 | Cuotas y Cobranza | 🔄 En Progreso |
| 27 | Entidades y Cuentas Corrientes | ⏳ Pendiente |
| 28 | Plan de Cuentas Contable | ⏳ Pendiente |
| 29 | Presupuesto Anual | ⏳ Pendiente |
| 30 | Control de Accesos | ⏳ Pendiente |

---

## Como ejecutar

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api
- **Produccion:** https://sportivo.axiomacloud.com

---

*Ultima actualizacion: Enero 2026*
