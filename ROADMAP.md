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
- [ ] **33.7.9** Panel de configuración de notificaciones por socio (futuro)

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

## FASE 39: Módulo Buffet/Restaurant
> Sistema completo de gestión de buffet, restaurant, bar y kiosco del club

### Concepto General
Sistema integral para la operación del buffet del club que incluye:
- **Restaurant/Buffet**: Gestión de mesas, comandas, mozos
- **Bar/Mostrador**: Venta de bebidas con despacho rápido
- **Cocina**: Pantalla de preparación (KDS)
- **Kiosco**: Venta rápida de golosinas y productos
- **Take Away**: Pedidos para llevar

### Integraciones con RojoPlus (CRÍTICO)

#### Menú en Sidebar (AdminLayout.jsx)
- Submenú "Buffet" integrado en el sidebar existente (igual que Deportes, Ingresos, Egresos)
- NO es una aplicación separada, usa el mismo layout admin
- Acceso controlado por permisos del sistema

#### Permisos (Sistema existente Fase 38)
- Los permisos de Buffet se agregan a `seed.js` junto con los demás
- Se crean en tabla `Permiso` existente
- Se asignan a roles mediante `PermisoRol` existente
- El frontend usa `tienePermiso()` de `permisos.js` existente
- Protección de rutas/botones igual que el resto del sistema

#### Tesorería y Cobranza (INTEGRADO 100%)
- **NO** se crea CajaBuffet separada - se usa `Caja` existente
- Cobros generan `MovimientoCaja` en la caja del club
- Usa `MedioPago` existentes (Efectivo, Tarjeta, QR, etc.)
- Genera `Asiento` contable automático igual que otros cobros
- Centro de costo BUFFET para análisis separado
- El arqueo y cierre de caja es el mismo del sistema

#### Stock (Sistema existente - NO duplicar productos)
- Los productos del buffet se dan de alta en el módulo Stock existente
- Agregar campo `esParaBuffet` (boolean) al modelo Producto existente
- Agregar campo `esIngrediente` (boolean) para insumos de cocina
- **Usuario con permiso BUFFET solo ve productos con esParaBuffet=true**
- Usuario con permiso STOCK_VER ve todos los productos
- El CRUD de productos se reutiliza, solo cambia el filtro
- ProductoMenu es solo metadata adicional (categoría menú, variantes, modificadores)
- Descuento automático de ingredientes usa MovimientoStock existente

#### Otras Integraciones
- **Socios**: QR para identificación, descuentos, cuenta corriente
- **Personal**: Mozos vinculados a entidades tipo PERSONAL

---

### Etapa 39.1: Modelos de Datos Base
> Estructura de base de datos para el módulo buffet

#### Modelos Principales
- [ ] **39.1.1** Modelo `ZonaBuffet` (codigo, nombre, descripcion, activo)
  - Zonas: SALON, TERRAZA, VIP, BARRA, KIOSCO
- [ ] **39.1.2** Modelo `Mesa` (numero, zona, capacidad, posX, posY, estado, activo)
  - Estados: LIBRE, OCUPADA, RESERVADA, CUENTA_PEDIDA, LIMPIEZA, FUERA_SERVICIO
- [ ] **39.1.3** Modelo `CategoriaMenu` (codigo, nombre, orden, color, icono, activo)
  - Categorías: BEBIDAS, COMIDAS, POSTRES, CAFETERIA, SNACKS, COMBOS
- [ ] **39.1.4** Modelo `ProductoMenu` (codigo, nombre, descripcion, categoriaId, precio, precioSocio, tiempoPreparacion, foto, disponible, activo)
- [ ] **39.1.5** Modelo `VarianteProducto` (productoMenuId, nombre, precioExtra)
  - Ej: Cerveza → Pinta (+$0), Litro (+$500)
- [ ] **39.1.6** Modelo `ModificadorProducto` (productoMenuId, nombre, precioExtra, esGratis)
  - Ej: Sin hielo, Extra queso, Término medio
- [ ] **39.1.7** Modelo `RecetaIngrediente` (productoMenuId, productoStockId, cantidad, unidad)
  - Vincula producto del menú con productos del stock para descuento automático

#### Modelos de Impresión
- [ ] **39.1.8** Modelo `ImpresoraTermica` (codigo, nombre, tipo, ip, puerto, activo)
  - Tipos: COCINA, BARRA, CAJA, KIOSCO
- [ ] **39.1.9** Modelo `DestinoImpresion` (categoriaMenuId, impresoraId, copias)
  - Define qué categorías se imprimen en qué impresora
  - Ej: BEBIDAS → Impresora BARRA, COMIDAS → Impresora COCINA

#### Modelos Operativos
- [ ] **39.1.10** Modelo `TurnoBuffet` (usuarioId, fechaInicio, fechaFin, fondoInicial, totalVentas, totalPropinas, estado)
  - Estados: ABIERTO, CERRADO
- [ ] **39.1.11** Modelo `Comanda` (numero, mesaId, turnoId, socioId?, cantidadComensales, estado, horaApertura, horaCierre, observaciones)
  - Estados: ABIERTA, EN_PREPARACION, SERVIDA, CUENTA_PEDIDA, CERRADA, ANULADA
