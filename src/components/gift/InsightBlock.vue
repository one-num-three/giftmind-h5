<script setup>
/**
 * InsightBlock —— AI 洞察
 * summary 用衬线排版讲人话，traits 是一排只读标签，keyPoint 用引文竖线单独强调。
 * 任何字段缺失都只是少一块，不会白屏。
 */
import { computed } from 'vue'

const props = defineProps({
  insight: { type: Object, default: () => ({}) },
})

/** 标签配色轮换，避免一排同色 */
const TRAIT_TONES = ['lilac', 'sage', 'sand', 'sky']

function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const summary = computed(() => text(props.insight?.summary))
const keyPoint = computed(() => text(props.insight?.keyPoint))
const traits = computed(() => {
  const list = Array.isArray(props.insight?.traits) ? props.insight.traits : []
  return list.map(text).filter(Boolean).slice(0, 6)
})

const hasAny = computed(() => Boolean(summary.value || keyPoint.value || traits.value.length))

function toneOf(i) {
  return TRAIT_TONES[i % TRAIT_TONES.length]
}
</script>

<template>
  <GCard v-if="hasAny" class="insight" padding="none" radius="xl">
    <div class="insight__inner">
      <p class="insight__eyebrow">
        <GIcon name="sparkle" :size="13" />
        <span>AI 读到的 TA</span>
      </p>

      <p v-if="summary" class="insight__summary">{{ summary }}</p>

      <div v-if="traits.length" class="insight__traits">
        <GChip
          v-for="(t, i) in traits"
          :key="`${t}-${i}`"
          class="insight__chip"
          size="sm"
          :tone="toneOf(i)"
          tabindex="-1"
        >
          {{ t }}
        </GChip>
      </div>

      <blockquote v-if="keyPoint" class="insight__key">{{ keyPoint }}</blockquote>
    </div>
  </GCard>
</template>

<style scoped>
.insight {
  position: relative;
}
.insight__inner {
  padding: var(--s-5);
}

.insight__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-rose);
}

.insight__summary {
  margin-top: var(--s-4);
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  line-height: var(--lh-loose);
  color: var(--c-ink);
  letter-spacing: 0.01em;
}

.insight__traits {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-5);
}
/* 只读标签：不给点击暗示 */
.insight__chip {
  pointer-events: none;
}

.insight__key {
  position: relative;
  margin-top: var(--s-5);
  padding: var(--s-1) 0 var(--s-1) var(--s-4);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}
.insight__key::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 2px;
  border-radius: var(--r-pill);
  background: var(--c-rose);
}
</style>
