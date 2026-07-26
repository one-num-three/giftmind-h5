<script setup>
defineProps({
  width: { type: String, default: '100%' },
  height: { type: String, default: '16px' },
  radius: { type: String, default: 'var(--r-xs)' },
  rows: { type: Number, default: 1 },
})
</script>

<template>
  <div class="g-skeleton-wrap">
    <div
      v-for="i in rows"
      :key="i"
      class="g-skeleton"
      :style="{
        width: i === rows && rows > 1 ? '62%' : width,
        height,
        borderRadius: radius,
      }"
    />
  </div>
</template>

<style scoped>
.g-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-skeleton {
  background: linear-gradient(
    90deg,
    var(--c-paper-2) 25%,
    var(--c-paper-3) 37%,
    var(--c-paper-2) 63%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
</style>
