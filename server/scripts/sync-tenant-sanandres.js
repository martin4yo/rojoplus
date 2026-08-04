/**
 * Copia el CONTENIDO del tenant "sanandres" de una base a otra.
 *
 * Copia sólo lo que describe al club (datos de contacto, branding, colores,
 * redes, contenido del sitio). NO toca lo que es de infraestructura de cada
 * entorno — plan, maxSocios/maxAdmins, estado, activo, dominioCustom — ni los
 * datos operativos (socios, actividades, cuotas).
 *
 * Ojo con logoUrl/faviconUrl: se copia la ruta, no el archivo. Si apuntan a
 * /uploads/... el archivo tiene que existir en el servidor destino.
 *
 * Uso:
 *   node scripts/sync-tenant-sanandres.js --from <URL_ORIGEN> --to <URL_DESTINO>
 *   node scripts/sync-tenant-sanandres.js --from ... --to ... --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')

const arg = (nombre) => {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : null
}

// Campos del tenant que describen al club
const CAMPOS_TENANT = [
  'nombre', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'codigoPostal',
  'descripcion', 'slogan', 'horarios', 'redesSociales', 'colores',
  'logoUrl', 'faviconUrl', 'heroImageUrl', 'razonSocial', 'cuit', 'condicionIva',
]
// Claves de contenido del sitio público
const CLAVES_TENANT_CONFIG = ['HERO_IMAGES', 'FECHA_FUNDACION']
const CLAVES_CONFIG = ['PAGINA_HISTORIA', 'CLUB_NOMBRE', 'CLUB_DIRECCION', 'CLUB_TELEFONO']

const iguales = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const corto = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  if (s === undefined || s === null) return '(vacío)'
  return s.length > 70 ? s.slice(0, 67) + '...' : s
}

async function main() {
  const urlFrom = arg('--from')
  const urlTo = arg('--to')
  if (!urlFrom || !urlTo) {
    console.error('Faltan --from <URL> y/o --to <URL>')
    process.exitCode = 1
    return
  }

  const from = new PrismaClient({ datasources: { db: { url: urlFrom } } })
  const to = new PrismaClient({ datasources: { db: { url: urlTo } } })

  try {
    const origen = await from.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
    const destino = await to.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
    if (!origen) throw new Error(`El tenant "${SUBDOMAIN}" no existe en el origen`)
    if (!destino) throw new Error(`El tenant "${SUBDOMAIN}" no existe en el destino`)

    console.log(`Origen  : tenant id=${origen.id} (${urlFrom.replace(/:[^:@]*@/, ':***@')})`)
    console.log(`Destino : tenant id=${destino.id} (${urlTo.replace(/:[^:@]*@/, ':***@')})\n`)

    // ── Campos del tenant ──────────────────────────────────────────────
    const omitir = (arg('--omitir') || '').split(',').filter(Boolean)
    if (omitir.length) console.log(`Campos omitidos por --omitir: ${omitir.join(', ')}\n`)
    const cambios = {}
    for (const campo of CAMPOS_TENANT) {
      if (omitir.includes(campo)) continue
      if (!iguales(origen[campo], destino[campo])) cambios[campo] = origen[campo]
    }
    if (Object.keys(cambios).length === 0) {
      console.log('Tenant: sin diferencias')
    } else {
      console.log('Tenant — campos a copiar:')
      for (const campo of Object.keys(cambios)) {
        console.log(`  ${campo}`)
        console.log(`     destino actual : ${corto(destino[campo])}`)
        console.log(`     pasa a ser     : ${corto(origen[campo])}`)
      }
    }

    // ── Config del sitio ───────────────────────────────────────────────
    const configs = []
    for (const clave of CLAVES_TENANT_CONFIG) {
      const o = await from.tenantConfiguracion.findUnique({ where: { tenantId_clave: { tenantId: origen.id, clave } } })
      const d = await to.tenantConfiguracion.findUnique({ where: { tenantId_clave: { tenantId: destino.id, clave } } })
      if (o && o.valor !== d?.valor) configs.push({ tabla: 'tenantConfiguracion', clave, valor: o.valor, tipo: o.tipo, actual: d?.valor })
    }
    for (const clave of CLAVES_CONFIG) {
      const o = await from.configuracion.findUnique({ where: { tenantId_clave: { tenantId: origen.id, clave } } })
      const d = await to.configuracion.findUnique({ where: { tenantId_clave: { tenantId: destino.id, clave } } })
      if (o && o.valor !== d?.valor) configs.push({ tabla: 'configuracion', clave, valor: o.valor, tipo: o.tipo, modulo: o.modulo, actual: d?.valor })
    }
    if (configs.length === 0) {
      console.log('\nConfiguración del sitio: sin diferencias')
    } else {
      console.log('\nConfiguración del sitio — claves a copiar:')
      for (const c of configs) {
        console.log(`  ${c.tabla}.${c.clave}`)
        console.log(`     destino actual : ${corto(c.actual)}`)
        console.log(`     pasa a ser     : ${corto(c.valor)}`)
      }
    }

    if (!APPLY) {
      console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
      return
    }
    if (Object.keys(cambios).length === 0 && configs.length === 0) {
      console.log('\nNada para hacer.')
      return
    }

    if (Object.keys(cambios).length) {
      await to.tenant.update({ where: { id: destino.id }, data: cambios })
      console.log(`\n✓ Tenant actualizado (${Object.keys(cambios).length} campos)`)
    }
    for (const c of configs) {
      if (c.tabla === 'tenantConfiguracion') {
        await to.tenantConfiguracion.upsert({
          where: { tenantId_clave: { tenantId: destino.id, clave: c.clave } },
          create: { tenantId: destino.id, clave: c.clave, valor: c.valor, tipo: c.tipo },
          update: { valor: c.valor },
        })
      } else {
        await to.configuracion.upsert({
          where: { tenantId_clave: { tenantId: destino.id, clave: c.clave } },
          create: { tenantId: destino.id, clave: c.clave, valor: c.valor, tipo: c.tipo, modulo: c.modulo },
          update: { valor: c.valor },
        })
      }
      console.log(`✓ ${c.tabla}.${c.clave}`)
    }
    console.log('\n✅ Sincronización aplicada.')
  } finally {
    await from.$disconnect()
    await to.$disconnect()
  }
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exitCode = 1 })
