/**
 * Datos de operación de prueba para el tenant "sanandres":
 *   1. Cargos de personal
 *   2. Entidades: empleados (PERSONAL), clientes y proveedores
 *   3. Mesas del salón y la terraza (para generar ventas de buffet)
 *   4. Imputación contable de ventas de los artículos ya creados:
 *      Producto.conceptoVentaId y ProductoBuffet.cuentaContableId
 *
 * Los códigos de entidad siguen la convención del tenant de referencia:
 * PERS-AAAA-00001 / CLI-AAAA-00001 / PROV-AAAA-00001.
 * Los CUIT son inventados pero con dígito verificador válido, así no los
 * rechaza ninguna validación de AFIP.
 *
 * Idempotente: saltea lo que ya existe (por código / número de mesa).
 *
 * Uso:
 *   node scripts/seedOperacionSanAndres.js            # dry-run
 *   node scripts/seedOperacionSanAndres.js --apply
 */
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()
const SUBDOMAIN = 'sanandres'
const APPLY = process.argv.includes('--apply')
const ANIO = 2026

/** Dígito verificador de CUIT (mod 11), para que los documentos sean válidos. */
function cuit(prefijo, base8) {
  const cuerpo = `${prefijo}${base8}`
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = cuerpo.split('').reduce((s, d, i) => s + Number(d) * pesos[i], 0)
  const resto = suma % 11
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto
  return `${prefijo}-${base8}-${dv}`
}

const CARGOS = [
  { codigo: 'ADM', nombre: 'Administración', orden: 1 },
  { codigo: 'BUFFET', nombre: 'Buffet', orden: 2 },
  { codigo: 'MANT', nombre: 'Mantenimiento', orden: 3 },
  { codigo: 'ENTRE', nombre: 'Entrenador', esEntrenador: true, orden: 4 },
  { codigo: 'SEG', nombre: 'Seguridad', orden: 5 },
]

const EMPLEADOS = [
  { nombre: 'Gómez, Fernando',   dni: '28455120', cargo: 'ADM',    cc: 'ADM',    sueldo: 980000, ingreso: '2019-03-01' },
  { nombre: 'Ríos, Marisa',      dni: '30122455', cargo: 'ADM',    cc: 'ADM',    sueldo: 820000, ingreso: '2021-06-15' },
  { nombre: 'Ferrari, Lucía',    dni: '27988100', cargo: 'ADM',    cc: 'ADM',    sueldo: 1150000, ingreso: '2017-02-01' },
  { nombre: 'Peralta, Julián',   dni: '32544871', cargo: 'BUFFET', cc: 'BUFFET', sueldo: 900000, ingreso: '2020-09-01' },
  { nombre: 'Cabrera, Nadia',    dni: '38771203', cargo: 'BUFFET', cc: 'BUFFET', sueldo: 720000, ingreso: '2023-01-10' },
  { nombre: 'Ponce, Matías',     dni: '41209855', cargo: 'BUFFET', cc: 'BUFFET', sueldo: 690000, ingreso: '2024-04-01' },
  { nombre: 'Sosa, Ramón',       dni: '24011788', cargo: 'MANT',   cc: 'ADM',    sueldo: 850000, ingreso: '2015-08-01' },
  { nombre: 'Medina, Osvaldo',   dni: '26700341', cargo: 'SEG',    cc: 'ADM',    sueldo: 780000, ingreso: '2018-11-01' },
  { nombre: 'Vera, Diego',       dni: '31455900', cargo: 'ENTRE',  cc: 'RUGBY',  sueldo: 950000, ingreso: '2021-02-15' },
  { nombre: 'Luna, Carolina',    dni: '33670122', cargo: 'ENTRE',  cc: 'HOCKEY', sueldo: 950000, ingreso: '2022-03-01' },
]

