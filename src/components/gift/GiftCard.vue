<script setup>
/**
 * GiftCard —— 一件礼物推荐
 *
 * 首选（primary）视觉更重：玫瑰底 + 角标 + 更大的 emoji 与契合度环。
 * 收藏与「怎么送更好」都在卡片底部一行，展开用高度过渡，不跳版。
 * gift 里任何字段缺失都有兜底文案，不会渲染出 undefined。
 */
import { ref, computed } from 'vue'
import { toArray } from '@/utils/helpers'

const props = defineProps({
  gift: { type: Object, default: () => ({}) },
  primary: Boolean,
  liked: Boolean,
})

const emit = defineEmits(['toggle-like'])

/** 礼物分类 → 标签配色 */
const CATEGORY_TONE = {
  实物: 'sand',
  体验: 'sage',
  定制: 'lilac',
  数字: 'sky',
  组合: 'rose',
}

function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const g = computed(() => (props.gift && typeof props.gift === 'object' ? props.gift : {}))

const emoji = computed(() => text(g.value.emoji) || '🎁')
const name = computed(() => text(g.value.name) || '一件还没起名的礼物')
const category = computed(() => text(g.value.category))
const categoryTone = computed(() => CATEGORY_TONE[category.value] || 'default')
const why = computed(() => text(g.value.why))
const price = computed(() => text(g.value.price))
const leadTime = computed(() => text(g.value.leadTime))
const tip = computed(() => text(g.value.tip))
const tags = computed(() =>
  toArray(g.value.tags)
    .map(text)
    .filter(Boolean)
    .slice(0, 3),
)

const score = computed(() => {
  const n = Number(g.value.matchScore)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
})
const hasScore = computed(() => score.value > 0)

const tipOpen = ref(false)

function toggleTip() {
  tipOpen.value = !tipOpen.value
}

function onLike() {
  const id = g.value.id
  if (!id) return
  emit('toggle-like', id)
}

/* ── 展开/收起的高度过渡（无定时器） ───────── */
function beforeEnter(el) {
  el.style.height = '0px'
  el.style.opacity = '0'
}
function enter(el) {
  el.style.height = `${el.scrollHeight}px`
  el.style.opacity = '1'
}
function afterEnter(el) {
  el.style.height = 'auto'
}
function beforeLeave(el) {
  el.style.height = `${el.scrollHeight}px`
  el.style.opacity = '1'
}
function leave(el) {
  // 强制一次回流，让浏览器认下起始高度，否则不会过渡
  void el.offsetHeight
  el.style.height = '0px'
  el.style.opacity = '0'
}
</script>

<template>
  <GCard
    class="gift"
    :class="{ 'is-primary': primary }"
    padding="none"
    radius="xl"
    :tone="primary ? 'rose' : 'surface'"
  >
    <span v-if="primary" class="gift__badge">首选</span>

    <div class="gift__inner">
      <!-- ── 头部：emoji / 名称 / 契合度 ── -->
      <div class="gift__head">
        <span class="gift__emoji">{{ emoji }}</span>

        <div class="gift__title">
          <p class="gift__name">{{ name }}</p>
          <GChip v-if="category" class="gift__cat" size="sm" :tone="categoryTone" tabindex="-1">
            {{ category }}
          </GChip>
        </div>

        <div v-if="hasScore" class="score">
          <svg class="score__svg" viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <circle class="score__track" cx="22" cy="22" r="19" stroke-width="3" />
            <circle
              class="score__fill"
              cx="22"
              cy="22"
              r="19"
              stroke-width="3"
              stroke-linecap="round"
              pathLength="100"
              :stroke-dasharray="`${score} 100`"
            />
          </svg>
          <span class="score__num">{{ score }}</span>
          <span class="score__cap">契合度</span>
        </div>
      </div>

      <!-- ── 为什么是它 ── -->
      <p v-if="why" class="gift__why">{{ why }}</p>

      <!-- ── 价格 / 备货 ── -->
      <div v-if="price || leadTime" class="gift__meta">
        <span v-if="price" class="gift__price">{{ price }}</span>
        <span v-if="price && leadTime" class="gift__dot" />
        <span v-if="leadTime" class="gift__lead">
          <GIcon name="clock" :size="13" />
          {{ leadTime }}
        </span>
      </div>

      <!-- ── 标签 ── -->
      <div v-if="tags.length" class="gift__tags">
        <span v-for="(t, i) in tags" :key="`${t}-${i}`" class="gift__tag">{{ t }}</span>
      </div>

      <!-- ── 底部一行 ── -->
      <div class="gift__foot">
        <button
          class="like tap"
          :class="{ 'is-on': liked }"
          type="button"
          :aria-pressed="liked ? 'true' : 'false'"
          :aria-label="liked ? '取消收藏' : '收藏这件礼物'"
          @click="onLike"
        >
          <GIcon name="heart" :size="17" />
          <span class="like__text">{{ liked ? '已收藏' : '收藏' }}</span>
        </button>

        <button
          v-if="tip"
          class="tipbtn tap"
          :class="{ 'is-open': tipOpen }"
          type="button"
          :aria-expanded="tipOpen ? 'true' : 'false'"
          @click="toggleTip"
        >
          <span>怎么送更好</span>
          <GIcon name="chevronDown" :size="15" />
        </button>
      </div>

      <Transition
        name="tip"
        @before-enter="beforeEnter"
        @enter="enter"
        @after-enter="afterEnter"
        @before-leave="beforeLeave"
        @leave="leave"
      >
        <div v-if="tip && tipOpen" class="tip">
          <div class="tip__inner">
            <p class="tip__label">实操建议</p>
            <p class="tip__text">{{ tip }}</p>
          </div>
        </div>
      </Transition>
    </div>
  </GCard>
