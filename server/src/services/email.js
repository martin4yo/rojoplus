import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

// Verificar si está en modo demo y obtener el email de prueba
async function getModoDemo() {
  try {
    const [modoDemo, emailDemo] = await Promise.all([
      prisma.configuracion.findUnique({ where: { clave: 'MODO_DEMO' } }),
      prisma.configuracion.findUnique({ where: { clave: 'EMAIL_DEMO' } }),
    ])
    return {
      activo: modoDemo?.valor === 'true',
      email: emailDemo?.valor || '',
    }
  } catch (error) {
    console.error('Error obteniendo modo demo:', error.message)
    return { activo: false, email: '' }
  }
}

// Función helper para enviar email (maneja modo demo)
async function enviarEmail({ to, subject, html }) {
  const modoDemo = await getModoDemo()

  let destinatario = to
  let subjectFinal = subject

  if (modoDemo.activo && modoDemo.email) {
    // En modo demo, redirigir al email de prueba
    destinatario = modoDemo.email
    subjectFinal = `[DEMO - Para: ${to}] ${subject}`
    console.log(`📧 MODO DEMO: Redirigiendo email de ${to} a ${modoDemo.email}`)
  }

  await transporter.sendMail({
    from: `"Rojo Plus" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: destinatario,
    subject: subjectFinal,
    html,
  })
}

export async function enviarEmailAprobacion(comercio) {
  const linkAcceso = `${frontendUrl}/comercio/${comercio.token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Rojo Plus - Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">¡Felicitaciones ${comercio.nombre}!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Tu solicitud para ser comercio adherido al programa <strong>Rojo Plus</strong> ha sido <strong style="color: #16a34a;">APROBADA</strong>.
        </p>

        <p style="color: #4b5563; line-height: 1.6;">
          A partir de ahora podés ofrecer descuentos a los socios del Club Sportivo Pilar.
        </p>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0 0 10px 0; font-weight: bold;">Tu link de acceso exclusivo:</p>
          <a href="${linkAcceso}" style="display: inline-block; background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Acceder al Sistema
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0 0;">
            O copiá este link: ${linkAcceso}
          </p>
        </div>

        <p style="color: #4b5563; line-height: 1.6;">
          <strong>Importante:</strong> Guardá este email. El link es tu acceso al sistema para validar socios y registrar ventas con descuento.
        </p>

        <p style="color: #4b5563; line-height: 1.6;">
          Descuento configurado: <strong>${comercio.descuentoPct}%</strong>
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: '¡Tu comercio fue aprobado! - Rojo Plus',
    html,
  })
}

export async function enviarEmailRechazo(comercio, motivo) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Rojo Plus - Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${comercio.nombre}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Lamentamos informarte que tu solicitud para ser comercio adherido al programa <strong>Rojo Plus</strong> no ha sido aprobada en esta oportunidad.
        </p>

        ${motivo ? `
        <div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0;"><strong>Motivo:</strong> ${motivo}</p>
        </div>
        ` : ''}

        <p style="color: #4b5563; line-height: 1.6;">
          Si tenés consultas o querés volver a intentarlo, contactanos a través de nuestros canales oficiales.
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: 'Actualización de tu solicitud - Rojo Plus',
    html,
  })
}

