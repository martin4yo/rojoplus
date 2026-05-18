/**
 * DRY-RUN del proceso de bloqueo por morosidad.
 *
 * Para un tenant, simula el cron de vigencia:
 *  - Considera SÓLO socios habilitados (estadoSocioRel.esSocioActivo = true).
 *  - Detecta familias con al menos una cuota PENDIENTE vencida.
 *  - Aplica días de gracia (MOROSIDAD_DIAS_GRACIA, default 0).
 *  - Lista todos los miembros que se bloquearían y las cuotas específicas.
 *
 * NO modifica nada en la base de datos.
 *
 * Salida:
 *  - Resumen ejecutivo por consola.
 *  - CSV detallado de socios afectados.
 *  - CSV detallado de cuotas vencidas.
 *
 * Uso:
 *   node src/scripts/dryRunMorosidad.js [--tenant <id|slug>]
 *
 * Defaults: tenant id=4 (sportivotest)
 */
import prisma from '../lib/prisma.js'
import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
let tenantArg = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tenant') tenantArg = args[i + 1]
}

async function resolverTenant() {
  if (!tenantArg) return 4 // default sportivotest
  if (/^\d+$/.test(tenantArg)) return parseInt(tenantArg)
  const t = await prisma.tenant.findFirst({ where: { slug: tenantArg }, select: { id: true } })
  if (!t) throw new Error(`Tenant no encontrado: ${tenantArg}`)
  return t.id
}

