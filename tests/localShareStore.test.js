import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalShare, fetchLocalShare, listLocalReplies, saveLocalReply, updateLocalShare } from '@/api/localShareStore'

describe('local immutable shares', () => {
  beforeEach(() => localStorage.clear())

  it('keeps an immutable plan snapshot after plan edits or deletion', () => {
    const plan = { id: 'plan-1', title: '第一版', gifts: [{ id: 'g1' }] }
    const share = createLocalShare(plan, { greeting: '你好' })
    plan.title = '第二版'
    plan.gifts[0].id = 'g2'
    localStorage.setItem('gm_plans', '[]')
    expect(fetchLocalShare(share.shareId).plan).toMatchObject({ title: '第一版', gifts: [{ id: 'g1' }] })
  })

  it('updates only through an explicit update and persists replies', () => {
    const share = createLocalShare({ id: 'plan-1', title: '第一版' })
    updateLocalShare(share.shareId, { id: 'plan-1', title: '第二版' }, { theme: 'sage' })
    saveLocalReply(share.shareId, '我很喜欢')
    expect(fetchLocalShare(share.shareId).plan.title).toBe('第二版')
    expect(listLocalReplies({ planId: 'plan-1' })[0].content).toBe('我很喜欢')
  })
})
