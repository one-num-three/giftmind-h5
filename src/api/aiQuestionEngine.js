/**
 * ══════════════════════════════════════════════════════════════
 *  深度 AI 动态出题引擎 (Deep AI Question Engine)
 *  —— 由顶级私人买手大模型驱动的 4~5 步步步深入对话：
 *     1. 拒绝浅薄表层提问，深入挖掘生活痛点、心愿细节与精神诉求；
 *     2. 纯中文输出，严禁任何英文，严禁张冠李戴；
 *     3. 每一步提供丰富、懂行、接地气的选项，同时支持随时自由输入；
 *     4. 4~5 步递进式自然收敛，信息充实后智能定型出方案。
 * ══════════════════════════════════════════════════════════════
 */
import { callMiMo } from './mimoService'

/** 初始第一题（0 延迟秒开，建立受礼人身份） */
export const INITIAL_STEP = {
  id: 'recipient',
  stage: 'discover',
  key: 'recipient',
  type: 'single',
  messages: [
    '你好呀 👋 我是 GiftMind，你的 AI 私人挑礼策划师。',
    '我会像最懂生活的朋友一样，用几个深入的问题帮你理清头绪。\n\n先告诉我，这次想为谁挑选一份特别的心意？',
  ],
  options: [
    { value: '父母 / 长辈', label: '父母 / 长辈', emoji: '🏡' },
    { value: '女朋友 / 妻子', label: '女朋友 / 妻子', emoji: '💗' },
    { value: '男朋友 / 丈夫', label: '男朋友 / 丈夫', emoji: '💙' },
    { value: '闺蜜 / 好友', label: '闺蜜 / 好友', emoji: '🤝' },
    { value: '同事 / 领导', label: '同事 / 领导', emoji: '🧑‍💼' },
    { value: '孩子 / 晚辈', label: '孩子 / 晚辈', emoji: '🎈' },
  ],
  allowCustom: true,
  placeholder: '也可以直接告诉我 TA 是谁…',
}

/** 关系类型分类器 */
export function classifyRelationship(recipient = '') {
  const r = String(recipient || '')
  if (/父|母|长辈|爸|妈|老两口|公公|婆婆|爷爷|奶奶|姥/.test(r)) {
    return 'elder' // 父母长辈
  }
  if (/女|妻|男|夫|对象|爱人|情侣|暗恋/.test(r)) {
    return 'lover' // 伴侣/恋人
  }
  if (/同事|领导|客户|老板|上司|下属|商务/.test(r)) {
    return 'work' // 职场同事
  }
  if (/孩子|晚辈|学生|儿子|女儿|侄|外甥/.test(r)) {
    return 'junior' // 孩子晚辈
  }
  return 'friend' // 朋友闺蜜
}

/** 英文选项映射表（防止大模型漏出英文） */
const EN_ZH_MAP = {
  circulation: '气血循环 / 身体保暖',
  posture: '体态承托 / 脊椎支撑',
  preventive: '日常预防 / 基础调养',
  allround: '全方位综合养生',
  wellness: '健康养生 / 综合调理',
  relaxation: '放松解压 / 舒缓身心',
  sleep: '改善睡眠 / 安神助眠',
  energy: '充沛活力 / 提神醒脑',
  comfort: '起居舒适 / 贴心呵护',
  fitness: '温和锻炼 / 身体活动',
}

