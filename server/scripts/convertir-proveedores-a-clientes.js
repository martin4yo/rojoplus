/**
 * Convierte 4 proveedores a clientes en sportivopilar:
 *   - PROV-2026-00010 LUCIANA RITZINGER          → CLI-2026-00001
 *   - PROV-2026-00012 MONDACA MARTIN             → CLI-2026-00002
 *   - PROV-2026-00013 INSTITUTO CHOPIN           → CLI-2026-00003
 *   - PROV-2026-00014 GONZALEZ SILVIA            → CLI-2026-00004
 *
 * Adicionalmente:
 *   - Borra 5 entidades CLIENTE existentes (PILETA, IPEF, TAEKWONDO, CHOPIN, GYM, sin movs).
 *   - Borra el duplicado PROV-2026-00015 LUCIANA RITZINGER (sin movs).
 *
 * Los MovimientoCaja referencian por entidadId, así que cambiar tipo+codigo
 * NO rompe la FK. Se reporta el detalle de los movimientos asociados.
 *
 * Uso:
 *   node scripts/convertir-proveedores-a-clientes.js --tenant sportivopilar
 *   node scripts/convertir-proveedores-a-clientes.js --tenant sportivopilar --apply
 */
import { PrismaClient } from '@prisma/client'
import { resolveTenant, flag } from './_lib/cli.js'

const prisma = new PrismaClient()
const APPLY = flag('apply')

const ANIO = new Date().getFullYear()

// Mapeo: id de proveedor → secuencia CLI deseada
const CONVERSIONES = [
  { id: 2022812, codigoActual: 'PROV-2026-00010', razonSocial: 'LUCIANA RITZINGER', nuevaSeq: 1 },
  { id: 6069423, codigoActual: 'PROV-2026-00012', razonSocial: 'MONDACA MARTIN', nuevaSeq: 2 },
  { id: 6069424, codigoActual: 'PROV-2026-00013', razonSocial: 'INSTITUTO CHOPIN ANDREA DEL GESSO', nuevaSeq: 3 },
  { id: 6069425, codigoActual: 'PROV-2026-00014', razonSocial: 'GONZALEZ SILVIA', nuevaSeq: 4 },
]

// IDs de clientes existentes a borrar
const CLIENTES_A_BORRAR = [6069418, 6069419, 6069420, 6069421, 6069422]

// ID del proveedor duplicado a borrar
const DUPLICADO_A_BORRAR = 6069426

function nuevoCodigo(seq) {
  return `CLI-${ANIO}-${String(seq).padStart(5, '0')}`
}

async function verificarEntidad(id, expected) {
  const e = await prisma.entidad.findUnique({
    where: { id },
    select: {
      id: true, codigo: true, tipo: true, razonSocial: true, tenantId: true,
      _count: { select: {
        movimientosCaja: true, movimientosContables: true, ordenesCompra: true,
        itemsLiquidacion: true, conceptosFijos: true, novedadesLiquidacion: true,
        ordenesTrabajo: true, pedidos: true, pedidosTienda: true, shopCustomers: true,
        echeqs: true, echeqsEndosados: true,
      }}
    }
  })
  if (!e) throw new Error(`Entidad id=${id} no existe`)
  if (expected.tenantId && e.tenantId !== expected.tenantId) {
    throw new Error(`Entidad id=${id} pertenece a tenant ${e.tenantId}, esperado ${expected.tenantId}`)
  }
  if (expected.tipo && e.tipo !== expected.tipo) {
    throw new Error(`Entidad id=${id} tipo=${e.tipo}, esperado ${expected.tipo}`)
  }
  if (expected.codigo && e.codigo !== expected.codigo) {
    throw new Error(`Entidad id=${id} codigo=${e.codigo}, esperado ${expected.codigo}`)
  }
  return e
}

async function listarMovimientos(entidadId) {
  return prisma.movimientoCaja.findMany({
    where: { entidadId },
    select: {
      id: true, numero: true, fecha: true, tipo: true, monto: true, concepto: true, descripcion: true,
    },
    orderBy: { fecha: 'asc' }
  })
}

