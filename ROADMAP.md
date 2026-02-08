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
- [x] **8.3** Implementar GET /admin/reportes/ventas/export ✅

---

## FASE 9: Sistema de Templates y Notificaciones
> Sistema completo de templates editables desde UI (Email y PDF)

- [x] **9.1** Configurar Nodemailer con Gmail
- [x] **9.2** Crear modelos EmailTemplate y PdfTemplate en BD
- [x] **9.3** Servicio de generación de PDFs con Puppeteer
- [x] **9.4** Servicio de envío de emails con templates de BD
- [x] **9.5** Endpoints CRUD de templates (email y PDF)
- [x] **9.6** Página admin de edición de templates de email
- [x] **9.7** Página admin de edición de templates de PDF
- [x] **9.8** Preview de templates y envío de emails de prueba
- [x] **9.9** Descarga de PDFs de prueba
- [x] **9.10** Sistema de variables dinámicas con Handlebars
- [x] **9.11** Templates predeterminados (COMPROBANTE_PAGO, PAGO_CONFIRMADO, PAGO_RECHAZADO, RECIBO, FACTURA)
- [x] **9.12** Menú jerárquico de Configuración con submenu
- [x] **9.13** Ajuste de paleta de colores (blue para email, gray para PDF)
- [x] **9.14** Limpieza de navegación redundante en ConfiguracionPagos

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
- [x] **17.5** Implementar boton exportar (ReporteComercios.jsx) ✅

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
- [x] **26.11** Reportes de cobranza global, por cuota social y por actividades
- [x] **26.12** Configuracion de dia de vencimiento de cuotas
- [x] **26.13** Switch para vencimiento en mismo mes o mes siguiente
- [x] **26.14** Sistema de recargos por mora (fijo o acumulativo)
- [x] **26.15** Calculo automatico de recargos al mostrar cuotas
- [x] **26.16** Aplicacion de recargos al registrar pago
- [x] **26.17** Planes de pago (financiacion de deuda)
- [x] **26.18** Modal de generacion de plan con preview
- [x] **26.19** Cuotas originales marcadas como FINANCIADA
- [x] **26.20** Generacion de cuotas de FINANCIACION con vencimientos sucesivos
- [x] **26.21** Filtros de periodo y estado en cobranza por socio
- [x] **26.22** Enter en buscador selecciona primer resultado
- [x] **26.23** Visualizacion de cuotas FINANCIACION con "Cuota X de N"
- [x] **26.24** Badges de estado: PAGADA, PENDIENTE, VENCIDA, FINANCIADA, ANULADA
- [x] **26.25** Cuotas de financiacion vinculadas a periodo segun fecha vencimiento

---

## FASE 27: Comercios Publicos y Geolocalizacion
> Mejoras en comercios adheridos para socios

- [x] **27.1** Agregar campos logo, latitud, longitud al modelo Comercio
- [x] **27.2** Modificar POST /comercios/registro para aceptar logo (base64) y coordenadas
- [x] **27.3** Crear funcion guardarLogo para procesar imagenes base64
- [x] **27.4** Crear endpoint GET /comercios (listado publico de comercios activos)
- [x] **27.5** Implementar calculo de distancia con formula Haversine
- [x] **27.6** Ordenar comercios por cercania cuando se envia ubicacion
- [x] **27.7** Agregar upload de logo en formulario de registro de comercio
- [x] **27.8** Agregar mapa interactivo (Leaflet) para seleccionar ubicacion
- [x] **27.9** Instalar dependencias leaflet y react-leaflet
- [x] **27.10** Configurar proxy de /uploads en Vite
- [x] **27.11** Modificar pagina /mi-qr con link a comercios adheridos
- [x] **27.12** Agregar boton "Ver comercios adheridos" en portal del socio
- [x] **27.13** Crear pagina /comercios con lista de comercios
- [x] **27.14** Implementar vista de lista y vista de mapa
- [x] **27.15** Filtro por rubro en listado de comercios
- [x] **27.16** Boton de geolocalizacion para ordenar por cercania
- [x] **27.17** Mostrar distancia en metros/km cuando hay ubicacion

---

## FASE 28: Ingresos, Egresos, Tesoreria y Stock
> Sistema contable integrado con stock de merchandising

### Modelos de Base de Datos
- [x] **28.1** Crear modelo Concepto (preclasificacion contable con switches usaEnCompras/Ventas/Tesoreria)
- [x] **28.2** Crear modelo Entidad (tipo: PROVEEDOR, CLIENTE, PERSONAL)
- [x] **28.3** Crear modelo MovimientoContable (tabla unica para facturas, pagos, cobros)
- [x] **28.4** Crear modelo ItemMovimiento (detalle de productos en facturas)
- [x] **28.5** Crear modelo TransferenciaCaja
- [x] **28.6** Crear modelo CategoriaProducto
- [x] **28.7** Crear modelo Producto
- [x] **28.8** Crear modelo ProductoVariante (stock por talle/color)
- [x] **28.9** Crear modelo ProductoFoto (multiples fotos por producto)
- [x] **28.10** Crear modelo MovimientoStock
- [x] **28.11** Actualizar Caja con relaciones a MovimientoContable y TransferenciaCaja
- [x] **28.12** Actualizar Socio con relacion a MovimientoContable (para ventas a socios)
- [x] **28.13** Migrar ConceptoTesoreria a Concepto (unificado)

### Backend - Entidades
- [x] **28.14** Endpoints CRUD de Conceptos (server/src/routes/contabilidad.js)
- [x] **28.15** Endpoints CRUD de Entidades con filtro por tipo
- [x] **28.16** Endpoint de cuenta corriente por entidad

### Backend - Tesoreria
- [x] **28.17** CRUD de Cajas (server/src/routes/tesoreria.js)
- [x] **28.18** Endpoint de Transferencias entre cajas
- [x] **28.19** Modificar cobranza de cuotas para impactar MovimientoCaja

### Backend - Stock
- [x] **28.20** Endpoints CRUD de CategoriaProducto (server/src/routes/stock.js)
- [x] **28.21** Endpoints CRUD de Producto con variantes y fotos
- [x] **28.22** Endpoints de MovimientoStock (ingreso, egreso, ajuste)
- [x] **28.23** Endpoint de alertas de stock bajo

