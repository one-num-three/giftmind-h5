import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/mimoService.js', () => ({ callMiMo: vi.fn() }))
import { callMiMo } from '@/api/mimoService.js'
import { fetchNextDynamicQuestion } from '@/api/aiQuestionEngine.js'
import { useSessionStore } from '@/stores/session'
import { composeConsultationBlocks } from '@/utils/summaryCompose'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  callMiMo.mockReset()
})

const question = (key, text) => ({
  key, messages: [text], options: [{ label: '选项一', value: '选项一' }, { label: '选项二', value: '选项二' }],
})

describe('三轮场景回归：程序不代替模型决定深度', () => {
  it('场景一：首轮给预算和大量细节，抽取不跳步，六轮八轮后仍可深入', async () => {
    const store = useSessionStore()
    store.start()
    store.answer({ id: 'recipient', key: 'recipient', messages: ['送给谁？'] }, '朋友，喜欢摄影，预算3000，已有相机')
    store.fillExtractedSlots({ budget: '3000', domain: '摄影', equipment: '已有相机', scene: '旅行', style: '轻便', occasion: '生日' })
    expect(store.stepIndex).toBe(1)
    expect(store.isFinished).toBe(false)
    for (let round = 1; round <= 10; round++) {
      callMiMo.mockResolvedValueOnce(JSON.stringify(question(`detail_${round}`, `进一步了解第${round}个实际使用细节？`)))
      const step = await fetchNextDynamicQuestion(store.answers, store.messages, store.stepIndex)
      expect(step.isReady).not.toBe(true)
      store.setDynamicStep(step)
      store.answer(step, `用户细节${round}`)
      expect(store.isFinished).toBe(false)
    }
    expect(callMiMo).toHaveBeenCalledTimes(10)
    callMiMo.mockResolvedValueOnce('{"isReady":true}')
    expect((await fetchNextDynamicQuestion(store.answers, store.messages, store.stepIndex)).isReady).toBe(true)
  })

  it('场景二：未知与纠正保留，确认卡片展示实际问答而非旧模板', async () => {
    const store = useSessionStore()
    store.start()
    const step = { id: 'dynamic_gear', key: 'camera_gear', messages: ['他现在出门拍照带什么？'], type: 'single' }
    store.answer(step, '不清楚品牌，但有相机')
    store.answer({ id: 'budget', key: 'budget', messages: ['预算大约多少？'] }, '3000元')
    store.answer({ id: 'unknown', key: 'lens', messages: ['了解他常用的镜头吗？'] }, '不太清楚')
    const blocks = composeConsultationBlocks(store.answers, store.answerSteps, store.messages)
    expect(blocks.map((block) => block.label)).toEqual(['他现在出门拍照带什么？', '预算大约多少？', '了解他常用的镜头吗？'])
    expect(JSON.stringify(blocks)).not.toContain('被认真对待')
    expect(JSON.stringify(blocks)).not.toContain('特别的日子')
    store.applyConsultationEdits({ camera_gear: '更正：只有手机', budget: '1500元', lens: '' })
    store.forceFinish()
    store.resumeConsultation()
    expect(store.isFinished).toBe(false)
    expect(store.answers.camera_gear).toBe('更正：只有手机')
    expect(store.answers.budget).toBe('1500元')
    callMiMo.mockResolvedValueOnce(JSON.stringify(question('phone_scene', '手机拍照最想改善什么？')))
    await fetchNextDynamicQuestion(store.answers, store.messages, store.stepIndex)
    const context = callMiMo.mock.calls[0][0][1].content
    expect(context).toContain('更正：只有手机')
    expect(context).toContain('1500元')
    expect(context).not.toContain('不清楚品牌，但有相机')
    expect(context).toContain('先跳过')
    expect(context).toContain('继续聊聊')
    store.persistDraft()
    store.$reset()
    store.restoreDraft()
    expect(store.answerSteps.camera_gear.messages[0]).toBe('他现在出门拍照带什么？')
  })

  it('未知或跳过的回答也不会被同名追问覆盖', async () => {
    callMiMo.mockResolvedValueOnce(JSON.stringify(question('gear', '最近观察到哪些使用习惯？')))
    const answers = { recipient: '朋友', gear: '', gear_3: '不清楚' }
    const step = await fetchNextDynamicQuestion(answers, [], 3)
    expect(step.key).toBe('gear_4')
    expect(answers.gear).toBe('')
    expect(answers.gear_3).toBe('不清楚')
  })

  it('场景三：失败不会完成，用户可主动结束或返回实际动态题', async () => {
    const store = useSessionStore()
    store.start()
    const step = { id: 'dynamic_scene', key: 'scene', messages: ['平时怎么用？'], type: 'single' }
    store.answer(step, '通勤')
    callMiMo.mockRejectedValueOnce(new Error('网络中断'))
    await expect(fetchNextDynamicQuestion(store.answers, store.messages, store.stepIndex)).rejects.toThrow()
    expect(store.isFinished).toBe(false)
    expect(store.answers.scene).toBe('通勤')
    store.forceFinish()
    expect(store.isFinished).toBe(true)
    store.back()
    expect(store.isFinished).toBe(false)
    expect(store.answers.scene).toBeUndefined()
    expect(store.activeDynamicStep.id).toBe('dynamic_scene')
  })
})
