/**
 * ══════════════════════════════════════════════════════════════
 *  useChatFlow —— 真实逐字流式打字机（Streaming Typewriter）与 AI 导演
 *
 *  核心职责：
 *    1. 用户作答瞬间 0 延迟逐字流式打出高情商懂行点评；
 *    2. MiMo 极速大模型动态追问，文本真实字字蹦出（10~15ms/字），彻底消除枯燥等待感；
 *    3. 稳定不卡顿、文字全部打完后选项气泡弹性出现；
 *    4. 支持随时一键跳过直接出方案（quickFinish）。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { fetchNextDynamicQuestion, INITIAL_STEP } from '@/api/aiQuestionEngine'
import { getLiveReaction } from '@/api/mimoService'

const DONE_TAG = '__done__'
const FINISH_TEXT = '我已经完全听明白了，正在为您定制最具质感的送礼方案 ✨'

export function useChatFlow() {
  const session = useSessionStore()
  const router = useRouter()

  /** AI 是否正在输出/思考中（true 时底部选项面板隐藏，打完后弹性展示） */
  const typing = ref(false)
  let activeRunId = 0
  let isDisposed = false

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function startNewRun() {
    activeRunId += 1
    return activeRunId
  }

  function isRunValid(runId) {
    return runId === activeRunId && !isDisposed
  }

  /**
   * 🌟 真实逐字打字机输出（10~15ms/字，遇标点微顿，真人手感）
   */
  async function streamSingleMessage(fullText, stepId, runId) {
    if (!fullText || typeof fullText !== 'string') return true
    const clean = fullText.trim()
    if (!clean) return true

    // 1. 创建流式消息气泡
    const msg = session.pushMessage({ role: 'ai', text: '', stepId, streaming: true })

    // 2. 逐字流式打入
    const chars = Array.from(clean)
    for (let i = 0; i < chars.length; i++) {
      if (!isRunValid(runId)) break
      msg.text += chars[i]
      const ch = chars[i]
      const isPause = /[,.!?:;，。！？：；\n]/.test(ch)
      await delay(isPause ? 25 : 10)
    }

    msg.streaming = false
    await delay(60)
    return true
  }

  /**
   * 播放一组消息
   */
  async function emitMessages(list, stepId, runId) {
    const raw = Array.isArray(list) ? list : list ? [list] : []
    const msgs = raw.filter((t) => typeof t === 'string' && t.trim())
    for (let i = 0; i < msgs.length; i++) {
      if (!isRunValid(runId)) return false
      await streamSingleMessage(msgs[i], stepId, runId)
      if (i < msgs.length - 1) {
        await delay(120)
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
  async function finish(runId) {
    if (session.messages.some((m) => m.stepId === DONE_TAG)) {
      router.replace('/summary')
      return
    }
    typing.value = true
    await streamSingleMessage(FINISH_TEXT, DONE_TAG, runId)
    typing.value = false
    await delay(500)
    if (!isRunValid(runId)) return
    router.replace('/summary')
  }

  /* ── 推进到下一题（由 AI 动态主导 + 真实逐字流式） ─────── */
  async function advance(lastAnsweredStep = null, lastAnswerValue = null) {
    const runId = startNewRun()
    typing.value = true

    // 🌟 阶段 1：作答后瞬间 0 毫秒逐字流式打出懂行点评（Live Reaction）
    if (lastAnsweredStep) {
      try {
        const reactionText = await getLiveReaction(lastAnsweredStep, lastAnswerValue, session.answers)
        if (isRunValid(runId) && reactionText) {
          await streamSingleMessage(reactionText, `${lastAnsweredStep.id}_reaction`, runId)
          await delay(80)
        }
      } catch (err) {
        console.warn('Reaction error:', err)
      }
    }

    if (session.isFinished) {
      await finish(runId)
      return
    }

    // 🌟 阶段 2：并行拉取/生成下一题
    let nextStep = null
    try {
      const aiResult = await fetchNextDynamicQuestion(session.answers, session.messages, session.stepIndex)
      if (aiResult?.isReady) {
        session.forceFinish()
        await finish(runId)
        return
      }
      nextStep = aiResult
      session.setDynamicStep(nextStep)
    } catch (err) {
      console.warn('AI question fetch error:', err)
      nextStep = session.currentStep
    }

    if (!isRunValid(runId)) return

    // 🌟 阶段 3：逐字流式打印下一题文本
    if (nextStep && nextStep.messages?.length) {
      for (const m of nextStep.messages) {
        if (!isRunValid(runId)) break
        await streamSingleMessage(m, nextStep.id, runId)
        await delay(80)
      }
    }

    // 打字全部结束，放开底部交互面板
    if (isRunValid(runId)) {
      typing.value = false
    }
  }

  /* ── 对外动作 ─────────────────────────────────── */

  function isCurrent(step) {
    return Boolean(step) && !isDisposed && step.id === session.currentStep?.id
  }

  function submit(step, value) {
    if (!isCurrent(step)) return
    session.answer(step, value, displayOf(step, value))
    advance(step, value)
  }

  function skipStep(step) {
    if (!isCurrent(step)) return
    session.skip(step)
    advance(step, '')
  }

  function quickFinish() {
    session.forceFinish()
    const runId = startNewRun()
    finish(runId)
  }

  function goBack() {
    if (isDisposed || session.stepIndex === 0) return []
    startNewRun()
    const prev = session.steps[session.stepIndex - 1]
    const old = prev ? session.answers[prev.key] : undefined
    session.back()
    typing.value = false
    if (Array.isArray(old)) return [...old]
    return old !== undefined && old !== null && old !== '' ? [old] : []
  }

  /* ── 进场 ─────────────────────────────────────── */
  async function boot() {
    if (!session.messages.length && !session.id && session.hasDraft()) {
      session.restoreDraft()
    }
    session.start(false)

    const runId = startNewRun()
    if (session.isFinished) {
      finish(runId)
      return
    }
    const step = session.currentStep || INITIAL_STEP
    if (!step) return

    const asked = session.messages.some((m) => m.role === 'ai' && m.stepId === step.id)
    if (asked) {
      typing.value = false
      return
    }

    typing.value = true
    await emitMessages(step.messages, step.id, runId)
    if (isRunValid(runId)) {
      typing.value = false
    }
  }

  onMounted(boot)
  onUnmounted(() => {
    isDisposed = true
    startNewRun()
    typing.value = false
    if (session.messages.length && !session.isFinished) session.persistDraft()
  })

  function defer(fn, ms) {
    const t = setTimeout(fn, ms)
    return t
  }

  return { typing, submit, skipStep, goBack, quickFinish, defer }
}
