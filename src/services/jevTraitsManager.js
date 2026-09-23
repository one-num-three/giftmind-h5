/**
 * ══════════════════════════════════════════════════════════════
 *  Jev 动态 12 特质自适应管理器 (Jev Dynamic 12-Traits Manager v1.0)
 *
 *  核心架构原则：
 *  1. 结构与灵动兼备：固定呈现 12 个特质卡槽，满足严谨画像仪式感；
 *  2. 4个核心基盘 + 8个自适应衍生：绝不死板硬编码同一套字段，随品类自适应演进；
 *  3. 台前幕后双轨解耦：大模型负责自然问答，Jev 负责校验入槽，彻底杜绝大模型被卡槽绑架抽风；
 *  4. 严格入槽裁决：有确切事实才填入，模糊/客套/纯跳过绝不强填。
 * ══════════════════════════════════════════════════════════════
 */

import { DOMAIN_KNOWLEDGE } from './jevEngine.js'

/** 🌟 4 大核心基盘槽位（任何送礼场景均通用必有） */
export const BASE_TRAIT_SLOTS = [
  {
    key: 'recipient',
    label: '收礼身份',
    icon: '👤',
    desc: '对象关系与亲密度',
    isBase: true,
  },
  {
    key: 'occasion',
    label: '送礼契机',
    icon: '🎉',
    desc: '节日/纪念日/转折节点',
    isBase: true,
  },
  {
    key: 'budget',
    label: '预算边界',
    icon: '💰',
    desc: '舒适价格带约束',
    isBase: true,
  },
  {
    key: 'taboo',
    label: '避坑雷区',
    icon: '🛡️',
    desc: '已知排斥与踩雷禁忌',
    isBase: true,
  },
]

