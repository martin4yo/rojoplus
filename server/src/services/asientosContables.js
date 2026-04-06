/**
 * Servicio para generación automática de asientos contables
 *
 * Este servicio genera asientos de partida doble automáticamente cuando se realizan
 * operaciones financieras como pagos, cobranzas, facturas, etc.
 *
 * IMPORTANTE: Los errores en la generación de asientos NO deben fallar la operación principal.
 * Se loguean los errores pero se permite continuar.
 */

// Códigos de cuentas contables estándar — se buscan por getCuentaId que usa findFirst,
// por lo que si el tenant usa códigos diferentes el admin debe configurar cuentaContableId
// en cada ConceptoTesoreria. Estos son los códigos de fallback estándar para clubes argentinos.
const CUENTAS = {
  // Activo
  CAJA_EFECTIVO: '1.1.1',
  BANCO_CC: '1.1.2',
  CLIENTES: '1.1.3',       // Deudores por cuotas / clientes
  DEUDORES_CUOTAS: '1.1.3',
  IVA_CF_21: '1.1.4.01',
  IVA_CF_105: '1.1.4.02',
  IVA_CF_27: '1.1.4.03',
  MERCADERIAS: '1.1.5.01',

  // Pasivo
  PROVEEDORES: '2.1.1',
  IVA_DF_21: '2.1.2.01',
  IVA_DF_105: '2.1.2.02',
  IVA_DF_27: '2.1.2.03',

  // Ingresos
  CUOTA_SOCIAL: '4.1',       // Cuotas sociales
  CUOTA_DEPORTIVA: '4.2',    // Actividades deportivas
  VENTAS_MERCADERIA: '4.3',  // Buffet / ventas
  INGRESOS_MORA: '4.4',      // Mora y recargos
  OTROS_INGRESOS: '4.9',

  // Egresos
  GASTOS_PERSONAL: '5.1',    // Sueldos y jornales
  GASTOS_VARIOS: '5.9',
}

/**
 * Resuelve la cuentaContableId del lado "cash" de un asiento de cobro/pago.
 * Prioridad:
 *   1. conceptoTesoreria del medioPago (si tiene cuentaContableId)
 *   2. cuentaContableId de la caja
 *   3. null (los callers deben manejar el fallback por tipo de caja)
 *
 * Requiere que medioPago se haya fetched con `include: { conceptoTesoreria: true }`.
 */
