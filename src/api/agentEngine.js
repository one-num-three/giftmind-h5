/**
 * Agent 闲聊模式引擎（二期）
 *
 * 产品口径（用户拍板）：
 *  - 自由聊天攒画像，模型每轮顺带把聊出来的信息提炼进画像槽位（slots）
 *  - 方案只由用户点「生成方案」按钮触发；checkPlanReadiness 检查信息够不够，
 *    不够就给一句自然追问继续聊（AI 绝不主动提出做方案）
 *  - chips 随缘：模型判断"给几个并列方向可点"有助益时才给，可点可打字
 *
 * 每轮一次大模型调用（jsonMode），宽容解析，解析失败兜底不炸对话。
 */
import { callChatModel } from './aiService'

/** 固定开场白：零模型调用，进场秒出（恢复现场时已有历史则不再播） */
export const AGENT_GREETING =
  '嗨，我是你的挑礼搭子～这里没有固定题目，你随便聊：TA 是谁、平时喜欢什么、你们之间有什么故事、预算大概多少，想到哪说到哪，我会顺着你的话往下问。聊到你觉得行了，点右上角的「生成方案」就行。'

const SLOT_HINT = `slots 为从对话里提炼出的画像增量（本轮没有新信息就填空对象，别硬凑），键名用这套约定：
recipient 送谁、budget 预算区间、occasion 场合由头、preference_direction 兴趣方向、specific_scene 具体场景、style_preference 风格偏好、personality 性格气质、memory 共同记忆、feeling 想传达的心意、relationship_note 关系补充；职场送礼可用 work_occasion、work_lifestyle、work_core_need、work_style_tone。值用贴近用户原话的具体短语，不要空洞形容词。用户纠正过的信息以最新说法为准。`

const AGENT_SYS_PROMPT = `你是 GiftMind 的资深挑礼买手，现在处于自由闲聊模式：没有固定问卷，用户像朋友一样随口说送礼需求，你像真人搭子一样自然接话。

聊天要求：
1. 用户说啥你回一句：接话、共鸣、顺着聊、补充相关见闻都可以，但绝不向用户提问——回复里不带问号，不用"预算多少？/她喜欢什么？/你呢？"这类追问式结尾。追问是问答模式干的事，闲聊模式只接话；信息不够时不许问，等用户点「生成方案」时由专门的检查流程来问。
2. 边聊边记：把聊出来的关键信息提炼进 slots（画像槽位），约定见下方。不用告诉用户你在记，用户纠正过的信息以最新说法为准。
3. chips 可点选项默认不用（chips 置 null）：仅当用户明确表达"在两三个选项之间拿不定主意"时，才把那几个选项给出来帮 TA 一把；拿不准就不给。
4. 绝不主动提出"生成方案 / 出方案 / 做方案 / 给你做一份"：方案只由用户点界面按钮触发，你只负责陪聊；用户主动说"生成方案"时，正常回应并等他点按钮。
5. 体验类礼物只锁定类型与调性，不替用户安排执行细节（时间、店铺、行程）。

${SLOT_HINT}

为了界面渲染，请严格返回 JSON：{"reply": string, "chips": [{"label": string, "value": string}] | null, "slots": object}。reply 是你本轮要说的话：口语、简短、有温度，不带问号。`

const INTERROGATE_SYS_PROMPT = `你是 GiftMind 的方案前信息补全员。用户点了「生成方案」按钮，现在进入收尾补全阶段：根据已有画像和对话，检查还缺什么关键信息，一次出一道题问用户。

判定「还缺什么」的标准：凭现有信息能不能给出「专门针对这个人」的选品建议——不是「送这类人的通用安全牌」，而是结合了 TA 的风格、场景、偏好之后让人点头说「对，这就是 TA 会喜欢的」那种。只能给出通用推荐或靠瞎猜，就说明还有关键缺口。缺什么算关键由你自己掂量：会让选品漂移的信息（送谁、方向、预算这类）是底线；无关紧要的细节方案里自行覆盖，不算缺口。

硬性规则：
1. 已知不重复问：发给你的画像槽位是已经聊出来的，不许再问这些或它们的同义变体。
2. 预算不可缺席：画像里没有 budget 时本轮必须问预算——这是收尾前的底线，其他都齐了也不许宣告完成。
3. 一次只问一个焦点，问句要明写问号收尾，不许把问题埋在陈述里；先一句话点明为什么问这个更稳。
4. 适合点选的问题（口味、场合、风格档位这类）给 2~4 个互不重叠的选项；开放性问题（比如"他平时喜欢做什么"）给空数组，让用户自由打字。
5. 信息已够给出针对这个人的选品、且预算已掌握 → 输出完成，不许多问、不许客套。

输出 JSON（严格二选一）：
- 还需要问 → {"done": false, "question": string, "options": [{"label": string, "value": string}] 或 [], "slot_key": string}。slot_key 是本题答案会补进的槽位，键名用这套约定：recipient、budget、occasion、preference_direction、specific_scene、style_preference、personality、memory、feeling、relationship_note、work_occasion、work_lifestyle、work_core_need、work_style_tone。
- 齐了 → {"done": true}`

