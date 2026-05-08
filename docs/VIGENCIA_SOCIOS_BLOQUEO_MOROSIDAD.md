# Vigencia de Socios — Bloqueo automático por morosidad

## Resumen

Cuando un socio tiene una cuota PENDIENTE con `fechaVencimiento < hoy`, el sistema lo pasa automáticamente a un EstadoSocio especial que bloquea su ingreso al club. Cuando se cobra y queda sin cuotas vencidas, vuelve al estado normal.

Una cuota vencida en cualquier integrante del **grupo familiar** bloquea a toda la familia.

## Modelo

### `EstadoSocio.rolVigencia`
Campo string nullable que define qué papel cumple el estado en la lógica automática:

| Valor | Significado |
|---|---|
| `'BLOQUEADO'` | El cron pasa los socios morosos a este estado |
| `'AL_DIA'` | El sistema pasa los socios a este estado al cobrar y quedar sin cuotas vencidas |
| `null` | Estado normal — no participa de la lógica automática (ej. CADETE_HONORIFICO, JUBILADO, BAJA, etc.) |

**Restricción operativa:** debe haber a lo sumo 1 estado con `BLOQUEADO` y 1 con `AL_DIA` por tenant. La validación es responsabilidad del frontend (no es DB constraint).

El switch existente `EstadoSocio.permiteIngresoMolinete` se mantiene como ya estaba — el estado `BLOQUEADO` debería tenerlo en `false`, el `AL_DIA` en `true`.

### Tabla `auditoria_socio`
Histórico genérico de eventos del socio. Eventos canónicos:

| Evento | Disparador |
|---|---|
| `ALTA_SOCIO` | POST /admin/socios |
| `BAJA_SOCIO` | POST /admin/socios/:id/desactivar |
| `REACTIVADO_SOCIO` | POST /admin/socios/:id/activar |
| `BLOQUEADO_MOROSIDAD` | Cron de bloqueo o hook tras pago insuficiente |
| `ACTIVADO_PAGO` | Hook tras pago que salda cuotas vencidas |
| `EMAIL_MOD`, `CELULAR_MOD`, `TELEFONO_MOD` | PUT /admin/socios/:id |
| `DIRECCION_MOD` | PUT /admin/socios/:id (cualquier campo de dirección) |
| `TIPO_SOCIO_MOD`, `ESTADO_SOCIO_MOD`, `CATEGORIA_MOD` | PUT /admin/socios/:id |
| `INSCRIPCION_ACT` | POST /admin/inscripciones |
| `BAJA_INSCRIPCION` | DELETE /admin/inscripciones/:id |

Estructura: `{ socioId, fecha, evento, detalle (Json), origen ('UI'|'CRON'|'API'|'IMPORT'), usuarioId, tenantId }`.

## Configuración por tenant (tabla `Configuracion`)

### Switches principales

| Clave | Default | Función |
|---|---|---|
| `MOROSIDAD_BLOQUEO_AUTO_ACTIVO` | `false` | Activa el cron de bloqueo |
| `MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO` | `false` | Activa el cron de notificación |
| `MOROSIDAD_NOTIF_CONFIRMADO` | `false` | **Doble llave**: además del switch, requiere confirmación explícita para enviar avisos reales. Sin esto, el cron no envía nada aunque el switch principal esté activo. |

### Throttling (notificación)

| Clave | Default | Función |
|---|---|---|
| `MOROSIDAD_NOTIF_MAX_POR_HORA` | `30` | Cap de envíos por hora por tenant |
| `MOROSIDAD_NOTIF_MAX_POR_DIA` | `200` | Cap de envíos por día por tenant |
| `MOROSIDAD_NOTIF_HORA_INICIO` | `9` | Inicio de la ventana de envío (0-23) |
| `MOROSIDAD_NOTIF_HORA_FIN` | `18` | Fin (exclusive) de la ventana (0-23) |
| `MOROSIDAD_NOTIF_DELAY_MS` | `4000` | Delay base entre envíos (con jitter ±50%) |

### Variables de entorno (kill switch global)

| Variable | Función |
|---|---|
| `NOTIFICACIONES_VIGENCIA_KILL_SWITCH=true` | **Stop de emergencia**: si está activa, ignora todo y no envía nada en ningún tenant. Para usar en caso de detectar problema masivo. |

**Nota:** las claves no necesitan estar presentes en `Configuracion` — si faltan se interpretan como su valor default (mayoría: `false`). Para activar el feature, crear las filas explícitamente.

## Crons

### Cron 1: Bloqueo automático
- Schedule: **1:00 AM** todos los días (Argentina)
- Switch: `MOROSIDAD_BLOQUEO_AUTO_ACTIVO`
- Acción: para cada tenant con el switch activo, ejecuta `recalcularTenant`:
  - Identifica grupos familiares con cuotas PENDIENTES vencidas
  - Bloquea todos los socios de esa familia (titular + miembros)
  - Reactiva socios que tenían bloqueado y ya no tienen cuotas vencidas

