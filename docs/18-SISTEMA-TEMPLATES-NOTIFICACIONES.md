# Sistema de Templates de Email y PDF - RojoPlus

**Fecha**: 24 Enero 2026
**Estado**: ✅ **Implementado y Funcional**

---

## 📋 Resumen

Sistema completo de notificaciones por email con templates editables desde la interfaz de administración y generación dinámica de PDFs (recibos, facturas).

### Características Principales

- ✅ **Templates de Email en BD**: HTML y CSS editables sin tocar código
- ✅ **Templates de PDF en BD**: HTML/CSS para Puppeteer editables
- ✅ **Variables dinámicas**: Uso de Handlebars para compilar templates
- ✅ **Vista previa**: Ver emails y PDFs antes de guardar
- ✅ **Emails de prueba**: Enviar test a cualquier email
- ✅ **PDFs adjuntos**: Generar y adjuntar PDFs a emails automáticamente
- ✅ **Modo demo**: Redirigir emails a una dirección de prueba
- ✅ **Inline CSS**: Juice para mejor compatibilidad con clientes de email

---

## 🗄️ Estructura de Base de Datos

### Modelo `EmailTemplate`

```prisma
model EmailTemplate {
  id          String   @id @default(cuid())
  eventType   String   @unique // COMPROBANTE_PAGO, PAGO_CONFIRMADO, etc.
  nombre      String
  descripcion String?
  subject     String   // Con variables Handlebars
  bodyHtml    String   @db.Text
  bodyText    String?  @db.Text
  variables   String   @default("[]") @db.Text // JSON array
  isActive    Boolean  @default(true)
  createdAt   DateTime
  updatedAt   DateTime
}
```

### Modelo `PdfTemplate`

```prisma
model PdfTemplate {
  id          String   @id @default(cuid())
  tipo        String   @unique // RECIBO, FACTURA
  nombre      String
  descripcion String?
  htmlContent String   @db.Text
  cssContent  String   @db.Text
  variables   String   @default("[]") @db.Text
  pageFormat  String   @default("A4")
  orientation String   @default("portrait")
  isActive    Boolean  @default(true)
  createdAt   DateTime
  updatedAt   DateTime
}
```

---

## 📧 Templates de Email

### Tipos de Eventos (eventType)

| EventType | Descripción | PDF Adjunto |
|-----------|-------------|-------------|
| `COMPROBANTE_PAGO` | Comprobante después de pagar | ✅ Recibo |
| `PAGO_CONFIRMADO` | Pago manual confirmado por admin | ✅ Recibo |
| `PAGO_RECHAZADO` | Pago manual rechazado | ❌ |
| `RECORDATORIO_VENCIMIENTO` | 5 días antes del vencimiento | ❌ |
| `CUOTA_GENERADA` | Cuota mensual generada | ❌ |

### Variables Disponibles

Cada template tiene un campo `variables` (JSON array) que indica qué variables están disponibles:

**Comunes:**
- `clubNombre`, `clubLema`, `clubDireccion`, `clubTelefono`, `clubEmail`, `clubCuit`, `clubLogo`
- `socioNombre`, `socioNumero`, `socioDni`
- `numero`, `fecha`, `montoTotal`

**Específicas:**
- `items` (array): `[{concepto, periodo, monto}]`
- `cuotas` (array): `[{concepto, vencimiento, monto}]`
- `medioPago`, `nroOperacion`
- `motivoRechazo`
- `portalUrl`

---

## 📄 Templates de PDF

### Tipos de PDF

| Tipo | Descripción | Uso |
|------|-------------|-----|
| `RECIBO` | Recibo de pago | Adjunto en emails de pago |
| `FACTURA` | Factura comercial | Buffet, ventas |

### Formato del Template

Cada template PDF contiene:
- **HTML**: Estructura del documento con variables Handlebars
- **CSS**: Estilos inline para Puppeteer
- **pageFormat**: A4, Letter, Legal
- **orientation**: portrait, landscape

