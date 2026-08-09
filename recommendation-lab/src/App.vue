<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import PreferenceForm from './components/PreferenceForm.vue'
import StackedCardCarousel from './components/StackedCardCarousel.vue'
import { evaluateRecommendations, submitRecommendationFeedback } from './api.js'
import { createRequestId, numericScore, topScoreSources } from './utils/recommendation.js'

const loading = ref(false)
const errorMessage = ref('')
const result = ref(null)
const requestId = ref('')
const currentAnswers = ref(null)
const selectedCandidate = ref(null)
const feedbackComment = ref('')
const feedbackState = ref('idle')
const feedbackError = ref('')
const feedbackId = ref('')
const resultsSection = ref(null)
const selectionSection = ref(null)
const activeGroupKey = ref('')

const exclusionLabels = {
  excluded_by_request: '已被本次请求排除',
  wrong_kind: '礼物类型不符合当前选择',
  over_budget: '价格超过预算',
  not_enough_time: '准备时间来不及',
  taboo: '命中明确避开项',
  unsuitable_recipient: '不适合当前送礼对象',
  wrong_recipient: '送礼对象标签不匹配',
  recipient_age_required: '需要确认收礼人年龄',
  recipient_too_young: '不适合未成年人',
  wrong_age: '适用年龄不匹配',
  participants_adult_confirmation_required: '需要确认参与者全部成年',
  city_tier_required: '需要选择活动城市层级',
  wrong_city_tier: '活动城市层级不匹配',
}

const excludedEntries = computed(() => {
  const counts = result.value?.excludedCounts
  if (!counts || typeof counts !== 'object') return []
  return Object.entries(counts).filter(([, count]) => Number(count) > 0)
})

const recommendationGroups = computed(() => {
  const groups = result.value?.recommendationGroups
  if (Array.isArray(groups) && groups.length) return groups
  const candidates = result.value?.candidates
  if (!Array.isArray(candidates) || !candidates.length) return []
  return [{
    key: 'recommendation',
    title: '最推荐',
    description: '综合考虑所有条件后最稳妥的三个方案。',
    candidates,
  }]
})

const activeGroup = computed(() => (
  recommendationGroups.value.find((group) => group.key === activeGroupKey.value)
  || recommendationGroups.value[0]
  || null
))

const rankingPlacements = computed(() => recommendationGroups.value.reduce(
  (total, group) => total + (Array.isArray(group.candidates) ? group.candidates.length : 0),
  0,
))

watch(recommendationGroups, (groups) => {
  if (!groups.some((group) => group.key === activeGroupKey.value)) {
    activeGroupKey.value = groups[0]?.key || ''
  }
})

function exclusionLabel(reason) {
  return exclusionLabels[reason] || `其他原因（${reason}）`
}

const selectedSources = computed(() => topScoreSources(selectedCandidate.value?.scoreBreakdown, 3))

