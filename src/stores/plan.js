/** 方案 Store：服务状态、完整方案替换、专项 AI 编辑与本地持久化。 */
import { defineStore } from 'pinia'
import api from '@/api'
import { useHistoryStore } from './history'
import { uid } from '@/utils/helpers'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function giftId(gift) {
  return gift?.catalogId || gift?.id || ''
}

function giftSelectionId(gift) {
  const id = giftId(gift)
  if (id) return id
  const name = typeof gift?.name === 'string' ? gift.name.trim() : ''
  return name ? `legacy:${name}` : ''
}

function deliveryHeading(plan, giftName) {
  const recipient = typeof plan?.answers?.recipient === 'string'
    ? plan.answers.recipient.trim()
    : ''
  const recipientLabel = recipient && !/[\/、]/.test(recipient) ? recipient : ''
  return {
    title: recipientLabel
      ? `给${recipientLabel}的「${giftName}」送出方案`
      : `给 TA 的「${giftName}」送出方案`,
    subtitle: '已按你最终选中的礼物，重新整理心意表达与送出步骤',
  }
}

function friendlyError(error) {
  const code = error?.code
  if (code === 'NETWORK') return '本地策划服务没有启动，请先运行 FastAPI（127.0.0.1:8000）'
  if (code === 'TIMEOUT') return 'DeepSeek 响应超时了，可以稍后重试；你的回答仍然保留着'
  if (code === 'AI_AUTH_FAILED') return 'DeepSeek Key 无效，请到 Data Studio 的 .env 检查配置'
  if (code === 'AI_BALANCE_INSUFFICIENT') return 'DeepSeek 额度不足，请充值后再试'
  if (code === 'RATE_LIMITED') return '模型请求太频繁，请等一会再试'
  if (code === 'NO_CANDIDATES') return '当前礼物库里没有同时满足预算、时间和禁忌的候选，请放宽一个条件'
  if (code === 'EMPTY_CATALOG') return '礼物库还没有可推荐的 active 数据，请先在 Data Studio 启用礼物'
  return error?.message || '生成失败，请重试'
}

export function normalizeGenerationIssue(error) {
  if (error?.code !== 'NO_CANDIDATES') return null
  const detail = error?.payload?.detail
  if (!detail || typeof detail !== 'object') return null
  const list = (value) => (
    Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []
  )
  return {
    code: 'NO_CANDIDATES',
    message: typeof detail.message === 'string' ? detail.message : friendlyError(error),
    eligibleCount: Number(detail.eligibleCount || 0),
    kindCounts: detail.kindCounts && typeof detail.kindCounts === 'object' ? clone(detail.kindCounts) : {},
    catalogKindCounts:
      detail.catalogKindCounts && typeof detail.catalogKindCounts === 'object'
        ? clone(detail.catalogKindCounts)
        : {},
    missingKinds: list(detail.missingKinds),
    causes: list(detail.causes),
    recoveryOptions: list(detail.recoveryOptions),
    editSuggestions: list(detail.editSuggestions),
    questions: Array.isArray(detail.questions) ? detail.questions.map(String).filter(Boolean) : [],
  }
}

