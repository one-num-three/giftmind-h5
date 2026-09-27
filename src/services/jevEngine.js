/**
 * ══════════════════════════════════════════════════════════════
 *  Jev 导购前台核心决策与对话状态追踪引擎 (Jev DST & Fast Decision Engine v3.0)
 *  —— 本地确定性职责 + 轻量快决策：
 *     1. DST 槽位看板梳理 (Slot Canvas)：1ms 整理用户输入的非结构化/选项数据为标准化槽位；
 *     2. 选项归类快决策 (clusterOptionsByJev)：调用 Jev SystemOne 成对判定候选选项是否应合并；
 *     3. 绝不越权硬编码品类细节：出题发散完全交给大模型，本地层只做整理与收敛。
 * ══════════════════════════════════════════════════════════════
 */

import { classifyRelationship } from '../utils/relationship.js'
import { callJevSystemOne } from './jevClient.js'

/** 垂直领域轻量识别词典 (轻量识别分类，绝不硬编码狭窄选项) */
export const DOMAIN_KNOWLEDGE = {
  ai_tech: {
    name: 'AI与数字科技',
    keywords: ['大模型', '人工智能', '编程', '代码', '算法', 'python', '机器人', '开发', 'llm'],
    pattern: /\b(ai|llm)\b|人工智能|大模型|编程|算法|代码|开发|机器人/i,
  },
  gaming: {
    name: '电子游戏与数码',
    keywords: ['游戏', '电竞', '开黑', 'switch', '掌机', '手柄', 'steam', '主机', 'pc', '端游', '手游', '数码'],
  },
  photo: {
    name: '摄影记录与影像',
    keywords: ['摄影', '拍照', '相机', '胶片', '微单', '拍立得', '镜头', '微距'],
  },
  tea: {
    name: '茶道品茗',
    keywords: ['茶道', '泡茶', '品茗', '普洱', '白茶', '龙井', '工夫茶', '茶具', '茶叶', '喝茶', '紫砂', '茶器', '盖碗'],
  },
  coffee: {
    name: '咖啡生活',
    keywords: ['咖啡', '手冲', '拿铁', '浓缩', '咖啡豆', '摩卡壶', '美式'],
  },
  outdoor: {
    name: '户外运动探索',
    keywords: ['户外', '徒步', '露营', '跑', '运动', '登山', '骑行', '钓鱼'],
  },
  desk: {
    name: '办公与桌面美学',
    keywords: ['办公', '桌面', '工位', '书写', '商务', '久坐', '收纳'],
  },
  model_toys: {
    name: '潮玩模型积木',
    keywords: ['乐高', '积木', '高达', '手办', '模型', '拼装'],
  },
  music: {
    name: '音乐与音频美学',
    keywords: ['音乐', '吉他', '乐器', '耳机', '黑胶', 'hifi'],
  },
  wellness: {
    name: '居家治愈与康养',
    keywords: ['养生', '睡眠', '按摩', '放松', '泡脚', '眼罩', '颈椎', '香薰'],
  },
  beauty: {
    name: '生活美学与时尚',
    keywords: ['美妆', '香水', '穿搭', '饰品', '首饰', '护肤', '包包'],
  },
}

/** 判定用户答案是否属于纯未知/跳过（未包含任何有效事实或转折） */
export const isPureUnknownValue = (v) => {
  const s = String(v || '').trim()
  if (!s) return true
  // 包含转折或具体线索（但、不过、家里、平时、喜欢、千万、不喝、不抽、除了等），不是纯未知
  if (/(但|不过|家里|平时|喜欢|千万|不喝|不抽|除了)/.test(s)) {
    return false
  }
  if (/^(不清楚|不太清楚|没留意|没关注|不知道|不确定|没注意|看情况|无所谓|随便|跳过)/i.test(s)) return true
  if (/不太清楚\s*[\/、]\s*没留意/i.test(s)) return true
  if (/(容错率高|不易踩雷|稳妥方案)/i.test(s)) return true
  return false
}

export const isUnknownValue = (v) => isPureUnknownValue(v)

/**
 * 🌟 1. 梳理当前所有答案为 4 层标准化事实看板 (4-Layer Fact State Canvas)
 * 纯确定性、耗时 < 1ms。严格区分：
 *   - confirmed_facts: 用户明确说过、有据可查的事实
 *   - model_hypotheses: 待确认的推测（严禁当事实下钻）
 *   - explicit_exclusions: 明确排除的雷区/忌讳
 *   - unknown_or_skipped: 用户明确表示不知道、没留意或跳过的维度
 */
