import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { generarAsientoPagoSueldo, generarAsientoDevengamientoSueldo, anularAsiento } from '../services/asientosContables.js'

const router = Router()

// Middleware de autenticación para todas las rutas
const authenticateAdmin = authAdmin

// ===============================================================
// CONCEPTOS DE LIQUIDACION (Configurables)
// ===============================================================

// GET /admin/conceptos-liquidacion - Listar conceptos
router.get('/conceptos-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const { activo, tipo } = req.query

    const where = {}
    if (activo !== undefined) {
      where.activo = activo === 'true'
    }
    if (tipo) {
      where.tipo = tipo
    }

    const conceptos = await req.db.conceptoLiquidacion.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }]
    })

    res.json(conceptos)
  } catch (error) {
    console.error('Error obteniendo conceptos liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /admin/conceptos-liquidacion/:id
router.get('/conceptos-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const concepto = await req.db.conceptoLiquidacion.findUnique({
      where: { id: parseInt(id) }
    })

    if (!concepto) {
      return res.status(404).json({ error: 'Concepto no encontrado' })
    }

    res.json(concepto)
  } catch (error) {
    console.error('Error obteniendo concepto:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Propagar un concepto fijo a todos los empleados PERSONAL del tenant.
// Crea ConceptoEmpleado si no existe (idempotente, gracias al @@unique).
async function propagarConceptoATodos(db, tenantId, conceptoId) {
  const empleados = await db.entidad.findMany({
    where: { tenantId, tipo: 'PERSONAL', activo: true },
    select: { id: true },
  })
  let creados = 0
  for (const e of empleados) {
    try {
      await db.conceptoEmpleado.create({
        data: {
          entidadId: e.id,
          conceptoId,
          activo: true,
          // valor/esPorcentaje/fechas: null → al generar liquidación se toma del catálogo
        },
      })
      creados++
    } catch (err) {
      // P2002 = ya existe → idempotente, lo salteamos
      if (err.code !== 'P2002') throw err
    }
  }
  return creados
}

// POST /admin/conceptos-liquidacion
router.post('/conceptos-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const { codigo, nombre, tipo, descripcion, esFijo, porcentaje, montoFijo, orden } = req.body

    if (!codigo || !nombre || !tipo) {
      return res.status(400).json({ error: 'Codigo, nombre y tipo son requeridos' })
    }

    if (!['HABER', 'DEDUCCION'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser HABER o DEDUCCION' })
    }

    const concepto = await req.db.conceptoLiquidacion.create({
      data: {
        codigo: codigo.toUpperCase(),
        nombre,
        tipo,
        descripcion,
        esFijo: esFijo || false,
        porcentaje: porcentaje ? parseFloat(porcentaje) : null,
        montoFijo: montoFijo ? parseFloat(montoFijo) : null,
        orden: orden || 0
      }
    })

    // Si nace marcado como "Automático para todos", crear el ConceptoEmpleado en cada empleado
    let propagados = 0
    if (concepto.esFijo) {
      propagados = await propagarConceptoATodos(req.db, req.tenantId, concepto.id)
    }

    res.status(201).json({ ...concepto, _propagadosAEmpleados: propagados })
  } catch (error) {
    console.error('Error creando concepto:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un concepto con ese codigo' })
    }
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /admin/conceptos-liquidacion/:id
router.put('/conceptos-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { codigo, nombre, tipo, descripcion, esFijo, porcentaje, montoFijo, orden, activo } = req.body

    const anterior = await req.db.conceptoLiquidacion.findUnique({ where: { id: parseInt(id) } })
    if (!anterior) return res.status(404).json({ error: 'Concepto no encontrado' })

    const concepto = await req.db.conceptoLiquidacion.update({
      where: { id: parseInt(id) },
      data: {
        codigo: codigo?.toUpperCase(),
        nombre,
        tipo,
        descripcion,
        esFijo,
        porcentaje: porcentaje !== undefined ? (porcentaje ? parseFloat(porcentaje) : null) : undefined,
        montoFijo: montoFijo !== undefined ? (montoFijo ? parseFloat(montoFijo) : null) : undefined,
        orden,
        activo
      }
    })

    // Propagar a empleados si esFijo pasó a true (transición false→true o creación inicial),
    // o si ya estaba en true y aún no se había propagado (igual es idempotente).
    let propagados = 0
    if (concepto.esFijo === true && (anterior.esFijo !== true || esFijo === true)) {
      propagados = await propagarConceptoATodos(req.db, req.tenantId, concepto.id)
    }

    res.json({ ...concepto, _propagadosAEmpleados: propagados })
  } catch (error) {
    console.error('Error actualizando concepto:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un concepto con ese codigo' })
    }
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ===============================================================
// LIQUIDACIONES DE SUELDO
// ===============================================================

// Generar numero de liquidacion
async function generarNumeroLiquidacion(mes, anio) {
  const mesStr = mes.toString().padStart(2, '0')
  return `LIQ-${anio}-${mesStr}`
}

// GET /admin/liquidaciones - Listar liquidaciones
router.get('/liquidaciones', authenticateAdmin, async (req, res) => {
  try {
    const { anio, estado, limit = 50, offset = 0 } = req.query

    const where = {}
    if (anio) {
      where.anio = parseInt(anio)
    }
    if (estado) {
      where.estado = estado
    }

    const [liquidaciones, total] = await Promise.all([
      req.db.liquidacionSueldo.findMany({
        where,
        include: {
          _count: {
            select: { items: true }
          }
        },
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      req.db.liquidacionSueldo.count({ where })
    ])

    res.json({
      data: liquidaciones,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error obteniendo liquidaciones:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /admin/liquidaciones/:id
router.get('/liquidaciones/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const liquidacion = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            entidad: {
              include: {
                cargoPersonal: true
              }
            }
          },
          orderBy: { entidad: { razonSocial: 'asc' } }
        }
      }
    })

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidacion no encontrada' })
    }

    res.json(liquidacion)
  } catch (error) {
    console.error('Error obteniendo liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/liquidaciones - Generar nueva liquidacion
router.post('/liquidaciones', authenticateAdmin, async (req, res) => {
  try {
    const { mes, anio, observaciones } = req.body

    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y anio son requeridos' })
    }

    // Verificar que no exista liquidacion para ese periodo
    const existente = await req.db.liquidacionSueldo.findUnique({
      where: { mes_anio: { mes: parseInt(mes), anio: parseInt(anio) } }
    })

    if (existente) {
      return res.status(400).json({ error: `Ya existe una liquidacion para ${mes}/${anio}` })
    }

    const mesNum = parseInt(mes)
    const anioNum = parseInt(anio)

    // Obtener personal activo con sueldo + sus conceptos fijos vigentes
    const personal = await req.db.entidad.findMany({
      where: {
        tipo: 'PERSONAL',
        activo: true,
        sueldoBasico: { not: null }
      },
      include: {
        cargoPersonal: true,
        conceptosFijos: {
          where: { activo: true },
          include: { concepto: true }
        }
      },
      orderBy: { razonSocial: 'asc' }
    })

    if (personal.length === 0) {
      return res.status(400).json({ error: 'No hay personal activo con sueldo configurado' })
    }

    // Obtener conceptos fijos activos
    const conceptosFijos = await req.db.conceptoLiquidacion.findMany({
      where: {
        activo: true,
        esFijo: true
      },
      orderBy: { orden: 'asc' }
    })

    // Obtener novedades del período no aplicadas
    const novedadesPeriodo = await req.db.novedadLiquidacion.findMany({
      where: {
        mes: mesNum,
        anio: anioNum,
        aplicada: false
      },
      include: { concepto: true }
    })

    // Indexar novedades por entidad
    const novedadesPorEntidad = new Map()
    for (const nov of novedadesPeriodo) {
      if (!novedadesPorEntidad.has(nov.entidadId)) novedadesPorEntidad.set(nov.entidadId, [])
      novedadesPorEntidad.get(nov.entidadId).push(nov)
    }

    // Fecha de referencia para vigencia de conceptos fijos del empleado (último día del período)
    const fechaPeriodo = new Date(anioNum, mesNum - 1, 1)
    const finPeriodo = new Date(anioNum, mesNum, 0, 23, 59, 59)

    // Nombre del periodo
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const periodo = `${meses[mesNum - 1]} ${anioNum}`
    const numero = await generarNumeroLiquidacion(mesNum, anioNum)

    // Crear liquidacion con items
    let totalBruto = 0
    let totalDeducciones = 0
    let totalNeto = 0
    const novedadIdsConsumidos = []

    const items = personal.map(emp => {
      const sueldoBasico = parseFloat(emp.sueldoBasico) || 0
      let haberes = sueldoBasico
      let deducciones = 0

      // Detalle de conceptos aplicados
      const detalleConceptos = [{
        conceptoCodigo: 'SUELDO_BASICO',
        conceptoNombre: 'Sueldo Basico',
        tipo: 'HABER',
        monto: sueldoBasico,
        descripcion: null,
        origen: 'BASICO'
      }]

      // Aplicar conceptos fijos GLOBALES
      for (const concepto of conceptosFijos) {
        let monto = 0
        if (concepto.porcentaje) {
          monto = sueldoBasico * parseFloat(concepto.porcentaje) / 100
        } else if (concepto.montoFijo) {
          monto = parseFloat(concepto.montoFijo)
        }

        if (monto > 0) {
          detalleConceptos.push({
            conceptoCodigo: concepto.codigo,
            conceptoNombre: concepto.nombre,
            tipo: concepto.tipo,
            monto: monto,
            descripcion: concepto.porcentaje ? `${concepto.porcentaje}% del sueldo basico` : null,
            origen: 'FIJO_GLOBAL'
          })

          if (concepto.tipo === 'HABER') haberes += monto
          else deducciones += monto
        }
      }

      // Aplicar conceptos fijos DEL EMPLEADO (vigentes en el período)
      for (const ce of (emp.conceptosFijos || [])) {
        // Filtro de vigencia
        if (ce.fechaInicio && new Date(ce.fechaInicio) > finPeriodo) continue
        if (ce.fechaFin && new Date(ce.fechaFin) < fechaPeriodo) continue

        let monto = 0
        if (ce.valor !== null && ce.valor !== undefined) {
          // Override del empleado
          monto = ce.esPorcentaje
            ? sueldoBasico * parseFloat(ce.valor) / 100
            : parseFloat(ce.valor)
        } else if (ce.concepto.porcentaje) {
          monto = sueldoBasico * parseFloat(ce.concepto.porcentaje) / 100
        } else if (ce.concepto.montoFijo) {
          monto = parseFloat(ce.concepto.montoFijo)
        }

        if (monto > 0) {
          let descripcion
          if (ce.valor !== null && ce.valor !== undefined) {
            descripcion = ce.esPorcentaje ? `${ce.valor}% (concepto fijo del empleado)` : 'Monto fijo del empleado'
          } else {
            descripcion = ce.concepto.porcentaje ? `${ce.concepto.porcentaje}% del sueldo basico` : null
          }

          detalleConceptos.push({
            conceptoCodigo: ce.concepto.codigo,
            conceptoNombre: ce.concepto.nombre,
            tipo: ce.concepto.tipo,
            monto: monto,
            descripcion,
            origen: 'FIJO_EMPLEADO',
            conceptoEmpleadoId: ce.id
          })

          if (ce.concepto.tipo === 'HABER') haberes += monto
          else deducciones += monto
        }
      }

      // Aplicar NOVEDADES del período
      const novedadesEmp = novedadesPorEntidad.get(emp.id) || []
      for (const nov of novedadesEmp) {
        const monto = parseFloat(nov.importe) || 0
        if (monto === 0) continue

        detalleConceptos.push({
          conceptoCodigo: nov.concepto.codigo,
          conceptoNombre: nov.concepto.nombre,
          tipo: nov.concepto.tipo,
          monto: monto,
          descripcion: nov.observaciones || 'Novedad del periodo',
          origen: 'NOVEDAD',
          novedadId: nov.id
        })

        if (nov.concepto.tipo === 'HABER') haberes += monto
        else deducciones += monto

        novedadIdsConsumidos.push(nov.id)
      }

      const netoAPagar = haberes - deducciones

      totalBruto += haberes
      totalDeducciones += deducciones
      totalNeto += netoAPagar

      return {
        entidadId: emp.id,
        sueldoBasico: sueldoBasico,
        totalHaberes: haberes,
        totalDeducciones: deducciones,
        netoAPagar: netoAPagar,
        detalleConceptos: detalleConceptos,
        estado: 'PENDIENTE'
      }
    })

    // Crear liquidación + marcar novedades como aplicadas en una transacción.
    // El proxy multi-tenant inyecta tenantId en el parent, pero NO en nested creates,
    // así que hay que ponerlo explícito en cada item.
    const itemsConTenant = items.map(it => ({ ...it, tenantId: req.tenantId }))
    const liquidacion = await req.db.$transaction(async (tx) => {
      const liq = await tx.liquidacionSueldo.create({
        data: {
          numero,
          periodo,
          mes: mesNum,
          anio: anioNum,
          totalBruto,
          totalDeducciones,
          totalNeto,
          observaciones,
          registradoPor: req.admin.id,
          items: { create: itemsConTenant }
        },
        include: {
          items: {
            include: {
              entidad: { include: { cargoPersonal: true } }
            }
          }
        }
      })

      if (novedadIdsConsumidos.length > 0) {
        await tx.novedadLiquidacion.updateMany({
          where: { id: { in: novedadIdsConsumidos } },
          data: {
            aplicada: true,
            liquidacionId: liq.id,
            fechaAplicacion: new Date()
          }
        })
      }

      return liq
    })

    // Asiento de devengamiento por cada item (D Gastos Personal / H Sueldos a Pagar)
    for (const it of liquidacion.items || []) {
      try {
        await generarAsientoDevengamientoSueldo(prisma, {
          itemLiquidacion: it,
          entidad: it.entidad,
          liquidacion,
          registradoPor: req.admin.id,
        })
      } catch (e) {
        console.error('[Liquidacion] Error devengamiento item ' + it.id + ':', e.message)
      }
    }

    res.status(201).json({ data: liquidacion })
  } catch (error) {
    console.error('Error creando liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /admin/liquidaciones/:id - Actualizar liquidacion (modificar conceptos)
router.put('/liquidaciones/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { observaciones, items } = req.body

    const liquidacion = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) }
    })

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidacion no encontrada' })
    }

    if (liquidacion.estado === 'PAGADO') {
      return res.status(400).json({ error: 'No se puede modificar una liquidacion pagada' })
    }

    // Si se envian items, actualizar cada uno
    if (items && Array.isArray(items)) {
      let totalBruto = 0
      let totalDeducciones = 0
      let totalNeto = 0

      for (const item of items) {
        // Recalcular totales del item
        let haberes = 0
        let deducciones = 0

        if (item.detalleConceptos) {
          for (const concepto of item.detalleConceptos) {
            if (concepto.tipo === 'HABER') {
              haberes += parseFloat(concepto.monto) || 0
            } else {
              deducciones += parseFloat(concepto.monto) || 0
            }
          }
        }

        const netoAPagar = haberes - deducciones

        await req.db.itemLiquidacion.update({
          where: { id: item.id },
          data: {
            totalHaberes: haberes,
            totalDeducciones: deducciones,
            netoAPagar: netoAPagar,
            detalleConceptos: item.detalleConceptos,
            observaciones: item.observaciones
          }
        })

        totalBruto += haberes
        totalDeducciones += deducciones
        totalNeto += netoAPagar
      }

      // Actualizar totales de la liquidacion
      await req.db.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: {
          totalBruto,
          totalDeducciones,
          totalNeto,
          observaciones
        }
      })
    } else if (observaciones !== undefined) {
      await req.db.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: { observaciones }
      })
    }

    // Retornar liquidacion actualizada
    const updated = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            entidad: {
              include: {
                cargoPersonal: true
              }
            }
          },
          orderBy: { entidad: { razonSocial: 'asc' } }
        }
      }
    })

    res.json(updated)
  } catch (error) {
    console.error('Error actualizando liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/liquidaciones/:id/pagar - Pagar un empleado de la liquidacion
router.post('/liquidaciones/:id/pagar', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { itemId, cajaId, medioPago, nroOperacion, observaciones } = req.body

    if (!itemId || !cajaId || !medioPago) {
      return res.status(400).json({ error: 'itemId, cajaId y medioPago son requeridos' })
    }

    const item = await req.db.itemLiquidacion.findUnique({
      where: { id: parseInt(itemId) },
      include: {
        entidad: true,
        liquidacion: true
      }
    })

    if (!item) {
      return res.status(404).json({ error: 'Item de liquidacion no encontrado' })
    }

    if (item.liquidacionId !== parseInt(id)) {
      return res.status(400).json({ error: 'El item no pertenece a esta liquidacion' })
    }

    if (item.estado === 'PAGADO') {
      return res.status(400).json({ error: 'Este item ya fue pagado' })
    }

    // Crear Orden de Pago
    const year = new Date().getFullYear()
    const count = await req.db.movimientoContable.count({
      where: { tipo: 'ORDEN_PAGO' }
    })
    const numero = `OP-${year}-${(count + 1).toString().padStart(5, '0')}`

    const cajaPago = await req.db.caja.findUnique({ where: { id: parseInt(cajaId) } })

    // Imputar al CC de la entidad (empleado); si no tiene, caer al CC de la caja
    const ccPago = item.entidad.centroCostoId ?? cajaPago?.centroCostoId ?? null

    const ordenPago = await req.db.$transaction(async (tx) => {
      // Crear la orden de pago
      const op = await tx.movimientoContable.create({
        data: {
          numero,
          tipo: 'ORDEN_PAGO',
          entidadId: item.entidadId,
          fecha: new Date(),
          montoTotal: item.netoAPagar,
          montoPagado: item.netoAPagar,
          saldoPendiente: 0,
          cajaId: parseInt(cajaId),
          medioPago,
          nroOperacion,
          observaciones: observaciones || `Pago sueldo ${item.liquidacion.periodo} - ${item.entidad.razonSocial}`,
          estado: 'PAGADO',
          centroCostoId: ccPago,
          registradoPor: req.admin.id
        }
      })

      // Actualizar item como pagado
      await tx.itemLiquidacion.update({
        where: { id: parseInt(itemId) },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date(),
          movimientoContableId: op.id
        }
      })

      // Resolver concepto de Sueldos (SUE) y su cuenta contable asociada.
      // Si no existe el concepto, caer a la primera cuenta activa (legacy).
      const conceptoSueldos = await tx.conceptoTesoreria.findFirst({
        where: { codigo: 'SUE', activo: true },
        include: { cuentaContable: true }
      })
      const cuentaContable = conceptoSueldos?.cuentaContable
        || await tx.cuentaContable.findFirst({ where: { activo: true } })
      if (!cuentaContable) {
        throw new Error('No hay cuentas contables configuradas')
      }

      // Resolver medioPagoId desde el código string que llega del frontend
      const medioPagoRel = await tx.medioPago.findFirst({
        where: { OR: [{ codigo: medioPago }, { nombre: medioPago }] }
      })

      const mvCount = await tx.movimientoCaja.count()
      const mvNumero = `MV-${year}-${(mvCount + 1).toString().padStart(6, '0')}`

      const mvCaja = await tx.movimientoCaja.create({
        data: {
          numero: mvNumero,
          cajaId: parseInt(cajaId),
          fecha: new Date(),
          tipo: 'EGRESO',
          cuentaContableId: cuentaContable.id,
          monto: item.netoAPagar,
          concepto: `Pago sueldo ${item.liquidacion.periodo}`,
          descripcion: item.entidad.razonSocial,
          movimientoContableId: op.id,
          centroCostoId: ccPago,
          entidadId: item.entidadId,
          medioPagoId: medioPagoRel?.id || null,
          registradoPor: req.admin.id
        }
      })

      // Crear ItemMovimientoCaja (concepto detallado) + MedioPagoMovimientoCaja
      await tx.itemMovimientoCaja.create({
        data: {
          tenantId: req.tenantId,
          movimientoCajaId: mvCaja.id,
          conceptoTesoreriaId: conceptoSueldos?.id || null,
          cuentaContableId: cuentaContable.id,
          centroCostoId: ccPago,
          monto: item.netoAPagar,
          descripcion: `Sueldo ${item.entidad.razonSocial} - ${item.liquidacion.periodo}`,
          orden: 0,
        }
      })
      if (medioPagoRel) {
        await tx.medioPagoMovimientoCaja.create({
          data: {
            tenantId: req.tenantId,
            movimientoCajaId: mvCaja.id,
            medioPagoId: medioPagoRel.id,
            monto: item.netoAPagar,
            nroOperacion: nroOperacion || null,
            orden: 0,
          }
        })
      }

      // Actualizar saldo de caja
      await tx.caja.update({
        where: { id: parseInt(cajaId) },
        data: { saldoActual: { decrement: item.netoAPagar } }
      })

      return op
    })

    // Generar asiento contable (fuera de la transacción para no fallar el pago si hay error)
    try {
      const caja = await req.db.caja.findUnique({
        where: { id: parseInt(cajaId) },
        include: { cuentaContable: true }
      })

      await generarAsientoPagoSueldo(prisma, {
        ordenPago,
        itemLiquidacion: item,
        entidad: item.entidad,
        caja,
        liquidacion: item.liquidacion,
        registradoPor: req.admin.id
      })
    } catch (asientoError) {
      console.error('[Liquidacion] Error generando asiento contable:', asientoError)
      // No fallar el pago si el asiento falla
    }

    // Verificar si todos los items estan pagados
    const itemsPendientes = await req.db.itemLiquidacion.count({
      where: {
        liquidacionId: parseInt(id),
        estado: 'PENDIENTE'
      }
    })

    // Actualizar estado de liquidacion
    const nuevoEstado = itemsPendientes === 0 ? 'PAGADO' : 'PARCIAL'
    await req.db.liquidacionSueldo.update({
      where: { id: parseInt(id) },
      data: {
        estado: nuevoEstado,
        fechaPago: nuevoEstado === 'PAGADO' ? new Date() : undefined
      }
    })

    res.json({
      message: 'Pago registrado correctamente',
      ordenPago
    })
  } catch (error) {
    console.error('Error pagando item:', error)
    res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
})

