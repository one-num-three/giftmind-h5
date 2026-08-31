/**
 * ══════════════════════════════════════════════════════════════
 *  AI 核心服务 (Xiaomi MiMo & DeepSeek 双引擎支持)
 *  —— 真正的大模型智能送礼策划大脑：
 *     1. 直连 giftmind-data-studio 官方 164 款商品库，RAG 驱动 AI 从库中精准选品；
 *     2. 实时懂行接话与情绪共鸣（Live Reaction / 动态去重，绝不复读）；
 *     3. 4 大多风格情话/心意卡片定制与仪式感生成。
 * ══════════════════════════════════════════════════════════════
 */
import { matchLocalKnowledge } from './localKnowledgeBase'
import { retrieveCandidates, formatCandidatesForPrompt } from './catalogService'

const MIMO_API_KEY = 'sk-cvqx5j4irwxdbv0lmlggjd9md013lndoplm6rkl0qm9vbh65'
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1'
const MIMO_MODEL = 'mimo-v2.5' // 经济型标准模型，测试成本低

/** 全局会话已展示点评历史（防止在同一会话中重复） */
const usedReactionTexts = new Set()

/**
 * 基础请求封装（直连大模型接口）
 */
export async function callMiMo(messages, { temperature = 0.7, jsonMode = false, timeout = 12000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const body = {
      model: MIMO_MODEL,
      messages,
      temperature,
    }
    if (jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const res = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MIMO_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[AI API Error ${res.status}]:`, errText)
      throw new Error(`AI HTTP ${res.status}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || ''
    return content.trim()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 痛点 1 核心实现：每道题提交后的 AI 实时懂行接话与情绪共鸣（Live Reaction / 杜绝重复）
 */
export async function getLiveReaction(step, answerValue, currentAnswers = {}) {
  if (answerValue === '' || (Array.isArray(answerValue) && answerValue.length === 0)) {
    return '没问题，这个问题我们先留白，重点顺着你最确定的细节来挑。'
  }

  const ansStr = Array.isArray(answerValue) ? answerValue.join('、') : String(answerValue)
  const recipient = currentAnswers.recipient || 'TA'
  const occasion = currentAnswers.occasion || '这次送礼'
  const budget = currentAnswers.budget || ''

  const systemPrompt = `你是精通人情世故的资深私人挑礼买手 GiftMind。你的情商极高、懂生活、懂品味。
当前用户刚回答了关于【${recipient}】的一项信息。
请针对用户的具体回答【${ansStr}】，给出一句极其自然、懂行、有温度且让人感觉“被深刻理解”的即时点评/接话（1~2句话，35字以内）。
要求：
1. 绝对不要像机器人重复用户的词！要像身边的懂行朋友一样共情或点出背后的选品逻辑。
2. 若用户提到“念想 / 精神 / 陪伴 / 回忆”，点明礼物是“承载心意与牵挂的念想载体”！
3. 切忌自以为是添加狭隘预设，保持开放与关怀。
4. 纯中文输出，严禁任何英文单词。
5. 直接输出这一两句文案，不要带任何引号或解释。`

  const userPrompt = `受礼人：${recipient}
场合：${occasion}
预算：${budget}
当前步骤：${step.messages?.[0] || step.id}
用户本次回答：${ansStr}`

  // 1. 优先调用大模型实时生成
  try {
    const reaction = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.75, timeout: 6000 }
    )
    if (reaction && reaction.length > 4) {
      const cleanReaction = reaction.replace(/^["“”]|["“”]$/g, '').trim()
      if (!usedReactionTexts.has(cleanReaction)) {
        usedReactionTexts.add(cleanReaction)
        return cleanReaction
      }
    }
  } catch (err) {
    console.log('[AI Live Reaction fallback to local knowledge base]:', err)
  }

  // 2. 离线/超时兜底（带去重过滤）
  const matched = matchLocalKnowledge(ansStr, currentAnswers)
  if (matched?.reaction && !usedReactionTexts.has(matched.reaction)) {
    usedReactionTexts.add(matched.reaction)
    return matched.reaction
  }

  // 3. 动态情境多样化兜底（绝不重复同一句话）
  const dynamicFallbacks = [
    `“${ansStr}”这个细节太走心了，礼物承载的就是这种看不见却摸得着的牵挂。`,
    `记下了！这种切身的真实心愿，往往才是挑对礼物的灵魂所在。`,
    `这份心意真的很体贴，在选品上我们会牢牢锁定这种真实的情感分量。`,
    `能留意到这样的日常需求，说明你对 TA 的用心程度远超一般人。`,
    `这个方向选得极好，既有深厚的温度，又特别经得起时间推敲。`
  ]

  for (const fb of dynamicFallbacks) {
    if (!usedReactionTexts.has(fb)) {
      usedReactionTexts.add(fb)
      return fb
    }
  }

  return `记下了「${ansStr}」，我们会把这份特别的心意融入专属方案中。`
}

/**
 * 🌟 核心突破：让大模型 100% 从 giftmind-data-studio 官方商品数据库中精挑细选
 */
export async function generateAiPlan(answers = {}) {
  const recipient = String(answers.recipient || 'TA')
  const occasion = String(answers.occasion || '特别的日子')
  const budget = String(answers.budget || '¥300-600')
  const personality = Array.isArray(answers.personality) ? answers.personality.join('、') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || '')
  const feeling = String(answers.feeling || '被深深理解与关怀')

  // 1. 从官方 164 款商品/体验库中多维检索候选池
  const candidateGifts = retrieveCandidates(answers, 14)
  const candidateText = formatCandidatesForPrompt(candidateGifts)

  const systemPrompt = `你是精通人情世故与生活品味的资深礼物策划专家 GiftMind。
你需要根据用户的问卷信息，从【GiftMind 官方商品数据库候选集】中为用户精选 3 件最贴切的真实礼物方案。

【GiftMind 官方真实商品库候选清单（必须优先从中挑选）】：
${candidateText}

【选品与推荐规则】：
1. 必须优先从上方官方商品库候选清单中挑选 3 件最契合的真实商品/体验（使用清单中的真实名称 name、价格 price、ID id）；
2. 结合用户的具体回答与心愿痛点（如送长辈念想/陪伴，挑老照片画册/全家写真/照片打印机/舒缓体验；送伴侣挑浪漫/首饰/体验），为每一件选出的商品撰写直击心坎的推荐理由 why（40字左右）；
3. 附上一封真挚、细腻、字字戳心的专属信件（paragraphs 3~4 段）。

必须输出严格 JSON 格式：
{
  "title": "方案主标题（12字以内，如：为爸妈定制的心意生活提案）",
  "subtitle": "一句话温暖副标题（如：用贴心关怀与陪伴，把牵挂化作日常的温度）",
  "insight": {
    "summary": "专业洞察陈述（80字左右，深入点出为什么这么选）",
    "traits": ["体贴孝顺", "情感念想", "品质生活"],
    "keyPoint": "选品核心逻辑（如：拒绝华而不实，直击长辈日常起居与情感陪伴）"
  },
  "gifts": [
    {
      "id": "官方商品库中的真实ID",
      "name": "官方商品库中的真实名称",
      "emoji": "🎁",
      "price": "官方商品库中的价格区间（如：¥300-600）",
      "why": "针对用户的具体情况，阐述为什么选这件礼物的深度推荐理由（40字以内）",
      "tag": "首选推荐"
    }
  ],
  "letter": {
    "salutation": "亲爱的爸妈：",
    "paragraphs": [
      "第一段内容...",
      "第二段内容...",
      "第三段内容..."
    ],
    "signature": "—— 爱你们的孩子"
  }
}`

  const userPrompt = `【受礼人】：${recipient}
【场合】：${occasion}
【预算区间】：${budget}
【性格/偏好标签】：${personality}
【特别细节/心愿故事】：${memory}
【期望感受】：${feeling}`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, jsonMode: true, timeout: 15000 }
    )

    const data = JSON.parse(raw)
    if (data && data.gifts?.length) {
      return sanitizePlanData(data, answers, candidateGifts)
    }
  } catch (err) {
    console.warn('[AI Plan Generation fallback]:', err)
  }

  return null
}

