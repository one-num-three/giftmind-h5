/**
 * ══════════════════════════════════════════════════════════════
 *  官方商品库检索服务 (Official Gift Catalog RAG Service)
 *  —— 直连 giftmind-data-studio 官方标准 164 款商品与体验数据库：
 *     1. 孩子/晚辈严格排雷：坚决拉黑女士墨镜、口红唇膏、彩妆、中老年推拿理疗、睡衣等成人品；
 *     2. 孩子/晚辈专属加权：强力命中 Jellycat玩偶公仔、富士胶片相机、米家照片打印机、盲盒手办、北极狐书包等正品好物；
 *     3. 长辈严格排雷：坚决拉黑墨镜、彩妆、情侣二次元、巧克力；强力命中推拿理疗、体检、老照片画册、照片打印机等。
 * ══════════════════════════════════════════════════════════════
 */
import OFFICIAL_GIFTS from '../data/officialGifts.json' with { type: 'json' }
import { classifyRelationship } from '../utils/relationship.js'

/** 关系标签映射 */
const RECIPIENT_TYPE_MAP = {
  elder: ['parent', '父母', '长辈', '妈妈', '爸爸', '家人', '女性亲友'],
  lover: ['partner', '女朋友', '女性朋友', '闺蜜', '恋人'],
  work: ['colleague', 'manager', '同事', '领导', '朋友'],
  junior: ['child', 'junior', '同学', '朋友', '有明确IP偏好的朋友', '潮玩收藏者'],
  friend: ['friend', '朋友', '闺蜜', '同学', '有明确IP偏好的朋友', '潮玩收藏者', '喜欢搞怪的朋友', '喜欢街头穿搭的人'],
}

/**
 * 从 164 款官方商品库中检索最匹配的候选集
 */