/** 对话历史压缩：仅保留 user/ai 交替文本，system 与 muted 的内部标记不进模型上下文 */
function formatHistory(messages, limit = 40) {
  const lines = []
  for (const m of messages || []) {
    if (!m || !m.text || m.muted) continue
    if (m.role === 'user') lines.push(`【用户】: ${m.text}`)
    else if (m.role === 'ai') lines.push(`【买手】: ${m.text}`)
  }
  return lines.slice(-limit).join('\n')
}

function safeJson(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

/** 解析闲聊回复：容错兜底——解析失败也给能看的 reply，chips/slots 为空，对话不中断 */
export function normalizeAgentReply(raw) {
  const parsed = safeJson(raw)
  const reply =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : '嗯嗯我在听，你再多说两句 TA 的事？'
  const chips = Array.isArray(parsed?.chips)
    ? parsed.chips
        .map((c) => ({
          label: String(c?.label || '').trim().slice(0, 8),
          value: String(c?.value || c?.label || '').trim(),
        }))
        .filter((c) => c.label && c.value)
        .slice(0, 4)
    : []
  const slots =
    parsed?.slots && typeof parsed.slots === 'object' && !Array.isArray(parsed.slots) ? parsed.slots : {}
  return { reply, chips, slots }
}

/** 槽位白名单：模型给的 slot_key 不在表内就丢弃，防拼写错误的脏键混进画像 */
const SLOT_KEYS = new Set([
  'recipient', 'budget', 'occasion', 'preference_direction', 'specific_scene',
  'style_preference', 'personality', 'memory', 'feeling', 'relationship_note',
  'work_occasion', 'work_lifestyle', 'work_core_need', 'work_style_tone',
])

/**
 * 解析出题结果：{"done":true} → {done:true}；{"done":false,...} → {done:false,question,options,slotKey}；
 * 解析失败返回 null，由调用方播兜底追问，不炸对话。
 */
export function normalizeNextQuestion(raw) {
  const parsed = safeJson(raw)
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.done === true) return { done: true, question: '', options: [], slotKey: '' }
  const question = typeof parsed.question === 'string' ? parsed.question.trim() : ''
  if (!question) return null
  const options = Array.isArray(parsed.options)
    ? parsed.options
        .map((o) => ({
          label: String(o?.label || '').trim().slice(0, 8),
          value: String(o?.value || o?.label || '').trim(),
        }))
        .filter((o) => o.label && o.value)
        .slice(0, 4)
    : []
  const slotKey =
    typeof parsed.slot_key === 'string' && SLOT_KEYS.has(parsed.slot_key.trim())
      ? parsed.slot_key.trim()
      : ''
  return { done: false, question, options, slotKey }
}

/**
 * 闲聊一轮：用户消息已进 session.messages，整段历史交给模型接话。
 * 单次调用，temperature 0.8（比出题稳一点，比检查员活一点）。
 */
export async function agentChat({ messages = [], answers = {} } = {}) {
  const history = formatHistory(messages)
  const userContent = `【对话记录】\n${history || '（刚开始聊）'}\n\n【当前画像】\n${JSON.stringify(answers, null, 2)}\n\n请接话。`
  const raw = await callChatModel(
    [
      { role: 'system', content: AGENT_SYS_PROMPT },
      { role: 'user', content: userContent },
    ],
    { jsonMode: true, temperature: 0.8, timeout: 35000 }
  )
  return normalizeAgentReply(raw)
}

/**
 * 点「生成方案」后的出题补全（温度 0.5：比闲聊稳、比旧检查活，出题质量优先）。
 * 单次调用完成「自检还缺什么 + 出一道题」，返回：
 * { done: true } 信息已够（预算下限由调用方程序把关）
 * { done: false, question, options, slotKey } 继续问
 * null 解析/调用失败，调用方播兜底追问
 */
export async function agentNextQuestion({ answers = {}, messages = [] } = {}) {
  const history = formatHistory(messages)
  const userContent = `【当前画像】\n${JSON.stringify(answers, null, 2)}\n\n【对话记录】\n${history || '（刚开始聊）'}\n\n请自检还缺什么并输出。`
  const raw = await callChatModel(
    [
      { role: 'system', content: INTERROGATE_SYS_PROMPT },
      { role: 'user', content: userContent },
    ],
    { jsonMode: true, temperature: 0.5, timeout: 35000 }
  )
  return normalizeNextQuestion(raw)
}
