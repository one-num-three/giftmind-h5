/**
 * ══════════════════════════════════════════════════════════════
 *  Xiaomi MiMo API 核心服务 (MiMo-V2.5-Pro-UltraSpeed)
 *  —— 极速 1000 TPS 神经大模型驱动：
 *     1. 问题即时懂行接话与情绪共鸣（解决痛点 1）
 *     2. 4 大多风格情话/心意卡片定制与仪式感生成（解决痛点 4）
 *     3. 完整方案与推荐生成
 * ══════════════════════════════════════════════════════════════
 */

const MIMO_API_KEY = 'sk-cvqx5j4irwxdbv0lmlggjd9md013lndoplm6rkl0qm9vbh65'
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1'
const MIMO_MODEL = 'mimo-v2.5-pro-ultraspeed'

/**
 * 基础请求封装（直连小米 MiMo 极速大模型接口）
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
      console.warn(`[MiMo API Error ${res.status}]:`, errText)
      throw new Error(`MiMo HTTP ${res.status}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || ''
    return content.trim()
  } finally {
    clearTimeout(timer)
  }
}

import { matchLocalKnowledge } from './localKnowledgeBase'

/**
 * 痛点 1 核心实现：每道题提交后的 AI 实时懂行接话与情绪共鸣（Live Reaction）
 */
export async function getLiveReaction(step, answerValue, currentAnswers = {}) {
  // 如果是跳过
  if (answerValue === '' || (Array.isArray(answerValue) && answerValue.length === 0)) {
    return '没问题，这个问题我们先留白，重点顺着你最确定的细节来挑。'
  }

  const ansStr = Array.isArray(answerValue) ? answerValue.join('、') : String(answerValue)
  const recipient = currentAnswers.recipient || 'TA'
  const occasion = currentAnswers.occasion || '这次送礼'
  const budget = currentAnswers.budget || ''

  const systemPrompt = `你是资深私人挑礼买手 GiftMind。你的情商极高、懂生活、懂品味、接地气。
当前用户正在回答关于受礼人的信息。
请根据用户的这次选择（以及已知的对象/场景/预算），给出一句极其自然、懂行、有温度且让人感觉“被深刻理解”的即时点评/接话（1~2句话，40字以内）。
要求：
1. 绝对不要像机器人重复用户的词！要像身边的懂行闺蜜/时尚买手朋友一样共情或给出选品小洞察。
2. 语言生动有画面感，带一点点生活烟火气。
3. 直接输出这一两句接话文案，不要带任何前缀或解释。`

  const userPrompt = `受礼人：${recipient}
场合：${occasion}
预算：${budget}
当前问题：${step.messages?.[0] || step.id}
用户本次回答：${ansStr}`

  try {
    const reaction = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.8, timeout: 4000 }
    )
    if (reaction && reaction.length > 5) {
      return reaction.replace(/^["“”]|["“”]$/g, '')
    }
  } catch (err) {
    console.log('[MiMo Live Reaction fallback to local knowledge base]:', err)
  }

  // 22 套正则底层专家知识库精准匹配
  const matched = matchLocalKnowledge(ansStr, currentAnswers)
  if (matched?.reaction) {
    return matched.reaction
  }

  // 极速高情商本地兜底矩阵（0 延迟，保证永远不会卡住用户）
  return getLocalFallbackReaction(step.id, ansStr, recipient)
}

function getLocalFallbackReaction(stepId, answer, recipient) {
  if (stepId === 'recipient') {
    if (answer.includes('女朋友') || answer.includes('妻子')) return '给另一半挑礼物永远是最浪漫的事，这次我们来准备一份让她眼前一亮的心动之作！'
    if (answer.includes('男朋友') || answer.includes('丈夫')) return '给男生挑礼物最讲究“实用与质感兼备”，别担心，绝对不踩老套雷区。'
    if (answer.includes('父母')) return '送长辈最重在“体贴入微与健康舒适”，我们要挑能真正融入他们日常的好东西。'
    if (answer.includes('闺蜜') || answer.includes('好友')) return '给好朋友送礼，仪式感和惊喜感必须拉满！'
    return `给 ${answer} 选礼很有讲究，我们一步步来锁定最合适的调性。`
  }
  if (stepId === 'budget') {
    if (answer.includes('50–150') || answer.includes('150–300')) return '这个预算很轻盈！把钱花在小而美的设计感好物上，心意丝毫不少。'
    if (answer.includes('300–600')) return '300~600 是非常黄金的送礼区间！既能选到小众轻奢质感，又不会给彼此带来心理负担。'
    if (answer.includes('600–1500')) return '这个预算可以从容挑选高品质的标杆单品与限定礼盒了，质感绝对在线。'
    if (answer.includes('不设上限')) return '底气十足！那我们就完全以“极致心动与独特仪式感”为第一标准来筛选。'
    return '预算心中有数了，我们在框架内把每一分钱的惊喜感发挥到最大。'
  }
  if (stepId === 'personality') {
    return `捕捉到了 TA 的独特气质！${answer} 的人，最容易被有故事、有生活细节的物件打动。`
  }
  if (stepId === 'taboo') {
    return '记下了！排雷和挑对同样重要，这些雷区我会在后续推荐中坚决避开。'
  }
  if (stepId === 'memory') {
    return '这个独一无二的细节太棒了！真实的共同回忆，永远是这份礼物最无可替代的灵魂。'
  }
  if (stepId === 'feeling') {
    return `希望 TA 拆开时能感受到“${answer}”——这种情绪正是我们所有礼物的核心落脚点。`
  }
  return '明白，这个细节很关键，我已经将它融进接下来的选品逻辑中了。'
}