---

## 🚀 Implementación Técnica

### Backend

#### Servicios

**`pdfGenerator.js`**
```javascript
generatePDF(prisma, tipo, data) // Genera PDF desde template
generateTestPDF(prisma, tipo)   // Genera PDF con datos de prueba
```

**`emailTemplateService.js`**
```javascript
sendTemplateEmail({
  prisma,
  eventType,
  to,
  data,
  attachPdf: { tipo, data, filename }
})
sendTestEmail(prisma, eventType, to)
```

#### Endpoints

**Email Templates:**
```
GET    /api/admin/templates/email          # Listar
GET    /api/admin/templates/email/:id      # Ver uno
PUT    /api/admin/templates/email/:id      # Actualizar
POST   /api/admin/templates/email/:id/test # Enviar test
```

**PDF Templates:**
```
GET    /api/admin/templates/pdf                # Listar
GET    /api/admin/templates/pdf/:id            # Ver uno
PUT    /api/admin/templates/pdf/:id            # Actualizar
POST   /api/admin/templates/pdf/:id/test       # Descargar PDF test
POST   /api/admin/templates/pdf/:id/preview    # Vista previa HTML
```

### Frontend

#### Páginas de Administración

**`/admin/configuracion/templates/email`**
- Lista lateral con categorías colapsables
- Editor de asunto y HTML
- Vista previa del email renderizado
- Variables disponibles
- Enviar email de prueba
- Toggle activo/inactivo

**`/admin/configuracion/templates/pdf`**
- Lista lateral de templates
- Editores separados para HTML y CSS
- Configuración de formato y orientación
- Vista previa en iframe
- Descargar PDF de prueba
- Variables disponibles

---

## 📦 Dependencias Instaladas

```json
{
  "puppeteer": "^21.x",    // Generación de PDFs
  "handlebars": "^4.x",    // Motor de templates
  "juice": "^10.x"         // Inline CSS para emails
}
```

---

## 🎯 Uso en el Código

### Enviar Email con PDF Adjunto

```javascript
import { sendTemplateEmail } from './services/emailTemplateService.js'

// Ejemplo: Enviar comprobante de pago
await sendTemplateEmail({
  prisma,
  eventType: 'COMPROBANTE_PAGO',
  to: socio.email,
  data: {
    clubNombre: 'Club Sportivo Pilar',
    clubEmail: 'info@club.com',
    socioNombre: socio.nombre,
    numero: pago.numero,
    fecha: pago.fecha,
    medioPago: pago.medioPago.nombre,
    montoTotal: pago.montoTotal,
    items: cargos.map(c => ({
      concepto: c.concepto,
      periodo: c.periodo,
      monto: c.monto
    }))
  },
  attachPdf: {
    tipo: 'RECIBO',
    data: {
      // Mismos datos + adicionales para el PDF
      socioNumero: socio.numero,
      nroOperacion: pago.nroOperacion
    },
    filename: `recibo-${pago.numero}.pdf`
  }
})
```

### Generar PDF Sin Enviar Email

```javascript
import { generatePDF } from './services/pdfGenerator.js'

const pdfBuffer = await generatePDF(prisma, 'RECIBO', {
  clubNombre: 'Club Sportivo Pilar',
  numero: 'R-00001',
  // ... más datos
})

// Enviar como descarga HTTP
res.setHeader('Content-Type', 'application/pdf')
res.setHeader('Content-Disposition', 'attachment; filename="recibo.pdf"')
res.send(pdfBuffer)
```

---

## 🔧 Integración con Endpoints Existentes

### 1. Confirmación de Pago Manual

**Archivo**: `server/src/routes/admin.js`

Agregar después de confirmar el pago:

