import nodemailer from 'nodemailer'
import prisma from '../lib/prisma.js'

// Transporter global (fallback desde variables de entorno)
const _globalSmtpPort = parseInt(process.env.SMTP_PORT) || 587
const globalTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: _globalSmtpPort,
  secure: process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== ''
    ? process.env.SMTP_SECURE === 'true'
    : _globalSmtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

// Obtiene branding del tenant y construye URL con subdomain
async function getTenantInfo(tenantId) {
  if (!tenantId) return { nombre: 'Club', slogan: '', color: '#DC2626', url: frontendUrl }
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return { nombre: 'Club', slogan: '', color: '#DC2626', url: frontendUrl }
    const color = tenant.colores?.primario || '#DC2626'
    // Construir URL con subdomain: http://localhost:5173 → http://sub.localhost:5173
    //                              https://clubix.com   → https://sub.clubix.com
    let url = frontendUrl
    if (tenant.subdomain) {
      if (url.includes('localhost')) {
        url = url.replace('localhost', `${tenant.subdomain}.localhost`)
      } else {
        url = url.replace('://', `://${tenant.subdomain}.`)
      }
    }
    return { nombre: tenant.nombre || 'Club', slogan: tenant.slogan || '', color, url }
  } catch (err) {
    console.error('Error obteniendo info del tenant:', err.message)
    return { nombre: 'Club', slogan: '', color: '#DC2626', url: frontendUrl }
  }
}

// Cache de transporters por host:port:user para no recrearlos en cada email
const transporterCache = new Map()

/**
 * Obtiene la configuración de mail del tenant (o globals como fallback).
 * Claves en tabla configuracion: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * SMTP_SECURE, SMTP_FROM, SMTP_FROM_NAME, EMAIL_CONTACTO, NOMBRE_CLUB
 */
export async function getMailConfig(db) {
  const globalFrom = `"${process.env.SMTP_FROM_NAME || 'Clubix'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
  const globalEmailContacto = process.env.EMAIL_CONTACTO || process.env.SMTP_USER

  if (!db) {
    return { transporter: globalTransporter, from: globalFrom, emailContacto: globalEmailContacto }
  }

  try {
    const configs = await db.configuracion.findMany({
      where: {
        clave: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM', 'SMTP_FROM_NAME', 'EMAIL_CONTACTO', 'NOMBRE_CLUB'] }
      }
    })
    const cfg = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

    const fromName = cfg.SMTP_FROM_NAME || cfg.NOMBRE_CLUB || process.env.SMTP_FROM_NAME || 'Clubix'
    const emailContacto = cfg.EMAIL_CONTACTO || globalEmailContacto

    if (!cfg.SMTP_HOST || !cfg.SMTP_USER) {
      // Sin config SMTP propia: usar transporter global pero con nombre del tenant
      return {
        transporter: globalTransporter,
        from: `"${fromName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        emailContacto,
      }
    }

    const smtpPort = parseInt(cfg.SMTP_PORT) || 587
    // Si SMTP_SECURE no está explícito, inferir por puerto (465 = SSL directo)
    const smtpSecure = cfg.SMTP_SECURE !== undefined && cfg.SMTP_SECURE !== ''
      ? cfg.SMTP_SECURE === 'true'
      : smtpPort === 465
    const cacheKey = `${cfg.SMTP_HOST}:${smtpPort}:${smtpSecure}:${cfg.SMTP_USER}`
    if (!transporterCache.has(cacheKey)) {
      transporterCache.set(cacheKey, nodemailer.createTransport({
        host: cfg.SMTP_HOST,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
      }))
    }

    return {
      transporter: transporterCache.get(cacheKey),
      from: `"${fromName}" <${cfg.SMTP_FROM || cfg.SMTP_USER}>`,
      emailContacto,
    }
  } catch (err) {
    console.error('Error obteniendo config SMTP del tenant:', err.message)
    return { transporter: globalTransporter, from: globalFrom, emailContacto: globalEmailContacto }
  }
}

