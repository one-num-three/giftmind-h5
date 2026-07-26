/**
 * Mock 适配器 —— 纯前端跑通全流程，方便设计走查与投资人演示。
 * 生成逻辑在 /mock/planGenerator.js，数据在 /mock/giftLibrary.js。
 */
import { generateMockPlan, generateLetter, pickGifts } from '../../mock/planGenerator'
import { GENERATING_STEPS } from '../../mock/generatingSteps'
import storage from '@/utils/storage'

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

export async function chatOnce({ messages }) {
  await delay(700)
  const last = messages?.[messages.length - 1]?.content || ''
  return `我记下了：「${last.slice(0, 30)}${last.length > 30 ? '…' : ''}」，这会体现在方案里。`
}

export async function regenerateLetter(planId, { tone, answers } = {}) {
  await delay(900)
  return generateLetter(answers || {}, tone)
}

export async function shuffleGifts(planId, { exclude = [], answers } = {}) {
  await delay(800)
  return pickGifts(answers || {}, { exclude })
}

export async function createShare(planId, config = {}) {
  await delay(600)
  const shareId = `s_${Math.random().toString(36).slice(2, 10)}`
  const store = storage.getJSON('gm_shares', {}) || {}
  store[shareId] = { planId, config, createdAt: Date.now() }
  storage.setJSON('gm_shares', store)
  return { shareId, url: `${location.origin}${location.pathname}#/s/${shareId}` }
}

export async function fetchShare(shareId) {
  await delay(400)
  const store = storage.getJSON('gm_shares', {}) || {}
  const rec = store[shareId]
  if (!rec) throw new Error('分享内容不存在或已过期')
  const plans = storage.getJSON('gm_plans', []) || []
  const plan = plans.find((p) => p.id === rec.planId)
  if (!plan) throw new Error('对应的方案已被删除')
  return { ...rec, plan }
}