export async function enviarEmailLinkAcceso(comercio) {
  const linkAcceso = `${frontendUrl}/comercio/${comercio.token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Rojo Plus - Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${comercio.nombre}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Te reenviamos tu link de acceso al sistema Rojo Plus.
        </p>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0 0 10px 0; font-weight: bold;">Tu link de acceso:</p>
          <a href="${linkAcceso}" style="display: inline-block; background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Acceder al Sistema
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0 0;">
            O copiá este link: ${linkAcceso}
          </p>
        </div>

        <p style="color: #4b5563; line-height: 1.6;">
          Recordá guardar este email para tener siempre tu link de acceso disponible.
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: 'Tu link de acceso - Rojo Plus',
    html,
  })
}

// Enviar recibo de pago por email
export async function enviarReciboPago(pago) {
  // Si el socio no tiene email, no enviar
  if (!pago.socio?.email) {
    console.log(`📧 Recibo ${pago.numero}: socio sin email, no se envía`)
    return false
  }

  const fechaPago = new Date(pago.fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Compatibilidad: usar cargos o cuotas (el schema usa "cargos")
  const cargos = pago.cargos || pago.cuotas || []
  const cuotasHtml = cargos.map(c => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.tipoCuota?.nombre || 'Cuota'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.periodo?.nombre || '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.categoriaActividad ? c.categoriaActividad.actividad?.nombre + ' - ' + c.categoriaActividad.nombre : '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(c.montoTotal).toLocaleString('es-AR')}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Recibo de Pago</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <div style="background-color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
            <div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">RECIBO Nº</p>
              <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: bold;">${pago.numero}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">FECHA</p>
              <p style="margin: 0; color: #1f2937;">${fechaPago}</p>
            </div>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 15px;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">SOCIO</p>
            <p style="margin: 0; color: #1f2937; font-weight: bold;">${pago.socio.apellidoNombre}</p>
            <p style="margin: 0; color: #6b7280;">Socio #${pago.socio.nroSocio} ${pago.socio.documento ? '• DNI: ' + pago.socio.documento : ''}</p>
          </div>
        </div>

        <div style="background-color: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280;">CONCEPTO</th>
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280;">PERIODO</th>
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280;">ACTIVIDAD</th>
                <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #6b7280;">IMPORTE</th>
              </tr>
            </thead>
            <tbody>
              ${cuotasHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #fef2f2;">
                <td colspan="3" style="padding: 12px 8px; font-weight: bold; color: #1f2937;">TOTAL PAGADO</td>
                <td style="padding: 12px 8px; font-weight: bold; color: #DC2626; text-align: right; font-size: 18px;">$${Number(pago.montoTotal).toLocaleString('es-AR')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top: 20px; padding: 15px; background-color: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">
            <strong>✓ Pago registrado correctamente</strong><br>
            Medio de pago: ${pago.medioPago?.nombre || 'No especificado'}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 12px; margin-top: 20px; text-align: center;">
          Este recibo fue generado automáticamente. Conservalo como comprobante de pago.
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  try {
    await enviarEmail({
      to: pago.socio.email,
      subject: `Recibo de Pago #${pago.numero} - Club Sportivo Pilar`,
      html,
    })
    console.log(`📧 Recibo ${pago.numero} enviado a ${pago.socio.email}`)
    return true
  } catch (error) {
    console.error(`❌ Error enviando recibo ${pago.numero}:`, error.message)
    return false
  }
}

// Enviar Magic Link al socio para acceso al portal
export async function enviarMagicLinkSocio(socio, token) {
  const linkAcceso = `${frontendUrl}/portal-socio/${token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Portal del Socio</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${socio.apellidoNombre}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Recibiste este email porque solicitaste acceso al <strong>Portal del Socio</strong>.
        </p>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: #991b1b; margin: 0 0 15px 0; font-weight: bold;">Hacé clic para acceder:</p>
          <a href="${linkAcceso}" style="display: inline-block; background-color: #DC2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Acceder al Portal
          </a>
          <p style="color: #6b7280; font-size: 12px; margin: 15px 0 0 0;">
            O copiá este link: <br><span style="word-break: break-all;">${linkAcceso}</span>
          </p>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0; font-size: 14px;">
            <strong>🔒 Seguridad:</strong><br>
            • Este link es válido por 24 horas<br>
            • Solo funciona desde el dispositivo donde lo abras<br>
            • Si no solicitaste este acceso, ignorá este email
          </p>
        </div>

        <p style="color: #4b5563; line-height: 1.6;">
          <strong>Desde el Portal del Socio podés:</strong>
        </p>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li>Ver y actualizar tu información personal</li>
          <li>Consultar tus actividades e inscribirte en nuevas</li>
          <li>Comunicarte con tus entrenadores</li>
          <li>Pagar tus cuotas online</li>
          <li>Acceder a tu QR de socio</li>
        </ul>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          💡 <strong>Tip:</strong> Guardá este email para futuros accesos al portal
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: socio.email,
    subject: 'Tu link de acceso al Portal del Socio',
    html,
  })
}

// Enviar QR al socio por email (acceso seguro)
export async function enviarEmailQRSocio({ to, socioNombre, nroSocio, qrUrl, portalUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Club Sportivo Pilar</h1>
        <p style="color: white; margin: 5px 0 0 0;">Rojo Plus - Tu Código QR</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937; margin-top: 0;">Hola ${socioNombre}!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Acá tenés tu código QR para acceder a los beneficios del programa <strong>Rojo Plus</strong>.
        </p>

        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
          <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px;">SOCIO Nº</p>
          <p style="color: #DC2626; font-size: 28px; font-weight: bold; margin: 0 0 20px 0;">${nroSocio}</p>

          <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="color: #991b1b; margin: 0 0 15px 0; font-weight: bold;">Tu QR personal:</p>
            <a href="${qrUrl}" style="display: inline-block; background-color: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Ver mi QR
            </a>
          </div>

          <p style="color: #6b7280; font-size: 13px; margin: 0;">
            Mostrá este QR en comercios adheridos para obtener descuentos
          </p>
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #065f46; margin: 0 0 10px 0; font-weight: bold;">Acceso a tu Portal del Socio:</p>
          <p style="color: #047857; margin: 0 0 15px 0; font-size: 14px;">
            Desde el portal podés ver tus cuotas, actividades, pagos y más.
          </p>
          <a href="${portalUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Ir al Portal del Socio
          </a>
        </div>

        <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-top: 20px;">
          <p style="color: #92400e; margin: 0; font-size: 13px;">
            <strong>Tip:</strong> Guardá este email o agregá el portal a tu pantalla de inicio para acceder rápidamente.
          </p>
        </div>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to,
    subject: `Tu código QR - Socio #${nroSocio} - Rojo Plus`,
    html,
  })

  console.log(`📧 QR enviado a ${to} (Socio #${nroSocio})`)
}

