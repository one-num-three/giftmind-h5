import { describe, expect, it } from 'vitest'

import { selectOngoingProjects, ongoingTitle, ongoingMetaText } from '@/utils/ongoing'

describe('ongoing projects（进行中的挑礼）', () => {
  it('只保留未存方案且答过至少 1 题的项目，按更新时间倒序，最多 3 个', () => {
    const list = [
      { id: 'p1', title: 'A', currentPlanId: 'plan-1', answerSteps: { a: {} }, updatedAt: '2026-09-27T10:00:00' },
      { id: 'p2', title: 'B', currentPlanId: null, answerSteps: { a: {} }, updatedAt: '2026-09-27T09:00:00' },
      { id: 'p3', title: 'C', currentPlanId: null, answerSteps: {}, updatedAt: '2026-09-27T11:00:00' },
      { id: 'p4', title: 'D', currentPlanId: null, answerSteps: { a: {}, b: {} }, updatedAt: '2026-09-27T12:00:00' },
      { id: 'p5', title: 'E', currentPlanId: null, answerSteps: { a: {} }, updatedAt: '2026-09-27T08:00:00' },
      { id: 'p6', title: 'F', currentPlanId: null, answerSteps: { a: {} }, updatedAt: '2026-09-27T07:00:00' },
    ]
    const result = selectOngoingProjects(list)
    expect(result.map((p) => p.id)).toEqual(['p4', 'p2', 'p5'])
  })

  it('非数组输入安全返回空', () => {
    expect(selectOngoingProjects(null)).toEqual([])
    expect(selectOngoingProjects(undefined)).toEqual([])
  })

  it('agent 闲聊项目按用户开口次数入选；qa 只有消息没答题不入选', () => {
    const list = [
      { id: 'a1', title: '闲聊', mode: 'agent', currentPlanId: null, answerSteps: {}, userMessageCount: 2, messageCount: 5, updatedAt: '2026-09-27T10:00:00' },
      { id: 'a2', title: '只有开场白', mode: 'agent', currentPlanId: null, answerSteps: {}, userMessageCount: 0, messageCount: 1, updatedAt: '2026-09-27T11:00:00' },
      { id: 'q1', title: '问答', mode: 'qa', currentPlanId: null, answerSteps: { a: {} }, messageCount: 4, updatedAt: '2026-09-27T09:00:00' },
      { id: 'q2', title: '只收到开场白', mode: 'qa', currentPlanId: null, answerSteps: {}, messageCount: 4, updatedAt: '2026-09-27T12:00:00' },
    ]
    expect(selectOngoingProjects(list).map((p) => p.id)).toEqual(['a1', 'q1'])
  })

  it('标题优先用已答的受礼人', () => {
    expect(ongoingTitle({ answers: { recipient: '  我妈妈  ' }, title: '新的选礼项目' })).toBe('送给 我妈妈')
    expect(ongoingTitle({ answers: {}, title: '弟弟升学礼' })).toBe('弟弟升学礼')
    expect(ongoingTitle({})).toBe('未命名的挑礼')
  })

  it('副标文案：问答按题数、闲聊按用户开口次数', () => {
    expect(ongoingMetaText({ mode: 'qa', answerSteps: { a: {}, b: {} } })).toBe('已聊 2 题')
    expect(ongoingMetaText({ mode: 'agent', userMessageCount: 5, messageCount: 12 })).toBe('已聊 5 次')
    expect(ongoingMetaText({ mode: 'agent', messageCount: 1 })).toBe('已聊 0 次')
  })
})
