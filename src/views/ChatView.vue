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
const { typing, submit, skipStep, goBack, defer } = useChatFlow()

const streamRef = ref(null)
const footRef = ref(null)
const exitOpen = ref(false)
/** 由「或者自己说…」进入的自由输入态 */
const customMode = ref(false)
const customBase = ref([])

const step = computed(() => session.currentStep)
const atStart = computed(() => session.stepIndex === 0)

/** 这一题的提问已经落到消息流里了吗？没问完就不给交互区 */
const asked = computed(() => {
  const s = step.value
  if (!s) return false
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
const bubbles = computed(() =>
  session.messages.map((m, i, arr) => {
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
    }
  }),
)

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

watch([() => session.messages.length, typing, mode], () => {
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
}
function onSkip() {
  customMode.value = false
  skipStep(step.value)
}
function onCustom(base) {
  customBase.value = Array.isArray(base) ? [...base] : []
  customMode.value = true
}
function onComposerSubmit(value) {
  const s = step.value
  if (!s) return
  // 多选题的答案始终保持数组形态：自己说的这句和已选项合并
  const merged =
    s.type === 'multi' ? [...customBase.value.filter((v) => v !== value), value] : value
  customMode.value = false
  submit(s, merged)
}

/** 键盘弹起后把输入区顶到可见位置 */
function onComposerFocus() {
  defer(() => {
    scrollToBottom(false)
    footRef.value?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, 320)
}

/* ── 顶部返回 ─────────────────────────────────── */
/** 回到上一题时用来回填选中态，等 step 变化的 watch 接手 */
let seed = null

function onBack() {
  if (customMode.value) {
    customMode.value = false
    return
  }
  if (atStart.value) {
    exitOpen.value = true
    return
  }
  seed = goBack()
}

function confirmExit() {
  exitOpen.value = false
  if (session.messages.length) session.persistDraft()
  if (window.history.length > 1) router.back()
  else router.replace('/')
}

/* ── 换题时收起自由输入；返回上一题则把旧答案填回去 ── */
watch(
  () => step.value?.id,
  () => {
    customMode.value = false
    customBase.value = seed || []
    seed = null
  },
)

/* ── 视口变化（软键盘）时保持贴底 ─────────────── */
function onViewportResize() {
  nextTick(() => scrollToBottom(false))
}

onMounted(() => {
  nextTick(() => scrollToBottom(false))
  window.visualViewport?.addEventListener('resize', onViewportResize)
  // 非阻塞：只决定 mic 按钮是否出现，失败不影响聊天
  planStore.refreshServiceStatus().catch(() => {})
})
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})
</script>

<template>
  <div class="page chat">
    <div class="chat__top">
      <GProgress :value="session.progress" />
    </div>

    <header class="chat__head">
      <button
        class="chat__back tap"
        :aria-label="atStart ? '退出对话' : '返回上一题'"
        @click="onBack"
      >
        <GIcon :name="atStart ? 'close' : 'back'" :size="20" />
      </button>
      <div class="chat__brand">GiftMind</div>
      <div class="chat__stage">{{ session.stageText }}</div>
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
      <ChoicePanel
        v-if="mode === 'choice'"
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
