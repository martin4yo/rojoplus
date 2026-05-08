# QA — Clubix / RojoPlus
> Última actualización: Abril 2026
> Documento único de control de calidad para probar toda la funcionalidad del producto.

---

## Cómo usar este documento

1. Cada módulo tiene secciones con un objetivo claro y pasos numerados.
2. Marcá `[x]` en cada checkbox al completar la prueba.
3. Si una prueba falla, anotá `[!]` y documentá el problema en la sección **"Defectos detectados"** al final.
4. **Pre-requisito siempre**: tener un tenant configurado, usuario admin con permisos completos, y al menos un socio cargado.

### Convenciones
- 🟢 Crítico (no puede fallar) | 🟡 Importante | 🔵 Cosmético
- ⚙️ Requiere configuración previa
- 🔒 Requiere permiso específico

---

## Índice

### Setup
1. [Login y Sesión](#1-login-y-sesión)
2. [Multi-tenant y Aislamiento](#2-multi-tenant-y-aislamiento)
3. [Permisos y Roles](#3-permisos-y-roles)

### Núcleo Socios
4. [Socios — CRUD](#4-socios--crud)
5. [Socios — Importación masiva](#5-socios--importación-masiva)
6. [Grupos Familiares](#6-grupos-familiares)
7. [Solicitudes de Inscripción](#7-solicitudes-de-inscripción)
8. [Cuotas y Cobranza](#8-cuotas-y-cobranza)
9. [Cargos Adicionales / Masivos](#9-cargos-adicionales--masivos)
10. [Cierres de Caja](#10-cierres-de-caja)

### Tesorería y Contabilidad
11. [Cajas y Movimientos](#11-cajas-y-movimientos)
12. [Transferencias entre Cajas](#12-transferencias-entre-cajas)
13. [Conciliación Bancaria](#13-conciliación-bancaria)
14. [Plan de Cuentas](#14-plan-de-cuentas)
15. [Asientos Contables](#15-asientos-contables)
16. [Libro Mayor](#16-libro-mayor)
17. [Presupuestos](#17-presupuestos)

### Ingresos
18. [Clientes (Entidades)](#18-clientes-entidades)
19. [Pedidos](#19-pedidos)
20. [Facturas de Venta](#20-facturas-de-venta)
21. [Recibos de Cobro](#21-recibos-de-cobro)

### Egresos
22. [Proveedores y Personal](#22-proveedores-y-personal)
23. [Órdenes de Compra](#23-órdenes-de-compra)
24. [Facturas de Compra](#24-facturas-de-compra)
25. [Órdenes de Pago](#25-órdenes-de-pago)
26. [Liquidaciones de Sueldos](#26-liquidaciones-de-sueldos)

### Centro de Costos
27. [Reporte de Centros de Costo](#27-reporte-de-centros-de-costo)
28. [Dashboard Ejecutivo CC](#28-dashboard-ejecutivo-cc)
29. [Matriz / Evolución / Rentabilidad / Presupuesto vs Real](#29-matriz--evolución--rentabilidad--presupuesto-vs-real)

### Stock
30. [Productos y Categorías](#30-productos-y-categorías)
31. [Movimientos de Stock](#31-movimientos-de-stock)
32. [Alertas de Stock](#32-alertas-de-stock)

### Buffet
33. [Configuración Buffet (Productos, Categorías, Mesas)](#33-configuración-buffet)
34. [Buffet — Mesas (UI POS)](#34-buffet--mesas-ui-pos)
35. [Buffet — Kiosco](#35-buffet--kiosco)
36. [Buffet — TakeAway](#36-buffet--takeaway)
37. [Buffet — Cocina / Barra (KDS)](#37-buffet--cocina--barra-kds)
38. [Buffet — Impresoras y Tickets](#38-buffet--impresoras-y-tickets)
39. [Menú Público](#39-menú-público)

### Control de Accesos
40. [Monitor y Intentos Denegados](#40-monitor-y-intentos-denegados)
41. [Habilitaciones](#41-habilitaciones)
42. [Control PWA](#42-control-pwa)
43. [Venta Ventanilla](#43-venta-ventanilla)
44. [Dispositivos](#44-dispositivos)

### Eventos y Reservas
45. [Eventos — CRUD y Venta de Entradas](#45-eventos--crud-y-venta-de-entradas)
46. [Reservas — Calendario y Config](#46-reservas--calendario-y-config)

### Deportes
47. [Espacios y Tipos de Espacio](#47-espacios-y-tipos-de-espacio)
48. [Agenda (Horarios Recurrentes)](#48-agenda-horarios-recurrentes)
49. [Entrenamientos y Asistencia](#49-entrenamientos-y-asistencia)
50. [Equipos y Plantel](#50-equipos-y-plantel)
51. [Campeonatos y Tabla de Posiciones](#51-campeonatos-y-tabla-de-posiciones)
52. [Planillas de Entrenamiento](#52-planillas-de-entrenamiento)
53. [Seguimiento Médico](#53-seguimiento-médico)
54. [Pasaje de Categoría](#54-pasaje-de-categoría)
55. [Reportes Deportivos](#55-reportes-deportivos)

### Comunicaciones
56. [Campañas de Comunicación](#56-campañas-de-comunicación)
57. [Chat Entrenadores](#57-chat-entrenadores)
58. [Templates de Email y PDF](#58-templates-de-email-y-pdf)
59. [Recupero](#59-recupero)
60. [Cobranzas](#60-cobranzas)

### Débito Automático
61. [Adhesión y CBU](#61-adhesión-y-cbu)
62. [Procesamiento (PRISMA / Payway / Bancos)](#62-procesamiento-prisma--payway--bancos)
63. [Recibos por Email + WhatsApp](#63-recibos-por-email--whatsapp)

### Gobernanza
64. [Actas de Reunión](#64-actas-de-reunión)
65. [Votaciones](#65-votaciones)
66. [Documentos del Club](#66-documentos-del-club)

### Reportes
67. [Reporte de Cuotas](#67-reporte-de-cuotas)
68. [Reporte de Socios](#68-reporte-de-socios)
69. [Reporte de Comercios](#69-reporte-de-comercios)
70. [Reporte de Morosidad](#70-reporte-de-morosidad)
71. [Reportes — Designer Custom](#71-reportes--designer-custom)
72. [Reportes — Run Reports](#72-reportes--run-reports)

### Configuración
73. [Tablas Auxiliares](#73-tablas-auxiliares)
74. [Branding y Personalización Visual](#74-branding-y-personalización-visual)
75. [Configuración Fiscal](#75-configuración-fiscal)
76. [Configuración de Pagos](#76-configuración-de-pagos)
77. [Menú Admin](#77-menú-admin)
78. [Usuarios y Roles](#78-usuarios-y-roles)
79. [Centros de Costo (config)](#79-centros-de-costo-config)
80. [Autoridades](#80-autoridades)

### Portal Socio (PWA)
81. [Login Portal Socio](#81-login-portal-socio)
82. [Cuenta Corriente Socio](#82-cuenta-corriente-socio)
83. [Pagos Online (Mercado Pago)](#83-pagos-online-mercado-pago)
84. [Reservas desde Portal](#84-reservas-desde-portal)
85. [Notificaciones y Chat](#85-notificaciones-y-chat)
86. [Acceso QR](#86-acceso-qr)

### Comercio
87. [Portal del Comerciante](#87-portal-del-comerciante)
88. [Listado público de Comercios](#88-listado-público-de-comercios)

### Sitio público
89. [Home y Páginas Estáticas](#89-home-y-páginas-estáticas)
90. [Actividades Públicas](#90-actividades-públicas)
91. [Noticias](#91-noticias)
92. [Calendario y Cronograma](#92-calendario-y-cronograma)
93. [Inscripción Pública](#93-inscripción-pública)

### Atajos / Favoritos (nuevo)
94. [Atajos del Admin](#94-atajos-del-admin)

### Super Admin
95. [Gestión de Tenants](#95-gestión-de-tenants)
96. [Dashboard de Uso](#96-dashboard-de-uso)
97. [Métricas IA](#97-métricas-ia)
98. [Registro Público de Club](#98-registro-público-de-club)

### Operativos / Cross-cutting
99. [Errores de conexión y resiliencia](#99-errores-de-conexión-y-resiliencia)
100. [Sockets en tiempo real](#100-sockets-en-tiempo-real)
101. [Adjuntos / Archivos](#101-adjuntos--archivos)

---

## 1. Login y Sesión

🟢 Crítico

### Casos
- [ ] Login con credenciales correctas → redirige a `/admin`
- [ ] Login con email inválido → mensaje de error claro
- [ ] Login con contraseña incorrecta → mensaje de error claro
- [ ] Logout → vuelve a `/admin/login` y limpia localStorage
- [ ] Reload con sesión activa → mantiene sesión y carga el menú
- [ ] Sesión expirada (token inválido) → redirige a login sin loop
- [ ] Acceso a `/admin/...` sin token → redirige a login

---

## 2. Multi-tenant y Aislamiento

🟢 Crítico

### Pre-requisito
Crear 2 tenants distintos con datos independientes (ej: `clubA` y `clubB`).

### Casos
- [ ] Login en `clubA.localhost` solo muestra socios de A
- [ ] Login en `clubB.localhost` solo muestra socios de B
- [ ] Endpoints API responden con `X-Tenant-Slug` correcto
- [ ] Cambiar manualmente el header `X-Tenant-Slug` en una request a un tenant ajeno → respuesta 403/401
- [ ] Logo, colores y nombre del club cambian según el tenant
- [ ] No hay datos de un tenant filtrándose a otro en NINGÚN listado (revisar al menos: socios, cuotas, movimientos, productos, reportes CC)
- [ ] El super-admin puede acceder a `/admin/tenants` desde localhost sin subdomain
- [ ] El admin de tenant NO ve los items "Gestión de Tenants" / "Dashboard de Uso" / "Métricas IA"

---

## 3. Permisos y Roles

🟢 Crítico

### Casos
- [ ] Crear un rol nuevo en `/admin/configuracion/roles/nuevo` con permisos limitados
- [ ] Asignar el rol a un usuario nuevo
- [ ] Login con ese usuario → menú lateral solo muestra los items autorizados
- [ ] Acceso directo a `/admin/socios` sin permiso `SOCIOS_VER` → redirige o muestra "sin acceso"
- [ ] Botones de acción se ocultan según `tienePermiso(PERMISOS.XXX)`
- [ ] Editar un rol no afecta sesiones activas hasta el próximo login

---

## 4. Socios — CRUD

🟢 Crítico

### Casos
- [ ] Listar socios → tabla muestra al menos: nombre, doc, estado, último pago
- [ ] Filtros por estado, categoría, fecha → resultados consistentes
- [ ] Buscar por nombre/documento → resultados correctos
- [ ] Crear socio nuevo (`/admin/socios/nuevo`) con datos completos → aparece en la lista
- [ ] Editar socio → cambios persisten
- [ ] Subir foto de perfil del socio → se renderiza en detalle
- [ ] Cambiar estado a "Inactivo" → el socio no aparece en filtros activos
- [ ] Ver detalle del socio → muestra cuenta corriente, familiares, actividades

---

## 5. Socios — Importación masiva

🟢 Crítico ⚙️

### Casos
- [ ] Descargar template Excel (`/admin/socios/cargar`) → archivo válido
- [ ] Importar 5 socios de prueba con datos válidos → todos se crean
- [ ] Importar archivo con un dato inválido (ej: doc duplicado) → reporta el error específico, no aborta
- [ ] Importación con columna `RFID` o `PIN` → se persiste en `Socio.rfidUid`
- [ ] Re-importar el mismo archivo → no duplica (actualiza)

---

## 6. Grupos Familiares

🟡 Importante

### Casos
- [ ] Crear socio principal y asignarle 2 familiares
- [ ] El familiar aparece en la lista del titular
- [ ] Cuenta corriente del titular muestra cargos de los familiares cuando se filtra `incluirFamilia=true`
- [ ] Cobrar cuota del titular cancela también las del grupo si está configurado así
- [ ] Eliminar el titular pide confirmación o reasigna familiares

---

## 7. Solicitudes de Inscripción

🟡 Importante

### Casos
- [ ] Registrar inscripción pública en `/inscripcion-socio` → llega a `/admin/solicitudes`
- [ ] Ver detalle de la solicitud
- [ ] Aprobar solicitud → se crea el socio
- [ ] Rechazar solicitud → marca como rechazada y permite motivo
- [ ] Pre-cargar familiares en la solicitud pública → llegan asociados

---

## 8. Cuotas y Cobranza

🟢 Crítico

### Casos
- [ ] Listar cuotas pendientes (`/admin/cuotas`)
- [ ] Filtrar por período, estado (pendiente/pagada/vencida)
- [ ] Generar cuotas masivamente para un período → se crea una cuota por socio activo
- [ ] Cobrar una cuota con efectivo → estado pasa a PAGADA, genera asiento contable
- [ ] Cobrar con descuento anticipado activo → aplica descuento si está dentro del período
- [ ] Cobrar con tarjeta → registra medio de pago correcto
- [ ] Cobrar con múltiples medios de pago → suma correctamente
- [ ] Recibo se genera y puede imprimirse/descargarse
- [ ] Anular pago → revierte el asiento contable
- [ ] Pagos informados (transferencia) llegan al contador del menú lateral

---

## 9. Cargos Adicionales / Masivos

🟡 Importante

### Casos
- [ ] Crear cargo adicional individual a un socio
- [ ] Crear cargo masivo para todos los socios activos
- [ ] Filtros del cargo masivo (categoría, antigüedad, estado) → afectan los socios elegidos
- [ ] El lote queda en historial y se puede revertir
- [ ] El cargo masivo respeta la caja seleccionada por rol

---

## 10. Cierres de Caja

🟡 Importante

### Casos
- [ ] Listar cierres → muestra fecha, caja, total
- [ ] Cerrar caja del día → suma todos los movimientos del día
- [ ] Imprimir cierre → genera PDF/ticket
- [ ] No permite cerrar dos veces la misma caja del mismo día

---

## 11. Cajas y Movimientos

🟢 Crítico

### Casos — Cajas
- [ ] Crear caja efectivo y caja banco
- [ ] Asignar centro de costo a una caja (ej: BUFFET → caja "Caja Buffet")
- [ ] Editar caja, cambiar moneda

### Casos — Movimientos
- [ ] Registrar Ingreso simple (un concepto, un medio) → genera asiento OK
- [ ] Registrar Egreso simple → asiento OK
- [ ] Registrar movimiento con **varios items** (multiconcepto) → balance OK, asiento con N líneas
- [ ] Registrar movimiento con **varios medios de pago** → balance valida total, asiento con N líneas de caja
- [ ] Centro de costo es **obligatorio** en cada item → bloquea guardar sin CC
- [ ] Cuenta contable se autocompleta desde el concepto, no se muestra al usuario
- [ ] Concepto sin cuenta contable asociada → error claro al guardar
- [ ] Adjuntar archivo al movimiento → se sube y descarga correctamente
- [ ] Buscar socio o entidad en el movimiento → mismo buscador que en clientes (sin loop de "Buscando...")
- [ ] Editar movimiento existente → permite modificar items y medios
- [ ] Anular movimiento → revierte asiento

---

## 12. Transferencias entre Cajas

🟡 Importante

### Casos
- [ ] Crear transferencia de Caja A → Caja B → ambas cajas reflejan el movimiento
- [ ] Asiento generado tiene el monto correcto en ambas cajas
- [ ] No permite transferir entre la misma caja
- [ ] Listado muestra las transferencias con origen, destino, fecha, monto

---

## 13. Conciliación Bancaria

🟡 Importante

### Casos
- [ ] Ver Pendientes de Conciliar
- [ ] Importar extracto CSV → matching automático sugerido
- [ ] Importar extracto **XLSX** → mismo matching
- [ ] Confirmar match → movimientos quedan conciliados
- [ ] Crear movimiento desde una línea no matcheada del extracto
- [ ] Detalle de conciliación muestra todos los matches

---

## 14. Plan de Cuentas

🟢 Crítico

### Casos
- [ ] Lista muestra estructura jerárquica (4 niveles)
- [ ] Saldo D/H se calcula correctamente para cada cuenta
- [ ] Crear cuenta nueva con código y naturaleza → aparece bajo su grupo
- [ ] No permite eliminar cuentas con movimientos
- [ ] Cuentas agrupadoras suman las hijas

---

## 15. Asientos Contables

🟢 Crítico

### Casos
- [ ] Asientos automáticos generados por: pagos, movimientos, facturas, OP, recibos, liquidaciones
- [ ] Cada asiento está balanceado (Debe = Haber)
- [ ] Numeración automática secuencial sin huecos
- [ ] Crear asiento manual con N líneas → no permite guardar desbalanceado
- [ ] Editar asiento manual → recalcula
- [ ] Eliminar asiento → solo si no proviene de un origen automático

---

## 16. Libro Mayor

🟡 Importante

### Casos
- [ ] Seleccionar cuenta → muestra todos los movimientos
- [ ] Saldo acumulado se actualiza línea por línea
- [ ] Filtro por fecha
- [ ] Exportar a Excel/PDF

---

## 17. Presupuestos

🟡 Importante

### Casos
- [ ] Crear presupuesto anual con N cuentas
- [ ] Editor permite cargar montos por mes y por cuenta
- [ ] Marcar presupuesto como vigente → solo uno vigente a la vez
- [ ] Ejecución muestra presupuesto vs real por mes
- [ ] Pre-cargar valores del año anterior + porcentaje → funciona

---

## 18. Clientes (Entidades)

🟡 Importante

### Casos
- [ ] Listar clientes — muestra cuenta corriente
- [ ] Crear cliente nuevo → genera código `CLI-XXX` automáticamente
- [ ] Datos fiscales (CUIT/DNI, condicionIva) se pueden cargar
- [ ] Asignar centro de costo al cliente
- [ ] Buscar cliente por nombre o documento

---

## 19. Pedidos

🔵 Cosmético

### Casos
- [ ] Crear pedido con items
- [ ] Detalle muestra el pedido
- [ ] Editar pedido en estado pendiente

---

## 20. Facturas de Venta

🟢 Crítico

### Casos
- [ ] Crear factura de venta a un cliente seleccionando items
- [ ] Items con stock se descuentan al confirmar
- [ ] Centro de costo **obligatorio** en cada item
- [ ] Total con IVA discriminado por alícuota
- [ ] Si está activada Facturación Electrónica → se genera CAE
- [ ] Detalle muestra factura con QR fiscal
- [ ] Listado con totales (subtotal, IVA, total)
- [ ] Filtro por estado funciona (pendiente/pagada/anulada)
- [ ] Filtro "Pagada" muestra correctamente facturas pagadas (estado PAGADO, no CONFIRMADO)
- [ ] Anular factura → reversa stock y asiento

---

## 21. Recibos de Cobro

🟡 Importante

### Casos
- [ ] Crear recibo aplicando a 1 o más facturas pendientes
- [ ] Multimedio de pago funciona en recibo
- [ ] Detalle muestra cuenta corriente actualizada
- [ ] Anular recibo → revierte la aplicación

---

## 22. Proveedores y Personal

🟡 Importante

### Casos
- [ ] Crear proveedor → código `PROV-XXX` automático
- [ ] Crear personal → código `PERS-XXX` automático
- [ ] Asignar centro de costo
- [ ] Cuenta corriente del proveedor

---

## 23. Órdenes de Compra

🟡 Importante

### Casos
- [ ] Crear OC con items y proveedor
- [ ] Estados: pendiente / parcial / recibida
- [ ] Recibir mercadería desde OC → genera ingreso de stock
- [ ] OC vinculada a factura de compra del proveedor

---

## 24. Facturas de Compra

🟢 Crítico

### Casos
- [ ] Crear factura de compra a proveedor con items
- [ ] Centro de costo **obligatorio** en cada item
- [ ] IVA crédito fiscal discriminado
- [ ] Asiento generado: Debe items + IVA / Haber proveedor
- [ ] Pagar factura desde detalle → genera OP y asiento de pago
- [ ] Estado pasa a PAGADO al cancelar 100% (no queda en CONFIRMADO)
- [ ] Filtro de estado "Pagado" muestra estas facturas
- [ ] Total al pie de la lista suma correctamente los registros visibles
- [ ] Adjuntar PDF de factura → se sube y descarga
- [ ] Multi-tenant: edit factura no rompe (`req.db` correcto, no `prisma` global)

---

## 25. Órdenes de Pago

🟡 Importante

### Casos
- [ ] Crear OP aplicando a facturas pendientes
- [ ] Multimedio de pago funciona
- [ ] Asiento de pago generado correctamente
- [ ] Anular OP → revierte aplicación y asiento

---

## 26. Liquidaciones de Sueldos

🟡 Importante

### Casos
- [ ] Listar liquidaciones por período
- [ ] Crear liquidación para un personal con conceptos remunerativos y no remunerativos
- [ ] Total neto = bruto - descuentos
- [ ] Detalle muestra recibo de sueldo descargable
- [ ] Asiento contable: 1 línea por entidad para que el centro de costo se distinga
- [ ] Conceptos de liquidación CRUD

---

## 27. Reporte de Centros de Costo

🟢 Crítico

### Casos
- [ ] Lista con todos los CC y su balance (ingresos - egresos)
- [ ] Centros con 0 movimientos NO aparecen (ojo: 0 movimientos, no resultado 0)
- [ ] Click en un CC abre detalle de movimientos
- [ ] Filtro por fecha
- [ ] Exportar a Excel → no incluye CCs sin movimientos
- [ ] Reporte da el mismo total que el dashboard del módulo (ej: dashboard buffet)
- [ ] Centro de costo BUFFET muestra todas las ventas del buffet

---

## 28. Dashboard Ejecutivo CC

🟡 Importante

### Casos
- [ ] Carga sin error
- [ ] Muestra KPIs por CC (ingresos, egresos, margen)
- [ ] Gráfico comparativo entre CCs

---

## 29. Matriz / Evolución / Rentabilidad / Presupuesto vs Real

🟡 Importante

### Casos
- [ ] **Matriz**: tabla CC × período (devengado/cobrado/pendiente)
- [ ] **Evolución temporal**: gráfico mensual por CC
- [ ] **Rentabilidad**: margen por actividad
- [ ] **Presupuesto vs Real**: variación por CC y mes

---

## 30. Productos y Categorías

🟡 Importante

### Casos
- [ ] Crear categoría
- [ ] Crear producto con imagen, precio, stock inicial, categoría
- [ ] Asignar tiposVenta (BUFFET, KIOSCO, ambos)
- [ ] Ver lista con stock actual

---

## 31. Movimientos de Stock

🟡 Importante

### Casos
- [ ] Listado muestra ingresos y egresos
- [ ] Ajuste manual de stock con motivo
- [ ] Movimiento tras venta de buffet/kiosco

---

## 32. Alertas de Stock

🔵 Cosmético

### Casos
- [ ] Productos bajo stock mínimo aparecen en `/admin/stock/alertas`
- [ ] El menú muestra contador

---

## 33. Configuración Buffet

🟢 Crítico

### Casos
- [ ] Categorías de buffet con orden y color
- [ ] Productos con `tiposVenta`, opciones (productos relacionados / extras)
- [ ] Mesas con zonas, estados (libre/ocupada)
- [ ] Precios por categoría/horario

---

## 34. Buffet — Mesas (UI POS)

🟢 Crítico

### Casos
- [ ] Ver mesas en planta
- [ ] Click en mesa libre → abre `GestionPedido`
- [ ] Agregar productos a la comanda → suman al total
- [ ] Modificar cantidad / sacar item
- [ ] Productos con opciones (`Modal Opciones`) → suman extras al precio
- [ ] Enviar a cocina → comanda se imprime en cocina
- [ ] Pre-cuenta → ticket impreso
- [ ] Cobrar mesa con factura fiscal → genera CAE + ticket fiscal con QR
- [ ] Cobrar mesa sin factura → ticket no fiscal
- [ ] Mesa pasa a libre tras cobrar
- [ ] Calculadora de vuelto funciona
- [ ] Selector de cliente para factura: busca en socios y entidades CLIENTE, autocompleta datos fiscales

---

## 35. Buffet — Kiosco

🟢 Crítico

### Casos
- [ ] Solo muestra productos con `tiposVenta: ['KIOSCO']`
- [ ] Mobile: botón flotante de carrito + drawer desde abajo
- [ ] Desktop: panel lateral siempre visible
- [ ] Cobrar genera ticket con impresora `BUFFET_IMPRESORA_KIOSCO`
- [ ] Movimiento de caja se asigna a centro de costo del kiosco
- [ ] Sin error de `productoBuffet.conceptoVenta` (debe usar `producto.conceptoVenta`)

---

## 36. Buffet — TakeAway

🟡 Importante

### Casos
- [ ] Mismo flujo que mesa (`GestionPedido`)
- [ ] Cliente registrado por nombre/teléfono
- [ ] Comanda se envía a cocina con formato TakeAway (`generarComandaTakeAwayESCPOS`)
- [ ] Cobrar emite ticket con impresora `BUFFET_IMPRESORA_TAKEAWAY`

---

## 37. Buffet — Cocina / Barra (KDS)

🟡 Importante

### Casos
- [ ] `/admin/buffet/cocina` muestra comandas pendientes en tiempo real (Socket.io)
- [ ] `/admin/buffet/kds/COCINA` filtra solo por sector
- [ ] `/admin/buffet/kds/BARRA` filtra solo por sector barra
- [ ] Marcar item como listo → desaparece de la pantalla
- [ ] Comanda completa → se cierra
- [ ] Notificación sonora de nueva comanda

---

## 38. Buffet — Impresoras y Tickets

🟢 Crítico ⚙️

### Casos
- [ ] Configurar 3 claves: `BUFFET_IMPRESORA_TICKETS`, `BUFFET_IMPRESORA_KIOSCO`, `BUFFET_IMPRESORA_TAKEAWAY`
- [ ] Test de impresión desde `/admin/buffet/impresoras`
- [ ] Ticket fiscal incluye QR de AFIP
- [ ] Ticket no fiscal sin CAE
- [ ] Comanda con formato `*** SECTOR ***` y observaciones con `>>`

---

## 39. Menú Público

🔵 Cosmético

### Casos
- [ ] `/menu-buffet` y `/buffet/menu` muestran productos con `tiposVenta: ['BUFFET']`
- [ ] Imágenes desde Unsplash se cargan
- [ ] Sin error si el tenant no tiene productos

---

## 40. Monitor y Intentos Denegados

🟡 Importante

### Casos
- [ ] Monitor muestra accesos en tiempo real (Socket.io)
- [ ] Intentos denegados listan los rechazos con motivo

---

## 41. Habilitaciones

🟡 Importante

### Casos
- [ ] Listar socios habilitados / no habilitados
- [ ] Habilitar manualmente un socio
- [ ] Sincronización con cuotas pagadas

---

## 42. Control PWA

🟡 Importante

### Casos
- [ ] PWA del molinete se conecta y aparece en monitor
- [ ] Validar QR del socio → permite/deniega
- [ ] Apertura remota (pendiente: vía Socket.io con molinete-service)

---

## 43. Venta Ventanilla

🟡 Importante

### Casos
- [ ] Ventanilla con cards de tipos de ticket
- [ ] Carrito + botón cobrar
- [ ] Cobrar con efectivo → registra movimiento
- [ ] Cobrar con MP QR (si configurado) → genera QR escaneable
- [ ] Ticket emitido al cobrar

---

## 44. Dispositivos

🟡 Importante

### Casos
- [ ] Listar molinetes / lectores configurados
- [ ] Crear/editar dispositivo
- [ ] Estado online/offline

---

## 45. Eventos — CRUD y Venta de Entradas

🟡 Importante

### Casos
- [ ] Crear evento con fecha, capacidad, precio
- [ ] Lista de eventos
- [ ] Detalle muestra entradas vendidas
- [ ] Vender entrada → genera comprobante con QR
- [ ] El QR de la entrada permite ingreso por molinete

---

## 46. Reservas — Calendario y Config

🟡 Importante

### Casos
- [ ] Configurar tipos de reserva, horarios disponibles
- [ ] Calendario muestra reservas del mes
- [ ] Crear reserva manual desde admin
- [ ] Reservas desde portal socio aparecen en calendario admin
- [ ] Confirmar/cancelar reserva

---

## 47. Espacios y Tipos de Espacio

🟡 Importante

### Casos
- [ ] Tipos de espacio configurados (Cancha, Salón, etc.)
- [ ] CRUD de espacios

---

## 48. Agenda (Horarios Recurrentes)

🟡 Importante

### Casos
- [ ] Crear horario recurrente para una actividad con espacio asignado
- [ ] Espacio es **obligatorio**
- [ ] Conflictos con otros horarios → alerta

---

## 49. Entrenamientos y Asistencia

🟡 Importante

### Casos
- [ ] Lista de entrenamientos generados desde la agenda
- [ ] Marcar asistencia: presente / ausente / justificado
- [ ] Histórico de asistencia por socio
- [ ] Alerta automática de baja asistencia configurada → llega notificación

---

## 50. Equipos y Plantel

🟡 Importante

### Casos
- [ ] Crear equipo permanente con plantel (lista de socios)
- [ ] Detalle muestra plantel con número, posición
- [ ] Editar plantel: agregar/quitar jugadores

---

## 51. Campeonatos y Tabla de Posiciones

🟡 Importante

### Casos
- [ ] Crear campeonato, asignar equipos
- [ ] Cargar partidos con resultado
- [ ] Tabla de posiciones se calcula (PJ, PG, PE, PP, PTS, GF, GC, DG)
- [ ] Campeonato sin partidos → tabla vacía sin error
- [ ] Próxima fecha y resultados de fecha anterior

---

## 52. Planillas de Entrenamiento

🟡 Importante

### Casos
- [ ] Crear planilla con ejercicios
- [ ] Asignar a entrenamiento
- [ ] Imprimir/exportar planilla

---

## 53. Seguimiento Médico

🟡 Importante

### Casos
- [ ] Ficha médica del socio: alergias, antecedentes, contacto emergencia
- [ ] Aptitud física con vencimiento
- [ ] Alerta de aptitud por vencer
- [ ] Lesiones: registrar lesión, fecha, días estimados

---

## 54. Pasaje de Categoría

🟡 Importante

### Casos
- [ ] Lista socios próximos a cambiar de categoría (por edad)
- [ ] Pasaje masivo a la categoría siguiente
- [ ] Histórico de pasajes

---

## 55. Reportes Deportivos

🔵 Cosmético

### Casos
- [ ] Reporte de asistencia por actividad
- [ ] Reporte de partidos jugados / ganados por equipo

---

## 56. Campañas de Comunicación

🟡 Importante ⚙️

### Casos
- [ ] Crear campaña con segmento (ej: morosos)
- [ ] Templates de email/WhatsApp
- [ ] Programar envío
- [ ] Detalle de campaña: enviados, leídos, errores
- [ ] Job de envío automático no genera duplicados

---

## 57. Chat Entrenadores

🟡 Importante

### Casos
- [ ] Lista de chats agrupada por actividad
- [ ] Mensajes en tiempo real (Socket.io)
- [ ] Adjuntos
- [ ] No leídos con badge

---

## 58. Templates de Email y PDF

🟡 Importante

### Casos
- [ ] Editor de templates con placeholders
- [ ] Vista previa
- [ ] Asignar template a evento (recibo, cuota, recordatorio)

---

## 59. Recupero

🟡 Importante

### Casos
- [ ] Lista de cuentas a recuperar
- [ ] Acciones registradas con fecha y motivo
- [ ] Campañas de recupero con plan de acciones

---

## 60. Cobranzas

🟡 Importante

### Casos
- [ ] Gestión de cobranzas con prioridades
- [ ] Detalle de gestión por socio
- [ ] Histórico de gestiones

---

## 61. Adhesión y CBU

🟡 Importante

### Casos
- [ ] Solicitud de adhesión desde admin → carga CBU
- [ ] Solicitud desde portal socio (sin CVV)
- [ ] Validación de CBU (22 dígitos)

---

## 62. Procesamiento (PRISMA / Payway / Bancos)

🟡 Importante ⚙️

### Casos
- [ ] Generar archivo PRISMA → formato correcto
- [ ] Procesar respuesta PRISMA → marca cobros OK/rechazados
- [ ] Payway: crear lote → enviar → recibir webhook
- [ ] Diferencia entre rechazo recuperable y final
- [ ] Sin permiso `DEBITO_AUTOMATICO` → no ve los botones

---

## 63. Recibos por Email + WhatsApp

🟡 Importante

### Casos
- [ ] Tras cobro automático exitoso → llega email con PDF
- [ ] Llega también WhatsApp con link al recibo
- [ ] Si email falla → sigue intentando WhatsApp

---

## 64. Actas de Reunión

🟡 Importante

### Casos
- [ ] Lista de actas
- [ ] Crear acta con título, fecha, asistentes, contenido
- [ ] Detalle: ver acta completa

---

## 65. Votaciones

🟡 Importante

### Casos
- [ ] Crear votación con opciones
- [ ] Socios pueden votar desde portal (1 vez por socio)
- [ ] Resultado en tiempo real
- [ ] Cerrar votación → no acepta más votos

---

## 66. Documentos del Club

🟡 Importante

### Casos
- [ ] Lista agrupada por categoría
- [ ] Crear documento con URL
- [ ] Flag "Visible en sitio público" → aparece en sitio
- [ ] Filtros y CRUD funcionando

---

## 67. Reporte de Cuotas

🟡 Importante

### Casos
- [ ] Filtros por período, estado, categoría
- [ ] Totales en pie
- [ ] Exportar a Excel

---

## 68. Reporte de Socios

🟡 Importante

### Casos
- [ ] Filtros por categoría, estado, antigüedad
- [ ] Totales por categoría
- [ ] Exportar

---

## 69. Reporte de Comercios

🔵 Cosmético

### Casos
- [ ] Lista de comercios adheridos
- [ ] Estado de pago

---

## 70. Reporte de Morosidad

🟡 Importante

### Casos
- [ ] Socios con N o más cuotas vencidas
- [ ] Antigüedad de la deuda
- [ ] Total adeudado

---

## 71. Reportes — Designer Custom

🔵 Cosmético

### Casos
- [ ] Crear plantilla de reporte custom (SQL)
- [ ] Vista previa
- [ ] Ejecutar y descargar

---

## 72. Reportes — Run Reports

🔵 Cosmético

### Casos
- [ ] Lista de reportes ejecutables
- [ ] Acceso rápido a reportes guardados con preset

---

## 73. Tablas Auxiliares

🟡 Importante

### Casos
- [ ] CRUD de cada tabla auxiliar (medios de pago, condiciones IVA, etc.)
- [ ] No se pueden eliminar registros con uso

---

## 74. Branding y Personalización Visual

🟡 Importante

### Casos
- [ ] Cargar logo claro/oscuro/favicon → se reflejan en admin y portal socio
- [ ] Cambiar color primario → CSS variables actualizan
- [ ] Slogan aparece en topbar admin

---

## 75. Configuración Fiscal

🟡 Importante ⚙️

### Casos
- [ ] CUIT, condición IVA, punto de venta
- [ ] Certificados AFIP cargados
- [ ] Test de conexión AFIP

---

## 76. Configuración de Pagos

🟡 Importante ⚙️

### Casos
- [ ] Mercado Pago: Access Token guardado por tenant
- [ ] Test de generación de preferencia
- [ ] Webhook configurado

---

## 77. Menú Admin

🟡 Importante

### Casos
- [ ] Lista de items con jerarquía
- [ ] Crear item con permiso requerido
- [ ] "Restaurar menú por defecto" no duplica items existentes (idempotente)

---

## 78. Usuarios y Roles

🟢 Crítico

### Casos
- [ ] CRUD de usuarios admin
- [ ] Asignar rol al usuario
- [ ] Cambiar contraseña
- [ ] CRUD de roles con matriz de permisos
- [ ] Permisos granulares funcionan en backend (`checkPermiso`) y frontend (`tienePermiso`)

---

## 79. Centros de Costo (config)

🟡 Importante

### Casos
- [ ] CRUD de centros de costo
- [ ] No se pueden eliminar CCs con movimientos

---

## 80. Autoridades

🔵 Cosmético

### Casos
- [ ] CRUD de autoridades
- [ ] Aparecen en sitio público en `/autoridades`

---

## 81. Login Portal Socio

🟢 Crítico

### Casos
- [ ] Login con email + código → llega código
- [ ] Login con WhatsApp → busca en celular/celularSecundario/telefonoFijo
- [ ] Login con magic link
- [ ] Sesión persistente

---

## 82. Cuenta Corriente Socio

🟡 Importante

### Casos
- [ ] Endpoint `/socio/:token/cuenta-corriente` muestra cuotas y cargos
- [ ] Coincide con la vista admin
- [ ] Filtro por familia

---

## 83. Pagos Online (Mercado Pago)

🟡 Importante ⚙️

### Casos
- [ ] Generar preferencia desde portal → redirige a MP
- [ ] Pago aprobado → webhook actualiza cuota
- [ ] Pago rechazado → no impacta
- [ ] Mostrar comprobante de pago en portal

---

## 84. Reservas desde Portal

🟡 Importante

### Casos
- [ ] Ver disponibilidad de espacios
- [ ] Crear reserva → confirma
- [ ] Cancelar reserva propia

---

## 85. Notificaciones y Chat

🟡 Importante

### Casos
- [ ] Push notifications PWA funcionan
- [ ] Chat con admin (chat entrenadores) recibe en tiempo real

---

## 86. Acceso QR

🟢 Crítico

### Casos
- [ ] Portal genera QR único del socio
- [ ] QR se escanea en molinete y permite ingreso
- [ ] QR rota o se invalida si el socio se da de baja

---

## 87. Portal del Comerciante

🟡 Importante

### Casos
- [ ] Acceso con token `/comercio/:token` o `/c/:token`
- [ ] Ver datos del comercio
- [ ] Editar datos en `/comercio/:token/editar`
- [ ] Token inválido → `/acceso-invalido`

---

## 88. Listado público de Comercios

🔵 Cosmético

### Casos
- [ ] `/comercios` muestra los activos
- [ ] Filtros por rubro
- [ ] Click abre detalle

---

## 89. Home y Páginas Estáticas

🔵 Cosmético

### Casos
- [ ] Home `/` carga con todos los bloques (hero, noticias, autoridades, etc.)
- [ ] Páginas: Historia, Misión, Autoridades, Instalaciones, Contacto
- [ ] Mobile responsive

---

## 90. Actividades Públicas

🟡 Importante

### Casos
- [ ] `/actividades` lista las activas
- [ ] Detalle por actividad muestra horarios y precio
- [ ] Filtros por categoría

---

## 91. Noticias

🟡 Importante

### Casos
- [ ] `/noticias` lista publicadas
- [ ] Detalle con slug `/noticias/:slug`
- [ ] CRUD desde admin → publicar/despublicar

---

## 92. Calendario y Cronograma

🔵 Cosmético

### Casos
- [ ] Calendario público de eventos
- [ ] Cronograma de actividades

---

## 93. Inscripción Pública

🟢 Crítico

### Casos
- [ ] `/inscripcion-socio` formulario completo
- [ ] Agregar familiares: `/inscripcion-socio/:id/familiares`
- [ ] reCAPTCHA funciona
- [ ] Envío llega a admin como Solicitud
- [ ] Email/WhatsApp de confirmación al solicitante

---

## 94. Atajos del Admin

🟡 Importante (nuevo módulo)

### Casos
- [ ] Botón estrella en header del admin abre modal "Nuevo atajo"
- [ ] Modal pre-llena URL con la actual
- [ ] Crear atajo con nombre, descripción, color de ícono, ícono, carpeta, "abrir en nueva pestaña"
- [ ] Aparece en `/admin/accesos-rapidos` (página "Atajos")
- [ ] Sidebar muestra "Atajos" como item fijo arriba (sin permiso)
- [ ] Tarjeta tipo mini: ícono centrado, barra de color superior, sin URL visible
- [ ] Hover muestra descripción como tooltip
- [ ] Switch "Edición" muestra: drag handle, lápiz, tachito en cada tarjeta
- [ ] Editar atajo desde lápiz → modal precargado
- [ ] Eliminar atajo → modal personalizado de confirmación → elimina
- [ ] Crear carpeta nueva con presets de color (5: blue/green/purple/orange/slate)
- [ ] Carpeta tiene `col-span-2` en grilla outer y items adentro `grid-cols-2`
- [ ] Items adentro de carpeta tienen mismo tamaño que items de raíz
- [ ] Cambiar color de carpeta clickeando swatches en modo edición
- [ ] Renombrar carpeta in-place (lápiz)
- [ ] Eliminar carpeta → ítems vuelven a raíz (`onDelete: SetNull`)
- [ ] Botón `+` en carpeta solo aparece en modo edición
- [ ] Drag & drop: mover ítem entre carpetas/raíz funciona
- [ ] Drag & drop: reordenar ítems dentro de carpeta
- [ ] Drag & drop: reordenar carpetas entre sí (handle del header)
- [ ] Cambios persisten tras recargar (POST `/admin/favoritos/reordenar`)
- [ ] Cada usuario admin ve solo sus propios atajos (scoped por adminId)
- [ ] Multi-tenant: atajos del usuario en clubA no aparecen en clubB

---

## 95. Gestión de Tenants

🟢 Crítico (super-admin)

### Casos
- [ ] `/admin/tenants` lista todos los tenants (solo super-admin)
- [ ] Crear tenant nuevo con slug, nombre, dominio
- [ ] Detalle de tenant con módulos habilitados
- [ ] Editar funcionalidades habilitadas
- [ ] Estado activo/inactivo
- [ ] Aislamiento: super-admin opera con `prisma` global, no `req.db`

---

## 96. Dashboard de Uso

🟡 Importante (super-admin)

### Casos
- [ ] `/admin/uso` muestra uso por tenant (storage, requests, etc.)
- [ ] Gráficos por mes
- [ ] Filtro por tenant

---

## 97. Métricas IA

🟡 Importante (super-admin)

### Casos
- [ ] `/admin/ia-metricas` muestra consumo de tokens / requests por tenant
- [ ] Costo estimado

---

## 98. Registro Público de Club

🟡 Importante

### Casos
- [ ] `/registro-club` permite alta self-service
- [ ] Crea tenant + admin inicial
- [ ] Email de bienvenida
- [ ] Primer login redirige a configuración inicial

---

## 99. Errores de conexión y resiliencia

🟢 Crítico

### Casos
- [ ] Apagar el server → al hacer cualquier acción aparece `ConnectionError` con logo del tenant
- [ ] Reintentar tras levantar el server → vuelve a la página
- [ ] Error de DB (postgres caído) → mismo overlay
- [ ] Toast de error se ve por ENCIMA del modal (z-index correcto)
- [ ] Errores de validación se muestran con `react-hot-toast`

---

## 100. Sockets en tiempo real

🟡 Importante

### Casos
- [ ] Comanda nueva en buffet → llega a cocina sin recargar
- [ ] Mensaje de chat → llega instantáneo al receptor
- [ ] Acceso por molinete → aparece en monitor en tiempo real
- [ ] Salas: `user:{id}`, `destino:COCINA`, `destino:BARRA`, `buffet`

---

## 101. Adjuntos / Archivos

🟡 Importante

### Casos
- [ ] Subir archivo desde factura compra/venta
- [ ] Subir archivo desde movimiento de caja
- [ ] Descargar archivo → mismo contenido que el subido
- [ ] `postFormData`, `downloadFile`, `upload` envían header `X-Tenant-Slug`
- [ ] Archivo de un tenant no se descarga desde otro (404 "Comprobante no encontrado")

---

## NUEVOS — Sesión Mayo 2026

### Vigencia de socios (bloqueo automático por morosidad) ⚙️

**Pre-requisito**: configurar 2 EstadoSocio del tenant: uno con `rolVigencia='AL_DIA'` y `permiteIngresoMolinete=true`; otro con `rolVigencia='BLOQUEADO'` y `permiteIngresoMolinete=false`. Activar `MOROSIDAD_BLOQUEO_AUTO_ACTIVO=true`. Para notificaciones también activar `MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO=true` Y `MOROSIDAD_NOTIF_CONFIRMADO=true`.

#### Cron de bloqueo (1:00 AM Argentina)
- [ ] 🟢 Socio con cuota PENDIENTE + `fechaVencimiento < hoy` → cron lo pasa al estado `BLOQUEADO`
- [ ] 🟢 Familia: cuota vencida en CUALQUIER miembro (titular o hijos) bloquea a TODA la familia
- [ ] 🟢 Socio bloqueado que se pone al día → cron lo pasa a `AL_DIA` en la siguiente corrida
- [ ] 🟡 Si el tenant no configuró estados con `rolVigencia` → cron skipea con warning
- [ ] 🟡 Cron itera tenants con `MOROSIDAD_BLOQUEO_AUTO_ACTIVO=true` (los que no, no se procesan)
- [ ] 🟢 Auditoría: cada cambio queda registrado en `auditoria_socio` con evento `BLOQUEADO_MOROSIDAD` o `ACTIVADO_PAGO`

#### Hook reactivación tras cobranza
- [ ] 🟢 Socio bloqueado, se le cobra una cuota que salda todas las vencidas → pasa a `AL_DIA` automáticamente al confirmar el pago
- [ ] 🟢 Si la familia entera se pone al día con un solo cobro → todos los miembros se reactivan
- [ ] 🟡 Si todavía hay cuotas vencidas → no se reactiva (se mantiene en BLOQUEADO)

#### Notificación de bloqueo (cron 9:00–18:00 horarias)
- [ ] 🟢 **Modo demo**: con `MODO_DEMO=true` y `EMAIL_DEMO`/`WHATSAPP_DEMO_NUMERO` configurados → notificaciones se redirigen al destinatario demo, no al socio real
- [ ] 🟢 **Cap horario**: nunca envía más de `MOROSIDAD_NOTIF_MAX_POR_HORA` (default 30) en una hora
- [ ] 🟢 **Cap diario**: nunca envía más de `MOROSIDAD_NOTIF_MAX_POR_DIA` (default 200) en un día
- [ ] 🟢 **Ventana horaria**: solo envía entre `MOROSIDAD_NOTIF_HORA_INICIO` y `MOROSIDAD_NOTIF_HORA_FIN`
- [ ] 🟢 **Plantilla rotativa**: el mismo socio recibe siempre la misma variante (4 plantillas)
- [ ] 🟢 **Throttling**: delay con jitter entre mensajes (`MOROSIDAD_NOTIF_DELAY_MS`)
- [ ] 🟢 **No duplica**: el evento `BLOQUEADO_MOROSIDAD` se marca con `notificadoEn` para no repetir
- [ ] 🟢 **Opt-outs**: respeta `Socio.notificarMorosidad`, `Socio.notifEmail`, `Socio.notifWhatsapp`
- [ ] 🟢 **Kill switch global**: `NOTIFICACIONES_VIGENCIA_KILL_SWITCH=true` en `.env` detiene todo

#### Auditoría de socio
- [ ] 🟢 Endpoint `GET /admin/socios/:id/auditoria` devuelve historial paginado
- [ ] 🟡 Eventos registrados: `ALTA_SOCIO`, `BAJA_SOCIO`, `EMAIL_MOD`, `CELULAR_MOD`, `DIRECCION_MOD`, `TIPO_SOCIO_MOD`, `INSCRIPCION_ACT`, `BAJA_INSCRIPCION`, `BLOQUEADO_MOROSIDAD`, `ACTIVADO_PAGO`
- [ ] 🟡 Cada evento tiene `usuarioId` (admin que originó) y `origen` (UI/CRON/API/IMPORT)

---

### Sesión persistente Socio + Entrenador ("recordar dispositivo")

#### Login Socio
- [ ] 🟢 Ingresar nº socio / DNI / email → recibir magic link por email o WhatsApp
- [ ] 🟢 Búsqueda por teléfono fue removida (input solo acepta nro/DNI/email)
- [ ] 🟢 Click en magic link → portal abre + cookie `socio_sid` se setea (DevTools)
- [ ] 🟢 Cerrar pestaña, volver a `/login-socio` → auto-login redirige al portal
- [ ] 🟡 URL del magic link no contiene `www.` (verificar cualquier subdomain)
- [ ] 🟡 Pestaña "Dispositivos conectados" en el perfil del socio muestra sesión actual
- [ ] 🟢 "Cerrar sesión" desde el portal → cookie eliminada, no auto-redirect
- [ ] 🟢 "Cerrar sesión en todos los dispositivos" → ningún device queda con sesión válida

#### Login Entrenador
- [ ] 🟢 Acceso desde header público → menú "Socio/Staff" → "Soy entrenador"
- [ ] 🟢 Ingresar email o documento del entrenador → magic link llega
- [ ] 🟢 Sesión persistente de 30 días (cookie `entrenador_sid`)
- [ ] 🟢 Entrenador vinculado a Entidad: la búsqueda funciona con email de Entidad

#### Admin: revocar sesiones
- [ ] 🟢 Tab "Dispositivos" en SocioForm → admin ve sesiones activas con IP/UA/fechas
- [ ] 🟢 Botón "Desconectar" → revoca esa sesión específica (el socio tiene que loguearse de nuevo en ese device)
- [ ] 🟢 Botón "Cerrar todas" → revoca todas las sesiones del socio

---

### Portal del Entrenador

**Pre-requisito**: tener Entrenador con email cargado y al menos una `EntrenadorCategoria` asignada activa.

#### Acceso y categorías
- [ ] 🟢 Login con email → magic link → portal abre con datos personales arriba
- [ ] 🟢 Selector de categorías muestra solo las asignadas al entrenador (no todas las del club)
- [ ] 🟢 Cantidad de inscriptos se muestra al lado de cada categoría
- [ ] 🟢 No accede a categorías de OTROS entrenadores (probar con `?categoriaId=X` ajeno → 403)

#### Tab Plantel
- [ ] 🟢 Lista todos los socios `Inscripcion.estado=ACTIVA` de la categoría
- [ ] 🟡 Muestra alerta si la `aptaFisicaVence` está vencida o por vencer en <30 días
- [ ] 🟡 Botones de teléfono y email funcionan (`tel:` / `mailto:`)
- [ ] 🟡 Indicador "menor" en socios con `esMenor=true`

#### Tab Entrenamientos
- [ ] 🟢 Lista entrenamientos de últimos 30 días + próximos 30 días por default
- [ ] 🟢 Crear entrenamiento extra → se crea con `tipo=EXTRA` y dispara notificación a socios inscriptos
- [ ] 🟢 Modo demo: notificación de nuevo entrenamiento llega al destinatario demo
- [ ] 🟢 Cancelar entrenamiento + motivo → estado pasa a `CANCELADO` y se notifica a socios
- [ ] 🟢 **Asistencia**: marcar 4 estados (PRESENTE / AUSENTE / TARDE / JUSTIFICADO) por jugador
- [ ] 🟢 Guardar asistencia → bulk upsert (no duplica si se guarda 2 veces)
- [ ] 🟡 Si el entrenamiento está cancelado, no se permite tomar asistencia

#### Tab Partidos
- [ ] 🟢 Crear partido (rival, fecha, condición LOCAL/VISITANTE, tipo)
- [ ] 🟢 Convocar plantel: tocar jugadores → bulk save → notifica a los nuevos convocados
- [ ] 🟢 Si se desconvoca a alguien → se elimina la convocatoria (sin notificación adversa)
- [ ] 🟡 Estado de respuesta del jugador (Confirmó / Rechazó / Sin responder) se muestra
- [ ] 🟢 Modo demo: notificación de convocatoria llega al destinatario demo

#### Tab Chat
- [ ] 🟢 Lista conversaciones con socios; ordenadas por último mensaje
- [ ] 🟢 Click → muestra historial; mensajes recibidos se marcan leídos automáticamente
- [ ] 🟢 Enviar mensaje → llega al socio
- [ ] 🟡 Indicador de mensajes no leídos en cada conversación

#### Salir
- [ ] 🟢 Botón "Salir" en header → cookie revocada → redirige a `/login-entrenador`

---

### Tab Entrenador en Personal (refactor Entrenador → Entidad)

**Pre-requisito**: en `/admin/configuracion/cargos-personal`, marcar al menos un Cargo con switch "Cargo de entrenador" activo.

- [ ] 🟢 Edición de Personal con cargo `esEntrenador=true` muestra tab "Entrenador"
- [ ] 🟡 Edición de Personal con cargo normal NO muestra el tab
- [ ] 🟢 Datos del rol (especialidad, observaciones, activo) se guardan
- [ ] 🟢 Datos staff web (mostrarEnWeb, fotoStaff, biografía) se guardan
- [ ] 🟢 Asignar categoría desde la tab → si no existía registro Entrenador, se auto-crea (auto-promoción)
- [ ] 🟢 Quitar categoría → solo elimina la relación, mantiene perfil entrenador
- [ ] 🟡 Migración: script `migrar-entrenadores-a-entidad.js --tenant X --dry-run` muestra qué pasaría
- [ ] 🟢 Después de migrar: cada Entrenador tiene `entidadId` no null
- [ ] 🟢 Login entrenador funciona buscando por email tanto en Entrenador.email como en entidad.email (post-migración)

---

### Cronograma — fix portal socio + sitio público

**Pre-requisito**: tener al menos una `CategoriaActividad` con `HorarioRecurrente` cargados desde `/admin/deportes/horarios`.

- [ ] 🟢 Sitio público `/actividades/:id` → tab Cronograma muestra día/hora/espacio correcto
- [ ] 🟢 Portal socio → "Mis actividades" → muestra horarios estructurados (era bug: no mostraba nada)
- [ ] 🟡 Helper `agruparSlots` agrupa días con mismo horario+espacio (Lun/Mié/Vie 19:00–20:30 · Cancha 1 en una línea)
- [ ] 🟡 Form Categoria Actividad ya NO tiene los inputs de texto legacy
- [ ] 🟡 En su lugar muestra link "Editar horarios →" a `/admin/deportes/horarios?categoriaId=X`

---

### Conciliación Brio → Clubix (sportivopilar)

- [ ] 🟢 Saldo CC global = adeudado global (cuotas pendientes)
- [ ] 🟢 Por familia: `saldoCC = sum(cuotas PENDIENTES)`
- [ ] 🟡 Si se necesita revertir ajustes: SQL DELETE por `origen` en cargos:
  - `AJUSTE_CUOTAS_FALTANTES_BRIO_20260507`
  - `AJUSTE_COMPENSACION_SALDO_CC_20260507`
  - `MIGRACION_BRIO_HISTORICO`

---

### Reporte "Listado de Socios para Firma"

- [ ] 🟢 Diseñador de reportes → query "Listado de Socios para Firma" disponible
- [ ] 🟢 Filtros: tipo de socio, estado, categoría (todos selects con options del tenant)
- [ ] 🟢 Filtro Edad: "Solo menores" / "Solo mayores"
- [ ] 🟢 PDF generado tiene grilla con: # / Nº Socio / DNI / Apellido y Nombre / Categoría / espacio firma
- [ ] 🟡 Filtros aplicados se muestran en el header del PDF

---

## Defectos detectados

Anotá acá los problemas encontrados durante las pruebas. Formato sugerido:

```
### [Módulo] - Título corto del defecto
- **Severidad**: 🟢 / 🟡 / 🔵
- **Pasos para reproducir**: ...
- **Resultado esperado**: ...
- **Resultado actual**: ...
- **Notas**: ...
```

---

## Resumen final

- [ ] Todos los módulos críticos (🟢) revisados y OK
- [ ] Defectos críticos resueltos antes de release
- [ ] Multi-tenant aislamiento verificado en al menos 2 tenants
- [ ] Smoke test final: login → cobrar cuota → registrar movimiento → ver reporte CC → logout
