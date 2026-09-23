<script setup>
/**
 * GeneratingView —— 生成中过场
 *
 * 等待本身也是产品的一部分：
 *   · 中央一条丝带按进度一点点系成蝴蝶结（纯 SVG，stroke-dashoffset 驱动）
 *   · 当前阶段文案上下淡入淡出地换，不硬替换
 *   · 已经走过的阶段逐条打勾落下
 *   · 底部一条细进度条按阶段数推进
 *
 * 阶段数据来自 planStore.progressStage（由 api.generatePlan 的 onProgress 回调推送），
 * 这里只观察、不假设一定是 mock —— 真实后端推别的 key 也能正常显示。
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useSessionStore } from '@/stores/session'
import { GENERATING_STEPS } from '../../mock/generatingSteps'

const router = useRouter()
const planStore = usePlanStore()
const session = useSessionStore()

/* ── 丝带的四笔：两个环 + 两条飘带 ─────────── */
const BOW_PATHS = [
  'M60 40C48 19 25 15 20 30c-4 12 15 20 40 10',
  'M60 40c12-21 35-25 40-10 4 12-15 20-40 10',
  'M60 40c-3 15-11 27-22 37',
  'M60 40c4 15 12 26 25 33',
]

/* ── 阶段观察 ─────────────────────────────── */
const seen = ref([]) // 到达过的阶段，按顺序去重
const finished = ref(false)
const applyingRecovery = ref('')

const EXPECTED_TOTAL = Array.isArray(GENERATING_STEPS) ? GENERATING_STEPS.length : 5

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

watch(
  () => planStore.progressStage,
  (s) => {
    if (!s || typeof s !== 'object') return
    const key = String(s.key || s.label || '')
    if (!key || seen.value.some((x) => x.key === key)) return
    seen.value.push({ key, label: String(s.label || ''), hint: String(s.hint || '') })
  },
  { immediate: true },
)

const total = computed(() => Math.max(EXPECTED_TOTAL, seen.value.length, 1))
const currentStage = computed(() =>
  finished.value ? null : seen.value[seen.value.length - 1] || null,
)
/** 已完成 = 走过的阶段里除去正在进行的那一条 */
const doneStages = computed(() =>
  finished.value ? seen.value : seen.value.slice(0, Math.max(0, seen.value.length - 1)),
)

const percent = computed(() => {
  if (finished.value) return 100
  if (planStore.error) return Math.round((doneStages.value.length / total.value) * 100)
  if (!seen.value.length) return 3
  return clamp(Math.round(((seen.value.length - 0.4) / total.value) * 100), 3, 97)
})

/** 中央文案：出错 / 完成 / 当前阶段 / 起步兜底，永远有内容 */
const headline = computed(() => {
  if (planStore.error) {
    if (planStore.generationIssue) {
      return {
        key: '__recoverable',
        label: '差一个条件，就能继续',
        hint: '不是你填错了，当前条件暂时凑不齐两种方案',
      }
    }
    return { key: '__error', label: '这一份没能生成出来', hint: planStore.error }
  }
  if (finished.value) {
    return { key: '__done', label: '方案已经准备好了', hint: '正在为你打开' }
  }
  return currentStage.value || { key: '__idle', label: '正在整理你说过的话', hint: '马上开始' }
})

const countText = computed(() => {
  if (planStore.error) return '已中断'
  if (finished.value) return '全部完成'
  const n = clamp(seen.value.length, 1, total.value)
  return `第 ${n} / ${total.value} 步`
})