async function main() {
  const tenant = await resolveTenant(prisma, 'convertir-proveedores-a-clientes.js')
  const tenantId = tenant.id
  console.log(APPLY ? '\n*** MODO APPLY (cambios reales) ***' : '\n*** MODO DRY-RUN (no se aplican cambios — usar --apply) ***')

  // ---- 1) VALIDACIONES PREVIAS ----
  console.log('\n=== Validando entidades a convertir ===')
  for (const c of CONVERSIONES) {
    const e = await verificarEntidad(c.id, { tenantId, tipo: 'PROVEEDOR', codigo: c.codigoActual })
    const totalRefs = Object.values(e._count).reduce((a,b) => a+b, 0)
    console.log(`  OK [${e.id}] ${e.codigo} ${e.razonSocial} (refs totales: ${totalRefs})`)
  }

  console.log('\n=== Validando clientes a borrar (deben tener 0 referencias) ===')
  for (const id of CLIENTES_A_BORRAR) {
    const e = await verificarEntidad(id, { tenantId, tipo: 'CLIENTE' })
    const totalRefs = Object.values(e._count).reduce((a,b) => a+b, 0)
    if (totalRefs > 0) {
      throw new Error(`Cliente id=${id} ${e.codigo} ${e.razonSocial} tiene ${totalRefs} referencias — abortando`)
    }
    console.log(`  OK [${e.id}] ${e.codigo} ${e.razonSocial} sin referencias`)
  }

  console.log('\n=== Validando proveedor duplicado (sin referencias) ===')
  const dup = await verificarEntidad(DUPLICADO_A_BORRAR, { tenantId, tipo: 'PROVEEDOR', codigo: 'PROV-2026-00015' })
  const dupRefs = Object.values(dup._count).reduce((a,b) => a+b, 0)
  if (dupRefs > 0) {
    throw new Error(`Duplicado id=${dup.id} tiene ${dupRefs} referencias — abortando`)
  }
  console.log(`  OK [${dup.id}] ${dup.codigo} ${dup.razonSocial} sin referencias`)

  // ---- 2) DETALLE DE MOVIMIENTOS DE CAJA QUE QUEDARÁN APUNTANDO A LAS NUEVAS CLIENTES ----
  console.log('\n=== Movimientos de caja que apuntan a las entidades a convertir ===')
  console.log('   (la FK entidadId no cambia, solo cambian tipo+codigo de la entidad)')
  for (const c of CONVERSIONES) {
    const movs = await listarMovimientos(c.id)
    if (movs.length === 0) {
      console.log(`  [${c.id}] ${c.codigoActual} → (sin movimientos)`)
    } else {
      console.log(`  [${c.id}] ${c.codigoActual} → ${nuevoCodigo(c.nuevaSeq)} — ${movs.length} mov(s):`)
      for (const m of movs) {
        const fecha = m.fecha?.toISOString().slice(0,10)
        console.log(`     mov #${m.id} ${m.numero} (${fecha}) tipo=${m.tipo} $${m.monto} — ${m.concepto || m.descripcion || ''}`)
      }
    }
  }

  // ---- 3) APLICAR (si --apply) ----
  if (!APPLY) {
    console.log('\n*** DRY-RUN terminado. Usar --apply para ejecutar los cambios. ***')
    return
  }

  console.log('\n=== Ejecutando cambios en transacción ===')
  await prisma.$transaction(async (tx) => {
    // a) borrar clientes existentes
    for (const id of CLIENTES_A_BORRAR) {
      const r = await tx.entidad.delete({ where: { id } })
      console.log(`  - borrado CLIENTE [${r.id}] ${r.codigo} ${r.razonSocial}`)
    }

    // b) borrar duplicado de Ritzinger
    {
      const r = await tx.entidad.delete({ where: { id: DUPLICADO_A_BORRAR } })
      console.log(`  - borrado duplicado [${r.id}] ${r.codigo} ${r.razonSocial}`)
    }

    // c) convertir proveedores → primero a códigos temporales para evitar choques con @@unique(tenantId, codigo)
    for (const c of CONVERSIONES) {
      const tmp = `__TMP-${c.id}`
      await tx.entidad.update({ where: { id: c.id }, data: { codigo: tmp } })
    }

    // d) asignar códigos finales + cambiar tipo
    for (const c of CONVERSIONES) {
      const cod = nuevoCodigo(c.nuevaSeq)
      const r = await tx.entidad.update({
        where: { id: c.id },
        data: { codigo: cod, tipo: 'CLIENTE' },
      })
      console.log(`  + convertido [${r.id}] ${c.codigoActual} → ${r.codigo} (tipo=CLIENTE) ${r.razonSocial}`)
    }
  })

  // ---- 4) VERIFICACIÓN POST-CAMBIOS ----
  console.log('\n=== Verificación post-cambios ===')
  const finales = await prisma.entidad.findMany({
    where: { tenantId, tipo: 'CLIENTE' },
    orderBy: { codigo: 'asc' },
    select: {
      id: true, codigo: true, razonSocial: true,
      _count: { select: { movimientosCaja: true } }
    }
  })
  for (const e of finales) {
    console.log(`  [${e.id}] ${e.codigo} ${e.razonSocial} — movs: ${e._count.movimientosCaja}`)
  }
  console.log('\n✅ Listo.')
}

main()
  .catch(e => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
