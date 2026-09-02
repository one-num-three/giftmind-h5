/**
 * ══════════════════════════════════════════════════════════════
 *  useChatFlow —— 拟真真人对话流控制器与流式打字机
 *
 *  核心职责：
 *    1. 作答后 0 延迟秒级响应，告别漫长空白停顿；
 *    2. 拟真真人打字节奏（35ms/字，遇标点呼吸 140ms），字字可见，拒绝暴风骤雨式倾倒；
 *    3. 气泡之间自然衔接（300ms 微顿），像真实朋友在微信对话；
 *    4. 深度 5 步递进式出题，支持右上角随时看方案。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { fetchNextDynamicQuestion, INITIAL_STEP } from '@/api/aiQuestionEngine'
import { getLiveReaction } from '@/api/mimoService'

const DONE_TAG = '__done__'
const FINISH_TEXT = '我已经完全理解了 TA 的喜好细节与你的心意，正在为您定制最具质感的送礼方案 ✨'

export function useChatFlow() {
  const session = useSessionStore()
  const router = useRouter()

  /** 打字机速率模式：'normal'（真人自然节奏 35ms） | 'fast'（极速 18ms） */
  const speedMode = ref(localStorage.getItem('gm_chat_speed') || 'normal')

  function toggleSpeedMode() {
    speedMode.value = speedMode.value === 'normal' ? 'fast' : 'normal'
    localStorage.setItem('gm_chat_speed', speedMode.value)
  }

  /** AI 是否正在输出中 */
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
   * 🌟 真实逐字打字机输出（像真人打字一样字字流出，遇标点自然呼吸停顿）
   */
  async function streamSingleMessage(fullText, stepId, runId) {
    if (!fullText || typeof fullText !== 'string') return true
    const clean = fullText.trim()
    if (!clean) return true

    const isFast = speedMode.value === 'fast'
    const charDelay = isFast ? 18 : 36       // 真人自然打字速度（约 15~20 字/秒）
    const pauseDelay = isFast ? 60 : 150     // 遇标点符号自然停顿呼吸

    // 1. 创建流式消息气泡
    const msg = session.pushMessage({ role: 'ai', text: '', stepId, streaming: true })
    const msgId = msg.id

    // 2. 逐字流式打入
    const chars = Array.from(clean)
    let currentText = ''
    for (let i = 0; i < chars.length; i++) {
      if (!isRunValid(runId)) break
      currentText += chars[i]
      session.updateMessageText(msgId, currentText, true)
      const ch = chars[i]
      const isPause = /[,.!?:;，。！？：；\n]/.test(ch)
      await delay(isPause ? pauseDelay : charDelay)
    }

    session.updateMessageText(msgId, clean, false)
    await delay(isFast ? 120 : 250)
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
        await delay(200)
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
    await delay(350)
    if (!isRunValid(runId)) return
    router.replace('/summary')
  }

  /* ── 推进到下一题（0 延迟秒级衔接 + 真人自然流式） ─────── */
  async function advance(lastAnsweredStep = null, lastAnswerValue = null) {
    const runId = startNewRun()
    typing.value = true

    // 🌟 阶段 1：作答后瞬间 0 毫秒逐字流式打出懂行点评（Live Reaction）
    if (lastAnsweredStep) {
      try {
        const reactionText = await getLiveReaction(lastAnsweredStep, lastAnswerValue, session.answers)
        if (isRunValid(runId) && reactionText) {
          await streamSingleMessage(reactionText, `${lastAnsweredStep.id}_reaction`, runId)
          await delay(280) // 气泡之间的自然微顿
        }
      } catch (err) {
        console.warn('Reaction error:', err)
      }
    }

    if (session.isFinished) {
      await finish(runId)
      return
    }

    // 🌟 阶段 2：获取下一道深度问题
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
        await delay(200)
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
    session.back()
    typing.value = false
    return []
  }

  /* ── 进场 ─────────────────────────────────────── */
  async function boot() {
    if (session.stepIndex === 0) {
      session.start(true)
    } else if (!session.messages.length && session.hasDraft()) {
      session.restoreDraft()
      session.start(false)
    }

    const runId = startNewRun()
    if (session.isFinished) {
      finish(runId)
      return
    }
    const step = session.currentStep || INITIAL_STEP
    if (!step) return

    // 检查当前题是否所有消息都已经完整展示过
    const currentStepMessages = session.messages.filter((m) => m.role === 'ai' && m.stepId === step.id)
    const expectedCount = (step.messages || []).length
    if (currentStepMessages.length >= expectedCount && expectedCount > 0) {
      typing.value = false
      return
    }

    // 清空当前题残余，干净打字输出
    session.messages = session.messages.filter((m) => m.stepId !== step.id)

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

  return { typing, speedMode, toggleSpeedMode, submit, skipStep, goBack, quickFinish, defer }
}
