/**
 * 会话 Store —— 一次「策划」从头到尾的所有状态
 * 消息流、答案、当前步骤、进度都在这里，页面只负责渲染。
 */
import { defineStore } from 'pinia'
import { resolveSteps, stageLabel, progressOf } from '@/config/flow'
import { uid } from '@/utils/helpers'
import storage from '@/utils/storage'

const DRAFT_KEY = 'gm_draft_session'

export const useSessionStore = defineStore('session', {
  state: () => ({
    id: '',
    messages: [], // { id, role: 'ai'|'user'|'system', text, at, stepId }
    answers: {},
    stepIndex: 0,
    status: 'idle', // idle | asking | waiting | done
    startedAt: 0,
  }),

  getters: {
    /** 按当前答案解析出的步骤序列（支持条件分支） */
    steps: (s) => resolveSteps(s.answers),
    currentStep() {
      return this.steps[this.stepIndex] || null
    },
    isFinished() {
      return this.stepIndex >= this.steps.length
    },
    progress() {
      return progressOf(this.stepIndex, this.steps.length)
    },
    stageText() {
      const step = this.currentStep
      return step ? stageLabel(step.stage) : '生成方案 4/4'
    },
    answeredCount: (s) => Object.keys(s.answers).length,
  },

  actions: {
    start(fresh = true) {
      if (fresh || !this.id) {
        this.id = uid('sess')
        this.messages = []
        this.answers = {}
        this.stepIndex = 0
        this.startedAt = Date.now()
      }
      this.status = 'asking'
    },

    pushMessage(msg) {
      const m = { id: uid('msg'), at: Date.now(), ...msg }
      this.messages.push(m)
      return m
    },

    /** 记录一步的回答并前进 */
    answer(step, value, displayText) {
      this.answers[step.key] = value
      this.pushMessage({
        role: 'user',
        text: displayText ?? (Array.isArray(value) ? value.join('、') : String(value)),
        stepId: step.id,
      })
      this.stepIndex += 1
      this.persistDraft()
    },

    skip(step) {
      // 多选字段的 API 契约始终是数组。保留这个类型可以避免真实后端
      // 在“没有，跳过这题”时收到空字符串并返回 422。
      this.answers[step.key] = step.type === 'multi' ? [] : ''
      this.pushMessage({ role: 'user', text: '（跳过）', stepId: step.id, muted: true })
      this.stepIndex += 1
      this.persistDraft()
    },

    /** 回到上一题（重新作答） */
    back() {
      if (this.stepIndex === 0) return
      this.stepIndex -= 1
      const step = this.steps[this.stepIndex]
      if (step) delete this.answers[step.key]
      // 移除该步骤之后的所有消息
      const idx = this.messages.findIndex((m) => m.stepId === step?.id && m.role === 'user')
      if (idx >= 0) this.messages.splice(idx)
      this.persistDraft()
    },

    reset() {
      this.$reset()
      storage.remove(DRAFT_KEY)
    },

    persistDraft() {
      storage.setJSON(DRAFT_KEY, {
        id: this.id,
        answers: this.answers,
        stepIndex: this.stepIndex,
        messages: this.messages,
        startedAt: this.startedAt,
      })
    },

    restoreDraft() {
      const d = storage.getJSON(DRAFT_KEY, null)
      if (!d?.id) return false
      Object.assign(this, d, { status: 'asking' })
      return true
    },

    hasDraft() {
      const d = storage.getJSON(DRAFT_KEY, null)
      return Boolean(d?.stepIndex)
    },
  },
})
