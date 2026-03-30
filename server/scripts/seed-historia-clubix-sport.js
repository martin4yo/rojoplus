/**
 * Seed: Historia y Valores — tenant clubix-sport
 *
 * Inserta contenido ficticio en la tabla configuracion para el tenant clubix-sport.
 * Uso:
 *   DATABASE_URL="postgresql://postgres:Q27G4B98@localhost:5434/clubix_db" \
 *   node --input-type=module scripts/seed-historia-clubix-sport.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONTENIDO = {
  intro: {
    titulo: 'Nuestra Historia',
    tituloSeccion: 'Verde y Orgullo',
    parrafos: [
      'El 12 de agosto de 1965, un grupo de vecinos del barrio Sur se reunió con un sueño: crear un club donde el deporte y la comunidad fueran uno solo. Así nació Clubix Sport, con colores verde y blanco que representan la esperanza y la unidad.',
      'A lo largo de seis décadas, miles de familias han formado parte de nuestra institución. Hoy somos un club multideportivo con más de 800 socios activos y presencia en torneos provinciales y nacionales en fútbol, básquet, vóley y natación.',
      'Nuestro predio del barrio Sur se convirtió en el corazón de la comunidad. Ser parte de Clubix Sport es ser parte de una familia que crece unida, dentro y fuera de la cancha.',
    ],
    imagen: '/images/club/default-historia.jpg',
    badge: '+58',
    badgeTexto: 'años de historia',
  },
  hitos: [
    {
      anio: '1965',
      titulo: 'Fundación',
      descripcion: 'El 12 de agosto de 1965, en una asamblea de 43 vecinos, nació oficialmente Clubix Sport con el objetivo de fomentar el deporte y la integración social en el barrio Sur.',
    },
    {
      anio: '1972',
      titulo: 'Primera sede propia',
      descripcion: 'Tras siete años de alquilar instalaciones, el club adquirió su primer predio propio de 5.000 m², que se convertiría en el corazón de la institución por generaciones.',
    },
    {
      anio: '1988',
      titulo: 'Campeón Provincial de Fútbol',
      descripcion: 'El equipo de primera división conquistó el campeonato provincial, el primer gran título de la historia del club e inicio de una era dorada en el fútbol regional.',
    },
    {
      anio: '2005',
      titulo: 'Inauguración del polideportivo',
      descripcion: 'Se inauguró el polideportivo cubierto de 1.200 m², que permitió sumar básquet, vóley y natación, transformando al club en una institución verdaderamente multideportiva.',
    },
    {
      anio: '2018',
      titulo: '800 socios activos',
      descripcion: 'El club alcanzó los 800 socios activos, consolidándose como uno de los clubes más importantes de la región y referente del deporte amateur.',
    },
    {
      anio: 'Hoy',
      titulo: '+58 Años de Trayectoria',
      descripcion: 'Seis décadas de historia, tradición y comunidad. Clubix Sport sigue creciendo con el compromiso de sus socios, dirigentes y toda la familia verde.',
    },
  ],
  palmares: [
    { titulo: 'Campeón Provincial Fútbol', anios: '1988, 1995, 2012' },
    { titulo: 'Torneo Regional Básquet', anios: '2009, 2017, 2023' },
    { titulo: 'Copa Verano Vóley', anios: '2019, 2022, 2024' },
    { titulo: 'Natación Categorías Formativas', anios: '2021, 2023, 2025' },
  ],
  formativas: [
    { categoria: 'Sub-15 Fútbol',    descripcion: 'Campeón regional 2023/24' },
    { categoria: 'Mini Básquet',     descripcion: 'Campeón provincial 2024' },
    { categoria: 'Natación Infantil', descripcion: 'Mejores marcas regionales 2024' },
    { categoria: 'Vóley Femenino',   descripcion: 'Campeón divisional 2024' },
  ],
  valores: [
    { titulo: 'Comunidad',    descripcion: 'Somos un punto de encuentro para familias de toda la región. El club es de todos y para todos.' },
    { titulo: 'Inclusión',    descripcion: 'Deportes y actividades para todas las edades y capacidades, sin distinción alguna.' },
    { titulo: 'Superación',   descripcion: 'Cada socio y cada deportista busca dar lo mejor de sí mismo cada día. El crecimiento es constante.' },
    { titulo: 'Tradición',    descripcion: 'Más de 58 años de historia nos respaldan. Somos parte del tejido social y cultural de nuestra ciudad.' },
  ],
  cta: {
    titulo: '¡Sumate a Clubix Sport!',
    descripcion: 'Formá parte de una institución con historia, tradición y un futuro brillante. ¡Más de 800 socios te esperan!',
    textoBoton: 'Quiero ser Socio',
    linkBoton: '/inscripcion-socio',
  },
}

async function main() {
  // Buscar el tenant clubix-sport
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'clubix-sport' },
    select: { id: true, nombre: true, slug: true },
  })

  if (!tenant) {
    console.error('❌ Tenant "clubix-sport" no encontrado en esta base de datos')
    process.exit(1)
  }

  console.log(`✅ Tenant encontrado: ${tenant.nombre} (id=${tenant.id})`)

  const clave = 'PAGINA_HISTORIA'

  await prisma.configuracion.upsert({
    where: { tenantId_clave: { tenantId: tenant.id, clave } },
    update: { valor: JSON.stringify(CONTENIDO) },
    create: {
      clave,
      valor: JSON.stringify(CONTENIDO),
      descripcion: 'Contenido editable de la página Historia y Valores',
      tipo: 'JSON',
      modulo: 'SITIO',
      tenantId: tenant.id,
    },
  })

  console.log(`✅ Contenido de Historia insertado para tenant "${tenant.slug}"`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