// POST /admin/liquidaciones/:id/pagar-todos - Pagar todos los empleados pendientes
router.post('/liquidaciones/:id/pagar-todos', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { cajaId, medioPago, nroOperacion } = req.body

    if (!cajaId || !medioPago) {
      return res.status(400).json({ error: 'cajaId y medioPago son requeridos' })
    }

    const liquidacion = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          where: { estado: 'PENDIENTE' },
          include: { entidad: true }
        }
      }
    })

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidacion no encontrada' })
    }

    if (liquidacion.items.length === 0) {
      return res.status(400).json({ error: 'No hay items pendientes de pago' })
    }

    // Concepto SUE + cuenta contable (igual que en /pagar individual)
    const conceptoSueldos = await req.db.conceptoTesoreria.findFirst({
      where: { codigo: 'SUE', activo: true },
      include: { cuentaContable: true }
    })
    const cuentaContable = conceptoSueldos?.cuentaContable
      || await req.db.cuentaContable.findFirst({ where: { activo: true } })
    if (!cuentaContable) {
      return res.status(400).json({ error: 'No hay cuentas contables configuradas' })
    }

    // Resolver medio de pago FK
    const medioPagoRel = await req.db.medioPago.findFirst({
      where: { OR: [{ codigo: medioPago }, { nombre: medioPago }] }
    })

    const cajaBatch = await req.db.caja.findUnique({
      where: { id: parseInt(cajaId) },
      include: { cuentaContable: true }
    })

    const year = new Date().getFullYear()

    const opsCreadas = []
    await req.db.$transaction(async (tx) => {
      let montoTotalPagado = 0

      for (const item of liquidacion.items) {
        // Crear orden de pago para cada empleado
        const opCount = await tx.movimientoContable.count({
          where: { tipo: 'ORDEN_PAGO' }
        })
        const opNumero = `OP-${year}-${(opCount + 1).toString().padStart(5, '0')}`

        // Imputar al CC de la entidad (empleado); si no tiene, caer al CC de la caja
        const ccPagoItem = item.entidad.centroCostoId ?? cajaBatch?.centroCostoId ?? null

        const op = await tx.movimientoContable.create({
          data: {
            numero: opNumero,
            tipo: 'ORDEN_PAGO',
            entidadId: item.entidadId,
            fecha: new Date(),
            montoTotal: item.netoAPagar,
            montoPagado: item.netoAPagar,
            saldoPendiente: 0,
            cajaId: parseInt(cajaId),
            medioPago,
            nroOperacion,
            observaciones: `Pago sueldo ${liquidacion.periodo} - ${item.entidad.razonSocial}`,
            estado: 'PAGADO',
            centroCostoId: ccPagoItem,
            registradoPor: req.admin.id
          }
        })

        // Actualizar item como pagado
        await tx.itemLiquidacion.update({
          where: { id: item.id },
          data: {
            estado: 'PAGADO',
            fechaPago: new Date(),
            movimientoContableId: op.id
          }
        })

        // Crear movimiento de caja con todos los datos (entidad, medioPago, items, mediosPago)
        const mvCount = await tx.movimientoCaja.count()
        const mvNumero = `MV-${year}-${(mvCount + 1).toString().padStart(6, '0')}`
        const mvCaja = await tx.movimientoCaja.create({
          data: {
            numero: mvNumero,
            cajaId: parseInt(cajaId),
            fecha: new Date(),
            tipo: 'EGRESO',
            cuentaContableId: cuentaContable.id,
            monto: item.netoAPagar,
            concepto: `Pago sueldo ${liquidacion.periodo}`,
            descripcion: item.entidad.razonSocial,
            movimientoContableId: op.id,
            centroCostoId: ccPagoItem,
            entidadId: item.entidadId,
            medioPagoId: medioPagoRel?.id || null,
            registradoPor: req.admin.id
          }
        })
        await tx.itemMovimientoCaja.create({
          data: {
            tenantId: req.tenantId,
            movimientoCajaId: mvCaja.id,
            conceptoTesoreriaId: conceptoSueldos?.id || null,
            cuentaContableId: cuentaContable.id,
            centroCostoId: ccPagoItem,
            monto: item.netoAPagar,
            descripcion: `Sueldo ${item.entidad.razonSocial} - ${liquidacion.periodo}`,
            orden: 0,
          }
        })
        if (medioPagoRel) {
          await tx.medioPagoMovimientoCaja.create({
            data: {
              tenantId: req.tenantId,
              movimientoCajaId: mvCaja.id,
              medioPagoId: medioPagoRel.id,
              monto: item.netoAPagar,
              nroOperacion: nroOperacion || null,
              orden: 0,
            }
          })
        }

        montoTotalPagado += parseFloat(item.netoAPagar)
        opsCreadas.push({ op, item })
      }

      // Actualizar saldo de caja
      await tx.caja.update({
        where: { id: parseInt(cajaId) },
        data: { saldoActual: { decrement: montoTotalPagado } }
      })

      // Actualizar liquidacion como pagada
      await tx.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date()
        }
      })
    })

    // Generar asientos contables fuera de la transacción (no fallar el pago si fallan)
    for (const { op, item } of opsCreadas) {
      try {
        await generarAsientoPagoSueldo(prisma, {
          ordenPago: op,
          itemLiquidacion: item,
          entidad: item.entidad,
          caja: cajaBatch,
          liquidacion,
          registradoPor: req.admin.id,
        })
      } catch (asientoError) {
        console.error('[Liquidacion] Error generando asiento masivo:', asientoError)
      }
    }

    res.json({
      message: `Se pagaron ${liquidacion.items.length} empleados correctamente`
    })
  } catch (error) {
    console.error('Error pagando liquidacion:', error)
    res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
})

