/**
 * Catálogo de crons automáticos del sistema.
 *
 * Cada cron tiene una clave única `key` que el sistema usa internamente,
 * y un `configKey` que es la clave en la tabla Configuracion del tenant
 * que controla si el cron está activo o no.
 *
 * Las funciones de los crons consultan esa clave antes de procesar al
 * tenant. Si la clave no existe, se asume el `defaultActivo`.
 *
 * Existe además un master switch `CRONS_PAUSADOS` que apaga TODOS los crons
 * del tenant (chequeado en notificacionService.getTenantsConCronsPausados y
 * vigenciaSocios.getTenantsActivos).
 */
export const CRONS_CATALOGO = [
  {
    key: 'CUOTAS_PROXIMAS',
    label: 'Aviso de cuotas próximas a vencer',
    descripcion: 'Notifica al socio N días antes del vencimiento (configurable en CUOTAS_PROXIMAS_DIAS, default 5).',
    horario: 'Diario · 9:00 AM',
    configKey: 'CRON_CUOTAS_PROXIMAS_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'CUOTAS_VENCIDAS',
    label: 'Aviso de cuotas vencidas hoy',
    descripcion: 'Notifica al socio el mismo día que vence la cuota.',
    horario: 'Diario · 10:00 AM',
    configKey: 'CRON_CUOTAS_VENCIDAS_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'MOROSIDAD_RECORDATORIO',
    label: 'Recordatorio de morosidad (15+ días)',
    descripcion: 'Recordatorio quincenal a socios con cuotas vencidas hace más de 15 días.',
    horario: 'Lun y Vie · 11:00 AM',
    configKey: 'CRON_MOROSIDAD_RECORDATORIO_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'CUMPLEANIOS',
    label: 'Saludo de cumpleaños',
    descripcion: 'Mensaje automático en el cumpleaños del socio (mensaje configurable).',
    horario: 'Diario · 8:00 AM',
    configKey: 'CUMPLEANIOS_ACTIVO', // legacy
    defaultActivo: false,
  },
  {
    key: 'BAJA_ASISTENCIA',
    label: 'Alerta de baja asistencia',
    descripcion: 'Email resumen al admin con socios cuya asistencia bajó.',
    horario: 'Lun · 9:00 AM',
    configKey: 'ALERTA_BAJA_ASISTENCIA_ACTIVO', // legacy
    defaultActivo: false,
  },
  {
    key: 'PARTIDOS_PROXIMOS',
    label: 'Recordatorio de partidos próximos',
    descripcion: 'Aviso a convocados confirmados un día antes del partido.',
    horario: 'Diario · 18:00 PM',
    configKey: 'CRON_PARTIDOS_PROXIMOS_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'VIGENCIA_BLOQUEO',
    label: 'Bloqueo automático por morosidad',
    descripcion: 'Cambia el estado del socio a BLOQUEADO cuando entra en mora (cron de vigencia).',
    horario: 'Diario · 1:00 AM',
    configKey: 'MOROSIDAD_BLOQUEO_AUTO_ACTIVO', // legacy
    defaultActivo: false,
  },
  {
    key: 'VIGENCIA_NOTIFICACION',
    label: 'Notificación de bloqueo por morosidad',
    descripcion: 'Mensaje al socio cuando se lo bloquea por morosidad.',
    horario: 'Cada hora · 9-18',
    configKey: 'MOROSIDAD_NOTIFICACION_BLOQUEO_ACTIVO', // legacy
    defaultActivo: false,
  },
  {
    key: 'RESERVAS_RECORDATORIO',
    label: 'Recordatorio de reservas',
    descripcion: 'Aviso (email/WhatsApp) a quien tiene una reserva confirmada para mañana.',
    horario: 'Diario · 8:00 AM',
    configKey: 'CRON_RESERVAS_RECORDATORIO_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'RESERVAS_CIERRE',
    label: 'Cierre de reservas pasadas',
    descripcion: 'Marca como COMPLETADA / NO_SHOW las reservas cuya fecha ya pasó.',
    horario: 'Diario · 0:30',
    configKey: 'CRON_RESERVAS_CIERRE_ACTIVO',
    defaultActivo: true,
  },
  {
    key: 'PASAJES_SUGERENCIA',
    label: 'Sugerencia de pasajes de categoría',
    descripcion: 'Detecta socios fuera de rango de edad para sugerir pase de categoría.',
    horario: '1-dic · 8:00 AM',
    configKey: 'CRON_PASAJES_SUGERENCIA_ACTIVO',
    defaultActivo: true,
  },
]

/**
 * Devuelve true si el cron está activo para el tenant.
 * Lógica: master pause OFF + clave individual ON (o default).
 */
export async function cronActivoEnTenant(prisma, cronKey, tenantId) {
  const cron = CRONS_CATALOGO.find(c => c.key === cronKey)
  if (!cron) return false
  const [master, individual] = await Promise.all([
    prisma.configuracion.findFirst({ where: { tenantId, clave: 'CRONS_PAUSADOS' }, select: { valor: true } }),
    prisma.configuracion.findFirst({ where: { tenantId, clave: cron.configKey }, select: { valor: true } }),
  ])
  if (master?.valor === 'true') return false
  if (individual) return individual.valor === 'true'
  return cron.defaultActivo
}

/**
 * Devuelve los tenantIds que tienen el cron deshabilitado (para usar en filtros notIn).
 * Combina master pause + flag individual.
 */
export async function tenantsBloqueadosPorCron(prisma, cronKey) {
  const cron = CRONS_CATALOGO.find(c => c.key === cronKey)
  if (!cron) return []

  // 1. Tenants con master pause activo
  const conMaster = await prisma.configuracion.findMany({
    where: { clave: 'CRONS_PAUSADOS', valor: 'true' },
    select: { tenantId: true },
  })
  const bloqueados = new Set(conMaster.map(c => c.tenantId))

  // 2. Tenants con la clave individual del cron
  const conFlag = await prisma.configuracion.findMany({
    where: { clave: cron.configKey },
    select: { tenantId: true, valor: true },
  })
  const explicitos = new Map(conFlag.map(c => [c.tenantId, c.valor]))

  // 3. Si el default es false, todos los tenants SIN flag explícito están bloqueados
  if (!cron.defaultActivo) {
    const tenants = await prisma.tenant.findMany({ where: { activo: true }, select: { id: true } })
    for (const t of tenants) {
      const v = explicitos.get(t.id)
      if (v !== 'true') bloqueados.add(t.id)
    }
  } else {
    // Default true: bloqueados solo los que tienen explícitamente false
    for (const [tid, v] of explicitos) {
      if (v === 'false') bloqueados.add(tid)
    }
  }

  return [...bloqueados]
}