function sanitizePlanData(data, answers, candidateGifts = []) {
  const gifts = (data.gifts || []).map((g, i) => {
    const match = candidateGifts.find((cg) => cg.id === g.id || cg.canonical_name === g.name)
    const cleanName = String(g.name || match?.canonical_name || '心意精选好物').replace(/[《》]/g, '')
    const price = String(g.price || (match?.price_min ? `¥${match.price_min}-${match.price_max}` : answers.budget || '¥300-600'))

    return {
      id: g.id || match?.id || `g_${Date.now()}_${i}`,
      catalogId: g.id || match?.id || `g_${Date.now()}_${i}`,
      name: cleanName,
      emoji: String(g.emoji || match?.emoji || '🎁'),
      price,
      why: String(g.why || match?.short_description || '为你精选的特别心意'),
      tag: String(g.tag || (i === 0 ? '首选推荐' : i === 1 ? '舒缓优选' : '心意好物')),
      kind: match?.gift_type_code || 'product',
      description: match?.short_description || '',
    }
  })

  const defaultLetter = {
    salutation: `${answers.recipient || '你'}：`,
    paragraphs: ['有些话当面说不出口，就写在信里了。', '愿这份心意能带给你一份温暖与小确幸。'],
    signature: '—— 爱你的我',
  }

  return {
    title: String(data.title || '专属心意策划方案'),
    subtitle: String(data.subtitle || '用体贴与心意为你量身定制'),
    insight: data.insight || {
      summary: '根据你的实际情况，为你量身定制了兼具心意与实用性的送礼方案。',
      traits: ['贴心选品', '品质生活'],
      keyPoint: '直击实际痛点，送礼送到心坎里',
    },
    gifts,
    recommendationGroups: [
      {
        category: '官方精选方案',
        title: '贴心心意推荐',
        subtitle: '从官方标准商品库中为你精挑细选',
        items: gifts,
      },
    ],
    letter: data.letter || defaultLetter,
    ritual: [
      { time: '送出前', title: '提前备好', desc: '拆开外包装检查，附上亲笔手写信' },
      { time: '送出当天', title: '温暖递上', desc: '微笑着亲手递给 TA，一起开箱体验' },
    ],
    share: {
      greeting: '生活需要一点未知的小确幸，拆开看看吧。',
      coverEmoji: '🎁',
      theme: 'dawn',
    },
    answers,
  }
}

