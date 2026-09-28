/**
 * ══════════════════════════════════════════════════════════════
 *  深度 AI 动态出题引擎 (Deep Multi-Layer Consultative Engine v5.0)
 *  传递真实对话和参考信息；追问内容、顺序与收尾均由模型决定。
 * ══════════════════════════════════════════════════════════════
 */
import { classifyRelationship } from '../utils/relationship.js'
import { buildDialogStateCanvas, DOMAIN_KNOWLEDGE, clusterOptionsByJev, capOptionsWithCustomGuard } from '../services/jevEngine.js'

/** 讲解选项：选中后不提交答案，触发一次选项讲解，用户随后在原题上继续选择 */
export const EXPLAIN_OPTION_VALUE = '__explain__'
export const EXPLAIN_OPTION = { value: EXPLAIN_OPTION_VALUE, label: '讲讲区别', emoji: '💡' }

/** 初始第一题（建立受礼人身份） */
export const INITIAL_STEP = {
  id: 'recipient',
  stage: 'discover',
  key: 'recipient',
  type: 'single',
  messages: [
    '你好呀 👋 我是 GiftMind，你的 AI 私人挑礼策划师。',
    '这次想为谁挑选礼物？也可以直接聊聊你的想法。',
  ],
  options: [
    { value: '同事 / 领导', label: '同事 / 领导', emoji: '🧑‍💼' },
    { value: '女朋友 / 妻子', label: '女朋友 / 妻子', emoji: '💗' },
    { value: '男朋友 / 丈夫', label: '男朋友 / 丈夫', emoji: '💙' },
    { value: '父母 / 长辈', label: '父母 / 长辈', emoji: '🏡' },
    { value: '孩子 / 晚辈', label: '孩子 / 晚辈', emoji: '🎈' },
    { value: '朋友 / 好友', label: '朋友 / 好友', emoji: '🤝' },
  ],
  allowCustom: true,
  placeholder: '也可以直接告诉我 TA 是谁…',
}

import { callChatModel } from './aiService.js'

/**
 * 🌟 自由输入长文本的多槽位智能抽取器 (Multi-Slot Extractor)
 * 当用户输入了一段包含丰富信息的长文本时，自动识别并抽取所有匹配槽位，实现连跳问答
 */