### Backend - Dashboard CashFlow
- [x] **28.23a** Panel CashFlow profesional con KPIs (Liquidez, Cash Flow Neto, Índice Cobranza, Días Cobertura)
- [x] **28.23b** Gráficos con recharts (BarChart evolución, PieChart composición, AreaChart tendencia)
- [x] **28.23c** 4 Tabs: General, Flujo de Caja, Cobranza, Cuentas
- [x] **28.23d** Tarjetas de saldo: Efectivo, Bancos, Tarjetas Pendientes Conciliación
- [x] **28.23e** Modelo ECheq para cheques electrónicos (EMITIDO/RECIBIDO)
- [x] **28.23f** Cards eCheqs Recibidos (En Cartera, Depositados) y eCheqs Emitidos (Pendientes débito)
- [x] **28.23g** Layout 5 columnas en Flujo de Caja (responsive)

### Backend - Movimientos Contables
- [x] **28.24** Endpoint crear MovimientoContable (server/src/routes/movimientosContables.js)
- [x] **28.25** Logica de impacto en stock al crear factura con items
- [x] **28.26** Logica de impacto en caja al registrar pago/cobro
- [x] **28.27** Endpoint de anulacion de movimientos

### Backend - Ordenes de Compra (Proveedores)
- [x] **28.28a** Crear modelo OrdenCompra y ItemOrdenCompra
- [x] **28.28b** Endpoints CRUD de OrdenCompra (server/src/routes/contabilidad.js)
- [x] **28.28c** Endpoint recibir mercadería (actualiza stock)
- [x] **28.28d** Endpoint cancelar orden de compra

### Backend - Pedidos (Clientes)
- [x] **28.28e** Crear modelo Pedido y ItemPedido
- [x] **28.28f** Endpoints CRUD de Pedido para Clientes y Socios
- [x] **28.28g** Endpoint cancelar pedido
- [x] **28.28h** Vincular Pedido con Factura de Venta

### Backend - Liquidacion de Sueldos (Personal)
- [x] **28.28i** Crear modelo LiquidacionSueldo y ItemLiquidacion
- [x] **28.28j** Crear modelo ConceptoLiquidacion (HABER/DEDUCCION)
- [x] **28.28k** Endpoint de generacion de liquidacion mensual
- [x] **28.28l** Endpoint de agregar/editar items por empleado
- [x] **28.28m** Endpoint de pago individual (impacta caja)
- [x] **28.28n** Endpoint de pago masivo (pagar-todos)

### Frontend - Menu y Navegacion
- [x] **28.28** Menu expandible con submenus (Ingresos, Egresos, Tesoreria, Stock)
- [x] **28.29** Agregar todas las rutas nuevas a App.jsx (con PlaceholderPage temporal)

### Frontend - Entidades
- [x] **28.30** Pagina /admin/egresos/proveedores (lista)
- [x] **28.31** Pagina /admin/ingresos/clientes (lista)
- [x] **28.32** Pagina /admin/egresos/personal (lista)
- [x] **28.33** Formulario de Entidad (campos condicionales por tipo)
- [x] **28.34** Ficha de entidad con cuenta corriente

### Frontend - Tesoreria
- [x] **28.35** Pagina /admin/tesoreria/cajas (lista)
- [x] **28.36** Formulario de Caja
- [x] **28.37** Pagina /admin/tesoreria/movimientos (lista de MovimientoCaja)
- [x] **28.38** Pagina /admin/tesoreria/transferencias

### Frontend - Stock
- [x] **28.39** Pagina /admin/stock/productos (lista con stock total + vista dual Shop/Lista)
- [x] **28.40** Formulario de Producto con variantes y fotos
- [x] **28.41** Pagina /admin/stock/categorias
- [x] **28.42** Pagina /admin/stock/movimientos
- [x] **28.43** Pagina /admin/stock/alertas

### Frontend - Facturas y Pagos
- [x] **28.44** Pagina /admin/egresos/facturas (FacturasCompraLista.jsx)
- [x] **28.45** Formulario de factura de compra con items (FacturaCompraForm.jsx)
- [x] **28.46** Pagina /admin/ingresos/facturas (FacturasVentaLista.jsx)
- [x] **28.47** Formulario de factura de venta a socio o cliente (FacturaVentaForm.jsx)
- [x] **28.48** Pagina /admin/egresos/ordenes-pago (OrdenesPagoLista.jsx)
- [x] **28.49** Formulario de orden de pago (OrdenPagoForm.jsx)

### Frontend - Ordenes de Compra (Proveedores)
- [x] **28.50** Pagina /admin/egresos/ordenes-compra (OrdenesCompraLista.jsx)
- [x] **28.51** Formulario de orden de compra con items (OrdenCompraForm.jsx)
- [x] **28.52** Detalle de orden de compra (OrdenCompraDetalle.jsx)

### Frontend - Pedidos (Clientes)
- [x] **28.53** Pagina /admin/ingresos/pedidos (PedidosLista.jsx)
- [x] **28.54** Formulario de pedido cliente o socio (PedidoForm.jsx)
- [x] **28.55** Detalle de pedido (PedidoDetalle.jsx)

### Frontend - Liquidacion de Sueldos (Personal)
- [x] **28.56** Pagina /admin/egresos/liquidaciones (LiquidacionesLista.jsx)
- [x] **28.57** Formulario de generacion de liquidacion mensual (LiquidacionForm.jsx)
- [x] **28.58** Detalle con items por empleado (LiquidacionDetalle.jsx)
- [x] **28.59** CRUD de conceptos de liquidación (ConceptosLiquidacion.jsx)

---

## FASE 29: Plan de Cuentas Contable
> Estructura contable para asociar a movimientos

- [x] **29.1** Diseñar estructura de plan de cuentas (modelo CuentaContable con jerarquía)
- [x] **29.2** CRUD de cuentas contables jerárquico (PlanCuentasLista.jsx + CuentaContableForm.jsx)
- [x] **29.3** Asociar cuentas a ConceptoTesoreria (campo cuentaContableId)
- [x] **29.4** Asociar cuentas a TipoSocio (via ConceptoTesoreria)
- [x] **29.5** Asociar cuentas a Actividad/CategoriaActividad (via ConceptoTesoreria)
- [x] **29.6** Selector de cuenta en modal de Concepto (ConceptoModal.jsx con flat=true)
- [x] **29.7** Crear modelo Asiento y AsientoLinea (partida doble)
- [x] **29.8** Endpoints CRUD de Asientos (asientos.js con rutas específicas antes de /:id)
- [x] **29.9** Generar asientos automáticos en pagos y cobranzas
- [x] **29.10** Libro Diario (AsientosLista.jsx + AsientoForm.jsx + AsientoDetalle.jsx)
- [x] **29.11** Libro Mayor (LibroMayor.jsx - movimientos por cuenta con saldos)
- [x] **29.12** Plan de Cuentas como Balance (columnas Debe, Haber, Saldo con totales al pie)
- [x] **29.13** Indicador D/H según naturaleza de cuenta (Deudoras: ACTIVO/EGRESO, Acreedoras: PASIVO/PATRIMONIO/INGRESO)
- [x] **29.14** Cuentas agrupadoras con importes en negrita
- [x] **29.15** Saldos visibles en panel de cuentas del Libro Mayor
- [x] **29.16** Usar Modal personalizado en lugar de alert/confirm estándar

