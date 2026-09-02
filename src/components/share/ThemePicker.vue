<script setup>
/**
 * ThemePicker —— 三套信纸色调：暖晨 / 暮色 / 草木
 * 色卡圆片取自各自的主色，选中态是一圈描边 + 一个勾。
 */
import { computed } from 'vue'
import GIcon from '@/components/base/GIcon.vue'

const props = defineProps({
  modelValue: { type: String, default: 'dawn' },
})
const emit = defineEmits(['update:modelValue'])

const THEMES = [
  { key: 'dawn', name: '暖晨', desc: '米色与陶土' },
  { key: 'dusk', name: '暮色', desc: '灰紫，更安静' },
  { key: 'sage', name: '草木', desc: '偏绿，清淡' },
]

const active = computed(() =>
  THEMES.some((t) => t.key === props.modelValue) ? props.modelValue : 'dawn',
)

function pick(key) {
  if (key !== active.value) emit('update:modelValue', key)
}
</script>

<template>
  <div class="tp">
    <button
      v-for="t in THEMES"
      :key="t.key"
      type="button"
      class="tp__item tap"
      :class="[`k-${t.key}`, { 'is-on': active === t.key }]"
      :aria-pressed="active === t.key"
      @click="pick(t.key)"
    >
      <span class="tp__swatch">
        <span class="tp__check">
          <GIcon name="check" :size="12" :stroke="2.4" />
        </span>
      </span>
      <span class="tp__name">{{ t.name }}</span>
      <span class="tp__desc">{{ t.desc }}</span>
    </button>
  </div>
</template>

<style scoped>
.tp {
  display: flex;
  gap: var(--s-3);
}

.tp__item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--s-4) var(--s-2) var(--s-3);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-line);
  transition: box-shadow var(--t-base) var(--e-out), background var(--t-base);
}

/* 每套主题自己的强调色 */
.k-dawn {
  --tp-key: var(--c-rose);
  --tp-wash: var(--c-rose-tint);
}
.k-dusk {
  --tp-key: var(--c-lilac-deep);
  --tp-wash: var(--c-lilac-soft);
}
.k-sage {
  --tp-key: var(--c-sage-deep);
  --tp-wash: var(--c-sage-soft);
}

.tp__item.is-on {
  background: var(--tp-wash);
  box-shadow: inset 0 0 0 2px var(--tp-key);
}

.tp__swatch {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  box-shadow: var(--sh-1), inset 0 0 0 1px var(--c-line);
}
.k-dawn .tp__swatch {
  background: linear-gradient(145deg, var(--c-sand-soft) 0%, var(--c-rose-soft) 52%, var(--c-rose) 100%);
}
.k-dusk .tp__swatch {
  background: linear-gradient(145deg, var(--c-lilac-soft) 0%, var(--c-lilac) 58%, var(--c-lilac-deep) 100%);
}
.k-sage .tp__swatch {
  background: linear-gradient(145deg, var(--c-sage-soft) 0%, var(--c-sage) 58%, var(--c-sage-deep) 100%);
}

.tp__check {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tp-key);
  color: var(--c-ink-inverse);
  box-shadow: 0 0 0 2px var(--c-surface);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity var(--t-fast) var(--e-out), transform var(--t-base) var(--e-spring);
}
.tp__item.is-on .tp__check {
  opacity: 1;
  transform: scale(1);
}

.tp__name {
  margin-top: 2px;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
}
.tp__desc {
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.tp__item.is-on .tp__desc {
  color: var(--c-ink-2);
}
</style>
