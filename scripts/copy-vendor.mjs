// 把瀏覽器端抽文字用的函式庫複製到 public/assets/vendor（自架，不依賴 CDN；CSP 只需 'self'）。
// 版本寫進路徑，搭配 /assets/* 的 immutable 快取。
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(new URL('..', import.meta.url).pathname)
const out = path.join(root, 'public/assets/vendor')
const pdfPkg = path.dirname(require.resolve('pdfjs-dist/package.json'))
const mammothPkg = path.dirname(require.resolve('mammoth/package.json'))
const pdfV = JSON.parse(fs.readFileSync(path.join(pdfPkg, 'package.json'), 'utf8')).version
const mammothV = JSON.parse(fs.readFileSync(path.join(mammothPkg, 'package.json'), 'utf8')).version

fs.rmSync(out, { recursive: true, force: true })
const pdfOut = path.join(out, `pdfjs-${pdfV}`)
fs.mkdirSync(pdfOut, { recursive: true })
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(pdfPkg, 'build', f), path.join(pdfOut, f))
fs.cpSync(path.join(pdfPkg, 'cmaps'), path.join(pdfOut, 'cmaps'), { recursive: true })
fs.cpSync(path.join(pdfPkg, 'standard_fonts'), path.join(pdfOut, 'standard_fonts'), { recursive: true })
fs.copyFileSync(path.join(mammothPkg, 'mammoth.browser.min.js'), path.join(out, `mammoth-${mammothV}.min.js`))
fs.writeFileSync(path.join(out, 'versions.json'), JSON.stringify({ pdfjs: pdfV, mammoth: mammothV }) + '\n')
console.log(`Vendored pdfjs ${pdfV}, mammoth ${mammothV}`)