### Cron 2: Notificación de bloqueo
- Schedule: **cada hora 9-18 Argentina** (al `:00` de cada hora dentro de la ventana)
- 5 gates de seguridad antes de enviar:
  1. Env `NOTIFICACIONES_VIGENCIA_KILL_SWITCH` no debe estar en `true`
  2. Tenant `MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO=true`
  3. Tenant `MOROSIDAD_NOTIF_CONFIRMADO=true` (doble llave)
  4. Hora actual dentro de la ventana `[MOROSIDAD_NOTIF_HORA_INICIO, MOROSIDAD_NOTIF_HORA_FIN)`
  5. Cap horario y diario aún no alcanzados
- Acción: busca eventos `BLOQUEADO_MOROSIDAD` de las últimas 36 horas no notificados, hasta consumir el presupuesto horario/diario. Envía email y/o WhatsApp al socio con plantilla rotativa (4 variantes por canal).
- Throttling: `MOROSIDAD_NOTIF_DELAY_MS` (default 4s) entre envíos, con jitter aleatorio ±50%.
- Marca el evento con `detalle.notificadoEn` para no repetir.
- Registra `NOTIFICACION_BLOQUEO_ENVIADA` en auditoría — usado para los caps.
- **Respeta `MODO_DEMO`** — si el tenant está en modo demo, los emails se redirigen a `EMAIL_DEMO` y los WhatsApp a `WHATSAPP_DEMO_NUMERO`. Es transparente: los wrappers `enviarEmail()` y `enviarWhatsApp()` ya lo manejan.
- Respeta `Socio.notificarMorosidad`, `Socio.notifEmail`, `Socio.notifWhatsapp` (opt-outs por socio).

### Anti-ban WhatsApp (mitigaciones aplicadas)
- **4 plantillas rotativas** por canal (determinístico por socioId — el mismo socio recibe siempre la misma variante para coherencia)
- **Personalización**: nombre + nº de socio en cada mensaje
- **Throttling configurable**: delay + jitter aleatorio ±50%
- **Spread temporal**: el cron corre cada hora 9-18, no de un solo golpe
- **Caps duros**: por hora y por día, configurables
- **Doble llave de habilitación**: dos switches independientes para evitar activación accidental
- **Kill switch global**: variable de entorno para detener todo de inmediato

## Hook tras cobranza
En `POST /admin/pagos`, después de crear el pago:
- Llama `recalcularFamiliaDeSocio(req.db, tenantId, socioId)`
- Si la familia ya no tiene cuotas vencidas y está en estado BLOQUEADO → pasa a AL_DIA
- Si todavía tiene vencidas → no se toca (ya estaba bloqueada o el cron lo manejará)

## Endpoint de consulta
- `GET /admin/socios/:id/auditoria?limit=100&offset=0&evento=BLOQUEADO_MOROSIDAD`
- Devuelve historial paginado con datos del usuario que disparó cada evento.

## Setup inicial (paso a paso)

1. **Configurar EstadoSocio en el tenant**:
   - Marcar el estado "Activo" / "Vigente" con `rolVigencia='AL_DIA'`, `permiteIngresoMolinete=true`
   - Crear (o marcar) un estado "Suspendido por morosidad" con `rolVigencia='BLOQUEADO'`, `permiteIngresoMolinete=false`

2. **Activar los switches** (desde Configuración):
   - `MOROSIDAD_BLOQUEO_AUTO_ACTIVO=true` para arrancar el cron de bloqueo
   - Para enviar avisos: ambos `MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO=true` Y `MOROSIDAD_NOTIF_CONFIRMADO=true` (doble llave)
   - Ajustar caps si querés más/menos volumen: `MOROSIDAD_NOTIF_MAX_POR_HORA`, `MOROSIDAD_NOTIF_MAX_POR_DIA`

3. **(Opcional) Verificar modo demo** antes de activar notificaciones en producción:
   - Revisar `MODO_DEMO`, `EMAIL_DEMO`, `WHATSAPP_DEMO_NUMERO`

4. **Sembrado retroactivo**: el primer cron (1 AM siguiente) procesará todos los socios. Si querés correrlo manualmente antes:
```js
// Desde un script o REPL
import { ejecutarBloqueoMorosidad } from './src/jobs/vigenciaSocios.js'
await ejecutarBloqueoMorosidad()
```

## Servicios reutilizables

```js
// services/auditoriaService.js
import { registrarEvento, registrarCambiosSocio, CAMPOS_AUDITABLES_SOCIO } from './services/auditoriaService.js'

// services/vigenciaService.js
import {
  getEstadosVigencia,         // -> { bloqueado, alDia }
  getFamiliasConMorosidad,    // -> Map<titularId, { miembrosIds }>
  recalcularTenant,           // recalcula todo el tenant
  recalcularFamiliaDeSocio,   // recalcula 1 familia (uso post-pago)
} from './services/vigenciaService.js'
```

## Reversibilidad

- Cambios en `EstadoSocio.rolVigencia`: solo afectan al cron, no destructivos. Setear a `null` desactiva la lógica.
- Bloqueo/reactivación automática: actualiza `Socio.estadoSocioId`. Para revertir un bloqueo puntual, basta cambiar el estado del socio manualmente desde la UI; el cron volverá a recalcular al siguiente run.
- Tabla `auditoria_socio`: append-only. Para limpiar (no recomendado), `DELETE FROM auditoria_socio WHERE evento='...'`.