/** 🌟 针对不同领域的 8 个动态自适应特质库 */
export const DOMAIN_TRAIT_PACKS = {
  coffee: [
    { key: 'gear_status', label: '装备现状', icon: '⚙️', desc: '手头已有/缺口器件' },
    { key: 'extraction_habit', label: '冲煮习惯', icon: '🫖', desc: '手冲手作 vs 快捷萃取' },
    { key: 'usage_scene', label: '享用场景', icon: '☕', desc: '工位办公 vs 居家漫享' },
    { key: 'flavor_preference', label: '风味偏好', icon: '🍋', desc: '浅烘果酸 vs 深烘坚果' },
    { key: 'carrier_type', label: '心意载体', icon: '🎁', desc: '硬核器具 vs 精品豆礼盒' },
    { key: 'aesthetic_tone', label: '设计调性', icon: '🎨', desc: '工业复古 vs 极简机能' },
    { key: 'portability', label: '空间便携', icon: '🎒', desc: '随行便携 vs 桌面常驻' },
    { key: 'special_touch', label: '开箱惊喜', icon: '✨', desc: '产区仪式感与文化' },
  ],
  tea: [
    { key: 'tea_scene', label: '品茗场景', icon: '🍵', desc: '办公室快客 vs 居家工夫茶台' },
    { key: 'tea_category', label: '茶品喜好', icon: '🍃', desc: '普洱老白茶 vs 绿茶岩茶' },
    { key: 'carrier_type', label: '心意形态', icon: '🎁', desc: '名山原叶茶 vs 考究茶器' },
    { key: 'ware_material', label: '材质器型', icon: '🏺', desc: '紫砂建盏 vs 极简耐热玻璃' },
    { key: 'social_ritual', label: '待客仪式', icon: '👥', desc: '独饮自得 vs 商务会客' },
    { key: 'aesthetic_tone', label: '文化调性', icon: '🖌️', desc: '传统东方雅韵 vs 现代极简' },
    { key: 'operation_ease', label: '操作便捷', icon: '⚡', desc: '一键闷泡 vs 繁复冲泡' },
    { key: 'health_benefit', label: '康养期待', icon: '🌿', desc: '暖胃润喉与宁神' },
  ],
  gaming: [
    { key: 'platform_system', label: '主力平台', icon: '🎮', desc: 'PC电竞 / Switch / PS5' },
    { key: 'carrier_type', label: '载体形态', icon: '🕹️', desc: '游戏本体卡带 vs 操控外设' },
    { key: 'play_mode', label: '游玩模式', icon: '🎧', desc: '沉浸单机剧情 vs 联机开黑' },
    { key: 'device_gap', label: '外设缺口', icon: '⌨️', desc: '机械键盘/手柄/高刷屏' },
    { key: 'aesthetic_tone', label: '桌面调性', icon: '💡', desc: '硬核极客 RGB vs 哑光极简' },
    { key: 'space_setup', label: '空间布局', icon: '🖥️', desc: '独立电竞房 vs 宿舍/合租' },
    { key: 'comfort_need', label: '久坐舒缓', icon: '🪑', desc: '护腕护腰与长时间舒适' },
    { key: 'ip_resonance', label: 'IP信仰', icon: '👾', desc: '特定游戏联名与世界观' },
  ],
  photo: [
    { key: 'photo_gear', label: '主力设备', icon: '📷', desc: '手机/微单/复古卡片机' },
    { key: 'shooting_theme', label: '主力题材', icon: '🌄', desc: '人像扫街 vs 风光建筑' },
    { key: 'gear_gap', label: '配件缺口', icon: '🎒', desc: '快拆背包/三脚架/防潮收纳' },
    { key: 'carrier_type', label: '心意形态', icon: '🎞️', desc: '专业配件 vs 胶片实体记忆' },
    { key: 'portability', label: '外带便携', icon: '🪶', desc: '轻装挂机 vs 重装防护' },
    { key: 'aesthetic_tone', label: '器材美学', icon: '✨', desc: '复古机械感 vs 现代专业' },
    { key: 'output_format', label: '成片呈现', icon: '🖼️', desc: '相纸冲印相框 vs 数字存档' },
    { key: 'usage_frequency', label: '创作频率', icon: '📅', desc: '周末短途 vs 日常高频' },
  ],
  beauty: [
    { key: 'style_preference', label: '穿搭风格', icon: '👗', desc: '法式小众 / 极简日常 / 知性' },
    { key: 'material_skin', label: '材质肤质', icon: '💎', desc: '过敏避雷 / 适合贵金属' },
    { key: 'wear_scene', label: '佩戴场景', icon: '✨', desc: '日常通勤高频 vs 隆重聚会' },
    { key: 'design_detail', label: '设计细节', icon: '💍', desc: '灵动碎钻 / 极简几何 / 温润珍珠' },
    { key: 'color_scheme', label: '色彩基调', icon: '🎨', desc: '玫瑰金 / 银白冷调 / 温暖暖金' },
    { key: 'symbolic_meaning', label: '专属寓意', icon: '💌', desc: '纪念誓约 / 守护祝愿' },
    { key: 'practical_ratio', label: '心意侧重', icon: '🌸', desc: '浪漫情绪价值 vs 经典保值' },
    { key: 'unpack_ritual', label: '开箱心意', icon: '🎀', desc: '高定礼盒与手写卡片' },
  ],
  wellness: [
    { key: 'body_pain_point', label: '身体诉求', icon: '💆', desc: '颈椎肩颈 / 腰部 / 眼部舒缓' },
    { key: 'sleep_quality', label: '睡眠调节', icon: '🌙', desc: '入睡困难 / 深度助眠' },
    { key: 'wear_operate', label: '操作难度', icon: '🔘', desc: '一键极简盲操 vs 丰富档位' },
    { key: 'carrier_type', label: '形态载体', icon: '🌿', desc: '轻巧按摩仪 vs 草本温热养护' },
    { key: 'usage_scene', label: '起居场景', icon: '🏡', desc: '居家躺卧 vs 办公室小憩' },
    { key: 'safety_reputation', label: '安全信赖', icon: '🩺', desc: '温控保护与医研背书' },
    { key: 'portability', label: '收纳轻量', icon: '🪶', desc: '小巧便携 vs 全包裹大件' },
    { key: 'emotional_tone', label: '关怀色彩', icon: '❤️', desc: '体贴暖心与长久陪伴' },
  ],
  outdoor: [
    { key: 'activity_type', label: '运动形态', icon: '⛰️', desc: '周末徒步露营 vs 日常路跑' },
    { key: 'gear_demand', label: '核心诉求', icon: '🧥', desc: '轻量防风防雨 vs 舒适支撑' },
    { key: 'protection_need', label: '安全防护', icon: '🔦', desc: '照明补给 / 净水求生' },
    { key: 'carrier_type', label: '心意形态', icon: '🎒', desc: '实用收纳背负 vs 露营氛围好物' },
    { key: 'durability', label: '耐用机能', icon: '🪓', desc: '高强度防撕裂与耐磨' },
    { key: 'aesthetic_tone', label: '山系美学', icon: '🏕️', desc: '自然大地色 vs 醒目亮色' },
    { key: 'pack_weight', label: '负重收纳', icon: '🪶', desc: '极简克重控 vs 充裕收纳' },
    { key: 'companion_mode', label: '出行状态', icon: '👥', desc: '独行旷野 vs 家庭亲友聚会' },
  ],
  desk: [
    { key: 'work_core_need', label: '工位痛点', icon: '💼', desc: '久坐舒缓 / 专注减压' },
    { key: 'desk_tool', label: '桌面工具', icon: '🖋️', desc: '质感书写笔 / 机械键盘 / 扩展坞' },
    { key: 'storage_habit', label: '收纳整理', icon: '📦', desc: '收纳托盘 / 线缆规整' },
    { key: 'comfort_warmth', label: '温热饮水', icon: '☕', desc: '恒温杯垫 / 质感水具' },
    { key: 'aesthetic_tone', label: '商务调性', icon: '👔', desc: '胡桃木东方 vs 金属现代科技' },
    { key: 'space_footprint', label: '桌面空间', icon: '📐', desc: '紧凑不占地 vs 视觉主位' },
    { key: 'office_decency', label: '得体分寸', icon: '🤝', desc: '不显招摇 / 优雅得体' },
    { key: 'durability', label: '经年陪伴', icon: '⏳', desc: '抗摔耐磨经久耐用' },
  ],
}

