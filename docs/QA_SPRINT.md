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
15. [Alerta Automática de Baja Asistencia](#15-alerta-automática-de-baja-asistencia)
16. [Automatización de Comunicaciones](#16-automatización-de-comunicaciones)
17. [Historial de Asistencia en Portal Socio](#17-historial-de-asistencia-en-portal-socio)
18. [Deportes — Equipos Permanentes con Plantel](#18-deportes--equipos-permanentes-con-plantel)
19. [Deportes — Campeonatos y Tabla de Posiciones](#19-deportes--campeonatos-y-tabla-de-posiciones)
20. [Deportes — Planillas de Entrenamiento](#20-deportes--planillas-de-entrenamiento)
21. [Seguimiento Médico](#21-seguimiento-médico)
22. [Gobernanza — Actas de Reunión](#22-gobernanza--actas-de-reunión)
23. [Gobernanza — Votaciones](#23-gobernanza--votaciones)
24. [Gobernanza — Documentos del Club](#24-gobernanza--documentos-del-club)
25. [Nuevo Menú — Deportes y Gobernanza](#25-nuevo-menú--deportes-y-gobernanza)

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

## 15. Alerta Automática de Baja Asistencia

### Qué se hizo
- Job cron semanal (lunes 8:00) que detecta socios con asistencia inferior al umbral configurado
- Configuración en Admin → Tablas Auxiliares: activar/desactivar, umbral % y ventana de días
- Envía email al EMAIL_CONTACTO del club con el listado de socios en riesgo

### Configuración requerida
> Admin → Tablas Auxiliares → "Alerta de Baja Asistencia": activar toggle, umbral (ej: 60%), días ventana (ej: 30)

### Checklist
- [ ] En Tablas Auxiliares aparece la card "Alerta de Baja Asistencia"
- [ ] El toggle activo/inactivo persiste al guardar
- [ ] Cambiar umbral y días → se guardan correctamente
- [ ] El email de alerta llega al contacto del club (verificar el lunes siguiente o via trigger manual en dev)
- [ ] El email lista socios con asistencia < umbral en el período configurado
- [ ] Si no hay socios por debajo del umbral, no se envía email (o se envía con lista vacía según config)

---

## 16. Automatización de Comunicaciones

### Qué se hizo
- Job diario (9:00) que envía saludos de cumpleaños a socios que cumplen ese día
- Job diario (8:30) que envía recordatorio de cuota próxima a vencer (configurable en días)
- Ambos configurables desde Admin → Tablas Auxiliares
- Deduplicación: no envía dos veces en el mismo día al mismo socio (tabla NotificacionLog)

### Configuración requerida
> **Cumpleaños:** Admin → Tablas Auxiliares → "Saludos de Cumpleaños": activar + personalizar mensaje con `{nombre}`
> **Recordatorio:** Admin → Tablas Auxiliares → "Recordatorio Anticipado de Cuotas": activar + días antes (ej: 3)

### Checklist
**Saludos de cumpleaños:**
- [ ] Card "Saludos de Cumpleaños" visible en Tablas Auxiliares
- [ ] Activar + personalizar mensaje con `{nombre}` → guardar
- [ ] Socio que cumple años hoy recibe email con su nombre interpolado
- [ ] El mismo socio NO recibe dos emails el mismo día (dedup activo)
- [ ] Socio sin email no genera error

**Recordatorio de cuotas:**
- [ ] Card "Recordatorio Anticipado de Cuotas" visible en Tablas Auxiliares
- [ ] Activar + días = 3 → guardar
- [ ] Socio con cuota que vence en exactamente 3 días recibe email + WhatsApp
- [ ] Si la cuota ya está paga, no recibe recordatorio
- [ ] No recibe dos recordatorios por la misma cuota el mismo día

---

## 17. Historial de Asistencia en Portal Socio

### Qué se hizo
- Nuevo tab "Mi Asistencia" en la sección "Mis Actividades" del portal socio
- Por inscripción: total entrenamientos, presentes, ausentes, % asistencia con barra de progreso
- Lista individual de cada entrenamiento con estado (PRESENTE / AUSENTE / Sin registro)
- Carga lazy: consulta solo cuando el socio abre el tab por primera vez

### Checklist
- [ ] En portal socio → sección "Mis Actividades" aparece el tab "Mi Asistencia"
- [ ] Al abrir el tab se muestra spinner y luego los datos
- [ ] Se muestra una card por cada inscripción activa o con entrenamientos en los últimos 90 días
- [ ] Cada card muestra: nombre actividad/categoría, % asistencia, barra de progreso coloreada (verde/amarillo/rojo)
- [ ] Lista de entrenamientos individuales con chip PRESENTE / AUSENTE / Sin registro
- [ ] Sin inscripciones: mensaje apropiado
- [ ] Navegar fuera y volver al tab no recarga (cache local)

---

## 18. Deportes — Equipos Permanentes con Plantel

### Qué se hizo
- CRUD de equipos permanentes por categoría/actividad con color identificatorio
- Plantel de jugadores (socios del club) con posición, dorsal y flag de titular
- Búsqueda de socios para agregar al plantel
- Validación de dorsales duplicados y jugadores repetidos

### Checklist
- [ ] Ir a Deportes → Equipos → muestra lista con filtros por categoría y activos
- [ ] Crear equipo: nombre, categoría, temporada, color → se guarda y aparece en lista
- [ ] Entrar al equipo → muestra plantel agrupado por posición
- [ ] Agregar jugador: buscar por apellido o número de socio → resultado aparece → seleccionar → se agrega
- [ ] Editar jugador: cambiar posición, dorsal, marcar titular → persiste
- [ ] Eliminar jugador del plantel → se remueve
- [ ] Intentar asignar dorsal ya existente en el mismo equipo → error claro
- [ ] Intentar agregar socio ya en el plantel → error claro
- [ ] Filtro activos/todos funciona

---

## 19. Deportes — Campeonatos y Tabla de Posiciones

### Qué se hizo
- CRUD de campeonatos (LIGA, TORNEO, COPA, AMISTOSO) vinculados a una categoría
- Asignación de partidos existentes al campeonato (tab "Asignar")
- Tabla de posiciones calculada en tiempo real: PJ/PG/PE/PP/GF/GC/DG/PTS
- Nuestro equipo resaltado. Ordenamiento: PTS desc → DG desc → GF desc

### Checklist
- [ ] Deportes → Campeonatos → lista con filtros En curso / Finalizados / Todos
- [ ] Crear campeonato: nombre, tipo LIGA, categoría, nombre del equipo propio, fechas → se crea
- [ ] Badge de tipo con color correcto (LIGA=azul, TORNEO=morado, COPA=amarillo, AMISTOSO=gris)
- [ ] Entrar al campeonato → tab "Tabla" vacía
- [ ] Tab "Asignar": lista partidos de la misma categoría sin campeonato
- [ ] Asignar partido → aparece en tab "Partidos" con botón "Quitar"
- [ ] Con partidos FINALIZADOS asignados → tab "Tabla" muestra la tabla calculada
- [ ] PTS = PG×3 + PE×1 (verificar con un partido conocido)
- [ ] GF/GC/DG calculados correctamente según condición LOCAL o VISITANTE
- [ ] Nuestro equipo aparece resaltado en la tabla
- [ ] Quitar partido → tabla se recalcula
- [ ] Partidos NO FINALIZADOS no afectan la tabla

---

## 20. Deportes — Planillas de Entrenamiento

### Qué se hizo
- Botón "Planilla" en la pantalla de Asistencia de cada entrenamiento
- Formulario: Objetivos, Calentamiento, Ejercicios (lista dinámica), Vuelta a la calma, Observaciones
- Cada ejercicio: nombre, descripción, series × repeticiones, duración, intensidad con badge coloreado
- Guardado upsert: crea la planilla si no existe, actualiza si ya existe

### Checklist
- [ ] En pantalla de Asistencia de un entrenamiento aparece botón "Planilla"
- [ ] La planilla muestra info del entrenamiento: fecha, hora, actividad/categoría
- [ ] Completar Objetivos y Calentamiento → Guardar → persisten al recargar
- [ ] Agregar ejercicio con todos los campos → badge de intensidad con color correcto (BAJA verde, MEDIA amarillo, ALTA naranja, MAXIMA rojo)
- [ ] Agregar múltiples ejercicios → aparecen numerados
- [ ] Eliminar un ejercicio → los restantes persisten correctamente
- [ ] Ejercicios sin nombre se filtran al guardar (no se guardan ni generan error)
- [ ] Sin permiso DEPORTES_EDITAR: todos los campos readonly, sin botón Guardar
- [ ] Dos entrenamientos distintos tienen planillas independientes

---

## 21. Seguimiento Médico

### Qué se hizo
- Página `/admin/socios/:id/medico` accesible desde Ficha de Socio → tab Médico → botón "Seguimiento médico completo"
- 3 tabs: Ficha Médica, Aptitud Física, Lesiones
- Ficha: grupo sanguíneo, alergias, medicamentos, condiciones crónicas, contacto de emergencia (upsert)
- Aptitud: historial de estudios con estados APTO/NO_APTO/CONDICIONAL/PENDIENTE, detección de vencimiento
- Lesiones: tipo, gravedad, fechas lesión/alta, tratamiento, restricciones, flag de alta médica

### Checklist
**Acceso:**
- [ ] Ficha de Socio → tab "Médico" → botón "Seguimiento médico completo" visible
- [ ] El botón navega correctamente a la página de seguimiento

**Ficha Médica:**
- [ ] Campos editables con permiso SOCIOS_EDITAR
- [ ] Guardar grupo sanguíneo y alergias → persisten al recargar
- [ ] Sin permiso: todos los campos readonly, sin botón Guardar

**Aptitud Física:**
- [ ] Crear registro APTO con médico y fechas → aparece en lista
- [ ] Registro vencido (fecha vencimiento < hoy) → muestra badge "Vencido" en rojo
- [ ] Eliminar registro → se remueve

**Lesiones:**
- [ ] Crear lesión GRAVE con tipo, fechas, descripción → aparece con borde naranja
- [ ] Editar lesión → marcar "Alta médica" → borde cambia a gris, badge "Alta médica" verde
- [ ] Eliminar lesión → se remueve

---

## 22. Gobernanza — Actas de Reunión

### Qué se hizo
- CRUD completo de actas (COMISION / ASAMBLEA / DIRECTIVA / OTRO)
- Estados: BORRADOR / FIRMADA / ARCHIVADA
- Campos: título, tipo, fecha, lugar, asistentes, temario, contenido, resoluciones, URL adjunto PDF
- Filtros por tipo, estado y año

### Checklist
- [ ] Gobernanza → Actas → lista vacía al inicio
- [ ] Crear nueva acta: título, tipo ASAMBLEA, fecha → se guarda y aparece en lista
- [ ] Badges de tipo y estado con colores correctos
- [ ] Entrar al acta → todos los campos editables
- [ ] Completar temario, contenido y resoluciones → guardar → persisten
- [ ] Cambiar estado a FIRMADA → persiste
- [ ] Agregar URL de adjunto → botón "Ver" abre en nueva pestaña
- [ ] Eliminar acta → confirmación → se elimina y regresa a la lista
- [ ] Filtros por tipo, estado y año funcionan correctamente

---

## 23. Gobernanza — Votaciones

### Qué se hizo
- CRUD de votaciones con opciones configurables
- Flujo de estados: BORRADOR → ABIERTA → CERRADA
- Un voto por socio por votación (deduplicado por @@unique)
- Padrón: socios activos que aún no votaron, con búsqueda
- Tab Resultados con barras de porcentaje y ganador destacado al cerrar

### Checklist
- [ ] Gobernanza → Votaciones → lista con filtro por estado
- [ ] Crear votación: título + 3 opciones → estado BORRADOR
- [ ] Botón "Abrir votación" → estado cambia a ABIERTA
- [ ] Tab "Registrar voto": muestra socios activos que no votaron
- [ ] Buscar socio → filtra correctamente
- [ ] Registrar voto: elegir opción → confirmar → socio desaparece del padrón
- [ ] Tab "Resultados": barras con % actualizado
- [ ] Tab "Votos": lista con opción de anular; al anular, socio vuelve al padrón
- [ ] Botón "Cerrar votación" → estado CERRADA, ganador destacado en verde
- [ ] Intentar registrar voto con votación CERRADA → error claro "La votación no está abierta"

---

## 24. Gobernanza — Documentos del Club

### Qué se hizo
- Repositorio de documentos por categoría (ESTATUTO, REGLAMENTO, ACTA, CONTRATO, GENERAL)
- Flag "Visible en sitio público" por documento
- CRUD con lista agrupada por categoría, edición inline

### Checklist
- [ ] Gobernanza → Documentos → lista vacía al inicio
- [ ] Filtro de categorías funciona (Todos / ESTATUTO / etc.)
- [ ] Agregar documento: nombre, categoría ESTATUTO, URL → aparece bajo sección "ESTATUTO"
- [ ] Botón "Ver" (ícono externo) abre la URL en nueva pestaña
- [ ] Editar documento: cambiar nombre y categoría → persiste
- [ ] Flag "Visible en sitio público" → se guarda y muestra etiqueta "Público"
- [ ] Eliminar documento → confirmación → se elimina

---

## 25. Nuevo Menú — Deportes y Gobernanza

### Qué se hizo
- "Equipos" y "Campeonatos" agregados al grupo Deportes en el seed del menú
- Nuevo grupo "Gobernanza" con: Actas, Votaciones, Documentos
- Los items nuevos se crean via re-seed (idempotente: no duplica items existentes)

### Configuración requerida
> Ir a **Admin → Configuración → Menú → "Restaurar menú por defecto"** para que aparezcan los nuevos items.

### Checklist
- [ ] Ejecutar seed de menú → no duplica items ya existentes
- [ ] Menú lateral muestra "Equipos" y "Campeonatos" bajo Deportes
- [ ] Menú lateral muestra grupo "Gobernanza" con Actas, Votaciones, Documentos
- [ ] Todos los links navegan a la pantalla correcta

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
| Jobs automáticos (cumpleaños, baja asistencia, recordatorio) | Cron interno | Admin → Tablas Auxiliares |

---

## Notas de regresión

Estos puntos existentes pueden haberse visto afectados y conviene verificar:

- [ ] El flujo de importación PRISMA estándar sigue funcionando (el refactor de `enviarNotificacionesRecibo` no debe haber roto nada)
- [ ] El módulo de Conciliación Bancaria con CSV sigue funcionando (la lógica XLSX es un branch adicional)
- [ ] La solicitud de adhesión al débito sin CVV (flujo existente) sigue funcionando sin Payway
- [ ] Los roles y permisos no se alteraron — verificar que un admin sin permiso `DEBITO_AUTOMATICO` no vea los botones de procesamiento
- [ ] El flujo de cobro de cuotas aplica correctamente el descuento anticipado cuando la config está activa y no lo aplica cuando está inactiva
- [ ] Los jobs de notificación no generan duplicados — verificar tabla `NotificacionLog` en días de prueba intensiva
- [ ] La tabla de posiciones retorna vacía (no error) para campeonatos sin partidos finalizados
- [ ] Aislamiento multi-tenant: los endpoints nuevos (`/gobernanza/*`, `/socios/:id/medico`, planillas, equipos, campeonatos) NO devuelven datos de otro tenant bajo ninguna circunstancia
- [ ] **Requiere `npx prisma db push` en producción** antes de usar: ActaReunion, Votacion, VotoRegistrado, DocumentoClub, PlanillaEntrenamiento, FichaMedica, AptitudFisica, LesionSocio, Equipo, PlantelEquipo, Campeonato (+ campos nuevos en Partido, Entrenamiento, Socio)
