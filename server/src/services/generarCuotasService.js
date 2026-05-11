/**
 * Servicio de generación de cuotas por período.
 *
 * Dos modos:
 *   - calcularCuotas(db, periodoId, filtros): calcula los cargos a generar
 *     SIN persistir. Devuelve datos enriquecidos (socio, tipo, categoría,
 *     actividad, etc.) para mostrar en la vista previa.
 *   - commitCuotas(db, periodoId, claves, adminId): vuelve a calcular,
 *     filtra por las claves recibidas y persiste solo esas. Esto garantiza
 *     que se aplique el estado actual de la BD aunque haya cambiado entre
 *     el preview y la confirmación.
 *
 * Una "clave" identifica unívocamente un cargo a generar:
 *   - Para CUOTA_SOCIAL:   `{socioId}|CUOTA_SOCIAL`
 *   - Para CUOTA_ACTIVIDAD:`{socioId}|CUOTA_ACTIVIDAD|{categoriaActividadId}`
 */

function claveCuotaSocial(socioId) {
  return `${socioId}|CUOTA_SOCIAL`
}

function claveCuotaActividad(socioId, categoriaActividadId) {
  return `${socioId}|CUOTA_ACTIVIDAD|${categoriaActividadId}`
}

/**
 * Aplica los filtros opcionales a un socio.
 * Retorna true si el socio "pasa".
 */
function pasaFiltrosSocio(socio, filtros) {
  if (!filtros) return true
  if (filtros.socioIds?.length && !filtros.socioIds.includes(socio.id)) return false
  if (filtros.tipoSocioIds?.length && !filtros.tipoSocioIds.includes(socio.tipoSocioRelId)) return false
  if (filtros.categoriaSocioIds?.length && !filtros.categoriaSocioIds.includes(socio.categoriaSocioId)) return false
  return true
}

function pasaFiltrosActividad(inscripcion, filtros) {
  if (!filtros) return true
  const cat = inscripcion.categoriaActividad
  if (filtros.actividadIds?.length && !filtros.actividadIds.includes(cat.actividadId)) return false
  if (filtros.categoriaActividadIds?.length && !filtros.categoriaActividadIds.includes(cat.id)) return false
  return true
}

/**
 * Calcula cuotas a generar para un periodo.
 *
 * @returns {Object} { cargos: [...], totales: {...}, advertencias: [...] }
 *   cargos[]: cada uno con todos los datos para persistir + campos extra
 *             (clave, socioNombre, tipoSocioNombre, categoriaSocioNombre,
 *              actividadNombre, categoriaActividadNombre).
 */
