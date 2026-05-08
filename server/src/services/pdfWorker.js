/**
 * PDF Worker — runs as a child process, isolated from the main server.
 * Receives { html, pageSetup, voucherMode } as JSON via stdin, writes PDF bytes to stdout.
 *
 * voucherMode=true: skips @page injection and fixed-header logic; lets CSS @page
 * in the template control all margins. Suited for sale/quote/delivery-note vouchers.
 *
 * voucherMode=false (default): wrap body content in a table to make the report
 * header repeat on every page (via <thead>); reserve top/bottom margins via @page
 * so spacing is consistent across pages.
 */

import puppeteer from 'puppeteer'

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { raw += chunk })
process.stdin.on('end', async () => {
  let html, pageSetup, voucherMode
  try {
    ;({ html, pageSetup = {}, voucherMode = false } = JSON.parse(raw))
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: 'Invalid input JSON: ' + e.message }))
    process.exit(1)
  }

  let browser
  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-background-networking',
        '--disable-default-apps', '--disable-sync', '--mute-audio',
      ],
    }
    if (process.env.CHROMIUM_PATH) {
      launchOptions.executablePath = process.env.CHROMIUM_PATH
    }
    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 })

    if (voucherMode) {
      const pdf = await page.pdf({
        format: pageSetup.format || 'A4',
        landscape: pageSetup.orientation === 'landscape',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
        displayHeaderFooter: false,
      })
      await browser.close()
      // Esperar a que stdout drene antes de exit. En Linux el pipe de stdout
      // tiene un buffer pequeño (~64KB); para PDFs grandes write() encola los
      // bytes y devuelve false, y process.exit() corta el flush truncando el PDF.
      process.stdout.write(Buffer.from(pdf), () => process.exit(0))
      return
    }

    // ── Report mode ──────────────────────────────────────────────────────────
    await page.evaluate(() => {
      // 1. Make <thead> repeat on every page (standard CSS)
      // 2. Override @page margins. BASE_STYLES tipicamente tiene `@page { margin: 0 }`
      //    que anula la opción `margin` de page.pdf(). !important + posterior en
      //    orden lo asegura.
      //    - top 8mm: espacio consistente arriba en TODAS las páginas (el
      //      padding-top del body solo afecta la primera, por eso se anula abajo).
      //    - bottom 22mm: reserva para el pie (displayHeaderFooter).
      const style = document.createElement('style')
      style.textContent = `
        thead { display: table-header-group !important; }
        @page { margin: 8mm 0 22mm 0 !important; }
        /* Anular padding vertical del body para que el espacio arriba/abajo
           lo controle @page (consistente en todas las páginas). El padding
           horizontal del body sí se respeta en todas, así que se mantiene. */
        body { padding-top: 0 !important; padding-bottom: 0 !important; }
        /* Tabla envolvente: sin estilos heredados que estorben */
        table.page-wrap, table.page-wrap > thead, table.page-wrap > tbody,
        table.page-wrap > thead > tr, table.page-wrap > tbody > tr,
        table.page-wrap > thead > tr > td, table.page-wrap > tbody > tr > td {
          border: 0 !important; padding: 0 !important; margin: 0 !important;
          background: transparent !important;
        }
      `
      document.head.appendChild(style)

      // Repetir cabecera del reporte en cada página: la única técnica que funciona
      // de forma consistente en Chromium print es envolver el contenido en una
      // tabla y poner la cabecera dentro de un <thead>. position:fixed es frágil
      // y se rompe con ciertas configuraciones de @page.
      //
      // Detección flexible de la cabecera: probamos varios nombres de clase y,
      // si no aparece ninguno, tomamos todo lo que esté antes del primer <table>
      // del body como "cabecera" (heurística para templates customizados).
      const body = document.body
      let headerEl = body.querySelector('.header')
        || body.querySelector('.rep-header')
        || body.querySelector('.report-header')
      const paramsEl = body.querySelector('.params')

      const headerNodes = []
      if (headerEl) {
        headerNodes.push(headerEl)
        if (paramsEl && paramsEl !== headerEl) headerNodes.push(paramsEl)
      } else {
        // Fallback: cabecera = todo lo que está antes del primer <table>
        for (const child of Array.from(body.children)) {
          if (child.tagName === 'TABLE') break
          headerNodes.push(child)
        }
      }
      if (headerNodes.length === 0) return

      // Construir tabla envolvente:
      //   <table class="page-wrap">
      //     <thead><tr><td>[headerNodes]</td></tr></thead>
      //     <tbody><tr><td>[resto del body]</td></tr></tbody>
      //   </table>
      const wrapTable = document.createElement('table')
      wrapTable.className = 'page-wrap'
      wrapTable.style.cssText = 'width:100%; border-collapse:collapse;'

      const thead = document.createElement('thead')
      const theadTr = document.createElement('tr')
      const theadTd = document.createElement('td')
      headerNodes.forEach(n => theadTd.appendChild(n))
      theadTr.appendChild(theadTd)
      thead.appendChild(theadTr)
      wrapTable.appendChild(thead)

      const tbody = document.createElement('tbody')
      const tbodyTr = document.createElement('tr')
      const tbodyTd = document.createElement('td')
      while (body.firstChild) tbodyTd.appendChild(body.firstChild)
      tbodyTr.appendChild(tbodyTd)
      tbody.appendChild(tbodyTr)
      wrapTable.appendChild(tbody)

      body.appendChild(wrapTable)
    })

    const pdf = await page.pdf({
      format: pageSetup.format || 'A4',
      landscape: pageSetup.orientation === 'landscape',
      // bottom 22mm reforzado por la regla @page inyectada arriba (!important)
      // para vencer cualquier @page del template.
      margin: { top: '0', right: '0', bottom: '22mm', left: '0' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-family:Arial,sans-serif;font-size:9px;color:#6b7280;
                    width:100%;padding:0 12mm;display:flex;justify-content:space-between;
                    align-items:center;box-sizing:border-box;">
          <span>Generado por Clubix</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>`,
    })

    await browser.close()
    // Mismo cuidado que en voucherMode: esperar drain de stdout antes de exit.
    process.stdout.write(Buffer.from(pdf), () => process.exit(0))
    return
  } catch (err) {
    if (browser) { try { await browser.close() } catch (_) {} }
    process.stderr.write(JSON.stringify({ error: err.message || 'Unknown error' }))
    process.exit(1)
  }
})