export function retrieveCandidates(answers = {}, maxCandidates = 14) {
  const recipient = String(answers.recipient || '')
  const relCategory = classifyRelationship(recipient)

  const targetRecipientTags = RECIPIENT_TYPE_MAP[relCategory] || ['friend']
  const budget = String(answers.budget || '')
  const traits = Array.isArray(answers.personality) ? answers.personality.join(' ') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || answers.child_ip_style || answers.child_trait || answers.pain_point || '')
  const queryTokens = `${recipient} ${traits} ${memory} ${answers.occasion || ''}`.toLowerCase()

  // 评分打分机制
  const scored = OFFICIAL_GIFTS.map((gift) => {
    let score = 0
    const recTypes = gift.recipient_types || []
    const tags = (gift.tags || []).join(' ').toLowerCase()
    const desc = (gift.short_description || '').toLowerCase()
    const name = (gift.canonical_name || '').toLowerCase()
    const giftTraits = (gift.traits || []).join(' ').toLowerCase()

    // 1. 身份相关性加分
    const hasMatchingRec = recTypes.some((r) => targetRecipientTags.includes(String(r).toLowerCase()))
    if (hasMatchingRec) {
      score += 40
    } else if (recTypes.length === 0) {
      score += 15 // 通用型礼物
    }

    // 2. 🌟 孩子/晚辈专属场景：绝对排雷与针对性加权
    if (relCategory === 'junior') {
      // 坚决排雷成人女性美妆、墨镜、中老年养生理疗、睡衣家居服、恶搞恶趣味玩偶
      if (/墨镜|太阳镜|猫眼|口红|唇膏|唇泥|唇釉|气垫|香水|沐浴油|项链|手链|施华洛世奇|推拿|艾灸|足疗|药浴|汗蒸|体检|早茶|戏曲|睡衣|条纹睡衣|家居服|真丝|咖啡|老鼠干|抽象玩偶|恶搞/.test(name + desc + tags)) {
        score -= 500 // 彻底一票否决
      }

      // 强力加分适龄好物（玩偶、盲盒、相机、打印机、双肩包、潮玩周边）
      if (/jellycat|兔|巴塞罗熊|梗犬|玩偶|公仔|盲盒|dimoo|泡泡玛特|quicksnap|相机|胶片|打印机|口袋照片|kånken|书包|双肩包|小卡|吧唧|牙刷|旅行箱/.test(name + desc + tags)) {
        score += 80
      }

      // 若用户偏好“潮玩/公仔/IP”
      if (/潮玩|公仔|盲盒|手办|玩偶|ip|模型/.test(queryTokens)) {
        if (/jellycat|dimoo|盲盒|玩偶|公仔|小卡|吧唧/.test(name + desc + tags)) {
          score += 60
        }
      }

      // 若用户偏好“游戏/掌机/桌游/电竞”
      if (/游戏|掌机|switch|桌游|体感|主机|电竞|开黑/.test(queryTokens)) {
        if (/switch|游戏|掌机|桌游|体感|手柄|拼装|积木|乐高/.test(name + desc + tags)) {
          score += 100
        }
      }
    }

    // 3. 🌟 长辈专属场景：强力排雷与专属加权
    if (relCategory === 'elder') {
      // 精神念想/回忆线索加分
      if (/念想|精神|回忆|照片|故事|纪念|陪伴|想念|牵挂/.test(queryTokens)) {
        if (/照片|画册|写真|打印机|相机|回忆|老电影|茶|全家|定制/.test(name + desc + tags)) {
          score += 70
        }
      }

      // 健康/养生/日常舒适加分
      if (/体检|推拿|艾灸|足疗|养生|按摩|晨练|老电影|茶|戏曲|祈福|写真|钓鱼|温泉|舒缓|健康|家务|清洁|保暖|照片|画册/.test(name + desc + tags)) {
        score += 50
      }

      // 坚决排雷：长辈绝不推荐巧克力、彩妆、墨镜、二次元潮玩、情侣物品
      if (/巧克力|德芙|唇釉|口红|气垫|墨镜|猫眼|老鼠干|盲盒|吧唧|小卡|情侣漫画|电玩城|密室|露营夜|滑雪/.test(name + desc + tags)) {
        score -= 500
      }
    }

    // 4. 🌟 职场/领导专属场景：排雷与专属加权
    if (relCategory === 'work') {
      // 职场得体分寸：绝对排斥毛绒玩偶、盲盒、口红彩妆、情侣饰品、恶搞玩具
      if (/jellycat|玩偶|公仔|盲盒|dimoo|口红|唇膏|唇泥|唇釉|气垫|睡衣|情侣|老鼠干|巧克力|项链|手链|水滴/.test(name + desc + tags)) {
        score -= 600
      }
      // 职场首选：工夫茶礼、轻量商务双肩包、旅行箱、理疗推拿、相机、打印机、健康养生
      if (/茶|双肩包|旅行箱|推拿|理疗|相机|打印机|晨练|养生|洗发|足疗|温泉|棒球帽/.test(name + desc + tags)) {
        score += 70
      }
    }

    // 5. 伴侣专属场景加权
    if (relCategory === 'lover') {
      if (/口红|项链|首饰|手链|香水|双人|星空露营|漫画|手作|情侣|浪漫|睡衣|巧克力|墨镜/.test(name + desc + tags)) {
        score += 45
      }
    }

    // 6. 场景主题强约束（防止“户外”出现玩偶或气垫）
    if (/户外|运动|探险|出游|登山|骑行/.test(queryTokens)) {
      if (/双肩包|旅行箱|棒球帽|相机|露营|徒步/.test(name + desc + tags)) {
        score += 80
      }
      if (/jellycat|玩偶|公仔|盲盒|气垫|口红|唇膏|唇泥|唇釉/.test(name + desc + tags)) {
        score -= 400
      }
    }

    // 7. 关键词精准命中加分
    const keywords = ['玩偶', '公仔', '相机', '打印机', '双肩包', '念想', '精神', '照片', '回忆', '健康', '养生', '按摩', '放松', '家务', '做饭', '首饰', '美妆', '体检', '温泉', '旅行箱', '棒球帽', '茶']
    for (const kw of keywords) {
      if (queryTokens.includes(kw) && (name.includes(kw) || desc.includes(kw) || tags.includes(kw) || giftTraits.includes(kw))) {
        score += 35
      }
    }

    // 6. 预算匹配与越界惩罚
    const pMin = gift.price_min || gift.priceLow || 0
    const pMax = gift.price_max || gift.priceHigh || 9999
    if (budget.includes('100-300') || budget.includes('300')) {
      if (pMin <= 350 && pMax >= 80) score += 35
      else if (pMin > 600) score -= 60 // 严重超预算扣分
    } else if (budget.includes('300-600') || budget.includes('600')) {
      if (pMin <= 700 && pMax >= 250) score += 35
      else if (pMin > 1000) score -= 50
    } else if (budget.includes('600-1200') || budget.includes('1200')) {
      if (pMax >= 500) score += 35
      else if (pMax < 200) score -= 30
    }

    return { gift, score }
  })

  // 按得分排序并取前 N 个
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxCandidates).map((s) => {
    const g = { ...s.gift }
    g.ecommerceLinks = getEcommerceSearchLinks(g, answers)
    return g
  })
}

/**
 * 🌟 实时全网/电商（淘宝/京东）长尾检索链接生成器 (Search Query Synthesizer)
 */
export function getEcommerceSearchLinks(gift, answers = {}) {
  const name = gift?.canonical_name || gift?.name || '精选礼品'
  const cleanName = name.replace(/（[^）]+）|\([^)]+\)/g, '').trim()

  const allText = Object.values(answers || {}).join(' ')
  let prefix = ''
  if (/办公室|工位|伏案/.test(allText)) prefix = '办公室 '
  else if (/户外|徒步|露营/.test(allText)) prefix = '户外 '

  const query = `${prefix}${cleanName}`.trim()
  return {
    query,
    taobaoUrl: `https://s.taobao.com/search?q=${encodeURIComponent(query)}`,
    jdUrl: `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}`,
  }
}

/**
 * 格式化候选列表为大模型输入文本
 */
export function formatCandidatesForPrompt(candidates = []) {
  if (!candidates.length) return '暂无特定候选，请根据生活实际精准选品。'
  return candidates
    .map((g, idx) => {
      const price = g.price_min && g.price_max ? `¥${g.price_min}–${g.price_max}` : g.price_min ? `¥${g.price_min}` : '价格适中'
      const desc = (g.short_description || g.why || '').replace(/\s+/g, ' ').slice(0, 70)
      return `[候选 ${idx + 1}] ID: ${g.id} | 名称: 《${g.canonical_name || g.name}》 | 价格: ${price} | 简介: ${desc}`
    })
    .join('\n')
}
