import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/projects', () => ({
  projectsApi: {
    create: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    appendMessage: vi.fn(),
    savePlan: vi.fn(),
  },
}))

import { projectsApi } from '@/api/projects'
import { useSessionStore } from '@/stores/session'

describe('session Agent 闲聊模式支持', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('startNewProject(agent) 设置 mode 并以 agent 创建后端项目', async () => {
    projectsApi.create.mockResolvedValue({ id: 'p-agent-1', mode: 'agent' })
    const session = useSessionStore()

    await session.startNewProject('agent')

    expect(session.mode).toBe('agent')
    expect(projectsApi.create).toHaveBeenCalledWith({ mode: 'agent' })
    expect(session.currentProjectId).toBe('p-agent-1')
  })

  it('startNewProject() 默认 qa，mode 不越界', async () => {
    projectsApi.create.mockResolvedValue({ id: 'p-qa-1', mode: 'qa' })
    const session = useSessionStore()

    await session.startNewProject()

    expect(session.mode).toBe('qa')
  })

  it('restoreFromProject 从记录恢复 mode，agent 现场原样回放', () => {
    const session = useSessionStore()
    const ok = session.restoreFromProject({
      id: 'p-agent-1',
      mode: 'agent',
      answers: { recipient: '闺蜜' },
      answerSteps: {},
      messages: [
        { role: 'ai', content: '开场白', stepKey: '__agent__' },
        { role: 'user', content: '送我闺蜜', stepKey: '__agent__' },
      ],
    })

    expect(ok).toBe(true)
    expect(session.mode).toBe('agent')
    expect(session.messages).toHaveLength(2)
    expect(session.stepIndex).toBe(0)
    // 缺 mode 字段的旧记录按 qa 处理
    session.restoreFromProject({ id: 'p-old', mode: undefined, answers: {}, messages: [] })
    expect(session.mode).toBe('qa')
  })

  it('mode 随项目绑定持久化：模拟整页刷新后初始状态仍是 agent', async () => {
    projectsApi.create.mockResolvedValue({ id: 'p-agent-2', mode: 'agent' })
    let session = useSessionStore()
    await session.startNewProject('agent')
    expect(session.mode).toBe('agent')

    // 整页刷新：pinia 重建，localStorage 里的绑定与模式保留
    setActivePinia(createPinia())
    session = useSessionStore()
    expect(session.mode).toBe('agent')
    expect(session.currentProjectId).toBe('p-agent-2')

    // 重置并新建 qa 项目后，持久化的模式同步清回 qa
    projectsApi.create.mockResolvedValue({ id: 'p-qa-2', mode: 'qa' })
    await session.startNewProject('qa')
    setActivePinia(createPinia())
    session = useSessionStore()
    expect(session.mode).toBe('qa')
    expect(session.currentProjectId).toBe('p-qa-2')
  })

  it('mergeAgentSlots 合并新槽位、跳过空值与重复值', () => {
    const session = useSessionStore()
    session.start(true)
    session.answers = { recipient: '我妈妈' }

    const added = session.mergeAgentSlots({
      budget: '500 左右',
      recipient: '我妈妈',
      '': '坏键',
      empty: '',
      nullVal: null,
    })

    expect(added).toBe(1)
    expect(session.answers).toEqual({ recipient: '我妈妈', budget: '500 左右' })
    expect(session.mergeAgentSlots(null)).toBe(0)
    expect(session.mergeAgentSlots([1, 2])).toBe(0)
  })
})
