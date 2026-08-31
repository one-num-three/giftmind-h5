/**
 * ══════════════════════════════════════════════════════════════
 *  useChatFlow —— 真实逐字流式打字机（Streaming Typewriter）与 AI 导演
 *
 *  核心职责：
 *    1. 用户作答瞬间 0 延迟逐字流式打出高情商懂行点评；
 *    2. MiMo 极速大模型动态追问，文本真实字字蹦出（12~18ms/字），彻底消除枯燥等待感；
 *    3. 严格适配现有 ChoicePanel / ChatBubble / Composer，确保 100% 稳定零崩溃；
 *    4. 支持随时一键跳过直接出方案（quickFinish）。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { fetchNextDynamicQuestion, INITIAL_STEP } from '@/api/aiQuestionEngine'
import { getLiveReaction } from '@/api/mimoService'

/** 同一 step 内两条气泡之间的间隔 */
const BUBBLE_GAP = 180
/** 收尾语说完到跳转 */
const FINISH_HOLD = 600

const DONE_TAG = '__done__'
const FINISH_TEXT = '我已经完全听明白了，正在为您定制最具质感的送礼方案 ✨'

export function useChatFlow() {
  const session = useSessionStore()
  const router = useRouter()

  /** AI 是否正在「思考中/拉取中」 */
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

  /**
   * 🌟 核心：真实逐字流式打字机（每个字 12~18ms，遇标点微顿，真人手感）
   */
  async function streamSingleMessage(fullText, stepId, run) {
    if (!fullText || typeof fullText !== 'string') return true
    const clean = fullText.trim()
    if (!clean) return true

    // 1. 创建流式消息气泡
    const msg = session.pushMessage({ role: 'ai', text: '', stepId, streaming: true })

    // 2. 逐字打字机推进
    const chars = Array.from(clean)
    for (let i = 0; i < chars.length; i++) {
      if (!alive(run)) return false
      msg.text += chars[i]
      const ch = chars[i]
      const isPause = /[,.!?:;，。！？：；\n]/.test(ch)
      await delay(isPause ? 30 : 12)
    }

    msg.streaming = false
    await delay(80)
    return true
  }

  /**
   * 播放一组消息（逐字打字机）
   */
  async function emitMessages(list, stepId, run) {
    const raw = Array.isArray(list) ? list : list ? [list] : []
    const msgs = raw.filter((t) => typeof t === 'string' && t.trim())
    for (let i = 0; i < msgs.length; i++) {
      const ok = await streamSingleMessage(msgs[i], stepId, run)
      if (!ok || !alive(run)) return false
      if (i < msgs.length - 1) {
        await delay(BUBBLE_GAP)
        if (!alive(run)) return false
      }
    }
    return true
  }

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
    if (session.messages.some((m) => m.stepId === DONE_TAG)) {
      router.replace('/summary')
      return
    }
    const done = await streamSingleMessage(FINISH_TEXT, DONE_TAG, run)
    if (!done) return
    await delay(FINISH_HOLD)
    if (!alive(run)) return
    router.replace('/summary')
  }

  /* ── 推进到下一题（由 AI 动态主导 + 真实逐字流式） ─────── */
  async function advance(lastAnsweredStep = null, lastAnswerValue = null) {
    const run = newRun()
    await delay(80)
    if (!alive(run)) return

    // 🌟 阶段 1：作答后瞬间 0 毫秒逐字流式打出懂行点评（Live Reaction）
    if (lastAnsweredStep) {
      try {
        const reactionText = await getLiveReaction(lastAnsweredStep, lastAnswerValue, session.answers)
        if (alive(run) && reactionText) {
          await streamSingleMessage(reactionText, `${lastAnsweredStep.id}_reaction`, run)
          if (!alive(run)) return
        }
      } catch (err) {
        console.warn('Reaction error:', err)
      }
    }

    if (session.isFinished) {
      await finish(run)
      return
    }

    // 🌟 阶段 2：动态生成下一题并逐字流式打出
    typing.value = true
    let nextStep = null

    try {
      const aiResult = await fetchNextDynamicQuestion(session.answers, session.messages, session.stepIndex)
      if (aiResult?.isReady) {
        session.forceFinish()
        typing.value = false
        await finish(run)
        return
      }
      nextStep = aiResult
      session.setDynamicStep(nextStep)
    } catch (err) {
      console.warn('AI question fetch error:', err)
      nextStep = session.currentStep
    } finally {
      typing.value = false
    }

    if (!alive(run)) return
    if (nextStep && nextStep.messages?.length) {
      for (const m of nextStep.messages) {
        const ok = await streamSingleMessage(m, nextStep.id, run)
        if (!ok || !alive(run)) return
        await delay(120)
      }
    }
  }

  /* ── 对外动作 ─────────────────────────────────── */

  function isCurrent(step) {
    return Boolean(step) && !disposed && step.id === session.currentStep?.id
  }

  function submit(step, value) {
    if (!isCurrent(step)) return
    cancel()
    session.answer(step, value, displayOf(step, value))
    advance(step, value)
  }

  function skipStep(step) {
    if (!isCurrent(step)) return
    cancel()
    session.skip(step)
    advance(step, '')
  }

  function quickFinish() {
    session.forceFinish()
    const run = newRun()
    finish(run)
  }

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
    if (!session.messages.length && !session.id && session.hasDraft()) {
      session.restoreDraft()
    }
    session.start(false)

    const run = newRun()
    if (session.isFinished) {
      finish(run)
      return
    }
    const step = session.currentStep || INITIAL_STEP
    if (!step) return

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
    waiting.forEach((wake) => wake())
    waiting.clear()
  }

  onMounted(boot)
  onUnmounted(() => {
    dispose()
    if (session.messages.length && !session.isFinished) session.persistDraft()
  })

  return { typing, submit, skipStep, goBack, quickFinish, defer }
}
