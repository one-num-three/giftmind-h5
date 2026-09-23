import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  createInitial12Traits,
  morphDynamicTraitsByDomain,
  evaluateAndFill12Traits,
  formatTraitsBlackboardForPrompt,
  BASE_TRAIT_SLOTS,
} from '@/services/jevTraitsManager'
import { useSessionStore } from '@/stores/session'

describe('Jev Dynamic 12-Traits Manager & Decoupled State Tracking', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('initializes exactly 12 traits with 4 base and 8 dynamic slots', () => {
    const traits = createInitial12Traits()
    expect(traits).toHaveLength(12)

    // 前 4 个必须是通用基盘槽
    const baseKeys = traits.slice(0, 4).map((t) => t.key)
    expect(baseKeys).toEqual(['recipient', 'occasion', 'budget', 'taboo'])
    traits.slice(0, 4).forEach((t) => expect(t.isBase).toBe(true))

    // 后 8 个为动态自适应槽
    traits.slice(4).forEach((t) => {
      expect(t.isBase).toBe(false)
      expect(t.isFilled).toBe(false)
      expect(t.value).toBe('')
    })
  })

  it('morphs dynamic slots when a domain is identified while preserving total count at 12', () => {
    const initialTraits = createInitial12Traits()
    
    // 模拟识别到咖啡领域
    const coffeeTraits = morphDynamicTraitsByDomain(initialTraits, 'coffee')
    expect(coffeeTraits).toHaveLength(12)
    const coffeeKeys = coffeeTraits.map((t) => t.key)
    expect(coffeeKeys).toContain('gear_status')
    expect(coffeeKeys).toContain('extraction_habit')
    expect(coffeeKeys).toContain('flavor_preference')

    // 模拟识别到游戏数码领域
    const gamingTraits = morphDynamicTraitsByDomain(initialTraits, 'gaming')
    expect(gamingTraits).toHaveLength(12)
    const gamingKeys = gamingTraits.map((t) => t.key)
    expect(gamingKeys).toContain('platform_system')
    expect(gamingKeys).toContain('play_mode')
  })

  it('preserves already filled slot values when morphing domain', () => {
    const traits = createInitial12Traits()
    traits[0].value = '朋友 / 兄弟'
    traits[0].isFilled = true

    // 在通用槽位填入值
    traits[4].value = '喜欢宅家品饮'
    traits[4].isFilled = true

    const morphed = morphDynamicTraitsByDomain(traits, 'coffee')
    expect(morphed[0].value).toBe('朋友 / 兄弟')
    expect(morphed[0].isFilled).toBe(true)
    // 通用槽位的值会被平滑迁移或保留
    expect(morphed[4].isFilled).toBe(true)
  })

  it('accurately fills slot when matching candidate facts, and rejects vague inputs', () => {
    const traits = createInitial12Traits()
    
    const candidate = {
      recipient: '女朋友',
      occasion: '三周年纪念日',
      budget: '¥600–1200',
      taboo: '对劣质合金过敏',
      gear_status: '手头无专业器具',
      vague_trash: '看情况随便吧', // 模糊无效词汇
      skipped_item: '跳过',         // 跳过词汇
    }

    const filled = evaluateAndFill12Traits(traits, candidate)
    
    expect(filled[0].value).toBe('女朋友')
    expect(filled[0].isFilled).toBe(true)
    expect(filled[1].value).toBe('三周年纪念日')
    expect(filled[1].isFilled).toBe(true)
    expect(filled[2].value).toBe('¥600–1200')
    expect(filled[2].isFilled).toBe(true)
    expect(filled[3].value).toBe('对劣质合金过敏')
    expect(filled[3].isFilled).toBe(true)

    // 验证模糊/跳过词汇没有被胡乱塞进任何槽位
    const values = filled.map((t) => t.value)
    expect(values).not.toContain('看情况随便吧')
    expect(values).not.toContain('跳过')
  })

  it('integrates seamlessly with Pinia sessionStore', () => {
    const store = useSessionStore()
    store.start()

    expect(store.traits12).toHaveLength(12)
    expect(store.filledTraitsCount).toBe(0)
    expect(store.traitsProgress).toBe(0)

    // 模拟用户提交第一题：选择送朋友
    store.answer({ id: 'recipient', key: 'recipient', type: 'single' }, '朋友 / 好友')
    store.syncDynamicTraits()

    expect(store.filledTraitsCount).toBeGreaterThanOrEqual(1)
    expect(store.traits12[0].value).toBe('朋友 / 好友')
    expect(store.traitsProgress).toBe(Math.round((store.filledTraitsCount / 12) * 100))

    // 模拟大模型提取到咖啡装备偏好
    store.syncDynamicTraits(
      { gear_status: '刚入手泰摩手冲壶，缺一台好磨豆机' },
      'coffee'
    )

    expect(store.filledTraitsCount).toBeGreaterThanOrEqual(2)
    const gearSlot = store.traits12.find((t) => t.key === 'gear_status')
    expect(gearSlot).toBeDefined()
    expect(gearSlot?.value).toBe('刚入手泰摩手冲壶，缺一台好磨豆机')
    expect(gearSlot?.isFilled).toBe(true)
  })

  it('formats prompt blackboard cleanly without survey interrogation commands', () => {
    const traits = createInitial12Traits()
    traits[0].value = '哥哥'
    traits[0].isFilled = true
    traits[2].value = '¥500左右'
    traits[2].isFilled = true

    const blackboard = formatTraitsBlackboardForPrompt(traits)
    expect(blackboard).toContain('【已知心意特征】')
    expect(blackboard).toContain('哥哥')
    expect(blackboard).toContain('¥500左右')
    expect(blackboard).toContain('【未明确的参考维度（仅供买手直觉权衡，严禁像审讯员一样逐条点名）：】')
    // 严禁包含机械调查问卷命令
    expect(blackboard).not.toContain('请询问')
    expect(blackboard).not.toContain('必须填满')
  })
})
