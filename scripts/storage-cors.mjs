// 設定物件儲存 bucket 的 CORS，讓瀏覽器能用 presigned URL 直傳（PUT）與下載（GET）。
// 用法：STORAGE_* 環境變數設好後 → node scripts/storage-cors.mjs https://你的站.netlify.app [https://另一個來源 ...]
// Neon 支援 PutBucketCors（neon.com/docs/storage/s3-compatibility）。
import { createHash } from 'node:crypto'
import { signedFetch, storageConfig, uriEncode } from '../src/storage.js'

const origins = process.argv.slice(2).filter((o) => /^https:\/\/[^/]+$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o))
if (!origins.length) {
  console.error('請提供至少一個來源，例如：node scripts/storage-cors.mjs https://personal-ai.netlify.app http://localhost:8888')
  process.exit(1)
}
const cfg = storageConfig(process.env)
if (!cfg) { console.error('缺少 STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY'); process.exit(1) }

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
${origins.map((o) => `    <AllowedOrigin>${o}</AllowedOrigin>`).join('\n')}
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`
const url = `${cfg.endpoint}/${uriEncode(cfg.bucket)}?cors=`
const res = await signedFetch(cfg, {
  method: 'PUT', url, body: xml,
  headers: { 'content-type': 'application/xml', 'content-md5': createHash('md5').update(xml).digest('base64') },
})
console.log(res.status, await res.text())
process.exit(res.ok ? 0 : 1)