---

## FASE 30: Presupuesto Anual
> Planificacion y control presupuestario

- [x] **30.1** Crear modelo Presupuesto (anio, estado)
- [x] **30.2** Crear modelo LineaPresupuesto (cuentaContableId, mes, montoPresupuestado)
- [x] **30.3** Pantalla de creacion de presupuesto anual
- [x] **30.4** Carga de montos por cuenta y mes
- [x] **30.5** Calculo automatico de ejecucion (real vs presupuestado)
- [x] **30.6** Dashboard de control presupuestario
- [x] **30.7** Alertas de desvios significativos
- [x] **30.8** Reporte comparativo mensual y acumulado

---

## FASE 31: Control de Accesos
> Sistema de control de acceso con molinetes

- [ ] **31.1** Investigar dispositivos/lectores de molinetes compatibles
- [ ] **31.2** Crear modelo DispositivoAcceso (tipo, ubicacion, ip, estado)
- [ ] **31.3** Crear modelo RegistroAcceso (socioId, dispositivo, fecha, tipo: ENTRADA/SALIDA)
- [ ] **31.4** Endpoint para recibir lecturas de dispositivos
- [ ] **31.5** Validar estado de socio y cuotas al dia para permitir acceso
- [ ] **31.6** Pantalla de configuracion de dispositivos
- [ ] **31.7** Monitor en tiempo real de accesos
- [ ] **31.8** Reporte de accesos por socio/periodo
- [ ] **31.9** Alertas de accesos denegados
- [ ] **31.10** Integracion con QR de socios como metodo de identificacion

---

## FASE 32: Centros de Costos
> Análisis de rentabilidad por área/actividad

### Concepto
Sistema de centros de costos para análisis multidimensional de ingresos y egresos por área, actividad o departamento del club (ej: Fútbol, Natación, Bar, Eventos, Administración).

### Objetivos
- **Análisis de Rentabilidad**: Conocer qué áreas/actividades generan más ingresos y cuáles generan más costos
- **Trazabilidad Contable**: Además de la cuenta contable, cada movimiento se asigna a un centro de costo
- **Reportes Gerenciales**: Balance y Estado de Resultados por centro de costo
- **Presupuesto por Centro**: Planificación y control presupuestario discriminado

### Implementación

#### Backend - Modelo y Lógica
- [x] **32.1** Crear modelo CentroCosto (codigo, nombre, descripcion, tipo: OPERATIVO/ADMINISTRATIVO, activo)
- [x] **32.2** Agregar centroCostoId a MovimientoCaja (nullable)
- [x] **32.3** Agregar centroCostoId a MovimientoContable (nullable)
- [x] **32.4** Agregar centroCostoId a AsientoLinea (nullable)
- [x] **32.5** Agregar centroCostoId a ItemMovimiento (permite múltiples centros en un mismo comprobante)
- [x] **32.6** Vincular Actividad con CentroCosto (actividades deportivas = centros operativos)
- [x] **32.7** Endpoints CRUD de CentroCosto
- [x] **32.8** Endpoint de reporte por centro de costo (ingresos, egresos, resultado)
- [x] **32.9** Endpoint de reporte comparativo de todos los centros
- [x] **32.10** Modificar lógica de cobranza de cuotas para asignar centro según actividad
- [x] **32.11** Agregar centro de costo en generación de asientos automáticos (todas las operaciones)
- [x] **32.12** Agregar centroCostoId a ItemMovimiento (permite múltiples centros por comprobante)

#### Frontend - UI y Reportes
- [x] **32.13** Página /admin/configuracion/centros-costo (CentrosCostoLista.jsx)
- [x] **32.14** Formulario de centro de costo (CentroCostoForm.jsx)
- [x] **32.15** Componente selector CentroCostoSelector.jsx (reutilizable)
- [x] **32.16** Reporte Estado de Resultados por Centro de Costo con filtros de fecha
- [x] **32.17** Dashboard con KPIs por centro (top 5 ingresos, top 5 egresos)
- [x] **32.18** Tabla detallada con % de participación por centro
- [x] **32.19** Rutas agregadas en App.jsx
- [x] **32.20** Agregar selector en MovimientoCajaForm (Facturas e Items pendiente)

#### Casos de Uso
- Cuota de Fútbol → Centro "Fútbol"
- Cuota de Natación → Centro "Natación"
- Gasto de luz del club → Centro "Administración"
- Venta de merchandising → Centro "Comercial"
- Sueldo de entrenador de básquet → Centro "Básquet"

---

## FASE 34: Portal del Socio Completo
> Portal moderno y completo para autogestión del socio

### Concepto
Portal responsive y mobile-first donde el socio puede gestionar toda su información, ver y pagar cuotas, inscribirse en actividades, ver horarios, comunicarse con entrenadores y acceder a su QR para descuentos.

### Objetivos
- **Autogestión Total**: El socio maneja su información sin depender del club
- **Acceso Seguro**: Sistema Magic Link (sin contraseñas)
- **Pagos Online**: Integración con MercadoPago y MODO
- **Comunicación Directa**: Chat con entrenadores de sus actividades
- **UX Moderna**: Diseño mobile-first con mejores prácticas 2026

### Implementación

#### Backend - API y Autenticación
- [x] **34.1** Endpoint POST /socio/enviar-link-acceso (Magic Link por email/DNI)
- [x] **34.2** Servicio de generación de tokens temporales (24hs)
- [x] **34.3** Endpoint GET /socio/validar-token/:token + GET /socio/:token (validar y obtener datos del socio)
- [x] **34.4** Endpoint GET /socio/:token/estado-cuenta (resumen de cuotas y actividades)
- [x] **34.5** Endpoint GET /socio/:token/proximos-eventos (entrenamientos, partidos) - *Devuelve array vacío, se llenará con FASE 33*
- [x] **34.6** Endpoint GET /socio/:token/inscripciones (actividades del socio)
- [x] **34.7** Endpoint GET /socio/:token/actividades-disponibles
- [x] **34.8** Endpoint POST /socio/:token/inscripciones (inscribirse en actividad)
- [x] **34.9** Endpoint POST /socio/:token/inscripciones/:id/baja
- [x] **34.10** Endpoint GET /socio/:token/cuotas/pendientes
- [x] **34.11** Endpoint POST /socio/:token/cuotas/:id/generar-link-pago (MercadoPago/MODO)
- [x] **34.12** Endpoint POST /socio/:token/cuotas/pagar-multiples
- [x] **34.13** Endpoint GET /socio/:token/pagos/historial
- [x] **34.14** Endpoint GET /socio/:token/conversaciones (con entrenadores) ✅
- [x] **34.15** Endpoint GET /socio/:token/conversaciones/:id/mensajes ✅
- [x] **34.16** Endpoint POST /socio/:token/conversaciones/:id/mensajes ✅
- [x] **34.17** Endpoint PUT /socio/:token/perfil (actualizar datos personales)
- [x] **34.18** Servicio de emails para Magic Link (enviarMagicLinkSocio)