// POST /admin/liquidaciones/:id/anular - Revertir pagos y dejar liquidación pendiente
// Para cada item PAGADO: genera un MovimientoCaja inverso (INGRESO) en la misma caja,
// anula el MovimientoCaja original y la OrdenPago, devuelve el saldo a la caja,
// y deja el item en estado PENDIENTE (para que pueda re-pagarse o editarse).
router.post('/liquidaciones/:id/anular', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const liquidacion = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: { include: { entidad: { select: { razonSocial: true } } } }
      }
    })
    if (!liquidacion) return res.status(404).json({ error: 'Liquidacion no encontrada' })

    const itemsPagados = liquidacion.items.filter(it => it.estado === 'PAGADO')
    const year = new Date().getFullYear()

    const reversos = []
    await req.db.$transaction(async (tx) => {
      for (const item of itemsPagados) {
        if (!item.movimientoContableId) continue
        const mvOriginal = await tx.movimientoCaja.findFirst({
          where: { movimientoContableId: item.movimientoContableId },
        })
        if (!mvOriginal) continue

        // Crear movimiento de caja inverso (INGRESO)
        const mvCount = await tx.movimientoCaja.count()
        const mvNumero = `MV-${year}-${(mvCount + 1).toString().padStart(6, '0')}`
        const mvInverso = await tx.movimientoCaja.create({
          data: {
            numero: mvNumero,
            cajaId: mvOriginal.cajaId,
            fecha: new Date(),
            tipo: 'INGRESO',
            cuentaContableId: mvOriginal.cuentaContableId,
            monto: mvOriginal.monto,
            concepto: `Reverso pago sueldo ${liquidacion.periodo}`,
            descripcion: `${item.entidad.razonSocial} — Reverso de ${mvOriginal.numero}`,
            centroCostoId: mvOriginal.centroCostoId,
            entidadId: mvOriginal.entidadId,
            medioPagoId: mvOriginal.medioPagoId,
            registradoPor: req.admin.id,
          }
        })

        // Items del reverso (clonar items del original como INGRESO)
        const itemsOriginales = await tx.itemMovimientoCaja.findMany({ where: { movimientoCajaId: mvOriginal.id } })
        for (const it of itemsOriginales) {
          await tx.itemMovimientoCaja.create({
            data: {
              tenantId: it.tenantId,
              movimientoCajaId: mvInverso.id,
              conceptoTesoreriaId: it.conceptoTesoreriaId,
              cuentaContableId: it.cuentaContableId,
              centroCostoId: it.centroCostoId,
              monto: it.monto,
              descripcion: `Reverso · ${it.descripcion || ''}`.trim(),
              orden: it.orden,
            }
          })
        }
        // Medios de pago del reverso
        const mediosOriginales = await tx.medioPagoMovimientoCaja.findMany({ where: { movimientoCajaId: mvOriginal.id } })
        for (const mp of mediosOriginales) {
          await tx.medioPagoMovimientoCaja.create({
            data: {
              tenantId: mp.tenantId,
              movimientoCajaId: mvInverso.id,
              medioPagoId: mp.medioPagoId,
              monto: mp.monto,
              nroOperacion: mp.nroOperacion,
              orden: mp.orden,
            }
          })
        }

        // Anular el MV original
        await tx.movimientoCaja.update({
          where: { id: mvOriginal.id },
          data: { anulado: true, fechaAnulacion: new Date(), motivoAnulacion: `Anulación liquidación ${liquidacion.periodo}` },
        })

        // Anular la OrdenPago
        await tx.movimientoContable.update({
          where: { id: item.movimientoContableId },
          data: { estado: 'ANULADO' },
        })

        // Devolver saldo a la caja (la plata "vuelve")
        await tx.caja.update({
          where: { id: mvOriginal.cajaId },
          data: { saldoActual: { increment: Number(mvOriginal.monto) } },
        })

        // Reset del item a PENDIENTE
        await tx.itemLiquidacion.update({
          where: { id: item.id },
          data: { estado: 'PENDIENTE', fechaPago: null, movimientoContableId: null },
        })

        reversos.push({ itemId: item.id, mvOriginal: mvOriginal.numero, mvReverso: mvNumero })
      }

      // Marcar liquidación como PENDIENTE
      await tx.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: { estado: 'PENDIENTE', fechaPago: null },
      })
    })

    // Anular asientos contables (fuera de la transacción)
    // 1) Por cada pago revertido: anular asiento PAGO_SUELDO
    for (const rev of reversos) {
      const item = itemsPagados.find(it => it.id === rev.itemId)
      if (!item) continue
      try {
        await anularAsiento(
          prisma,
          'PAGO_SUELDO',
          item.movimientoContableId,
          req.admin.id,
          `Anulación liquidación ${liquidacion.periodo}`
        )
      } catch (e) {
        console.error('[Liquidacion] Error anulando asiento pago:', e.message)
      }
    }
    // 2) Anular asientos DEVENGAMIENTO_SUELDO de TODOS los items de la liquidación
    for (const item of liquidacion.items) {
      try {
        await anularAsiento(
          prisma,
          'DEVENGAMIENTO_SUELDO',
          item.id,
          req.admin.id,
          `Anulación liquidación ${liquidacion.periodo}`
        )
      } catch (e) {
        console.error('[Liquidacion] Error anulando devengamiento:', e.message)
      }
    }

    res.json({ success: true, message: `Liquidación anulada. Se revirtieron ${reversos.length} pagos.`, reversos })
  } catch (error) {
    console.error('Error anulando liquidacion:', error)
    res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
})

