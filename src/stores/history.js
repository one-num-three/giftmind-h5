/**
 * 我的方案 —— 本地持久化（换后端时把 load/save 换成接口即可）
 */
import { defineStore } from 'pinia'
import storage from '@/utils/storage'

const KEY = 'gm_plans'

/** ← 接后端时，把这两个函数换成接口调用即可，其余代码不用动 */
function read() {
  const list = storage.getJSON(KEY, [])
  return Array.isArray(list) ? list : []
}
function write(list) {
  storage.setJSON(KEY, list)
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    plans: read(),
    keyword: '',
  }),

  getters: {
    sorted: (s) => [...s.plans].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    filtered() {
      const kw = this.keyword.trim()
      if (!kw) return this.sorted
      return this.sorted.filter((p) =>
        [p.title, p.answers?.recipient, p.answers?.occasion, p.answers?.memory]
          .filter(Boolean)
          .join(' ')
          .includes(kw),
      )
    },
    count: (s) => s.plans.length,
  },

  actions: {
    save(plan) {
      const i = this.plans.findIndex((p) => p.id === plan.id)
      if (i >= 0) this.plans.splice(i, 1, { ...plan })
      else this.plans.unshift({ ...plan })
      write(this.plans)
    },
    remove(id) {
      this.plans = this.plans.filter((p) => p.id !== id)
      write(this.plans)
    },
    get(id) {
      return this.plans.find((p) => p.id === id) || null
    },
    reload() {
      this.plans = read()
    },
    clearAll() {
      this.plans = []
      write([])
    },
  },
})
