/**
 * ══════════════════════════════════════════════════════════════
 *  深度 AI 动态出题引擎 (Deep AI Question Engine)
 *  —— 由顶级私人买手大模型驱动的 5~6 步深度见招拆招追问：
 *     1. 针对“潮玩公仔/动漫模型/自己动手拼装机甲”层层细化题材、玩法与特定心愿；
 *     2. 针对“长辈家务/身体舒缓/精神念想”多层次深挖痛点细节；
 *     3. 所有问题均自带「✍️ 其他 / 自定义输入…」选项，用户可随时输入个性化内容；
 *     4. 纯中文输出，零英文单词，严禁张冠李戴。
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
    '我会像最懂生活的朋友一样，通过几个深入的问题帮你理清头绪。\n\n先告诉我，这次想为谁挑选一份特别的心意？',
  ],
  options: [
    { value: '孩子 / 晚辈', label: '孩子 / 晚辈', emoji: '🎈' },
    { value: '父母 / 长辈', label: '父母 / 长辈', emoji: '🏡' },
    { value: '女朋友 / 妻子', label: '女朋友 / 妻子', emoji: '💗' },
    { value: '男朋友 / 丈夫', label: '男朋友 / 丈夫', emoji: '💙' },
    { value: '闺蜜 / 好友', label: '闺蜜 / 好友', emoji: '🤝' },
    { value: '同事 / 领导', label: '同事 / 领导', emoji: '🧑‍💼' },
  ],
  allowCustom: true,
  placeholder: '也可以直接告诉我 TA 是谁…',
}

/** 关系类型分类器 */
export function classifyRelationship(recipient = '') {
  const r = String(recipient || '')
  if (/父|母|长辈|爸|妈|老两口|公公|婆婆|爷爷|奶奶|姥/.test(r)) {
    return 'elder'
  }
  if (/孩|晚辈|学生|儿|女|侄|外甥|宝宝|童|弟|妹/.test(r)) {
    return 'junior'
  }
  if (/女|妻|男|夫|对象|爱人|情侣|暗恋/.test(r)) {
    return 'lover'
  }
  if (/同事|领导|客户|老板|上司|下属|商务/.test(r)) {
    return 'work'
  }
  return 'friend'
}

/** 英文选项映射表 */
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
  science: '科学探索 / 动手实验',
  creative: '艺术创想 / 手工搭建',
}

/**
 * 深度智能追问生成器
 */
export async function fetchNextDynamicQuestion(answers = {}, historyMessages = [], stepIndex = 1) {
  const filledKeys = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '')
  const answeredCount = filledKeys.length

  // 🌟 深度收集：经历 5 题充分了解用户后自然收敛（或者用户随时点击右上角看方案）
  if (answeredCount >= 6 || stepIndex >= 6) {
    return { isReady: true }
  }

  const recipient = answers.recipient || 'TA'
  const relType = classifyRelationship(recipient)

  const systemPrompt = `你是精通人情世故、极具生活品味与洞察力的资深私人买手顾问 GiftMind。
你需要根据用户上一轮的回答，像一个真正懂行、有经验的专业挑礼专家一样，【步步深入追问具体的场景与细节】，切忌浅尝辄止！

【深度追问指导原则】：
1. 若送【孩子/晚辈】：
   - 如果用户提到“潮玩/公仔/动手拼装机甲/模型”：下一问必须深入追问题材世界观（科幻机甲/机械积木/动漫周边），再深挖动手拼装难度（独立卡扣免胶/精密可动挑战/亲子合作），以及孩子心心念念的特定角色心愿！【严禁直接跳到预算草草收场】！
   - 如果用户提到“安静探索型/科学实验”：下一问必须深挖具体探索方向（天文望远镜/物理机械/科普立体书）；
2. 若送【父母/长辈】：
   - 深入追问是弯腰拖地地面清洁、一日三餐下厨繁重，还是颈椎腰背酸痛，抑或是想念孩子需要精神陪伴；
3. 【纯中文规范】：所有问题和选项必须为地道流畅的纯中文，【严禁出现任何英文单词】！
4. 必须提供 4~5 个具体生动的中文选项 options，并且全部支持用户自定义输入。

【当前已知信息】：
${JSON.stringify(answers, null, 2)}

必须输出严格 JSON 格式：
{
  "question": "深度针对性提问（亲切自然，具有启发性）",
  "key": "收集字段名（如 child_mech_style / detail_scenario / memory_wish / budget_form）",
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

  const userPrompt = `受礼人：${recipient}
