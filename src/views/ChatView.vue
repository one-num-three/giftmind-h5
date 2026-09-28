<script setup>
/**
 * AI 对话问卷 —— 产品的核心页面
 * 页面只做三件事：渲染消息流、按 currentStep.type 换底部交互、把动作转给 useChatFlow。
 * 节奏（打字机 / 推进 / 收尾 / 恢复）全在 composables/useChatFlow.js 里。
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { isMock } from '@/api'
import { useSessionStore } from '@/stores/session'
import { usePlanStore } from '@/stores/plan'
import { useUiStore } from '@/stores/ui'
import { useChatFlow } from '@/composables/useChatFlow'
import ChatBubble from '@/components/chat/ChatBubble.vue'
import TypingDots from '@/components/chat/TypingDots.vue'
import ChoicePanel from '@/components/chat/ChoicePanel.vue'
import ChatComposer from '@/components/chat/ChatComposer.vue'

const router = useRouter()
const session = useSessionStore()
const planStore = usePlanStore()
const ui = useUiStore()
const { typing, speedMode, toggleSpeedMode, paceMode, togglePaceMode, submit, skipStep, goBack, editAnswer, agentChips, agentSend, requestPlan, defer } = useChatFlow()

const streamRef = ref(null)
const footRef = ref(null)
const exitOpen = ref(false)
/** 点气泡改答案：待确认的目标消息与确认弹层 */
const editOpen = ref(false)
const editTarget = ref(null)
/** 由「或者自己说…」进入的自由输入态 */
const customMode = ref(false)
const customBase = ref([])

const step = computed(() => session.currentStep)

/** Agent 闲聊模式：无问卷步骤，常驻输入 + 用户点按钮出方案 */
const isAgent = computed(() => session.mode === 'agent')

/** 这一题的提问已经落到消息流里了吗？没问完就不给交互区 */
const asked = computed(() => {
  const s = step.value
  if (!s) return false
  if (s.key === 'retry_action') return true
  const hasCopy = (s.messages || []).some((t) => typeof t === 'string' && t.trim())
  if (!hasCopy) return true // 剧本没写提问文案，就别把用户卡住
  return session.messages.some((m) => m.role === 'ai' && m.stepId === s.id)
})


/** 底部交互形态：完全由 currentStep.type 决定；剧本没给选项就退回输入框 */
const mode = computed(() => {
  const s = step.value
  if (!s || typing.value || !asked.value) return 'idle'
  if (customMode.value) return 'text'
  if (s.type === 'single' || s.type === 'multi') return s.options?.length ? 'choice' : 'text'
  return 'text'
})

/** 语音转写只在服务端已配置（或 Mock 模式）时开放 */
const voiceAvailable = computed(() => isMock || Boolean(planStore.serviceStatus?.voiceConfigured))

/* ── 消息流 ───────────────────────────────────── */
/** 已作答的步骤 id 集合：自己的历史回答气泡才可点改 */
const answeredStepIds = computed(() => new Set(Object.values(session.answerSteps || {}).map((s) => s && s.id)))

const bubbles = computed(() =>
  session.messages.filter((m) => m.role !== 'system').map((m, i, arr) => {
    const role = m.role === 'user' ? 'user' : 'ai'
    const prev = arr[i - 1]
    const lead = !prev || (prev.role === 'user' ? 'user' : 'ai') !== role
    return {
      id: m.id,
      role,
      text: m.text,
      muted: Boolean(m.muted),
      avatar: role === 'ai' && lead, // 连发的 AI 消息只有第一条露头像
      spaced: lead && i > 0,
      streaming: Boolean(m.streaming),
      editable: role === 'user' && !m.muted && !m.streaming && answeredStepIds.value.has(m.stepId) && !typing.value,
    }
  }),
)

/** 修改目标题的题目文案（确认弹层里提示用户改的是哪题） */
const editQuestionText = computed(() => {
  const msg = editTarget.value
  if (!msg) return ''
  const step = Object.values(session.answerSteps || {}).find((s) => s?.id === msg.stepId)
  const q = (step?.messages || []).filter((t) => typeof t === 'string' && t.trim()).join(' ')
  return q ? (q.length > 40 ? `${q.slice(0, 40)}…` : q) : ''
})