- [ ] **39.1.12** Modelo `ItemComanda` (comandaId, productoMenuId, varianteId?, cantidad, precioUnitario, descuento, comensal, estado, horaEnvio, horaListo, horaEntregado, observaciones)
  - Estados: PENDIENTE, ENVIADO_COCINA, EN_PREPARACION, LISTO, ENTREGADO, ANULADO
- [ ] **39.1.13** Modelo `ModificadorItem` (itemComandaId, modificadorId, cantidad)
- [ ] **39.1.14** Modelo `PedidoTakeAway` (numero, socioId?, nombreCliente, telefono, estado, horaEstimada, horaEntrega, total, observaciones)
  - Estados: RECIBIDO, EN_PREPARACION, LISTO, ENTREGADO, CANCELADO
- [ ] **39.1.15** Modelo `ItemPedidoTakeAway` (pedidoId, productoMenuId, varianteId?, cantidad, precioUnitario, observaciones)
- [ ] **39.1.16** Modelo `ReservaBuffet` (mesaId, fecha, hora, duracionEstimada, comensales, nombreCliente, telefono, socioId?, estado, observaciones)
  - Estados: PENDIENTE, CONFIRMADA, CANCELADA, COMPLETADA, NO_SHOW
- [ ] **39.1.17** Modelo `AnulacionItem` (itemComandaId, motivo, autorizadoPor, fecha)
- [ ] **39.1.18** Modelo `CierreBuffet` (cajaId, turnoId, fecha, fondoInicial, totalVentas, totalPropinas, totalEfectivo, totalTarjeta, efectivoArqueado, diferencia, observaciones, cerradoPorId)

#### Modificaciones a modelos existentes
- [ ] **39.1.19** Agregar campo `comandaId` a modelo `MovimientoCaja` existente (nullable)
- [ ] **39.1.20** Agregar campo `pedidoTakeAwayId` a modelo `MovimientoCaja` existente (nullable)
- [ ] **39.1.21** Agregar campo `esPropina` a modelo `MovimientoCaja` existente (boolean, default false)
- [ ] **39.1.22** Agregar campo `esParaBuffet` a modelo `Producto` existente (boolean, default false)
- [ ] **39.1.23** Agregar campo `esIngrediente` a modelo `Producto` existente (boolean, default false)
- [ ] **39.1.24** Agregar tipo "BUFFET" a enum/campo tipo de `Caja` existente
- [ ] **39.1.25** Migración y relaciones Prisma

**NOTA**: Se usa Caja y MovimientoCaja existentes. Los productos del buffet se crean en Stock existente con esParaBuffet=true. El buffet tiene su caja tipo BUFFET con cierres propios (CierreBuffet).

---

### Etapa 39.2: Configuración de Impresoras y Destinos
> Sistema de impresión térmica con enrutamiento por categoría

#### Backend - Gestión de Impresoras
- [ ] **39.2.1** Endpoints CRUD de `ImpresoraTermica`
- [ ] **39.2.2** Endpoint test de conexión a impresora (ping IP)
- [ ] **39.2.3** Endpoints CRUD de `DestinoImpresion`
- [ ] **39.2.4** Endpoint obtener destinos por categoría
- [ ] **39.2.5** Servicio de impresión ESC/POS
  - Comandos básicos: texto, negrita, tamaño, corte
  - Formato ticket comanda
  - Formato ticket pre-cuenta
  - Formato ticket cobro
- [ ] **39.2.6** Servicio de envío a impresora por TCP/IP
- [ ] **39.2.7** Cola de impresión con reintentos
- [ ] **39.2.8** Endpoint imprimir comanda (separa por destino automáticamente)
- [ ] **39.2.9** Endpoint reimprimir comanda/item

#### Frontend - Configuración Impresoras
- [ ] **39.2.10** Página `/admin/buffet/configuracion/impresoras` (ImpresorasLista.jsx)
- [ ] **39.2.11** Formulario de impresora (ImpresoraForm.jsx)
  - Campos: nombre, tipo (select), IP, puerto
  - Botón "Probar conexión"
  - Botón "Imprimir prueba"
- [ ] **39.2.12** Página `/admin/buffet/configuracion/destinos-impresion` (DestinosImpresion.jsx)
  - Tabla: Categoría | Impresora destino | Copias
  - Selector de impresora por categoría
- [ ] **39.2.13** Preview de ticket antes de imprimir (opcional)

#### Lógica de Enrutamiento
```
Al enviar comanda a cocina:
1. Obtener items de la comanda
2. Agrupar items por categoría
3. Para cada categoría:
   a. Buscar destino de impresión configurado
   b. Generar ticket ESC/POS con items de esa categoría
   c. Enviar a impresora correspondiente
4. Si no hay destino configurado → usar impresora por defecto
```

---

### Etapa 39.3: Gestión de Carta/Menú
> Reutiliza CRUD de Stock existente, filtrado por esParaBuffet=true

#### Concepto Clave
- **NO** se duplica el CRUD de productos
- Los productos del buffet son Productos normales del Stock con `esParaBuffet=true`
- La persona del buffet accede a la página de productos existente **filtrada**
- Solo necesitan modelos adicionales para categorías del menú, variantes y modificadores

