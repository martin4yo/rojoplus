/**
 * Contenido del sitio público del tenant "sanandres":
 *   - PAGINA_HISTORIA (tabla configuracion)  → /historia
 *   - HERO_IMAGES + FECHA_FUNDACION (tenant_configuracion) → hero del home
 *   - Tenant.heroImageUrl como fallback del carousel
 *
 * La historia está basada en el Club San Andrés real (Asociación Ex-Alumnos
 * San Andrés, Benavídez, Tigre), fundado el 9/5/1911 por ex alumnos de la
 * Escuela Escocesa San Andrés. Fuentes en el README del commit / Wikipedia.
 *
 * Las fotos del hero son de Unsplash (licencia libre, sin atribución
 * obligatoria) y se sirven por URL: no hace falta subir archivos al servidor.
 * El club puede reemplazarlas por fotos propias desde Admin → Branding.
 *
 * Uso:
 *   node scripts/contenido-web-sanandres.js            # dry-run
 *   node scripts/contenido-web-sanandres.js --apply
 *   DATABASE_URL="postgresql://...:5436/clubix_db" node scripts/contenido-web-sanandres.js --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')

const FECHA_FUNDACION = '1911-05-09'

// Fotos verificadas (HTTP 200, image/jpeg) en images.unsplash.com
const U = (id, w, h) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`
const HERO_IMAGES = [
  U('1501176395966-be7bab349695', 2400, 1350), // rugby en cancha embarrada — Quino Al
  U('1707495805525-d752b090c0c9', 2400, 1350), // hockey sobre césped — Claudio Schwarz
  U('1734158661120-a0605f0cee48', 2400, 1350), // hockey, acción en sintético — Lea Panaino
]
const IMAGEN_INTRO = U('1734158661120-a0605f0cee48', 1000, 1250) // 4/5 para la intro

const HISTORIA = {
  intro: {
    titulo: 'Nuestra Historia',
    tituloSeccion: 'Herencia escocesa',
    parrafos: [
      'Todo empieza en 1838, cuando un grupo de colonos escoceses funda la Escuela Escocesa San Andrés para educar a sus hijos en su idioma, su fe y su cultura. De ese colegio nace el primer club deportivo de la casa, el St. Andrew’s Athletic Club, que en 1891 se consagra campeón del primer torneo de Primera División organizado en la Argentina.',
      'El 9 de mayo de 1911 los ex alumnos fundan el club tal como lo conocemos, entonces llamado St. Andrew’s Former Pupil’s Club. Desde el primer día conviven el rugby, el hockey, la natación, el fútbol y la vela: un club de deporte amateur pensado como prolongación de la vida del colegio. En 1985 pasa a llamarse Asociación Ex-Alumnos San Andrés.',
      'Hoy la sede de Benavídez, en el partido de Tigre, es el corazón del club: rugby en la URBA, hockey femenino con líneas completas en la AHBA y una comunidad de familias que sostiene la misma idea de siempre. Somos, además, uno de los pocos clubes de Sudamérica con tartán propio, la marca de nuestro origen escocés.',
    ],
    imagen: IMAGEN_INTRO,
    badge: '+110',
    badgeTexto: 'años de historia',
  },
  hitos: [
    { anio: '1838', titulo: 'Nace la Escuela Escocesa San Andrés', descripcion: 'Un grupo de colonos escoceses funda el colegio para educar a sus hijos en su idioma, su fe y su cultura. De ahí saldría, décadas después, el club.' },
    { anio: '1891', titulo: 'Campeones del primer torneo argentino', descripcion: 'El St. Andrew’s Athletic Club, primer club deportivo del colegio, gana el primer campeonato de Primera División organizado en la Argentina. La institución se disolvería hacia 1894.' },
    { anio: '1911', titulo: 'Fundación del club', descripcion: 'El 9 de mayo los ex alumnos fundan el St. Andrew’s Former Pupil’s Club, con rugby, hockey, natación, fútbol y vela desde el primer día. Sidney Sanders es su primer presidente.' },
    { anio: '1985', titulo: 'Asociación Ex-Alumnos San Andrés', descripcion: 'El club adopta su nombre actual, reafirmando el vínculo con el colegio y con las generaciones de ex alumnos que lo sostienen.' },
    { anio: '2009', titulo: 'Ascenso al Top de la URBA', descripcion: 'El plantel superior de rugby asciende a la máxima categoría de la Unión de Rugby de Buenos Aires tras vencer 18-5 a Universitario de La Plata.' },
    { anio: '2017', titulo: 'Campeón de Segunda', descripcion: 'Tras años difíciles, San Andrés se consagra campeón de la Segunda división de la URBA con 24 partidos ganados y sólo 2 derrotas.' },
    { anio: '2018', titulo: 'Campeón de Primera C', descripcion: 'Segundo título consecutivo: el club gana la Primera C con un registro de 20 victorias y 6 caídas, y sigue escalando en el sistema de la URBA.' },
    { anio: 'Hoy', titulo: 'Rugby en Primera A y hockey en la AHBA', descripcion: 'El plantel de rugby compite en la Primera A de la URBA y el hockey femenino presenta tres líneas completas en los torneos de la AHBA, además de los equipos de promoción y proyección.' },
  ],
  palmares: [
    { titulo: 'Primera División (St. Andrew’s A.C.)', anios: '1891' },
    { titulo: 'Ascenso al Top de la URBA', anios: '2009' },
    { titulo: 'Campeón Segunda URBA', anios: '2017' },
    { titulo: 'Campeón Primera C URBA', anios: '2018' },
  ],
  formativas: [
    { categoria: 'Rugby infantiles', descripcion: 'De Escuelita a M14' },
    { categoria: 'Rugby juveniles', descripcion: 'De M15 a M18 y plantel superior' },
    { categoria: 'Hockey formativas', descripcion: 'De Mini Hockey a Sub 19' },
    { categoria: 'Hockey mayores', descripcion: 'Tres líneas completas en la AHBA' },
  ],
  valores: [
    { titulo: 'Tradición', descripcion: 'Casi dos siglos de herencia escocesa, y un tartán propio que nos identifica.' },
    { titulo: 'Espíritu amateur', descripcion: 'Se juega por el club y por el que está al lado, no por otra cosa.' },
    { titulo: 'Formación', descripcion: 'Del colegio a la cancha: primero personas, después jugadores.' },
    { titulo: 'Comunidad', descripcion: 'Familias, ex alumnos y socios sosteniendo el mismo proyecto desde 1911.' },
  ],
  cta: {
    titulo: 'Sumate a San Andrés',
    descripcion: 'Rugby, hockey y una comunidad con más de 110 años de historia.',
    textoBoton: 'Hacete socio',
    linkBoton: '/inscripcion-socio',
  },
}

async function main() {
  const [{ d: db, port }] = await prisma.$queryRaw`select current_database() as d, inet_server_port() as port`
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
  if (!tenant) {
    console.error(`❌ No existe el tenant "${SUBDOMAIN}" en ${db} (server port ${port})`)
    process.exitCode = 1
    return
  }
  const tenantId = tenant.id
  console.log(`Base   : ${db} (server port ${port})`)
  console.log(`Tenant : id=${tenantId} ${tenant.nombre}`)

  const historiaActual = await prisma.configuracion.findUnique({
    where: { tenantId_clave: { tenantId, clave: 'PAGINA_HISTORIA' } },
  })
  const heroActual = await prisma.tenantConfiguracion.findUnique({
    where: { tenantId_clave: { tenantId, clave: 'HERO_IMAGES' } },
  })
  console.log(`PAGINA_HISTORIA actual : ${historiaActual ? `${historiaActual.valor.length} chars` : '(sin definir)'}`)
  console.log(`HERO_IMAGES actual     : ${heroActual?.valor ?? '(sin definir)'}`)
  console.log(`heroImageUrl actual    : ${tenant.heroImageUrl ?? '(sin definir)'}`)
  console.log(`\nSe escribirán ${HISTORIA.hitos.length} hitos y ${HERO_IMAGES.length} imágenes de hero.`)

  if (!APPLY) {
    console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
    return
  }

  await prisma.configuracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'PAGINA_HISTORIA' } },
    create: { tenantId, clave: 'PAGINA_HISTORIA', valor: JSON.stringify(HISTORIA), tipo: 'JSON', modulo: 'CONTENIDO', descripcion: 'Contenido de la página Historia' },
    update: { valor: JSON.stringify(HISTORIA), tipo: 'JSON', modulo: 'CONTENIDO' },
  })
  console.log('✓ PAGINA_HISTORIA actualizada')

  await prisma.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'HERO_IMAGES' } },
    create: { tenantId, clave: 'HERO_IMAGES', valor: JSON.stringify(HERO_IMAGES), tipo: 'JSON', descripcion: 'Imágenes del carousel hero' },
    update: { valor: JSON.stringify(HERO_IMAGES) },
  })
  console.log(`✓ HERO_IMAGES actualizado (${HERO_IMAGES.length} fotos)`)

  await prisma.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'FECHA_FUNDACION' } },
    create: { tenantId, clave: 'FECHA_FUNDACION', valor: FECHA_FUNDACION, tipo: 'STRING', descripcion: 'Fecha de fundación del club' },
    update: { valor: FECHA_FUNDACION },
  })
  console.log(`✓ FECHA_FUNDACION = ${FECHA_FUNDACION}`)

  await prisma.tenant.update({ where: { id: tenantId }, data: { heroImageUrl: HERO_IMAGES[0] } })
  console.log('✓ heroImageUrl (fallback) actualizado')

  console.log('\n✅ Contenido del sitio público aplicado.')
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