/**
 * 深度智能追问生成器
 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1) {
  const filledKeys = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '')
  const answeredCount = filledKeys.length

  // 🌟 深度收集：4~5 题充分了解用户后自然收敛（或者用户随时点击右上角看方案）
  if (answeredCount >= 5 || stepIndex >= 5) {
    return { isReady: true }
  }

  const recipient = answers.recipient || 'TA'
  const relType = classifyRelationship(recipient)

  const relationshipPrompts = {
    elder: `当前受礼人为【父母 / 长辈】。
提问核心：
1. 深入挖掘长辈真实生活痛点（如日常家务操劳、下厨备菜繁琐、起居舒适度、身体舒缓养生、老两口精神陪伴与念想等）；
2. 严禁出现情人节、恋爱、宠TA等情侣词汇；
3. 选项必须具体有画面感，贴合长辈实际生活；`,
    lover: `当前受礼人为【恋人 / 伴侣】。
提问核心：
1. 深入挖掘两人相处状态、浪漫心动契机、日常小确幸、美学偏好或近期共同心愿；
2. 避免千篇一律的俗套礼物，注重情绪共鸣与惊喜感；`,
    work: `当前受礼人为【职场同事 / 领导 / 商务伙伴】。
提问核心：
1. 围绕升职调动、退休欢送、商务答谢、体面往来展开；
2. 注重礼物的分寸感、体面度与办公生活品味；`,
    junior: `当前受礼人为【孩子 / 晚辈】。
提问核心：
1. 围绕成长庆祝、考学升学、动手探索、益智科学与趣味陪伴展开；`,
    friend: `当前受礼人为【朋友 / 闺蜜】。
提问核心：
1. 围绕生日聚会、乔迁新居、生活美学、默契陪伴与治愈解压展开；`,
  }[relType]

  const systemPrompt = `你是精通人情世故、极具生活品味与洞察力的资深私人买手顾问 GiftMind。
你需要像一个真正懂生活的高情商朋友一样，通过自然对话为用户挑选最适合【${recipient}】的礼物。

【核心人伦与提问原则】：
${relationshipPrompts}
- 纯中文输出：选项与问题必须全部为地道自然的纯中文，【严禁出现任何英文单词】！
- 深度递进：不要停留在表层套话，要根据用户之前透露的回答不断向下深挖具体场景、痛点、故事或期望感受！

【当前已知信息】：
${JSON.stringify(answers, null, 2)}

【任务】：
根据当前对话进展，提出下一道最具启发性、最能挖掘真实细节的深度问题。
1. 提供 4~5 个极具代表性、具体生动的中文选项 options（包含 value, label, emoji）。
2. 支持自由输入 placeholder。
3. 若觉得信息已足够丰富（已涵盖核心诉求、偏好、预算），可返回 is_ready: true。

必须输出严格 JSON 格式：
{
  "question": "深度针对性提问（纯中文，亲切自然）",
  "key": "收集字段名（如 pain_point / lifestyle / memory / feeling / budget / format）",
  "stage": "discover / preference / story / shape",
  "type": "single 或者 multi 或者 text",
  "options": [
    { "value": "纯中文选项值", "label": "纯中文选项文本", "emoji": "🏮" }
  ],
  "allow_custom": true,
  "placeholder": "自由输入补充细节…",
  "skippable": true,
  "is_ready": false
}`

  const userPrompt = `送礼对象：${recipient}
当前步数：第 ${stepIndex + 1} 题（目标共 4-5 题）
最新回答记录：
${historyMessages.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n')}

请生成下一道深度问题：`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.7, jsonMode: true, timeout: 8000 }
    )

    const parsed = JSON.parse(raw)
    return sanitizeAiStep(parsed, answers, stepIndex)
  } catch (err) {
    console.warn('[AI Question Engine fallback]:', err)
    return getAdaptiveFallbackStep(answers, stepIndex)
  }
}

/**
 * 严格清洗适配器
 */
function sanitizeAiStep(raw, answers, stepIndex) {
  if (!raw || typeof raw !== 'object') {
    return getAdaptiveFallbackStep(answers, stepIndex)
  }

  if (raw.is_ready === true) {
    return { isReady: true }
  }

  const key = String(raw.key || `step_${stepIndex}`).trim()
  const stage = ['discover', 'preference', 'story', 'shape'].includes(raw.stage) ? raw.stage : 'preference'
  const type = ['single', 'multi', 'text'].includes(raw.type) ? raw.type : 'single'

  const question = String(raw.question || '').trim() || '我们继续聊聊 TA 的生活细节与心愿～'
  const messages = [question]

  // 保证 options 安全且每个都是纯正中文
  let options = []
  if (type !== 'text' && Array.isArray(raw.options) && raw.options.length > 0) {
    options = raw.options
      .slice(0, 6)
      .map((opt) => {
        let val = String(opt.value || opt.label || opt).trim()
        let lbl = String(opt.label || opt.value || opt).trim()
        let emj = String(opt.emoji || '✨').trim()

        const lowerVal = val.toLowerCase()
        const lowerLbl = lbl.toLowerCase()
        if (EN_ZH_MAP[lowerVal]) {
          val = EN_ZH_MAP[lowerVal]
          lbl = EN_ZH_MAP[lowerVal]
        } else if (EN_ZH_MAP[lowerLbl]) {
          val = EN_ZH_MAP[lowerLbl]
          lbl = EN_ZH_MAP[lowerLbl]
        } else if (/^[a-zA-Z\s_-]+$/.test(lbl)) {
          return null
        }

        return { value: val, label: lbl, emoji: emj }
      })
      .filter(Boolean)
  }

  if (type !== 'text' && !options.length) {
    options = getDefaultDeepOptions(answers.recipient, stepIndex)
  }

  return {
    id: `deep_ai_step_${stepIndex}_${key}`,
    stage,
    key,
    type,
    messages,
    options,
    allowCustom: raw.allow_custom !== false,
    placeholder: String(raw.placeholder || '自由输入补充细节…'),
    skippable: raw.skippable !== false,
    isReady: false,
  }
}

/**
 * 深度兜底题库（步步深入，4 步覆盖全面）
 */