// Verificar si está en modo demo y obtener el email de prueba
async function getModoDemo(db) {
  try {
    const dbToUse = db || prisma
    const [modoDemo, emailDemo] = await Promise.all([
      dbToUse.configuracion.findUnique({ where: { clave: 'MODO_DEMO' } }),
      dbToUse.configuracion.findUnique({ where: { clave: 'EMAIL_DEMO' } }),
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

// Función helper para enviar email (maneja modo demo y SMTP por tenant)
export async function enviarEmail({ to, subject, html, db, attachments = [] }) {
  const [modoDemo, mailConfig] = await Promise.all([
    getModoDemo(db),
    getMailConfig(db),
  ])

  let destinatario = to
  let subjectFinal = subject

  if (modoDemo.activo && modoDemo.email) {
    destinatario = modoDemo.email
    subjectFinal = `[DEMO - Para: ${to}] ${subject}`
    console.log(`📧 MODO DEMO: Redirigiendo email de ${to} a ${modoDemo.email}`)
  }

  const mailOpts = {
    from: mailConfig.from,
    to: destinatario,
    subject: subjectFinal,
    html,
  }
  if (attachments.length > 0) mailOpts.attachments = attachments

  await mailConfig.transporter.sendMail(mailOpts)
}

export async function enviarEmailAprobacion(comercio, db) {
  const tenant = await getTenantInfo(comercio.tenantId)
  const linkAcceso = `${tenant.url}/comercio/${comercio.token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${tenant.color}; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">${tenant.nombre}</h1>
        <p style="color: white; margin: 5px 0 0 0;">Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">¡Felicitaciones ${comercio.nombre}!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Tu solicitud para ser comercio adherido al programa de beneficios de <strong>${tenant.nombre}</strong> ha sido <strong style="color: #16a34a;">APROBADA</strong>.
        </p>

        <p style="color: #4b5563; line-height: 1.6;">
          A partir de ahora podés ofrecer descuentos a los socios del club.
        </p>

        <div style="background-color: #f9f9f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #374151; margin: 0 0 10px 0; font-weight: bold;">Tu link de acceso exclusivo:</p>
          <a href="${linkAcceso}" style="display: inline-block; background-color: ${tenant.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
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
          ${tenant.nombre}${tenant.slogan ? ` - "${tenant.slogan}"` : ''}
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: `¡Tu comercio fue aprobado! - ${tenant.nombre}`,
    html,
    db,
  })
}

export async function enviarEmailRechazo(comercio, motivo, db) {
  const tenant = await getTenantInfo(comercio.tenantId)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${tenant.color}; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">${tenant.nombre}</h1>
        <p style="color: white; margin: 5px 0 0 0;">Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${comercio.nombre}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Lamentamos informarte que tu solicitud para ser comercio adherido al programa de beneficios de <strong>${tenant.nombre}</strong> no ha sido aprobada en esta oportunidad.
        </p>

        ${motivo ? `
        <div style="background-color: #fef2f2; border-left: 4px solid ${tenant.color}; padding: 15px; margin: 20px 0;">
          <p style="color: #374151; margin: 0;"><strong>Motivo:</strong> ${motivo}</p>
        </div>
        ` : ''}

        <p style="color: #4b5563; line-height: 1.6;">
          Si tenés consultas o querés volver a intentarlo, contactanos a través de nuestros canales oficiales.
        </p>
      </div>

      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          ${tenant.nombre}${tenant.slogan ? ` - "${tenant.slogan}"` : ''}
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: `Actualización de tu solicitud - ${tenant.nombre}`,
    html,
    db,
  })
}

export async function enviarEmailLinkAcceso(comercio, db) {
  const tenant = await getTenantInfo(comercio.tenantId)
  const linkAcceso = `${tenant.url}/comercio/${comercio.token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${tenant.color}; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">${tenant.nombre}</h1>
        <p style="color: white; margin: 5px 0 0 0;">Programa de Beneficios</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${comercio.nombre}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Te reenviamos tu link de acceso al sistema de beneficios de ${tenant.nombre}.
        </p>

        <div style="background-color: #f9f9f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #374151; margin: 0 0 10px 0; font-weight: bold;">Tu link de acceso:</p>
          <a href="${linkAcceso}" style="display: inline-block; background-color: ${tenant.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
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
          ${tenant.nombre}${tenant.slogan ? ` - "${tenant.slogan}"` : ''}
        </p>
      </div>
    </div>
  `

  await enviarEmail({
    to: comercio.email,
    subject: `Tu link de acceso - ${tenant.nombre}`,
    html,
    db,
  })
}

// Enviar recibo de pago por email
// opts.pdfBuffer / opts.pdfFilename: si vienen, se adjunta el PDF al mail.
// Devuelve { ok, motivo } para que el caller pueda mostrar la causa al usuario.
export async function enviarReciboPago(pago, db, opts = {}) {
  // Si el socio no tiene email, no enviar
  if (!pago.socio?.email) {
    console.log(`📧 Recibo ${pago.numero}: socio sin email, no se envía`)
    return { ok: false, motivo: 'El socio no tiene email registrado' }
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
    const attachments = []
    if (opts.pdfBuffer) {
      attachments.push({
        filename: opts.pdfFilename || `recibo-${pago.numero}.pdf`,
        content: opts.pdfBuffer,
        contentType: 'application/pdf',
      })
    }
    await enviarEmail({
      to: pago.socio.email,
      subject: `Recibo de Pago #${pago.numero} - Club Sportivo Pilar`,
      html,
      db,
      attachments,
    })
    console.log(`📧 Recibo ${pago.numero} enviado a ${pago.socio.email}${attachments.length ? ' (con PDF adjunto)' : ''}`)
    return { ok: true }
  } catch (error) {
    console.error(`❌ Error enviando recibo ${pago.numero}:`, error.message)
    return { ok: false, motivo: error.message || 'Error al enviar email (revisá la configuración SMTP)' }
  }
}

// Enviar Magic Link al socio para acceso al portal
export async function enviarMagicLinkSocio(socio, token, db, tenantId = null) {
  // Resolver URL con subdomain del tenant (cae a frontendUrl global si no hay tenant)
  const tenantInfo = await getTenantInfo(tenantId ?? socio?.tenantId)
  const linkAcceso = `${tenantInfo.url}/portal-socio/${token}`

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
    db,
  })
}

