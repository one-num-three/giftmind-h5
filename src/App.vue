<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { gsap } from 'gsap'
import TabBar from '@/components/layout/TabBar.vue'
import GToast from '@/components/base/GToast.vue'
import { REDUCED_MOTION_QUERY, routeDirection, routeMotionSpec } from '@/utils/motion'

const route = useRoute()
const showTab = computed(() => Boolean(route.meta?.tab))
const direction = ref(1)

watch(
  () => route.meta?.depth,
  (next, previous) => {
    direction.value = routeDirection(next, previous)
  },
)

function reducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true
}

function focusRoute(el) {
  const target = el.querySelector?.('h1, [data-route-focus]') || el
  if (!(target instanceof HTMLElement)) return
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

function routeEnter(el, done) {
  const spec = routeMotionSpec(direction.value, reducedMotion())
  gsap.killTweensOf(el)
  gsap.fromTo(el, spec.enterFrom, {
    ...spec.enterTo,
    clearProps: 'opacity,visibility,transform,willChange',
    onComplete: () => {
      focusRoute(el)
      done()
    },
  })
}

function routeLeave(el, done) {
  const spec = routeMotionSpec(direction.value, reducedMotion())
  gsap.killTweensOf(el)
  gsap.to(el, { ...spec.leaveTo, onComplete: done })
}

onUnmounted(() => gsap.killTweensOf('.app-root > *'))
</script>

<template>
  <div class="app-root">
    <RouterView v-slot="{ Component }">
      <Transition :css="false" mode="out-in" @enter="routeEnter" @leave="routeLeave">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>

    <TabBar v-if="showTab" />
    <GToast />
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-root :deep([tabindex='-1']:focus) {
  outline: none;
}
</style>
