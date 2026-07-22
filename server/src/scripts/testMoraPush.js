/**
 * Script puntual: envía aviso de morosidad por WA al socio indicado,
 * saltando flags notif_whatsapp y WHATSAPP_NOTIF_MORA.
 * Uso: node src/scripts/testMoraPush.js <socioId>
 */
import 'dotenv/config'
import prisma from '../lib/prisma.js'
import { createTenantPrisma } from '../lib/tenantPrisma.js'
import { notificarMora, obtenerTelefonoSocio } from '../services/whatsappService.js'

const socioId = parseInt(process.argv[2] || '7278', 10)

const socio = await prisma.socio.findUnique({
  where: { id: socioId },
  include: {
    titularFamilia: true,
    miembrosFamilia: { select: { id: true } },
  },
})

if (!socio) {
  console.error(`Socio ${socioId} no encontrado`)
  process.exit(1)
}

const destinatario = socio.titularFamilia || socio

const socioIds = (() => {
  if (destinatario.id === socio.id && socio.miembrosFamilia?.length > 0)
    return [socio.id, ...socio.miembrosFamilia.map(m => m.id)]
  if (destinatario.id !== socio.id) return null // se resuelve abajo
  return [socio.id]
})()

let ids = socioIds
if (!ids) {
  const grupo = await prisma.socio.findMany({
    where: { OR: [{ id: destinatario.id }, { titularFamiliaId: destinatario.id }] },
    select: { id: true },
  })
  ids = grupo.map(s => s.id)
}

const cuotasVencidas = await prisma.cargo.findMany({
  where: {
    socioId: { in: ids },
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: new Date() },
  },
})

if (cuotasVencidas.length === 0) {
  console.log('Sin cuotas vencidas — no se envía nada.')
  process.exit(0)
}

const totalAdeudado = cuotasVencidas.reduce((s, c) => s + Number(c.montoTotal), 0)
const telefono = obtenerTelefonoSocio(destinatario)

console.log(`Socio:      ${destinatario.apellidoNombre} (id=${destinatario.id})`)
console.log(`Teléfono:   ${telefono || '— SIN TELÉFONO —'}`)
console.log(`Cuotas:     ${cuotasVencidas.length}`)
console.log(`Total:      $${totalAdeudado.toLocaleString('es-AR')}`)

if (!telefono) {
  console.error('Sin teléfono válido. Abortando.')
  process.exit(1)
}

const db = createTenantPrisma(destinatario.tenantId)

const resultado = await notificarMora({
  db,
  tenantId: destinatario.tenantId,
  socio: destinatario,
  deuda: { total: totalAdeudado },
})

console.log('Resultado WA:', JSON.stringify(resultado, null, 2))
await prisma.$disconnect()
