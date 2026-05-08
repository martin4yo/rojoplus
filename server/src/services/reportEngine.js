import Handlebars from 'handlebars'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Handlebars helpers ──────────────────────────────────────────────────────

Handlebars.registerHelper('formatCurrency', (value) => {
  const n = Number(value) || 0
  return new Handlebars.SafeString(
    n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
})

Handlebars.registerHelper('formatDate', (value) => {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('es-AR') } catch { return String(value) }
})

Handlebars.registerHelper('formatDateTime', (value) => {
  if (!value) return '—'
  try { return new Date(value).toLocaleString('es-AR') } catch { return String(value) }
})

// sum: {{sum items "field"}} → formatted currency string
Handlebars.registerHelper('sum', (items, field) => {
  const total = (items || []).reduce((acc, item) => acc + (Number(item[field]) || 0), 0)
  return new Handlebars.SafeString(
    total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
})

// sumRaw: returns raw number
Handlebars.registerHelper('sumRaw', (items, field) =>
  (items || []).reduce((acc, item) => acc + (Number(item[field]) || 0), 0)
)

// count: {{count items}}
Handlebars.registerHelper('count', (items) => (items || []).length)

// groupBy: {{#groupBy items "field"}} key=group key, items=group items {{/groupBy}}
Handlebars.registerHelper('groupBy', function (items, field, options) {
  if (!Array.isArray(items)) return ''
  const groups = new Map()
  for (const item of items) {
    const key = field.split('.').reduce((obj, k) => obj?.[k], item)
    const groupKey = key != null ? String(key) : 'Sin clasificar'
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(item)
  }
  let result = ''
  for (const [key, groupItems] of groups) {
    result += options.fn({ key, items: groupItems, count: groupItems.length })
  }
  return new Handlebars.SafeString(result)
})

// inc: {{inc @index}} → 1-based row number
Handlebars.registerHelper('inc', (n) => n + 1)

// Comparison helpers
Handlebars.registerHelper('eq', (a, b) => a == b)
Handlebars.registerHelper('ne', (a, b) => a != b)
Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b))
Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b))
Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b))
Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b))

// colorText: {{colorText value "#hex"}}
Handlebars.registerHelper('colorText', (value, color) =>
  new Handlebars.SafeString(`<span style="color:${color}">${value}</span>`)
)

// lower / upper: case helpers
Handlebars.registerHelper('lower', (value) => String(value ?? '').toLowerCase())
Handlebars.registerHelper('upper', (value) => String(value ?? '').toUpperCase())

// ── PDF via child process ───────────────────────────────────────────────────

const PDF_WORKER_PATH = path.join(__dirname, 'pdfWorker.js')
const PDF_TIMEOUT_MS = 90_000

export async function warmBrowser() {}

export function renderHtml(htmlTemplate, data) {
  const compiled = Handlebars.compile(htmlTemplate)
  return compiled(data)
}

export async function htmlToPdf(html, pageSetup = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PDF_WORKER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`PDF generation timed out after ${PDF_TIMEOUT_MS / 1000}s`))
    }, PDF_TIMEOUT_MS)

    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))

    let stderrText = ''
    child.stderr.on('data', (chunk) => { stderrText += chunk.toString() })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        const pdf = Buffer.concat(chunks)
        if (pdf.length > 0) resolve(pdf)
        else reject(new Error('PDF worker produced empty output'))
      } else {
        let msg = `PDF worker exited with code ${code}`
        try {
          const parsed = JSON.parse(stderrText)
          if (parsed.error) msg = parsed.error
        } catch {}
        if (stderrText && msg === `PDF worker exited with code ${code}`) msg = stderrText.trim()
        reject(new Error(msg))
      }
    })

    child.on('error', (err) => { clearTimeout(timer); reject(err) })

    child.stdin.write(JSON.stringify({ html, pageSetup, voucherMode: options.voucherMode ?? false }))
    child.stdin.end()
  })
}

// ── Default templates per query key ────────────────────────────────────────

