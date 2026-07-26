/**
 * 把 dist-single/ 的产物内联成一个自包含 HTML，方便直接双击预览 / 发给别人看。
 * 用法：SINGLE=1 vite build && node scripts/inline.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIST = new URL('../dist-single/', import.meta.url).pathname
const OUT = new URL('../giftmind-demo.html', import.meta.url).pathname

let html = readFileSync(join(DIST, 'index.html'), 'utf8')
const entries = readdirSync(DIST)
const dir = entries.includes('assets') ? join(DIST, 'assets') : DIST
const assets = readdirSync(dir)

const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

if (css) {
  const code = readFileSync(join(dir, css), 'utf8')
  // 用 replacer 函数，避免 CSS/JS 里的 $& $' $` 被当成替换模式
  html = html.replace(new RegExp(`\\s*<link[^>]+href="[^"]*${esc(css)}"[^>]*>`), () => `\n    <style>\n${code}\n    </style>`)
}
if (js) {
  const code = readFileSync(join(dir, js), 'utf8')
  html = html.replace(
    new RegExp(`\\s*<script[^>]+src="[^"]*${esc(js)}"[^>]*>\\s*</script>`),
    () => `\n    <script type="module">\n${code}\n    </script>`,
  )
}

html = html.replace(
  '<head>',
  '<head>\n    <!-- GiftMind H5 · 单文件预览版（由 npm run build:demo 生成，源码见工程目录） -->',
)

if (/src="[^"]*\.js"|href="[^"]*\.css"/.test(html)) {
  throw new Error('内联失败：HTML 里仍有未内联的本地资源引用')
}

writeFileSync(OUT, html, 'utf8')
console.log(`✓ ${OUT}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)