function onBubbleEdit(id) {
  if (typing.value) return
  const msg = session.messages.find((m) => m.id === id)
  if (!msg || msg.role !== 'user' || msg.muted) return
  editTarget.value = msg
  editOpen.value = true
}

function confirmEdit() {
  const msg = editTarget.value
  editOpen.value = false
  editTarget.value = null
  if (msg) editAnswer(msg)
}

/** 打字气泡是不是一段 AI 发言的开头 */
const typingLeads = computed(() => {
  const last = session.messages[session.messages.length - 1]
  return !last || last.role !== 'ai'
})

function scrollToBottom(smooth = true) {
  const el = streamRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

watch([() => session.messages.length, typing, mode, agentChips], () => {
  nextTick(() => scrollToBottom(true))
})

/* ── 底部交互 ─────────────────────────────────── */
const composerPlaceholder = computed(
  () => step.value?.placeholder || (customMode.value ? '直接告诉我…' : '写点什么…'),
)
const composerHint = computed(() => {
  if (!customMode.value || step.value?.type !== 'multi') return ''
  const n = customBase.value.length
  return n ? `会和已选的 ${n} 项一起提交` : ''
})

function onSubmit(value) {
  submit(step.value, value)
  customMode.value = false
  customBase.value = []
}
function onSkip() {
  customMode.value = false
  customBase.value = []
  skipStep(step.value)
}
function onCustom(base) {
  customBase.value = Array.isArray(base) ? [...base] : []
  customMode.value = true
}
function onComposerSubmit(text) {
  const clean = typeof text === 'string' ? text.trim() : ''
  if (!clean) return

  if (customMode.value && step.value?.type === 'multi') {
    const combined = [...customBase.value, clean]
    onSubmit(combined)
    return
  }

  // 🌟 核心修复：立即同步提交，0ms 瞬间把消息打上屏幕并进入 AI 思考，绝不阻塞 UI 导致跳回选项
  onSubmit(clean)

  // 长文本后台静默辅助解析，绝不卡住主线程交互
  // 原文已经进入会话；不再异步回填推测槽位，避免覆盖后续纠正或改变轮次。
}

/* ── Agent 闲聊模式 ── */
function onAgentSubmit(text) {
  agentSend(text)
}
function onAgentChip(chip) {
  if (chip?.label) agentSend(chip.label)
}
function onPlanClick() {
  requestPlan()
}

/** 键盘弹起后把输入区顶到可见位置 */
function onComposerFocus() {
  defer(() => {
    scrollToBottom(false)
    footRef.value?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, 320)
}

/* ── 顶部返回 ─────────────────────────────────── */

/** 左上角 = 完全退出对话（统一行为，不再兼职"返回上一题"） */
function onBack() {
  exitOpen.value = true
}

/** 返回上一题：仅撤销上一步作答，消息流保留，重新展示上一题的选项 */
function onPrev() {
  const old = goBack()
  customBase.value = Array.isArray(old) ? [...old] : []
  customMode.value = false
}

function confirmExit() {
  exitOpen.value = false
  if (session.messages.length) session.persistDraft()
  if (window.history.length > 1) router.back()
  else router.replace('/')
}

/* ── 换题时收起自由输入 ── */
watch(
  () => step.value?.id,
  () => {
    customMode.value = false
  },
)

/* ── 视口变化（软键盘）时保持贴底 ─────────────── */
function onViewportResize() {
  nextTick(() => scrollToBottom(false))
}

onMounted(async () => {
  nextTick(() => scrollToBottom(false))
  window.visualViewport?.addEventListener('resize', onViewportResize)
  if (!isMock) {
    try {
      await planStore.checkServiceStatus()
    } catch {
      // 检查失败就保持默认
    }
  }
})
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})
</script>

