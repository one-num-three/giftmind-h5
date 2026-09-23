/** 真实 FastAPI 适配器。Prompt 与 DeepSeek Key 均只存在服务端。 */
import { http } from './request'
import {
  GENERATION_STAGES,
  H5_ENDPOINTS,
  LETTER_TONES,
  assertDeliveryComposition,
  assertPlan,
  newRequestId,
  normalizeServiceStatus,
} from './contracts'

// 联网生成与替换共用请求窗口，覆盖后端 170 秒的总时限。
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

function allPlanGifts(plan) {
  const direct = Array.isArray(plan?.gifts) ? plan.gifts : []
  const ranked = Array.isArray(plan?.recommendationGroups)
    ? plan.recommendationGroups.flatMap((group) => (
        Array.isArray(group?.candidates) ? group.candidates : []
      ))
    : []
  const seen = new Set()
  return [...direct, ...ranked].filter((gift) => {
    const id = giftId(gift)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
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
    allParticipantsAdults:
      source.allParticipantsAdults === true || source.allParticipantsAdults === 'true'
        ? true
        : source.allParticipantsAdults === false || source.allParticipantsAdults === 'false'
          ? false
          : null,
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

export async function generateSummary(answers, { signal } = {}) {
  return http.post(
    H5_ENDPOINTS.summaryPlan,
    { requestId: newRequestId(), answers: normalizePlanningAnswers(answers) },
    { signal, timeout: 30000 },
  )
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
  const gifts = allPlanGifts(plan)
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
    { timeout: PLAN_GENERATION_TIMEOUT },
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

export async function composeDelivery(plan, selectedGift, { signal } = {}) {
  const result = await http.post(
    H5_ENDPOINTS.composeDelivery,
    {
      requestId: newRequestId(),
      answers: normalizePlanningAnswers(plan?.answers),
      selectedGift: selectedGift || {},
      currentLetter: plan?.letter || null,
      currentRitual: Array.isArray(plan?.ritual) ? plan.ritual : [],
    },
    { signal, timeout: PLAN_GENERATION_TIMEOUT },
  )
  return assertDeliveryComposition(result)
}

export async function shuffleGifts() {
  throw new Error('真实模式请逐件替换礼物，这样已确认的选择不会被覆盖')
}

export async function createShare(plan, config = {}) {
  const record = await http.post(
    H5_ENDPOINTS.createShare,
    { plan: cloneSharePlan(plan), config },
    { timeout: 30000 },
  )
  if (record?.shareId && record?.manageToken && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`giftmind_share_token_${record.shareId}`, record.manageToken)
    } catch {}
  }
  return { ...record, url: shareUrl(record.shareId) }
}

export async function updateShare(shareId, plan, config = {}) {
  let manageToken = config.manageToken
  if (!manageToken && typeof localStorage !== 'undefined') {
    try {
      manageToken = localStorage.getItem(`giftmind_share_token_${shareId}`)
    } catch {}
  }
  const headers = manageToken ? { 'X-Share-Manage-Token': manageToken } : {}
  const record = await http.put(
    `${H5_ENDPOINTS.updateShare}${shareId}`,
    { plan: cloneSharePlan(plan), config, manageToken },
    { timeout: 30000, headers },
  )
  return { ...record, url: shareUrl(record.shareId) }
}

export async function fetchShare(shareId) {
  return http.get(`${H5_ENDPOINTS.fetchShare}${shareId}`, { timeout: 15000 })
}

export async function sendShareReply(shareId, content) {
  return http.post(
    `${H5_ENDPOINTS.sendShareReply}${shareId}/replies`,
    { content: String(content || '').slice(0, 300) },
    { timeout: 15000 },
  )
}

export async function fetchShareReplies(query) {
  const q = query && typeof query === 'object' ? query : {}
  if (q.shareId) return http.get(`${H5_ENDPOINTS.fetchShareReplies}${q.shareId}/replies`, { timeout: 15000 })
  if (q.planId) return http.get(`${H5_ENDPOINTS.fetchShareReplies}replies?planId=${encodeURIComponent(q.planId)}`, { timeout: 15000 })
  return []
}

export async function transcribeVoice(blob, format) {
  const form = new FormData()
  const safeFormat = ['webm', 'wav', 'mp3', 'm4a', 'ogg', 'opus'].includes(format) ? format : 'webm'
  form.append('audio', blob, `voice.${safeFormat}`)
  form.append('format', safeFormat)
  return http.post(H5_ENDPOINTS.voiceTranscribe, form, { timeout: 60000 })
}

function cloneSharePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('方案不存在，无法生成分享')
  const copy = JSON.parse(JSON.stringify(plan))
  delete copy.debug
  return copy
}

function shareUrl(shareId) {
  return `${location.origin}${location.pathname}#/s/${shareId}`
}
