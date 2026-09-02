<script setup>
defineProps({
  emoji: { type: String, default: '🎁' },
  title: { type: String, default: '这里还什么都没有' },
  desc: String,
})
</script>

<template>
  <div class="g-empty">
    <div class="g-empty__art">
      <span class="g-empty__emoji">{{ emoji }}</span>
      <span class="g-empty__ring" />
    </div>
    <div class="g-empty__title">{{ title }}</div>
    <div v-if="desc" class="g-empty__desc">{{ desc }}</div>
    <div v-if="$slots.default" class="g-empty__action"><slot /></div>
  </div>
</template>

<style scoped>
.g-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--s-9) var(--s-6);
  text-align: center;
}
.g-empty__art {
  position: relative;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--s-5);
}
.g-empty__emoji {
  font-size: 34px;
  animation: floaty 4s ease-in-out infinite;
}
.g-empty__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--g-warm);
  z-index: -1;
}
.g-empty__title {
  font-size: var(--fs-body);
  color: var(--c-ink-2);
  font-weight: 500;
}
.g-empty__desc {
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
  margin-top: 6px;
  line-height: var(--lh-snug);
  max-width: 240px;
}
.g-empty__action {
  margin-top: var(--s-6);
}
</style>
