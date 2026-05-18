import puppeteer from 'puppeteer'
import path from 'path'
import { pathToFileURL } from 'url'

const htmlPath = path.resolve('D:/Desarrollos/React/clubix/docs/marketing/flyer-clubix.html')
const outPath = path.resolve('D:/Desarrollos/React/clubix/docs/marketing/flyer-clubix.pdf')
const fileUrl = pathToFileURL(htmlPath).href

console.log('Cargando:', fileUrl)
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })
  console.log('PDF generado:', outPath)
} finally {
  await browser.close()
}
