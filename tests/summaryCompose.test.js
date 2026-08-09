import { describe, expect, it } from 'vitest'
import { composeSummaryBlocks } from '@/utils/summaryCompose'

describe('summary compose', () => {
  it('derives the four editable blocks from answers', () => {
    const summary = composeSummaryBlocks({
      recipient: '女朋友 / 妻子',
      recipientAge: '26–40岁',
      occasion: '纪念日',
      timing: '一周内',
      budget: '¥300–600',
      taboo: ['不要花 / 香水等易踩雷'],
      style: ['体验类（活动/课程/旅行）'],
      allParticipantsAdults: true,
      memory: '我们第一次在冰岛看极光。',
      feeling: '被深深理解，感动到想哭',
    })

    expect(Object.keys(summary)).toEqual(['who', 'story', 'feeling', 'constraints'])
    expect(summary.who.text).toContain('女朋友')
    expect(summary.who.text).not.toContain('一周内')
    expect(summary.story.text).toContain('纪念日：')
    expect(summary.story.text).toContain('冰岛')
    expect(summary.feeling.text).toContain('被深深理解')
    expect(summary.constraints.text).toContain('¥300–600')
    expect(summary.constraints.text).toContain('不要花')
    expect(summary.constraints.text).toContain('全部成年')
    expect(summary.story.fields).toEqual(['occasion', 'memory', 'relationshipNote'])
    expect(summary.who.fields).toEqual(['recipient', 'recipientAge'])
  })

  it('falls back gracefully for sparse answers', () => {
    const summary = composeSummaryBlocks({ recipient: '闺蜜 / 好友' })
    expect(summary.who.text).toContain('闺蜜')
    expect(summary.story.text).toContain('还没有提到')
    expect(summary.constraints.text).toBe('暂无特殊约束')
  })

  it('repairs legacy summary text without repeating recipient or constraints', () => {
    const summary = composeSummaryBlocks({
      recipient: '送给送给女朋友 / 妻子，为纪念日，计划一周内内送出',
      recipientAge: '26–40岁',
      occasion: '纪念日',
      timing: '一周内',
      budget: '¥300–600',
      summaryNotes: '预算：¥300–600；时间：一周内；补充说明：不要公开送',
    })

    expect(summary.who.text).toBe('送给女朋友 / 妻子，年龄段：26–40岁')
    expect(summary.constraints.text.match(/预算：/g)).toHaveLength(1)
    expect(summary.constraints.text.match(/时间：/g)).toHaveLength(1)
    expect(summary.constraints.text).toContain('补充说明：不要公开送')
  })
})
