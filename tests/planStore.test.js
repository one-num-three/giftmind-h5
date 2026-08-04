import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { apiMock } = vi.hoisted(() => ({ apiMock: {
  getServiceStatus: vi.fn(async () => ({ ok: true, state: 'connected', activeGiftCount: 8 })),
  generatePlan: vi.fn(async () => ({
    title: '服务端方案',
    answers: { recipient: '错误覆盖' },
    gifts: [{ id: 'g1', catalogId: 'g1' }],
    letter: { paragraphs: ['正文'] },
    ritual: [],
  })),
  replaceGift: vi.fn(async () => ({ gift: { id: 'g2', catalogId: 'g2' } })),
  regenerateLetter: vi.fn(async () => ({ letter: { paragraphs: ['新正文'] } })),
  rewriteRitual: vi.fn(async () => ({ ritual: [{ title: '新步骤' }] })),
  fetchShareReplies: vi.fn(async () => []),
} }))
vi.mock('@/api', () => ({ default: apiMock }))

import { usePlanStore } from '@/stores/plan'

describe('plan store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('preserves user answers and replaces the whole plan on AI edits', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })
    const before = store.current
    expect(store.current.answers).toEqual({ recipient: '妈妈' })
    await store.replaceGift('g1', { reason: 'not_for_them' })
    expect(store.current).not.toBe(before)
    expect(store.current.gifts[0].catalogId).toBe('g2')
    expect(store.current.answers).toEqual({ recipient: '妈妈' })
  })

  it('updates only letter or ritual sections', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })
    await store.regenerateLetter('温暖')
    await store.rewriteRitual('简单一点')
    expect(store.current.letter.paragraphs).toEqual(['新正文'])
    expect(store.current.ritual).toEqual([{ title: '新步骤' }])
    expect(store.current.gifts[0].catalogId).toBe('g1')
  })
})
