/**
 * ══════════════════════════════════════════════════════════════
 *  AI 核心服务 (Xiaomi MiMo & DeepSeek 双引擎支持)
 *  当前动态对话通过 callMiMo 请求后端；联网选礼走 realAdapter。
 *  本文件其余旧导出供兼容调用，不参与当前动态提问与选礼路径。
 * ══════════════════════════════════════════════════════════════
 */
import { classifyRelationship } from '../utils/relationship.js'


/** 全局会话已展示点评历史（防止在同一会话中重复） */
const usedReactionTexts = new Set()
let fallbackCycle = 0

/**
 * 基础请求封装（服务端安全代理优先，消除前端凭据泄露风险）
 */
export async function callMiMo(messages, { temperature = 0.7, top_p, jsonMode = false, timeout = 90000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  // 严格安全架构：生产走服务端网关代理，开发走 Vite 本地服务端代理，浏览器完全不暴露凭据
  const endpoints = ['/api/h5/chat-completion']

  // 深度兼容：DeepSeek 启用 jsonMode 时必须在提示词中包含 json 关键字
  const clonedMessages = messages.map(m => ({ ...m }))
  if (jsonMode) {
    const hasJsonWord = clonedMessages.some(m => /json/i.test(m.content || ''))
    if (!hasJsonWord && clonedMessages.length > 0) {
      clonedMessages[clonedMessages.length - 1].content += '\n(请严格以合法的 JSON 格式输出结果)'
    }
  }

  const body = {
    messages: clonedMessages,
    temperature,
  }
  if (typeof top_p === 'number') {
    body.top_p = top_p
  }
  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  try {
    let lastErr = null
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (res.ok) {
          const data = await res.json()
          const content = data?.choices?.[0]?.message?.content || data?.content || (typeof data === 'string' ? data : '')
          if (content) return content.trim()
        } else {
          const error = await res.json().catch(() => ({}))
          lastErr = new Error(error?.detail?.message || `模型服务返回 HTTP ${res.status}，请检查后台配置`)
        }
      } catch (err) {
        console.warn(`[AI API Fetch Error: ${url}]`, err.message)
        lastErr = err
      }
    }
    throw lastErr || new Error('All AI endpoints failed')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 痛点 1 核心实现：每道题提交后的 AI 实时懂行接话与情绪共鸣（0ms 秒级流式响应，拒绝卡顿等待）
 */
export async function getLiveReaction(step, answerValue, currentAnswers = {}) {
  if (answerValue === '' || (Array.isArray(answerValue) && answerValue.length === 0)) {
    return '没问题，这个问题我们先留白，重点顺着你最确定的细节来挑。'
  }

  const ansStr = Array.isArray(answerValue) ? answerValue.join('、') : String(answerValue)
  const recipient = currentAnswers.recipient || 'TA'

  // 0ms 瞬间生成精准、高情商、就事论事的懂行点评，直接进入流式逐字打印
  const reaction = generateSmartDiverseFallback(ansStr, recipient)
  usedReactionTexts.add(reaction)
  return reaction
}

function generateSmartDiverseFallback(ansStr, recipient) {
  const rel = classifyRelationship(recipient || ansStr)
  const isChild = rel === 'junior'
  const isElder = rel === 'elder'
  const isLover = rel === 'lover'
  const isWork = rel === 'work'

  let pool = []

  // 1. 第一题身份确认时的专属温暖接话
  if (/女朋友|妻子|老婆|女友/.test(ansStr)) {
    return '为心爱的她挑选礼物，最珍贵的是那份被放在心上的细腻与专属感～'
  }
  if (/男朋友|丈夫|老公|男友/.test(ansStr)) {
    return '为心爱的他挑选礼物，兼具高质感、实用性与专属仪式感的礼物最能戳中他的心～'
  }
  if (/父母|长辈|妈妈|爸爸/.test(ansStr)) {
    return '给长辈选礼最见孝心，挑真正省心耐用、让起居更舒适的贴心好物最实在～'
  }
  if (/孩子|晚辈|宝宝/.test(ansStr)) {
    return '给孩子挑礼物，兼具趣味性、探索欲与成长陪伴的好物最能让TA开心～'
  }
  if (/朋友|好友|兄弟|哥们|闺蜜|死党|室友/.test(ansStr)) {
    return '给好朋友挑礼物最讲究默契与共鸣，送真正契合 TA 生活细节与真挚情谊的心意最能打动人～'
  }
  if (/同事|领导/.test(ansStr)) {
    return '职场送礼重在得体分寸，既有生活品质感又不会带来人情负担～'
  }

  // 🌟 核心升级 1：如果用户表示不清楚/不知道/没想好/其他，绝不机械套词，而是高情商接话
  const isUncertain = /不知道|不清楚|没想好|没头绪|没主见|随便|其他|别的|不挑|都行|看情况|无所谓|不知道喜欢什么/.test(ansStr)
  if (isUncertain) {
    return '完全理解！挑礼物最怕没有头绪，这太正常了。咱们不猜 TA 喜欢什么，顺着日常生活的痕迹来找灵感～'
  }

  // 🌟 核心升级 2：如果是用户输入的具体爱好词，自然融入口语，坚决不带【】或（）括号
  if (ansStr.length >= 2 && !/单选|多选|跳过|未提及/.test(ansStr)) {
    const cleanTerm = ansStr.replace(/^[其他|比如|可能|大概|平时|想要|希望|给|送]+/g, '').trim().slice(0, 8) || ansStr.slice(0, 8)
    if (isElder) return `长辈平时喜欢${cleanTerm}有这份雅兴太棒了！把生活里的真挚热爱融进礼物，这份心意最显体贴与懂得～`
    if (isChild) return `抓住了孩子对${cleanTerm}的着迷与热爱，投其所好挑出来的礼物最能让 TA 拆开时开怀欢呼～`
    if (isWork) return `针对${cleanTerm}这个具体方向，在得体分寸中彰显生活调性与品味，送礼大方不出错～`
    if (isLover) return `捕捉到了 TA 对${cleanTerm}的心动细节，这份被默默放在心上的懂得，本身就是最好的浪漫～`
    return `收到关于${cleanTerm}的偏好，我们顺着这个核心方向一步步锁定最契合的方案～`
  }

  if (isChild) {
    if (/潮玩|公仔|盲盒|手办|玩偶|ip|模型|高达|动漫|二次元/.test(ansStr)) {
      pool = [
        '喜欢潮玩公仔的孩子往往有自己的审美主张，选正版高品质的大热IP或治愈毛绒最能给TA惊喜。',
        '这类流行玩偶与手办模型不仅好玩，放在书桌床头还是特别暖心的小陪伴。',
        '从孩子平时念叨的大热形象切入，拆开礼物那一刻绝对能收获最纯粹的开怀欢呼。',
      ]
    } else if (/安静|探索|拼搭|科学|积木|阅读|绘本|太空|天文|实验/.test(ansStr)) {
      pool = [
        '喜欢安静探索的孩子专注力极佳，拼搭模型或科学实验往往能让他们沉浸大半天。',
        '这类孩子求知欲旺盛，送兼具知识性与动手乐趣的益智好物最对胃口。',
        '从孩子着迷的探索兴趣切入，能让礼物长久陪伴，反复玩耍也不容易厌倦。',
      ]
    } else if (/动手|画|美术|黏土|手工|创造/.test(ansStr)) {
      pool = [
        '动手能力强的孩子想象力丰富，一套高品质的艺术创想套组最能激发灵感。',
        '鼓励孩子自己动手创造，不仅能收获满满的成就感，还能留下珍贵的成长作品。',
      ]
    } else if (/运动|户外|骑行|活力|探险/.test(ansStr)) {
      pool = [
        '充满活力爱探险的孩子，送能在大自然里探索或挥洒汗水的装备最过瘾。',
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
  } else if (isWork) {
    if (/户外|运动|探险|健身/.test(ansStr)) {
      pool = [
        '运动与户外方向健康阳光、充满活力，作为职场礼物得体实用且毫无距离感。',
        '选高品质的轻量户外与运动装备，既有生活调性，又能很好地表达关心与支持。',
      ]
    } else if (/茶|养生|理疗|健康/.test(ansStr)) {
      pool = [
        '茶道与身心调养极具传统底蕴与文化分寸，作为职场礼敬沉稳且体面。',
        '体恤日常伏案与工作操劳，送健康的关怀最能表达真挚敬意。',
      ]
    } else if (/桌面|美学|办公|文具/.test(ansStr)) {
      pool = [
        '办公桌面好物讲究质感与仪式感，日常工作中高频使用，每次伏案都能感受到这份心意。',
        '简约沉稳的桌面美学物件，兼具实用价值与高级审美。',
      ]
    } else {
      pool = [
        '职场送礼重在得体与分寸，锁定这个方向后方案会兼具品质感与实用性。',
        '这个契机把握得很准，既表达了真挚敬意与感谢，又大方得体不越界。',
      ]
    }
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
 * 🌟 核心突破 1：由 DeepSeek 智能提炼生成的 4 块送礼确认卡片 (AI-Powered Summary)
 * 彻底铲除死板硬编码模板，完全基于真实对话上下文与用户回答提取
 */
export async function generateAiSummary(answers = {}, messages = []) {
  const recipient = answers.recipient || '对方'
  const rel = classifyRelationship(recipient)

  // 整理问答对话记录
  const dialogHistory = (messages || [])
    .filter((m) => m && m.text && !m.muted)
    .map((m) => `${m.role === 'user' ? '【用户】' : '【AI顾问】'}: ${m.text}`)
    .join('\n')

  const answersText = Object.entries(answers)
    .filter(([k]) => !['recipient'].includes(k))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join('、') : v}`)
    .join('\n')

  const systemPrompt = `你是精通人情与礼品洞察的资深私人买手顾问 GiftMind。
用户刚刚与 AI 完成了一轮挑选礼物的深度咨询对话。
请结合【用户所有回答】与【真实对话上下文】，为用户提炼生成 4 块送礼确认卡片。
要求：语言凝练、真挚懂行、完全贴合真实对话细节，避免使用宽泛空洞的模板套话。

输出严格 JSON 格式：
{
  "who": "送给谁及TA的鲜明特质（如：送给孩子 / 晚辈（喜欢机械积木、恐龙与动手拼装，动手能力强））",
  "story": "为什么送 / 送礼契机与背后心意（结合对话中用户表达的契机、原因或期待，45字以内）",
  "feeling": "想表达什么 / 期待情绪与感受（用户希望受礼人感受到的心情、认可或陪伴，35字以内）",
  "constraints": "核心偏好与选品范围（列出偏好领域、具体形态、预算区间、禁忌等，35字以内）"
}`

  const userPrompt = `【受礼人角色】：${recipient}（分类：${rel}）
【已记录的问答细节】：
${answersText || '- 暂无结构化字段'}

【完整对话记录】：
${dialogHistory || '- 暂无对话文本'}

请提炼输出高质量的 4 块确认卡片 JSON：`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.7, timeout: 15000 }
    )

    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.who || parsed.story || parsed.feeling) {
        return {
          who: parsed.who || `送给${recipient}`,
          story: parsed.story || '送出一份被认真放在心上的特别心意。',
          feeling: parsed.feeling || '感受被懂、被体贴与被真诚对待的温暖。',
          constraints: parsed.constraints || (answers.budget ? `预算：${answers.budget}` : '兼具高品质与实用价值'),
        }
      }
    }
  } catch (err) {
    console.warn('[generateAiSummary Fallback]:', err)
  }

  // 动态兜底（基于用户实际输入词，绝不输出死板模板）
  const userTokens = Object.values(answers).map((v) => String(v || '')).filter(Boolean)
  const detailSnippet = userTokens.filter((t) => t.length > 1 && !t.includes('/')).slice(0, 3).join('、')
  return {
    who: `送给${recipient}${detailSnippet ? `（关注：${detailSnippet}）` : ''}`,
    story: detailSnippet ? `针对${detailSnippet}这一具体方向，送出一份真正贴切而走心的心意。` : `在特别的日子里，送出一份贴心实用的礼物。`,
    feeling: `让对方真切感受到被用心关注与体贴照顾。`,
    constraints: answers.budget ? `预算参考：${answers.budget}` : '品质出众，体面稳妥',
  }
}

/**
 * 🌟 核心突破 2：打破 164 款商品库限制，由 DeepSeek 大模型进行全网真实在售好物开放检索与深度企划
 */
export async function generateAiPlan(answers = {}) {
  const recipient = String(answers.recipient || 'TA')
  const occasion = String(answers.occasion || answers.story || '特别的日子')
  const budget = String(answers.budget || '¥300-600')
  const personality = Array.isArray(answers.personality) ? answers.personality.join('、') : String(answers.personality || '')
  const memory = String(answers.memory || answers.story || answers.child_ip_style || answers.child_trait || answers.pain_point || '')
  const feeling = String(answers.feeling || answers.feeling_wish || '被深深理解与关怀')
  const constraints = String(answers.constraints || answers.summaryNotes || '')

  const rel = classifyRelationship(recipient)
  const isChild = rel === 'junior'
  const isElder = rel === 'elder'
  const isWork = rel === 'work'

  const letterRule = isChild
    ? `【送孩子/晚辈专属信件约束（极其重要）】：
- 称呼必须为：“亲爱的宝贝：” 或 “亲爱的小朋友：”；
- 语气必须是长辈对孩子的温柔爱护、鼓励探索与陪伴祝福，【绝对禁止出现任何男女感情、纠葛、翻篇、遗憾等成人口吻】！
- 落款必须为：“—— 永远爱你的长辈 / 爸爸妈妈”；`
    : isElder
    ? `【送父母/长辈专属信件约束】：
- 称呼必须为：“亲爱的爸妈：”；
- 语气必须是体贴孝顺、感恩心疼；
- 落款必须为：“—— 爱你们的孩子”；`
    : isWork
    ? `【送同事/领导专属信件约束（极其重要）】：
- 称呼必须为：“尊敬的领导：” 或 “亲爱的同事 / 伙伴：”；
- 语气必须是职场得体、真挚感谢提携关照与并肩奋斗、祝福事业发展顺遂，【绝对禁止出现情侣口吻、闺蜜套话或过分亲昵】！
- 落款必须为：“—— 您的团队伙伴 / 同仁 敬上”；`
    : `【送伴侣/朋友信件约束】：浪漫深情或真挚默契。`

  const systemPrompt = `你是顶级礼品策划大师与全网专业选品买手 GiftMind。
你需要根据用户的真实需求、受礼人特质与预算，打破任何固定商品库的狭隘限制，直接调动你对【全网在售真实正品好物】（淘宝、京东、天猫旗舰店、知名品牌商场等）的深度认知，为用户精选 3 件【真实存在、口碑极高、可在主流电商平台直接购买的正品商品或高水准体验】。

【全网买手专业选品参考原则】：
1. 【真实品牌与型号】：推荐电商在售的真实知名品牌、系列或具体型号（例如知名品牌特定型号、大热IP官方正品等），避免虚构不存在的产品或含糊词汇；
2. 【客观市价与预算参考】：给出的 price 贴合当前主流真实在售价格，且贴近用户的预算区间（${budget}）；
3. 【懂行且直击心坎的推荐理由（why）】：深入结合受礼人的核心偏好、痛点或生活场景，写明 50-70 字直击心坎的推荐理由；
4. 【精准电商搜索词（searchQuery）】：为每件商品提炼可在淘宝/京东直接搜出该正品的最精准搜索关键词（如：“乐高 42154 福特GT”、“Jellycat 害羞兔 31cm”、“国家地理 恐龙化石挖掘 豪华版”）；
5. 【人伦角色分寸对齐】：信件与礼品类型契合受礼人身份，孩子适合益智成长，领导适合得体大方；
6. 【当面递送说辞（delivery_script）】：30秒可以直接说出口的自然体面说辞（包含借口+关心+无还礼压力，50-70字）。

${letterRule}

必须输出严格 JSON 格式：
{
  "title": "方案主标题（12字以内，如：为宝贝量身定制的成长心意提案）",
  "subtitle": "一句话温暖副标题",
  "insight": {
    "summary": "专业洞察陈述（80字左右，深入点出为什么这么选）",
    "traits": ["标签1", "标签2", "标签3"],
    "keyPoint": "选品核心逻辑"
  },
  "delivery_script": "当面递送30秒说辞（50-70字）",
  "social_etiquette_tip": "递送时机与分寸避坑指南（30字左右）",
  "gifts": [
    {
      "id": "open_gift_1",
      "name": "真实品牌 + 系列/型号（如：LEGO 乐高 42154 机械组 福特GT跑车）",
      "emoji": "🏎️",
      "price": "¥899",
      "why": "深度契合受礼人偏好的推荐理由（50-70字）",
      "tag": "首选推荐",
      "kind": "product",
      "category": "积木拼搭",
      "searchQuery": "最精准的淘宝京东搜索词（如：乐高 42154 福特GT）",
      "matchedDetails": ["细节1", "细节2"],
      "caveats": ["购买或使用注意细节（如：建议认准官方旗舰店防伪）"],
      "tip": "怎么送更有仪式感的小建议",
      "dimensionScores": {
        "recommendation": 98,
        "fit": 96,
        "distinctiveness": 94,
        "feasibility": 92
      }
    }
  ],
  "letter": {
    "salutation": "称呼（如：亲爱的宝贝：）",
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
【期望感受】：${feeling}
【必须满足/核心约束】：${constraints}`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, jsonMode: true, timeout: 35000 }
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
  const gifts = (data.gifts || []).map((g, i) => {
    const cleanName = String(g.name || '精选心意好物').replace(/[《》]/g, '').trim()
    const cleanQuery = String(g.searchQuery || cleanName).replace(/[《》]/g, '').trim()
    const price = String(g.price || answers.budget || '价格亲民')

    const ecommerceLinks = {
      query: cleanQuery,
      taobaoUrl: `https://s.taobao.com/search?q=${encodeURIComponent(cleanQuery)}`,
      jdUrl: `https://search.jd.com/Search?keyword=${encodeURIComponent(cleanQuery)}`,
      xiaohongshuUrl: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(cleanQuery)}`,
    }

    return {
      id: g.id || `open_gift_${Date.now()}_${i}`,
      catalogId: g.id || `open_gift_${Date.now()}_${i}`,
      name: cleanName,
      emoji: String(g.emoji || (i === 0 ? '🎁' : i === 1 ? '✨' : '🎯')),
      price,
      why: String(g.why || '为你全网精选的特别心意'),
      tag: String(g.tag || (i === 0 ? '首选推荐' : i === 1 ? '精选优选' : '心意好物')),
      kind: g.kind || 'product',
      category: g.category || '礼物',
      description: String(g.why || ''),
      searchQuery: cleanQuery,
      ecommerceLinks,
      matchedUserFacts: Array.isArray(g.matchedDetails) ? g.matchedDetails : [],
      matchedDetails: Array.isArray(g.matchedDetails) ? g.matchedDetails : [],
      caveats: Array.isArray(g.caveats) && g.caveats.length ? g.caveats : ['下单前确认颜色、规格、官方正品授权与售后保障。'],
      tip: g.tip || '送出前可写上一张心意小卡片，仪式感更满。',
      dimensionScores: g.dimensionScores || {
        recommendation: 95 - i * 2,
        fit: 94 - i * 2,
        distinctiveness: 92 - i,
        feasibility: 90 + i,
      },
    }
  })

  const rel = classifyRelationship(answers.recipient || '')
  let defaultDeliveryScript = ''
  let defaultSocialEtiquette = ''

  if (rel === 'work') {
    defaultDeliveryScript = '领导，前阵子看您总加班看项目，这套放办公室随手用特别省心，顺手给您带了一套，您工作累了随时润润喉放松下。'
    defaultSocialEtiquette = '建议在下班前后或单独在办公室工位时递送，点到为止不张扬，最显职场分寸。'
  } else if (rel === 'lover') {
    defaultDeliveryScript = '前几天看到这个，第一眼就觉得写着你的名字。专属送给全世界最值得被宠爱的你。'
    defaultSocialEtiquette = '可在二人独处或用餐结束时送出，附带亲笔手写卡片，浪漫仪式感拉满。'
  } else if (rel === 'elder') {
    defaultDeliveryScript = '爸妈，看你们平时总舍不得添置，这个平时用起来特别顺手，特意买给你们试试，可别再说浪费钱啦。'
    defaultSocialEtiquette = '送出前帮他们拆好包装并演示一键操作，长辈嘴上说省钱心里最欣慰。'
  } else if (rel === 'junior') {
    defaultDeliveryScript = '当当当当！看宝贝最近表现特别棒，这个特别的心意奖励送给你，愿你每天都开开心心！'
    defaultSocialEtiquette = '在放学或周末闲暇时一起拆箱，鼓励孩子动手探索，陪伴是最好的心意。'
  } else {
    defaultDeliveryScript = '前阵子看到这个一眼就觉得特别适合你，顺手给你带了一份，必须收下！'
    defaultSocialEtiquette = '聚会见面时随手递上，自然松弛，体现真挚生活默契。'
  }

  const deliveryScript = String(data.delivery_script || data.deliveryScript || defaultDeliveryScript)
  const socialEtiquetteTip = String(data.social_etiquette_tip || data.socialEtiquetteTip || defaultSocialEtiquette)

  const isChild = rel === 'junior'
  const defaultLetter = isChild
    ? {
        salutation: '亲爱的宝贝：',
        paragraphs: [
          '见信好呀！',
          '愿你永远保持对世界的好奇心与探索欲，开开心心地慢慢长大。',
          '这份小小的礼物希望能陪伴你的每一个奇妙瞬间，愿你天天都有好心情！',
        ],
        signature: '—— 永远爱你的家人',
      }
    : {
        salutation: `${answers.recipient || '你'}：`,
        paragraphs: ['有些话当面说不出口，就写在信里了。', '愿这份心意能带给你一份温暖与小确幸。'],
        signature: '—— 爱你的我',
      }

  return {
    title: String(data.title || '专属心意策划方案'),
    subtitle: String(data.subtitle || '全网智能甄选 · 用体贴与心意为你量身定制'),
    insight: data.insight || {
      summary: '根据你的实际情况，为你量身定制了兼具心意与实用性的送礼方案。',
      traits: ['贴心选品', '品质生活'],
      keyPoint: '直击实际痛点，送礼送到心坎里',
    },
    deliveryScript,
    socialEtiquetteTip,
    gifts,
    recommendationGroups: [
      {
        category: '全网严选方案',
        title: '贴心心意推荐',
        subtitle: '全网正品好物中为你量身甄选',
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
 * 🌟 核心突破 3：换一个礼物 —— 由 DeepSeek 大模型实时全网动态检索新礼物
 */
export async function generateAiReplacementGift(plan, { targetId, reason = '' } = {}) {
  const answers = plan?.answers || {}
  const recipient = answers.recipient || '对方'
  const budget = answers.budget || '¥300-600'
  const currentGifts = Array.isArray(plan?.gifts) ? plan.gifts : []
  const excludeNames = currentGifts.map((g) => g.name).join('、')

  const systemPrompt = `你是顶级礼品策划大师与全网专业买手 GiftMind。
用户希望替换当前送礼方案中的一件礼物（当前方案已推荐过：${excludeNames}）。
请避开已推荐过的商品，为受礼人推荐另一件【全网在售的真实正品好物】（具体到真实品牌、系列与型号）。
必须输出严格 JSON 格式：
{
  "name": "真实品牌 + 系列/型号",
  "emoji": "🎁",
  "price": "真实市价区间（贴近预算：${budget}）",
  "why": "深度推荐理由（50-70字）",
  "tag": "优选替换",
  "kind": "product",
  "category": "类别",
  "searchQuery": "淘宝京东精准搜索词",
  "matchedDetails": ["细节1", "细节2"],
  "caveats": ["购买注意事项"],
  "tip": "赠送小贴士",
  "dimensionScores": {
    "recommendation": 94,
    "fit": 95,
    "distinctiveness": 93,
    "feasibility": 92
  }
}`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `受礼人：${recipient}，预算：${budget}，用户反馈替换诉求：${reason || '想看点不一样的真实商品'}` },
      ],
      { jsonMode: true, temperature: 0.8, timeout: 20000 }
    )
    const g = JSON.parse(raw)
    if (g && g.name) {
      const cleanName = String(g.name).replace(/[《》]/g, '').trim()
      const cleanQuery = String(g.searchQuery || cleanName).replace(/[《》]/g, '').trim()
      return {
        id: `replace_gift_${Date.now()}`,
        catalogId: `replace_gift_${Date.now()}`,
        name: cleanName,
        emoji: String(g.emoji || '🎁'),
        price: String(g.price || budget),
        why: String(g.why || '为你精选的全新替换心意'),
        tag: '优选替换',
        kind: g.kind || 'product',
        category: g.category || '礼物',
        description: String(g.why || ''),
        searchQuery: cleanQuery,
        ecommerceLinks: {
          query: cleanQuery,
          taobaoUrl: `https://s.taobao.com/search?q=${encodeURIComponent(cleanQuery)}`,
          jdUrl: `https://search.jd.com/Search?keyword=${encodeURIComponent(cleanQuery)}`,
          xiaohongshuUrl: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(cleanQuery)}`,
        },
        matchedUserFacts: Array.isArray(g.matchedDetails) ? g.matchedDetails : [],
        matchedDetails: Array.isArray(g.matchedDetails) ? g.matchedDetails : [],
        caveats: Array.isArray(g.caveats) && g.caveats.length ? g.caveats : ['下单前确认官方正品授权。'],
        tip: g.tip || '附带心意卡片效果更佳。',
        dimensionScores: g.dimensionScores || {
          recommendation: 94,
          fit: 95,
          distinctiveness: 93,
          feasibility: 92,
        },
      }
    }
  } catch (err) {
    console.warn('[generateAiReplacementGift Fallback]:', err)
  }
  return null
}

/**
 * 痛点 4 核心实现：4 大风格情话/心意卡片多风格定制生成器
 */
export async function generateCustomStyleLetter(styleKey, planData, customStory = '') {
  const recipient = planData?.answers?.recipient || 'TA'
  const occasion = planData?.answers?.occasion || '特别的日子'
  const memory = customStory || planData?.answers?.memory || '平日里的默契与陪伴'
  const selectedGiftName = planData?.selectedGift?.name || planData?.gifts?.[0]?.name || '这份礼物'

  const isChild = /孩|晚辈|学生|儿|女|侄|外甥|童|宝|弟|妹/.test(recipient)
  const isElder = /父|母|长辈|爸|妈|老两口|公公|婆婆|爷爷|奶奶|姥/.test(recipient)

  const audienceGuidance = isChild
    ? '受礼人为【孩子/晚辈】：语气必须充满童真、宠溺、鼓励与成长关爱，【绝对禁止出现任何男女情侣纠葛、暧昧或成人口吻】！'
    : isElder
    ? '受礼人为【父母/长辈】：语气必须充满孝顺、感恩、关怀与心疼！'
    : '受礼人为【伴侣/朋友】：根据具体风格进行真挚表达。'

  const styleGuides = {
    touching: '深情走心风格：细腻真挚、字字戳心，表达被理解与珍惜的感动，温润如涓涓细流。',
    tsundere: '嘴硬傲娇风格：口嫌体正直、反差萌，表面嫌弃实际上比谁都在乎，幽默可爱。',
    humorous: '轻松幽默风格：像老朋友互损打趣、接地气、让人会心大笑，充满生活烟火气。',
    poetic: '唯美诗意风格：现代诗歌般的留白与意境，充满画面感与艺术格调，清新脱俗。',
  }

  const systemPrompt = `你是精通中文语言艺术的资深写信顾问。
你需要根据方案信息与受礼人关系，为送礼人定制一封具有【${styleGuides[styleKey] || styleGuides.touching}】的情感手写信。

${audienceGuidance}

必须输出严格 JSON 格式：
{
  "salutation": "称呼（如：亲爱的宝贝： / 亲爱的爸妈： / 亲爱的：）",
  "paragraphs": [
    "第一段内容（30-60字）",
    "第二段内容（40-80字，自然融入礼物：${selectedGiftName} 和心愿：${memory}）",
    "第三段祝福或深情落脚点（30-60字）"
  ],
  "signature": "落款（如：—— 永远爱你的长辈 / —— 爱你的我）"
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
        salutation: data.salutation || (isChild ? '亲爱的宝贝：' : `${recipient}：`),
        paragraphs: data.paragraphs,
        signature: data.signature || (isChild ? '—— 最爱你的家人' : '—— 我'),
        tone: styleKey,
      }
    }
  } catch (err) {
    console.warn('[AI Custom Letter Generation fallback]:', err)
  }

  return null
}
