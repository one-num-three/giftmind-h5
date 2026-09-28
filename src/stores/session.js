/**
 * 会话 Store —— 一次「策划」从头到尾的所有状态
 * 现由深度 AI 买手大模型主导出题与槽位自适应。
 */
import { defineStore } from 'pinia'
import { INITIAL_STEP } from '@/api/aiQuestionEngine'
import { CHAT_FLOW, stageLabel } from '@/config/flow'
import { uid } from '@/utils/helpers'
import storage from '@/utils/storage'
import { projectsApi } from '@/api/projects'
import { buildDialogStateCanvas } from '@/services/jevEngine'
import { createInitial12Traits, morphDynamicTraitsByDomain, evaluateAndFill12Traits } from '@/services/jevTraitsManager'

const DRAFT_KEY = 'gm_draft_session'
const PROJECT_KEY = 'gm_current_project'
const PROJECT_MODE_KEY = 'gm_project_mode'
const RECOVERY_FIELDS = new Set(['budget', 'timing'])
const MAX_PENDING_MESSAGES = 200

/** 项目绑定完成前要落库的消息先排队，bindProject 时按序补发 */
let pendingMessages = []

export const useSessionStore = defineStore('session', {
  state: () => ({
    id: '',
    currentProjectId: storage.get(PROJECT_KEY) || '',
    /** 挑礼模式：'qa' 问答问卷 | 'agent' 自由闲聊，后端项目记录里的 mode 为准；
     *  随项目绑定一起持久化，刷新/重开页面后仍知道自己身处哪种模式 */
    mode: storage.get(PROJECT_MODE_KEY) || 'qa',
    messages: [], // { id, role: 'ai'|'user'|'system', text, at, stepId, streaming, synced }
    answers: {},
    answerSteps: {},
    stepIndex: 0,
    status: 'idle', // idle | asking | waiting | done
    startedAt: 0,
    activeDynamicStep: null,
    isAiReady: false,
    dynamic12Traits: createInitial12Traits(),
  }),

  getters: {
    steps() {
      return CHAT_FLOW
    },
    currentStep() {
      if (this.stepIndex === 0) return INITIAL_STEP
      if (this.activeDynamicStep) return this.activeDynamicStep
      return INITIAL_STEP
    },
    isFinished() {
      return this.isAiReady
    },
    progress() {
      return this.isAiReady ? 1 : this.stepIndex / (this.stepIndex + 4)
    },
    stageText() {
      const step = this.currentStep
      return step ? stageLabel(step.stage) : '生成方案'
    },
    answeredCount: (s) => Object.keys(s.answers).length,
    /** 🌟 12 维动态心意特质卡槽 Getter */
    traits12: (s) => s.dynamic12Traits || [],
    filledTraitsCount: (s) => (s.dynamic12Traits || []).filter((t) => t.isFilled).length,
    traitsProgress: (s) => Math.round(((s.dynamic12Traits || []).filter((t) => t.isFilled).length / 12) * 100),
  },

  actions: {
    /** 兼容旧槽位提取调用；补充字段不改变对话轮次。 */
    fillExtractedSlots(extractedSlots = {}) {
      if (!extractedSlots || typeof extractedSlots !== 'object') return 0
      const keys = Object.keys(extractedSlots)
      if (!keys.length) return 0

      let added = 0
      for (const [k, v] of Object.entries(extractedSlots)) {
        if (v && !this.answers[k]) {
          this.answers[k] = v
          added++
        }
      }
      if (added > 0) {
        this.persistDraft()
      }
      return added
    },
    start(fresh = true) {
      if (fresh || !this.id || this.stepIndex === 0) {
        this.id = uid('sess')
        this.messages = []
        this.answers = {}
        this.answerSteps = {}
        this.stepIndex = 0
        this.activeDynamicStep = null
        this.isAiReady = false
        this.dynamic12Traits = createInitial12Traits()
        this.startedAt = Date.now()
      }
      this.status = 'asking'
    },

    /** 🌟 项目制：把当前会话绑定到一个挑礼项目（消息/答案落库都靠它） */
    bindProject(projectId) {
      const pid = typeof projectId === 'string' ? projectId : ''
      this.currentProjectId = pid
      if (pid) storage.set(PROJECT_KEY, pid)
      else storage.remove(PROJECT_KEY)
      // 绑定前排队等待的消息，现在按序补发
      if (pid && pendingMessages.length) {
        const queued = pendingMessages
        pendingMessages = []
        for (const m of queued) this._postMessage(pid, m)
      }
    },

    clearProject() {
      this.bindProject('')
    },

    /**
     * 开始一个全新的挑礼项目：清掉旧现场 → 立即开聊 → 异步创建后端项目并绑定。
     * 不等待创建完成才进页面（后端不在也能聊，消息先排队，绑定后补发）。
     */
    async startNewProject(mode = 'qa') {
      this.reset()
      this.mode = mode === 'agent' ? 'agent' : 'qa'
      storage.set(PROJECT_MODE_KEY, this.mode)
      this.start(true)
      try {
        const project = await projectsApi.create({ mode })
        if (project?.id) this.bindProject(project.id)
      } catch {
        /* 本地服务没启动：不阻塞聊天 */
      }
    },

    /** 从后端项目记录恢复现场（方案页「继续完善」回到问答时用） */
    restoreFromProject(record) {
      if (!record || typeof record !== 'object') return false
      pendingMessages = []
      const list = Array.isArray(record.messages) ? record.messages : []
      this.messages = list.map((m) => ({
        id: m.id || uid('msg'),
        role: m.role === 'ai' || m.role === 'system' ? m.role : 'user',
        text: typeof m.content === 'string' ? m.content : '',
        at: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
        stepId: m.stepKey || '',
        streaming: false,
        synced: true, // 已在库里的消息不再回写
      }))
      this.answers = record.answers && typeof record.answers === 'object' ? { ...record.answers } : {}
      this.mode = record.mode === 'agent' ? 'agent' : 'qa'
      storage.set(PROJECT_MODE_KEY, this.mode)
      const steps = record.answerSteps && typeof record.answerSteps === 'object' ? record.answerSteps : {}
      this.answerSteps = steps
      // 每答一题 stepIndex+1，恢复时按已答题数对齐，AI 会接着这个进度往下问
      this.stepIndex = Object.keys(steps).length
      this.activeDynamicStep = null
      this.isAiReady = false
      this.dynamic12Traits = createInitial12Traits()
      this.startedAt = Date.now()
      this.status = 'asking'
      this.id = uid('sess')
      this.persistDraft()
      return true
    },

    /** 异步把一条消息写进当前项目；失败静默（不打扰聊天节奏） */
    _syncMessage(m) {
      if (!m || m.synced || m.streaming) return
      const text = typeof m.text === 'string' ? m.text.trim() : ''
      if (!text) return
      m.synced = true
      const pid = this.currentProjectId
      if (!pid) {
        // 项目还没建好（创建请求在途）：排队，bindProject 时补发
        pendingMessages.push(m)
        if (pendingMessages.length > MAX_PENDING_MESSAGES) pendingMessages.shift()
        return
      }
      this._postMessage(pid, m)
    },

    _postMessage(pid, m) {
      const role = m.role === 'ai' || m.role === 'system' ? m.role : 'user'
      const payload = {
        role,
        content: String(m.text),
        stepKey: m.stepId ? String(m.stepId).slice(0, 64) : '',
        meta: { muted: Boolean(m.muted), edited: Boolean(m.edited) },
      }
      // 用户消息顺带把答案快照带上，后端用它刷新项目现场
      if (role === 'user') {
        payload.answers = JSON.parse(JSON.stringify(this.answers))
        payload.answerSteps = JSON.parse(JSON.stringify(this.answerSteps))
      }
      projectsApi.appendMessage(pid, payload).catch(() => {})
    },

    /** 答案快照直接刷后端（咨询改答案等不走消息入口的变更） */
    _syncProjectSnapshot() {
      if (!this.currentProjectId) return
      projectsApi
        .patch(this.currentProjectId, {
          answers: JSON.parse(JSON.stringify(this.answers)),
          answerSteps: JSON.parse(JSON.stringify(this.answerSteps)),
        })
        .catch(() => {})
    },

    /** 截断后的完整消息历史整单回写后端（与本地现场保持一致，防恢复时旧答案复活） */
    _replaceProjectMessages() {
      if (!this.currentProjectId) return
      const messages = this.messages
        .filter((m) => typeof m.text === 'string' && m.text.trim())
        .map((m) => ({
          role: m.role === 'ai' || m.role === 'system' ? m.role : 'user',
          content: String(m.text),
          stepKey: m.stepId ? String(m.stepId).slice(0, 64) : '',
          meta: { muted: Boolean(m.muted), edited: Boolean(m.edited) },
        }))
      projectsApi
        .patch(this.currentProjectId, {
          answers: JSON.parse(JSON.stringify(this.answers)),
          answerSteps: JSON.parse(JSON.stringify(this.answerSteps)),
          messages,
        })
        .catch(() => {})
    },

    /** 🌟 Jev 驱动的 12 维动态心意特质后台静默同步与审核入槽 */
    syncDynamicTraits(extractedCandidate = {}, domain = '', suggestedSlots = []) {
      if (!this.dynamic12Traits || this.dynamic12Traits.length !== 12) {
        this.dynamic12Traits = createInitial12Traits()
      }
      const canvas = buildDialogStateCanvas(this.answers || {})
      const activeDomain = domain || canvas.domain || ''
      // 1. 若识别到品类或模型建议槽位，动态调整 8 维自适应槽位
      if (activeDomain || (Array.isArray(suggestedSlots) && suggestedSlots.length >= 2)) {
        this.dynamic12Traits = morphDynamicTraitsByDomain(this.dynamic12Traits, activeDomain, suggestedSlots)
      }
      // 2. Jev 严格裁决：符合的填入，不符合/模糊的不填
      const mergedCandidate = { ...canvas, ...extractedCandidate }
      this.dynamic12Traits = evaluateAndFill12Traits(this.dynamic12Traits, mergedCandidate, this.answers)
      this.persistDraft()
      return this.dynamic12Traits
    },

    pushMessage(msg) {
      const m = { id: uid('msg'), at: Date.now(), ...msg }
      this.messages.push(m)
      this._syncMessage(m)
      return this.messages[this.messages.length - 1]
    },

    updateMessageText(id, newText, isStreaming = true) {
      const target = this.messages.find((m) => m.id === id)
      if (target) {
        target.text = newText
        target.streaming = isStreaming
        // 流式消息在打字结束（isStreaming=false）这一刻才真正落库
        if (!isStreaming) this._syncMessage(target)
      }
    },

    setDynamicStep(step) {
      this.activeDynamicStep = step
      this.persistDraft()
    },

    forceFinish() {
      this.isAiReady = true
      this.persistDraft()
    },

    /** Agent 闲聊模式：把模型从对话里提炼的画像槽位合并进 answers，并同步后端快照 */
    mergeAgentSlots(slots) {
      if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return 0
      let added = 0
      for (const [key, value] of Object.entries(slots)) {
        if (!key || value == null || value === '') continue
        if (JSON.stringify(this.answers[key]) === JSON.stringify(value)) continue
        this.answers[key] = value
        added++
      }
      if (added > 0) {
        this.persistDraft()
        this._syncProjectSnapshot()
      }
      return added
    },

    /** 记录一步的回答并前进 */
    answer(step, value, displayText) {
      this.answers[step.key] = value
      this.answerSteps[step.key] = JSON.parse(JSON.stringify(step))
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
      this.answerSteps[step.key] = JSON.parse(JSON.stringify(step))
      this.pushMessage({ role: 'user', text: '先跳过', stepId: step.id, muted: true })
      this.stepIndex += 1
      this.persistDraft()
    },

    applySummaryEdits(edits) {
      for (const [blockKey, value] of Object.entries(edits || {})) {
        let editText = typeof value === 'string' ? value.trim() : ''
        if (!editText) continue
        if (blockKey === 'story') {
          const occasionPrefix = this.answers.occasion ? `${this.answers.occasion}：` : ''
          if (occasionPrefix && editText.startsWith(occasionPrefix)) {
            this.answers.memory = editText.slice(occasionPrefix.length).trim()
          } else {
            this.answers.memory = editText
          }
        } else if (blockKey === 'feeling') {
          this.answers.feeling = editText
        } else if (blockKey === 'constraints') {
          this.answers.constraints = editText
        }
      }
      this.persistDraft()
    },

    applyConsultationEdits(edits) {
      for (const [key, value] of Object.entries(edits || {})) {
        if (!Object.prototype.hasOwnProperty.call(this.answers, key)) continue
        const previous = this.answers[key]
        if (Array.isArray(previous)) this.answers[key] = String(value).split(/[、\n]/).map((s) => s.trim()).filter(Boolean)
        else if (typeof previous === 'boolean') this.answers[key] = value === '是' ? true : value === '否' ? false : String(value).trim()
        else if (previous && typeof previous === 'object') {
          try { this.answers[key] = JSON.parse(value) } catch { continue }
        } else this.answers[key] = String(value).trim()
        if (JSON.stringify(previous) === JSON.stringify(this.answers[key])) continue
        const stepId = this.answerSteps[key]?.id || key
        const message = [...this.messages].reverse().find((m) => m.role === 'user' && m.stepId === stepId)
        if (message) {
          message.text = String(value).trim() || '先跳过'
          message.muted = !String(value).trim()
          message.edited = true
        }
      }
      this.persistDraft()
      this._syncProjectSnapshot()
    },

    resumeConsultation() {
      this.isAiReady = false
      this.activeDynamicStep = null
      this.messages = this.messages.filter((m) => m.stepId !== '__done__')
      this.pushMessage({ role: 'system', stepId: '__resume__', text: '用户在确认页选择了“继续聊聊”，希望进一步讨论选礼细节。' })
      this.status = 'asking'
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
      const stepIndex = CHAT_FLOW.findIndex((step) => step.id === stepId || step.key === stepId)
      if (stepIndex >= 0) {
        this.stepIndex = stepIndex
        for (let i = stepIndex; i < CHAT_FLOW.length; i++) {
          const s = CHAT_FLOW[i]
          if (s?.key) delete this.answers[s.key]
        }
      }
      const firstMessageIndex = this.messages.findIndex((message) => message.stepId === stepId)
      if (firstMessageIndex >= 0) this.messages.splice(firstMessageIndex)
      this.status = 'asking'
      this.persistDraft()
      return true
    },

    back() {
      const last = [...this.messages].reverse().find((m) => m.role === 'user')
      const entry = Object.entries(this.answerSteps).find(([, step]) => step.id === last?.stepId)
      if (!entry) return
      const [key, step] = entry
      delete this.answers[key]
      delete this.answerSteps[key]
      this.stepIndex = Math.max(0, this.stepIndex - 1)
      this.activeDynamicStep = step
      this.isAiReady = false
      const idx = this.messages.findIndex((m) => m.id === last.id)
      this.messages.splice(idx)
      this.persistDraft()
    },

    /**
     * 🌟 点气泡改答案：跳到历史任意一题重新作答。
     * 该题与之后的所有答案一起作废（下游问题是按旧上下文问的，留着会自相矛盾），
     * 消息流从该题回答气泡处截断，题目本体（含选项）通过 answerSteps 快照原样重新展示。
     */
    revisitDynamic(stepId) {
      const keys = Object.keys(this.answerSteps)
      const key = keys.find((k) => this.answerSteps[k]?.id === stepId)
      if (!key) return false
      const step = this.answerSteps[key]
      const cutAt = keys.indexOf(key)
      for (let i = cutAt; i < keys.length; i++) {
        delete this.answers[keys[i]]
        delete this.answerSteps[keys[i]]
      }
      const firstAnswerIdx = this.messages.findIndex(
        (m) => m.role === 'user' && m.stepId === stepId && !m.muted
      )
      if (firstAnswerIdx >= 0) this.messages.splice(firstAnswerIdx)
      this.stepIndex = Object.keys(this.answerSteps).length
      this.activeDynamicStep = step
      this.isAiReady = false
      this.status = 'asking'
      // 作废答案派生出的特质画像一并清零，避免按已丢弃的旧回答推荐
      this.dynamic12Traits = createInitial12Traits()
      this.persistDraft()
      this._syncProjectSnapshot()
      this._replaceProjectMessages()
      return true
    },

    reset() {
      pendingMessages = []
      storage.remove(DRAFT_KEY)
      storage.remove(PROJECT_KEY)
      storage.remove(PROJECT_MODE_KEY)
      // 先删存储再 $reset：initial state 会重新读 storage，顺序不能反
      this.$reset()
    },

    persistDraft() {
      const cleanMessages = this.messages.map((m) => ({
        ...m,
        streaming: false,
      }))

      storage.setJSON(DRAFT_KEY, {
        id: this.id,
        projectId: this.currentProjectId,
        answers: this.answers,
        answerSteps: this.answerSteps,
        stepIndex: this.stepIndex,
        messages: cleanMessages,
        startedAt: this.startedAt,
        activeDynamicStep: this.activeDynamicStep,
        isAiReady: this.isAiReady,
        dynamic12Traits: this.dynamic12Traits,
      })
    },

    restoreDraft() {
      const d = storage.getJSON(DRAFT_KEY, null)
      if (!d?.id || !d.stepIndex) return false
      
      const restored = {
        ...d,
        answerSteps: d.answerSteps || {},
        messages: (d.messages || []).map((m) => ({ ...m, streaming: false, synced: true })),
        dynamic12Traits: Array.isArray(d.dynamic12Traits) && d.dynamic12Traits.length === 12
          ? d.dynamic12Traits
          : createInitial12Traits(),
        status: 'asking',
      }
      if (typeof d.projectId === 'string' && d.projectId) this.bindProject(d.projectId)
      Object.assign(this, restored)
      return true
    },

    hasDraft() {
      const d = storage.getJSON(DRAFT_KEY, null)
      return Boolean(d?.id && d?.stepIndex > 0)
    },
  },
})
