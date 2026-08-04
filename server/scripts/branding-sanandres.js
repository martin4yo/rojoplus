/**
 * Aplica la paleta azul oscuro (navy) al tenant "sanandres".
 *
 * Solo toca Tenant.colores — no modifica ningún otro dato del tenant.
 * Imprime el valor anterior antes de escribir, para poder revertir.
 *
 * Uso:
 *   node scripts/branding-sanandres.js                     # dry-run contra DATABASE_URL de .env
 *   node scripts/branding-sanandres.js --apply             # escribe
 *   DATABASE_URL="postgresql://...:5436/clubix_db" node scripts/branding-sanandres.js --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')

// Claves consumidas por applyTheme() en client/src/contexts/TenantContext.jsx.
// fondoSitio → --pub-hero-bg, que es el fondo del sitio público (hero, header,
// footer, portal socio). primario → --color-primary, el que por defecto es rojo.
const COLORS = {
  primario: '#1E3A8A',
  primarioOscuro: '#152C6B',
  primarioClaro: '#93B4E8',
  secundario: '#0F172A',
  secundarioOscuro: '#060B18',
  secundarioClaro: '#334155',
  acento: '#38BDF8',
  exito: '#10B981',
  advertencia: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  fondoPrincipal: '#FFFFFF',
  fondoSecundario: '#F1F5F9',
  textoPrincipal: '#0F172A',
  textoSecundario: '#64748B',
  borde: '#DBE3EE',
  fondoSitio: '#0B1B3A',
  textoSitio: '#FFFFFF',
}

async function main() {
  const [{ d: db, port }] = await prisma.$queryRaw`select current_database() as d, inet_server_port() as port`
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
  if (!tenant) {
    console.error(`❌ No existe el tenant "${SUBDOMAIN}" en ${db} (server port ${port})`)
    process.exitCode = 1
    return
  }

  console.log(`Base   : ${db} (server port ${port})`)
  console.log(`Tenant : id=${tenant.id} ${tenant.nombre}`)
  console.log(`Antes  : ${JSON.stringify(tenant.colores)}`)
  console.log(`Después: ${JSON.stringify(COLORS)}`)

  if (!APPLY) {
    console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
    return
  }

  await prisma.tenant.update({ where: { id: tenant.id }, data: { colores: COLORS } })
  console.log('\n✅ Paleta azul oscuro aplicada.')
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