// DELETE /admin/liquidaciones/:id - Anular liquidacion
router.delete('/liquidaciones/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const liquidacion = await req.db.liquidacionSueldo.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          where: { estado: 'PAGADO' }
        }
      }
    })

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidacion no encontrada' })
    }

    if (liquidacion.items.length > 0) {
      return res.status(400).json({
        error: 'No se puede anular una liquidacion con pagos realizados'
      })
    }

    await req.db.$transaction(async (tx) => {
      await tx.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: { estado: 'ANULADO' }
      })

      // Liberar novedades asociadas para que vuelvan a estar disponibles
      await tx.novedadLiquidacion.updateMany({
        where: { liquidacionId: parseInt(id) },
        data: {
          aplicada: false,
          liquidacionId: null,
          fechaAplicacion: null
        }
      })
    })

    res.json({ message: 'Liquidacion anulada correctamente' })
  } catch (error) {
    console.error('Error anulando liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ===============================================================
// CONCEPTOS FIJOS DEL EMPLEADO
// ===============================================================

// GET /admin/entidades/:entidadId/conceptos-liquidacion
router.get('/entidades/:entidadId/conceptos-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const entidadId = parseInt(req.params.entidadId)
    const conceptos = await req.db.conceptoEmpleado.findMany({
      where: { entidadId },
      include: { concepto: true },
      orderBy: [{ activo: 'desc' }, { id: 'asc' }]
    })
    res.json({ success: true, data: conceptos })
  } catch (error) {
    console.error('Error obteniendo conceptos del empleado:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/entidades/:entidadId/conceptos-liquidacion
router.post('/entidades/:entidadId/conceptos-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const entidadId = parseInt(req.params.entidadId)
    const { conceptoId, valor, esPorcentaje, fechaInicio, fechaFin, activo, observaciones } = req.body

    if (!conceptoId) return res.status(400).json({ error: 'conceptoId es requerido' })

    const entidad = await req.db.entidad.findUnique({ where: { id: entidadId } })
    if (!entidad) return res.status(404).json({ error: 'Empleado no encontrado' })
    if (entidad.tipo !== 'PERSONAL') {
      return res.status(400).json({ error: 'La entidad no es PERSONAL' })
    }

    const creado = await req.db.conceptoEmpleado.create({
      data: {
        entidadId,
        conceptoId: parseInt(conceptoId),
        valor: valor !== null && valor !== undefined && valor !== '' ? parseFloat(valor) : null,
        esPorcentaje: !!esPorcentaje,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        activo: activo !== undefined ? !!activo : true,
        observaciones: observaciones || null
      },
      include: { concepto: true }
    })

    res.status(201).json(creado)
  } catch (error) {
    console.error('Error creando concepto del empleado:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El empleado ya tiene este concepto asignado' })
    }
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /admin/entidades/:entidadId/conceptos-liquidacion/:id
router.put('/entidades/:entidadId/conceptos-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const entidadId = parseInt(req.params.entidadId)
    const id = parseInt(req.params.id)
    const { valor, esPorcentaje, fechaInicio, fechaFin, activo, observaciones } = req.body

    const existente = await req.db.conceptoEmpleado.findUnique({ where: { id } })
    if (!existente || existente.entidadId !== entidadId) {
      return res.status(404).json({ error: 'Concepto no encontrado' })
    }

    const actualizado = await req.db.conceptoEmpleado.update({
      where: { id },
      data: {
        valor: valor !== undefined ? (valor === null || valor === '' ? null : parseFloat(valor)) : undefined,
        esPorcentaje: esPorcentaje !== undefined ? !!esPorcentaje : undefined,
        fechaInicio: fechaInicio !== undefined ? (fechaInicio ? new Date(fechaInicio) : null) : undefined,
        fechaFin: fechaFin !== undefined ? (fechaFin ? new Date(fechaFin) : null) : undefined,
        activo: activo !== undefined ? !!activo : undefined,
        observaciones: observaciones !== undefined ? (observaciones || null) : undefined
      },
      include: { concepto: true }
    })

    res.json(actualizado)
  } catch (error) {
    console.error('Error actualizando concepto del empleado:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /admin/entidades/:entidadId/conceptos-liquidacion/:id
router.delete('/entidades/:entidadId/conceptos-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const entidadId = parseInt(req.params.entidadId)
    const id = parseInt(req.params.id)

    const existente = await req.db.conceptoEmpleado.findUnique({ where: { id } })
    if (!existente || existente.entidadId !== entidadId) {
      return res.status(404).json({ error: 'Concepto no encontrado' })
    }

    await req.db.conceptoEmpleado.delete({ where: { id } })
    res.json({ message: 'Concepto eliminado' })
  } catch (error) {
    console.error('Error eliminando concepto del empleado:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ===============================================================
// NOVEDADES DE LIQUIDACION (variables del periodo)
// ===============================================================

// GET /admin/novedades-liquidacion?mes=&anio=&entidadId=&aplicada=
router.get('/novedades-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const { mes, anio, entidadId, aplicada } = req.query

    const where = {}
    if (mes) where.mes = parseInt(mes)
    if (anio) where.anio = parseInt(anio)
    if (entidadId) where.entidadId = parseInt(entidadId)
    if (aplicada !== undefined) where.aplicada = aplicada === 'true'

    const novedades = await req.db.novedadLiquidacion.findMany({
      where,
      include: {
        concepto: true,
        entidad: { select: { id: true, razonSocial: true, codigo: true, legajo: true } }
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { id: 'desc' }]
    })

    res.json(novedades)
  } catch (error) {
    console.error('Error obteniendo novedades:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /admin/novedades-liquidacion
router.post('/novedades-liquidacion', authenticateAdmin, async (req, res) => {
  try {
    const { entidadId, conceptoId, mes, anio, importe, observaciones } = req.body

    if (!entidadId || !conceptoId || !mes || !anio || importe === undefined || importe === null) {
      return res.status(400).json({ error: 'entidadId, conceptoId, mes, anio e importe son requeridos' })
    }

    const importeNum = parseFloat(importe)
    if (isNaN(importeNum) || importeNum <= 0) {
      return res.status(400).json({ error: 'El importe debe ser mayor a 0' })
    }

    // Validar que no exista ya una liquidación cerrada para ese período (no se pueden agregar novedades retroactivas)
    const liqExistente = await req.db.liquidacionSueldo.findFirst({
      where: { mes: parseInt(mes), anio: parseInt(anio), estado: { not: 'ANULADO' } }
    })
    if (liqExistente) {
      return res.status(400).json({
        error: `Ya existe una liquidación generada para ${mes}/${anio}. Anúlela primero o cargue las novedades en el período siguiente.`
      })
    }

    const novedad = await req.db.novedadLiquidacion.create({
      data: {
        entidadId: parseInt(entidadId),
        conceptoId: parseInt(conceptoId),
        mes: parseInt(mes),
        anio: parseInt(anio),
        importe: importeNum,
        observaciones: observaciones || null,
        registradoPor: req.admin.id
      },
      include: {
        concepto: true,
        entidad: { select: { id: true, razonSocial: true, codigo: true, legajo: true } }
      }
    })

    res.status(201).json(novedad)
  } catch (error) {
    console.error('Error creando novedad:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'El empleado ya tiene una novedad de ese concepto cargada para ese período'
      })
    }
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /admin/novedades-liquidacion/:id
router.put('/novedades-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { importe, observaciones } = req.body

    const existente = await req.db.novedadLiquidacion.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Novedad no encontrada' })
    if (existente.aplicada) {
      return res.status(400).json({ error: 'No se puede modificar una novedad ya aplicada en una liquidación' })
    }

    const data = {}
    if (importe !== undefined) {
      const n = parseFloat(importe)
      if (isNaN(n) || n <= 0) return res.status(400).json({ error: 'Importe inválido' })
      data.importe = n
    }
    if (observaciones !== undefined) data.observaciones = observaciones || null

    const actualizada = await req.db.novedadLiquidacion.update({
      where: { id },
      data,
      include: {
        concepto: true,
        entidad: { select: { id: true, razonSocial: true, codigo: true, legajo: true } }
      }
    })

    res.json(actualizada)
  } catch (error) {
    console.error('Error actualizando novedad:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /admin/novedades-liquidacion/:id
router.delete('/novedades-liquidacion/:id', authenticateAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const existente = await req.db.novedadLiquidacion.findUnique({ where: { id } })
    if (!existente) return res.status(404).json({ error: 'Novedad no encontrada' })
    if (existente.aplicada) {
      return res.status(400).json({ error: 'No se puede eliminar una novedad ya aplicada. Anule la liquidación primero.' })
    }

    await req.db.novedadLiquidacion.delete({ where: { id } })
    res.json({ message: 'Novedad eliminada' })
  } catch (error) {
    console.error('Error eliminando novedad:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /admin/entidades/:entidadId/liquidaciones
// Historial de liquidaciones del empleado (items + parent + MV de pago si existe).
router.get('/entidades/:entidadId/liquidaciones', authenticateAdmin, async (req, res) => {
  try {
    const entidadId = parseInt(req.params.entidadId)
    const items = await req.db.itemLiquidacion.findMany({
      where: { entidadId },
      include: {
        liquidacion: {
          select: { id: true, numero: true, periodo: true, mes: true, anio: true, estado: true }
        },
        // MovimientoContable (orden de pago) → buscamos su MovimientoCaja asociado
        // a través del backref. Lo hacemos en una segunda query porque el FK está
        // en MovimientoContable, no en ItemLiquidacion.
      },
      orderBy: [{ liquidacion: { anio: 'desc' } }, { liquidacion: { mes: 'desc' } }]
    })

    // Para los items pagados, obtener el MV de tesorería (vía movimientoContableId)
    const opIds = items.map(i => i.movimientoContableId).filter(Boolean)
    let mvByOp = {}
    if (opIds.length > 0) {
      const movs = await req.db.movimientoCaja.findMany({
        where: { movimientoContableId: { in: opIds } },
        select: {
          id: true,
          numero: true,
          movimientoContableId: true,
          medioPagoRel: { select: { id: true, nombre: true } },
          caja: { select: { id: true, nombre: true } }
        }
      })
      mvByOp = Object.fromEntries(movs.map(m => [m.movimientoContableId, m]))
    }

    const enriched = items.map(it => ({
      ...it,
      movimientoCaja: it.movimientoContableId ? (mvByOp[it.movimientoContableId] || null) : null
    }))

    res.json({ success: true, data: enriched })
  } catch (error) {
    console.error('Error obteniendo historial liquidaciones:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
