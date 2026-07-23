import express from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'

const router = express.Router()

// Helper para manejar errores async
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

// ============================================
// PRESUPUESTO - CRUD
// ============================================

// GET /api/admin/presupuestos - Listar todos los presupuestos
router.get('/presupuestos', authAdmin, asyncHandler(async (req, res) => {
  const { anio } = req.query

  const where = {}
  if (anio) where.anio = parseInt(anio)

  const presupuestos = await req.db.presupuesto.findMany({
    where,
    orderBy: [
      { anio: 'desc' },
      { version: 'asc' }
    ],
    include: {
      _count: {
        select: { lineas: true }
      }
    }
  })

  res.json({ success: true, data: presupuestos })
}))

// GET /api/admin/presupuestos/anios - Listar años disponibles con sus versiones
router.get('/presupuestos/anios', authAdmin, asyncHandler(async (req, res) => {
  const presupuestos = await req.db.presupuesto.findMany({
    orderBy: [
      { anio: 'desc' },
      { version: 'asc' }
    ],
    select: {
      id: true,
      anio: true,
      version: true,
      nombre: true,
      estado: true,
      esPrincipal: true,
      _count: {
        select: { lineas: true }
      }
    }
  })

  // Agrupar por año
  const porAnio = {}
  for (const p of presupuestos) {
    if (!porAnio[p.anio]) {
      porAnio[p.anio] = {
        anio: p.anio,
        versiones: []
      }
    }
    porAnio[p.anio].versiones.push(p)
  }

  res.json({ success: true, data: Object.values(porAnio) })
}))

// GET /api/admin/presupuestos/:id - Detalle de presupuesto con lineas
router.get('/presupuestos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) },
    include: {
      lineas: {
        include: {
          cuentaContable: true,
          concepto: true
        },
        orderBy: [
          { cuentaContableId: 'asc' },
          { conceptoId: 'asc' },
          { mes: 'asc' }
        ]
      }
    }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  res.json({ success: true, data: presupuesto })
}))

// POST /api/admin/presupuestos - Crear presupuesto
router.post('/presupuestos', authAdmin, asyncHandler(async (req, res) => {
  const { anio, nombre, observaciones } = req.body

  // Obtener la siguiente versión para ese año
  const ultimaVersion = await req.db.presupuesto.findFirst({
    where: { anio: parseInt(anio) },
    orderBy: { version: 'desc' }
  })

  const nuevaVersion = ultimaVersion ? ultimaVersion.version + 1 : 1
  const esPrimero = nuevaVersion === 1

  const presupuesto = await req.db.presupuesto.create({
    data: {
      anio: parseInt(anio),
      version: nuevaVersion,
      nombre: nombre || `Presupuesto ${anio} v${nuevaVersion}`,
      observaciones,
      estado: 'BORRADOR',
      esPrincipal: esPrimero // La primera versión es principal por defecto
    }
  })

  res.status(201).json({ success: true, data: presupuesto })
}))

// PUT /api/admin/presupuestos/:id - Actualizar presupuesto
router.put('/presupuestos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { nombre, observaciones, estado } = req.body

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  // Si se está aprobando el presupuesto
  const updateData = { nombre, observaciones }
  if (estado && estado !== presupuesto.estado) {
    updateData.estado = estado
    if (estado === 'APROBADO') {
      updateData.aprobadoPor = req.admin.id
      updateData.fechaAprobacion = new Date()
    }
  }

  const actualizado = await req.db.presupuesto.update({
    where: { id: parseInt(id) },
    data: updateData
  })

  res.json({ success: true, data: actualizado })
}))

// POST /api/admin/presupuestos/:id/set-principal - Establecer como versión principal
router.post('/presupuestos/:id/set-principal', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  // Quitar principal de otras versiones del mismo año y establecer esta
  await req.db.$transaction([
    req.db.presupuesto.updateMany({
      where: { anio: presupuesto.anio },
      data: { esPrincipal: false }
    }),
    req.db.presupuesto.update({
      where: { id: parseInt(id) },
      data: { esPrincipal: true }
    })
  ])

  res.json({ success: true, message: 'Versión establecida como principal' })
}))