const serviceHint = computed(() => {
  const status = planStore.serviceStatus
  if (!status) return '正在连接 AI 策划大脑'
  if (status.mode === 'web_search') {
    if (!status.deepseekConfigured) return '服务端尚未配置 DeepSeek'
    if (!status.searchConfigured) return '服务端搜索能力未启用或浏览器不可用'
    if (status.searchProvider === 'taobao_jd_browser') return `${status.model || 'DeepSeek'} · 将检索淘宝/京东；平台可能要求登录或验证`
    return `${status.model || 'DeepSeek'} · 自主联网检索，不使用商品库`
  }
  if (status.state === 'unavailable') return '本地服务不可达'
  if (status.state === 'empty_catalog') return '全网检索准备中'
  if (status.state === 'rule_fallback') return 'DeepSeek 未配置，将使用规则模式'
  const countLabel = typeof status.activeGiftCount === 'number'
    ? `${status.activeGiftCount} 件候选礼物`
    : (status.activeGiftCount || '全网实时开放检索')
  return `${status.model || 'DeepSeek AI 选品大脑'} 已连接 · ${countLabel}`
})

const issue = computed(() => planStore.generationIssue)
const recoveryOptions = computed(() => issue.value?.recoveryOptions || [])
const editSuggestions = computed(() => issue.value?.editSuggestions || [])
const missingKindText = computed(() => {
  const labels = (issue.value?.missingKinds || []).map((item) => item.label).filter(Boolean)
  return labels.length ? labels.join('和') : '实物礼物和体验活动的组合'
})

/* ── 丝带成形：把进度切成四段，逐笔画出来 ──── */
const p = computed(() => percent.value / 100)
function seg(i) {
  return clamp(p.value * BOW_PATHS.length - i, 0, 1)
}
const knot = computed(() => clamp((p.value - 0.55) / 0.4, 0, 1))

/* ── 生成流程（可中断） ───────────────────── */
let alive = true
let timer = 0

function clearTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = 0
  }
}

/** 收尾：满格停一眼再跳，避免进度条刚满就闪走 */
function done() {
  if (!alive || finished.value) return
  finished.value = true
  clearTimer()
  timer = setTimeout(() => {
    timer = 0
    if (alive) router.replace('/plan')
  }, 640)
}

/** 上一次生成还没跑完（比如退出去又回来）：接管它的结果，不重复发起 */
watch(
  () => planStore.generating,
  (now, before) => {
    if (before && !now && !planStore.error && planStore.hasPlan) done()
  },
)

async function run() {
  if (!alive) return
  if (planStore.generating) return // 已有一次在跑，交给上面的 watcher 收尾
  seen.value = []
  finished.value = false
  try {
    await planStore.generate(session.answers)
    if (!alive) return
    done()
  } catch {
    // 失败信息已经写在 planStore.error 上，这里只负责不把异常抛到控制台
  }
}

function retry() {
  if (!alive) return
  planStore.clearGenerationError()
  run()
}

function backToChat() {
  planStore.clearGenerationError()
  router.replace('/chat')
}

async function applyRecovery(option) {
  if (!alive || !option?.id || applyingRecovery.value) return
  if (!session.applyRecoveryPatch(option.answerPatch)) return
  applyingRecovery.value = option.id
  planStore.clearGenerationError()
  try {
    await run()
  } finally {
    applyingRecovery.value = ''
  }
}

function editFrom(stepId) {
  if (!stepId) return
  planStore.clearGenerationError()
  session.revisit(stepId)
  router.replace('/chat')
}

onMounted(() => {
  // 直接访问本页但一题都没答过：没有任何可用输入，回首页
  if (session.answeredCount === 0) {
    router.replace('/')
    return
  }
  run()
})

onUnmounted(() => {
  alive = false
  clearTimer()
})
</script>

