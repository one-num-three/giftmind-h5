/**
 * ══════════════════════════════════════════════════════════════
 *  AI 动态出题与防崩溃适配引擎 (AI Question Engine & Ironclad Adapter)
 *  —— 由 Xiaomi MiMo (mimo-v2.5-pro-ultraspeed) 全权主导出题：
 *     1. 彻底告别死板问卷，根据关系（长辈/伴侣/朋友/同事/晚辈）严格见招拆招；
 *     2. 严禁对象与场景张冠李戴（长辈绝不出现情人节/宠TA，同事绝不出现恋爱纪念）；
 *     3. 强力格式清洗与保底适配器，100% 确保 Vue 前端组件零报错；
 *     4. 充足超时保护（8秒）与精准关系动态兜底矩阵。
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

/** 关系类型分类器 */
export function classifyRelationship(recipient = '') {
  const r = String(recipient || '')
  if (r.includes('父') || r.includes('母') || r.includes('长辈') || r.includes('爸') || r.includes('妈') || r.includes('爷爷') || r.includes('奶奶') || r.includes('姥') || r.includes('公') || r.includes('婆')) {
    return 'elder' // 父母长辈
  }
  if (r.includes('女') || r.includes('妻') || r.includes('男') || r.includes('夫') || r.includes('对象') || r.includes('爱人') || r.includes('情侣') || r.includes('暗恋')) {
    return 'lover' // 伴侣/恋人
  }
  if (r.includes('同事') || r.includes('领导') || r.includes('客户') || r.includes('老板') || r.includes('上司') || r.includes('下属')) {
    return 'work' // 职场同事
  }
  if (r.includes('孩子') || r.includes('晚辈') || r.includes('学生') || r.includes('儿子') || r.includes('女儿') || r.includes('侄') || r.includes('外甥')) {
    return 'junior' // 孩子晚辈
  }
  return 'friend' // 朋友闺蜜
}

/**
 * 询问大模型生成下一道深度动态题目
 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1) {
  // 检查已填槽位
  const filledKeys = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '')
  const answeredCount = filledKeys.length

  // 如果已经问了 4~5 题且核心信息（预算、场合、偏好）基本满足，即可收尾
  if (answeredCount >= 4 && answers.budget && answers.occasion) {
    return { isReady: true }
  }

  const recipient = answers.recipient || 'TA'
  const relType = classifyRelationship(recipient)

  const relationshipRules = {
    elder: '当前对象为【父母 / 长辈】。严禁出现情人节、恋爱纪念、宠TA等情侣词汇！必须围绕孝顺父母、长辈寿辰、中秋春节过节、父亲节母亲节、健康养生、日常尽孝关怀展开！',
    lover: '当前对象为【恋人 / 伴侣】。围绕情人节七夕、生日、恋爱纪念日、浪漫惊喜、两人共同回忆展开！',
    work: '当前对象为【职场同事 / 领导 / 合作伙伴】。严禁过于暧昧的词汇！围绕升职跳槽、退休离职欢送、商务拜访、节日体面答谢展开！',
    junior: '当前对象为【孩子 / 晚辈】。围绕生日、升学考学、儿童节、新年成长礼物展开！',
    friend: '当前对象为【朋友 / 闺蜜】。围绕朋友生日、乔迁新居、聚会惊喜、陪伴感谢展开！',
  }[relType]

  const systemPrompt = `你是精通人情世故、懂生活品味的资深私人挑礼买手 GiftMind。
你需要像一个极其懂行的朋友一样，通过自然对话为用户挑选最适合【${recipient}】的礼物。

【核心人伦规则（绝不可违背）】：
${relationshipRules}

【当前已知信息】：
${JSON.stringify(answers, null, 2)}

【任务】：
请根据用户已透露的所有细节，提出下一道最关键、最具洞察力的追问。
要求：
1. 必须根据具体语境见招拆招（例如送父母，要根据长辈的生活痛点和健康需求来设计深度提问，绝不生硬死板）。
2. 先给出一句极其自然、懂行、有共鸣的短接话 comment（30字以内），然后提出针对性问题 question。
3. 提供 4~6 个极其贴合当前关系身份与问题的具体选项 options（包含 value, label, emoji）。
4. 判断当前收集到的信息是否已经足够生成完美方案（is_ready: boolean）。

必须输出严格 JSON 格式：
{
  "comment": "高情商点评/接话（30字以内）",
  "question": "针对关系身份的具体下一问",
  "key": "下一个收集的字段名（如 occasion / budget / personality / taboo / memory / feeling）",
  "stage": "discover / preference / story / shape",
  "type": "single 或者 multi 或者 text",
  "options": [
    { "value": "选项值", "label": "选项文本", "emoji": "🏮" }
  ],
  "allow_custom": true,
  "placeholder": "自由输入提示词...",
  "skippable": true,
  "is_ready": false
}`

  const userPrompt = `送礼对象：${recipient}
用户最新回答记录：
${historyMessages.slice(-4).map((m) => `${m.role}: ${m.text}`).join('\n')}

请生成下一题：`

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
    console.warn('[AI Question Engine fallback to relationship-aware rule]:', err)
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

  // 如果 options 为空且不是 text 题，根据关系和 key 补充兜底选项
  if (type !== 'text' && !options.length) {
    options = getDefaultOptionsForRel(answers.recipient, key)
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
 * 关系感知的高智能本地兜底题（网络抖动时 0 毫秒秒切，绝对符合人伦身份）
 */