#### Frontend - UI/UX Moderno
- [x] **34.19** Componente LoginSocio.jsx con Magic Link (email/DNI)
- [x] **34.20** Componente PortalSocioNuevo.jsx (layout con bottom navigation)
- [x] **34.21** Sección DashboardSocio.jsx (resumen con cards, KPIs)
- [x] **34.22** Sección MiPerfilSocio.jsx (datos, grupo familiar, QR)
- [x] **34.23** Componente reutilizable QRSocio.jsx (con logo integrado)
- [x] **34.24** Sección MisActividadesSocio.jsx (tabs: mis actividades / disponibles)
- [x] **34.25** Sección MensajesSocio.jsx (chat estilo WhatsApp con entrenadores)
- [x] **34.26** Sección PagosSocio.jsx (cuotas pendientes, pago MercadoPago/MODO, historial)
- [x] **34.27** Integración con API endpoints (pagos, estado cuenta, actividades)
- [x] **34.28** Modals personalizados para confirmaciones y errores (reemplaza alert/confirm)
- [x] **34.29** Toast notifications para feedback (react-hot-toast en 11+ archivos) ✅
- [x] **34.30** Responsive design (Tailwind sm/md/lg breakpoints en todo el sistema) ✅
- [x] **34.31** Rutas en App.jsx (/login-socio, /portal-socio/:token)

#### Características de UX
- **Bottom Navigation**: Navegación táctil optimizada para móviles
- **Badges Dinámicos**: Notificaciones visuales (mensajes no leídos, cuotas pendientes)
- **Cards con Elevation**: Diseño material con sombras sutiles
- **Skeleton Loaders**: Feedback visual durante cargas
- **Acciones Rápidas**: Dashboard con accesos directos
- **Color Coding**: Estados visuales (verde=OK, rojo=vencido, amarillo=pendiente)
- **Micro-interacciones**: Feedback táctil en botones

#### Seguridad
- **Magic Link**: Token único temporal (24hs) sin contraseñas
- **Validación por Email**: Solo el email registrado recibe el acceso
- **Tokens Únicos**: Un token por dispositivo/sesión
- **Expiración Automática**: Links vencen automáticamente

---

## FASE 33: Gestión Deportiva
> Módulo de entrenamientos, asistencia, partidos y estadísticas (Fútbol, Básquet, Vóley)

### Modelos Base (reutiliza Actividad/CategoriaActividad/Inscripcion/Entrenador existentes)

### Etapa 33.1: Espacios Deportivos ✅
- [x] **33.1.1** Crear modelo EspacioDeportivo (codigo, nombre, tipo, capacidad, cubierto, iluminacion)
- [x] **33.1.2** Crear relación muchos-a-muchos EspacioDeportivo ↔ Actividad
- [x] **33.1.3** Migración de base de datos
- [x] **33.1.4** Endpoints CRUD de EspacioDeportivo (server/src/routes/deportes.js)
- [x] **33.1.5** Página /admin/deportes/espacios (EspaciosLista.jsx)
- [x] **33.1.6** Formulario de espacio (EspacioForm.jsx)
- [x] **33.1.7** Seed con espacios iniciales (seed-deportes.js)
- [x] **33.1.8** Crear modelo TipoEspacio (tabla configurable)
- [x] **33.1.9** Página /admin/deportes/tipos-espacio (TiposEspacioConfig.jsx)
- [x] **33.1.10** Crear modelo HorarioDisponibilidad (días y horarios por espacio)
- [x] **33.1.11** UI de horarios en EspacioForm con guardado bulk

### Etapa 33.2: Entrenamientos ✅
- [x] **33.2.1** Crear modelo Entrenamiento (categoriaActividadId, espacioId, fecha, horaInicio, horaFin, estado)
- [x] **33.2.2** Crear modelo HorarioRecurrente (templates de horarios semanales)
- [x] **33.2.3** Endpoints CRUD de Entrenamiento
- [x] **33.2.4** Endpoint generar entrenamientos desde template (semana/mes)
- [x] **33.2.5** Endpoint cancelar entrenamiento
- [x] **33.2.6** Página /admin/deportes/entrenamientos (calendario semanal/mensual)
- [x] **33.2.7** Modal de creación/edición de entrenamiento
- [x] **33.2.8** Modal de generación masiva desde horarios recurrentes
- [x] **33.2.9** Página /admin/deportes/horarios (HorariosRecurrentes.jsx)
- [x] **33.2.10** Validación de conflictos de espacio

### Etapa 33.3: Asistencia ✅
- [x] **33.3.1** Crear modelo Asistencia (entrenamientoId, socioId, estado, horaLlegada)
- [x] **33.3.2** Agregar relación Socio.asistencias
- [x] **33.3.3** Endpoint obtener lista de inscriptos para tomar asistencia
- [x] **33.3.4** Endpoint guardar asistencia masiva
- [x] **33.3.5** Página /admin/deportes/asistencia (TomaAsistencia.jsx)
- [x] **33.3.6** Lista de jugadores con estados: PRESENTE, AUSENTE, JUSTIFICADO, TARDE
- [x] **33.3.7** Acceso rápido desde calendario de entrenamientos
- [x] **33.3.8** Indicador visual de asistencia tomada/pendiente en calendario

