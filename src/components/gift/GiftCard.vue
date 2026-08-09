<script setup>
/**
 * GiftCard —— 一件礼物推荐
 *
 * 首选（primary）视觉更重：玫瑰底 + 角标 + 更大的 emoji 与契合度环。
 * 收藏与「怎么送更好」都在卡片底部一行，展开用高度过渡，不跳版。
 * gift 里任何字段缺失都有兜底文案，不会渲染出 undefined。
 */
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'
import { gsap } from 'gsap'
import { toArray } from '@/utils/helpers'
import { REDUCED_MOTION_QUERY } from '@/utils/motion'
import {
  rawEvidenceEntries,
  rawScoreEntries,
  recommendationExplanation,
} from '@/utils/recommendationExplain'

const props = defineProps({
  gift: { type: Object, default: () => ({}) },
  primary: Boolean,
  liked: Boolean,
  locked: Boolean,
  selected: Boolean,
  selecting: Boolean,
  selectionBusy: Boolean,
  replacing: Boolean,
})

const emit = defineEmits(['toggle-like', 'toggle-lock', 'replace', 'choose'])

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
const selectionKey = computed(() => (
  g.value.catalogId || g.value.id || (name.value ? `legacy:${name.value}` : '')
))
const category = computed(() => text(g.value.category))
const categoryTone = computed(() => CATEGORY_TONE[category.value] || 'default')
const tip = computed(() => text(g.value.tip))
const tags = computed(() =>
  toArray(g.value.tags)
    .map(text)
    .filter(Boolean)
    .slice(0, 3),
)

const DIMENSION_META = [
  ['recommendation', '推荐度'],
  ['fit', '适配度'],
  ['distinctiveness', '特别度'],
  ['feasibility', '可执行度'],
]

const awards = computed(() =>
  toArray(g.value.awards)
    .map(text)
    .filter((award) => Boolean(award) && award !== text(g.value.rankingLabel)),
)

const dimensions = computed(() => {
  const source = g.value.dimensionScores
  if (!source || typeof source !== 'object') return []
  return DIMENSION_META.map(([key, label]) => ({
    key,
    label,
    value: Math.min(100, Math.max(0, Math.round(Number(source[key]) || 0))),
  }))
})

const score = computed(() => {
  const n = Number(
    g.value.rankingScore
      ?? g.value.dimensionScores?.[g.value.rankingDimension]
      ?? g.value.dimensionScores?.recommendation
      ?? g.value.matchScore,
  )
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
})
const hasScore = computed(() => score.value > 0)
const scoreCaption = computed(() => text(g.value.rankingLabel) || '推荐度')
const explanation = computed(() => recommendationExplanation(g.value))
const rawScores = computed(() => rawScoreEntries(g.value.scoreBreakdown))
const rawEvidence = computed(() => rawEvidenceEntries(g.value.matchedEvidence))
const hasRawEvidence = computed(() => (
  hasScore.value
  || dimensions.value.length > 0
  || rawScores.value.length > 0
  || rawEvidence.value.length > 0
))

const tipOpen = ref(false)
const cardRef = ref(null)

function cardElement() {
  return cardRef.value?.$el || cardRef.value
}

