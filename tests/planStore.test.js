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
  composeDelivery: vi.fn(async (_plan, gift) => ({
    source: 'deepseek',
    model: 'deepseek-v4-flash',
    promptVersion: 'delivery_compose_v4',
    selectedCatalogId: gift.catalogId,
    selectedGiftName: gift.name,
    letter: { paragraphs: [`围绕${gift.name}的新正文`] },
    ritual: [{ title: `准备${gift.name}` }],
  })),
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

  it('commits the selected gift only after its delivery plan succeeds', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })
    const gift = { id: 'g1', catalogId: 'g1', name: '黄铜书签', emoji: '🔖' }

    const pending = store.selectGift(gift)
    expect(store.selectingGiftId).toBe('g1')
    expect(store.current.selectedGiftId).toBeUndefined()
    await pending

    expect(store.selectingGiftId).toBe('')
    expect(store.current.selectedGiftId).toBe('g1')
    expect(store.current.letter.paragraphs[0]).toContain('黄铜书签')
    expect(store.current.ritual[0].title).toContain('黄铜书签')
    expect(store.current.deliverySource).toBe('deepseek')
    expect(store.current.share.coverEmoji).toBe('🔖')
    expect(store.current.title).toBe('给妈妈的「黄铜书签」送出方案')
    expect(store.current.subtitle).toBe('已按你最终选中的礼物，重新整理心意表达与送出步骤')
    expect(store.current.recommendationTitle).toBe('服务端方案')
  })

  it('keeps the original recommendation title when the selected gift changes again', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })

    await store.selectGift({ catalogId: 'g1', name: '黄铜书签' })
    await store.selectGift({ catalogId: 'g2', name: '手写歌单' })

    expect(store.current.title).toBe('给妈妈的「手写歌单」送出方案')
    expect(store.current.recommendationTitle).toBe('服务端方案')
  })

  it('uses TA instead of exposing a broad combined recipient label in the title', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '女朋友 / 妻子' })

    await store.selectGift({ catalogId: 'g1', name: '手写歌单' })

    expect(store.current.title).toBe('给 TA 的「手写歌单」送出方案')
  })

  it('keeps the current delivery content when selected-gift composition fails', async () => {
    apiMock.composeDelivery.mockRejectedValueOnce(new Error('模型暂时不可用'))
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })
    const before = JSON.parse(JSON.stringify(store.current))

    await expect(store.selectGift({ catalogId: 'g1', name: '黄铜书签' })).rejects.toThrow('模型暂时不可用')

    expect(store.selectingGiftId).toBe('')
    expect(store.current).toEqual(before)
    expect(store.error).toBe('模型暂时不可用')
  })

  it('keeps legacy name-only recommendations selectable', async () => {
    const store = usePlanStore()
    await store.generate({ recipient: '妈妈' })

    await store.selectGift({ name: '旧方案里的礼物' })

    expect(apiMock.composeDelivery).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({ catalogId: 'legacy:旧方案里的礼物' }),
    )
    expect(store.current.selectedGiftId).toBe('legacy:旧方案里的礼物')
  })

  it('preserves structured no-candidate recovery details for the UI', async () => {
    apiMock.generatePlan.mockRejectedValueOnce({
      code: 'NO_CANDIDATES',
      message: '暂时凑不齐两种方案',
      payload: {
        detail: {
          code: 'NO_CANDIDATES',
          message: '暂时凑不齐两种方案',
          missingKinds: [{ code: 'activity', label: '体验活动' }],
          causes: [{ code: 'over_budget', label: '超过当前预算', count: 8 }],
          recoveryOptions: [{
            id: 'relax_budget',
            label: '把预算改为 ¥300–600',
            answerPatch: { budget: '¥300–600' },
          }],
          editSuggestions: [],
        },
      },
    })
    const store = usePlanStore()

    await expect(store.generate({ budget: '¥150–300' })).rejects.toBeTruthy()

    expect(store.generationIssue.missingKinds[0].label).toBe('体验活动')
    expect(store.generationIssue.recoveryOptions[0].answerPatch).toEqual({ budget: '¥300–600' })
    store.clearGenerationError()
    expect(store.error).toBe('')
    expect(store.generationIssue).toBeNull()
  })

  it('keeps local history plans readable when the optional replies request fails', async () => {
    apiMock.fetchShareReplies.mockRejectedValueOnce(new Error('plan is local only'))
    const store = usePlanStore()
    store.current = { id: 'local-plan' }

    await expect(store.loadReplies()).resolves.toEqual([])
    expect(store.replies).toEqual([])
  })
})