function getAdaptiveFallbackStep(answers, stepIndex) {
  const recipient = answers.recipient || 'TA'
  const rel = classifyRelationship(recipient)

  if (stepIndex === 1) {
    // 第 2 题：深挖生活痛点与日常场景
    if (rel === 'elder') {
      return {
        id: 'fallback_elder_pain',
        stage: 'discover',
        key: 'pain_point',
        type: 'single',
        messages: ['在父母/长辈的日常生活中，你最想帮他们改善或分担的是哪一类具体场景？'],
        options: [
          { value: '家务操劳 / 弯腰清洁与备菜做饭繁琐', label: '家务清洁 / 弯腰拖地下厨操劳', emoji: '🧹' },
          { value: '身体舒缓 / 日常容易疲惫需要放松', label: '身体舒缓 / 日常放松呵护', emoji: '💆' },
          { value: '精神陪伴 / 想要生活有点温暖念想', label: '精神陪伴 / 温暖念想回忆', emoji: '📷' },
          { value: '食疗滋补 / 养生调理与起居舒适', label: '食疗滋补 / 养生起居舒适', emoji: '🍵' },
        ],
        allowCustom: true,
        placeholder: '也可以直接写长辈平时最操劳或最需要的事…',
      }
    }
    return {
      id: 'fallback_lover_scene',
      stage: 'discover',
      key: 'occasion_scene',
      type: 'single',
      messages: [`这次给【${recipient}】选礼，最核心的契机或心愿是什么？`],
      options: [
        { value: '特别日子庆祝（生日 / 纪念日 / 节日）', label: '特别节日 / 生日纪念', emoji: '🎂' },
        { value: '日常浪漫小确幸（想宠 TA 带来惊喜）', label: '日常小确幸 / 浪漫惊喜', emoji: '✨' },
        { value: '心意表达（感谢陪伴 / 缓和关系 / 道歉）', label: '心意表达 / 感谢与弥补', emoji: '💌' },
        { value: '实用升级（帮 TA 解决某个具体生活需求）', label: '实用升级 / 解决需求', emoji: '🛋️' },
      ],
      allowCustom: true,
    }
  }

  if (stepIndex === 2) {
    // 第 3 题：深挖精神诉求与期望感受
    return {
      id: 'fallback_feeling_story',
      stage: 'story',
      key: 'memory_feeling',
      type: 'single',
      messages: ['TA 拆开礼物那一刻，你最希望 TA 心里涌起什么样的感受？或者 TA 最近提过什么心愿？'],
      options: [
        { value: '被深深理解与体贴照顾，觉得特别踏实温暖', label: '被深深理解，觉得温暖踏实', emoji: '🧣' },
        { value: '眼前一亮，体验到从未试过的全新生活品质', label: '眼前一亮，惊喜万分', emoji: '🎉' },
        { value: '睹物思人，每次看到都能感受到满满的陪伴与牵挂', label: '睹物思人，感受到满满牵挂', emoji: '📷' },
        { value: '纯粹的开怀大笑，感到轻松愉悦无负担', label: '轻松愉悦，纯粹开怀大笑', emoji: '😄' },
      ],
      allowCustom: true,
      placeholder: '可以写写 TA 最近念叨过的心愿或你们的回忆…',
    }
  }

  // 第 4 题：预算与呈现形式
  return {
    id: 'fallback_budget_format',
    stage: 'shape',
    key: 'budget',
    type: 'single',
    messages: ['在礼物形式与预算上，你期望的核心发力点在哪里？'],
    options: [
      { value: '¥100–300 轻盈心意好物', label: '¥100–300 轻盈小而美', emoji: '🌱' },
      { value: '¥300–600 黄金品质大件', label: '¥300–600 黄金品质款', emoji: '✨' },
      { value: '¥600–1200 尊享体面重礼', label: '¥600–1200 尊享重礼', emoji: '🎁' },
      { value: '沉浸式体验 / 线下放松方案', label: '线下体验 / 舒缓放松', emoji: '🧖' },
    ],
    allowCustom: true,
  }
}

function getDefaultDeepOptions(recipient, stepIndex) {
  const rel = classifyRelationship(recipient)
  if (rel === 'elder') {
    return [
      { value: '家务减负 / 实用智能好物', label: '家务减负 / 实用省心', emoji: '🧹' },
      { value: '身体舒缓 / 按摩与理疗体验', label: '身体舒缓 / 理疗放松', emoji: '💆' },
      { value: '食疗养生 / 滋补调理茶饮', label: '食疗养生 / 滋补茶饮', emoji: '🍵' },
      { value: '回忆念想 / 专属照片定制', label: '回忆念想 / 照片定制', emoji: '📷' },
    ]
  }
  return [
    { value: '高质感实用好物', label: '高质感实用好物', emoji: '✨' },
    { value: '浪漫走心专属纪念', label: '浪漫走心专属纪念', emoji: '💍' },
    { value: '治愈解压生活美学', label: '治愈解压生活美学', emoji: '🕯️' },
    { value: '双人沉浸式美好体验', label: '双人沉浸式体验', emoji: '🥂' },
  ]
}