// Enviar QR al socio por email (acceso seguro)
export async function enviarEmailQRSocio({ to, socioNombre, nroSocio, qrUrl, portalUrl, db }) {
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
    db,
  })

  console.log(`📧 QR enviado a ${to} (Socio #${nroSocio})`)
}

/**
 * Envía email desde formulario de contacto
 */
export async function enviarEmailContacto({ nombre, email, telefono, asunto, mensaje, db }) {
  const mailConfig = await getMailConfig(db)
  const emailClub = mailConfig.emailContacto

  const asuntoMap = {
    inscripcion: 'Inscripción de socio',
    actividades: 'Consulta sobre actividades',
    eventos: 'Alquiler de instalaciones',
    sugerencia: 'Sugerencia',
    otro: 'Otro',
  }

  const asuntoTexto = asuntoMap[asunto] || asunto || 'Consulta general'

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
    db,
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
    db,
  })

  console.log(`📧 Email de contacto procesado: ${nombre} <${email}>`)
}

// ─── RESERVAS DE ESPACIOS ───────────────────────────────────────────────────

/**
 * Envía confirmación de reserva al hacer el booking
 */
export async function enviarConfirmacionReserva(reserva, db) {
  if (!reserva.email) return false

  const fecha = new Date(reserva.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const linkCancelacion = reserva.tokenCancelacion
    ? `${frontendUrl}/reservas/cancelar/${reserva.tokenCancelacion}`
    : null

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Reserva Confirmada</h1>
        <p style="color: white; margin: 5px 0 0 0;">Club Sportivo Pilar</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${reserva.nombreReserva}${reserva.apellido ? ' ' + reserva.apellido : ''}!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Tu reserva ha sido <strong style="color: #16a34a;">confirmada</strong> exitosamente.
        </p>

        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 140px;">Código</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #DC2626;">${reserva.codigo}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Espacio</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1f2937;">${reserva.espacio?.nombre || ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Fecha</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${fecha}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Horario</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${reserva.horaInicio} - ${reserva.horaFin} hs</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total abonado</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1f2937;">$${Number(reserva.precioTotal).toLocaleString('es-AR')}</td>
            </tr>
            ${reserva.esRecurrente ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Tipo</td>
              <td style="padding: 8px 0; color: #7c3aed; font-weight: bold;">Reserva semanal recurrente</td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${linkCancelacion ? `
        <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px;">
            ¿Necesitás cancelar? Podés hacerlo hasta las horas previas estipuladas por el club:
          </p>
          <a href="${linkCancelacion}" style="display: inline-block; background-color: #d97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Cancelar mi reserva
          </a>
        </div>
        ` : ''}

        <p style="color: #6b7280; font-size: 12px; margin-top: 20px; text-align: center;">
          Guardá este email como comprobante. Código de reserva: <strong>${reserva.codigo}</strong>
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
      to: reserva.email,
      subject: `Reserva confirmada: ${reserva.espacio?.nombre || 'Espacio'} - ${reserva.codigo}`,
      html,
      db,
    })
    console.log(`📧 Confirmación reserva ${reserva.codigo} enviada a ${reserva.email}`)
    return true
  } catch (error) {
    console.error(`❌ Error enviando confirmación reserva ${reserva.codigo}:`, error.message)
    return false
  }
}

