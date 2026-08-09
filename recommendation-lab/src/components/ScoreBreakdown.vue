<script setup>
import { computed } from 'vue'
import { evidenceList, scoreEntries } from '../utils/recommendation.js'

const props = defineProps({
  candidate: { type: Object, required: true },
})

const entries = computed(() => scoreEntries(props.candidate.scoreBreakdown))
const evidence = computed(() => evidenceList(props.candidate))
const positiveMax = computed(() => Math.max(1, ...entries.value.map((item) => Math.max(0, item.value))))

function widthFor(value) {
  return `${Math.min(100, Math.max(3, (Math.max(0, value) / positiveMax.value) * 100))}%`
}

function formatValue(value) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}
</script>

<template>
  <section class="score-panel" aria-label="推荐评分依据">
    <div v-if="entries.length" class="score-list">
      <div v-for="entry in entries" :key="entry.key" class="score-row">
        <div class="score-row__label">
          <span>{{ entry.label }}</span>
          <strong :class="{ 'is-negative': entry.value < 0 }">{{ formatValue(entry.value) }}</strong>
        </div>
        <div class="score-track" aria-hidden="true">
          <span :class="{ 'is-negative': entry.value < 0 }" :style="{ width: widthFor(entry.value) }"></span>
        </div>
      </div>
    </div>
    <p v-else class="empty-detail">接口暂未返回分项评分。</p>

    <div v-if="evidence.length" class="evidence-block">
      <h4>命中证据</h4>
      <ul>
        <li v-for="item in evidence" :key="item">{{ item }}</li>
      </ul>
    </div>

    <div v-if="candidate.whyTemplate || candidate.tip" class="reason-block">
      <p v-if="candidate.whyTemplate"><strong>为什么推荐：</strong>{{ candidate.whyTemplate }}</p>
      <p v-if="candidate.tip"><strong>送礼提示：</strong>{{ candidate.tip }}</p>
    </div>
  </section>
</template>
