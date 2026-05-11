/**
 * Helpers para obtener (y crear si no existen) los TipoSocio especiales
 * usados al aprobar solicitudes de socio con grupo familiar.
 *
 * Códigos estables (no traducir):
 *   - TITULAR_FAMILIA  → Titular de un grupo familiar
 *   - MIEMBRO_FAMILIA  → Miembro (no titular) de un grupo familiar
 *
 * `db` es el cliente Prisma extendido por tenant (req.db). El tenantId se
 * resuelve solo: la extensión inyecta el filtro y lo agrega al data del create.
 */

async function getOrCreate(db, { codigo, nombre, descripcion, orden }) {
  const existente = await db.tipoSocio.findFirst({ where: { codigo } })
  if (existente) return existente
  return db.tipoSocio.create({
    data: { codigo, nombre, descripcion, orden, color: 'blue', activo: true },
  })
}

export function getTipoSocioTitularFamilia(db) {
  return getOrCreate(db, {
    codigo: 'TITULAR_FAMILIA',
    nombre: 'Titular Familia',
    descripcion: 'Socio titular de un grupo familiar',
    orden: 10,
  })
}

export function getTipoSocioMiembroFamilia(db) {
  return getOrCreate(db, {
    codigo: 'MIEMBRO_FAMILIA',
    nombre: 'Miembro Familia',
    descripcion: 'Miembro de un grupo familiar',
    orden: 11,
  })
}
