/**
 * ══════════════════════════════════════════════════════════════
 *  「假 AI」内容引擎
 *
 *  设计目标：在没有任何模型的情况下，让输出看起来像是被认真想过的。
 *  三条原则：
 *    1. 确定性 —— 种子来自 answers 本身，同一份问卷永远得到同一份方案。
 *    2. 打分而非抽签 —— 礼物是按多维加权算出来的，不是随机挑的。
 *    3. 故事优先 —— 用户写的 memory 会被抽词、回填进首选礼物和信里。
 *
 *  对外接口（mockAdapter.js 依赖，签名不可改）：
 *    generateMockPlan(answers)                  -> Plan（不含 id/createdAt）
 *    pickGifts(answers, { exclude })            -> Gift[2]
 *    pickGiftGroups(answers, { exclude })       -> RankingGroup[4]
 *    generateLetter(answers, tone)              -> Letter
 * ══════════════════════════════════════════════════════════════
 */

import { seededRandom, pickN, parseBudget, toArray } from '../src/utils/helpers.js'
import {
  LETTER_TEMPLATES,
  RITUAL_LIBRARY,
  INSIGHT_PHRASES,
  TITLE_LIBRARY,
  SHARE_GREETINGS,
  SHARE_EMOJI,
  SHARE_THEME,
  OCCASION_EMOJI,
  RECIPIENT_PROFILE,
  OCCASION_PHRASE,
  TIMING_META,
  MEMORY_HINTS,
  MEMORY_WHY_TEMPLATES,
  RELATIONSHIP_LINES,
  TONE_OVERLAYS,
  LEAD_TIME_TEXT,
  STYLE_TO_CATEGORY,
  FEELINGS,
  TIMINGS,
  TABOOS,
} from './giftLibrary.js'
import { GIFT_CATALOG } from './catalog.js'

/* ══════════════════════════════════════════════════════════════
 *  1. 基础工具
 * ══════════════════════════════════════════════════════════════ */

