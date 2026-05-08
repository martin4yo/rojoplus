/**
 * Servicio de auditoría general del Socio.
 *
 * Registra eventos en tabla `auditoria_socio`. Reutilizable desde cualquier
 * flujo (UI, cron, import, API). El `db` debe ser un PrismaClient con tenantId
 * resuelto (req.db) o un PrismaClient global cuando se usa desde cron/scripts.
 *
 * Eventos canónicos (extender según necesidad):
 *   - BLOQUEADO_MOROSIDAD     - cron de vigencia bloqueó al socio
 *   - ACTIVADO_PAGO           - socio reactivado tras pago
 *   - ALTA_SOCIO              - socio dado de alta
 *   - BAJA_SOCIO              - socio dado de baja
 *   - TELEFONO_MOD, EMAIL_MOD, CELULAR_MOD, DIRECCION_MOD
 *   - TIPO_SOCIO_MOD, ESTADO_SOCIO_MOD, CATEGORIA_MOD
 *   - INSCRIPCION_ACT         - alta de inscripción a actividad
 *   - BAJA_INSCRIPCION        - baja de inscripción
 *
 * Uso típico:
 *   await registrarEvento(req.db, {
 *     socioId, tenantId, evento: 'EMAIL_MOD',
 *     detalle: { antes: oldEmail, despues: newEmail },
 *     origen: 'UI', usuarioId: req.admin.id,
 *   })
 */

/**
 * Registra un evento de auditoría.
 *
 * @param {PrismaClient} db - cliente prisma (req.db o global)
 * @param {object} args
 * @param {number} args.socioId
 * @param {number} args.tenantId
 * @param {string} args.evento - código del evento
 * @param {any} [args.detalle] - JSON serializable
 * @param {string} [args.origen] - 'UI' | 'CRON' | 'API' | 'IMPORT'
 * @param {number|null} [args.usuarioId]
 * @returns {Promise<void>} - no falla la operación principal si la auditoría tira error
 */
export async function registrarEvento(db, { socioId, tenantId, evento, detalle, origen, usuarioId }) {
  if (!db || !socioId || !tenantId || !evento) {
    console.warn('[auditoriaService] llamada inválida:', { socioId, tenantId, evento })
    return
  }
  try {
    await db.auditoriaSocio.create({
      data: {
        socioId,
        tenantId,
        evento,
        detalle: detalle ?? undefined,
        origen: origen || null,
        usuarioId: usuarioId ?? null,
      },
    })
  } catch (err) {
    // No queremos que un fallo de auditoría tire la operación principal.
    console.error(`[auditoriaService] error registrando ${evento} para socio ${socioId}:`, err.message)
  }
}

/**
 * Compara dos objetos y devuelve los pares de campos cambiados.
 * Útil para construir el `detalle` cuando se hace un PUT con varios campos.
 *
 * @param {object} antes
 * @param {object} despues
 * @param {string[]} campos - lista de campos a comparar
 * @returns {object|null} { campo1: { antes, despues }, ... } o null si no hay cambios
 */
export function diffCampos(antes, despues, campos) {
  const diff = {}
  for (const c of campos) {
    const a = antes?.[c] ?? null
    const d = despues?.[c] ?? null
    if (a !== d) diff[c] = { antes: a, despues: d }
  }
  return Object.keys(diff).length > 0 ? diff : null
}

/**
 * Mapeo de campos críticos del Socio → evento canónico.
 * Si un PUT modifica varios de estos, registra un evento por cada uno.
 */
export const CAMPOS_AUDITABLES_SOCIO = {
  email: 'EMAIL_MOD',
  emailSecundario: 'EMAIL_MOD',
  celular: 'CELULAR_MOD',
  celularSecundario: 'CELULAR_MOD',
  telefonoFijo: 'TELEFONO_MOD',
  calle: 'DIRECCION_MOD',
  numero: 'DIRECCION_MOD',
  piso: 'DIRECCION_MOD',
  depto: 'DIRECCION_MOD',
  barrio: 'DIRECCION_MOD',
  ciudad: 'DIRECCION_MOD',
  provincia: 'DIRECCION_MOD',
  codigoPostal: 'DIRECCION_MOD',
  tipoSocioRelId: 'TIPO_SOCIO_MOD',
  estadoSocioId: 'ESTADO_SOCIO_MOD',
  categoriaSocioId: 'CATEGORIA_MOD',
}

/**
 * A partir del diff de campos, registra los eventos correspondientes
 * agrupando por tipo de evento (DIRECCION_MOD agrupa todos los campos de
 * dirección en un solo registro).
 */
export async function registrarCambiosSocio(db, { socioId, tenantId, antes, despues, origen, usuarioId }) {
  const campos = Object.keys(CAMPOS_AUDITABLES_SOCIO)
  const diff = diffCampos(antes, despues, campos)
  if (!diff) return

  // Agrupar por evento
  const porEvento = {}
  for (const [campo, cambio] of Object.entries(diff)) {
    const ev = CAMPOS_AUDITABLES_SOCIO[campo]
    if (!porEvento[ev]) porEvento[ev] = {}
    porEvento[ev][campo] = cambio
  }

  for (const [evento, detalle] of Object.entries(porEvento)) {
    await registrarEvento(db, { socioId, tenantId, evento, detalle, origen, usuarioId })
  }
}
