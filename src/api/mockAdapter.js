/**
 * Mock 适配器 —— 纯前端跑通全流程，方便设计走查与投资人演示。
 * 生成逻辑在 /mock/planGenerator.js，数据在 /mock/giftLibrary.js。
 */
import { generateMockPlan, generateLetter, pickGiftGroups, pickGifts } from '../../mock/planGenerator'
import { GENERATING_STEPS } from '../../mock/generatingSteps'
import { composeSummaryBlocks } from '@/utils/summaryCompose'
import {
  createLocalShare,
  fetchLocalShare,
  listLocalReplies,
  saveLocalReply,
  updateLocalShare,
} from './localShareStore'

import { generateCustomStyleLetter, callMiMo, generateAiPlan } from './mimoService'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export async function generatePlan(answers, { onProgress, signal } = {}) {
  // 模拟"AI 正在思考"的阶段性回调
  if (onProgress) {
    for (const step of GENERATING_STEPS) {
      if (signal?.aborted) throw new Error('aborted')
      onProgress(step)
      await delay(step.duration)
    }
  } else {
    await delay(1200)
  }

  // 1. 优先调用真实的 AI 礼物策划大脑（精准解决“父母重复劳动”等真实痛点，绝不推错位品）
  try {
    const aiPlan = await generateAiPlan(answers)
    if (aiPlan && aiPlan.gifts?.length) {
      return aiPlan
    }
  } catch (err) {
    console.warn('[AI Plan Fallback to mock rule]:', err)
  }

  // 2. 离线/断网备用方案
  return generateMockPlan(answers)
}

export async function getServiceStatus() {
  return {
    ok: true,
    state: 'rule_fallback',
    deepseekConfigured: false,
    voiceConfigured: true,
    model: 'Mock 规则引擎',
    activeGiftCount: 101,
    promptVersions: {},
  }
}

export async function generateSummary(answers) {
  await delay(500)
  return {
    requestId: `mock-summary-${Date.now()}`,
    source: 'rule',
    summary: composeSummaryBlocks(answers),
  }
}

export async function chatOnce({ messages }) {
  const last = messages?.[messages.length - 1]?.content || ''
  try {
    const reply = await callMiMo([
      { role: 'system', content: '你是资深高情商礼物顾问 GiftMind。请亲切、懂行地回答用户的追问或建议（60字以内）。' },
      { role: 'user', content: last }
    ], { temperature: 0.7, timeout: 5000 })
    if (reply) return reply
  } catch (e) {
    console.warn('MiMo chatOnce fallback:', e)
  }
  return `我记下了：「${last.slice(0, 30)}${last.length > 30 ? '…' : ''}」，这会体现在方案里。`
}

export async function regenerateLetter(plan, { tone, answers } = {}) {
  try {
    const custom = await generateCustomStyleLetter(tone, plan)
    if (custom && custom.paragraphs?.length) {
      return { letter: custom }
    }
  } catch (e) {
    console.warn('MiMo regenerateLetter fallback:', e)
  }
  return generateLetter(plan?.answers || answers || {}, tone)
}

export async function replaceGift(plan, { targetId } = {}) {
  await delay(700)
  const current = Array.isArray(plan?.gifts) ? plan.gifts : []
  const exclude = current.map((gift) => gift?.catalogId || gift?.id).filter(Boolean)
  const [gift] = pickGifts(plan?.answers || {}, { exclude })
  if (!gift) throw new Error('暂时没有更多合适礼物')
  return { targetId, gift }
}

export async function rewriteRitual(plan, { instruction = '' } = {}) {
  await delay(700)
  const current = Array.isArray(plan?.ritual) ? plan.ritual : []
  if (!instruction.trim()) return current
  return current.map((step, index) =>
    index === 0 ? { ...step, desc: `${step.desc || ''}${step.desc ? ' ' : ''}${instruction.trim()}` } : { ...step },
  )
}

export async function composeDelivery(plan, selectedGift) {
  await delay(900)
  const answers = plan?.answers || {}
  const name = String(selectedGift?.name || '这份礼物').trim()
  const id = selectedGift?.catalogId || selectedGift?.id || ''
  const memory = String(answers.memory || '').trim()
    .replaceAll('TA', '你')
    .replace(/(^|[^其吉])[他她](?!们)/g, '$1你')
  const feeling = String(answers.feeling || '').trim()
    .replaceAll('TA', '你')
    .replace(/(^|[^其吉])[他她](?!们)/g, '$1你')
    .replace(/^(?:(?:我)?想让|希望)你(?:感到|觉得)?/, '')
    .replace(/[，。 ]+$/g, '')
  const occasion = String(answers.occasion || '').trim()
  const kind = String(selectedGift?.kind || selectedGift?.giftTypeCode || '').toLowerCase()
  const isActivity = kind === 'activity' || String(selectedGift?.category || '').includes('体验')
  const currentLetter = plan?.letter || {}
  const paragraphs = []
  if (memory) paragraphs.push(`你说起那件事的时候，我记住了：${/[。！？!?]$/.test(memory) ? memory : `${memory}。`}`)
  paragraphs.push(occasion ? `${occasion}快乐。想把「${name}」放到你手里。` : `想把「${name}」放到你手里。`)
  paragraphs.push(feeling ? `愿它替我陪你一会儿，也让你感到${feeling}。` : '愿它替我陪你一会儿。剩下的话，等见面再说。')

  return {
    source: 'rule_fallback',
    model: null,
    promptVersion: 'mock_delivery_compose_v1',
    selectedCatalogId: id,
    selectedGiftName: name,
    letter: {
      salutation: currentLetter.salutation || '给你：',
      paragraphs,
      signature: currentLetter.signature || '—— 我',
      tone: currentLetter.tone || '现代诗意',
    },
    ritual: isActivity
      ? [
          { time: answers.timing || '送出前', title: '先确认时间与预约', desc: '核对可预约日期、参与条件和取消规则，再发出邀请。' },
          { time: '发出邀请时', title: '把选择权留给 TA', desc: `告诉 TA 你想一起体验「${name}」，同时留出改期或婉拒的空间。` },
        ]
      : [
          { time: answers.timing || '送出前', title: '先确认商品细节', desc: '核对规格、库存、到货时间和退换规则，再决定包装方式。' },
          { time: '送出当天', title: '先让 TA 看你写的话', desc: `递出「${name}」时留一点安静，让对方按自己的节奏拆开和回应。` },
        ],
  }
}

export async function shuffleGifts(planId, { exclude = [], answers } = {}) {
  await delay(800)
  return {
    gifts: pickGifts(answers || {}, { exclude }),
    recommendationGroups: pickGiftGroups(answers || {}, { exclude }),
  }
}

export async function createShare(planId, config = {}) {
  await delay(400)
  const record = createLocalShare(planId, config)
  return record
}

export async function updateShare(shareId, plan, config = {}) {
  await delay(300)
  const record = updateLocalShare(shareId, plan, config)
  return record
}

export async function fetchShare(shareId, d = '') {
  await delay(200)
  return fetchLocalShare(shareId, d)
}

export async function sendShareReply(shareId, content) {
  await delay(250)
  return saveLocalReply(shareId, content)
}

export async function fetchShareReplies(query) {
  return listLocalReplies(query)
}

export async function transcribeVoice(blob, format) {
  await delay(900)
  return {
    transcript: '我们第一次一起看极光，还记得那天的风很大。',
    confidence: 0.95,
    segments: [{ start: 0, end: 2.4, text: '我们第一次一起看极光，还记得那天的风很大。' }],
    source: 'mock',
  }
}
