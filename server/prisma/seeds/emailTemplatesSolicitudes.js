/**
 * Templates de email para el sistema de solicitudes de socios
 */

export const templatesSolicitudes = [
  {
    eventType: 'SOLICITUD_RECIBIDA',
    nombre: 'Solicitud Recibida - Confirmación al Solicitante',
    subject: '$ {{clubNombre}} - Solicitud Recibida',
    bodyHtml: String.raw`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #DC2626;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #DC2626;
      margin: 0;
      font-size: 24px;
    }
    .content {
      margin-bottom: 30px;
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #DC2626;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
    .highlight {
      color: #DC2626;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Solicitud Recibida</h1>
    </div>

    <div class="content">
      <p>Hola <strong>$ {{nombreCompleto}}</strong>,</p>

      <p>¡Gracias por tu interés en ser parte de <strong>$ {{clubNombre}}</strong>!</p>

      <p>Hemos recibido tu solicitud de alta como socio y la estamos procesando.</p>

      <div class="info-box">
        <p><strong>Datos de tu solicitud:</strong></p>
        <ul>
          <li><strong>Número de solicitud:</strong> #$ {{numeroSolicitud}}</li>
          <li><strong>Actividad seleccionada:</strong> $ {{actividadInscripcion}}</li>
          <li><strong>Fecha de solicitud:</strong> Hoy</li>
        </ul>
      </div>

      <p>Nuestro equipo revisará tu solicitud en las próximas <span class="highlight">48 horas</span> y te enviaremos un correo con la respuesta.</p>

      <p>Si tienes alguna consulta, no dudes en contactarnos.</p>

      <p>¡Esperamos darte la bienvenida pronto a nuestra familia!</p>

      <p>Saludos cordiales,<br>
      <strong>$ {{clubNombre}}</strong></p>
    </div>

    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
    `,
    isActive: true,
    descripcion: 'Email de confirmación enviado al solicitante cuando envía el formulario de alta'
  },
  {
    eventType: 'NOTIF_NUEVA_SOLICITUD',
    nombre: 'Notificación Nueva Solicitud - Admin',
    subject: '$ {{clubNombre}} - Nueva Solicitud de Socio #$ {{numeroSolicitud}}',
    bodyHtml: String.raw`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
      color: white;
      padding: 20px;
      margin: -30px -30px 30px -30px;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .data-table th {
      background-color: #f8f9fa;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #DC2626;
      font-weight: bold;
    }
    .data-table td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
    }
    .action-button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #DC2626;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Nueva Solicitud de Socio</h1>
    </div>

    <div class="content">
      <p><strong>Se ha recibido una nueva solicitud de alta de socio.</strong></p>

      <table class="data-table">
        <tr>
          <th>Número de Solicitud</th>
          <td>#$ {{numeroSolicitud}}</td>
        </tr>
        <tr>
          <th>Nombre Completo</th>
          <td>$ {{nombreCompleto}}</td>
        </tr>
        <tr>
          <th>Documento</th>
          <td>$ {{documento}}</td>
        </tr>
        <tr>
          <th>Email</th>
          <td>$ {{email}}</td>
        </tr>
        <tr>
          <th>Teléfono</th>
          <td>$ {{telefono}}</td>
        </tr>
        <tr>
          <th>Actividad</th>
          <td>$ {{actividadInscripcion}}</td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="$ {{urlGestion}}" class="action-button">
          Ver y Procesar Solicitud
        </a>
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Por favor, procesa esta solicitud dentro de las próximas 48 horas.
      </p>
    </div>

    <div class="footer">
      <p>Sistema de Gestión - $ {{clubNombre}}</p>
    </div>
  </div>
</body>
</html>
    `,
    isActive: true,
    descripcion: 'Email enviado a los administradores cuando se recibe una nueva solicitud'
  },
  {
    eventType: 'SOLICITUD_RECHAZADA',
    nombre: 'Solicitud Rechazada',
    subject: '$ {{clubNombre}} - Respuesta a tu Solicitud',
    bodyHtml: String.raw`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #DC2626;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #DC2626;
      margin: 0;
      font-size: 24px;
    }
    .content {
      margin-bottom: 30px;
    }
    .motivo-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .contact-box {
      background-color: #d1ecf1;
      border-left: 4px solid #0c5460;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Respuesta a tu Solicitud</h1>
    </div>

    <div class="content">
      <p>Hola <strong>$ {{nombreCompleto}}</strong>,</p>

      <p>Gracias por tu interés en formar parte de <strong>$ {{clubNombre}}</strong>.</p>

      <p>Lamentamos informarte que en este momento no podemos aprobar tu solicitud de alta como socio.</p>

      <div class="motivo-box">
        <p><strong>Motivo:</strong></p>
        <p>$ {{motivoRechazo}}</p>
      </div>

      <div class="contact-box">
        <p><strong>¿Tienes dudas?</strong></p>
        <p>Si deseas más información o aclarar algún punto, no dudes en contactarnos:</p>
        <p>📞 <strong>$ {{telefonoContacto}}</strong></p>
      </div>

      <p>Esperamos que esta situación pueda resolverse y puedas ser parte de nuestra familia en el futuro.</p>

      <p>Saludos cordiales,<br>
      <strong>$ {{clubNombre}}</strong></p>
    </div>

    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
    `,
    isActive: true,
    descripcion: 'Email enviado al solicitante cuando su solicitud es rechazada'
  }
]

export async function seedEmailTemplatesSolicitudes(prisma) {
  console.log('🔧 Seeding email templates para solicitudes...')

  for (const template of templatesSolicitudes) {
    await prisma.emailTemplate.upsert({
      where: { eventType: template.eventType },
      update: template,
      create: template
    })
    console.log(`  ✓ Template: ${template.eventType}`)
  }

  console.log('✅ Email templates de solicitudes creados correctamente\n')
}