// DELETE /api/admin/presupuestos/:id - Eliminar presupuesto (solo si está en BORRADOR)
router.delete('/presupuestos/:id', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  if (presupuesto.estado !== 'BORRADOR') {
    return res.status(400).json({ error: 'Solo se pueden eliminar presupuestos en estado BORRADOR' })
  }

  await req.db.presupuesto.delete({
    where: { id: parseInt(id) }
  })

  res.json({ success: true, message: 'Presupuesto eliminado' })
}))

// ============================================
// LINEAS DE PRESUPUESTO
// ============================================

// POST /api/admin/presupuestos/:id/lineas - Agregar/actualizar linea
router.post('/presupuestos/:id/lineas', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { cuentaContableId, conceptoId, mes, montoPresupuestado, observaciones } = req.body

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  if (presupuesto.estado === 'CERRADO') {
    return res.status(400).json({ error: 'No se pueden modificar presupuestos cerrados' })
  }

  // Verificar que se proporcione cuenta contable O concepto (no ambos, no ninguno)
  if ((!cuentaContableId && !conceptoId) || (cuentaContableId && conceptoId)) {
    return res.status(400).json({ error: 'Debe especificar una cuenta contable O un concepto (no ambos)' })
  }

  // Buscar si ya existe una linea para esa combinación
  const existente = await req.db.lineaPresupuesto.findFirst({
    where: {
      presupuestoId: parseInt(id),
      cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
      conceptoId: conceptoId ? parseInt(conceptoId) : null,
      mes: parseInt(mes)
    }
  })

  let linea
  if (existente) {
    // Actualizar
    linea = await req.db.lineaPresupuesto.update({
      where: { id: existente.id },
      data: {
        montoPresupuestado: parseFloat(montoPresupuestado),
        observaciones
      },
      include: {
        cuentaContable: true,
        concepto: true
      }
    })
  } else {
    // Crear
    linea = await req.db.lineaPresupuesto.create({
      data: {
        presupuestoId: parseInt(id),
        cuentaContableId: cuentaContableId ? parseInt(cuentaContableId) : null,
        conceptoId: conceptoId ? parseInt(conceptoId) : null,
        mes: parseInt(mes),
        montoPresupuestado: parseFloat(montoPresupuestado),
        observaciones
      },
      include: {
        cuentaContable: true,
        concepto: true
      }
    })
  }

  res.json({ success: true, data: linea })
}))

// POST /api/admin/presupuestos/:id/lineas/bulk - Guardar múltiples lineas (para la grilla)
router.post('/presupuestos/:id/lineas/bulk', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { lineas } = req.body

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  if (presupuesto.estado === 'CERRADO') {
    return res.status(400).json({ error: 'No se pueden modificar presupuestos cerrados' })
  }

  // Procesar cada linea
  const resultado = await req.db.$transaction(async (tx) => {
    const procesadas = []

    for (const linea of lineas) {
      const { cuentaContableId, conceptoId, mes, montoPresupuestado, observaciones } = linea

      // Buscar si ya existe
      const existente = await tx.lineaPresupuesto.findFirst({
        where: {
          presupuestoId: parseInt(id),
          cuentaContableId: cuentaContableId || null,
          conceptoId: conceptoId || null,
          mes: parseInt(mes)
        }
      })

      if (montoPresupuestado === 0 || montoPresupuestado === null || montoPresupuestado === '') {
        // Si el monto es 0 y existe, eliminar
        if (existente) {
          await tx.lineaPresupuesto.delete({ where: { id: existente.id } })
        }
      } else {
        // Crear o actualizar
        if (existente) {
          const actualizada = await tx.lineaPresupuesto.update({
            where: { id: existente.id },
            data: { montoPresupuestado: parseFloat(montoPresupuestado), observaciones }
          })
          procesadas.push(actualizada)
        } else {
          const nueva = await tx.lineaPresupuesto.create({
            data: {
              presupuestoId: parseInt(id),
              cuentaContableId: cuentaContableId || null,
              conceptoId: conceptoId || null,
              mes: parseInt(mes),
              montoPresupuestado: parseFloat(montoPresupuestado),
              observaciones
            }
          })
          procesadas.push(nueva)
        }
      }
    }

    return procesadas
  })

  res.json({ success: true, data: { procesadas: resultado.length } })
}))

