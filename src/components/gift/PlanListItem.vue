<script>
import { ref } from 'vue'

/**
 * 模块级共享状态：当前处于「左滑展开」的行 id。
 * 放在模块作用域而不是组件里，保证同一时间只有一行露出删除按钮。
 */
const openRowId = ref('')
</script>

<script setup>
/**
 * PlanListItem —— 「我的方案」列表行
 *
 * 交互三层：
 *   1. 点整行 → /plan/:id
 *   2. 左滑（touch / 鼠标拖拽）→ 露出右侧删除，松手吸附到 0 或 -72
 *   3. 桌面降级：hover 设备上常驻一个删除入口，不依赖手势也能删
 * 删除一律走二次确认，确认后才落到 historyStore。
 */
import { computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import { joinText, relativeTime, toArray } from '@/utils/helpers'

const props = defineProps({
  plan: { type: Object, default: () => ({}) },
})

const router = useRouter()
const history = useHistoryStore()
const ui = useUiStore()

/* ── 展示数据：任何字段缺失都要有兜底 ─────────── */
const planId = computed(() => String(props.plan?.id || ''))
const emoji = computed(() => props.plan?.share?.coverEmoji || '🎁')
const title = computed(() => String(props.plan?.title || '').trim() || '未命名的方案')

const THEMES = ['dawn', 'dusk', 'sage']
const theme = computed(() => {
  const t = props.plan?.share?.theme
  return THEMES.includes(t) ? t : 'dawn'
})

/** 「女朋友 / 妻子」→「女朋友」，「体验类（活动/课程/旅行）」→「体验类」 */
function short(v) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return s.split(/[（(]/)[0].split(' / ')[0].split('，')[0].trim()
}

const metaText = computed(() => {
  const a = props.plan?.answers || {}
  const when = relativeTime(props.plan?.updatedAt || props.plan?.createdAt)
  return joinText([short(a.recipient), short(a.occasion), when].filter(Boolean), ' · ')
})

const chips = computed(() => {
  const a = props.plan?.answers || {}
  const out = []
  const budget = short(a.budget)
  if (budget) out.push({ key: 'budget', tone: 'sand', text: budget })

  const count = toArray(props.plan?.gifts).length
  if (count) out.push({ key: 'gifts', tone: 'sage', text: `${count} 件礼物` })

  const styles = toArray(a.style).map(short).filter(Boolean)
  if (styles.length) {
    out.push({
      key: 'style',
      tone: 'lilac',
      text: styles.length > 1 ? `${styles[0]} 等 ${styles.length} 种` : styles[0],
    })
  }
  return out
})

/* ── 左滑手势 ─────────────────────────────────
 * 位移用内联 style 写，是「真实 px」；而样式表里的 72px 会被 postcss-pxtorem
 * 转成 rem 并随根字号缩放。所以吸附距离必须实测 DOM 宽度，不能写死 72。
 */
const FALLBACK_W = 72
const OVERSHOOT = 20
const DIR_THRESHOLD = 6

const actionRef = ref(null)
const offset = ref(0)
const dragging = ref(false)
const confirmOpen = ref(false)

let actionW = FALLBACK_W
let startX = 0
let startY = 0
let startOffset = 0
let startAt = 0
let axis = '' // '' 未定 | 'x' 横滑 | 'y' 纵向滚动，交还给页面
let moved = false
let closedOther = false
let mouseDragging = false

const opened = computed(() => offset.value < -1)
const frontStyle = computed(() => ({ transform: `translate3d(${offset.value}px, 0, 0)` }))

function measure() {
  const w = actionRef.value?.offsetWidth || 0
  if (w > 0) actionW = w
}

function setOpen(v) {
  measure()
  offset.value = v ? -actionW : 0
  if (v) openRowId.value = planId.value
  else if (openRowId.value === planId.value) openRowId.value = ''
}

/** 别的行展开时，自己收起（不改 openRowId，避免把对方的状态抹掉） */
watch(openRowId, (id) => {
  if (id !== planId.value && offset.value !== 0) {
    dragging.value = false
    offset.value = 0
  }
})

function begin(x, y) {
  measure()
  startX = x
  startY = y
  startOffset = offset.value
  startAt = Date.now()
  axis = ''
  moved = false
  // 手指落在别的行上时，先把已展开的那一行收起来，这一下就不再当作点击
  closedOther = Boolean(openRowId.value) && openRowId.value !== planId.value
  if (closedOther) openRowId.value = ''
}

/** 返回 true 表示这次移动被横滑消费掉了 */
function move(x, y) {
  const dx = x - startX
  const dy = y - startY

  if (!axis) {
    if (Math.abs(dx) < DIR_THRESHOLD && Math.abs(dy) < DIR_THRESHOLD) return false
    // 纵向优先：判定为竖滑就整段手势都不接管，让页面正常滚动
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axis === 'x') dragging.value = true
  }
  if (axis !== 'x') return false

  moved = true
  let next = startOffset + dx
  if (next < -actionW) next = -actionW - (-actionW - next) * 0.35 // 超出后阻尼
  offset.value = Math.max(-actionW - OVERSHOOT, Math.min(0, next))
  return true
}

