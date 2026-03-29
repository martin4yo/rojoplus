/**
 * Funciones auxiliares compartidas para el módulo de buffet
 */
import prisma from '../../lib/prisma.js'

// ============================================================================
// GENERADORES DE NÚMEROS
// ============================================================================

/**
 * Genera número único para comanda
 * Formato: CYYYYMMDD-NNNN
 */
export async function generarNumeroComanda(db) {
  const client = db || prisma
  const hoy = new Date()
  const prefijo = `C${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`

  const ultima = await client.comanda.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })

  let secuencia = 1
  if (ultima) {
    const partes = ultima.numero.split('-')
    secuencia = parseInt(partes[1] || '0') + 1
  }

  return `${prefijo}-${String(secuencia).padStart(4, '0')}`
}

/**
 * Genera número único para pedido take away
 * Formato: TAYYYYMMDD-NNNN
 */
export async function generarNumeroPedido(db) {
  const client = db || prisma
  const hoy = new Date()
  const prefijo = `TA${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`

  const ultimo = await client.pedidoTakeAway.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })

  let secuencia = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    secuencia = parseInt(partes[1] || '0') + 1
  }

  return `${prefijo}-${String(secuencia).padStart(4, '0')}`
}

/**
 * Genera número de movimiento contable
 * Formato: MC-YYYY-NNNNN
 */
export async function generarNumeroMC(db) {
  const client = db || prisma
  const anio = new Date().getFullYear()
  const prefijo = `MC-${anio}-`

  const ultimo = await client.movimientoContable.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' }
  })

  let siguiente = 1
  if (ultimo) {
    const partes = ultimo.numero.split('-')
    const ultimoNum = parseInt(partes[partes.length - 1]) || 0
    siguiente = ultimoNum + 1
  }

  return `${prefijo}${String(siguiente).padStart(5, '0')}`
}

// ============================================================================
// CÁLCULOS DE TOTALES
// ============================================================================

/**
 * Recalcula subtotal y total de una comanda
 */
export async function recalcularTotalesComanda(comandaId, db) {
  const client = db || prisma
  const items = await client.itemComanda.findMany({
    where: { comandaId, estado: { not: 'ANULADO' } }
  })

  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0)

  await client.comanda.update({
    where: { id: comandaId },
    data: { subtotal, total: subtotal }
  })

  return subtotal
}

/**
 * Recalcula subtotal y total de un pedido take away
 */
export async function recalcularTotalesPedido(pedidoId, db) {
  const client = db || prisma
  const items = await client.itemPedidoTakeAway.findMany({
    where: { pedidoId }
  })

  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0)

  await client.pedidoTakeAway.update({
    where: { id: pedidoId },
    data: { subtotal, total: subtotal }
  })

  return subtotal
}

// ============================================================================
// INCLUDES COMUNES PARA QUERIES
// ============================================================================

export const COMANDA_INCLUDE = {
  mesa: true,
  socio: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      nroSocio: true
    }
  },
  items: {
    where: { estado: { not: 'ANULADO' } },
    include: {
      productoBuffet: {
        select: { id: true, nombre: true, codigo: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  },
  atendedor: {
    select: { id: true, nombre: true, apellido: true }
  },
  cerrador: {
    select: { id: true, nombre: true, apellido: true }
  }
}

export const PEDIDO_TAKEAWAY_INCLUDE = {
  items: {
    include: {
      productoBuffet: {
        select: { id: true, nombre: true, codigo: true }
      }
    }
  },
  socio: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      nroSocio: true
    }
  }
}

export const MESA_INCLUDE = {
  zona: true,
  mozoAsignado: {
    select: { id: true, nombre: true, apellido: true }
  },
  comandas: {
    where: {
      estado: { in: ['ABIERTA', 'EN_PREPARACION', 'CUENTA_PEDIDA'] }
    },
    include: {
      items: {
        where: { estado: { not: 'ANULADO' } }
      },
      socio: {
        select: { nombre: true, apellido: true }
      }
    }
  }
}

// ============================================================================
// FILTROS DE CAJAS
// ============================================================================

/**
 * Obtiene las cajas permitidas para el admin actual
 * - Super admin: retorna null (sin filtro, acceso a todas)
 * - Con cajas asignadas: retorna array de IDs
 * - Sin cajas asignadas: retorna [] (sin acceso)
 */
export async function getCajasPermitidas(adminId) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      rol: {
        include: {
          cajas: { select: { cajaId: true } }
        }
      }
    }
  })

  // Super admin tiene acceso a todas las cajas
  if (admin?.rol?.esSuperAdmin) return null

  // Si no tiene rol o no tiene cajas asignadas, no tiene acceso a ninguna
  if (!admin?.rol?.cajas?.length) return []

  return admin.rol.cajas.map(c => c.cajaId)
}

/**
 * Aplica filtro de cajas a un where
 * - null: sin filtro (super admin)
 * - []: filtro que no matchea nada (sin acceso)
 * - [ids]: filtro a esas cajas
 */
export function applyCajasFilter(where, cajasIds, field = 'id') {
  if (cajasIds === null) return where
  return { ...where, [field]: { in: cajasIds } }
}

export default {
  generarNumeroComanda,
  generarNumeroPedido,
  generarNumeroMC,
  recalcularTotalesComanda,
  recalcularTotalesPedido,
  getCajasPermitidas,
  applyCajasFilter,
  COMANDA_INCLUDE,
  PEDIDO_TAKEAWAY_INCLUDE,
  MESA_INCLUDE
}
