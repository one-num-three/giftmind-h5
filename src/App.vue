<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/layout/TabBar.vue'
import GToast from '@/components/base/GToast.vue'

const route = useRoute()
const showTab = computed(() => Boolean(route.meta?.tab))
</script>

<template>
  <div class="app-root">
    <RouterView v-slot="{ Component }">
      <Transition name="rt" mode="out-in">
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
</style>
