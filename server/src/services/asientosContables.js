/**
 * Servicio para generación automática de asientos contables
 *
 * Este servicio genera asientos de partida doble automáticamente cuando se realizan
 * operaciones financieras como pagos, cobranzas, facturas, etc.
 *
 * IMPORTANTE: Los errores en la generación de asientos NO deben fallar la operación principal.
 * Se loguean los errores pero se permite continuar.
 */

// Códigos de cuentas contables estándar (deben coincidir con seed.js)
const CUENTAS = {
  // Activo
  CAJA_EFECTIVO: '1.1.1.01',
  BANCO_CC: '1.1.1.02',
  CLIENTES: '1.1.2.01',
  DEUDORES_CUOTAS: '1.1.2.02',
  IVA_CF_21: '1.1.3.01',
  IVA_CF_105: '1.1.3.02',
  IVA_CF_27: '1.1.3.03',
  MERCADERIAS: '1.1.4.01',

  // Pasivo
  PROVEEDORES: '2.1.1.01',
  IVA_DF_21: '2.1.2.01',
  IVA_DF_105: '2.1.2.02',
  IVA_DF_27: '2.1.2.03',

  // Ingresos
  CUOTA_SOCIAL: '4.1.01',
  CUOTA_DEPORTIVA: '4.1.02',
  VENTAS_MERCADERIA: '4.2.01',
  INGRESOS_MORA: '4.2.02', // Ingresos financieros por recargos
  OTROS_INGRESOS: '4.3.99',

  // Egresos
  GASTOS_VARIOS: '5.9.99',
}

/**
 * Genera el próximo número de asiento
 */
async function generarNumeroAsiento(prisma) {
  const year = new Date().getFullYear()
  const prefix = `AST-${year}-`

  const ultimoAsiento = await prisma.asiento.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { numero: 'desc' },
  })

  let secuencia = 1
  if (ultimoAsiento) {
    const partes = ultimoAsiento.numero.split('-')
    secuencia = parseInt(partes[2]) + 1
  }

  return `${prefix}${secuencia.toString().padStart(5, '0')}`
}

/**
 * Obtiene el ID de una cuenta contable por su código
 */
async function getCuentaId(prisma, codigo) {
  const cuenta = await prisma.cuentaContable.findUnique({
    where: { codigo },
  })
  if (!cuenta) {
    throw new Error(`Cuenta contable ${codigo} no encontrada`)
  }
  return cuenta.id
}

/**
 * Crea un asiento contable con sus líneas
 * @param {Object} prisma - Cliente Prisma (o transacción)
 * @param {Object} datos - Datos del asiento
 * @param {string} datos.concepto - Descripción del asiento
 * @param {Date} datos.fecha - Fecha del asiento
 * @param {string} datos.tipoOrigen - Tipo de documento origen (PAGO, COBRANZA, FACTURA_COMPRA, etc.)
 * @param {number} datos.origenId - ID del documento origen
 * @param {number} datos.registradoPor - ID del admin que registra
 * @param {number} datos.centroCostoId - ID del centro de costo (opcional)
 * @param {Array} datos.lineas - Líneas del asiento [{cuentaCodigo, debe, haber, descripcion, centroCostoId}]
 */
async function crearAsiento(prisma, datos) {
  const { concepto, fecha, tipoOrigen, origenId, registradoPor, centroCostoId, lineas } = datos

  // Validar que el asiento esté balanceado
  const totalDebe = lineas.reduce((sum, l) => sum + (l.debe || 0), 0)
  const totalHaber = lineas.reduce((sum, l) => sum + (l.haber || 0), 0)

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    throw new Error(`Asiento desbalanceado: Debe=${totalDebe}, Haber=${totalHaber}`)
  }

  // Filtrar líneas sin monto
  const lineasConMonto = lineas.filter(l => (l.debe || 0) > 0 || (l.haber || 0) > 0)

  if (lineasConMonto.length < 2) {
    throw new Error('El asiento debe tener al menos 2 líneas con monto')
  }

  // Obtener IDs de cuentas
  const lineasConIds = await Promise.all(
    lineasConMonto.map(async (linea, index) => ({
      cuentaContableId: await getCuentaId(prisma, linea.cuentaCodigo),
      descripcion: linea.descripcion || null,
      debe: linea.debe || 0,
      haber: linea.haber || 0,
      // Usar centro de costo de la línea o el del asiento
      centroCostoId: linea.centroCostoId || centroCostoId || null,
      orden: index + 1,
    }))
  )

  // Crear asiento
  const asiento = await prisma.asiento.create({
    data: {
      numero: await generarNumeroAsiento(prisma),
      fecha: fecha || new Date(),
      concepto,
      estado: 'CONFIRMADO',
      tipoOrigen,
      origenId,
      registradoPor,
      lineas: {
        create: lineasConIds,
      },
    },
    include: { lineas: true },
  })

  return asiento
}