function str(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function list(v) {
  return toArray(v)
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

/** 从数组里取一个，空数组不会抛错 */
function pick(arr, rand, fallback = '') {
  if (!Array.isArray(arr) || arr.length === 0) return fallback
  const i = Math.floor(rand() * arr.length)
  return arr[clamp(i, 0, arr.length - 1)] ?? fallback
}

/** 稳定种子：同样的答案 → 同样的方案 */
function seedOf(answers, salt = '') {
  let base = '{}'
  try {
    base = JSON.stringify(answers ?? {}) || '{}'
  } catch {
    base = 'unserializable'
  }
  return salt ? `${base}|${salt}` : base
}

/** 按中文句号切句，避免用到 lookbehind（兼容旧 Safari） */
function splitSentences(text) {
  const out = []
  let cur = ''
  for (const ch of String(text || '')) {
    cur += ch
    if (ch === '。' || ch === '！' || ch === '？') {
      out.push(cur)
      cur = ''
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

function truncate(text, max) {
  const s = String(text || '').trim()
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

/** 拼接若干句子，把总长控制在 [min, max] */
function composeText(parts, min, max, fallbacks = []) {
  let out = ''
  for (const p of [...parts, ...fallbacks]) {
    const s = String(p || '').trim()
    if (!s) continue
    if (out.length >= min) break
    if (out.length + s.length > max) continue
    out += s
  }
  return out
}

/* ══════════════════════════════════════════════════════════════
 *  2. 答案归一化 —— 任何字段缺失都不许抛错
 * ══════════════════════════════════════════════════════════════ */

const FEELING_VALUES = Object.values(FEELINGS)

function analyzeMemory(memory) {
  const raw = str(memory)
  if (!raw) {
    return { has: false, raw: '', frag: '', hints: [], ids: new Set(), tags: new Set(), traits: new Set(), title: '' }
  }

  const hints = MEMORY_HINTS.filter((h) => h.keys.some((k) => raw.includes(k)))
  const ids = new Set()
  const tags = new Set()
  const traits = new Set()
  hints.forEach((h) => {
    ;(h.ids || []).forEach((x) => ids.add(x))
    ;(h.tags || []).forEach((x) => tags.add(x))
    ;(h.traits || []).forEach((x) => traits.add(x))
  })

  return {
    has: true,
    raw,
    frag: pickFragment(raw, hints),
    hints,
    ids,
    tags,
    traits,
    title: hints[0]?.title || '',
  }
}

/** 从一段自由文本里抠出一个能直接引用的短句 */
function pickFragment(raw, hints) {
  const parts = raw
    .split(/[，。！？；、,.!?;:：\n\r~…—\-\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const keyed = parts.filter((p) => hints.some((h) => h.keys.some((k) => p.includes(k))))
  const pool = keyed.length ? keyed : parts

  let best = ''
  for (const p of pool) {
    if (p.length <= 18 && p.length > best.length) best = p
  }
  if (best.length >= 3) return best
  // 没有合适的短句：截断第一段
  return truncate(pool[0] || raw, 16)
}

function buildContext(answers) {
  const a = answers && typeof answers === 'object' ? answers : {}

  const recipient = str(a.recipient)
  const profile = RECIPIENT_PROFILE[recipient] || RECIPIENT_PROFILE.default

  const occasion = str(a.occasion)
  const occasionPhrase =
    OCCASION_PHRASE[occasion] ||
    (occasion && occasion.length <= 8 ? occasion : OCCASION_PHRASE.default)

  const timing = str(a.timing)
  const timingMeta = TIMING_META[timing] || TIMING_META.default

  const budget = str(a.budget)
  const [budgetLow, budgetHigh] = parseBudget(budget)

  const personality = list(a.personality)
  const taboo = list(a.taboo)
  const style = list(a.style)
  const categories = style.map((s) => STYLE_TO_CATEGORY[s]).filter(Boolean)

  const feelingRaw = str(a.feeling)
  const feelingKey = FEELING_VALUES.includes(feelingRaw) ? feelingRaw : ''

  const relationshipNote = str(a.relationshipNote)

  return {
    recipient,
    profile,
    you: profile.you,
    third: profile.third,
    occasion,
    occasionPhrase,
    timing,
    days: timingMeta.days,
    timingWord: timingMeta.word,
    budget,
    budgetLow,
    budgetHigh,
    personality,
    taboo,
    style,
    categories,
    feelingRaw,
    feelingKey,
    relationshipNote,
    memory: analyzeMemory(a.memory),
    traitPhrase: '',
  }
}

/* ══════════════════════════════════════════════════════════════
 *  3. 打分匹配
 *
 *  维度与权重（命中 taboo 直接淘汰，其余加权求和）：
 *    性格标签   每命中 +24（上限 60，最高权重）
 *    收礼对象   命中 +18 / 通用 +8 / 不适配 -20
 *    场合       命中 +14 / 不适配 -6
 *    预算       完全落区间 +20 / 有重叠 +10 / 超出 -26~-44 / 偏低 -14~-50
 *    交付时间   leadDays ≤ 剩余天数 +10，否则 -34~-48（只剩两天再额外 -15）
 *    形式偏好   category 命中 style +16 / 组合方案 +6 / 不符 -12
 *    记忆线索   命中礼物 ID +28，命中 tag/trait 各有加成
 *    期望感受   礼物 tag 命中该 feeling 的偏好标签 +6（上限 12）
 *    禁忌软加成 例如忌讳大件时「不占地方」+8
 *  最终归一化到 matchScore 60–98。
 * ══════════════════════════════════════════════════════════════ */

const IDEAL_RAW = 150

function scoreGift(gift, ctx, jitter) {
  const avoid = gift.avoid || []

  // ── 硬淘汰：命中禁忌 ──
  for (const t of ctx.taboo) {
    if (avoid.includes(t)) return null
  }
  if (ctx.taboo.includes(TABOOS.PRICEY) && gift.priceHigh > 800) return null
  if (ctx.taboo.includes(TABOOS.FOOD) && gift.tags.includes('甜')) return null

  let raw = 0

  // 性格标签
  if (ctx.personality.length) {
    let hits = 0
    for (const p of ctx.personality) if (gift.traits.includes(p)) hits++
    raw += Math.min(hits * 24, 60)
    if (hits === 0) raw -= 10
  }

  // 收礼对象
  if (ctx.recipient) {
    if (gift.recipients.includes(ctx.recipient)) raw += 18
    else if (gift.recipients.includes('*')) raw += 8
    else raw -= 20
  }

  // 场合
  if (ctx.occasion) {
    if (gift.occasions.includes(ctx.occasion)) raw += 14
    else raw -= 6
  }

  // 预算
  const lo = ctx.budgetLow
  const hi = ctx.budgetHigh
  if (gift.priceLow >= lo && gift.priceHigh <= hi) raw += 20
  else if (gift.priceLow <= hi && gift.priceHigh >= lo) raw += 10
  else if (gift.priceLow > hi) raw += gift.priceLow > hi * 2 ? -44 : -26
  else {
    // 明显低于预算：不算越界，但会显得没当回事，差得越远扣得越多
    const gap = clamp((lo - gift.priceHigh) / Math.max(1, lo), 0, 1)
    raw -= 22 + Math.round(gap * 40)
  }

  // 交付时间
  if (gift.leadDays <= ctx.days) raw += 10
  else {
    raw += gift.leadDays - ctx.days > 14 ? -48 : -34
    // 只剩一两天时，需要制作周期的东西基本不该出现
    if (ctx.days <= 1 && gift.leadDays >= 7) raw -= 15
  }

  // 形式偏好
  if (ctx.categories.length) {
    if (ctx.categories.includes(gift.category)) raw += 16
    else if (ctx.categories.includes('组合')) raw += 6
    else raw -= 12
  }

  // 记忆线索
  if (ctx.memory.has) {
    if (ctx.memory.ids.has(gift.id)) raw += 28
    const tagHit = gift.tags.filter((t) => ctx.memory.tags.has(t)).length
    raw += Math.min(tagHit * 8, 16)
    const traitHit = gift.traits.filter((t) => ctx.memory.traits.has(t)).length
    raw += Math.min(traitHit * 6, 12)
  }

  // 期望感受
  if (ctx.feelingKey) {
    const wanted = INSIGHT_PHRASES.feelingInsight[ctx.feelingKey]?.giftTags || []
    const hit = gift.tags.filter((t) => wanted.includes(t)).length
    raw += Math.min(hit * 6, 12)
  }

  // 禁忌的软性偏好
  if (ctx.taboo.includes(TABOOS.BULKY) && gift.tags.includes('不占地方')) raw += 8
  if (ctx.taboo.includes(TABOOS.LOUD) && (gift.tags.includes('低调') || gift.tags.includes('不越界'))) raw += 8
  if (ctx.taboo.includes(TABOOS.PRICEY) && gift.priceHigh <= 300) raw += 6
  if (ctx.taboo.includes(TABOOS.DISPOSABLE) && (gift.tags.includes('可珍藏') || gift.tags.includes('日常在用'))) raw += 6

  // 稳定抖动：打散同分，但对同一份 answers 恒定
  raw += (jitter() - 0.5) * 6

  return raw
}

function scoreAll(ctx, seed) {
  const jitter = seededRandom(`${seed}|score`)
  const scored = []
  for (const gift of GIFT_CATALOG) {
    const raw = scoreGift(gift, ctx, jitter)
    if (raw === null) continue
    scored.push({ gift, raw })
  }
  // 极端情况下（禁忌把库清空）退回全库，保证永远有输出
  if (scored.length < 2) {
    const fallbackJitter = seededRandom(`${seed}|fallback`)
    return GIFT_CATALOG.map((gift) => ({ gift, raw: (fallbackJitter() - 0.5) * 6 }))
  }
  return scored
}

/** raw → matchScore(60-98)：相对排名 + 绝对质量各占一半左右 */
function makeScorer(scored) {
  const raws = scored.map((s) => s.raw)
  const best = Math.max(...raws)
  const worst = Math.min(...raws)
  const span = Math.max(1, best - worst)
  return (raw) => {
    const rel = clamp((raw - worst) / span, 0, 1)
    const abs = clamp(raw / IDEAL_RAW, 0, 1)
    return Math.round(clamp(60 + 38 * (0.62 * rel + 0.38 * abs), 60, 98))
  }
}

/** 各取最高分实物和体验，再按综合分排序。 */
function selectGifts(scored, ctx, exclude) {
  const banned = new Set(list(exclude))
  let pool = scored.filter((s) => !banned.has(s.gift.id)).sort((a, b) => b.raw - a.raw)
  if (pool.length < 2) pool = [...scored].sort((a, b) => b.raw - a.raw)

  const product = pool.find((entry) => entry.gift.kind === 'product')
  const activity = pool.find((entry) => entry.gift.kind === 'activity')
  return [product, activity].filter(Boolean).sort((a, b) => b.raw - a.raw)
}

function leadTimeText(gift, days) {
  const base = LEAD_TIME_TEXT[gift.leadDays] || `建议提前 ${gift.leadDays} 天`
  return gift.leadDays > days ? `${base} · 时间偏紧，务必问加急` : base
}

/** 把 memory 的关键词织进首选礼物的 why */
function weaveMemory(why, frag, rand) {
  const tpl = pick(MEMORY_WHY_TEMPLATES, rand, '{why}')
  const prefix = tpl.split('{why}')[0].replace('{frag}', frag)
  const room = 88 - prefix.length
  if (why.length <= room) return `${prefix}${why}`

  let tail = ''
  for (const s of splitSentences(why)) {
    if (tail.length + s.length > room) break
    tail += s
  }
  if (!tail) tail = `${why.slice(0, Math.max(4, room - 1))}。`
  return `${prefix}${tail}`
}

function decorateGift(entry, ctx, index, toScore, rand) {
  const g = entry.gift
  const why = index === 0 && ctx.memory.has && ctx.memory.frag ? weaveMemory(g.why, ctx.memory.frag, rand) : g.why

  const recommendation = toScore(entry.raw)
  const inBudget = g.priceLow >= ctx.budgetLow && g.priceHigh <= ctx.budgetHigh
  const feasibility = clamp((g.leadDays <= ctx.days ? 52 : 25) + (inBudget ? 43 : 18), 0, 98)
  const distinctiveness = clamp(58 + Math.min(24, (g.tags || []).length * 4) + (g.kind === 'activity' ? 6 : 0), 0, 98)
  const fit = clamp(Math.round(recommendation * 0.96 + (ctx.memory.ids.has(g.id) ? 4 : 0)), 0, 98)

  return {
    id: g.id,
    catalogId: g.id,
    emoji: g.emoji,
    name: g.name,
    why,
    price: `¥${g.priceLow}–${g.priceHigh}`,
    category: g.category,
    tags: (g.tags || []).slice(0, 3),
    matchScore: recommendation,
    dimensionScores: {
      recommendation,
      fit,
      distinctiveness,
      feasibility,
    },
    awards: [],
    tip: g.tip,
    leadTime: leadTimeText(g, ctx.days),
    // 推荐结果保留目录元数据，后续接真实报价 / 图片 / 变体时无需改方案协议。
    kind: g.kind,
    format: g.format,
    pricing: g.pricing,
    acquisition: g.acquisition,
    planning: g.planning,
    constraints: g.constraints,
    evidence: g.evidence,
    dataStatus: g.dataStatus,
  }
}

/* ══════════════════════════════════════════════════════════════
 *  4. 对外：pickGifts
 * ══════════════════════════════════════════════════════════════ */

export function pickGifts(answers, { exclude = [] } = {}) {
  const ctx = buildContext(answers)
  const excluded = list(exclude)
  const seed = seedOf(answers, excluded.length ? `x:${excluded.join(',')}` : '')

  const scored = scoreAll(ctx, seed)
  const toScore = makeScorer(scored)
  const chosen = selectGifts(scored, ctx, excluded)
  const rand = seededRandom(`${seed}|why`)

  const gifts = chosen.map((entry, i) => decorateGift(entry, ctx, i, toScore, rand))
  const awardSpecs = [
    ['recommendation', '最推荐'],
    ['fit', '最合适'],
    ['distinctiveness', '最特别'],
    ['feasibility', '最省心'],
  ]
  if (gifts.length === 2) {
    awardSpecs.forEach(([key, label]) => {
      const winner = gifts.reduce((best, gift) =>
        gift.dimensionScores[key] > best.dimensionScores[key] ? gift : best,
      )
      winner.awards.push(label)
    })
  }
  return gifts
}

const RANKING_GROUP_SPECS = [
  ['recommendation', '最推荐', '综合考虑适配、特别程度和落地难度，优先看整体最稳的三个方案。'],
  ['fit', '最合适', '更贴合送礼对象、场合、期待感受和你提供的具体故事。'],
  ['distinctiveness', '最特别', '更少见、更有记忆点，也更不容易变成一份普通礼物。'],
  ['feasibility', '最省心', '预算、准备时间与获得方式更稳妥，执行时更不容易出岔子。'],
]

export function pickGiftGroups(answers, { exclude = [] } = {}) {
  const ctx = buildContext(answers)
  const excluded = list(exclude)
  const seed = seedOf(answers, excluded.length ? `groups:${excluded.join(',')}` : 'groups')
  const scored = scoreAll(ctx, seed)
  const toScore = makeScorer(scored)
  const banned = new Set(excluded)
  let pool = scored.filter((entry) => !banned.has(entry.gift.id))
  if (pool.length < 3) pool = scored
  const rand = seededRandom(`${seed}|why`)
  const decorated = pool
    .sort((a, b) => b.raw - a.raw)
    .map((entry, index) => decorateGift(entry, ctx, index, toScore, rand))

  return RANKING_GROUP_SPECS.map(([key, title, description]) => ({
    key,
    title,
    description,
    candidates: [...decorated]
      .sort((a, b) => (
        b.dimensionScores[key] - a.dimensionScores[key]
        || b.dimensionScores.recommendation - a.dimensionScores.recommendation
        || a.id.localeCompare(b.id)
      ))
      .slice(0, 3)
      .map((gift, index) => ({
        ...gift,
        awards: [title],
        rankingDimension: key,
        rankingLabel: title,
        rankingRank: index + 1,
        rankingScore: gift.dimensionScores[key],
      })),
  }))
}

/* ══════════════════════════════════════════════════════════════
 *  5. 对外：generateLetter
 * ══════════════════════════════════════════════════════════════ */

function fill(text, ctx) {
  const map = {
    recipient: ctx.you,
    occasion: ctx.occasionPhrase,
    trait: ctx.traitPhrase,
    memory: ctx.memory.frag,
    third: ctx.third,
  }
  return String(text || '')
    .replace(/\{(\w+)\}/g, (_, k) => (map[k] ? map[k] : ''))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** 补句取词器：轮转发放，避免相邻段落反复用同一句 */
function makeFillerFeed(fillers, rand) {
  const shuffled = pickN(fillers || [], (fillers || []).length, rand)
  let i = 0
  return () => (shuffled.length ? shuffled[i++ % shuffled.length] : '')
}

/** 把段落收进 [min, max]，短了补句，长了砍掉最后一句 */
function fitParagraph(text, nextFiller, min = 40, max = 80) {
  let s = String(text || '').trim()

  for (let n = 0; n < 3 && s.length < min; n++) {
    const f = nextFiller()
    if (!f) break
    if (s.length + f.length > max) continue
    s += f
  }

  if (s.length > max) {
    const sentences = splitSentences(s)
    let kept = ''
    for (const one of sentences) {
      if (kept.length + one.length > max) break
      kept += one
    }
    if (kept.length >= min) s = kept
    else s = `${s.slice(0, max - 1).replace(/[，、；：]$/, '')}。`
  }

  return s
}

function resolveTone(tone, group) {
  const t = str(tone)
  if (!t) {
    const modern = TONE_OVERLAYS.find((o) => o.key === 'modern_poetic')
    return { label: modern?.label || '现代诗意', overlay: modern || null }
  }
  const hit = TONE_OVERLAYS.find((o) => o.key === t || o.label === t || o.keys.some((k) => t.includes(k)))
  return hit ? { label: hit.label, overlay: hit } : { label: group.tone, overlay: null }
}

export function generateLetter(answers, tone) {
  const ctx = buildContext(answers)
  const seed = seedOf(answers, `letter:${str(tone)}`)
  const rand = seededRandom(seed)

  const group = LETTER_TEMPLATES[ctx.feelingKey] || LETTER_TEMPLATES[FEELINGS.UNDERSTOOD]
  const { label, overlay } = resolveTone(tone, group)
  const nextFiller = makeFillerFeed(group.fillers, rand)

  // 性格 → 可以写进句子的短语
  if (ctx.personality.length) {
    const p = pick(ctx.personality, rand, ctx.personality[0])
    ctx.traitPhrase = INSIGHT_PHRASES.traitInsight[p]?.phrase || ''
  }

  const paragraphs = []

  // 第一段：开场
  paragraphs.push(fitParagraph(fill(pick(group.openings, rand), ctx), nextFiller))

  // 中段一：有故事就讲故事，没有就讲一句实在话
  if (ctx.memory.has && ctx.memory.frag) {
    paragraphs.push(fitParagraph(fill(pick(group.memoryMiddles, rand), ctx), nextFiller))
  } else {
    paragraphs.push(fitParagraph(fill(pick(group.plainMiddles, rand), ctx), nextFiller))
  }

  // 中段二：性格 / 关系状态
  const traitLine = ctx.traitPhrase
    ? fill(pick(group.traitMiddles, rand), ctx)
    : fill(pick(group.plainMiddles, rand), ctx)
  const relLines = RELATIONSHIP_LINES[ctx.relationshipNote]
  const secondMiddle = relLines ? `${pick(relLines, rand)}${traitLine}` : traitLine
  const secondText = fitParagraph(secondMiddle, nextFiller)
  if (secondText && secondText !== paragraphs[1]) paragraphs.push(secondText)

  // 语气覆盖：让不同 tone 真的读起来不一样
  if (overlay) {
    const extra = pick(overlay.extra, rand)
    const last = paragraphs.length - 1
    if (extra && paragraphs[last] && paragraphs[last].length + extra.length <= 80) {
      paragraphs[last] += extra
    }
  }

  // 结尾
  paragraphs.push(fitParagraph(fill(pick(group.closings, rand), ctx), nextFiller))

  return {
    salutation: `${pick(ctx.profile.salutations, rand, '给你')}：`,
    paragraphs: paragraphs.filter(Boolean).slice(0, 4),
    signature: pick(ctx.profile.signatures, rand, '—— 我'),
    tone: label,
  }
}

/* ══════════════════════════════════════════════════════════════
 *  6. 洞察 / 仪式 / 标题 / 分享
 * ══════════════════════════════════════════════════════════════ */

function buildInsight(ctx, rand) {
  const P = INSIGHT_PHRASES
  const feel = P.feelingInsight[ctx.feelingKey] || P.feelingInsight.default
  const relation = P.relationLead[ctx.recipient] || P.relationLead.default
  const angle = P.occasionAngle[ctx.occasion] || P.occasionAngle.default

  let traitSentence = ''
  if (ctx.personality.length) {
    const p = ctx.personality[0]
    const info = P.traitInsight[p]
    if (info) traitSentence = `${ctx.you}${info.phrase}，${info.clause}。`
  }

  const budgetKey = ctx.budgetHigh <= 300 ? 'low' : ctx.budgetLow >= 600 ? 'high' : 'mid'

  const parts = [
    pick(relation, rand),
    ctx.memory.has ? fill(pick(P.memoryLead, rand), ctx) : pick(angle, rand),
    traitSentence,
    `${feel.clause}。`,
    ctx.memory.has ? pick(angle, rand) : '',
    ctx.budget ? P.budgetNote[budgetKey] : '',
    ctx.timing ? P.timingNote[ctx.timing] || P.timingNote.default : '',
  ]

  const summary = composeText(parts, 60, 90, P.closers)

  // 关键词：性格 → 期望感受 → 关系
  const traits = []
  ctx.personality.slice(0, 3).forEach((p) => {
    const w = P.traitInsight[p]?.word
    if (w && !traits.includes(w)) traits.push(w)
  })
  if (feel.word && !traits.includes(feel.word)) traits.push(feel.word)
  const relWord = ctx.profile.insightWord
  if (relWord && !traits.includes(relWord)) traits.push(relWord)
  for (const w of P.fallbackTraits) {
    if (traits.length >= 3) break
    if (!traits.includes(w)) traits.push(w)
  }

  return {
    summary,
    traits: traits.slice(0, 5),
    keyPoint: pick(feel.keyPoints, rand, P.feelingInsight.default.keyPoints[0]),
  }
}

/** 从对应 timing 的素材里挑 4 步，保留时间顺序，首尾必取 */
function buildRitual(ctx, rand) {
  const steps = RITUAL_LIBRARY[ctx.timing] || RITUAL_LIBRARY[TIMINGS.WEEK]
  if (steps.length <= 4) return steps.map((s) => ({ ...s }))

  const middleIdx = steps.map((_, i) => i).slice(1, steps.length - 1)
  const picked = pickN(middleIdx, 2, rand)
  const idx = [0, ...picked, steps.length - 1].sort((a, b) => a - b)
  return idx.map((i) => ({ ...steps[i] }))
}

function buildTitle(ctx, rand) {
  const fromMemory = ctx.memory.title
  const bank = TITLE_LIBRARY[ctx.feelingKey] || TITLE_LIBRARY.default
  const title = fromMemory || pick(bank, rand, TITLE_LIBRARY.default[0])
  return title.length > 12 ? title.slice(0, 12) : title
}

function buildShare(ctx, rand) {
  const greetings = SHARE_GREETINGS[ctx.feelingKey] || SHARE_GREETINGS.default
  return {
    greeting: pick(greetings, rand, SHARE_GREETINGS.default[0]),
    coverEmoji: OCCASION_EMOJI[ctx.occasion] || SHARE_EMOJI[ctx.feelingKey] || SHARE_EMOJI.default,
    theme: SHARE_THEME[ctx.feelingKey] || SHARE_THEME.default,
  }
}

/* ══════════════════════════════════════════════════════════════
 *  7. 对外：generateMockPlan
 * ══════════════════════════════════════════════════════════════ */

export function generateMockPlan(answers) {
  const ctx = buildContext(answers)
  const seed = seedOf(answers)
  const rand = seededRandom(`${seed}|plan`)

  const gifts = pickGifts(answers)
  const recommendationGroups = pickGiftGroups(answers)
  const insight = buildInsight(ctx, rand)
  const ritual = buildRitual(ctx, rand)
  const share = buildShare(ctx, rand)
  const subtitle = fill(pick(INSIGHT_PHRASES.subtitles, rand, INSIGHT_PHRASES.subtitles[0]), ctx)

  return {
    title: buildTitle(ctx, rand),
    subtitle,
    insight,
    gifts,
    recommendationGroups,
    letter: generateLetter(answers),
    ritual,
    share,
  }
}

export default { generateMockPlan, pickGifts, pickGiftGroups, generateLetter }
