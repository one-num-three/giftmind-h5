export const SCORE_LABELS = {
  semantic: '语义理解',
  semanticScore: '语义理解',
  rag_retrieval: 'RAG检索命中',
  bm25: '关键词召回',
  lexical: '关键词召回',
  recipient: '对象匹配',
  relationship: '关系匹配',
  occasion: '场景匹配',
  personality: '性格偏好',
  interest: '兴趣匹配',
  interests: '兴趣匹配',
  feeling: '期待感受',
  style: '形式偏好',
  budget: '预算匹配',
  timing: '时间可行性',
  quality: '数据质量',
  data_quality: '数据完整度',
  completeness: '信息完整度',
  diversity: '方案差异度',
}

export const DIMENSION_LABELS = {
  recommendation: '综合推荐度',
  fit: '适配度',
  distinctiveness: '特别度',
  feasibility: '可执行度',
}

export const DIMENSION_ORDER = [
  'recommendation',
  'fit',
  'distinctiveness',
  'feasibility',
]

export function clampIndex(index, length) {
  if (!length) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

export function dragDirection(deltaX, threshold = 56) {
  if (Math.abs(deltaX) < threshold) return 0
  return deltaX < 0 ? 1 : -1
}

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `lab-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function numericScore(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
}

export function scoreEntries(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return []
  return Object.entries(breakdown)
    .map(([key, raw]) => {
      const value = typeof raw === 'object' && raw !== null ? raw.score : raw
      return {
        key,
        label: SCORE_LABELS[key] || key,
        value: numericScore(value),
      }
    })
    .filter((item) => Number.isFinite(item.value) && item.value !== 0)
    .sort((a, b) => b.value - a.value)
}

export function dimensionEntries(candidate) {
  const dimensions = candidate?.dimensionScores
  if (!dimensions || typeof dimensions !== 'object') return []
  return DIMENSION_ORDER
    .filter((key) => Number.isFinite(Number(dimensions[key])))
    .map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      value: Math.round(numericScore(dimensions[key]) * 10) / 10,
    }))
}

export function topScoreSources(breakdown, limit = 3) {
  return scoreEntries(breakdown)
    .filter((item) => item.value > 0)
    .slice(0, limit)
}

export function evidenceList(candidate) {
  const source = candidate?.matchedEvidence ?? candidate?.matched
  if (Array.isArray(source)) return source.flatMap(formatEvidenceItem).filter(Boolean)
  if (source && typeof source === 'object') {
    return Object.entries(source)
      .filter(([, value]) => Boolean(value))
      .flatMap(([key, value]) => formatEvidenceItem(value, SCORE_LABELS[key] || key))
  }
  if (typeof source === 'string' && source.trim()) return [source.trim()]
  return []
}

export function humanExplanation(candidate = {}) {
  const facts = uniqueStrings(candidate.matchedUserFacts || candidate.matchedDetails)
  const caveats = uniqueStrings(candidate.caveats)
  if (!caveats.length) {
    caveats.push(
      candidate.kind === 'activity'
        ? '预订前确认门店、档期、适用人数和退款规则。'
        : '下单前确认颜色、规格、库存和退换规则。',
    )
  }
  const directReason = firstText(
      candidate.whyForRecipient,
      candidate.storyConnection,
      candidate.whyTemplate,
    )
  const description = firstText(candidate.description)
  const conciseDescription = description.slice(0, 72).replace(/[。！？!?]+$/, '')
  const fitReason = directReason.length >= 12
    ? directReason
    : facts.length && description
      ? `${facts[0].replace(/[。！？!?]+$/, '')}。${conciseDescription}，能把这条线索落成一份具体的心意。`
      : description || directReason || '这件候选满足当前核心条件，值得进入最终比较。'
  return {
    fitReason,
    matchedDetails: facts.slice(0, 4),
    caveats: caveats.slice(0, 3),
    price: firstText(candidate.priceText, candidate.price, '价格需确认'),
    leadTime: firstText(candidate.leadTime, '准备时间需确认'),
  }
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || ''
}

function uniqueStrings(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values.map((item) => firstText(item)).filter(Boolean))]
}

function formatEvidenceItem(item, fallbackLabel = '') {
  if (item === null || item === undefined || item === false) return []
  if (Array.isArray(item)) return item.flatMap((nested) => formatEvidenceItem(nested, fallbackLabel))
  if (typeof item === 'string' || typeof item === 'number') {
    const text = String(item).trim()
    if (!text) return []
    return [fallbackLabel ? `${fallbackLabel}：${text}` : text]
  }
  if (item === true) return fallbackLabel ? [fallbackLabel] : []
  if (typeof item !== 'object') return []

  const rawKey = item.key || item.field || item.type || item.dimension || ''
  const label = item.label || item.name || SCORE_LABELS[rawKey] || fallbackLabel || rawKey
  const value = item.value ?? item.evidence ?? item.reason ?? item.matched ?? item.text ?? item.detail

  if (value !== undefined && value !== null && value !== '') {
    const rendered = Array.isArray(value) ? value.filter(Boolean).join('、') : String(value).trim()
    return rendered ? [label ? `${label}：${rendered}` : rendered] : []
  }

  return Object.entries(item)
    .filter(([key, valueItem]) => !['key', 'field', 'type', 'dimension', 'label', 'name'].includes(key) && Boolean(valueItem))
    .flatMap(([key, valueItem]) => formatEvidenceItem(valueItem, SCORE_LABELS[key] || key))
}
