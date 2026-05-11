/**
 * Setup completo del tenant "clublospinos" — Club Los Pinos.
 *
 * Crea:
 *   - Tenant + branding (paleta verde/negro/blanco del logo CLP)
 *   - Admin nuevo (admin@clublospinos.com / admin123)
 *   - Estructura: cuentas contables, centros de costo, conceptos tesorería,
 *     medios de pago, tipos/categorías/estados de socio
 *   - 2 actividades: Rugby y Hockey con sus categorías reales (UAR / Confederación
 *     Argentina de Hockey)
 *   - Período actual + ~30 socios (incl. familias) + cuotas generadas con algunos pagos
 *   - Comisión directiva, página Historia
 *
 * Uso:
 *   DATABASE_URL="postgresql://postgres:Q27G4B98@localhost:5434/clubix_db" \
 *     node --input-type=module scripts/setup-clublospinos.js
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
let ADMIN_ID_GLOBAL = null

const SUBDOMAIN = 'clublospinos'
const NOMBRE = 'Club Los Pinos'
const COLORS = {
  primario: '#0a6e3a',
  secundario: '#000000',
  acento: '#0a6e3a',
  fondo: '#FFFFFF',
  texto: '#1a1a1a',
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_SRC = path.resolve(__dirname, '..', '..', 'client', 'public', 'images', 'club', 'clublospinos-logo.png')
const UPLOADS_TENANTS = path.resolve(__dirname, '..', '..', 'uploads', 'tenants')

async function main() {
  // 1) Verificar / crear admin nuevo --------------------------------
  const ADMIN_EMAIL = 'admin@clublospinos.com'
  const ADMIN_PASS = 'admin123'
  let admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    admin = await prisma.admin.create({
      data: {
        nombre: 'Admin Club Los Pinos',
        email: ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(ADMIN_PASS, 12),
        activo: true,
      },
    })
    console.log(`✓ Admin creado id=${admin.id} (${ADMIN_EMAIL} / ${ADMIN_PASS})`)
  } else {
    console.log(`✓ Admin existente id=${admin.id} (${ADMIN_EMAIL})`)
  }
  ADMIN_ID_GLOBAL = admin.id

  // 2) Tenant -------------------------------------------------------
  let tenant = await prisma.tenant.findUnique({ where: { subdomain: SUBDOMAIN } })
  if (tenant) {
    console.log(`! Tenant ya existe id=${tenant.id} — abortando para evitar duplicados.`)
    return
  }
  tenant = await prisma.tenant.create({
    data: {
      nombre: NOMBRE,
      subdomain: SUBDOMAIN,
      slug: SUBDOMAIN,
      email: 'contacto@clublospinos.com',
      telefono: '+54 9 11 4444-5555',
      direccion: 'Av. Los Pinos 1500',
      ciudad: 'Pilar',
      provincia: 'Buenos Aires',
      codigoPostal: '1629',
      descripcion: 'Club deportivo familiar dedicado al rugby y al hockey, con tradición en formación de jugadores desde infantiles hasta primera.',
      slogan: 'Pasión, garra y familia.',
      horarios: 'Lunes a viernes 9:00-22:00 · Sábados y domingos 9:00-20:00',
      redesSociales: {
        instagram: '@clublospinos',
        facebook: 'ClubLosPinosOK',
        twitter: '@clublospinos',
      },
      colores: COLORS,
      plan: 'STANDARD',
      maxSocios: 500,
      maxAdmins: 5,
      estado: 'ACTIVO',
      activo: true,
      fechaAprobacion: new Date(),
      timezone: 'America/Argentina/Buenos_Aires',
      moneda: 'ARS',
      razonSocial: 'Asociación Civil Club Los Pinos',
      condicionIva: 'EXENTO',
    },
  })
  console.log(`✓ Tenant creado id=${tenant.id}`)
  const tenantId = tenant.id

  // 3) Copiar logo --------------------------------------------------
  try {
    if (!fs.existsSync(UPLOADS_TENANTS)) fs.mkdirSync(UPLOADS_TENANTS, { recursive: true })
    const dst = path.join(UPLOADS_TENANTS, `tenant-${tenantId}-logo.png`)
    fs.copyFileSync(LOGO_SRC, dst)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: `/uploads/tenants/tenant-${tenantId}-logo.png` },
    })
    console.log(`✓ Logo copiado → /uploads/tenants/tenant-${tenantId}-logo.png`)
  } catch (e) {
    console.warn(`! No se pudo copiar logo: ${e.message}`)
  }

  // 4) Vincular admin al tenant -------------------------------------
  await prisma.tenantUsuario.create({
    data: { tenantId, adminId: admin.id, rol: 'ADMIN' },
  })
  console.log(`✓ Admin vinculado al tenant`)

  // 5) Estructura básica --------------------------------------------
  await inicializarEstructura(tenantId)

  // 6) Actividades Rugby y Hockey ------------------------------------
  await crearActividades(tenantId)

  // 7) Período actual + socios + cuotas -----------------------------
  await crearPeriodoYSocios(tenantId)

  // 8) Espacios, autoridades, página Historia -----------------------
  await crearComplementos(tenantId)

  console.log('\n✅ Setup completo. Acceso:')
  console.log(`   - URL  : http://${SUBDOMAIN}.clubix.localhost:5173`)
  console.log(`   - Email: ${ADMIN_EMAIL}`)
  console.log(`   - Pass : ${ADMIN_PASS}`)
}

// ────────────────────────────────────────────────────────────────────
// 5) Estructura: cuentas, centros, conceptos, medios, tipos socio, etc.
// ────────────────────────────────────────────────────────────────────
async function inicializarEstructura(tenantId) {
  console.log('\n→ Inicializando estructura...')

  // Cuentas contables (3 niveles)
  const padres = await Promise.all([
    prisma.cuentaContable.create({ data: { tenantId, codigo: '1', nombre: 'ACTIVO', tipo: 'ACTIVO', nivel: 1, esImputable: false, orden: 1 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '2', nombre: 'PASIVO', tipo: 'PASIVO', nivel: 1, esImputable: false, orden: 2 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '3', nombre: 'PATRIMONIO NETO', tipo: 'PATRIMONIO', nivel: 1, esImputable: false, orden: 3 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '4', nombre: 'INGRESOS', tipo: 'INGRESO', nivel: 1, esImputable: false, orden: 4 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '5', nombre: 'EGRESOS', tipo: 'EGRESO', nivel: 1, esImputable: false, orden: 5 } }),
  ])
  const [activo, pasivo, patrimonio, ingresos, egresos] = padres
  const hijos = await Promise.all([
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
  const [activoCte] = hijos
  await Promise.all([
    prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.1', nombre: 'Caja', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 100 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.2', nombre: 'Bancos', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 101 } }),
    prisma.cuentaContable.create({ data: { tenantId, codigo: '1.1.3', nombre: 'Deudores por Cuotas', tipo: 'ACTIVO', nivel: 3, padreId: activoCte.id, esImputable: true, orden: 102 } }),
  ])
  console.log('  ✓ Cuentas contables (19)')

  // Centros de costo (solo Rugby/Hockey + admin/buffet)
  await prisma.centroCosto.createMany({
    data: [
      { tenantId, codigo: 'ADM',    nombre: 'Administración', orden: 1 },
      { tenantId, codigo: 'RUGBY',  nombre: 'Rugby',          orden: 2 },
      { tenantId, codigo: 'HOCKEY', nombre: 'Hockey',         orden: 3 },
      { tenantId, codigo: 'BUFFET', nombre: 'Buffet',         orden: 4 },
      { tenantId, codigo: 'EVENTOS',nombre: 'Eventos',        orden: 5 },
    ],
  })
  console.log('  ✓ Centros de costo (5)')

  // Conceptos de tesorería
  await prisma.conceptoTesoreria.createMany({
    data: [
      { tenantId, codigo: 'COB-CUO',  nombre: 'Cobranza de Cuotas',  tipo: 'INGRESO', usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 1 },
      { tenantId, codigo: 'COB-ACT',  nombre: 'Cobranza Actividades',tipo: 'INGRESO', usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 2 },
      { tenantId, codigo: 'ING-MORA', nombre: 'Ingresos por Mora',   tipo: 'INGRESO', usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 3 },
      { tenantId, codigo: 'ING-BUF',  nombre: 'Ingresos Buffet',     tipo: 'INGRESO', usaEnTesoreria: true,  usaEnVentas: true,  usaEnCompras: false, orden: 4 },
      { tenantId, codigo: 'OTR-ING',  nombre: 'Otros Ingresos',      tipo: 'INGRESO', usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 5 },
      { tenantId, codigo: 'SUE',      nombre: 'Sueldos y Jornales',  tipo: 'EGRESO',  usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 6 },
      { tenantId, codigo: 'SERV',     nombre: 'Servicios',           tipo: 'EGRESO',  usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: true,  orden: 7 },
      { tenantId, codigo: 'MAN',      nombre: 'Mantenimiento',       tipo: 'EGRESO',  usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: true,  orden: 8 },
      { tenantId, codigo: 'COM',      nombre: 'Compras',             tipo: 'EGRESO',  usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: true,  orden: 9 },
      { tenantId, codigo: 'OTR-EGR',  nombre: 'Otros Egresos',       tipo: 'EGRESO',  usaEnTesoreria: true,  usaEnVentas: false, usaEnCompras: false, orden: 10 },
    ],
  })
  const cobCuo = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-CUO' } })
  const ingMora = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-MORA' } })
  console.log('  ✓ Conceptos de tesorería (10)')

  // Medios de pago
  await prisma.medioPago.createMany({
    data: [
      { tenantId, codigo: 'EFECTIVO',     nombre: 'Efectivo',           tipo: 'EFECTIVO',      activo: true,  orden: 1 },
      { tenantId, codigo: 'TRANSFERENCIA',nombre: 'Transferencia',      tipo: 'TRANSFERENCIA', activo: true,  orden: 2 },
      { tenantId, codigo: 'DEBITO',       nombre: 'Tarjeta Débito',     tipo: 'TARJETA',       activo: true,  orden: 3 },
      { tenantId, codigo: 'CREDITO',      nombre: 'Tarjeta Crédito',    tipo: 'TARJETA',       activo: true,  orden: 4 },
      { tenantId, codigo: 'MERCADOPAGO',  nombre: 'MercadoPago',        tipo: 'DIGITAL',       activo: true,  orden: 5 },
    ],
  })
  console.log('  ✓ Medios de pago (5)')

  // Tipos de socio
  await prisma.tipoSocio.createMany({
    data: [
      { tenantId, codigo: 'TITULAR_FAMILIA', nombre: 'Titular Familia', descripcion: 'Titular del grupo familiar', cuotaMensual: 18000, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'green', orden: 1 },
      { tenantId, codigo: 'MIEMBRO_FAMILIA', nombre: 'Miembro Familia', descripcion: 'Cónyuge / hijo del titular',  cuotaMensual: 0,     conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'blue',  orden: 2 },
      { tenantId, codigo: 'SOCIO_UNICO',     nombre: 'Socio Único',     descripcion: 'Socio individual sin familia', cuotaMensual: 15000, conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'green', orden: 3 },
      { tenantId, codigo: 'CADETE',          nombre: 'Cadete',          descripcion: 'Menor de 18 años no familiar', cuotaMensual: 9000,  conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'cyan',  orden: 4 },
      { tenantId, codigo: 'VITALICIO',       nombre: 'Vitalicio',       descripcion: 'Sin cargo mensual',            cuotaMensual: 0,     conceptoTesoreriaId: cobCuo.id, conceptoMoraId: ingMora.id, color: 'gold',  orden: 5 },
    ],
  })
  console.log('  ✓ Tipos de socio (5)')

  // Categorías de socio
  await prisma.categoriaSocio.createMany({
    data: [
      { tenantId, codigo: 'REGULAR',  nombre: 'Regular',           porcentajeDescuento: 0,    orden: 1 },
      { tenantId, codigo: 'JUBILADO', nombre: 'Jubilado',          porcentajeDescuento: 50,   orden: 2 },
      { tenantId, codigo: 'BECADO',   nombre: 'Becado',            porcentajeDescuento: 100,  orden: 3 },
      { tenantId, codigo: 'PERSONAL', nombre: 'Personal del Club', porcentajeDescuento: 100,  orden: 4 },
    ],
  })
  console.log('  ✓ Categorías de socio (4)')

  // Estados de socio — con esSocioActivo correcto y rolVigencia
  await prisma.estadoSocio.createMany({
    data: [
      { tenantId, codigo: 'VIGENTE',     nombre: 'Vigente',                color: '#16a34a', permiteDescuentos: true,  permiteIngresoMolinete: true,  esSocioActivo: true,  rolVigencia: 'AL_DIA',     orden: 1 },
      { tenantId, codigo: 'BLOQUEADO',   nombre: 'Bloqueado por Morosidad',color: '#9333ea', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: true,  rolVigencia: 'BLOQUEADO',  orden: 2 },
      { tenantId, codigo: 'SUSPENDIDO',  nombre: 'Suspendido',             color: '#d97706', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: true,  rolVigencia: null,         orden: 3 },
      { tenantId, codigo: 'BAJA',        nombre: 'Baja',                   color: '#dc2626', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: false, rolVigencia: null,         orden: 4 },
      { tenantId, codigo: 'BAJA_FALL',   nombre: 'Baja por Fallecimiento', color: '#6b7280', permiteDescuentos: false, permiteIngresoMolinete: false, esSocioActivo: false, rolVigencia: null,         orden: 5 },
    ],
  })
  console.log('  ✓ Estados de socio (5)')

  // Configs básicas
  await prisma.configuracion.createMany({
    data: [
      { tenantId, clave: 'CONCEPTO_COBRANZA_CUOTAS',         valor: String(cobCuo.id), tipo: 'INTEGER',  modulo: 'TESORERIA' },
      { tenantId, clave: 'CONCEPTO_MORA',                    valor: String(ingMora.id),tipo: 'INTEGER',  modulo: 'TESORERIA' },
      { tenantId, clave: 'DIA_CORTE_CUOTAS',                 valor: '20',              tipo: 'INTEGER',  modulo: 'CUOTAS' },
      { tenantId, clave: 'SOCIO_NRO_MIN',                    valor: '100',             tipo: 'INTEGER',  modulo: 'SOCIOS' },
      { tenantId, clave: 'SOCIO_NRO_MAX',                    valor: '9999',            tipo: 'INTEGER',  modulo: 'SOCIOS' },
      { tenantId, clave: 'MOROSIDAD_BLOQUEO_AUTO_ACTIVO',    valor: 'false',           tipo: 'BOOLEAN',  modulo: 'MOROSIDAD' },
      { tenantId, clave: 'MOROSIDAD_DIAS_GRACIA',            valor: '5',               tipo: 'INTEGER',  modulo: 'MOROSIDAD' },
      { tenantId, clave: 'CLUB_NOMBRE',                      valor: NOMBRE,            tipo: 'STRING',   modulo: 'GENERAL' },
      { tenantId, clave: 'CLUB_DIRECCION',                   valor: 'Av. Los Pinos 1500, Pilar', tipo: 'STRING', modulo: 'GENERAL' },
      { tenantId, clave: 'CLUB_TELEFONO',                    valor: '+54 9 11 4444-5555', tipo: 'STRING', modulo: 'GENERAL' },
    ],
  })
  console.log('  ✓ Configuraciones (10)')
}

// ────────────────────────────────────────────────────────────────────
// 6) Actividades Rugby y Hockey
// ────────────────────────────────────────────────────────────────────
async function crearActividades(tenantId) {
  console.log('\n→ Creando Rugby y Hockey...')

  const rugby = await prisma.actividad.create({
    data: {
      tenantId,
      codigo: 'RUGBY',
      nombre: 'Rugby',
      descripcion: 'Rugby masculino, divisiones formativas, juveniles y primera.',
      requiereAptaFisica: true,
      cuotaMensual: 14000,
      color: '#0a6e3a',
      activo: true,
      orden: 1,
    },
  })

  // Categorías Rugby — basadas en reglamento UAR / URBA (Mini Yacaré → Primera + Veteranos)
  const catsRugby = [
    { codigo: 'RUG-YACARE',   nombre: 'Mini Yacaré',  descripcion: 'Pre-escuelita, sin contacto',           edadMinima: 4,  edadMaxima: 5,  sexo: 'MASCULINO', cuotaMensual: 9000,  orden: 1 },
    { codigo: 'RUG-ESCUELITA',nombre: 'Escuelita',    descripcion: 'Iniciación rugby (TAG / Probá Rugby)',  edadMinima: 6,  edadMaxima: 7,  sexo: 'MASCULINO', cuotaMensual: 10000, orden: 2 },
    { codigo: 'RUG-M8',       nombre: 'M8',           descripcion: 'Sub 8 - primer scrum sin disputa',      edadMinima: 8,  edadMaxima: 8,  sexo: 'MASCULINO', cuotaMensual: 11000, orden: 3 },
    { codigo: 'RUG-M9',       nombre: 'M9',           descripcion: 'Sub 9 - disputa 1 vs 1',                edadMinima: 9,  edadMaxima: 9,  sexo: 'MASCULINO', cuotaMensual: 11000, orden: 4 },
    { codigo: 'RUG-M10',      nombre: 'M10',          descripcion: 'Sub 10',                                edadMinima: 10, edadMaxima: 10, sexo: 'MASCULINO', cuotaMensual: 12000, orden: 5 },
    { codigo: 'RUG-M11',      nombre: 'M11',          descripcion: 'Sub 11 - disputa hasta 2 vs 2',         edadMinima: 11, edadMaxima: 11, sexo: 'MASCULINO', cuotaMensual: 12000, orden: 6 },
    { codigo: 'RUG-M12',      nombre: 'M12',          descripcion: 'Sub 12 - disputa libre',                edadMinima: 12, edadMaxima: 12, sexo: 'MASCULINO', cuotaMensual: 12000, orden: 7 },
    { codigo: 'RUG-M13',      nombre: 'M13',          descripcion: 'Sub 13',                                edadMinima: 13, edadMaxima: 13, sexo: 'MASCULINO', cuotaMensual: 13000, orden: 8 },
    { codigo: 'RUG-M14',      nombre: 'M14',          descripcion: 'Sub 14',                                edadMinima: 14, edadMaxima: 14, sexo: 'MASCULINO', cuotaMensual: 13000, orden: 9 },
    { codigo: 'RUG-M15',      nombre: 'M15',          descripcion: 'Sub 15 (juveniles)',                    edadMinima: 15, edadMaxima: 15, sexo: 'MASCULINO', cuotaMensual: 14000, orden: 10 },
    { codigo: 'RUG-M16',      nombre: 'M16',          descripcion: 'Sub 16 (juveniles)',                    edadMinima: 16, edadMaxima: 16, sexo: 'MASCULINO', cuotaMensual: 14000, orden: 11 },
    { codigo: 'RUG-M17',      nombre: 'M17',          descripcion: 'Sub 17 (juveniles)',                    edadMinima: 17, edadMaxima: 17, sexo: 'MASCULINO', cuotaMensual: 14000, orden: 12 },
    { codigo: 'RUG-M18',      nombre: 'M18',          descripcion: 'Sub 18 (juveniles)',                    edadMinima: 18, edadMaxima: 18, sexo: 'MASCULINO', cuotaMensual: 14000, orden: 13 },
    { codigo: 'RUG-M19',      nombre: 'M19 / Juvenil', descripcion: 'Sub 19 - transición a primera',         edadMinima: 19, edadMaxima: 19, sexo: 'MASCULINO', cuotaMensual: 14000, orden: 14 },
    { codigo: 'RUG-INTER',    nombre: 'Intermedia',    descripcion: 'Plantel intermedio (categoría adulta)', edadMinima: 20, edadMaxima: null, sexo: 'MASCULINO', cuotaMensual: 15000, orden: 15 },
    { codigo: 'RUG-PRIMERA',  nombre: 'Primera',       descripcion: 'Primera división (senior)',             edadMinima: 19, edadMaxima: null, sexo: 'MASCULINO', cuotaMensual: 15000, orden: 16 },
    { codigo: 'RUG-VETERANOS',nombre: 'Veteranos',     descripcion: 'Veteranos / amistosos (35+)',           edadMinima: 35, edadMaxima: null, sexo: 'MASCULINO', cuotaMensual: 12000, orden: 17 },
  ]
  await prisma.categoriaActividad.createMany({
    data: catsRugby.map(c => ({ ...c, tenantId, actividadId: rugby.id, activo: true })),
  })
  console.log(`  ✓ Rugby + ${catsRugby.length} categorías`)

  const hockey = await prisma.actividad.create({
    data: {
      tenantId,
      codigo: 'HOCKEY',
      nombre: 'Hockey',
      descripcion: 'Hockey sobre césped femenino — desde mini hockey hasta primera y mami hockey.',
      requiereAptaFisica: true,
      cuotaMensual: 14000,
      color: '#000000',
      activo: true,
      orden: 2,
    },
  })

  // Categorías Hockey femenino — Confederación Argentina de Hockey + uso habitual de clubes
  const catsHockey = [
    { codigo: 'HOC-MINI',     nombre: 'Mini Hockey',     descripcion: 'Iniciación, palo pelota',                 edadMinima: 5,  edadMaxima: 8,  sexo: 'FEMENINO', cuotaMensual: 10000, orden: 1 },
    { codigo: 'HOC-SUB10',    nombre: 'Sub 10',          descripcion: 'Categoría sub 10',                        edadMinima: 9,  edadMaxima: 10, sexo: 'FEMENINO', cuotaMensual: 11000, orden: 2 },
    { codigo: 'HOC-SUB12',    nombre: 'Sub 12',          descripcion: 'Categoría sub 12',                        edadMinima: 11, edadMaxima: 12, sexo: 'FEMENINO', cuotaMensual: 12000, orden: 3 },
    { codigo: 'HOC-SUB14',    nombre: 'Sub 14',          descripcion: 'Sub 14 (CAH - Campeonato Argentino)',     edadMinima: 13, edadMaxima: 14, sexo: 'FEMENINO', cuotaMensual: 13000, orden: 4 },
    { codigo: 'HOC-SUB16',    nombre: 'Sub 16',          descripcion: 'Sub 16 (CAH - Campeonato Argentino)',     edadMinima: 15, edadMaxima: 16, sexo: 'FEMENINO', cuotaMensual: 14000, orden: 5 },
    { codigo: 'HOC-SUB19',    nombre: 'Sub 19',          descripcion: 'Sub 19 (CAH - Campeonato Argentino)',     edadMinima: 17, edadMaxima: 19, sexo: 'FEMENINO', cuotaMensual: 14000, orden: 6 },
    { codigo: 'HOC-INTER',    nombre: 'Intermedia',      descripcion: 'Plantel intermedio',                      edadMinima: 17, edadMaxima: null, sexo: 'FEMENINO', cuotaMensual: 14000, orden: 7 },
    { codigo: 'HOC-PRIMERA',  nombre: 'Primera',         descripcion: 'Primera división',                        edadMinima: 18, edadMaxima: null, sexo: 'FEMENINO', cuotaMensual: 15000, orden: 8 },
    { codigo: 'HOC-MAMI',     nombre: 'Mami Hockey',     descripcion: 'Hockey amateur recreativo (35+)',         edadMinima: 35, edadMaxima: null, sexo: 'FEMENINO', cuotaMensual: 11000, orden: 9 },
    { codigo: 'HOC-VETERANAS',nombre: 'Veteranas',       descripcion: 'Veteranas (45+)',                         edadMinima: 45, edadMaxima: null, sexo: 'FEMENINO', cuotaMensual: 10000, orden: 10 },
  ]
  await prisma.categoriaActividad.createMany({
    data: catsHockey.map(c => ({ ...c, tenantId, actividadId: hockey.id, activo: true })),
  })
  console.log(`  ✓ Hockey + ${catsHockey.length} categorías`)
}

// ────────────────────────────────────────────────────────────────────
// 7) Período + socios + cuotas
// ────────────────────────────────────────────────────────────────────
async function crearPeriodoYSocios(tenantId) {
  console.log('\n→ Creando período actual + socios...')

  const hoy = new Date()
  const periodo = await prisma.periodo.create({
    data: {
      tenantId,
      nombre: `${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`,
      mes: hoy.getMonth() + 1,
      anio: hoy.getFullYear(),
      fechaVencimiento: new Date(hoy.getFullYear(), hoy.getMonth(), 10),
      estado: 'ABIERTO',
    },
  })
  console.log(`  ✓ Período ${periodo.nombre} (id=${periodo.id})`)

  const tiposSocio   = await prisma.tipoSocio.findMany({ where: { tenantId } })
  const tipoTitular  = tiposSocio.find(t => t.codigo === 'TITULAR_FAMILIA')
  const tipoMiembro  = tiposSocio.find(t => t.codigo === 'MIEMBRO_FAMILIA')
  const tipoUnico    = tiposSocio.find(t => t.codigo === 'SOCIO_UNICO')
  const tipoCadete   = tiposSocio.find(t => t.codigo === 'CADETE')
  const tipoVita     = tiposSocio.find(t => t.codigo === 'VITALICIO')
  const catRegular   = (await prisma.categoriaSocio.findFirst({ where: { tenantId, codigo: 'REGULAR' } }))
  const catJubilado  = (await prisma.categoriaSocio.findFirst({ where: { tenantId, codigo: 'JUBILADO' } }))
  const estVigente   = (await prisma.estadoSocio.findFirst({ where: { tenantId, codigo: 'VIGENTE' } }))
  const estBloqueado = (await prisma.estadoSocio.findFirst({ where: { tenantId, codigo: 'BLOQUEADO' } }))

  // Datos: 8 familias (titular+pareja+1-2 hijos) + 5 socios únicos + 3 cadetes + 1 vitalicio = ~30 socios
  const familias = [
    { apellido: 'García',     titular: 'Mariano',    pareja: 'Laura',     hijos: ['Camila','Joaquín'] },
    { apellido: 'Fernández',  titular: 'Roberto',    pareja: 'Silvia',    hijos: ['Lucía','Tomás'] },
    { apellido: 'Pérez',      titular: 'Alejandro',  pareja: 'Carolina',  hijos: ['Martina'] },
    { apellido: 'Rodríguez',  titular: 'Diego',      pareja: 'Andrea',    hijos: ['Bautista','Sofía'] },
    { apellido: 'López',      titular: 'Sebastián',  pareja: 'Verónica',  hijos: ['Bruno','Catalina'] },
    { apellido: 'Martínez',   titular: 'Federico',   pareja: 'Romina',    hijos: ['Felipe'] },
    { apellido: 'Sánchez',    titular: 'Hernán',     pareja: 'Mariela',   hijos: ['Pilar','Valentín'] },
    { apellido: 'Romero',     titular: 'Gustavo',    pareja: 'Daniela',   hijos: ['Lara'] },
  ]
  const unicos = [
    { apellido: 'Suárez',   nombre: 'Nicolás',     edad: 28, sexo: 'M' },
    { apellido: 'Acosta',   nombre: 'Pablo',       edad: 24, sexo: 'M' },
    { apellido: 'Torres',   nombre: 'Florencia',   edad: 31, sexo: 'F' },
    { apellido: 'Giménez',  nombre: 'Lucas',       edad: 26, sexo: 'M' },
    { apellido: 'Ríos',     nombre: 'Belén',       edad: 29, sexo: 'F' },
  ]
  const cadetes = [
    { apellido: 'Castro',   nombre: 'Ignacio',     edad: 16, sexo: 'M' },
    { apellido: 'Ortiz',    nombre: 'Renata',      edad: 15, sexo: 'F' },
    { apellido: 'Cabrera',  nombre: 'Mateo',       edad: 17, sexo: 'M' },
  ]
  const vitalicios = [
    { apellido: 'Molina',   nombre: 'Eduardo',     edad: 78, sexo: 'M' },
  ]

  let nroSocio = 100
  const nuevoNro = () => String(nroSocio++)
  const nuevoDoc = (() => { let d = 25000000; return () => String(d++ + Math.floor(Math.random()*100)) })()
  const cobranzas = []
  let titularesCreados = 0
  let miembrosCreados = 0
  let unicosCreados = 0
  let cadetesCreados = 0
  let vitaliciosCreados = 0

  // Familias
  for (const fam of familias) {
    const fechaNacTit = new Date(1980 + Math.floor(Math.random()*15), Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27))
    const titular = await prisma.socio.create({
      data: {
        tenantId, nroSocio: nuevoNro(),
        apellidoNombre: `${fam.apellido}, ${fam.titular}`,
        apellido: fam.apellido, nombre: fam.titular,
        documento: nuevoDoc(),
        fechaNacimiento: fechaNacTit,
        sexo: 'M',
        email: `${fam.titular.toLowerCase()}.${fam.apellido.toLowerCase()}@email.com`,
        celular: `11${Math.floor(40000000 + Math.random()*9000000)}`,
        ciudad: 'Pilar', provincia: 'Buenos Aires',
        tipoSocioRelId: tipoTitular.id,
        categoriaSocioId: catRegular.id,
        estadoSocioId: estVigente.id,
        fechaAlta: new Date(hoy.getFullYear() - 2, 0, 1),
      },
    })
    titularesCreados++
    cobranzas.push({ socioId: titular.id, monto: 18000 })

    // Pareja
    const pareja = await prisma.socio.create({
      data: {
        tenantId, nroSocio: nuevoNro(),
        apellidoNombre: `${fam.apellido}, ${fam.pareja}`,
        apellido: fam.apellido, nombre: fam.pareja,
        documento: nuevoDoc(),
        fechaNacimiento: new Date(1982 + Math.floor(Math.random()*13), Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27)),
        sexo: 'F',
        email: `${fam.pareja.toLowerCase()}.${fam.apellido.toLowerCase()}@email.com`,
        celular: `11${Math.floor(40000000 + Math.random()*9000000)}`,
        ciudad: 'Pilar', provincia: 'Buenos Aires',
        tipoSocioRelId: tipoMiembro.id,
        categoriaSocioId: catRegular.id,
        estadoSocioId: estVigente.id,
        titularFamiliaId: titular.id,
        parentescoTitular: 'CONYUGE',
        fechaAlta: new Date(hoy.getFullYear() - 2, 0, 1),
      },
    })
    miembrosCreados++

    // Hijos
    for (const hijo of fam.hijos) {
      const edad = 8 + Math.floor(Math.random()*9) // 8-16
      const fechaNac = new Date(hoy.getFullYear() - edad, Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27))
      const esMenor = edad < 18
      const sexoHijo = ['Camila','Lucía','Martina','Sofía','Catalina','Pilar','Lara'].includes(hijo) ? 'F' : 'M'
      await prisma.socio.create({
        data: {
          tenantId, nroSocio: nuevoNro(),
          apellidoNombre: `${fam.apellido}, ${hijo}`,
          apellido: fam.apellido, nombre: hijo,
          documento: nuevoDoc(),
          fechaNacimiento: fechaNac,
          sexo: sexoHijo,
          ciudad: 'Pilar', provincia: 'Buenos Aires',
          tipoSocioRelId: tipoMiembro.id,
          categoriaSocioId: catRegular.id,
          estadoSocioId: estVigente.id,
          titularFamiliaId: titular.id,
          parentescoTitular: 'HIJO',
          esMenor,
          responsableId: esMenor ? titular.id : null,
          fechaAlta: new Date(hoy.getFullYear() - 2, 0, 1),
        },
      })
      miembrosCreados++
    }
  }

  // Únicos
  for (const u of unicos) {
    const fechaNac = new Date(hoy.getFullYear() - u.edad, Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27))
    const socio = await prisma.socio.create({
      data: {
        tenantId, nroSocio: nuevoNro(),
        apellidoNombre: `${u.apellido}, ${u.nombre}`,
        apellido: u.apellido, nombre: u.nombre,
        documento: nuevoDoc(),
        fechaNacimiento: fechaNac,
        sexo: u.sexo,
        email: `${u.nombre.toLowerCase()}.${u.apellido.toLowerCase()}@email.com`,
        celular: `11${Math.floor(40000000 + Math.random()*9000000)}`,
        ciudad: 'Pilar', provincia: 'Buenos Aires',
        tipoSocioRelId: tipoUnico.id,
        categoriaSocioId: catRegular.id,
        estadoSocioId: estVigente.id,
        fechaAlta: new Date(hoy.getFullYear() - 1, 6, 1),
      },
    })
    unicosCreados++
    cobranzas.push({ socioId: socio.id, monto: 15000 })
  }

  // Cadetes
  for (const c of cadetes) {
    const fechaNac = new Date(hoy.getFullYear() - c.edad, Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27))
    const socio = await prisma.socio.create({
      data: {
        tenantId, nroSocio: nuevoNro(),
        apellidoNombre: `${c.apellido}, ${c.nombre}`,
        apellido: c.apellido, nombre: c.nombre,
        documento: nuevoDoc(),
        fechaNacimiento: fechaNac,
        sexo: c.sexo,
        ciudad: 'Pilar', provincia: 'Buenos Aires',
        tipoSocioRelId: tipoCadete.id,
        categoriaSocioId: catRegular.id,
        estadoSocioId: estVigente.id,
        esMenor: true,
        fechaAlta: new Date(hoy.getFullYear(), 1, 1),
      },
    })
    cadetesCreados++
    cobranzas.push({ socioId: socio.id, monto: 9000 })
  }

  // Vitalicio
  for (const v of vitalicios) {
    const fechaNac = new Date(hoy.getFullYear() - v.edad, Math.floor(Math.random()*12), 1 + Math.floor(Math.random()*27))
    await prisma.socio.create({
      data: {
        tenantId, nroSocio: nuevoNro(),
        apellidoNombre: `${v.apellido}, ${v.nombre}`,
        apellido: v.apellido, nombre: v.nombre,
        documento: nuevoDoc(),
        fechaNacimiento: fechaNac,
        sexo: v.sexo,
        ciudad: 'Pilar', provincia: 'Buenos Aires',
        tipoSocioRelId: tipoVita.id,
        categoriaSocioId: catJubilado.id,
        estadoSocioId: estVigente.id,
        fechaAlta: new Date(hoy.getFullYear() - 30, 0, 1),
      },
    })
    vitaliciosCreados++
  }

  console.log(`  ✓ Socios: titulares=${titularesCreados} miembros=${miembrosCreados} únicos=${unicosCreados} cadetes=${cadetesCreados} vitalicios=${vitaliciosCreados}`)

  // Cuotas + algunos pagos confirmados (40% pagos, 60% pendiente)
  let cargosCreados = 0
  let pagosCreados = 0
  const efectivo = await prisma.medioPago.findFirst({ where: { tenantId, codigo: 'EFECTIVO' } })
  const conceptoCob = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'COB-CUO' } })

  for (let i = 0; i < cobranzas.length; i++) {
    const c = cobranzas[i]
    const pago = i % 5 < 2 // ~40% pagados
    const cargo = await prisma.cargo.create({
      data: {
        tenantId,
        socioId: c.socioId,
        periodoId: periodo.id,
        categoria: 'CUOTA_SOCIAL',
        tipoCuota: 'CUOTA_SOCIAL',
        descripcion: `Cuota Social ${periodo.nombre}`,
        montoOriginal: c.monto,
        montoBonificacion: 0,
        montoTotal: c.monto,
        fechaVencimiento: periodo.fechaVencimiento,
        estado: pago ? 'PAGADO' : 'PENDIENTE',
        origen: 'GENERACION_AUTO',
        conceptoTesoreriaId: conceptoCob.id,
      },
    })
    cargosCreados++

    if (pago) {
      const pagoNumero = await prisma.pago.count({ where: { tenantId } }) + 1
      const pagoRec = await prisma.pago.create({
        data: {
          tenantId,
          numero: String(pagoNumero).padStart(6, '0'),
          socioId: c.socioId,
          fecha: new Date(hoy.getFullYear(), hoy.getMonth(), Math.max(1, hoy.getDate() - 5)),
          montoTotal: c.monto,
          montoRecibido: c.monto,
          medioPagoId: efectivo.id,
          estado: 'CONFIRMADO',
          origen: 'MOSTRADOR',
          registradoPor: ADMIN_ID_GLOBAL,
        },
      })
      await prisma.cargo.update({ where: { id: cargo.id }, data: { pagoId: pagoRec.id, fechaPago: pagoRec.fecha } })
      pagosCreados++
    }
  }
  console.log(`  ✓ Cargos: ${cargosCreados} (de los cuales ${pagosCreados} pagados)`)
}

// ────────────────────────────────────────────────────────────────────
// 8) Complementos: espacios, autoridades, página historia
// ────────────────────────────────────────────────────────────────────
async function crearComplementos(tenantId) {
  console.log('\n→ Creando espacios y autoridades...')

  // Tipos de espacio + espacios deportivos
  try {
    const tipoRugby = await prisma.tipoEspacio.create({
      data: { tenantId, codigo: 'CANCHA_RUGBY',  nombre: 'Cancha de Rugby',   orden: 1, activo: true },
    })
    const tipoHockey = await prisma.tipoEspacio.create({
      data: { tenantId, codigo: 'CANCHA_HOCKEY', nombre: 'Cancha de Hockey',  orden: 2, activo: true },
    })
    const tipoSocial = await prisma.tipoEspacio.create({
      data: { tenantId, codigo: 'SOCIAL',        nombre: 'Salón Social',      orden: 3, activo: true },
    })
    await prisma.espacioDeportivo.createMany({
      data: [
        { tenantId, codigo: 'RUGBY-1',  nombre: 'Cancha de Rugby Principal', tipoEspacioId: tipoRugby.id,  cubierto: false, iluminacion: true,  capacidad: 22, descripcion: 'Cancha principal de rugby con iluminación', activo: true },
        { tenantId, codigo: 'RUGBY-2',  nombre: 'Cancha de Rugby Auxiliar',  tipoEspacioId: tipoRugby.id,  cubierto: false, iluminacion: false, capacidad: 22, descripcion: 'Cancha auxiliar, formativas',              activo: true },
        { tenantId, codigo: 'HOCKEY-1', nombre: 'Cancha de Hockey Sintética',tipoEspacioId: tipoHockey.id, cubierto: false, iluminacion: true,  capacidad: 22, descripcion: 'Césped sintético, con iluminación',         activo: true },
        { tenantId, codigo: 'CLUB-HSE', nombre: 'Club House',                 tipoEspacioId: tipoSocial.id, cubierto: true,  iluminacion: true,  capacidad: 200, descripcion: 'Salón social, buffet y vestuarios',        activo: true },
      ],
    })
    console.log('  ✓ Espacios deportivos (4) + tipos (3)')
  } catch (e) {
    console.warn(`  ! No se pudieron crear espacios: ${e.message}`)
  }

  // Autoridades / Comisión Directiva
  try {
    await prisma.autoridad.createMany({
      data: [
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Presidente',       nombre: 'Carlos Mendoza',   orden: 1, activo: true },
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Vicepresidente',   nombre: 'Mariana Vega',     orden: 2, activo: true },
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Secretario',       nombre: 'Pablo Iglesias',   orden: 3, activo: true },
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Tesorera',         nombre: 'Sandra Bello',     orden: 4, activo: true },
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Vocal Titular',    nombre: 'Diego Maidana',    orden: 5, activo: true },
        { tenantId, seccion: 'COMISION_DIRECTIVA', cargo: 'Vocal Titular',    nombre: 'Lucía Robledo',    orden: 6, activo: true },
      ],
    })
    console.log('  ✓ Autoridades (6)')
  } catch (e) {
    console.warn(`  ! No se pudieron crear autoridades: ${e.message}`)
  }

  // Página Historia
  try {
    await prisma.configuracion.create({
      data: {
        tenantId,
        clave: 'PAGINA_HISTORIA',
        valor: JSON.stringify({
          intro: {
            titulo: 'Nuestra Historia',
            tituloSeccion: 'Verde y Familia',
            parrafos: [
              'Club Los Pinos nació en 1962 cuando un grupo de familias del Partido de Pilar se reunió con un sueño compartido: tener un espacio donde el deporte amateur y la vida en comunidad fueran un mismo proyecto.',
              'Desde el primer día apostamos por dos disciplinas que se transformaron en marca registrada del club: el rugby masculino y el hockey femenino. Esa identidad sostenida durante más de seis décadas hizo de Los Pinos un semillero reconocido en la zona norte de Buenos Aires.',
              'Hoy somos una comunidad de familias unidas por el verde y el blanco. Cada sábado las canchas se llenan de chicos y chicas que aprenden mucho más que un deporte: aprenden a ser equipo.',
            ],
            badge: '+60',
            badgeTexto: 'años de tradición',
          },
          hitos: [
            { anio: '1962', titulo: 'Fundación',                 descripcion: 'Un grupo de 18 familias firma el acta fundacional. Se elige el verde y el blanco como colores institucionales.' },
            { anio: '1968', titulo: 'Primera cancha de rugby',   descripcion: 'Se inaugura la cancha principal sobre tierra propia. Comienza la actividad formativa con apenas 30 chicos.' },
            { anio: '1985', titulo: 'Hockey femenino',           descripcion: 'Se suma la rama de hockey sobre césped. Primer plantel de Primera compitiendo en la URBA.' },
            { anio: '2003', titulo: 'Cancha sintética',           descripcion: 'Se inaugura la cancha de césped sintético de hockey, una de las primeras en la zona norte.' },
            { anio: '2018', titulo: 'Club House nuevo',           descripcion: 'Se inaugura el Club House con buffet, vestuarios remodelados y salón de usos múltiples.' },
            { anio: '2024', titulo: 'Más de 500 socios',          descripcion: 'El club alcanza los 500 socios activos, con divisiones formativas en todas las categorías.' },
          ],
        }),
        tipo: 'JSON',
        modulo: 'CONTENIDO',
      },
    })
    console.log('  ✓ Página Historia')
  } catch (e) {
    console.warn(`  ! No se pudo crear página historia: ${e.message}`)
  }
}

// ────────────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
