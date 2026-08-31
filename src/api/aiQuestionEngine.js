/**
 * ══════════════════════════════════════════════════════════════
 *  AI 动态出题与防崩溃适配引擎 (AI Question Engine & Ironclad Adapter)
 *  —— 由 Xiaomi MiMo (mimo-v2.5-pro-ultraspeed) 全权主导出题：
 *     1. 彻底告别死板问卷，根据上下文见招拆招；
 *     2. 智能画像槽位收集（Slot-Filling）；
 *     3. 强力格式清洗与保底适配器，100% 确保 Vue 前端组件零报错；
 *     4. 毫秒级超时熔断与自愈机制。
 * ══════════════════════════════════════════════════════════════
 */
import { callMiMo } from './mimoService'

/** 初始第一题（0 延迟秒开，引导建立送礼对象） */
export const INITIAL_STEP = {
  id: 'recipient',
  stage: 'discover',
  key: 'recipient',
  type: 'single',
  messages: [
    '你好呀 👋 我是 GiftMind，你的 AI 私人挑礼策划师。',
    '接下来我将根据你的实际情况为你量身挑选最懂 TA 的方案。\n\n先说说，这次想送给谁？',
  ],
  options: [
    { value: '女朋友 / 妻子', label: '女朋友 / 妻子', emoji: '💗' },
    { value: '男朋友 / 丈夫', label: '男朋友 / 丈夫', emoji: '💙' },
    { value: '父母 / 长辈', label: '父母 / 长辈', emoji: '🏡' },
    { value: '闺蜜 / 好友', label: '闺蜜 / 好友', emoji: '🤝' },
    { value: '同事 / 领导', label: '同事 / 领导', emoji: '🧑‍💼' },
    { value: '孩子 / 晚辈', label: '孩子 / 晚辈', emoji: '🎈' },
  ],
  allowCustom: true,
  placeholder: '也可以直接告诉我 TA 是谁…',
}

/** 核心槽位检查清单 */
const CORE_SLOTS = [
  { key: 'occasion', label: '场合/理由', stage: 'discover' },
  { key: 'budget', label: '预算区间', stage: 'preference' },
  { key: 'personality', label: '性格与爱好', stage: 'preference' },
  { key: 'taboo', label: '避雷禁忌', stage: 'preference' },
  { key: 'memory', label: '特别故事/心愿', stage: 'story' },
  { key: 'feeling', label: '拆礼期待感受', stage: 'story' },
]

/**
 * 询问大模型生成下一道深度动态题目
 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1) {
  // 检查已填槽位
  const filledKeys = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '')
  const answeredCount = filledKeys.length

  // 如果已经问了 5 题以上且核心信息基本满足，即可收尾
  if (answeredCount >= 5 && answers.budget && answers.occasion) {
    return { isReady: true }
  }

  const recipient = answers.recipient || 'TA'
  const occasion = answers.occasion || ''
  const budget = answers.budget || ''

  const systemPrompt = `你是精通人情世故、懂生活、懂品味的资深礼物买手 GiftMind。
你需要像一个极其懂行的朋友一样，通过自然对话为用户挑选最适合【${recipient}】的礼物。

【当前已知信息】：
${JSON.stringify(answers, null, 2)}

【已回答题数】：${stepIndex}
【任务】：
请根据用户已透露的所有细节，提出下一道最关键、最具洞察力的追问。
要求：
1. 必须根据具体语境见招拆招（例如用户说是情人节送男友，要根据男友的可能爱好和情人节仪式感来设计深度提问，绝不生硬死板）。
2. 先给出一句极其自然、懂行、有共鸣的短接话 comment（30字以内），然后提出针对性问题 question。
3. 提供 4~6 个极其贴合当前问题的具体选项 options（包含 value, label, emoji）。
4. 判断当前收集到的信息是否已经足够生成完美方案（is_ready: boolean，一般第 4~5 题且有预算、场合和偏好时设为 true）。

必须输出严格 JSON 格式：
{
  "comment": "高情商点评/接话（如：情人节送男友，高质感实用小物和浪漫仪式感永远是最佳组合！）",
  "question": "具体下一问（如：他平时更偏向哪种生活状态或爱好？）",
  "key": "下一个收集的字段名（如 occasion / budget / personality / taboo / memory / feeling）",
  "stage": "discover / preference / story / shape",
  "type": "single 或者 multi 或者 text",
  "options": [
    { "value": "选项值", "label": "选项文本", "emoji": "🎨" }
  ],
  "allow_custom": true,
  "placeholder": "自由输入提示词...",
  "skippable": true,
  "is_ready": false
}`

  const userPrompt = `用户最新对话历史：
${historyMessages.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n')}

请给出下一题：`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.75, jsonMode: true, timeout: 3200 }
    )

    const parsed = JSON.parse(raw)
    return sanitizeAiStep(parsed, answers, stepIndex)
  } catch (err) {
    console.warn('[AI Question Engine fallback to adaptive rule]:', err)
    return getAdaptiveFallbackStep(answers, stepIndex)
  }
}

/**
 * 🛡️ 严格清洗适配器（确保输出 100% 兼容现有 Vue UI 模板）
 */
