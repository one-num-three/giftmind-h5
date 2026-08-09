import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(async () => ({ gifts: [], letter: {}, ritual: [] })),
}))

vi.mock('@/api/request', () => ({
  http: { get: vi.fn(), post: postMock },
}))

import { generatePlan, normalizePlanningAnswers } from '@/api/realAdapter'
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

  it('writes summary edits back into structured answers', () => {
    const store = useSessionStore()
    store.start()
    store.applySummaryEdits({
      who: '送给小雨',
      story: '我们第一次看极光。',
      feeling: '希望她感到被理解',
      constraints: '预算不变，仪式要简单',
    })
    expect(store.answers.recipient).toBe('送给小雨')
    expect(store.answers.memory).toBe('我们第一次看极光。')
    expect(store.answers.feeling).toBe('希望她感到被理解')
    expect(store.answers.summaryNotes).toBe('预算不变，仪式要简单')
    expect(store.answers.occasion).toBeUndefined()
  })
})
