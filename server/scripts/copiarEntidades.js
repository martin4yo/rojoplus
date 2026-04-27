/**
 * Copia datos maestros de un tenant origen a un tenant destino.
 *
 * Por defecto copia: entidades (PROVEEDOR + PERSONAL).
 * Opcionalmente: PdfTemplate (recibos/comprobantes para imprimir), EmailTemplate (cuerpo de mails).
 *
 * Uso:
 *   - Solo entidades (default):
 *       node scripts/copiarEntidades.js --from sportivotest --to sportivopilar [--dry-run]
 *   - Entidades + plantillas PDF:
 *       node scripts/copiarEntidades.js --from sportivotest --to sportivopilar --templates
 *   - Entidades + plantillas PDF + emails:
 *       node scripts/copiarEntidades.js --from sportivotest --to sportivopilar --templates --emails
 *   - Solo plantillas (sin entidades):
 *       node scripts/copiarEntidades.js --from sportivotest --to sportivopilar --templates --emails --skip-entidades
 *
 * Comportamiento:
 *   - Idempotente: si ya existe en el destino con el mismo identificador (codigo / tipo / eventType), SALTA.
 *   - Entidades: remapea cargoPersonalId y centroCostoId por código. Sin match → null.
 *   - Plantillas: copia tal cual (no tienen FKs entre tenants).
 *   - No copia ids ni timestamps.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return def
  return process.argv[i + 1] || def
}

const FROM_SLUG = arg('from')
const TO_SLUG = arg('to')
const DRY_RUN = process.argv.includes('--dry-run')
const TIPOS = (arg('tipos', 'PROVEEDOR,PERSONAL') || '').split(',').map(t => t.trim()).filter(Boolean)
const COPIAR_TEMPLATES = process.argv.includes('--templates')
const COPIAR_EMAILS = process.argv.includes('--emails')
const SKIP_ENTIDADES = process.argv.includes('--skip-entidades')

if (!FROM_SLUG || !TO_SLUG) {
  console.error('Uso: node copiarEntidades.js --from <slug-origen> --to <slug-destino> [--tipos PROVEEDOR,PERSONAL] [--templates] [--emails] [--skip-entidades] [--dry-run]')
  process.exit(1)
}

async function main() {
  console.log(`\n=== Copia de entidades ===`)
  console.log(`Origen:  ${FROM_SLUG}`)
  console.log(`Destino: ${TO_SLUG}`)
  console.log(`Tipos:   ${TIPOS.join(', ')}`)
  console.log(`Modo:    ${DRY_RUN ? 'DRY-RUN' : 'APLICAR'}\n`)

  const [fromTenant, toTenant] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug: FROM_SLUG } }),
    prisma.tenant.findUnique({ where: { slug: TO_SLUG } }),
  ])
  if (!fromTenant) { console.error(`❌ Tenant origen '${FROM_SLUG}' no encontrado`); process.exit(1) }
  if (!toTenant)   { console.error(`❌ Tenant destino '${TO_SLUG}' no encontrado`); process.exit(1) }
  console.log(`✔ Origen:  ${fromTenant.nombre} (id=${fromTenant.id})`)
  console.log(`✔ Destino: ${toTenant.nombre} (id=${toTenant.id})\n`)

  if (!SKIP_ENTIDADES) {
    await copiarEntidades(fromTenant, toTenant)
  }
  if (COPIAR_TEMPLATES) {
    await copiarPdfTemplates(fromTenant, toTenant)
  }
  if (COPIAR_EMAILS) {
    await copiarEmailTemplates(fromTenant, toTenant)
  }

  if (DRY_RUN) console.log(`\n⚠ DRY-RUN. Para aplicar, corré sin --dry-run.`)
  else        console.log(`\n✅ Migración completada.`)
}

// ─── ENTIDADES ───────────────────────────────────────────────────────────────

// Genera el próximo código en destino según el tipo de entidad y un contador local
// que se va incrementando durante la copia para no chocar entre items del mismo lote.
async function nuevoCodigoEntidad(tenantId, tipo, contadorLocal) {
  const prefijos = { PROVEEDOR: 'PROV', CLIENTE: 'CLI', PERSONAL: 'PERS' }
  const prefijo = prefijos[tipo] || 'ENT'
  const anio = new Date().getFullYear()

  if (contadorLocal[prefijo] === undefined) {
    const ultimo = await prisma.entidad.findFirst({
      where: { tenantId, codigo: { startsWith: `${prefijo}-` } },
      orderBy: { codigo: 'desc' },
    })
    let seq = 0
    if (ultimo) {
      const partes = ultimo.codigo.split('-')
      seq = parseInt(partes[partes.length - 1]) || 0
    }
    contadorLocal[prefijo] = seq
  }
  contadorLocal[prefijo] += 1
  return `${prefijo}-${anio}-${String(contadorLocal[prefijo]).padStart(5, '0')}`
}

async function copiarEntidades(fromTenant, toTenant) {
  console.log(`\n──── Entidades (${TIPOS.join(', ')}) ────`)
  const entidades = await prisma.entidad.findMany({
    where: { tenantId: fromTenant.id, tipo: { in: TIPOS } },
    include: {
      cargoPersonal: { select: { codigo: true, nombre: true } },
      centroCosto:   { select: { codigo: true, nombre: true } },
    },
    orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
  })
  console.log(`Encontradas en origen: ${entidades.length}\n`)

  // Lookup tables del destino para remapeo
  const cargosDestino = await prisma.cargoPersonal.findMany({ where: { tenantId: toTenant.id } })
  const cargosByCodigo = new Map(cargosDestino.map(c => [c.codigo, c.id]))

  const centrosDestino = await prisma.centroCosto.findMany({ where: { tenantId: toTenant.id } })
  const centrosByCodigo = new Map(centrosDestino.map(c => [c.codigo, c.id]))

  // Dedup en destino por (tipo, documento) o (tipo, razonSocial-normalizada)
  const existentesDestino = await prisma.entidad.findMany({
    where: { tenantId: toTenant.id, tipo: { in: TIPOS } },
    select: { codigo: true, tipo: true, razonSocial: true, documento: true },
  })
  const norm = s => (s || '').trim().toUpperCase()
  const dedupKey = (tipo, doc, razon) => doc
    ? `${tipo}::DOC::${norm(doc)}`
    : `${tipo}::RAZ::${norm(razon)}`
  const yaExistenDedup = new Set(existentesDestino.map(e => dedupKey(e.tipo, e.documento, e.razonSocial)))

  // Contador local para asignar nuevos códigos sin chocar
  const contadorLocal = {}

  let creadas = 0
  let saltadas = 0
  let warningsCargo = 0
  let warningsCentro = 0

  for (const e of entidades) {
    const dKey = dedupKey(e.tipo, e.documento, e.razonSocial)
    if (yaExistenDedup.has(dKey)) {
      const motivo = e.documento ? `documento ${e.documento}` : `razón social "${e.razonSocial}"`
      console.log(`  ⊘ SALTADA  [${e.tipo}] ${e.codigo} — ${e.razonSocial} (ya existe en destino con mismo ${motivo})`)
      saltadas++
      continue
    }

    // Remapear cargoPersonal
    let nuevoCargoPersonalId = null
    if (e.cargoPersonalId && e.cargoPersonal?.codigo) {
      nuevoCargoPersonalId = cargosByCodigo.get(e.cargoPersonal.codigo) ?? null
      if (!nuevoCargoPersonalId) {
        console.log(`    ⚠ Cargo '${e.cargoPersonal.codigo}' no existe en destino → quedará en null`)
        warningsCargo++
      }
    }

    // Remapear centroCosto
    let nuevoCentroCostoId = null
    if (e.centroCostoId && e.centroCosto?.codigo) {
      nuevoCentroCostoId = centrosByCodigo.get(e.centroCosto.codigo) ?? null
      if (!nuevoCentroCostoId) {
        console.log(`    ⚠ Centro de costo '${e.centroCosto.codigo}' no existe en destino → quedará en null`)
        warningsCentro++
      }
    }

    const nuevoCodigo = await nuevoCodigoEntidad(toTenant.id, e.tipo, contadorLocal)

    const data = {
      tenantId: toTenant.id,
      codigo: nuevoCodigo,
      tipo: e.tipo,
      razonSocial: e.razonSocial,
      nombreFantasia: e.nombreFantasia,
      tipoDocumento: e.tipoDocumento,
      documento: e.documento,
      email: e.email,
      telefono: e.telefono,
      direccion: e.direccion,
      ciudad: e.ciudad,
      provincia: e.provincia,
      codigoPostal: e.codigoPostal,
      condicionIva: e.condicionIva,
      banco: e.banco,
      cbu: e.cbu,
      alias: e.alias,
      legajo: e.legajo,
      fechaIngreso: e.fechaIngreso,
      sueldoBasico: e.sueldoBasico,
      foto: e.foto,
      observaciones: e.observaciones,
      activo: e.activo,
      cargoPersonalId: nuevoCargoPersonalId,
      centroCostoId: nuevoCentroCostoId,
    }

    if (DRY_RUN) {
      console.log(`  + CREARÍA  [${e.tipo}] ${e.codigo} → ${nuevoCodigo} — ${e.razonSocial}`)
    } else {
      await prisma.entidad.create({ data })
      console.log(`  ✔ CREADA   [${e.tipo}] ${e.codigo} → ${nuevoCodigo} — ${e.razonSocial}`)
    }
    // Marcar como existente para no duplicar dentro del mismo lote
    yaExistenDedup.add(dKey)
    creadas++
  }

  console.log(`  ─ Resumen entidades ─`)
  console.log(`  Total en origen:        ${entidades.length}`)
  console.log(`  Ya existían en destino: ${saltadas}`)
  console.log(`  ${DRY_RUN ? 'Se crearían' : 'Creadas'}:             ${creadas}`)
  console.log(`  ⚠ Cargos sin match:     ${warningsCargo}`)
  console.log(`  ⚠ Centros sin match:    ${warningsCentro}`)
}

// ─── PDF TEMPLATES (recibos / comprobantes para imprimir o adjuntar) ─────────

async function copiarPdfTemplates(fromTenant, toTenant) {
  console.log(`\n──── PDF Templates ────`)
  const templates = await prisma.pdfTemplate.findMany({ where: { tenantId: fromTenant.id } })
  console.log(`Encontradas en origen: ${templates.length}`)

  const existentes = await prisma.pdfTemplate.findMany({
    where: { tenantId: toTenant.id },
    select: { tipo: true },
  })
  const yaExisten = new Set(existentes.map(t => t.tipo))

  let creadas = 0, saltadas = 0
  for (const t of templates) {
    if (yaExisten.has(t.tipo)) {
      console.log(`  ⊘ SALTADA  [PDF] ${t.tipo} — ${t.nombre} (ya existe en destino)`)
      saltadas++
      continue
    }
    const data = {
      tenantId: toTenant.id,
      tipo: t.tipo,
      nombre: t.nombre,
      descripcion: t.descripcion,
      htmlContent: t.htmlContent,
      cssContent: t.cssContent,
      variables: t.variables,
      pageFormat: t.pageFormat,
      orientation: t.orientation,
      isActive: t.isActive,
    }
    if (DRY_RUN) {
      console.log(`  + CREARÍA  [PDF] ${t.tipo} — ${t.nombre}`)
    } else {
      await prisma.pdfTemplate.create({ data })
      console.log(`  ✔ CREADA   [PDF] ${t.tipo} — ${t.nombre}`)
    }
    creadas++
  }
  console.log(`  ${DRY_RUN ? 'Se crearían' : 'Creadas'}: ${creadas} · Saltadas: ${saltadas}`)
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

async function copiarEmailTemplates(fromTenant, toTenant) {
  console.log(`\n──── Email Templates ────`)
  const templates = await prisma.emailTemplate.findMany({ where: { tenantId: fromTenant.id } })
  console.log(`Encontradas en origen: ${templates.length}`)

  const existentes = await prisma.emailTemplate.findMany({
    where: { tenantId: toTenant.id },
    select: { eventType: true },
  })
  const yaExisten = new Set(existentes.map(t => t.eventType))

  let creadas = 0, saltadas = 0
  for (const t of templates) {
    if (yaExisten.has(t.eventType)) {
      console.log(`  ⊘ SALTADA  [EMAIL] ${t.eventType} — ${t.nombre} (ya existe en destino)`)
      saltadas++
      continue
    }
    const data = {
      tenantId: toTenant.id,
      eventType: t.eventType,
      nombre: t.nombre,
      descripcion: t.descripcion,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
      variables: t.variables,
      isActive: t.isActive,
    }
    if (DRY_RUN) {
      console.log(`  + CREARÍA  [EMAIL] ${t.eventType} — ${t.nombre}`)
    } else {
      await prisma.emailTemplate.create({ data })
      console.log(`  ✔ CREADA   [EMAIL] ${t.eventType} — ${t.nombre}`)
    }
    creadas++
  }
  console.log(`  ${DRY_RUN ? 'Se crearían' : 'Creadas'}: ${creadas} · Saltadas: ${saltadas}`)
}

main()
  .catch(err => {
    console.error('\n❌ Error en la migración:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
