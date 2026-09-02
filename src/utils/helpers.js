/** 通用小工具 */

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function formatDate(ts, withTime = false) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
  return withTime ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}` : base
}

export function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(ts)
}

export function toArray(v) {
  if (v == null || v === '') return []
  return Array.isArray(v) ? v : [v]
}

export function joinText(v, sep = '、') {
  return toArray(v).join(sep)
}

/** 复制到剪贴板，带降级 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallthrough */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}

/** 稳定伪随机：同样的种子永远得到同样的结果，保证方案可复现 */
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length
  for (let i = 0; i < String(seed).length; i++) {
    h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export function pickN(list, n, rand = Math.random) {
  const pool = [...list]
  const out = []
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return out
}

/** 预算文案 → 数值区间 */
export function parseBudget(text = '') {
  const nums = String(text).match(/\d+/g)?.map(Number) || []
  if (text.includes('不设上限')) return [600, 99999]
  if (nums.length >= 2) return [nums[0], nums[1]]
  if (nums.length === 1) return [nums[0], nums[0] * 3]
  return [0, 99999]
}