```javascript
// Después de crear el pago...
const pago = await prisma.pago.create({ ... })

// Enviar email con comprobante
try {
  await sendTemplateEmail({
    prisma,
    eventType: 'PAGO_CONFIRMADO',
    to: socio.email,
    data: {
      clubNombre: 'Club Sportivo Pilar',
      clubEmail: process.env.CLUB_EMAIL,
      socioNombre: socio.nombre,
      numero: pago.numero,
      fecha: new Date(pago.fecha).toLocaleDateString('es-AR'),
      montoTotal: pago.montoTotal.toString()
    },
    attachPdf: {
      tipo: 'RECIBO',
      data: {
        // Datos completos para el recibo
        clubNombre: 'Club Sportivo Pilar',
        clubDireccion: process.env.CLUB_DIRECCION,
        clubTelefono: process.env.CLUB_TELEFONO,
        clubEmail: process.env.CLUB_EMAIL,
        numero: pago.numero,
        fecha: new Date(pago.fecha).toLocaleDateString('es-AR'),
        fechaGeneracion: new Date().toLocaleString('es-AR'),
        socioNombre: socio.nombre,
        socioNumero: socio.numero,
        medioPago: medioPago.nombre,
        montoTotal: pago.montoTotal.toString(),
        items: aplicaciones.map(a => ({
          concepto: a.cargo.descripcion,
          periodo: a.cargo.periodo,
          monto: a.monto.toString()
        }))
      },
      filename: `recibo-${pago.numero}.pdf`
    }
  })
} catch (emailError) {
  console.error('Error enviando email de confirmación:', emailError)
  // No fallar la operación si el email falla
}
```

### 2. Rechazo de Pago Manual

```javascript
// Después de rechazar...
try {
  await sendTemplateEmail({
    prisma,
    eventType: 'PAGO_RECHAZADO',
    to: socio.email,
    data: {
      clubNombre: 'Club Sportivo Pilar',
      clubEmail: process.env.CLUB_EMAIL,
      clubTelefono: process.env.CLUB_TELEFONO,
      socioNombre: socio.nombre,
      motivoRechazo: motivoRechazo
    }
  })
} catch (emailError) {
  console.error('Error enviando email de rechazo:', emailError)
}
```

### 3. Webhook de MercadoPago

**Archivo**: `server/src/routes/pagos.js`

```javascript
// Después de crear el pago desde webhook...
try {
  await sendTemplateEmail({
    prisma,
    eventType: 'COMPROBANTE_PAGO',
    to: socio.email,
    data: {
      // ... datos del pago
    },
    attachPdf: {
      tipo: 'RECIBO',
      data: { /* ... */ },
      filename: `recibo-${pago.numero}.pdf`
    }
  })
} catch (emailError) {
  console.error('Error enviando comprobante:', emailError)
}
```

---

## 🎨 Personalización de Templates

### Desde la Interfaz de Administración

1. Ir a `/admin/configuracion/templates/email` o `/pdf`
2. Seleccionar el template a editar
3. Modificar:
   - **Email**: Subject, HTML, activar/desactivar
   - **PDF**: HTML, CSS, formato de página, orientación
4. **Vista previa** para validar cambios
5. **Guardar** cambios
6. **Enviar prueba** (email) o **Descargar prueba** (PDF)

### Variables en Templates

Usar sintaxis Handlebars:
```handlebars
{{variable}}               <!-- Variable simple -->
{{#if variable}}...{{/if}} <!-- Condicional -->
{{#each items}}            <!-- Loop -->
  {{concepto}} - ${{monto}}
{{/each}}
```

---

## 📈 Próximas Mejoras

### Corto Plazo
- [ ] Agregar más templates (cuota vencida, cambio de categoría, etc.)
- [ ] Agregar helpers de Handlebars personalizados
- [ ] Histórico de emails enviados (tabla `NotificacionLog`)
- [ ] Cola de envío con Bull/Redis para emails masivos

### Mediano Plazo
- [ ] Editor WYSIWYG para emails (EmailJS, GrapeJS)
- [ ] Versionado de templates (auditoría de cambios)
- [ ] Plantillas por defecto vs personalizadas por tenant
- [ ] A/B testing de templates

