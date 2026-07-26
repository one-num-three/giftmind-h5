<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GIcon from '@/components/base/GIcon.vue'
import { useHistoryStore } from '@/stores/history'

const route = useRoute()
const router = useRouter()
const history = useHistoryStore()

const tabs = computed(() => [
  { name: 'landing', path: '/', icon: 'sparkle', label: '策划' },
  { name: 'history', path: '/history', icon: 'bookmark', label: '我的方案', badge: history.count },
])

function go(path) {
  if (route.path !== path) router.replace(path)
}
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="t in tabs"
      :key="t.name"
      class="tabbar__item"
      :class="{ active: route.name === t.name }"
      @click="go(t.path)"
    >
      <span class="tabbar__icon">
        <GIcon :name="t.icon" :size="21" />
        <span v-if="t.badge" class="tabbar__badge">{{ t.badge > 99 ? '99+' : t.badge }}</span>
      </span>
      <span class="tabbar__label">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: sticky;
  bottom: 0;
  z-index: var(--z-bar);
  display: flex;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: rgba(251, 247, 242, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--c-line);
  flex-shrink: 0;
}
.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--c-ink-4);
  transition: color var(--t-fast);
}
.tabbar__item.active {
  color: var(--c-rose);
}
.tabbar__icon {
  position: relative;
}
.tabbar__badge {
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: var(--r-pill);
  background: var(--c-rose);
  color: #fff;
  font-size: 9px;
  line-height: 15px;
  text-align: center;
}
.tabbar__label {
  font-size: var(--fs-micro);
  letter-spacing: 0.02em;
}
</style>
