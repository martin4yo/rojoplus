/**
 * Backfill de hashOrigen en movimientos_extracto existentes.
 *
 * - Recorre TODOS los MovimientoExtracto sin hashOrigen.
 * - Calcula el hash con services/hashExtracto.js y lo guarda.
 * - Detecta y reporta colisiones por tenant (movimientos duplicados históricos).
 * - NO elimina nada. Las colisiones detectadas quedan logueadas para revisión manual.
 *
 * Uso:
 *   node src/scripts/backfillHashExtractos.js [--apply]
 *
 * Sin --apply solo calcula y muestra el reporte (dry-run).
 * Con --apply persiste los hashes calculados.
 */
import prisma from '../lib/prisma.js'
import { calcularHashMovimiento } from '../services/hashExtracto.js'

const apply = process.argv.includes('--apply')

async function main() {
  console.log(`Backfill hashOrigen — modo: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('--------------------------------------------------------')

  const pendientes = await prisma.movimientoExtracto.findMany({
    where: { hashOrigen: null },
    select: {
      id: true, tenantId: true, fecha: true, importe: true, tipo: true,
      concepto: true, referencia: true, numeroComprobante: true, saldo: true,
      extracto: { select: { numero: true, cajaId: true } }
    },
    orderBy: { id: 'asc' }
  })

  console.log(`Movimientos sin hash: ${pendientes.length}`)
  if (pendientes.length === 0) {
    console.log('Nada que hacer.')
    return
  }

  // Calcular hash y agrupar por (tenantId, hash) para detectar colisiones
  const grupos = new Map() // key = `${tenantId}|${hash}` → [movs]
  const updates = [] // { id, hashOrigen }

  for (const m of pendientes) {
    const hash = calcularHashMovimiento({
      fecha: m.fecha,
      importe: m.importe,
      tipo: m.tipo,
      concepto: m.concepto,
      referencia: m.referencia,
      numeroComprobante: m.numeroComprobante,
      saldo: m.saldo,
    })
    const key = `${m.tenantId}|${hash}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(m)
    updates.push({ id: m.id, hashOrigen: hash })
  }

  // Reporte de colisiones
  const colisiones = []
  for (const [key, movs] of grupos.entries()) {
    if (movs.length > 1) colisiones.push({ key, movs })
  }

  if (colisiones.length > 0) {
    console.log('')
    console.log(`⚠ ATENCIÓN: ${colisiones.length} grupos de movimientos duplicados detectados (mismo tenant + mismo hash)`)
    console.log('Si más adelante aplicás un @@unique([tenantId, hashOrigen]), estas filas hay que reconciliarlas antes.')
    console.log('')
    for (const c of colisiones.slice(0, 20)) {
      const [tenantId] = c.key.split('|')
      console.log(`  tenant=${tenantId} hash=${c.key.split('|')[1].slice(0, 12)}... → ${c.movs.length} movs`)
      for (const m of c.movs) {
        console.log(`    id=${m.id} fecha=${m.fecha.toISOString().slice(0,10)} importe=${m.importe} tipo=${m.tipo} extracto=${m.extracto?.numero} caja=${m.extracto?.cajaId}`)
        console.log(`      concepto="${(m.concepto || '').slice(0, 80)}"`)
      }
    }
    if (colisiones.length > 20) console.log(`  ... y ${colisiones.length - 20} más`)
  } else {
    console.log('✓ No se detectaron colisiones — todos los hashes son únicos por tenant.')
  }

  if (!apply) {
    console.log('')
    console.log('DRY-RUN: no se persistieron cambios. Volvé a correr con --apply para guardar los hashes.')
    return
  }

  // Persistir hashes en bloques de 500
  console.log('')
  console.log(`Guardando ${updates.length} hashes en BD...`)
  const BATCH = 500
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH)
    await prisma.$transaction(
      slice.map(u => prisma.movimientoExtracto.update({
        where: { id: u.id },
        data: { hashOrigen: u.hashOrigen }
      }))
    )
    console.log(`  ${Math.min(i + BATCH, updates.length)} / ${updates.length}`)
  }
  console.log('✓ Backfill completado.')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
