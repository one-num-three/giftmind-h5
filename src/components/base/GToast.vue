<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { toast } = storeToRefs(ui)
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toast" class="g-toast" :class="`is-${toast.type}`">{{ toast.text }}</div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.g-toast {
  position: fixed;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  max-width: 300px;
  padding: 10px 18px;
  border-radius: var(--r-pill);
  background: rgba(59, 52, 46, 0.92);
  color: var(--c-ink-inverse);
  font-size: var(--fs-sm);
  text-align: center;
  box-shadow: var(--sh-2);
  backdrop-filter: blur(6px);
}
.is-success {
  background: rgba(116, 141, 112, 0.95);
}
.is-error {
  background: rgba(192, 123, 114, 0.95);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--t-base), transform var(--t-base) var(--e-out);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
