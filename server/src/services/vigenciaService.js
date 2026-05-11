/**
 * Servicio de vigencia de socios (bloqueo/reactivación por morosidad).
 *
 * Lógica:
 *   - El tenant define dos EstadoSocio especiales vía `rolVigencia`:
 *       'BLOQUEADO' = al que pasan los socios cuando tienen cuota vencida
 *       'AL_DIA'    = al que pasan los socios cuando se ponen al día
 *   - Una cuota vencida en CUALQUIER miembro del grupo familiar bloquea a
 *     toda la familia (titular + miembros).
 *   - Días de gracia (`Configuracion.MOROSIDAD_DIAS_GRACIA`, default 0):
 *     una cuota cuenta como vencida sólo si `fechaVencimiento < hoy - gracia`.
 *
 * El servicio NO consulta `Configuracion.MOROSIDAD_BLOQUEO_AUTO_ACTIVO` —
 * eso lo hace el caller (cron). Si el caller decide ejecutar, el servicio
 * actúa.
 */

import { registrarEvento } from './auditoriaService.js'

/**
 * Lee MOROSIDAD_DIAS_GRACIA del tenant. Default 0 si no está seteada o es inválida.
 */
export async function getDiasGracia(prisma, tenantId) {
  const cfg = await prisma.configuracion.findFirst({
    where: { tenantId, clave: 'MOROSIDAD_DIAS_GRACIA' },
    select: { valor: true },
  })
  const n = parseInt(cfg?.valor, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Calcula la fecha de corte efectiva restando los días de gracia.
 * Una cuota se considera vencida sólo si `fechaVencimiento < cutoff`.
 */
function aplicarDiasGracia(fechaCorte, diasGracia) {
  if (!diasGracia) return fechaCorte
  const d = new Date(fechaCorte)
  d.setDate(d.getDate() - diasGracia)
  return d
}

/**
 * Obtiene los EstadoSocio especiales (rolVigencia) del tenant.
 * @returns {Promise<{ bloqueado: EstadoSocio|null, alDia: EstadoSocio|null }>}
 */
export async function getEstadosVigencia(prisma, tenantId) {
  const estados = await prisma.estadoSocio.findMany({
    where: { tenantId, rolVigencia: { in: ['BLOQUEADO', 'AL_DIA'] } },
    select: { id: true, codigo: true, nombre: true, rolVigencia: true },
  })
  return {
    bloqueado: estados.find(e => e.rolVigencia === 'BLOQUEADO') || null,
    alDia:     estados.find(e => e.rolVigencia === 'AL_DIA') || null,
  }
}

/**
 * Para un tenant, devuelve los grupos familiares que tienen al menos una
 * cuota vencida. Una "familia" es: el titular + todos sus miembros (vínculo
 * via Socio.titularFamiliaId). Para socios sin grupo familiar, el "titular"
 * es el mismo socio.
 *
 * @returns {Promise<Map<number, { titularId, miembrosIds: number[] }>>}
 */
export async function getFamiliasConMorosidad(prisma, tenantId, { fechaCorte = new Date(), diasGracia = null } = {}) {
  const gracia = diasGracia ?? await getDiasGracia(prisma, tenantId)
  const cutoff = aplicarDiasGracia(fechaCorte, gracia)
  // 1) Socios con cuota vencida
  const cargosVencidos = await prisma.cargo.findMany({
    where: {
      tenantId,
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: cutoff },
      socioId: { not: null },
    },
    select: { socioId: true },
    distinct: ['socioId'],
  })
  const morososIndividuales = new Set(cargosVencidos.map(c => c.socioId))
  if (morososIndividuales.size === 0) return new Map()

  // 2) Resolver familia: para cada moroso, obtener su titularFamiliaId (si
  //    es titular, su propio id es el "titular" de la familia)
  const morososData = await prisma.socio.findMany({
    where: { id: { in: [...morososIndividuales] } },
    select: { id: true, titularFamiliaId: true },
  })
  const titularesAfectados = new Set()
  for (const s of morososData) {
    titularesAfectados.add(s.titularFamiliaId || s.id)
  }

  // 3) Para cada titular afectado, obtener todos los miembros
  const familiares = await prisma.socio.findMany({
    where: {
      tenantId,
      OR: [
        { id: { in: [...titularesAfectados] } },
        { titularFamiliaId: { in: [...titularesAfectados] } },
      ],
    },
    select: { id: true, titularFamiliaId: true },
  })

  const familias = new Map() // titularId → { titularId, miembrosIds: [] }
  for (const t of titularesAfectados) {
    familias.set(t, { titularId: t, miembrosIds: [] })
  }
  for (const f of familiares) {
    const tit = f.titularFamiliaId || f.id
    if (familias.has(tit)) {
      familias.get(tit).miembrosIds.push(f.id)
    }
  }
  return familias
}

/**
 * Para un tenant, devuelve el set de socioIds de todas las familias en estado
 * BLOQUEADO actualmente.
 */
export async function getSociosEnBloqueado(prisma, tenantId, estadoBloqueadoId) {
  if (!estadoBloqueadoId) return new Set()
  const socios = await prisma.socio.findMany({
    where: { tenantId, estadoSocioId: estadoBloqueadoId },
    select: { id: true },
  })
  return new Set(socios.map(s => s.id))
}

/**
 * Recalcula vigencia para TODO el tenant.
 *   - Bloquea familias con morosidad.
 *   - Reactiva familias que tenían bloqueado y ahora están al día.
 *
 * @returns {Promise<{
 *   bloqueados: number,
 *   reactivados: number,
 *   familiasMorosas: number,
 *   skip?: string
 * }>}
 */
export async function recalcularTenant(prisma, tenantId, { origen = 'CRON', usuarioId = null, fechaCorte = new Date(), diasGracia = null } = {}) {
  const estados = await getEstadosVigencia(prisma, tenantId)
  if (!estados.bloqueado || !estados.alDia) {
    return {
      bloqueados: 0, reactivados: 0, familiasMorosas: 0,
      skip: `Faltan EstadoSocio con rolVigencia='BLOQUEADO' (${estados.bloqueado ? 'OK' : 'falta'}) y/o 'AL_DIA' (${estados.alDia ? 'OK' : 'falta'})`,
    }
  }

  const gracia = diasGracia ?? await getDiasGracia(prisma, tenantId)
  const familiasMorosas = await getFamiliasConMorosidad(prisma, tenantId, { fechaCorte, diasGracia: gracia })
  const sociosABloquear = new Set()
  for (const f of familiasMorosas.values()) {
    for (const id of f.miembrosIds) sociosABloquear.add(id)
  }

  const sociosBloqueados = await getSociosEnBloqueado(prisma, tenantId, estados.bloqueado.id)

  // A bloquear: socios morosos que NO están ya en BLOQUEADO
  const aBloquear = [...sociosABloquear].filter(id => !sociosBloqueados.has(id))
  // A reactivar: socios en BLOQUEADO que ya NO están en familias morosas
  const aReactivar = [...sociosBloqueados].filter(id => !sociosABloquear.has(id))

  // Aplicar cambios
  if (aBloquear.length > 0) {
    await prisma.socio.updateMany({
      where: { id: { in: aBloquear } },
      data: { estadoSocioId: estados.bloqueado.id },
    })
    for (const socioId of aBloquear) {
      await registrarEvento(prisma, {
        socioId, tenantId,
        evento: 'BLOQUEADO_MOROSIDAD',
        detalle: { estadoNuevoId: estados.bloqueado.id, estadoNuevoCodigo: estados.bloqueado.codigo },
        origen, usuarioId,
      })
    }
  }

  if (aReactivar.length > 0) {
    await prisma.socio.updateMany({
      where: { id: { in: aReactivar } },
      data: { estadoSocioId: estados.alDia.id },
    })
    for (const socioId of aReactivar) {
      await registrarEvento(prisma, {
        socioId, tenantId,
        evento: 'ACTIVADO_PAGO',
        detalle: { estadoNuevoId: estados.alDia.id, estadoNuevoCodigo: estados.alDia.codigo },
        origen, usuarioId,
      })
    }
  }

  return {
    bloqueados: aBloquear.length,
    reactivados: aReactivar.length,
    familiasMorosas: familiasMorosas.size,
  }
}

/**
 * Recalcula vigencia de UNA familia específica. Útil después de un pago.
 * Si la familia ya no tiene cuotas vencidas y está en BLOQUEADO → pasa a AL_DIA.
 * Si tiene cuotas vencidas y NO está en BLOQUEADO → pasa a BLOQUEADO.
 */
export async function recalcularFamiliaDeSocio(prisma, tenantId, socioId, { origen = 'API', usuarioId = null, fechaCorte = new Date(), diasGracia = null } = {}) {
  const estados = await getEstadosVigencia(prisma, tenantId)
  if (!estados.bloqueado || !estados.alDia) {
    return { skip: 'Tenant no tiene EstadoSocio con rolVigencia configurado' }
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { id: true, titularFamiliaId: true },
  })
  if (!socio) return { skip: 'Socio no existe' }

  const titularId = socio.titularFamiliaId || socio.id
  const miembros = await prisma.socio.findMany({
    where: {
      tenantId,
      OR: [{ id: titularId }, { titularFamiliaId: titularId }],
    },
    select: { id: true, estadoSocioId: true },
  })
  const miembrosIds = miembros.map(m => m.id)

  const gracia = diasGracia ?? await getDiasGracia(prisma, tenantId)
  const cutoff = aplicarDiasGracia(fechaCorte, gracia)
  const tieneVencidas = await prisma.cargo.count({
    where: {
      tenantId,
      socioId: { in: miembrosIds },
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: cutoff },
    },
  })

  let bloqueados = 0, reactivados = 0
  if (tieneVencidas > 0) {
    // Bloquear los que NO están bloqueados
    const aBloquear = miembros.filter(m => m.estadoSocioId !== estados.bloqueado.id).map(m => m.id)
    if (aBloquear.length > 0) {
      await prisma.socio.updateMany({ where: { id: { in: aBloquear } }, data: { estadoSocioId: estados.bloqueado.id } })
      for (const sid of aBloquear) {
        await registrarEvento(prisma, {
          socioId: sid, tenantId,
          evento: 'BLOQUEADO_MOROSIDAD',
          detalle: { estadoNuevoId: estados.bloqueado.id, estadoNuevoCodigo: estados.bloqueado.codigo, motivo: 'cuota_vencida_familia' },
          origen, usuarioId,
        })
      }
      bloqueados = aBloquear.length
    }
  } else {
    // Reactivar los que están en BLOQUEADO
    const aReactivar = miembros.filter(m => m.estadoSocioId === estados.bloqueado.id).map(m => m.id)
    if (aReactivar.length > 0) {
      await prisma.socio.updateMany({ where: { id: { in: aReactivar } }, data: { estadoSocioId: estados.alDia.id } })
      for (const sid of aReactivar) {
        await registrarEvento(prisma, {
          socioId: sid, tenantId,
          evento: 'ACTIVADO_PAGO',
          detalle: { estadoNuevoId: estados.alDia.id, estadoNuevoCodigo: estados.alDia.codigo },
          origen, usuarioId,
        })
      }
      reactivados = aReactivar.length
    }
  }

  return { bloqueados, reactivados, tieneVencidas, miembros: miembros.length }
}