watch(
  () => props.selected,
  async (selected) => {
    if (!selected) return
    await nextTick()
    const card = cardElement()
    if (!card || window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return
    const marker = card.querySelector('.gift__selected-state')
    gsap.killTweensOf([card, marker].filter(Boolean))
    const timeline = gsap.timeline()
    timeline.fromTo(
      card,
      { scale: 0.988, transformOrigin: '50% 55%' },
      { scale: 1, duration: 0.38, ease: 'back.out(1.7)', clearProps: 'transform' },
    )
    if (marker) {
      timeline.fromTo(
        marker,
        { autoAlpha: 0, y: -5 },
        { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,visibility,transform' },
        0.04,
      )
    }
  },
)

onUnmounted(() => {
  const card = cardElement()
  if (card) gsap.killTweensOf([card, card.querySelector('.gift__selected-state')].filter(Boolean))
})

function toggleTip() {
  tipOpen.value = !tipOpen.value
}

function onLike() {
  const id = g.value.catalogId || g.value.id
  if (!id) return
  emit('toggle-like', id)
}

function onLock() {
  const id = g.value.catalogId || g.value.id
  if (id) emit('toggle-lock', id)
}

function onReplace() {
  const id = g.value.catalogId || g.value.id
  if (id && !props.locked && !props.replacing) emit('replace', id)
}

function onSelect() {
  if (selectionKey.value && !props.selectionBusy) emit('choose', g.value)
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
    ref="cardRef"
    class="gift"
    :class="{ 'is-primary': primary, 'is-selected': selected, 'is-selecting': selecting }"
    padding="none"
    radius="xl"
    :tone="primary ? 'rose' : 'surface'"
  >
    <span v-if="primary" class="gift__badge">首选</span>
    <span v-if="selected" class="gift__selected-state" aria-live="polite">
      <GIcon name="check" :size="13" />
      已选中
    </span>

    <div class="gift__inner">
      <!-- ── 头部：emoji / 名称 / 契合度 ── -->
      <div class="gift__head">
        <span class="gift__emoji">{{ emoji }}</span>

        <div class="gift__title">
          <p class="gift__name">{{ name }}</p>
          <GChip v-if="category" class="gift__cat" size="sm" :tone="categoryTone" :interactive="false">
            {{ category }}
          </GChip>
        </div>

      </div>

      <div v-if="awards.length" class="gift__awards" aria-label="推荐榜单标签">
        <span v-for="award in awards" :key="award">{{ award }}</span>
      </div>

      <div class="gift__explanation">
        <section class="explain-block explain-block--fit">
          <h4>为什么适合 TA</h4>
          <p>{{ explanation.fitReason }}</p>
        </section>

        <section v-if="explanation.matchedDetails.length" class="explain-block">
          <h4>命中了你说的哪些细节</h4>
          <ul class="matched-list">
            <li v-for="detail in explanation.matchedDetails" :key="detail">{{ detail }}</li>
          </ul>
        </section>

        <section class="explain-block explain-block--risk">
          <h4>可能踩雷的地方</h4>
          <ul>
            <li v-for="caveat in explanation.caveats" :key="caveat">{{ caveat }}</li>
          </ul>
        </section>

        <section class="explain-block">
          <h4>价格与准备时间</h4>
          <div class="gift__meta">
            <span class="gift__price">{{ explanation.price }}</span>
            <span class="gift__dot" />
            <span class="gift__lead">
              <GIcon name="clock" :size="13" />
              {{ explanation.leadTime }}
            </span>
          </div>
        </section>
      </div>

      <details v-if="hasRawEvidence" class="raw-evidence">
        <summary>
          <span>查看原始推荐依据</span>
          <GIcon name="chevronDown" :size="15" />
        </summary>
        <div class="raw-evidence__body">
          <p v-if="hasScore" class="raw-evidence__score">{{ scoreCaption }} {{ score }} 分</p>
          <div v-if="dimensions.length" class="gift__dimensions" aria-label="多维评分">
            <div v-for="dimension in dimensions" :key="dimension.key" class="gift__dimension">
              <span>{{ dimension.label }}</span>
              <strong>{{ dimension.value }}</strong>
              <i aria-hidden="true"><b :style="{ width: `${dimension.value}%` }"></b></i>
            </div>
          </div>
          <dl v-if="rawScores.length" class="raw-list">
            <div v-for="entry in rawScores" :key="entry.key">
              <dt>{{ entry.label }}</dt>
              <dd>{{ entry.value > 0 ? '+' : '' }}{{ entry.value }}</dd>
            </div>
          </dl>
          <dl v-if="rawEvidence.length" class="raw-matches">
            <div v-for="entry in rawEvidence" :key="entry.key">
              <dt>{{ entry.label }}</dt>
              <dd>{{ entry.values.join('、') }}</dd>
            </div>
          </dl>
          <div v-if="tags.length" class="gift__tags">
            <span v-for="(t, i) in tags" :key="`${t}-${i}`" class="gift__tag">{{ t }}</span>
          </div>
        </div>
      </details>

      <button
        class="choose tap"
        :class="{ 'is-selected': selected, 'is-loading': selecting }"
        type="button"
        :data-gift-key="selectionKey"
        :disabled="selectionBusy"
        :aria-busy="selecting ? 'true' : 'false'"
        :aria-pressed="selected ? 'true' : 'false'"
        @click="onSelect"
      >
        <span>{{ selecting ? '正在为它整理送出方案…' : selected ? '已选中，查看送出方案' : '选它，继续生成送出方案' }}</span>
        <span v-if="selecting" class="choose__pulse" aria-hidden="true"><i /><i /><i /></span>
        <GIcon v-else name="arrowRight" :size="17" />
      </button>

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
          class="like tap"
          :class="{ 'is-on': locked }"
          type="button"
          :aria-pressed="locked ? 'true' : 'false'"
          @click="onLock"
        >
          <GIcon :name="locked ? 'check' : 'bookmark'" :size="16" />
          <span class="like__text">{{ locked ? '已保留' : '保留' }}</span>
        </button>

        <button
          class="replace tap"
          type="button"
          :disabled="locked || replacing"
          @click="onReplace"
        >
          <GIcon name="refresh" :size="15" />
          <span>{{ replacing ? '替换中…' : locked ? '已锁定' : '换一个' }}</span>
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
.gift.is-selected {
  box-shadow: 0 0 0 2px var(--c-sage-deep, var(--c-ink)), var(--sh-2);
}
.gift.is-selecting {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-rose) 55%, var(--c-line)), var(--sh-2);
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

.gift__selected-state {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 2;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: var(--r-pill);
  background: var(--c-sage-deep, var(--c-ink));
  color: var(--c-paper);
  font-size: var(--fs-micro);
  font-weight: 700;
}

.gift__awards {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--s-3);
}
.gift__awards span {
  padding: 4px 9px;
  border-radius: var(--r-pill);
  background: var(--c-sand-soft);
  color: var(--c-sand-deep);
  font-size: var(--fs-micro);
  font-weight: 650;
}

.gift__explanation {
  display: grid;
  gap: var(--s-3);
  margin-top: var(--s-4);
}
.explain-block {
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--c-surface) 88%, transparent);
}
.explain-block--fit {
  border-color: color-mix(in srgb, var(--c-rose) 22%, var(--c-line));
}
.explain-block--risk {
  background: color-mix(in srgb, var(--c-sand-soft) 42%, var(--c-surface));
}
.explain-block h4 {
  margin: 0 0 6px;
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  font-weight: 700;
  letter-spacing: var(--ls-wide);
}
.explain-block p,
.explain-block li {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
}
.explain-block ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 1.15em;
}
.matched-list {
  list-style: none;
  padding-left: 0 !important;
}
.matched-list li::before {
  content: '“';
  color: var(--c-rose-deep);
  font-family: var(--f-serif);
}
.matched-list li::after {
  content: '”';
  color: var(--c-rose-deep);
  font-family: var(--f-serif);
}

