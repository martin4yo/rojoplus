/**
 * Helpers para resolver el período de alta de cuotas según el día de corte configurado.
 *
 * Regla: si la fecha de alta es <= DIA_CORTE_CUOTAS → cuota del mes corriente.
 *        si es > DIA_CORTE_CUOTAS → cuota del mes siguiente.
 *
 * El día de corte se configura en la tabla `configuracion` (clave DIA_CORTE_CUOTAS).
 * Si no está cargado, se usa el día 20 por defecto.
 */

const DEFAULT_DIA_CORTE = 20

/** Lee el día de corte de la configuración del tenant. */
export async function obtenerDiaCorte(db) {
  try {
    const cfg = await db.configuracion.findFirst({
      where: { clave: 'DIA_CORTE_CUOTAS' }
    })
    const valor = parseInt(cfg?.valor)
    if (!valor || valor < 1 || valor > 31) return DEFAULT_DIA_CORTE
    return valor
  } catch {
    return DEFAULT_DIA_CORTE
  }
}

/**
 * Devuelve el período (mes/año) que corresponde para el alta según el día de corte.
 * Si el período no existe, lo crea con vencimiento el día 10 del mes siguiente.
 *
 * @param {*} db        Cliente Prisma del tenant (req.db).
 * @param {Date} [fechaAlta=new Date()]  Fecha real del alta.
 * @returns {Promise<{id, mes, anio, nombre, fechaVencimiento, estado}>} Periodo
 */
export async function resolverPeriodoAlta(db, fechaAlta = new Date()) {
  const diaCorte = await obtenerDiaCorte(db)
  let mes = fechaAlta.getMonth() + 1   // 1-12
  let anio = fechaAlta.getFullYear()

  if (fechaAlta.getDate() > diaCorte) {
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }

  let periodo = await db.periodo.findFirst({ where: { mes, anio } })
  if (!periodo) {
    const fechaVencimiento = new Date(anio, mes - 1, 10) // día 10 del mismo mes del período
    periodo = await db.periodo.create({
      data: {
        mes,
        anio,
        nombre: `${String(mes).padStart(2, '0')}/${anio}`,
        fechaVencimiento,
        estado: 'ABIERTO',
      }
    })
  }
  return periodo
}
