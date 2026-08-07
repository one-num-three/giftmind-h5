import { describe, expect, it } from 'vitest'
import { composeSummaryBlocks } from '@/utils/summaryCompose'

describe('summary compose', () => {
  it('derives the four editable blocks from answers', () => {
    const summary = composeSummaryBlocks({
      recipient: '女朋友 / 妻子',
      occasion: '纪念日',
      timing: '一周内',
      budget: '¥300–600',
      taboo: ['不要花 / 香水等易踩雷'],
      style: ['体验类（活动/课程/旅行）'],
      memory: '我们第一次在冰岛看极光。',
      feeling: '被深深理解，感动到想哭',
    })

    expect(Object.keys(summary)).toEqual(['who', 'story', 'feeling', 'constraints'])
    expect(summary.who.text).toContain('女朋友')
    expect(summary.who.text).toContain('一周内')
    expect(summary.story.text).toContain('冰岛')
    expect(summary.feeling.text).toContain('被深深理解')
    expect(summary.constraints.text).toContain('¥300–600')
    expect(summary.constraints.text).toContain('不要花')
    expect(summary.story.fields).toEqual(['memory'])
    expect(summary.who.fields).toEqual(['recipient'])
  })

  it('falls back gracefully for sparse answers', () => {
    const summary = composeSummaryBlocks({ recipient: '闺蜜 / 好友' })
    expect(summary.who.text).toContain('闺蜜')
    expect(summary.story.text).toContain('还没有提到')
    expect(summary.constraints.text).toBe('暂无特殊约束')
  })
})