<template>
  <div class="page chat">
    <div class="chat__top">
      <GProgress v-if="!isAgent" :value="session.progress" />
    </div>

    <header class="chat__head">
      <button
        class="chat__back tap"
        aria-label="退出对话"
        title="退出对话"
        @click="onBack"
      >
        <GIcon name="close" :size="20" />
      </button>
      <div class="chat__brand" role="heading" aria-level="1" data-route-focus>
        GiftMind
        <span class="chat__ai-engine-tag" title="DeepSeek Flash (v4代经济型实时思考引擎已就绪)">DeepSeek Flash</span>
      </div>
      <div class="chat__head-right">
        <!-- ↩ 返回上一题（重新选择上一题的答案），Agent 闲聊无题目可退 -->
        <button
          v-if="!isAgent && session.stepIndex > 0"
          class="chat__prev-btn tap"
          type="button"
          aria-label="返回上一题"
          title="回到上一题重新选择"
          @click="onPrev"
        >
          <GIcon name="back" :size="14" />
          <span>上一题</span>
        </button>

        <!-- ⚡ 极速 / ☕ 沉浸 速率切换按钮 -->
        <button
          class="chat__speed-btn tap"
          type="button"
          :title="speedMode === 'fast' ? '当前为极速模式，点击切为慢速沉浸' : '当前为慢速沉浸模式，点击切为极速'"
          @click="toggleSpeedMode"
        >
          <span v-if="speedMode === 'fast'">⚡ 极速</span>
          <span v-else>☕ 沉浸</span>
        </button>

        <!-- 🎁 Agent 闲聊：只有用户点按钮才生成方案（AI 绝不主动提） -->
        <button
          v-if="isAgent"
          class="chat__plan-btn tap"
          type="button"
          :disabled="typing || planStore.generating"
          :title="typing ? '等对方说完再点～' : '觉得聊得差不多了？点我生成方案'"
          @click="onPlanClick"
        >
          🎁 生成方案
        </button>
        <template v-else>
          <button
            v-if="session.stepIndex >= 2"
            class="chat__quick-btn tap"
            :class="{ 'chat__quick-btn--active': paceMode === 'fast' }"
            type="button"
            :title="paceMode === 'fast' ? '已加速：只问关键项，点击恢复细致追问' : '等不及了？点击加速，之后只问关键问题、大幅拉快进度'"
            @click="togglePaceMode"
          >
            <span v-if="paceMode === 'fast'">🐢 恢复细致</span>
            <span v-else>⏩ 快点问</span>
          </button>
          <div v-else class="chat__stage">{{ session.stageText }}</div>
        </template>
      </div>
    </header>

    <div ref="streamRef" class="chat__stream scroll-y">
      <div class="chat__list">
        <ChatBubble
          v-for="b in bubbles"
          :key="b.id"
          :role="b.role"
          :text="b.text"
          :avatar="b.avatar"
          :spaced="b.spaced"
          :muted="b.muted"
          :streaming="b.streaming"
          :editable="b.editable"
          @edit="onBubbleEdit(b.id)"
        />
        <ChatBubble
          v-if="typing"
          role="ai"
          :avatar="typingLeads"
          :spaced="typingLeads && bubbles.length > 0"
          tight
        >
          <TypingDots />
        </ChatBubble>
      </div>
    </div>

    <div ref="footRef" class="chat__foot">
      <!-- 🌙 Agent 闲聊模式：常驻输入框 + 模型随缘给的可点方向 -->
      <template v-if="isAgent">
        <div v-if="agentChips.length && !typing" class="chat__chips">
          <button
            v-for="(chip, idx) in agentChips"
            :key="`${idx}-${chip.label}`"
            type="button"
            class="chat__chip tap"
            @click="onAgentChip(chip)"
          >
            {{ chip.label }}
          </button>
        </div>
        <ChatComposer
          :placeholder="typing ? '对方正在输入…' : '想到什么说什么…'"
          :voice="voiceAvailable"
          @submit="onAgentSubmit"
          @focus="onComposerFocus"
          @voice-error="(message) => ui.error(message)"
        />
      </template>
      <ChoicePanel
        v-else-if="mode === 'choice'"
        :key="`choice-${step.id}`"
        class="anim-up"
        :step="step"
        :initial="customBase"
        @submit="onSubmit"
        @skip="onSkip"
        @custom="onCustom"
      />
      <ChatComposer
        v-else-if="mode === 'text'"
        :key="`text-${step.id}-${customMode ? 'custom' : 'main'}`"
        class="anim-up"
        :placeholder="composerPlaceholder"
        :hint="composerHint"
        :skippable="Boolean(step.skippable)"
        :cancelable="customMode"
        :autofocus="customMode"
        :voice="voiceAvailable"
        @submit="onComposerSubmit"
        @skip="onSkip"
        @cancel="customMode = false"
        @focus="onComposerFocus"
        @voice-error="(message) => ui.error(message)"
      />
      <div v-else class="chat__idle" aria-hidden="true" />
    </div>

    <GSheet v-model="exitOpen" title="先离开一下？">
      <p class="exit__desc">
        退出后进度会保留。已经聊过的内容都留着，下次回来可以接着往下说。
      </p>
      <template #footer>
        <div class="exit__acts">
          <GButton variant="outline" block @click="exitOpen = false">继续聊</GButton>
          <GButton variant="dark" block @click="confirmExit">退出对话</GButton>
        </div>
      </template>
    </GSheet>

    <GSheet v-model="editOpen" title="修改这题的回答？">
      <p class="exit__desc">
        <template v-if="editQuestionText">「{{ editQuestionText }}」</template>
        改完后，这题后面的问答都会作废，从这里重新往下聊。
      </p>
      <template #footer>
        <div class="exit__acts">
          <GButton variant="outline" block @click="editOpen = false">再想想</GButton>
          <GButton variant="dark" block @click="confirmEdit">修改这题</GButton>
        </div>
      </template>
    </GSheet>
  </div>
