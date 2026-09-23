/**
 * 四块摘要的规则组合（与后端 plan_summary 保持一致）。
 * Mock 模式直接用；真实模式以后端返回为准。
 */

function text(value, fallback = '') {
  const t = typeof value === 'string' ? value.trim() : ''
  return t || fallback
}

function listText(value, fallback = '') {
  const list = Array.isArray(value) ? value.map((x) => String(x).trim()).filter(Boolean) : []
  return list.length ? list.join('、') : fallback
}

function recipientText(value) {
  let recipient = text(value, '对方')
  while (recipient.startsWith('送给')) recipient = recipient.slice(2).trim()
  recipient = recipient.split(/，(?:为|年龄段|计划)/, 1)[0].trim()
  return recipient || '对方'
}

function cleanSummaryNotes(value) {
  const generatedPrefixes = [
    '预算：',
    '时间：',
    '避开：',
    '形式偏好：',
    '活动城市层级：',
    '活动参与者：',
  ]
  return text(value)
    .split('；')
    .map((part) => part.trim().replace(/^补充说明：/, ''))
    .filter((part) => part && !generatedPrefixes.some((prefix) => part.startsWith(prefix)))
    .join('；')
}

// 确认页按实际问题呈现，不再补写用户没有说过的故事和情绪。
export function composeConsultationBlocks(answers = {}, answerSteps = {}, messages = []) {
  const labels = {
    recipient: '送给谁', budget: '预算', occasion: '送礼契机', timing: '送出时间',
    taboo: '需要避开', constraints: '补充要求', memory: '你提到的细节',
    preference_direction: '偏好方向', domain: '兴趣方向', feeling: '想表达的心意',
  }
  return Object.entries(answers).filter(([key]) => key !== 'retry_action').map(([key, value], index) => {
    const step = answerSteps[key]
    const question = step?.messages?.at(-1)
    const oldQuestion = messages.filter((m) => m.role === 'ai' && m.stepId === key).at(-1)?.text
    const text = Array.isArray(value) ? value.join('、')
      : typeof value === 'boolean' ? (value ? '是' : '否')
        : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
    return {
      key, label: question || oldQuestion || labels[key] || `对话细节 ${index + 1}`,
      text, skipped: !text.trim(),
    }
  })
}

export function composeSummaryBlocks(answers = {}) {
  const recipient = recipientText(answers.recipient)
  const occasion = text(answers.occasion, '一个特别的日子')
  const timing = text(answers.timing)

  let who = `送给${recipient}`
  const age = text(answers.recipientAge)
  if (age) who += `，年龄段：${age}`

  const storyDetail = text(answers.memory) || text(answers.relationshipNote)
  const story = storyDetail
    ? `${occasion}：${storyDetail}`
    : `${occasion}：还没有提到具体的回忆，可以补充一句。`

  const feeling = text(answers.feeling, '希望 TA 感到被认真对待')

  const parts = []
  if (answers.budget != null) parts.push(`预算：${String(answers.budget)}`)
  if (timing) parts.push(`时间：${timing}`)
  const taboo = listText(answers.taboo)
  if (taboo) parts.push(`避开：${taboo}`)
  const style = listText(answers.style)
  if (style) parts.push(`形式偏好：${style}`)
  const cityTierLabels = {
    tier_1: '一线城市',
    tier_2: '二线城市',
    tier_3_or_below: '三线及以下',
  }
  const cityTier = cityTierLabels[answers.cityTierCode] || text(answers.city)
  if (cityTier) parts.push(`活动城市层级：${cityTier}`)
  if (answers.allParticipantsAdults === true) parts.push('活动参与者：全部成年')
  if (answers.allParticipantsAdults === false) parts.push('活动参与者：未全部确认成年')
  const notes = cleanSummaryNotes(answers.summaryNotes)
  if (notes) parts.push(`补充说明：${notes}`)
  const constraints = parts.length ? parts.join('；') : '暂无特殊约束'

  return {
    who: { label: '送给谁', text: who, fields: ['recipient', 'recipientAge'] },
    story: { label: '为什么送', text: story, fields: ['occasion', 'memory', 'relationshipNote'] },
    feeling: { label: '想表达什么', text: feeling, fields: ['feeling'] },
    constraints: {
      label: '必须满足',
      text: constraints,
      fields: ['budget', 'timing', 'taboo', 'style', 'allParticipantsAdults', 'cityTierCode', 'summaryNotes'],
    },
  }
}
