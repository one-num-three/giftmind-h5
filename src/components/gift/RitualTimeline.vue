<script setup>
/**
 * RitualTimeline —— 送出那一刻的仪式流程
 * 竖向时间线：左侧圆点 + 连接线，右侧时间胶囊 / 标题 / 说明。
 * 最后一步（真正递出去的那一下）用实心玫瑰点收尾。
 */
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
})

function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const list = computed(() => {
  const raw = Array.isArray(props.steps) ? props.steps : []
  return raw
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      time: text(s.time),
      title: text(s.title),
      desc: text(s.desc),
    }))
    .filter((s) => s.title || s.desc || s.time)
})
</script>

<template>
  <ol v-if="list.length" class="rt">
    <li
      v-for="(s, i) in list"
      :key="`${s.time}-${i}`"
      class="rt__item"
      :class="{ 'is-last': i === list.length - 1 }"
    >
      <div class="rt__rail" aria-hidden="true">
        <span class="rt__dot" />
        <span class="rt__line" />
      </div>

      <div class="rt__body">
        <span v-if="s.time" class="rt__time">{{ s.time }}</span>
        <p v-if="s.title" class="rt__title">{{ s.title }}</p>
        <p v-if="s.desc" class="rt__desc">{{ s.desc }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.rt {
  position: relative;
}

.rt__item {
  display: flex;
  gap: var(--s-4);
}

.rt__rail {
  position: relative;
  flex-shrink: 0;
  width: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rt__dot {
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 2px var(--c-rose-soft);
  flex-shrink: 0;
}
.rt__item.is-last .rt__dot {
  background: var(--c-rose);
  box-shadow: 0 0 0 4px var(--c-rose-tint);
}

.rt__line {
  flex: 1;
  width: 1px;
  margin: 4px 0;
  background: var(--c-line-strong);
}
.rt__item.is-last .rt__line {
  display: none;
}

.rt__body {
  flex: 1;
  min-width: 0;
  padding-bottom: var(--s-6);
}
.rt__item.is-last .rt__body {
  padding-bottom: 0;
}

.rt__time {
  display: inline-block;
  max-width: 100%;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--c-paper-2);
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  line-height: 1.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rt__item.is-last .rt__time {
  background: var(--c-rose-tint);
  color: var(--c-rose-deep);
}

.rt__title {
  margin-top: var(--s-2);
  font-size: var(--fs-h3);
  font-weight: 500;
  line-height: 1.4;
  color: var(--c-ink);
  word-break: break-word;
}

.rt__desc {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
}
</style>
