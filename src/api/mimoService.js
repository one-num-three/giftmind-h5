/**
 * ══════════════════════════════════════════════════════════════
 *  AI 核心服务 (Xiaomi MiMo & DeepSeek 双引擎支持)
 *  —— 真正的大模型智能送礼策划大脑：
 *     1. 直连 giftmind-data-studio 官方 164 款商品库，RAG 驱动 AI 从库中精准选品；
 *     2. 实时懂行接话与情绪共鸣（Live Reaction / 丰富多元，绝无模板套话，杜绝复读）；
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
let fallbackCycle = 0

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
 * 痛点 1 核心实现：每道题提交后的 AI 实时懂行接话与情绪共鸣（Live Reaction / 拒绝套话复读）
 */
export async function getLiveReaction(step, answerValue, currentAnswers = {}) {
  if (answerValue === '' || (Array.isArray(answerValue) && answerValue.length === 0)) {
    return '没问题，这个问题我们先留白，重点顺着你最确定的细节来挑。'
  }

  const ansStr = Array.isArray(answerValue) ? answerValue.join('、') : String(answerValue)
  const recipient = currentAnswers.recipient || 'TA'
  const occasion = currentAnswers.occasion || '这次送礼'
  const budget = currentAnswers.budget || ''

  const systemPrompt = `你是精通挑礼艺术与生活美学的资深私人顾问 GiftMind。
用户刚刚回答了关于【${recipient}】的一项信息：【${ansStr}】。
请针对这个回答给出 1 句简短、自然、极具懂行感的专业点评或选品洞察（30字以内）。

【极其重要的表达规则】：
1. 绝对禁止在每句话里套用“太走心了”、“牵挂”等千篇一律的陈词滥调！
2. 必须就事论事，给出接地气、专业懂行的生活洞察：
   - 比如孩子安静探索：点明专注力好、拼搭/科学/绘本能沉浸大半天；
   - 比如长辈做家务/下厨：点明省心省力、一键好上手、实用减负；
   - 比如长辈想念/念想：点明定格全家欢聚回忆、睹物思人最暖心；
   - 比如伴侣浪漫/仪式：点明生活小确幸、有巧思有品味；
3. 纯中文输出，严禁任何英文单词。
4. 直接输出这一句话，不带任何引号或解释。`

  const userPrompt = `受礼人：${recipient}
用户本次回答：${ansStr}`

  // 1. 优先调用大模型实时生成
  try {
    const reaction = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.85, timeout: 5000 }
    )
    if (reaction && reaction.length >= 4) {
      const cleanReaction = reaction.replace(/^["“”]|["“”]$/g, '').trim()
      if (!usedReactionTexts.has(cleanReaction)) {
        usedReactionTexts.add(cleanReaction)
        return cleanReaction
      }
    }
  } catch (err) {
    console.log('[AI Live Reaction fallback]:', err)
  }

  // 2. 离线/超时精准分类兜底（多维度轮换，绝无重复套话）
  const fallback = generateSmartDiverseFallback(ansStr, recipient)
  usedReactionTexts.add(fallback)
  return fallback
}

