/**
 * 「进行中的挑礼」筛选与展示文案
 * 口径：还没存方案（currentPlanId 为空）且聊过的项目，按最近更新排序。
 * qa 答过至少 1 题才算聊过（只有消息没答题说明没真正开始）；
 * agent 没有题目，按「用户回答了几次」（userMessageCount，不含 AI 的话）判定参与度。
 * 两种口径分开，互不借用，避免「已聊 0 题」这种卡片。
 * 已有方案的项目走方案库的「继续完善」，不在这里重复出现。
 */

export function selectOngoingProjects(list, limit = 3) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => {
      if (!p || p.currentPlanId) return false
      return p.mode === 'agent'
        ? (p.userMessageCount || 0) > 0
        : Object.keys(p.answerSteps || {}).length > 0
    })
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, limit)
}

/** 列表卡片标题：优先用已答的受礼人，其次项目标题 */
export function ongoingTitle(project) {
  const recipient = typeof project?.answers?.recipient === 'string' ? project.answers.recipient.trim() : ''
  if (recipient) return `送给 ${recipient}`
  return project?.title || '未命名的挑礼'
}

/** 副标文案：问答按题数，闲聊按用户开口次数 */
export function ongoingMetaText(project) {
  if (project?.mode === 'agent') return `已聊 ${project.userMessageCount || 0} 次`
  return `已聊 ${Object.keys(project?.answerSteps || {}).length} 题`
}
