/** 校验单文件预览版：直接 file:// 打开能否跑通首屏与对话 */
import { chromium } from 'playwright'

const file = `file://${new URL('../giftmind-demo.html', import.meta.url).pathname}`
const errors = []
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
})

await page.goto(file, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 1500))
const title = await page.locator('.hero__title, h1').first().innerText().catch(() => '')
await page.screenshot({ path: new URL('../.walkthrough/demo-file.png', import.meta.url).pathname })

await page.locator('button', { hasText: '开始策划' }).first().click()
await new Promise((r) => setTimeout(r, 3000))
const chips = await page.locator('.choice__chips button').count()
await page.screenshot({ path: new URL('../.walkthrough/demo-file-chat.png', import.meta.url).pathname })

await browser.close()
console.log(JSON.stringify({ title: title.replace(/\n/g, ' '), chips, errors }, null, 2))
