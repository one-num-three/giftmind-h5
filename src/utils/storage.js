/**
 * 安全的本地存储
 * Safari 隐私模式、iOS 低存储、被沙箱化的 iframe 里 localStorage 会直接抛异常，
 * 全站统一走这里，任何失败都降级到内存，绝不让页面白屏。
 */
const memory = new Map()

let available = null
function ok() {
  if (available !== null) return available
  try {
    const k = '__gm_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    available = true
  } catch {
    available = false
  }
  return available
}

export const storage = {
  get(key) {
    if (ok()) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        /* fallthrough */
      }
    }
    return memory.has(key) ? memory.get(key) : null
  },
  set(key, value) {
    memory.set(key, value)
    if (!ok()) return false
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
  remove(key) {
    memory.delete(key)
    if (!ok()) return
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  getJSON(key, fallback) {
    const raw = this.get(key)
    if (!raw) return fallback
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  setJSON(key, value) {
    try {
      return this.set(key, JSON.stringify(value))
    } catch {
      return false
    }
  },
}

export default storage
