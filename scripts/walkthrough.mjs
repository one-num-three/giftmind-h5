/**
 * 移动端全流程走查：375×812 逐屏截图 + 控制台错误收集
 * 用法：CHROME_PATH=... node scripts/walkthrough.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../.walkthrough/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const errors = []
const notes = []
let shot = 0

async function snap(page, name, full = false) {
  shot += 1
  await page.screenshot({
    path: join(OUT, `${String(shot).padStart(2, '0')}-${name}.png`),
    fullPage: full,
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function scrollTo(page, top) {
  await page.evaluate((t) => {
    const el = document.querySelector('.page__body') || document.scrollingElement
    el?.scrollTo({ top: t })
    window.scrollTo({ top: t })
  }, top)
}
async function scrollBottom(page) {
  await page.evaluate(() => {
    const el = document.querySelector('.page__body') || document.scrollingElement
    if (el) el.scrollTo({ top: el.scrollHeight })
    window.scrollTo({ top: document.body.scrollHeight })
  })
}
async function checkOverflow(page, label) {
  const r = await page.evaluate(() => {
    const d = document.documentElement
    const app = document.getElementById('app')
    return {
      docScroll: d.scrollWidth,
      docClient: d.clientWidth,
      appScroll: app?.scrollWidth || 0,
      appClient: app?.clientWidth || 0,
    }
  })
  if (r.docScroll > r.docClient + 1 || r.appScroll > r.appClient + 1) {
    notes.push(`⚠ 横向溢出 @${label}: ${JSON.stringify(r)}`)
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`[console] ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

/* ── 1. 首页 ── */
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await sleep(1400)
await snap(page, 'landing-hero')
await checkOverflow(page, 'landing')
await scrollTo(page, 900)
await sleep(700)
await snap(page, 'landing-flow')
await scrollTo(page, 1900)
await sleep(700)
await snap(page, 'landing-deliver')
await scrollBottom(page)
await sleep(900)
await snap(page, 'landing-bottom')

/* ── 2. 对话 ── */
await scrollTo(page, 0)
await sleep(400)
await page.locator('button', { hasText: '开始策划' }).first().click()
await page.waitForURL('**/chat', { timeout: 8000 })
await sleep(2800)
await snap(page, 'chat-q1')
await checkOverflow(page, 'chat')

const TEXT_ANSWER = '她一直说想学插花。去年生日那天我们在鼓楼的小店躲雨，躲了整整一个小时。'
let guard = 0
while (!page.url().includes('/generating') && !page.url().includes('/plan') && guard < 40) {
  guard += 1
  await sleep(700)

  const composer = page.locator('.composer__area')
  const chips = page.locator('.choice__chips button')
  const confirm = page.locator('.choice__confirm')

  if (await chips.count()) {
    const n = await chips.count()
    const counter = await page.locator('.choice__counter').count()
    if (counter) {
      // 多选：点前两个（或一个）
      await chips.nth(0).click()
      await sleep(220)
      if (n > 2) {
        await chips.nth(1).click()
        await sleep(220)
      }
      if (guard === 5) await snap(page, 'chat-multi')
      if (await confirm.count()) await confirm.first().click()
    } else {
      await chips.nth(Math.min(1, n - 1)).click()
    }
    continue
  }

  if ((await composer.count()) && (await composer.last().isVisible())) {
    const box = page.locator('.composer').last()
    const area = box.locator('textarea').last()
    await area.click()
    await area.fill(TEXT_ANSWER)
    await sleep(350)
    await snap(page, 'chat-text')
    const send = box.locator('.composer__send').last()
    if (await send.isEnabled().catch(() => false)) await send.click()
    else await area.press('Enter')
    continue
  }
}
notes.push(`对话推进用了 ${guard} 轮，最终 URL = ${page.url()}`)

/* ── 3. 生成中 ── */
if (page.url().includes('/generating')) {
  await sleep(900)
  await snap(page, 'generating-1')
  await sleep(2400)
  await snap(page, 'generating-2')
}
await page.waitForURL('**/plan**', { timeout: 30000 }).catch(() => notes.push('⚠ 未跳转到 /plan'))
await sleep(1800)

/* ── 4. 方案页 ── */
await snap(page, 'plan-cover')
await checkOverflow(page, 'plan')
const planH = await page.evaluate(
  () => document.querySelector('.page__body')?.scrollHeight || 0,
)
notes.push(`方案页可滚动高度 ${planH}px`)
for (const [i, top] of [600, 1200, 1900, 2600, 3400].entries()) {
  await scrollTo(page, top)
  await sleep(600)
  await snap(page, `plan-${i + 1}`)
}
await scrollBottom(page)
await sleep(600)
await snap(page, 'plan-bottom')

/* ── 5. 分享配置 ── */
const shareBtn = page.locator('button:visible', { hasText: /做成给\s*TA|给 TA 的页面/ }).first()
if (await shareBtn.count()) {
  await shareBtn.click()
  await page.waitForURL('**/share/edit/**', { timeout: 8000 }).catch(() => {})
  await sleep(1500)
  await snap(page, 'share-editor')
  await checkOverflow(page, 'share-editor')
  await scrollTo(page, 700)
  await sleep(600)
  await snap(page, 'share-editor-2')
  await scrollBottom(page)
  await sleep(600)
  await snap(page, 'share-editor-3')

  const gen = page.locator('button:visible', { hasText: /生成链接/ }).first()
  if (await gen.count()) {
    await gen.click()
    await sleep(1800)
    await snap(page, 'share-link')
    const preview = page.locator('button:visible', { hasText: /预览/ }).first()
    if (await preview.count()) {
      await preview.click()
      await sleep(2000)
      await snap(page, 'share-cover')
      await checkOverflow(page, 'share')
      // 点击开信
      await page.mouse.click(187, 430)
      await sleep(1600)
      await snap(page, 'share-opened')
      for (const [i, top] of [500, 1200, 2000, 2800].entries()) {
        await scrollTo(page, top)
        await sleep(700)
        await snap(page, `share-${i + 1}`)
      }
      await scrollBottom(page)
      await sleep(600)
      await snap(page, 'share-bottom')
    }
  }
} else {
  notes.push('⚠ 方案页没找到「做成给 TA 的页面」按钮')
}

/* ── 6. 我的方案 ── */
await page.goto(`${BASE}/#/history`, { waitUntil: 'domcontentloaded' })
await sleep(1400)
await snap(page, 'history')
await checkOverflow(page, 'history')

await page.evaluate(() => localStorage.clear())
await page.goto(`${BASE}/#/history`, { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await sleep(1200)
await snap(page, 'history-empty')

/* ── 7. 430 宽屏 ── */
await page.setViewportSize({ width: 430, height: 932 })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await sleep(1200)
await snap(page, 'landing-430')
await checkOverflow(page, '430-landing')

/* ── 8. 桌面宽度收口 ── */
await page.setViewportSize({ width: 1280, height: 900 })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await sleep(1200)
await snap(page, 'desktop-1280')

await browser.close()
console.log(JSON.stringify({ shots: shot, notes, errors }, null, 2))
