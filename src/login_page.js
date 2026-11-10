import { APP_NAME, APP_VERSION } from './config.js'

export function loginPage({ error = '', next = '/' } = {}) {
  const safeNext = String(next || '/').startsWith('/') && !String(next).startsWith('//') ? next : '/'
  const message = error ? `<p class="error" role="alert">${error === 'rate' ? '嘗試次數過多，請稍後再試。' : '密碼不正確。'}</p>` : ''
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="dark">
<title>登入 · ${APP_NAME}</title>
<style>
  :root { color-scheme: dark; --bg:#080c14; --panel:#0f1520; --line:#243044; --text:#e7edf7; --muted:#8b9bb4; --accent:#7dd3fc; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(900px 500px at 50% -10%,#16263d 0%,var(--bg) 55%); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { width:min(92vw,390px); padding:30px; border:1px solid var(--line); border-radius:16px; background:linear-gradient(180deg,rgba(20,30,46,.96),rgba(12,18,28,.98)); box-shadow:0 24px 80px rgba(0,0,0,.45); }
  .mark { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:#0b2233; border:1px solid #1d4e63; color:var(--accent); font-weight:800; font-size:18px; margin-bottom:18px; }
  h1 { font-size:1.2rem; margin:0 0 6px; letter-spacing:-.02em; }
  p.sub { margin:0 0 22px; color:var(--muted); font-size:.85rem; line-height:1.5; }
  label { display:block; font-size:.8rem; color:var(--muted); margin-bottom:7px; }
  input { width:100%; height:44px; border-radius:10px; border:1px solid var(--line); background:#080e17; color:var(--text); padding:0 13px; font-size:1rem; outline:none; }
  input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.16); }
  button { width:100%; height:44px; margin-top:14px; border:0; border-radius:10px; background:#e7edf7; color:#08101c; font-weight:700; font-size:.92rem; cursor:pointer; }
  button:hover { background:#fff; }
  .error { color:#fecaca; background:#3f1518; border:1px solid #7f1d1d; padding:9px 11px; border-radius:9px; font-size:.82rem; margin:0 0 14px; }
  footer { margin-top:18px; color:#5f708a; font-size:.72rem; text-align:center; }
</style>
</head>
<body>
<main>
  <div class="mark">AI</div>
  <h1>${APP_NAME}</h1>
  <p class="sub">私人工作區。輸入部署時設定的密碼即可繼續。</p>
  ${message}
  <form method="post" action="/api/login">
    <input type="hidden" name="next" value="${escapeAttr(safeNext)}">
    <label for="password">密碼</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    <button type="submit">登入</button>
  </form>
  <footer>Personal AI v${APP_VERSION}</footer>
</main>
</body>
</html>`
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function loginResponse(opts, status = 200) {
  return new Response(loginPage(opts), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  })
}