<template>
  <div class="page gen" :class="{ 'has-issue': issue }">
    <div class="gen__bg grain" aria-hidden="true">
      <span class="glow gen__glow gen__glow--rose" />
      <span class="glow gen__glow gen__glow--sand" />
      <span class="glow gen__glow gen__glow--sage" />
    </div>

    <div class="page__body gen__body">
      <div class="gen__stack">
        <!-- ══ 中央：正在成形的丝带 ══ -->
        <div v-if="!planStore.error" class="figure" aria-hidden="true">
          <span class="figure__halo" />

          <svg class="figure__ring" viewBox="0 0 200 200" fill="none">
            <circle
              cx="100"
              cy="100"
              r="94"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 11"
            />
          </svg>

          <span v-for="i in 6" :key="i" class="frag" :class="`frag--${i}`" />

          <svg
            class="figure__bow"
            viewBox="0 0 120 96"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-for="(d, i) in BOW_PATHS"
              :key="i"
              :d="d"
              pathLength="1"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-dasharray="1"
              :stroke-dashoffset="1 - seg(i)"
            />
          </svg>

          <span class="figure__knot" :style="{ transform: `translate(-50%, -50%) scale(${knot})` }" />
        </div>

        <!-- ══ 当前阶段 ══ -->
        <div class="head">
          <Transition name="swap" mode="out-in">
            <div :key="headline.key" class="head__inner">
              <p class="head__label">{{ headline.label }}</p>
              <p class="head__hint">{{ headline.hint }}</p>
            </div>
          </Transition>
        </div>

        <p class="service" :class="{ 'is-warn': planStore.serviceStatus?.state !== 'connected' }">
          <span class="service__dot" />{{ serviceHint }}
        </p>

        <!-- ══ 失败：给出口 ══ -->
        <section v-if="issue" class="recovery" aria-labelledby="recovery-title">
          <div class="recovery__intro">
            <p id="recovery-title">目前缺少：{{ missingKindText }}</p>
            <span>系统没有偷偷放宽你的年龄与避雷条件。</span>
          </div>

          <div v-if="recoveryOptions.length" class="recovery__group">
            <p class="recovery__eyebrow">一键调整后继续</p>
            <button
              v-for="option in recoveryOptions"
              :key="option.id"
              type="button"
              class="recovery__option"
              :disabled="Boolean(applyingRecovery)"
              @click="applyRecovery(option)"
            >
              <span>
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
              </span>
              <GIcon :name="applyingRecovery === option.id ? 'refresh' : 'arrowRight'" :size="17" />
            </button>
          </div>

          <div v-if="editSuggestions.length" class="recovery__group">
            <p class="recovery__eyebrow">也可以亲自确认</p>
            <button
              v-for="suggestion in editSuggestions"
              :key="suggestion.stepId"
              type="button"
              class="recovery__edit"
              @click="editFrom(suggestion.stepId)"
            >
              <span>
                <strong>{{ suggestion.label }}</strong>
                <small>{{ suggestion.description }}</small>
              </span>
              <GIcon name="chevron" :size="16" />
            </button>
          </div>

          <details v-if="issue.causes.length" class="recovery__details">
            <summary>查看哪些条件挡住了候选</summary>
            <dl>
              <div v-for="cause in issue.causes" :key="cause.code">
                <dt>{{ cause.label }}</dt>
                <dd>{{ cause.count }} 个</dd>
              </div>
            </dl>
          </details>

          <div class="recovery__fallback">
            <button type="button" @click="retry">原条件再试一次</button>
            <button type="button" @click="backToChat">返回逐项修改</button>
          </div>
        </section>

        <div v-else-if="planStore.error" class="fail">
          <GButton variant="primary" size="md" @click="retry">
            <GIcon name="refresh" :size="16" />
            再试一次
          </GButton>
          <GButton variant="ghost" size="md" @click="backToChat">返回修改答案</GButton>
        </div>

        <!-- ══ 已完成的阶段 ══ -->
        <TransitionGroup v-else tag="ul" name="tick" class="done">
          <li v-for="s in doneStages" :key="s.key" class="done__item">
            <span class="done__tick"><GIcon name="check" :size="11" :stroke="2.4" /></span>
            <span class="done__text">{{ s.label }}</span>
          </li>
        </TransitionGroup>
      </div>
    </div>

    <!-- ══ 底部进度 ══ -->
    <footer class="gen__foot">
      <div class="gen__count">
        <span>{{ countText }}</span>
        <span class="gen__pct">{{ percent }}%</span>
      </div>
      <GProgress :value="percent" :height="3" />
    </footer>
  </div>
</template>

<style scoped>
.gen {
  overflow: hidden;
}
.gen.has-issue {
  overflow-y: auto;
}

