/**
 * Renumera socios para que su nroSocio caiga dentro del rango configurado en
 * Configuracion (SOCIO_NRO_MIN / SOCIO_NRO_MAX) del tenant.
 *
 * Toma cada socio especificado por su nroSocio actual, calcula el próximo libre
 * dentro del rango y lo reasigna. Usa transacción.
 *
 * Uso:
 *   node scripts/renumerar-socios.js --tenant <slug> --socios 6,7 [--apply]
 *
 * Sin --apply es dry-run: muestra qué nroSocio se asignaría a cada uno sin tocar BD.
 */

import { PrismaClient } from '@prisma/client'
import { arg, flag, resolveTenant } from './_lib/cli.js'

const prisma = new PrismaClient()

async function main() {
  const tenant = await resolveTenant(prisma, 'renumerar-socios.js')
  const tenantId = tenant.id
  const apply = flag('apply')
  const sociosArg = arg('socios')

  if (!sociosArg) {
    console.error('❌ Falta --socios <lista> (nroSocios actuales separados por coma). Ej: --socios 6,7')
    process.exit(1)
  }
  const nrosBuscar = sociosArg.split(',').map(s => s.trim()).filter(Boolean)

  // 1) Leer rango configurado
  const [cfgMin, cfgMax] = await Promise.all([
    prisma.configuracion.findFirst({ where: { tenantId, clave: 'SOCIO_NRO_MIN' } }),
    prisma.configuracion.findFirst({ where: { tenantId, clave: 'SOCIO_NRO_MAX' } }),
  ])
  const min = cfgMin?.valor ? parseInt(cfgMin.valor, 10) : null
  const max = cfgMax?.valor ? parseInt(cfgMax.valor, 10) : null

  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    console.error('❌ El tenant no tiene SOCIO_NRO_MIN / SOCIO_NRO_MAX configurados (o son inválidos).')
    process.exit(1)
  }
  console.log(`Rango configurado: ${min} - ${max}`)

  // 2) Cargar todos los nroSocio del tenant para evitar colisiones
  const socios = await prisma.socio.findMany({
    where: { tenantId },
    select: { id: true, nroSocio: true, apellidoNombre: true },
  })
  const usados = new Set(
    socios
      .map(s => parseInt(s.nroSocio, 10))
      .filter(n => Number.isFinite(n) && n > 0)
  )

  // 3) Localizar los socios a renumerar
  const aRenumerar = []
  for (const nro of nrosBuscar) {
    const s = socios.find(x => String(x.nroSocio) === nro)
    if (!s) {
      console.warn(`⚠ No se encontró socio con nroSocio="${nro}" en el tenant.`)
      continue
    }
    aRenumerar.push(s)
  }

  if (aRenumerar.length === 0) {
    console.log('Sin socios para renumerar. Salgo.')
    return
  }

  // 4) Calcular nuevo nroSocio para cada uno (próximo libre dentro del rango).
  // Recorremos desde min hacia max, salteando los ya usados.
  const enRango = [...usados].filter(n => n >= min && n <= max)
  let cursor = enRango.length === 0 ? min : Math.max(...enRango) + 1

  const plan = []
  for (const socio of aRenumerar) {
    while (usados.has(cursor) && cursor <= max) cursor++
    if (cursor > max) {
      console.error(`❌ Rango ${min}-${max} agotado al asignar a socio id=${socio.id} (${socio.apellidoNombre}).`)
      process.exit(1)
    }
    plan.push({ socio, nuevoNro: cursor })
    usados.add(cursor) // reservar para el siguiente del lote
    cursor++
  }

  // 5) Imprimir plan y aplicar (si --apply)
  console.log('\nPlan de reasignación:')
  for (const { socio, nuevoNro } of plan) {
    console.log(`  id=${socio.id}  ${socio.apellidoNombre}  ${socio.nroSocio} → ${nuevoNro}`)
  }

  if (!apply) {
    console.log('\nDry-run. Pasá --apply para ejecutar los cambios.')
    return
  }

  await prisma.$transaction(async tx => {
    for (const { socio, nuevoNro } of plan) {
      // Verificación final dentro de la transacción para evitar carreras
      const colision = await tx.socio.findFirst({
        where: { tenantId, nroSocio: String(nuevoNro), id: { not: socio.id } },
        select: { id: true },
      })
      if (colision) {
        throw new Error(`Colisión: nroSocio=${nuevoNro} ya usado por socio id=${colision.id}`)
      }
      await tx.socio.update({
        where: { id: socio.id },
        data: { nroSocio: String(nuevoNro) },
      })
    }
  })

  console.log('\n✓ Reasignación aplicada.')
}

main()
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