function scrollTo(element) {
  if (!element) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

function resetEvaluation() {
  errorMessage.value = ''
  result.value = null
  requestId.value = ''
  currentAnswers.value = null
  selectedCandidate.value = null
  feedbackComment.value = ''
  feedbackState.value = 'idle'
  feedbackError.value = ''
  feedbackId.value = ''
  activeGroupKey.value = ''
}

async function evaluate(answers) {
  loading.value = true
  errorMessage.value = ''
  result.value = null
  selectedCandidate.value = null
  feedbackComment.value = ''
  feedbackState.value = 'idle'
  feedbackError.value = ''
  feedbackId.value = ''
  requestId.value = createRequestId()
  currentAnswers.value = answers

  await nextTick()
  scrollTo(resultsSection.value)

  try {
    const payload = await evaluateRecommendations(requestId.value, answers)
    if (!payload || (!Array.isArray(payload.recommendationGroups) && !Array.isArray(payload.candidates))) {
      throw new Error('服务器返回的数据格式不完整，请检查推荐接口。')
    }
    result.value = payload
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '推荐请求失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function retry() {
  if (currentAnswers.value) await evaluate(currentAnswers.value)
}

async function selectCandidate(candidate) {
  selectedCandidate.value = {
    ...candidate,
    selectedRankingKey: activeGroup.value?.key || candidate.rankingDimension,
    selectedRankingLabel: activeGroup.value?.title || candidate.rankingLabel || '最推荐',
    selectedRankingScore: candidate.rankingScore
      ?? candidate.dimensionScores?.[activeGroup.value?.key]
      ?? candidate.score,
  }
  feedbackState.value = 'idle'
  feedbackError.value = ''
  feedbackId.value = ''
  await nextTick()
  scrollTo(selectionSection.value)
}

async function submitFeedback() {
  if (!selectedCandidate.value || !result.value) return
  feedbackState.value = 'saving'
  feedbackError.value = ''

  try {
    const payload = await submitRecommendationFeedback({
      requestId: result.value.requestId || requestId.value,
      selectedCatalogId: selectedCandidate.value.catalogId,
      selectedRank: selectedCandidate.value.rank,
      selectedScore: selectedCandidate.value.selectedRankingScore,
      comment: feedbackComment.value.trim(),
      answers: currentAnswers.value,
      candidateIds: [...new Set(
        recommendationGroups.value.flatMap((group) => (
          group.candidates || []
        ).map((candidate) => candidate.catalogId)),
      )],
    })
    if (!payload?.saved) throw new Error('服务器没有确认保存成功。')
    feedbackState.value = 'saved'
    feedbackId.value = payload.feedbackId || ''
  } catch (error) {
    feedbackState.value = 'error'
    feedbackError.value = error instanceof Error ? error.message : '反馈提交失败，请稍后重试。'
  }
}

function formatScore(score) {
  return Math.round(numericScore(score) * 10) / 10
}
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#top" aria-label="回到 GiftMind 推荐测试台顶部">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28">
            <path d="M5 11h18v12H5zM4 11h20M14 11v12M5 15h18M9 11c-3.2 0-4.5-1.5-4.5-3.6C4.5 5.5 6 4 8 4c3 0 5.1 3.2 6 7M19 11c3.2 0 4.5-1.5 4.5-3.6C23.5 5.5 22 4 20 4c-3 0-5.1 3.2-6 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span>GiftMind <small>Recommendation Lab</small></span>
      </a>
      <span class="lab-badge">本地测试</span>
    </header>

    <main id="top">
      <section class="intro-section">
        <p class="eyebrow">推荐命中测试台</p>
        <h1>看看它有没有<br />真正听懂你的意思</h1>
        <p class="intro-copy">先用选择题描述 TA，再分别查看“最推荐、最合适、最特别、最省心”四个榜单，每个榜单给你三个方案。</p>
      </section>

      <section class="panel form-panel" aria-labelledby="form-heading">
        <div class="section-heading">
          <span>01</span>
          <div>
            <p class="eyebrow">描述这次送礼</p>
            <h2 id="form-heading">尽量选择，少量补充</h2>
          </div>
        </div>
        <PreferenceForm :loading="loading" @submit="evaluate" @reset="resetEvaluation" />
      </section>

      <section ref="resultsSection" class="results-stage" aria-labelledby="results-heading" aria-busy="loading">
        <div class="section-heading results-title">
          <span>02</span>
          <div>
            <p class="eyebrow">浏览并理解推荐</p>
            <h2 id="results-heading">四类榜单与评分</h2>
          </div>
        </div>

        <div v-if="loading" class="loading-card" role="status" aria-live="polite">
          <div class="loading-visual skeleton"></div>
          <div class="loading-lines">
            <span class="skeleton"></span>
            <span class="skeleton"></span>
            <span class="skeleton"></span>
          </div>
          <div>
            <strong>正在生成四类推荐榜单</strong>
            <p>先过滤预算、年龄与禁忌，再按四个维度分别选出前三名。</p>
          </div>
        </div>

        <div v-else-if="errorMessage" class="state-card state-card--error" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8v5M12 17h.01M10.3 4.8 3.2 17.1A2 2 0 0 0 4.9 20h14.2a2 2 0 0 0 1.7-2.9L13.7 4.8a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <h3>推荐接口没有完成请求</h3>
          <p>{{ errorMessage }}</p>
          <button type="button" class="secondary-button" @click="retry">重新尝试</button>
        </div>

        <template v-else-if="result">
          <div class="result-meta" aria-label="候选统计">
            <div><strong>{{ result.catalogCount ?? '—' }}</strong><span>礼物总数</span></div>
            <div><strong>{{ result.eligibleCount ?? '—' }}</strong><span>通过硬过滤</span></div>
            <div><strong>{{ recommendationGroups.length }}</strong><span>推荐榜单</span></div>
            <div><strong>{{ rankingPlacements }}</strong><span>榜单席位</span></div>
          </div>

          <details v-if="excludedEntries.length" class="exclusion-details">
            <summary>查看排除统计</summary>
            <dl>
              <div v-for="([reason, count]) in excludedEntries" :key="reason">
                <dt>{{ exclusionLabel(reason) }}</dt>
                <dd>{{ count }}</dd>
              </div>
            </dl>
          </details>

          <template v-if="activeGroup?.candidates?.length">
            <div class="ranking-tabs" role="tablist" aria-label="选择推荐标准">
              <button
                v-for="group in recommendationGroups"
                :key="group.key"
                type="button"
                role="tab"
                :aria-selected="activeGroup.key === group.key"
                :class="{ 'is-active': activeGroup.key === group.key }"
                @click="activeGroupKey = group.key"
              >
                <span>{{ group.title }}</span>
                <small>{{ group.candidates.length }} 个</small>
              </button>
            </div>

            <StackedCardCarousel
              :key="activeGroup.key"
              :candidates="activeGroup.candidates"
              :selected-id="selectedCandidate?.catalogId"
              :eyebrow="activeGroup.title"
              :heading="activeGroup.description"
              :note="`本榜按“${activeGroup.title}”对应分数独立排序；同一方案也可能进入其他榜单。`"
              :score-key="activeGroup.key"
              :score-label="activeGroup.title"
              @select="selectCandidate"
            />
          </template>

          <div v-else class="state-card">
            <h3>这组条件暂时没有候选</h3>
            <p>这不是自动放宽安全条件。请回到表单调整预算、年龄或活动城市层级后重新测试。</p>
          </div>
        </template>

        <div v-else class="state-card state-card--quiet">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M7 13h18v13H7zM5 13h22M16 13v13M7 18h18M11 13c-3 0-4.5-1.5-4.5-3.5S8 6 10 6c3 0 5 3.2 6 7M21 13c3 0 4.5-1.5 4.5-3.5S24 6 22 6c-3 0-5 3.2-6 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <h3>推荐结果会出现在这里</h3>
          <p>完成上方选择后，系统会展示每件礼物为什么入选，以及它的具体得分。</p>
        </div>
      </section>

      <section
        v-if="selectedCandidate"
        ref="selectionSection"
        class="panel selection-panel"
        aria-labelledby="selection-heading"
      >
        <div class="section-heading">
          <span>03</span>
          <div>
            <p class="eyebrow">明确选中与反馈</p>
            <h2 id="selection-heading">你选中了这个方案</h2>
          </div>
        </div>

        <div class="selection-summary">
          <div class="selection-score">
            <strong>{{ formatScore(selectedCandidate.selectedRankingScore ?? selectedCandidate.score) }}</strong>
            <span>{{ selectedCandidate.selectedRankingLabel || '推荐度' }}</span>
          </div>
          <div>
            <span class="selection-rank">第 {{ selectedCandidate.rank }} 名</span>
            <h3>{{ selectedCandidate.name }}</h3>
            <p>{{ selectedCandidate.priceText || '价格待确认' }}</p>
          </div>
        </div>

        <div class="source-summary">
          <h3>主要得分来源</h3>
          <ul v-if="selectedSources.length">
            <li v-for="source in selectedSources" :key="source.key">
              <span>{{ source.label }}</span>
              <strong>+{{ Math.round(source.value * 10) / 10 }}</strong>
            </li>
          </ul>
          <p v-else>接口暂未返回可计算的分项得分。</p>
        </div>

        <form class="feedback-form" @submit.prevent="submitFeedback">
          <label class="control control--detail">
            <span>你的反馈 <i>可选</i></span>
            <textarea
              v-model.trim="feedbackComment"
              rows="4"
              maxlength="500"
              :disabled="feedbackState === 'saving' || feedbackState === 'saved'"
              placeholder="例如：礼物方向对了，但没有理解“低调”是指不公开表达，而不是不能定制。"
            ></textarea>
            <small>{{ feedbackComment.length }}/500</small>
          </label>

          <p v-if="feedbackError" class="form-error" role="alert">{{ feedbackError }}</p>
          <p v-if="feedbackState === 'saved'" class="feedback-success" role="status">
            反馈已保存<span v-if="feedbackId"> · 编号 {{ feedbackId }}</span>
          </p>

          <button class="primary-button" type="submit" :disabled="feedbackState === 'saving' || feedbackState === 'saved'">
            <svg v-if="feedbackState === 'saving'" class="spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42 16" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12.5 9 17l11-11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ feedbackState === 'saved' ? '反馈已提交' : feedbackState === 'saving' ? '正在保存…' : '提交这次选择' }}
          </button>
        </form>
      </section>
    </main>

    <footer>
      <span>GiftMind Recommendation Lab</span>
      <span>浏览不等于偏好，明确选择才会被记录。</span>
    </footer>
  </div>
</template>