/** 🌟 初始未识别出具体品类时的通用 8 维动态槽位 */
export const DEFAULT_DYNAMIC_TRAIT_PACK = [
  { key: 'lifestyle_domain', label: '爱好领域', icon: '🎯', desc: '主生活赛道与兴趣' },
  { key: 'core_need', label: '核心诉求', icon: '💡', desc: '功能痛点或心意期望' },
  { key: 'usage_scene', label: '使用场景', icon: '📍', desc: '日常起居/办公/出行' },
  { key: 'aesthetic_style', label: '审美风格', icon: '🎨', desc: '调性偏好与视觉风格' },
  { key: 'carrier_type', label: '心意载体', icon: '🎁', desc: '硬核器具/生活周边/消耗品' },
  { key: 'practicality_ratio', label: '实用侧重', icon: '⚖️', desc: '高频实用 vs 仪式惊喜' },
  { key: 'portability_space', label: '空间与便携', icon: '📐', desc: '随行便携 vs 室内常驻' },
  { key: 'special_touch', label: '专属象征', icon: '✨', desc: '共鸣细节与开箱惊喜' },
]

/**
 * 🌟 初始化完整的 12 特质卡槽模型
 */
export function createInitial12Traits() {
  const slots = []
  // 1. 装入 4 个核心基盘槽
  for (const b of BASE_TRAIT_SLOTS) {
    slots.push({
      key: b.key,
      label: b.label,
      icon: b.icon,
      desc: b.desc,
      value: '',
      isFilled: false,
      isBase: true,
      dynamicCategory: 'base',
    })
  }
  // 2. 装入 8 个通用衍生槽，确保总数始终为 12
  for (const d of DEFAULT_DYNAMIC_TRAIT_PACK) {
    slots.push({
      key: d.key,
      label: d.label,
      icon: d.icon,
      desc: d.desc,
      value: '',
      isFilled: false,
      isBase: false,
      dynamicCategory: 'general',
    })
  }
  return slots
}

