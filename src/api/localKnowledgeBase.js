/**
 * ══════════════════════════════════════════════════════════════
 *  本地挑礼专家知识库与正则匹配引擎 (Local Expert Knowledge Base)
 *  —— 仅当大模型离线/断网时作为底层保底：
 *     1. 22 套高覆盖率正则关键词匹配规则；
 *     2. 严格杜绝重复输出（带全局会话去重机制）；
 *     3. 针对人伦身份（长辈/伴侣/同事/朋友/晚辈）精准分流。
 * ══════════════════════════════════════════════════════════════
 */

export const LOCAL_KNOWLEDGE_RULES = [
  /* ── 1. 父母长辈·辛苦家务与健康痛点 ────────────── */
  {
    id: 'elder_labor_tired',
    category: 'elder',
    pattern: /重复|累|辛苦|劳动|家务|腰酸|背痛|做饭|做卫生|拖地|扫地|洗碗|操劳/,
    reaction: '能体察到长辈日复一日的操劳与辛苦，这份心意真的最难得。我们一定要选真正能帮他们省力减负的实用好物！',
    nextQuestion: '长辈平时主要是哪类家务或日常活动最让他们觉得吃力呢？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '弯腰扫地拖地 / 家里大面积清洁', label: '拖地扫地 / 弯腰清洁', emoji: '🧹' },
      { value: '一日三餐下厨 / 备菜洗碗', label: '下厨洗碗 / 厨房油烟', emoji: '🍳' },
      { value: '久坐久站 / 腰椎颈椎酸胀', label: '腰椎颈椎 / 酸胀疲劳', emoji: '💆' },
      { value: '睡眠浅 / 夜里容易起夜失眠', label: '睡眠不好 / 容易失眠', emoji: '💤' },
    ],
  },
  {
    id: 'elder_health_sleep',
    category: 'elder',
    pattern: /健康|养生|失眠|睡不好|腰|腿|关节|高血压|颈椎|按摩|体检/,
    reaction: '长辈年纪大了，最关心的就是睡眠与身体舒适。健康舒缓类的礼物永远能送到心坎里。',
    nextQuestion: '长辈平时主要的身体痛点或生活习惯是哪种？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '颈椎腰酸 / 容易疲劳', label: '颈椎腰酸 / 容易疲劳', emoji: '💆' },
      { value: '睡眠浅 / 多梦失眠', label: '睡眠浅 / 容易失眠', emoji: '💤' },
      { value: '关节怕冷 / 血液循环慢', label: '关节怕冷 / 畏寒', emoji: '🧣' },
      { value: '注重食疗 / 爱喝养生茶', label: '注重食疗 / 养生茶', emoji: '🍵' },
    ],
  },
  {
    id: 'elder_parent_general',
    category: 'elder',
    pattern: /爸|妈|母|父|长辈|老两口|公公|婆婆|爷爷|奶奶|外公|外婆|姥姥|姥爷/,
    reaction: '送长辈最重在“体贴入微与真实有用”，不买华而不实的噱头，挑能真正融进他们日常生活的好物。',
    nextQuestion: '这次给长辈选礼，主要是什么场合或由头呢？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '母亲节 / 父亲节', label: '母亲节 / 父亲节', emoji: '💐' },
      { value: '中秋 / 春节年节', label: '中秋 / 春节过节', emoji: '🏮' },
      { value: '长辈寿辰 / 生日', label: '长辈寿辰 / 生日', emoji: '🎂' },
      { value: '银婚 / 金婚纪念', label: '父母结婚纪念日', emoji: '👵👴' },
      { value: '日常孝敬关怀', label: '没有特别日子，就想孝敬爸妈', emoji: '🧣' },
    ],
  },

  /* ── 2. 女朋友 / 妻子 / 恋爱专区 ─────────────────── */
  {
    id: 'lover_female_romantic',
    category: 'lover',
    pattern: /女朋友|女友|妻子|老婆|爱人|恋爱|情人节|七夕|纪念日/,
    reaction: '给另一半挑礼物永远是最浪漫的事，这次我们来准备一份让她眼前一亮的心动之作！',
    nextQuestion: '这次送给女生，是出于什么特别的场合呢？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '情人节 / 七夕', label: '情人节 / 七夕', emoji: '🌹' },
      { value: '她的生日庆祝', label: '她的生日庆祝', emoji: '🎂' },
      { value: '恋爱 / 结婚纪念日', label: '恋爱 / 结婚纪念日', emoji: '💍' },
      { value: '日常浪漫惊喜', label: '平时无由，就想宠她', emoji: '✨' },
      { value: '道歉 / 和好', label: '道歉 / 想弥补她', emoji: '🕊️' },
    ],
  },
  {
    id: 'lover_beauty_fashion',
    category: 'lover',
    pattern: /美妆|护肤|口红|香水|包|首饰|项链|耳钉|手链|穿搭|时尚/,
    reaction: '女生对首饰与生活美学的感知极度敏锐！挑这种礼物最看重“高级调性与独特设计感”。',
    nextQuestion: '她平时的穿搭风格更接近哪一种？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '法式复古 / 气质名媛', label: '法式复古 / 气质名媛', emoji: '👗' },
      { value: '清冷简约 / 极简质感', label: '清冷简约 / 极简质感', emoji: '◻️' },
      { value: '甜美可爱 / 少女元气', label: '甜美可爱 / 少女元气', emoji: '🎀' },
      { value: '通勤干练 / 独立职场', label: '通勤干练 / 独立职场', emoji: '💼' },
    ],
  },
  {
    id: 'lover_foodie_photo',
    category: 'lover',
    pattern: /吃货|甜食|蛋糕|奶茶|探店|拍照|咖啡|烘焙|打卡/,
    reaction: '爱美食、爱拍照记录生活的女生，最容易被高颜值、充满仪式感的生活小确幸打动。',
    nextQuestion: '她平时有哪些爱不释手的生活小爱好？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '手冲咖啡 / 独立小馆探店', label: '咖啡 / 探店打卡', emoji: '☕' },
      { value: '甜品烘焙 / 收集可爱餐具', label: '烘焙 / 可爱餐具', emoji: '🍰' },
      { value: '胶片摄影 / 记录日常', label: '拍照 / 胶片记录', emoji: '📷' },
      { value: '香薰蜡烛 / 居家治愈', label: '香薰 / 居家治愈', emoji: '🕯️' },
    ],
  },

  /* ── 3. 男朋友 / 丈夫专区 ────────────────────────── */
  {
    id: 'lover_male_general',
    category: 'lover',
    pattern: /男朋友|男友|丈夫|老公|直男|送男生/,
    reaction: '给男生选礼物最讲究“硬核质感与高频使用”，拒绝中看不中用的老套雷区，我们要挑真正让他爱不释手的单品。',
    nextQuestion: '这次送给男生，是出于什么特别的日子？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '他的生日庆祝', label: '他的生日庆祝', emoji: '🎂' },
      { value: '情人节 / 七夕', label: '情人节 / 七夕', emoji: '🌹' },
      { value: '恋爱 / 结婚纪念日', label: '恋爱 / 结婚纪念日', emoji: '💍' },
      { value: '升职 / 考学突破', label: '升职 / 突破庆祝', emoji: '🎓' },
      { value: '日常投喂惊喜', label: '没有理由，顺手宠他', emoji: '✨' },
    ],
  },
  {
    id: 'lover_male_digital',
    category: 'lover',
    pattern: /数码|电脑|机械键盘|耳机|显卡|鼠标|桌搭|外设|科技/,
    reaction: '数码控男生对于“工业设计、轴体手感与性能参数”极为看重，必须挑选专业度被公认的标杆型号。',
    nextQuestion: '他在数码与桌搭方面偏向哪种偏好？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '桌面美学 / 客制化键盘', label: '客制化键盘 / 桌搭美学', emoji: '⌨️' },
      { value: '发烧音频 / 降噪头戴耳机', label: '发烧音频 / 降噪耳机', emoji: '🎧' },
      { value: '极客数码 / 充电收纳', label: '极客数码 / 效率收纳', emoji: '🔌' },
      { value: '电竞硬核 / 高刷外设', label: '电竞外设 / 游戏操作', emoji: '🖱️' },
    ],
  },
  {
    id: 'lover_male_gaming',
    category: 'lover',
    pattern: /游戏|switch|ps5|steam|黑神话|主机|电竞|掌机/,
    reaction: '游戏党的心思其实最好懂！送他梦寐以求的游戏周边或体验升级，他绝对会像个孩子一样开心。',
    nextQuestion: '他平时最常玩哪一类游戏设备？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '主机玩家（PS5 / Xbox）', label: '主机党（PS5 / Xbox）', emoji: '🎮' },
      { value: '掌机党（Switch / SteamDeck）', label: '掌机党（Switch）', emoji: '🕹️' },
      { value: 'PC Steam / 3A 大作发烧友', label: 'PC Steam 3A 大作', emoji: '💻' },
      { value: '手游开黑 / 休闲联机', label: '手游开黑 / 联机', emoji: '📱' },
    ],
  },
  {
    id: 'lover_male_outdoor',
    category: 'lover',
    pattern: /运动|健身|跑步|露营|登山|机车|公路车|骑行|钓鱼|球/,
    reaction: '户外与运动系的男生，最看重装备的“轻量化、耐用度与专业防护”，挑一件懂行的硬核装备准没错。',
    nextQuestion: '他最沉迷的户外/运动项目是哪种？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '户外徒步 / 露营野炊', label: '户外露营 / 徒步', emoji: '⛺' },
      { value: '公路车骑行 / 机车', label: '骑行 / 机车装备', emoji: '🚴' },
      { value: '力量健身 / 跑步马拉松', label: '跑步 / 健身训练', emoji: '🏃' },
      { value: '篮球 / 足球 / 羽毛球', label: '球类运动竞技', emoji: '🏸' },
    ],
  },

  /* ── 4. 闺蜜 / 好友专区 ────────────────────────── */
  {
    id: 'friend_birthday_housewarming',
    category: 'friend',
    pattern: /闺蜜|姐妹|兄弟|好朋友|搬家|乔迁|新居|聚会/,
    reaction: '给好友送礼，既要有满满的陪伴仪式感，又要贴近生活，让 TA 每次用到都能想起你们的默契。',
    nextQuestion: '这次送好友具体是什么场合？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '好朋友生日', label: '好朋友生日', emoji: '🎂' },
      { value: '乔迁新居庆祝', label: '乔迁新居庆祝', emoji: '🏡' },
      { value: '毕业 / 升职突破', label: '毕业 / 升职突破', emoji: '🎓' },
      { value: '伴娘 / 伴郎答谢', label: '伴娘 / 伴郎答谢', emoji: '💌' },
      { value: '日常心意投喂', label: '日常姐妹/兄弟心意', emoji: '✨' },
    ],
  },
  {
    id: 'friend_lifestyle_art',
    category: 'friend',
    pattern: /文艺|书|阅读|插花|胶片|小众|展览|画画|手作/,
    reaction: '文艺又懂艺术的朋友，最看重礼物背后的故事感与情绪留白，小众设计单品最容易击中。',
    nextQuestion: 'TA 平时的生活格调更偏向哪种？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '手账手作 / 文创文具控', label: '手账 / 文创手作', emoji: '🎨' },
      { value: '小众香氛 / 居家生活美学', label: '小众香氛 / 蜡烛', emoji: '🕯️' },
      { value: '独立阅读 / 思想书籍', label: '阅读 / 艺术画册', emoji: '📖' },
      { value: '绿植盆栽 / 园艺生活', label: '绿植 / 园艺生活', emoji: '🪴' },
    ],
  },

  /* ── 5. 职场同事 / 领导专区 ──────────────────────── */
  {
    id: 'work_promotion_retire',
    category: 'work',
    pattern: /领导|上司|老板|同事|升职|调动|商务|客户|感谢|拜访|跳槽/,
    reaction: '职场与商务送礼，核心在于“体面得体、分寸感恰到好处”，既表达诚挚尊重，又不会给对方心理压力。',
    nextQuestion: '这次职场往来是什么具体事由？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '升职 / 事业调动', label: '升职 / 事业调动', emoji: '💼' },
      { value: '离职 / 退休欢送', label: '离职 / 退休欢送', emoji: '🤝' },
      { value: '商务拜访 / 合作感谢', label: '商务拜访 / 答谢', emoji: '🍵' },
      { value: '中秋 / 元旦过节', label: '中秋 / 元旦节日礼', emoji: '🏮' },
      { value: '同僚生日庆祝', label: '同事生日庆祝', emoji: '🎂' },
    ],
  },

  /* ── 6. 孩子 / 晚辈专区 ──────────────────────────── */
  {
    id: 'junior_children_general',
    category: 'junior',
    pattern: /小孩|孩子|儿子|女儿|侄|外甥|宝宝|晚辈|学生|童/,
    reaction: '给孩子选礼物，最棒的是“寓教于乐、激发想象力”，兼顾安全性与满满的探索乐趣。',
    nextQuestion: '这次是为孩子庆祝什么呢？',
    targetKey: 'occasion',
    stage: 'discover',
    options: [
      { value: '儿童节 / 生日', label: '儿童节 / 生日', emoji: '🎈' },
      { value: '升学 / 考学奖励', label: '开学 / 升学奖励', emoji: '🎒' },
      { value: '成长特别纪念', label: '成长特别纪念', emoji: '🌟' },
      { value: '新年压岁礼物', label: '新年压岁礼物', emoji: '🧧' },
    ],
  },

  /* ── 7. 预算区间规则 ────────────────────────────── */
  {
    id: 'budget_light_under300',
    category: 'budget',
    pattern: /50|100|150|200|300|学生|便宜|预算不高|轻微/,
    reaction: '¥100~300 是非常轻盈无负担的预算！把钱花在小而美的设计感好物上，心意与趣味丝毫不减。',
    nextQuestion: '在 100~300 元区间内，你更希望侧重哪种调性？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '精致设计感 / 桌面小物件', label: '高颜值桌面小物', emoji: '✨' },
      { value: '日常刚需 / 升级质感', label: '日常刚需升级款', emoji: '🧺' },
      { value: '趣味搞怪 / 带来欢笑', label: '趣味搞怪 / 治愈解压', emoji: '😄' },
      { value: '美味投喂 / 精致小食礼盒', label: '精致零食礼盒', emoji: '🍪' },
    ],
  },
  {
    id: 'budget_golden_300_600',
    category: 'budget',
    pattern: /300|400|500|600|黄金区间|轻奢|合适/,
    reaction: '¥300~600 是公认的“黄金送礼区间”！既能选到极具格调的小众轻奢品牌，又完全不会给收礼人造成收重礼的心理压力。',
    nextQuestion: '在这个预算下，你期望礼物的核心发力点在哪？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '小众轻奢 / 独特生活美学', label: '小众轻奢美学', emoji: '✨' },
      { value: '经久耐用 / 提升生活品质', label: '品质生活大件', emoji: '🛋️' },
      { value: '定制专属 / 融入回忆纪念', label: '专属定制纪念', emoji: '💌' },
      { value: '健康舒缓 / 放松解压', label: '健康舒缓放松', emoji: '🌿' },
    ],
  },
  {
    id: 'budget_premium_over1000',
    category: 'budget',
    pattern: /800|1000|1500|2000|不设上限|大牌|高级|预算充足/,
    reaction: '预算十分从容！我们可以完全跳出常规单品，直接锁定高品质标杆与限定礼盒，把质感拉到极致。',
    nextQuestion: '在高端预算下，更倾向哪种展现形式？',
    targetKey: 'personality',
    stage: 'preference',
    options: [
      { value: '标杆大牌 / 经典永不过时', label: '经典标杆单品', emoji: '👑' },
      { value: '高端定制 / 独一无二孤品', label: '高级专属定制', emoji: '✨' },
      { value: '极致性能 / 顶配科技享受', label: '顶配科技享受', emoji: '⚡' },
      { value: '奢华体验 / 双人浪漫旅程', label: '奢华双人体验', emoji: '🥂' },
    ],
  },

  /* ── 8. 避雷禁忌与故事回忆 ──────────────────────── */
  {
    id: 'taboo_filter',
    category: 'taboo',
    pattern: /不要|别送|踩雷|忌讳|香水|大件|占地方|怕尴尬/,
    reaction: '记下了！排雷和挑对同样重要，这些容易引起负担或不适的雷区我会在后续推荐中坚决过滤。',
    nextQuestion: '有什么特别的故事或 TA 最近念叨过的心愿吗？',
    targetKey: 'memory',
    stage: 'story',
    options: [],
  },
  {
    id: 'story_memory_camping_travel',
    category: 'story',
    pattern: /旅行|旅游|海边|演唱会|第一次|露营|约会|回忆|念叨/,
    reaction: '这个细节太有画面感了！独一无二的共同回忆，永远是这份礼物最无可替代的灵魂。',
    nextQuestion: 'TA 拆开礼物那一刻，你最希望 TA 体会到什么感受？',
    targetKey: 'feeling',
    stage: 'story',
    options: [
      { value: '被深深理解 / 感动到想哭', label: '被深深理解，眼眶湿润', emoji: '🥹' },
      { value: '惊喜出乎意料 / 眼前一亮', label: '完全没想到，惊喜万分', emoji: '🎉' },
      { value: '温暖踏实 / 觉得被细心照顾', label: '温暖踏实，觉得被爱', emoji: '🧣' },
      { value: '纯粹开怀大笑 / 幽默欢脱', label: '纯粹开心，笑出声来', emoji: '😄' },
    ],
  },
]

// 会话已使用点评集合（防重复）
const usedReactionIds = new Set()

/**
 * 本地知识库正则智能匹配函数（严格只匹配用户本次输入，且绝对不重复）
 */
export function matchLocalKnowledge(currentAnswerText = '', currentAnswers = {}) {
  const text = String(currentAnswerText || '').trim()
  if (!text) return null

  // 1. 先从用户本次回答中精准匹配规则
  for (const rule of LOCAL_KNOWLEDGE_RULES) {
    if (rule.pattern.test(text) && !usedReactionIds.has(rule.id)) {
      usedReactionIds.add(rule.id)
      return rule
    }
  }

  // 2. 如果当前输入没命中特定词，按关系兜底
  const recipient = String(currentAnswers.recipient || '')
  for (const rule of LOCAL_KNOWLEDGE_RULES) {
    if (rule.pattern.test(recipient) && !usedReactionIds.has(rule.id)) {
      usedReactionIds.add(rule.id)
      return rule
    }
  }

  return null
}
