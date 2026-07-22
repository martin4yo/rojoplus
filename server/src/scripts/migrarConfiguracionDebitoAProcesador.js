/**
 * Migración: parte ConfiguracionDebito en ProcesadorDebito (catálogo global,
 * define el formato del registro) + ConfiguracionDebito (datos del club por tenant).
 *
 * Se ejecuta DESPUÉS de `npx prisma db push`. La secuencia completa es:
 *   1. exportar configuracion_debito a JSON             (ver --json)
 *   2. TRUNCATE configuracion_debito                    (procesadorId es NOT NULL)
 *   3. npx prisma db push
 *   4. node src/scripts/migrarConfiguracionDebitoAProcesador.js --json <ruta>
 *
 * Idempotente: los procesadores se crean con upsert por `codigo` y las
 * configuraciones con upsert por (tenantId, procesadorId).
 *
 * Uso:
 *   node src/scripts/migrarConfiguracionDebitoAProcesador.js --json /ruta/configdebito-premig.json
 *   node src/scripts/migrarConfiguracionDebitoAProcesador.js --json /ruta/... --dry-run
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import 'dotenv/config'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')
const JSON_PATH = (() => {
  const idx = process.argv.indexOf('--json')
  return idx >= 0 ? process.argv[idx + 1] : null
})()

if (!JSON_PATH) {
  console.error('Falta --json <ruta al export previo>')
  process.exit(1)
}

// Campos que definen el formato del registro → van al procesador global.
function procesadorFromRow(r) {
  return {
    codigo: r.codigo,
    nombre: r.nombre,
    tipo: r.tipo,
    plataforma: r.plataforma,
    formatoArchivo: r.formato_archivo,
    separador: r.separador,
    encoding: r.encoding,
    configuracionCampos: r.configuracion_campos,
    templateCabecera: r.template_cabecera,
    templatePie: r.template_pie,
    apiUrl: r.api_url,
    activo: r.activo,
  }
}

// Campos del club → van a la configuración por tenant.
function configFromRow(r, procesadorId) {
  return {
    tenantId: r.tenant_id,
    procesadorId,
    codigoEmpresa: r.codigo_empresa,
    codigoComercio: r.codigo_comercio,
    nombreEmpresa: r.nombre_empresa,
    cuitEmpresa: r.cuit_empresa,
    apiKey: r.api_key,
    apiSecret: r.api_secret,
    ambiente: r.ambiente,
    activo: r.activo,
  }
}

async function main() {
  console.log(`Migración ConfiguracionDebito → Procesador + Configuración ${DRY_RUN ? '(DRY RUN)' : ''}`)

  const rows = JSON.parse(readFileSync(JSON_PATH, 'utf8')) || []
  console.log(`Filas en el export: ${rows.length}`)

  // 1. Procesadores globales, deduplicados por código.
  const procByCodigo = {}
  for (const r of rows) {
    if (!procByCodigo[r.codigo]) procByCodigo[r.codigo] = procesadorFromRow(r)
  }
  console.log(`\nProcesadores globales a crear: ${Object.keys(procByCodigo).join(', ')}`)

  const idsProcesador = {}
  for (const [codigo, data] of Object.entries(procByCodigo)) {
    if (DRY_RUN) { console.log(`  [DRY] procesador ${codigo} (${data.formatoArchivo})`); continue }
    const p = await prisma.procesadorDebito.upsert({
      where: { codigo },
      create: data,
      update: data,
    })
    idsProcesador[codigo] = p.id
    console.log(`  ✅ procesador ${codigo} → id=${p.id}`)
  }

  // 2. Configuraciones por tenant, apuntando al procesador.
  console.log(`\nConfiguraciones por tenant: ${rows.length}`)
  for (const r of rows) {
    const procesadorId = idsProcesador[r.codigo]
    if (DRY_RUN) { console.log(`  [DRY] t${r.tenant_id} · ${r.codigo}`); continue }

    const data = configFromRow(r, procesadorId)
    await prisma.configuracionDebito.upsert({
      where: { tenantId_procesadorId: { tenantId: r.tenant_id, procesadorId } },
      create: data,
      update: data,
    })
    console.log(`  ✅ t${r.tenant_id} · ${r.codigo}`)
  }

  console.log('\n✅ Migración completa')
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
