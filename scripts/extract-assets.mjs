import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'src', 'web_decoded.html'), 'utf8');
const outDir = path.join(root, 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) throw new Error('No <style> block in web_decoded.html');
fs.writeFileSync(path.join(outDir, 'app.css'), cssMatch[1].trim() + '\n');

const markupStart = html.indexOf('<div class="ta-app">');
const scriptTag = html.indexOf('\n<script>', markupStart);
if (markupStart < 0 || scriptTag < 0) throw new Error('Could not locate app markup');
const markup = html
  .slice(markupStart, scriptTag)
  .trim()
  .replace(/__AVATAR_URI__/g, '/avatar.png');

const iifeStart = html.indexOf('(function() {', scriptTag);
const iifeEnd = html.lastIndexOf('</script>');
if (iifeStart < 0 || iifeEnd < 0) throw new Error('Could not locate app script');
let iife = html.slice(iifeStart, iifeEnd).trim().replace(/__AVATAR_URI__/g, '/avatar.png');

if (!iife.startsWith('(function() {')) throw new Error('Unexpected IIFE shape');
const inject =
  '(function() {\n' +
  '  var _root = document.getElementById(\'app\');\n' +
  '  if (_root) _root.innerHTML = ' + JSON.stringify(markup) + ';\n';
iife = inject + iife.slice('(function() {'.length);

fs.writeFileSync(path.join(outDir, 'app.js'), iife + '\n');
console.log('Wrote public/assets/app.css (' + cssMatch[1].length + ' chars)');
console.log('Wrote public/assets/app.js (' + iife.length + ' chars, markup ' + markup.length + ')');
