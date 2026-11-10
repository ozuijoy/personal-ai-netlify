export function makeNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function shellCsp(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://image.pollinations.ai",
    "media-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https: blob:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "media-src data: blob: https:",
  "connect-src https:",
  "frame-src 'none'",
  "worker-src blob:",
  "form-action https:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ')

export function previewFrameResponse() {
  const html = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>預覽</title></head><body><script>
(function(){
  var done = false;
  window.addEventListener('message', function (e) {
    if (done || e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.type !== 'ta-preview' || typeof d.html !== 'string') return;
    done = true;
    document.open(); document.write(d.html); document.close();
  });
  try { window.parent.postMessage({ type: 'ta-preview-ready' }, '*'); } catch (err) {}
})();
<\/script></body></html>`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Security-Policy': PREVIEW_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export function sameOriginRequest(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

export function applySecurityHeaders(request, response) {
  if (!response || response.status === 101) return response
  let res
  try { res = new Response(response.body, response) } catch { return response }
  const headers = res.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  // The artifact preview iframe is same-origin and must be frameable. All
  // other pages remain unframeable.
  if (new URL(request.url).pathname === '/sandbox/frame') headers.set('X-Frame-Options', 'SAMEORIGIN')
  else headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  if (new URL(request.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return res
}