export async function extractSlotsFromFreeText(text = '', currentAnswers = {}) {
  const trimmed = (text || '').trim()
  if (!trimmed || trimmed.length < 4) {
    return { slots: {}, keywords: [] }
  }

  // 🌟 1. Jev 导购前台 1ms 快速槽位解析（秒级提取，无需等待大模型网络请求）
  const quickCanvas = buildDialogStateCanvas({ ...currentAnswers, free_text: trimmed })
  const quickSlots = {}
  if (quickCanvas.recipient) quickSlots.recipient = quickCanvas.recipient
  if (quickCanvas.friend_sub_type) quickSlots.friend_sub_type = quickCanvas.friend_sub_type
  if (quickCanvas.domain && DOMAIN_KNOWLEDGE[quickCanvas.domain]) {
    quickSlots.preference_direction = DOMAIN_KNOWLEDGE[quickCanvas.domain].name
  }
  if (quickCanvas.sub_feature) quickSlots.specific_scene = quickCanvas.sub_feature
  if (quickCanvas.core_need) quickSlots.core_need = quickCanvas.core_need
  if (quickCanvas.style_tone) quickSlots.style_preference = quickCanvas.style_tone
  if (quickCanvas.budget) quickSlots.budget = quickCanvas.budget

  // 若通过 Jev 快速命中了 2 个以上核心槽位，1ms 瞬间返回，彻底避免卡顿
  if (Object.keys(quickSlots).length >= 2) {
    return { slots: quickSlots, keywords: [] }
  }

  const prompt = `你是精通送礼画像抽取的专业买手助理。
请分析用户的自由输入文本，抽取出以下维度中所有明确提到的特征槽位（未提及的设为 null）：
1. recipient: "同事 / 领导" | "女朋友 / 妻子" | "男朋友 / 丈夫" | "父母 / 长辈" | "孩子 / 晚辈" | "朋友 / 好友" | null
2. occasion: 契机（如 "升职晋升", "日常感谢", "生日祝贺", "商务答谢" 等）
3. lifestyle: 生活领域（如 "茶道养生", "运动户外", "办公美学", "差旅数码" 等）
4. activity_scene: 具体活动或起居场景（如 "办公室茶台", "周末轻徒步", "夜跑健身", "商务会议签署" 等）
5. core_need: 核心功能诉求或痛点（如 "温润滋养润喉", "轻量减负防泼水", "护颈护腰", "高效收纳" 等）
6. style_tone: 审美风格（如 "自然山系大地色", "低调内敛商务黑灰", "东方人文雅致", "极简机能" 等）
7. usage_habit: 使用习惯（如 "极简快客随手泡", "随行保温焖茶", "随身便携", "大容量分区" 等）
8. emotional_tone: 送礼分寸与情感（如 "得体大方不造成人情负担", "真挚敬谢铭记提携", "团队默契" 等）
9. budget: 预算区间（如 "¥100–300", "¥300–600", "¥600–1200", "¥1200+" 等）
10. keywords: 提取用户提到的 1~3 个极其具体的专有名词（如 ["老白茶", "普洱", "颈椎酸痛", "夜跑"] 等）

输出严格 JSON 格式：
{
  "recipient": string | null,
  "occasion": string | null,
  "lifestyle": string | null,
  "activity_scene": string | null,
  "core_need": string | null,
  "style_tone": string | null,
  "usage_habit": string | null,
  "emotional_tone": string | null,
  "budget": string | null,
  "keywords": string[]
}`

  try {
    const raw = await callChatModel(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: `【用户输入】：${trimmed}` },
      ],
      { jsonMode: true, timeout: 3500 }
    )
    if (raw) {
      const p = JSON.parse(raw)
      const slots = {}
      const rel = classifyRelationship(p.recipient || currentAnswers.recipient || '同事 / 领导')

      if (p.recipient) slots.recipient = p.recipient
      if (p.budget) slots.budget = p.budget

      if (rel === 'work') {
        if (p.occasion) slots.work_occasion = p.occasion
        if (p.lifestyle) slots.work_lifestyle = p.lifestyle
        if (p.activity_scene) slots.work_activity_scene = p.activity_scene
        if (p.core_need) slots.work_core_need = p.core_need
        if (p.style_tone) slots.work_style_tone = p.style_tone
        if (p.usage_habit) slots.work_usage_habit = p.usage_habit
        if (p.emotional_tone) slots.work_emotional_tone = p.emotional_tone
      } else {
        if (p.lifestyle) slots.preference_direction = p.lifestyle
        if (p.activity_scene) slots.specific_scene = p.activity_scene
        if (p.style_tone) slots.style_preference = p.style_tone
      }

      return { slots, keywords: Array.isArray(p.keywords) ? p.keywords : [] }
    }
  } catch (err) {
    console.warn('Slot extraction LLM fallback to rule regex:', err)
  }

  // 规则兜底快速提取
  const fallbackSlots = {}
  const keywords = []
  if (/领导|同事|上级|老板|主管/.test(trimmed)) fallbackSlots.recipient = '同事 / 领导'
  else if (/女友|老婆|妻子/.test(trimmed)) fallbackSlots.recipient = '女朋友 / 妻子'
  else if (/男友|老公|丈夫/.test(trimmed)) fallbackSlots.recipient = '男朋友 / 丈夫'
  else if (/父母|爸|妈|长辈|叔|阿姨/.test(trimmed)) fallbackSlots.recipient = '父母 / 长辈'
  else if (/孩子|娃|儿子|女儿|侄/.test(trimmed)) fallbackSlots.recipient = '孩子 / 晚辈'

  if (/升职|晋升|升迁/.test(trimmed)) fallbackSlots.work_occasion = '升职晋升 / 乔迁新起点，体面周全'
  if (/茶|泡茶|品茗|普洱|白茶|龙井|工夫茶/.test(trimmed)) {
    fallbackSlots.work_lifestyle = '茶道品茗与健康养生 / 讲究工夫茶、身心调理与慢节奏生活'
    keywords.push('茶道养生')
  }
  if (/户外|徒步|露营|跑|运动/.test(trimmed)) {
    fallbackSlots.work_lifestyle = '潮流出游与户外运动 / 喜欢轻量徒步、跑步健身与周末出游'
    keywords.push('户外运动')
  }
  if (/300|400|500|600/.test(trimmed)) {
    fallbackSlots.budget = '¥300–600 体面进阶款'
  }

  return { slots: fallbackSlots, keywords }
}

