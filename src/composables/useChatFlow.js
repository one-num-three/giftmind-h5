/**
 * ══════════════════════════════════════════════════════════════
 *  useChatFlow —— 拟真真人对话流控制器与流式打字机
 *
 *  核心职责：
 *    1. 作答后 0 延迟秒级响应，告别漫长空白停顿；
 *    2. 拟真真人打字节奏（35ms/字，遇标点呼吸 140ms），字字可见，拒绝暴风骤雨式倾倒；
 *    3. 气泡之间自然衔接（300ms 微顿），像真实朋友在微信对话；
 *    4. 接续模型自主对话，支持用户随时确认或继续聊。
 * ══════════════════════════════════════════════════════════════
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { fetchNextDynamicQuestion, INITIAL_STEP } from '@/api/aiQuestionEngine'

const DONE_TAG = '__done__'
const FINISH_TEXT = '先一起核对刚才聊到的细节；确认后，我会根据这些线索上网找合适的礼物。'

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
    const charDelay = isFast ? 12 : 22       // 真人自然打字速度（约 25~35 字/秒）
    const pauseDelay = isFast ? 40 : 90      // 遇标点符号自然微顿
    const postDelay = isFast ? 80 : 160

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
    await delay(postDelay)
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
    if (typeof step?.summary === 'function') {
      try {
        const t = step.summary(value)
        if (typeof t === 'string' && t) return t
      } catch {
        // ignore
      }
    }
    // 🌟 核心约束：以用户界面上实际看到的纯净选项文字（label）为准，杜绝将内部冗长描述或脑补句子打入用户气泡
    if (step?.options && Array.isArray(step.options)) {
      if (Array.isArray(value)) {
        const labels = value.map((v) => {
          const found = step.options.find((o) => o.value === v || o.label === v)
          return found?.label || v
        })
        return labels.join('、')
      }
      const found = step.options.find((o) => o.value === value || o.label === value)
      if (found?.label) return found.label
    }
    return undefined
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

  /* ── 推进到下一题（大模型深度主导 + 真实思考打字节奏） ─────── */
  async function advance(lastAnsweredStep = null, lastAnswerValue = null) {
    const runId = startNewRun()
    typing.value = true

    if (session.isFinished) {
      await finish(runId)
      return
    }

    // 🌟 核心：大模型主导！绝不在正常对话中插入死板生硬的模板点评
    // 思考期间自然呈现 3 点打字动效 (TypingDots)，由大模型统一输出高情商承接与专业追问
    let nextStep = null
    try {
      const aiResult = await fetchNextDynamicQuestion(
        session.answers,
        session.messages,
        session.stepIndex
      )
      if (!isRunValid(runId)) return

      // 🌟 后台静默维护 12 维心意特质画像（前端界面不展示，后台与方案生成自适应留存）
      session.syncDynamicTraits(
        aiResult?.extracted_traits || {},
        aiResult?.suggested_domain || '',
        aiResult?.suggested_slots || []
      )

      if (aiResult?.isReady) {
        session.forceFinish()
        await finish(runId)
        return
      }
      nextStep = aiResult
      session.setDynamicStep(nextStep)
    } catch (err) {
      console.error('AI question fetch error:', err)
      if (!isRunValid(runId)) return
      typing.value = false
      const retryStep = {
        id: `retry_step_${Date.now()}`,
        stage: 'preference',
        key: 'retry_action',
        type: 'single',
        messages: ['AI 思考遇到了网络波动，未能成功生成下一轮追问。你可以点击下方重新生成，或直接查看定制方案。'],
        options: [
          { value: '重新生成追问', label: '重新生成追问', emoji: '🔄' },
          { value: '直接查看定制方案', label: '直接查看定制方案', emoji: '✨' },
        ],
        allowCustom: false,
      }
      session.setDynamicStep(retryStep)
      session.pushMessage({
        role: 'ai',
        text: retryStep.messages[0],
        stepId: retryStep.id,
      })
      typing.value = false
      return
    }


    if (!isRunValid(runId)) return

    // 🌟 逐字流式打印大模型生成的承接与追问（messages[0] 为共鸣承接，messages[1] 为深度追问）
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
    if (step.key === 'retry_action') {
      if (value === '直接查看定制方案') {
        quickFinish()
        return
      }
      // 重新生成追问：清空重试题，重新发起深度思考
      advance(step, '')
      return
    }
    const displayText = displayOf(step, value)
    // 显示标题与提交值分别保存，避免短标题覆盖模型提供的完整回答。
    session.answer(step, value, displayText)
    session.syncDynamicTraits()
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
    if (session.stepIndex > 0 && !session.activeDynamicStep) {
      await advance()
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