### Etapa 33.4: Partidos y Eventos ✅
- [x] **33.4.1** Crear modelo Partido (categoriaActividadId, fecha, hora, rival, condicion, resultado)
- [x] **33.4.2** Crear modelo Convocatoria (partidoId, socioId, confirmado)
- [x] **33.4.3** Crear modelo EstadisticaPartido (goles, asistencias, tarjetas, minutos)
- [x] **33.4.4** Endpoints CRUD de Partido
- [x] **33.4.5** Endpoint crear convocatoria (lista de jugadores)
- [x] **33.4.6** Endpoint confirmar/rechazar convocatoria (jugador o padre)
- [x] **33.4.7** Endpoint cargar resultado y estadísticas
- [x] **33.4.8** Página /admin/partidos (Partidos.jsx - lista con filtros y CRUD modal)
- [x] **33.4.9** Página /admin/partidos/:id (PartidoDetalle.jsx - 3 tabs)
- [x] **33.4.10** Tab Convocatoria (lista, convocar, notificar Push/Email/WhatsApp)
- [x] **33.4.11** Tab Resultado (cargar goles local/visitante)
- [x] **33.4.12** Tab Estadísticas (tabla editable goles, asistencias, tarjetas por jugador)
- [x] **33.4.13** Endpoint notificar convocados (Push, Email, WhatsApp)
- [x] **33.4.14** Tracking de notificaciones en modelo Convocatoria

### Etapa 33.5: Reportes y Estadísticas ✅
- [x] **33.5.1** Endpoint reporte de asistencia por jugador (% asistencia)
- [x] **33.5.2** Endpoint reporte de asistencia por equipo/categoría
- [x] **33.5.3** Endpoint estadísticas de jugador (partidos, goles, etc.)
- [x] **33.5.4** Endpoint ranking (goleadores, asistencias por categoría)
- [x] **33.5.5** Página /admin/reportes/deportivos (ReportesDeportivos.jsx - 4 tabs)
- [x] **33.5.6** Tab Asistencia (resumen + detalle por socio)
- [x] **33.5.7** Tab Partidos (ganados/perdidos/empatados, goles)
- [x] **33.5.8** Tab Ranking (goleadores y asistidores con medallas)
- [x] **33.5.9** Tab Jugador (búsqueda + stats completas individual)
- [x] **33.5.10** Exportar reportes a Excel/PDF (botones Excel verde + PDF rojo)

### Etapa 33.6: Pasaje de Categoría Automático ✅
> Sistema inteligente para reasignación de jugadores según edad

**Implementación Simplificada (sin modelo PasajeCategoria extra, usa Inscripcion existente):**

#### Backend - Lógica (pasajeCategoria.js - 350+ líneas)
- [x] **33.6.1** Endpoint GET /categorias/pasaje/revisar - Calcular socios fuera de rango de edad
- [x] **33.6.2** Lógica: Fecha de referencia configurable (por defecto 1/1 próximo año)
- [x] **33.6.3** Lógica: Calcular edad de cada socio inscripto a la fecha de referencia
- [x] **33.6.4** Lógica: Comparar con edadMinima/edadMaxima de su categoría
- [x] **33.6.5** Lógica: Sugerir categoría destino de la misma actividad
- [x] **33.6.6** Lógica: Detectar socios sin categoría disponible (alertas)
- [x] **33.6.7** Endpoint POST /categorias/pasaje/ejecutar - Ejecutar pasajes seleccionados
- [x] **33.6.8** Lógica: Finalizar inscripción actual (motivoFin=PASAJE_CATEGORIA)
- [x] **33.6.9** Lógica: Crear nueva inscripción en categoría destino
- [x] **33.6.10** Lógica: Mantener exenciones, becas, federación del socio
- [x] **33.6.11** Endpoint GET /categorias/pasaje/historial - Ver pasajes ejecutados
- [x] **33.6.12** Endpoint GET /categorias/pasaje/estadisticas - KPIs por año

#### Frontend - UI (PasajeCategoria.jsx - 650 líneas)
- [x] **33.6.13** Página /admin/deportes/pasaje-categoria (3 tabs)
- [x] **33.6.14** Tab Revisar: KPIs (en rango, requieren pasaje, sin categoría)
- [x] **33.6.15** Tab Revisar: Tabla de pasajes con selección múltiple
- [x] **33.6.16** Tab Revisar: Columnas (Socio, Edad, Cat. Actual, Tipo, Cat. Destino)
- [x] **33.6.17** Tab Revisar: Indicador ASCENSO/DESCENSO
- [x] **33.6.18** Tab Revisar: Alerta de socios sin categoría disponible
- [x] **33.6.19** Tab Revisar: Botón "Ejecutar N pasajes" con confirmación
- [x] **33.6.20** Tab Historial: Lista de pasajes ejecutados
- [x] **33.6.21** Tab Estadísticas: Total por año, por actividad, por mes
- [x] **33.6.22** Filtros: Por actividad, fecha de referencia

#### Mejoras Futuras (opcional)
- [x] **33.6.23** Proceso programado (cron) para sugerir pasajes al inicio de temporada ✅
- [x] **33.6.24** Notificación automática a padres cuando su hijo cambia de categoría ✅
- [x] **33.6.25** Excepciones documentadas (marcar socio para que no se sugiera pasaje) ✅

### Etapa 33.7: Notificaciones Deportivas ✅
- [x] **33.7.1** Modelo NotificacionLog ya existente (reutilizado)
- [x] **33.7.2** Push payloads para eventos deportivos
- [x] **33.7.3** Servicio de envío (email + push) integrado
- [x] **33.7.4** Notificación automática: nuevo entrenamiento (manual desde UI) ✅
- [x] **33.7.5** Notificación automática: cancelación de entrenamiento
- [x] **33.7.6** Notificación automática: convocatoria a partido
- [x] **33.7.7** Notificación automática: recordatorio 24h antes (cron 18:00)
- [x] **33.7.8** Notificación automática: pasaje de categoría ✅
- [x] **33.7.9** Panel de configuración de notificaciones por socio ✅

### Menú y Navegación ✅
- [x] **33.8.1** Agregar submenu "Deportes" en AdminLayout
- [x] **33.8.2** Rutas: /admin/deportes/espacios
- [x] **33.8.3** Rutas: /admin/deportes/entrenamientos
- [x] **33.8.4** Rutas: /admin/deportes/horarios
- [x] **33.8.5** Rutas: /admin/deportes/asistencia/:id
- [x] **33.8.6** Rutas: /admin/deportes/pasaje-categoria
- [x] **33.8.7** Rutas: /admin/partidos (+ /admin/partidos/:id)
- [x] **33.8.8** Rutas: /admin/reportes/deportivos

---

## FASE 35: Débito Automático
> Sistema de débito automático con múltiples procesadores

### Prisma Medios de Pago ✅
- [x] **35.1** Configuración de números de establecimiento (VISA Crédito, VISA Débito, Mastercard)
- [x] **35.2** Generación de archivos TXT formato Prisma (DEBLIQC, DEBLIQD, DEBLIMC)
- [x] **35.3** Importación de respuestas (RDEBLIQC, RDEBLIQD, RDEBLIMC)
- [x] **35.4** Creación automática de pagos para débitos exitosos
- [x] **35.5** Envío de recibos por email a socios
- [x] **35.6** Mapeo de códigos de rechazo (50+ códigos)
- [x] **35.7** Reintento de rechazados
- [x] **35.8** Estadísticas y KPIs (cobrados, rechazados, tasa éxito)
- [x] **35.9** UI completa con 5 pestañas (Generar, Archivos, Importar, Estadísticas, Configuración)