function sanitizeAiStep(raw, answers, stepIndex) {
  if (!raw || typeof raw !== 'object') {
    return getAdaptiveFallbackStep(answers, stepIndex)
  }

  if (raw.is_ready === true) {
    return { isReady: true }
  }

  const key = String(raw.key || 'personality').trim()
  const stage = ['discover', 'preference', 'story', 'shape'].includes(raw.stage) ? raw.stage : 'preference'
  const type = ['single', 'multi', 'text'].includes(raw.type) ? raw.type : 'single'

  const comment = String(raw.comment || '').trim()
  const question = String(raw.question || '').trim()
  const messages = [comment, question].filter(Boolean)
  if (!messages.length) messages.push('我们继续聊聊 TA 的喜好～')

  // 保证 options 安全且每个都有 emoji 和 label
  let options = []
  if (type !== 'text' && Array.isArray(raw.options) && raw.options.length > 0) {
    options = raw.options.slice(0, 6).map((opt) => ({
      value: String(opt.value || opt.label || opt).trim(),
      label: String(opt.label || opt.value || opt).trim(),
      emoji: String(opt.emoji || '✨').trim(),
    })).filter((opt) => opt.label)
  }

  // 如果 options 为空且不是 text 题，根据 key 补充兜底选项
  if (type !== 'text' && !options.length) {
    options = getDefaultOptionsForKey(key)
  }

  return {
    id: `ai_step_${stepIndex}_${key}`,
    stage,
    key,
    type,
    messages,
    options,
    allowCustom: raw.allow_custom !== false,
    placeholder: String(raw.placeholder || '直接告诉我…'),
    skippable: raw.skippable !== false,
    isReady: false,
  }
}

/**
 * 本地智能上下文兜底题（网络抖动时 0 毫秒秒切，绝不卡死）
 */
function getAdaptiveFallbackStep(answers, stepIndex) {
  const recipient = answers.recipient || 'TA'

  if (!answers.occasion) {
    return {
      id: `fallback_occasion_${stepIndex}`,
      stage: 'discover',
      key: 'occasion',
      type: 'single',
      messages: ['明白。这次送礼是什么场合或特别日子呢？'],
      options: [
        { value: '生日', label: '生日庆祝', emoji: '🎂' },
        { value: '纪念日', label: '恋爱/结婚纪念日', emoji: '💍' },
        { value: '节日', label: '情人节 / 节日', emoji: '🌹' },
        { value: '升职 / 毕业', label: '升职 / 毕业突破', emoji: '🎓' },
        { value: '道歉 / 和好', label: '道歉 / 想弥补', emoji: '🕊️' },
        { value: '平时惊喜', label: '没有理由，就想宠 TA', emoji: '✨' },
      ],
      allowCustom: true,
      skippable: false,
    }
  }

  if (!answers.budget) {
    return {
      id: `fallback_budget_${stepIndex}`,
      stage: 'preference',
      key: 'budget',
      type: 'single',
      messages: ['预算大概在什么区间？给我一个大致范围就行～'],
      options: [
        { value: '¥100–300', label: '¥100–300（轻盈心意）', emoji: '🌱' },
        { value: '¥300–600', label: '¥300–600（质感轻奢）', emoji: '✨' },
        { value: '¥600–1500', label: '¥600–1500（精致大件）', emoji: '🎁' },
        { value: '¥1500 以上', label: '¥1500 以上（高定专属）', emoji: '👑' },
        { value: '不设上限', label: '不设上限，看方案', emoji: '🫶' },
      ],
      allowCustom: true,
      skippable: false,
    }
  }

  if (!answers.personality) {
    return {
      id: `fallback_personality_${stepIndex}`,
      stage: 'preference',
      key: 'personality',
      type: 'multi',
      minSelect: 1,
      maxSelect: 4,
      messages: [`${recipient} 平时是个什么样的人？挑几个最贴近的标签（可多选）～`],
      options: [
        { value: '数码 / 科技控', label: '数码 / 科技控', emoji: '⌨️' },
        { value: '文艺 / 爱阅读', label: '文艺 / 爱阅读', emoji: '📚' },
        { value: '户外 / 爱运动', label: '户外 / 爱运动', emoji: '🏃' },
        { value: '咖啡 / 美食家', label: '咖啡 / 美食家', emoji: '☕' },
        { value: '时尚 / 潮流穿搭', label: '时尚 / 潮流穿搭', emoji: '👟' },
        { value: '居家 / 温柔治愈', label: '居家 / 温柔治愈', emoji: '🕯️' },
      ],
      allowCustom: true,
      placeholder: '还有其他特点？直接写…',
      skippable: true,
    }
  }

  if (!answers.memory) {
    return {
      id: `fallback_memory_${stepIndex}`,
      stage: 'story',
      key: 'memory',
      type: 'text',
      messages: [
        '最后这个问题最关键 💡',
        '你们之间有没有特别的故事、梗，或者 TA 最近念叨过想要的东西？哪怕只是一句话，也会让方案精准很多。',
      ],
      placeholder: '比如：TA 最近总说脖子酸；或者我们经常一起去露营…',
      skippable: true,
    }
  }

  return { isReady: true }
}

function getDefaultOptionsForKey(key) {
  if (key === 'occasion') {
    return [
      { value: '生日', label: '生日', emoji: '🎂' },
      { value: '纪念日', label: '纪念日', emoji: '💍' },
      { value: '节日', label: '节日', emoji: '🎄' },
      { value: '平时惊喜', label: '平时惊喜', emoji: '✨' },
    ]
  }
  if (key === 'budget') {
    return [
      { value: '¥100–300', label: '¥100–300', emoji: '🌱' },
      { value: '¥300–600', label: '¥300–600', emoji: '✨' },
      { value: '¥600–1500', label: '¥600–1500', emoji: '🎁' },
      { value: '¥1500 以上', label: '¥1500 以上', emoji: '👑' },
    ]
  }
  return [
    { value: '品质实用', label: '品质实用', emoji: '💼' },
    { value: '浪漫惊喜', label: '浪漫惊喜', emoji: '🌹' },
    { value: '小众设计', label: '小众设计', emoji: '🎨' },
    { value: '健康陪伴', label: '健康陪伴', emoji: '🌿' },
  ]
}
