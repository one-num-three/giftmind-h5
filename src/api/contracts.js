/** GiftMind H5 本地策划 API 的唯一前端契约。 */
export const H5_ENDPOINTS = Object.freeze({
  status: '/status',
  summaryPlan: '/plans/summary',
  generatePlan: '/plans/generate',
  replaceGift: '/plans/gifts/replace',
  rewriteLetter: '/plans/letter/rewrite',
  rewriteRitual: '/plans/ritual/rewrite',
  chat: '/chat',
  createShare: '/shares',
  updateShare: '/shares/',
  fetchShare: '/shares/',
  sendShareReply: '/shares/',
  fetchShareReplies: '/shares/',
  voiceTranscribe: '/voice/transcribe',
})

export const GENERATION_STAGES = Object.freeze([
  { key: 'read', label: '正在读取你的回答', hint: '把关系、故事和期待整理成线索' },
  { key: 'catalog', label: '正在筛选礼物库', hint: '先排除预算、时间和禁忌不合适的选项' },
  { key: 'compare', label: '正在比较候选', hint: '只在真实目录候选里寻找更贴近 TA 的组合' },
  { key: 'reason', label: '正在写推荐理由', hint: '把礼物和你们的故事连接起来' },
  { key: 'compose', label: '正在整理信件与仪式', hint: '让心意最后落到可以执行的细节里' },
])

export const LETTER_TONES = Object.freeze({
  克制真诚: 'restrained',
  温暖: 'warm',
  俏皮: 'playful',
  郑重: 'solemn',
  简短: 'concise',
  热烈: 'warm',
})

export const REPLACE_REASONS = Object.freeze([
  { code: 'too_expensive', label: '价格不合适' },
  { code: 'too_common', label: '太常见了' },
  { code: 'not_for_them', label: '不太像 TA' },
  { code: 'already_gifted', label: '以前送过了' },
  { code: 'not_enough_time', label: '来不及准备' },
  { code: 'wrong_format', label: '想换一种形式' },
  { code: 'other', label: '其他原因' },
])

export const SERVICE_STATE = Object.freeze({
  connected: 'connected',
  ruleFallback: 'rule_fallback',
  emptyCatalog: 'empty_catalog',
  unavailable: 'unavailable',
})

export function newRequestId() {
  if (globalThis.crypto?.randomUUID) return `client-${globalThis.crypto.randomUUID()}`
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeServiceStatus(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const count = Math.max(0, Number(data.activeGiftCount) || 0)
  let state = SERVICE_STATE.connected
  if (!data.ok) state = SERVICE_STATE.unavailable
  else if (!count) state = SERVICE_STATE.emptyCatalog
  else if (!data.deepseekConfigured) state = SERVICE_STATE.ruleFallback

  return {
    ok: Boolean(data.ok),
    state,
    deepseekConfigured: Boolean(data.deepseekConfigured),
    voiceConfigured: Boolean(data.voiceConfigured),
    model: typeof data.model === 'string' ? data.model : '',
    activeGiftCount: count,
    promptVersions: data.promptVersions && typeof data.promptVersions === 'object' ? data.promptVersions : {},
  }
}

export function assertPlan(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('服务返回的方案为空')
  if (!Array.isArray(raw.gifts)) throw new Error('服务返回的礼物列表格式不正确')
  if (!raw.letter || typeof raw.letter !== 'object') throw new Error('服务返回的信件格式不正确')
  if (!Array.isArray(raw.ritual)) throw new Error('服务返回的仪式流程格式不正确')
  return raw
}
