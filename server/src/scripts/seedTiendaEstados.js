/**
 * Seed inicial de estados y transiciones de pedidos de tienda online,
 * además de los parámetros básicos del módulo Tienda en Configuracion.
 *
 * Idempotente: corre upsert sobre cada estado/transición/parámetro.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node src/scripts/seedTiendaEstados.js
 *   (opcional) --tenant <slug>  para limitar a un tenant
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ESTADOS = [
  { codigo: 'PENDIENTE',      nombre: 'Pendiente de pago', color: '#F59E0B', isInitial: true,  isFinal: false, permiteFacturar: false, autoFacturar: false, notificaCliente: false, ordenKanban: 1 },
  { codigo: 'CONFIRMADO',     nombre: 'Pagado',            color: '#10B981', isInitial: false, isFinal: false, permiteFacturar: true,  autoFacturar: false, notificaCliente: true,  ordenKanban: 2 },
  { codigo: 'EN_PREPARACION', nombre: 'En preparación',    color: '#3B82F6', isInitial: false, isFinal: false, permiteFacturar: true,  autoFacturar: false, notificaCliente: true,  ordenKanban: 3 },
  { codigo: 'LISTO_RETIRO',   nombre: 'Listo para retiro', color: '#8B5CF6', isInitial: false, isFinal: false, permiteFacturar: true,  autoFacturar: false, notificaCliente: true,  ordenKanban: 4 },
  { codigo: 'ENTREGADO',      nombre: 'Entregado',         color: '#059669', isInitial: false, isFinal: true,  permiteFacturar: true,  autoFacturar: false, notificaCliente: true,  ordenKanban: 5 },
  { codigo: 'CANCELADO',      nombre: 'Cancelado',         color: '#EF4444', isInitial: false, isFinal: true,  permiteFacturar: false, autoFacturar: false, notificaCliente: true,  ordenKanban: 6 },
]

const TRANSICIONES = [
  ['PENDIENTE',      'CONFIRMADO'],
  ['PENDIENTE',      'CANCELADO'],
  ['CONFIRMADO',     'EN_PREPARACION'],
  ['CONFIRMADO',     'CANCELADO'],
  ['EN_PREPARACION', 'LISTO_RETIRO'],
  ['EN_PREPARACION', 'CANCELADO'],
  ['LISTO_RETIRO',   'ENTREGADO'],
  ['LISTO_RETIRO',   'CANCELADO'],
]

const PARAMETROS_DEFAULT = [
  { clave: 'TIENDA_HABILITADA',          valor: 'false', tipo: 'BOOLEAN', descripcion: 'Activa el módulo Tienda Online' },
  { clave: 'TIENDA_CAJA_ID',             valor: '',      tipo: 'INT',     descripcion: 'Caja contable donde imputan los pagos de la tienda' },
  { clave: 'TIENDA_MEDIO_PAGO_MP_ID',    valor: '',      tipo: 'INT',     descripcion: 'Medio de pago Mercado Pago para pagos online de tienda' },
  { clave: 'TIENDA_RESERVA_TTL_MIN',     valor: '15',    tipo: 'INT',     descripcion: 'Minutos que se mantiene reservado el stock durante el checkout' },
  { clave: 'TIENDA_PERMITIR_INVITADOS',  valor: 'true',  tipo: 'BOOLEAN', descripcion: 'Permite comprar sin crear cuenta' },
  { clave: 'TIENDA_RETIRO_DIRECCION',    valor: '',      tipo: 'STRING',  descripcion: 'Dirección donde el comprador retira el pedido' },
  { clave: 'TIENDA_RETIRO_HORARIOS',     valor: '',      tipo: 'STRING',  descripcion: 'Horarios de retiro (texto libre)' },
  { clave: 'TIENDA_TITULO_HERO',         valor: 'Tienda', tipo: 'STRING', descripcion: 'Título principal del hero de la tienda' },
  { clave: 'TIENDA_SUBTITULO_HERO',      valor: '',      tipo: 'STRING',  descripcion: 'Subtítulo del hero de la tienda' },
]

function getTenantSlugArg() {
  const idx = process.argv.indexOf('--tenant')
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return null
}

async function seedTenant(tenant) {
  console.log(`\nTenant: ${tenant.nombre} (id=${tenant.id}, slug=${tenant.slug})`)

  // Estados
  for (const e of ESTADOS) {
    await prisma.estadoPedidoTienda.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: e.codigo } },
      update: { ...e },
      create: { ...e, tenantId: tenant.id },
    })
    console.log(`  estado: ${e.codigo}`)
  }

  // Transiciones
  const estados = await prisma.estadoPedidoTienda.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, codigo: true },
  })
  const idByCodigo = Object.fromEntries(estados.map(s => [s.codigo, s.id]))

  for (const [from, to] of TRANSICIONES) {
    const desdeId = idByCodigo[from]
    const hastaId = idByCodigo[to]
    if (!desdeId || !hastaId) continue
    await prisma.transicionEstadoTienda.upsert({
      where: { tenantId_desdeId_hastaId: { tenantId: tenant.id, desdeId, hastaId } },
      update: {},
      create: { desdeId, hastaId, tenantId: tenant.id },
    })
    console.log(`  transición: ${from} -> ${to}`)
  }

  // Parámetros default (solo crea si no existen — no pisa valores configurados)
  for (const p of PARAMETROS_DEFAULT) {
    const existing = await prisma.configuracion.findUnique({
      where: { tenantId_clave: { tenantId: tenant.id, clave: p.clave } },
    })
    if (!existing) {
      await prisma.configuracion.create({
        data: { ...p, tenantId: tenant.id, modulo: 'TIENDA' },
      })
      console.log(`  parametro: ${p.clave} = ${p.valor || '(vacio)'}`)
    }
  }
}

async function main() {
  const slug = getTenantSlugArg()
  const where = slug ? { slug } : {}
  const tenants = await prisma.tenant.findMany({ where, select: { id: true, nombre: true, slug: true } })

  if (tenants.length === 0) {
    console.log(`No se encontraron tenants${slug ? ` con slug=${slug}` : ''}.`)
    return
  }

  console.log(`Procesando ${tenants.length} tenant(s)...`)

  for (const t of tenants) {
    await seedTenant(t)
  }

  console.log('\nDone.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
