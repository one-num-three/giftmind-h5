<script setup>
/**
 * 选项面板 —— 驱动 step.type 为 'single' / 'multi' 的交互
 *  single : 点一下即选中，300ms 后提交（让选中态被看见）
 *  multi  : 计数 + 达上限置灰 + 「确认选择」；minSelect 为 0 且可跳过时
 *           未选任何项的主按钮直接变成「跳过」
 *  allowCustom → 「或者自己说…」入口（交给页面切到输入框）
 *  skippable   → 右下角低调的「跳过」
 */
import { computed, onUnmounted, ref } from 'vue'

const props = defineProps({
  step: { type: Object, required: true },
  /** 已选值（从自由输入退回来时用它复原） */
  initial: { type: Array, default: () => [] },
})
const emit = defineEmits(['submit', 'skip', 'custom'])

const selected = ref([...props.initial])
const locked = ref(false)
let pickTimer = null

const options = computed(() => props.step.options || [])
const isMulti = computed(() => props.step.type === 'multi')
const minSelect = computed(() =>
  typeof props.step.minSelect === 'number' ? props.step.minSelect : 1,
)
const maxSelect = computed(() =>
  typeof props.step.maxSelect === 'number' ? props.step.maxSelect : 0,
)
const reachedMax = computed(
  () => maxSelect.value > 0 && selected.value.length >= maxSelect.value,
)
const counterText = computed(() =>
  maxSelect.value
    ? `已选 ${selected.value.length}/${maxSelect.value}`
    : `已选 ${selected.value.length}`,
)

/** 一个都没选、也不要求必选 → 主按钮就是「跳过」 */
const skipMode = computed(
  () =>
    isMulti.value &&
    minSelect.value === 0 &&
    Boolean(props.step.skippable) &&
    selected.value.length === 0,
)
const canConfirm = computed(() => selected.value.length >= minSelect.value)
/** 主按钮已经是跳过时，就不用再重复一个跳过链接 */
const showSkipLink = computed(() => Boolean(props.step.skippable) && !skipMode.value)

function isOn(value) {
  return selected.value.includes(value)
}
function isOff(value) {
  return isMulti.value && reachedMax.value && !isOn(value)
}

function onTap(opt) {
  if (isMulti.value) {
    const i = selected.value.indexOf(opt.value)
    if (i >= 0) selected.value.splice(i, 1)
    else if (!reachedMax.value) selected.value.push(opt.value)
    return
  }
  if (locked.value) return
  locked.value = true
  selected.value = [opt.value]
  pickTimer = setTimeout(() => {
    pickTimer = null
    emit('submit', opt.value)
  }, 300)
}

function onConfirm() {
  if (skipMode.value) {
    emit('skip')
    return
  }
  if (!canConfirm.value) return
  emit('submit', [...selected.value])
}

onUnmounted(() => {
  if (pickTimer) clearTimeout(pickTimer)
})
</script>

<template>
  <div class="choice">
    <div v-if="isMulti" class="choice__counter" :class="{ full: reachedMax }">
      {{ counterText }}
    </div>

    <div class="choice__chips">
      <GChip
        v-for="opt in options"
        :key="opt.value"
        :emoji="opt.emoji"
        :hint="opt.hint"
        :selected="isOn(opt.value)"
        :disabled="isOff(opt.value)"
        @click="onTap(opt)"
      >
        {{ opt.label }}
      </GChip>

      <!-- 🌟 所有问题显式提供「其他/自定义输入」选项 -->
      <GChip
        v-if="step.allowCustom !== false"
        emoji="✍️"
        :selected="false"
        @click="emit('custom', [...selected])"
      >
        其他 / 自定义输入…
      </GChip>
    </div>

    <div v-if="showSkipLink" class="choice__links">
      <span class="grow" />
      <button class="link link--skip tap" @click="emit('skip')">跳过</button>
    </div>

    <GButton
      v-if="isMulti"
      block
      :variant="skipMode ? 'outline' : 'primary'"
      :disabled="!skipMode && !canConfirm"
      class="choice__confirm"
      @click="onConfirm"
    >
      {{ skipMode ? '没有，跳过这题' : '确认选择' }}
    </GButton>
  </div>
</template>

<style scoped>
.choice {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.choice__counter {
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
  letter-spacing: 0.02em;
  transition: color var(--t-fast);
}
.choice__counter.full {
  color: var(--c-rose-deep);
}

.choice__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.choice__links {
  display: flex;
  align-items: center;
  min-height: 32px;
}
.grow {
  flex: 1;
}

/* 视觉上只有 32px 高，实际点区拉满 44px */
.link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 44px;
  padding: 0 10px;
  margin: -6px -10px;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}
.link--skip {
  color: var(--c-ink-4);
  text-decoration: underline;
  text-underline-offset: 3px;
  margin: -6px -10px -6px 0;
}

.choice__confirm {
  margin-top: var(--s-1);
}
</style>