#### Backend - Productos Buffet (reutiliza stock.js)
- [ ] **39.3.1** Agregar filtro `?esParaBuffet=true` a endpoint GET /productos existente
- [ ] **39.3.2** Al crear producto desde buffet, setear `esParaBuffet=true` automáticamente
- [ ] **39.3.3** Endpoints CRUD de `CategoriaMenu` (categorías del menú, no del stock)
- [ ] **39.3.4** Endpoint reordenar categorías (drag & drop)
- [ ] **39.3.5** Endpoints CRUD de `VarianteProductoMenu` (tamaños: pinta, litro, etc.)
- [ ] **39.3.6** Endpoints CRUD de `ModificadorProducto` (sin sal, extra queso, etc.)
- [ ] **39.3.7** Endpoints CRUD de `RecetaIngrediente` (ingredientes para descuento stock)
- [ ] **39.3.8** Endpoint toggle disponibilidad producto (agotado/disponible)
- [ ] **39.3.9** Endpoint obtener carta completa organizada por categoría (para app mozo)
- [ ] **39.3.10** Endpoint buscar productos buffet (autocomplete)
- [ ] **39.3.11** Endpoint productos más vendidos (favoritos)

#### Frontend - Administración Carta
- [ ] **39.3.12** Página `/admin/buffet/productos` (ProductosBuffet.jsx)
  - **Reutiliza componentes de Stock** pero con filtro esParaBuffet=true
  - Solo muestra productos del buffet
  - Botón "Nuevo Producto" crea con esParaBuffet=true
- [ ] **39.3.13** Página `/admin/buffet/carta` (CartaLista.jsx)
  - Organiza productos por categorías del menú
  - Drag & drop para reordenar en cada categoría
  - Asignar productos a categorías
  - Vista similar a un menú real
- [ ] **39.3.14** Formulario de categoría menú (CategoriaMenuForm.jsx)
  - Campos: código, nombre, color, icono, orden
- [ ] **39.3.15** Modal asignar producto a categoría
  - Selector de producto (filtrado buffet)
  - Precio de venta (puede diferir del precio stock)
  - Precio socio
  - Tiempo de preparación
- [ ] **39.3.16** Tab variantes en producto (VariantesTab.jsx)
  - Lista de variantes con precio extra
  - Agregar/editar/eliminar variantes
- [ ] **39.3.17** Tab modificadores en producto (ModificadoresTab.jsx)
  - Lista de modificadores
  - Marcar si es gratis o tiene costo
- [ ] **39.3.18** Tab receta en producto (RecetaTab.jsx)
  - Selector de productos del stock (esIngrediente=true)
  - Cantidad y unidad por ingrediente
  - Cálculo de costo estimado
- [ ] **39.3.19** Vista previa de carta (CartaPreview.jsx)
  - Como se vería en app del mozo

#### Filtrado por Permisos
- [ ] **39.3.20** Usuario con BUFFET_CARTA solo ve productos con esParaBuffet=true
- [ ] **39.3.21** Si tiene permiso STOCK_VER puede ver todos los productos
- [ ] **39.3.22** El filtro se aplica en backend según permisos del usuario

---

### Etapa 39.4: Gestión de Mesas y Zonas
> Layout visual del salón con mesas arrastrables

#### Backend - Mesas
- [ ] **39.4.1** Endpoints CRUD de `ZonaBuffet`
- [ ] **39.4.2** Endpoints CRUD de `Mesa`
- [ ] **39.4.3** Endpoint actualizar posición mesa (posX, posY)
- [ ] **39.4.4** Endpoint cambiar estado mesa
- [ ] **39.4.5** Endpoint unir mesas (mesa principal + mesas unidas)
- [ ] **39.4.6** Endpoint separar mesas unidas
- [ ] **39.4.7** Endpoint obtener estado actual de todas las mesas
- [ ] **39.4.8** WebSocket para actualización en tiempo real de estados

#### Frontend - Gestión Mesas
- [ ] **39.4.9** Página `/admin/buffet/mesas` (MesasLayout.jsx)
  - Canvas con mesas arrastrables
  - Colores por estado (verde libre, rojo ocupada, etc.)
  - Zoom in/out
  - Filtro por zona
- [ ] **39.4.10** Formulario de zona (ZonaForm.jsx)
- [ ] **39.4.11** Formulario de mesa (MesaForm.jsx)
  - Campos: número, zona, capacidad
  - Toggle activo/fuera de servicio
- [ ] **39.4.12** Modo edición de layout (arrastrar mesas)
- [ ] **39.4.13** Modo operación (ver estados, click abre comanda)
- [ ] **39.4.14** Indicador de tiempo de ocupación por mesa
- [ ] **39.4.15** Modal unir mesas (selección múltiple)

---

### Etapa 39.5: Reservas
> Sistema de reservas de mesas

#### Backend - Reservas
- [ ] **39.5.1** Endpoints CRUD de `ReservaBuffet`
- [ ] **39.5.2** Endpoint verificar disponibilidad (fecha, hora, comensales)
- [ ] **39.5.3** Endpoint confirmar reserva
- [ ] **39.5.4** Endpoint cancelar reserva
- [ ] **39.5.5** Endpoint marcar no-show
- [ ] **39.5.6** Endpoint reservas del día
- [ ] **39.5.7** Notificación recordatorio de reserva (1 día antes, 2 horas antes)
- [ ] **39.5.8** Buscar socio por QR/DNI para vincular reserva

