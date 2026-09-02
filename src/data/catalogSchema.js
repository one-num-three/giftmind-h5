/**
 * GiftMind 礼物目录的数据契约。
 *
 * 当前 H5 仍然使用静态素材，但从这里开始把「礼物想法」和未来要接入的
 * 真实商品 / 活动报价分开。这样后续接数据库时，不需要重写推荐器：
 * - gift idea：适合推荐的抽象礼物想法；
 * - offer：某个平台、商家或活动场次的真实报价；
 * - variant：同一商品的颜色、尺寸、套餐或规格。
 */

export const CATALOG_SCHEMA_VERSION = 'giftmind.catalog.v1'

export const GIFT_KINDS = Object.freeze({
  PRODUCT: 'product',
  ACTIVITY: 'activity',
})

export const DATA_STATUSES = Object.freeze({
  SEED: 'seed',
  DRAFT: 'draft',
  REVIEWED: 'reviewed',
  VERIFIED: 'verified',
  ARCHIVED: 'archived',
})

const CATEGORY_META = Object.freeze({
  实物: {
    kind: GIFT_KINDS.PRODUCT,
    format: 'physical_product',
    acquisitionMode: 'purchase',
    fulfillmentMode: 'shipping_or_pickup',
    priceBasis: 'per_item',
    prerequisites: ['确认尺寸、颜色或兼容性'],
  },
  定制: {
    kind: GIFT_KINDS.PRODUCT,
    format: 'custom_product',
    acquisitionMode: 'custom_order',
    fulfillmentMode: 'shipping_or_pickup',
    priceBasis: 'per_item',
    prerequisites: ['准备定制文字、照片或尺寸', '确认制作周期'],
  },
  数字: {
    kind: GIFT_KINDS.PRODUCT,
    format: 'digital_product',
    acquisitionMode: 'purchase',
    fulfillmentMode: 'digital_delivery',
    priceBasis: 'per_item_or_account',
    prerequisites: ['确认收礼人使用的平台或设备'],
  },
  组合: {
    kind: GIFT_KINDS.PRODUCT,
    format: 'bundle',
    acquisitionMode: 'curated_bundle',
    fulfillmentMode: 'mixed',
    priceBasis: 'per_bundle',
    prerequisites: ['确认组合内容与总预算'],
  },
  体验: {
    kind: GIFT_KINDS.ACTIVITY,
    format: 'activity',
    acquisitionMode: 'booking',
    fulfillmentMode: 'in_person_or_online',
    priceBasis: 'per_booking_or_person',
    prerequisites: ['确认可参与时间', '确认地点或线上形式'],
  },
})

const CATEGORY_LABELS = Object.freeze({
  physical_product: '商品 · 实物',
  custom_product: '商品 · 定制',
  digital_product: '商品 · 数字',
  bundle: '商品 · 组合',
  activity: '活动 · 体验',
})

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  return value == null || value === '' ? [] : [String(value)]
}

function nonNegativeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function derivePlanWindow(leadDays) {
  const days = nonNegativeNumber(leadDays)
  if (days === 0) return 'same_day'
  if (days <= 3) return 'a_few_days'
  if (days <= 7) return 'one_week'
  if (days <= 14) return 'two_weeks'
  return 'long_lead'
}

function buildSearchText(raw, meta) {
  return [
    raw.name,
    raw.category,
    meta.kind === GIFT_KINDS.ACTIVITY ? '活动 体验 预约' : '商品 礼物',
    ...list(raw.traits),
    ...list(raw.occasions),
    ...list(raw.recipients),
    ...list(raw.tags),
  ]
    .filter(Boolean)
    .join(' ')
}

function defaultEvidence() {
  return {
    sourceType: 'editorial_seed',
    sourceName: 'GiftMind 初始素材库',
    sourceUrl: null,
    collectedAt: null,
    verifiedAt: null,
    verified: false,
    note: '演示素材，价格、库存、商家和活动场次尚未核验。',
  }
}

