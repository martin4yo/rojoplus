# QA Sprint — Clubix / RojoPlus
> Generado: Abril 2026
> Scope: Todo lo desarrollado en el sprint actual

---

## Índice
1. [Menú y Navegación](#1-menú-y-navegación)
2. [Portal Socio — Login por WhatsApp](#2-portal-socio--login-por-whatsapp)
3. [Portal Socio — Escaneo de Comprobante (Parse)](#3-portal-socio--escaneo-de-comprobante-parse)
4. [Portal Socio — Notificaciones y Chat](#4-portal-socio--notificaciones-y-chat)
5. [Deportes — Espacio Obligatorio en Horarios](#5-deportes--espacio-obligatorio-en-horarios)
6. [Tesorería — Mejoras de Movimientos](#6-tesorería--mejoras-de-movimientos)
7. [Cobro desde Ficha de Socio](#7-cobro-desde-ficha-de-socio)
8. [Cargos Adicionales Masivos](#8-cargos-adicionales-masivos)
9. [Campañas de Comunicación](#9-campañas-de-comunicación)
10. [Chat Entrenadores](#10-chat-entrenadores)
11. [Débito Automático — Respuesta Bancaria (CBU)](#11-débito-automático--respuesta-bancaria-cbu)
12. [Débito Automático — Recibos Email + WhatsApp](#12-débito-automático--recibos-email--whatsapp)
13. [Débito Automático — Payway](#13-débito-automático--payway)
14. [Conciliación Bancaria — Soporte XLSX](#14-conciliación-bancaria--soporte-xlsx)

---

## 1. Menú y Navegación

### Qué se hizo
- Recupero y Comunicaciones agregados al menú lateral (seed ejecutado)
- "Horarios Recurrentes" renombrado a "Agendar Actividad"
- "Horarios" renombrado a "Agenda"
- "Chat Entrenadores" agregado al menú bajo Socios

### Checklist
- [X] El menú lateral muestra "Recupero" con ícono correcto
- [X] El menú lateral muestra "Comunicaciones" con ícono correcto
- [X] La sección de deportes muestra "Agendar Actividad" en lugar de "Horarios Recurrentes"
- [X] La sección de deportes muestra "Agenda" en lugar de "Horarios"
- [X] El menú lateral muestra "Chat Entrenadores" bajo la sección Socios

---

## 2. Portal Socio — Login por WhatsApp

### Qué se hizo
- Tercera opción de login en el portal socio: recibir código por WhatsApp
- El backend busca el socio en los 3 campos de teléfono (`celular`, `celularSecundario`, `telefonoFijo`)
- Envía el mismo magic link / código que el email pero vía WhatsApp

### Configuración requerida
> **WhatsApp: LISTO** — Evolution API ya está conectada y operativa. Sin pasos previos.

### Checklist
- [X] En la pantalla de login del portal socio aparece el botón "Ingresar por WhatsApp"
- [X] Ingresar un número de teléfono válido de un socio → recibe mensaje WhatsApp con el link
- [X] El link del mensaje funciona y loguea al socio correctamente
- [X] Si el número no pertenece a ningún socio, muestra error claro
- [ ] Si WhatsApp no está conectado, el botón muestra error apropiado (no crash)

---

## 3. Portal Socio — Escaneo de Comprobante (Parse)

### Qué se hizo
- El socio puede subir una foto del comprobante de pago y el sistema extrae monto, fecha y referencia automáticamente
- Usa la API de Parse/Axioma Cloud (feature pagada, por tenant)
- La API Key se configura por tenant desde el panel super-admin

### Configuración requerida
> **En Super-Admin → Gestión de Tenants → [Tenant] → Funcionalidades:**
> 1. Activar el toggle "Escaneo de Comprobantes (Parse)"
> 2. Ingresar la API Key de Parse y guardar
>
> Sin esta configuración el botón no aparece en el portal socio.

### Checklist
- [ ] Sin API Key configurada: el botón "Escanear comprobante" NO aparece en el portal
- [ ] Con API Key configurada: el botón aparece al seleccionar imagen de comprobante
- [ ] Subir imagen de comprobante → aparece el resultado con monto, fecha y referencia extraídos
- [ ] Los datos extraídos pre-llenan el campo de monto en el formulario de informe de pago
- [ ] Si el escaneo falla (imagen ilegible), muestra error sin bloquear el flujo de pago
- [ ] En mobile: se puede elegir entre galería y cámara al subir el comprobante

---

## 4. Portal Socio — Notificaciones y Chat

### Qué se hizo
- Tarjeta de Notificaciones fija en el dashboard del portal (4ta card, siempre visible)
- Chat en tiempo real con entrenadores via Socket.io
- Badge de mensajes no leídos en el tab Mensajes
- El socio puede responder mensajes

### Checklist
- [ ] El dashboard del portal muestra 4 cards: Cuotas, Actividades, Reservas, Notificaciones
- [ ] La card de Notificaciones muestra el conteo de notificaciones no leídas
- [ ] Al entrar a Mensajes, se listan las conversaciones con entrenadores
- [ ] Los mensajes nuevos aparecen en tiempo real sin recargar la página (Socket.io activo)
- [ ] El badge de mensajes no leídos se actualiza al recibir un mensaje nuevo
- [ ] El badge desaparece al abrir la conversación
- [ ] El socio puede escribir y enviar respuestas
- [ ] El entrenador ve la respuesta del socio en tiempo real en el panel admin

---

## 5. Deportes — Espacio Obligatorio en Horarios

### Qué se hizo
- Toggle global en la pantalla "Agendar Actividad" para hacer obligatorio el campo "Espacio" al crear un horario recurrente
- El valor se guarda en tabla `Configuracion` con clave `HORARIO_ESPACIO_OBLIGATORIO`
- El backend valida esta regla al crear horarios

### Checklist
- [ ] En "Agendar Actividad" aparece el toggle "Espacio obligatorio" (solo visible con permiso `DEPORTES_ENTRENAMIENTOS`)
- [ ] Con el toggle **desactivado**: crear horario sin espacio → funciona correctamente
- [ ] Con el toggle **activado**: crear horario sin espacio → error claro "La asignación de espacio es obligatoria"
- [ ] Con el toggle **activado**: crear horario con espacio → funciona correctamente
- [ ] El estado del toggle persiste entre recargas de página

---

## 6. Tesorería — Mejoras de Movimientos

### Qué se hizo
- Componente inline para crear Conceptos de Tesorería directamente desde el formulario de movimiento (sin salir a configuración)
- Selector de Socio/Entidad opcional en movimientos (para asociar el movimiento a un tercero)
- Modal post-movimiento con PDF del comprobante + opción de envío por email y WhatsApp

### Checklist
**Concepto inline:**
- [ ] En el formulario de nuevo movimiento, al lado del selector de Concepto aparece un botón "+"
- [ ] Al hacer clic en "+" se abre un mini-formulario para crear el concepto
- [ ] El concepto creado queda seleccionado automáticamente en el movimiento

**Selector Socio/Entidad:**
- [ ] En el formulario de movimiento aparece un campo de búsqueda de socio/entidad (no obligatorio)
- [ ] Buscar por nombre o número de socio → muestra resultados
- [ ] Seleccionar un socio → queda vinculado al movimiento
- [ ] Dejar vacío → el movimiento se crea igual sin vinculación

**Modal post-movimiento:**
- [ ] Al confirmar un movimiento, aparece modal con resumen y botones Email / WhatsApp / PDF
- [ ] "Descargar PDF" → genera y descarga el comprobante
- [ ] "Enviar por Email" → envía al email del socio asociado (si tiene)
- [ ] "Enviar por WhatsApp" → envía al teléfono del socio (si tiene)
- [ ] Sin socio asociado, los botones de email/WhatsApp están ocultos o deshabilitados

---

## 7. Cobro desde Ficha de Socio

### Qué se hizo
- Botón "Registrar Cobro" en la ficha individual del socio
- Permite cobrar cualquier concepto (cuota, seguro, inscripción, etc.) directamente desde la ficha
- Genera pago, aplica a cargos pendientes y emite comprobante

### Checklist
- [ ] En la ficha del socio aparece el botón "Registrar Cobro"
- [ ] El modal muestra los cargos pendientes del socio y permite seleccionar cuáles pagar
- [ ] Se puede elegir medio de pago y caja
- [ ] Al confirmar: se crea el pago y los cargos quedan en estado PAGADO
- [ ] El saldo de la caja se actualiza correctamente
- [ ] Se puede enviar el recibo al socio desde el mismo modal

---

## 8. Cargos Adicionales Masivos

### Qué se hizo
- Generación masiva de cargos adicionales (seguros, inscripciones, etc.) separada del período mensual
- Filtros por actividad y categoría
- Soporte para múltiples conceptos en un mismo batch
- Configuración de fecha de vencimiento

### Checklist
- [ ] Existe una sección "Cargos Adicionales" o similar en el módulo de Cuotas/Cobranza
- [ ] Se puede filtrar por actividad y categoría para seleccionar los socios destino
- [ ] Se pueden agregar múltiples conceptos con monto y fecha de vencimiento cada uno
- [ ] Vista previa muestra cuántos socios y monto total antes de confirmar
- [ ] Al confirmar, se crean los cargos en la cuenta corriente de cada socio
- [ ] Los cargos aparecen en la cuenta corriente del socio con el concepto correcto

---

## 9. Campañas de Comunicación

### Qué se hizo
- Envío real de campañas por email y WhatsApp (antes era mock)
- Página de detalle de campaña con resultados de envío
- Segmentación por actividad deportiva
- Estadísticas: enviados, fallidos, tasa de apertura

### Configuración requerida
> **Email:** SMTP configurado por tenant en Admin → Configuración → Email
> **WhatsApp: LISTO** — Evolution API ya está conectada y operativa.

### Checklist
- [ ] Crear campaña con tipo Email → se envía a los destinatarios correctos
- [ ] Crear campaña con tipo WhatsApp → llega el mensaje
- [ ] Segmentar por actividad → solo reciben los socios de esa actividad
- [ ] La página de detalle muestra: total destinatarios, enviados, fallidos
- [ ] Si un socio no tiene email/teléfono, se cuenta como fallido sin crashear
- [ ] Campañas enviadas quedan en historial con fecha y resultados

---

## 10. Chat Entrenadores

### Qué se hizo
- Panel admin "Chat Entrenadores" (mobile-first) con dos modos:
  - **Broadcast privado**: mensaje a todos los socios de una actividad/categoría, cada socio lo ve en su chat individual
  - **Canal grupal**: canal compartido tipo grupo, todos los socios ven los mensajes de todos
- El entrenador puede iniciar conversaciones y responder
- El socio responde desde el portal en la sección "Mensajes"
- Tiempo real via Socket.io en ambos lados
- Badge de no leídos en el portal socio

### Configuración requerida
> El servidor debe tener Socket.io activo (ya incluido en el servidor).
> El frontend debe conectar al mismo origen que el backend (variable `VITE_API_URL`).

### Checklist
**Panel entrenador (admin):**
- [ ] Ir a Admin → Chat Entrenadores → se carga correctamente en mobile
- [ ] Seleccionar actividad/categoría → lista los socios disponibles
- [ ] Enviar broadcast → el mensaje aparece en la conversación individual de cada socio en el portal
- [ ] Enviar mensaje a un socio específico → aparece en su portal en tiempo real
- [ ] El entrenador ve cuando un socio responde (sin recargar)

**Portal socio:**
- [ ] El socio ve la sección "Mensajes" en el portal
- [ ] El mensaje del entrenador aparece sin recargar (Socket.io)
- [ ] Badge con número de mensajes no leídos visible en la navegación
- [ ] El socio puede responder y el entrenador lo recibe en tiempo real
- [ ] Al leer los mensajes el badge desaparece

---

## 11. Débito Automático — Respuesta Bancaria (CBU)

### Qué se hizo
- Nuevo tab "Resp. Bancaria" en Débito Automático
- Soporte para importar archivos de retorno de Galicia, Macro, Santander y Provincia de Buenos Aires
- Matching por CBU completo
- Mismo flujo que PRISMA: crea pagos, aplica a cargos, envía recibos

### Configuración requerida
> Los socios adheridos por CBU deben tener el CBU completo (22 dígitos) en su ficha.
> El archivo de retorno del banco debe ser el archivo de texto posición fija que provee el banco.

### Formato esperado por banco
| Banco | Formato | Encoding |
|-------|---------|----------|
| Galicia | Posición fija, CBU en col 10-31 | Latin-1 |
| Macro | Posición fija, CBU en col 2-22, estado en col 70 | Latin-1 |
| Santander | Posición fija, CBU en col 3-24 | Latin-1 |
| Provincia | Posición fija, CBU en col 5-26 | Latin-1 |

> **Nota:** Los formatos de posición exacta varían según la versión del convenio firmado con el banco. Si el matching da 0 registros, verificar las columnas con el archivo real y ajustar en `parsearRespuestaBanco()` en `debitoAutomatico.js`.

### Checklist
- [ ] Ir a Débito Automático → tab "Resp. Bancaria"
- [ ] Seleccionar banco: Galicia
- [ ] Seleccionar archivo de débito original generado
- [ ] Subir archivo de retorno .txt del banco
- [ ] Vista previa muestra las primeras líneas del archivo
- [ ] Al procesar: aparece resumen de cobrados / rechazados / monto
- [ ] Verificar en cuenta corriente de un socio cobrado → el cargo queda en PAGADO
- [ ] Verificar en cuenta corriente de un socio rechazado → el cargo sigue pendiente con motivo de rechazo
- [ ] Se envían notificaciones por email + WhatsApp a los cobrados
- [ ] Probar con cada banco disponible (Macro, Santander, Provincia)

---

## 12. Débito Automático — Recibos Email + WhatsApp

### Qué se hizo
- Al importar respuesta (PRISMA o bancaria), se envían recibos por **email Y WhatsApp** (antes solo email)
- El resultado muestra cuántos emails y WhatsApps se enviaron / fallaron
- Nuevo botón "Reenviar recibos" en archivos ya procesados (ícono de campana)
- El reenvío también envía por ambos canales

### Configuración requerida
> **WhatsApp: LISTO** — Evolution API ya conectada.
> Email: SMTP debe estar configurado en variables de entorno.

### Checklist
- [ ] Al importar una respuesta PRISMA, el resultado muestra la sección "Notificaciones enviadas" con conteos de Email y WhatsApp
- [ ] Un socio cobrado con email recibe el recibo por correo
- [ ] Un socio cobrado con teléfono configurado recibe mensaje WhatsApp
- [ ] Un socio sin email ni teléfono: no genera error, aparece como 0 en los contadores
- [ ] En la lista de archivos PROCESADOS aparece el ícono de campana (reenviar recibos)
- [ ] Al hacer clic en campanita → se reenvían los recibos y aparece toast con el resultado
- [ ] Lo mismo aplica para archivos importados via "Resp. Bancaria"

---

## 13. Débito Automático — Payway

### Qué se hizo
- Servicio `paywayService.js` para tokenización y cobros via API REST de Payway
- Soporte sandbox (developers.decidir.com) y producción (live.decidir.com)
- Tokenización automática al solicitar adhesión desde el portal socio (si hay config activa)
- Nuevo tab "Payway" en el admin para cobrar en lote via API
- Webhook para recibir notificaciones async de Payway
- Badge "Tokenizado via Payway" en el portal socio

### Configuración requerida

**Paso 1 — Crear configuración Payway en Admin:**
> Ir a **Débito Automático → Configuración → Nueva configuración**
> - Código: `PAYWAY`
> - Nombre: `Payway (Sandbox)` o `Payway (Producción)`
> - Plataforma: `PAYWAY`
> - **Código Comercio** = `site_id` provisto por Payway
> - **API Key** = private key (para cobros)
> - **API Secret** = public key (para tokenización)
> - **Ambiente** = `SANDBOX` o `PRODUCCION`

**Paso 2 — Configurar webhook (producción):**
> En el panel de Payway configurar la URL de webhook:
> `https://[tu-dominio]/api/payway/webhook`

**Credenciales de sandbox:**
> Payway provee credenciales de prueba en: https://developers.decidir.com/
> Las tarjetas de prueba disponibles están en su documentación oficial.

### Checklist
**Sandbox — configuración:**
- [ ] Crear configuración PAYWAY en Admin con credenciales sandbox
- [ ] El tab "Payway" en Débito Automático muestra la configuración creada

**Portal socio — tokenización:**
- [ ] Al adherirse al débito con tarjeta: aparece el campo CVV (opcional)
- [ ] Ingresar CVV → al guardar, el backend tokeniza con Payway sandbox
- [ ] En el portal del socio adherido aparece el badge "Tokenizado via Payway"
- [ ] Sin CVV → la adhesión se guarda igual (flujo PRISMA sin token)

**Cobro en lote:**
- [ ] Generar un archivo de débito con socios que tengan token Payway
- [ ] Ir al tab "Payway" → seleccionar configuración y archivo → "Cobrar via Payway"
- [ ] El sistema procesa cada socio y muestra resultado por fila (cobrado/rechazado)
- [ ] Los cobrados quedan con pago creado en la cuenta corriente
- [ ] Se envían recibos por email + WhatsApp
- [ ] Probar con tarjeta de rechazo de sandbox → aparece motivo de rechazo correcto

**Casos de error:**
- [ ] Socio sin token Payway → el cobro muestra error con lista de socios sin token (no falla todo)
- [ ] Configuración sin API Key → error claro antes de intentar cobrar

---

## 14. Conciliación Bancaria — Soporte XLSX

### Qué se hizo
- La conciliación bancaria acepta archivos `.xlsx` y `.xls` además de CSV/TXT
- Presets de formatos para bancos argentinos (Galicia, Santander, Macro, Provincia) en CSV y XLSX
- Botón "Importar presets bancos argentinos" para cargar los formatos de una sola vez

### Configuración requerida
> Ejecutar los presets una sola vez:
> Ir a **Conciliación Bancaria → Formatos → "Importar presets bancos argentinos"**
> Esto crea los formatos predefinidos en la base de datos del tenant.

### Checklist
- [ ] En Conciliación Bancaria → Formatos aparece el botón "Importar presets bancos argentinos"
- [ ] Al hacer clic aparecen los formatos de Galicia, Macro, Santander y Provincia (CSV y XLSX)
- [ ] El botón es idempotente: ejecutarlo dos veces no duplica los formatos
- [ ] Subir un archivo `.xlsx` de extracto bancario → se procesa correctamente
- [ ] Subir un archivo `.csv` → sigue funcionando como antes
- [ ] Con el formato de Galicia XLSX seleccionado, subir el extracto → los movimientos se parsean
- [ ] Los movimientos importados aparecen en la pantalla de conciliación para matchear
- [ ] Verificar que el saldo inicial y final del extracto se calculan correctamente

---

## Resumen de dependencias externas

| Feature | Servicio externo | Dónde configurar |
|---------|-----------------|-----------------|
| Login WhatsApp | Evolution API | **LISTO** |
| Email (recibos, campañas) | SMTP por tenant | Admin → Configuración → Email |
| Escaneo comprobante | Parse / Axioma Cloud | Super-Admin → Tenants → Funcionalidades |
| Chat entrenadores (tiempo real) | Socket.io (interno) | No requiere config externa |
| Campañas WhatsApp | Evolution API | **LISTO** |
| Recibos WhatsApp | Evolution API | **LISTO** |
| Payway cobros | Payway API | Admin → Débito → Configuración |
| Payway webhook | Payway API | Panel Payway → URL webhook |

---

## Notas de regresión

Estos puntos existentes pueden haberse visto afectados y conviene verificar:

- [ ] El flujo de importación PRISMA estándar sigue funcionando (el refactor de `enviarNotificacionesRecibo` no debe haber roto nada)
- [ ] El módulo de Conciliación Bancaria con CSV sigue funcionando (la lógica XLSX es un branch adicional)
- [ ] La solicitud de adhesión al débito sin CVV (flujo existente) sigue funcionando sin Payway
- [ ] Los roles y permisos no se alteraron — verificar que un admin sin permiso `DEBITO_AUTOMATICO` no vea los botones de procesamiento