#### Frontend - Reservas
- [ ] **39.5.9** Página `/admin/buffet/reservas` (ReservasLista.jsx)
  - Vista calendario día/semana
  - Vista lista con filtros
  - Estados con colores
- [ ] **39.5.10** Formulario de reserva (ReservaForm.jsx)
  - Selector de fecha y hora
  - Cantidad de comensales
  - Mesa sugerida automáticamente
  - Datos del cliente o vincular socio
- [ ] **39.5.11** Timeline de reservas por mesa
- [ ] **39.5.12** Alertas de reservas próximas en mapa de mesas

---

### Etapa 39.6: Turnos de Mozos
> Control de turnos del personal del buffet

#### Backend - Turnos
- [ ] **39.6.1** Endpoints CRUD de `TurnoBuffet`
- [ ] **39.6.2** Endpoint abrir turno (con fondo inicial)
- [ ] **39.6.3** Endpoint cerrar turno (resumen ventas, propinas)
- [ ] **39.6.4** Endpoint obtener turno activo del usuario
- [ ] **39.6.5** Endpoint listar ventas del turno
- [ ] **39.6.6** Endpoint registrar propina
- [ ] **39.6.7** Endpoint asignar mesas a mozo
- [ ] **39.6.8** Reporte de ventas por mozo

#### Frontend - Turnos
- [ ] **39.6.9** Página `/admin/buffet/turnos` (TurnosLista.jsx)
  - Turnos del día con estado
  - Histórico con filtros
- [ ] **39.6.10** Modal apertura de turno (AperturaTurno.jsx)
  - Fondo inicial
  - Mesas asignadas
- [ ] **39.6.11** Modal cierre de turno (CierreTurno.jsx)
  - Resumen de ventas
  - Total propinas
  - Diferencia de caja
- [ ] **39.6.12** Dashboard del mozo (ventas del día, mesas activas)

---

### Etapa 39.7: Toma de Comandas
> Flujo principal de registro de pedidos en mesas

#### Backend - Comandas
- [ ] **39.7.1** Endpoint abrir comanda (mesa, mozo, comensales, socio opcional)
- [ ] **39.7.2** Endpoint agregar item a comanda
- [ ] **39.7.3** Endpoint modificar item (cantidad, observaciones)
- [ ] **39.7.4** Endpoint anular item (con motivo y autorización)
- [ ] **39.7.5** Endpoint enviar a cocina (cambia estado items a ENVIADO_COCINA)
- [ ] **39.7.6** Endpoint obtener comanda activa de mesa
- [ ] **39.7.7** Endpoint listar comandas activas (para mozo)
- [ ] **39.7.8** Endpoint historial de comandas
- [ ] **39.7.9** Endpoint transferir comanda a otra mesa
- [ ] **39.7.10** Endpoint dividir comanda (crear nueva con items seleccionados)
- [ ] **39.7.11** Lógica de impresión al enviar a cocina (usa destinos configurados)
- [ ] **39.7.12** Descuento automático de stock al cerrar comanda (usa recetas)

#### Frontend - App Mozo TABLET (PWA optimizada)
- [ ] **39.7.13** Layout especial buffet tablet (sin sidebar, bottom nav)
- [ ] **39.7.14** Pantalla mapa de mesas del mozo (MozoMesas.jsx)
  - Solo mesas asignadas o todas
  - Click en mesa → abre comanda
  - Indicadores visuales de estado
- [ ] **39.7.15** Pantalla toma de comanda tablet (TomaComanda.jsx)
  - Header: mesa, comensales, tiempo
  - Grid de categorías (3-4 columnas)
  - Lista de productos por categoría
  - Búsqueda rápida
  - Productos favoritos/frecuentes
- [ ] **39.7.16** Selector de variante al agregar producto
- [ ] **39.7.17** Selector de modificadores
- [ ] **39.7.18** Asignar item a comensal (1, 2, 3...)
- [ ] **39.7.19** Campo observaciones por item
- [ ] **39.7.20** Resumen de comanda actual
  - Lista de items pendientes de enviar
  - Items ya enviados
  - Total parcial
- [ ] **39.7.21** Botón "Enviar a Cocina" (solo items pendientes)
- [ ] **39.7.22** Notificación push cuando item está listo
- [ ] **39.7.23** Marcar item como entregado
- [ ] **39.7.24** Botón "Pedir Cuenta" (cambia estado comanda)

#### Frontend - App Mozo MÓVIL (PWA optimizada celular)
> Versión específica para celular con UX adaptada a pantalla pequeña

- [ ] **39.7.25** Layout móvil específico (TomaComandaMobile.jsx)
  - Full screen, sin chrome del navegador
  - Bottom navigation fija (Mesas, Comanda, Cuenta)
  - Gestos swipe para navegación
- [ ] **39.7.26** Mapa de mesas versión móvil
  - Lista vertical con cards grandes (touch-friendly)
  - Indicadores de estado con colores
  - Pull-to-refresh
  - Filtro rápido por zona (tabs horizontales)