/**
 * Envía email desde formulario de contacto
 */
export async function enviarEmailContacto({ nombre, email, telefono, asunto, mensaje }) {
  // Email al club
  const asuntoMap = {
    inscripcion: 'Inscripción de socio',
    actividades: 'Consulta sobre actividades',
    eventos: 'Alquiler de instalaciones',
    sugerencia: 'Sugerencia',
    otro: 'Otro',
  }

  const asuntoTexto = asuntoMap[asunto] || asunto || 'Consulta general'
  const emailClub = process.env.EMAIL_CONTACTO || process.env.SMTP_USER

  const htmlClub = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
      <div style="background: linear-gradient(135deg, #DC2626 0%, #b91c1c 100%); padding: 30px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Nuevo mensaje de contacto</h1>
      </div>

      <div style="padding: 30px; background-color: white;">
        <div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 15px; margin-bottom: 20px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold;">Asunto: ${asuntoTexto}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 120px;">Nombre:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 500;">${nombre}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="mailto:${email}" style="color: #DC2626;">${email}</a>
            </td>
          </tr>
          ${telefono ? `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Teléfono:</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="tel:${telefono}" style="color: #DC2626;">${telefono}</a>
            </td>
          </tr>
          ` : ''}
        </table>

        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; font-weight: bold;">Mensaje:</p>
          <p style="margin: 0; color: #374151; white-space: pre-wrap; line-height: 1.6;">${mensaje}</p>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <a href="mailto:${email}?subject=Re: ${asuntoTexto}" style="display: inline-block; background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Responder
          </a>
        </div>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Mensaje enviado desde el formulario de contacto del sitio web
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: emailClub,
    subject: `[Contacto Web] ${asuntoTexto} - ${nombre}`,
    html: htmlClub,
  })

  // Email de confirmación al usuario
  const htmlUsuario = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
      <div style="background: linear-gradient(135deg, #DC2626 0%, #b91c1c 100%); padding: 30px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Recibimos tu mensaje!</h1>
      </div>

      <div style="padding: 30px; background-color: white;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Hola <strong>${nombre}</strong>,
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Gracias por contactarte con Club Sportivo Pilar. Recibimos tu consulta y te responderemos a la brevedad.
        </p>

        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Tu mensaje:</p>
          <p style="margin: 0; color: #374151; font-style: italic;">"${mensaje.substring(0, 200)}${mensaje.length > 200 ? '...' : ''}"</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Si necesitás comunicarte de forma urgente, podés llamarnos al <strong>0230 442-0297</strong>
          o escribirnos por WhatsApp.
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          Club Sportivo Pilar - "El Rojo de la Avenida"<br>
          Av. Tomás Márquez 1125, Pilar
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: email,
    subject: 'Recibimos tu mensaje - Club Sportivo Pilar',
    html: htmlUsuario,
  })

  console.log(`📧 Email de contacto procesado: ${nombre} <${email}>`)
}

// Verificar conexión SMTP al iniciar
export async function verificarConexionSMTP() {
  try {
    await transporter.verify()
    console.log('📧 Conexión SMTP verificada')
    return true
  } catch (error) {
    console.error('❌ Error conexión SMTP:', error.message)
    return false
  }
}
