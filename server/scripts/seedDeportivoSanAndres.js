/**
 * Estructura deportiva de prueba para el tenant "sanandres":
 *   1. 2 entrenadores (sobre las entidades de personal con cargo ENTRE),
 *      asignados a todas las categorías de Rugby y de Hockey respectivamente
 *   2. Tipos de espacio + 3 espacios: cancha de rugby, cancha de hockey y
 *      el Quincho (recreativo)
 *   3. Config de reservas por espacio, para habilitar el alquiler
 *
 * Idempotente: saltea lo que ya existe.
 *
 * Uso:
 *   node scripts/seedDeportivoSanAndres.js            # dry-run
 *   node scripts/seedDeportivoSanAndres.js --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')

// Se enganchan a las entidades de personal ya creadas (cargo ENTRE)
const ENTRENADORES = [
  {
    entidad: 'Vera, Diego', actividad: 'RUGBY', especialidad: 'Rugby — plantel superior y juveniles',
    bio: 'Ex jugador del club, entrenador de plantel superior. Nivel 2 de la UAR.',
    email: 'diego.vera@sanandres.test', tel: '11 5200-0001', orden: 1,
  },
  {
    entidad: 'Luna, Carolina', actividad: 'HOCKEY', especialidad: 'Hockey — formativas y primera',
    bio: 'Entrenadora nacional de hockey, a cargo de las divisiones formativas y primera.',
    email: 'carolina.luna@sanandres.test', tel: '11 5200-0002', orden: 2,
  },
]

const TIPOS_ESPACIO = [
  { codigo: 'CANCHA_RUGBY', nombre: 'Cancha de Rugby', orden: 1 },
  { codigo: 'CANCHA_HOCKEY', nombre: 'Cancha de Hockey', orden: 2 },
  { codigo: 'RECREATIVO', nombre: 'Espacio Recreativo', orden: 3 },
]

const ESPACIOS = [
  {
    codigo: 'RUGBY-1', nombre: 'Cancha de Rugby', tipoEspacio: 'CANCHA_RUGBY', tipo: 'CANCHA',
    capacidad: 30, cubierto: false, iluminacion: true,
    descripcion: 'Cancha principal de rugby con iluminación y tribuna.',
    actividad: 'RUGBY',
    reserva: { precioSocio: 45000, precioNoSocio: 75000, duracionSlotMin: 90 },
  },
  {
    codigo: 'HOCKEY-1', nombre: 'Cancha de Hockey', tipoEspacio: 'CANCHA_HOCKEY', tipo: 'CANCHA',
    capacidad: 24, cubierto: false, iluminacion: true,
    descripcion: 'Cancha de hockey de césped sintético con iluminación.',
    actividad: 'HOCKEY',
    reserva: { precioSocio: 40000, precioNoSocio: 68000, duracionSlotMin: 90 },
  },
  {
    codigo: 'QUINCHO', nombre: 'Quincho', tipoEspacio: 'RECREATIVO', tipo: 'RECREATIVO',
    capacidad: 60, cubierto: true, iluminacion: true,
    descripcion: 'Quincho con parrilla, mesas y baños. Para cumpleaños y eventos de socios.',
    reserva: { precioSocio: 90000, precioNoSocio: 150000, duracionSlotMin: 240, anticipacionMaxDias: 90 },
  },
]

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
  console.log(`A crear: ${ENTRENADORES.length} entrenadores, ${TIPOS_ESPACIO.length} tipos de espacio, ${ESPACIOS.length} espacios + su config de reserva`)

  if (!APPLY) {
    console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
    return
  }

  // ── 1. Entrenadores ────────────────────────────────────────────────
  for (const e of ENTRENADORES) {
    const entidad = await prisma.entidad.findFirst({ where: { tenantId, tipo: 'PERSONAL', razonSocial: e.entidad } })
    if (!entidad) {
      console.warn(`  ! No existe la entidad de personal "${e.entidad}" — se saltea`)
      continue
    }
    let entrenador = await prisma.entrenador.findFirst({ where: { tenantId, entidadId: entidad.id } })
    if (!entrenador) {
      entrenador = await prisma.entrenador.create({
        data: {
          tenantId,
          entidadId: entidad.id,
          especialidad: e.especialidad,
          activo: true,
          mostrarEnWeb: true,
          biografiaStaff: e.bio,
          emailPublico: e.email,
          telefonoPublico: e.tel,
          ordenStaff: e.orden,
        },
      })
      console.log(`✓ Entrenador ${e.entidad} (id=${entrenador.id})`)
    } else {
      console.log(`· Entrenador ${e.entidad} ya existía (id=${entrenador.id})`)
    }

    // Asignar a todas las categorías de su actividad
    const actividad = await prisma.actividad.findFirst({ where: { tenantId, codigo: e.actividad } })
    if (!actividad) {
      console.warn(`  ! No existe la actividad ${e.actividad} — no se asignan categorías`)
      continue
    }
    const categorias = await prisma.categoriaActividad.findMany({ where: { tenantId, actividadId: actividad.id } })
    let asignadas = 0
    for (const cat of categorias) {
      const ya = await prisma.entrenadorCategoria.findFirst({
        where: { tenantId, entrenadorId: entrenador.id, categoriaActividadId: cat.id },
      })
      if (ya) continue
      await prisma.entrenadorCategoria.create({
        data: { tenantId, entrenadorId: entrenador.id, categoriaActividadId: cat.id, rol: 'ENTRENADOR', activo: true },
      })
      asignadas++
    }
    console.log(`  → ${e.actividad}: ${asignadas} categorías asignadas (de ${categorias.length})`)
  }

  // ── 2. Tipos de espacio + espacios ─────────────────────────────────
  const tipos = {}
  for (const t of TIPOS_ESPACIO) {
    tipos[t.codigo] = await prisma.tipoEspacio.findFirst({ where: { tenantId, codigo: t.codigo } })
      ?? await prisma.tipoEspacio.create({ data: { ...t, tenantId, activo: true } })
  }
  console.log(`✓ Tipos de espacio: ${Object.keys(tipos).join(', ')}`)

  for (const es of ESPACIOS) {
    let espacio = await prisma.espacioDeportivo.findFirst({ where: { tenantId, codigo: es.codigo } })
    if (!espacio) {
      espacio = await prisma.espacioDeportivo.create({
        data: {
          tenantId,
          codigo: es.codigo,
          nombre: es.nombre,
          tipo: es.tipo,
          tipoEspacioId: tipos[es.tipoEspacio].id,
          capacidad: es.capacidad,
          cubierto: es.cubierto,
          iluminacion: es.iluminacion,
          descripcion: es.descripcion,
          activo: true,
        },
      })
      console.log(`✓ Espacio ${es.nombre} (${es.codigo})`)
    } else {
      console.log(`· Espacio ${es.codigo} ya existía`)
    }

    // Vincular el espacio con su actividad, para la agenda de entrenamientos
    if (es.actividad) {
      const actividad = await prisma.actividad.findFirst({ where: { tenantId, codigo: es.actividad } })
      if (actividad) {
        await prisma.espacioDeportivo.update({
          where: { id: espacio.id },
          data: { actividades: { connect: { id: actividad.id } } },
        })
        console.log(`  → vinculado a la actividad ${es.actividad}`)
      }
    }

    // ── 3. Config de reserva (habilita el alquiler) ──────────────────
    const yaConfig = await prisma.configReservaEspacio.findFirst({ where: { tenantId, espacioId: espacio.id } })
    if (!yaConfig) {
      await prisma.configReservaEspacio.create({
        data: {
          tenantId,
          espacioId: espacio.id,
          duracionSlotMin: es.reserva.duracionSlotMin,
          cuposSimultaneos: 1,
          anticipacionMinHs: 2,
          anticipacionMaxDias: es.reserva.anticipacionMaxDias ?? 30,
          modoPrecio: 'FIJO',
          precioBase: es.reserva.precioNoSocio,
          precioSocio: es.reserva.precioSocio,
          precioNoSocio: es.reserva.precioNoSocio,
          politicaCancelacionHs: 24,
          permiteCancelacionOnline: true,
          activo: true,
        },
      })
      console.log(`  → alquiler habilitado: socio $${es.reserva.precioSocio} / no socio $${es.reserva.precioNoSocio} por ${es.reserva.duracionSlotMin} min`)
    } else {
      console.log(`  · ya tenía config de reserva`)
    }
  }

  console.log('\n✅ Estructura deportiva creada.')
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
