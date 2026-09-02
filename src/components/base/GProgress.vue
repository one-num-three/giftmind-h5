<script setup>
defineProps({
  value: { type: Number, default: 0 }, // 0-100
  height: { type: Number, default: 3 },
})
</script>

<template>
  <div class="g-progress" :style="{ height: height + 'px' }">
    <div class="g-progress__fill" :style="{ width: Math.min(100, Math.max(0, value)) + '%' }" />
  </div>
</template>

<style scoped>
.g-progress {
  width: 100%;
  background: var(--c-paper-3);
  overflow: hidden;
  flex-shrink: 0;
}
.g-progress__fill {
  height: 100%;
  background: var(--g-primary);
  border-radius: 0 var(--r-pill) var(--r-pill) 0;
  transition: width var(--t-slow) var(--e-out);
}
</style>
