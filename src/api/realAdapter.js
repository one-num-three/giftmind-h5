/** 真实 FastAPI 适配器。Prompt 与 DeepSeek Key 均只存在服务端。 */
import { http } from './request'
import {
  GENERATION_STAGES,
  H5_ENDPOINTS,
  LETTER_TONES,
  assertPlan,
  newRequestId,
  normalizeServiceStatus,
} from './contracts'
import {
  createLocalShare,
  fetchLocalShare,
  listLocalReplies,
  saveLocalReply,
  updateLocalShare,
} from './localShareStore'

// 完整方案生成比单字段建议更耗时；前端窗口要覆盖后端 120 秒的
// 单次耐心请求，否则后端仍在生成时浏览器会先报超时。
const PLAN_GENERATION_TIMEOUT = 180000

function startProgress(onProgress) {
  if (typeof onProgress !== 'function') return () => {}
  let index = 0
  onProgress(GENERATION_STAGES[index])
  const timer = setInterval(() => {
    index = Math.min(index + 1, GENERATION_STAGES.length - 1)
    onProgress(GENERATION_STAGES[index])
    if (index === GENERATION_STAGES.length - 1) clearInterval(timer)
  }, 1300)
  return () => clearInterval(timer)
}

function giftId(gift) {
  return gift?.catalogId || gift?.id || ''
}

function listAnswer(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  const text = String(value || '').trim()
  return text ? [text] : []
}

/**
 * 兼容 Mock 时代留下的草稿：多选字段曾可能被保存为空字符串。
 * 所有真实 API 请求都从这里统一成后端 PlanningAnswers 契约。
 */
export function normalizePlanningAnswers(answers) {
  const source = answers && typeof answers === 'object' ? answers : {}
  return {
    ...source,
    personality: listAnswer(source.personality),
    taboo: listAnswer(source.taboo),
    style: listAnswer(source.style),
  }
}

export async function getServiceStatus({ signal } = {}) {
  const raw = await http.get(H5_ENDPOINTS.status, { signal, timeout: 8000 })
  return normalizeServiceStatus(raw)
}

export async function generatePlan(answers, { onProgress, signal } = {}) {
  const stop = startProgress(onProgress)
  try {
    const result = await http.post(
      H5_ENDPOINTS.generatePlan,
      { requestId: newRequestId(), answers: normalizePlanningAnswers(answers) },
      { signal, timeout: PLAN_GENERATION_TIMEOUT },
    )
    return assertPlan(result)
  } finally {
    stop()
  }
}

export async function chatOnce({ messages, answers, plan }, { signal } = {}) {
  const result = await http.post(
    H5_ENDPOINTS.chat,
    {
      requestId: newRequestId(),
      messages: Array.isArray(messages) ? messages.slice(-8) : [],
      answers: normalizePlanningAnswers(answers),
      plan: plan || null,
    },
    { signal, timeout: 60000 },
  )
  return result?.reply || ''
}

export async function replaceGift(plan, { targetId, reason, reasonNote = '', lockedIds = [] } = {}) {
  const gifts = Array.isArray(plan?.gifts) ? plan.gifts : []
  return http.post(
    H5_ENDPOINTS.replaceGift,
    {
      requestId: newRequestId(),
      answers: normalizePlanningAnswers(plan?.answers),
      currentCatalogIds: gifts.map(giftId).filter(Boolean),
      replaceCatalogId: targetId,
      reason: reason || 'other',
      reasonNote,
      lockedCatalogIds: lockedIds,
      currentPlan: plan || null,
    },
    { timeout: 60000 },
  )
}

export async function regenerateLetter(plan, { tone, instruction = '' } = {}) {
  return http.post(
    H5_ENDPOINTS.rewriteLetter,
    {
      requestId: newRequestId(),
      answers: normalizePlanningAnswers(plan?.answers),
      gifts: Array.isArray(plan?.gifts) ? plan.gifts : [],
      currentLetter: plan?.letter || null,
      tone: LETTER_TONES[tone] || tone || 'warm',
      instruction,
    },
    { timeout: 60000 },
  )
}

export async function rewriteRitual(plan, { instruction = '' } = {}) {
  return http.post(
    H5_ENDPOINTS.rewriteRitual,
    {
      requestId: newRequestId(),
      answers: normalizePlanningAnswers(plan?.answers),
      gifts: Array.isArray(plan?.gifts) ? plan.gifts : [],
      currentRitual: Array.isArray(plan?.ritual) ? plan.ritual : [],
      instruction,
    },
    { timeout: 60000 },
  )
}

export async function shuffleGifts() {
  throw new Error('真实模式请逐件替换礼物，这样已确认的选择不会被覆盖')
}

export async function createShare(plan, config = {}) {
  const record = createLocalShare(plan, config)
  return { ...record, url: `${location.origin}${location.pathname}#/s/${record.shareId}` }
}

export async function updateShare(shareId, plan, config = {}) {
  const record = updateLocalShare(shareId, plan, config)
  return { ...record, url: `${location.origin}${location.pathname}#/s/${record.shareId}` }
}

export async function fetchShare(shareId) {
  return fetchLocalShare(shareId)
}

export async function sendShareReply(shareId, content) {
  return saveLocalReply(shareId, content)
}

export async function fetchShareReplies(query) {
  return listLocalReplies(query)
}
