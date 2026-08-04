/**
 * Setup completo del tenant "sanandres" — Club San Andres.
 *
 * Crea:
 *   - Tenant + branding (paleta azul oscuro) + logo
 *   - Admin (admin@sanandres.com / admin123) con rol ADMIN
 *   - Estructura: cuentas contables, centros de costo, conceptos de tesorería,
 *     medios de pago, tipos/categorías/estados de socio, configuraciones
 *   - 2 actividades: Rugby (masculino) y Hockey (femenino) con sus categorías
 *   - Período actual abierto
 *   - 30 socios aleatorios:
 *       · 10 varones inscriptos en Rugby
 *       · 10 mujeres inscriptas en Hockey
 *       ·  5 varones y 5 mujeres sin actividad
 *
 * Uso:
 *   node scripts/setup-sanandres.js          # toma DATABASE_URL de server/.env
 *   DATABASE_URL="postgresql://..." node scripts/setup-sanandres.js
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const prisma = new PrismaClient()

const SUBDOMAIN = 'sanandres'
const NOMBRE = 'Club San Andres'
const ADMIN_EMAIL = 'admin@sanandres.com'
const ADMIN_PASS = 'admin123'
const CIUDAD = 'Pilar'
const PROVINCIA = 'Buenos Aires'
const DIRECCION = 'Av. San Andrés 2450'
const TELEFONO = '+54 9 11 5566-7788'

// Paleta azul oscuro (navy). Las claves son las que consume applyTheme()
// en client/src/contexts/TenantContext.jsx
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_SRC = path.resolve(__dirname, '..', '..', 'LogoSanAndres.jpg')
// server/uploads es lo que sirve express.static en /uploads (ver src/index.js).
// Ojo: existe también un uploads/ en la raíz del repo que NO se sirve.
const UPLOADS_TENANTS = path.resolve(__dirname, '..', 'uploads', 'tenants')

// ── helpers aleatorios ──────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rnd(arr.length)]
const sinAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const HOY = new Date()

/** Fecha de nacimiento aleatoria para una edad dada (día/mes al azar). */
function fechaNacPara(edad) {
  return new Date(HOY.getFullYear() - edad, rnd(12), 1 + rnd(27))
}

/** DNI plausible según la edad (más viejo → número más bajo). */
function documentoPara(edad) {
  const base = 46000000 - (edad * 700000)
  return String(base + rnd(700000))
}

const celular = () => `11${Math.floor(40000000 + Math.random() * 9000000)}`

const CALLES = ['Belgrano', 'San Martín', 'Rivadavia', 'Mitre', 'Sarmiento', 'Las Heras', 'Alvear', 'Perón', 'Los Robles', 'Del Valle']