/**
 * 🌟 根据识别到的生活领域或大模型建议，动态调整后 8 个槽位的定义（保持已填内容不丢）
 */
export function morphDynamicTraitsByDomain(currentTraits = [], domain = '', customSuggestedSlots = []) {
  if (!Array.isArray(currentTraits) || currentTraits.length < 4) {
    currentTraits = createInitial12Traits()
  }

  // 1. 保留前 4 个基底槽
  const baseSlots = currentTraits.slice(0, 4)
  const existingDynamicMap = new Map()
  for (let i = 4; i < currentTraits.length; i++) {
    const s = currentTraits[i]
    if (s.value && s.isFilled) {
      existingDynamicMap.set(s.key, s)
    }
  }

  // 2. 寻找匹配的领域槽包
  let targetPack = null
  const cleanDomain = String(domain || '').toLowerCase()
  for (const [packKey, pack] of Object.entries(DOMAIN_TRAIT_PACKS)) {
    if (cleanDomain.includes(packKey) || packKey.includes(cleanDomain)) {
      targetPack = pack
      break
    }
  }

  // 尝试通过 DOMAIN_KNOWLEDGE 映射
  if (!targetPack && domain) {
    for (const [k, d] of Object.entries(DOMAIN_KNOWLEDGE)) {
      if (domain.includes(d.name) || d.name.includes(domain)) {
        if (DOMAIN_TRAIT_PACKS[k]) {
          targetPack = DOMAIN_TRAIT_PACKS[k]
          break
        }
      }
    }
  }

  // 若无特定领域，且有模型推荐的槽位
  let dynamicSlotsToUse = []
  if (targetPack) {
    dynamicSlotsToUse = targetPack
  } else if (Array.isArray(customSuggestedSlots) && customSuggestedSlots.length >= 4) {
    dynamicSlotsToUse = customSuggestedSlots.slice(0, 8)
  } else {
    dynamicSlotsToUse = DEFAULT_DYNAMIC_TRAIT_PACK
  }

  // 3. 构建新的 8 个动态槽，保留已有的值
  const newDynamicSlots = dynamicSlotsToUse.slice(0, 8).map((template, idx) => {
    // 检查是否有历史同 key 或按顺序保留的有效值
    const oldByExactKey = existingDynamicMap.get(template.key)
    const oldSlotAtIdx = currentTraits[4 + idx]
    let value = ''
    let isFilled = false

    if (oldByExactKey && oldByExactKey.isFilled) {
      value = oldByExactKey.value
      isFilled = true
    } else if (oldSlotAtIdx && oldSlotAtIdx.isFilled && oldSlotAtIdx.dynamicCategory === 'general') {
      // 继承通用槽位已填的值
      value = oldSlotAtIdx.value
      isFilled = true
    }

    return {
      key: template.key,
      label: template.label,
      icon: template.icon || '✨',
      desc: template.desc || template.label,
      value,
      isFilled,
      isBase: false,
      dynamicCategory: targetPack ? 'domain' : 'custom',
    }
  })

  // 确保刚好拼满 12 个槽
  while (newDynamicSlots.length < 8) {
    const fallbackTemplate = DEFAULT_DYNAMIC_TRAIT_PACK[newDynamicSlots.length]
    newDynamicSlots.push({
      key: fallbackTemplate.key,
      label: fallbackTemplate.label,
      icon: fallbackTemplate.icon,
      desc: fallbackTemplate.desc,
      value: '',
      isFilled: false,
      isBase: false,
      dynamicCategory: 'general',
    })
  }

  return [...baseSlots, ...newDynamicSlots]
}

