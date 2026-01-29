import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const emailTemplates = [
  {
    eventType: 'CUOTA_PROX_VENCER',
    nombre: 'Recordatorio - Cuota Próxima a Vencer',
    descripcion: 'Email automático enviado 5 días antes del vencimiento de una cuota',
    subject: 'Recordatorio: Tu cuota vence en {{diasRestantes}} días',
    bodyHtml: String.raw`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
  <!-- Header -->
  <div style="background-color: #DC2626; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Club Sportivo Pilar</h1>
    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">"El Rojo de la Avenida"</p>
  </div>

  <!-- Body -->
  <div style="padding: 40px 30px; background-color: white;">
    <h2 style="color: #1f2937; margin-top: 0;">Hola {{socioNombre}} 👋</h2>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
      Te recordamos que tenés una cuota próxima a vencer.
    </p>

    <div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: bold;">📋 Detalle de la cuota:</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Descripción:</strong> {{cargoDescripcion}}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Monto:</strong> $ {{montoTotal}}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Vence:</strong> {{fechaVencimiento}}</p>
      <p style="margin: 5px 0; color: #DC2626; font-size: 18px; font-weight: bold;">⏰ Quedan {{diasRestantes}} días</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      Podés pagar tu cuota de forma rápida y segura desde nuestro portal:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{linkPortal}}" style="display: inline-block; background-color: #DC2626; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        💳 Pagar Ahora
      </a>
    </div>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0 0 10px 0; color: #1f2937; font-weight: bold;">📌 Formas de pago disponibles:</p>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
        <li>MercadoPago (tarjeta de crédito/débito)</li>
        <li>MODO</li>
        <li>Transferencia bancaria</li>
        <li>Pago en efectivo en el club</li>
      </ul>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; line-height: 1.5;">
      <strong>Nota:</strong> Si ya pagaste, por favor ignorá este email. Los pagos pueden demorar 24-48hs en verse reflejados.
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #1f2937; padding: 25px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      Club Sportivo Pilar<br>
      Socio Nº {{nroSocio}}
    </p>
    <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 11px;">
      Este es un email automático, por favor no respondas a este mensaje.
    </p>
  </div>
</div>
    `,
    bodyText: 'Hola {{socioNombre}}, te recordamos que tu cuota vence en {{diasRestantes}} días. Monto: $ {{montoTotal}}. Ingresá a {{linkPortal}} para pagar.',
    variables: JSON.stringify([
      { name: 'socioNombre', description: 'Nombre del socio', example: 'Juan Pérez' },
      { name: 'nroSocio', description: 'Número de socio', example: '1234' },
      { name: 'cargoDescripcion', description: 'Descripción de la cuota', example: 'Cuota mensual' },
      { name: 'montoTotal', description: 'Monto total a pagar', example: '5000.00' },
      { name: 'fechaVencimiento', description: 'Fecha de vencimiento', example: '15/02/2026' },
      { name: 'diasRestantes', description: 'Días que faltan para el vencimiento', example: '5' },
      { name: 'linkPortal', description: 'Link al portal del socio', example: 'https://...' },
    ]),
    isActive: true,
  },

  {
    eventType: 'CUOTA_VENCIDA',
    nombre: 'Notificación - Cuota Vencida',
    descripcion: 'Email automático enviado el día del vencimiento de una cuota',
    subject: 'Tu cuota del Club Sportivo Pilar ha vencido',
    bodyHtml: String.raw`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
  <!-- Header -->
  <div style="background-color: #DC2626; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Club Sportivo Pilar</h1>
    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">"El Rojo de la Avenida"</p>
  </div>

  <!-- Body -->
  <div style="padding: 40px 30px; background-color: white;">
    <h2 style="color: #1f2937; margin-top: 0;">Hola {{socioNombre}} 👋</h2>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
      Te informamos que tu cuota venció el día de hoy.
    </p>

    <div style="background-color: #fef2f2; border-left: 4px solid #b91c1c; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: bold;">📋 Detalle de la cuota vencida:</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Descripción:</strong> {{cargoDescripcion}}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Monto:</strong> $ {{montoTotal}}</p>
      <p style="margin: 5px 0; color: #b91c1c; font-weight: bold;">📅 Venció el: {{fechaVencimiento}}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      Te pedimos que regularices tu situación a la brevedad para evitar recargos por mora.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{linkPortal}}" style="display: inline-block; background-color: #DC2626; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        💳 Pagar Ahora
      </a>
    </div>

    <div style="background-color: #fffbeb; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin-top: 25px;">
      <p style="margin: 0; color: #92400e;">
        ⚠️ <strong>Importante:</strong> Las cuotas vencidas generan recargos automáticos. Te recomendamos ponerte al día cuanto antes.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; line-height: 1.5;">
      Si ya pagaste, por favor ignorá este email. Los pagos pueden demorar 24-48hs en verse reflejados.
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #1f2937; padding: 25px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      Club Sportivo Pilar<br>
      Socio Nº {{nroSocio}}
    </p>
    <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 11px;">
      Este es un email automático, por favor no respondas a este mensaje.
    </p>
  </div>
</div>
    `,
    bodyText: 'Hola {{socioNombre}}, tu cuota venció el {{fechaVencimiento}}. Monto: $ {{montoTotal}}. Ingresá a {{linkPortal}} para pagar y evitar recargos.',
    variables: JSON.stringify([
      { name: 'socioNombre', description: 'Nombre del socio', example: 'Juan Pérez' },
      { name: 'nroSocio', description: 'Número de socio', example: '1234' },
      { name: 'cargoDescripcion', description: 'Descripción de la cuota', example: 'Cuota mensual' },
      { name: 'montoTotal', description: 'Monto total a pagar', example: '5000.00' },
      { name: 'fechaVencimiento', description: 'Fecha de vencimiento', example: '10/02/2026' },
      { name: 'linkPortal', description: 'Link al portal del socio', example: 'https://...' },
    ]),
    isActive: true,
  },

  {
    eventType: 'MOROSIDAD',
    nombre: 'Recordatorio de Morosidad',
    descripcion: 'Email automático enviado cada 15 días a socios con cuotas vencidas',
    subject: 'Recordatorio de pago - {{cantidadCuotas}} cuota(s) pendiente(s)',
    bodyHtml: String.raw`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
  <!-- Header -->
  <div style="background-color: #DC2626; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Club Sportivo Pilar</h1>
    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">"El Rojo de la Avenida"</p>
  </div>

  <!-- Body -->
  <div style="padding: 40px 30px; background-color: white;">
    <h2 style="color: #1f2937; margin-top: 0;">Hola {{socioNombre}} 👋</h2>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
      Te contactamos para recordarte que tenés cuotas pendientes de pago.
    </p>

    <div style="background-color: #fef2f2; border: 2px solid #b91c1c; padding: 25px; margin: 25px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #991b1b; font-size: 16px;">💰 <strong>Total adeudado:</strong></p>
      <p style="margin: 10px 0 0 0; color: #b91c1c; font-size: 32px; font-weight: bold;">$ {{totalAdeudado}}</p>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">{{cantidadCuotas}} cuota(s) pendiente(s)</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      Te pedimos que regularices tu situación a la brevedad. Si tenés dificultades para el pago, acercate al club para coordinar un plan de pagos.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{linkPortal}}" style="display: inline-block; background-color: #DC2626; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        💳 Ver Deuda y Pagar
      </a>
    </div>

    <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0 0 10px 0; color: #065f46; font-weight: bold;">💬 ¿Necesitás ayuda?</p>
      <p style="margin: 0; color: #047857; line-height: 1.5;">
        Comunicate con el club para coordinar un plan de pagos que se ajuste a tus posibilidades.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; line-height: 1.5;">
      <strong>Nota:</strong> Si ya pagaste, por favor ignorá este email. Los pagos pueden demorar 24-48hs en verse reflejados.
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #1f2937; padding: 25px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      Club Sportivo Pilar<br>
      Socio Nº {{nroSocio}}
    </p>
    <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 11px;">
      Este es un email automático, por favor no respondas a este mensaje.
    </p>
  </div>
</div>
    `,
    bodyText: 'Hola {{socioNombre}}, tenés {{cantidadCuotas}} cuota(s) pendiente(s) por un total de $ {{totalAdeudado}}. Ingresá a {{linkPortal}} para pagar.',
    variables: JSON.stringify([
      { name: 'socioNombre', description: 'Nombre del socio', example: 'Juan Pérez' },
      { name: 'nroSocio', description: 'Número de socio', example: '1234' },
      { name: 'cantidadCuotas', description: 'Cantidad de cuotas pendientes', example: '3' },
      { name: 'totalAdeudado', description: 'Total adeudado', example: '15000.00' },
      { name: 'linkPortal', description: 'Link al portal del socio', example: 'https://...' },
    ]),
    isActive: true,
  },

  {
    eventType: 'INSCRIPCION_CONFIRMADA',
    nombre: 'Confirmación de Inscripción',
    descripcion: 'Email automático enviado al inscribirse a una actividad deportiva',
    subject: '¡Inscripción confirmada! {{actividad}} - {{categoria}}',
    bodyHtml: String.raw`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
  <!-- Header -->
  <div style="background-color: #DC2626; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Club Sportivo Pilar</h1>
    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">"El Rojo de la Avenida"</p>
  </div>

  <!-- Body -->
  <div style="padding: 40px 30px; background-color: white;">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 60px;">⚽</span>
    </div>

    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">¡Inscripción Confirmada!</h2>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px; text-align: center;">
      ¡Felicitaciones <strong>{{socioNombre}}</strong>!<br>
      Tu inscripción ha sido confirmada exitosamente.
    </p>

    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 25px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0 0 15px 0; color: #065f46; font-weight: bold; font-size: 18px;">📋 Detalles de la inscripción:</p>
      <p style="margin: 8px 0; color: #374151; font-size: 16px;"><strong>Actividad:</strong> {{actividad}}</p>
      <p style="margin: 8px 0; color: #374151; font-size: 16px;"><strong>Categoría:</strong> {{categoria}}</p>
      <p style="margin: 8px 0; color: #374151; font-size: 16px;"><strong>Inicio:</strong> {{fechaInicio}}</p>
    </div>

    <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: bold;">📍 Próximos pasos:</p>
      <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8;">
        <li>Presentate en el club en el horario de entrenamiento</li>
        <li>Llevá tu apto físico vigente</li>
        <li>Consultá los horarios en el portal del socio</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{linkPortal}}" style="display: inline-block; background-color: #DC2626; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        📱 Ver en Mi Portal
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
      ¡Te esperamos en el club! 🎉
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #1f2937; padding: 25px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      Club Sportivo Pilar<br>
      Socio Nº {{nroSocio}}
    </p>
  </div>
</div>
    `,
    bodyText: '¡Hola {{socioNombre}}! Tu inscripción a {{actividad}} - {{categoria}} ha sido confirmada. Inicio: {{fechaVencimiento}}. ¡Te esperamos!',
    variables: JSON.stringify([
      { name: 'socioNombre', description: 'Nombre del socio', example: 'Juan Pérez' },
      { name: 'nroSocio', description: 'Número de socio', example: '1234' },
      { name: 'actividad', description: 'Nombre de la actividad', example: 'Fútbol' },
      { name: 'categoria', description: 'Categoría de la actividad', example: 'Primera división' },
      { name: 'fechaInicio', description: 'Fecha de inicio', example: '01/03/2026' },
      { name: 'linkPortal', description: 'Link al portal del socio', example: 'https://...' },
    ]),
    isActive: true,
  },

  {
    eventType: 'BIENVENIDA',
    nombre: 'Email de Bienvenida',
    descripcion: 'Email automático enviado a nuevos socios al darse de alta',
    subject: '¡Bienvenido al Club Sportivo Pilar!',
    bodyHtml: String.raw`
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
  <!-- Header -->
  <div style="background-color: #DC2626; padding: 40px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px;">¡Bienvenido!</h1>
    <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Club Sportivo Pilar</p>
    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">"El Rojo de la Avenida"</p>
  </div>

  <!-- Body -->
  <div style="padding: 40px 30px; background-color: white;">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 60px;">🎉</span>
    </div>

    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">¡Ya sos parte de la familia roja!</h2>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
      Hola <strong>{{socioNombre}}</strong>,
    </p>

    <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
      Nos alegra enormemente darte la bienvenida al <strong>Club Sportivo Pilar</strong>. Desde hoy sos parte de nuestra gran familia.
    </p>

    <div style="background-color: #ecfdf5; border: 2px solid #10b981; padding: 25px; margin: 30px 0; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #065f46; font-size: 16px;">🎫 <strong>Tu número de socio es:</strong></p>
      <p style="margin: 10px 0 0 0; color: #047857; font-size: 36px; font-weight: bold;">{{nroSocio}}</p>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">Fecha de alta: {{fechaAlta}}</p>
    </div>

    <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0 0 15px 0; color: #1e40af; font-weight: bold; font-size: 18px;">🚀 ¿Qué podés hacer ahora?</p>
      <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 2;">
        <li>Acceder a tu portal personal</li>
        <li>Ver y pagar tus cuotas online</li>
        <li>Obtener tu QR para descuentos</li>
        <li>Inscribirte en actividades deportivas</li>
        <li>Consultar tu estado de cuenta</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="{{linkPortal}}" style="display: inline-block; background-color: #DC2626; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
        🏠 Ir a Mi Portal
      </a>
      <br>
      <a href="{{linkMiQR}}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        📱 Obtener Mi QR
      </a>
    </div>

    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-weight: bold;">💳 Rojo Plus - Programa de Beneficios</p>
      <p style="margin: 0; color: #7c2d12; line-height: 1.6;">
        Como socio, tenés descuentos exclusivos en comercios adheridos. Mostrá tu QR al pagar y disfrutá de los beneficios.
      </p>
    </div>

    <p style="color: #1f2937; font-size: 16px; margin-top: 35px; text-align: center; line-height: 1.6;">
      <strong>¡Gracias por elegirnos!</strong><br>
      <span style="color: #6b7280; font-size: 14px;">Te esperamos en el club</span>
    </p>
  </div>

  <!-- Footer -->
  <div style="background-color: #1f2937; padding: 25px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
      Club Sportivo Pilar<br>
      Socio Nº {{nroSocio}}
    </p>
  </div>
</div>
    `,
    bodyText: '¡Bienvenido {{socioNombre}}! Ya sos parte del Club Sportivo Pilar. Tu número de socio es {{nroSocio}}. Accedé a tu portal en {{linkPortal}} y obtené tu QR en {{linkMiQR}}.',
    variables: JSON.stringify([
      { name: 'socioNombre', description: 'Nombre del socio', example: 'Juan Pérez' },
      { name: 'nroSocio', description: 'Número de socio', example: '1234' },
      { name: 'fechaAlta', description: 'Fecha de alta', example: '20/01/2026' },
      { name: 'linkPortal', description: 'Link al portal del socio', example: 'https://...' },
      { name: 'linkMiQR', description: 'Link para obtener el QR', example: 'https://...' },
    ]),
    isActive: true,
  },
]

export async function seedEmailTemplates() {
  console.log('\n📧 Creando templates de email para notificaciones automáticas...\n')

  for (const template of emailTemplates) {
    try {
      const existing = await prisma.emailTemplate.findUnique({
        where: { eventType: template.eventType },
      })

      if (existing) {
        console.log(`⏭️  Template "${template.eventType}" ya existe, actualizando...`)
        await prisma.emailTemplate.update({
          where: { eventType: template.eventType },
          data: template,
        })
      } else {
        console.log(`✅ Creando template "${template.nombre}"...`)
        await prisma.emailTemplate.create({
          data: template,
        })
      }
    } catch (error) {
      console.error(`❌ Error con template "${template.eventType}":`, error.message)
    }
  }

  console.log('\n✅ Templates de email creados exitosamente\n')
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedEmailTemplates()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error)
      prisma.$disconnect()
      process.exit(1)
    })
}

export default seedEmailTemplates