function getAdaptiveFallbackStep(answers, stepIndex) {
  const recipient = answers.recipient || 'TA'
  const rel = classifyRelationship(recipient)

  // 1. 场合追问
  if (!answers.occasion) {
    const occasionOptions = {
      elder: [
        { value: '母亲节 / 父亲节', label: '母亲节 / 父亲节', emoji: '💐' },
        { value: '中秋 / 春节年节', label: '中秋 / 春节过节', emoji: '🏮' },
        { value: '长辈寿辰 / 生日', label: '长辈寿辰 / 生日', emoji: '🎂' },
        { value: '银婚 / 金婚纪念', label: '父母结婚纪念日', emoji: '👵👴' },
        { value: '退休 / 康养休假', label: '退休 / 康养休假', emoji: '🍵' },
        { value: '日常孝敬关怀', label: '没有特别日子，就想孝敬爸妈', emoji: '🧣' },
      ],
      lover: [
        { value: '情人节 / 七夕', label: '情人节 / 七夕', emoji: '🌹' },
        { value: 'TA的生日', label: 'TA 的生日', emoji: '🎂' },
        { value: '恋爱 / 结婚纪念日', label: '恋爱 / 结婚纪念日', emoji: '💍' },
        { value: '道歉 / 想弥补', label: '道歉 / 和好', emoji: '🕊️' },
        { value: '日常浪漫惊喜', label: '没有理由，就想宠 TA', emoji: '✨' },
      ],
      work: [
        { value: '升职 / 调动', label: '升职 / 事业调动', emoji: '💼' },
        { value: '离职 / 退休欢送', label: '离职 / 退休欢送', emoji: '🤝' },
        { value: '商务拜访 / 答谢', label: '商务拜访 / 合作感谢', emoji: '🍵' },
        { value: '中秋 / 元旦过节', label: '中秋 / 元旦节日礼', emoji: '🏮' },
        { value: '生日庆祝', label: '同事生日庆祝', emoji: '🎂' },
      ],
      junior: [
        { value: '儿童节 / 生日', label: '儿童节 / 生日', emoji: '🎈' },
        { value: '升学 / 考学奖励', label: '开学 / 升学奖励', emoji: '🎒' },
        { value: '成长特别纪念', label: '成长特别纪念', emoji: '🌟' },
        { value: '新年压岁礼物', label: '新年压岁礼物', emoji: '🧧' },
      ],
      friend: [
        { value: '朋友生日', label: '好朋友生日', emoji: '🎂' },
        { value: '乔迁新居', label: '乔迁新居', emoji: '🏡' },
        { value: '毕业 / 升职突破', label: '毕业 / 升职突破', emoji: '🎓' },
        { value: '伴娘 / 伴郎感谢', label: '伴娘 / 伴郎感谢', emoji: '💌' },
        { value: '平时聚会惊喜', label: '日常姐妹/兄弟心意', emoji: '✨' },
      ],
    }[rel]

    return {
      id: `fallback_occasion_${stepIndex}`,
      stage: 'discover',
      key: 'occasion',
      type: 'single',
      messages: [`明白。这次给${recipient}送礼，是什么场合或特别日子呢？`],
      options: occasionOptions,
      allowCustom: true,
      skippable: false,
    }
  }

  // 2. 预算追问
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

  // 3. 偏好/性格追问
  if (!answers.personality) {
    const personalityOptions = {
      elder: [
        { value: '注重健康 / 养生保健', label: '注重健康 / 养生', emoji: '🍵' },
        { value: '节俭朴实 / 喜欢实用', label: '节俭朴实 / 讲究实用', emoji: '🧺' },
        { value: '爱下厨 / 美食家务', label: '爱下厨 / 家务操劳', emoji: '🍳' },
        { value: '爱散步 / 广场舞健身', label: '爱散步 / 晨练健身', emoji: '👟' },
        { value: '爱品茶 / 书画园艺', label: '爱品茶 / 养花弄草', emoji: '🪴' },
        { value: '操心子女 / 容易失眠', label: '操心多 / 睡眠不好', emoji: '💤' },
      ],
      lover: [
        { value: '文艺 / 爱阅读', label: '文艺 / 爱阅读', emoji: '📚' },
        { value: '数码 / 科技控', label: '数码 / 科技控', emoji: '⌨️' },
        { value: '户外 / 爱运动', label: '户外 / 爱运动', emoji: '🏃' },
        { value: '咖啡 / 美食探店', label: '咖啡 / 美食探店', emoji: '☕' },
        { value: '时尚 / 潮流穿搭', label: '时尚 / 潮流穿搭', emoji: '👟' },
        { value: '居家 / 温柔治愈', label: '居家 / 温柔治愈', emoji: '🕯️' },
      ],
      work: [
        { value: '务实高效 / 商务精英', label: '务实高效 / 商务精英', emoji: '💼' },
        { value: '品茶 / 咖啡爱好者', label: '品茶 / 咖啡控', emoji: '☕' },
        { value: '数码外设 / 办公控', label: '数码外设 / 效率控', emoji: '⌨️' },
        { value: '低调稳重 / 讲究品味', label: '低调稳重 / 讲究品味', emoji: '🖋️' },
      ],
      junior: [
        { value: '爱乐高 / 拼装益智', label: '乐高 / 拼装积木', emoji: '🧩' },
        { value: '爱阅读 / 科普探索', label: '爱阅读 / 科普绘本', emoji: '📖' },
        { value: '爱运动 / 户外轮滑', label: '户外运动 / 活力四射', emoji: '🛹' },
        { value: '二次元 / 动漫潮玩', label: '动漫 / 潮玩手办', emoji: '🧸' },
      ],
      friend: [
        { value: '爱拍照 / 探店打卡', label: '爱拍照 / 探店打卡', emoji: '📷' },
        { value: '宅家追剧 / 游戏少女', label: '宅家追剧 / 游戏党', emoji: '🎮' },
        { value: '户外露营 / 自然系', label: '户外露营 / 自然系', emoji: '⛺' },
        { value: '美食控 / 甜食爱好者', label: '美食控 / 甜食爱好者', emoji: '🍰' },
      ],
    }[rel]

    return {
      id: `fallback_personality_${stepIndex}`,
      stage: 'preference',
      key: 'personality',
      type: 'multi',
      minSelect: 1,
      maxSelect: 4,
      messages: [`${recipient} 平时有哪些生活习惯或爱好？挑几个最贴近的（可多选）～`],
      options: personalityOptions,
      allowCustom: true,
      placeholder: '还有其他特点？直接写…',
      skippable: true,
    }
  }

  // 4. 回忆细节
  if (!answers.memory) {
    return {
      id: `fallback_memory_${stepIndex}`,
      stage: 'story',
      key: 'memory',
      type: 'text',
      messages: [
        '还有一个关键细节 💡',
        `TA 最近有没有随口念叨过缺什么、或者身体哪里不舒服？哪怕是一句日常小抱怨，也会让推荐极其贴心。`,
      ],
      placeholder: '比如：最近总说腰酸腿疼、睡眠浅；或者家里某个老旧电器不好用…',
      skippable: true,
    }
  }

  return { isReady: true }
}

function getDefaultOptionsForRel(recipient, key) {
  const rel = classifyRelationship(recipient)
  if (key === 'occasion') {
    if (rel === 'elder') {
      return [
        { value: '母亲节 / 父亲节', label: '母亲节 / 父亲节', emoji: '💐' },
        { value: '中秋 / 春节年节', label: '中秋 / 春节年节', emoji: '🏮' },
        { value: '长辈寿辰', label: '长辈寿辰', emoji: '🎂' },
        { value: '日常孝敬', label: '日常孝敬', emoji: '🧣' },
      ]
    }
    return [
      { value: '生日', label: '生日', emoji: '🎂' },
      { value: '节日', label: '节日', emoji: '🌹' },
      { value: '纪念日', label: '纪念日', emoji: '💍' },
      { value: '平时惊喜', label: '平时惊喜', emoji: '✨' },
    ]
  }
  return [
    { value: '品质健康', label: '品质健康', emoji: '🌿' },
    { value: '实用贴心', label: '实用贴心', emoji: '🧺' },
    { value: '高端体面', label: '高端体面', emoji: '🎁' },
    { value: '温暖陪伴', label: '温暖陪伴', emoji: '🧣' },
  ]
}
