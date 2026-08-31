/**
 * ══════════════════════════════════════════════════════════════
 *  AI 核心服务 (Xiaomi MiMo & DeepSeek 双引擎支持)
 *  —— 真正的大模型智能送礼策划大脑：
 *     1. 真实 AI 选品引擎：根据具体痛点（如父母重复劳动）量身定制真实礼物，绝不推耳机错位品；
 *     2. 实时懂行接话与情绪共鸣（Live Reaction / 杜绝重复）；
 *     3. 4 大多风格情话/心意卡片定制与仪式感生成。
 * ══════════════════════════════════════════════════════════════
 */
import { matchLocalKnowledge } from './localKnowledgeBase'

const MIMO_API_KEY = 'sk-cvqx5j4irwxdbv0lmlggjd9md013lndoplm6rkl0qm9vbh65'
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1'
const MIMO_MODEL = 'mimo-v2.5' // 经济型标准模型，测试成本低

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
 * 痛点 1 核心实现：每道题提交后的 AI 实时懂行接话与情绪共鸣（Live Reaction）
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
2. 若用户提到长辈做家务/辛苦/劳累，重点肯定用户的孝顺与体贴，点明要选“省力减负、分担日常”的实用好物！
3. 直接输出这一两句文案，不要带任何引号或解释。`

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
      { temperature: 0.75, timeout: 5000 }
    )
    if (reaction && reaction.length > 4) {
      return reaction.replace(/^["“”]|["“”]$/g, '').trim()
    }
  } catch (err) {
    console.log('[AI Live Reaction fallback to local knowledge base]:', err)
  }

  // 2. 离线/超时兜底（带去重过滤）
  const matched = matchLocalKnowledge(ansStr, currentAnswers)
  if (matched?.reaction) {
    return matched.reaction
  }

  return '能体察到长辈的辛劳，这份心意最难得。我们顺着这个细节来挑最减负贴心的好物！'
}

/**
 * 🌟 核心突破：由真实大模型生成契合具体痛点的完整送礼方案（绝不推错位礼物）
 */
export async function generateAiPlan(answers = {}) {
  const recipient = String(answers.recipient || 'TA')
  const occasion = String(answers.occasion || '特别的日子')
  const budget = String(answers.budget || '¥300-600')
  const personality = Array.isArray(answers.personality) ? answers.personality.join('、') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || '')
  const feeling = String(answers.feeling || '被深深理解与关怀')

  const systemPrompt = `你是精通人情世故与生活品味的资深礼物策划专家 GiftMind。
你需要根据用户的问卷信息，为用户生成一份真正懂人心、选品极其贴切专业的完整送礼策划方案。

【极其重要的选品人伦与逻辑原则】：
1. 若送【父母/长辈】且用户提到【重复劳动/家务操劳/腰酸/健康/做饭】：
   - 必须精准推荐：智能自清洁洗地机/扫拖机器人、腰椎颈椎热敷揉捏按摩仪、免看火多功能破壁机、人体工学电动清洁刷等【真实减负、关怀健康】的贴心好物！
   - 严禁推荐耳机、游戏机、香水、彩妆等完全不搭边的错位物品！
2. 若送【男朋友/女生/朋友】：根据具体性格和预算精准选品。
3. 方案包含 3 件契合痛点的具体礼物清单（包含 name, emoji, price, why, tag）。
4. 附上一封真挚、细腻、字字戳心的专属信件（paragraphs 3~4 段）。

必须输出严格 JSON 格式：
{
  "title": "方案主标题（12字以内，如：为爸妈的减负生活提案）",
  "subtitle": "一句话温暖副标题（如：用科技与体贴，换下他们操劳的双手的温度心意）",
  "insight": {
    "summary": "专业洞察陈述（80字左右，深入点出为什么这么选）",
    "traits": ["体贴孝顺", "减负省力", "健康关怀"],
    "keyPoint": "选品核心逻辑（如：拒绝华而不实，直击家务劳累痛点）"
  },
  "gifts": [
    {
      "id": "g1",
      "name": "智能自清洁无线洗地机",
      "emoji": "🧹",
      "price": "¥999-1499",
      "why": "告别弯腰拖地的繁重家务，一键自清洁，真正把父母从每日重复清洁中解放出来。",
      "tag": "首选减负推荐"
    },
    {
      "id": "g2",
      "name": "腰背颈椎多功能热敷揉捏按摩仪",
      "emoji": "💆",
      "price": "¥399",
      "why": "针对操劳后的腰背酸痛，恒温热敷舒缓肌肉，随时随地给父母做专业按摩。",
      "tag": "健康舒缓优选"
    },
    {
      "id": "g3",
      "name": "全自动免看火低音破壁料理机",
      "emoji": "🍲",
      "price": "¥299",
      "why": "一键预约免看火，营养热饮轻松搞定，极大简化每日下厨步骤。",
      "tag": "省心生活好物"
    }
  ],
  "letter": {
    "salutation": "亲爱的爸妈：",
    "paragraphs": [
      "见信好。",
      "每次回家，总看到你们忙前忙后。那些日复一日的繁琐家务，虽然你们从不抱怨，但我其实一直看在眼里，也心疼在心里。",
      "这次特意为你们挑选了能分担日常辛劳的实用小帮手，希望能替我多陪伴你们、分担一点辛劳。",
      "愿你们健健康康，每天都有更多时间喝茶、散步、享清闲。"
    ],
    "signature": "—— 爱你们的孩子"
  }
}`

  const userPrompt = `【受礼人】：${recipient}
【场合】：${occasion}
【预算区间】：${budget}
【性格/爱好标签】：${personality}
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
      return sanitizePlanData(data, answers)
    }
  } catch (err) {
    console.warn('[AI Plan Generation fallback]:', err)
  }

  return null
}

function sanitizePlanData(data, answers) {
  const gifts = (data.gifts || []).map((g, i) => ({
    id: g.id || `g_${Date.now()}_${i}`,
    catalogId: g.id || `g_${Date.now()}_${i}`,
    name: String(g.name || '心意精选礼物'),
    emoji: String(g.emoji || '🎁'),
    price: String(g.price || answers.budget || '¥300-600'),
    why: String(g.why || '为你挑选的特别礼物'),
    tag: String(g.tag || (i === 0 ? '首选推荐' : '心意备选')),
    kind: 'physical',
  }))

  const defaultLetter = {
    salutation: `${answers.recipient || '你'}：`,
    paragraphs: ['有些话当面说不出口，就写在信里了。', '愿这份心意能带给你一份小确幸。'],
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
        category: '减负省心首选',
        title: '分担日常劳作',
        subtitle: '真正能派上用场的实用好物',
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