// DELETE /api/admin/presupuestos/:presupuestoId/lineas/:lineaId - Eliminar linea
router.delete('/presupuestos/:presupuestoId/lineas/:lineaId', authAdmin, asyncHandler(async (req, res) => {
  const { presupuestoId, lineaId } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(presupuestoId) }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  if (presupuesto.estado === 'CERRADO') {
    return res.status(400).json({ error: 'No se pueden modificar presupuestos cerrados' })
  }

  await req.db.lineaPresupuesto.delete({
    where: { id: parseInt(lineaId) }
  })

  res.json({ success: true, message: 'Linea eliminada' })
}))

// ============================================
// EJECUCIÓN PRESUPUESTARIA
// ============================================

// GET /api/admin/presupuestos/:id/ejecucion - Comparar presupuesto vs ejecución real
// La ejecución se calcula desde los asientos contables (AsientoLinea)
// Fórmula de saldo: Haber - Debe
//   - Ingresos (cuentas INGRESO): se registran al Haber, saldo positivo
//   - Egresos (cuentas EGRESO): se registran al Debe, saldo negativo
router.get('/presupuestos/:id/ejecucion', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) },
    include: {
      lineas: {
        include: {
          cuentaContable: true,
          concepto: {
            include: {
              cuentaContable: true // Para obtener la cuenta del concepto
            }
          }
        }
      }
    }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  // Obtener fecha de inicio y fin del año
  const inicioAnio = new Date(presupuesto.anio, 0, 1)
  const finAnio = new Date(presupuesto.anio, 11, 31, 23, 59, 59)

  // Recopilar todas las cuentas contables únicas de las líneas del presupuesto
  const cuentasIds = new Set()
  const conceptoToCuenta = {} // Mapeo conceptoId -> cuentaContableId

  for (const linea of presupuesto.lineas) {
    if (linea.cuentaContableId) {
      cuentasIds.add(linea.cuentaContableId)
    } else if (linea.conceptoId && linea.concepto?.cuentaContableId) {
      cuentasIds.add(linea.concepto.cuentaContableId)
      conceptoToCuenta[linea.conceptoId] = linea.concepto.cuentaContableId
    }
  }

  // Obtener todos los asientos del año que involucren esas cuentas
  const asientoLineas = await req.db.asientoLinea.findMany({
    where: {
      cuentaContableId: { in: Array.from(cuentasIds) },
      asiento: {
        fecha: { gte: inicioAnio, lte: finAnio },
        estado: 'CONFIRMADO'
      }
    },
    include: {
      asiento: {
        select: { fecha: true }
      }
    }
  })

  // Agrupar por cuenta y mes: { cuentaId_mes: { debe: X, haber: Y } }
  const saldosPorCuentaMes = {}

  for (const linea of asientoLineas) {
    const mes = linea.asiento.fecha.getMonth() + 1
    const key = `${linea.cuentaContableId}_${mes}`

    if (!saldosPorCuentaMes[key]) {
      saldosPorCuentaMes[key] = { debe: 0, haber: 0 }
    }

    saldosPorCuentaMes[key].debe += parseFloat(linea.debe || 0)
    saldosPorCuentaMes[key].haber += parseFloat(linea.haber || 0)
  }

  // Combinar presupuesto con ejecución
  const resultado = presupuesto.lineas.map(linea => {
    // Determinar la cuenta contable para buscar el saldo
    let cuentaId
    if (linea.cuentaContableId) {
      cuentaId = linea.cuentaContableId
    } else if (linea.conceptoId) {
      cuentaId = conceptoToCuenta[linea.conceptoId]
    }

    // Obtener saldo de esa cuenta para ese mes
    const key = `${cuentaId}_${linea.mes}`
    const saldos = saldosPorCuentaMes[key] || { debe: 0, haber: 0 }

    // Saldo = Haber - Debe
    // Positivo = ingresos (cuentas de ingreso tienen más Haber)
    // Negativo = egresos (cuentas de gasto tienen más Debe)
    const montoEjecutado = saldos.haber - saldos.debe

    const presupuestado = parseFloat(linea.montoPresupuestado)

    // Diferencia: lo que falta para alcanzar el presupuesto
    // Si presupuestado=+100 y ejecutado=+80, diferencia=+20 (faltan 20)
    // Si presupuestado=-50 y ejecutado=-30, diferencia=-20 (faltan gastar 20)
    const diferencia = presupuestado - montoEjecutado

    // Porcentaje de ejecución
    // Para ingresos: % positivo es bueno
    // Para egresos: comparamos magnitudes (si presupuestamos -50 y gastamos -30, ejecutamos 60%)
    let porcentaje = 0
    if (presupuestado !== 0) {
      porcentaje = (montoEjecutado / presupuestado) * 100
    }

    return {
      ...linea,
      montoEjecutado,
      diferencia,
      porcentajeEjecucion: Math.round(porcentaje * 100) / 100
    }
  })

  res.json({
    success: true,
    data: {
      presupuesto: {
        id: presupuesto.id,
        anio: presupuesto.anio,
        version: presupuesto.version,
        nombre: presupuesto.nombre,
        estado: presupuesto.estado,
        esPrincipal: presupuesto.esPrincipal
      },
      lineas: resultado
    }
  })
}))

