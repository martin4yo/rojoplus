import { Router } from 'express'
import * as XLSX from 'xlsx'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.use(authAdmin)

// =============================================================================
// SOCIOS POR ACTIVIDAD (con saldo deudor)
// =============================================================================
// Construye el listado de inscriptos activos por actividad/categoría, anexando
// el saldo deudor de cada socio (suma de cargos PENDIENTE + VENCIDO). Usado por
// el reporte "Socios por Actividad".
async function construirSociosPorActividad(db, query) {
  const { actividadId, categoriaActividadId, soloDeudores } = query
  const hoy = new Date()

  // Inscripciones activas = ya iniciadas y no terminadas al día de hoy.
  const whereInscripcion = {
    estado: 'ACTIVA',
    fechaInicio: { lte: hoy },
    OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }],
  }
  if (categoriaActividadId) {
    whereInscripcion.categoriaActividadId = parseInt(categoriaActividadId)
  } else if (actividadId) {
    whereInscripcion.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  const inscripciones = await db.inscripcion.findMany({
    where: whereInscripcion,
    include: {
      socio: {
        select: {
          id: true, nroSocio: true, apellidoNombre: true,
          documento: true, celular: true, email: true,
        },
      },
      categoriaActividad: {
        select: {
          id: true, nombre: true,
          actividad: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  // Saldo deudor por socio: una sola agregación para todos los socios del listado.
  const socioIds = [...new Set(inscripciones.map(i => i.socioId))]
  const deudaPorSocio = {}
  if (socioIds.length > 0) {
    const agg = await db.cargo.groupBy({
      by: ['socioId'],
      where: { socioId: { in: socioIds }, estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      _sum: { montoTotal: true },
      _count: { _all: true },
    })
    for (const a of agg) {
      deudaPorSocio[a.socioId] = {
        saldoDeudor: Math.round(Number(a._sum.montoTotal) || 0),
        cantCuotasAdeudadas: a._count?._all || 0,
      }
    }
  }

  let filas = inscripciones.map(i => {
    const deuda = deudaPorSocio[i.socioId] || { saldoDeudor: 0, cantCuotasAdeudadas: 0 }
    return {
      inscripcionId: i.id,
      socioId: i.socioId,
      nroSocio: i.socio?.nroSocio || '',
      apellidoNombre: i.socio?.apellidoNombre || '',
      documento: i.socio?.documento || '',
      celular: i.socio?.celular || '',
      email: i.socio?.email || '',
      federado: i.federado,
      actividadId: i.categoriaActividad?.actividad?.id || null,
      actividad: i.categoriaActividad?.actividad?.nombre || 'Sin actividad',
      categoriaActividadId: i.categoriaActividad?.id || null,
      categoria: i.categoriaActividad?.nombre || '',
      fechaInicio: i.fechaInicio,
      saldoDeudor: deuda.saldoDeudor,
      cantCuotasAdeudadas: deuda.cantCuotasAdeudadas,
      alDia: deuda.saldoDeudor <= 0,
    }
  })

  if (soloDeudores === 'true' || soloDeudores === '1') {
    filas = filas.filter(f => f.saldoDeudor > 0)
  }

  // Orden: actividad, categoría, apellido y nombre.
  filas.sort((a, b) =>
    a.actividad.localeCompare(b.actividad) ||
    a.categoria.localeCompare(b.categoria) ||
    a.apellidoNombre.localeCompare(b.apellidoNombre)
  )

  const totalSaldoDeudor = filas.reduce((s, f) => s + f.saldoDeudor, 0)
  const sociosDeudores = new Set(filas.filter(f => f.saldoDeudor > 0).map(f => f.socioId)).size
  const sociosUnicos = new Set(filas.map(f => f.socioId)).size

  return {
    filas,
    totales: {
      totalInscripciones: filas.length,
      sociosUnicos,
      sociosDeudores,
      sociosAlDia: sociosUnicos - sociosDeudores,
      totalSaldoDeudor: Math.round(totalSaldoDeudor),
    },
  }
}

// GET /api/admin/reportes/deportivos/socios-por-actividad
router.get('/socios-por-actividad', asyncHandler(async (req, res) => {
  const data = await construirSociosPorActividad(req.db, req.query)
  res.json({ success: true, data })
}))

// GET /api/admin/reportes/deportivos/socios-por-actividad/exportar
router.get('/socios-por-actividad/exportar', asyncHandler(async (req, res) => {
  const { filas } = await construirSociosPorActividad(req.db, req.query)

  const datos = filas.map(f => ({
    'Actividad': f.actividad,
    'Categoría': f.categoria,
    'Nro Socio': f.nroSocio,
    'Apellido y Nombre': f.apellidoNombre,
    'Documento': f.documento,
    'Teléfono': f.celular,
    'Email': f.email,
    'Saldo Deudor': f.saldoDeudor,
    'Estado': f.alDia ? 'Al día' : 'Debe',
    'Observaciones': '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(datos)
  ws['!cols'] = [
    { wch: 22 }, // Actividad
    { wch: 18 }, // Categoría
    { wch: 10 }, // Nro Socio
    { wch: 30 }, // Apellido y Nombre
    { wch: 12 }, // Documento
    { wch: 15 }, // Teléfono
    { wch: 25 }, // Email
    { wch: 14 }, // Saldo Deudor
    { wch: 10 }, // Estado
    { wch: 40 }, // Observaciones
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Socios por Actividad')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const fecha = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=socios_por_actividad_${fecha}.xlsx`)
  res.send(buffer)
}))

// =============================================================================
// REPORTE DE ASISTENCIA A ENTRENAMIENTOS
// =============================================================================

// GET /api/admin/reportes-deportivos/asistencia - Resumen de asistencia
router.get('/asistencia', asyncHandler(async (req, res) => {
  const { categoriaActividadId, actividadId, fechaDesde, fechaHasta } = req.query

  // Construir filtros
  const whereEntrenamiento = { estado: { not: 'CANCELADO' } }

  if (categoriaActividadId) {
    whereEntrenamiento.categoriaActividadId = parseInt(categoriaActividadId)
  } else if (actividadId) {
    whereEntrenamiento.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  if (fechaDesde || fechaHasta) {
    whereEntrenamiento.fecha = {}
    if (fechaDesde) whereEntrenamiento.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) whereEntrenamiento.fecha.lte = new Date(fechaHasta)
  }

  // Obtener entrenamientos con asistencias
  const entrenamientos = await req.db.entrenamiento.findMany({
    where: whereEntrenamiento,
    include: {
      categoriaActividad: {
        include: { actividad: true }
      },
      asistencias: {
        include: {
          socio: {
            select: { id: true, nroSocio: true, apellidoNombre: true }
          }
        }
      }
    },
    orderBy: { fecha: 'desc' }
  })

  // Calcular estadísticas
  const totalEntrenamientos = entrenamientos.length
  const entrenamientosConAsistencia = entrenamientos.filter(e => e.asistencias.length > 0).length

  // Agrupar asistencias por socio
  const asistenciasPorSocio = new Map()

  for (const ent of entrenamientos) {
    for (const asist of ent.asistencias) {
      const socioId = asist.socioId
      if (!asistenciasPorSocio.has(socioId)) {
        asistenciasPorSocio.set(socioId, {
          socio: asist.socio,
          presentes: 0,
          ausentes: 0,
          justificados: 0,
          tarde: 0,
          total: 0
        })
      }
      const stats = asistenciasPorSocio.get(socioId)
      stats.total++
      if (asist.estado === 'PRESENTE') stats.presentes++
      else if (asist.estado === 'AUSENTE') stats.ausentes++
      else if (asist.estado === 'JUSTIFICADO') stats.justificados++
      else if (asist.estado === 'TARDE') stats.tarde++
    }
  }

  // Convertir a array y calcular porcentajes
  const resumenPorSocio = Array.from(asistenciasPorSocio.values())
    .map(s => ({
      ...s,
      porcentajeAsistencia: s.total > 0
        ? Math.round(((s.presentes + s.tarde) / s.total) * 100)
        : 0
    }))
    .sort((a, b) => b.porcentajeAsistencia - a.porcentajeAsistencia)

  // Estadísticas globales
  const totalAsistencias = resumenPorSocio.reduce((sum, s) => sum + s.total, 0)
  const totalPresentes = resumenPorSocio.reduce((sum, s) => sum + s.presentes + s.tarde, 0)

  res.json({
    success: true,
    data: {
      resumen: {
        totalEntrenamientos,
        entrenamientosConAsistencia,
        totalJugadores: resumenPorSocio.length,
        promedioAsistencia: totalAsistencias > 0
          ? Math.round((totalPresentes / totalAsistencias) * 100)
          : 0
      },
      porSocio: resumenPorSocio,
      entrenamientos: entrenamientos.map(e => ({
        id: e.id,
        fecha: e.fecha,
        horaInicio: e.horaInicio,
        horaFin: e.horaFin,
        categoria: `${e.categoriaActividad.actividad.nombre} - ${e.categoriaActividad.nombre}`,
        totalAsistencias: e.asistencias.length,
        presentes: e.asistencias.filter(a => a.estado === 'PRESENTE' || a.estado === 'TARDE').length
      }))
    }
  })
}))

// GET /api/admin/reportes-deportivos/asistencia/socio/:socioId - Detalle de asistencia de un socio
router.get('/asistencia/socio/:socioId', asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { fechaDesde, fechaHasta } = req.query

  const whereAsistencia = { socioId: parseInt(socioId) }

  if (fechaDesde || fechaHasta) {
    whereAsistencia.entrenamiento = { fecha: {} }
    if (fechaDesde) whereAsistencia.entrenamiento.fecha.gte = new Date(fechaDesde)
    if (fechaHasta) whereAsistencia.entrenamiento.fecha.lte = new Date(fechaHasta)
  }

  const asistencias = await req.db.asistencia.findMany({
    where: whereAsistencia,
    include: {
      entrenamiento: {
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      }
    },
    orderBy: { entrenamiento: { fecha: 'desc' } }
  })

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
  })

  // Estadísticas
  const stats = {
    total: asistencias.length,
    presentes: asistencias.filter(a => a.estado === 'PRESENTE').length,
    tarde: asistencias.filter(a => a.estado === 'TARDE').length,
    ausentes: asistencias.filter(a => a.estado === 'AUSENTE').length,
    justificados: asistencias.filter(a => a.estado === 'JUSTIFICADO').length
  }
  stats.porcentajeAsistencia = stats.total > 0
    ? Math.round(((stats.presentes + stats.tarde) / stats.total) * 100)
    : 0

  res.json({
    success: true,
    data: {
      socio,
      stats,
      detalle: asistencias.map(a => ({
        fecha: a.entrenamiento.fecha,
        hora: a.entrenamiento.horaInicio,
        categoria: `${a.entrenamiento.categoriaActividad.actividad.nombre} - ${a.entrenamiento.categoriaActividad.nombre}`,
        estado: a.estado,
        horaLlegada: a.horaLlegada,
        observaciones: a.observaciones
      }))
    }
  })
}))

// =============================================================================
// ESTADÍSTICAS DE PARTIDOS
// =============================================================================

// GET /api/admin/reportes-deportivos/partidos - Resumen de partidos
router.get('/partidos', asyncHandler(async (req, res) => {
  const { categoriaActividadId, actividadId, temporada } = req.query

  const wherePartido = {}

  if (categoriaActividadId) {
    wherePartido.categoriaActividadId = parseInt(categoriaActividadId)
  } else if (actividadId) {
    wherePartido.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  if (temporada) {
    const anio = parseInt(temporada)
    wherePartido.fecha = {
      gte: new Date(`${anio}-01-01`),
      lte: new Date(`${anio}-12-31`)
    }
  }

  const partidos = await req.db.partido.findMany({
    where: wherePartido,
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    },
    orderBy: { fecha: 'desc' }
  })

  // Calcular estadísticas
  const finalizados = partidos.filter(p => p.estado === 'FINALIZADO')
  let ganados = 0, perdidos = 0, empatados = 0
  let golesAFavor = 0, golesEnContra = 0

  for (const p of finalizados) {
    if (p.golesLocal !== null && p.golesVisitante !== null) {
      const nuestrosGoles = p.condicion === 'LOCAL' ? p.golesLocal : p.golesVisitante
      const susGoles = p.condicion === 'LOCAL' ? p.golesVisitante : p.golesLocal

      golesAFavor += nuestrosGoles
      golesEnContra += susGoles

      if (nuestrosGoles > susGoles) ganados++
      else if (nuestrosGoles < susGoles) perdidos++
      else empatados++
    }
  }

  // Agrupar por rival
  const porRival = {}
  for (const p of finalizados) {
    if (!porRival[p.rival]) {
      porRival[p.rival] = { jugados: 0, ganados: 0, perdidos: 0, empatados: 0, gf: 0, gc: 0 }
    }
    const r = porRival[p.rival]
    r.jugados++

    if (p.golesLocal !== null && p.golesVisitante !== null) {
      const nuestrosGoles = p.condicion === 'LOCAL' ? p.golesLocal : p.golesVisitante
      const susGoles = p.condicion === 'LOCAL' ? p.golesVisitante : p.golesLocal
      r.gf += nuestrosGoles
      r.gc += susGoles
      if (nuestrosGoles > susGoles) r.ganados++
      else if (nuestrosGoles < susGoles) r.perdidos++
      else r.empatados++
    }
  }

  res.json({
    success: true,
    data: {
      resumen: {
        totalPartidos: partidos.length,
        finalizados: finalizados.length,
        programados: partidos.filter(p => p.estado === 'PROGRAMADO').length,
        suspendidos: partidos.filter(p => p.estado === 'SUSPENDIDO').length,
        cancelados: partidos.filter(p => p.estado === 'CANCELADO').length,
        ganados,
        perdidos,
        empatados,
        golesAFavor,
        golesEnContra,
        diferenciaGoles: golesAFavor - golesEnContra,
        efectividad: finalizados.length > 0
          ? Math.round(((ganados * 3 + empatados) / (finalizados.length * 3)) * 100)
          : 0
      },
      porRival: Object.entries(porRival)
        .map(([rival, stats]) => ({ rival, ...stats }))
        .sort((a, b) => b.jugados - a.jugados),
      ultimosPartidos: partidos.slice(0, 10).map(p => ({
        id: p.id,
        fecha: p.fecha,
        rival: p.rival,
        condicion: p.condicion,
        resultado: p.golesLocal !== null && p.golesVisitante !== null
          ? (p.condicion === 'LOCAL'
            ? `${p.golesLocal} - ${p.golesVisitante}`
            : `${p.golesVisitante} - ${p.golesLocal}`)
          : null,
        estado: p.estado,
        categoria: `${p.categoriaActividad.actividad.nombre} - ${p.categoriaActividad.nombre}`
      }))
    }
  })
}))

// GET /api/admin/reportes-deportivos/goleadores - Tabla de goleadores
router.get('/goleadores', asyncHandler(async (req, res) => {
  const { categoriaActividadId, actividadId, temporada, limite } = req.query
  const limit = parseInt(limite) || 20

  let wherePartido = { estado: 'FINALIZADO' }

  if (temporada) {
    const anio = parseInt(temporada)
    wherePartido.fecha = {
      gte: new Date(`${anio}-01-01`),
      lte: new Date(`${anio}-12-31`)
    }
  }

  if (actividadId) {
    wherePartido.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  if (categoriaActividadId) {
    wherePartido.categoriaActividadId = parseInt(categoriaActividadId)
  }

  const estadisticas = await req.db.estadisticaPartido.groupBy({
    by: ['socioId'],
    where: {
      partido: wherePartido
    },
    _sum: {
      goles: true,
      asistencias: true,
      tarjetaAmarilla: true,
      tarjetaRoja: true,
      minutosJugados: true
    },
    _count: {
      id: true
    },
    orderBy: {
      _sum: {
        goles: 'desc'
      }
    },
    take: limit
  })

  // Obtener datos de los socios
  const socioIds = estadisticas.map(e => e.socioId)
  const socios = await req.db.socio.findMany({
    where: { id: { in: socioIds } },
    select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
  })

  const sociosMap = new Map(socios.map(s => [s.id, s]))

  const goleadores = estadisticas.map((e, index) => ({
    posicion: index + 1,
    socio: sociosMap.get(e.socioId),
    partidos: e._count.id,
    goles: e._sum.goles || 0,
    asistencias: e._sum.asistencias || 0,
    tarjetasAmarillas: e._sum.tarjetaAmarilla || 0,
    tarjetasRojas: e._sum.tarjetaRoja || 0,
    minutosJugados: e._sum.minutosJugados || 0,
    promedioGoles: e._count.id > 0
      ? ((e._sum.goles || 0) / e._count.id).toFixed(2)
      : '0.00'
  }))

  res.json({ success: true, data: goleadores })
}))

// GET /api/admin/reportes-deportivos/asistidores - Tabla de asistidores
router.get('/asistidores', asyncHandler(async (req, res) => {
  const { categoriaActividadId, actividadId, temporada, limite } = req.query
  const limit = parseInt(limite) || 20

  let wherePartido = { estado: 'FINALIZADO' }

  if (temporada) {
    const anio = parseInt(temporada)
    wherePartido.fecha = {
      gte: new Date(`${anio}-01-01`),
      lte: new Date(`${anio}-12-31`)
    }
  }

  if (actividadId) {
    wherePartido.categoriaActividad = { actividadId: parseInt(actividadId) }
  }

  if (categoriaActividadId) {
    wherePartido.categoriaActividadId = parseInt(categoriaActividadId)
  }

  const estadisticas = await req.db.estadisticaPartido.groupBy({
    by: ['socioId'],
    where: {
      partido: wherePartido
    },
    _sum: {
      goles: true,
      asistencias: true
    },
    _count: {
      id: true
    },
    orderBy: {
      _sum: {
        asistencias: 'desc'
      }
    },
    take: limit
  })

  const socioIds = estadisticas.map(e => e.socioId)
  const socios = await req.db.socio.findMany({
    where: { id: { in: socioIds } },
    select: { id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true }
  })

  const sociosMap = new Map(socios.map(s => [s.id, s]))

  const asistidores = estadisticas.map((e, index) => ({
    posicion: index + 1,
    socio: sociosMap.get(e.socioId),
    partidos: e._count.id,
    asistencias: e._sum.asistencias || 0,
    goles: e._sum.goles || 0
  }))

  res.json({ success: true, data: asistidores })
}))

// GET /api/admin/reportes-deportivos/jugador/:socioId - Estadísticas completas de un jugador
router.get('/jugador/:socioId', asyncHandler(async (req, res) => {
  const { socioId } = req.params
  const { temporada } = req.query

  const socio = await req.db.socio.findUnique({
    where: { id: parseInt(socioId) },
    select: {
      id: true, nroSocio: true, apellidoNombre: true, fotoUrl: true,
      fechaNacimiento: true, documento: true
    }
  })

  if (!socio) {
    return res.status(404).json({ success: false, error: 'Socio no encontrado' })
  }

  let wherePartido = { estado: 'FINALIZADO' }

  if (temporada) {
    const anio = parseInt(temporada)
    wherePartido.fecha = {
      gte: new Date(`${anio}-01-01`),
      lte: new Date(`${anio}-12-31`)
    }
  }

  // Estadísticas de partidos
  const estadisticasPartidos = await req.db.estadisticaPartido.findMany({
    where: {
      socioId: parseInt(socioId),
      partido: wherePartido
    },
    include: {
      partido: {
        include: {
          categoriaActividad: {
            include: { actividad: true }
          }
        }
      }
    },
    orderBy: { partido: { fecha: 'desc' } }
  })

  // Totales partidos
  const totalesPartidos = {
    partidos: estadisticasPartidos.length,
    titularidades: estadisticasPartidos.filter(e => e.esTitular).length,
    minutosJugados: estadisticasPartidos.reduce((sum, e) => sum + (e.minutosJugados || 0), 0),
    goles: estadisticasPartidos.reduce((sum, e) => sum + e.goles, 0),
    asistencias: estadisticasPartidos.reduce((sum, e) => sum + e.asistencias, 0),
    tarjetasAmarillas: estadisticasPartidos.reduce((sum, e) => sum + e.tarjetaAmarilla, 0),
    tarjetasRojas: estadisticasPartidos.reduce((sum, e) => sum + e.tarjetaRoja, 0)
  }

  // Estadísticas de asistencia a entrenamientos
  let whereAsistencia = { socioId: parseInt(socioId) }

  if (temporada) {
    const anio = parseInt(temporada)
    whereAsistencia.entrenamiento = {
      fecha: {
        gte: new Date(`${anio}-01-01`),
        lte: new Date(`${anio}-12-31`)
      }
    }
  }

  const asistencias = await req.db.asistencia.findMany({
    where: whereAsistencia
  })

  const totalesAsistencia = {
    entrenamientos: asistencias.length,
    presentes: asistencias.filter(a => a.estado === 'PRESENTE').length,
    tarde: asistencias.filter(a => a.estado === 'TARDE').length,
    ausentes: asistencias.filter(a => a.estado === 'AUSENTE').length,
    justificados: asistencias.filter(a => a.estado === 'JUSTIFICADO').length
  }
  totalesAsistencia.porcentaje = totalesAsistencia.entrenamientos > 0
    ? Math.round(((totalesAsistencia.presentes + totalesAsistencia.tarde) / totalesAsistencia.entrenamientos) * 100)
    : 0

  // Inscripciones activas
  const inscripciones = await req.db.inscripcion.findMany({
    where: {
      socioId: parseInt(socioId),
      estado: 'ACTIVA'
    },
    include: {
      categoriaActividad: {
        include: { actividad: true }
      }
    }
  })

  res.json({
    success: true,
    data: {
      socio,
      inscripciones: inscripciones.map(i => ({
        id: i.id,
        categoria: `${i.categoriaActividad.actividad.nombre} - ${i.categoriaActividad.nombre}`,
        fechaInicio: i.fechaInicio,
        federado: i.federado
      })),
      partidos: {
        totales: totalesPartidos,
        detalle: estadisticasPartidos.slice(0, 20).map(e => ({
          fecha: e.partido.fecha,
          rival: e.partido.rival,
          resultado: e.partido.golesLocal !== null
            ? (e.partido.condicion === 'LOCAL'
              ? `${e.partido.golesLocal}-${e.partido.golesVisitante}`
              : `${e.partido.golesVisitante}-${e.partido.golesLocal}`)
            : null,
          titular: e.esTitular,
          minutos: e.minutosJugados,
          goles: e.goles,
          asistencias: e.asistencias
        }))
      },
      asistencia: totalesAsistencia
    }
  })
}))

export default router
