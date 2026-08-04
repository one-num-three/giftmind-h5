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

export async function getServiceStatus({ signal } = {}) {
  const raw = await http.get(H5_ENDPOINTS.status, { signal, timeout: 8000 })
  return normalizeServiceStatus(raw)
}

export async function generatePlan(answers, { onProgress, signal } = {}) {
  const stop = startProgress(onProgress)
  try {
    const result = await http.post(
      H5_ENDPOINTS.generatePlan,
      { requestId: newRequestId(), answers: answers || {} },
      { signal, timeout: 90000 },
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
      answers: answers || {},
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
      answers: plan?.answers || {},
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
      answers: plan?.answers || {},
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
      answers: plan?.answers || {},
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