export async function calcularCuotas(db, periodoId, filtros = {}) {
  const periodo = await db.periodo.findUnique({ where: { id: periodoId } })
  if (!periodo) throw new Error('Periodo no encontrado')

  // Cargos ya existentes en este periodo (para marcar como ya generados)
  const [cargosCuotaSocial, cargosCuotaActividad] = await Promise.all([
    db.cargo.findMany({
      where: { periodoId: periodo.id, categoria: 'CUOTA_SOCIAL' },
      select: { id: true, socioId: true, montoOriginal: true, montoBonificacion: true, montoTotal: true, estado: true },
    }),
    db.cargo.findMany({
      where: { periodoId: periodo.id, categoria: 'CUOTA_ACTIVIDAD' },
      select: { id: true, socioId: true, categoriaActividadId: true, montoOriginal: true, montoBonificacion: true, montoTotal: true, estado: true },
    }),
  ])
  const cargoSocialPorSocio = new Map(cargosCuotaSocial.map(c => [c.socioId, c]))
  const cargoActividadPorClave = new Map(cargosCuotaActividad.map(c => [`${c.socioId}-${c.categoriaActividadId}`, c]))

  // Socios activos
  const socios = await db.socio.findMany({
    where: { estadoSocioRel: { esSocioActivo: true } },
    include: {
      tipoSocioRel: { include: { conceptoTesoreria: true } },
      categoriaSocioRel: true,
      _count: { select: { miembrosFamilia: true } },
      inscripciones: {
        where: { estado: 'ACTIVA' },
        include: {
          categoriaActividad: {
            include: { actividad: { include: { conceptoTesoreria: true } } },
          },
        },
      },
    },
  })

  const cargos = []
  const advertencias = {
    sociosSaltadosYaConCuota: 0,
    inscripcionesSaltadasYaConCargo: 0,
    sociosNoTitulares: 0,
    sociosSinCuotaMensual: 0,
    sociosFiltrados: 0,
  }

  const incluirCuotaSocial = filtros.soloCuotaActividad !== true
  const incluirCuotaActividad = filtros.soloCuotaSocial !== true

  for (const socio of socios) {
    if (!pasaFiltrosSocio(socio, filtros)) {
      advertencias.sociosFiltrados++
      continue
    }

    const descuentoPct = socio.categoriaSocioRel?.porcentajeDescuento
      ? Number(socio.categoriaSocioRel.porcentajeDescuento)
      : 0

    const esTitularOUnico = !socio.titularFamiliaId
    const cargoSocialExistente = cargoSocialPorSocio.get(socio.id)
    const yaTeníaCuotaSocial = !!cargoSocialExistente

    if (!esTitularOUnico) advertencias.sociosNoTitulares++

    const cuotaSocialMonto = socio.tipoSocioRel?.conceptoTesoreria?.cuotaMensual
      ? Number(socio.tipoSocioRel.conceptoTesoreria.cuotaMensual)
      : Number(socio.tipoSocioRel?.cuotaMensual || 0)

    if (!cuotaSocialMonto) advertencias.sociosSinCuotaMensual++

    const datosSocioBase = {
      socioNombre: `${socio.apellido}, ${socio.nombre}`.trim(),
      socioNumero: socio.nroSocio,
      tipoSocioId: socio.tipoSocioRelId,
      tipoSocioNombre: socio.tipoSocioRel?.nombre || null,
      categoriaSocioId: socio.categoriaSocioId,
      categoriaSocioNombre: socio.categoriaSocioRel?.nombre || null,
    }

    // === CUOTA SOCIAL ===
    if (incluirCuotaSocial && yaTeníaCuotaSocial) {
      // Ya generada — incluir como informativa, no se regenera
      advertencias.sociosSaltadosYaConCuota++
      cargos.push({
        clave: claveCuotaSocial(socio.id),
        yaGenerado: true,
        cargoExistenteId: cargoSocialExistente.id,
        cargoExistenteEstado: cargoSocialExistente.estado,
        ...datosSocioBase,
        actividadId: null,
        actividadNombre: null,
        categoriaActividadId: null,
        categoriaActividadNombre: null,
        conceptoLabel: 'Cuota Social',
        categoria: 'CUOTA_SOCIAL',
        montoOriginal: Number(cargoSocialExistente.montoOriginal),
        montoBonificacion: Number(cargoSocialExistente.montoBonificacion),
        montoTotal: Number(cargoSocialExistente.montoTotal),
      })
    } else if (incluirCuotaSocial && esTitularOUnico && cuotaSocialMonto) {
      const montoBase = cuotaSocialMonto
      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion

      if (montoTotal > 0) {
        const esTitularDeFamilia = (socio._count?.miembrosFamilia || 0) > 0
        const tipoCuota = esTitularDeFamilia ? 'GRUPO_FAMILIAR' : 'SOCIO_UNICO'

        cargos.push({
          clave: claveCuotaSocial(socio.id),
          yaGenerado: false,
          // Datos enriquecidos (preview)
          ...datosSocioBase,
          actividadId: null,
          actividadNombre: null,
          categoriaActividadId: null,
          categoriaActividadNombre: null,
          conceptoLabel: 'Cuota Social',
          // Datos para persistir
          periodoId: periodo.id,
          socioId: socio.id,
          grupoFamiliarId: socio.titularFamiliaId || socio.id,
          categoria: 'CUOTA_SOCIAL',
          tipoCuota,
          conceptoTesoreriaId: socio.tipoSocioRel?.conceptoTesoreriaId || null,
          descripcion: `Cuota Social - ${tipoCuota === 'GRUPO_FAMILIAR' ? 'Grupo Familiar' : 'Socio Único'}`,
          montoOriginal: montoBase,
          montoBonificacion,
          montoTotal,
          estado: 'PENDIENTE',
          fechaVencimiento: periodo.fechaVencimiento,
          origen: 'GENERACION_MASIVA',
          motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
        })
      }
    }

    // === CUOTAS DE ACTIVIDAD ===
    if (!incluirCuotaActividad) continue

    for (const inscripcion of socio.inscripciones) {
      if (inscripcion.exentoCuota) continue
      if (!pasaFiltrosActividad(inscripcion, filtros)) continue

      const categoria = inscripcion.categoriaActividad
      const actividad = categoria.actividad
      const claveAct = `${socio.id}-${inscripcion.categoriaActividadId}`
      const cargoActExistente = cargoActividadPorClave.get(claveAct)

      if (cargoActExistente) {
        advertencias.inscripcionesSaltadasYaConCargo++
        cargos.push({
          clave: claveCuotaActividad(socio.id, categoria.id),
          yaGenerado: true,
          cargoExistenteId: cargoActExistente.id,
          cargoExistenteEstado: cargoActExistente.estado,
          ...datosSocioBase,
          actividadId: actividad.id,
          actividadNombre: actividad.nombre,
          categoriaActividadId: categoria.id,
          categoriaActividadNombre: categoria.nombre,
          conceptoLabel: `${actividad.nombre} - ${categoria.nombre}`,
          categoria: 'CUOTA_ACTIVIDAD',
          montoOriginal: Number(cargoActExistente.montoOriginal),
          montoBonificacion: Number(cargoActExistente.montoBonificacion),
          montoTotal: Number(cargoActExistente.montoTotal),
        })
        continue
      }

      let montoBase = actividad.conceptoTesoreria?.cuotaMensual
        ? Number(actividad.conceptoTesoreria.cuotaMensual)
        : (categoria.cuotaMensual ? Number(categoria.cuotaMensual) : (actividad.cuotaMensual ? Number(actividad.cuotaMensual) : 0))

      if (inscripcion.porcentajeCuota && Number(inscripcion.porcentajeCuota) !== 100) {
        montoBase = montoBase * (Number(inscripcion.porcentajeCuota) / 100)
      }

      if (montoBase <= 0) continue

      const montoBonificacion = montoBase * (descuentoPct / 100)
      const montoTotal = montoBase - montoBonificacion
      if (montoTotal <= 0) continue

      cargos.push({
        clave: claveCuotaActividad(socio.id, categoria.id),
        yaGenerado: false,
        ...datosSocioBase,
        actividadId: actividad.id,
        actividadNombre: actividad.nombre,
        categoriaActividadId: categoria.id,
        categoriaActividadNombre: categoria.nombre,
        conceptoLabel: `${actividad.nombre} - ${categoria.nombre}`,
        // Persistencia
        periodoId: periodo.id,
        socioId: socio.id,
        grupoFamiliarId: socio.titularFamiliaId || socio.id,
        categoria: 'CUOTA_ACTIVIDAD',
        categoriaActividadId: categoria.id,
        conceptoTesoreriaId: actividad.conceptoTesoreriaId || null,
        descripcion: `${actividad.nombre} - ${categoria.nombre}`,
        montoOriginal: montoBase,
        montoBonificacion,
        montoTotal,
        estado: 'PENDIENTE',
        fechaVencimiento: periodo.fechaVencimiento,
        origen: 'GENERACION_MASIVA',
        motivoBonificacion: descuentoPct > 0 ? `Descuento por categoría: ${descuentoPct}%` : null,
      })
    }
  }

  // Totales agregados (sólo cargos a generar — excluye los yaGenerado)
  const cargosNuevos = cargos.filter(c => !c.yaGenerado)
  const sociosUnicos = new Set(cargosNuevos.map(c => c.socioId))
  const totales = {
    cargosCount: cargosNuevos.length,
    yaGeneradosCount: cargos.length - cargosNuevos.length,
    sociosCount: sociosUnicos.size,
    montoOriginal: round(cargosNuevos.reduce((s, c) => s + c.montoOriginal, 0)),
    montoBonificacion: round(cargosNuevos.reduce((s, c) => s + c.montoBonificacion, 0)),
    montoTotal: round(cargosNuevos.reduce((s, c) => s + c.montoTotal, 0)),
    porCategoria: {
      CUOTA_SOCIAL: cargosNuevos.filter(c => c.categoria === 'CUOTA_SOCIAL').length,
      CUOTA_ACTIVIDAD: cargosNuevos.filter(c => c.categoria === 'CUOTA_ACTIVIDAD').length,
    },
  }

  return { periodo, cargos, totales, advertencias }
}

