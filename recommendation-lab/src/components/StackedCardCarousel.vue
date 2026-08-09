<script setup>
import { computed, ref, watch } from 'vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
import {
  clampIndex,
  dimensionEntries,
  dragDirection,
  humanExplanation,
  numericScore,
} from '../utils/recommendation.js'

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  selectedId: { type: [String, Number], default: null },
  eyebrow: { type: String, default: '推荐榜单' },
  heading: { type: String, default: '按当前维度选出的前三名' },
  note: { type: String, default: '左右滑动比较这三个方案，浏览本身不会被记录。' },
  scoreKey: { type: String, default: 'recommendation' },
  scoreLabel: { type: String, default: '最推荐' },
})

const emit = defineEmits(['select'])

const currentIndex = ref(0)
const dragX = ref(0)
const dragging = ref(false)
const pointerId = ref(null)
const startX = ref(0)
const failedImages = ref(new Set())

const activeCandidate = computed(() => props.candidates[currentIndex.value] || null)
const visibleCandidates = computed(() => props.candidates.slice(currentIndex.value, currentIndex.value + 3))

watch(
  () => props.candidates,
  () => {
    currentIndex.value = 0
    dragX.value = 0
    failedImages.value = new Set()
  },
)

function move(step) {
  currentIndex.value = clampIndex(currentIndex.value + step, props.candidates.length)
  dragX.value = 0
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, label, summary, details'))
}

function onPointerDown(event) {
  if (event.button !== 0 || isInteractiveTarget(event.target)) return
  pointerId.value = event.pointerId
  startX.value = event.clientX
  dragX.value = 0
  dragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging.value || event.pointerId !== pointerId.value) return
  dragX.value = event.clientX - startX.value
}

function finishPointer(event) {
  if (!dragging.value || event.pointerId !== pointerId.value) return
  const threshold = Math.min(88, Math.max(48, event.currentTarget.clientWidth * 0.14))
  const direction = dragDirection(dragX.value, threshold)
  dragging.value = false
  pointerId.value = null
  if (direction === 1 && currentIndex.value < props.candidates.length - 1) move(1)
  else if (direction === -1 && currentIndex.value > 0) move(-1)
  else dragX.value = 0
}

function cancelPointer() {
  dragging.value = false
  pointerId.value = null
  dragX.value = 0
}

function cardStyle(offset) {
  if (offset === 0) {
    const opacity = Math.max(0.72, 1 - Math.abs(dragX.value) / 520)
    return {
      zIndex: 30,
      opacity,
      transform: `translate3d(${dragX.value}px, 0, 0) rotate(${dragX.value / 42}deg)`,
    }
  }

  const progress = Math.min(1, Math.max(0, -dragX.value / 150))
  const baseX = offset === 1 ? 22 : 36
  const baseY = offset === 1 ? 13 : 24
  const baseScale = offset === 1 ? 0.965 : 0.93
  return {
    zIndex: 30 - offset,
    opacity: offset === 1 ? 0.92 : 0.64,
    transform: `translate3d(${baseX * (1 - progress)}px, ${baseY * (1 - progress)}px, 0) scale(${baseScale + (1 - baseScale) * progress})`,
  }
}

function markImageFailed(catalogId) {
  const next = new Set(failedImages.value)
  next.add(catalogId)
  failedImages.value = next
}

function hasImage(candidate) {
  return Boolean(candidate.imageUrl) && !failedImages.value.has(candidate.catalogId)
}

function formatScore(score) {
  return Math.round(numericScore(score) * 10) / 10
}

function rankingScore(candidate) {
  return formatScore(
    candidate.rankingScore
      ?? candidate.dimensionScores?.[props.scoreKey]
      ?? candidate.score,
  )
}

function dimensions(candidate) {
  return dimensionEntries(candidate)
}

function explanation(candidate) {
  return humanExplanation(candidate)
}

function visibleAwards(candidate) {
  return (candidate.awards || []).filter((award) => award !== props.scoreLabel)
}
</script>