export const usePlanStore = defineStore('plan', {
  state: () => ({
    current: null,
    generating: false,
    editing: false,
    selectingGiftId: '',
    progressStage: null,
    error: '',
    generationIssue: null,
    serviceStatus: null,
    likedGiftIds: [],
    lockedGiftIds: [],
    replies: [],
  }),

  getters: {
    hasPlan: (state) => Boolean(state.current),
    gifts: (state) => state.current?.gifts || [],
    letter: (state) => state.current?.letter || null,
    ritual: (state) => state.current?.ritual || [],
  },

  actions: {
    async refreshServiceStatus() {
      try {
        this.serviceStatus = await api.getServiceStatus()
      } catch (error) {
        this.serviceStatus = {
          ok: false,
          state: 'unavailable',
          deepseekConfigured: false,
          model: '',
          activeGiftCount: 0,
          error: friendlyError(error),
        }
      }
      return this.serviceStatus
    },

    replaceCurrent(patch, { save = true } = {}) {
      if (!this.current) return null
      const previous = this.current
      const payload = patch?.plan && typeof patch.plan === 'object' ? patch.plan : patch
      this.current = {
        ...clone(previous),
        ...(payload && typeof payload === 'object' ? clone(payload) : {}),
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt: Date.now(),
        // 用户输入永远以本地原始回答为准，AI 返回值不能覆盖。
        answers: clone(previous.answers || {}),
      }
      if (save) useHistoryStore().save(this.current)
      return this.current
    },

    async generate(answers) {
      this.generating = true
      this.error = ''
      this.generationIssue = null
      this.progressStage = null
      await this.refreshServiceStatus()
      try {
        const plan = await api.generatePlan(answers, {
          onProgress: (stage) => {
            this.progressStage = stage
          },
        })
        this.current = {
          ...clone(plan),
          id: uid('plan'),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          answers: clone(answers || {}),
        }
        this.lockedGiftIds = []
        this.likedGiftIds = []
        useHistoryStore().save(this.current)
        return this.current
      } catch (error) {
        this.error = friendlyError(error)
        this.generationIssue = normalizeGenerationIssue(error)
        throw error
      } finally {
        this.generating = false
        this.progressStage = null
      }
    },

    async replaceGift(targetId, { reason = 'other', reasonNote = '' } = {}) {
      if (!this.current || !targetId) return null
      this.editing = true
      try {
        const result = await api.replaceGift(clone(this.current), {
          targetId,
          reason,
          reasonNote,
          lockedIds: [...this.lockedGiftIds],
        })
        if (result?.plan || Array.isArray(result?.gifts)) return this.replaceCurrent(result)

        const gift = result?.gift || result?.replacement || result
        if (!gift || typeof gift !== 'object') throw new Error('服务没有返回替代礼物')
        const gifts = this.gifts.map((item) => (giftId(item) === targetId ? clone(gift) : clone(item)))
        const recommendationGroups = Array.isArray(this.current.recommendationGroups)
          ? this.current.recommendationGroups.map((group) => ({
              ...clone(group),
              candidates: Array.isArray(group?.candidates)
                ? group.candidates.map((item) => {
                    if (giftId(item) !== targetId) return clone(item)
                    const dimension = group.key || item.rankingDimension || 'recommendation'
                    return {
                      ...clone(gift),
                      rankingDimension: dimension,
                      rankingLabel: group.title || item.rankingLabel,
                      rankingRank: item.rankingRank || item.rank,
                      rankingScore: gift.dimensionScores?.[dimension] ?? gift.matchScore,
                      awards: [group.title || item.rankingLabel].filter(Boolean),
                    }
                  })
                : [],
            }))
          : undefined
        this.replaceCurrent({ gifts, ...(recommendationGroups ? { recommendationGroups } : {}) })
        return gift
      } finally {
        this.editing = false
      }
    },

    async shuffleGifts() {
      if (!this.current) return
      const exclude = this.current.gifts.map(giftId).filter(Boolean)
      const result = await api.shuffleGifts(this.current.id, {
        exclude,
        answers: this.current.answers,
        currentPlan: clone(this.current),
      })
      if (Array.isArray(result)) this.replaceCurrent({ gifts: result })
      else this.replaceCurrent(result)
    },

    async regenerateLetter(tone, instruction = '') {
      if (!this.current) return null
      this.editing = true
      try {
        const result = await api.regenerateLetter(clone(this.current), { tone, instruction })
        const letter = result?.letter || result
        if (!letter || typeof letter !== 'object') throw new Error('服务没有返回新的信件')
        this.replaceCurrent({ letter })
        return letter
      } finally {
        this.editing = false
      }
    },

    async rewriteRitual(instruction = '') {
      if (!this.current) return null
      this.editing = true
      try {
        const result = await api.rewriteRitual(clone(this.current), { instruction })
        const ritual = Array.isArray(result) ? result : result?.ritual
        if (!Array.isArray(ritual)) throw new Error('服务没有返回新的仪式流程')
        this.replaceCurrent({ ritual })
        return ritual
      } finally {
        this.editing = false
      }
    },

    async selectGift(gift) {
      const id = giftSelectionId(gift)
      if (!this.current || !id || this.selectingGiftId) return null
      const selectedGift = clone(gift)
      if (!giftId(selectedGift)) selectedGift.catalogId = id
      this.selectingGiftId = id
      this.error = ''
      try {
        const result = await api.composeDelivery(clone(this.current), selectedGift)
        if (!result?.letter || !Array.isArray(result?.ritual)) {
          throw new Error('服务没有返回完整的送出方案')
        }
        const selectedGiftName = String(result.selectedGiftName || selectedGift.name || '这份礼物').trim()
        const selectedGiftEmoji = String(selectedGift.emoji || '').trim()
        const heading = deliveryHeading(this.current, selectedGiftName)
        this.replaceCurrent({
          recommendationTitle: this.current.recommendationTitle || this.current.title || '',
          recommendationSubtitle: this.current.recommendationSubtitle || this.current.subtitle || '',
          title: heading.title,
          subtitle: heading.subtitle,
          selectedGiftId: id,
          selectedGift,
          share: {
            ...(this.current.share && typeof this.current.share === 'object'
              ? clone(this.current.share)
              : {}),
            ...(selectedGiftEmoji ? { coverEmoji: selectedGiftEmoji } : {}),
          },
          letter: clone(result.letter),
          ritual: clone(result.ritual),
          deliverySource: result.source || '',
          deliveryModel: result.model || '',
          deliveryPromptVersion: result.promptVersion || '',
        })
        return result
      } catch (error) {
        this.error = friendlyError(error)
        throw error
      } finally {
        this.selectingGiftId = ''
      }
    },

    toggleLike(id) {
      const index = this.likedGiftIds.indexOf(id)
      if (index >= 0) this.likedGiftIds.splice(index, 1)
      else this.likedGiftIds.push(id)
    },

    toggleLock(id) {
      const index = this.lockedGiftIds.indexOf(id)
      if (index >= 0) this.lockedGiftIds.splice(index, 1)
      else this.lockedGiftIds.push(id)
    },

    clearGenerationError() {
      this.error = ''
      this.generationIssue = null
    },

    async loadReplies() {
      this.replies = this.current?.id ? await api.fetchShareReplies({ planId: this.current.id }) : []
      return this.replies
    },

    setCurrent(plan) {
      this.current = plan ? clone(plan) : null
      this.selectingGiftId = ''
      this.loadReplies()
    },

    touch() {
      if (!this.current) return
      this.current = { ...clone(this.current), updatedAt: Date.now() }
      useHistoryStore().save(this.current)
    },

    clear() {
      this.current = null
      this.error = ''
      this.generationIssue = null
      this.selectingGiftId = ''
      this.likedGiftIds = []
      this.lockedGiftIds = []
      this.replies = []
    },
  },
})
