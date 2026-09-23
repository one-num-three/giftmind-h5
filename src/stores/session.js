/**
 * 会话 Store —— 一次「策划」从头到尾的所有状态
 * 现由深度 AI 买手大模型主导出题与槽位自适应。
 */
import { defineStore } from 'pinia'
import { INITIAL_STEP } from '@/api/aiQuestionEngine'
import { CHAT_FLOW, stageLabel } from '@/config/flow'
import { uid } from '@/utils/helpers'
import storage from '@/utils/storage'
import { buildDialogStateCanvas } from '@/services/jevEngine'
import { createInitial12Traits, morphDynamicTraitsByDomain, evaluateAndFill12Traits } from '@/services/jevTraitsManager'

const DRAFT_KEY = 'gm_draft_session'
const RECOVERY_FIELDS = new Set(['budget', 'timing'])

export const useSessionStore = defineStore('session', {
  state: () => ({
    id: '',
    messages: [], // { id, role: 'ai'|'user'|'system', text, at, stepId, streaming }
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
    /** 🌟 Jev 驱动的买手人情动态洞察画像徽标 */
    insightBadges(s) {
      const badges = []
      const canvas = buildDialogStateCanvas(s.answers || {})

      // 1. 关系徽标 (精准反映细分类型，绝不模糊)
      if (canvas.recipient) {
        if (canvas.friend_sub_type) {
          const emojiMap = {
            '铁哥们 / 兄弟': '👊',
            '好闺蜜 / 姐妹': '✨',
            '同窗死党': '🎓',
            '日常搭子 / 玩伴': '🤝',
          }
          badges.push({
            text: canvas.friend_sub_type,
            icon: emojiMap[canvas.friend_sub_type] || '🤝',
            tone: 'friend',
          })
        } else if (canvas.rel_category === 'work') {
          badges.push({ text: '职场尊崇与分寸', icon: '👔', tone: 'work' })
        } else if (canvas.rel_category === 'lover') {
          badges.push({ text: '亲密浪漫专属', icon: '💗', tone: 'love' })
        } else if (canvas.rel_category === 'elder') {
          badges.push({ text: '孝敬康养体贴', icon: '🏡', tone: 'elder' })
        } else if (canvas.rel_category === 'junior') {
          badges.push({ text: '童趣益智探索', icon: '🎈', tone: 'kid' })
        } else {
          badges.push({ text: '挚友默契', icon: '🤝', tone: 'friend' })
        }
      }

      // 2. 领域徽标 (动态展示任何爱好领域，绝不死卡 8 种)
      if (canvas.domain) {
        const domainMap = {
          ai_tech: { text: 'AI与数字科技', icon: '🤖', tone: 'tech' },
          'AI与数字科技': { text: 'AI与数字科技', icon: '🤖', tone: 'tech' },
          model_toys: { text: '潮玩模型积木', icon: '🧩', tone: 'toys' },
          '潮玩模型积木': { text: '潮玩模型积木', icon: '🧩', tone: 'toys' },
          music: { text: '音乐与音频美学', icon: '🎵', tone: 'music' },
          '音乐与音频美学': { text: '音乐与音频美学', icon: '🎵', tone: 'music' },
          tea: { text: '办公室慢调品茗', icon: '🍵', tone: 'tea' },
          '茶道品茗': { text: '茶道品茗', icon: '🍵', tone: 'tea' },
          coffee: { text: '精品咖啡生活', icon: '☕', tone: 'coffee' },
          '咖啡生活': { text: '精品咖啡生活', icon: '☕', tone: 'coffee' },
          photo: { text: '摄影记录与影像', icon: '📷', tone: 'photo' },
          '摄影记录与影像': { text: '摄影记录与影像', icon: '📷', tone: 'photo' },
          outdoor: { text: '轻量户外探索', icon: '⛰️', tone: 'outdoor' },
          '户外运动探索': { text: '轻量户外探索', icon: '⛰️', tone: 'outdoor' },
          gaming: { text: '硬核游戏电竞', icon: '🎮', tone: 'gaming' },
          '电子游戏与数码': { text: '电子游戏与数码', icon: '🎮', tone: 'gaming' },
          desk: { text: '工位桌面美学', icon: '🖋️', tone: 'desk' },
          '办公与桌面美学': { text: '工位桌面美学', icon: '🖋️', tone: 'desk' },
          wellness: { text: '居家身心治愈', icon: '🌿', tone: 'wellness' },
          '居家治愈与康养': { text: '居家身心治愈', icon: '🌿', tone: 'wellness' },
          beauty: { text: '生活美学与时尚', icon: '🌸', tone: 'beauty' },
          '生活美学与时尚': { text: '生活美学与时尚', icon: '🌸', tone: 'beauty' },
        }
        if (domainMap[canvas.domain]) {
          badges.push(domainMap[canvas.domain])
        } else {
          badges.push({ text: canvas.domain.slice(0, 8), icon: '🎯', tone: 'domain' })
        }
      }

      // 3. 心意形态与细节
      if (canvas.modality) {
        badges.push({ text: canvas.modality, icon: '🎁', tone: 'sub' })
      } else if (canvas.sub_feature) {
        badges.push({ text: canvas.sub_feature, icon: '🎯', tone: 'sub' })
      }
      if (canvas.focus_detail) {
        badges.push({ text: canvas.focus_detail, icon: '✨', tone: 'detail' })
      }

      // 4. 诉求与风格
      if (canvas.core_need) {
        badges.push({ text: canvas.core_need, icon: '💡', tone: 'need' })
      } else if (canvas.style_tone) {
        badges.push({ text: canvas.style_tone, icon: '🎨', tone: 'style' })
      }

      // 5. 预算
      if (canvas.budget) {
        badges.push({ text: '预算精准锁定', icon: '🎯', tone: 'budget' })
      }

      return badges
    },
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

    /** 🌟 Jev 驱动的 12 维动态心意特质同步与审核入槽 */
    syncDynamicTraits(extractedCandidate = {}, domain = '', suggestedSlots = []) {
      if (!this.dynamic12Traits || this.dynamic12Traits.length !== 12) {
        this.dynamic12Traits = createInitial12Traits()
      }
      // 1. 若识别到品类或模型建议槽位，动态调整 8 维自适应槽位
      if (domain || (Array.isArray(suggestedSlots) && suggestedSlots.length >= 2)) {
        this.dynamic12Traits = morphDynamicTraitsByDomain(this.dynamic12Traits, domain, suggestedSlots)
      }
      // 2. Jev 严格裁决：符合的填入，不符合/模糊的不填
      this.dynamic12Traits = evaluateAndFill12Traits(this.dynamic12Traits, extractedCandidate, this.answers)
      this.persistDraft()
      return this.dynamic12Traits
    },

    pushMessage(msg) {
      const m = { id: uid('msg'), at: Date.now(), ...msg }
      this.messages.push(m)
      return this.messages[this.messages.length - 1]
    },

    updateMessageText(id, newText, isStreaming = true) {
      const target = this.messages.find((m) => m.id === id)
      if (target) {
        target.text = newText
        target.streaming = isStreaming
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

    reset() {
      this.$reset()
      storage.remove(DRAFT_KEY)
    },

    persistDraft() {
      const cleanMessages = this.messages.map((m) => ({
        ...m,
        streaming: false,
      }))

      storage.setJSON(DRAFT_KEY, {
        id: this.id,
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
        messages: (d.messages || []).map((m) => ({ ...m, streaming: false })),
        dynamic12Traits: Array.isArray(d.dynamic12Traits) && d.dynamic12Traits.length === 12
          ? d.dynamic12Traits
          : createInitial12Traits(),
        status: 'asking',
      }
      Object.assign(this, restored)
      return true
    },

    hasDraft() {
      const d = storage.getJSON(DRAFT_KEY, null)
      return Boolean(d?.id && d?.stepIndex > 0)
    },
  },
})