/** 选项出闸统一清洗：剥解释后缀、label 严格 10 字内、补 value/desc/emoji；不改写模型措辞 */
const cleanStr = (s) => (typeof s === 'string' ? s.trim() : '')

function cleanCandidateOption(opt) {
  let label = cleanStr(opt.label) || cleanStr(opt.value)
  // 剥离冒号、破折号或括号后的长串举例与解释，确保选项精炼干净
  label = label.replace(/[：:][^]*$/, '').replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').trim()
  if (label.includes(' / ')) label = label.split(' / ')[0].trim()
  // 严格保证在 10 个字以内
  if (label.length > 10) {
    label = label.slice(0, 10).trim()
  }
  const value = cleanStr(opt.value) || label
  const desc = cleanStr(opt.desc || opt.hint)
  return { label, value, desc, hint: desc, emoji: cleanStr(opt.emoji) }
}

/** 模型自主理解上下文并决定追问或收尾；双轨解耦：模型专注买手交流并提取特质，Jev 负责审核入槽与选项归类。 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1, currentTraits = [], answeredSteps = {}, pace = 'normal') {
  // 还原「stepId → 当轮题目与回答键」索引，把每轮实际提供的选项与用户完整选择一并交给模型，避免它凭碎片猜测
  const answeredRoundByStepId = {}
  for (const [answeredKey, answeredStep] of Object.entries(answeredSteps || {})) {
    if (answeredStep && answeredStep.id) {
      answeredRoundByStepId[answeredStep.id] = { key: answeredKey, step: answeredStep }
    }
  }

  // 格式化最近真实对话上下文：问题、当轮全部选项、用户所选选项的完整语义同屏呈现
  const historyLines = []
  for (const m of (historyMessages || [])) {
    if (!m || !m.text || m.stepId === '__done__') continue
    if (m.role === 'user') {
      const round = m.stepId ? answeredRoundByStepId[m.stepId] : null
      const offeredOptions = round && Array.isArray(round.step.options) ? round.step.options : []
      if (offeredOptions.length) {
        const offered = offeredOptions
          .map((opt, idx) => {
            const label = typeof opt?.label === 'string' ? opt.label.trim() : ''
            const value = typeof opt?.value === 'string' ? opt.value.trim() : ''
            if (!label) return ''
            return value && value !== label ? `${idx + 1}. ${label}（${value}）` : `${idx + 1}. ${label}`
          })
          .filter(Boolean)
          .join('　')
        if (offered) historyLines.push(`【AI买手提供的选项】: ${offered}`)
      }
      let userLine = `【用户】: ${m.text}`
      const answeredValue = round ? answers[round.key] : undefined
      const fullPick = Array.isArray(answeredValue) ? answeredValue.join('、') : String(answeredValue ?? '')
      if (!m.muted && fullPick && fullPick !== m.text) {
        userLine += `（完整选择：${fullPick}）`
      }
      historyLines.push(userLine)
    } else {
      historyLines.push(`${m.role === 'system' ? '【会话操作】' : '【AI买手】'}: ${m.text}`)
    }
  }
  const recentDialogHistory = historyLines.join('\n')

  let sysPrompt = `你是精通人情世故、懂生活、懂品味的资深礼物买手 GiftMind。你需要像一位善于倾听的私人顾问一样，通过自然对话理解用户真正想解决的问题，帮其理清送礼思路与合适选择。
以用户原话和最新纠正为依据，尊重明确要求，区分已知、未知与推测。追问方向、深度、表达及何时收尾由你综合对话与用户意愿判断，不按固定流程、轮数或某个字段决定。
你的任务自始至终是帮用户挑选合适的礼物（包括体验类礼物，如双人课程、活动名额、晚餐礼券等可以赠送的体验），用礼物成全体验，而不是替用户策划活动。体验类礼物只需锁定体验的类型与调性（如烛光晚餐、双人手作、短途度假这类方向），不要替用户安排活动的执行细节（何时去、在哪个城市、订哪家店、菜品与行程规划），这些留给用户自己决定。

可选参考：
1. 倾听与分歧分流：当用户提及某项爱好、生活习惯或大类目时，主动梳理可能的主流分歧方向进行分流，把选择权留给用户，切勿擅自做主下定论或默认单一方向。
2. 细致追问与严禁早收：绝不在关键信息仍停留在泛泛大类或模糊概念时草率收尾（isReady: true）。所有具体的物品种类都必须彻底确定，追问必须更加细致深入，直到把具体的细分种类、品牌或风格倾向、以及预算区间全部摸清楚，确保推荐方案精准有依据、绝不踩雷。当所送品类的品牌与品质差异会明显影响收礼体验时，还要自然摸清 TA 对品牌的态度（认固定牌子、愿意尝鲜还是只看品质）与品质期待。
3. 单次单焦点，绝不连珠炮：每轮回复有且仅聚焦一个核心决策点，严禁在同一轮里同时抛出两个或多个问题；所有发言与下方选项必须严格服务于这唯一的一个焦点，让用户一目了然、轻松好选。
4. 顺势深挖，不倒退查户口：像真人朋友聊天一样，顺着用户上一句话的线索直接往前深挖具体的物品、玩法或风格，严禁倒退回去盘问由头或重新分类。面对孩子或晚辈，绝不反复死磕具体年龄数字，直接从具体的爱好与兴趣点入手，不把聊天变成问卷调查。
5. 预算只是价格边界约束，绝非选礼决策实质，不因用户提及预算而草率结束；继续讨论能否改善选择，顺着用户诉求探讨具体偏好、痛点或风格。但预算不可缺席：收尾进确认（isReady: true）之前必须已经掌握预算区间，尚不清楚就直接开口问，早问晚问不限，话题自然时顺带问亦可。问预算时，档位设置须贴合当前已聊定品类的真实价格带——先按该品类从入门到高端的实际行情划定上下限再分档，对低价品类给天价档、对高价品类给过低档这类与行情脱节的档位都是失真的。
6. 通俗体贴与自然交流：站在送礼人日常视角，用接地气的方式交流与设置选项，不拽生僻黑话，提供贴近日常认知的选项及稳妥兜底项；语言真诚有温度，如朋友般自然启发，不设死板套话，不居高临下说教。
7. 承接选择须完整：用户点选的选项若包含多个并列要点（如"影音"中的"音"与"影"），每个要点都是后续选品要兑现的承诺；推进任一分支前，须确认其余分支已被顾及或分流给用户，不得静默丢弃其中任何一部分。
8. 这是供你权衡的思路，不是逐项完成的清单。

为了界面渲染，请返回 JSON 对象。isReady 表示是否进入确认；继续交流时 messages 为你要说的话组成的字符串数组，key 为本轮记录标识。options 为候选回答数组，请放开想到 8~10 个（多想比少想好），尽量覆盖当前方向下不同的细分方向与生活方式，相近的候选可以并存（稍后会统一归类收敛，不必自己压缩数量）；每项 label 简练易读（严格控制在 10 个字以内），严禁在选项文字后追加冒号、括号或大段举例说明；出选项前先过一道自检：本轮选项呈现的生活方式图景，是否依赖某个你尚未向用户确认的 TA 关键状态（日常节奏、人生阶段、关系分寸、使用场景等）？若该状态未知、选项只能按人群刻板印象凑齐（看似好几个方向、实则同一场景），本轮就改问该状态本身、用它的合理分档作选项，确认后再回到原题，不得把整题建立在未确认的假设上。选项依据对话中已知的关于 TA 的真实信息设置，不了解 TA 的兴趣时宁宽勿窄，「宽」指横跨不同的真实生活场景而非同一场景内堆砌多项；按性别或关系去套常见喜好比漏掉 TA 真正的爱好更糟；value 为用户选中后提交的回答文本，须完整自包含、涵盖该选项要表达的全部要点，可附 emoji。type 默认一律 single：绝大多数决策点选一个就够；只有"多个并列要素确需同时成立"时才可用 multi（拿不准就宁拆成先后两轮单选，也别轻易一次多选），适合直接描述细节时用 text。内容、数量和组织方式由你决定。options_need_explain 仅当本轮选项是并列的具体品牌、型号或款式名（用户需要先弄清差异才好下手选）时为 true，界面会据此附加一个"讲讲区别"讲解入口；方向类、程度类、场景类等常规选项一律不填或置 false。`

  // 🌟 加速模式：用户主动要求加快进度时，只问关键项并尽快收敛进确认页
  if (pace === 'fast') {
    sysPrompt += `
当前为加速模式：用户明确要求加快进度。跳过细枝末节，只追问对选礼不可或缺的关键信息（核心方向与预算边界），已有信息不重复确认；信息足够时立即收敛进确认页（isReady: true）。`
  }

  const userContent = `【完整对话记录】
${recentDialogHistory || '（刚开始对话）'}

【当前回答原文】
${JSON.stringify(answers, null, 2)}

回答保留动态字段、未知和跳过；确认页修改后的值以当前回答为准。请继续这段对话。`

  try {
    const raw = await callChatModel(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ],
      // 🌟 第一阶段：高温多想——放开出 8~10 个候选，保覆盖、保灵气
      { jsonMode: true, temperature: 1.0, top_p: 0.95, timeout: 35000 }
    )

    if (raw) {
      const parsed = JSON.parse(raw)

      if (parsed.isReady === true) {
        return {
          isReady: true,
          extracted_traits: (parsed.extracted_traits && typeof parsed.extracted_traits === 'object') ? parsed.extracted_traits : {},
          suggested_domain: typeof parsed.suggested_domain === 'string' ? parsed.suggested_domain : '',
        }
      }

      // 🌟 第二阶段：Jev 快决策归类——成对判定"是否同一类该合并"，全程只调一次大模型；失败不阻断，退回原始候选
      const candidates = Array.isArray(parsed.options) ? parsed.options : []
      if (pace !== 'fast' && candidates.length >= 5) {
        try {
          parsed.options = await clusterOptionsByJev(candidates, userContent)
        } catch (clusterErr) {
          console.warn('[AI Question Engine] Jev 选项归类失败，使用原始候选:', clusterErr?.message || clusterErr)
        }
      }

      // 只校验可显示的类型，不改写模型措辞。
      const cleanedMessages = (Array.isArray(parsed.messages) ? parsed.messages : [parsed.messages])
        .map(cleanStr)
        .filter(Boolean)

      // 保留每次实际回答，包括未知和跳过，避免同名问题覆盖记录。
      const rawKey = typeof parsed.key === 'string' && parsed.key.trim() ? parsed.key.trim() : `dimension_${stepIndex}`
      let finalKey = rawKey
      let suffix = stepIndex
      while (Object.prototype.hasOwnProperty.call(answers, finalKey)) finalKey = `${rawKey}_${suffix++}`

      const cleanedOptions = (Array.isArray(parsed.options) ? parsed.options : [])
        .filter((opt) => opt && typeof opt === 'object')
        .map(cleanCandidateOption)
        .filter((opt) => opt.label && opt.value)
      // 封顶 6 个，但"其他/自定义"兜底项永不被挤掉
      const options = capOptionsWithCustomGuard(cleanedOptions, 6)
      // 仅当模型自标记"并列品牌/型号/款式"时附讲解入口：选中不提交答案，让 DS 讲完区别后用户回头再选
      const isMulti = parsed.type === 'multi'
      if (parsed.options_need_explain === true && !isMulti && options.length) {
        options.push({ ...EXPLAIN_OPTION, desc: '', hint: '' })
      }

      if (cleanedMessages.length) {
        return {
          id: `dynamic_step_${stepIndex}_${Date.now()}`,
          stage: parsed.stage || 'preference',
          key: finalKey,
          type: options.length && parsed.type !== 'text' ? (parsed.type === 'multi' ? 'multi' : 'single') : 'text',
          messages: cleanedMessages,
          options,
          allowCustom: true,
          placeholder: '也可以直接输入具体细节…',
          fact_basis: parsed.fact_basis || '',
          decision_purpose: parsed.decision_purpose || '',
          target_dimension: parsed.target_dimension || finalKey,
          extracted_traits: (parsed.extracted_traits && typeof parsed.extracted_traits === 'object') ? parsed.extracted_traits : {},
          suggested_domain: typeof parsed.suggested_domain === 'string' ? parsed.suggested_domain : '',
          suggested_slots: Array.isArray(parsed.suggested_slots) ? parsed.suggested_slots : [],
        }
      }
    }
    throw new Error('AI 返回数据格式不完整')
  } catch (err) {
    console.error('[AI Question Engine Error]:', err)
    throw new Error(`本轮回复未能完成：${err.message || '请重试'}`)
  }
}

/**
 * 💡 选项讲解：用户点"讲讲区别"后，基于当前题目、选项与已收集信息生成一段讲解。
 * 只生成讲解文本，不改变答题状态；讲解会作为 AI 消息留在对话历史里，
 * 后续出题模型看到"已讲过区别"自然不会重复讲。
 */
