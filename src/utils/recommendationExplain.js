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

function recipientPronoun(recipient) {
  const value = text(recipient)
  if (/女朋友|妻子|妈妈|母亲|女儿|姐姐|妹妹|姐妹|闺蜜|女性|女生|女同事|女老师/.test(value)) {
    return '她'
  }
  if (/男朋友|丈夫|爸爸|父亲|儿子|哥哥|弟弟|兄弟|男性|男生|男同事|男老师/.test(value)) {
    return '他'
  }
  return 'TA'
}

/**
 * 目录文案经常自带“他/她”，但推荐对象可能不同。
 * 这里只改礼物目录里的第三人称，不碰用户自己填写的回忆与原话。
 */
export function recipientAwareCopy(value, recipient = '') {
  const source = text(value)
  if (!source) return ''
  const pronoun = recipientPronoun(recipient)

  return source.replace(/[他她]/g, (matched, index, whole) => {
    const before = whole[index - 1] || ''
    const after = whole[index + 1] || ''
    // “其他 / 吉他 / 他人”不是人物代词，必须原样保留。
    if (matched === '他' && (before === '其' || before === '吉' || after === '人')) return matched
    return pronoun
  })
}

function list(value) {
  if (!Array.isArray(value)) return text(value) ? [text(value)] : []
  return value.map(text).filter(Boolean)
}

function unique(values, limit = 4) {
  return [...new Set(values.map(text).filter(Boolean))].slice(0, limit)
}

export function recommendationKindLabel(gift = {}) {
  const kind = text(gift.kind || gift.giftTypeCode || gift.entityType).toLowerCase()
  if (['activity', 'experience'].includes(kind)) return '体验'
  if (['product', 'goods', 'gift', 'gift_idea'].includes(kind)) return '礼物'
  const category = text(gift.category)
  if (/活动|体验/.test(category)) return '体验'
  if (/实物|商品|礼物|数字|定制/.test(category)) return '礼物'
  return category
}

export function recommendationExplanation(gift = {}, options = {}) {
  const recipient = text(options.recipient)
  const directReason = recipientAwareCopy(
    text(gift.whyForRecipient)
      || text(gift.storyConnection)
      || text(gift.why)
      || text(gift.whyTemplate),
    recipient,
  )
  const matchedDetails = unique(
    list(gift.matchedUserFacts).length
      ? list(gift.matchedUserFacts)
      : list(gift.matchedDetails),
  )
  const description = recipientAwareCopy(gift.description, recipient)
  const fitReason = directReason.length >= 12
    ? directReason
    : groundedReason(directReason, description, matchedDetails)

  const caveats = unique(list(gift.caveats).map((item) => recipientAwareCopy(item, recipient)), 3)
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