/** 把旧版一条素材记录扩展为可接数据库的目录记录。 */
export function normalizeGiftRecord(raw, overrides = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const meta = CATEGORY_META[source.category] || CATEGORY_META.实物
  const kind = overrides.kind || source.kind || meta.kind
  const leadDays = nonNegativeNumber(source.leadDays)
  const priceLow = nonNegativeNumber(source.priceLow)
  const priceHigh = Math.max(priceLow, nonNegativeNumber(source.priceHigh, priceLow))
  const evidence = { ...defaultEvidence(), ...(source.evidence || {}), ...(overrides.evidence || {}) }

  return {
    ...source,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    entityType: 'gift_idea',
    kind,
    // category 保持旧版中文展示值；format 是后续 API 可稳定使用的机器值。
    format: overrides.format || source.format || meta.format,
    formatLabel: CATEGORY_LABELS[overrides.format || source.format || meta.format] || source.category,
    pricing: {
      currency: 'CNY',
      min: priceLow,
      max: priceHigh,
      basis: source.priceBasis || meta.priceBasis,
      status: 'estimated',
      display: `¥${priceLow}–${priceHigh}`,
    },
    planning: {
      recommendedLeadDays: leadDays,
      window: derivePlanWindow(leadDays),
      status: 'editorial_estimate',
    },
    acquisition: {
      mode: source.acquisitionMode || meta.acquisitionMode,
      fulfillment: source.fulfillmentMode || meta.fulfillmentMode,
      requiresBooking: kind === GIFT_KINDS.ACTIVITY,
      requiresCustomization: meta.format === 'custom_product',
      inventoryStatus: 'unknown',
      provider: null,
      url: null,
    },
    fit: {
      recipients: list(source.recipients),
      occasions: list(source.occasions),
      traits: list(source.traits),
      tags: list(source.tags),
    },
    constraints: {
      avoidWhen: list(source.avoid),
      prerequisites: list(source.prerequisites || meta.prerequisites),
      notes: list(source.constraintNotes),
    },
    media: {
      cover: { type: 'emoji', value: source.emoji || '🎁' },
      images: list(source.images),
    },
    // 这里先为空；以后抓到淘宝 / 京东 / 活动平台信息时，挂真实报价，不污染 gift idea。
    offers: Array.isArray(source.offers) ? source.offers : [],
    variants: Array.isArray(source.variants) ? source.variants : [],
    evidence,
    dataStatus: source.dataStatus || DATA_STATUSES.SEED,
    quality: {
      verified: Boolean(evidence.verified),
      hasOffer: Array.isArray(source.offers) && source.offers.length > 0,
      hasImage: list(source.images).length > 0,
      hasSource: Boolean(evidence.sourceUrl),
      missing: [
        !evidence.sourceUrl && 'source_url',
        !list(source.images).length && 'image',
        !(Array.isArray(source.offers) && source.offers.length) && 'offer',
      ].filter(Boolean),
    },
    search: {
      text: buildSearchText(source, meta),
      tokens: [...new Set([...list(source.tags), ...list(source.traits), ...list(source.occasions)])],
    },
  }
}

export function validateGiftRecord(record) {
  const errors = []
  if (!record?.id) errors.push('缺少 id')
  if (!record?.name) errors.push('缺少 name')
  if (!Object.values(GIFT_KINDS).includes(record?.kind)) errors.push(`kind 无效: ${record?.kind}`)
  if (!record?.category || !CATEGORY_META[record.category]) errors.push(`category 无效: ${record?.category}`)
  if (record?.category && CATEGORY_META[record.category]?.kind !== record.kind) {
    errors.push(`category 与 kind 不一致: ${record.category} / ${record.kind}`)
  }
  if (!record?.pricing || record.pricing.min > record.pricing.max) errors.push('pricing 区间无效')
  if (!Array.isArray(record?.fit?.recipients) || !record.fit.recipients.length) errors.push('缺少 fit.recipients')
  if (!Array.isArray(record?.fit?.occasions) || !record.fit.occasions.length) errors.push('缺少 fit.occasions')
  if (!record?.evidence?.sourceType) errors.push('缺少 evidence.sourceType')
  return errors
}

export function validateCatalog(records) {
  const seen = new Set()
  const errors = []
  for (const record of records || []) {
    if (seen.has(record?.id)) errors.push(`${record.id}: id 重复`)
    seen.add(record?.id)
    for (const error of validateGiftRecord(record)) errors.push(`${record?.id || '<unknown>'}: ${error}`)
  }
  return errors
}

export function summarizeCatalog(records) {
  const summary = {
    total: 0,
    byKind: { product: 0, activity: 0 },
    byCategory: {},
    unverified: 0,
    withoutOffer: 0,
    withoutImage: 0,
  }
  for (const record of records || []) {
    summary.total += 1
    if (summary.byKind[record.kind] != null) summary.byKind[record.kind] += 1
    summary.byCategory[record.category] = (summary.byCategory[record.category] || 0) + 1
    if (!record.evidence?.verified) summary.unverified += 1
    if (!record.quality?.hasOffer) summary.withoutOffer += 1
    if (!record.quality?.hasImage) summary.withoutImage += 1
  }
  return summary
}
