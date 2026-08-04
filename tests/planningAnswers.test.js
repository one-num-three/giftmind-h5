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
    expect(normalizePlanningAnswers({ personality: '文艺', taboo: '', style: null })).toMatchObject({
      personality: ['文艺'],
      taboo: [],
      style: [],
    })

    await generatePlan({ personality: ['文艺'], taboo: '', style: '实物礼物' })
    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0][1].answers).toMatchObject({
      personality: ['文艺'],
      taboo: [],
      style: ['实物礼物'],
    })
  })
})
