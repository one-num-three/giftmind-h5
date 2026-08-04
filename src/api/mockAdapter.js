/**
 * Mock 适配器 —— 纯前端跑通全流程，方便设计走查与投资人演示。
 * 生成逻辑在 /mock/planGenerator.js，数据在 /mock/giftLibrary.js。
 */
import { generateMockPlan, generateLetter, pickGifts } from '../../mock/planGenerator'
import { GENERATING_STEPS } from '../../mock/generatingSteps'
import {
  createLocalShare,
  fetchLocalShare,
  listLocalReplies,
  saveLocalReply,
  updateLocalShare,
} from './localShareStore'

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
  return generateMockPlan(answers)
}

export async function getServiceStatus() {
  return {
    ok: true,
    state: 'rule_fallback',
    deepseekConfigured: false,
    model: 'Mock 规则引擎',
    activeGiftCount: 101,
    promptVersions: {},
  }
}

export async function chatOnce({ messages }) {
  await delay(700)
  const last = messages?.[messages.length - 1]?.content || ''
  return `我记下了：「${last.slice(0, 30)}${last.length > 30 ? '…' : ''}」，这会体现在方案里。`
}

export async function regenerateLetter(plan, { tone, answers } = {}) {
  await delay(900)
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

export async function shuffleGifts(planId, { exclude = [], answers } = {}) {
  await delay(800)
  return pickGifts(answers || {}, { exclude })
}

export async function createShare(planId, config = {}) {
  await delay(600)
  const record = createLocalShare(planId, config)
  return { ...record, url: `${location.origin}${location.pathname}#/s/${record.shareId}` }
}

export async function updateShare(shareId, plan, config = {}) {
  await delay(400)
  const record = updateLocalShare(shareId, plan, config)
  return { ...record, url: `${location.origin}${location.pathname}#/s/${record.shareId}` }
}

export async function fetchShare(shareId) {
  await delay(400)
  return fetchLocalShare(shareId)
}

export async function sendShareReply(shareId, content) {
  await delay(250)
  return saveLocalReply(shareId, content)
}

export async function fetchShareReplies(query) {
  return listLocalReplies(query)
}