/* ══ 背景：奶油白 + 柔光 ══════════════════════ */
.gen__bg {
  position: absolute;
  inset: 0;
  background: var(--g-dawn);
  pointer-events: none;
}
.gen__glow {
  animation: breathe 12s var(--e-in-out) infinite;
}
.gen__glow--rose {
  width: 280px;
  height: 280px;
  top: -60px;
  left: -90px;
  background: var(--c-rose-soft);
  filter: blur(56px);
}
.gen__glow--sand {
  width: 300px;
  height: 300px;
  top: 200px;
  right: -130px;
  background: var(--c-sand-soft);
  filter: blur(60px);
  animation-duration: 15s;
  animation-delay: -5s;
}
.gen__glow--sage {
  width: 240px;
  height: 240px;
  bottom: 40px;
  left: -60px;
  background: var(--c-sage-soft);
  filter: blur(56px);
  animation-duration: 14s;
  animation-delay: -8s;
}

.gen__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: var(--s-8) var(--page-x) var(--s-7);
}
/* margin: auto 内容居中：内容超高时也不会把顶部裁掉 */
.gen__stack {
  margin: auto 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}

/* ══ 中央图形 ═══════════════════════════════ */
.figure {
  position: relative;
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--t-slow) var(--e-out);
}
.figure.is-error {
  opacity: 0.32;
}

.figure__halo {
  position: absolute;
  width: 148px;
  height: 148px;
  border-radius: 50%;
  background: var(--g-warm);
  filter: blur(14px);
  animation: breathe 5.4s var(--e-in-out) infinite;
}

.figure__ring {
  position: absolute;
  inset: 0;
  width: 200px;
  height: 200px;
  color: var(--c-sand);
  opacity: 0.5;
  animation: turn 64s linear infinite;
}

.figure__bow {
  position: relative;
  width: 150px;
  height: 120px;
  color: var(--c-rose);
}
.figure__bow path {
  transition: stroke-dashoffset var(--t-slow) var(--e-out);
}

.figure__knot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -10px;
  border-radius: 50%;
  background: var(--c-rose);
  box-shadow: var(--sh-primary);
  transform-origin: center;
  transition: transform var(--t-slow) var(--e-spring);
}

/* 向中心聚拢的碎片 */
.frag {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: var(--c-rose);
  opacity: 0;
  animation: converge 4.6s var(--e-in-out) infinite;
}
.frag--1 {
  --fx: -78px;
  --fy: -46px;
  animation-delay: 0s;
}
.frag--2 {
  --fx: 74px;
  --fy: -54px;
  background: var(--c-sand-deep);
  animation-delay: -0.8s;
}
.frag--3 {
  --fx: -64px;
  --fy: 62px;
  background: var(--c-sage);
  animation-delay: -1.7s;
}
.frag--4 {
  --fx: 82px;
  --fy: 40px;
  background: var(--c-lilac);
  animation-delay: -2.5s;
}
.frag--5 {
  --fx: 8px;
  --fy: -86px;
  background: var(--c-sky);
  animation-delay: -3.2s;
}
.frag--6 {
  --fx: -22px;
  --fy: 84px;
  animation-delay: -4s;
}

@keyframes converge {
  0% {
    transform: translate(var(--fx), var(--fy)) scale(0.5);
    opacity: 0;
  }
  22% {
    opacity: 0.85;
  }
  82% {
    opacity: 0.5;
  }
  100% {
    transform: translate(0, 0) scale(0.2);
    opacity: 0;
  }
}

@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}