- [ ] **39.7.27** Toma de comanda versión móvil
  - Categorías en scroll horizontal (chips)
  - Productos en lista vertical con fotos grandes
  - Búsqueda con teclado optimizado
  - FAB flotante para ver resumen
- [ ] **39.7.28** Agregar producto modal full-screen
  - Imagen del producto grande
  - Selector de cantidad (+/-)
  - Variantes en chips seleccionables
  - Modificadores como toggles
  - Teclado para observaciones
  - Botón grande "Agregar"
- [ ] **39.7.29** Resumen de comanda (drawer desde abajo)
  - Swipe up para expandir
  - Lista de items con swipe para eliminar
  - Total siempre visible
  - Botones: Enviar a Cocina, Pedir Cuenta
- [ ] **39.7.30** Notificaciones push en móvil
  - Vibración cuando item está listo
  - Badge con cantidad de items listos
- [ ] **39.7.31** Modo offline móvil
  - Cola de comandas local
  - Sincronización automática
  - Indicador de conexión
- [ ] **39.7.32** Detección automática de dispositivo
  - Si ancho < 768px → TomaComandaMobile
  - Si ancho >= 768px → TomaComanda (tablet)
  - O selector manual en configuración de usuario

---

### Etapa 39.8: Pantalla Cocina (KDS - Kitchen Display System)
> Visualización y gestión de pedidos en cocina

#### Backend - KDS
- [ ] **39.8.1** Endpoint items pendientes de preparación (filtrado por impresora/destino)
- [ ] **39.8.2** Endpoint marcar item como "en preparación"
- [ ] **39.8.3** Endpoint marcar item como "listo"
- [ ] **39.8.4** Endpoint marcar todos los items de una comanda como listos
- [ ] **39.8.5** WebSocket para actualización en tiempo real
- [ ] **39.8.6** Endpoint bumper (quitar de pantalla)
- [ ] **39.8.7** Cálculo de tiempo de espera por item
- [ ] **39.8.8** Alertas de items con espera excesiva

#### Frontend - KDS
- [ ] **39.8.9** Página `/buffet/cocina` (PantallaCocina.jsx)
  - Sin login (o PIN simple)
  - Pantalla completa optimizada para monitor/TV
- [ ] **39.8.10** Grid de tickets pendientes
  - Cada ticket = items de una comanda para esa estación
  - Ordenados por hora de llegada (FIFO)
- [ ] **39.8.11** Colores por tiempo de espera
  - Verde: < 5 min
  - Amarillo: 5-10 min
  - Rojo: > 10 min
- [ ] **39.8.12** Touch en item → marcar en preparación
- [ ] **39.8.13** Touch en ticket completo → marcar todos listos
- [ ] **39.8.14** Swipe → bump (quitar de pantalla)
- [ ] **39.8.15** Sonido/alerta en nuevos pedidos
- [ ] **39.8.16** Filtro por estación (si hay múltiples)
- [ ] **39.8.17** Contador de tickets pendientes

---

### Etapa 39.9: Cierre de Mesa y Cobro
> Pre-cuenta, división, cobro y facturación

#### Backend - Cobro (Integrado con Tesorería existente)
- [ ] **39.9.1** Endpoint generar pre-cuenta
- [ ] **39.9.2** Endpoint calcular totales (subtotal, descuentos, propina sugerida, total)
- [ ] **39.9.3** Endpoint aplicar descuento (%, monto fijo, motivo)
- [ ] **39.9.4** Endpoint división de cuenta
  - Por partes iguales
  - Por comensal (cada uno paga lo suyo)
  - Monto fijo por persona
- [ ] **39.9.5** Endpoint cobrar comanda (usa servicios existentes):
  - Crea `MovimientoCaja` en caja activa del club
  - Usa `MedioPago` existentes del sistema
  - Múltiples medios de pago en una operación
  - Registro de propina (MovimientoCaja con esPropina=true)
  - Vinculación con socio (cuenta corriente)
- [ ] **39.9.6** Endpoint cargar a cuenta corriente socio (crea Cargo pendiente)
- [ ] **39.9.7** Endpoint cerrar comanda (cambia estado mesa a LIMPIEZA)
- [ ] **39.9.8** Impresión de ticket de cobro
- [ ] **39.9.9** Generación de factura usando sistema existente (A/B/C)
- [ ] **39.9.10** Generación de `Asiento` contable automático (mismo servicio que cuotas)
- [ ] **39.9.11** Centro de costo BUFFET en cada asiento generado

#### Frontend - Cobro
- [ ] **39.9.12** Modal pre-cuenta (PreCuenta.jsx)
  - Detalle de items consumidos
  - Subtotal, descuentos, total
  - Botón imprimir pre-cuenta
- [ ] **39.9.13** Modal división de cuenta (DivisionCuenta.jsx)
  - Opciones: iguales, por comensal, personalizado
  - Arrastrar items a cada cuenta
- [ ] **39.9.14** Modal cobro (CobroComanda.jsx)
  - Selector de medio de pago
  - Múltiples pagos (parte efectivo, parte tarjeta)
  - Campo propina
  - Escanear QR socio para cuenta corriente
  - Selector tipo comprobante
  - Botón cobrar + imprimir
