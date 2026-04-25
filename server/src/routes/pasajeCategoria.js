import express from 'express'
import { authAdmin } from '../middleware/auth.js'

const router = express.Router()

// Helper: Calcular edad a una fecha determinada
function calcularEdad(fechaNacimiento, fechaReferencia = new Date()) {
  if (!fechaNacimiento) return null
  const nacimiento = new Date(fechaNacimiento)
  const referencia = new Date(fechaReferencia)

  let edad = referencia.getFullYear() - nacimiento.getFullYear()
  const mesActual = referencia.getMonth()
  const mesNacimiento = nacimiento.getMonth()

  if (mesActual < mesNacimiento ||
      (mesActual === mesNacimiento && referencia.getDate() < nacimiento.getDate())) {
    edad--
  }

  return edad
}

// GET /revisar - Revisar socios que necesitan pasaje de categoría
router.get('/revisar', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { actividadId, fechaReferencia } = req.query

    // Fecha de referencia para calcular edades (por defecto: inicio del próximo año)
    const fechaRef = fechaReferencia
      ? new Date(fechaReferencia)
      : new Date(new Date().getFullYear() + 1, 0, 1) // 1ro de enero del próximo año

    // Obtener todas las inscripciones activas con datos del socio y categoría
    const whereInscripcion = {
      estado: 'ACTIVA',
      fechaFin: null,
    }

    if (actividadId) {
      whereInscripcion.categoriaActividad = {
        actividadId: parseInt(actividadId)
      }
    }

    const inscripciones = await req.db.inscripcion.findMany({
      where: whereInscripcion,
      include: {
        socio: {
          select: {
            id: true,
            nroSocio: true,
            apellido: true,
            nombre: true,
            apellidoNombre: true,
            fechaNacimiento: true,
            sexo: true,
          }
        },
        categoriaActividad: {
          include: {
            actividad: {
              select: { id: true, nombre: true }
            }
          }
        }
      }
    })

    // Obtener todas las categorías ordenadas por edad
    const categorias = await prisma.categoriaActividad.findMany({
      where: { activo: true },
      include: {
        actividad: { select: { id: true, nombre: true } }
      },
      orderBy: [
        { actividadId: 'asc' },
        { edadMinima: 'asc' }
      ]
    })

    // Agrupar categorías por actividad
    const categoriasPorActividad = {}
    for (const cat of categorias) {
      if (!categoriasPorActividad[cat.actividadId]) {
        categoriasPorActividad[cat.actividadId] = []
      }
      categoriasPorActividad[cat.actividadId].push(cat)
    }

    // Analizar cada inscripción
    const pasajesNecesarios = []
    const sinCategoriaDisponible = []
    const enRango = []

    for (const insc of inscripciones) {
      const socio = insc.socio
      const catActual = insc.categoriaActividad
      const edad = calcularEdad(socio.fechaNacimiento, fechaRef)

      if (edad === null) {
        // Socio sin fecha de nacimiento - no se puede evaluar
        continue
      }

      // Verificar si la edad está dentro del rango de la categoría actual
      const edadMinima = catActual.edadMinima ?? 0
      const edadMaxima = catActual.edadMaxima ?? 99

      if (edad >= edadMinima && edad <= edadMaxima) {
        // Está en rango, no necesita pasaje
        enRango.push({
          inscripcionId: insc.id,
          socio: {
            id: socio.id,
            nroSocio: socio.nroSocio,
            nombre: socio.nombre || socio.apellidoNombre,
            apellido: socio.apellido,
          },
          edad,
          categoriaActual: {
            id: catActual.id,
            nombre: catActual.nombre,
            edadMinima: catActual.edadMinima,
            edadMaxima: catActual.edadMaxima,
          },
          actividad: catActual.actividad
        })
        continue
      }

      // Buscar categoría apropiada en la misma actividad
      const categoriasActividad = categoriasPorActividad[catActual.actividadId] || []
      let categoriaDestino = null

      for (const cat of categoriasActividad) {
        const catEdadMin = cat.edadMinima ?? 0
        const catEdadMax = cat.edadMaxima ?? 99

        // Verificar si coincide el sexo (si la categoría tiene restricción)
        if (cat.sexo && cat.sexo !== 'MIXTO' && socio.sexo && cat.sexo !== socio.sexo) {
          continue
        }

        if (edad >= catEdadMin && edad <= catEdadMax) {
          categoriaDestino = cat
          break
        }
      }

      const pasaje = {
        inscripcionId: insc.id,
        socio: {
          id: socio.id,
          nroSocio: socio.nroSocio,
          nombre: socio.nombre || socio.apellidoNombre,
          apellido: socio.apellido,
          fechaNacimiento: socio.fechaNacimiento,
        },
        edad,
        edadAlReferencia: edad,
        categoriaActual: {
          id: catActual.id,
          codigo: catActual.codigo,
          nombre: catActual.nombre,
          edadMinima: catActual.edadMinima,
          edadMaxima: catActual.edadMaxima,
        },
        actividad: catActual.actividad,
        tipoMovimiento: edad > (catActual.edadMaxima ?? 99) ? 'ASCENSO' : 'DESCENSO',
      }

      if (categoriaDestino) {
        pasaje.categoriaDestino = {
          id: categoriaDestino.id,
          codigo: categoriaDestino.codigo,
          nombre: categoriaDestino.nombre,
          edadMinima: categoriaDestino.edadMinima,
          edadMaxima: categoriaDestino.edadMaxima,
        }
        pasajesNecesarios.push(pasaje)
      } else {
        pasaje.motivo = edad > (catActual.edadMaxima ?? 99)
          ? 'Supera edad máxima, sin categoría superior disponible'
          : 'Edad menor a la mínima, sin categoría inferior disponible'
        sinCategoriaDisponible.push(pasaje)
      }
    }

    // Estadísticas
    const estadisticas = {
      totalInscripciones: inscripciones.length,
      enRango: enRango.length,
      requierenPasaje: pasajesNecesarios.length,
      sinCategoriaDisponible: sinCategoriaDisponible.length,
      fechaReferencia: fechaRef,
    }

    res.json({
      success: true,
      data: {
        estadisticas,
        pasajesNecesarios,
        sinCategoriaDisponible,
      }
    })

  } catch (error) {
    console.error('Error al revisar pasajes:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /ejecutar - Ejecutar pasajes de categoría seleccionados
router.post('/ejecutar', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { pasajes, fechaEfectiva } = req.body

    // pasajes = [{ inscripcionId, categoriaDestinoId }, ...]

    if (!pasajes || !Array.isArray(pasajes) || pasajes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe seleccionar al menos un pasaje para ejecutar'
      })
    }

    const fechaEfect = fechaEfectiva ? new Date(fechaEfectiva) : new Date()
    const resultados = []

    await req.db.$transaction(async (tx) => {
      for (const pasaje of pasajes) {
        const { inscripcionId, categoriaDestinoId } = pasaje

        // Obtener inscripción actual
        const inscripcion = await tx.inscripcion.findUnique({
          where: { id: inscripcionId },
          include: {
            socio: { select: { id: true, nroSocio: true, apellidoNombre: true } },
            categoriaActividad: { select: { id: true, nombre: true, actividadId: true } }
          }
        })

        if (!inscripcion) {
          resultados.push({
            inscripcionId,
            exito: false,
            error: 'Inscripción no encontrada'
          })
          continue
        }

        if (inscripcion.estado !== 'ACTIVA') {
          resultados.push({
            inscripcionId,
            exito: false,
            error: 'La inscripción ya no está activa'
          })
          continue
        }

        // Verificar que la categoría destino existe y es de la misma actividad
        const categoriaDestino = await tx.categoriaActividad.findUnique({
          where: { id: categoriaDestinoId }
        })

        if (!categoriaDestino) {
          resultados.push({
            inscripcionId,
            exito: false,
            error: 'Categoría destino no encontrada'
          })
          continue
        }

        if (categoriaDestino.actividadId !== inscripcion.categoriaActividad.actividadId) {
          resultados.push({
            inscripcionId,
            exito: false,
            error: 'La categoría destino debe ser de la misma actividad'
          })
          continue
        }

        // 1. Finalizar inscripción actual
        await tx.inscripcion.update({
          where: { id: inscripcionId },
          data: {
            fechaFin: fechaEfect,
            motivoFin: 'PASAJE_CATEGORIA',
            estado: 'FINALIZADA'
          }
        })

        // 2. Crear nueva inscripción en la categoría destino
        const nuevaInscripcion = await tx.inscripcion.create({
          data: {
            socioId: inscripcion.socioId,
            categoriaActividadId: categoriaDestinoId,
            fechaInscripcion: fechaEfect,
            fechaInicio: fechaEfect,
            exentoCuota: inscripcion.exentoCuota,
            motivoExencion: inscripcion.motivoExencion,
            becado: inscripcion.becado,
            federado: inscripcion.federado,
            porcentajeCuota: inscripcion.porcentajeCuota,
            autorizadoPor: 'Sistema - Pasaje Automático',
            fechaAutorizacion: new Date(),
            estado: 'ACTIVA',
            observaciones: `Pasaje automático desde ${inscripcion.categoriaActividad.nombre}`
          }
        })

        resultados.push({
          inscripcionId,
          exito: true,
          nuevaInscripcionId: nuevaInscripcion.id,
          socio: inscripcion.socio.apellidoNombre,
          categoriaOrigen: inscripcion.categoriaActividad.nombre,
          categoriaDestino: categoriaDestino.nombre
        })
      }
    })

    const exitosos = resultados.filter(r => r.exito).length
    const fallidos = resultados.filter(r => !r.exito).length

    res.json({
      success: true,
      data: {
        mensaje: `Pasaje ejecutado: ${exitosos} exitosos, ${fallidos} con errores`,
        exitosos,
        fallidos,
        resultados
      }
    })

  } catch (error) {
    console.error('Error al ejecutar pasajes:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /historial - Ver historial de pasajes
router.get('/historial', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { actividadId, desde, hasta, page = 1, limit = 50 } = req.query

    const where = {
      motivoFin: 'PASAJE_CATEGORIA'
    }

    if (actividadId) {
      where.categoriaActividad = {
        actividadId: parseInt(actividadId)
      }
    }

    if (desde || hasta) {
      where.fechaFin = {}
      if (desde) where.fechaFin.gte = new Date(desde)
      if (hasta) where.fechaFin.lte = new Date(hasta)
    }

    const [inscripciones, total] = await Promise.all([
      req.db.inscripcion.findMany({
        where,
        include: {
          socio: {
            select: {
              id: true,
              nroSocio: true,
              apellidoNombre: true,
              nombre: true,
              apellido: true,
            }
          },
          categoriaActividad: {
            include: {
              actividad: { select: { id: true, nombre: true } }
            }
          }
        },
        orderBy: { fechaFin: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      req.db.inscripcion.count({ where })
    ])

    res.json({
      success: true,
      data: inscripciones,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })

  } catch (error) {
    console.error('Error al obtener historial:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /estadisticas - Estadísticas de pasajes
router.get('/estadisticas', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { anio } = req.query
    const year = anio ? parseInt(anio) : new Date().getFullYear()

    const inicioAnio = new Date(year, 0, 1)
    const finAnio = new Date(year, 11, 31, 23, 59, 59)

    // Total pasajes del año
    const totalPasajes = await req.db.inscripcion.count({
      where: {
        motivoFin: 'PASAJE_CATEGORIA',
        fechaFin: {
          gte: inicioAnio,
          lte: finAnio
        }
      }
    })

    // Pasajes por actividad
    const pasajesPorActividad = await req.db.inscripcion.groupBy({
      by: ['categoriaActividadId'],
      where: {
        motivoFin: 'PASAJE_CATEGORIA',
        fechaFin: {
          gte: inicioAnio,
          lte: finAnio
        }
      },
      _count: { id: true }
    })

    // Obtener nombres de categorías
    const categoriasIds = pasajesPorActividad.map(p => p.categoriaActividadId)
    const categorias = await prisma.categoriaActividad.findMany({
      where: { id: { in: categoriasIds } },
      include: { actividad: { select: { nombre: true } } }
    })

    const pasajesConNombre = pasajesPorActividad.map(p => {
      const cat = categorias.find(c => c.id === p.categoriaActividadId)
      return {
        categoria: cat?.nombre || 'Desconocida',
        actividad: cat?.actividad?.nombre || 'Desconocida',
        cantidad: p._count.id
      }
    })

    // Pasajes por mes
    const pasajesPorMes = await prisma.$queryRaw`
      SELECT
        EXTRACT(MONTH FROM fecha_fin) as mes,
        COUNT(*) as cantidad
      FROM inscripciones
      WHERE motivo_fin = 'PASAJE_CATEGORIA'
        AND fecha_fin >= ${inicioAnio}
        AND fecha_fin <= ${finAnio}
      GROUP BY EXTRACT(MONTH FROM fecha_fin)
      ORDER BY mes
    `

    res.json({
      success: true,
      data: {
        anio: year,
        totalPasajes,
        porActividad: pasajesConNombre,
        porMes: pasajesPorMes.map(p => ({
          mes: parseInt(p.mes),
          cantidad: parseInt(p.cantidad)
        }))
      }
    })

  } catch (error) {
    console.error('Error al obtener estadísticas:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /exceptuar/:inscripcionId - Marcar/desmarcar excepción de pasaje automático
router.post('/exceptuar/:inscripcionId', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { inscripcionId } = req.params
    const { exceptuar, motivo } = req.body

    const inscripcion = await req.db.inscripcion.update({
      where: { id: parseInt(inscripcionId) },
      data: {
        exceptuadoPasaje: exceptuar === true,
        motivoExcepcion: exceptuar ? (motivo || 'Sin especificar') : null
      },
      include: {
        socio: { select: { apellidoNombre: true } },
        categoriaActividad: { select: { nombre: true } }
      }
    })

    res.json({
      success: true,
      message: exceptuar
        ? `${inscripcion.socio.apellidoNombre} exceptuado del pasaje automático en ${inscripcion.categoriaActividad.nombre}`
        : `Excepción removida para ${inscripcion.socio.apellidoNombre}`,
      data: inscripcion
    })
  } catch (error) {
    console.error('Error al actualizar excepción:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /excepciones - Listar inscripciones exceptuadas
router.get('/excepciones', authAdmin, async (req, res) => {
  try {
    const prisma = req.prisma
    const { actividadId } = req.query

    const where = {
      exceptuadoPasaje: true,
      estado: 'ACTIVA'
    }

    if (actividadId) {
      where.categoriaActividad = { actividadId: parseInt(actividadId) }
    }

    const excepciones = await req.db.inscripcion.findMany({
      where,
      include: {
        socio: {
          select: { id: true, nroSocio: true, apellidoNombre: true, fechaNacimiento: true }
        },
        categoriaActividad: {
          select: {
            id: true,
            nombre: true,
            edadMinima: true,
            edadMaxima: true,
            actividad: { select: { id: true, nombre: true } }
          }
        }
      },
      orderBy: { socio: { apellidoNombre: 'asc' } }
    })

    res.json({
      success: true,
      data: excepciones.map(e => ({
        inscripcionId: e.id,
        socio: e.socio,
        categoria: e.categoriaActividad,
        motivo: e.motivoExcepcion
      }))
    })
  } catch (error) {
    console.error('Error al listar excepciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
