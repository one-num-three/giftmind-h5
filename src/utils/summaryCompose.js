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

export function composeSummaryBlocks(answers = {}) {
  const recipient = text(answers.recipient, '对方')
  const occasion = text(answers.occasion, '一个特别的日子')
  const timing = text(answers.timing)

  let who = `送给${recipient}，为${occasion}`
  if (timing) who += `，计划${timing}内送出`
  const age = text(answers.recipientAge)
  if (age) who += `，年龄段：${age}`

  const story =
    text(answers.memory) ||
    text(answers.relationshipNote) ||
    '还没有提到具体的回忆，可以在下一步补充一句。'

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
  const notes = text(answers.summaryNotes)
  if (notes) parts.push(`补充说明：${notes}`)
  const constraints = parts.length ? parts.join('；') : '暂无特殊约束'

  return {
    who: { label: 'TA 是谁', text: who, fields: ['recipient', 'recipientAge'] },
    story: { label: '你们的故事', text: story, fields: ['memory'] },
    feeling: { label: '这次想表达什么', text: feeling, fields: ['feeling'] },
    constraints: {
      label: '预算与约束',
      text: constraints,
      fields: ['budget', 'timing', 'taboo', 'style', 'allParticipantsAdults', 'cityTierCode', 'summaryNotes'],
    },
  }
}
