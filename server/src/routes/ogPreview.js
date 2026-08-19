/**
 * Vista previa por tenant para crawlers de redes sociales (WhatsApp, Facebook,
 * Telegram, Slack...).
 *
 * Problema que resuelve: nginx sirve `client/dist/index.html` estático para
 * cualquier ruta y cualquier dominio, y ese archivo trae los meta tags de Open
 * Graph fijos de Clubix. Resultado: compartir el link de CUALQUIER club por
 * WhatsApp mostraba el logo, el título y la descripción de Clubix.
 *
 * Acá se lee ese mismo index.html y se reemplazan los tags con el nombre y el
 * logo del tenant resuelto por el Host. nginx desvía a esta ruta SOLO a los
 * crawlers (ver el `map $http_user_agent $es_crawler` en la config del sitio),
 * asi que los navegadores reales siguen recibiendo el archivo estático sin
 * pasar por Node.
 */
import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prisma from '../lib/prisma.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DIST_INDEX = process.env.SPA_DIST_PATH
  || path.resolve(__dirname, '../../../client/dist/index.html')

// Cache del HTML base, invalidado por mtime (un deploy lo regenera)
let cacheHtml = null
let cacheMtime = 0

function leerIndexHtml() {
  const stat = fs.statSync(DIST_INDEX)
  if (!cacheHtml || stat.mtimeMs !== cacheMtime) {
    cacheHtml = fs.readFileSync(DIST_INDEX, 'utf8')
    cacheMtime = stat.mtimeMs
  }
  return cacheHtml
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function subdominioDe(host) {
  const partes = (host || '').split(':')[0].split('.')
  if (partes.length <= 2) return null
  if (partes[0] === 'www') return null
  return partes[0]
}

async function resolverTenant(host) {
  const sub = subdominioDe(host)
  if (sub) {
    const porSub = await prisma.tenant.findUnique({ where: { subdomain: sub } })
    if (porSub?.activo) return porSub
  }
  const hostSinPuerto = (host || '').split(':')[0]
  if (hostSinPuerto) {
    const porDominio = await prisma.tenant.findUnique({ where: { dominioCustom: hostSinPuerto } })
    if (porDominio?.activo) return porDominio
  }
  return null
}

/**
 * Reemplaza el valor de un meta tag si existe. No lo agrega si falta: el
 * index.html ya los trae todos, y agregarlos a ciegas duplicaría tags.
 */
function setMeta(html, attr, name, valor) {
  const re = new RegExp(
    `(<meta\\s+${attr}=["']${name}["']\\s+content=["'])[^"']*(["'])`,
    'i'
  )
  return html.replace(re, `$1${escapeHtml(valor)}$2`)
}

router.get('/og-preview', async (req, res) => {
  try {
    const host = req.get('X-Forwarded-Host') || req.get('host') || ''
    const proto = req.get('X-Forwarded-Proto') || 'https'
    const uriOriginal = req.get('X-Original-URI') || '/'

    let html = leerIndexHtml()
    const tenant = await resolverTenant(host)

    // Sin tenant (ej: el apex clubix.com.ar) se devuelve el HTML tal cual,
    // que ya trae el branding de Clubix y es lo correcto para ese dominio.
    if (tenant) {
      const nombre = tenant.nombre
      const imagen = tenant.logoUrl
        ? (tenant.logoUrl.startsWith('http') ? tenant.logoUrl : `${proto}://${host}${tenant.logoUrl}`)
        : null
      const descripcion = `Portal de socios de ${nombre}.`

      html = setMeta(html, 'property', 'og:site_name', nombre)
      html = setMeta(html, 'property', 'og:title', nombre)
      html = setMeta(html, 'property', 'og:description', descripcion)
      html = setMeta(html, 'property', 'og:url', `${proto}://${host}${uriOriginal}`)
      html = setMeta(html, 'name', 'twitter:title', nombre)
      html = setMeta(html, 'name', 'twitter:description', descripcion)
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(nombre)}</title>`)

      if (imagen) {
        html = setMeta(html, 'property', 'og:image', imagen)
        html = setMeta(html, 'name', 'twitter:image', imagen)
        // Las medidas fijas del index.html son del logo de Clubix y no aplican
        // al logo del club; dejarlas mal hace que WhatsApp recorte raro.
        html = html.replace(/\s*<meta\s+property=["']og:image:(width|height)["'][^>]*>/gi, '')
      }
    }

    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=300')
    return res.send(html)
  } catch (err) {
    console.error('[og-preview] error:', err.message)
    // Ante cualquier problema, devolver el index.html sin tocar es mejor que
    // romperle la preview (o la navegación) a alguien.
    try {
      return res.set('Content-Type', 'text/html; charset=utf-8').send(leerIndexHtml())
    } catch {
      return res.status(500).send('')
    }
  }
})

export default router
