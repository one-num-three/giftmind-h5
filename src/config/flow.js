/**
 * ══════════════════════════════════════════════════════════════
 *  对话剧本（Conversation Script）
 *  —— GiftMind 的核心可配置资产。改问题、加分支、调顺序都在这里，
 *     不需要动任何页面代码。
 *
 *  step 支持的字段：
 *    id          唯一标识
 *    stage       所属阶段（对应 STAGES.id），用于顶部进度与阶段标签
 *    key         答案写入 session.answers 的字段名
 *    type        'single' | 'multi' | 'text'
 *    messages    AI 依次发出的气泡文案（数组 = 多条连发）
 *    options     选项 [{ value, label, emoji, hint }]
 *    minSelect / maxSelect   多选约束
 *    allowCustom 选项之外允许自由输入
 *    placeholder 输入框占位符
 *    skippable   是否允许「跳过」
 *    when        (answers) => boolean   条件显示（分支）
 *    summary     (value) => string      写进气泡的用户答案展示文案
 * ══════════════════════════════════════════════════════════════
 */

export const STAGES = [
  { id: 'discover', label: '认识 TA' },
  { id: 'preference', label: '了解偏好' },
  { id: 'story', label: '挖掘故事' },
  { id: 'shape', label: '定型方案' },
]

