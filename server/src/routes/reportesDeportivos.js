import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { authAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()
const prisma = new PrismaClient()

router.use(authAdmin)

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
  const entrenamientos = await prisma.entrenamiento.findMany({
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

  const asistencias = await prisma.asistencia.findMany({
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

  const socio = await prisma.socio.findUnique({
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

  const partidos = await prisma.partido.findMany({
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

  const estadisticas = await prisma.estadisticaPartido.groupBy({
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
  const socios = await prisma.socio.findMany({
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

  const estadisticas = await prisma.estadisticaPartido.groupBy({
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
  const socios = await prisma.socio.findMany({
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

  const socio = await prisma.socio.findUnique({
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
  const estadisticasPartidos = await prisma.estadisticaPartido.findMany({
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

  const asistencias = await prisma.asistencia.findMany({
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
  const inscripciones = await prisma.inscripcion.findMany({
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