// GET /api/admin/presupuestos/:id/resumen - Resumen por cuenta/concepto
router.get('/presupuestos/:id/resumen', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params

  const presupuesto = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) },
    include: {
      lineas: {
        include: {
          cuentaContable: true,
          concepto: true
        }
      }
    }
  })

  if (!presupuesto) {
    return res.status(404).json({ error: 'Presupuesto no encontrado' })
  }

  // Agrupar por cuenta o concepto
  const resumen = {}

  for (const linea of presupuesto.lineas) {
    let key, nombre, tipo

    if (linea.cuentaContableId) {
      key = `cuenta_${linea.cuentaContableId}`
      nombre = linea.cuentaContable.nombre
      tipo = 'CUENTA'
    } else {
      key = `concepto_${linea.conceptoId}`
      nombre = linea.concepto.nombre
      tipo = 'CONCEPTO'
    }

    if (!resumen[key]) {
      resumen[key] = {
        tipo,
        id: linea.cuentaContableId || linea.conceptoId,
        nombre,
        meses: {},
        totalAnual: 0
      }
    }

    const monto = parseFloat(linea.montoPresupuestado)
    resumen[key].meses[linea.mes] = monto
    resumen[key].totalAnual += monto
  }

  res.json({
    success: true,
    data: {
      presupuesto: {
        id: presupuesto.id,
        anio: presupuesto.anio,
        version: presupuesto.version,
        nombre: presupuesto.nombre,
        estado: presupuesto.estado,
        esPrincipal: presupuesto.esPrincipal
      },
      resumen: Object.values(resumen)
    }
  })
}))

// POST /api/admin/presupuestos/:id/copiar - Copiar presupuesto (nueva versión o a otro año)
router.post('/presupuestos/:id/copiar', authAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { anioDestino, porcentajeAjuste = 0, nombre } = req.body

  const presupuestoOrigen = await req.db.presupuesto.findUnique({
    where: { id: parseInt(id) },
    include: { lineas: true }
  })

  if (!presupuestoOrigen) {
    return res.status(404).json({ error: 'Presupuesto origen no encontrado' })
  }

  const anioFinal = anioDestino ? parseInt(anioDestino) : presupuestoOrigen.anio

  // Obtener la siguiente versión para el año destino
  const ultimaVersion = await req.db.presupuesto.findFirst({
    where: { anio: anioFinal },
    orderBy: { version: 'desc' }
  })

  const nuevaVersion = ultimaVersion ? ultimaVersion.version + 1 : 1

  // Crear nuevo presupuesto con lineas ajustadas
  const factorAjuste = 1 + (parseFloat(porcentajeAjuste) / 100)

  const nuevoPresupuesto = await req.db.presupuesto.create({
    data: {
      anio: anioFinal,
      version: nuevaVersion,
      nombre: nombre || `Presupuesto ${anioFinal} v${nuevaVersion}`,
      estado: 'BORRADOR',
      esPrincipal: false,
      observaciones: `Copiado de ${presupuestoOrigen.nombre || presupuestoOrigen.anio + ' v' + presupuestoOrigen.version}${porcentajeAjuste ? ` con ajuste de ${porcentajeAjuste}%` : ''}`,
      lineas: {
        create: presupuestoOrigen.lineas.map(linea => ({
          cuentaContableId: linea.cuentaContableId,
          conceptoId: linea.conceptoId,
          mes: linea.mes,
          montoPresupuestado: parseFloat(linea.montoPresupuestado) * factorAjuste,
          observaciones: linea.observaciones
        }))
      }
    },
    include: {
      lineas: true
    }
  })

  res.status(201).json({ success: true, data: nuevoPresupuesto })
}))

export default router
