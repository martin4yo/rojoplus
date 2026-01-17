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

- [ ] **19.1** Configurar build de produccion
- [ ] **19.2** Configurar variables de entorno produccion
- [ ] **19.3** Deploy en servidor
- [ ] **19.4** Configurar Nginx
- [ ] **19.5** Configurar SSL/HTTPS
- [ ] **19.6** Crear admin inicial en produccion
- [ ] **19.7** Cargar socios iniciales

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
| 19 | Produccion | ⏳ Pendiente |

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

---

*Ultima actualizacion: Enero 2026*
