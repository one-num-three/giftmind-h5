/**
 * ══════════════════════════════════════════════════════════════
 *  深度 AI 动态出题引擎 (Deep Multi-Layer Consultative Engine v5.0)
 *  传递真实对话和参考信息；追问内容、顺序与收尾均由模型决定。
 * ══════════════════════════════════════════════════════════════
 */
import { classifyRelationship } from '../utils/relationship.js'
import { routeNextDecision, buildDialogStateCanvas, DOMAIN_KNOWLEDGE, evaluateJevSystemOne } from '../services/jevEngine.js'

export { classifyRelationship, routeNextDecision, buildDialogStateCanvas, evaluateJevSystemOne }

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

import { callMiMo } from './mimoService.js'

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
    const raw = await callMiMo(
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

/** 模型自主理解上下文并决定追问或收尾；双轨解耦：模型专注买手交流并提取特质，Jev 负责审核入槽。 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1, currentTraits = []) {
  // 格式化最近真实对话上下文（让大模型完整看见上一轮出了哪些具体选项）
  const recentDialogHistory = (historyMessages || [])
    .filter((m) => m && m.text && m.stepId !== '__done__')
    .map((m) => `${m.role === 'user' ? '【用户】' : m.role === 'system' ? '【会话操作】' : '【AI买手】'}: ${m.text}`)
    .join('\n')

  const sysPrompt = `你是 GiftMind，一位善于倾听、懂得选礼的私人顾问。通过自然对话理解用户真正想解决的问题，帮助其作出合适的选择。
以用户原话和最新纠正为依据，尊重明确要求，区分已知、未知与推测。追问方向、深度、表达及何时收尾由你综合对话与用户意愿判断，不按固定流程、轮数或某个字段决定。

可选参考：
1. 预算只是价格边界约束，绝非选礼决策实质，不因用户提及预算而草率结束；继续讨论能否改善选择，顺着爱好生活深挖装备现状、使用场景或痛点风格。
2. 提问切入关键决策分歧，只问送礼人日常肉眼可见的事实，不问生僻黑话；选项提供贴近日常认知的选项及稳妥兜底项。
3. 这是供你权衡的思路，不是逐项完成的清单。

为了界面渲染，请返回 JSON 对象。isReady 表示是否进入确认；继续交流时 messages 为你要说的话组成的字符串数组，key 为本轮记录标识。options 为可选回答数组，数量适中（约三四个）；每项 label 必须极其精简（严格控制在 10 个字以内，如 "复古金属细手链"、"小巧设计感耳饰"），严禁在选项文字后追加冒号、括号或大段举例说明；value 为用户选中后提交的回答文本，可附 emoji。type 可为 single、multi 或 text。内容、数量和组织方式由你决定。`

  const userContent = `【完整对话记录】
${recentDialogHistory || '（刚开始对话）'}

【当前回答原文】
${JSON.stringify(answers, null, 2)}

回答保留动态字段、未知和跳过；确认页修改后的值以当前回答为准。请继续这段对话。`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userContent },
      ],
      { jsonMode: true, temperature: 0.85, top_p: 0.95, timeout: 35000 }
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

      // 只校验可显示的类型，不改写模型措辞。
      const cleanStr = (s) => (typeof s === 'string' ? s.trim() : '')
      const cleanedMessages = (Array.isArray(parsed.messages) ? parsed.messages : [parsed.messages])
        .map(cleanStr)
        .filter(Boolean)

      // 保留每次实际回答，包括未知和跳过，避免同名问题覆盖记录。
      const rawKey = typeof parsed.key === 'string' && parsed.key.trim() ? parsed.key.trim() : `dimension_${stepIndex}`
      let finalKey = rawKey
      let suffix = stepIndex
      while (Object.prototype.hasOwnProperty.call(answers, finalKey)) finalKey = `${rawKey}_${suffix++}`

      const options = (Array.isArray(parsed.options) ? parsed.options : [])
        .filter((opt) => opt && typeof opt === 'object')
        .map((opt) => {
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
        })
        .filter((opt) => opt.label && opt.value)
        .slice(0, 4)

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
 * 🌟 程序安全护栏：关系与伦理合规过滤
 */

export function filterOptionsByRelationshipGuardrails(options = [], rel = 'friend') {
  if (!Array.isArray(options)) return []
  return options.filter((opt) => {
    const text = `${opt.value} ${opt.label}`
    if (rel === 'work') {
      // 职场送礼护栏：坚决过滤私密、情侣、暧昧词汇与物品
      if (/情侣|睡衣|内衣|唇膏|口红|爱意|亲吻|宝贝|亲爱的|前男友|前女友|贴身/.test(text)) return false
    }
    if (rel === 'junior') {
      // 晚辈/孩子送礼护栏：坚决过滤成人向、饮酒、香烟、恋爱
      if (/烈酒|白酒|香烟|烟草|情趣|前任|失恋|打火机|职场升迁/.test(text)) return false
    }
    if (rel === 'elder') {
      // 长辈送礼护栏：过滤高危极限运动或高门槛极客黑话
      if (/夜店|极客超频|电竞上分|蹦极|跳伞/.test(text)) return false
    }
    return true
  })
}

/**
 * 🌟 程序安全护栏：标准预算确认收敛题
 */
export function getBudgetGuardrailStep(rel = 'friend') {
  let messages = ['需求画像已经越来越立体清晰了！顺便确认一下你的预算预期，我们在最合适的区间内精挑细选：']
  let options = [
    { value: '¥100–300 轻巧心意款', label: '¥100–300 轻巧心意款', emoji: '🌱' },
    { value: '¥300–600 品质进阶款', label: '¥300–600 品质进阶款', emoji: '✨' },
    { value: '¥600–1200 标杆重磅款', label: '¥600–1200 标杆重磅款', emoji: '👑' },
    { value: '¥1200 以上 顶配尊享款', label: '¥1200 以上 顶配尊享款', emoji: '💎' },
  ]
  if (rel === 'work') {
    messages = ['确认一下职场送礼的预算范围，我们在最得体的分寸内挑选既有面子又不显唐突的品质好物：']
    options = [
      { value: '¥200–400 轻松得体款', label: '¥200–400 轻松得体款', emoji: '🤝' },
      { value: '¥400–800 体面进阶款', label: '¥400–800 体面进阶款', emoji: '👔' },
      { value: '¥800–1500 尊崇重礼款', label: '¥800–1500 尊崇重礼款', emoji: '👑' },
      { value: '¥1500 以上 顶级商务款', label: '¥1500 以上 顶级商务款', emoji: '💎' },
    ]
  }
  return {
    id: 'guardrail_step_budget',
    stage: 'shape',
    key: 'budget',
    type: 'single',
    messages,
    options,
    allowCustom: true,
  }
}

/**
 * 🌟 万能反射式自适应追问（Universal Reflective Engine）
 * 彻底铲除 ifelse 决策树！不再有写死的品类路由，而是动态反射提炼用户输入的核心关键词：
 * 永远围绕用户所提之物展开，绝不跳戏，绝不跑偏！
 */
export function getUniversalReflectiveStep(answers = {}, stepIndex = 1) {
  const recipient = answers.recipient || 'TA'
  const rel = classifyRelationship(recipient)

  if (stepIndex >= 5 || answers.budget) {
    return getBudgetGuardrailStep(rel)
  }

  // 提取用户前序所有的真实输入词汇
  const textEntries = Object.entries(answers).filter(([k]) => k !== 'recipient')
  const lastEntry = textEntries[textEntries.length - 1]
  const lastVal = lastEntry ? String(lastEntry[1]) : ''

  // 提取最具辨识度的短词（1~6个字）
  let coreTerm = 'TA 的兴趣偏好'
  const matches = lastVal.match(/[\u4e00-\u9fa5a-zA-Z0-9]{2,8}/g)
  if (matches && matches.length > 0) {
    const valid = matches.filter(w => !/喜欢|平时|希望|可以|想要|送给|觉得|一般|或者|进行|这个|那个/.test(w))
    if (valid.length > 0) {
      coreTerm = valid[0]
    }
  }

  // 步步深入通用递进维度（场景 -> 痛点 -> 质感 -> 情感 -> 预算）
  if (stepIndex <= 2) {
    return {
      id: `reflective_step_${stepIndex}_core_dimension`,
      stage: 'preference',
      key: `reflective_core_dimension_${stepIndex}`,
      type: 'single',
      messages: [`围绕${recipient}平时对${coreTerm}的爱好与习惯，你更希望这份心意侧重哪个核心方向？`],
      options: [
        { value: '专业进阶装备', label: '专业进阶装备', desc: '做工精良、提升把玩体验与专业水准', hint: '提升把玩体验与专业水准', emoji: '⚡' },
        { value: '轻便随身好上手', label: '轻巧省心上手', desc: '零门槛好上手、舒适减负耐用', hint: '零门槛好上手、舒适减负耐用', emoji: '🎒' },
        { value: '成果珍藏纪念', label: '专属心意定格', desc: '把热爱制作成看得见的心意留存', hint: '把热爱制作成看得见的心意留存', emoji: '🖼️' },
        { value: '不太清楚 / 没留意', label: '不太清楚 / 没留意', desc: '这个细节暂时不了解，可以换个角度聊', hint: '这个细节暂时不了解，可以换个角度聊', emoji: '🤷' },
      ],
      allowCustom: true,
      placeholder: `也可以直接告诉我 TA 对${coreTerm}的具体要求…`,
    }
  }

  if (stepIndex === 3) {
    return {
      id: `reflective_step_${stepIndex}_pain_point`,
      stage: 'story',
      key: `reflective_pain_point_${stepIndex}`,
      type: 'single',
      messages: [`在体验${coreTerm}这件事上，你最希望帮 TA 解决或改善的是什么？`],
      options: [
        { value: '提升舒适度与减负', label: '舒适减负健康', desc: '使用更顺手省心、不累人更健康', hint: '使用更顺手省心、不累人更健康', emoji: '💆' },
        { value: '进阶高阶专业性能', label: '进阶专业性能', desc: '做工与性能更上一层楼，满足进阶挑剔品味', hint: '做工与性能更上一层楼', emoji: '⚡' },
        { value: '开箱即用极简友好', label: '开箱即用友好', desc: '零复杂学习门槛，开箱即用省心', hint: '零复杂学习门槛，开箱即用省心', emoji: '💡' },
        { value: '不太清楚 / 没留意', label: '不太清楚 / 没留意', desc: '这个细节暂时不了解，可以换个角度聊', hint: '这个细节暂时不了解，可以换个角度聊', emoji: '🤷' },
      ],
      allowCustom: true,
      placeholder: '也可以直接输入你最想帮 TA 改善的细节…',
    }
  }

  if (stepIndex === 4) {
    return {
      id: `reflective_step_${stepIndex}_aesthetic`,
      stage: 'shape',
      key: `reflective_aesthetic_${stepIndex}`,
      type: 'single',
      messages: ['在审美风格、材质调性与做工用料上，你觉得哪种最契合 TA 的气质？'],
      options: [
        { value: '经典沉稳高质感', label: '经典沉稳质感', desc: '用料扎实考究、低调内敛耐用', hint: '用料扎实考究、低调内敛耐用', emoji: '🏆' },
        { value: '现代简约机能风', label: '现代极简机能', desc: '线条利落，强调实用主义与科技美感', hint: '强调实用主义与科技美感', emoji: '📐' },
        { value: '自然温润人文风', label: '自然温润人文', desc: '触感温和细腻，带有人文温度与自然气息', hint: '触感细腻有自然温度', emoji: '🌿' },
        { value: '不太清楚 / 没留意', label: '不太清楚 / 没留意', desc: '这个细节暂时不了解，可以换个角度聊', hint: '这个细节暂时不了解，可以换个角度聊', emoji: '🤷' },
      ],
      allowCustom: true,
    }
  }

  // 第 5 步：情感共鸣
  return {
    id: `reflective_step_${stepIndex}_feeling`,
    stage: 'shape',
    key: `reflective_feeling_${stepIndex}`,
    type: 'single',
    messages: [`送出这份关于${coreTerm}的心意，你最希望 TA 拆开那一刻感受到什么？`],
    options: [
      { value: '惊喜与被懂得 / 感叹“你怎么知道我平时最需要/最喜欢这个”', label: '被深刻懂得 / 惊喜会心一笑', emoji: '💖' },
      { value: '体贴与温情陪伴 / 无论何时使用，都能切身感受到这份踏实的在乎', label: '贴心踏实在乎 / 长久温情陪伴', emoji: '🛋️' },
      { value: '纯粹快乐与放松 / 卸下一身疲惫，享受属于自己的纯粹欢乐', label: '纯粹快乐释放 / 卸下生活疲劳', emoji: '🎈' },
    ],
    allowCustom: true,
  }
}

/**
 * 深度问答多层决策树
 */
export function getAdaptiveDeepStep(answers, stepIndex) {
  const recipient = answers.recipient || 'TA'
  const rel = classifyRelationship(recipient)
  const allAnswerText = Object.values(answers).join(' ')

  // ══════════════════════════════════════════════════════════
  //  1. 职场路径：同事 / 领导 / 上司 / 客户 (7~8 步深度多维参数下钻)
  // ══════════════════════════════════════════════════════════
  if (rel === 'work') {
    // 【第 1 题】：职场场景契机与分寸
    if (!answers.work_occasion && stepIndex === 1) {
      return {
        id: 'work_step_1_occasion',
        stage: 'discover',
        key: 'work_occasion',
        type: 'single',
        messages: [`给职场中的 ${recipient} 选礼，最核心的场景契机是什么？`],
        options: [
          { value: '升职晋升 / 乔迁转岗，祝贺阶段性成就与新起点', label: '升职转岗 / 祝贺成就与新起点', emoji: '🎉' },
          { value: '答谢提携与指导，表达真挚感谢与职场敬意', label: '答谢提携 / 表达真挚敬意与支持', emoji: '🤝' },
          { value: '商务拜访 / 节日礼敬，讲究体面得体不越界', label: '商务礼敬 / 体面大方有分寸', emoji: '🏮' },
          { value: '团队生日 / 退休荣休，纪念共同奋斗的珍贵时光', label: '生日荣休 / 纪念团队奋斗时光', emoji: '🎂' },
          { value: '日常协作感谢 / 轻松有品质感，不造成人情负担', label: '日常感谢 / 轻松实用不添负担', emoji: '☕' },
        ],
        allowCustom: true,
        placeholder: '也可以直接说明具体的职场送礼场景…',
      }
    }

    // 【第 2 题】：生活方式与调性大方向
    if (!answers.work_lifestyle && (stepIndex === 2 || !answers.work_activity_scene)) {
      return {
        id: 'work_step_2_lifestyle',
        stage: 'preference',
        key: 'work_lifestyle',
        type: 'single',
        messages: ['TA 在平时的工作与闲暇生活中，更倾向哪种品味调性？'],
        options: [
          { value: '潮流出游与户外运动 / 喜欢轻量徒步、跑步健身与周末出游', label: '运动户外 / 健身出游与阳光活力', emoji: '⛰️' },
          { value: '茶道品茗与健康养生 / 讲究工夫茶、身心调理与慢节奏生活', label: '茶道养生 / 工夫茶与身心调理', emoji: '🍵' },
          { value: '办公桌面与商务美学 / 讲究桌面质感、精良文具与高效办公', label: '办公美学 / 质感桌面与精良文具', emoji: '🖋️' },
          { value: '差旅出行与品质数码 / 经常出差出行、看重轻量便携与实用装备', label: '差旅出行 / 轻量便携与实用装备', emoji: '🧳' },
        ],
        allowCustom: true,
        placeholder: '可以补充领导/同事平时的个人爱好…',
      }
    }

    // 【第 3 题】：具体活动场景下钻（Sub-Scenario）
    if (!answers.work_activity_scene && stepIndex === 3) {
      if (/户外|运动|探险|出游|健身/.test(allAnswerText)) {
        return {
          id: 'work_step_3_outdoor_scenario',
          stage: 'preference',
          key: 'work_activity_scene',
          type: 'single',
          messages: ['在户外与运动方向上，TA 平时更常参与或计划哪类具体活动？'],
          options: [
            { value: '城市轻徒步 / 周末近郊露营与自然放空', label: '轻徒步露营 / 周末近郊自然放空', emoji: '🏕️' },
            { value: '日常通勤出街 / 晨跑夜跑与健身房运动', label: '日常通勤健身 / 跑步出街运动', emoji: '🏃' },
            { value: '短途自驾游 / 探索周边小众山野风景', label: '周边自驾游 / 短途山野探索', emoji: '🚗' },
            { value: '休闲球类运动 / 羽毛球、网球等轻度运动', label: '休闲球类 / 网羽健身运动', emoji: '🏸' },
          ],
          allowCustom: true,
          placeholder: '可以写写 TA 具体的周末运动习惯…',
        }
      }

      if (/茶道|品茗|养生|工夫茶|健康/.test(allAnswerText)) {
        return {
          id: 'work_step_3_tea_scenario',
          stage: 'preference',
          key: 'work_activity_scene',
          type: 'single',
          messages: ['在茶道与养生起居上，TA 平时更倾向哪种具体的品茗与调养场景？'],
          options: [
            { value: '办公室茶台静心品茗 / 伏案工作间隙泡工夫茶提神', label: '办公室茶台 / 伏案间隙工夫茶', emoji: '🍵' },
            { value: '居家私享与茶友雅聚 / 慢品名茶、享受静谧生活', label: '居家品茗 / 慢品好茶与闲适', emoji: '🫖' },
            { value: '长期伏案身体舒缓 / 颈椎腰背肌肉酸痛需要深层放松', label: '身体舒缓 / 伏案腰颈深层放松', emoji: '💆' },
            { value: '日常温和调养 / 保温润喉、注重四季养生饮品', label: '温饮润喉 / 日常养生调理', emoji: '🌿' },
          ],
          allowCustom: true,
        }
      }

      if (/桌面|美学|办公|文具/.test(allAnswerText)) {
        return {
          id: 'work_step_3_desk_scenario',
          stage: 'preference',
          key: 'work_activity_scene',
          type: 'single',
          messages: ['在办公环境与工作日常中，TA 最核心的使用场景是哪一类？'],
          options: [
            { value: '高频商务签署与重要会议 / 注重书写手感与沉稳气场', label: '商务签署会议 / 沉稳书写手感', emoji: '🖋️' },
            { value: '工位桌面整洁与充电 / 告别杂乱线材、追求高质感工位', label: '工位整洁美学 / 极简无线充电', emoji: '⚡' },
            { value: '私密办公室氛围调节 / 喜欢沉静木质香气与专注气场', label: '办公氛围调节 / 沉静木质香薰', emoji: '🪵' },
            { value: '高效多设备协作 / 笔记本与随身文具随时收纳转场', label: '多设备协同 / 便携质感收纳', emoji: '📁' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'work_step_3_travel_scenario',
        stage: 'preference',
        key: 'work_activity_scene',
        type: 'single',
        messages: ['在差旅与出行节奏上，TA 最主要的出行特点是？'],
        options: [
          { value: '2-3天高频商务出差 / 需要极简登机、免托运快速转场', label: '短途高频出差 / 免托运极简登机', emoji: '✈️' },
          { value: '日常背电脑跨部门穿梭 / 需要挺括防泼水减压背包', label: '日常通勤背电脑 / 挺括减压背包', emoji: '🎒' },
          { value: '长途差旅或度假 / 看重箱体抗摔静音万向轮与大容量', label: '长途差旅度假 / 静音大容量旅行箱', emoji: '🧳' },
          { value: '差旅途中的生活记录 / 喜欢随手定格风土人情与重要瞬间', label: '差旅生活记录 / 定格人文瞬间', emoji: '📷' },
        ],
        allowCustom: true,
      }
    }

    // 【第 4 题】：核心痛点与功能诉求（Functional Demand / Core Need）
    if (!answers.work_core_need && stepIndex === 4) {
      if (/户外|运动|探险|出游/.test(allAnswerText)) {
        return {
          id: 'work_step_4_outdoor_need',
          stage: 'story',
          key: 'work_core_need',
          type: 'single',
          messages: ['在户外装备与运动配件上，你觉得 TA 最看重或目前最欠缺的核心功能诉求是什么？'],
          options: [
            { value: '极致轻量化与减负防泼水 / 背负舒适透气、不压双肩', label: '轻量减负防泼水 / 透气不压肩', emoji: '🎒' },
            { value: '烈日遮阳防护与透气 / 户外防晒、吸汗快干、随性百搭', label: '烈日防晒遮阳 / 吸汗透气百搭', emoji: '🧢' },
            { value: '旅途记录与仪式感 / 定格自然风光与出游精彩瞬间', label: '影像记录仪式感 / 定格自然风光', emoji: '📷' },
            { value: '运动补水与体能舒缓 / 长效保温保冷水壶或肌肉放松', label: '补水温饮舒缓 / 运动后体能恢复', emoji: '💧' },
          ],
          allowCustom: true,
          placeholder: '可以补充 TA 目前在户外装备上的具体痛点…',
        }
      }

      if (/茶道|品茗|养生|健康/.test(allAnswerText)) {
        return {
          id: 'work_step_4_tea_need',
          stage: 'story',
          key: 'work_core_need',
          type: 'single',
          messages: ['在茶道品鉴与养生调理上，哪种核心价值最能击中 TA 的实际需求？'],
          options: [
            { value: '名山古树茶韵底蕴 / 传统纯正工艺，体面大气、显品位', label: '传统名山底蕴 / 体面尊崇纯正茶韵', emoji: '🍵' },
            { value: '便携好上手不繁琐 / 办公室出差随时一键泡出好茶', label: '便携一键好上手 / 随时静心泡茶', emoji: '🫖' },
            { value: '直击肩颈肌肉疲劳 / 专业推拿揉捏，彻底卸下一身僵硬', label: '深层理疗推拿 / 彻底卸下肌肉酸痛', emoji: '💆' },
            { value: '温和滋养调理身体 / 温润滋补润喉，适合常年用嗓人士', label: '温和滋补润喉 / 适合伏案用嗓', emoji: '🌿' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'work_step_4_office_need',
        stage: 'story',
        key: 'work_core_need',
        type: 'single',
        messages: ['在办公好物与工作配件上，最需要满足哪种核心细节诉求？'],
        options: [
          { value: '沉稳手感与顺滑签署 / 商务场合掏出来不失体面与分寸', label: '沉稳书写签署 / 商务场合大方体面', emoji: '🖋️' },
          { value: '极简整洁与高效协同 / 告别杂乱、桌面视觉清爽利落', label: '极简整洁高效 / 告别杂乱桌面', emoji: '⚡' },
          { value: '经久耐用质感出众 / 皮质金属用料扎实、越用越有韵味', label: '扎实质感耐用 / 经得起长期使用', emoji: '📁' },
          { value: '舒缓焦虑营造专注氛围 / 沉静香气让人心情平静沉稳', label: '沉静香气舒缓 / 营造专注气场', emoji: '🪵' },
        ],
        allowCustom: true,
      }
    }

    // 【第 5 题】：审美风格与材质调性（Aesthetic & Style）
    if (!answers.work_style_tone && stepIndex === 5) {
      return {
        id: 'work_step_5_style_tone',
        stage: 'story',
        key: 'work_style_tone',
        type: 'single',
        messages: ['TA 平时的个人物品、穿搭与审美偏向哪种风格调性？'],
        options: [
          { value: '极简黑灰机能风 / 低调硬朗、沉稳干练，不浮夸', label: '极简沉稳风 / 低调硬朗干练', emoji: '🕶️' },
          { value: '经典商务与品质感 / 讲究材质挺括、质感出众、体面周全', label: '经典商务品质 / 挺括体面考究', emoji: '💼' },
          { value: '自然山系与大地色 / 舒适随性、讲究生活调性与松弛感', label: '自然山系生活 / 松弛舒适调性', emoji: '🍃' },
          { value: '东方雅致与人文底蕴 / 偏好传统茶道、文房与沉静木质感', label: '东方人文雅致 / 传统韵味底蕴', emoji: '🪵' },
        ],
        allowCustom: true,
        placeholder: '可以补充 TA 喜欢的颜色或品牌风格…',
      }
    }

    // 【第 6 题】：使用习惯、便携度与规格考量（Usage Habit & Portability - 严格按品类分支）
    if (!answers.work_usage_habit && stepIndex === 6) {
      if (/茶道|品茗|养生|工夫茶|健康/.test(allAnswerText)) {
        return {
          id: 'work_step_6_tea_habit',
          stage: 'story',
          key: 'work_usage_habit',
          type: 'single',
          messages: ['在日常泡茶或养生起居的使用习惯上，哪种形态更契合 TA 的节奏？'],
          options: [
            { value: '办公室极简快客杯或小罐茶 / 随手冲泡出汤、简单省心不繁琐', label: '极简快客随手泡 / 简单省心', emoji: '🫖' },
            { value: '整套茶席功夫茶具 / 注重品茗仪式感、适合在办公室静心待客', label: '工夫茶席套组 / 仪式感待客', emoji: '🍵' },
            { value: '温润随行保温/焖茶杯 / 随时随地喝上一口温度适宜的润喉好茶', label: '随行温饮焖茶 / 随时润喉', emoji: '🌿' },
            { value: '极简一键即享 / 无需复杂门槛与繁琐收拾，上手即享健康', label: '一键即享 / 无繁琐收拾门槛', emoji: '⚡' },
          ],
          allowCustom: true,
        }
      }

      if (/桌面|美学|办公|文具/.test(allAnswerText)) {
        return {
          id: 'work_step_6_desk_habit',
          stage: 'story',
          key: 'work_usage_habit',
          type: 'single',
          messages: ['在办公好物的日常使用习惯与摆放上，你更看重哪类细节？'],
          options: [
            { value: '极简整洁不占地 / 规整桌面空间，保持工位视觉利落', label: '极简不占地 / 保持桌面清爽', emoji: '⚡' },
            { value: '随身便携随时签署 / 方便带去各种会议或商务谈判场合', label: '随身便携 / 会议谈判随时用', emoji: '🖋️' },
            { value: '常驻工位沉稳质感 / 摆在桌上兼具实用性与高档审美', label: '常驻工位 / 兼具质感与美学', emoji: '🪵' },
            { value: '经久耐用免维护 / 扎实用料，经得起每天高频使用', label: '经久耐用 / 经得起每天高频用', emoji: '🛡️' },
          ],
          allowCustom: true,
        }
      }

      if (/差旅|出行/.test(allAnswerText)) {
        return {
          id: 'work_step_6_travel_habit',
          stage: 'story',
          key: 'work_usage_habit',
          type: 'single',
          messages: ['在差旅与出行装备的日常使用中，你最看重哪方面的便利性？'],
          options: [
            { value: '免托运极简登机规格 / 快速通过安检与转场，轻快利落', label: '免托运登机 / 快速转场利落', emoji: '✈️' },
            { value: '独立电脑仓与减压背负 / 保护电子设备、长时间背负不酸痛', label: '电脑仓防震 / 减压背负舒适', emoji: '🎒' },
            { value: '静音耐磨顺滑万向轮 / 各种路面平稳推行、安静省力', label: '静音耐磨万向轮 / 推行顺滑省力', emoji: '🧳' },
            { value: '防泼水耐脏易打理 / 雨雪天气出行无忧、一擦即净', label: '防泼水耐脏 / 出行省心无忧', emoji: '🛡️' },
          ],
          allowCustom: true,
        }
      }

      // 运动户外
      return {
        id: 'work_step_6_outdoor_habit',
        stage: 'story',
        key: 'work_usage_habit',
        type: 'single',
        messages: ['在户外与运动装备的实际使用中，你更看重哪方面的细节考量？'],
        options: [
          { value: '轻便随身不占空间 / 日常轻装出行、方便随时随地取用', label: '轻量便携不占地 / 随身取用方便', emoji: '🪶' },
          { value: '大容量与多隔层收纳 / 能容纳水壶、毛巾与换洗衣物等装备', label: '大容量多隔层 / 装备收纳清晰', emoji: '🎒' },
          { value: '耐磨防泼水易打理 / 材质结实经久耐用，无需繁琐维护保养', label: '耐脏耐用易打理 / 经久省心', emoji: '🛡️' },
          { value: '透气排汗体感舒适 / 运动出汗不闷热、亲肤快干', label: '透气排汗 / 运动清爽不闷热', emoji: '🍃' },
        ],
        allowCustom: true,
      }
    }

    // 【第 7 题】：情感传达重点与送礼分寸（Emotional Tone & Boundary）
    if (!answers.work_emotional_tone && stepIndex === 7) {
      return {
        id: 'work_step_7_emotional_tone',
        stage: 'shape',
        key: 'work_emotional_tone',
        type: 'single',
        messages: ['这次送礼，最希望在人情交往与职场分寸上给对方传达什么感觉？'],
        options: [
          { value: '得体大方有分寸 / 既有生活品质感，又绝对不造成任何心理人情负担', label: '得体大方 / 不造成人情负担', emoji: '🤝' },
          { value: '真挚感谢与敬意 / 感谢过往的悉心指导与提携关照，铭记于心', label: '真挚敬谢 / 铭记指导提携', emoji: '💌' },
          { value: '团队并肩作战的默契 / 见证共同攻坚克难的岁月，未来继续同行', label: '团队默契 / 见证共同奋斗', emoji: '👥' },
          { value: '尊崇与阶段性祝贺 / 彰显阶段性成就与地位，礼面周全尊贵', label: '尊崇祝贺 / 彰显成就礼面周全', emoji: '🏆' },
        ],
        allowCustom: true,
      }
    }

    // 【第 8 题】：预算区间与方案收敛（Budget）
    return {
      id: 'work_step_8_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['最后确认一下预算区间，我将根据以上 7 个维度的详细信息，从官方正品库中精确定位 3 套职场得体方案并定制得体贺信：'],
      options: [
        { value: '¥100–300 贴心分寸款（如 优质茶礼/轻量双肩包/棒球帽/温饮礼）', label: '¥100–300 贴心分寸款', emoji: '🌱' },
        { value: '¥300–600 品质体面款（如 20英寸旅行箱/专业理疗半日/工夫茶具）', label: '¥300–600 品质体面款', emoji: '✨' },
        { value: '¥600–1200 尊享体面重磅礼（如 深度茶礼/高端商务定制）', label: '¥600–1200 尊享重磅礼', emoji: '🎁' },
        { value: '¥1200 以上 商务奢享大礼', label: '¥1200 以上 商务奢享', emoji: '👑' },
      ],
      allowCustom: true,
    }
  }

  // ══════════════════════════════════════════════════════════
  //  2. 孩子 / 晚辈 专属深度路径 (7~8 步下钻)
  // ══════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════
  //  2. 孩子 / 晚辈 专属深度路径 (7~8 步下钻，全领域自适应不偏离)
  // ══════════════════════════════════════════════════════════
  if (rel === 'junior') {
    const isGaming = /游戏|电竞|掌机|switch|桌游|主机|体感|steam|电玩|开黑/.test(allAnswerText)
    const isMech = /潮玩|动漫|模型|机甲|拼装|手办|乐高|高达|拼搭|积木/.test(allAnswerText)
    const isPhoto = /摄影|相机|胶卷|打印|拍照|手账|拍立得/.test(allAnswerText)
    const isPlush = /毛绒|公仔|娃娃|玩偶|jellycat|抱枕/.test(allAnswerText)
    const isSports = /运动|户外|骑行|滑板|球|轮滑|书包|双肩包|探险/.test(allAnswerText)
    const isArtReading = /画|美术|手工|粘土|陶艺|阅读|书|绘本|字帖|科学|实验|天文/.test(allAnswerText)

    // 【第 1 题】：年龄与核心兴趣
    if (!answers.child_trait && stepIndex === 1) {
      return {
        id: 'child_step_1_trait',
        stage: 'discover',
        key: 'child_trait',
        type: 'single',
        messages: ['这个礼物是送给多大年龄的孩子？平时 TA 最着迷、最能沉下心玩的是哪一类？'],
        options: [
          { value: '电子游戏与益智桌游 / 喜欢掌机互动、策略棋盘与家庭游戏', label: '游戏桌游 / 掌机电玩与益智', emoji: '🎮' },
          { value: '潮玩动漫与动手模型 / 喜欢拼装机甲、手办与模型收藏', label: '潮玩模型 / 机甲拼装与手办', emoji: '🤖' },
          { value: '摄影记录与科学探索 / 喜欢胶卷摄影、拼搭积木与科学探索', label: '摄影求知 / 胶片相机与科学', emoji: '📷' },
          { value: '软萌治愈与毛绒公仔 / 喜欢高品质正版玩偶陪伴', label: '毛绒公仔 / 正版甜美玩偶', emoji: '🧸' },
          { value: '活力户外与轻量运动 / 喜欢运动出行、骑行滑板与潮流双肩包', label: '活力运动 / 户外出行装备', emoji: '🎒' },
        ],
        allowCustom: true,
        placeholder: '也可以直接告诉我孩子的具体年龄和爱好（如：8岁爱玩Switch/画画）…',
      }
    }

    // 【第 2 题】：题材与玩法深度下钻（按领域强力路由）
    if (!answers.child_universe && stepIndex === 2) {
      // 🎮 A. 游戏与数字娱乐分支
      if (isGaming) {
        return {
          id: 'child_step_2_universe_gaming',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在游戏与互动娱乐上，孩子平时更着迷哪种玩法体验？'],
          options: [
            { value: '掌机冒险与体感竞技 / 如 Nintendo Switch、运动体感游戏，阳光活力防沉迷', label: '掌机冒险 / Switch与体感运动', emoji: '🎮' },
            { value: '益智策略与家庭桌游 / 逻辑推理、策略对弈，适合全家或小伙伴一起玩', label: '益智桌游 / 亲子策略推理', emoji: '🎲' },
            { value: '编程机器人与智能玩具 / 边玩边学编程与机械传动，寓教于乐', label: '编程智玩 / 玩中学逻辑代码', emoji: '🤖' },
            { value: '复古像素掌机与益智闯关 / 经典冒险、轻巧便携、锻炼反应速度', label: '复古掌机 / 便携益智闯关', emoji: '🕹️' },
          ],
          allowCustom: true,
          placeholder: '可以补充具体常玩的游戏类型…',
        }
      }

      // 🤖 B. 潮玩模型机甲分支
      if (isMech) {
        return {
          id: 'child_step_2_universe_mech',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在动手模型与潮玩题材上，孩子平时最迷恋哪种世界观或角色形态？'],
          options: [
            { value: '硬核科幻可动机甲 / 帅气战甲、关节可动、机械感十足', label: '科幻可动机甲 / 帅气关节战甲', emoji: '🤖' },
            { value: '机械工程与齿轮传动 / 齿轮联动、机械动力探索', label: '机械科技工程 / 齿轮动力探索', emoji: '⚙️' },
            { value: '正版大热盲盒手办 / POP MART DIMOO等高颜值艺术摆件', label: '正版潮玩盲盒 / 艺术潮流摆件', emoji: '🌟' },
            { value: '热血动漫二次元手办 / 经典动漫角色与燃情羁绊', label: '经典动漫手办 / 角色热血羁绊', emoji: '⚔️' },
          ],
          allowCustom: true,
        }
      }

      // 🧸 C. 毛绒公仔玩偶分支
      if (isPlush) {
        return {
          id: 'child_step_2_universe_plush',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在玩偶和公仔的选择上，哪种形态更能打动孩子？'],
          options: [
            { value: '正版治愈系高档玩偶 / 如 Jellycat 经典巴塞罗熊、甜美玩偶，触感极度细腻', label: 'Jellycat治愈玩偶 / 软萌顶流', emoji: '🧸' },
            { value: '大尺寸安抚抱枕玩偶 / 适合睡觉抱在怀里、满满安全感', label: '超软安抚大抱枕 / 暖心安全感', emoji: '☁️' },
            { value: '萌趣搞怪挂件潮偶 / 挂在书包上和小伙伴分享潮流', label: '书包萌趣挂偶 / 随身吸睛潮流', emoji: '🎒' },
          ],
          allowCustom: true,
        }
      }

      // 🎒 D. 活力运动出行分支
      if (isSports) {
        return {
          id: 'child_step_2_universe_sports',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在运动与出行方向上，孩子更倾向于哪类装备好物？'],
          options: [
            { value: '专业护脊轻量双肩包 / 科学减负、颜值高耐磨耐脏，日常出行上学百搭', label: '轻量护脊双肩包 / 减负透气', emoji: '🎒' },
            { value: '轮滑滑板酷玩装备 / 锻炼平衡感与身体协调，户外吸睛酷炫', label: '滑板轮滑潮玩 / 锻炼平衡活力', emoji: '🛹' },
            { value: '球类竞技与运动配件 / 篮球羽毛球运动套装，挥洒汗水', label: '球类运动套装 / 阳光挥洒汗水', emoji: '🏀' },
          ],
          allowCustom: true,
        }
      }

      // 🎨 E. 艺术绘画手工阅读分支
      if (isArtReading) {
        return {
          id: 'child_step_2_universe_art',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在艺术创作与求知方向上，哪种体验最能激发孩子的创造力？'],
          options: [
            { value: '豪华美术绘画大师礼盒 / 专业彩铅水彩画材全套，随心绘制童年天马行空', label: '专业画材礼盒 / 天马行空创作', emoji: '🎨' },
            { value: '趣味科学实验与天文观测 / 望远镜显微镜，探索大自然奥秘', label: '科学实验与天文 / 探索宇宙奥秘', emoji: '🔬' },
            { value: '经典获奖立体科普绘本书目 / 沉浸式阅读与精美立体插画，拓展眼界', label: '精美科普立体书 / 开拓知识眼界', emoji: '📚' },
          ],
          allowCustom: true,
        }
      }

      // 📷 F. 摄影与记录生活分支
      if (isPhoto) {
        return {
          id: 'child_step_2_universe_explore',
          stage: 'preference',
          key: 'child_universe',
          type: 'single',
          messages: ['在探索与记录生活方向上，孩子更倾向于哪种活动形式？'],
          options: [
            { value: '真实胶卷摄影记录 / 自己构图拍照、体验冲洗胶片的惊喜', label: '胶卷摄影创作 / 体验真实胶片', emoji: '📷' },
            { value: '随拍随印手账创作 / 口袋照片打印、做旅行与成长手账', label: '照片打印手账 / 记录成长足迹', emoji: '🖨️' },
            { value: '户外山野自然观察 / 背着小书包探索昆虫、植物与星空', label: '自然户外探索 / 背包观察探索', emoji: '🎒' },
          ],
          allowCustom: true,
        }
      }

      // 🌟 G. 智能自适应动态兜底分支（自动带入用户自定义词）
      const userCustomTerm = answers.child_trait || '个人爱好'
      const cleanTerm = userCustomTerm.slice(0, 10)
      return {
        id: 'child_step_2_universe_custom',
        stage: 'preference',
        key: 'child_universe',
        type: 'single',
        messages: [`围绕孩子平时对 ${cleanTerm} 的着迷与热爱，你更希望这份礼物偏向哪种核心体验？`],
        options: [
          { value: `益智探索与思维进阶 / 结合 ${cleanTerm} 进行深度脑力拓展与能力培养`, label: '益智思维进阶 / 拓展脑力潜能', emoji: '🧠' },
          { value: `动手创造与专属成果 / 能亲手制作出看得见的成果，收获满满成就感`, label: '动手创造体验 / 亲手完成成就', emoji: '🛠️' },
          { value: `沉浸互动与欢乐陪伴 / 带来高品质的纯粹快乐，给童年留下美好回忆`, label: '纯粹欢乐陪伴 / 沉浸快乐童年', emoji: '✨' },
          { value: `高品质精良正版好物 / 做工考究耐玩，陪伴孩子长久成长`, label: '品质耐玩好物 / 陪伴长久成长', emoji: '🏆' },
        ],
        allowCustom: true,
      }
    }

    // 【第 3 题】：互动门槛、健康考量与上手难度
    if (!answers.child_difficulty && stepIndex === 3) {
      if (isGaming) {
        return {
          id: 'child_step_3_gaming_health',
          stage: 'story',
          key: 'child_difficulty',
          type: 'single',
          messages: ['对于游戏娱乐类礼物，你在日常把玩与家教引导上最看重哪方面的分寸？'],
          options: [
            { value: '健康护眼防沉迷 / 屏幕舒适不刺眼，时长与游戏内容家长易掌控', label: '健康护眼防沉迷 / 内容健康好掌控', emoji: '👀' },
            { value: '亲子共同通关互动 / 适合周末大人孩子组队合作，增进亲情默契', label: '亲子协作通关 / 增进亲情默契', emoji: '👨‍👧' },
            { value: '启发智力与解谜思维 / 烧脑益智通关，在游戏中锻炼专注力与反应力', label: '智力解谜思维 / 锻炼专注反应力', emoji: '🧩' },
            { value: '轻巧便携随时开玩 / 路上或外出游玩时随时能享受片刻欢乐', label: '轻巧便携好玩 / 外出随时享受', emoji: '🎒' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'child_step_3_difficulty',
        stage: 'story',
        key: 'child_difficulty',
        type: 'single',
        messages: ['在上手门槛、把玩体验与耐心程度上，你期望的体验门槛是？'],
        options: [
          { value: '简单友好独立上手 / 步骤清晰友好，孩子自己能独立玩得开心', label: '简单好上手 / 孩子可独立完成', emoji: '🧩' },
          { value: '高精益智进阶款 / 细节丰富多变、有一定挑战性与把玩深度', label: '高精进阶款 / 细节丰富多变', emoji: '⚔️' },
          { value: '亲子协作共同参与 / 适合周末大人孩子一起沉浸互动半天', label: '亲子协作互动 / 增进陪伴温情', emoji: '👨‍👩‍👧' },
          { value: '开箱即玩成品精装 / 做工扎实质感好，无需复杂门槛直接享受', label: '开箱即玩好物 / 免门槛直接享受', emoji: '🏆' },
        ],
        allowCustom: true,
      }
    }

    // 【第 4 题】：安全品质与用料标准
    if (!answers.child_quality_demand && stepIndex === 4) {
      if (isGaming) {
        return {
          id: 'child_step_4_gaming_quality',
          stage: 'story',
          key: 'child_quality_demand',
          type: 'single',
          messages: ['在数码游戏与玩具的选品做工上，你最看重的硬性要求是？'],
          options: [
            { value: '官方正品行货与质保售后 / 品质有保障、做工扎实耐用、安全放心', label: '官方正品行货 / 质保安全省心', emoji: '🛡️' },
            { value: '防摔耐磕按键手感扎实 / 经得起孩子高频使用与日常折腾', label: '耐用耐摔抗造 / 经得起折腾', emoji: '🦾' },
            { value: '纯净无暴力不良内容 / 阳光益智、分级明确、对孩子身心健康有益', label: '阳光纯净内容 / 对身心成长有益', emoji: '🌱' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'child_step_4_quality',
        stage: 'story',
        key: 'child_quality_demand',
        type: 'single',
        messages: ['在玩具与用品的做工用料上，你最看重的标准是？'],
        options: [
          { value: '环保无异味、边角圆润光滑，确保安全不划手', label: '环保无异味 / 边角圆润安全', emoji: '🛡️' },
          { value: '官方正版授权，做工精良涂装细腻，绝非劣质山寨', label: '官方正版精工 / 涂装细腻考究', emoji: '✨' },
          { value: '耐摔耐磨结实耐玩，经得起孩子日常折腾', label: '结实耐摔耐玩 / 经得起折腾', emoji: '🦾' },
        ],
        allowCustom: true,
      }
    }

    // 【第 5 题】：日常把玩与使用场景
    if (!answers.child_safe_habit && stepIndex === 5) {
      if (isGaming) {
        return {
          id: 'child_step_5_gaming_scene',
          stage: 'story',
          key: 'child_safe_habit',
          type: 'single',
          messages: ['平时玩这个礼物时，最主要的场景是哪里？'],
          options: [
            { value: '客厅大屏或全家欢聚 / 电视大屏投屏、周末亲子体感同乐', label: '客厅全家欢聚 / 亲子大屏同乐', emoji: '📺' },
            { value: '书桌专属益智角 / 课后放学在个人书桌前放松解密', label: '书桌专属角落 / 课后益智放松', emoji: '🪑' },
            { value: '假期长途旅行随身携带 / 路上解闷安抚神器、随时随地畅玩', label: '旅行随身便携 / 出行解闷神器', emoji: '✈️' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'child_step_5_safe_habit',
        stage: 'story',
        key: 'child_safe_habit',
        type: 'single',
        messages: ['平时孩子把玩或展示礼物时，主要的展示或使用场景是？'],
        options: [
          { value: '常驻书桌床头展示 / 做工精致耐看，每天看着都充满自豪感', label: '书桌床头展示 / 做工精美耐看', emoji: '🪑' },
          { value: '随身携带与伙伴分享 / 轻便小巧，能带去学校或户外和小伙伴炫耀', label: '随身便携分享 / 容易和小伙伴玩', emoji: '🎒' },
          { value: '专属收纳柜典藏 / 零件齐全妥善保管、培养整理习惯', label: '典藏收纳保管 / 培养整理习惯', emoji: '📦' },
        ],
        allowCustom: true,
      }
    }

    // 【第 6 题】：成长陪伴与心愿寄托
    if (!answers.child_wish_tone && stepIndex === 6) {
      if (isGaming) {
        return {
          id: 'child_step_6_gaming_wish',
          stage: 'shape',
          key: 'child_wish_tone',
          type: 'single',
          messages: ['送孩子这份游戏或娱乐礼物，你最希望启发或带给 TA 什么？'],
          options: [
            { value: '释放学业压力、收获纯粹快乐，拥有一个被理解支持的幸福童年', label: '纯粹快乐释放 / 被理解支持的童年', emoji: '🌟' },
            { value: '锻炼思维敏捷与战术应对，在探索挑战中收获自信与毅力', label: '锻炼敏捷思维 / 挑战中收获自信', emoji: '🧠' },
            { value: '留下大人与孩子并肩通关的珍贵回忆，成为亲子之间的共同话题', label: '并肩通关回忆 / 共同温暖话题', emoji: '👨‍👧' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'child_step_6_wish_tone',
        stage: 'shape',
        key: 'child_wish_tone',
        type: 'single',
        messages: ['送孩子这份礼物，你最希望启发或带给 TA 什么？'],
        options: [
          { value: '鼓励动手创造与独立思考，在拼搭中收获满满成就感', label: '激发创造自豪感 / 独立完成成就', emoji: '💡' },
          { value: '给予温暖的情感陪伴，在童年岁月里留下被爱的安全感', label: '温暖治愈陪伴 / 留下被爱安全感', emoji: '🧸' },
          { value: '激发对大自然与科学世界的好奇心，勇于探索未知', label: '激发探索求知欲 / 勇于探索世界', emoji: '🔭' },
        ],
        allowCustom: true,
      }
    }

    // 【第 7 题】：预算区间
    return {
      id: 'child_step_7_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['最后确认一下预算范围，我来为你匹配最受孩子欢迎的正版高口碑方案：'],
      options: [
        { value: '¥100–300 精巧心意款（如 益智桌游/正版盲盒手办/口袋打印/轻量书包）', label: '¥100–300 精巧心意款', emoji: '🌱' },
        { value: '¥300–600 品质进阶款（如 进阶掌机/Jellycat中号玩偶/北极狐书包/益智套组）', label: '¥300–600 进阶大件', emoji: '✨' },
        { value: '¥600–1200 标杆重磅大礼（如 Nintendo Switch便携款/典藏机甲大套组/高端定制）', label: '¥600–1200 典藏重磅', emoji: '👑' },
        { value: '¥1200 以上 顶配数码与尊享大礼', label: '¥1200 以上 顶配尊享', emoji: '💎' },
      ],
      allowCustom: true,
    }
  }

  // ══════════════════════════════════════════════════════════
  //  3. 父母 / 长辈 专属深度路径 (7~8 步下钻)
  // ══════════════════════════════════════════════════════════
  if (rel === 'elder') {
    // 【第 1 题】：核心起居诉求
    if (!answers.pain_point && stepIndex === 1) {
      return {
        id: 'elder_step_1_scenario',
        stage: 'discover',
        key: 'pain_point',
        type: 'single',
        messages: ['在父母/长辈的日常起居中，你最想帮他们改善或分担的是哪一类具体场景？'],
        options: [
          { value: '家务操劳 / 弯腰拖地与做饭备菜繁重', label: '家务操劳 / 弯腰清洁与备菜', emoji: '🧹' },
          { value: '身体舒缓 / 颈椎腰背酸痛容易疲累', label: '身体舒缓 / 颈椎腰背放松', emoji: '💆' },
          { value: '精神念想 / 老照片回忆与陪伴挂念', label: '精神念想 / 专属回忆陪伴', emoji: '📷' },
          { value: '起居养生 / 温和调理与舒适好眠', label: '起居养生 / 舒适调养', emoji: '🍵' },
        ],
        allowCustom: true,
        placeholder: '也可以直接写长辈平时最操劳或最需要的事…',
      }
    }

    // 【第 2 题】：具体生活习惯与场景
    if (!answers.elder_habit_detail && stepIndex === 2) {
      if (/家务|操劳|做饭|备菜|弯腰|拖地/.test(allAnswerText)) {
        return {
          id: 'elder_step_2_housework_habit',
          stage: 'preference',
          key: 'elder_habit_detail',
          type: 'single',
          messages: ['在帮长辈减轻家务与起居负担上，哪种形式最能让他们真正感到轻松？'],
          options: [
            { value: '卸下一身家务疲劳 / 到专业理疗馆进行肩颈和足部深层揉捏', label: '肩颈足疗放松 / 彻底卸下家务疲劳', emoji: '💆' },
            { value: '免弯腰省心清洁装备 / 极简一键操作，把双手从繁琐打扫中解放', label: '一键免弯腰清洁 / 解放双手', emoji: '🛋️' },
            { value: '子女放下手机全程陪伴 / 陪父母晨练买菜、做一顿热腾腾的饭菜', label: '温情亲情相伴 / 放下手机陪父母', emoji: '🥣' },
          ],
          allowCustom: true,
        }
      }

      if (/精神|念想|回忆|照片|故事|挂念|想念/.test(allAnswerText)) {
        return {
          id: 'elder_step_2_memory_habit',
          stage: 'preference',
          key: 'elder_habit_detail',
          type: 'single',
          messages: ['在定格回忆与温情念想上，哪种载体最能让长辈常常翻看、感到欣慰？'],
          options: [
            { value: '老照片整理归册 / 将箱底泛黄旧照高清扫描排版，翻印成定制精装画册', label: '老照片定制画册 / 翻印成册', emoji: '🖼️' },
            { value: '怀旧影院老电影专场 / 包场重温父母年轻时最爱的老胶片经典电影', label: '老电影专场 / 重温年轻岁月', emoji: '🎞️' },
            { value: '米家口袋照片打印机 / 子女平时微信发照片，随时一键洗出彩色相片', label: '照片打印机 / 随时打印全家福', emoji: '🖨️' },
            { value: '茶室棋牌闲适下午 / 陪长辈喝好茶聊天，享受慢节奏的亲情时光', label: '茶室品茗 / 闲适亲情时光', emoji: '🍵' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'elder_step_2_relief_habit',
        stage: 'preference',
        key: 'elder_habit_detail',
        type: 'single',
        messages: ['在身体舒缓与健康呵护上，长辈更偏好哪类具体的调养方式？'],
        options: [
          { value: '专业技师肩颈足疗 / 针对性深层揉捏、按开长期紧绷肌肉', label: '专业推拿足疗 / 针对性揉捏放松', emoji: '💆' },
          { value: '传统中医温热艾灸 / 驱散体内老寒气、温通经络与关节', label: '中医艾灸温敷 / 驱寒调理体质', emoji: '🌿' },
          { value: '全身药浴汗蒸放松 / 温热排汗、促进血液循环改善深度睡眠', label: '药浴汗蒸排汗 / 改善睡眠质量', emoji: '🧖' },
          { value: '全面健康深度体检 / 心血管与骨密度系统筛查，让全家安心', label: '深度健康体检 / 系统筛查全家安心', emoji: '🩺' },
        ],
        allowCustom: true,
      }
    }

    // 【第 3 题】：身体改善痛点部位
    if (!answers.elder_body_focus && stepIndex === 3) {
      return {
        id: 'elder_step_3_body_focus',
        stage: 'preference',
        key: 'elder_body_focus',
        type: 'single',
        messages: ['针对长辈的起居与身体状态，最希望能重点改善哪个方面？'],
        options: [
          { value: '颈椎斜方肌酸胀 / 伏案看手机或操劳导致的颈背紧绷', label: '肩颈斜方肌 / 缓解僵硬酸胀', emoji: '💆' },
          { value: '腰肌劳损腰椎酸痛 / 弯腰久坐需要强力腰部支撑与揉捏', label: '腰椎腰肌 / 强力支撑舒缓', emoji: '🛋️' },
          { value: '腿脚冰凉关节不适 / 需要温热泡脚活血与艾灸驱寒', label: '腿脚关节 / 驱寒活血温通', emoji: '🦵' },
          { value: '失眠多梦气血不调 / 需要深度放松与安神好眠', label: '安神助眠 / 调理气血安睡', emoji: '🌙' },
        ],
        allowCustom: true,
      }
    }

    // 【第 4 题】：操作门槛与长辈使用习惯
    if (!answers.operation_preference && stepIndex === 4) {
      return {
        id: 'elder_step_4_operation',
        stage: 'story',
        key: 'operation_preference',
        type: 'single',
        messages: ['长辈使用礼物或体验时，你最看重的细节是什么？'],
        options: [
          { value: '极简好上手，不需要看复杂说明书，一键就能享受', label: '极简操作 / 一键即享不费脑', emoji: '👍' },
          { value: '实实在在天天用得上，长辈舍不得闲置、觉得特别实用', label: '实用耐用 / 舍得天天用', emoji: '🛋️' },
          { value: '有子女陪伴在侧，深深感受到被放在心上的孝心与关怀', label: '子女相伴 / 感受满满孝心', emoji: '🥹' },
        ],
        allowCustom: true,
      }
    }

    // 【第 5 题】：包装与送礼讲究
    if (!answers.elder_package_preference && stepIndex === 5) {
      return {
        id: 'elder_step_5_package',
        stage: 'story',
        key: 'elder_package_preference',
        type: 'single',
        messages: ['在包装形式与仪式感上，哪种方式长辈最受用？'],
        options: [
          { value: '体面精美大礼盒装 / 红金喜庆、长辈拆开觉得特别有面子', label: '精装喜庆大礼盒 / 体面有面子', emoji: '🎁' },
          { value: '质朴实用简约装 / 撕掉花哨包装直接上手用，长辈觉得不浪费钱', label: '质朴实用简约 / 实在不浪费', emoji: '📦' },
          { value: '附带子女手写手账/信件 / 满满亲情文字，长辈读完热泪盈眶', label: '附带真挚家书 / 亲情温度满满', emoji: '💌' },
        ],
        allowCustom: true,
      }
    }

    // 【第 6 题】：预算区间
    return {
      id: 'elder_step_6_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['在预算范围与礼物形态上，你期望的区间大概是？'],
      options: [
        { value: '¥100–300 贴心小件 / 晨练早餐 / 老电影专场', label: '¥100–300 贴心小件', emoji: '🌱' },
        { value: '¥300–600 黄金品质大件 / 专业肩颈推拿理疗半日', label: '¥300–600 实用大件/理疗', emoji: '✨' },
        { value: '¥600–1200 尊享体面重磅礼 / 深度中医艾灸套餐', label: '¥600–1200 尊享关怀', emoji: '🎁' },
        { value: '¥1200 以上 全身体检深度筛查套餐', label: '¥1200 以上 全身体检', emoji: '👑' },
      ],
      allowCustom: true,
    }
  }

  // ══════════════════════════════════════════════════════════
  //  4. 女朋友 / 妻子 / 伴侣 专属深度路径 (7~8 步下钻)
  // ══════════════════════════════════════════════════════════
  if (rel === 'lover') {
    // 【第 1 题】：契机与仪式感
    if (!answers.occasion_scene && stepIndex === 1) {
      return {
        id: 'lover_step_1_occasion',
        stage: 'discover',
        key: 'occasion_scene',
        type: 'single',
        messages: [`这次给心爱的 TA 选礼，最核心的契机或心愿是什么？`],
        options: [
          { value: '恋爱/结婚周年纪念日，希望极具仪式感与专属纪念', label: '周年纪念 / 仪式感与专属深情', emoji: '💍' },
          { value: 'TA 的生日庆祝，想送一份既惊喜又实用的心头好', label: '生日惊喜 / 走心心头好', emoji: '🎂' },
          { value: '日常浪漫小确幸，捕捉心动瞬间、给生活添点甜', label: '日常小确幸 / 浪漫心意', emoji: '✨' },
          { value: '感谢长久陪伴与支持，表达深深的爱意与珍惜', label: '感恩陪伴 / 诉说真挚深情', emoji: '💌' },
        ],
        allowCustom: true,
      }
    }

    // 【第 2 题】：核心品味领域
    if (!answers.lover_preference_domain && stepIndex === 2) {
      return {
        id: 'lover_step_2_domain',
        stage: 'preference',
        key: 'lover_preference_domain',
        type: 'single',
        messages: ['TA 平时最心动、最能点亮生活调性的是哪一类具体方向？'],
        options: [
          { value: '潮流户外与新鲜体验 / 喜欢轻量徒步、露营看星空与旅行装备', label: '潮流户外 / 露营与新鲜体验', emoji: '⛰️' },
          { value: '精致首饰与穿搭点缀 / 喜欢小众锁骨链、闪耀星星吊坠与银饰', label: '精致首饰 / 锁骨链与闪耀饰品', emoji: '💎' },
          { value: '美妆香氛与生活美学 / 喜欢质感气垫、专属调香与居家治愈', label: '美妆香氛 / 气垫与调香体验', emoji: '💄' },
          { value: '生活记录与复古数码 / 喜欢胶卷相机、随身照片打印机与拍立得', label: '生活记录 / 胶卷相机与照片打印', emoji: '📷' },
        ],
        allowCustom: true,
      }
    }

    // 【第 3 题】：佩戴/使用场景细分
    if (!answers.lover_use_scene && stepIndex === 3) {
      if (/首饰|饰品|项链|耳饰|手链|穿搭/.test(allAnswerText)) {
        return {
          id: 'lover_step_3_jewelry_scene',
          stage: 'preference',
          key: 'lover_use_scene',
          type: 'single',
          messages: ['在首饰与穿搭上，TA 平时最主要的佩戴场合与习惯是？'],
          options: [
            { value: '日常通勤低调百搭 / 细巧精致、搭配职场或休闲便服不突兀', label: '日常通勤低调百搭 / 细巧精致', emoji: '👗' },
            { value: '约会聚会吸睛亮点 / 闪耀夺目、能成为整体造型的视觉焦点', label: '约会吸睛亮点 / 闪耀夺目焦点', emoji: '✨' },
            { value: '专属深情信物 / 含有星辰、眼泪或双星寓意，天天戴在心口', label: '专属浪漫信物 / 寓意深情常戴', emoji: '⭐' },
          ],
          allowCustom: true,
        }
      }

      if (/户外|运动|露营|旅行/.test(allAnswerText)) {
        return {
          id: 'lover_step_3_outdoor_scene',
          stage: 'preference',
          key: 'lover_use_scene',
          type: 'single',
          messages: ['在户外与浪漫出游上，两个人更憧憬哪种具体体验？'],
          options: [
            { value: '双人星空露营夜 / 一起看银河与日出，专属浪漫帐篷体验', label: '双人星空露营 / 看银河与日出', emoji: '🌌' },
            { value: '轻便说走就走短途旅行 / 高颜值轻量双肩包与万向轮旅行箱', label: '短途轻便旅程 / 颜值出游装备', emoji: '🧳' },
            { value: '周末探店街拍 / 潮流棒球帽与复古胶卷相机抓拍心动瞬间', label: '街头探店街拍 / 潮流遮阳胶片记录', emoji: '📷' },
          ],
          allowCustom: true,
        }
      }

      return {
        id: 'lover_step_3_aesthetic_scene',
        stage: 'preference',
        key: 'lover_use_scene',
        type: 'single',
        messages: ['在美学与居家生活上，TA 更心动哪种具体的仪式感？'],
        options: [
          { value: '双人专属调香工坊 / 两个人亲手调配彼此专属的浪漫香气', label: '专属调香工坊 / 亲手调制专属香', emoji: '🌸' },
          { value: '日常清透水润美妆 / 质感气垫随时保持通透自然好气色', label: '清透水润气垫 / 便携补妆好气色', emoji: '💄' },
          { value: '双人油画写生艺术课 / 互相画出眼中最美的彼此留作纪念', label: '双人油画写生 / 艺术浪漫纪念', emoji: '🎨' },
          { value: '温暖治愈毛绒陪伴 / 摆在床头每晚给予温柔触感', label: '治愈毛绒玩偶 / 床头温柔陪伴', emoji: '🧸' },
        ],
        allowCustom: true,
      }
    }

    // 【第 4 题】：审美偏好与材质细节
    if (!answers.lover_style_detail && stepIndex === 4) {
      return {
        id: 'lover_step_4_style_detail',
        stage: 'story',
        key: 'lover_style_detail',
        type: 'single',
        messages: ['TA 的审美与偏好更贴近哪种气质调性？'],
        options: [
          { value: '清透灵动小众感 / 喜欢微光水滴、闪耀水晶与极简纯银', label: '清透灵动小众 / 闪耀纯银与水晶', emoji: '💎' },
          { value: '法式浪漫与复古优雅 / 喜欢温柔色调、小众香气与仪式感', label: '法式浪漫复古 / 温柔优雅调性', emoji: '🌹' },
          { value: '随性活力潮流感 / 喜欢清爽百搭、功能与颜值并存', label: '随性活力潮流 / 颜值功能并存', emoji: '🧢' },
        ],
        allowCustom: true,
      }
    }

    // 【第 5 题】：日常搭配频率与收纳便携
    if (!answers.lover_habit_wear && stepIndex === 5) {
      return {
        id: 'lover_step_5_habit_wear',
        stage: 'story',
        key: 'lover_habit_wear',
        type: 'single',
        messages: ['在日常使用与佩戴习惯上，你最看重哪一点？'],
        options: [
          { value: '高频日常佩戴 / 舒适不挑衣服、天天戴着不摘', label: '高频日常佩戴 / 百搭舒适不挑衣', emoji: '✨' },
          { value: '高光时刻闪耀 / 重要约会与拍照聚会时戴出惊艳感', label: '高光约会拍照 / 惊艳吸睛出彩', emoji: '📸' },
          { value: '轻巧易随身收纳 / 放在小包包里不占地方、便于携带', label: '轻巧便携随身 / 小包随时收纳', emoji: '👛' },
        ],
        allowCustom: true,
      }
    }

    // 【第 6 题】：情感寄托与心愿重点
    if (!answers.lover_heart_wish && stepIndex === 6) {
      return {
        id: 'lover_step_6_heart_wish',
        stage: 'shape',
        key: 'lover_heart_wish',
        type: 'single',
        messages: ['这份礼物最核心想让 TA 感受到的是？'],
        options: [
          { value: '被坚定放在心上、被深深理解与爱护的踏实感', label: '被坚定放在心上 / 满满安全感', emoji: '💖' },
          { value: '平淡生活中的浪漫惊喜、重温初见时的心动', label: '浪漫惊喜心动 / 重温初见甜蜜', emoji: '🎆' },
          { value: '两人携手走向未来的坚定约定与美好愿景', label: '未来携手约定 / 专属深情信物', emoji: '🗝️' },
        ],
        allowCustom: true,
      }
    }

    // 【第 7 题】：预算区间
    return {
      id: 'lover_step_7_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['预算大概在什么范围？选好后我立即为你精细定制方案与专属情书 ✨'],
      options: [
        { value: '¥100–300 日常小确幸好物（如 双肩包/气垫/棒球帽）', label: '¥100–300 小确幸款', emoji: '🌱' },
        { value: '¥300–600 浪漫高质感心仪首选（如 星星项链/蓝眼泪/旅行箱）', label: '¥300–600 质感首选', emoji: '✨' },
        { value: '¥600–1200 典藏仪式感重磅大礼（如 专属调香/重磅定制）', label: '¥600–1200 典藏重磅', emoji: '🎁' },
        { value: '¥1200 以上 奢享体验与深度定制', label: '¥1200 以上 奢享大礼', emoji: '👑' },
      ],
      allowCustom: true,
    }
  }

  // ══════════════════════════════════════════════════════════
  //  5. 朋友 / 好友 专属路径 (7~8 步下钻，兼顾哥们与闺蜜)
  // ══════════════════════════════════════════════════════════
  if (!answers.occasion_scene && stepIndex === 1) {
    return {
      id: 'friend_step_1',
      stage: 'discover',
      key: 'occasion_scene',
      type: 'single',
      messages: ['给好朋友挑礼物最讲究默契与共鸣！想先了解下，TA 和你更像哪种相处状态？'],
      options: [
        { value: '铁哥们 / 兄弟', label: '铁哥们 / 兄弟', emoji: '👊' },
        { value: '好闺蜜 / 姐妹', label: '好闺蜜 / 姐妹', emoji: '✨' },
        { value: '同窗死党', label: '同窗死党', emoji: '🎓' },
        { value: '日常搭子 / 玩伴', label: '日常搭子', emoji: '🤝' },
      ],
      allowCustom: true,
    }
  }

  if (!answers.friend_activity_type && stepIndex === 2) {
    if (/居家|治愈|解压|陪伴|咖啡/.test(allAnswerText)) {
      return {
        id: 'friend_step_2_healing_type',
        stage: 'preference',
        key: 'friend_activity_type',
        type: 'single',
        messages: ['在居家治愈与解压好物上，TA 更偏爱哪一种放松方式？'],
        options: [
          { value: '治愈系毛绒玩偶陪伴 / 软萌触感摆在书桌沙发超暖心', label: '软萌玩偶陪伴 / 摆在书桌治愈', emoji: '🧸' },
          { value: '芳香沐浴与身体润养 / 治愈香气卸下一整天的紧绷疲惫', label: '芳香沐浴润养 / 深度滋润解压', emoji: '🛁' },
          { value: '周末双人艺术画画 / 两个人一边喝咖啡一边涂鸦放空', label: '双人画画写生 / 惬意艺术放松', emoji: '🎨' },
        ],
        allowCustom: true,
      }
    }

    if (/出游|户外|运动|出街/.test(allAnswerText)) {
      return {
        id: 'friend_step_2_outdoor_type',
        stage: 'preference',
        key: 'friend_activity_type',
        type: 'single',
        messages: ['在出街出游与运动装备上，哪种方向最契合 TA 的日常习惯？'],
        options: [
          { value: '轻便百搭双肩背包 / 日常探店、短途徒步与通勤轻装出行', label: '轻便双肩包 / 探店出游百搭', emoji: '🎒' },
          { value: '随性街头运动遮阳 / 遮阳利器、帅气百搭帽子配饰', label: '街头运动遮阳 / 随性遮阳百搭', emoji: '🧢' },
          { value: '胶卷抓拍真实瞬间 / 捕捉两个人最自然搞怪的真实胶片', label: '胶卷相机抓拍 / 记录搞怪真实瞬间', emoji: '📷' },
        ],
        allowCustom: true,
      }
    }

    return {
      id: 'friend_step_2_beauty_type',
      stage: 'preference',
      key: 'friend_activity_type',
      type: 'single',
      messages: ['在美学与颜值好物上，TA 平时更心仪哪种体验？'],
      options: [
        { value: '清透自然好气色美妆 / 轻松搞定日常自然通透妆容', label: '清透美妆气垫 / 自然通透好气色', emoji: '💄' },
        { value: '专属香气与情绪治愈 / 独家香水调配或沙龙香气', label: '沙龙香氛调配 / 独特嗅觉记忆', emoji: '🌸' },
        { value: '高颜值实用出行配件 / 既有出街回头率又耐装实用', label: '高颜值出行配件 / 吸睛实用耐装', emoji: '🎒' },
      ],
      allowCustom: true,
    }
  }

  if (!answers.friend_core_demand && stepIndex === 3) {
    return {
      id: 'friend_step_3_demand',
      stage: 'preference',
      key: 'friend_core_demand',
      type: 'single',
      messages: ['在礼物的实用度与体验感上，你最看重哪一点？'],
      options: [
        { value: '天天用得上、每次使用都能想起彼此的深厚友情', label: '高频日常实用 / 睹物想到友情', emoji: '🌟' },
        { value: '颜值爆表、拍照发朋友圈超级出片', label: '高颜值吸睛 / 拍照发圈极出片', emoji: '📸' },
        { value: '小众不撞款、有品味有调性', label: '小众设计感 / 不撞款有品味', emoji: '✨' },
      ],
      allowCustom: true,
    }
  }

  if (!answers.friend_habit_preference && stepIndex === 4) {
    return {
      id: 'friend_step_4_habit',
      stage: 'story',
      key: 'friend_habit_preference',
      type: 'single',
      messages: ['TA 平时在物品收纳与生活习惯上偏向哪种风格？'],
      options: [
        { value: '极简随性 / 轻巧便携、不喜欢笨重累赘', label: '极简随性轻便 / 拒绝笨重累赘', emoji: '🪶' },
        { value: '精致仪式感 / 讲究包装、开箱惊喜与生活细节', label: '精致仪式感 / 讲究开箱惊喜', emoji: '🎁' },
        { value: '注重体验与互动 / 两个人能一起玩、一起参与', label: '互动体验感 / 两个人一起参与', emoji: '👭' },
      ],
      allowCustom: true,
    }
  }

  if (!answers.friend_gift_tone && stepIndex === 5) {
    return {
      id: 'friend_step_5_tone',
      stage: 'story',
      key: 'friend_gift_tone',
      type: 'single',
      messages: ['送好朋友这份心意，最想传达的心意色彩是？'],
      options: [
        { value: '默契友情陪伴', label: '默契友情陪伴', emoji: '🫶' },
        { value: '真挚未来祝福', label: '真挚未来祝福', emoji: '👑' },
        { value: '暖心解压关怀', label: '暖心解压关怀', emoji: '☕' },
      ],
      allowCustom: true,
    }
  }

  // 终结预算题
  return {
    id: 'friend_step_6_budget',
    stage: 'shape',
    key: 'budget',
    type: 'single',
    messages: ['预算大概在什么范围？选好后立即生成专属方案：'],
    options: [
      { value: '¥100–300 贴心心意好物', label: '¥100–300 贴心好物', emoji: '🌱' },
      { value: '¥300–600 进阶质感大件', label: '¥300–600 进阶质感', emoji: '✨' },
      { value: '¥600–1200 尊享体面重磅礼', label: '¥600–1200 尊享重磅', emoji: '🎁' },
    ],
    allowCustom: true,
  }
}
