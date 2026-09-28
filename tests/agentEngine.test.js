import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/aiService', () => ({ callChatModel: vi.fn() }))

import { callChatModel } from '@/api/aiService'
import {
  AGENT_GREETING,
  agentChat,
  agentNextQuestion,
  normalizeAgentReply,
  normalizeNextQuestion,
} from '@/api/agentEngine'

const RED_LINES = [/摄影/, /咖啡/, /现有设备/, /3~4/, /第.*轮/]

describe('agentEngine（Agent 闲聊模式）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('闲聊提示词避开红线词且带 JSON 契约与槽位约定', async () => {
    callChatModel.mockResolvedValue(JSON.stringify({ reply: '好呀', chips: null, slots: {} }))
    await agentChat({ messages: [], answers: {} })
    const sys = callChatModel.mock.calls[0][0][0].content
    for (const bad of RED_LINES) expect(sys).not.toMatch(bad)
    expect(sys).toMatch(/JSON/)
    expect(sys).toMatch(/slots/)
    // 闲聊只接话不追问：回复不带问号，提问只发生在「生成方案」后的出题补全阶段
    expect(sys).toMatch(/绝不向用户提问/)
    expect(sys).toMatch(/不带问号/)
    expect(callChatModel.mock.calls[0][1]).toMatchObject({ jsonMode: true, temperature: 0.8 })
  })

  it('出题补全提示词避开红线词：自检缺什么、不重复问已知、预算不可缺席、非字段清单', async () => {
    callChatModel.mockResolvedValue(JSON.stringify({ done: false, question: '预算多少？', options: [], slot_key: 'budget' }))
    await agentNextQuestion({ answers: {}, messages: [] })
    const sys = callChatModel.mock.calls[0][0][0].content
    for (const bad of RED_LINES) expect(sys).not.toMatch(bad)
    // 判定标准延续「针对这个人」哲学，且明确已知槽位不重复问
    expect(sys).toMatch(/针对这个人/)
    expect(sys).toMatch(/通用安全牌/)
    expect(sys).toMatch(/已知不重复问/)
    expect(sys).not.toMatch(/必须明确/)
    // 预算硬下限写进契约；问句收尾；slot_key 供程序回写画像
    expect(sys).toMatch(/预算不可缺席/)
    expect(sys).toMatch(/问句/)
    expect(sys).toMatch(/slot_key/)
    expect(callChatModel.mock.calls[0][1]).toMatchObject({ jsonMode: true, temperature: 0.5 })
  })

  it('对话历史跳过 muted 与 system 消息', async () => {
    callChatModel.mockResolvedValue(JSON.stringify({ reply: 'ok', chips: null, slots: {} }))
    await agentChat({
      messages: [
        { role: 'user', text: '生成方案', muted: true },
        { role: 'system', text: '内部标记' },
        { role: 'user', text: '送给我妈妈' },
        { role: 'ai', text: '她平时喜欢什么？' },
      ],
      answers: {},
    })
    const user = callChatModel.mock.calls[0][0][1].content
    expect(user).not.toContain('生成方案')
    expect(user).not.toContain('内部标记')
    expect(user).toContain('送给我妈妈')
    expect(user).toContain('她平时喜欢什么？')
  })

  it('normalizeAgentReply 正常解析 reply/chips/slots，chips 清洗截断', () => {
    const r = normalizeAgentReply(
      JSON.stringify({
        reply: ' 嗯哼 ',
        chips: [
          { label: '实用主义路线比较长', value: '实用' },
          { label: '', value: 'x' },
        ],
        slots: { budget: '500 左右' },
      })
    )
    expect(r.reply).toBe('嗯哼')
    expect(r.chips).toEqual([{ label: '实用主义路线比较', value: '实用' }])
    expect(r.slots).toEqual({ budget: '500 左右' })
  })

  it('normalizeAgentReply 对非法 JSON 容错兜底，不炸对话', () => {
    const r = normalizeAgentReply('not json at all')
    expect(r.reply.length).toBeGreaterThan(0)
    expect(r.chips).toEqual([])
    expect(r.slots).toEqual({})
  })

  it('normalizeNextQuestion 解析出题/完成/坏输入三态', () => {
    expect(
      normalizeNextQuestion(
        JSON.stringify({ done: false, question: ' 预算多少？ ', options: [{ label: '300 左右', value: '300 左右' }], slot_key: 'budget' })
      )
    ).toEqual({ done: false, question: '预算多少？', options: [{ label: '300 左右', value: '300 左右' }], slotKey: 'budget' })
    expect(normalizeNextQuestion('{"done": true}')).toEqual({ done: true, question: '', options: [], slotKey: '' })
    // 坏输入返回 null，由调用方播兜底追问
    expect(normalizeNextQuestion('garbage')).toBeNull()
    expect(normalizeNextQuestion('{"done": false}')).toBeNull()
    // 拼写错误的槽位键名被白名单丢弃，防脏键混进画像
    expect(normalizeNextQuestion('{"done": false, "question": "预算多少？", "slot_key": "budet"}')?.slotKey).toBe('')
  })

  it('开场白非空且不踩红线', () => {
    expect(AGENT_GREETING.length).toBeGreaterThan(10)
    for (const bad of RED_LINES) expect(AGENT_GREETING).not.toMatch(bad)
  })
})