export function buildDialogStateCanvas(answers = {}) {
  const confirmed_facts = {}
  const model_hypotheses = {}
  const explicit_exclusions = []
  const unknown_or_skipped = []

  const entries = Object.entries(answers || {})
  for (const [k, rawVal] of entries) {
    const valStr = Array.isArray(rawVal) ? rawVal.join('、') : String(rawVal || '').trim()
    if (!valStr) {
      unknown_or_skipped.push({ key: k, value: '已跳过' })
      continue
    }

    if (isPureUnknownValue(valStr)) {
      unknown_or_skipped.push({ key: k, value: valStr })
      continue
    }

    // 处理复合句 / 复杂自然语言输入
    // 分割子句分析禁忌、预算与有效事实
    const clauses = valStr.split(/[，,；;。！!\n]+/).map((c) => c.trim()).filter(Boolean)
    let hasExclusionClause = false
    const positiveClauses = []

    for (const clause of clauses) {
      // 1. 忌讳与排除项解析
      if (k === 'taboo' || k === 'constraints' || /不要|别送|避开|排斥|反感|不能有|禁止|除了/.test(clause)) {
        if (!explicit_exclusions.includes(clause)) {
          explicit_exclusions.push(clause)
        }
        hasExclusionClause = true
      } else if (isPureUnknownValue(clause)) {
        // 子句是纯未知（如 "不清楚品牌"），不加入 positiveClauses
      } else {
        // 正向事实子句（如 "但家里有咖啡机" -> 去掉开头的转折词 "但" / "但是" / "不过"）
        const cleaned = clause.replace(/^(但|但是|不过|另外|其实)\s*/, '').trim()
        if (cleaned) {
          positiveClauses.push(cleaned)
        }
      }

      // 2. 预算检测提取（必须有明确的货币符号、单位或预算关键词上下文，避免把像素/年份/普通词汇误当成预算）
      if (!answers.budget && !confirmed_facts.budget && /(?:预算|价位|花费)\s*[¥￥]?\s*\d+|[¥￥]\s*\d+|\d{2,5}\s*(?:元|块)(?:左右|上下|以内)?/.test(clause)) {
        const bMatch = clause.match(/((?:预算\s*)?[¥￥]?\s*\d{2,5}(?:\s*[-–~至到]\s*\d{2,5})?\s*(?:元|块)?(?:左右|上下)?)/)
        if (bMatch && bMatch[1] && /[¥￥元块]|预算/.test(bMatch[1])) {
          confirmed_facts.budget = bMatch[1].trim()
        }
      }
    }

    // 如果整句有明确排除且尚未被子句收集，或字段属于明确 taboo / constraints
    if ((k === 'taboo' || k === 'constraints' || /不要|别送|避开|排斥|反感/.test(valStr)) && !explicit_exclusions.includes(valStr)) {
      explicit_exclusions.push(valStr)
    }

    // 确定性正向事实录入
    if (positiveClauses.length > 0) {
      confirmed_facts[k] = positiveClauses.join('，')
    } else if (!hasExclusionClause && !isPureUnknownValue(valStr) && k !== 'taboo' && k !== 'constraints') {
      confirmed_facts[k] = valStr
    }
  }


  // 纠偏与清除：如果用户在后续步骤为某个曾跳过的维度提供了确定事实，从 unknown_or_skipped 中清除
  const resolvedKeys = new Set(Object.keys(confirmed_facts))
  const finalUnknownOrSkipped = unknown_or_skipped.filter((u) => !resolvedKeys.has(u.key))
  const unknown_dimensions = finalUnknownOrSkipped.map((u) => u.key.toLowerCase())

  const canvas = {
    // 4 层认知状态
    confirmed_facts,
    model_hypotheses,
    explicit_exclusions,
    unknown_or_skipped: finalUnknownOrSkipped,
    unknown_dimensions,

    // 结构化投影（兼容下游视图与徽标）
    recipient: confirmed_facts.recipient || null,
    rel_category: 'friend',
    friend_sub_type: null,
    domain: null,
    modality: null,
    focus_detail: null,
    core_need: null,
    compatibility_spec: null,
    budget: confirmed_facts.budget || answers.budget || null,
    raw_texts: Object.values(confirmed_facts),
  }

  // 提取正向用户文本（过滤掉包含排除、忌讳、否定的子句，杜绝 "不要咖啡" 误识别为咖啡偏好）
  const positiveTexts = []
  for (const [k, v] of entries) {
    if (k === 'recipient' || k === 'taboo' || k === 'constraints') continue
    const s = String(v || '').trim()
    if (!s || isPureUnknownValue(s)) continue

    const subClauses = s.split(/[，,；;。！!\n]+/).map((c) => c.trim()).filter(Boolean)
    for (const c of subClauses) {
      if (/不要|别送|避开|排斥|反感|不能有|禁止|除了|不喝|不玩|不喜/.test(c)) {
        continue
      }
      positiveTexts.push(c)
    }
  }
  const userPositiveText = positiveTexts.join(' ')

  // 1. 关系判定
  if (answers.recipient && !isPureUnknownValue(answers.recipient)) {
    canvas.recipient = answers.recipient
    canvas.rel_category = classifyRelationship(answers.recipient)
  }

  // 2. 朋友细分类型判定
  if (canvas.rel_category === 'friend') {
    if (/哥们|兄弟|开黑|球友/.test(userPositiveText)) {
      canvas.friend_sub_type = '铁哥们 / 兄弟'
    } else if (/闺蜜|姐妹|女性朋友/.test(userPositiveText)) {
      canvas.friend_sub_type = '好闺蜜 / 姐妹'
    } else if (/死党|同窗|发小|老同学/.test(userPositiveText)) {
      canvas.friend_sub_type = '同窗死党'
    } else if (/搭子|玩伴|饭搭子/.test(userPositiveText)) {
      canvas.friend_sub_type = '日常搭子 / 玩伴'
    }
  }

  // 3. 垂直领域/核心兴趣判定（以用户实际回答的正向文本为准，杜绝否定词）
  if (answers.domain && !isPureUnknownValue(answers.domain) && !/不要|别送|避开/.test(answers.domain)) {
    canvas.domain = answers.domain
  } else if (answers.preference_direction && !isPureUnknownValue(answers.preference_direction) && !/不要|别送|避开/.test(answers.preference_direction)) {
    canvas.domain = answers.preference_direction
  } else {
    for (const [key, d] of Object.entries(DOMAIN_KNOWLEDGE)) {
      if (d.pattern && d.pattern.test(userPositiveText)) {
        canvas.domain = d.name
        break
      } else if (d.keywords.some((w) => userPositiveText.toLowerCase().includes(w.toLowerCase()))) {
        canvas.domain = d.name
        break
      }
    }
    // 🌟 兜底自由吸纳：如果字典未命中，但用户在第1题之后回答了任何有效正向偏好内容，直接采纳为 domain
    if (!canvas.domain && userPositiveText) {
      const nonRecipientEntries = entries.filter(
        ([k, v]) => k !== 'recipient' && k !== 'friend_sub_type' && k !== 'budget' && !isPureUnknownValue(v) && !/不要|别送|避开|排斥|反感/.test(String(v || ''))
      )
      if (nonRecipientEntries.length > 0) {
        canvas.domain = String(nonRecipientEntries[0][1]).replace(/[\r\n\t]/g, ' ').trim()
      }
    }
  }

  // 4. 心意形态 (Modality) 判定
  if (answers.modality && !isPureUnknownValue(answers.modality)) {
    canvas.modality = answers.modality
  } else if (/本体|游戏本身|卡带|steam|算力|会员|原叶|咖啡豆|茶叶|喝的|吃/.test(userPositiveText)) {
    canvas.modality = '体验/内容本体'
  } else if (/周边|手办|画册|盲盒|玩偶|公仔|摆件|徽章|联名/.test(userPositiveText)) {
    canvas.modality = '实体文化周边'
  } else if (/外设|手柄|耳机|装备|器具|器皿|壶|杯|包|工具|套件|键盘/.test(userPositiveText)) {
    canvas.modality = '功能装备外设'
  } else if (/桌游|聚会|互动|体验|双人|门票|比赛|挑战/.test(userPositiveText)) {
    canvas.modality = '社交互动体验'
  }

  // 5. 题材与喜好细节 (Focus Detail)
  if (answers.focus_detail && !isPureUnknownValue(answers.focus_detail)) {
    canvas.focus_detail = String(answers.focus_detail)
  } else if (answers.specific_scene && !isPureUnknownValue(answers.specific_scene)) {
    canvas.focus_detail = String(answers.specific_scene)
  }

  // 6. 核心诉求/痛点 (Core Need)
  if (answers.core_need && !isPureUnknownValue(answers.core_need)) {
    canvas.core_need = String(answers.core_need)
  }

  // 7. 设备兼容与卡口平台 (Compatibility / Mount / Platform)
  if (answers.compatibility_spec && !isPureUnknownValue(answers.compatibility_spec)) {
    canvas.compatibility_spec = String(answers.compatibility_spec)
  } else if (/索尼|佳能|尼康|富士|莱卡|松下|e卡口|rf|z卡口|m43|steam|switch|ps5|xbox|pc|电脑/i.test(userPositiveText)) {
    const m = userPositiveText.match(/索尼|佳能|尼康|富士|莱卡|松下|e卡口|rf|z卡口|m43|steam|switch|ps5|xbox|pc|电脑/i)
    if (m) canvas.compatibility_spec = m[0]
  }

  // 8. 预算
  if (answers.budget && !isPureUnknownValue(answers.budget)) {
    canvas.budget = String(answers.budget)
  }

  return canvas
}