const CLIENTES = [
  { razon: 'Colegio Los Robles',            fantasia: 'Los Robles',        iva: 'EXENTO',                 cuit: cuit('30', '71455028'), email: 'admin@losrobles.test',      tel: '11 4555-1200' },
  { razon: 'Constructora Pilar Norte SRL',  fantasia: 'Pilar Norte',       iva: 'RESPONSABLE INSCRIPTO',  cuit: cuit('30', '71203456'), email: 'compras@pilarnorte.test',   tel: '11 4555-2233' },
  { razon: 'Eventos del Delta SA',          fantasia: 'Eventos Delta',     iva: 'RESPONSABLE INSCRIPTO',  cuit: cuit('30', '70998877'), email: 'contacto@eventosdelta.test', tel: '11 4555-3344' },
  { razon: 'Gimnasio Aconcagua',            fantasia: 'Aconcagua Fit',     iva: 'MONOTRIBUTISTA',         cuit: cuit('27', '30455112'), email: 'hola@aconcaguafit.test',    tel: '11 4555-4455' },
  { razon: 'Club Vecinal Los Álamos',       fantasia: 'Los Álamos',        iva: 'EXENTO',                 cuit: cuit('30', '68112390'), email: 'secretaria@losalamos.test', tel: '11 4555-5566' },
  { razon: 'Panadería La Espiga',           fantasia: 'La Espiga',         iva: 'MONOTRIBUTISTA',         cuit: cuit('20', '28455120'), email: 'laespiga@correo.test',      tel: '11 4555-6677' },
]

const PROVEEDORES = [
  { razon: 'Distribuidora Benavídez SRL', fantasia: 'Distri Benavídez', iva: 'RESPONSABLE INSCRIPTO', cuit: cuit('30', '71455900'), rubro: 'Bebidas y gaseosas',        tel: '11 4700-1100' },
  { razon: 'Frigorífico Del Valle SA',    fantasia: 'Del Valle',        iva: 'RESPONSABLE INSCRIPTO', cuit: cuit('30', '70112388'), rubro: 'Carnes y fiambres',         tel: '11 4700-2200' },
  { razon: 'Panificados Doña Rosa',       fantasia: 'Doña Rosa',        iva: 'MONOTRIBUTISTA',        cuit: cuit('27', '29001455'), rubro: 'Panadería y facturas',      tel: '11 4700-3300' },
  { razon: 'Lácteos del Litoral SA',      fantasia: 'Del Litoral',      iva: 'RESPONSABLE INSCRIPTO', cuit: cuit('30', '69887744'), rubro: 'Lácteos',                   tel: '11 4700-4400' },
  { razon: 'Textil Andina SA',            fantasia: 'Textil Andina',    iva: 'RESPONSABLE INSCRIPTO', cuit: cuit('30', '71009922'), rubro: 'Indumentaria deportiva',    tel: '11 4700-5500' },
  { razon: 'Deportes Sur SRL',            fantasia: 'Deportes Sur',     iva: 'RESPONSABLE INSCRIPTO', cuit: cuit('30', '70554411'), rubro: 'Artículos deportivos',      tel: '11 4700-6600' },
  { razon: 'Limpieza Total SRL',          fantasia: 'Limpieza Total',   iva: 'MONOTRIBUTISTA',        cuit: cuit('30', '71880033'), rubro: 'Insumos de limpieza',       tel: '11 4700-7700' },
  { razon: 'Ferretería El Tornillo',      fantasia: 'El Tornillo',      iva: 'MONOTRIBUTISTA',        cuit: cuit('20', '24011788'), rubro: 'Ferretería y mantenimiento', tel: '11 4700-8800' },
]

