/**
 * ══════════════════════════════════════════════════════════════
 *  useChatFlow —— 对话页的「导演」
 *
 *  页面只管渲染与转发用户动作，所有节奏都在这里：
 *    · 打字机：先出 TypingDots，停顿后再落气泡；一个 step 的多条
 *      messages 依次连发，中间留呼吸间隔
 *    · 推进：answer / skip 之后隔一拍再问下一题
 *    · 分支：只读 session.steps（已按 when 过滤），不自己判断条件
 *    · 收尾：isFinished 时补一句收尾语，然后去 /generating
 *    · 恢复：store 里已经有消息就直接呈现，不重播动画
 *
 *  取消机制：每次播放拿一个 run 号，任何新动作（作答/返回/卸载）
 *  都会让旧 run 失效，异步链在下一个检查点自行退出，
 *  不会在页面离开后继续 push 消息。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

/** 一条气泡出现前的「正在输入」时长区间 */
const TYPING_MIN = 600
const TYPING_MAX = 900
/** 同一 step 内两条气泡之间的间隔 */
const BUBBLE_GAP = 300
/** 用户作答后到下一题开口 */
const AFTER_ANSWER = 500
/** 收尾语说完到跳转 */
const FINISH_HOLD = 900

const DONE_TAG = '__done__'
const FINISH_TEXT = '我已经完全听明白了，给我几秒钟。'

export function useChatFlow() {
  const session = useSessionStore()
  const router = useRouter()

  /** AI 是否正在「输入中」 */
  const typing = ref(false)

  const timers = new Set()
  const waiting = new Set()
  let seq = 0
  let disposed = false

  /* ── 定时器：统一登记，统一清理 ───────────────── */
  function defer(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t)
      if (!disposed) fn()
    }, ms)
    timers.add(t)
    return t
  }

  function delay(ms) {
    return new Promise((resolve) => {
      const done = () => {
        timers.delete(t)
        waiting.delete(done)
        resolve()
      }
      const t = setTimeout(done, ms)
      timers.add(t)
      waiting.add(done)
    })
  }

  /* ── run 令牌：让旧的播放链安静退场 ───────────── */
  function cancel() {
    seq += 1
    typing.value = false
  }
  function newRun() {
    cancel()
    return seq
  }
  function alive(run) {
    return run === seq && !disposed
  }

  /** 文案越长，"打字"越久，但始终落在 600–900ms 之间 */
  function typingDuration(text) {
    return Math.min(TYPING_MAX, TYPING_MIN + String(text || '').length * 10)
  }

  /**
   * 依次播放一组 AI 气泡
   * @returns {Promise<boolean>} 是否完整播完（被取消则 false）
   */
  async function emitMessages(list, stepId, run) {
    // 剧本是可配置资产，这里对形状做一次兜底
    const raw = Array.isArray(list) ? list : list ? [list] : []
    const msgs = raw.filter((t) => typeof t === 'string' && t.trim())
    for (let i = 0; i < msgs.length; i++) {
      typing.value = true
      await delay(typingDuration(msgs[i]))
      if (!alive(run)) return false

      typing.value = false
      session.pushMessage({ role: 'ai', text: msgs[i], stepId })

      if (i < msgs.length - 1) {
        await delay(BUBBLE_GAP)
        if (!alive(run)) return false
      }
    }
    return true
  }

  /** step.summary 允许自定义气泡里的展示文案；出错就退回 store 默认 */
  function displayOf(step, value) {
    if (typeof step?.summary !== 'function') return undefined
    try {
      const t = step.summary(value)
      return typeof t === 'string' && t ? t : undefined
    } catch {
      return undefined
    }
  }

  /* ── 收尾 ─────────────────────────────────────── */
  async function finish(run) {
    // 已经说过收尾语（比如返回后又进来）就直接走
    if (session.messages.some((m) => m.stepId === DONE_TAG)) {
      router.replace('/summary')
      return
    }
    const done = await emitMessages([FINISH_TEXT], DONE_TAG, run)
    if (!done) return
    await delay(FINISH_HOLD)
    if (!alive(run)) return
    router.replace('/summary')
  }

  /* ── 推进到下一题 ─────────────────────────────── */
  async function advance() {
    const run = newRun()
    await delay(AFTER_ANSWER)
    if (!alive(run)) return

    if (session.isFinished) {
      await finish(run)
      return
    }
    const step = session.currentStep
    if (!step) return
    await emitMessages(step.messages, step.id, run)
  }

  /* ── 对外动作 ─────────────────────────────────── */

  /** 只接受「当前这一题」的提交，挡住连点造成的重复推进 */
  function isCurrent(step) {
    return Boolean(step) && !disposed && step.id === session.currentStep?.id
  }

  /** 提交一步的答案（value 可以是字符串或数组） */
  function submit(step, value) {
    if (!isCurrent(step)) return
    cancel()
    session.answer(step, value, displayOf(step, value))
    advance()
  }

  /** 跳过当前题 */
  function skipStep(step) {
    if (!isCurrent(step)) return
    cancel()
    session.skip(step)
    advance()
  }

  /**
   * 回到上一题重答：store 会把该题之后的消息一并抹掉
   * @returns {string[]} 上一题原来的答案，交给页面回填选中态
   */
  function goBack() {
    if (disposed || session.stepIndex === 0) return []
    cancel()
    const prev = session.steps[session.stepIndex - 1]
    const old = prev ? session.answers[prev.key] : undefined
    session.back()
    if (Array.isArray(old)) return [...old]
    return old !== undefined && old !== null && old !== '' ? [old] : []
  }

  /* ── 进场 ─────────────────────────────────────── */
  function boot() {
    // 刷新后内存里空了，但本地还留着草稿 —— 接着聊
    if (!session.messages.length && !session.id && session.hasDraft()) {
      session.restoreDraft()
    }
    // 已有会话则原样保留，全新才开一局
    session.start(false)

    const run = newRun()
    if (session.isFinished) {
      finish(run)
      return
    }
    const step = session.currentStep
    if (!step) return

    // 这一题的提问已经在消息里了 —— 恢复场景，直接呈现不重播
    const asked = session.messages.some((m) => m.role === 'ai' && m.stepId === step.id)
    if (asked) return

    emitMessages(step.messages, step.id, run)
  }

  function dispose() {
    disposed = true
    seq += 1
    typing.value = false
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
    // 唤醒还挂在 await 上的播放链，让它们在检查点自行退出
    waiting.forEach((wake) => wake())
    waiting.clear()
  }

  onMounted(boot)
  onUnmounted(() => {
    dispose()
    // 中途离开也别丢进度
    if (session.messages.length && !session.isFinished) session.persistDraft()
  })

  return { typing, submit, skipStep, goBack, defer }
}