- [ ] **39.9.15** Confirmación de cierre de mesa
- [ ] **39.9.16** Notificación a mozo de mesa liberada

---

### Etapa 39.10: Pedidos Take Away
> Flujo de pedidos para llevar

#### Backend - Take Away
- [ ] **39.10.1** Endpoints CRUD de `PedidoTakeAway`
- [ ] **39.10.2** Endpoint crear pedido rápido
- [ ] **39.10.3** Endpoint agregar items a pedido
- [ ] **39.10.4** Endpoint calcular hora estimada de entrega
- [ ] **39.10.5** Endpoint cambiar estado pedido
- [ ] **39.10.6** Endpoint cobrar pedido
- [ ] **39.10.7** Endpoint listar pedidos activos
- [ ] **39.10.8** Notificación push cuando pedido está listo
- [ ] **39.10.9** Impresión de comanda a cocina (mismo sistema de destinos)
- [ ] **39.10.10** Impresión de ticket de retiro

#### Frontend - Take Away
- [ ] **39.10.11** Página `/admin/buffet/takeaway` (TakeAwayLista.jsx)
  - Lista de pedidos activos con estados
  - Filtros por estado
  - Búsqueda por número/nombre
- [ ] **39.10.12** Modal nuevo pedido (TakeAwayForm.jsx)
  - Datos cliente (nombre, teléfono) o escanear socio
  - Selector de productos (igual que comanda)
  - Hora estimada de retiro
- [ ] **39.10.13** Pantalla de números listos (PantallaRetiro.jsx)
  - Para mostrar en mostrador
  - Números de pedidos listos
  - Animación al agregar nuevo

---

### Etapa 39.11: Punto de Venta Kiosco
> Venta rápida sin mesa para golosinas y productos menores

#### Backend - Kiosco
- [ ] **39.11.1** Endpoint venta rápida kiosco (productos, cobro inmediato)
- [ ] **39.11.2** Endpoint productos frecuentes kiosco
- [ ] **39.11.3** Endpoint buscar producto por código de barras
- [ ] **39.11.4** Endpoint cargar a cuenta socio (con límite)
- [ ] **39.11.5** Integración con caja kiosco

#### Frontend - Kiosco
- [ ] **39.11.6** Página `/buffet/kiosco` (PuntoVentaKiosco.jsx)
  - Layout simplificado para venta rápida
  - Grid de productos frecuentes
  - Búsqueda por código/nombre
  - Campo para lector de código de barras
- [ ] **39.11.7** Lista de items en venta actual
- [ ] **39.11.8** Botones de cobro rápido (efectivo, tarjeta, cuenta socio)
- [ ] **39.11.9** Modal identificar socio (QR o DNI)
- [ ] **39.11.10** Impresión de ticket

---

### Etapa 39.12: Caja del Buffet (Integrada pero con cierre propio)
> Usa Caja existente pero permite cierre independiente del buffet

#### Backend - Caja Buffet
- [ ] **39.12.1** Crear Caja tipo "BUFFET" en sistema existente (ej: "Caja Buffet Principal")
- [ ] **39.12.2** Los cobros del buffet van a la caja tipo BUFFET
- [ ] **39.12.3** Modelo `CierreBuffet` (cajaId, turnoId, fecha, fondoInicial, totalVentas, totalPropinas, totalEfectivo, totalTarjeta, efectivoArqueado, diferencia, observaciones, cerradoPor)
- [ ] **39.12.4** Endpoint apertura de turno buffet (fondo inicial en caja BUFFET)
- [ ] **39.12.5** Endpoint cierre de turno buffet:
  - Calcula totales de MovimientoCaja del turno
  - Registra arqueo de efectivo
  - Calcula diferencias
  - Genera CierreBuffet
- [ ] **39.12.6** Endpoint movimientos filtrados por caja BUFFET
- [ ] **39.12.7** Endpoint resumen del día (ventas, propinas, por medio de pago)
- [ ] **39.12.8** Endpoint histórico de cierres buffet
- [ ] **39.12.9** Las propinas se registran como MovimientoCaja con esPropina=true
- [ ] **39.12.10** Transferencia de efectivo a caja principal (opcional, al final del día)

#### Frontend - Caja Buffet
- [ ] **39.12.11** Página `/admin/buffet/caja` (CajaBuffet.jsx)
  - Estado actual de caja BUFFET
  - Movimientos del turno actual
  - Totales por medio de pago
  - Propinas acumuladas
- [ ] **39.12.12** Modal apertura de turno (AperturaTurnoBuffet.jsx)
  - Fondo inicial (conteo de efectivo)
  - Mozo/encargado que abre
- [ ] **39.12.13** Modal cierre de turno (CierreTurnoBuffet.jsx)
  - Arqueo de efectivo por denominación
  - Totales por medio de pago
  - Propinas del turno
  - Diferencias detectadas
  - Observaciones
- [ ] **39.12.14** Histórico de cierres con filtros
- [ ] **39.12.15** Opción de transferir efectivo a caja principal

**NOTA**: El buffet tiene su propia caja (tipo BUFFET) y puede hacer cierres independientes. Los movimientos siguen usando MovimientoCaja del sistema, permitiendo reportes consolidados del club.

