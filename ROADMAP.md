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

- [ ] **30.1** Crear modelo Presupuesto (anio, estado)
- [ ] **30.2** Crear modelo LineaPresupuesto (cuentaContableId, mes, montoPresupuestado)
- [ ] **30.3** Pantalla de creacion de presupuesto anual
- [ ] **30.4** Carga de montos por cuenta y mes
- [ ] **30.5** Calculo automatico de ejecucion (real vs presupuestado)
- [ ] **30.6** Dashboard de control presupuestario
- [ ] **30.7** Alertas de desvios significativos
- [ ] **30.8** Reporte comparativo mensual y acumulado

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

## FASE 32: Gestión Deportiva
> Módulo de entrenamientos, asistencia, partidos y estadísticas (Fútbol, Básquet, Vóley)

### Modelos Base (reutiliza Actividad/CategoriaActividad/Inscripcion/Entrenador existentes)

### Etapa 32.1: Espacios Deportivos ✅
- [x] **32.1.1** Crear modelo EspacioDeportivo (codigo, nombre, tipo, capacidad, cubierto, iluminacion)
- [x] **32.1.2** Crear relación muchos-a-muchos EspacioDeportivo ↔ Actividad
- [x] **32.1.3** Migración de base de datos
- [x] **32.1.4** Endpoints CRUD de EspacioDeportivo (server/src/routes/deportes.js)
- [x] **32.1.5** Página /admin/deportes/espacios (EspaciosLista.jsx)
- [x] **32.1.6** Formulario de espacio (EspacioForm.jsx)
- [x] **32.1.7** Seed con espacios iniciales (seed-deportes.js)
- [x] **32.1.8** Crear modelo TipoEspacio (tabla configurable)
- [x] **32.1.9** Página /admin/deportes/tipos-espacio (TiposEspacioConfig.jsx)
- [x] **32.1.10** Crear modelo HorarioDisponibilidad (días y horarios por espacio)
- [x] **32.1.11** UI de horarios en EspacioForm con guardado bulk

### Etapa 32.2: Entrenamientos ✅
- [x] **32.2.1** Crear modelo Entrenamiento (categoriaActividadId, espacioId, fecha, horaInicio, horaFin, estado)
- [x] **32.2.2** Crear modelo HorarioRecurrente (templates de horarios semanales)
- [x] **32.2.3** Endpoints CRUD de Entrenamiento
- [x] **32.2.4** Endpoint generar entrenamientos desde template (semana/mes)
- [x] **32.2.5** Endpoint cancelar entrenamiento
- [x] **32.2.6** Página /admin/deportes/entrenamientos (calendario semanal/mensual)
- [x] **32.2.7** Modal de creación/edición de entrenamiento
- [x] **32.2.8** Modal de generación masiva desde horarios recurrentes
- [x] **32.2.9** Página /admin/deportes/horarios (HorariosRecurrentes.jsx)
- [x] **32.2.10** Validación de conflictos de espacio

### Etapa 32.3: Asistencia
- [ ] **32.3.1** Crear modelo Asistencia (entrenamientoId, socioId, estado, horaLlegada)
- [ ] **32.3.2** Agregar relación Socio.asistencias
- [ ] **32.3.3** Endpoint obtener lista de inscriptos para tomar asistencia
- [ ] **32.3.4** Endpoint guardar asistencia masiva
- [ ] **32.3.5** Página /admin/deportes/asistencia (TomaAsistencia.jsx)
- [ ] **32.3.6** Lista de jugadores con estados: PRESENTE, AUSENTE, JUSTIFICADO, TARDE
- [ ] **32.3.7** Acceso rápido desde calendario de entrenamientos
- [ ] **32.3.8** Indicador visual de asistencia tomada/pendiente en calendario

### Etapa 32.4: Partidos y Eventos
- [ ] **32.4.1** Crear modelo Partido (categoriaActividadId, fecha, hora, rival, condicion, resultado)
- [ ] **32.4.2** Crear modelo Convocatoria (partidoId, socioId, confirmado)
- [ ] **32.4.3** Crear modelo EstadisticaPartido (goles, asistencias, tarjetas, minutos)
- [ ] **32.4.4** Endpoints CRUD de Partido
- [ ] **32.4.5** Endpoint crear convocatoria (lista de jugadores)
- [ ] **32.4.6** Endpoint confirmar/rechazar convocatoria (jugador o padre)
- [ ] **32.4.7** Endpoint cargar resultado y estadísticas
- [ ] **32.4.8** Página /admin/deportes/partidos (PartidosLista.jsx - calendario)
- [ ] **32.4.9** Formulario de partido (PartidoForm.jsx)
- [ ] **32.4.10** Página de convocatoria (ConvocatoriaPartido.jsx)
- [ ] **32.4.11** Página de carga de resultado (ResultadoPartido.jsx)

### Etapa 32.5: Reportes y Estadísticas
- [ ] **32.5.1** Endpoint reporte de asistencia por jugador (% asistencia)
- [ ] **32.5.2** Endpoint reporte de asistencia por equipo/categoría
- [ ] **32.5.3** Endpoint estadísticas de jugador (partidos, goles, etc.)
- [ ] **32.5.4** Endpoint ranking (goleadores, asistencias por categoría)
- [ ] **32.5.5** Página /admin/deportes/reportes/asistencia (ReporteAsistencia.jsx)
- [ ] **32.5.6** Página /admin/deportes/reportes/estadisticas (EstadisticasJugador.jsx)
- [ ] **32.5.7** Dashboard deportivo con resumen general
- [ ] **32.5.8** Exportar reportes a Excel/PDF

### Etapa 32.6: Notificaciones (Opcional)
- [ ] **32.6.1** Crear modelo ConfiguracionNotificacion (socioId, tipo, activo)
- [ ] **32.6.2** Crear modelo Notificacion (tipo, mensaje, destinatario, estado)
- [ ] **32.6.3** Servicio de envío de notificaciones (email)
- [ ] **32.6.4** Notificación automática: nuevo entrenamiento
- [ ] **32.6.5** Notificación automática: cancelación de entrenamiento
- [ ] **32.6.6** Notificación automática: convocatoria a partido
- [ ] **32.6.7** Notificación automática: recordatorio 24h antes
- [ ] **32.6.8** Panel de configuración de notificaciones por socio

### Menú y Navegación
- [ ] **32.7.1** Agregar submenu "Deportes" en AdminLayout
- [ ] **32.7.2** Rutas: /admin/deportes/espacios
- [ ] **32.7.3** Rutas: /admin/deportes/entrenamientos
- [ ] **32.7.4** Rutas: /admin/deportes/horarios
- [ ] **32.7.5** Rutas: /admin/deportes/asistencia
- [ ] **32.7.6** Rutas: /admin/deportes/partidos
- [ ] **32.7.7** Rutas: /admin/deportes/reportes

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
| 26 | Cuotas y Cobranza | ✅ Completado |
| 27 | Comercios Publicos y Geolocalizacion | ✅ Completado |
| 28 | Ingresos, Egresos, Tesoreria y Stock | ✅ Completado |
| 29 | Plan de Cuentas Contable | ✅ Completado |
| 30 | Presupuesto Anual | ⏳ Pendiente |
| 31 | Control de Accesos | ⏳ Pendiente |
| 32 | Gestión Deportiva | 🔄 En Progreso |

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

*Ultima actualizacion: 21 de Enero 2026 - FASE 32 Gestión Deportiva*
