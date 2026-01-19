import nodemailer from 'nodemailer'

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

  await transporter.sendMail({
    from: `"Rojo Plus" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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

  await transporter.sendMail({
    from: `"Rojo Plus" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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

  await transporter.sendMail({
    from: `"Rojo Plus" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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

  const cuotasHtml = pago.cuotas.map(c => `
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
    await transporter.sendMail({
      from: `"Club Sportivo Pilar" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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