---

### Etapa 39.13: Reportes y Analytics
> Dashboard y reportes gerenciales del buffet

#### Backend - Reportes
- [ ] **39.13.1** Endpoint dashboard buffet (KPIs del día)
- [ ] **39.13.2** Endpoint ventas por período
- [ ] **39.13.3** Endpoint productos más vendidos
- [ ] **39.13.4** Endpoint productos menos vendidos
- [ ] **39.13.5** Endpoint margen por producto (precio - costo ingredientes)
- [ ] **39.13.6** Endpoint ventas por categoría
- [ ] **39.13.7** Endpoint ventas por hora (curva de demanda)
- [ ] **39.13.8** Endpoint ventas por mozo
- [ ] **39.13.9** Endpoint rotación de mesas (promedio ocupación)
- [ ] **39.13.10** Endpoint ticket promedio
- [ ] **39.13.11** Endpoint comparativo períodos
- [ ] **39.13.12** Endpoint consumo socios vs público
- [ ] **39.13.13** Endpoint items anulados con motivos
- [ ] **39.13.14** Endpoint exportar a Excel

#### Frontend - Reportes
- [ ] **39.13.15** Página `/admin/buffet/dashboard` (DashboardBuffet.jsx)
  - KPIs: ventas del día, ticket promedio, mesas atendidas
  - Gráfico ventas por hora
  - Top 5 productos
  - Alertas (stock bajo, tiempos altos)
- [ ] **39.13.16** Página `/admin/buffet/reportes` (ReportesBuffet.jsx)
  - Tabs: Ventas, Productos, Mozos, Mesas, Análisis
- [ ] **39.13.17** Tab Ventas
  - Filtros de fecha
  - Gráficos con Recharts
  - Tabla detallada
- [ ] **39.13.18** Tab Productos
  - Ranking más/menos vendidos
  - Margen por producto
  - Productos agotados frecuentemente
- [ ] **39.13.19** Tab Mozos
  - Ventas por mozo
  - Tickets promedio
  - Propinas
- [ ] **39.13.20** Tab Mesas
  - Ocupación por zona
  - Tiempo promedio
  - Mesas más rentables
- [ ] **39.13.21** Tab Análisis
  - Comparativo con período anterior
  - Tendencias
  - Proyecciones

---

### Etapa 39.14: Integraciones Avanzadas
> Conexión profunda con módulos existentes

#### Integración Socios
- [ ] **39.14.1** Descuento automático por tipo de socio
- [ ] **39.14.2** Límite de cuenta corriente por categoría de socio
- [ ] **39.14.3** Historial de consumos en ficha del socio
- [ ] **39.14.4** Bloqueo de cuenta si socio moroso

#### Integración Stock
- [ ] **39.14.5** Descuento automático de ingredientes al cerrar comanda
- [ ] **39.14.6** Alertas de stock bajo de insumos
- [ ] **39.14.7** Sugerencia de pedido a proveedor
- [ ] **39.14.8** Recálculo de costos cuando cambian precios de insumos

#### Integración Contabilidad
- [ ] **39.14.9** Asientos automáticos de ventas buffet
- [ ] **39.14.10** Centro de costo BUFFET
- [ ] **39.14.11** Cuenta contable por categoría de producto (opcional)
- [ ] **39.14.12** Estado de resultados del buffet

#### Integración Notificaciones
- [ ] **39.14.13** Push a socio cuando pedido take away listo
- [ ] **39.14.14** Email recordatorio de reserva
- [ ] **39.14.15** Notificación de consumo cargado a cuenta

---

### Etapa 39.15: Menú, Navegación y Permisos
> Integración completa con AdminLayout y sistema de permisos existente

#### Menú en AdminLayout.jsx (Sidebar existente)
- [ ] **39.15.1** Agregar submenú "Buffet" en AdminLayout.jsx (igual que Deportes, Ingresos)
  - Icono: UtensilsCrossed de lucide-react
  - Expandible con subitems
  - Protegido por permisos
- [ ] **39.15.2** Subitems del menú Buffet:
  - Dashboard (BUFFET_VER)
  - Mesas (BUFFET_MESAS)
  - Carta/Menú (BUFFET_CARTA)
  - Reservas (BUFFET_RESERVAS)
  - Turnos (BUFFET_TURNOS)
  - Take Away (BUFFET_TAKEAWAY)
  - Ventas del Día (BUFFET_VENTAS)
  - Reportes (BUFFET_REPORTES)
  - Configuración → submenu: Impresoras, Destinos, Zonas (BUFFET_CONFIG)

#### Rutas en App.jsx
- [ ] **39.15.3** Rutas admin (protegidas por ProtectedRoute existente):
  - `/admin/buffet/dashboard` → DashboardBuffet
  - `/admin/buffet/mesas` → MesasLayout
  - `/admin/buffet/carta` → CartaLista
  - `/admin/buffet/reservas` → ReservasLista
  - `/admin/buffet/turnos` → TurnosLista
  - `/admin/buffet/takeaway` → TakeAwayLista
  - `/admin/buffet/ventas` → VentasBuffet
  - `/admin/buffet/reportes` → ReportesBuffet
  - `/admin/buffet/configuracion/impresoras` → ImpresorasLista
  - `/admin/buffet/configuracion/destinos` → DestinosImpresion
  - `/admin/buffet/configuracion/zonas` → ZonasLista

