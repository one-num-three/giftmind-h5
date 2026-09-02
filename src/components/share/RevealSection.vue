<script setup>
/**
 * RevealSection —— useReveal 的包装组件
 * 滚到视口才淡入上浮；delay 用来让同一屏里的几段错开一点点。
 */
import { computed } from 'vue'
import { useReveal } from '@/composables/useReveal'

const props = defineProps({
  /** 进场延迟（毫秒） */
  delay: { type: Number, default: 0 },
  threshold: { type: Number, default: 0.12 },
})

const { el, visible } = useReveal({ threshold: props.threshold })

const style = computed(() => {
  const d = Number.isFinite(props.delay) ? Math.max(0, props.delay) : 0
  return { transitionDelay: `${d}ms` }
})
</script>

<template>
  <div ref="el" class="rv" :class="{ 'is-in': visible }" :style="style">
    <slot :visible="visible" />
  </div>
</template>

<style scoped>
.rv {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 760ms var(--e-out), transform 760ms var(--e-out);
}
.rv.is-in {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .rv {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
