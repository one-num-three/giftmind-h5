import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSessionStore } from '@/stores/session'

function buildSession() {
  const session = useSessionStore()
  session.start(true)
  session.stepIndex = 3
  session.answers = { recipient: '送给我爸爸', hobby: '钓鱼', budget: '500 左右' }
  session.answerSteps = {
    recipient: { id: 'recipient', key: 'recipient', type: 'single', messages: ['这次想为谁挑礼物？'], options: [] },
    hobby: { id: 'dynamic_step_1', key: 'hobby', type: 'single', messages: ['他平时最上心什么？'], options: [{ label: '钓鱼', value: '钓鱼' }] },
    budget: { id: 'dynamic_step_2', key: 'budget', type: 'single', messages: ['预算大概多少？'], options: [] },
  }
  session.messages = [
    { id: 'm1', role: 'ai', text: '这次想为谁挑礼物？', stepId: 'recipient' },
    { id: 'm2', role: 'user', text: '送给我爸爸', stepId: 'recipient' },
    { id: 'm3', role: 'ai', text: '他平时最上心什么？', stepId: 'dynamic_step_1' },
    { id: 'm4', role: 'user', text: '讲讲区别', stepId: 'dynamic_step_1', muted: true },
    { id: 'm5', role: 'user', text: '钓鱼', stepId: 'dynamic_step_1' },
    { id: 'm6', role: 'ai', text: '预算大概多少？', stepId: 'dynamic_step_2' },
    { id: 'm7', role: 'user', text: '500 左右', stepId: 'dynamic_step_2' },
  ]
  return session
}

describe('session.revisitDynamic（点气泡改答案）', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('目标题及之后的答案全部作废，题目本体原样重新展示', () => {
    const session = buildSession()
    const ok = session.revisitDynamic('dynamic_step_1')

    expect(ok).toBe(true)
    // hobby 与 budget 一起作废，只保留更靠前的 recipient
    expect(Object.keys(session.answers)).toEqual(['recipient'])
    expect(Object.keys(session.answerSteps)).toEqual(['recipient'])
    expect(session.stepIndex).toBe(1)
    // 重新展示的是 answerSteps 里的题目快照（含原选项）
    expect(session.activeDynamicStep?.key).toBe('hobby')
    expect(session.activeDynamicStep?.options?.[0]?.label).toBe('钓鱼')
    expect(session.isFinished).toBe(false)
    // 消息流从该题回答气泡处截断；muted 的"讲讲区别"在同题回答之前，保留
    expect(session.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('改最后一题只作废这一题', () => {
    const session = buildSession()
    const ok = session.revisitDynamic('dynamic_step_2')

    expect(ok).toBe(true)
    expect(Object.keys(session.answers)).toEqual(['recipient', 'hobby'])
    expect(session.stepIndex).toBe(2)
    expect(session.activeDynamicStep?.key).toBe('budget')
    expect(session.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'])
  })

  it('未知 stepId 与未作答步骤一律拒绝，现场不动', () => {
    const session = buildSession()
    expect(session.revisitDynamic('dynamic_step_9')).toBe(false)
    expect(session.revisitDynamic('')).toBe(false)
    expect(Object.keys(session.answers)).toHaveLength(3)
    expect(session.messages).toHaveLength(7)
    expect(session.stepIndex).toBe(3)
  })

  it('作废答案派生的特质画像一并清零', () => {
    const session = buildSession()
    session.dynamic12Traits = session.dynamic12Traits.map((t, i) => (i === 0 ? { ...t, isFilled: true, value: '旧回答残留' } : t))

    session.revisitDynamic('dynamic_step_1')

    expect(session.dynamic12Traits.every((t) => !t.isFilled)).toBe(true)
  })
})
