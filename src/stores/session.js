/**
 * 会话 Store —— 一次「策划」从头到尾的所有状态
 * 消息流、答案、当前步骤、进度都在这里，页面只负责渲染。
 * 现已支持 Xiaomi MiMo 大模型动态出题与槽位自适应。
 */
import { defineStore } from 'pinia'
import { resolveSteps, stageLabel, progressOf } from '@/config/flow'
import { INITIAL_STEP } from '@/api/aiQuestionEngine'
import { uid } from '@/utils/helpers'
import storage from '@/utils/storage'

const DRAFT_KEY = 'gm_draft_session'
const RECOVERY_FIELDS = new Set(['budget', 'timing'])

export const useSessionStore = defineStore('session', {
  state: () => ({
    id: '',
    messages: [], // { id, role: 'ai'|'user'|'system', text, at, stepId }
    answers: {},
    stepIndex: 0,
    status: 'idle', // idle | asking | waiting | done
    startedAt: 0,
    activeDynamicStep: null,
    isAiReady: false,
  }),

  getters: {
    /** 静态备用步骤序列 */
    steps: (s) => resolveSteps(s.answers),
    currentStep() {
      if (this.stepIndex === 0) return INITIAL_STEP
      if (this.activeDynamicStep) return this.activeDynamicStep
      return this.steps[this.stepIndex] || null
    },
    isFinished() {
      return this.isAiReady || this.stepIndex >= 6 || this.stepIndex >= this.steps.length
    },
    progress() {
      return progressOf(this.stepIndex, 5)
    },
    stageText() {
      const step = this.currentStep
      return step ? stageLabel(step.stage) : '生成方案'
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
        this.activeDynamicStep = null
        this.isAiReady = false
        this.startedAt = Date.now()
      }
      this.status = 'asking'
    },

    pushMessage(msg) {
      const m = { id: uid('msg'), at: Date.now(), ...msg }
      this.messages.push(m)
      return m
    },

    setDynamicStep(step) {
      this.activeDynamicStep = step
      this.persistDraft()
    },

    forceFinish() {
      this.isAiReady = true
      this.persistDraft()
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
      this.answers[step.key] = step.type === 'multi' ? [] : ''
      this.pushMessage({ role: 'user', text: '（跳过）', stepId: step.id, muted: true })
      this.stepIndex += 1
      this.persistDraft()
    },

    applySummaryEdits(edits) {
      const map = {
        story: 'memory',
        feeling: 'feeling',
      }
      for (const [blockKey, value] of Object.entries(edits || {})) {
        const field = map[blockKey]
        if (!field) continue
        let editText = typeof value === 'string' ? value.trim() : ''
        if (!editText) continue
        if (blockKey === 'story') {
          const occasion = String(this.answers.occasion || '一个特别的日子').trim()
          const prefix = `${occasion}：`
          if (editText.startsWith(prefix)) editText = editText.slice(prefix.length).trim()
        }
        if (editText) this.answers[field] = editText
      }
      this.persistDraft()
    },

    applyRecoveryPatch(patch) {
      let changed = false
      for (const [key, value] of Object.entries(patch || {})) {
        if (!RECOVERY_FIELDS.has(key) || value == null || value === '') continue
        this.answers[key] = value
        changed = true
      }
      if (changed) this.persistDraft()
      return changed
    },

    revisit(stepId) {
      const snapshot = this.steps
      const index = snapshot.findIndex((step) => step.id === stepId)
      if (index < 0) return false
      const affected = new Set(snapshot.slice(index).map((step) => step.key))
      for (const key of affected) delete this.answers[key]
      const firstMessageIndex = this.messages.findIndex((message) => message.stepId === stepId)
      if (firstMessageIndex >= 0) this.messages.splice(firstMessageIndex)
      this.stepIndex = index
      this.status = 'asking'
      this.persistDraft()
      return true
    },

    back() {
      if (this.stepIndex === 0) return
      this.stepIndex -= 1
      const step = this.currentStep
      if (step) delete this.answers[step.key]
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
        activeDynamicStep: this.activeDynamicStep,
        isAiReady: this.isAiReady,
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
