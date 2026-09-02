<script setup>
/**
 * 文本输入区
 *  · 自动增高，最多 5 行（超出内部滚动，由 CSS max-height 收口）
 *  · Enter 发送 / Shift+Enter 换行，中文输入法组词期间的 Enter 不误发
 *  · 空内容时发送按钮禁用
 *  · 上方一行放次要动作：回到选项 / 跳过
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useVoiceInput } from '@/composables/useVoiceInput'

const props = defineProps({
  placeholder: { type: String, default: '写点什么…' },
  hint: { type: String, default: '' },
  skippable: Boolean,
  cancelable: Boolean, // 由「或者自己说…」进来的，可以退回选项
  autofocus: Boolean,
  voice: Boolean, // 后端已配置语音转写时才显示 mic
})
const emit = defineEmits(['submit', 'skip', 'cancel', 'focus', 'voiceError'])

const text = ref('')
const areaRef = ref(null)
const focused = ref(false)
let composing = false
const voice = useVoiceInput()

const canSend = computed(() => text.value.trim().length > 0)
const voiceBusy = computed(() => voice.recording.value || voice.transcribing.value)

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

async function onMic() {
  if (!props.voice || voiceBusy.value) return
  if (!voice.recording.value) {
    try {
      await voice.start()
    } catch (error) {
      emit('voiceError', error?.message || '语音不可用')
    }
    return
  }
  try {
    const transcript = await voice.stop()
    if (transcript) {
      text.value = transcript
      nextTick(() => {
        autoGrow()
        areaRef.value?.focus()
      })
    }
  } catch (error) {
    emit('voiceError', error?.message || '语音转写失败，请重试')
  }
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
      <button
        v-if="voice"
        class="composer__mic tap"
        :class="{ recording: voice.recording, busy: voiceBusy }"
        :aria-label="voice.recording ? `录音中 ${voice.seconds} 秒，点击结束` : '用语音说'"
        :disabled="voice.transcribing"
        @mousedown.prevent
        @click="onMic"
      >
        <svg v-if="!voice.transcribing" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
        <span v-else class="composer__mic-spin" aria-hidden="true" />
        <span v-if="voice.recording" class="composer__mic-sec">{{ voice.seconds }}</span>
      </button>
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

.composer__mic {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-ink-3);
  background: var(--c-paper-2);
  box-shadow: inset 0 0 0 1px var(--c-line);
  transition: color var(--t-fast), background var(--t-fast);
}
.composer__mic svg {
  width: 19px;
  height: 19px;
  fill: currentColor;
}
.composer__mic.recording {
  color: var(--c-ink-inverse);
  background: var(--c-rose);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-rose) 24%, transparent);
  animation: mic-pulse 1.2s ease-in-out infinite;
}
.composer__mic.busy {
  pointer-events: none;
  opacity: 0.7;
}
.composer__mic-sec {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  color: var(--c-ink-inverse);
  background: var(--c-rose);
}
.composer__mic-spin {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--c-ink-3);
  border-top-color: transparent;
  animation: mic-rotate 0.8s linear infinite;
}
@keyframes mic-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}
@keyframes mic-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
