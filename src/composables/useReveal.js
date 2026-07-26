/**
 * ══════════════════════════════════════════════════════════════
 *  useReveal —— 「滚动到了才出现」
 *
 *  给分享页的逐段揭示用：把返回的 el 绑到目标节点，节点进入视口时
 *  visible 变 true，由 CSS 负责淡入上浮。
 *
 *  两条原则：
 *    1. 只做一次 —— 默认 once，出现过就不再消失，回滚不会闪。
 *    2. 宁可直接可见，也不能白屏 —— 拿不到节点、或环境没有
 *       IntersectionObserver（老 WebView），一律立刻置为可见。
 *
 *  observer 在 onUnmounted 里 disconnect，页面离开不留监听。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'

export function useReveal(options = {}) {
  const {
    threshold = 0.12,
    rootMargin = '0px 0px -10% 0px',
    once = true,
    root = null, // Element | () => Element | null（null 表示视口）
  } = options

  const el = ref(null)
  const visible = ref(false)
  let io = null

  function stop() {
    if (io) {
      io.disconnect()
      io = null
    }
  }

  function resolveRoot() {
    const r = typeof root === 'function' ? root() : root
    return r && typeof Element !== 'undefined' && r instanceof Element ? r : null
  }

  function onIntersect(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visible.value = true
        if (once) {
          stop()
          return
        }
      } else if (!once) {
        visible.value = false
      }
    }
  }

  onMounted(() => {
    const node = el.value
    if (!node || typeof IntersectionObserver === 'undefined') {
      visible.value = true
      return
    }
    try {
      io = new IntersectionObserver(onIntersect, {
        root: resolveRoot(),
        threshold,
        rootMargin,
      })
      io.observe(node)
    } catch {
      // 任何环境异常都退回「直接显示」，绝不留一屏空白
      stop()
      visible.value = true
    }
  })

  onUnmounted(stop)

  return { el, visible, stop }
}

export default useReveal
