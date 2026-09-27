import { describe, expect, it, vi } from 'vitest'
import {
  buildDialogStateCanvas,
  isUnknownValue,
} from '@/services/jevEngine.js'
import { fetchNextDynamicQuestion, explainOptionsForStep, EXPLAIN_OPTION_VALUE, INITIAL_STEP } from '@/api/aiQuestionEngine.js'

// Mock aiService so we can test fetchNextDynamicQuestion deterministically
vi.mock('@/api/aiService.js', () => ({
  callChatModel: vi.fn(),
}))

vi.mock('@/services/jevClient.js', () => ({
  callJevSystemOne: vi.fn(),
}))

import { callChatModel } from '@/api/aiService.js'
import { callJevSystemOne } from '@/services/jevClient.js'

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

  describe('2. Compound Sentence & Negation Handling (复合句与否定保护)', () => {
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

  describe('3. Dynamic Question Post-Processing & Fallback Quality', () => {
    it('保留模型给出的选项，不额外注入模板选项', async () => {
      callChatModel.mockResolvedValueOnce(
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
          // 模型自标记：并列的具体形态选项需要讲解入口
          options_need_explain: true,
        })
      )

      const answers = { recipient: '男朋友 / 丈夫', domain: '咖啡生活' }
      const step = await fetchNextDynamicQuestion(answers, [], 2)

      expect(step.isReady).toBeUndefined()
      expect(step.key).toBe('coffee_modality')
      expect(step.messages.length).toBe(2)

      expect(step.options.filter((o) => o.value !== EXPLAIN_OPTION_VALUE)).toHaveLength(3)
      // 单选题末尾固定附"讲讲区别"入口（非模板选项，选中触发讲解而非提交答案）
      expect(step.options.at(-1).value).toBe(EXPLAIN_OPTION_VALUE)
      expect(step.options.some((o) => o.value === '不太清楚 / 没留意')).toBe(false)

      // All options should have desc and hint
      step.options.forEach((opt) => {
        expect(opt.desc).toBeDefined()
        expect(opt.hint).toBeDefined()
      })
    })

    it('模型可自由提问，不需要凑选项或固定回应结构', async () => {
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'open_question', messages: ['【补充】你还想聊些什么？'], options: [] }))
      const step = await fetchNextDynamicQuestion({ recipient: '朋友' }, [], 10)
      expect(step.type).toBe('text')
      expect(step.messages).toEqual(['【补充】你还想聊些什么？'])
      expect(step.options).toEqual([])
      expect(step.allowCustom).toBe(true)
    })

    it('保留多选、长回答与模型原文，不以标题替换完整语义', async () => {
      const value = '希望保留原来的使用习惯，愿意尝试新的选择，但不希望增加额外负担'
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'decision', type: 'multi', messages: ['这些想法哪些更符合你？'], options: [{ label: '保留习惯', value }] }))
      const step = await fetchNextDynamicQuestion({}, [], 2)
      expect(step.type).toBe('multi')
      expect(step.options).toHaveLength(1)
      expect(step.options[0].value).toBe(value)
    })

    it('提示词只给通用参考，直接传递原话而不注入领域路线', async () => {
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'detail', messages: ['想再听听你的想法。'] }))
      await fetchNextDynamicQuestion({ recipient: '朋友', note: '他不喜欢摄影，也不了解咖啡', budget: '3000' }, [], 3)
      const prompts = callChatModel.mock.calls.at(-1)[0]
      expect(prompts[0].content).toContain('可选参考')
      expect(prompts[0].content).not.toMatch(/摄影|咖啡|现有设备|3~4|第.*轮/)
      expect(prompts[1].content).toContain('他不喜欢摄影，也不了解咖啡')
      expect(prompts[1].content).not.toMatch(/事实看板|领域线索|待探索|用户意图/)
    })

    it('历史上下文包含当轮全部选项与用户完整选择，模型无需凭碎片猜测', async () => {
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'drill', messages: ['他更偏哪一边？'], options: [] }))
      const answeredSteps = {
        hobby: {
          id: 'dynamic_hobby',
          key: 'hobby',
          messages: ['他平时喜欢怎么放松？'],
          options: [
            { label: '影音娱乐', value: '影音娱乐，耳机音箱与投影观影都喜欢' },
            { label: '户外运动', value: '户外运动' },
          ],
        },
      }
      const answers = { recipient: '朋友 / 好友', hobby: '影音娱乐，耳机音箱与投影观影都喜欢' }
      const historyMessages = [
        { role: 'ai', text: '他平时喜欢怎么放松？', stepId: 'dynamic_hobby' },
        { role: 'user', text: '影音娱乐', stepId: 'dynamic_hobby' },
      ]
      await fetchNextDynamicQuestion(answers, historyMessages, 3, [], answeredSteps)
      const context = callChatModel.mock.calls.at(-1)[0][1].content
      expect(context).toContain('【AI买手提供的选项】: 1. 影音娱乐（影音娱乐，耳机音箱与投影观影都喜欢）　2. 户外运动')
      expect(context).toContain('【用户】: 影音娱乐（完整选择：影音娱乐，耳机音箱与投影观影都喜欢）')
    })

    it('label 与 value 相同或跳过时不追加冗余标注', async () => {
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'drill2', messages: ['还有别的吗？'], options: [] }))
      const answeredSteps = {
        recipient: {
          id: 'recipient',
          key: 'recipient',
          messages: ['这次想为谁挑选礼物？'],
          options: [{ label: '朋友 / 好友', value: '朋友 / 好友' }],
        },
        lens: {
          id: 'dynamic_lens',
          key: 'lens',
          messages: ['了解他常用的镜头吗？'],
          options: [{ label: '定焦', value: '定焦' }],
        },
      }
      const answers = { recipient: '朋友 / 好友', lens: '' }
      const historyMessages = [
        { role: 'ai', text: '这次想为谁挑选礼物？', stepId: 'recipient' },
        { role: 'user', text: '朋友 / 好友', stepId: 'recipient' },
        { role: 'user', text: '先跳过', stepId: 'dynamic_lens', muted: true },
      ]
      await fetchNextDynamicQuestion(answers, historyMessages, 4, [], answeredSteps)
      const context = callChatModel.mock.calls.at(-1)[0][1].content
      expect(context).toContain('【AI买手提供的选项】: 1. 朋友 / 好友')
      expect(context).not.toContain('（完整选择：')
    })

    it('加速模式在系统提示中追加快进收敛指令，普通模式不追加', async () => {
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'fast_round', messages: ['咱们挑重点说。'], options: [] }))
      await fetchNextDynamicQuestion({}, [], 2, [], {}, 'fast')
      const fastPrompt = callChatModel.mock.calls.at(-1)[0][0].content
      expect(fastPrompt).toContain('加速模式')
      expect(fastPrompt).toContain('isReady')

      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'normal_round', messages: ['照常细聊。'], options: [] }))
      await fetchNextDynamicQuestion({}, [], 2)
      expect(callChatModel.mock.calls.at(-1)[0][0].content).not.toContain('加速模式')
    })

    it('选项归类：候选≥5 个时 Jev 成对判定合并，全程只调一次大模型', async () => {
      const candidates = [
        { label: '游戏主机', value: '他喜欢游戏主机掌机这类设备 🎮' },
        { label: '电竞外设', value: '他喜欢电竞外设键盘鼠标耳机这类 ⌨️' },
        { label: '电脑硬件', value: '他喜欢研究电脑硬件装机 🔧' },
        { label: '耳机音响', value: '他喜欢耳机音响 🎧' },
        { label: '摄影影像', value: '他喜欢相机镜头无人机 📷' },
        { label: '智能穿戴', value: '他喜欢智能手表手环 ⌚' },
        { label: '其他', value: '其他方向，我直接说' },
      ]
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'tech_branch', messages: ['他偏哪个细分？'], options: candidates, type: 'single', options_need_explain: true }))
      callJevSystemOne.mockResolvedValueOnce({ answers: { pair_0_1: { noul: 0.9 } } })
      const step = await fetchNextDynamicQuestion({}, [], 2)
      // 全程只调一次大模型；Jev 归类是毫秒级快决策，不计入大模型调用
      expect(callChatModel).toHaveBeenCalledTimes(1)
      expect(callChatModel.mock.calls[0][1].temperature).toBe(1.0)
      expect(callJevSystemOne).toHaveBeenCalledTimes(1)
      // 游戏主机+电竞外设合并、代表取原顺序首个；"其他"兜底项与讲解项保留
      expect(step.options).toHaveLength(7)
      expect(step.options[0].label).toBe('游戏主机')
      expect(step.options.map((o) => o.label)).not.toContain('电竞外设')
      expect(step.options.map((o) => o.label)).toContain('其他')
      expect(step.options.at(-1).value).toBe(EXPLAIN_OPTION_VALUE)

      // Jev 归类失败 → 退回原始候选，对话不断；"其他"兜底项不被封顶挤掉
      callChatModel.mockReset()
      callJevSystemOne.mockReset()
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'tech_branch2', messages: ['他偏哪个细分？'], options: candidates, type: 'single', options_need_explain: true }))
      callJevSystemOne.mockRejectedValueOnce(new Error('jev boom'))
      const fallback = await fetchNextDynamicQuestion({}, [], 3)
      expect(fallback.options).toHaveLength(8)
      expect(fallback.options.map((o) => o.label)).toContain('其他')

      // 加速模式为重速度跳过归类，也不调 Jev
      callChatModel.mockReset()
      callJevSystemOne.mockReset()
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'tech_branch3', messages: ['快点定。'], options: candidates, type: 'single', options_need_explain: true }))
      const fastStep = await fetchNextDynamicQuestion({}, [], 4, [], {}, 'fast')
      expect(callChatModel).toHaveBeenCalledTimes(1)
      expect(callJevSystemOne).not.toHaveBeenCalled()
      expect(fastStep.options).toHaveLength(8)
    })

    it('honors model decision when model outputs isReady: true', async () => {
      callChatModel.mockResolvedValueOnce(
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

      callChatModel.mockResolvedValueOnce(
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
      // 模型未标记 options_need_explain：常规单选题不附讲解入口
      expect(step.options).toHaveLength(2)
    })

    it('单选题仅在模型自标记并列品牌/型号时附讲解入口，多选与文字题永不附', async () => {
      // 未标记的常规单选题：没有讲解项
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'plain_single', messages: ['他偏哪个方向？'], options: [{ label: '影音娱乐', value: '影音娱乐' }] }))
      const plain = await fetchNextDynamicQuestion({}, [], 2)
      expect(plain.type).toBe('single')
      expect(plain.options.map((o) => o.value)).not.toContain(EXPLAIN_OPTION_VALUE)

      // 标记为并列品牌/型号的单选题：末尾附讲解项
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'brand_single', messages: ['这几个牌子他认哪个？'], options: [{ label: '洛斐', value: '洛斐矮轴键盘' }, { label: '樱桃', value: '樱桃原厂轴' }], options_need_explain: true }))
      const branded = await fetchNextDynamicQuestion({}, [], 3)
      expect(branded.options.at(-1).value).toBe(EXPLAIN_OPTION_VALUE)
      expect(branded.options.filter((o) => o.value !== EXPLAIN_OPTION_VALUE)).toHaveLength(2)

      // multi 即使标记也不附（选择语义会混乱）
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'multi_q', type: 'multi', messages: ['哪些更符合？'], options: [{ label: 'A', value: 'A' }], options_need_explain: true }))
      const multiStep = await fetchNextDynamicQuestion({}, [], 4)
      expect(multiStep.options.map((o) => o.value)).not.toContain(EXPLAIN_OPTION_VALUE)

      // text 题不附讲解项；第一题（硬编码身份题）也不带讲解入口
      callChatModel.mockResolvedValueOnce(JSON.stringify({ key: 'text_q', messages: ['直接说说？'], options: [] }))
      const textStep = await fetchNextDynamicQuestion({}, [], 5)
      expect(textStep.type).toBe('text')
      expect(textStep.options).toEqual([])
      expect(INITIAL_STEP.options.map((o) => o.value)).not.toContain(EXPLAIN_OPTION_VALUE)

      // 讲解函数：把题目、选项（剔除讲解项自身）与已知信息交给模型，返回讲解文本
      callChatModel.mockResolvedValueOnce('洛斐主打颜值和便携，樱桃是老牌手感稳……')
      const explainText = await explainOptionsForStep(
        {
          id: 'kb_brand',
          messages: ['这几个键盘牌子他更可能喜欢哪个？'],
          options: [
            { label: '洛斐', value: '洛斐 Lofree，颜值设计向矮轴键盘' },
            { label: '樱桃', value: 'Cherry 樱桃，老牌原厂轴手感' },
            { value: EXPLAIN_OPTION_VALUE, label: '讲讲区别' },
          ],
        },
        { recipient: '朋友 / 好友', budget: '¥300–600' }
      )
      expect(explainText).toContain('洛斐')
      const [explainPrompts, explainOpts] = callChatModel.mock.calls.at(-1)
      expect(explainPrompts[1].content).toContain('这几个键盘牌子他更可能喜欢哪个？')
      expect(explainPrompts[1].content).toContain('1. 洛斐（洛斐 Lofree，颜值设计向矮轴键盘）')
      expect(explainPrompts[1].content).toContain('2. 樱桃（Cherry 樱桃，老牌原厂轴手感）')
      expect(explainPrompts[1].content).not.toContain('讲讲区别')
      expect(explainPrompts[1].content).toContain('budget: ¥300–600')
      expect(explainOpts.jsonMode).toBeFalsy()

      // 讲解项缺失/无选项时直接返回空串，不发起调用
      callChatModel.mockClear()
      expect(await explainOptionsForStep({ options: [{ value: EXPLAIN_OPTION_VALUE, label: '讲讲区别' }] }, {})).toBe('')
      expect(callChatModel).not.toHaveBeenCalled()
    })
  })
})
