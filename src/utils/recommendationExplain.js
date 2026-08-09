const SCORE_LABELS = {
  recommendation: '综合推荐度',
  fit: '适配度',
  distinctiveness: '特别度',
  feasibility: '可执行度',
  rag_retrieval: '语义检索',
  memory_semantic: '回忆关联',
  recipient: '对象匹配',
  relationship: '关系匹配',
  occasion: '场合匹配',
  traits: '性格匹配',
  interests: '兴趣匹配',
  feeling: '期待感受',
  budget: '预算匹配',
  timing: '时间匹配',
  data_quality: '数据完整度',
  city_tier: '城市供给参考',
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function list(value) {
  if (!Array.isArray(value)) return text(value) ? [text(value)] : []
  return value.map(text).filter(Boolean)
}

function unique(values, limit = 4) {
  return [...new Set(values.map(text).filter(Boolean))].slice(0, limit)
}

export function recommendationExplanation(gift = {}) {
  const directReason = text(gift.whyForRecipient)
    || text(gift.storyConnection)
    || text(gift.why)
    || text(gift.whyTemplate)
  const matchedDetails = unique(
    list(gift.matchedUserFacts).length
      ? list(gift.matchedUserFacts)
      : list(gift.matchedDetails),
  )
  const description = text(gift.description)
  const fitReason = directReason.length >= 12
    ? directReason
    : groundedReason(directReason, description, matchedDetails)

  const caveats = unique(list(gift.caveats), 3)
  if (!caveats.length) {
    caveats.push(
      gift.kind === 'activity'
        ? '预订前确认门店、档期、适用人数和退款规则。'
        : '下单前确认颜色、规格、库存和退换规则。',
    )
  }

  return {
    fitReason,
    matchedDetails,
    caveats,
    price: text(gift.price) || text(gift.priceText) || '价格需确认',
    leadTime: text(gift.leadTime) || '准备时间需确认',
  }
}

function groundedReason(directReason, description, matchedDetails) {
  if (matchedDetails.length && description) {
    const concise = description.slice(0, 72).replace(/[。！？!?]+$/, '')
    const fact = matchedDetails[0].replace(/[。！？!?]+$/, '')
    return `${fact}。${concise}，能把这条线索落成一份具体的心意。`
  }
  return description
    || directReason
    || '这件候选满足了当前的核心条件，适合作为下一步重点比较的方案。'
}

export function rawScoreEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .map(([key, score]) => ({
      key,
      label: SCORE_LABELS[key] || key,
      value: Math.round((Number(score) || 0) * 10) / 10,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}

export function rawEvidenceEntries(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .map(([key, evidence]) => ({
      key,
      label: SCORE_LABELS[key] || key,
      values: unique(Array.isArray(evidence) ? evidence : [evidence], 5),
    }))
    .filter((entry) => entry.values.length)
}