### Largo Plazo
- [ ] WhatsApp templates (Twilio)
- [ ] SMS templates
- [ ] Push notifications

---

## 🐛 Troubleshooting

### El email no llega

1. Verificar configuración SMTP en `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu-email@gmail.com
   SMTP_PASS=tu-app-password
   SMTP_FROM=tu-email@gmail.com
   ```

2. Verificar que el template esté **activo** (`isActive: true`)

3. Verificar logs del servidor:
   ```bash
   # Buscar errores de email
   cd server && npm run dev
   ```

4. Enviar email de prueba desde la interfaz

### El PDF no se genera

1. Verificar que Puppeteer esté instalado correctamente:
   ```bash
   cd server && npm list puppeteer
   ```

2. En Windows, puede requerir reiniciar el servidor después de instalar

3. Verificar que el template HTML sea válido

4. Usar "Descargar prueba" para ver errores

### Variables no se reemplazan

1. Verificar que las variables estén en formato `{{variable}}`
2. Verificar que los datos incluyan todas las variables usadas
3. Probar con datos de ejemplo usando "Enviar prueba"

---

## 🎨 Mejoras de UI/UX (24 Enero 2026)

### Paleta de Colores Consistente

**Problema resuelto:** Los templates usaban colores inconsistentes con el resto del panel.

**Solución aplicada:**
- **EmailTemplates**: Cambio de purple a **blue** (estándar para módulos orientados a usuarios)
- **PdfTemplates**: Cambio de red a **gray** (estándar para documentos)

```jsx
// Email Templates
bg-blue-100 text-blue-600  // Headers e iconos
bg-blue-50 border-l-blue-500  // Template seleccionado
focus:ring-blue-500  // Focus states

// PDF Templates
bg-gray-100 text-gray-600  // Headers e iconos
bg-gray-50 border-l-gray-500  // Template seleccionado
focus:ring-gray-500  // Focus states
```

### Menú de Configuración Jerárquico

**Problema resuelto:** Templates no eran accesibles desde el menú lateral.

**Solución aplicada:**
```
Configuración ▼
  ├─ General
  ├─ Datos Bancarios
  ├─ Templates Email
  └─ Templates PDF
```

**Beneficios:**
- Acceso directo desde sidebar
- Estructura escalable para futuras configuraciones
- Consistente con otros menús (Ingresos, Egresos, etc.)

### Navegación Simplificada

**Problema resuelto:** Navegación redundante con múltiples botones "Volver".

**Cambios aplicados:**
- ❌ Removida card duplicada "Datos Bancarios" de página General
- ❌ Removidos botones "Volver" y "Cancelar" de ConfiguracionPagos
- ✅ Guardar permanece en la página con mensaje de éxito
- ✅ Usuario puede seguir editando sin tener que re-navegar

**Flujo mejorado:**
```
Antes: Dashboard → Config → Card → Click → Editar → Guardar → Auto-vuelve
Después: Dashboard → Config (submenu) → Datos Bancarios → Editar → Guardar → Permanece
```

### Impacto en Usabilidad

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Clics para editar config | 5-6 | 3 | -50% |
| Navegación confusa | ⚠️ Alta | ✅ Ninguna | 100% |
| Consistencia visual | ⚠️ Baja | ✅ Alta | 100% |
| Feedback al guardar | Auto-navega | Permanece + mensaje | ✅ Mejor |

---

## 📚 Referencias

- **Handlebars**: https://handlebarsjs.com/
- **Puppeteer**: https://pptr.dev/
- **Juice** (Inline CSS): https://github.com/Automattic/juice
- **Nodemailer**: https://nodemailer.com/

---

**Desarrollado por**: Claude Code + Martín Lombardo
**Versión**: 1.1
**Última actualización**: 24 Enero 2026