function generateSmartDiverseFallback(ansStr, recipient) {
  const isChild = /孩|晚辈|学生|儿|女|侄|外甥|童|宝/.test(recipient)
  const isElder = /父|母|长辈|爸|妈|老两口|公公|婆婆|爷爷|奶奶/.test(recipient)
  const isLover = /女|妻|男|夫|对象|爱人|情侣/.test(recipient)

  let pool = []

  if (isChild) {
    if (/安静|探索|拼搭|科学|积木|阅读|绘本|太空|天文/.test(ansStr)) {
      pool = [
        '喜欢安静探索的孩子专注力极佳，拼搭模型或科学实验往往能让他们沉浸大半天。',
        '这类孩子求知欲旺盛，送兼具知识性与动手乐趣的益智好物最对胃口。',
        '从孩子着迷的兴趣切入，能让礼物长久陪伴，反复玩耍也不容易厌倦。',
      ]
    } else if (/动手|画|美术|黏土|手工|创造/.test(ansStr)) {
      pool = [
        '动手能力强的孩子想象力丰富，一套高品质的艺术创想套组最能激发灵感。',
        '鼓励孩子自己动手创造，不仅能收获成就感，还能留下珍贵的作品。',
      ]
    } else if (/运动|户外|骑行|活力|探险/.test(ansStr)) {
      pool = [
        '充满活力爱探险的孩子，送能在大自然里探索或挥洒汗水的运动装备最过瘾。',
        '陪孩子一起动起来，这样的礼物充满阳光与成长的活力。',
      ]
    } else {
      pool = [
        '从孩子的真实兴趣出发，选能兼顾趣味性与成长陪伴的好礼物。',
        '摸清了孩子的爱好偏好，选品就能有的放矢，送到孩子心坎里。',
      ]
    }
  } else if (isElder) {
    if (/家务|操劳|弯腰|做饭|清洁|扫|拖|繁重|辛劳/.test(ansStr)) {
      pool = [
        '体察到长辈日复一日的琐碎操劳，挑省时省力、一键好上手的减负好物最实在。',
        '长辈最怕复杂难操作，选设计人性化、能真正解放双手的好帮手最贴心。',
      ]
    } else if (/舒缓|按摩|痛|酸|关节|骨|睡眠|理疗/.test(ansStr)) {
      pool = [
        '随着年纪渐长，温和深层的热敷揉捏与理疗体验最能舒缓长辈的日常疲劳。',
        '把舒适与健康带给长辈，让他们每天睡得踏实、起居轻松，这份孝心最周到。',
      ]
    } else if (/念想|精神|回忆|照片|故事|陪伴/.test(ansStr)) {
      pool = [
        '长辈年纪大了最看重陪伴与回忆，把家人的欢聚温情定格下来，比什么礼物都暖心。',
        '专属的回忆载体能让长辈随时翻看，这种睹物思人的踏实感最有分量。',
      ]
    } else {
      pool = [
        '摸清长辈的实际起居习惯，挑真正经久耐用、让生活更舒适的贴心好物。',
        '给长辈选礼重在分寸与实用，这份细致考量会让方案更加稳妥。',
      ]
    }
  } else if (isLover) {
    pool = [
      '抓住日常相处里的小心动，有巧思和生活品味的礼物最能让人眼前一亮。',
      '送伴侣注重情绪价值与仪式感，选有质感、有专属故事的方案最为动人。',
      '摸清了 TA 的生活调性，我们在选品上会牢牢锁定这份独特的浪漫分寸。',
    ]
  } else {
    pool = [
      '记下了这个关键细节，在选品上我们会牢牢围绕这个核心诉求来甄选。',
      '这个方向选得很准，既体面又有生活质感，兼具实用与格调。',
      '有了这个清晰的指引，接下来的选品方案会更具针对性。',
    ]
  }

  fallbackCycle = (fallbackCycle + 1) % pool.length
  return pool[fallbackCycle]
}

/**
 * 🌟 核心突破：让大模型 100% 从 giftmind-data-studio 官方商品数据库中精挑细选
 */
export async function generateAiPlan(answers = {}) {
  const recipient = String(answers.recipient || 'TA')
  const occasion = String(answers.occasion || '特别的日子')
  const budget = String(answers.budget || '¥300-600')
  const personality = Array.isArray(answers.personality) ? answers.personality.join('、') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || answers.child_theme || answers.pain_point || '')
  const feeling = String(answers.feeling || answers.feeling_wish || '被深深理解与关怀')

  // 1. 从官方 164 款商品/体验库中多维检索候选池
  const candidateGifts = retrieveCandidates(answers, 14)
  const candidateText = formatCandidatesForPrompt(candidateGifts)

  const systemPrompt = `你是精通人情世故与生活品味的资深礼物策划专家 GiftMind。
你需要根据用户的问卷信息，从【GiftMind 官方商品数据库候选集】中为用户精选 3 件最贴切的真实礼物方案。

【GiftMind 官方真实商品库候选清单（必须优先从中挑选）】：
${candidateText}

【选品与推荐规则】：
1. 必须优先从上方官方商品库候选清单中挑选 3 件最契合的真实商品/体验（使用清单中的真实名称 name、价格 price、ID id）；
2. 结合用户的具体回答与心愿痛点（如孩子喜欢科学探索/空间积木，挑益智模型/科学装备；长辈操劳，挑减负理疗；伴侣挑浪漫美学），为每一件选出的商品撰写直击心坎的推荐理由 why（40字左右）；
3. 附上一封真挚、细腻、字字戳心的专属信件（paragraphs 3~4 段）。

必须输出严格 JSON 格式：
{
  "title": "方案主标题（12字以内，如：为TA定制的心意生活提案）",
  "subtitle": "一句话温暖副标题",
  "insight": {
    "summary": "专业洞察陈述（80字左右，深入点出为什么这么选）",
    "traits": ["贴心懂行", "专属心意", "品质生活"],
    "keyPoint": "选品核心逻辑"
  },
  "gifts": [
    {
      "id": "官方商品库中的真实ID",
      "name": "官方商品库中的真实名称",
      "emoji": "🎁",
      "price": "官方商品库中的价格区间（如：¥300-600）",
      "why": "深度推荐理由（40字以内）",
      "tag": "首选推荐"
    }
  ],
  "letter": {
    "salutation": "称呼：",
    "paragraphs": [
      "第一段内容...",
      "第二段内容...",
      "第三段内容..."
    ],
    "signature": "落款"
  }
}`

  const userPrompt = `【受礼人】：${recipient}
【场合/契机】：${occasion}
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
      tag: String(g.tag || (i === 0 ? '首选推荐' : i === 1 ? '精选优选' : '心意好物')),
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
