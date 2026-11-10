import { APP_NAME, APP_VERSION, siteOrigin } from './config.js'
import { makeNonce, shellCsp } from './security.js'

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

const ASSET_V = '1'

export function htmlShell({ lang = 'zh-TW', nonce = '', origin = '' } = {}) {
  const safeLang = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang) ? lang : 'zh-TW'
  const canonical = `${origin || ''}/`
  return `<!DOCTYPE html>
<html lang="${esc(safeLang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${APP_NAME}</title>
<meta name="description" content="私人 AI 對話工作區">
<meta name="application-name" content="${APP_NAME}">
<meta name="theme-color" content="#080c14">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/avatar.png">
<link rel="apple-touch-icon" href="/avatar.png">
<link rel="manifest" href="/manifest.json">
<meta property="og:site_name" content="${APP_NAME}">
<meta property="og:title" content="${APP_NAME}">
<meta property="og:description" content="私人 AI 對話工作區">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="/assets/app.css?v=${ASSET_V}">
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js" integrity="sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi" crossorigin="anonymous" defer></script>
</head>
<body>
<div id="app"></div>
<script nonce="${esc(nonce)}">
window.TA_GEO={};
try { localStorage.setItem('ta_lang', '${esc(safeLang)}'); } catch (e) {}
</script>
<script src="/assets/i18n/${esc(safeLang)}.js?v=${ASSET_V}" defer></script>
<script src="/assets/i18n.js?v=${ASSET_V}" defer></script>
<script src="/assets/app.js?v=${ASSET_V}" defer></script>
<script src="/assets/prompts.js?v=${ASSET_V}" defer></script>
</body>
</html>`
}

export function htmlResponse(request, env, opts = {}, status = 200) {
  const nonce = makeNonce()
  const origin = siteOrigin(request, env)
  return new Response(htmlShell({ ...opts, origin, nonce }), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'private, no-store',
      'CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Content-Security-Policy': shellCsp(nonce),
      'X-Personal-AI-Version': APP_VERSION,
    },
  })
}