/**
 * Envía notificación de cancelación de reserva
 */
export async function enviarCancelacionReserva(reserva, motivo, db) {
  if (!reserva.email) return false

  const fecha = new Date(reserva.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #6b7280; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Reserva Cancelada</h1>
        <p style="color: #d1d5db; margin: 5px 0 0 0;">Club Sportivo Pilar</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${reserva.nombreReserva}${reserva.apellido ? ' ' + reserva.apellido : ''}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Te informamos que tu reserva <strong>${reserva.codigo}</strong> ha sido cancelada.
        </p>

        <div style="background-color: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 140px;">Espacio</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${reserva.espacio?.nombre || ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Fecha</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${fecha}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Horario</td>
              <td style="padding: 8px 0; color: #1f2937;">${reserva.horaInicio} - ${reserva.horaFin} hs</td>
            </tr>
          </table>
        </div>

        ${motivo ? `
        <div style="background-color: #fef2f2; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0;"><strong>Motivo:</strong> ${motivo}</p>
        </div>
        ` : ''}

        ${reserva.reembolsado ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #065f46; margin: 0; font-weight: bold;">
            ✓ Se procesará el reembolso de $${Number(reserva.precioTotal).toLocaleString('es-AR')} por MercadoPago
          </p>
        </div>
        ` : ''}

        <p style="color: #4b5563; line-height: 1.6;">
          Para hacer una nueva reserva podés ingresar al portal del socio o al sitio web del club.
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
      to: reserva.email,
      subject: `Reserva cancelada: ${reserva.espacio?.nombre || 'Espacio'} - ${fecha}`,
      html,
      db,
    })
    console.log(`📧 Cancelación reserva ${reserva.codigo} enviada a ${reserva.email}`)
    return true
  } catch (error) {
    console.error(`❌ Error enviando cancelación reserva ${reserva.codigo}:`, error.message)
    return false
  }
}

/**
 * Envía recordatorio 24hs antes de la reserva
 */
export async function enviarRecordatorioReserva(reserva, db) {
  if (!reserva.email) return false

  const fecha = new Date(reserva.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Recordatorio de Reserva</h1>
        <p style="color: white; margin: 5px 0 0 0;">¡Mañana tenés cancha!</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hola ${reserva.nombreReserva}${reserva.apellido ? ' ' + reserva.apellido : ''}!</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Te recordamos que mañana tenés una reserva en el club.
        </p>

        <div style="background-color: white; border-radius: 8px; padding: 25px; margin: 20px 0; border: 2px solid #DC2626; text-align: center;">
          <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 14px;">RESERVA</p>
          <p style="color: #DC2626; font-size: 22px; font-weight: bold; margin: 0 0 5px 0;">${reserva.espacio?.nombre || ''}</p>
          <p style="color: #1f2937; font-size: 18px; margin: 0 0 5px 0;">${fecha}</p>
          <p style="color: #1f2937; font-size: 28px; font-weight: bold; margin: 0;">${reserva.horaInicio} - ${reserva.horaFin} hs</p>
        </div>

        <p style="color: #6b7280; font-size: 13px; text-align: center;">
          Código de reserva: <strong>${reserva.codigo}</strong>
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
      to: reserva.email,
      subject: `Recordatorio: ${reserva.espacio?.nombre || 'Reserva'} mañana a las ${reserva.horaInicio} hs`,
      html,
      db,
    })
    console.log(`📧 Recordatorio reserva ${reserva.codigo} enviado a ${reserva.email}`)
    return true
  } catch (error) {
    console.error(`❌ Error enviando recordatorio reserva ${reserva.codigo}:`, error.message)
    return false
  }
}

// Verificar conexión SMTP al iniciar (usa config global del .env)
// Silencioso: si no hay SMTP global cargado, no loggea nada (cada tenant usa su SMTP propio).
// Si hay y falla, solo warning — el server arranca igual.
export async function verificarConexionSMTP() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    // Sin SMTP global configurado — los tenants deben tener su propio SMTP cargado
    return false
  }
  try {
    await globalTransporter.verify()
    console.log('📧 SMTP global del .env verificado')
    return true
  } catch (error) {
    console.warn(`⚠️  SMTP global del .env no responde (${error.code || 'error'}): los tenants sin SMTP propio no podrán enviar mail`)
    return false
  }
}

// ─── TIENDA ONLINE ─────────────────────────────────────────────────────────

function tiendaEmailWrapper({ tenantInfo, titulo, cuerpo, footer }) {
  const color = tenantInfo.color || '#0EA5E9'
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#f8fafc;">
      <div style="background-color: ${color}; padding: 28px; text-align: center;">
        <h1 style="color: white; margin: 0; letter-spacing: 1px;">${tenantInfo.nombre || 'Club'}</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; text-transform: uppercase; font-size: 12px; letter-spacing: 2px;">Tienda Online</p>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">${titulo}</h2>
        ${cuerpo}
      </div>
      <div style="background-color: #0f172a; padding: 18px; text-align: center;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">${footer || tenantInfo.nombre || 'Clubix'}</p>
      </div>
    </div>
  `
}

/**
 * Envía email de verificación a un ShopCustomer recién registrado.
 */
export async function enviarVerificacionEmailTienda({ shopCustomer, token, tenantId, db }) {
  const tenantInfo = await getTenantInfo(tenantId)
  const link = `${tenantInfo.url}/tienda/verificar-email?token=${encodeURIComponent(token)}`

  const cuerpo = `
    <p style="color:#475569; line-height:1.6;">Hola ${shopCustomer.nombre},</p>
    <p style="color:#475569; line-height:1.6;">Recibimos tu registro en la tienda online de <strong>${tenantInfo.nombre}</strong>. Para activar tu cuenta verificá tu email haciendo clic en el siguiente botón:</p>
    <div style="text-align:center; margin:30px 0;">
      <a href="${link}" style="display:inline-block; background:${tenantInfo.color}; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:bold;">Verificar mi email</a>
    </div>
    <p style="color:#94a3b8; font-size:12px; line-height:1.6;">Este link expira en 24 horas. Si no creaste esta cuenta podés ignorar este mensaje.</p>
  `

  await enviarEmail({
    to: shopCustomer.email,
    subject: `Verificá tu email - ${tenantInfo.nombre}`,
    html: tiendaEmailWrapper({ tenantInfo, titulo: 'Confirmá tu email', cuerpo }),
    db,
  })
}

/**
 * Envía un magic link al comprador (login sin password).
 */
export async function enviarMagicLinkTienda({ shopCustomer, token, tenantId, db }) {
  const tenantInfo = await getTenantInfo(tenantId)
  const link = `${tenantInfo.url}/tienda/login-magic?token=${encodeURIComponent(token)}`

  const cuerpo = `
    <p style="color:#475569; line-height:1.6;">Hola ${shopCustomer.nombre || ''},</p>
    <p style="color:#475569; line-height:1.6;">Recibimos un pedido de acceso a la tienda online. Hacé clic para entrar:</p>
    <div style="text-align:center; margin:30px 0;">
      <a href="${link}" style="display:inline-block; background:${tenantInfo.color}; color:white; padding:14px 32px; text-decoration:none; border-radius:6px; font-weight:bold;">Ingresar</a>
    </div>
    <p style="color:#94a3b8; font-size:12px; line-height:1.6;">Este link expira en 15 minutos. Si no lo solicitaste, ignorá este email.</p>
  `

  await enviarEmail({
    to: shopCustomer.email,
    subject: `Tu link de acceso - ${tenantInfo.nombre} Tienda`,
    html: tiendaEmailWrapper({ tenantInfo, titulo: 'Acceso a la tienda', cuerpo }),
    db,
  })
}

/**
 * Notificación al comprador: pedido pagado confirmado.
 */
export async function enviarPedidoConfirmadoTienda({ pedidoTienda, items, tenantId, db }) {
  const tenantInfo = await getTenantInfo(tenantId)
  const itemsHtml = items.map(it => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #e2e8f0;">
        ${it.snapshotNombre}
        ${it.snapshotTalle ? ` <span style="color:#64748b">(${it.snapshotTalle}${it.snapshotColor ? ` ${it.snapshotColor}` : ''})</span>` : ''}
      </td>
      <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:center;">${it.cantidad}</td>
      <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:right;">$${Number(it.subtotal).toLocaleString('es-AR')}</td>
    </tr>
  `).join('')

  const cuerpo = `
    <p style="color:#475569; line-height:1.6;">Hola ${pedidoTienda.compradorNombre},</p>
    <p style="color:#475569; line-height:1.6;">Recibimos tu pago para el pedido <strong>${pedidoTienda.numero}</strong>. Te avisaremos cuando esté listo para retirar.</p>
    <table style="width:100%; border-collapse:collapse; margin:20px 0;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px; text-align:left;">Producto</th>
          <th style="padding:8px; text-align:center;">Cantidad</th>
          <th style="padding:8px; text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:12px 8px; text-align:right; font-weight:bold; font-size:16px;">Total: $${Number(pedidoTienda.total).toLocaleString('es-AR')}</td></tr>
      </tfoot>
    </table>
  `

  await enviarEmail({
    to: pedidoTienda.compradorEmail,
    subject: `Pedido confirmado ${pedidoTienda.numero} - ${tenantInfo.nombre}`,
    html: tiendaEmailWrapper({ tenantInfo, titulo: '¡Pedido confirmado!', cuerpo }),
    db,
  })
}

/**
 * Notificación de cambio de estado al comprador.
 */
export async function enviarCambioEstadoTienda({ pedidoTienda, estadoNuevo, tenantId, db, mensajePersonalizado }) {
  const tenantInfo = await getTenantInfo(tenantId)
  const cuerpo = `
    <p style="color:#475569; line-height:1.6;">Hola ${pedidoTienda.compradorNombre},</p>
    <p style="color:#475569; line-height:1.6;">El estado de tu pedido <strong>${pedidoTienda.numero}</strong> cambió a:</p>
    <div style="background:#f1f5f9; border-left:4px solid ${estadoNuevo.color || tenantInfo.color}; padding:16px; margin:16px 0;">
      <strong style="color:#0f172a; font-size:18px;">${estadoNuevo.nombre}</strong>
    </div>
    ${mensajePersonalizado ? `<p style="color:#475569; line-height:1.6;">${mensajePersonalizado}</p>` : ''}
  `

  await enviarEmail({
    to: pedidoTienda.compradorEmail,
    subject: `Pedido ${pedidoTienda.numero}: ${estadoNuevo.nombre} - ${tenantInfo.nombre}`,
    html: tiendaEmailWrapper({ tenantInfo, titulo: estadoNuevo.nombre, cuerpo }),
    db,
  })
}

/**
 * Enviar comprobante de movimiento de caja por email.
 * Devuelve { ok, motivo }.
 */
export async function enviarComprobanteMovimientoEmail({ movimiento, destinatario, pdfBuffer, pdfFilename, db }) {
  if (!destinatario) return { ok: false, motivo: 'Sin email destino' }

  const esIngreso = movimiento.tipo === 'INGRESO'
  const tipoLabel = esIngreso ? 'Ingreso' : 'Egreso'
  const verbo     = esIngreso ? 'Recibimos de' : 'Pagamos a'
  const nombre    = movimiento.socio?.apellidoNombre
    || movimiento.entidad?.razonSocial
    || movimiento.entidad?.nombreFantasia
    || destinatario

  const fechaStr = new Date(movimiento.fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const monto = Number(movimiento.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Comprobante de ${tipoLabel}</h1>
        <p style="color: white; margin: 5px 0 0 0;">Nº ${movimiento.numero}</p>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <div style="background-color: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">FECHA</p>
          <p style="color: #1f2937; margin: 0 0 15px 0;">${fechaStr}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 0;">${verbo.toUpperCase()}</p>
          <p style="color: #1f2937; font-weight: bold; margin: 0 0 15px 0;">${nombre}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 0;">CONCEPTO</p>
          <p style="color: #1f2937; margin: 0 0 15px 0;">${movimiento.concepto || movimiento.descripcion || '-'}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 0;">CAJA</p>
          <p style="color: #1f2937; margin: 0 0 15px 0;">${movimiento.caja?.nombre || '-'}</p>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px; text-align: right;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">TOTAL</p>
            <p style="color: #DC2626; font-size: 22px; font-weight: bold; margin: 0;">$${monto}</p>
          </div>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px; text-align: center;">
          Conservalo como comprobante.
        </p>
      </div>
    </div>
  `

  const attachments = pdfBuffer
    ? [{ filename: pdfFilename || `comprobante-${movimiento.numero}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    : []

  try {
    await enviarEmail({
      to: destinatario,
      subject: `Comprobante de ${tipoLabel} Nº ${movimiento.numero}`,
      html,
      db,
      attachments,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, motivo: err.message || 'Error al enviar' }
  }
}