// Mesas: 12 en el salón + 4 en la terraza + 1 comunal
const MESAS = [
  ...Array.from({ length: 8 }, (_, i) => ({ numero: i + 1, capacidad: 4, zona: 'Salón' })),
  ...Array.from({ length: 4 }, (_, i) => ({ numero: i + 9, capacidad: 6, zona: 'Salón' })),
  ...Array.from({ length: 4 }, (_, i) => ({ numero: i + 13, capacidad: 4, zona: 'Terraza' })),
  { numero: 17, capacidad: 12, zona: 'Salón', nombre: 'Mesa comunal', esComunal: true },
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
  console.log(`A crear: ${CARGOS.length} cargos, ${EMPLEADOS.length} empleados, ${CLIENTES.length} clientes, ${PROVEEDORES.length} proveedores, ${MESAS.length} mesas`)
  console.log(`         + imputación contable de ventas en los artículos existentes`)

  if (!APPLY) {
    console.log('\n(dry-run) Volvé a ejecutar con --apply para escribir.')
    return
  }

  // ── 1. Cargos de personal ──────────────────────────────────────────
  const cargos = {}
  for (const c of CARGOS) {
    cargos[c.codigo] = await prisma.cargoPersonal.findFirst({ where: { tenantId, codigo: c.codigo } })
      ?? await prisma.cargoPersonal.create({ data: { ...c, tenantId, activo: true } })
  }
  console.log(`✓ Cargos de personal: ${Object.keys(cargos).join(', ')}`)

  const centros = Object.fromEntries(
    (await prisma.centroCosto.findMany({ where: { tenantId } })).map(c => [c.codigo, c.id])
  )

  // ── 2. Entidades ───────────────────────────────────────────────────
  const crearEntidad = async (codigo, data) => {
    const existente = await prisma.entidad.findFirst({ where: { tenantId, codigo } })
    if (existente) return false
    await prisma.entidad.create({ data: { ...data, codigo, tenantId, activo: true } })
    return true
  }

  let nEmp = 0
  for (const [i, e] of EMPLEADOS.entries()) {
    const codigo = `PERS-${ANIO}-${String(i + 1).padStart(5, '0')}`
    const creado = await crearEntidad(codigo, {
      tipo: 'PERSONAL',
      razonSocial: e.nombre,
      tipoDocumento: 'DNI',
      documento: e.dni,
      email: `${e.nombre.split(',')[1].trim().toLowerCase()}.${e.nombre.split(',')[0].toLowerCase()}@sanandres.test`
        .normalize('NFD').replace(/[̀-ͯ]/g, ''),
      telefono: `11 5${String(2000000 + i * 13457).slice(0, 7)}`,
      ciudad: 'Benavidez',
      provincia: 'Buenos Aires',
      legajo: String(100 + i + 1),
      fechaIngreso: new Date(e.ingreso),
      sueldoBasico: e.sueldo,
      cargoPersonalId: cargos[e.cargo].id,
      centroCostoId: centros[e.cc] ?? null,
    })
    if (creado) nEmp++
  }
  console.log(`✓ Empleados (PERSONAL): ${nEmp}`)

  let nCli = 0
  for (const [i, c] of CLIENTES.entries()) {
    const codigo = `CLI-${ANIO}-${String(i + 1).padStart(5, '0')}`
    const creado = await crearEntidad(codigo, {
      tipo: 'CLIENTE',
      razonSocial: c.razon,
      nombreFantasia: c.fantasia,
      tipoDocumento: 'CUIT',
      documento: c.cuit,
      condicionIva: c.iva,
      email: c.email,
      telefono: c.tel,
      ciudad: 'Benavidez',
      provincia: 'Buenos Aires',
    })
    if (creado) nCli++
  }
  console.log(`✓ Clientes: ${nCli}`)

  let nProv = 0
  for (const [i, p] of PROVEEDORES.entries()) {
    const codigo = `PROV-${ANIO}-${String(i + 1).padStart(5, '0')}`
    const creado = await crearEntidad(codigo, {
      tipo: 'PROVEEDOR',
      razonSocial: p.razon,
      nombreFantasia: p.fantasia,
      tipoDocumento: 'CUIT',
      documento: p.cuit,
      condicionIva: p.iva,
      telefono: p.tel,
      ciudad: 'Benavidez',
      provincia: 'Buenos Aires',
      observaciones: p.rubro,
    })
    if (creado) nProv++
  }
  console.log(`✓ Proveedores: ${nProv}`)

  // ── 3. Mesas ───────────────────────────────────────────────────────
  let nMesas = 0
  for (const m of MESAS) {
    const existente = await prisma.mesa.findFirst({ where: { tenantId, numero: m.numero } })
    if (existente) continue
    await prisma.mesa.create({
      data: {
        tenantId,
        numero: m.numero,
        nombre: m.nombre ?? String(m.numero).padStart(3, '0'),
        capacidad: m.capacidad,
        zona: m.zona,
        esComunal: !!m.esComunal,
        estado: 'LIBRE',
        activo: true,
      },
    })
    nMesas++
  }
  console.log(`✓ Mesas: ${nMesas}`)

  // ── 4. Imputación contable de ventas ───────────────────────────────
  const cuenta4 = await prisma.cuentaContable.findFirst({ where: { tenantId, codigo: '4' } })
  const cuentaBuffet = await prisma.cuentaContable.findFirst({ where: { tenantId, codigo: '4.3' } })
  const cuentaTienda = await prisma.cuentaContable.findFirst({ where: { tenantId, codigo: '4.5' } })
    ?? await prisma.cuentaContable.create({
      data: { tenantId, codigo: '4.5', nombre: 'Tienda y Merchandising', tipo: 'INGRESO', nivel: 2, padreId: cuenta4?.id ?? null, esImputable: true, orden: 45 },
    })

  const conceptoBuffet = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-BUF' } })
  const conceptoTienda = await prisma.conceptoTesoreria.findFirst({ where: { tenantId, codigo: 'ING-TIE' } })
    ?? await prisma.conceptoTesoreria.create({
      data: {
        tenantId, codigo: 'ING-TIE', nombre: 'Ingresos Tienda', tipo: 'INGRESO',
        usaEnTesoreria: true, usaEnVentas: true, usaEnCompras: false, orden: 11,
        cuentaContableId: cuentaTienda.id, centroCostoId: centros.ADM ?? null,
      },
    })

  // El concepto de buffet venía sin cuenta ni centro de costo asignados
  if (conceptoBuffet && (!conceptoBuffet.cuentaContableId || !conceptoBuffet.centroCostoId)) {
    await prisma.conceptoTesoreria.update({
      where: { id: conceptoBuffet.id },
      data: {
        cuentaContableId: conceptoBuffet.cuentaContableId ?? cuentaBuffet?.id ?? null,
        centroCostoId: conceptoBuffet.centroCostoId ?? centros.BUFFET ?? null,
      },
    })
    console.log('✓ Concepto ING-BUF vinculado a la cuenta 4.3 y al centro de costo BUFFET')
  }

  const merch = await prisma.producto.updateMany({
    where: { tenantId, publicarEnTienda: true, conceptoVentaId: null },
    data: { conceptoVentaId: conceptoTienda.id },
  })
  const buffetProds = await prisma.producto.updateMany({
    where: { tenantId, publicarEnTienda: false, conceptoVentaId: null, productoBuffet: { isNot: null } },
    data: { conceptoVentaId: conceptoBuffet?.id ?? null },
  })
  const pbuffet = await prisma.productoBuffet.updateMany({
    where: { tenantId, cuentaContableId: null },
    data: { cuentaContableId: cuentaBuffet?.id ?? null },
  })
  console.log(`✓ Concepto de venta: ${merch.count} de merchandising → ING-TIE, ${buffetProds.count} de buffet/kiosco → ING-BUF`)
  console.log(`✓ Cuenta contable en ProductoBuffet: ${pbuffet.count} → 4.3 Buffet`)

  console.log('\n✅ Datos de operación creados.')
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