### Payway ⏳
- [ ] **35.10** Configuración de credenciales Payway
- [ ] **35.11** Integración con API REST de Payway
- [ ] **35.12** Generación de débitos vía API
- [ ] **35.13** Webhook para recibir respuestas
- [ ] **35.14** Procesamiento de archivo de respuesta alternativo

### Débito Directo Bancario ⏳
- [ ] **35.15** Formato de archivo Banco Galicia
- [ ] **35.16** Formato de archivo Banco Macro
- [ ] **35.17** Formato de archivo Banco Santander
- [ ] **35.18** Formato de archivo Banco Provincia
- [ ] **35.19** Importación de respuestas por banco
- [ ] **35.20** UI para seleccionar banco en generación

---

## FASE 36: Conciliación Bancaria ✅
> Comparación de movimientos del sistema con extractos bancarios

### Importación de Extractos ✅
- [x] **36.1** Parser de archivos OFX (Open Financial Exchange)
- [x] **36.2** Parser de archivos CSV con mapeo configurable
- [x] **36.3** Parser de archivos TXT posicional (Excel pendiente XLSX)
- [x] **36.4** Modelo ExtractoBancario (cabecera del extracto)
- [x] **36.5** Modelo MovimientoExtracto (líneas del extracto)
- [x] **36.6** Modelo Conciliacion (registro de conciliaciones)
- [x] **36.7** Configuración de mapeo de columnas por banco (FormatoExtracto parametrizable)
- [x] **36.8** Modal de importación con selección de formato y cuenta

### Conciliación Automática ✅
- [x] **36.9** Match por importe exacto + misma fecha
- [x] **36.10** Match por importe exacto + fecha cercana (±5 días)
- [x] **36.11** Match por referencia (incluido en búsqueda)
- [x] **36.12** Sugerencias con nivel de confianza (ALTA/MEDIA)
- [x] **36.13** Campo `conciliado` en MovimientoCaja
- [x] **36.14** Vinculación MovimientoExtracto ↔ MovimientoCaja

### Conciliación Manual ✅
- [x] **36.15** Vista en dos columnas (Extracto vs Sistema)
- [x] **36.16** Filtros: solo pendientes, por caja
- [x] **36.17** Click para seleccionar y vincular manualmente
- [x] **36.18** Botón "Aplicar Sugerencias" para match automático masivo
- [x] **36.19** Lista de movimientos vinculados antes de confirmar

### Cierre y Reportes ✅
- [x] **36.20** Verificación saldo conciliado (KPIs en dashboard)
- [x] **36.21** Estado de extracto: IMPORTADO → EN_CONCILIACION → CONCILIADO
- [x] **36.22** Resumen por estado de extractos
- [x] **36.23** Tabla de movimientos no conciliados pendientes
- [x] **36.24** Histórico de conciliaciones con endpoint /historial

### Archivos Implementados
```
server/src/routes/conciliacionBancaria.js    # 919 líneas - Backend completo
client/src/pages/admin/tesoreria/ConciliacionBancaria.jsx   # 777 líneas
client/src/pages/admin/tesoreria/ConciliacionDetalle.jsx    # 511 líneas
```

---

## FASE 37: Sitio Institucional Público
> Mejoras y funcionalidades adicionales del sitio público

### Páginas Completadas ✅
- [x] **37.1** Home con secciones (HeroSection, Actividades, CTA, Sponsors, Noticias, Contacto)
- [x] **37.2** Actividades con grid de actividades
- [x] **37.3** Noticias con listado y filtros por categoría
- [x] **37.4** Detalle de Noticia con URL compartible (`/noticias/:slug`)
- [x] **37.5** Instalaciones con galería y modal detalle
- [x] **37.6** Historia del club
- [x] **37.7** Misión y Valores
- [x] **37.8** Autoridades (Comisión Directiva, Vocales, Revisores, Subcomisiones)
- [x] **37.9** Contacto con formulario funcional (envía email real)
- [x] **37.10** Comercios/Beneficios con mapa y geolocalización
- [x] **37.11** Inscripción de Socio (formulario público)
- [x] **37.12** Navegación con menú "Nosotros" y submenús

### Páginas Adicionales ✅
- [x] **37.13** Detalle de Actividad (`/actividades/:id`) - Página con info, categorías, horarios ✅
- [x] **37.14** Calendario de Eventos - Vista calendario con partidos y entrenamientos ✅
- [x] **37.15** Galería de Fotos - Álbumes del club (estructura preparada) ✅
- [x] **37.16** Página 404 personalizada con links útiles ✅
- [x] **37.17** Autoridades editables desde admin (CRUD completo con foto, cargo, orden)

---

## FASE 38: Usuarios, Roles y Permisos ✅
> Sistema completo de control de acceso basado en roles

### Modelos Base ✅
- [x] **38.1** Modelo Admin ya existe (id, email, nombre, password, activo, rolId)
- [x] **38.2** Modelo Rol ya existe (id, codigo, nombre, descripcion, esSuperAdmin)
- [x] **38.3** Modelo Permiso ya existe (id, codigo, nombre, modulo)
- [x] **38.4** Modelo PermisoRol ya existe (relación muchos-a-muchos)
- [x] **38.5** Relación Admin -> Rol (rolId en Admin)

### Backend - Endpoints ✅
- [x] **38.6** CRUD de Admins/Usuarios (crear, editar, activar/desactivar, cambiar password)
- [x] **38.7** CRUD de Roles (con permisos asignados)
- [x] **38.8** Asignar permisos a roles (en creación/edición de rol)
- [x] **38.9** Asignar rol a usuario (en creación/edición de usuario)
- [x] **38.10** Middleware checkPermiso() con cache de 5 minutos
- [x] **38.11** Endpoint GET /mis-permisos (permisos del usuario logueado)
- [x] **38.12** Seed con 30+ permisos por módulo del sistema
- [x] **38.13** Función invalidarCachePermisos() al modificar roles

### Frontend - UI ✅
- [x] **38.14** Página /admin/configuracion/usuarios (UsuariosLista.jsx)
- [x] **38.15** Formulario de usuario (UsuarioForm.jsx)
- [x] **38.16** Página /admin/configuracion/roles (RolesLista.jsx)
- [x] **38.17** Formulario de rol con checkboxes de permisos (RolForm.jsx)
- [x] **38.18** Servicio permisos.js (tienePermiso, tieneAlgunPermiso, esAdmin)
- [x] **38.19** Protección de rutas/botones según permisos del usuario logueado ✅
- [x] **38.20** Mi Perfil: cambiar contraseña ✅

