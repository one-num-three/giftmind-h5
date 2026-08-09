import { describe, expect, it } from 'vitest'
import { giftsForShare } from '@/utils/sharePlan'

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
