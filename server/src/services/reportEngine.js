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
