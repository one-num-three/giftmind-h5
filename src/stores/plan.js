/**
 * 方案 Store —— 生成中状态 + 当前方案 + 收藏/替换等操作
 */
import { defineStore } from 'pinia'
import api from '@/api'
import { useHistoryStore } from './history'
import { uid } from '@/utils/helpers'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    current: null,
    generating: false,
    progressStage: null, // { key, label, hint, duration }
    error: '',
    likedGiftIds: [],
  }),

  getters: {
    hasPlan: (s) => Boolean(s.current),
    gifts: (s) => s.current?.gifts || [],
    letter: (s) => s.current?.letter || null,
    ritual: (s) => s.current?.ritual || [],
  },

  actions: {
    async generate(answers) {
      this.generating = true
      this.error = ''
      this.progressStage = null
      try {
        const plan = await api.generatePlan(answers, {
          onProgress: (stage) => {
            this.progressStage = stage
          },
        })
        this.current = {
          id: uid('plan'),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          answers,
          ...plan,
        }
        useHistoryStore().save(this.current)
        return this.current
      } catch (e) {
        this.error = e?.message || '生成失败，请重试'
        throw e
      } finally {
        this.generating = false
        this.progressStage = null
      }
    },

    async shuffleGifts() {
      if (!this.current) return
      const exclude = this.current.gifts.map((g) => g.id)
      const gifts = await api.shuffleGifts(this.current.id, {
        exclude,
        answers: this.current.answers,
      })
      this.current.gifts = gifts
      this.touch()
    },

    async regenerateLetter(tone) {
      if (!this.current) return
      const letter = await api.regenerateLetter(this.current.id, {
        tone,
        answers: this.current.answers,
      })
      this.current.letter = letter
      this.touch()
    },

    toggleLike(giftId) {
      const i = this.likedGiftIds.indexOf(giftId)
      if (i >= 0) this.likedGiftIds.splice(i, 1)
      else this.likedGiftIds.push(giftId)
    },

    setCurrent(plan) {
      this.current = plan
    },

    touch() {
      if (!this.current) return
      this.current.updatedAt = Date.now()
      useHistoryStore().save(this.current)
    },

    clear() {
      this.current = null
      this.error = ''
      this.likedGiftIds = []
    },
  },
})
