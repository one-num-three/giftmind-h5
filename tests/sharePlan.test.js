import { describe, expect, it } from 'vitest'
import { giftsForShare, recipientGiftReason } from '@/utils/sharePlan'

describe('giftsForShare', () => {
  it('shares only the final selected gift', () => {
    const selectedGift = { catalogId: 'g2', name: '写了注解的歌单' }
    expect(giftsForShare({
      selectedGift,
      gifts: [{ catalogId: 'g1', name: '书签' }, selectedGift],
    })).toEqual([selectedGift])
  })

  it('resolves a legacy selected gift id from ranking groups', () => {
    const selectedGift = { catalogId: 'g2', name: '陶艺体验' }
    expect(giftsForShare({
      selectedGiftId: 'g2',
      gifts: [{ catalogId: 'g1', name: '书签' }],
      recommendationGroups: [{ candidates: [selectedGift] }],
    })).toEqual([selectedGift])
  })

  it('keeps the old gift list for legacy shares without a selection', () => {
    const gifts = [{ catalogId: 'g1' }, { catalogId: 'g2' }]
    expect(giftsForShare({ gifts })).toEqual(gifts)
  })
})

describe('recipientGiftReason', () => {
  it('turns stale third-person copy into recipient-facing second person', () => {
    expect(recipientGiftReason('把他提过想读的书备齐，让她感到被理解。'))
      .toBe('把你提过想读的书备齐，让你感到被理解。')
  })

  it('does not corrupt words such as 吉他 or 其他', () => {
    expect(recipientGiftReason('为 TA 选一把吉他，也可以考虑其他颜色。'))
      .toBe('为你选一把吉他，也可以考虑其他颜色。')
  })
})