### Permisos Implementados (30+ códigos)
```
SOCIOS: VER, CREAR, EDITAR, ELIMINAR
INSCRIPCIONES: VER, GESTIONAR
ACTIVIDADES: VER, GESTIONAR
DEPORTES: VER, PARTIDOS, ENTRENAMIENTOS, PASAJE
CUOTAS: VER, GENERAR, BONIFICAR, DEBITO_AUTOMATICO
TESORERIA: CAJA_VER, CAJA_COBRAR, CAJA_MOVIMIENTOS, CAJA_ANULAR, CAJA_CIERRE
CONTABILIDAD: VER, ASIENTOS, PRESUPUESTO
STOCK: VER, GESTIONAR
INGRESOS: VER, GESTIONAR
EGRESOS: VER, GESTIONAR
SUELDOS: VER, GESTIONAR
REPORTES: VER, EXPORTAR
CONTENIDO: VER, GESTIONAR
CONFIG: VER, EDITAR
SISTEMA: USUARIOS_GESTIONAR, COMERCIOS_GESTIONAR
```

---

## FASE 39: Módulo Buffet/Restaurant (MVP)
> Sistema de gestión de buffet, kiosco y take away del club

### Concepto General
MVP del módulo buffet con funcionalidades esenciales:
- **Mesas y Comandas**: Gestión de mesas, toma de pedidos, cobro
- **Cocina (KDS)**: Pantalla de preparación para cocineros
- **Kiosco**: Venta rápida sin mesa
- **Take Away**: Pedidos para llevar

### Integraciones con RojoPlus

#### Menú en Sidebar (AdminLayout.jsx)
- Submenú "Buffet" integrado en el sidebar existente
- NO es una aplicación separada, usa el mismo layout admin
- Acceso controlado por permisos del sistema

#### Permisos (Sistema existente Fase 38)
- Los permisos de Buffet se agregan a `seed.js` junto con los demás
- El frontend usa `tienePermiso()` de `permisos.js` existente
- Permisos: BUFFET_VER, BUFFET_MESAS, BUFFET_COBRAR, BUFFET_COCINA, BUFFET_KIOSCO

#### Tesorería y Cobranza (INTEGRADO 100%)
- **NO** se crea CajaBuffet separada - se usa `Caja` existente
- Cobros generan `MovimientoCaja` en la caja del club
- Usa `MedioPago` existentes (Efectivo, Tarjeta, QR, etc.)
- Centro de costo BUFFET para análisis separado

#### Stock (Sistema existente - NO duplicar productos)
- Los productos del buffet se dan de alta en el módulo Stock existente
- Agregar campo `esParaBuffet` (boolean) al modelo Producto existente
- **Usuario con permiso BUFFET solo ve productos con esParaBuffet=true**

---

### Etapa 39.1: Configuración y Setup
> Modelos, productos, mesas, impresoras y permisos

#### Modelos Prisma
- [ ] **39.1.1** Modelo `Mesa` (numero, capacidad, estado, activo)
  - Estados: LIBRE, OCUPADA, CUENTA_PEDIDA, LIMPIEZA
- [ ] **39.1.2** Modelo `CategoriaMenu` (codigo, nombre, orden, color, activo)
  - Categorías: BEBIDAS, COMIDAS, POSTRES, SNACKS
- [ ] **39.1.3** Modelo `Comanda` (numero, mesaId, socioId?, estado, horaApertura, horaCierre, total)
  - Estados: ABIERTA, EN_PREPARACION, CUENTA_PEDIDA, CERRADA, ANULADA
- [ ] **39.1.4** Modelo `ItemComanda` (comandaId, productoId, cantidad, precioUnitario, estado, observaciones)
  - Estados: PENDIENTE, ENVIADO_COCINA, EN_PREPARACION, LISTO, ENTREGADO
- [ ] **39.1.5** Modelo `PedidoTakeAway` (numero, nombreCliente, telefono, estado, horaEstimada, total)
  - Estados: RECIBIDO, EN_PREPARACION, LISTO, ENTREGADO, CANCELADO
- [ ] **39.1.6** Modelo `ItemPedidoTakeAway` (pedidoId, productoId, cantidad, precioUnitario, observaciones)
- [ ] **39.1.7** Modelo `ImpresoraTermica` (nombre, tipo, ip, puerto, activo)
  - Tipos: COCINA, BARRA, CAJA
- [ ] **39.1.8** Modelo `DestinoImpresion` (categoriaMenuId, impresoraId)
- [ ] **39.1.9** Migración Prisma

#### Modificaciones a modelos existentes
- [ ] **39.1.10** Agregar campo `esParaBuffet` a modelo `Producto` (boolean, default false)
- [ ] **39.1.11** Agregar campo `comandaId` a modelo `MovimientoCaja` (nullable)
- [ ] **39.1.12** Agregar campo `pedidoTakeAwayId` a modelo `MovimientoCaja` (nullable)

#### Backend - Endpoints Base
- [ ] **39.1.13** Endpoints CRUD de `Mesa`
- [ ] **39.1.14** Endpoints CRUD de `CategoriaMenu`
- [ ] **39.1.15** Endpoint GET productos buffet (filtro esParaBuffet=true)
- [ ] **39.1.16** Endpoints CRUD de `ImpresoraTermica`
- [ ] **39.1.17** Endpoints CRUD de `DestinoImpresion`
- [ ] **39.1.18** Endpoint test conexión impresora
- [ ] **39.1.19** Servicio impresión ESC/POS básico

#### Frontend - Configuración
- [ ] **39.1.20** Menú "Buffet" en AdminLayout.jsx
- [ ] **39.1.21** Página `/admin/buffet/mesas` (MesasLista.jsx)
- [ ] **39.1.22** Página `/admin/buffet/categorias` (CategoriasMenu.jsx)
- [ ] **39.1.23** Página `/admin/buffet/productos` (ProductosBuffet.jsx) - filtro esParaBuffet
- [ ] **39.1.24** Página `/admin/buffet/impresoras` (ImpresorasLista.jsx)
- [ ] **39.1.25** Página `/admin/buffet/destinos-impresion` (DestinosImpresion.jsx)

#### Permisos (seed.js)
- [ ] **39.1.26** Agregar permisos: BUFFET_VER, BUFFET_MESAS, BUFFET_COBRAR, BUFFET_COCINA, BUFFET_KIOSCO
- [ ] **39.1.27** Agregar constantes a permisos.js del frontend