async function main() {
  // 1) Admin ---------------------------------------------------------
  let admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    const rolAdmin = await prisma.rol.findFirst({ where: { codigo: 'ADMIN' } })
    admin = await prisma.admin.create({
      data: {
        nombre: 'Admin',
        apellido: 'Club San Andres',
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ADMIN_PASS, 12),
        activo: true,
        rolId: rolAdmin?.id ?? null,
      },
    })
    console.log(`✓ Admin creado id=${admin.id} (${ADMIN_EMAIL} / ${ADMIN_PASS}) rol=${rolAdmin?.codigo ?? 'SIN ROL'}`)
  } else {
    console.log(`✓ Admin existente id=${admin.id} (${ADMIN_EMAIL})`)
  }

  // 2) Tenant --------------------------------------------------------
  // Si ya existe (ej: creado a mano desde el panel super-admin en otro entorno)
  // lo reutilizamos y sólo completamos los campos que están vacíos, para no
  // pisar lo que haya cargado el club.
  const DATOS_TENANT = {
    nombre: NOMBRE,
    email: 'contacto@sanandres.com',
    telefono: TELEFONO,
    direccion: DIRECCION,
    ciudad: CIUDAD,
    provincia: PROVINCIA,
    codigoPostal: '1629',
    descripcion: 'Club deportivo dedicado al rugby masculino y al hockey femenino, con formación desde infantiles hasta primera división.',
    slogan: 'Orgullo azul.',
    horarios: 'Lunes a viernes 9:00-22:00 · Sábados y domingos 9:00-20:00',
    redesSociales: {
      instagram: '@clubsanandres',
      facebook: 'ClubSanAndresOK',
      twitter: '@clubsanandres',
    },
    colores: COLORS,
    razonSocial: 'Asociación Civil Club San Andres',
    condicionIva: 'EXENTO',
  }
  const vacio = (v) => v === null || v === undefined || v === '' ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

  let tenant = await prisma.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
  if (tenant) {
    const faltantes = Object.fromEntries(Object.entries(DATOS_TENANT).filter(([k]) => vacio(tenant[k])))
    if (Object.keys(faltantes).length) {
      tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: faltantes })
      console.log(`✓ Tenant existente id=${tenant.id} — completados campos vacíos: ${Object.keys(faltantes).join(', ')}`)
    } else {
      console.log(`✓ Tenant existente id=${tenant.id} — sin campos vacíos que completar`)
    }
  } else {
    tenant = await prisma.tenant.create({
      data: {
        ...DATOS_TENANT,
        subdomain: SUBDOMAIN,
        slug: SUBDOMAIN,
        plan: 'STANDARD',
        maxSocios: 500,
        maxAdmins: 5,
        estado: 'ACTIVO',
        activo: true,
        fechaAprobacion: new Date(),
        timezone: 'America/Argentina/Buenos_Aires',
        moneda: 'ARS',
      },
    })
    console.log(`✓ Tenant creado id=${tenant.id} (${NOMBRE} / ${SUBDOMAIN}) — paleta azul oscuro`)
  }
  const tenantId = tenant.id

  // 3) Logo ----------------------------------------------------------
  // Sólo si el tenant no tiene logo y el archivo está disponible localmente.
  // Ojo: en un entorno remoto el archivo tiene que existir en ESE servidor.
  if (tenant.logoUrl) {
    console.log(`✓ Logo ya configurado (${tenant.logoUrl}) — se respeta`)
  } else if (fs.existsSync(LOGO_SRC)) {
    try {
      if (!fs.existsSync(UPLOADS_TENANTS)) fs.mkdirSync(UPLOADS_TENANTS, { recursive: true })
      const dst = path.join(UPLOADS_TENANTS, `tenant-${tenantId}-logo.jpg`)
      fs.copyFileSync(LOGO_SRC, dst)
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: `/uploads/tenants/tenant-${tenantId}-logo.jpg`, faviconUrl: `/uploads/tenants/tenant-${tenantId}-logo.jpg` },
      })
      console.log(`✓ Logo copiado → /uploads/tenants/tenant-${tenantId}-logo.jpg`)
    } catch (e) {
      console.warn(`! No se pudo copiar el logo: ${e.message}`)
    }
  } else {
    console.warn(`! No se encontró el logo en ${LOGO_SRC} — el tenant queda sin logo.`)
  }

  // 4) Vincular admin al tenant --------------------------------------
  const vinculo = await prisma.tenantUsuario.findUnique({
    where: { tenantId_adminId: { tenantId, adminId: admin.id } },
  })
  if (vinculo) {
    console.log('✓ Admin ya vinculado al tenant')
  } else {
    await prisma.tenantUsuario.create({ data: { tenantId, adminId: admin.id, rol: 'ADMIN' } })
    console.log('✓ Admin vinculado al tenant')
  }

  // 5..8
  await inicializarEstructura(tenantId)
  const actividades = await crearActividades(tenantId)
  await crearSocios(tenantId, actividades)

  console.log('\n✅ Setup completo. Acceso:')
  console.log(`   - URL  : http://${SUBDOMAIN}.clubix.localhost:5173`)
  console.log(`   - Email: ${ADMIN_EMAIL}`)
  console.log(`   - Pass : ${ADMIN_PASS}`)
}

// ────────────────────────────────────────────────────────────────────
// Estructura: cuentas, centros, conceptos, medios, tipos de socio
// ────────────────────────────────────────────────────────────────────
/** Ejecuta `fn` sólo si el tenant no tiene todavía registros de ese modelo. */
async function siVacia(model, tenantId, label, fn) {
  const n = await prisma[model].count({ where: { tenantId } })
  if (n > 0) {
    console.log(`  · ${label}: ya hay ${n} — se omite`)
    return false
  }
  await fn()
  return true
}