/**
 * 痛点 4 核心实现：4 大风格情话/心意卡片多风格定制生成器
 */
export async function generateCustomStyleLetter(styleKey, planData, customStory = '') {
  const recipient = planData?.answers?.recipient || 'TA'
  const occasion = planData?.answers?.occasion || '特别的日子'
  const memory = customStory || planData?.answers?.memory || '平日里的默契与陪伴'
  const selectedGiftName = planData?.selectedGift?.name || planData?.gifts?.[0]?.name || '这份礼物'

  const stylePrompts = {
    touching: {
      name: '深情细腻 · 走心催泪',
      prompt: '语言细腻真挚，层层递进，深入提炼两人相处中的细微感动与真实回忆，表达“你所有的细小习惯我都放在心上”的深情，让人读完眼眶湿润。'
    },
    tsundere: {
      name: '嘴硬心软 · 傲娇可爱',
      prompt: '带有傲娇、轻快、反差萌的口吻（比如：“逛街顺手看到的，觉得只有你戴才不算浪费”、“不许感动得哭鼻子哦”），表面云淡风轻，字里行间全是在意。'
    },
    humorous: {
      name: '轻松幽默 · 欢脱搞怪',
      prompt: '风趣幽默、充满默契玩笑与生活梗，读起来让人忍不住会心大笑，拉近距离，充满快乐元气。'
    },
    poetic: {
      name: '唯美诗意 · 文青质感',
      prompt: '现代诗歌般的留白与意境美，充满画面感（如晨光、微风、咖啡香气、岁月流转），格调高雅，极富艺术美感。'
    }
  }

  const curStyle = stylePrompts[styleKey] || stylePrompts.touching

  const systemPrompt = `你是精通情感表达与文案创作的文学导师。
请为用户为 ${recipient} 准备的随礼手写心意卡片生成一封定制信。
风格要求：【${curStyle.name}】—— ${curStyle.prompt}

输出严格 JSON 格式：
{
  "salutation": "称呼（如：亲爱的XXX / 见信好）",
  "paragraphs": [
    "第一段（引出回忆或送礼由头）",
    "第二段（结合礼物与心意深情表达）",
    "第三段（对未来的期许与心愿）"
  ],
  "signature": "落款（如：永远陪在你身边的XXX / 某个爱挑剔但更爱你的人）",
  "tone": "${curStyle.name}"
}`

  const userPrompt = `送礼对象：${recipient}
场合：${occasion}
礼物名称：${selectedGiftName}
背景回忆/细节：${memory}`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.85, jsonMode: true, timeout: 8000 }
    )
    const parsed = JSON.parse(raw)
    if (parsed.paragraphs && parsed.paragraphs.length > 0) {
      return parsed
    }
  } catch (err) {
    console.warn('[MiMo Style Letter Gen error]:', err)
  }

  // 本地兜底信件
  return {
    salutation: `致 最特别的 ${recipient}：`,
    paragraphs: [
      `很多时候，最想说的话反而总是藏在日常的琐碎里。${memory ? `就像我们曾聊起的“${memory}”，一直被我悄悄记在心底。` : '生活匆忙，但关于你的细节我从不敢遗忘。'}`,
      `为你准备了这款【${selectedGiftName}】，希望当你在生活里用到它的那一刻，能瞬间感受到这份跨越距离的温暖与陪伴。`,
      `愿日子常新，愿你眼里总有星光，愿我们未来的每一个特别日子，都有彼此相伴。`
    ],
    signature: '写在心意送达之时',
    tone: curStyle.name
  }
}