<template>
  <section class="carousel-shell" aria-labelledby="carousel-heading">
    <div class="carousel-heading-row">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2 id="carousel-heading">{{ heading }}</h2>
      </div>
      <output class="carousel-counter" aria-live="polite">
        {{ currentIndex + 1 }} / {{ candidates.length }}
      </output>
    </div>

    <p class="carousel-note">{{ note }}</p>

    <div
      class="card-deck"
      :class="{ 'is-dragging': dragging }"
      role="group"
      aria-roledescription="轮播"
      aria-label="方案候选卡片"
      tabindex="0"
      @keydown.left.prevent="move(-1)"
      @keydown.right.prevent="move(1)"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="finishPointer"
      @pointercancel="cancelPointer"
    >
      <article
        v-for="(candidate, offset) in visibleCandidates"
        :key="candidate.catalogId"
        class="gift-card"
        :class="{ 'is-active': offset === 0, 'is-selected': selectedId === candidate.catalogId }"
        :style="cardStyle(offset)"
        :aria-hidden="offset > 0 ? 'true' : undefined"
      >
        <template v-if="offset === 0">
          <div class="gift-media">
            <img
              v-if="hasImage(candidate)"
              :src="candidate.imageUrl"
              :alt="`${candidate.name} 的商品图片`"
              draggable="false"
              @error="markImageFailed(candidate.catalogId)"
            />
            <div v-else class="gift-placeholder" role="img" :aria-label="`${candidate.name} 暂无图片`">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="M9 18h30v22H9zM7 18h34M24 18v22M8 25h32M16 18c-5 0-7-2-7-5 0-2.8 2.2-5 5-5 4.6 0 8.2 5.5 10 10M32 18c5 0 7-2 7-5 0-2.8-2.2-5-5-5-4.6 0-8.2 5.5-10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>暂无图片</span>
            </div>
            <span class="rank-badge">第 {{ candidate.rank || currentIndex + 1 }} 名</span>
            <span class="kind-badge">{{ candidate.kind === 'activity' ? '活动' : '商品' }}</span>
          </div>

          <div class="gift-card__body">
            <div class="gift-score-row">
              <div class="gift-title-block">
                <p>{{ candidate.category || '精选礼物' }}</p>
                <h3>{{ candidate.name }}</h3>
              </div>
            </div>

            <div v-if="visibleAwards(candidate).length" class="award-row" aria-label="其他榜单标签">
              <span v-for="award in visibleAwards(candidate)" :key="award">{{ award }}</span>
            </div>

            <p class="gift-description">{{ candidate.description || '暂无详细说明，请结合评分依据判断。' }}</p>

            <div class="human-reasons">
              <section>
                <h4>为什么适合 TA</h4>
                <p>{{ explanation(candidate).fitReason }}</p>
              </section>
              <section v-if="explanation(candidate).matchedDetails.length">
                <h4>命中了你说的哪些细节</h4>
                <ul class="human-reasons__facts">
                  <li v-for="fact in explanation(candidate).matchedDetails" :key="fact">{{ fact }}</li>
                </ul>
              </section>
              <section class="human-reasons__risk">
                <h4>可能踩雷的地方</h4>
                <ul>
                  <li v-for="caveat in explanation(candidate).caveats" :key="caveat">{{ caveat }}</li>
                </ul>
              </section>
              <section>
                <h4>价格与准备时间</h4>
                <p class="human-reasons__meta">
                  <strong>{{ explanation(candidate).price }}</strong>
                  <span>{{ explanation(candidate).leadTime }}</span>
                </p>
              </section>
            </div>

            <details class="score-details">
              <summary>
                <span>查看原始推荐依据</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m7 9 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </summary>
              <div class="raw-score-head">
                <span>{{ scoreLabel }}</span>
                <strong>{{ rankingScore(candidate) }} 分</strong>
              </div>
              <div v-if="dimensions(candidate).length" class="dimension-grid" aria-label="多维评分">
                <div v-for="dimension in dimensions(candidate)" :key="dimension.key" class="dimension-item">
                  <div>
                    <span>{{ dimension.label }}</span>
                    <strong>{{ dimension.value }}</strong>
                  </div>
                  <i aria-hidden="true"><b :style="{ width: `${dimension.value}%` }"></b></i>
                </div>
              </div>
              <ScoreBreakdown :candidate="candidate" />
            </details>

            <button
              class="primary-button select-button"
              type="button"
              :aria-pressed="selectedId === candidate.catalogId"
              @click="emit('select', candidate)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ selectedId === candidate.catalogId ? '已选中，查看送出方案' : '选它，继续生成送出方案' }}
            </button>
          </div>
        </template>
        <div v-else class="stack-card-back" aria-hidden="true">
          <span>{{ candidate.name }}</span>
        </div>
      </article>
    </div>

    <nav class="carousel-controls" aria-label="切换礼物">
      <button type="button" :disabled="currentIndex === 0" @click="move(-1)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        上一个
      </button>
      <button type="button" :disabled="currentIndex >= candidates.length - 1" @click="move(1)">
        下一个
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </nav>
  </section>
</template>