async function inicializarEstructura(tenantId) {
  console.log('\n\u2192 Inicializando estructura...')

  // Plan de cuentas
  await siVacia('cuentaContable', tenantId, 'Cuentas contables', async () => {
    const [activo, pasivo, patrimonio, ingresos, egresos] = await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1', nombre: 'ACTIVO', tipo: 'ACTIVO', nivel: 1, esImputable: false, orden: 1 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2', nombre: 'PASIVO', tipo: 'PASIVO', nivel: 1, esImputable: false, orden: 2 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '3', nombre: 'PATRIMONIO NETO', tipo: 'PATRIMONIO', nivel: 1, esImputable: false, orden: 3 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, esImputable: false, orden: 4 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, esImputable: false, orden: 5 } }),
    ])
    const [activoCte, pasivoCte] = await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1', nombre: 'Activo Corriente', tipo: 'ACTIVO', nivel: 2, padreId: activo.id, esImputable: false, orden: 10 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2.1', nombre: 'Pasivo Corriente', tipo: 'PASIVO', nivel: 2, padreId: pasivo.id, esImputable: false, orden: 20 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '3.1', nombre: 'Capital Social', tipo: 'PATRIMONIO', nivel: 2, padreId: patrimonio.id, esImputable: true, orden: 30 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.1', nombre: 'Cuotas Sociales', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 40 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.2', nombre: 'Actividades Deportivas', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 41 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.3', nombre: 'Buffet', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 42 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '4.4', nombre: 'Mora y Recargos', tipo: 'INGRESO', nivel: 2, padreId: ingresos.id, esImputable: true, orden: 43 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.1', nombre: 'Sueldos y Jornales', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 50 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.2', nombre: 'Servicios', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 51 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.3', nombre: 'Mantenimiento', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 52 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '5.9', nombre: 'Otros Egresos', tipo: 'EGRESO', nivel: 2, padreId: egresos.id, esImputable: true, orden: 59 } }),
    ])
    await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.1', nombre: 'Caja', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 100 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.2', nombre: 'Bancos', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 101 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.3', nombre: 'Deudores por Cuotas', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 102 } }),
    ])
    const deudasSociales = await prisma.cuentaContable.create({
      data: { tenantId, codigo: '2.1.3', nombre: 'Deudas Sociales', tipo: 'PASIVO', nivel: 3, padreId: pasivoCte.id, esImputable: false, orden: 23 },
    })
    await Promise.all([
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2.1.3.01', nombre: 'Sueldos a Pagar', tipo: 'PASIVO', nivel: 4, padreId: deudasSociales.id, esImputable: true, orden: 230 } }),
      prisma.cuentaContable.create({ data: { tenantId, codigo: '2.1.3.02', nombre: 'Cargas Sociales a Pagar', tipo: 'PASIVO', nivel: 4, padreId: deudasSociales.id, esImputable: true, orden: 231 } }),
    ])
    console.log('  \u2713 Cuentas contables (22)')
  })

  // Centros de costo
  await siVacia('centroCosto', tenantId, 'Centros de costo', async () => {
    await prisma.centroCosto.createMany({
      data: [
        { tenantId, codigo: 'ADM', nombre: 'Administraci\u00f3n', orden: 1 },
        { tenantId, codigo: 'RUGBY', nombre: 'Rugby', orden: 2 },
        { tenantId, codigo: 'HOCKEY', nombre: 'Hockey', orden: 3 },
        { tenantId, codigo: 'BUFFET', nombre: 'Buffet', orden: 4 },
        { tenantId, codigo: 'EVENTOS', nombre: 'Eventos', orden: 5 },
      ],
    })
    console.log('  \u2713 Centros de costo (5)')
  })

  // Conceptos de tesorer\u00eda
  await siVacia('conceptoTesoreria', tenantId, 'Conceptos de tesorer\u00eda', async () => {
    await prisma.conceptoTesoreria.createMany({
      data: [
        { tenantId, codigo: 'COB-CUO', nombre: 'Cobranza de Cuotas', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 1 },
        { tenantId, codigo: 'COB-ACT', nombre: 'Cobranza Actividades', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 2 },
        { tenantId, codigo: 'ING-MORA', nombre: 'Ingresos por Mora', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 3 },
        { tenantId, codigo: 'ING-BUF', nombre: 'Ingresos Buffet', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: true, usaEnCompras: false, orden: 4 },
        { tenantId, codigo: 'OTR-ING', nombre: 'Otros Ingresos', tipo: 'INGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 5 },
        { tenantId, codigo: 'SUE', nombre: 'Sueldos y Jornales', tipo: 'EGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 6 },
        { tenantId, codigo: 'SERV', nombre: 'Servicios', tipo: 'EGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true, orden: 7 },
        { tenantId, codigo: 'MAN', nombre: 'Mantenimiento', tipo: 'EGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true, orden: 8 },
        { tenantId, codigo: 'COM', nombre: 'Compras', tipo: 'EGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: true, orden: 9 },
        { tenantId, codigo: 'OTR-EGR', nombre: 'Otros Egresos', tipo: 'EGRESO', usaEnTesoreria: true, usaEnVentas: false, usaEnCompras: false, orden: 10 },
      ],
    })
    console.log('  \u2713 Conceptos de tesorer\u00eda (10)')
  })

  const cobCuo = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-CUO' } })
  const cobAct = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-ACT' } })
  const ingMora = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-MORA' } })

  // Medios de pago
  await siVacia('medioPago', tenantId, 'Medios de pago', async () => {
    await prisma.medioPago.createMany({
      data: [
        { tenantId, codigo: 'EFECTIVO', nombre: 'Efectivo', tipo: 'EFECTIVO', activo: true, orden: 1 },
        { tenantId, codigo: 'TRANSFERENCIA', nombre: 'Transferencia', tipo: 'TRANSFERENCIA', activo: true, orden: 2 },
        { tenantId, codigo: 'DEBITO', nombre: 'Tarjeta D\u00e9bito', tipo: 'TARJETA', activo: true, orden: 3 },
        { tenantId, codigo: 'CREDITO', nombre: 'Tarjeta Cr\u00e9dito', tipo: 'TARJETA', activo: true, orden: 4 },
        { tenantId, codigo: 'MERCADOPAGO', nombre: 'MercadoPago', tipo: 'DIGITAL', activo: true, orden: 5 },
      ],
    })
    console.log('  \u2713 Medios de pago (5)')
  })

  // Tipos de socio
  await siVacia('tipoSocio', tenantId, 'Tipos de socio', async () => {
    await prisma.tipoSocio.createMany({
      data: [
        { tenantId, codigo: 'ACTIVO', nombre: 'Socio Activo', descripcion: 'Socio mayor de edad', cuotaMensual: 16000, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'blue', orden: 1 },
        { tenantId, codigo: 'CADETE', nombre: 'Socio Cadete', descripcion: 'Menor de 18 a\u00f1os', cuotaMensual: 9000, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'cyan', orden: 2 },
        { tenantId, codigo: 'VITALICIO', nombre: 'Socio Vitalicio', descripcion: 'Sin cargo mensual', cuotaMensual: 0, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'gold', orden: 3 },
        { tenantId, codigo: 'ADHERENTE', nombre: 'Socio Adherente', descripcion: 'Sin acceso a instalaciones', cuotaMensual: 8000, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'gray', orden: 4 },
      ],
    })
    console.log('  \u2713 Tipos de socio (4)')
  })

  // Categor\u00edas de socio
  await siVacia('categoriaSocio', tenantId, 'Categor\u00edas de socio', async () => {
    await prisma.categoriaSocio.createMany({
      data: [
        { tenantId, codigo: 'REGULAR', nombre: 'Regular', porcentajeDescuento: 0, orden: 1 },
        { tenantId, codigo: 'JUBILADO', nombre: 'Jubilado', porcentajeDescuento: 50, orden: 2 },
        { tenantId, codigo: 'BECADO', nombre: 'Becado', porcentajeDescuento: 100, orden: 3 },
        { tenantId, codigo: 'PERSONAL', nombre: 'Personal del Club', porcentajeDescuento: 100, orden: 4 },
      ],
    })
    console.log('  \u2713 Categor\u00edas de socio (4)')
  })

  // Estados de socio
  await siVacia('estadoSocio', tenantId, 'Estados de socio', async () => {
    await prisma.estadoSocio.createMany({
      data: [
        { tenantId, codigo: 'VIGENTE', nombre: 'Vigente', color: '#16a34a', permiteDescuentos: true, permiteIngresoMolinete: true, esSocioActivo: true, rolVigencia: 'AL_DIA', orden: 1 },
        { tenantId, codigo: 'BLOQUEADO', nombre: 'Bloqueado por Morosidad', color: '#9333ea', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: false, rolVigencia: 'BLOQUEADO', orden: 2 },
        { tenantId, codigo: 'SUSPENDIDO', nombre: 'Suspendido', color: '#d97706', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: true, rolVigencia: null, orden: 3 },
        { tenantId, codigo: 'BAJA', nombre: 'Baja', color: '#dc2626', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: false, rolVigencia: null, orden: 4 },
      ],
    })
    console.log('  \u2713 Estados de socio (4)')
  })

  // Configuraciones b\u00e1sicas
  await siVacia('configuracion', tenantId, 'Configuraciones', async () => {
    await prisma.configuracion.createMany({
      data: [
        { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS', valor: String(cobCuo.id), tipo: 'INTEGER', modulo: 'TESORERIA' },
        { tenantId, clave: 'CONCEPTO_COBRANZA_ACTIVIDADES', valor: String(cobAct.id), tipo: 'INTEGER', modulo: 'TESORERIA' },
        { tenantId, clave: 'CONCEPTO_MORA', valor: String(ingMora.id), tipo: 'INTEGER', modulo: 'TESORERIA' },
        { tenantId, clave: 'DIA_CORTE_CUOTAS', valor: '20', tipo: 'INTEGER', modulo: 'CUOTAS' },
        { tenantId, clave: 'SOCIO_NRO_MIN', valor: '100', tipo: 'INTEGER', modulo: 'SOCIOS' },
        { tenantId, clave: 'SOCIO_NRO_MAX', valor: '9999', tipo: 'INTEGER', modulo: 'SOCIOS' },
        { tenantId, clave: 'MOROSIDAD_BLOQUEO_AUTO_ACTIVO', valor: 'false', tipo: 'BOOLEAN', modulo: 'MOROSIDAD' },
        { tenantId, clave: 'MOROSIDAD_DIAS_GRACIA', valor: '5', tipo: 'INTEGER', modulo: 'MOROSIDAD' },
        { tenantId, clave: 'CLUB_NOMBRE', valor: NOMBRE, tipo: 'STRING', modulo: 'GENERAL' },
        { tenantId, clave: 'CLUB_DIRECCION', valor: `${DIRECCION}, ${CIUDAD}`, tipo: 'STRING', modulo: 'GENERAL' },
        { tenantId, clave: 'CLUB_TELEFONO', valor: TELEFONO, tipo: 'STRING', modulo: 'GENERAL' },
      ],
    })
    console.log('  \u2713 Configuraciones (11)')
  })

  // Tesorer\u00eda m\u00ednima con la que operar
  await prisma.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS' } },
    create: { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS', valor: String(cobCuo.id), tipo: 'STRING' },
    update: {},
  })
  await prisma.tenantConfiguracion.upsert({
    where: { tenantId_clave: { tenantId, clave: 'CONCEPTO_MORA' } },
    create: { tenantId, clave: 'CONCEPTO_MORA', valor: String(ingMora.id), tipo: 'STRING' },
    update: {},
  })
}

// ────────────────────────────────────────────────────────────────────
// Actividades: Rugby (masculino) y Hockey (femenino)
// ────────────────────────────────────────────────────────────────────
async function crearActividades(tenantId) {
  console.log('\n→ Creando actividades Rugby y Hockey...')

  const ccRugby = await prisma.centroCosto.findFirst({ where: { tenantId, codigo: 'RUGBY' } })
  const ccHockey = await prisma.centroCosto.findFirst({ where: { tenantId, codigo: 'HOCKEY' } })
  const cobAct = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-ACT' } })
  const ingMora = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-MORA' } })

  const rugby = await prisma.actividad.findFirst({ where: { tenantId, codigo: 'RUGBY' } }) ?? await prisma.actividad.create({
    data: {
      tenantId,
      codigo: 'RUGBY',
      nombre: 'Rugby',
      descripcion: 'Rugby masculino: divisiones formativas, juveniles, intermedia y primera.',
      requiereAptaFisica: true,
      cuotaMensual: 14000,
      color: '#1E3A8A',
      activo: true,
      orden: 1,
      centroCostoId: ccRugby?.id ?? null,
      conceptoTesoreriaId: cobAct?.id ?? null,
      conceptoMoraId: ingMora?.id ?? null,
    },
  })

  // Categorías de Rugby (criterio UAR / URBA)
  const catsRugby = [
    { codigo: 'RUG-ESCUELITA', nombre: 'Escuelita', descripcion: 'Iniciación al rugby, sin contacto', edadMinima: 5, edadMaxima: 7, cuotaMensual: 10000, orden: 1 },
    { codigo: 'RUG-M8', nombre: 'M8', descripcion: 'Sub 8', edadMinima: 8, edadMaxima: 8, cuotaMensual: 11000, orden: 2 },
    { codigo: 'RUG-M10', nombre: 'M10', descripcion: 'Sub 10', edadMinima: 9, edadMaxima: 10, cuotaMensual: 12000, orden: 3 },
    { codigo: 'RUG-M12', nombre: 'M12', descripcion: 'Sub 12', edadMinima: 11, edadMaxima: 12, cuotaMensual: 12000, orden: 4 },
    { codigo: 'RUG-M14', nombre: 'M14', descripcion: 'Sub 14', edadMinima: 13, edadMaxima: 14, cuotaMensual: 13000, orden: 5 },
    { codigo: 'RUG-M16', nombre: 'M16', descripcion: 'Sub 16 (juveniles)', edadMinima: 15, edadMaxima: 16, cuotaMensual: 14000, orden: 6 },
    { codigo: 'RUG-M18', nombre: 'M18', descripcion: 'Sub 18 (juveniles)', edadMinima: 17, edadMaxima: 18, cuotaMensual: 14000, orden: 7 },
    { codigo: 'RUG-INTER', nombre: 'Intermedia', descripcion: 'Plantel intermedio', edadMinima: 19, edadMaxima: 25, cuotaMensual: 15000, orden: 8 },
    { codigo: 'RUG-PRIMERA', nombre: 'Primera', descripcion: 'Primera división', edadMinima: 19, edadMaxima: 34, cuotaMensual: 15000, orden: 9 },
    { codigo: 'RUG-VETERANOS', nombre: 'Veteranos', descripcion: 'Veteranos (35+)', edadMinima: 35, edadMaxima: null, cuotaMensual: 12000, orden: 10 },
  ]
  const yaRugby = await prisma.categoriaActividad.count({ where: { tenantId, actividadId: rugby.id } })
  if (yaRugby > 0) {
    console.log(`  · Rugby: ya tiene ${yaRugby} categorías — se omite`)
  } else {
    await prisma.categoriaActividad.createMany({
      data: catsRugby.map(c => ({ ...c, tenantId, actividadId: rugby.id, sexo: 'MASCULINO', activo: true, conceptoTesoreriaId: cobAct?.id ?? null })),
    })
    console.log(`  ✓ Rugby + ${catsRugby.length} categorías`)
  }

  const hockey = await prisma.actividad.findFirst({ where: { tenantId, codigo: 'HOCKEY' } }) ?? await prisma.actividad.create({
    data: {
      tenantId,
      codigo: 'HOCKEY',
      nombre: 'Hockey',
      descripcion: 'Hockey sobre césped femenino: desde mini hockey hasta primera y mami hockey.',
      requiereAptaFisica: true,
      cuotaMensual: 14000,
      color: '#38BDF8',
      activo: true,
      orden: 2,
      centroCostoId: ccHockey?.id ?? null,
      conceptoTesoreriaId: cobAct?.id ?? null,
      conceptoMoraId: ingMora?.id ?? null,
    },
  })

  // Categorías de Hockey (criterio Confederación Argentina de Hockey)
  const catsHockey = [
    { codigo: 'HOC-MINI', nombre: 'Mini Hockey', descripcion: 'Iniciación, palo y pelota', edadMinima: 5, edadMaxima: 8, cuotaMensual: 10000, orden: 1 },
    { codigo: 'HOC-SUB10', nombre: 'Sub 10', descripcion: 'Categoría sub 10', edadMinima: 9, edadMaxima: 10, cuotaMensual: 11000, orden: 2 },
    { codigo: 'HOC-SUB12', nombre: 'Sub 12', descripcion: 'Categoría sub 12', edadMinima: 11, edadMaxima: 12, cuotaMensual: 12000, orden: 3 },
    { codigo: 'HOC-SUB14', nombre: 'Sub 14', descripcion: 'Categoría sub 14', edadMinima: 13, edadMaxima: 14, cuotaMensual: 13000, orden: 4 },
    { codigo: 'HOC-SUB16', nombre: 'Sub 16', descripcion: 'Categoría sub 16', edadMinima: 15, edadMaxima: 16, cuotaMensual: 14000, orden: 5 },
    { codigo: 'HOC-SUB19', nombre: 'Sub 19', descripcion: 'Categoría sub 19', edadMinima: 17, edadMaxima: 19, cuotaMensual: 14000, orden: 6 },
    { codigo: 'HOC-INTER', nombre: 'Intermedia', descripcion: 'Plantel intermedio', edadMinima: 20, edadMaxima: 25, cuotaMensual: 14000, orden: 7 },
    { codigo: 'HOC-PRIMERA', nombre: 'Primera', descripcion: 'Primera división', edadMinima: 20, edadMaxima: 34, cuotaMensual: 15000, orden: 8 },
    { codigo: 'HOC-MAMI', nombre: 'Mami Hockey', descripcion: 'Hockey recreativo (35+)', edadMinima: 35, edadMaxima: 44, cuotaMensual: 11000, orden: 9 },
    { codigo: 'HOC-VETERANAS', nombre: 'Veteranas', descripcion: 'Veteranas (45+)', edadMinima: 45, edadMaxima: null, cuotaMensual: 10000, orden: 10 },
  ]
  const yaHockey = await prisma.categoriaActividad.count({ where: { tenantId, actividadId: hockey.id } })
  if (yaHockey > 0) {
    console.log(`  · Hockey: ya tiene ${yaHockey} categorías — se omite`)
  } else {
    await prisma.categoriaActividad.createMany({
      data: catsHockey.map(c => ({ ...c, tenantId, actividadId: hockey.id, sexo: 'FEMENINO', activo: true, conceptoTesoreriaId: cobAct?.id ?? null })),
    })
    console.log(`  ✓ Hockey + ${catsHockey.length} categorías`)
  }

  return { rugbyId: rugby.id, hockeyId: hockey.id, ccRugbyId: ccRugby?.id ?? null, ccHockeyId: ccHockey?.id ?? null }
}

// ────────────────────────────────────────────────────────────────────
// 30 socios: 10 varones rugby, 10 mujeres hockey, 5 + 5 sin actividad
// ────────────────────────────────────────────────────────────────────
async function crearSocios(tenantId, act) {
  console.log('\n→ Creando período y 30 socios...')

  const yaSocios = await prisma.socio.count({ where: { tenantId } })
  if (yaSocios > 0) {
    console.log(`  · El tenant ya tiene ${yaSocios} socios — se omite la carga`)
    return
  }

  const periodo = await prisma.periodo.findFirst({ where: { tenantId, anio: HOY.getFullYear(), mes: HOY.getMonth() + 1 } }) ?? await prisma.periodo.create({
    data: {
      tenantId,
      nombre: `${String(HOY.getMonth() + 1).padStart(2, '0')}/${HOY.getFullYear()}`,
      mes: HOY.getMonth() + 1,
      anio: HOY.getFullYear(),
      fechaVencimiento: new Date(HOY.getFullYear(), HOY.getMonth(), 10),
      estado: 'ABIERTO',
    },
  })
  console.log(`  ✓ Período ${periodo.nombre} (id=${periodo.id})`)

  const tipoActivo = await prisma.tipoSocio.findFirst({ where: { tenantId, codigo: 'ACTIVO' } })
  const tipoCadete = await prisma.tipoSocio.findFirst({ where: { tenantId, codigo: 'CADETE' } })
  const catRegular = await prisma.categoriaSocio.findFirst({ where: { tenantId, codigo: 'REGULAR' } })
  const estVigente = await prisma.estadoSocio.findFirst({ where: { tenantId, codigo: 'VIGENTE' } })

  const catsRugby = await prisma.categoriaActividad.findMany({ where: { tenantId, actividadId: act.rugbyId }, orderBy: { orden: 'asc' } })
  const catsHockey = await prisma.categoriaActividad.findMany({ where: { tenantId, actividadId: act.hockeyId }, orderBy: { orden: 'asc' } })

  /** Devuelve la categoría cuya franja etaria contiene la edad. */
  const categoriaParaEdad = (cats, edad) =>
    cats.find(c => edad >= (c.edadMinima ?? 0) && edad <= (c.edadMaxima ?? 200))

  // Nombres: 10 varones rugby, 10 mujeres hockey, 5 varones y 5 mujeres sin actividad.
  // Las edades cubren todo el abanico de categorías de cada deporte.
  const varonesRugby = [
    { apellido: 'Aguirre', nombre: 'Bautista', edad: 7 },
    { apellido: 'Benítez', nombre: 'Thiago', edad: 8 },
    { apellido: 'Cáceres', nombre: 'Lorenzo', edad: 10 },
    { apellido: 'Domínguez', nombre: 'Ramiro', edad: 12 },
    { apellido: 'Escobar', nombre: 'Valentín', edad: 14 },
    { apellido: 'Ferreyra', nombre: 'Gonzalo', edad: 16 },
    { apellido: 'Guzmán', nombre: 'Tomás', edad: 18 },
    { apellido: 'Herrera', nombre: 'Nicolás', edad: 22 },
    { apellido: 'Ibarra', nombre: 'Facundo', edad: 28 },
    { apellido: 'Juárez', nombre: 'Martín', edad: 38 },
  ]
  const mujeresHockey = [
    { apellido: 'Krause', nombre: 'Emma', edad: 7 },
    { apellido: 'Ledesma', nombre: 'Catalina', edad: 9 },
    { apellido: 'Maidana', nombre: 'Renata', edad: 11 },
    { apellido: 'Navarro', nombre: 'Julieta', edad: 13 },
    { apellido: 'Ojeda', nombre: 'Delfina', edad: 15 },
    { apellido: 'Paredes', nombre: 'Morena', edad: 18 },
    { apellido: 'Quiroga', nombre: 'Agustina', edad: 21 },
    { apellido: 'Rearte', nombre: 'Milagros', edad: 26 },
    { apellido: 'Sosa', nombre: 'Victoria', edad: 39 },
    { apellido: 'Toledo', nombre: 'Gabriela', edad: 47 },
  ]
  const varonesSinActividad = [
    { apellido: 'Urquiza', nombre: 'Alejandro', edad: 34 },
    { apellido: 'Vallejos', nombre: 'Rubén', edad: 41 },
    { apellido: 'Wagner', nombre: 'Esteban', edad: 49 },
    { apellido: 'Ximénez', nombre: 'Carlos', edad: 57 },
    { apellido: 'Zabala', nombre: 'Horacio', edad: 63 },
  ]
  const mujeresSinActividad = [
    { apellido: 'Álvarez', nombre: 'Marcela', edad: 31 },
    { apellido: 'Barrios', nombre: 'Silvina', edad: 37 },
    { apellido: 'Correa', nombre: 'Patricia', edad: 44 },
    { apellido: 'Duarte', nombre: 'Norma', edad: 52 },
    { apellido: 'Estévez', nombre: 'Graciela', edad: 60 },
  ]

  let nro = 100
  let inscripciones = 0
  const resumen = []

  async function crearSocio(p, sexo, deporte) {
    const edad = p.edad
    const esMenor = edad < 18
    const socio = await prisma.socio.create({
      data: {
        tenantId,
        nroSocio: String(nro++),
        apellidoNombre: `${p.apellido}, ${p.nombre}`,
        apellido: p.apellido,
        nombre: p.nombre,
        documento: documentoPara(edad),
        fechaNacimiento: fechaNacPara(edad),
        sexo,
        email: esMenor ? null : `${sinAcentos(p.nombre)}.${sinAcentos(p.apellido)}@email.com`,
        celular: esMenor ? null : celular(),
        calle: pick(CALLES),
        numero: String(100 + rnd(2900)),
        ciudad: CIUDAD,
        provincia: PROVINCIA,
        codigoPostal: '1629',
        nacionalidad: 'Argentina',
        tipoSocioRelId: esMenor ? tipoCadete.id : tipoActivo.id,
        categoriaSocioId: catRegular.id,
        estadoSocioId: estVigente.id,
        esMenor,
        aptaFisicaVigente: !!deporte,
        aptaFisicaVence: deporte ? new Date(HOY.getFullYear() + 1, HOY.getMonth(), HOY.getDate()) : null,
        fechaAlta: new Date(HOY.getFullYear() - rnd(4), rnd(12), 1 + rnd(27)),
      },
    })

    if (deporte) {
      const cats = deporte === 'RUGBY' ? catsRugby : catsHockey
      const cat = categoriaParaEdad(cats, edad)
      if (!cat) throw new Error(`Sin categoría de ${deporte} para edad ${edad} (${socio.apellidoNombre})`)
      await prisma.inscripcion.create({
        data: {
          tenantId,
          socioId: socio.id,
          categoriaActividadId: cat.id,
          centroCostoId: deporte === 'RUGBY' ? act.ccRugbyId : act.ccHockeyId,
          fechaInicio: new Date(HOY.getFullYear(), 2, 1),
          estado: 'ACTIVA',
          porcentajeCuota: 100,
        },
      })
      inscripciones++
      resumen.push(`      ${socio.nroSocio} ${socio.apellidoNombre} (${edad}) → ${deporte} ${cat.nombre}`)
    } else {
      resumen.push(`      ${socio.nroSocio} ${socio.apellidoNombre} (${edad}) → sin actividad`)
    }
    return socio
  }

  for (const p of varonesRugby) await crearSocio(p, 'M', 'RUGBY')
  for (const p of mujeresHockey) await crearSocio(p, 'F', 'HOCKEY')
  for (const p of varonesSinActividad) await crearSocio(p, 'M', null)
  for (const p of mujeresSinActividad) await crearSocio(p, 'F', null)

  console.log(`  ✓ 30 socios creados (nros 100-${nro - 1}) — ${inscripciones} inscripciones a actividades`)
  console.log(resumen.join('\n'))
}

// ────────────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