function end() {
  dragging.value = false
  if (axis !== 'x') {
    axis = ''
    return
  }
  axis = ''
  const dx = offset.value - startOffset
  const quick = Date.now() - startAt < 260
  if (quick && dx < -12) return setOpen(true) // 快速左甩
  if (quick && dx > 12) return setOpen(false) // 快速右甩
  setOpen(offset.value < -actionW / 2)
}

/* 触摸 */
function onTouchStart(e) {
  if (e.touches.length !== 1) return
  begin(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchMove(e) {
  if (e.touches.length !== 1) return
  const consumed = move(e.touches[0].clientX, e.touches[0].clientY)
  if (consumed && e.cancelable) e.preventDefault()
}
function onTouchEnd() {
  end()
}

/* 鼠标（桌面预览）：只接管 mouse，触摸设备仍走 touch 事件，避免重复处理 */
function onPointerDown(e) {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  mouseDragging = true
  begin(e.clientX, e.clientY)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}
function onPointerMove(e) {
  if (!mouseDragging) return
  if (move(e.clientX, e.clientY)) e.preventDefault()
}
function onPointerUp() {
  if (!mouseDragging) return
  detachPointer()
  end()
}
function detachPointer() {
  mouseDragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

/* ── 点击 / 删除 ─────────────────────────────── */
function onClick() {
  if (moved) {
    moved = false
    return // 刚刚是滑动，不算点击
  }
  if (closedOther) {
    closedOther = false
    return // 这一下只是收起别的行
  }
  if (offset.value !== 0) {
    setOpen(false)
    return // 展开态：先收起
  }
  if (!planId.value) {
    ui.error('这份方案缺少编号，打不开了')
    return
  }
  router.push(`/plan/${planId.value}`)
}

function askDelete() {
  confirmOpen.value = true
}

function doDelete() {
  confirmOpen.value = false
  const id = planId.value
  setOpen(false)
  if (!id) return
  history.remove(id)
  ui.success('已删除这份方案')
}

onUnmounted(() => {
  detachPointer()
  if (openRowId.value === planId.value) openRowId.value = ''
})
</script>

<template>
  <div class="prow" :class="{ 'is-open': opened }">
    <!-- 左滑露出的删除区（容器比按钮宽出一截，滑过头时露出的也是连续的红） -->
    <div class="prow__action">
      <button
        ref="actionRef"
        class="prow__del"
        type="button"
        :tabindex="opened ? 0 : -1"
        :aria-hidden="!opened"
        @click.stop="askDelete"
      >
        <GIcon name="trash" :size="17" />
        <span class="prow__del-text">删除</span>
      </button>
    </div>

    <!-- 卡片本体 -->
    <div
      class="prow__front"
      :class="{ 'is-dragging': dragging }"
      :style="frontStyle"
      role="button"
      tabindex="0"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @pointerdown="onPointerDown"
      @click="onClick"
      @keydown.enter.prevent="onClick"
      @keydown.space.prevent="onClick"
    >
      <div class="prow__cover" :class="`is-${theme}`">
        <span class="prow__emoji">{{ emoji }}</span>
      </div>

      <div class="prow__body">
        <p class="prow__title">{{ title }}</p>
        <p v-if="metaText" class="prow__meta">{{ metaText }}</p>
        <div v-if="chips.length" class="prow__chips">
          <span v-for="c in chips" :key="c.key" class="prow__chip" :class="`is-${c.tone}`">
            {{ c.text }}
          </span>
        </div>
      </div>

      <!-- 桌面降级入口：hover 设备上常驻，不用手势也能删 -->
      <button class="prow__more" type="button" aria-label="删除这份方案" @click.stop="askDelete">
        <GIcon name="trash" :size="15" />
      </button>
    </div>

    <GSheet v-model="confirmOpen" title="删除这份方案？">
      <p class="confirm__name">「{{ title }}」</p>
      <p class="confirm__text">
        删掉之后，这份方案里的礼物推荐、信和仪式流程都会一起消失，找不回来。
      </p>
      <template #footer>
        <div class="confirm__acts">
          <GButton variant="outline" block @click="confirmOpen = false">再想想</GButton>
          <GButton class="btn-danger" variant="dark" block @click="doDelete">删除</GButton>
        </div>
      </template>
    </GSheet>
  </div>
</template>

<style scoped>
.prow {
  position: relative;
  border-radius: var(--r-lg);
  /* 阴影挂在外层：内层 front 会被 overflow 裁掉，就没有阴影了；
     而元素自身的 box-shadow 不受自己的 overflow 影响。 */
  box-shadow: var(--sh-1);
  overflow: hidden;
  background: var(--c-surface);
}

/* ── 删除区 ──────────────────────────────── */
.prow__action {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 92px; /* 72 按钮 + 20 回弹余量 */
  display: flex;
  justify-content: flex-end;
  background: var(--c-danger);
}
.prow__del {
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--c-danger);
  color: var(--c-ink-inverse);
  font-size: var(--fs-micro);
}
.prow__del-text {
  letter-spacing: 0.04em;
}

/* ── 卡片本体 ────────────────────────────── */
.prow__front {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 12px;
  background: var(--c-surface);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
  transition: transform var(--t-base) var(--e-out), background var(--t-fast);
}
.prow__front.is-dragging {
  transition: none;
}
.prow__front:not(.is-dragging):active {
  background: var(--c-paper-2);
}
.prow__front:focus-visible {
  outline: 2px solid var(--c-rose);
  outline-offset: -2px;
}

.prow__cover {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px var(--c-line);
}
.prow__cover.is-dawn {
  background: var(--g-dawn);
}
.prow__cover.is-dusk {
  background: var(--g-dusk);
}
.prow__cover.is-sage {
  background: linear-gradient(
    160deg,
    var(--c-sage-soft) 0%,
    var(--c-paper-2) 58%,
    var(--c-sand-soft) 100%
  );
}
.prow__emoji {
  font-size: 26px;
  line-height: 1;
}

.prow__body {
  flex: 1;
  min-width: 0;
}
.prow__title {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prow__meta {
  margin-top: 3px;
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prow__chips {
  display: flex;
  gap: 5px;
  margin-top: var(--s-2);
  overflow: hidden;
}
.prow__chip {
  flex-shrink: 0;
  max-width: 96px;
  height: 21px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  font-size: 10.5px;
  line-height: 21px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: var(--c-paper-2);
  color: var(--c-ink-3);
}
.prow__chip.is-sand {
  background: var(--c-sand-soft);
  color: var(--c-sand-deep);
}
.prow__chip.is-sage {
  background: var(--c-sage-soft);
  color: var(--c-sage-deep);
}
.prow__chip.is-lilac {
  background: var(--c-lilac-soft);
  color: var(--c-lilac-deep);
}

/* 桌面降级入口：只在有 hover 的设备上出现 */
.prow__more {
  display: none;
  position: absolute;
  top: 50%;
  right: 2px;
  width: 34px;
  height: 34px;
  /* 用 transform 居中而不是负 margin：负值不会被 pxtorem 转 rem，换屏宽会偏 */
  transform: translateY(-50%);
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--c-ink-4);
  transition: color var(--t-fast), background var(--t-fast);
}
.prow__more:active {
  opacity: 0.7;
}
@media (hover: hover) and (pointer: fine) {
  .prow__more {
    display: flex;
  }
  .prow__more:hover {
    background: var(--c-paper-2);
    color: var(--c-danger);
  }
  .prow__body {
    padding-right: 30px;
  }
}

/* ── 二次确认 ────────────────────────────── */
.confirm__name {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  color: var(--c-ink);
}
.confirm__text {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
}
.confirm__acts {
  display: flex;
  gap: var(--s-3);
}
.confirm__acts > * {
  flex: 1;
  min-width: 0;
}
.confirm__acts :deep(.btn-danger) {
  background: var(--c-danger);
  color: var(--c-ink-inverse);
  box-shadow: none;
}
</style>