/**
 * 🌟 核心裁决器：用户输入之后，Jev 判断“符不符合这个特质”
 * - 如果符合：精准填到对应槽位，置信点亮
 * - 如果不符合/模糊/无关：坚决不填，绝不塞脏数据！
 */
export function evaluateAndFill12Traits(currentTraits = [], extractedCandidate = {}, currentAnswers = {}) {
  let traits = Array.isArray(currentTraits) && currentTraits.length === 12
    ? currentTraits.map((t) => ({ ...t }))
    : createInitial12Traits()

  if (!extractedCandidate || typeof extractedCandidate !== 'object') {
    extractedCandidate = {}
  }

  // 辅助清洗：过滤掉纯未知/无意义词汇
  const cleanVal = (v) => {
    if (!v || typeof v !== 'string') return ''
    const s = v.trim()
    if (s.length < 2) return ''
    if (/^(null|undefined|未知|不知道|看情况|无所谓|随便|跳过|不限|不清楚)$/i.test(s)) return ''
    return s
  }

  // 1. 自动从 currentAnswers 同步基础通用槽位
  // [Slot 0: recipient]
  if (!traits[0].isFilled) {
    const r = cleanVal(currentAnswers.recipient || extractedCandidate.recipient)
    if (r) {
      traits[0].value = r
      traits[0].isFilled = true
    }
  }

  // [Slot 1: occasion]
  if (!traits[1].isFilled) {
    const occ = cleanVal(currentAnswers.occasion || currentAnswers.work_occasion || extractedCandidate.occasion)
    if (occ) {
      traits[1].value = occ
      traits[1].isFilled = true
    }
  }

  // [Slot 2: budget]
  if (!traits[2].isFilled) {
    const b = cleanVal(currentAnswers.budget || extractedCandidate.budget)
    if (b) {
      traits[2].value = b
      traits[2].isFilled = true
    }
  }

  // [Slot 3: taboo]
  if (!traits[3].isFilled) {
    const tb = cleanVal(currentAnswers.taboo || currentAnswers.avoid || extractedCandidate.taboo || extractedCandidate.avoid)
    if (tb) {
      traits[3].value = tb
      traits[3].isFilled = true
    }
  }

  // 2. 处理大模型识别到的 extracted_traits
  for (const [candidateKey, rawValue] of Object.entries(extractedCandidate)) {
    const val = cleanVal(rawValue)
    if (!val) continue

    // 寻找最佳匹配槽位
    const targetSlot = traits.find((slot) => {
      if (slot.key === candidateKey) return true
      // 容错与同义词映射
      if (candidateKey.includes('gear') && slot.key.includes('gear')) return true
      if (candidateKey.includes('scene') && slot.key.includes('scene')) return true
      if (candidateKey.includes('style') && slot.key.includes('style')) return true
      if (candidateKey.includes('need') && slot.key.includes('need')) return true
      if (candidateKey.includes('flavor') && slot.key.includes('flavor')) return true
      return false
    })

    if (targetSlot) {
      // 🌟 Jev 裁决：确切语义匹配，入槽！
      targetSlot.value = val
      targetSlot.isFilled = true
    }
  }

  return traits
}

/**
 * 🌟 生成供大模型 Prompt 参考的“已知特质画像黑板”
 * 作用：作为大模型的已知记忆，绝不向大模型下达“去问第X个槽”的机械指令！
 */
export function formatTraitsBlackboardForPrompt(traits = []) {
  if (!Array.isArray(traits) || !traits.length) return ''

  const filledList = traits.filter((t) => t.isFilled && t.value)
  if (!filledList.length) return ''

  let out = '【已知心意特征】\n'
  filledList.forEach((t) => {
    out += `• ${t.label}（${t.key}）：${t.value}\n`
  })

  const pendingList = traits.filter((t) => !t.isFilled)
  if (pendingList.length) {
    out += '\n【未明确的参考维度（仅供买手直觉权衡，严禁像审讯员一样逐条点名）：】\n'
    out += pendingList.map((t) => t.label).join('、') + '\n'
  }

  return out
}