export function resolverCuentaCashId(medioPago, caja) {
  return caja?.cuentaContableId
    || medioPago?.conceptoTesoreria?.cuentaContableId
    || null
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
  if (!codigo) return null
  const cuenta = await prisma.cuentaContable.findFirst({
    where: { codigo },
  })
  if (!cuenta) {
    console.warn(`[AsientoContable] Cuenta contable "${codigo}" no encontrada en el plan de cuentas`)
  }
  return cuenta?.id ?? null
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

  // Obtener IDs de cuentas — acepta cuentaContableId directo o cuentaCodigo string
  const lineasResueltas = await Promise.all(
    lineasConMonto.map(async (linea, index) => {
      const cuentaContableId = linea.cuentaContableId != null
        ? linea.cuentaContableId
        : await getCuentaId(prisma, linea.cuentaCodigo)
      if (!cuentaContableId) {
        console.warn(`[AsientoContable] Línea ${index + 1} sin cuenta contable (código: ${linea.cuentaCodigo}) — se omite`)
        return null
      }
      return {
        cuentaContableId,
        descripcion: linea.descripcion || null,
        debe: linea.debe || 0,
        haber: linea.haber || 0,
        centroCostoId: linea.centroCostoId || centroCostoId || null,
        orden: index + 1,
      }
    })
  )
  const lineasConIds = lineasResueltas.filter(Boolean)

  // Re-validar balance después de filtrar líneas sin cuenta
  if (lineasConIds.length < 2) {
    throw new Error(`El asiento no tiene suficientes líneas con cuenta contable configurada (${lineasConIds.length}/2 mínimo). Configurá las cuentas contables en los conceptos de tesorería.`)
  }
  const totalDebeF = lineasConIds.reduce((s, l) => s + l.debe, 0)
  const totalHaberF = lineasConIds.reduce((s, l) => s + l.haber, 0)
  if (Math.abs(totalDebeF - totalHaberF) > 0.01) {
    throw new Error(`Asiento desbalanceado tras omitir líneas sin cuenta: Debe=${totalDebeF}, Haber=${totalHaberF}`)
  }

  // Crear asiento sin lineas (nested create no recibe tenantId del extension)
  const asiento = await prisma.asiento.create({
    data: {
      numero: await generarNumeroAsiento(prisma),
      fecha: fecha || new Date(),
      concepto,
      estado: 'CONFIRMADO',
      tipoOrigen,
      origenId,
      registradoPor,
    },
  })

  // Crear lineas por separado para que el extension inyecte tenantId
  await prisma.asientoLinea.createMany({
    data: lineasConIds.map(l => ({ ...l, asientoId: asiento.id })),
  })

  return { ...asiento, lineas: lineasConIds }
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
  const { pago, caja, cargos, registradoPor, medioPago } = datos

  try {
    // Cuenta del lado cash: medioPago.conceptoTesoreria > caja > fallback por tipo
    const cuentaCajaId = resolverCuentaCashId(medioPago, caja)
    const cuentaCajaCodigo = cuentaCajaId ? null
      : (caja.cuentaContable?.codigo || (caja.tipo === 'BANCO' ? CUENTAS.BANCO_CC : CUENTAS.CAJA_EFECTIVO))

    // Cargar cargos completos con sus categorías, conceptos y centros de costo
    const cargosCompletos = await Promise.all(
      cargos.map(cargo => prisma.cargo.findFirst({
        where: { id: cargo.id },
        include: {
          categoriaActividad: {
            include: {
              conceptoTesoreria: true,
              actividad: { include: { centroCosto: true } },
            },
          },
        },
      }))
    )

    // Concepto por defecto para fallback de CC
    const configConcepto = await prisma.configuracion.findFirst({ where: { clave: 'CONCEPTO_COBRANZA_CUOTAS' } })
    const conceptoPorDefecto = configConcepto?.valor
      ? await prisma.conceptoTesoreria.findFirst({ where: { id: parseInt(configConcepto.valor) } })
      : null

    const montoTotal = Number(pago.montoTotal)

    // DEBE: ingreso de fondos en caja — CC de la caja
    const lineaCaja = cuentaCajaId
      ? { cuentaContableId: cuentaCajaId, debe: montoTotal, haber: 0, centroCostoId: caja.centroCostoId || null }
      : { cuentaCodigo: cuentaCajaCodigo, debe: montoTotal, haber: 0, centroCostoId: caja.centroCostoId || null }
    const lineas = [lineaCaja]

    // HABER: ingresos por cuotas — agrupados por CC efectivo del cargo
    // Prioridad CC: cargo.centroCostoId → actividad.centroCostoId → conceptoTesoreria.centroCostoId → conceptoPorDefecto.centroCostoId → caja.centroCostoId
    const gruposIngresos = {}
    let totalRecargo = 0

    for (const cargo of cargosCompletos) {
      if (!cargo) continue
      const montoBase = Number(cargo.montoTotal) - Number(cargo.montoRecargo || 0)
      const montoRecargo = Number(cargo.montoRecargo || 0)
      totalRecargo += montoRecargo

      const esDeportivo = cargo.categoria === 'CUOTA_ACTIVIDAD' && cargo.categoriaActividad?.actividad
      const ccEfectivo =
        cargo.centroCostoId ??
        cargo.categoriaActividad?.actividad?.centroCostoId ??
        cargo.categoriaActividad?.conceptoTesoreria?.centroCostoId ??
        conceptoPorDefecto?.centroCostoId ??
        caja.centroCostoId ??
        null

      // Cuenta de ingresos: prioridad cuentaContableId del concepto, luego código CUENTAS
      const conceptoCargo = cargo.categoriaActividad?.conceptoTesoreria
      const cuentaIngresoId = conceptoCargo?.cuentaContableId || conceptoPorDefecto?.cuentaContableId || null
      const cuentaIngresoCodigo = esDeportivo ? CUENTAS.CUOTA_DEPORTIVA : CUENTAS.CUOTA_SOCIAL
      const grupoKey = `${ccEfectivo}_${cuentaIngresoId || cuentaIngresoCodigo}`

      if (!gruposIngresos[grupoKey]) {
        gruposIngresos[grupoKey] = {
          cuentaContableId: cuentaIngresoId || null,
          cuentaCodigo: cuentaIngresoId ? null : cuentaIngresoCodigo,
          centroCostoId: ccEfectivo,
          haber: 0,
        }
      }
      if (montoBase > 0) gruposIngresos[grupoKey].haber += montoBase

      // Mora al mismo CC
      if (montoRecargo > 0) {
        const moraKey = `${ccEfectivo}_MORA`
        if (!gruposIngresos[moraKey]) {
          gruposIngresos[moraKey] = { cuentaCodigo: CUENTAS.INGRESOS_MORA, centroCostoId: ccEfectivo, haber: 0 }
        }
        gruposIngresos[moraKey].haber += montoRecargo
      }
    }

    for (const grupo of Object.values(gruposIngresos)) {
      if (grupo.haber > 0) {
        lineas.push({
          ...(grupo.cuentaContableId ? { cuentaContableId: grupo.cuentaContableId } : { cuentaCodigo: grupo.cuentaCodigo }),
          debe: 0,
          haber: grupo.haber,
          centroCostoId: grupo.centroCostoId,
        })
      }
    }

    const asiento = await crearAsiento(prisma, {
      concepto: `Cobranza cuota socio #${pago.socio?.nroSocio || pago.socioId}${totalRecargo > 0 ? ' (inc. mora)' : ''}`,
      fecha: pago.fecha,
      tipoOrigen: 'PAGO_CUOTA',
      origenId: pago.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea, no a nivel de asiento
      lineas,
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para pago cuota ${pago.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para pago cuota ${pago?.id}:`, error.message)
    console.error(error)
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
  const { movimiento, caja, registradoPor, medioPago } = datos

  // Cuenta del lado cash: medioPago.conceptoTesoreria > caja > fallback por tipo
  const cuentaCajaId = resolverCuentaCashId(medioPago, caja)
  const lineaCashBase = cuentaCajaId
    ? { cuentaContableId: cuentaCajaId }
    : { cuentaCodigo: caja.cuentaContable?.codigo || (caja.tipo === 'BANCO' ? CUENTAS.BANCO_CC : CUENTAS.CAJA_EFECTIVO) }

  // Cuenta del concepto (contracuenta: gasto/ingreso) — viene del include del movimiento
  const cuentaConceptoCodigo = movimiento.cuentaContable?.codigo
  if (!cuentaConceptoCodigo) {
    throw new Error('La cuenta contable del movimiento es requerida para generar el asiento')
  }

  const monto = Number(movimiento.monto)
  const obs = movimiento.descripcion || null
  const ccMov = movimiento.centroCostoId || null
  const ccCaja = caja.centroCostoId || ccMov  // Caja line gets caja's CC, fallback to movimiento CC
  const lineas = movimiento.tipo === 'INGRESO'
    ? [
        { ...lineaCashBase, debe: monto, haber: 0,     descripcion: obs, centroCostoId: ccCaja },
        { cuentaCodigo: cuentaConceptoCodigo, debe: 0, haber: monto, descripcion: obs, centroCostoId: ccMov },
      ]
    : [
        { cuentaCodigo: cuentaConceptoCodigo, debe: monto, haber: 0, descripcion: obs, centroCostoId: ccMov },
        { ...lineaCashBase, debe: 0, haber: monto, descripcion: obs, centroCostoId: ccCaja },
      ]

  const asiento = await crearAsiento(prisma, {
    concepto: `${movimiento.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}: ${movimiento.concepto}`,
    fecha: movimiento.fecha,
    tipoOrigen: 'MOV_CAJA',
    origenId: movimiento.id,
    registradoPor,
    centroCostoId: null, // CC definido por línea
    lineas,
  })

  console.log(`[AsientoContable] Creado asiento ${asiento.numero} para movimiento caja ${movimiento.numero}`)
  return asiento
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

    const cc = factura.centroCostoId || null
    const subtotal = Number(factura.subtotal) || 0
    if (subtotal > 0) {
      lineas.push({ cuentaCodigo: cuentaGastoCodigo, debe: subtotal, haber: 0, descripcion: 'Subtotal compra', centroCostoId: cc })
    }

    const iva21 = Number(factura.iva21) || 0
    if (iva21 > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.IVA_CF_21, debe: iva21, haber: 0, descripcion: 'IVA CF 21%', centroCostoId: cc })
    }

    const iva105 = Number(factura.iva105) || 0
    if (iva105 > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.IVA_CF_105, debe: iva105, haber: 0, descripcion: 'IVA CF 10.5%', centroCostoId: cc })
    }

    const montoTotal = Number(factura.montoTotal)
    lineas.push({
      cuentaCodigo: CUENTAS.PROVEEDORES,
      debe: 0,
      haber: montoTotal,
      descripcion: `Factura ${factura.tipoComprobante || ''} ${factura.puntoVenta || ''}-${factura.numeroComprobante || ''}`.trim(),
      centroCostoId: cc,
    })

    const nombreProveedor = factura.entidad?.razonSocial || factura.entidad?.nombreFantasia || 'Proveedor'

    const asiento = await crearAsiento(prisma, {
      concepto: `Factura compra ${nombreProveedor}`,
      fecha: factura.fecha,
      tipoOrigen: 'FACTURA_COMPRA',
      origenId: factura.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea
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

    const cc = factura.centroCostoId || null
    const montoTotal = Number(factura.montoTotal)
    lineas.push({
      cuentaCodigo: CUENTAS.CLIENTES,
      debe: montoTotal,
      haber: 0,
      descripcion: `Factura ${factura.tipoComprobante || ''} ${factura.puntoVenta || ''}-${factura.numeroComprobante || ''}`.trim(),
      centroCostoId: cc,
    })

    const subtotal = Number(factura.subtotal) || 0
    if (subtotal > 0) {
      const ventaLine = concepto?.cuentaContableId
        ? { cuentaContableId: concepto.cuentaContableId }
        : { cuentaCodigo: concepto?.cuentaContable?.codigo || CUENTAS.VENTAS_MERCADERIA }
      lineas.push({ ...ventaLine, debe: 0, haber: subtotal, descripcion: 'Subtotal venta', centroCostoId: cc })
    }

    const iva21 = Number(factura.iva21) || 0
    if (iva21 > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.IVA_DF_21, debe: 0, haber: iva21, descripcion: 'IVA DF 21%', centroCostoId: cc })
    }

    const iva105 = Number(factura.iva105) || 0
    if (iva105 > 0) {
      lineas.push({ cuentaCodigo: CUENTAS.IVA_DF_105, debe: 0, haber: iva105, descripcion: 'IVA DF 10.5%', centroCostoId: cc })
    }

    const nombreCliente = factura.entidad?.razonSocial || factura.socio?.apellidoNombre || 'Cliente'

    const asiento = await crearAsiento(prisma, {
      concepto: `Factura venta ${nombreCliente}`,
      fecha: factura.fecha,
      tipoOrigen: 'FACTURA_VENTA',
      origenId: factura.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea
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

    const ccOrden = ordenPago.centroCostoId || null
    const lineas = [
      { cuentaCodigo: CUENTAS.PROVEEDORES, debe: monto, haber: 0, descripcion: 'Cancelación deuda', centroCostoId: ccOrden },
    ]

    if (pagos && pagos.length > 0 && cajas && cajas.length > 0) {
      for (let i = 0; i < pagos.length; i++) {
        const pago = pagos[i]
        const cajaDelPago = cajas.find(c => c.id === parseInt(pago.cajaId)) || cajas[i]
        const cuentaCajaCodigo = cajaDelPago?.cuentaContable?.codigo
          || (cajaDelPago?.tipo === 'BANCO' ? CUENTAS.BANCO_CC : CUENTAS.CAJA_EFECTIVO)
        lineas.push({
          cuentaCodigo: cuentaCajaCodigo,
          debe: 0,
          haber: parseFloat(pago.monto),
          descripcion: `${pago.medioPago} - OP ${ordenPago.numero}`,
          centroCostoId: cajaDelPago?.centroCostoId || ccOrden,
        })
      }
    } else if (caja) {
      const cuentaCajaCodigo = caja.cuentaContable?.codigo
        || (caja.tipo === 'BANCO' ? CUENTAS.BANCO_CC : CUENTAS.CAJA_EFECTIVO)
      lineas.push({
        cuentaCodigo: cuentaCajaCodigo,
        debe: 0,
        haber: monto,
        descripcion: `OP ${ordenPago.numero}`,
        centroCostoId: caja.centroCostoId || ccOrden,
      })
    }

    const asiento = await crearAsiento(prisma, {
      concepto: `Pago a proveedor ${nombreProveedor}`,
      fecha: ordenPago.fecha,
      tipoOrigen: 'ORDEN_PAGO',
      origenId: ordenPago.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea
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
  const { recibo, caja, registradoPor, medioPago } = datos

  try {
    // Cuenta del lado cash: medioPago.conceptoTesoreria > caja > fallback
    const cuentaCajaId = resolverCuentaCashId(medioPago, caja)
    const lineaCash = cuentaCajaId
      ? { cuentaContableId: cuentaCajaId, debe: Number(recibo.montoTotal), haber: 0, descripcion: `Recibo ${recibo.numero}` }
      : { cuentaCodigo: caja?.cuentaContable?.codigo || (caja?.tipo === 'BANCO' ? CUENTAS.BANCO_CC : CUENTAS.CAJA_EFECTIVO), debe: Number(recibo.montoTotal), haber: 0, descripcion: `Recibo ${recibo.numero}` }

    const monto = Number(recibo.montoTotal)
    const ccRecibo = recibo.centroCostoId || null
    const ccCaja = caja?.centroCostoId || ccRecibo
    const nombreCliente = recibo.entidad?.razonSocial || recibo.socio?.apellidoNombre || 'Cliente'

    // DEBE (caja): CC de la caja donde se recibe el dinero
    const lineaCashConCC = { ...lineaCash, centroCostoId: ccCaja }

    const asiento = await crearAsiento(prisma, {
      concepto: `Cobro de ${nombreCliente}`,
      fecha: recibo.fecha,
      tipoOrigen: 'RECIBO_COBRO',
      origenId: recibo.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea
      lineas: [
        lineaCashConCC,
        { cuentaCodigo: CUENTAS.CLIENTES, debe: 0, haber: monto, descripcion: 'Cobro deuda', centroCostoId: ccRecibo },
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
 * Genera asiento para pago de sueldo
 *
 * Asiento:
 *   D: Gastos de Personal  $monto
 *   H: Caja/Banco          $monto
 */
async function generarAsientoPagoSueldo(prisma, datos) {
  const { ordenPago, itemLiquidacion, entidad, caja, liquidacion, registradoPor } = datos

  try {
    // Cuenta de la caja
    let cuentaCajaCodigo = CUENTAS.CAJA_EFECTIVO
    if (caja.cuentaContable?.codigo) {
      cuentaCajaCodigo = caja.cuentaContable.codigo
    } else if (caja.tipo === 'BANCO') {
      cuentaCajaCodigo = CUENTAS.BANCO_CC
    }

    const monto = Number(itemLiquidacion.netoAPagar)
    const nombreEmpleado = entidad?.razonSocial || 'Personal'

    const ccCaja = caja.centroCostoId || null
    const asiento = await crearAsiento(prisma, {
      concepto: `Pago sueldo ${liquidacion.periodo} - ${nombreEmpleado}`,
      fecha: ordenPago.fecha,
      tipoOrigen: 'PAGO_SUELDO',
      origenId: ordenPago.id,
      registradoPor,
      centroCostoId: null, // CC definido por línea
      lineas: [
        { cuentaCodigo: CUENTAS.GASTOS_PERSONAL, debe: monto, haber: 0, descripcion: `Liquidación ${liquidacion.numero}`, centroCostoId: ccCaja },
        { cuentaCodigo: cuentaCajaCodigo, debe: 0, haber: monto, descripcion: `OP ${ordenPago.numero}`, centroCostoId: ccCaja },
      ],
    })

    console.log(`[AsientoContable] Creado asiento ${asiento.numero} para pago sueldo ${ordenPago.numero}`)
    return asiento
  } catch (error) {
    console.error(`[AsientoContable] Error generando asiento para pago sueldo ${ordenPago.id}:`, error.message)
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

/**
 * Genera asiento para transferencia entre cajas
 *
 * Asiento:
 *   D: Cuenta caja destino   $monto  (activo aumenta en destino)
 *   H: Cuenta caja origen    $monto  (activo disminuye en origen)
 */
async function crearAsientoTransferencia(prisma, datos) {
  const { transferencia, cuentaOrigen, cuentaDestino, centroCostoId, descripcion, registradoPor } = datos

  if (!cuentaOrigen?.codigo) {
    throw new Error('La cuenta contable de la caja origen es requerida para el asiento')
  }
  if (!cuentaDestino?.codigo) {
    throw new Error('La cuenta contable de la caja destino es requerida para el asiento')
  }

  const monto = Number(transferencia.monto)

  const asiento = await crearAsiento(prisma, {
    concepto: `Transferencia ${transferencia.cajaOrigen?.nombre || ''} → ${transferencia.cajaDestino?.nombre || ''}`,
    fecha: transferencia.fecha,
    tipoOrigen: 'TRANSFERENCIA',
    origenId: transferencia.id,
    registradoPor,
    centroCostoId: null, // CC definido por línea
    lineas: [
      { cuentaCodigo: cuentaDestino.codigo, debe: monto, haber: 0,    descripcion: descripcion || null, centroCostoId: centroCostoId || null },
      { cuentaCodigo: cuentaOrigen.codigo,  debe: 0,    haber: monto, descripcion: descripcion || null, centroCostoId: centroCostoId || null },
    ],
  })

  console.log(`[AsientoContable] Creado asiento ${asiento.numero} para transferencia ${transferencia.numero}`)
  return asiento
}

export {
  generarAsientoPagoCuota,
  generarAsientoMovimientoCaja,
  crearAsientoTransferencia,
  generarAsientoFacturaCompra,
  generarAsientoFacturaVenta,
  generarAsientoOrdenPago,
  generarAsientoReciboCobro,
  generarAsientoPagoSueldo,
  anularAsiento,
  CUENTAS,
}