.gift__dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-2);
  margin-top: var(--s-4);
  padding: var(--s-3);
  border-radius: var(--r-md);
  background: var(--c-paper-2);
}
.gift.is-primary .gift__dimensions {
  background: var(--c-surface);
}
.gift__dimension {
  min-width: 0;
}
.gift__dimension > span,
.gift__dimension > strong {
  font-size: var(--fs-micro);
}
.gift__dimension > span {
  color: var(--c-ink-3);
}
.gift__dimension > strong {
  float: right;
  color: var(--c-rose-deep);
  font-variant-numeric: tabular-nums;
}
.gift__dimension i {
  height: 4px;
  display: block;
  clear: both;
  margin-top: 5px;
  overflow: hidden;
  border-radius: var(--r-pill);
  background: var(--c-line);
}
.gift__dimension b {
  height: 100%;
  display: block;
  border-radius: inherit;
  background: var(--c-rose);
}

.raw-evidence {
  margin-top: var(--s-3);
  border-top: 1px solid var(--c-line);
  border-bottom: 1px solid var(--c-line);
}
.raw-evidence summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-ink-3);
  cursor: pointer;
  font-size: var(--fs-caption);
  list-style: none;
}
.raw-evidence summary::-webkit-details-marker {
  display: none;
}
.raw-evidence summary :deep(svg) {
  transition: transform var(--t-base) var(--e-out);
}
.raw-evidence[open] summary :deep(svg) {
  transform: rotate(180deg);
}
.raw-evidence__body {
  padding: 0 0 var(--s-4);
}
.raw-evidence__score {
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.raw-list,
.raw-matches {
  display: grid;
  gap: 7px;
  margin-top: var(--s-3);
}
.raw-list > div,
.raw-matches > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s-3);
}
.raw-list dt,
.raw-list dd,
.raw-matches dt,
.raw-matches dd {
  margin: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  line-height: 1.55;
}
.raw-list dd {
  color: var(--c-rose-deep);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.raw-matches dd {
  max-width: 64%;
  text-align: right;
}

.choose {
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  margin-top: var(--s-4);
  padding: 0 var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-ink);
  color: var(--c-paper);
  font-size: var(--fs-sm);
  font-weight: 700;
  transition: transform var(--t-fast) var(--e-out), background-color var(--t-fast) var(--e-out);
}
.choose:active {
  transform: scale(0.985);
}
.choose.is-selected {
  background: var(--c-sage-deep, var(--c-ink));
}
.choose:disabled {
  cursor: wait;
  opacity: 0.62;
}
.choose.is-loading {
  opacity: 1;
}
.choose__pulse {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.choose__pulse i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: choose-pulse 0.9s ease-in-out infinite;
}
.choose__pulse i:nth-child(2) {
  animation-delay: 0.12s;
}
.choose__pulse i:nth-child(3) {
  animation-delay: 0.24s;
}
.choose:focus-visible {
  outline: 2px solid var(--c-rose);
  outline-offset: 3px;
}

@keyframes choose-pulse {
  0%, 70%, 100% { opacity: 0.35; transform: translateY(0); }
  35% { opacity: 1; transform: translateY(-2px); }
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

.replace {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  min-width: 44px;
  min-height: 44px;
  justify-content: flex-end;
  color: var(--c-rose-deep);
  font-size: var(--fs-micro);
}
.replace:disabled {
  color: var(--c-ink-4);
  cursor: not-allowed;
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
  .choose__pulse i {
    animation: none;
    opacity: 0.75;
  }
  .like.is-on :deep(svg) {
    animation: none;
  }
}
</style>
