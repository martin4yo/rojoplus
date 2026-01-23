import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding templates...')

  // Email Templates
  console.log('\n📧 Seeding Email Templates...')
  
  const emailTemplates = [
    {
      eventType: 'COMPROBANTE_PAGO',
      nombre: 'Comprobante de Pago',
      descripcion: 'Se envía al socio después de realizar un pago exitoso',
      subject: 'Comprobante de Pago - {{clubNombre}}',
      bodyHtml: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1>Comprobante de Pago</h1><p>Hola {{socioNombre}}, tu pago fue procesado correctamente.</p><p>Recibo Nro: {{numero}}</p><p>Total: ${{montoTotal}}</p></div>',
      bodyText: 'Comprobante de Pago - Recibo {{numero}} - Total: ${{montoTotal}}',
      variables: '["clubNombre","socioNombre","numero","fecha","medioPago","montoTotal","items"]',
      isActive: true
    },
    {
      eventType: 'PAGO_CONFIRMADO',
      nombre: 'Pago Manual Confirmado',
      descripcion: 'Se envía cuando el admin confirma un pago informado por transferencia',
      subject: '✅ Pago Confirmado - {{clubNombre}}',
      bodyHtml: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1 style="color: green;">✅ Pago Confirmado</h1><p>Hola {{socioNombre}}, confirmamos que recibimos tu pago.</p><p>Recibo Nro: {{numero}}</p><p>Monto: ${{montoTotal}}</p></div>',
      bodyText: 'Pago Confirmado - Recibo {{numero}} - Monto: ${{montoTotal}}',
      variables: '["clubNombre","socioNombre","numero","fecha","montoTotal"]',
      isActive: true
    },
    {
      eventType: 'PAGO_RECHAZADO',
      nombre: 'Pago Manual Rechazado',
      descripcion: 'Se envía cuando el admin rechaza un pago informado',
      subject: '❌ Pago No Confirmado - {{clubNombre}}',
      bodyHtml: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1 style="color: red;">❌ Pago No Confirmado</h1><p>Hola {{socioNombre}}, no pudimos confirmar tu pago.</p><p>Motivo: {{motivoRechazo}}</p><p>Contacto: {{clubTelefono}}</p></div>',
      bodyText: 'Pago No Confirmado - Motivo: {{motivoRechazo}}',
      variables: '["clubNombre","clubTelefono","socioNombre","motivoRechazo"]',
      isActive: true
    }
  ]

  for (const template of emailTemplates) {
    const created = await prisma.emailTemplate.upsert({
      where: { eventType: template.eventType },
      update: template,
      create: template,
    })
    console.log('✅ ' + created.nombre)
  }

  // PDF Templates
  console.log('\n📄 Seeding PDF Templates...')
  
  const pdfTemplates = [
    {
      tipo: 'RECIBO',
      nombre: 'Recibo de Pago',
      descripcion: 'Comprobante de pago estándar',
      htmlContent: '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div class="recibo"><h1>{{clubNombre}}</h1><h2>RECIBO Nro. {{numero}}</h2><p>Fecha: {{fecha}}</p><p>Socio: {{socioNombre}}</p><table><tbody>{{#each items}}<tr><td>{{concepto}}</td><td>${{monto}}</td></tr>{{/each}}</tbody><tfoot><tr><td>TOTAL</td><td>${{montoTotal}}</td></tr></tfoot></table></div></body></html>',
      cssContent: 'body{font-family:Arial;} table{width:100%;border-collapse:collapse;} td{padding:8px;border:1px solid #ccc;} h1{color:#DC2626;} h2{margin:10px 0;}',
      variables: '["clubNombre","numero","fecha","socioNombre","montoTotal","items"]',
      pageFormat: 'A4',
      orientation: 'portrait',
      isActive: true
    },
    {
      tipo: 'FACTURA',
      nombre: 'Factura',
      descripcion: 'Factura para actividades comerciales',
      htmlContent: '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div class="factura"><h1>{{clubNombre}}</h1><h2>FACTURA {{tipoFactura}}</h2><p>{{numeroFactura}}</p><p>Cliente: {{clienteNombre}}</p><table><tbody>{{#each items}}<tr><td>{{descripcion}}</td><td>${{subtotal}}</td></tr>{{/each}}</tbody><tfoot><tr><td>TOTAL</td><td>${{total}}</td></tr></tfoot></table></div></body></html>',
      cssContent: 'body{font-family:Arial;} table{width:100%;border-collapse:collapse;} td{padding:8px;border:1px solid #ccc;}',
      variables: '["clubNombre","tipoFactura","numeroFactura","clienteNombre","total","items"]',
      pageFormat: 'A4',
      orientation: 'portrait',
      isActive: true
    }
  ]

  for (const template of pdfTemplates) {
    const created = await prisma.pdfTemplate.upsert({
      where: { tipo: template.tipo },
      update: template,
      create: template,
    })
    console.log('✅ ' + created.nombre)
  }

  console.log('\n✨ Templates seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
