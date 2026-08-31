/**
 * ══════════════════════════════════════════════════════════════
 *  AI 动态出题与防崩溃适配引擎 (AI Question Engine & Ironclad Adapter)
 *  —— 由 Xiaomi MiMo & DeepSeek 全权主导出题：
 *     1. 纯中文输出：严格过滤所有外语英文单词（绝不出现 circulation / posture 等英文）；
 *     2. 拒绝自以为是的主观预设（不主观臆断长辈腰酸背痛，提供开放、多元的健康与生活维度）；
 *     3. 强力格式清洗与保底适配器，100% 确保 Vue 前端组件零报错；
 *     4. 关系感知与安全兜底。
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
    '你好呀 👋 我是 GiftMind，你的 AI 私人挑礼策划师。先告诉我，这次想送给谁？',
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

/** 英文选项通用中文字典映射（防止大模型漏出英文） */
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
 * 询问大模型生成下一道深度动态题目
 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1) {
  const filledKeys = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '')
  const answeredCount = filledKeys.length

  // 如果已经问了 4 题以上且预算和场合均已明晰，即可准备生成
  if (answeredCount >= 4 && answers.budget && answers.occasion) {
    return { isReady: true }
  }

  const recipient = answers.recipient || 'TA'
  const relType = classifyRelationship(recipient)

  const relationshipRules = {
    elder: '当前对象为【父母 / 长辈】。严禁出现情人节、恋爱纪念、宠TA等情侣词汇！围绕孝顺父母、长辈寿辰、过节聚会、日常尽孝、健康滋补展开。切忌主观臆断长辈一定有特定病症或腰酸背痛，保持多元开放！',
    lover: '当前对象为【恋人 / 伴侣】。围绕情人节七夕、生日、恋爱纪念日、浪漫惊喜、两人共同回忆展开！',
    work: '当前对象为【职场同事 / 领导 / 合作伙伴】。严禁过于暧昧的词汇！围绕升职跳槽、退休离职欢送、商务拜访、节日体面答谢展开！',
    junior: '当前对象为【孩子 / 晚辈】。围绕生日、升学考学、儿童节、新年成长礼物展开！',
    friend: '当前对象为【朋友 / 闺蜜】。围绕朋友生日、乔迁新居、聚会惊喜、陪伴感谢展开！',
  }[relType]

  const systemPrompt = `你是精通人情世故、懂生活品味的资深私人挑礼买手 GiftMind。
你需要像一个极其懂行的朋友一样，通过自然对话为用户挑选最适合【${recipient}】的礼物。

【核心底线规则（必须严格遵守）】：
1. 纯中文输出：选项、问题、评语必须全部为纯正规范的中文，【绝对严禁输出任何未经翻译的英文单词（如 circulation / posture 等）】！
2. 严禁主观臆断与狭隘预设：不要在用户未明确提及前，自以为是地预设长辈就一定腰酸背痛或失眠！选项要覆盖日常食疗、居家舒适、温和放松、智能便利等多个健康与生活维度。
3. 人伦规范：${relationshipRules}

【当前已知信息】：
${JSON.stringify(answers, null, 2)}

【任务】：
根据用户已透露的信息，提出下一道最具启发性的追问。
1. 给出一句自然、懂行、有共鸣的短评 comment（30字以内），然后提出针对性问题 question。
2. 提供 4~5 个符合中文表达习惯的具体选项 options（每个包含 value, label, emoji，严禁英文）。
3. 判断当前信息是否足够生成完整方案（is_ready: boolean）。

必须输出严格 JSON 格式：
{
  "comment": "高情商点评/接话（纯中文，30字以内）",
  "question": "针对具体维度的下一问（纯中文）",
  "key": "下一个收集的字段名（如 budget / personality / occasion / memory / feeling）",
  "stage": "discover / preference / story / shape",
  "type": "single 或者 multi 或者 text",
  "options": [
    { "value": "纯中文选项值", "label": "纯中文选项文本", "emoji": "🏮" }
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
 * 🛡️ 严格清洗适配器（清除纯英文选项，确保 100% 纯中文与零报错）
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
  if (!messages.length) messages.push('我们继续聊聊 TA 的偏好与细节～')

  // 保证 options 安全且每个都是纯正中文
  let options = []
  if (type !== 'text' && Array.isArray(raw.options) && raw.options.length > 0) {
    options = raw.options
      .slice(0, 6)
      .map((opt) => {
        let val = String(opt.value || opt.label || opt).trim()
        let lbl = String(opt.label || opt.value || opt).trim()
        let emj = String(opt.emoji || '✨').trim()

        // 英文自动翻译与过滤
        const lowerVal = val.toLowerCase()
        const lowerLbl = lbl.toLowerCase()
        if (EN_ZH_MAP[lowerVal]) {
          val = EN_ZH_MAP[lowerVal]
          lbl = EN_ZH_MAP[lowerVal]
        } else if (EN_ZH_MAP[lowerLbl]) {
          val = EN_ZH_MAP[lowerLbl]
          lbl = EN_ZH_MAP[lowerLbl]
        } else if (/^[a-zA-Z\s_-]+$/.test(lbl)) {
          // 如果依然是未收录的纯英文单词，跳过此残缺选项
          return null
        }

        return {
          value: val,
          label: lbl,
          emoji: emj,
        }
      })
      .filter(Boolean)
  }

  // 如果 options 被过滤完且不是 text 题，根据关系和 key 补充规范中文选项
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
        { value: '退休 / 康养休闲', label: '退休 / 康养休闲', emoji: '🍵' },
        { value: '日常孝敬关怀', label: '日常孝敬爸妈', emoji: '🧣' },
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
        { value: '好朋友生日', label: '好朋友生日', emoji: '🎂' },
        { value: '乔迁新居庆祝', label: '乔迁新居庆祝', emoji: '🏡' },
        { value: '毕业 / 升职突破', label: '毕业 / 升职突破', emoji: '🎓' },
        { value: '伴娘 / 伴郎答谢', label: '伴娘 / 伴郎答谢', emoji: '💌' },
        { value: '日常投喂惊喜', label: '日常姐妹/兄弟心意', emoji: '✨' },
      ],
    }[rel]

    return {
      id: `ai_fallback_${stepIndex}_occasion`,
      stage: 'discover',
      key: 'occasion',
      type: 'single',
      messages: [`这次给【${recipient}】选礼，主要是什么场合或由头呢？`],
      options: occasionOptions,
      allowCustom: true,
      placeholder: '或者直接输入特别的日子…',
      skippable: true,
      isReady: false,
    }
  }

  // 2. 预算追问
  if (!answers.budget) {
    return {
      id: `ai_fallback_${stepIndex}_budget`,
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['大致期望的预算范围是多少呢？'],
      options: [
        { value: '100-300元', label: '¥100–300 轻微心意', emoji: '🌱' },
        { value: '300-600元', label: '¥300–600 黄金区间', emoji: '✨' },
        { value: '600-1200元', label: '¥600–1200 品质大礼', emoji: '🎁' },
        { value: '1200元以上', label: '¥1200+ 尊享重礼', emoji: '👑' },
      ],
      allowCustom: true,
      placeholder: '也可以直接输入具体预算数字…',
      skippable: true,
      isReady: false,
    }
  }

  // 3. 偏好追问
  return {
    id: `ai_fallback_${stepIndex}_personality`,
    stage: 'preference',
    key: 'personality',
    type: 'single',
    messages: [`在为【${recipient}】选品时，你更看重哪类方向？`],
    options: getDefaultOptionsForRel(recipient, 'personality'),
    allowCustom: true,
    placeholder: '说说 TA 平时的具体偏好或生活习惯…',
    skippable: true,
    isReady: false,
  }
}

function getDefaultOptionsForRel(recipient, key) {
  const rel = classifyRelationship(recipient)
  if (rel === 'elder') {
    return [
      { value: '日常食疗滋补 / 养生茶饮', label: '食疗滋补 / 养生茶饮', emoji: '🍵' },
      { value: '居家省力 / 减负便利好物', label: '居家省力 / 减负好物', emoji: '🧹' },
      { value: '起居舒适 / 贴心品质呵护', label: '起居舒适 / 品质呵护', emoji: '🛏️' },
      { value: '温和放松 / 缓解日常疲劳', label: '温和放松 / 舒缓疲劳', emoji: '🌿' },
    ]
  }
  if (rel === 'lover') {
    return [
      { value: '浪漫仪式感 / 走心纪念', label: '浪漫仪式感 / 纪念', emoji: '🌹' },
      { value: '精致首饰 / 生活美学', label: '精致首饰 / 美学', emoji: '💍' },
      { value: '硬核数码 / 体验升级', label: '硬核数码 / 外设', emoji: '🎧' },
      { value: '高颜值实用 / 居家好物', label: '高颜值居家实用', emoji: '✨' },
    ]
  }
  return [
    { value: '实用省心 / 品质升级', label: '实用省心 / 品质升级', emoji: '🛋️' },
    { value: '设计美学 / 小众格调', label: '设计美学 / 小众格调', emoji: '🎨' },
    { value: '趣味惊喜 / 治愈解压', label: '趣味惊喜 / 治愈解压', emoji: '😄' },
    { value: '健康舒缓 / 放松生活', label: '健康舒缓 / 放松生活', emoji: '🌿' },
  ]
}
