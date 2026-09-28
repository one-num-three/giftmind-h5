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
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { projectsApi } from '@/api/projects'
import { fetchNextDynamicQuestion, INITIAL_STEP, explainOptionsForStep, EXPLAIN_OPTION_VALUE } from '@/api/aiQuestionEngine'
import { agentChat, agentNextQuestion, AGENT_GREETING } from '@/api/agentEngine'

const DONE_TAG = '__done__'
const FINISH_TEXT = '先一起核对刚才聊到的细节；确认后，我会根据这些线索上网找合适的礼物。'

export function useChatFlow() {
  const session = useSessionStore()
  const route = useRoute()
  const router = useRouter()

  /** 打字机速率模式：'normal'（真人自然节奏 35ms） | 'fast'（极速 18ms） */
  const speedMode = ref(localStorage.getItem('gm_chat_speed') || 'normal')

  function toggleSpeedMode() {
    speedMode.value = speedMode.value === 'normal' ? 'fast' : 'normal'
    localStorage.setItem('gm_chat_speed', speedMode.value)
  }

  /** 提问节奏模式：'normal'（细致深挖） | 'fast'（用户点了"快点问"，只问关键项、尽快收敛） */
  const paceMode = ref(localStorage.getItem('gm_chat_pace') || 'normal')

  function togglePaceMode() {
    paceMode.value = paceMode.value === 'normal' ? 'fast' : 'normal'
    localStorage.setItem('gm_chat_pace', paceMode.value)
  }

  /** AI 是否正在输出中 */
  const typing = ref(false)
  /** Agent 闲聊模式：当前可点的方向建议（模型随缘给，发送后清空） */
  const agentChips = ref([])
  /** 点过「生成方案」后进入出题补全阶段：期间用户每答一句都自动出下一道题，直到信息收齐 */
  const planPending = ref(false)
  /** 上一轮题目要补进的画像槽位（用户回答后回写 answers；内存态，刷新丢失不碍事——模型读对话历史能感知答案） */
  let pendingSlotKey = ''
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

  /* ── Agent 闲聊模式（二期：自由聊攒画像，用户点按钮才出方案） ── */

  /** 进场：无历史播固定开场白（会落库）；有历史纯展示——
   *  但若最后停在用户消息（或半个没打完的 AI 空气泡）上，说明上一轮 AI 在思考/打字途中被退出动作丢掉了，补接一轮 */
  async function agentBoot() {
    const runId = startNewRun()
    if (!session.messages.length) {
      typing.value = true
      await streamSingleMessage(AGENT_GREETING, '__agent__', runId)
      if (isRunValid(runId)) typing.value = false
      return
    }
    const lastMsg = session.messages[session.messages.length - 1]
    const dangling =
      (lastMsg.role === 'user' && !lastMsg.muted) ||
      (lastMsg.role === 'ai' && !String(lastMsg.text || '').trim())
    if (!dangling) return
    dropTrailingEmptyAiBubbles()
    typing.value = true
    await agentRespond(runId)
    if (isRunValid(runId)) typing.value = false
  }

  /** 丢掉末尾没打完的 AI 空气泡（它们从未落库，留着只会挡住恢复判断） */
  function dropTrailingEmptyAiBubbles() {
    while (session.messages.length) {
      const last = session.messages[session.messages.length - 1]
      if (last.role !== 'ai' || String(last.text || '').trim()) break
      session.messages.pop()
    }
  }

  /** 闲聊一轮的 AI 半边：接话 → 提炼槽位 → 打字播出 → 随缘 chips。
   *  agentSend 正常调用；用户「AI 思考/打字途中退出再回来」时由 agentBoot 补调，把没接住的那半轮接上 */
  async function agentRespond(runId) {
    try {
      const result = await agentChat({ messages: session.messages, answers: session.answers })
      if (!isRunValid(runId)) return false
      session.mergeAgentSlots(result?.slots)
      await streamSingleMessage(result?.reply, '__agent__', runId)
      if (isRunValid(runId)) agentChips.value = result?.chips || []
      return true
    } catch (err) {
      console.error('Agent chat error:', err)
      if (isRunValid(runId)) {
        await streamSingleMessage('刚才网络抖了一下，你接着说～', '__agent__', runId)
      }
      return false
    }
  }

  /**
   * 出题补全的核心一步：让 LLM 自检还缺什么——
   * 收齐（且预算在位）→ 收口或直通生成；没齐 → 播题 + 给可点选项。
   * directOnDone=true 用于点按钮的当轮：信息本来就齐就直接进 /generating，省一次重复点击。
   */
  async function askNextQuestion(runId, directOnDone = false) {
    const next = await agentNextQuestion({ answers: session.answers, messages: session.messages })
    if (!isRunValid(runId)) return false
    if (!next) {
      // 解析/调用失败：按预算缺口播兜底追问，不让对话断线
      const missingBudget = !session.answers?.budget
      pendingSlotKey = missingBudget ? 'budget' : ''
      await streamSingleMessage(
        missingBudget ? '预算大概定在多少呀？定了我就能开工。' : 'TA 还有什么没聊到的偏好吗？',
        '__agent__',
        runId
      )
      return true
    }
    if (next.done) {
      if (session.answers?.budget) {
        planPending.value = false
        if (directOnDone) {
          await streamSingleMessage('好嘞，信息够了～我这就给你做方案，稍等几秒。', '__agent__', runId)
          if (!isRunValid(runId)) return false
          typing.value = false
          router.push('/generating')
          return true
        }
        // 追询途中变齐：明确收口，绝不走闲聊接话（闲聊不带问号的规矩会抹掉收敛信号，两次实测卡死在这）
        await streamSingleMessage(
          '好嘞，信息够了～想生成的时候点右上角的 🎁 就行，想再补充什么也可以继续聊。',
          '__agent__',
          runId
        )
      } else {
        // 模型说齐了但预算缺失——硬下限不许放行（预算不可缺席）
        pendingSlotKey = 'budget'
        await streamSingleMessage('最后确认一下：这次预算大概多少呀？定了我就能开工。', '__agent__', runId)
      }
      return true
    }
    pendingSlotKey = next.slotKey
    await streamSingleMessage(next.question, '__agent__', runId)
    if (isRunValid(runId)) agentChips.value = next.options
    return true
  }

  async function agentSend(text) {
    const clean = typeof text === 'string' ? text.trim() : ''
    if (!clean || isDisposed) return false
    const runId = startNewRun()
    session.pushMessage({ role: 'user', text: clean, stepId: '__agent__' })
    agentChips.value = []
    typing.value = true
    try {
      // 🌟 出题补全阶段：先把这轮回答写进画像槽位（上一轮题目预告过 slot_key），再出下一道题
      if (planPending.value) {
        if (pendingSlotKey) {
          session.mergeAgentSlots({ [pendingSlotKey]: clean })
          pendingSlotKey = ''
        }
        await askNextQuestion(runId)
      } else {
        await agentRespond(runId)
      }
    } catch (err) {
      console.error('Agent send error:', err)
      if (isRunValid(runId)) await agentRespond(runId)
    } finally {
      if (isRunValid(runId)) typing.value = false
    }
    return true
  }

  /**
   * 用户点「生成方案」：muted 记一条用户意图 → 进入出题补全阶段。
   * 信息本来就齐 → 预告后直接进 /generating（白嫖问答模式整条生成+保存链路）；
   * 不齐 → 播第一道题，此后用户每答一句自动出下一道，直到收齐收口。
   */
  async function requestPlan() {
    if (isDisposed || typing.value) return false
    const runId = startNewRun()
    typing.value = true
    agentChips.value = []
    session.pushMessage({ role: 'user', text: '生成方案', stepId: '__agent__', muted: true })
    try {
      planPending.value = true
      await askNextQuestion(runId, true)
    } catch (err) {
      console.error('Plan interrogation error:', err)
      if (isRunValid(runId)) {
        const missingBudget = !session.answers?.budget
        pendingSlotKey = missingBudget ? 'budget' : ''
        await streamSingleMessage(
          missingBudget ? '预算大概定在多少呀？定了我就能开工。' : 'TA 还有什么没聊到的偏好吗？',
          '__agent__',
          runId
        )
      }
    } finally {
      if (isRunValid(runId)) typing.value = false
    }
    return true
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
        session.stepIndex,
        [],
        session.answerSteps,
        paceMode.value
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

  /**
   * 💡 "讲讲区别"：不提交答案、不推进题目。
   * 用户气泡以 muted 记入对话历史（后续出题模型看到"问过区别"不会重复讲），
   * 讲解文本打字机输出后原题选项原样回来，用户接着选。
   */
  async function explainChoice(step) {
    const runId = startNewRun()
    session.pushMessage({ role: 'user', text: '讲讲区别', stepId: step.id, muted: true })
    typing.value = true
    try {
      const text = await explainOptionsForStep(step, session.answers)
      if (!isRunValid(runId)) return
      const content = text || '这几个选项的区别说来话长，你可以先凭感觉选一个，或者直接输入你更具体的想法，我按你的来。'
      await streamSingleMessage(content, step.id, runId)
    } catch (err) {
      console.error('Explain options error:', err)
      if (isRunValid(runId)) {
        await streamSingleMessage('刚才网络有点波动，没讲成。你可以直接选一个，或者点"其他"输入你的想法。', step.id, runId)
      }
    } finally {
      if (isRunValid(runId)) typing.value = false
    }
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
    if (value === EXPLAIN_OPTION_VALUE) {
      explainChoice(step)
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

  /**
   * ✏️ 点气泡改答案：把对话截回该题重新作答（下游问答作废重问）。
   * 截断后推一条系统消息，让出题模型明白上下文跳变、以最新回答为准。
   */
  function editAnswer(message) {
    if (isDisposed || typing.value || !message) return false
    if (message.role !== 'user' || message.muted || message.streaming) return false
    startNewRun()
    typing.value = false
    const ok = session.revisitDynamic(message.stepId)
    if (!ok) return false
    session.pushMessage({
      role: 'system',
      stepId: '__edit__',
      text: '用户回头修改了此前某一题的回答，该题之后的问答已全部作废，请结合最新回答继续推进，不要重复已作废的内容。',
    })
    return true
  }

  /* ── 进场 ─────────────────────────────────────── */
  async function boot() {
    // 🌟 恢复现场：优先 ?project=（方案页/聊一半卡片的「继续」）；
    // 没有 query 但本地绑定了项目（整页刷新/重开标签页，URL 上不带参数）时同样回捞，
    // 否则模式会丢回 qa、把问答开场白误存进 agent 项目——这是刷新后「从头开始问答」的根因
    const projectQuery = String(route.query.project || '')
    const resumeId = projectQuery || session.currentProjectId
    if (resumeId && (resumeId !== session.currentProjectId || !session.messages.length)) {
      try {
        const record = await projectsApi.get(resumeId)
        session.bindProject(resumeId)
        session.restoreFromProject(record)
      } catch (err) {
        // 拉不到就按全新会话走，不挡路
        console.error('恢复项目现场失败：', err)
      }
    }

    // 🌟 Agent 闲聊模式：无问卷、无推进，现场就是全部（开场白只在新项目播一次）
    if (session.mode === 'agent') {
      await agentBoot()
      return
    }

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

    // 🌟 AI 思考/打字途中退出再回来：最后一条停在用户消息（或半个 AI 空气泡）上 = AI 后半轮丢了，进场就补一嗓子
    const lastMsg = session.messages[session.messages.length - 1]
    const danglingUserTurn =
      lastMsg &&
      ((lastMsg.role === 'user' && !lastMsg.muted) ||
        (lastMsg.role === 'ai' && !String(lastMsg.text || '').trim()))
    if (danglingUserTurn) {
      dropTrailingEmptyAiBubbles()
      session.activeDynamicStep = null
    }
    if (session.stepIndex > 0 && (!session.activeDynamicStep || danglingUserTurn)) {
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

  return { typing, speedMode, toggleSpeedMode, paceMode, togglePaceMode, submit, skipStep, goBack, quickFinish, editAnswer, agentChips, agentSend, requestPlan, defer }
}