/**
 * Genera asiento para pago de cuota de socio
 *
 * Asiento:
 *   D: Caja (cuenta de la caja usada)      $montoTotal
 *   H: Ingresos por Cuotas                 $montoBase
 *   H: Ingresos por Mora                   $montoMora (si > 0)
 *
 * Centro de Costo:
 *   - Si es cuota DEPORTIVA: usar centro de costo de la actividad
 *   - Si es cuota SOCIAL: usar centro de costo Administración (ADM)
 */
async function generarAsientoPagoCuota(prisma, datos) {
  const { pago, caja, cargos, registradoPor } = datos

  try {
    // Obtener código de cuenta de la caja (si tiene) o usar CAJA_EFECTIVO por defecto
    let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
    if (caja.cuentaContable?.codigo) {
      cuentaCajaCodigo = caja.cuentaContable.codigo
    } else if (caja.tipo === 'BANCO') {
      cuentaCajaCodigo = CUENTAS.BANCO_CC
    }

    // Determinar centro de costo según los cargos pagados
    // Obtener los cargos con sus categorías de actividad para determinar el centro
    const cargosConActividad = await Promise.all(
      cargos.map(async cargo => {
        const cargoCompleto = await prisma.cargo.findUnique({
          where: { id: cargo.id },
          include: {
            categoriaActividad: {
              include: {
                actividad: {
                  include: { centroCosto: true },
                },
              },
            },
          },
        })
        return cargoCompleto
      })
    )

    // Determinar centro de costo:
    // - Si hay cargos de CUOTA_ACTIVIDAD con actividad, usar ese centro
    // - Si solo hay CUOTA_SOCIAL, usar Administración
    let centroCostoId = null
    const cargosDeportivos = cargosConActividad.filter(c => c?.categoria === 'CUOTA_ACTIVIDAD' && c?.categoriaActividad)

    if (cargosDeportivos.length > 0 && cargosDeportivos.every(c => c.categoriaActividad?.actividad?.centroCostoId)) {
      // Usar el centro de la primera actividad (si todas son iguales, será el mismo)
      centroCostoId = cargosDeportivos[0].categoriaActividad.actividad.centroCostoId
    } else {
      // Usar Administración (ADM)
      const centroAdm = await prisma.centroCosto.findUnique({
        where: { codigo: 'ADM' },
      })
      centroCostoId = centroAdm?.id || null
    }

    // Calcular montos base y recargos
    const montoTotal = Number(pago.montoTotal)
    const montoRecargo = cargos.reduce((sum, cargo) => sum + Number(cargo.montoRecargo || 0), 0)
    const montoBase = montoTotal - montoRecargo

    // Líneas del asiento
    const lineas = [
      // DEBE: Caja con el total
      { cuentaCodigo: cuentaCajaCodigo, debe: montoTotal, haber: 0 },
    ]

    // HABER: Ingresos por cuotas (monto base)
    if (montoBase > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.CUOTA_SOCIAL, debe: 0, haber: montoBase })
    }

    // HABER: Ingresos por mora (recargos)
    if (montoRecargo > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.INGRESOS_MORA, debe: 0, haber: montoRecargo })
    }

    const asiento = await crearAsiento(prisma, {
      concepto: `Cobranza cuota socio #${pago.socio?.nroSocio || pago.socioId}${montoRecargo > 0 ? ' (inc. mora)' : ''}`,
      fecha: pago.fecha,
      tipoOrigen: 'PAGO_CUOTA',
      origenId: pago.id,
      registradoPor,
      centroCostoId,
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para pago cuota ${pago.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para pago cuota ${pago.id}:`, error.message)
    return null // No fallar la operación principal
  }
}

/**
 * Genera asiento para movimiento de caja (ingreso/egreso)
 *
 * INGRESO:
 *   D: Caja           $monto
 *   H: Cuenta Concepto $monto
 *
 * EGRESO:
 *   D: Cuenta Concepto $monto
 *   H: Caja           $monto
 */
async function generarAsientoMovimientoCaja(prisma, datos) {
  const { movimiento, caja, concepto, registradoPor } = datos

  try {
    // Obtener código de cuenta de la caja
    let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
    if (caja.cuentaContable?.codigo) {
      cuentaCajaCodigo = caja.cuentaContable.codigo
    } else if (caja.tipo === 'BANCO') {
      cuentaCajaCodigo = CUENTAS.BANCO_CC
    }

    // Obtener cuenta del concepto (si tiene) o usar genérica
    let cuentaConceptoCodigo = movimiento.tipo === 'INGRESO'
      ? CUENTAS.OTROS_INGRESOS
      : CUENTAS.GASTOS_VARIOS

    if (concepto?.cuentaContable?.codigo) {
      cuentaConceptoCodigo = concepto.cuentaContable.codigo
    }

    const monto = Number(movimiento.monto)
    const lineas = movimiento.tipo === 'INGRESO'
      ? [
          { cuentaCodigo: cuentaCajaCodigo, debe: monto, haber: 0 },
          { cuentaCodigo: cuentaConceptoCodigo, debe: 0, haber: monto },
        ]
      : [
          { cuentaCodigo: cuentaConceptoCodigo, debe: monto, haber: 0 },
          { cuentaCodigo: cuentaCajaCodigo, debe: 0, haber: monto },
        ]

    const asiento = await crearAsiento(prisma, {
      concepto: `${movimiento.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}: ${movimiento.concepto}`,
      fecha: movimiento.fecha,
      tipoOrigen: 'MOV_CAJA',
      origenId: movimiento.id,
      registradoPor,
      centroCostoId: movimiento.centroCostoId || null, // Usar centro de costo del movimiento
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para movimiento caja ${movimiento.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para mov caja ${movimiento.id}:`, error.message)
    return null
  }
}

