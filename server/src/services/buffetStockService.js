/**
 * Descuenta stock por venta de buffet/kiosco/takeaway.
 * Solo actúa si el Producto asociado tiene al menos una variante activa.
 * Si no tiene variantes, el producto no gestiona stock y se ignora.
 *
 * @param {object} db      - instancia de Prisma con tenant (req.db)
 * @param {Array}  items   - items de la venta con productoBuffet incluido
 * @param {number} adminId - id del admin que realizó la venta
 * @param {string} concepto - descripción del movimiento (ej: "Venta Buffet - Comanda C001")
 */
export async function descontarStockVentaBuffet(db, items, adminId, concepto) {
  for (const item of items) {
    const pb = item.productoBuffet
    if (!pb?.productoId) continue

    // Si el producto no tiene variante activa, no gestiona stock → saltar
    const variante = await db.productoVariante.findFirst({
      where: { productoId: pb.productoId, activo: true }
    })
    if (!variante) continue

    const cantidad = item.cantidad
    const stockAnterior = parseFloat(variante.stockActual)
    const stockPosterior = stockAnterior - cantidad

    await db.productoVariante.update({
      where: { id: variante.id },
      data: { stockActual: stockPosterior }
    })

    await db.movimientoStock.create({
      data: {
        productoVarianteId: variante.id,
        tipo: 'EGRESO',
        cantidad,
        stockAnterior,
        stockPosterior,
        concepto,
        registradoPor: adminId
      }
    })
  }
}