---

### Etapa 39.2: Operación
> Flujos de venta: Mesas, Take Away, Kiosco y Cocina (KDS)

#### Backend - Comandas (Mesas)
- [ ] **39.2.1** Endpoint POST `/buffet/comandas` - Abrir comanda en mesa
- [ ] **39.2.2** Endpoint GET `/buffet/comandas/:id` - Detalle comanda
- [ ] **39.2.3** Endpoint POST `/buffet/comandas/:id/items` - Agregar items
- [ ] **39.2.4** Endpoint PUT `/buffet/comandas/:id/items/:itemId` - Modificar item
- [ ] **39.2.5** Endpoint DELETE `/buffet/comandas/:id/items/:itemId` - Anular item
- [ ] **39.2.6** Endpoint POST `/buffet/comandas/:id/enviar-cocina` - Enviar a cocina + imprimir
- [ ] **39.2.7** Endpoint POST `/buffet/comandas/:id/cobrar` - Cobrar (genera MovimientoCaja)
- [ ] **39.2.8** Endpoint POST `/buffet/comandas/:id/cerrar` - Cerrar mesa

#### Backend - Take Away
- [ ] **39.2.9** Endpoint POST `/buffet/takeaway` - Crear pedido
- [ ] **39.2.10** Endpoint GET `/buffet/takeaway` - Listar pendientes
- [ ] **39.2.11** Endpoint POST `/buffet/takeaway/:id/items` - Agregar items
- [ ] **39.2.12** Endpoint POST `/buffet/takeaway/:id/enviar-cocina` - Enviar a cocina + imprimir
- [ ] **39.2.13** Endpoint PUT `/buffet/takeaway/:id/listo` - Marcar listo
- [ ] **39.2.14** Endpoint POST `/buffet/takeaway/:id/cobrar` - Cobrar y entregar

#### Backend - Kiosco (Venta Rápida)
- [ ] **39.2.15** Endpoint POST `/buffet/kiosco/venta` - Venta directa sin mesa
  - Recibe: items[], medioPagoId, socioId?
  - Genera: MovimientoCaja + imprime ticket

#### Backend - Cocina (KDS)
- [ ] **39.2.16** Endpoint GET `/buffet/cocina/pendientes` - Items pendientes de preparación
- [ ] **39.2.17** Endpoint PUT `/buffet/cocina/items/:id/preparando` - Marcar en preparación
- [ ] **39.2.18** Endpoint PUT `/buffet/cocina/items/:id/listo` - Marcar listo
- [ ] **39.2.19** WebSocket o polling para actualizaciones en tiempo real

#### Backend - Dashboard
- [ ] **39.2.20** Endpoint GET `/buffet/dashboard` - KPIs (mesas ocupadas, comandas activas, ventas día)
- [ ] **39.2.21** Endpoint GET `/buffet/mesas/estado` - Estado de todas las mesas

#### Frontend - Operación Mesas
- [ ] **39.2.22** Página `/admin/buffet` - Dashboard con estado de mesas
- [ ] **39.2.23** Componente `MesaCard` - Click abre comanda
- [ ] **39.2.24** Página `/admin/buffet/comanda/:id` - Toma de pedido
  - Grid de categorías y productos
  - Carrito con items agregados
  - Botones: Enviar a cocina, Ver cuenta, Cobrar
- [ ] **39.2.25** Modal de cobro (selección medio de pago)

#### Frontend - Take Away
- [ ] **39.2.26** Página `/admin/buffet/takeaway` - Lista de pedidos pendientes
- [ ] **39.2.27** Modal nuevo pedido (nombre, teléfono, items)
- [ ] **39.2.28** Acciones: Enviar cocina, Marcar listo, Cobrar

#### Frontend - Kiosco
- [ ] **39.2.29** Página `/admin/buffet/kiosco` - Venta rápida
  - Grid de productos (solo SNACKS, BEBIDAS)
  - Carrito simple
  - Botón "Cobrar" directo

#### Frontend - Cocina (KDS)
- [ ] **39.2.30** Página `/admin/buffet/cocina` - Pantalla para cocina
  - Cards de items pendientes ordenados por tiempo
  - Colores por estado (nuevo=rojo, preparando=amarillo)
  - Click para marcar estado
  - Actualización automática (polling 10s o WebSocket)

#### Frontend - Menú Público
- [ ] **39.2.31** Página `/buffet/menu` - Menú público (sin login)
  - Grid de productos con foto, nombre, descripción, precio
  - Filtro por categoría
  - Solo visualización (sin compra online en MVP)

#### Rutas App.jsx
- [ ] **39.2.32** Agregar rutas: /admin/buffet/*, /buffet/menu

---

### Fases Futuras (Post-MVP)
> Funcionalidades a agregar después de validar el MVP

- Reservas de mesas
- Turnos de mozos
- Pedidos online (socios y público)
- Promociones, Happy Hour, Combos
- Delivery con repartidores
- Menú digital QR (pedir desde la mesa)
- Recetas e ingredientes (descuento automático de stock)
- Variantes y modificadores de productos
- Reportes y analytics avanzados
- PWA y modo offline
- Eventos y catering
- Propinas y split de cuentas
- Feedback y encuestas

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
| 9 | Templates y Notificaciones | ✅ Completado |
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
| 26 | Cuotas y Cobranza | ✅ Completado |
| 27 | Comercios Publicos y Geolocalizacion | ✅ Completado |
| 28 | Ingresos, Egresos, Tesoreria y Stock | ✅ Completado |
| 29 | Plan de Cuentas Contable | ✅ Completado |
| 30 | Presupuesto Anual | ✅ Completado |
| 31 | Control de Accesos | ⏳ Pendiente |
| 32 | Centros de Costos | ⏳ Pendiente |
| 33 | Gestión Deportiva | 🔄 En Progreso |
| 34 | Portal del Socio | 🔶 Parcial |
| 35 | Débito Automático | 🔶 Parcial (Prisma ✅) |
| 36 | Conciliación Bancaria | ✅ Completado |
| 37 | Sitio Institucional Público | 🔶 Parcial |
| 38 | Usuarios, Roles y Permisos | ✅ Completado |
| 39 | Módulo Buffet/Restaurant | ⏳ Pendiente |

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

*Ultima actualizacion: 7 de Febrero 2026 - FASE 39 (Módulo Buffet/Restaurant) simplificada a MVP con 2 etapas*
*MVP incluye: Mesas/Comandas, Take Away, Kiosco, Cocina (KDS), Impresoras Térmicas, Menú Público*
