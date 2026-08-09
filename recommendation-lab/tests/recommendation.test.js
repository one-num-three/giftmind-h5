import { describe, expect, it } from 'vitest'
import { createEmptyPreferenceAnswers, createExamplePreferenceAnswers } from '../src/data/preferenceTemplates.js'
import {
  clampIndex,
  dimensionEntries,
  dragDirection,
  evidenceList,
  numericScore,
  topScoreSources,
} from '../src/utils/recommendation.js'

describe('recommendation helpers', () => {
  it('keeps carousel index inside candidate range', () => {
    expect(clampIndex(-1, 4)).toBe(0)
    expect(clampIndex(9, 4)).toBe(3)
    expect(clampIndex(2, 4)).toBe(2)
  })

  it('only navigates after the swipe threshold', () => {
    expect(dragDirection(-80)).toBe(1)
    expect(dragDirection(80)).toBe(-1)
    expect(dragDirection(20)).toBe(0)
  })

  it('normalizes fractional scores and ranks main sources', () => {
    expect(numericScore(0.82)).toBe(82)
    expect(topScoreSources({ budget: 8, semantic: 0.32, occasion: 12 }, 2)).toEqual([
      { key: 'semantic', label: '语义理解', value: 32 },
      { key: 'occasion', label: '场景匹配', value: 12 },
    ])
  })

  it('accepts evidence arrays and objects', () => {
    expect(evidenceList({ matchedEvidence: ['喜欢阅读'] })).toEqual(['喜欢阅读'])
    expect(evidenceList({ matched: { budget: '落在预算内' } })).toEqual([
      '预算匹配：落在预算内',
    ])
    expect(
      evidenceList({
        matchedEvidence: [
          { key: 'rag_retrieval', value: '“记录生活”与商品描述高度接近' },
          { label: '用户原话', evidence: ['喜欢拍照', '常逛书店'] },
        ],
      }),
    ).toEqual([
      'RAG检索命中：“记录生活”与商品描述高度接近',
      '用户原话：喜欢拍照、常逛书店',
    ])
  })

  it('uses readable labels for real backend score keys', () => {
    expect(topScoreSources({ data_quality: 8, rag_retrieval: 25, recipient: 12 }, 3)).toEqual([
      { key: 'rag_retrieval', label: 'RAG检索命中', value: 25 },
      { key: 'recipient', label: '对象匹配', value: 12 },
      { key: 'data_quality', label: '数据完整度', value: 8 },
    ])
  })

  it('keeps the four comparison dimensions in a stable readable order', () => {
    expect(
      dimensionEntries({
        dimensionScores: {
          feasibility: 91.2,
          distinctiveness: 78,
          fit: 84.5,
          recommendation: 88,
        },
      }),
    ).toEqual([
      { key: 'recommendation', label: '综合推荐度', value: 88 },
      { key: 'fit', label: '适配度', value: 84.5 },
      { key: 'distinctiveness', label: '特别度', value: 78 },
      { key: 'feasibility', label: '可执行度', value: 91.2 },
    ])
  })
})

describe('preference templates', () => {
  it('provides a complete example that can be submitted immediately', () => {
    const example = createExamplePreferenceAnswers()

    expect([
      example.recipient,
      example.recipientAge,
      example.occasion,
      example.timing,
      example.budget,
      example.feeling,
      example.cityTierCode,
    ].every(Boolean)).toBe(true)
    expect(example.personality.length).toBeGreaterThan(0)
    expect(example.allParticipantsAdults).toBe(true)
  })

  it('returns fresh arrays when filling or clearing repeatedly', () => {
    const first = createExamplePreferenceAnswers()
    const second = createExamplePreferenceAnswers()
    first.personality.push('临时修改')

    expect(second.personality).not.toContain('临时修改')
    expect(createEmptyPreferenceAnswers().personality).toEqual([])
    expect(createEmptyPreferenceAnswers().allParticipantsAdults).toBeNull()
  })
})
