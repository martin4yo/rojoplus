/**
 * Actualiza el htmlTemplate del reporte "Socios morosos por actividad / categoría"
 * en todos los tenants donde existe, para:
 *   - Destacar visualmente cuotas CUOTA_SOCIAL (badge ámbar + fila resaltada).
 *   - Mantener el resto del diseño intacto.
 *
 * Es idempotente: si ya fue actualizado (detecta el marcador), no vuelve a tocarlo.
 */
import prisma from '../lib/prisma.js'

const MARKER = '<!-- v2-cuota-social -->'

const NUEVO_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
${MARKER}
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
  /* Cuota social: fila resaltada + badge */
  .cuota-social td { background:#fef3c7 !important; }
  .cuota-social td:first-child { border-left:3px solid #f59e0b; padding-left:6px; }
  .badge-social {
    display:inline-block; background:#f59e0b; color:#fff;
    padding:1px 6px; border-radius:3px; font-size:7pt; font-weight:bold;
    margin-left:4px; vertical-align:middle;
  }
</style></head><body>
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
        <tr{{#if (eq tipo "CUOTA_SOCIAL")}} class="cuota-social"{{/if}}>
          <td>{{periodo}}{{#if (eq tipo "CUOTA_SOCIAL")}}<span class="badge-social">SOCIAL</span>{{/if}}</td>
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
</body></html>`

const reportes = await prisma.reportTemplate.findMany({
  where: { queryKey: 'morosos_por_actividad', isActive: true },
  select: { id: true, name: true, tenantId: true, htmlTemplate: true },
})

console.log(`Reportes encontrados: ${reportes.length}\n`)

for (const r of reportes) {
  const tenant = await prisma.tenant.findUnique({ where: { id: r.tenantId }, select: { slug: true } })
  if (r.htmlTemplate?.includes(MARKER)) {
    console.log(`  [${tenant?.slug}] id=${r.id.slice(-12)} → ya tiene v2-cuota-social, skip`)
    continue
  }
  await prisma.reportTemplate.update({
    where: { id: r.id },
    data: { htmlTemplate: NUEVO_HTML },
  })
  console.log(`  [${tenant?.slug}] id=${r.id.slice(-12)} → ACTUALIZADO (${NUEVO_HTML.length} chars)`)
}

console.log('\nDone.')
process.exit(0)
