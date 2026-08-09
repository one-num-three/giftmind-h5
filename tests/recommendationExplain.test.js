import { describe, expect, it } from 'vitest'
import {
  rawEvidenceEntries,
  rawScoreEntries,
  recommendationExplanation,
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
})
