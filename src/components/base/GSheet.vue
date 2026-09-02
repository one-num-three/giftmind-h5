<script setup>
import { watch } from 'vue'
import GIcon from './GIcon.vue'

const props = defineProps({
  modelValue: Boolean,
  title: String,
})
const emit = defineEmits(['update:modelValue'])

watch(
  () => props.modelValue,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  },
)

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="g-sheet__mask" @click.self="close">
        <Transition name="slide-up" appear>
          <div class="g-sheet">
            <div class="g-sheet__handle" />
            <header v-if="title || $slots.header" class="g-sheet__head">
              <slot name="header">
                <div class="g-sheet__title">{{ title }}</div>
              </slot>
              <button class="g-sheet__close tap" aria-label="关闭" @click="close">
                <GIcon name="close" :size="18" />
              </button>
            </header>
            <div class="g-sheet__body scroll-y"><slot /></div>
            <div v-if="$slots.footer" class="g-sheet__foot"><slot name="footer" /></div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.g-sheet__mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  background: var(--c-mask);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.g-sheet {
  width: 100%;
  max-width: var(--app-max-w);
  background: var(--c-paper);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding-bottom: var(--safe-bottom);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 40px rgba(120, 92, 74, 0.18);
}
.g-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: var(--r-pill);
  background: var(--c-ink-4);
  opacity: 0.5;
  margin: 10px auto 2px;
  flex-shrink: 0;
}
.g-sheet__head {
  display: flex;
  align-items: center;
  padding: var(--s-3) var(--s-5) var(--s-2);
  flex-shrink: 0;
}
.g-sheet__title {
  font-size: var(--fs-h3);
  font-weight: 500;
  flex: 1;
}
.g-sheet__close {
  color: var(--c-ink-3);
  padding: 4px;
}
.g-sheet__body {
  padding: var(--s-2) var(--s-5) var(--s-5);
  flex: 1;
}
.g-sheet__foot {
  padding: var(--s-3) var(--s-5) var(--s-5);
  border-top: 1px solid var(--c-line);
  flex-shrink: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform var(--t-base) var(--e-out);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
