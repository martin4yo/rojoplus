/**
 * Helpers compartidos del módulo Tienda Online.
 */
import prisma from '../../lib/prisma.js'

/**
 * Genera un número único de PedidoTienda con formato WEB-NNNNNN
 * Único por tenant. Tiene la misma race condition mínima que otros generadores —
 * siempre llamarlo dentro de una transacción cuando importa.
 */
export async function generarNumeroPedidoTienda(db, tenantId) {
  const client = db || prisma
  const ultimo = await client.pedidoTienda.findFirst({
    where: { tenantId },
    orderBy: { id: 'desc' },
    select: { numero: true },
  })
  let secuencia = 1
  if (ultimo?.numero) {
    const partes = ultimo.numero.split('-')
    secuencia = (parseInt(partes[1] || '0') || 0) + 1
  }
  return `WEB-${String(secuencia).padStart(6, '0')}`
}

/**
 * Devuelve el stock disponible (real - reservas activas no expiradas) por variante.
 * @param {*} db
 * @param {number[]} varianteIds
 * @returns {Promise<Map<number, { stockActual: number, reservado: number, disponible: number }>>}
 */
export async function obtenerDisponibilidadVariantes(db, varianteIds) {
  if (!varianteIds?.length) return new Map()

  const variantes = await db.productoVariante.findMany({
    where: { id: { in: varianteIds } },
    select: { id: true, stockActual: true },
  })

  // Sumar reservas activas no expiradas
  const reservas = await db.reservaStock.groupBy({
    by: ['productoVarianteId'],
    where: {
      productoVarianteId: { in: varianteIds },
      estado: { in: ['ACTIVA', 'CONFIRMADA'] },
      OR: [
        { estado: 'CONFIRMADA' }, // confirmada no expira
        { AND: [{ estado: 'ACTIVA' }, { expiraEn: { gt: new Date() } }] },
      ],
    },
    _sum: { cantidad: true },
  })

  const reservadoPorId = new Map(
    reservas.map(r => [r.productoVarianteId, Number(r._sum?.cantidad || 0)])
  )

  const result = new Map()
  for (const v of variantes) {
    const reservado = reservadoPorId.get(v.id) || 0
    const stockActual = Number(v.stockActual)
    result.set(v.id, {
      stockActual,
      reservado,
      disponible: Math.max(0, stockActual - reservado),
    })
  }
  return result
}

/**
 * Resuelve el precio de venta efectivo de un producto + variante para la tienda.
 * Prioridad: variante.precioVenta > producto.precioOfertaTienda > producto.precioVenta.
 * El "precio de lista" (sin oferta) es: variante.precioVenta > producto.precioVenta.
 */
export function calcularPrecio(producto, variante) {
  const precioVariante = variante?.precioVenta != null ? Number(variante.precioVenta) : null
  const precioOferta = producto?.precioOfertaTienda != null ? Number(producto.precioOfertaTienda) : null
  const precioVenta = producto?.precioVenta != null ? Number(producto.precioVenta) : null

  // Precio "de lista" (sin oferta), usado para mostrar tachado
  const precioLista = precioVariante ?? precioVenta ?? 0

  // Precio efectivo: si hay oferta y la variante no overridea, usa la oferta
  const precioEfectivo =
    precioVariante != null
      ? precioVariante
      : (precioOferta ?? precioVenta ?? 0)

  return {
    precio: precioEfectivo,
    precioLista,
    enOferta: precioOferta != null && precioVariante == null && precioOferta < (precioVenta ?? precioOferta),
  }
}

/**
 * Lee parámetros de configuración del módulo tienda.
 * Devuelve un objeto con valores parseados.
 */
export async function leerParametrosTienda(db) {
  const params = await db.configuracion.findMany({
    where: { modulo: 'TIENDA' },
    select: { clave: true, valor: true, tipo: true },
  })
  const map = {}
  for (const p of params) {
    let v = p.valor
    if (p.tipo === 'INT') v = v ? parseInt(v) : null
    else if (p.tipo === 'BOOLEAN') v = v === 'true'
    map[p.clave] = v
  }
  return {
    habilitada: !!map.TIENDA_HABILITADA,
    cajaId: map.TIENDA_CAJA_ID || null,
    medioPagoMpId: map.TIENDA_MEDIO_PAGO_MP_ID || null,
    reservaTtlMin: map.TIENDA_RESERVA_TTL_MIN || 15,
    permitirInvitados: map.TIENDA_PERMITIR_INVITADOS !== false,
    retiroDireccion: map.TIENDA_RETIRO_DIRECCION || '',
    retiroHorarios: map.TIENDA_RETIRO_HORARIOS || '',
    tituloHero: map.TIENDA_TITULO_HERO || 'Tienda',
    subtituloHero: map.TIENDA_SUBTITULO_HERO || '',
  }
}

/**
 * Includes comunes para queries de PedidoTienda.
 */
export const PEDIDO_TIENDA_INCLUDE = {
  estado: true,
  shopCustomer: { select: { id: true, email: true, nombre: true, telefono: true } },
  socio: { select: { id: true, nroSocio: true, apellidoNombre: true, email: true, celular: true } },
  entidad: { select: { id: true, codigo: true, razonSocial: true, email: true, telefono: true } },
  items: {
    include: {
      productoVariante: {
        include: {
          producto: {
            select: { id: true, nombre: true, codigo: true, fotos: { take: 1, orderBy: { orden: 'asc' } } },
          },
        },
      },
    },
  },
  reservas: { select: { id: true, estado: true, cantidad: true, productoVarianteId: true } },
  historial: {
    include: {
      estado: true,
      admin: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  pedido: { select: { id: true, numero: true } },
}
