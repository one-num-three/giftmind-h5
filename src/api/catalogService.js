/**
 * ══════════════════════════════════════════════════════════════
 *  官方商品库检索服务 (Official Gift Catalog RAG Service)
 *  —— 直连 giftmind-data-studio 官方标准 164 款商品与体验数据库：
 *     1. 多维检索：根据受礼人类型、预算范围、核心痛点与关键词匹配候选品；
 *     2. RAG 注入：将官方真实商品注入大模型 Prompt，驱动 AI 100% 从库中精挑细选；
 *     3. 拒绝凭空捏造，保证每件礼物均有官方名称、价格区间与真实描述。
 * ══════════════════════════════════════════════════════════════
 */
import OFFICIAL_GIFTS from '../data/officialGifts.json'

/** 关系标签映射 */
const RECIPIENT_TYPE_MAP = {
  elder: ['parent', '父母', '长辈', '妈妈', '爸爸', '家人', '女性亲友'],
  lover: ['partner', '女朋友', '女性朋友', '闺蜜', '恋人'],
  work: ['colleague', 'manager', '同事', '领导', '朋友'],
  junior: ['child', 'junior', '同学', '朋友'],
  friend: ['friend', '朋友', '闺蜜', '同学', '有明确IP偏好的朋友', '潮玩收藏者', '喜欢搞怪的朋友', '喜欢街头穿搭的人'],
}

/**
 * 从 164 款官方商品库中检索最匹配的候选集
 */
export function retrieveCandidates(answers = {}, maxCandidates = 14) {
  const recipient = String(answers.recipient || '')
  let relCategory = 'friend'
  if (/父|母|长辈|爸|妈|老两口|公公|婆婆|爷爷|奶奶|姥/.test(recipient)) {
    relCategory = 'elder'
  } else if (/女|妻|男|夫|爱人|对象|情侣/.test(recipient)) {
    relCategory = 'lover'
  } else if (/同事|领导|商务|客户|老板/.test(recipient)) {
    relCategory = 'work'
  } else if (/孩|晚辈|学生|儿|女|侄|外甥/.test(recipient)) {
    relCategory = 'junior'
  }

  const targetRecipientTags = RECIPIENT_TYPE_MAP[relCategory] || ['friend']
  const budget = String(answers.budget || '')
  const personality = Array.isArray(answers.personality) ? answers.personality.join(' ') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || '')
  const queryTokens = `${recipient} ${personality} ${memory} ${answers.occasion || ''}`.toLowerCase()

  // 评分打分机制
  const scored = OFFICIAL_GIFTS.map((gift) => {
    let score = 0
    const recTypes = gift.recipient_types || []
    const tags = (gift.tags || []).join(' ').toLowerCase()
    const desc = (gift.short_description || '').toLowerCase()
    const name = (gift.canonical_name || '').toLowerCase()
    const traits = (gift.traits || []).join(' ').toLowerCase()

    // 1. 身份相关性加分
    const hasMatchingRec = recTypes.some((r) => targetRecipientTags.includes(r.toLowerCase()))
    if (hasMatchingRec) {
      score += 40
    } else if (recTypes.length === 0) {
      score += 15 // 通用型礼物
    }

    // 2. 长辈专属场景强力加权
    if (relCategory === 'elder') {
      if (/体检|推拿|艾灸|足疗|养生|按摩|晨练|老电影|茶|戏曲|祈福|写真|钓鱼|温泉|舒缓|健康|家务|清洁|保暖/.test(name + desc + tags)) {
        score += 50
      }
      // 排除极端年轻化/潮玩/情侣/彩妆
      if (/唇釉|口红|气垫|老鼠干|盲盒|吧唧|小卡|情侣漫画|电玩城/.test(name + tags)) {
        score -= 100
      }
    }

    // 3. 伴侣专属场景加权
    if (relCategory === 'lover') {
      if (/口红|项链|首饰|手链|香水|双人|星空露营|漫画|手作|情侣|浪漫|睡衣/.test(name + desc + tags)) {
        score += 45
      }
    }

    // 4. 关键词命中加分
    const keywords = ['健康', '养生', '按摩', '放松', '家务', '做饭', '咖啡', '摄影', '露营', '运动', '游戏', '首饰', '美妆', '体检', '温泉', '自清洁', '舒缓']
    for (const kw of keywords) {
      if (queryTokens.includes(kw) && (name.includes(kw) || desc.includes(kw) || tags.includes(kw) || traits.includes(kw))) {
        score += 30
      }
    }

    // 5. 预算匹配加分
    const pMin = gift.price_min || 0
    const pMax = gift.price_max || 9999
    if (budget.includes('100-300') || budget.includes('300')) {
      if (pMin <= 350 && pMax >= 80) score += 25
    } else if (budget.includes('300-600') || budget.includes('600')) {
      if (pMin <= 700 && pMax >= 250) score += 25
    } else if (budget.includes('600-1200') || budget.includes('1200')) {
      if (pMax >= 500) score += 25
    }

    return { gift, score }
  })

  // 按得分排序并取前 N 个
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxCandidates).map((s) => s.gift)
}

/**
 * 格式化候选列表为大模型输入文本
 */
export function formatCandidatesForPrompt(candidates = []) {
  if (!candidates.length) return '暂无特定候选，请根据生活实际精准选品。'
  return candidates
    .map((g, idx) => {
      const price = g.price_min && g.price_max ? `¥${g.price_min}–${g.price_max}` : g.price_min ? `¥${g.price_min}` : '价格适中'
      const desc = (g.short_description || '').replace(/\s+/g, ' ').slice(0, 70)
      return `[编号 ${idx + 1}] ID: ${g.id} | 名称: 《${g.canonical_name}》 | 价格: ${price} | 简介: ${desc}`
    })
    .join('\n')
}
