<script setup>
/**
 * 文本输入区
 *  · 自动增高，最多 5 行（超出内部滚动，由 CSS max-height 收口）
 *  · Enter 发送 / Shift+Enter 换行，中文输入法组词期间的 Enter 不误发
 *  · 空内容时发送按钮禁用
 *  · 上方一行放次要动作：回到选项 / 跳过
 */
import { computed, nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  placeholder: { type: String, default: '写点什么…' },
  hint: { type: String, default: '' },
  skippable: Boolean,
  cancelable: Boolean, // 由「或者自己说…」进来的，可以退回选项
  autofocus: Boolean,
})
const emit = defineEmits(['submit', 'skip', 'cancel', 'focus'])

const text = ref('')
const areaRef = ref(null)
const focused = ref(false)
let composing = false

const canSend = computed(() => text.value.trim().length > 0)

function autoGrow() {
  const el = areaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function send() {
  const value = text.value.trim()
  if (!value) return
  text.value = ''
  nextTick(autoGrow)
  emit('submit', value)
}

function onKeydown(e) {
  if (e.key !== 'Enter') return
  if (e.shiftKey) return // 换行
  if (composing || e.isComposing || e.keyCode === 229) return // 输入法组词中
  e.preventDefault()
  send()
}

function onFocus() {
  focused.value = true
  emit('focus')
}

onMounted(() => {
  autoGrow()
  if (props.autofocus) areaRef.value?.focus()
})

defineExpose({ focus: () => areaRef.value?.focus() })
</script>

<template>
  <div class="composer">
    <div v-if="cancelable || hint || skippable" class="composer__meta">
      <button v-if="cancelable" class="link tap" @click="emit('cancel')">
        <GIcon name="back" :size="13" />
        <span>回到选项</span>
      </button>
      <span v-if="hint" class="composer__hint" :class="{ 'composer__hint--after': cancelable }">
        {{ hint }}
      </span>
      <span class="grow" />
      <button v-if="skippable" class="link link--skip tap" @click="emit('skip')">跳过</button>
    </div>

    <div class="composer__box" :class="{ focused }">
      <textarea
        ref="areaRef"
        v-model="text"
        class="composer__area"
        rows="1"
        enterkeyhint="send"
        :placeholder="placeholder"
        @input="autoGrow"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="focused = false"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button
        class="composer__send tap"
        :class="{ off: !canSend }"
        :disabled="!canSend"
        aria-label="发送"
        @mousedown.prevent
        @click="send"
      >
        <GIcon name="send" :size="17" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.composer__meta {
  display: flex;
  align-items: center;
  min-height: 32px;
}
.grow {
  flex: 1;
}
.composer__hint {
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.composer__hint--after {
  margin-left: var(--s-3);
}

/* 视觉 32px，点区 44px */
.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.composer__box {
  display: flex;
  align-items: flex-end;
  gap: var(--s-2);
  padding: 5px 5px 5px 14px;
  background: var(--c-surface);
  border-radius: var(--r-lg);
  box-shadow: inset 0 0 0 1px var(--c-line-strong), var(--sh-1);
  transition: box-shadow var(--t-base) var(--e-out);
}
.composer__box.focused {
  box-shadow: inset 0 0 0 1px var(--c-rose), var(--sh-2);
}

.composer__area {
  flex: 1;
  min-width: 0;
  padding: 11px 0;
  font-family: var(--f-sans);
  font-size: var(--fs-body);
  line-height: 22px;
  color: var(--c-ink);
  max-height: 130px; /* 5 行 + 上下内边距 */
  overflow-y: auto;
  scrollbar-width: none;
}
.composer__area::-webkit-scrollbar {
  display: none;
}
.composer__area::placeholder {
  color: var(--c-ink-4);
}

.composer__send {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--g-primary);
  color: var(--c-ink-inverse);
  box-shadow: var(--sh-primary);
  transition: opacity var(--t-fast), box-shadow var(--t-base) var(--e-out);
}
.composer__send.off {
  background: var(--c-paper-3);
  color: var(--c-ink-4);
  box-shadow: none;
  pointer-events: none;
}
</style>