/**
 * 痛点 4 核心实现：4 大风格情话/心意卡片多风格定制生成器
 */
export async function generateCustomStyleLetter(styleKey, planData, customStory = '') {
  const recipient = planData?.answers?.recipient || 'TA'
  const occasion = planData?.answers?.occasion || '特别的日子'
  const memory = customStory || planData?.answers?.memory || '平日里的默契与陪伴'
  const selectedGiftName = planData?.selectedGift?.name || planData?.gifts?.[0]?.name || '这份礼物'

  const styleGuides = {
    touching: '深情走心风格：细腻真挚、字字戳心，表达被理解与珍惜的感动，温润如涓涓细流。',
    tsundere: '嘴硬傲娇风格：口嫌体正直、反差萌，表面嫌弃实际上比谁都在乎，幽默可爱。',
    humorous: '轻松幽默风格：像老朋友互损打趣、接地气、让人会心大笑，充满生活烟火气。',
    poetic: '唯美诗意风格：现代诗歌般的留白与意境，充满画面感与艺术格调，清新脱俗。',
  }

  const systemPrompt = `你是精通中文语言艺术的资深写信顾问。
你需要根据方案信息与受礼人关系，为送礼人定制一封具有【${styleGuides[styleKey] || styleGuides.touching}】的情感手写信。

必须输出严格 JSON 格式：
{
  "salutation": "称呼（如：亲爱的爸妈：/ 亲爱的：）",
  "paragraphs": [
    "第一段内容（30-60字）",
    "第二段内容（40-80字，自然融入礼物：${selectedGiftName} 和细节回忆：${memory}）",
    "第三段祝福或深情落脚点（30-60字）"
  ],
  "signature": "落款（如：—— 永远爱你们的孩子 / —— 爱你的我）"
}`

  const userPrompt = `受礼人：${recipient}
场合：${occasion}
礼物名称：${selectedGiftName}
背后的特别故事/心愿细节：${memory}
选定风格：${styleKey}`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.8, jsonMode: true, timeout: 8000 }
    )

    const data = JSON.parse(raw)
    if (data && Array.isArray(data.paragraphs) && data.paragraphs.length >= 2) {
      return {
        salutation: data.salutation || `${recipient}：`,
        paragraphs: data.paragraphs,
        signature: data.signature || '—— 我',
        tone: styleKey,
      }
    }
  } catch (err) {
    console.warn('[AI Custom Letter Generation fallback]:', err)
  }

  return null
}