function round(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * Recalcula y persiste solo los cargos cuya clave esté en `claves`.
 * Si `claves` es null/undefined, persiste TODOS (compat legacy).
 */
export async function commitCuotas(db, periodoId, claves, adminId) {
  const { cargos } = await calcularCuotas(db, periodoId, {})

  // Sólo cargos nuevos (excluir los ya generados)
  let aPersistir = cargos.filter(c => !c.yaGenerado)
  if (Array.isArray(claves)) {
    const set = new Set(claves)
    aPersistir = aPersistir.filter(c => set.has(c.clave))
  }

  // Eliminar campos enriquecidos antes de persistir
  const dataPersistir = aPersistir.map(c => {
    const {
      clave, yaGenerado, cargoExistenteId, cargoExistenteEstado,
      socioNombre, socioNumero, tipoSocioId, tipoSocioNombre,
      categoriaSocioId, categoriaSocioNombre, actividadId, actividadNombre,
      categoriaActividadNombre, conceptoLabel, ...persistible
    } = c
    return persistible
  })

  if (dataPersistir.length > 0) {
    await db.cargo.createMany({ data: dataPersistir })
  }

  // Actualizar estado del periodo
  const totalCuotasPeriodo = await db.cargo.count({ where: { periodoId } })
  if (totalCuotasPeriodo > 0) {
    await db.periodo.update({
      where: { id: periodoId },
      data: {
        estado: 'GENERADO',
        fechaGeneracion: new Date(),
        generadoPor: adminId,
      },
    })
  }

  return {
    cuotasGeneradas: dataPersistir.length,
    clavesNoEncontradas: Array.isArray(claves)
      ? claves.filter(k => !cargos.find(c => c.clave === k))
      : [],
  }
}
