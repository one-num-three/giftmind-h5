import { describe, expect, it } from 'vitest'
import { pickGiftGroups, pickGifts } from '../mock/planGenerator.js'

describe('mock recommendation pair', () => {
  it('returns one product and one activity ordered by recommendation score', () => {
    const gifts = pickGifts({
      recipient: '女朋友 / 妻子',
      occasion: '纪念日',
      timing: '一周内',
      budget: '¥300–600',
      personality: ['文艺 / 小众', '户外 / 自然'],
      taboo: [],
      memory: '喜欢拍照、逛展和一起创造回忆',
      feeling: '被深深理解，感动到想哭',
    })

    expect(gifts).toHaveLength(2)
    expect(new Set(gifts.map((gift) => gift.kind))).toEqual(
      new Set(['product', 'activity']),
    )
    expect(gifts[0].dimensionScores.recommendation).toBeGreaterThanOrEqual(
      gifts[1].dimensionScores.recommendation,
    )
    expect(Object.keys(gifts[0].dimensionScores)).toEqual([
      'recommendation',
      'fit',
      'distinctiveness',
      'feasibility',
    ])
    expect(new Set(gifts.flatMap((gift) => gift.awards))).toEqual(
      new Set(['最推荐', '最合适', '最特别', '最省心']),
    )
  })
})

describe('mock four-dimension rankings', () => {
  it('returns three independently sorted candidates in each visible group', () => {
    const groups = pickGiftGroups({
      recipient: '女朋友 / 妻子',
      occasion: '纪念日',
      timing: '一周内',
      budget: '¥300–600',
      personality: ['文艺 / 小众', '户外 / 自然'],
      taboo: [],
      memory: '喜欢拍照、逛展和一起创造回忆',
      feeling: '被深深理解，感动到想哭',
    })

    expect(groups.map((group) => group.title)).toEqual([
      '最推荐',
      '最合适',
      '最特别',
      '最省心',
    ])
    groups.forEach((group) => {
      expect(group.candidates).toHaveLength(3)
      expect(group.candidates.map((gift) => gift.rankingScore)).toEqual(
        [...group.candidates]
          .map((gift) => gift.rankingScore)
          .sort((a, b) => b - a),
      )
      expect(group.candidates.every((gift) => gift.awards[0] === group.title)).toBe(true)
    })
  })
})