#### Rutas Operativas (dentro del mismo sistema)
- [ ] **39.15.4** Rutas operativas:
  - `/admin/buffet/mozo` → MozoMesas (mapa de mesas para mozo)
  - `/admin/buffet/comanda/:mesaId` → TomaComanda
  - `/admin/buffet/cocina` → PantallaCocina (KDS)
  - `/admin/buffet/kiosco` → PuntoVentaKiosco
  - `/admin/buffet/retiro` → PantallaRetiro (take away)

#### Permisos en seed.js (Sistema existente Fase 38)
- [ ] **39.15.5** Agregar permisos a seed.js junto con los demás:
  ```javascript
  // En seed.js, array de permisos existente, agregar:
  { codigo: 'BUFFET_VER', nombre: 'Ver módulo Buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_CARTA', nombre: 'Gestionar carta/menú', modulo: 'BUFFET' },
  { codigo: 'BUFFET_MESAS', nombre: 'Gestionar mesas y zonas', modulo: 'BUFFET' },
  { codigo: 'BUFFET_RESERVAS', nombre: 'Gestionar reservas', modulo: 'BUFFET' },
  { codigo: 'BUFFET_TURNOS', nombre: 'Gestionar turnos', modulo: 'BUFFET' },
  { codigo: 'BUFFET_TAKEAWAY', nombre: 'Gestionar pedidos take away', modulo: 'BUFFET' },
  { codigo: 'BUFFET_VENTAS', nombre: 'Ver ventas del buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_REPORTES', nombre: 'Ver reportes del buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_CONFIG', nombre: 'Configurar buffet', modulo: 'BUFFET' },
  { codigo: 'BUFFET_MOZO', nombre: 'Tomar comandas (mozo)', modulo: 'BUFFET' },
  { codigo: 'BUFFET_COCINA', nombre: 'Pantalla cocina (KDS)', modulo: 'BUFFET' },
  { codigo: 'BUFFET_KIOSCO', nombre: 'Punto de venta kiosco', modulo: 'BUFFET' },
  { codigo: 'BUFFET_COBRAR', nombre: 'Cobrar comandas', modulo: 'BUFFET' },
  { codigo: 'BUFFET_ANULAR', nombre: 'Anular items/comandas', modulo: 'BUFFET' },
  ```
- [ ] **39.15.6** Agregar constantes a permisos.js del frontend:
  ```javascript
  // En client/src/services/permisos.js
  BUFFET_VER: 'BUFFET_VER',
  BUFFET_CARTA: 'BUFFET_CARTA',
  // ... etc
  ```
- [ ] **39.15.7** Usar tienePermiso() en componentes del buffet
- [ ] **39.15.8** Filtrar menú en AdminLayout según permisos de buffet

---

### Etapa 39.16: PWA y Modo Offline
> Optimización para tablets y funcionamiento sin conexión

#### PWA Mozo
- [ ] **39.16.1** Service worker específico para buffet
- [ ] **39.16.2** Cache de carta/menú
- [ ] **39.16.3** Cola de comandas offline
- [ ] **39.16.4** Sincronización al recuperar conexión
- [ ] **39.16.5** Indicador de estado de conexión
- [ ] **39.16.6** Modo offline básico (ver mesas, tomar comanda, sincronizar después)

#### Optimizaciones
- [ ] **39.16.7** Precarga de imágenes de productos
- [ ] **39.16.8** Lazy loading de secciones
- [ ] **39.16.9** Animaciones táctiles (feedback)
- [ ] **39.16.10** Tamaño de botones optimizado para touch

---

### Resumen de Modelos

#### Modelos Nuevos (15)
```prisma
// Configuración
ZonaBuffet, Mesa, CategoriaMenu, ProductoMenu
VarianteProductoMenu, ModificadorProducto, RecetaIngrediente
ImpresoraTermica, DestinoImpresion

// Operación
TurnoBuffet, Comanda, ItemComanda, ModificadorItem
PedidoTakeAway, ItemPedidoTakeAway, ReservaBuffet
AnulacionItem, CierreBuffet
```

#### Modelos Existentes Modificados
```prisma
MovimientoCaja  // +comandaId, +pedidoTakeAwayId, +esPropina
Producto        // +esParaBuffet, +esIngrediente
Caja            // +tipo BUFFET
```

### Resumen de Endpoints (~120)
- Configuración: ~25
- Carta/Menú: ~15
- Mesas: ~10
- Reservas: ~10
- Turnos: ~10
- Comandas: ~15
- KDS: ~10
- Cobro: ~12
- Take Away: ~10
- Kiosco: ~5
- Caja: ~12
- Reportes: ~15

### Resumen de Páginas (~30)
- Admin: ~15 páginas
- Operativas Tablet: ~8 páginas
- Operativas Móvil: ~5 páginas (versión celular optimizada)
- Configuración: ~4 páginas

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

*Ultima actualizacion: 7 de Febrero 2026 - Agregada FASE 39 (Módulo Buffet/Restaurant) con 16 etapas y ~188 items (incluye versión móvil optimizada)*