</template>

<style scoped>
.gift {
  position: relative;
}
.gift.is-primary {
  box-shadow: var(--sh-2);
}

.gift__badge {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  padding: 5px 12px 6px;
  border-radius: var(--r-lg) 0 var(--r-md) 0;
  background: var(--g-primary);
  color: var(--c-ink-inverse);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  line-height: 1;
}

.gift__inner {
  padding: var(--s-5);
}
.gift.is-primary .gift__inner {
  padding-top: var(--s-7);
}

/* ── 头部 ─────────────────────────────────── */
.gift__head {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
}

.gift__emoji {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  background: var(--c-surface);
  box-shadow: var(--sh-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
}
.gift.is-primary .gift__emoji {
  width: 56px;
  height: 56px;
  font-size: 30px;
}

.gift__title {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}
.gift__name {
  font-size: var(--fs-h3);
  font-weight: 500;
  line-height: 1.4;
  color: var(--c-ink);
  word-break: break-word;
}
.gift.is-primary .gift__name {
  font-family: var(--f-serif);
  font-size: var(--fs-h2);
}
.gift__cat {
  margin-top: var(--s-2);
  pointer-events: none;
}

/* ── 契合度环 ─────────────────────────────── */
.score {
  position: relative;
  flex-shrink: 0;
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score__svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
.score__track {
  stroke: var(--c-line);
}
.gift.is-primary .score__track {
  stroke: var(--c-rose-soft);
}
.score__fill {
  stroke: var(--c-rose);
  transition: stroke-dasharray var(--t-slow) var(--e-out);
}
.score__num {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--f-display);
  font-size: var(--fs-sm);
  color: var(--c-rose-deep);
}
.score__cap {
  margin-top: 2px;
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
  white-space: nowrap;
}

/* ── 正文 ─────────────────────────────────── */
.gift__why {
  margin-top: var(--s-4);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

.gift__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-4);
}
.gift__price {
  font-family: var(--f-display);
  font-size: var(--fs-h3);
  color: var(--c-sand-deep);
  letter-spacing: 0.01em;
}
.gift__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--c-ink-4);
}
.gift__lead {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
  min-width: 0;
}

.gift__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--s-3);
}
.gift__tag {
  padding: 3px 9px;
  border-radius: var(--r-pill);
  background: var(--c-paper-2);
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  line-height: 1.6;
}
.gift.is-primary .gift__tag {
  background: var(--c-surface);
}

/* ── 底部一行 ─────────────────────────────── */
.gift__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  margin-top: var(--s-4);
  padding-top: var(--s-3);
  border-top: 1px solid var(--c-line);
}

.like {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding-right: var(--s-3);
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
  transition: color var(--t-fast) var(--e-out);
}
.like.is-on {
  color: var(--c-rose);
}
.like.is-on :deep(svg) {
  fill: currentColor;
  animation: pop var(--t-base) var(--e-spring);
}
.like__text {
  white-space: nowrap;
}

.tipbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding-left: var(--s-3);
  color: var(--c-rose-deep);
  font-size: var(--fs-caption);
  white-space: nowrap;
}
.tipbtn :deep(svg) {
  transition: transform var(--t-base) var(--e-out);
}
.tipbtn.is-open :deep(svg) {
  transform: rotate(180deg);
}

@keyframes pop {
  0% {
    transform: scale(0.7);
  }
  60% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}

/* ── 小贴士展开 ───────────────────────────── */
.tip {
  overflow: hidden;
}
.tip__inner {
  margin-top: var(--s-3);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-paper-2);
}
.gift.is-primary .tip__inner {
  background: var(--c-surface);
}
.tip__label {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-4);
}
.tip__text {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

.tip-enter-active,
.tip-leave-active {
  transition: height var(--t-base) var(--e-out), opacity var(--t-base) var(--e-out);
}

@media (prefers-reduced-motion: reduce) {
  .like.is-on :deep(svg) {
    animation: none;
  }
}
</style>