/* ══ 阶段文案 ═══════════════════════════════ */
.head {
  margin-top: var(--s-6);
  min-height: 74px;
  width: 100%;
  text-align: center;
}
.head__label {
  font-family: var(--f-serif);
  font-size: var(--fs-h2);
  font-weight: 500;
  line-height: 1.5;
  color: var(--c-ink);
}
.head__hint {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-snug);
  color: var(--c-ink-3);
}
.service {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: var(--s-2);
  padding: 5px 10px;
  border-radius: var(--r-pill);
  background: var(--c-sage-tint, var(--c-paper-2));
  color: var(--c-sage-deep);
  font-size: var(--fs-micro);
}
.service.is-warn {
  background: var(--c-sand-soft);
  color: var(--c-ink-3);
}
.service__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* 上一条淡出上移，下一条从下方淡入 */
.swap-enter-active,
.swap-leave-active {
  transition: opacity var(--t-base) var(--e-out), transform var(--t-base) var(--e-out);
}
.swap-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ══ 已完成清单 ═════════════════════════════ */
.done {
  margin-top: var(--s-7);
  width: 100%;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.done__item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.done__tick {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-sage-soft);
  color: var(--c-sage-deep);
}
.done__text {
  min-width: 0;
  font-size: var(--fs-sm);
  line-height: var(--lh-snug);
  color: var(--c-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tick-enter-active {
  transition: opacity var(--t-slow) var(--e-out), transform var(--t-slow) var(--e-out);
}
.tick-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.tick-move {
  transition: transform var(--t-base) var(--e-out);
}

/* ══ 失败出口 ═══════════════════════════════ */
.fail {
  margin-top: var(--s-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
}

.recovery {
  width: 100%;
  margin-top: var(--s-5);
  padding: var(--s-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--c-surface) 94%, transparent);
  box-shadow: var(--sh-2);
  text-align: left;
}
.recovery__intro p {
  color: var(--c-ink);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: 1.55;
}
.recovery__intro span {
  display: block;
  margin-top: 5px;
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  line-height: 1.55;
}
.recovery__group {
  margin-top: var(--s-4);
}
.recovery__eyebrow {
  margin-bottom: var(--s-2);
  color: var(--c-ink-4);
  font-size: var(--fs-micro);
  font-weight: 700;
  letter-spacing: var(--ls-wide);
}
.recovery__option,
.recovery__edit {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: 12px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-paper);
  color: var(--c-ink);
  text-align: left;
}
.recovery__option + .recovery__option,
.recovery__edit + .recovery__edit {
  margin-top: var(--s-2);
}
.recovery__option:hover,
.recovery__option:focus-visible {
  border-color: var(--c-rose);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-rose) 12%, transparent);
}
.recovery__option:disabled {
  opacity: 0.62;
}
.recovery__option strong,
.recovery__edit strong {
  display: block;
  font-size: var(--fs-caption);
  line-height: 1.45;
}
.recovery__option small,
.recovery__edit small {
  display: block;
  margin-top: 3px;
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  line-height: 1.5;
}
.recovery__edit {
  min-height: 56px;
  border-color: transparent;
  background: var(--c-paper-2);
}
.recovery__details {
  margin-top: var(--s-4);
  border-top: 1px solid var(--c-line);
  padding-top: var(--s-3);
}
.recovery__details summary {
  min-height: 40px;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}
.recovery__details dl {
  display: grid;
  gap: 7px;
  padding: 4px 0 var(--s-2);
}
.recovery__details dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--s-3);
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
}
.recovery__fallback {
  display: flex;
  justify-content: center;
  gap: var(--s-4);
  margin-top: var(--s-3);
}
.recovery__fallback button {
  min-height: 40px;
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.has-issue .gen__body {
  overflow: visible;
  padding-top: var(--s-6);
  padding-bottom: calc(var(--s-8) + 54px);
}
.has-issue .gen__stack {
  margin-top: 0;
  margin-bottom: 0;
}
.has-issue .head {
  margin-top: var(--s-2);
}

/* ══ 底部进度 ═══════════════════════════════ */
.gen__foot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding-bottom: var(--safe-bottom);
}
.gen__count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--page-x) var(--s-2);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-4);
}
.gen__pct {
  font-family: var(--f-display);
  letter-spacing: normal;
  color: var(--c-ink-3);
}

@media (prefers-reduced-motion: reduce) {
  .gen__glow,
  .figure__halo,
  .figure__ring,
  .frag {
    animation: none;
  }
  .frag {
    opacity: 0;
  }
}
</style>
