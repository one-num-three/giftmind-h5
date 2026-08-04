import storage from '@/utils/storage'

const SHARES_KEY = 'gm_shares'
const REPLIES_KEY = 'gm_share_replies'
const PLANS_KEY = 'gm_plans'

function clone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Vue reactive proxy 不能直接 structuredClone，退回 JSON 快照。
    }
  }
  return JSON.parse(JSON.stringify(value))
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function readMap(key) {
  const value = storage.getJSON(key, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function resolvePlan(planOrId) {
  if (planOrId && typeof planOrId === 'object') return planOrId
  const id = text(planOrId)
  const plans = storage.getJSON(PLANS_KEY, [])
  return Array.isArray(plans) ? plans.find((plan) => plan?.id === id) || null : null
}

function makeShareId() {
  if (globalThis.crypto?.randomUUID) return `s_${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function createLocalShare(planOrId, config = {}) {
  const plan = resolvePlan(planOrId)
  if (!plan) throw new Error('对应的方案不存在，无法生成分享')

  const shareId = makeShareId()
  const record = {
    shareId,
    planId: text(plan.id),
    snapshotVersion: 1,
    plan: clone(plan),
    config: clone(config && typeof config === 'object' ? config : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const shares = readMap(SHARES_KEY)
  shares[shareId] = record
  storage.setJSON(SHARES_KEY, shares)
  return clone(record)
}

export function updateLocalShare(shareId, planOrId, config = {}) {
  const id = text(shareId)
  const shares = readMap(SHARES_KEY)
  if (!shares[id]) throw new Error('要更新的分享不存在')
  const plan = resolvePlan(planOrId)
  if (!plan) throw new Error('对应的方案不存在，无法更新分享')

  shares[id] = {
    ...shares[id],
    planId: text(plan.id),
    plan: clone(plan),
    config: clone(config && typeof config === 'object' ? config : {}),
    updatedAt: Date.now(),
  }
  storage.setJSON(SHARES_KEY, shares)
  return clone(shares[id])
}

export function fetchLocalShare(shareId) {
  const record = readMap(SHARES_KEY)[text(shareId)]
  if (!record?.plan) throw new Error('分享内容不存在或已过期')
  return clone(record)
}

export function saveLocalReply(shareId, content) {
  const id = text(shareId)
  fetchLocalShare(id)
  const message = text(content).slice(0, 300)
  if (!message) throw new Error('请先写一句话')

  const all = readMap(REPLIES_KEY)
  const reply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    shareId: id,
    content: message,
    createdAt: Date.now(),
  }
  const list = Array.isArray(all[id]) ? all[id] : []
  all[id] = [...list, reply]
  storage.setJSON(REPLIES_KEY, all)
  return clone(reply)
}

export function listLocalReplies({ shareId, planId } = {}) {
  const all = readMap(REPLIES_KEY)
  if (shareId) return clone(Array.isArray(all[text(shareId)]) ? all[text(shareId)] : [])
  if (!planId) return []

  const wanted = text(planId)
  const shares = readMap(SHARES_KEY)
  return Object.values(shares)
    .filter((share) => share?.planId === wanted)
    .flatMap((share) => (Array.isArray(all[share.shareId]) ? all[share.shareId] : []))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(clone)
}
