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

/** 跨设备/跨浏览器免后端自包含 URL 编码 */
export function encodeSharePayload(record) {
  try {
    const plan = record.plan || {}
    const config = record.config || {}
    const mini = {
      p: {
        t: plan.title || '',
        st: plan.subtitle || '',
        r: plan.recipient || '',
        g: (plan.gifts || []).slice(0, 4).map((g) => ({
          n: g.name || '',
          e: g.emoji || '🎁',
          w: g.why || '',
          k: g.kind || 'physical',
        })),
        l: plan.letter || null,
        rt: plan.ritual || [],
        a: plan.answers || {},
      },
      c: config,
    }
    const jsonStr = JSON.stringify(mini)
    return encodeURIComponent(btoa(encodeURIComponent(jsonStr)))
  } catch (e) {
    return ''
  }
}

/** 跨设备/跨浏览器免后端自包含 URL 解码 */
export function decodeSharePayload(d) {
  if (!d) return null
  try {
    const jsonStr = decodeURIComponent(atob(decodeURIComponent(d)))
    const mini = JSON.parse(jsonStr)
    if (!mini?.p) return null
    return {
      shareId: 'shared',
      plan: {
        title: mini.p.t || '给你的专属心意方案',
        subtitle: mini.p.st || '',
        recipient: mini.p.r || '你',
        gifts: (mini.p.g || []).map((g) => ({
          name: g.n,
          emoji: g.e,
          why: g.w,
          kind: g.k,
        })),
        letter: mini.p.l || { salutation: '见信好：', paragraphs: ['为你准备了一份心意。'], signature: '—— 我' },
        ritual: mini.p.rt || [],
        answers: mini.p.a || {},
      },
      config: mini.c || { theme: 'dawn', recipient: '你', greeting: '生活需要一点未知的小确幸，拆开看看吧。' },
      createdAt: Date.now(),
    }
  } catch (e) {
    return null
  }
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

  const payload = encodeSharePayload(record)
  const url = `${location.origin}${location.pathname}#/s/${record.shareId}${payload ? `?d=${payload}` : ''}`
  return { ...clone(record), url }
}

export function updateLocalShare(shareId, planOrId, config = {}) {
  const id = text(shareId)
  const shares = readMap(SHARES_KEY)
  const plan = resolvePlan(planOrId) || shares[id]?.plan
  if (!plan) throw new Error('对应的方案不存在，无法更新分享')

  const record = {
    ...(shares[id] || {}),
    shareId: id,
    planId: text(plan.id),
    plan: clone(plan),
    config: clone(config && typeof config === 'object' ? config : {}),
    updatedAt: Date.now(),
  }
  shares[id] = record
  storage.setJSON(SHARES_KEY, shares)

  const payload = encodeSharePayload(record)
  const url = `${location.origin}${location.pathname}#/s/${record.shareId}${payload ? `?d=${payload}` : ''}`
  return { ...clone(record), url }
}

export function fetchLocalShare(shareId, queryParamD = '') {
  const id = text(shareId)
  const record = readMap(SHARES_KEY)[id]
  if (record?.plan) return clone(record)

  // 跨设备/其他浏览器自包含恢复
  if (queryParamD) {
    const decoded = decodeSharePayload(queryParamD)
    if (decoded?.plan) {
      decoded.shareId = id || decoded.shareId
      const shares = readMap(SHARES_KEY)
      shares[id] = decoded
      storage.setJSON(SHARES_KEY, shares)
      return clone(decoded)
    }
  }

  // 尝试全局 plans 兜底
  const plans = storage.getJSON(PLANS_KEY, [])
  if (Array.isArray(plans) && plans.length > 0) {
    const latestPlan = plans[plans.length - 1]
    return {
      shareId: id,
      plan: clone(latestPlan),
      config: { theme: 'dawn', recipient: '亲爱的', greeting: '生活需要一点未知的小确幸，拆开看看吧。' },
      createdAt: Date.now(),
    }
  }

  throw new Error('分享内容不存在或已过期')
}

export function saveLocalReply(shareId, content) {
  const id = text(shareId)
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
