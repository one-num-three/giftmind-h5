/**
 * 我的方案 —— 后端 SQLite 为主存储，localStorage 做离线兜底与首屏缓存。
 *
 * 读：ensureLoaded/reload 优先后端列表，后端挂了读本地缓存（页面照常能用）；
 * 写：本地立即生效（乐观更新）+ 异步串行落库，本地 id 先创建换后端 id 再更新。
 * 方案 id 一律改用后端 id（UUID）；判断标准 BACKEND_ID_RE。
 */
import { defineStore } from 'pinia'
import storage from '@/utils/storage'
import { plansApi, projectsApi } from '@/api/projects'
import { useSessionStore } from './session'

const KEY = 'gm_plans'
const BACKEND_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 同一方案的落库请求串成链：最新状态一定最后写入，不互相覆盖 */
const pendingSaves = new Map()

function readLocal() {
  const list = storage.getJSON(KEY, [])
  return Array.isArray(list) ? list : []
}

function writeLocal(list) {
  storage.setJSON(KEY, list)
}

/** 后端方案记录 → 前端方案对象（plan JSON 展平，id 直接用后端 id） */
function fromRecord(record) {
  if (!record || typeof record !== 'object') return null
  const plan = record.plan && typeof record.plan === 'object' ? record.plan : {}
  return {
    ...plan,
    id: record.id,
    projectId: record.projectId || '',
    answers: record.answers && typeof record.answers === 'object' ? record.answers : {},
    createdAt: record.createdAt ? new Date(record.createdAt).getTime() : Date.now(),
    updatedAt: record.updatedAt ? new Date(record.updatedAt).getTime() : Date.now(),
  }
}

/** 前端方案 → 后端入参（剥离本地字段，plan 体单独装） */
function toPayload(plan) {
  const { id, projectId, createdAt, updatedAt, answers, ...rest } = plan || {}
  return {
    title: (typeof plan?.title === 'string' && plan.title.trim()) || '未命名方案',
    plan: rest,
    answers: answers || {},
  }
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    plans: readLocal(), // 先用缓存顶上，reload 后换成后端数据
    keyword: '',
    loaded: false,
    backendOk: true,
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
    /** 页面进来时调一次：只拉取一回，重复进入不重复请求 */
    async ensureLoaded() {
      if (!this.loaded) await this.reload()
    },

    async reload() {
      try {
        const records = await plansApi.list()
        this.plans = (Array.isArray(records) ? records : []).map(fromRecord).filter(Boolean)
        this.backendOk = true
      } catch {
        // 后端不在：回退本地缓存，功能照常
        this.backendOk = false
        this.plans = readLocal()
      }
      this.loaded = true
      writeLocal(this.plans)
    },

    /**
     * 保存/更新一份方案。本地立即生效；后端异步落库（静默失败不打扰流程）。
     * localOnly：演示数据等只进本地的场景用。
     */
    save(plan, { localOnly = false } = {}) {
      if (!plan || !plan.id) return
      const snapshot = JSON.parse(JSON.stringify(plan))
      const i = this.plans.findIndex((p) => p.id === plan.id)
      if (i >= 0) this.plans.splice(i, 1, snapshot)
      else this.plans.unshift(snapshot)
      writeLocal(this.plans)
      if (localOnly || !this.backendOk) return
      this._syncPlan(plan)
    },

    _syncPlan(plan) {
      const key = plan.id
      const prev = pendingSaves.get(key) || Promise.resolve()
      const next = prev
        .catch(() => {})
        .then(async () => {
          const projectId = plan.projectId || useSessionStore().currentProjectId
          if (!projectId) return
          const payload = toPayload(plan)
          if (BACKEND_ID_RE.test(plan.id)) {
            // 已有后端记录：直接更新快照
            await plansApi.update(plan.id, payload)
            return
          }
          // 本地 id 第一次落库：创建后把后端 id 回填给调用方（planStore.current 同一引用）
          const record = await projectsApi.savePlan(projectId, payload)
          if (record?.id) {
            plan.id = record.id
            plan.projectId = record.projectId || projectId
            const idx = this.plans.findIndex((p) => p.id === key)
            if (idx >= 0) {
              this.plans[idx] = JSON.parse(JSON.stringify(plan))
              writeLocal(this.plans)
            }
          }
        })
        .catch(() => {})
      pendingSaves.set(key, next)
    },

    remove(id) {
      this.plans = this.plans.filter((p) => p.id !== id)
      writeLocal(this.plans)
      // 只删后端确实有的；本地 id 没有对应记录
      if (BACKEND_ID_RE.test(id)) plansApi.remove(id).catch(() => {})
    },

    get(id) {
      return this.plans.find((p) => p.id === id) || null
    },

    async clearAll() {
      const backendIds = this.plans.map((p) => p.id).filter((x) => BACKEND_ID_RE.test(x))
      this.plans = []
      writeLocal([])
      await Promise.allSettled(backendIds.map((x) => plansApi.remove(x)))
    },
  },
})