当前步数：第 ${stepIndex + 1} 题（请继续向下深入挖掘细节，不要草率结束）
最新回答记录：
${historyMessages.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n')}

请生成下一道更深度的追问：`

  try {
    const raw = await callMiMo(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.75, jsonMode: true, timeout: 8000 }
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

  const question = String(raw.question || '').trim() || '我们继续深入聊聊 TA 的喜好细节与心愿～'
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
    allowCustom: true,
    placeholder: String(raw.placeholder || '其他想法 / 也可以直接输入…'),
    skippable: raw.skippable !== false,
    isReady: false,
  }
}

/**
 * 深度兜底题库（步步深入，多层次挖掘）
 */
function getAdaptiveFallbackStep(answers, stepIndex) {
  const recipient = answers.recipient || 'TA'
  const rel = classifyRelationship(recipient)
  const allAnswerText = JSON.stringify(answers)

  // ── 孩子/晚辈 专属深度路径 ──
  if (rel === 'junior') {
    if (stepIndex === 1) {
      return {
        id: 'child_step_1_trait',
        stage: 'discover',
        key: 'child_trait',
        type: 'single',
        messages: ['这个礼物是送给多大年龄的孩子？平时 TA 最着迷、最能沉下心玩的是哪一类？'],
        options: [
          { value: '潮玩动漫与动手模型 / 喜欢拼装机甲、手办与模型收藏', label: '潮玩模型 / 机甲与公仔', emoji: '🤖' },
          { value: '安静探索与益智探索 / 喜欢拼搭积木、科学实验与科普阅读', label: '科学探索 / 积木与阅读', emoji: '🔬' },
          { value: '动手创造与美育手工 / 喜欢画画黏土、美术艺术创想', label: '动手创造 / 美术与手工', emoji: '🎨' },
          { value: '活力户外与运动探险 / 喜欢户外探险、骑行与体能运动', label: '活力运动 / 户外探险', emoji: '🏃' },
        ],
        allowCustom: true,
        placeholder: '也可以直接告诉我孩子的具体年龄和爱好…',
      }
    }

    if (stepIndex === 2) {
      // 🌟 针对“拼装机甲/动手模型/潮玩公仔”深入题材
      if (/潮玩|公仔|动漫|模型|IP|盲盒|手办|机甲|拼装|动手/.test(allAnswerText)) {
        return {
          id: 'child_step_2_mech_theme',
          stage: 'preference',
          key: 'child_mech_theme',
          type: 'single',
          messages: ['在动手拼装与机甲模型方向上，TA 更着迷哪种具体的题材与世界观？平时有没有特别喜欢的形象？'],
          options: [
            { value: '科幻未来机甲 / 关节可动的酷炫拼装战甲（如 高达机甲/变形战甲）', label: '科幻机甲 / 高达可动机甲', emoji: '🤖' },
            { value: '机械科技积木 / 齿轮传动与机械空间搭建（如 动力机械组/微缩场景）', label: '科技积木 / 机械传动组', emoji: '⚙️' },
            { value: '热门动漫IP模型 / 正版动漫角色拼装（如 宝可梦拼装/奥特曼机甲）', label: '热门动漫 / 经典IP周边', emoji: '🌟' },
            { value: '软萌治愈公仔 / 正版手感极佳玩偶（如 Jellycat 趣味公仔/巴塞罗熊）', label: '毛绒玩偶 / Jellycat公仔', emoji: '🧸' },
          ],
          allowCustom: true,
          placeholder: '可以写写孩子最着迷的特定角色或形象…',
        }
      }

      return {
        id: 'child_step_2_deep_theme',
        stage: 'preference',
        key: 'child_theme',
        type: 'single',
        messages: ['在具体方向上，你更希望送一份偏重哪种体验或能力的礼物？孩子最近有没有心心念念的小心愿？'],
        options: [
          { value: '科学求知 / 激发探索欲的天文、实验或机械玩具', label: '科学探索 / 激发求知欲', emoji: '🔭' },
          { value: '空间建构 / 锻炼逻辑与耐心的精品拼搭积木', label: '空间积木 / 锻炼耐心逻辑', emoji: '🧱' },
          { value: '美育熏陶 / 启发想象力的精装绘本或艺术套组', label: '绘本美育 / 启发想象力', emoji: '📚' },
          { value: '纯粹惊喜 / 圆孩子一个心愿的专属心爱好物', label: '心愿礼物 / 带来巨大惊喜', emoji: '🎁' },
        ],
        allowCustom: true,
        placeholder: '可以写写孩子最近念叨过的具体愿望…',
      }
    }

    if (stepIndex === 3) {
      // 🌟 深入拼装难度与玩法
      if (/机甲|拼装|模型|积木|机械|动手/.test(allAnswerText)) {
        return {
          id: 'child_step_3_assembly_difficulty',
          stage: 'story',
          key: 'assembly_difficulty',
          type: 'single',
          messages: ['在拼装难度与动手玩法上，你更倾向于哪种类型？孩子平时的动手耐力如何？'],
          options: [
            { value: '免胶卡扣独立上手 / 步骤清晰友好，孩子自己动手能独立搞定', label: '独立上手 / 卡扣免胶易拼', emoji: '🧩' },
            { value: '高精度进阶可动款 / 零件丰富多变、关节可动可摆各种战斗姿势', label: '进阶挑战 / 高可动造型', emoji: '⚔️' },
            { value: '亲子合作互动大件 / 适合周末和大人一起合力完成，享受陪伴', label: '亲子互动 / 全家合力拼搭', emoji: '👨‍👩‍👧' },
          ],
          allowCustom: true,
          placeholder: '可以补充孩子的动手习惯或耐心程度…',
        }
      }

      return {
        id: 'child_step_3_feeling',
        stage: 'story',
        key: 'feeling_wish',
        type: 'single',
        messages: ['送出这份礼物时，你最期待看到孩子的什么反应？'],
        options: [
          { value: '兴奋欢呼，迫不及待马上拆开动手玩起来', label: '兴奋欢呼，立马玩起来', emoji: '🎉' },
          { value: '爱不释手，能长久陪伴、反复探索不厌烦', label: '爱不释手，长久陪伴', emoji: '⭐' },
          { value: '受到鼓励，在探索中建立自信与成就感', label: '受到鼓励，收获成就感', emoji: '🏆' },
        ],
        allowCustom: true,
      }
    }

    if (stepIndex === 4) {
      return {
        id: 'child_step_4_special_wish',
        stage: 'story',
        key: 'special_wish',
        type: 'single',
        messages: ['孩子最近有没有心心念念念叨过某个特定心愿？或者你送这份礼物最想带给 TA 的是什么？'],
        options: [
          { value: '激发专注力与探索欲，在动手过程中锻炼逻辑思维与耐心', label: '锻炼专注力与逻辑思维', emoji: '🧠' },
          { value: '圆孩子心心念念的一个小心愿，收到瞬间激动尖叫', label: '圆孩子特定心愿，超级惊喜', emoji: '🎁' },
          { value: '拼好后放在书桌摆件，天天看着有满满的成就感', label: '书桌常驻展示，收获成就感', emoji: '🏆' },
        ],
        allowCustom: true,
        placeholder: '可以写写孩子最近念叨过的具体愿望或小暗号…',
      }
    }

    return {
      id: 'child_step_5_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['最后确认一下预算区间与规格偏好，我来从官方正品库中为你精挑细选：'],
      options: [
        { value: '¥100–300 精巧心意拼装好物', label: '¥100–300 精巧心意款', emoji: '🌱' },
        { value: '¥300–600 品质进阶热门大套组', label: '¥300–600 进阶大套组', emoji: '✨' },
        { value: '¥600–1200 标杆重磅典藏级大礼', label: '¥600–1200 标杆典藏礼', emoji: '👑' },
      ],
      allowCustom: true,
    }
  }

  // ── 父母/长辈 专属深度路径 ──
  if (rel === 'elder') {
    if (stepIndex === 1) {
      return {
        id: 'elder_step_1_scenario',
        stage: 'discover',
        key: 'pain_point',
        type: 'single',
        messages: ['在父母/长辈的日常生活中，你最想帮他们改善或分担的是哪一类具体场景？'],
        options: [
          { value: '家务操劳 / 弯腰拖地与做饭备菜繁重', label: '家务操劳 / 弯腰清洁与备菜', emoji: '🧹' },
          { value: '身体舒缓 / 颈椎腰背酸痛容易疲累', label: '身体舒缓 / 颈椎腰背放松', emoji: '💆' },
          { value: '精神念想 / 老照片回忆与陪伴挂念', label: '精神念想 / 专属回忆陪伴', emoji: '📷' },
          { value: '食疗滋补 / 养生调理与起居舒适', label: '食疗滋补 / 起居生活舒适', emoji: '🍵' },
        ],
        allowCustom: true,
        placeholder: '也可以直接写长辈平时最操劳或最需要的事…',
      }
    }
    if (stepIndex === 2) {
      return {
        id: 'elder_step_2_detail',
        stage: 'preference',
        key: 'detail_need',
        type: 'single',
        messages: ['针对这个需求，你希望这份礼物如何真正帮到他们？长辈平时最容易忽略自己的什么地方？'],
        options: [
          { value: '真正减负省力，一键操作不费劲，把双手解放出来', label: '一键好上手，省心省力', emoji: '🛋️' },
          { value: '温热揉捏，深层驱散疲劳，改善睡眠和身体舒适度', label: '温热舒缓，提升睡眠舒适', emoji: '🌿' },
          { value: '定格一家人温情，把回忆翻印成册随时看一看', label: '定格温情，睹物思人留念想', emoji: '🖼️' },
        ],
        allowCustom: true,
        placeholder: '可以补充长辈平时的生活习惯或脾气…',
      }
    }
    if (stepIndex === 3) {
      return {
        id: 'elder_step_3_feeling',
        stage: 'story',
        key: 'feeling',
        type: 'single',
        messages: ['长辈拆开礼物时，你最希望他们体会到的是什么？'],
        options: [
          { value: '觉得孩子真的长大了、懂事又心疼父母', label: '懂得心疼父母，踏实温暖', emoji: '🧣' },
          { value: '觉得家里添了一件特别实用省心的好东西', label: '实用耐用，舍得天天用', emoji: '👍' },
          { value: '感动欣慰，深深感受到被挂念与陪伴', label: '深深被挂念，欣慰感动', emoji: '🥹' },
        ],
        allowCustom: true,
      }
    }
    return {
      id: 'elder_step_4_budget',
      stage: 'shape',
      key: 'budget',
      type: 'single',
      messages: ['在礼物形式与预算上，你期望的核心发力点在哪里？'],
      options: [
        { value: '¥100–300 贴心小件心意好物', label: '¥100–300 贴心小件', emoji: '🌱' },
        { value: '¥300–600 黄金品质实用大件', label: '¥300–600 实用大件', emoji: '✨' },
        { value: '¥600–1200 尊享体面重磅关怀', label: '¥600–1200 尊享关怀', emoji: '🎁' },
        { value: '线下推拿/理疗/温泉放松体验', label: '线下理疗体验', emoji: '🧖' },
      ],
      allowCustom: true,
    }
  }

  // ── 通用/伴侣路径 ──
  if (stepIndex === 1) {
    return {
      id: 'common_step_1',
      stage: 'discover',
      key: 'occasion_scene',
      type: 'single',
      messages: [`这次给【${recipient}】选礼，最核心的契机或心愿是什么？`],
      options: [
        { value: '特别节日或生日庆祝', label: '特别节日 / 生日纪念', emoji: '🎂' },
        { value: '日常浪漫小确幸', label: '日常小确幸 / 浪漫心意', emoji: '✨' },
        { value: '感谢陪伴或弥补遗憾', label: '感谢陪伴 / 弥补遗憾', emoji: '💌' },
        { value: '实用升级品质生活', label: '实用升级 / 提升品质', emoji: '🛋️' },
      ],
      allowCustom: true,
    }
  }

  if (stepIndex === 2) {
    return {
      id: 'common_step_2',
      stage: 'preference',
      key: 'style_preference',
      type: 'single',
      messages: ['TA 的生活调性或审美风格，更接近哪一种？'],
      options: [
        { value: '极简实用 / 注重质感与效率', label: '极简实用 / 注重质感', emoji: '◻️' },
        { value: '浪漫走心 / 喜欢仪式感与专属纪念', label: '浪漫走心 / 仪式感纪念', emoji: '💍' },
        { value: '热爱生活 / 美食咖啡与居家治愈', label: '居家治愈 / 美食与生活', emoji: '🕯️' },
        { value: '潮流户外 / 爱运动与新鲜体验', label: '潮流户外 / 新鲜体验', emoji: '⛰️' },
      ],
      allowCustom: true,
      placeholder: '或者写写 TA 平时的特别喜好…',
    }
  }

  return {
    id: 'common_step_3',
    stage: 'shape',
    key: 'budget',
    type: 'single',
    messages: ['预算大概在什么范围？'],
    options: [
      { value: '¥100–300', label: '¥100–300', emoji: '🌱' },
      { value: '¥300–600', label: '¥300–600', emoji: '✨' },
      { value: '¥600–1200', label: '¥600–1200', emoji: '🎁' },
      { value: '¥1200 以上', label: '¥1200 以上', emoji: '👑' },
    ],
    allowCustom: true,
  }
}

function getDefaultDeepOptions(recipient, stepIndex) {
  const rel = classifyRelationship(recipient)
  if (rel === 'junior') {
    return [
      { value: '科幻机甲 / 拼装战甲', label: '科幻机甲 / 拼装战甲', emoji: '🤖' },
      { value: '毛绒公仔 / 治愈玩偶', label: '毛绒公仔 / 治愈玩偶', emoji: '🧸' },
      { value: '潮流手办 / 盲盒模型', label: '潮流手办 / 盲盒模型', emoji: '🤖' },
      { value: '科学探索 / 益智拼搭', label: '科学探索 / 益智拼搭', emoji: '🔬' },
    ]
  }
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
