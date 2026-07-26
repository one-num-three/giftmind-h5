<script setup>
import { useRouter } from 'vue-router'
import GIcon from './GIcon.vue'

const props = defineProps({
  title: String,
  subtitle: String,
  back: { type: Boolean, default: true },
  transparent: Boolean,
  to: [String, Object],
})
const emit = defineEmits(['back'])
const router = useRouter()

function onBack() {
  emit('back')
  if (props.to) router.replace(props.to)
  else if (window.history.length > 1) router.back()
  else router.replace('/')
}
</script>

<template>
  <header class="g-nav" :class="{ transparent }">
    <button v-if="back" class="g-nav__btn tap" aria-label="返回" @click="onBack">
      <GIcon name="back" :size="20" />
    </button>
    <div v-else class="g-nav__btn" />

    <div class="g-nav__center">
      <div v-if="title" class="g-nav__title">{{ title }}</div>
      <div v-if="subtitle" class="g-nav__sub">{{ subtitle }}</div>
    </div>

    <div class="g-nav__btn g-nav__right"><slot name="right" /></div>
  </header>
</template>

<style scoped>
.g-nav {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  display: flex;
  align-items: center;
  height: calc(var(--navbar-h) + var(--safe-top));
  padding: var(--safe-top) var(--s-3) 0;
  background: rgba(251, 247, 242, 0.86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-line);
  flex-shrink: 0;
}
.g-nav.transparent {
  background: transparent;
  border-bottom-color: transparent;
  backdrop-filter: none;
}
.g-nav__btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-ink-2);
  flex-shrink: 0;
}
.g-nav__right {
  width: auto;
  min-width: 36px;
  justify-content: flex-end;
}
.g-nav__center {
  flex: 1;
  text-align: center;
  overflow: hidden;
}
.g-nav__title {
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.g-nav__sub {
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
  margin-top: 1px;
}
</style>