export const CHAT_FLOW = [
  /* ── 阶段一：认识 TA ─────────────────────────── */
  {
    id: 'recipient',
    stage: 'discover',
    key: 'recipient',
    type: 'single',
    messages: [
      '你好呀 👋 我是 GiftMind，你的 AI 送礼策划师。',
      '接下来十分钟，我会像朋友一样问你几个问题，然后给你一份真正「懂 TA」的方案。\n\n先说说，这次想送给谁？',
    ],
    options: [
      { value: '女朋友 / 妻子', label: '女朋友 / 妻子', emoji: '💗' },
      { value: '男朋友 / 丈夫', label: '男朋友 / 丈夫', emoji: '💙' },
      { value: '父母', label: '父母', emoji: '🏡' },
      { value: '朋友 / 好友', label: '朋友 / 好友', emoji: '🤝' },
      { value: '同事 / 上司', label: '同事 / 上司', emoji: '🧑‍💼' },
      { value: '孩子 / 晚辈', label: '孩子 / 晚辈', emoji: '🎈' },
    ],
    allowCustom: true,
    placeholder: '也可以直接告诉我 TA 是谁…',
  },
  {
    id: 'recipient_age',
    stage: 'discover',
    key: 'recipientAge',
    type: 'single',
    messages: [
      '再确认一下 TA 的年龄段。涉及酒类、KTV、网吧等内容时，我会据此主动避开不合适的推荐。',
    ],
    options: [
      { value: '未满18岁', label: '未满 18 岁', emoji: '🧒' },
      { value: '18–25岁', label: '18–25 岁' },
      { value: '26–40岁', label: '26–40 岁' },
      { value: '41–60岁', label: '41–60 岁' },
      { value: '60岁以上', label: '60 岁以上' },
      { value: '不确定', label: '不确定', emoji: '❔' },
    ],
  },
  {
    id: 'occasion',
    stage: 'discover',
    key: 'occasion',
    type: 'single',
    messages: ['明白。是什么场合呢？'],
    options: [
      { value: '生日', label: '生日', emoji: '🎂' },
      { value: '纪念日', label: '纪念日', emoji: '💍' },
      { value: '节日', label: '节日', emoji: '🎄', hint: '情人节 / 母亲节 / 春节…' },
      { value: '毕业 / 里程碑', label: '毕业 / 里程碑', emoji: '🎓' },
      { value: '道歉 / 和好', label: '道歉 / 和好', emoji: '🕊️' },
      { value: '没有理由，就想送', label: '没理由，就想送', emoji: '✨' },
    ],
    allowCustom: true,
  },
  {
    id: 'timing',
    stage: 'discover',
    key: 'timing',
    type: 'single',
    messages: ['离送出还有多久？这会影响我推荐定制类还是现货类。'],
    options: [
      { value: '就今明两天', label: '就今明两天', emoji: '⚡' },
      { value: '一周内', label: '一周内', emoji: '📅' },
      { value: '两到四周', label: '两到四周', emoji: '🗓️' },
      { value: '一个月以上', label: '一个月以上', emoji: '🌱' },
    ],
  },

  /* ── 阶段二：了解偏好 ────────────────────────── */
  {
    id: 'budget',
    stage: 'preference',
    key: 'budget',
    type: 'single',
    messages: ['预算大概多少？不用精确，给我一个区间就好。'],
    options: [
      { value: '¥50–150', label: '¥50–150' },
      { value: '¥150–300', label: '¥150–300' },
      { value: '¥300–600', label: '¥300–600' },
      { value: '¥600–1500', label: '¥600–1500' },
      { value: '¥1500 以上', label: '¥1500 以上' },
      { value: '不设上限，看方案', label: '不设上限，看方案', emoji: '🫶' },
    ],
  },
  {
    id: 'personality',
    stage: 'preference',
    key: 'personality',
    type: 'multi',
    minSelect: 1,
    maxSelect: 4,
    messages: ['TA 是个什么样的人？挑几个最贴近的词（最多 4 个）。'],
    options: [
      { value: '文艺 / 小众', label: '文艺 / 小众', emoji: '🎞️' },
      { value: '温柔 / 居家', label: '温柔 / 居家', emoji: '🕯️' },
      { value: '活力 / 爱运动', label: '活力 / 爱运动', emoji: '🏃' },
      { value: '理性 / 极简', label: '理性 / 极简', emoji: '◻️' },
      { value: '甜食爱好者', label: '甜食爱好者', emoji: '🍰' },
      { value: '户外 / 自然', label: '户外 / 自然', emoji: '⛰️' },
      { value: '时尚 / 潮流', label: '时尚 / 潮流', emoji: '👟' },
      { value: '音乐 / 影视迷', label: '音乐 / 影视迷', emoji: '🎧' },
      { value: '爱做饭 / 美食', label: '爱做饭 / 美食', emoji: '🍳' },
      { value: '数码 / 效率控', label: '数码 / 效率控', emoji: '⌨️' },
    ],
    allowCustom: true,
    placeholder: '还有别的形容词？直接写…',
  },
  {
    id: 'taboo',
    stage: 'preference',
    key: 'taboo',
    type: 'multi',
    minSelect: 0,
    maxSelect: 3,
    skippable: true,
    messages: ['有什么是一定要避开的吗？（没有就跳过）'],
    options: [
      { value: '不要太贵重、会有负担', label: '不要太贵重' },
      { value: '不要占地方的大件', label: '不要占地方' },
      { value: '不要花 / 香水等易踩雷', label: '不要花 / 香水' },
      { value: '不要吃的（在控制饮食）', label: '不要吃的' },
      { value: '不要一次性、用完就丢', label: '不要一次性' },
      { value: '不要太张扬、怕尴尬', label: '不要太张扬' },
    ],
    allowCustom: true,
  },

  /* ── 阶段三：挖掘故事 ────────────────────────── */
  {
    id: 'memory',
    stage: 'story',
    key: 'memory',
    type: 'text',
    messages: [
      '接下来这个问题最关键。',
      '你们之间有没有某个特别的记忆？或者 TA 最近提过特别想要 / 想做的事？\n\n哪怕只是一句话，也会让我的推荐精准很多。',
    ],
    placeholder: '比如：TA 最近总念叨想学花艺；或者我们第一次约会在海边…',
    skippable: true,
  },
  {
    id: 'relationship_note',
    stage: 'story',
    key: 'relationshipNote',
    type: 'single',
    when: (a) => ['女朋友 / 妻子', '男朋友 / 丈夫'].includes(a.recipient),
    messages: ['你们最近的状态更接近哪一种？我会调整这封信的语气。'],
    options: [
      { value: '甜蜜期，怎么送都开心', label: '甜蜜期', emoji: '🍯' },
      { value: '稳定期，想制造一点新鲜感', label: '稳定期', emoji: '🌊' },
      { value: '有点疏远，想拉近一点', label: '想拉近一点', emoji: '🌉' },
      { value: '刚和好 / 想弥补', label: '想弥补', emoji: '🕊️' },
    ],
  },
  {
    id: 'feeling',
    stage: 'story',
    key: 'feeling',
    type: 'single',
    messages: ['TA 拆开礼物那一刻，你最希望 TA 是什么感受？'],
    options: [
      { value: '被深深理解，感动到想哭', label: '被深深理解', emoji: '🥹' },
      { value: '惊喜，完全没想到', label: '完全没想到', emoji: '🎉' },
      { value: '甜蜜，感受到被爱', label: '被爱着', emoji: '💗' },
      { value: '温暖踏实，觉得被照顾', label: '温暖踏实', emoji: '🧣' },
      { value: '纯粹的开心，笑出来', label: '笑出来', emoji: '😄' },
    ],
  },

  /* ── 阶段四：定型方案 ────────────────────────── */
  {
    id: 'all_participants_adults',
    stage: 'shape',
    key: 'allParticipantsAdults',
    type: 'single',
    messages: [
      '我会同时考虑实物和体验方案。参与体验的所有人是否都已满 18 岁？',
      '我不会根据关系或活动类型猜测年龄。',
    ],
    options: [
      { value: true, label: '是，全部成年', emoji: '✅' },
      { value: false, label: '否 / 不确定', emoji: '🛡️' },
    ],
    summary: (value) => (value ? '是，参与者全部成年' : '否 / 还不确定'),
  },
]

/** 按条件过滤出本次会话真正要走的步骤 */
export function resolveSteps(answers = {}) {
  return CHAT_FLOW.filter((s) => (typeof s.when === 'function' ? s.when(answers) : true))
}

/** 阶段标签，如「挖掘故事 3/4」 */
export function stageLabel(stageId) {
  const idx = STAGES.findIndex((s) => s.id === stageId)
  if (idx < 0) return ''
  return `${STAGES[idx].label} ${idx + 1}/${STAGES.length}`
}

/** 进度百分比：按已完成步骤在总步骤中的占比，起步给 6% 让进度条不为空 */
export function progressOf(doneCount, total) {
  if (!total) return 6
  return Math.min(100, Math.round(6 + (doneCount / total) * 94))
}