/**
 * Genera asiento para factura de compra (proveedor)
 *
 * Asiento (ejemplo con IVA 21%):
 *   D: Mercadería/Gasto       $subtotal
 *   D: IVA Crédito Fiscal 21% $iva21
 *   D: IVA Crédito Fiscal 10.5% $iva105 (si aplica)
 *   H: Proveedores            $montoTotal
 */
async function generarAsientoFacturaCompra(prisma, datos) {
  const { factura, concepto, registradoPor } = datos

  try {
    const lineas = []

    // Línea del gasto/compra (cuenta del concepto o genérica)
    let cuentaGastoCodigo = CUENTAS.GASTOS_VARIOS
    if (concepto?.cuentaContable?.codigo) {
      cuentaGastoCodigo = concepto.cuentaContable.codigo
    }

    const subtotal = Number(factura.subtotal) || 0
    if (subtotal > 0) {
      lineas.push({
        cuentaCodigo: cuentaGastoCodigo,
        debe: subtotal,
        haber: 0,
        descripcion: 'Subtotal compra',
      })
    }

    // IVA Crédito Fiscal 21%
    const iva21 = Number(factura.iva21) || 0
    if (iva21 > 0) {
      lineas.push({
        cuentaCodigo: CUENTAS.IVA_CF_21,
        debe: iva21,
        haber: 0,
        descripcion: 'IVA CF 21%',
      })
    }

    // IVA Crédito Fiscal 10.5%
    const iva105 = Number(factura.iva105) || 0
    if (iva105 > 0) {
      lineas.push({
        cuentaCodigo: CUENTAS.IVA_CF_105,
        debe: iva105,
        haber: 0,
        descripcion: 'IVA CF 10.5%',
      })
    }

    // Proveedores (Haber)
    const montoTotal = Number(factura.montoTotal)
    lineas.push({
      cuentaCodigo: CUENTAS.PROVEEDORES,
      debe: 0,
      haber: montoTotal,
      descripcion: `Factura ${factura.tipoComprobante || ''} ${factura.puntoVenta || ''}-${factura.numeroComprobante || ''}`.trim(),
    })

    const nombreProveedor = factura.entidad?.razonSocial || factura.entidad?.nombreFantasia || 'Proveedor'

    const asiento = await crearAsiento(prisma, {
      concepto: `Factura compra ${nombreProveedor}`,
      fecha: factura.fecha,
      tipoOrigen: 'FACTURA_COMPRA',
      origenId: factura.id,
      registradoPor,
      centroCostoId: factura.centroCostoId || null, // Usar centro de costo de la factura
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para factura compra ${factura.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para factura compra ${factura.id}:`, error.message)
    return null
  }
}

/**
 * Genera asiento para factura de venta (cliente/socio)
 *
 * Asiento (ejemplo con IVA 21%):
 *   D: Clientes/Deudores       $montoTotal
 *   H: Ventas                  $subtotal
 *   H: IVA Débito Fiscal 21%   $iva21
 *   H: IVA Débito Fiscal 10.5% $iva105 (si aplica)
 */
async function generarAsientoFacturaVenta(prisma, datos) {
  const { factura, concepto, registradoPor } = datos

  try {
    const lineas = []

    // Clientes (Debe)
    const montoTotal = Number(factura.montoTotal)
    lineas.push({
      cuentaCodigo: CUENTAS.CLIENTES,
      debe: montoTotal,
      haber: 0,
      descripcion: `Factura ${factura.tipoComprobante || ''} ${factura.puntoVenta || ''}-${factura.numeroComprobante || ''}`.trim(),
    })

    // Ventas (Haber) - cuenta del concepto o genérica
    let cuentaVentaCodigo = CUENTAS.VENTAS_MERCADERIA
    if (concepto?.cuentaContable?.codigo) {
      cuentaVentaCodigo = concepto.cuentaContable.codigo
    }

    const subtotal = Number(factura.subtotal) || 0
    if (subtotal > 0) {
      lineas.push({
        cuentaCodigo: cuentaVentaCodigo,
        debe: 0,
        haber: subtotal,
        descripcion: 'Subtotal venta',
      })
    }

    // IVA Débito Fiscal 21%
    const iva21 = Number(factura.iva21) || 0
    if (iva21 > 0) {
      lineas.push({
        cuentaCodigo: CUENTAS.IVA_DF_21,
        debe: 0,
        haber: iva21,
        descripcion: 'IVA DF 21%',
      })
    }

    // IVA Débito Fiscal 10.5%
    const iva105 = Number(factura.iva105) || 0
    if (iva105 > 0) {
      lineas.push({
        cuentaCodigo: CUENTAS.IVA_DF_105,
        debe: 0,
        haber: iva105,
        descripcion: 'IVA DF 10.5%',
      })
    }

    const nombreCliente = factura.entidad?.razonSocial
      || factura.socio?.apellidoNombre
      || 'Cliente'

    const asiento = await crearAsiento(prisma, {
      concepto: `Factura venta ${nombreCliente}`,
      fecha: factura.fecha,
      tipoOrigen: 'FACTURA_VENTA',
      origenId: factura.id,
      registradoPor,
      centroCostoId: factura.centroCostoId || null, // Usar centro de costo de la factura
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para factura venta ${factura.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para factura venta ${factura.id}:`, error.message)
    return null
  }
}

/**
 * Genera asiento para orden de pago (pago a proveedor)
 * Soporta múltiples medios de pago (múltiples cajas)
 *
 * Asiento:
 *   D: Proveedores  $montoTotal
 *   H: Caja1        $monto1
 *   H: Caja2        $monto2
 *   ... (una línea por cada pago)
 */
async function generarAsientoOrdenPago(prisma, datos) {
  const { ordenPago, caja, cajas, pagos, registradoPor } = datos

  try {
    const monto = Number(ordenPago.montoTotal)
    const nombreProveedor = ordenPago.entidad?.razonSocial || 'Proveedor'

    // Línea de débito: Proveedores
    const lineas = [
      { cuentaCodigo: CUENTAS.PROVEEDORES, debe: monto, haber: 0, descripcion: 'Cancelación deuda' },
    ]

    // Si hay múltiples pagos, crear una línea de haber por cada uno
    if (pagos && pagos.length > 0 && cajas && cajas.length > 0) {
      for (let i = 0; i < pagos.length; i++) {
        const pago = pagos[i]
        const cajaDelPago = cajas.find(c => c.id === parseInt(pago.cajaId)) || cajas[i]

        let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
        if (cajaDelPago?.cuentaContable?.codigo) {
          cuentaCajaCodigo = cajaDelPago.cuentaContable.codigo
        } else if (cajaDelPago?.tipo === 'BANCO') {
          cuentaCajaCodigo = CUENTAS.BANCO_CC
        }

        lineas.push({
          cuentaCodigo: cuentaCajaCodigo,
          debe: 0,
          haber: parseFloat(pago.monto),
          descripcion: `${pago.medioPago} - OP ${ordenPago.numero}`
        })
      }
    } else if (caja) {
      // Fallback: un solo pago (compatibilidad con código anterior)
      let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
      if (caja.cuentaContable?.codigo) {
        cuentaCajaCodigo = caja.cuentaContable.codigo
      } else if (caja.tipo === 'BANCO') {
        cuentaCajaCodigo = CUENTAS.BANCO_CC
      }

      lineas.push({
        cuentaCodigo: cuentaCajaCodigo,
        debe: 0,
        haber: monto,
        descripcion: `OP ${ordenPago.numero}`
      })
    }

    const asiento = await crearAsiento(prisma, {
      concepto: `Pago a proveedor ${nombreProveedor}`,
      fecha: ordenPago.fecha,
      tipoOrigen: 'ORDEN_PAGO',
      origenId: ordenPago.id,
      registradoPor,
      centroCostoId: ordenPago.centroCostoId || null,
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para orden pago ${ordenPago.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para orden pago ${ordenPago.id}:`, error.message)
    return null
  }
}

/**
 * Genera asiento para recibo de cobro (cobro a cliente)
 *
 * Asiento:
 *   D: Caja/Banco   $monto
 *   H: Clientes     $monto
 */
async function generarAsientoReciboCobro(prisma, datos) {
  const { recibo, caja, registradoPor } = datos

  try {
    // Cuenta de la caja
    let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
    if (caja.cuentaContable?.codigo) {
      cuentaCajaCodigo = caja.cuentaContable.codigo
    } else if (caja.tipo === 'BANCO') {
      cuentaCajaCodigo = CUENTAS.BANCO_CC
    }

    const monto = Number(recibo.montoTotal)
    const nombreCliente = recibo.entidad?.razonSocial
      || recibo.socio?.apellidoNombre
      || 'Cliente'

    const asiento = await crearAsiento(prisma, {
      concepto: `Cobro de ${nombreCliente}`,
      fecha: recibo.fecha,
      tipoOrigen: 'RECIBO_COBRO',
      origenId: recibo.id,
      registradoPor,
      centroCostoId: recibo.centroCostoId || null, // Usar centro de costo del recibo
      lineas: [
        { cuentaCodigo: cuentaCajaCodigo, debe: monto, haber: 0, descripcion: `Recibo ${recibo.numero}` },
        { cuentaCodigo: CUENTAS.CLIENTES, debe: 0, haber: monto, descripcion: 'Cobro deuda' },
      ],
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para recibo cobro ${recibo.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para recibo cobro ${recibo.id}:`, error.message)
    return null
  }
}

/**
 * Anula un asiento contable (cuando se anula la operación origen)
 */
async function anularAsiento(prisma, tipoOrigen, origenId, anuladoPor, motivo) {
  try {
    const asiento = await prisma.asiento.findFirst({
      where: { tipoOrigen, origenId, estado: 'CONFIRMADO' },
    })

    if (!asiento) {
      console.log(`[AsientoContable] No se encontró asiento para anular (${tipoOrigen}:${origenId})`)
      return null
    }

    const asientoAnulado = await prisma.asiento.update({
      where: { id: asiento.id },
      data: {
        estado: 'ANULADO',
        fechaAnulacion: new Date(),
        motivoAnulacion: motivo || 'Anulación de operación origen',
        anuladoPor,
      },
    })

    console.log(`[AsientoContable] Anulado asiento ${asiento.numero}`)
    return asientoAnulado
  } catch (error) {
    console.error(`[AsientoContable] Error anulando asiento (${tipoOrigen}:${origenId}):`, error.message)
    return null
  }
}

export {
  generarAsientoPagoCuota,
  generarAsientoMovimientoCaja,
  generarAsientoFacturaCompra,
  generarAsientoFacturaVenta,
  generarAsientoOrdenPago,
  generarAsientoReciboCobro,
  anularAsiento,
  CUENTAS,
}
