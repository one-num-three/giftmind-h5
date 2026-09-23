import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(async () => ({ gifts: [], letter: {}, ritual: [] })),
}))

vi.mock('@/api/request', () => ({
  http: { get: vi.fn(), post: postMock },
}))

import { generatePlan, replaceGift, normalizePlanningAnswers } from '@/api/realAdapter'
import { useSessionStore } from '@/stores/session'

describe('planning answer contract', () => {
  beforeEach(() => {
    localStorage.clear()
    postMock.mockClear()
    setActivePinia(createPinia())
  })

  it('stores skipped multi-choice answers as an empty list', () => {
    const store = useSessionStore()
    store.start()
    store.skip({ id: 'taboo', key: 'taboo', type: 'multi' })
    expect(store.answers.taboo).toEqual([])
  })

  it('normalizes legacy string values before calling the real API', async () => {
    expect(normalizePlanningAnswers({ personality: '文艺', taboo: '', style: null, allParticipantsAdults: 'false' })).toMatchObject({
      personality: ['文艺'],
      taboo: [],
      style: [],
      allParticipantsAdults: false,
    })

    await generatePlan({ personality: ['文艺'], taboo: '', style: '实物礼物' })
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0][1].answers).toMatchObject({
      personality: ['文艺'],
      taboo: [],
      style: ['实物礼物'],
    })
  })

  it('联网替换的请求窗口覆盖后端检索时限', async () => {
    await replaceGift({ answers: { budget: '1500元' }, gifts: [{ id: 'web-old' }] }, { targetId: 'web-old' })
    expect(postMock.mock.calls[0][2].timeout).toBe(180000)
    expect(postMock.mock.calls[0][1].answers.budget).toBe('1500元')
  })

  it('only writes summary edits that map safely to one structured field', () => {
    const store = useSessionStore()
    store.start()
    store.answers.recipient = '女朋友 / 妻子'
    store.answers.budget = '¥300–600'
    store.answers.occasion = '纪念日'
    store.applySummaryEdits({
      who: '送给小雨',
      story: '纪念日：我们第一次看极光。',
      feeling: '希望她感到被理解',
      constraints: '预算不变，仪式要简单',
    })
    expect(store.answers.recipient).toBe('女朋友 / 妻子')
    expect(store.answers.memory).toBe('我们第一次看极光。')
    expect(store.answers.feeling).toBe('希望她感到被理解')
    expect(store.answers.summaryNotes).toBeUndefined()
    expect(store.answers.occasion).toBe('纪念日')
  })

  it('reopens the conversation at a structured field without corrupting earlier answers', () => {
    const store = useSessionStore()
    store.start()
    store.answers = {
      recipient: '闺蜜 / 好友',
      recipientAge: '26–40岁',
      occasion: '生日',
      timing: '一周内',
      budget: '¥300–600',
      feeling: '被理解',
    }
    const budgetIndex = store.steps.findIndex((step) => step.id === 'budget')
    store.stepIndex = store.steps.length

    expect(store.revisit('budget')).toBe(true)
    expect(store.stepIndex).toBe(budgetIndex)
    expect(store.answers.recipient).toBe('闺蜜 / 好友')
    expect(store.answers.budget).toBeUndefined()
    expect(store.answers.feeling).toBeUndefined()
  })

  it('applies only safe fields from a no-candidate recovery option', () => {
    const store = useSessionStore()
    store.start(true)
    store.answers = {
      recipient: '闺蜜 / 好友',
      recipientAge: '26–40岁',
      budget: '¥50–150',
      timing: '一周内',
      taboo: ['不要吃的'],
    }

    expect(store.applyRecoveryPatch({
      budget: '¥150–300',
      timing: '两到四周',
      taboo: [],
      recipientAge: '成年人',
    })).toBe(true)

    expect(store.answers.budget).toBe('¥150–300')
    expect(store.answers.timing).toBe('两到四周')
    expect(store.answers.taboo).toEqual(['不要吃的'])
    expect(store.answers.recipientAge).toBe('26–40岁')
  })
})
