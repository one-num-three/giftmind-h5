<script setup>
/** AI「正在输入」：三个点错峰呼吸 */
</script>

<template>
  <div class="dots" role="status" aria-label="对方正在输入">
    <span class="dots__d" />
    <span class="dots__d" />
    <span class="dots__d" />
  </div>
</template>

<style scoped>
.dots {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 18px;
}
.dots__d {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-ink-4);
  animation: dotBreathe 1.25s var(--e-in-out) infinite;
}
.dots__d:nth-child(2) {
  animation-delay: 0.16s;
}
.dots__d:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes dotBreathe {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.9);
  }
  45% {
    opacity: 1;
    transform: translateY(-2px) scale(1);
  }
}
</style>