function fmtFecha(d) {
  if (!d) return ''
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function escribirCsv(filename, header, rows) {
  const outDir = path.resolve('docs/dry-run')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const filepath = path.join(outDir, filename)
  const sep = ';'
  const lines = [
    header.map(csvEscape).join(sep),
    ...rows.map(r => r.map(csvEscape).join(sep)),
  ]
  fs.writeFileSync(filepath, '﻿' + lines.join('\n'), 'utf-8') // BOM para Excel
  return filepath
}

async function main() {
  const tenantId = await resolverTenant()
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, nombre: true } })
  console.log(`\n=== DRY-RUN morosidad — tenant ${tenant?.slug} (id=${tenantId}) ===\n`)

  // Config
  const cfg = await prisma.configuracion.findMany({
    where: { tenantId, clave: { in: ['MOROSIDAD_BLOQUEO_AUTO_ACTIVO', 'MOROSIDAD_DIAS_GRACIA', 'MOROSIDAD_MIN_CUOTAS_VENCIDAS'] } },
    select: { clave: true, valor: true },
  })
  const cfgMap = Object.fromEntries(cfg.map(c => [c.clave, c.valor]))
  const diasGracia = parseInt(cfgMap.MOROSIDAD_DIAS_GRACIA) || 0
  const minCuotasParsed = parseInt(cfgMap.MOROSIDAD_MIN_CUOTAS_VENCIDAS)
  const minCuotas = Number.isFinite(minCuotasParsed) && minCuotasParsed >= 1 ? minCuotasParsed : 2
  const bloqueoActivo = cfgMap.MOROSIDAD_BLOQUEO_AUTO_ACTIVO === 'true'

  const hoy = new Date()
  const cutoff = new Date(hoy)
  cutoff.setDate(cutoff.getDate() - diasGracia)

  console.log(`Bloqueo automático: ${bloqueoActivo ? 'ACTIVO' : 'INACTIVO'}`)
  console.log(`Días de gracia    : ${diasGracia}`)
  console.log(`Mín. cuotas venc. : ${minCuotas} (períodos distintos)`)
  console.log(`Fecha hoy         : ${fmtFecha(hoy)}`)
  console.log(`Cutoff venc <     : ${fmtFecha(cutoff)}\n`)

  // Estados de vigencia
  const estados = await prisma.estadoSocio.findMany({
    where: { tenantId, rolVigencia: { in: ['BLOQUEADO', 'AL_DIA'] } },
    select: { id: true, codigo: true, nombre: true, rolVigencia: true },
  })
  const bloqueado = estados.find(e => e.rolVigencia === 'BLOQUEADO')
  const alDia = estados.find(e => e.rolVigencia === 'AL_DIA')
  console.log(`Estado BLOQUEADO  : ${bloqueado ? `${bloqueado.codigo} (id=${bloqueado.id})` : '⚠️ NO CONFIGURADO'}`)
  console.log(`Estado AL_DIA     : ${alDia ? `${alDia.codigo} (id=${alDia.id})` : '⚠️ NO CONFIGURADO'}\n`)

  if (!bloqueado || !alDia) {
    console.log('⚠️  Faltan estados con rolVigencia. El cron NO procesaría este tenant.')
    process.exit(0)
  }

  // 1) Cargos PENDIENTE vencidos de socios HABILITADOS
  //    Para el conteo de umbral sólo cuentan cuotas con periodoId (excluye cargos manuales/extras).
  const cargos = await prisma.cargo.findMany({
    where: {
      tenantId,
      estado: 'PENDIENTE',
      fechaVencimiento: { lt: cutoff },
      socioId: { not: null },
      socio: { estadoSocioRel: { esSocioActivo: true } },
    },
    select: {
      id: true,
      socioId: true,
      periodoId: true,
      montoTotal: true,
      fechaVencimiento: true,
      categoria: true,
      descripcion: true,
      periodo: { select: { nombre: true } },
      categoriaActividad: { select: { nombre: true, actividad: { select: { nombre: true } } } },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  if (cargos.length === 0) {
    console.log('✅ No hay socios habilitados con cuotas vencidas. Nada para bloquear.')
    process.exit(0)
  }

  // 2) Agrupar cargos por socio + identificar socios morosos (>= minCuotas periodos distintos)
  const cargosPorSocio = new Map()
  const periodosPorSocio = new Map()
  for (const c of cargos) {
    if (!cargosPorSocio.has(c.socioId)) cargosPorSocio.set(c.socioId, [])
    cargosPorSocio.get(c.socioId).push(c)
    if (c.periodoId) {
      if (!periodosPorSocio.has(c.socioId)) periodosPorSocio.set(c.socioId, new Set())
      periodosPorSocio.get(c.socioId).add(c.periodoId)
    }
  }
  const morososIds = new Set()
  for (const [sid, periodos] of periodosPorSocio.entries()) {
    if (periodos.size >= minCuotas) morososIds.add(sid)
  }

  if (morososIds.size === 0) {
    console.log(`✅ No hay socios habilitados con ${minCuotas}+ cuotas vencidas en períodos distintos. Nada para bloquear.`)
    process.exit(0)
  }

  // 3) Socios morosos + sus titulares
  const morosos = await prisma.socio.findMany({
    where: { id: { in: [...morososIds] } },
    select: { id: true, titularFamiliaId: true },
  })
  const titulares = new Set()
  for (const m of morosos) titulares.add(m.titularFamiliaId || m.id)

  // 4) Toda la familia de cada titular (incluye miembros sin deuda propia)
  const familias = await prisma.socio.findMany({
    where: {
      tenantId,
      OR: [
        { id: { in: [...titulares] } },
        { titularFamiliaId: { in: [...titulares] } },
      ],
    },
    select: {
      id: true, nroSocio: true, apellidoNombre: true, titularFamiliaId: true,
      email: true, celular: true,
      estadoSocioRel: { select: { id: true, codigo: true, nombre: true, esSocioActivo: true } },
    },
    orderBy: [{ titularFamiliaId: 'asc' }, { id: 'asc' }],
  })

  const familiasMap = new Map() // titularId -> [miembros]
  for (const t of titulares) familiasMap.set(t, [])
  for (const s of familias) {
    const tid = s.titularFamiliaId || s.id
    if (familiasMap.has(tid)) familiasMap.get(tid).push(s)
  }

  // 5) Filas para CSV de socios
  const sociosRows = []
  const cuotasRows = []
  let totalABloquearNuevos = 0
  let totalYaBloqueados = 0
  let totalSociosSinDeudaPropia = 0
  let totalSociosConDeudaPropia = 0
  let totalDeuda = 0

  for (const [tid, miembros] of familiasMap.entries()) {
    const titular = miembros.find(m => !m.titularFamiliaId) || miembros[0]
    const titularNum = titular?.nroSocio || ''
    const titularNombre = titular?.apellidoNombre || ''

    const totalDeudaFam = miembros.reduce((sum, m) => {
      const cs = cargosPorSocio.get(m.id) || []
      return sum + cs.reduce((s, c) => s + Number(c.montoTotal), 0)
    }, 0)

    for (const m of miembros) {
      const cs = cargosPorSocio.get(m.id) || []
      const periodosM = periodosPorSocio.get(m.id)?.size || 0
      const esMorosoIndividual = morososIds.has(m.id)
      const deudaSocio = cs.reduce((s, c) => s + Number(c.montoTotal), 0)
      const yaBloqueado = m.estadoSocioRel?.id === bloqueado.id
      if (yaBloqueado) totalYaBloqueados++
      else totalABloquearNuevos++

      if (deudaSocio > 0) totalSociosConDeudaPropia++
      else totalSociosSinDeudaPropia++

      totalDeuda += deudaSocio

      sociosRows.push([
        m.nroSocio,
        m.apellidoNombre,
        !m.titularFamiliaId ? 'TITULAR' : 'MIEMBRO',
        m.estadoSocioRel?.codigo || '',
        m.estadoSocioRel?.nombre || '',
        yaBloqueado ? 'YA_BLOQUEADO' : 'A_BLOQUEAR',
        esMorosoIndividual ? 'PROPIA' : (deudaSocio > 0 ? 'PROPIA<UMBRAL' : 'FAMILIA'),
        cs.length,
        periodosM,
        deudaSocio.toFixed(2),
        titularNum,
        titularNombre,
        miembros.length,
        totalDeudaFam.toFixed(2),
        m.email || '',
        m.celular || '',
      ])

      for (const c of cs) {
        cuotasRows.push([
          m.nroSocio,
          m.apellidoNombre,
          c.id,
          c.categoria || '',
          c.descripcion || '',
          c.periodo?.nombre || '',
          c.categoriaActividad
            ? `${c.categoriaActividad.actividad?.nombre || ''} - ${c.categoriaActividad.nombre}`
            : '',
          fmtFecha(c.fechaVencimiento),
          Number(c.montoTotal).toFixed(2),
        ])
      }
    }
  }

  // 6) Resumen
  console.log('=== RESUMEN ===')
  console.log(`  Familias afectadas         : ${familiasMap.size}`)
  console.log(`  Socios totales en familias : ${totalABloquearNuevos + totalYaBloqueados}`)
  console.log(`     → A BLOQUEAR (nuevos)   : ${totalABloquearNuevos}`)
  console.log(`     → ya bloqueados         : ${totalYaBloqueados}`)
  console.log(`  Con deuda directa          : ${totalSociosConDeudaPropia}`)
  console.log(`  Sin deuda (arrastra famil.): ${totalSociosSinDeudaPropia}`)
  console.log(`  Cuotas pendientes vencidas : ${cargos.length}`)
  console.log(`  Deuda total acumulada      : $${totalDeuda.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

  // 7) Escribir CSVs
  const stamp = `${tenant?.slug || tenantId}_${new Date().toISOString().slice(0, 10)}`
  const csvSocios = escribirCsv(
    `dry-run-morosidad-socios-${stamp}.csv`,
    ['nroSocio', 'apellidoNombre', 'rol', 'estadoCodigo', 'estadoNombre', 'accion', 'causa', 'cantCuotas', 'periodosVencidos', 'deudaPropia', 'titularNroSocio', 'titularNombre', 'integrantesFamilia', 'deudaFamilia', 'email', 'celular'],
    sociosRows,
  )
  const csvCuotas = escribirCsv(
    `dry-run-morosidad-cuotas-${stamp}.csv`,
    ['nroSocio', 'apellidoNombre', 'cargoId', 'categoria', 'descripcion', 'periodo', 'actividad', 'fechaVencimiento', 'montoTotal'],
    cuotasRows,
  )

  console.log('\n=== CSV generados ===')
  console.log(`  ${csvSocios}`)
  console.log(`  ${csvCuotas}`)
  console.log('\nDRY-RUN finalizado. No se modificó ningún registro.\n')

  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