const BASE_STYLES = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; margin: 0;
         padding: 12mm 12mm 8mm; }
  .header { display:flex; justify-content:space-between; align-items:flex-start;
            border-bottom:2px solid #1d4ed8; padding-bottom:8px; margin-bottom:8px; }
  .title { font-size:14pt; font-weight:bold; color:#1d4ed8; }
  .subtitle { font-size:9pt; color:#6b7280; }
  .meta { font-size:7.5pt; color:#6b7280; text-align:right; line-height:1.5; }
  .params { font-size:7.5pt; color:#555; margin-bottom:8px; display:flex; flex-wrap:wrap; gap:12px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th { background:#1d4ed8; color:#fff; padding:5px 6px; font-size:8pt; text-align:left; }
  td { padding:4px 6px; font-size:8pt; border-bottom:1px solid #e5e7eb; }
  tr:nth-child(even) td { background:#f8fafc; }
  .r { text-align:right; }
  .group-hdr td { background:#dbeafe; font-weight:bold; color:#1e3a8a; font-size:8pt; padding:4px 6px; }
  .subtotal td { background:#eff6ff; font-weight:bold; }
  .grand-total { margin-top:10px; text-align:right; font-weight:bold; font-size:10pt; }
</style></head><body>`

export function getDefaultTemplate(queryKey) {
  const templates = {
    socios_activos: `${BASE_STYLES}
<div class="header">
  <div><div class="title">Socios Activos</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span> &nbsp;{{/each}}</div>
<table>
  <thead><tr><th>#</th><th>Apellido y Nombre</th><th>Categoría</th><th>DNI</th><th>Email</th><th>Teléfono</th></tr></thead>
  <tbody>
    {{#each data.items}}
    <tr><td>{{inc @index}}</td><td>{{apellido}}, {{nombre}}</td><td>{{categoria}}</td>
        <td>{{dni}}</td><td>{{email}}</td><td>{{telefono}}</td></tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">Total: {{data.summary.total}} socios</div>
</body></html>`,

    cuotas_cobranza: `${BASE_STYLES}
<div class="header">
  <div><div class="title">Estado de Cobranza</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span> &nbsp;{{/each}}</div>
<table>
  <thead><tr><th>#</th><th>Socio</th><th>Descripción</th><th>Vencimiento</th><th>Estado</th><th class="r">Importe</th></tr></thead>
  <tbody>
    {{#each data.items}}
    <tr><td>{{inc @index}}</td><td>{{socio}}</td><td>{{descripcion}}</td>
        <td>{{formatDate vencimiento}}</td><td>{{estado}}</td>
        <td class="r">$ {{formatCurrency importe}}</td></tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">Total: $ {{formatCurrency data.summary.total}} | {{data.summary.count}} cuotas</div>
</body></html>`,

    socios_morosos: `${BASE_STYLES}
<div class="header">
  <div><div class="title">Socios Morosos</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Apellido y Nombre</th><th>DNI</th><th>Email</th><th class="r">Cuotas</th><th class="r">Deuda</th></tr></thead>
  <tbody>
    {{#each data.items}}
    <tr><td>{{inc @index}}</td><td>{{nombre}}</td><td>{{dni}}</td><td>{{email}}</td>
        <td class="r">{{cuotas}}</td><td class="r">$ {{formatCurrency deuda}}</td></tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">{{data.summary.totalSocios}} socios | Deuda total: $ {{formatCurrency data.summary.totalDeuda}}</div>
</body></html>`,

    movimientos_caja: `${BASE_STYLES}
<div class="header">
  <div><div class="title">Movimientos de Caja</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span> &nbsp;{{/each}}</div>
<table>
  <thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Caja</th><th class="r">Importe</th></tr></thead>
  <tbody>
    {{#each data.items}}
    <tr><td>{{inc @index}}</td><td>{{formatDate fecha}}</td><td>{{tipo}}</td>
        <td>{{descripcion}}</td><td>{{caja}}</td>
        <td class="r">$ {{formatCurrency importe}}</td></tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">Ingresos: \${{formatCurrency data.summary.ingresos}} | Egresos: \${{formatCurrency data.summary.egresos}} | Saldo: \${{formatCurrency data.summary.saldo}}</div>
</body></html>`,

    morosos_por_actividad: `${BASE_STYLES}
<style>
  .group { page-break-before: always; }
  .group:first-of-type { page-break-before: auto; }
  .group-header {
    background: #1f2937; color: white; padding: 10px 14px; margin: 10px 0 8px;
    border-radius: 4px; font-weight: bold; font-size: 11pt;
    display: flex; justify-content: space-between; align-items: center;
  }
  .group-header .stats { font-weight: normal; font-size: 9pt; opacity: 0.9; }
  .socio-block {
    margin-bottom: 8px; padding: 6px 8px;
    border-left: 3px solid #DC2626; background: #fafafa;
    page-break-inside: avoid;
  }
  .socio-name { font-weight: bold; font-size: 10pt; color: #1f2937; }
  .socio-contact { font-size: 8pt; color: #6b7280; margin-bottom: 4px; }
  .cuotas-table { font-size: 8pt; width: 100%; margin-top: 4px; }
  .cuotas-table th { background: #f3f4f6; font-size: 7.5pt; padding: 3px 6px; }
  .cuotas-table td { padding: 3px 6px; }
  .cuotas-table tfoot td { background: #fef3c7; font-weight: bold; }
  .group-total {
    font-weight: bold; padding: 8px 12px; background: #fef3c7;
    border-radius: 4px; margin-top: 6px; text-align: right; font-size: 10pt;
  }
  .grand-total { background: #1f2937; color: white; padding: 12px; }
</style>
<div class="header">
  <div><div class="title">Socios Morosos por Actividad / Categoría</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span>&nbsp;{{/each}}</div>

{{#each data.items}}
<div class="group">
  <div class="group-header">
    <span>{{actividad}} — {{categoria}}</span>
    <span class="stats">{{cantSocios}} socios · {{cantCuotas}} cuotas · $ {{formatCurrency totalDeuda}}</span>
  </div>
  {{#each socios}}
  <div class="socio-block">
    <div class="socio-name">#{{nroSocio}} — {{apellidoNombre}}{{#if documento}} ({{documento}}){{/if}}</div>
    <div class="socio-contact">{{#if celular}}📱 {{celular}}{{/if}}{{#if email}} · ✉ {{email}}{{/if}}</div>
    <table class="cuotas-table">
      <thead>
        <tr>
          <th>Período</th>
          <th>Descripción</th>
          <th>Vencimiento</th>
          <th class="r">Días mora</th>
          <th class="r">Importe</th>
        </tr>
      </thead>
      <tbody>
        {{#each cuotas}}
        <tr>
          <td>{{periodo}}</td>
          <td>{{descripcion}}</td>
          <td>{{formatDate fechaVencimiento}}</td>
          <td class="r">{{diasMora}}</td>
          <td class="r">$ {{formatCurrency montoTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
      <tfoot>
        <tr><td colspan="3" class="r">Subtotal {{apellidoNombre}}:</td><td class="r">{{cantCuotas}}</td><td class="r">$ {{formatCurrency totalDeuda}}</td></tr>
      </tfoot>
    </table>
  </div>
  {{/each}}
  <div class="group-total">
    Total {{actividad}} / {{categoria}}: {{cantSocios}} socios · {{cantCuotas}} cuotas · $ {{formatCurrency totalDeuda}}
  </div>
</div>
{{/each}}

<div class="grand-total" style="margin-top:24px; text-align:center;">
  TOTAL GENERAL — {{data.summary.totalGrupos}} grupos · {{data.summary.totalSocios}} socios · {{data.summary.totalCuotas}} cuotas · $ {{formatCurrency data.summary.totalDeuda}}
</div>
</body></html>`,

    recibo_cobro: `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; padding: 10mm; }
  .recibo { border: 2px solid #1d4ed8; border-radius: 8px; overflow: hidden; }
  .header { background: #1d4ed8; color: white; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; flex-direction: row; align-items: center; gap: 12px; }
  .logo { max-height: 60px; max-width: 100px; object-fit: contain; background: white; border-radius: 4px; padding: 3px; flex-shrink: 0; }
  .club-info { display: flex; flex-direction: column; justify-content: center; }
  .club-name { font-size: 11pt; font-weight: bold; line-height: 1.3; }
  .club-detail { font-size: 7pt; opacity: 0.85; line-height: 1.6; margin-top: 2px; }
  .recibo-title { text-align: right; }
  .recibo-title .title { font-size: 14pt; font-weight: bold; letter-spacing: 1px; }
  .recibo-title .numero { font-size: 10pt; margin-top: 2px; }
  .recibo-title .fecha { font-size: 8pt; opacity: 0.85; }
  .body { padding: 10px 14px; }
  .section { margin-bottom: 10px; }
  .section-title { font-size: 7.5pt; font-weight: bold; color: #1d4ed8; text-transform: uppercase;
                   letter-spacing: 0.5px; border-bottom: 1px solid #dbeafe; padding-bottom: 3px; margin-bottom: 6px; }
  .row { display: flex; gap: 16px; margin-bottom: 3px; }
  .field { flex: 1; }
  .field label { font-size: 7pt; color: #6b7280; display: block; }
  .field span { font-size: 9pt; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: #eff6ff; color: #1e3a8a; padding: 4px 6px; text-align: left; font-weight: bold; }
  td { padding: 4px 6px; border-bottom: 1px solid #f0f0f0; }
  .r { text-align: right; }
  .total-row td { font-weight: bold; background: #dbeafe; font-size: 10pt; }
  .medio-pago { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; margin-top: 6px; }
  .medio-pago .icon { font-size: 16pt; }
  .footer { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 6px 14px;
            font-size: 7pt; color: #6b7280; text-align: center; }
</style></head><body>
{{#each data.items}}
<div class="recibo">
  <div class="header">
    <div class="header-left">
      {{#if tenant.logoUrl}}
      <img class="logo" src="{{tenant.logoUrl}}" alt="logo">
      {{/if}}
      <div class="club-info">
        <div class="club-name">{{tenant.nombre}}</div>
        <div class="club-detail">
          {{#if tenant.direccion}}{{tenant.direccion}}<br>{{/if}}
          {{#if tenant.telefono}}Tel: {{tenant.telefono}}<br>{{/if}}
          {{#if tenant.cuit}}CUIT: {{tenant.cuit}}{{/if}}
        </div>
      </div>
    </div>
    <div class="recibo-title">
      <div class="title">RECIBO DE PAGO</div>
      <div class="numero">N° {{numero}}</div>
      <div class="fecha">{{formatDateTime fecha}}</div>
    </div>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">Datos del Socio</div>
      <div class="row">
        <div class="field"><label>Apellido y Nombre</label><span>{{socio}}</span></div>
        <div class="field"><label>Documento</label><span>{{documento}}</span></div>
        <div class="field"><label>Celular</label><span>{{celular}}</span></div>
      </div>
      {{#if email}}<div class="row"><div class="field"><label>Email</label><span>{{email}}</span></div></div>{{/if}}
    </div>

    <div class="section">
      <div class="section-title">Conceptos Abonados</div>
      <table>
        <thead><tr><th>Descripción</th><th>Período</th><th>Vencimiento</th><th class="r">Importe</th></tr></thead>
        <tbody>
          {{#each conceptos}}
          <tr>
            <td>{{descripcion}}</td>
            <td>{{periodo}}</td>
            <td>{{formatDate vencimiento}}</td>
            <td class="r">$ {{formatCurrency importe}}</td>
          </tr>
          {{/each}}
          <tr class="total-row">
            <td colspan="3">TOTAL ABONADO</td>
            <td class="r">$ {{formatCurrency montoTotal}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Medio de Pago</div>
      <div class="medio-pago">
        <div>
          <strong>{{medioPago}}</strong>
          {{#if nroOperacion}}<br><span style="font-size:8pt;color:#374151">N° operación: {{nroOperacion}}</span>{{/if}}
          {{#if bancoOrigen}}<br><span style="font-size:8pt;color:#374151">Banco: {{bancoOrigen}}</span>{{/if}}
        </div>
        <div style="margin-left:auto;font-size:12pt;font-weight:bold;color:#16a34a">
          $ {{formatCurrency montoRecibido}}
        </div>
      </div>
      {{#if montoACuenta}}
      <div style="margin-top:4px;font-size:8pt;color:#6b7280">A cuenta registrado: $ {{formatCurrency montoACuenta}}</div>
      {{/if}}
    </div>

    {{#if observaciones}}
    <div class="section">
      <div class="section-title">Observaciones</div>
      <p style="font-size:8.5pt;color:#374151">{{observaciones}}</p>
    </div>
    {{/if}}
  </div>

  <div class="footer">
    Caja: {{caja}} {{#if cobrador}} | Cobrador: {{cobrador}}{{/if}} | Generado: {{../generatedAt}}
  </div>
</div>
{{/each}}
</body></html>`,

    actividades_inscripciones: `${BASE_STYLES}
<div class="header">
  <div><div class="title">Inscripciones por Actividad</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Actividad</th><th>Categoría</th><th>Socio</th></tr></thead>
  <tbody>
    {{#groupBy data.items "actividad"}}
    <tr class="group-hdr"><td colspan="4">{{key}} ({{count}} inscriptos)</td></tr>
    {{#each items}}
    <tr><td>{{inc @index}}</td><td>{{actividad}}</td><td>{{categoria}}</td><td>{{socio}}</td></tr>
    {{/each}}
    {{/groupBy}}
  </tbody>
</table>
<div class="grand-total">Total inscripciones: {{data.summary.total}}</div>
</body></html>`,
  }

  templates.orden_trabajo = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 12mm; }
  .ot { border: 2px solid #1d4ed8; border-radius: 8px; overflow: hidden; }
  .ot-header { background: linear-gradient(90deg, #1e3a8a, #1d4ed8); color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
  .ot-header .left .club { font-size: 11pt; font-weight: bold; }
  .ot-header .left .sub { font-size: 8pt; opacity: 0.9; margin-top: 2px; }
  .ot-header .right { text-align: right; }
  .ot-header .right .title { font-size: 14pt; font-weight: bold; letter-spacing: 1px; }
  .ot-header .right .numero { font-size: 11pt; margin-top: 2px; font-family: 'Courier New', monospace; }
  .ot-header .right .fecha { font-size: 8pt; opacity: 0.85; }
  .ot-body { padding: 14px 18px; }
  .titulo-ot { font-size: 13pt; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; }
  .badges { display: flex; gap: 8px; margin: 6px 0 14px; flex-wrap: wrap; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 8pt; font-weight: bold; }
  .b-pendiente   { background: #fef3c7; color: #92400e; }
  .b-en_proceso  { background: #dbeafe; color: #1e40af; }
  .b-resuelta    { background: #d1fae5; color: #065f46; }
  .b-cancelada   { background: #f3f4f6; color: #4b5563; }
  .b-baja      { background: #f3f4f6; color: #4b5563; }
  .b-media     { background: #dbeafe; color: #1e40af; }
  .b-alta      { background: #fed7aa; color: #9a3412; }
  .b-urgente   { background: #fee2e2; color: #991b1b; }
  .b-tipo      { background: #ede9fe; color: #5b21b6; }
  .seccion { margin-bottom: 14px; }
  .seccion h3 { font-size: 9pt; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
  .desc { background: #f9fafb; padding: 10px 12px; border-radius: 4px; font-size: 9.5pt; white-space: pre-wrap; line-height: 1.5; }
  .resolucion { background: #ecfdf5; border-left: 3px solid #10b981; padding: 10px 12px; border-radius: 4px; font-size: 9.5pt; white-space: pre-wrap; line-height: 1.5; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; font-size: 9pt; }
  .info-grid .k { color: #6b7280; }
  .info-grid .v { color: #111; font-weight: 500; }
  .costos { display: flex; gap: 12px; margin-top: 4px; }
  .costos .box { flex: 1; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; }
  .costos .box .label { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; }
  .costos .box .valor { font-size: 12pt; font-weight: bold; color: #111; }
  .historial { margin-top: 6px; }
  .h-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 8.5pt; }
  .h-item:last-child { border-bottom: none; }
  .h-item .h-fecha { width: 110px; color: #6b7280; flex-shrink: 0; font-size: 8pt; }
  .h-item .h-cuerpo { flex: 1; }
  .h-item .h-quien { font-weight: 600; color: #1f2937; }
  .h-item .h-tipo { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 7pt; margin-left: 6px; }
  .h-item .h-tipo.com { background: #f3f4f6; color: #6b7280; }
  .h-item .h-tipo.est { background: #dbeafe; color: #1e40af; }
  .h-item .h-tipo.asg { background: #ede9fe; color: #5b21b6; }
  .h-item .h-texto { color: #374151; margin-top: 3px; white-space: pre-wrap; line-height: 1.4; }
  .firmas { display: flex; gap: 24px; margin-top: 32px; }
  .firma { flex: 1; text-align: center; }
  .firma .linea { border-top: 1px solid #6b7280; margin: 0 12px 4px; height: 36px; }
  .firma .label { font-size: 8pt; color: #6b7280; }
</style></head><body>

{{#with data.items.[0]}}
<div class="ot">
  <div class="ot-header">
    <div class="left">
      <div class="club">{{../summary.tenant.nombre}}</div>
      {{#if ../summary.tenant.direccion}}<div class="sub">{{../summary.tenant.direccion}}</div>{{/if}}
      {{#if ../summary.tenant.telefono}}<div class="sub">Tel: {{../summary.tenant.telefono}}</div>{{/if}}
    </div>
    <div class="right">
      <div class="title">ORDEN DE TRABAJO</div>
      <div class="numero">{{numero}}</div>
      <div class="fecha">Apertura: {{formatDateTime fechaApertura}}</div>
    </div>
  </div>

  <div class="ot-body">
    <div class="titulo-ot">{{titulo}}</div>
    <div class="badges">
      <span class="badge b-{{lower estado}}">{{estado}}</span>
      <span class="badge b-{{lower prioridad}}">Prioridad: {{prioridad}}</span>
      <span class="badge b-tipo">{{tipo}}</span>
    </div>

    {{#if descripcion}}
    <div class="seccion">
      <h3>Descripción del problema</h3>
      <div class="desc">{{descripcion}}</div>
    </div>
    {{/if}}

    <div class="seccion">
      <h3>Asignación y ubicación</h3>
      <div class="info-grid">
        <div><span class="k">Responsable:</span> <span class="v">{{#if responsable}}{{responsable}}{{#if responsableTipo}} ({{responsableTipo}}){{/if}}{{else}}Sin asignar{{/if}}</span></div>
        <div><span class="k">Ubicación:</span> <span class="v">{{#if ubicacion}}{{ubicacion}}{{else}}—{{/if}}</span></div>
        {{#if responsableTel}}<div><span class="k">Tel. responsable:</span> <span class="v">{{responsableTel}}</span></div>{{/if}}
        {{#if centroCosto}}<div><span class="k">Centro de costo:</span> <span class="v">{{centroCosto}}</span></div>{{/if}}
      </div>
    </div>

    <div class="seccion">
      <h3>Fechas</h3>
      <div class="info-grid">
        <div><span class="k">Apertura:</span> <span class="v">{{formatDateTime fechaApertura}}</span></div>
        <div><span class="k">Inicio:</span> <span class="v">{{#if fechaInicio}}{{formatDateTime fechaInicio}}{{else}}—{{/if}}</span></div>
        <div><span class="k">Cierre:</span> <span class="v">{{#if fechaResolucion}}{{formatDateTime fechaResolucion}}{{else}}—{{/if}}</span></div>
      </div>
    </div>

    {{#if costoEstimado}}{{else}}{{#if costoReal}}{{/if}}{{/if}}
    {{#if costoEstimado}}
    <div class="seccion">
      <h3>Costos</h3>
      <div class="costos">
        <div class="box">
          <div class="label">Estimado</div>
          <div class="valor">$ {{formatCurrency costoEstimado}}</div>
        </div>
        {{#if costoReal}}
        <div class="box">
          <div class="label">Real</div>
          <div class="valor">$ {{formatCurrency costoReal}}</div>
        </div>
        {{/if}}
      </div>
    </div>
    {{else}}{{#if costoReal}}
    <div class="seccion">
      <h3>Costos</h3>
      <div class="costos">
        <div class="box">
          <div class="label">Real</div>
          <div class="valor">$ {{formatCurrency costoReal}}</div>
        </div>
      </div>
    </div>
    {{/if}}{{/if}}

    {{#if resolucion}}
    <div class="seccion">
      <h3>Resolución</h3>
      <div class="resolucion">{{resolucion}}</div>
    </div>
    {{/if}}

    {{#if historial.length}}
    <div class="seccion">
      <h3>Historial ({{historial.length}} eventos)</h3>
      <div class="historial">
        {{#each historial}}
        <div class="h-item">
          <div class="h-fecha">{{formatDateTime fecha}}</div>
          <div class="h-cuerpo">
            <span class="h-quien">{{admin}}</span>
            {{#if (eq tipo "COMENTARIO")}}<span class="h-tipo com">comentario</span>{{/if}}
            {{#if (eq tipo "CAMBIO_ESTADO")}}<span class="h-tipo est">{{#if estadoAnterior}}{{estadoAnterior}} → {{/if}}{{estadoNuevo}}</span>{{/if}}
            {{#if (eq tipo "ASIGNACION")}}<span class="h-tipo asg">asignación</span>{{/if}}
            {{#if comentario}}<div class="h-texto">{{comentario}}</div>{{/if}}
          </div>
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}

    <div class="firmas">
      <div class="firma">
        <div class="linea"></div>
        <div class="label">Solicitante</div>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <div class="label">Responsable / Ejecutó</div>
      </div>
      <div class="firma">
        <div class="linea"></div>
        <div class="label">Conformidad</div>
      </div>
    </div>
  </div>
</div>
{{/with}}

</body></html>`

  templates['socios_listado_firma'] = `${BASE_STYLES}
<style>
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { border: 1px solid #999; padding: 6px 5px; vertical-align: middle; }
  th { background: #1d4ed8; color: white; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
  td.firma { width: 22%; height: 36px; }
  td.r { text-align: right; }
  td.c { text-align: center; }
  tbody tr:nth-child(even) td:not(.firma) { background: #f8fafc; }
  .params { font-size: 9pt; color: #555; margin-bottom: 6px; }
</style>
<div class="header">
  <div><div class="title">Listado de Socios</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span> &nbsp;{{/each}}</div>
<table>
  <thead>
    <tr>
      <th style="width:5%">#</th>
      <th style="width:10%">Nº Socio</th>
      <th style="width:12%">DNI</th>
      <th style="width:33%">Apellido y Nombre</th>
      <th style="width:18%">Categoría</th>
      <th style="width:22%">Firma</th>
    </tr>
  </thead>
  <tbody>
    {{#each data.items}}
    <tr>
      <td class="c">{{inc @index}}</td>
      <td class="c">{{nroSocio}}</td>
      <td>{{documento}}</td>
      <td>{{apellidoNombre}}</td>
      <td>{{categoria}}</td>
      <td class="firma"></td>
    </tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">Total: {{data.summary.total}} socios</div>
</body></html>`

  return templates[queryKey] || `${BASE_STYLES}
<div class="header">
  <div><div class="title">{{reportName}}</div><div class="subtitle">{{tenant.nombre}}</div></div>
  <div class="meta">Generado: {{generatedAt}}<br>{{userName}}</div>
</div>
<div class="params">{{#each paramLabels}}<span><strong>{{this.label}}:</strong> {{this.value}}</span> &nbsp;{{/each}}</div>
<table>
  <tbody>
    {{#each data.items}}
    <tr>{{#each this}}<td>{{this}}</td>{{/each}}</tr>
    {{/each}}
  </tbody>
</table>
<div class="grand-total">{{data.summary.count}} registros</div>
</body></html>`
}
