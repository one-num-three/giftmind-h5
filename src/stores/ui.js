/** 全局轻交互：Toast / 遮罩加载 */
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    toast: null, // { text, type }
    loading: false,
    loadingText: '',
  }),
  actions: {
    showToast(text, type = 'default', duration = 1800) {
      this.toast = { text, type, id: Date.now() }
      clearTimeout(this._t)
      this._t = setTimeout(() => (this.toast = null), duration)
    },
    success(text) {
      this.showToast(text, 'success')
    },
    error(text) {
      this.showToast(text, 'error')
    },
    setLoading(v, text = '') {
      this.loading = v
      this.loadingText = text
    },
  },
})