export async function explainOptionsForStep(step = {}, answers = {}) {
  const question = (Array.isArray(step.messages) ? step.messages : [])
    .filter((t) => typeof t === 'string' && t.trim())
    .join('\n')
  const optionLines = (Array.isArray(step.options) ? step.options : [])
    .filter((opt) => opt && opt.value && opt.value !== EXPLAIN_OPTION_VALUE)
    .map((opt, idx) => {
      const label = typeof opt.label === 'string' && opt.label.trim() ? opt.label.trim() : String(opt.value)
      const value = String(opt.value || '').trim()
      return value && value !== label ? `${idx + 1}. ${label}（${value}）` : `${idx + 1}. ${label}`
    })
  if (!optionLines.length) return ''

  const known = Object.entries(answers || {})
    .filter(([, v]) => (Array.isArray(v) ? v.length : v && String(v).trim()))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('、') : String(v)}`)
    .join('\n')

  const sysPrompt = '你是 GiftMind 礼物顾问。用户在一道选择题上点了"讲讲区别"，希望你把每个选项讲清楚，帮他理解后再做选择。'
  const userContent = `【题目】
${question || '（接上文）'}

【选项】
${optionLines.join('\n')}

【已知的收礼人信息】
${known || '（暂无）'}

请自然口语地讲 2~4 段话：每个选项是什么、核心区别在哪、各适合什么样的收礼人，最后可以给出你的倾向建议，但要明确最终决定权在用户。不要替用户拍板，不要反问新问题，讲完就停。300 字以内。`

  try {
    const raw = await callChatModel(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ],
      { timeout: 20000 }
    )
    return typeof raw === 'string' ? raw.trim() : ''
  } catch (err) {
    console.warn('[Explain Options] 讲解生成失败:', err?.message || err)
    return ''
  }
}