</template>

<style scoped>
.chat {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* ── 顶部 ─────────────────────────────────── */
.chat__top {
  padding-top: var(--safe-top);
  background: var(--c-paper);
  flex-shrink: 0;
}

.chat__head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: var(--navbar-h);
  padding: 0 var(--s-3);
  background: var(--c-paper);
  flex-shrink: 0;
}

.chat__back {
  width: 44px;
  height: 44px;
  margin-left: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-ink-2);
  flex-shrink: 0;
}
.chat__brand {
  flex: 1;
  min-width: 0;
  font-family: var(--f-display);
  font-size: var(--fs-h3);
  line-height: 1;
  color: var(--c-ink);
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
.chat__ai-engine-tag {
  font-size: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.2);
  margin-left: 6px;
  letter-spacing: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.chat__ai-engine-tag::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
  box-shadow: 0 0 6px #10b981;
}
.chat__stage {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  border-radius: var(--r-pill);
  background: var(--c-rose-tint);
  color: var(--c-rose-deep);
  font-size: var(--fs-micro);
  white-space: nowrap;
  flex-shrink: 0;
}
.chat__head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.chat__speed-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--c-bg-subtle, #f3f4f6);
  color: var(--c-ink-2, #4b5563);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--c-border, #e5e7eb);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.chat__prev-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--c-bg-subtle, #f3f4f6);
  color: var(--c-ink-2, #4b5563);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--c-border, #e5e7eb);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.chat__prev-btn:active {
  transform: scale(0.95);
  background: var(--c-rose-tint, #fff1f2);
  color: var(--c-rose, #f43f5e);
}
.chat__speed-btn:active {
  transform: scale(0.95);
  background: var(--c-rose-tint, #fff1f2);
  color: var(--c-rose, #f43f5e);
}
.chat__quick-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border: none;
  box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
  cursor: pointer;
}
.chat__quick-btn--active {
  background: #fff;
  color: var(--c-rose, #f43f5e);
  border: 1px solid var(--c-rose, #f43f5e);
  box-shadow: none;
}

/* ── 消息流 ───────────────────────────────── */
.chat__stream {
  flex: 1;
  min-height: 0;
  padding: var(--s-4) var(--page-x) var(--s-5);
}
.chat__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── 底部交互区 ───────────────────────────── */
.chat__foot {
  position: relative;
  flex-shrink: 0;
  padding: var(--s-3) var(--page-x) calc(var(--s-4) + var(--safe-bottom));
  background: var(--c-paper);
}
.chat__foot::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 32px;
  background: var(--g-mask-bottom);
  pointer-events: none;
}
.chat__idle {
  height: 54px;
}
.chat__plan-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border: none;
  box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3);
  cursor: pointer;
}
.chat__plan-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.chat__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
}
.chat__chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #1c1917;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* ── 退出确认 ─────────────────────────────── */
.exit__desc {
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
  padding-bottom: var(--s-2);
}
.exit__acts {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.exit__acts > * {
  flex: 1;
  min-width: 0;
}
</style>