/**
 * 🌟 2. 选项归类快决策：成对判定候选是否同一类该合并（Jev noul，一次调用问完所有对）
 * 第一阶段大模型高温多想保覆盖，此处只去重收敛保层级。阈值 0.65：实测真重复 ≥0.85、跨类 ≤0.26，
 * 间隔大、判得稳；合并用并查集，每类保留原顺序首个代表（即买手自己的优先级顺序）。
 */
const OPTION_CUSTOM_LABEL_RE = /自定义|其他|自己填|我来说/

export async function clusterOptionsByJev(candidates, contextText = '') {
  const list = (Array.isArray(candidates) ? candidates : []).filter((o) => o && typeof o === 'object')
  if (list.length < 2) return list
  const capped = list.slice(0, 12)
  const labels = capped.map((o) => String(o.label ?? '').trim())

  const state = `${String(contextText || '').slice(0, 3000)}\n\nAI 买手想出以下候选选项（编号从1开始）。请判断某两个候选是否指向同一类东西、应当合并：\n` +
    labels.map((label, i) => `候选${i + 1}: ${label}`).join('\n')

  const questions = {}
  for (let a = 0; a < capped.length; a++) {
    for (let b = a + 1; b < capped.length; b++) {
      questions[`pair_${a}_${b}`] = {
        type: 'noul',
        instructions: `候选${a + 1}「${labels[a]}」与候选${b + 1}「${labels[b]}」是否指向同一类东西、应当合并为一个选项？`,
      }
    }
  }

  const res = await callJevSystemOne({ state, questions, timeout: 12000 })
  const answers = (res && res.answers) || {}

  const parent = capped.map((_, i) => i)
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const MERGE_THRESHOLD = 0.65
  for (let a = 0; a < capped.length; a++) {
    if (OPTION_CUSTOM_LABEL_RE.test(labels[a])) continue
    for (let b = a + 1; b < capped.length; b++) {
      if (OPTION_CUSTOM_LABEL_RE.test(labels[b])) continue
      const v = answers[`pair_${a}_${b}`]?.noul
      if (typeof v === 'number' && v >= MERGE_THRESHOLD) parent[find(a)] = find(b)
    }
  }

  const seen = new Set()
  const reps = []
  for (let i = 0; i < capped.length; i++) {
    const root = find(i)
    if (seen.has(root)) continue
    seen.add(root)
    reps.push(capped[i])
  }
  return reps
}

/** 选项封顶：最多 max 个，但"其他/自定义"兜底项永不被挤掉 */
export function capOptionsWithCustomGuard(options, max = 6) {
  const list = Array.isArray(options) ? options : []
  if (list.length <= max) return list
  const kept = []
  for (const opt of list) {
    const label = typeof opt?.label === 'string' ? opt.label : ''
    if (kept.length >= max && !OPTION_CUSTOM_LABEL_RE.test(label)) continue
    kept.push(opt)
  }
  return kept
}
