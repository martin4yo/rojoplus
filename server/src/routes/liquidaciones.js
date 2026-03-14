import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authAdmin } from '../middleware/auth.js'
import { generarAsientoPagoSueldo } from '../services/asientosContables.js'

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

    const conceptos = await prisma.conceptoLiquidacion.findMany({
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
    const concepto = await prisma.conceptoLiquidacion.findUnique({
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

    const concepto = await prisma.conceptoLiquidacion.create({
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

    res.status(201).json(concepto)
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

    const concepto = await prisma.conceptoLiquidacion.update({
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

    res.json(concepto)
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
      prisma.liquidacionSueldo.findMany({
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
      prisma.liquidacionSueldo.count({ where })
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

    const liquidacion = await prisma.liquidacionSueldo.findUnique({
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
    const existente = await prisma.liquidacionSueldo.findUnique({
      where: { mes_anio: { mes: parseInt(mes), anio: parseInt(anio) } }
    })

    if (existente) {
      return res.status(400).json({ error: `Ya existe una liquidacion para ${mes}/${anio}` })
    }

    // Obtener personal activo con sueldo
    const personal = await prisma.entidad.findMany({
      where: {
        tipo: 'PERSONAL',
        activo: true,
        sueldoBasico: { not: null }
      },
      include: {
        cargoPersonal: true
      },
      orderBy: { razonSocial: 'asc' }
    })

    if (personal.length === 0) {
      return res.status(400).json({ error: 'No hay personal activo con sueldo configurado' })
    }

    // Obtener conceptos fijos activos
    const conceptosFijos = await prisma.conceptoLiquidacion.findMany({
      where: {
        activo: true,
        esFijo: true
      },
      orderBy: { orden: 'asc' }
    })

    // Nombre del periodo
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const periodo = `${meses[parseInt(mes) - 1]} ${anio}`
    const numero = await generarNumeroLiquidacion(parseInt(mes), parseInt(anio))

    // Crear liquidacion con items
    let totalBruto = 0
    let totalDeducciones = 0
    let totalNeto = 0

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
        descripcion: null
      }]

      // Aplicar conceptos fijos
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
            descripcion: concepto.porcentaje ? `${concepto.porcentaje}% del sueldo basico` : null
          })

          if (concepto.tipo === 'HABER') {
            haberes += monto
          } else {
            deducciones += monto
          }
        }
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

    const liquidacion = await prisma.liquidacionSueldo.create({
      data: {
        numero,
        periodo,
        mes: parseInt(mes),
        anio: parseInt(anio),
        totalBruto,
        totalDeducciones,
        totalNeto,
        observaciones,
        registradoPor: req.admin.id,
        items: {
          create: items
        }
      },
      include: {
        items: {
          include: {
            entidad: {
              include: {
                cargoPersonal: true
              }
            }
          }
        }
      }
    })

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

    const liquidacion = await prisma.liquidacionSueldo.findUnique({
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

        await prisma.itemLiquidacion.update({
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
      await prisma.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: {
          totalBruto,
          totalDeducciones,
          totalNeto,
          observaciones
        }
      })
    } else if (observaciones !== undefined) {
      await prisma.liquidacionSueldo.update({
        where: { id: parseInt(id) },
        data: { observaciones }
      })
    }

    // Retornar liquidacion actualizada
    const updated = await prisma.liquidacionSueldo.findUnique({
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

    const item = await prisma.itemLiquidacion.findUnique({
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
    const count = await prisma.movimientoContable.count({
      where: { tipo: 'ORDEN_PAGO' }
    })
    const numero = `OP-${year}-${(count + 1).toString().padStart(5, '0')}`

    const ordenPago = await prisma.$transaction(async (tx) => {
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

      // Crear movimiento de caja
      const cuentaContable = await tx.cuentaContable.findFirst({
        where: { activo: true }
      })

      if (!cuentaContable) {
        throw new Error('No hay cuentas contables configuradas')
      }

      const mvCount = await tx.movimientoCaja.count()
      const mvNumero = `MV-${year}-${(mvCount + 1).toString().padStart(6, '0')}`

      await tx.movimientoCaja.create({
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
          registradoPor: req.admin.id
        }
      })

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
    const itemsPendientes = await prisma.itemLiquidacion.count({
      where: {
        liquidacionId: parseInt(id),
        estado: 'PENDIENTE'
      }
    })

    // Actualizar estado de liquidacion
    const nuevoEstado = itemsPendientes === 0 ? 'PAGADO' : 'PARCIAL'
    await prisma.liquidacionSueldo.update({
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

    const liquidacion = await prisma.liquidacionSueldo.findUnique({
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

    const cuentaContable = await req.db.cuentaContable.findFirst({
      where: { activo: true }
    })

    if (!cuentaContable) {
      return res.status(400).json({ error: 'No hay cuentas contables configuradas' })
    }

    const year = new Date().getFullYear()

    await prisma.$transaction(async (tx) => {
      let montoTotalPagado = 0

      for (const item of liquidacion.items) {
        // Crear orden de pago para cada empleado
        const opCount = await tx.movimientoContable.count({
          where: { tipo: 'ORDEN_PAGO' }
        })
        const opNumero = `OP-${year}-${(opCount + 1).toString().padStart(5, '0')}`

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

        // Crear movimiento de caja
        const mvCount = await tx.movimientoCaja.count()
        const mvNumero = `MV-${year}-${(mvCount + 1).toString().padStart(6, '0')}`

        await tx.movimientoCaja.create({
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
            registradoPor: req.admin.id
          }
        })

        montoTotalPagado += parseFloat(item.netoAPagar)
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

    res.json({
      message: `Se pagaron ${liquidacion.items.length} empleados correctamente`
    })
  } catch (error) {
    console.error('Error pagando liquidacion:', error)
    res.status(500).json({ error: error.message || 'Error interno del servidor' })
  }
})

// DELETE /admin/liquidaciones/:id - Anular liquidacion
router.delete('/liquidaciones/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const liquidacion = await prisma.liquidacionSueldo.findUnique({
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

    await prisma.liquidacionSueldo.update({
      where: { id: parseInt(id) },
      data: { estado: 'ANULADO' }
    })

    res.json({ message: 'Liquidacion anulada correctamente' })
  } catch (error) {
    console.error('Error anulando liquidacion:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
