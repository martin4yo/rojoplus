'use strict'

/**
 * PDF Worker — runs as a child process, isolated from the main server.
 * Receives { html, pageSetup, voucherMode } as JSON via stdin, writes PDF bytes to stdout.
 */

const puppeteer = require('puppeteer')

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
      process.stdout.write(Buffer.from(pdf))
      process.exit(0)
    }

    // Report mode — add repeating header + footer
    await page.evaluate(() => {
      const style = document.createElement('style')
      style.textContent = 'thead { display: table-header-group !important; }'
      document.head.appendChild(style)

      const header = document.querySelector('.header')
      const params = document.querySelector('.params')
      if (!header) return

      const bodyCS = window.getComputedStyle(document.body)
      const bodyPL = bodyCS.paddingLeft
      const bodyPR = bodyCS.paddingRight
      const bodyPT = parseFloat(bodyCS.paddingTop) || 0

      const headerH = header.offsetHeight
      const paramsH = params ? params.offsetHeight : 0

      Object.assign(header.style, {
        position: 'fixed', top: '0', left: '0', right: '0', margin: '0',
        paddingTop: bodyPT + 'px', paddingLeft: bodyPL, paddingRight: bodyPR,
        background: 'white', zIndex: '1000', boxSizing: 'border-box',
      })

      if (params) {
        Object.assign(params.style, {
          position: 'fixed', top: (bodyPT + headerH) + 'px',
          left: '0', right: '0', margin: '0',
          paddingLeft: bodyPL, paddingRight: bodyPR, zIndex: '999', boxSizing: 'border-box',
        })
      }

      const totalFixedH = bodyPT + headerH + paramsH
      document.body.style.paddingTop = totalFixedH + 'px'

      const MIN_BOTTOM_PX = 20 * 3.7795
      const currentBottom = parseFloat(window.getComputedStyle(document.body).paddingBottom) || 0
      if (currentBottom < MIN_BOTTOM_PX) {
        document.body.style.paddingBottom = MIN_BOTTOM_PX + 'px'
      }
    })

    const pdf = await page.pdf({
      format: pageSetup.format || 'A4',
      landscape: pageSetup.orientation === 'landscape',
      margin: { top: '0', right: '0', bottom: '14mm', left: '0' },
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
    process.stdout.write(Buffer.from(pdf))
    process.exit(0)
  } catch (err) {
    if (browser) { try { await browser.close() } catch (_) {} }
    process.stderr.write(JSON.stringify({ error: err.message || 'Unknown error' }))
    process.exit(1)
  }
})
