import { describe, expect, it } from 'vitest'
import {
  rawEvidenceEntries,
  rawScoreEntries,
  recipientAwareCopy,
  recommendationExplanation,
  recommendationKindLabel,
} from '@/utils/recommendationExplain'

describe('recommendation explanation', () => {
  it('prefers grounded user-facing copy over technical evidence', () => {
    const result = recommendationExplanation({
      kind: 'activity',
      whyForRecipient: '能回应你们常一起看展的共同习惯。',
      why: '综合匹配度较高',
      matchedUserFacts: ['你提到：常一起看展', '场合：纪念日'],
      caveats: ['周末档期可能紧张'],
      priceText: '¥280–360',
      leadTime: '建议提前 3 天确认',
    })

    expect(result).toEqual({
      fitReason: '能回应你们常一起看展的共同习惯。',
      matchedDetails: ['你提到：常一起看展', '场合：纪念日'],
      caveats: ['周末档期可能紧张'],
      price: '¥280–360',
      leadTime: '建议提前 3 天确认',
    })
  })

  it('adds a useful default caveat without inventing catalog facts', () => {
    expect(recommendationExplanation({ kind: 'product', name: '礼物' }).caveats).toEqual([
      '下单前确认颜色、规格、库存和退换规则。',
    ])
  })

  it('does not show a short marketing slogan as the whole fit reason', () => {
    expect(recommendationExplanation({
      whyForRecipient: '让心意闪耀',
      description: '一条适合日常佩戴的简约手链。',
      matchedUserFacts: ['你提到：她喜欢有纪念意义但不张扬的礼物。'],
    }).fitReason).toBe(
      '你提到：她喜欢有纪念意义但不张扬的礼物。一条适合日常佩戴的简约手链，能把这条线索落成一份具体的心意。',
    )
  })

  it('keeps raw scores and retrieval evidence separate', () => {
    expect(rawScoreEntries({ budget: 5, rag_retrieval: 31 })).toEqual([
      { key: 'rag_retrieval', label: '语义检索', value: 31 },
      { key: 'budget', label: '预算匹配', value: 5 },
    ])
    expect(rawEvidenceEntries({ rag_retrieval: ['照片', '相册'] })).toEqual([
      { key: 'rag_retrieval', label: '语义检索', values: ['照片', '相册'] },
    ])
  })

  it('uses the user-facing gift versus experience taxonomy', () => {
    expect(recommendationKindLabel({ kind: 'product', category: '数字' })).toBe('礼物')
    expect(recommendationKindLabel({ giftTypeCode: 'activity', category: '线下活动' })).toBe('体验')
    expect(recommendationKindLabel({ category: '实物' })).toBe('礼物')
  })

  it('keeps catalog copy aligned with the recipient identity', () => {
    expect(recipientAwareCopy('他愿望单里躺着的那款游戏', '女朋友 / 妻子')).toBe(
      '她愿望单里躺着的那款游戏',
    )
    expect(recipientAwareCopy('她会在某个早上忽然想起这份礼物', '男朋友 / 丈夫')).toBe(
      '他会在某个早上忽然想起这份礼物',
    )
    expect(recipientAwareCopy('给吉他配一套其他颜色的琴弦', '女朋友 / 妻子')).toBe(
      '给吉他配一套其他颜色的琴弦',
    )
    expect(recipientAwareCopy('让她收到时会心一笑')).toBe('让TA收到时会心一笑')
  })

  it('only normalizes catalog prose and preserves the user-provided evidence', () => {
    const result = recommendationExplanation({
      whyForRecipient: '他会在通勤时反复用到。',
      matchedUserFacts: ['你提到：她最近开始坐地铁上班。'],
    }, { recipient: '女朋友 / 妻子' })

    expect(result.fitReason).toBe('她会在通勤时反复用到。')
    expect(result.matchedDetails).toEqual(['你提到：她最近开始坐地铁上班。'])
  })
})
