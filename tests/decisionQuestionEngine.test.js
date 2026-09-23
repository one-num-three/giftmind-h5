import { describe, expect, it, vi } from 'vitest'
import {
  buildDialogStateCanvas,
  routeNextDecision,
  DOMAIN_DECISION_FORKS,
  getDomainDecisionForks,
  isUnknownValue,
} from '@/services/jevEngine.js'
import { fetchNextDynamicQuestion, getUniversalReflectiveStep } from '@/api/aiQuestionEngine.js'

// Mock mimoService so we can test fetchNextDynamicQuestion deterministically
vi.mock('@/api/mimoService.js', () => ({
  callMiMo: vi.fn(),
}))

import { callMiMo } from '@/api/mimoService.js'

describe('Decision-Driven Questioning Engine (每一题必须解决一个选礼决策)', () => {
  describe('1. 4-Layer Fact State Canvas (四层认知事实看板)', () => {
    it('strictly separates confirmed facts, exclusions, and unknown/skipped answers', () => {
      const canvas = buildDialogStateCanvas({
        recipient: '男朋友 / 丈夫',
        preference_direction: '咖啡生活',
        gear_status: '不太清楚 / 没留意',
        taboo: '不要送杯子，家里太多了',
        budget: '¥600–1200',
        skipped_item: '',
      })

      // 1. Confirmed facts
      expect(canvas.confirmed_facts.recipient).toBe('男朋友 / 丈夫')
      expect(canvas.confirmed_facts.preference_direction).toBe('咖啡生活')
      expect(canvas.confirmed_facts.budget).toBe('¥600–1200')
      expect(canvas.domain).toBe('咖啡生活')
      expect(canvas.budget).toBe('¥600–1200')

      // 2. Unknown or skipped items
      expect(canvas.unknown_or_skipped).toEqual(
        expect.arrayContaining([
          { key: 'gear_status', value: '不太清楚 / 没留意' },
          { key: 'skipped_item', value: '已跳过' },
        ])
      )
      expect(canvas.unknown_dimensions).toContain('gear_status')
      expect(canvas.unknown_dimensions).toContain('skipped_item')

      // Unknown values must NOT pollute slots
      expect(canvas.confirmed_facts.gear_status).toBeUndefined()

      // 3. Explicit exclusions
      expect(canvas.explicit_exclusions).toContain('不要送杯子，家里太多了')
    })

    it('identifies various unknown phrases correctly', () => {
      expect(isUnknownValue('不太清楚 / 没留意')).toBe(true)
      expect(isUnknownValue('没关注')).toBe(true)
      expect(isUnknownValue('不确定')).toBe(true)
      expect(isUnknownValue('想看容错率高的方案')).toBe(true)
      expect(isUnknownValue('手冲咖啡器具')).toBe(false)
    })
  })

  describe('2. Decision Forks and Giver Observability (决策分歧与送礼人可观察线索)', () => {
    it('provides domain forks and observable hints for coffee and photo', () => {
      const coffeeFork = getDomainDecisionForks('咖啡生活')
      expect(coffeeFork).not.toBeNull()
      expect(coffeeFork.name).toBe('咖啡生活')
      expect(coffeeFork.forks).toContain('装备状态')
      expect(coffeeFork.giverObservableHints).toContain('平时喝拿铁多，还是黑咖啡多')

      const photoFork = getDomainDecisionForks('摄影记录与影像')
      expect(photoFork).not.toBeNull()
      expect(photoFork.giverObservableHints).toContain('出门拍照常带大单反微单')
    })

    it('correctly handles compound sentences with unknown and confirmed facts', () => {
      const canvas = buildDialogStateCanvas({
        recipient: '男朋友 / 丈夫',
        gear_status: '不清楚品牌，但家里有咖啡机',
      })
      expect(canvas.confirmed_facts.gear_status).toBe('家里有咖啡机')
      expect(canvas.unknown_or_skipped).toHaveLength(0)
      expect(canvas.domain).toBe('咖啡生活')
    })

    it('protects against negation so "不要咖啡" does not become coffee domain', () => {
      const canvas = buildDialogStateCanvas({
        recipient: '闺蜜 / 姐妹',
        answer1: '不要咖啡因，千万别送咖啡，其他随便',
      })
      expect(canvas.explicit_exclusions).toContain('不要咖啡因')
      expect(canvas.explicit_exclusions).toContain('千万别送咖啡')
      expect(canvas.domain).not.toBe('咖啡生活')
    })

    it('clears resolved unknown dimensions when user later provides confirmed fact', () => {
      const canvas = buildDialogStateCanvas({
        recipient: '同事 / 领导',
        gear: '不清楚',
      })
      expect(canvas.unknown_dimensions).toContain('gear')

      // User corrects or updates later
      const updatedCanvas = buildDialogStateCanvas({
        recipient: '同事 / 领导',
        gear: '家里有全套意式机',
      })
      expect(updatedCanvas.confirmed_facts.gear).toBe('家里有全套意式机')
      expect(updatedCanvas.unknown_dimensions).not.toContain('gear')
    })
  })

  describe('2. Decision Guidance and Autonomous Convergence (决策建议与自主收敛)', () => {
    it('provides domain forks and observable hints for coffee and photo', () => {
      const coffeeFork = getDomainDecisionForks('咖啡生活')
      expect(coffeeFork).not.toBeNull()
      expect(coffeeFork.name).toBe('咖啡生活')
      expect(coffeeFork.forks).toContain('装备状态')
      expect(coffeeFork.giverObservableHints).toContain('平时喝拿铁多，还是黑咖啡多')

      const photoFork = getDomainDecisionForks('摄影记录与影像')
      expect(photoFork).not.toBeNull()
      expect(photoFork.giverObservableHints).toContain('出门拍照常带大单反微单')
    })

    it('leaves text intent to the model instead of matching historical keywords', () => {
      const answers = {
        recipient: '男朋友 / 丈夫',
        free_text: '不用再问了，直接看方案吧',
      }
      const decision = routeNextDecision(answers, 2)
      expect(decision.isReady).toBe(false)
    })

    it('does not finish automatically at stepIndex >= 8', () => {
      const answers = { recipient: '朋友 / 好友' }
      const decision = routeNextDecision(answers, 8)
      expect(decision.isReady).toBe(false)
    })

    it('respects model autonomy at step 3 by providing advisory hint instead of forced lockout', () => {
      const answers = {
        recipient: '男朋友 / 丈夫',
        domain: '咖啡生活',
        budget: '¥600–1200',
      }
      const decision = routeNextDecision(answers, 3)
      expect(decision.isReady).toBe(false)
      expect(decision.canvas.domain).toBe('咖啡生活')
      expect(decision.suggestedHint).toBe('')
    })
  })

  describe('3. Dynamic Question Post-Processing & Fallback Quality', () => {
    it('保留模型给出的选项，不额外注入模板选项', async () => {
      callMiMo.mockResolvedValueOnce(
        JSON.stringify({
          isReady: false,
          stage: 'preference',
          key: 'coffee_modality',
          messages: [
            '懂得品味咖啡的人对日常风味通常很有自己的讲究。',
            '想送这份咖啡心意，你更倾向于让 TA 体验哪种咖啡形态？',
          ],
          options: [
            { value: '手冲手作套装', label: '手冲手作套装', desc: '手摇磨、滤杯与分享壶' },
            { value: '意式便携机', label: '意式便携机', desc: '快速萃取油脂香浓' },
            { value: '高品质产区豆', label: '高品质产区豆', desc: '探索单一原产地风味' },
          ],
        })
      )

      const answers = { recipient: '男朋友 / 丈夫', domain: '咖啡生活' }
      const step = await fetchNextDynamicQuestion(answers, [], 2)

      expect(step.isReady).toBeUndefined()
      expect(step.key).toBe('coffee_modality')
      expect(step.messages.length).toBe(2)

      expect(step.options.length).toBe(3)
      expect(step.options.some((o) => o.value === '不太清楚 / 没留意')).toBe(false)

      // All options should have desc and hint
      step.options.forEach((opt) => {
        expect(opt.desc).toBeDefined()
        expect(opt.hint).toBeDefined()
      })
    })

    it('模型可自由提问，不需要凑选项或固定回应结构', async () => {
      callMiMo.mockResolvedValueOnce(JSON.stringify({ key: 'open_question', messages: ['【补充】你还想聊些什么？'], options: [] }))
      const step = await fetchNextDynamicQuestion({ recipient: '朋友' }, [], 10)
      expect(step.type).toBe('text')
      expect(step.messages).toEqual(['【补充】你还想聊些什么？'])
      expect(step.options).toEqual([])
      expect(step.allowCustom).toBe(true)
    })

    it('保留多选、长回答与模型原文，不以标题替换完整语义', async () => {
      const value = '希望保留原来的使用习惯，愿意尝试新的选择，但不希望增加额外负担'
      callMiMo.mockResolvedValueOnce(JSON.stringify({ key: 'decision', type: 'multi', messages: ['这些想法哪些更符合你？'], options: [{ label: '保留习惯', value }] }))
      const step = await fetchNextDynamicQuestion({}, [], 2)
      expect(step.type).toBe('multi')
      expect(step.options).toHaveLength(1)
      expect(step.options[0].value).toBe(value)
    })

    it('提示词只给通用参考，直接传递原话而不注入领域路线', async () => {
      callMiMo.mockResolvedValueOnce(JSON.stringify({ key: 'detail', messages: ['想再听听你的想法。'] }))
      await fetchNextDynamicQuestion({ recipient: '朋友', note: '他不喜欢摄影，也不了解咖啡', budget: '3000' }, [], 3)
      const prompts = callMiMo.mock.calls.at(-1)[0]
      expect(prompts[0].content).toContain('可选参考')
      expect(prompts[0].content).not.toMatch(/摄影|咖啡|现有设备|3~4|第.*轮/)
      expect(prompts[1].content).toContain('他不喜欢摄影，也不了解咖啡')
      expect(prompts[1].content).not.toMatch(/事实看板|领域线索|待探索|用户意图/)
    })

    it('honors model decision when model outputs isReady: true', async () => {
      callMiMo.mockResolvedValueOnce(
        JSON.stringify({
          isReady: true,
        })
      )

      const answers = { recipient: '朋友 / 好友', domain: '露营' }
      const step = await fetchNextDynamicQuestion(answers, [], 3)
      expect(step.isReady).toBe(true)
    })

    it('avoids key collisions if model reuses an already answered key', async () => {
      const answers = {
        recipient: '男朋友 / 丈夫',
        domain: '咖啡生活',
        coffee_gear: '意式半自动咖啡机',
      }

      callMiMo.mockResolvedValueOnce(
        JSON.stringify({
          isReady: false,
          stage: 'preference',
          key: 'coffee_gear',
          messages: ['那日常做咖啡你更希望帮 TA 补充哪类配件？'],
          options: [
            { value: '专业压粉锤', label: '专业压粉锤', desc: '手感扎实' },
            { value: '便携奶泡器', label: '便携奶泡器', desc: '拉花专用' },
          ],
        })
      )

      const step = await fetchNextDynamicQuestion(answers, [], 3)
      // Key should be suffixed with step index so it doesn't overwrite existing answer
      expect(step.key).toBe('coffee_gear_3')
      expect(step.options.length).toBe(2)
    })
  })

  describe('4. Universal Reflective Step (离线兜底选项质量)', () => {
    it('provides single-dimension options with desc, hint, and fallback', () => {
      const step = getUniversalReflectiveStep({ recipient: '朋友', domain: '露营' }, 2)
      expect(step.options.length).toBe(4)
      expect(step.options[3].value).toBe('不太清楚 / 没留意')
      step.options.forEach((opt) => {
        expect(opt.desc).toBeDefined()
        expect(opt.hint).toBeDefined()
      })
    })
  })
})
