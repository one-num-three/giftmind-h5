<script setup>
/**
 * SummaryView —— 生成方案前的摘要确认
 *
 * 访谈结束后先到这里：TA 是谁 / 你们的故事 / 这次想表达什么 / 预算与约束，
 * 四块都可以直接改。确认后把修改写回 answers，再走原有生成流程。
 * 约束块是展示性的自由备注：预算/时间/禁忌的硬过滤仍以结构化字段为准。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import GNavBar from '@/components/base/GNavBar.vue'
import GButton from '@/components/base/GButton.vue'

const router = useRouter()
const session = useSessionStore()
const ui = useUiStore()

const BLOCK_ORDER = ['who', 'story', 'feeling', 'constraints']
const BLOCK_EMOJI = { who: '🫂', story: '📖', feeling: '💌', constraints: '🧭' }

const loading = ref(true)
const source = ref('rule')
const edits = reactive({})
let alive = true

const answeredCount = computed(() => session.answeredCount)

function blockText(key) {
  return typeof edits[key] === 'string' ? edits[key] : ''
}

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(key, event) {
  edits[key] = event.target.value
  autoGrow(event.target)
}

async function load() {
  if (answeredCount.value === 0) {
    router.replace('/')
    return
  }
  loading.value = true
  try {
    const result = await api.generateSummary(session.answers)
    if (!alive) return
    const summary = result?.summary && typeof result.summary === 'object' ? result.summary : {}
    for (const key of BLOCK_ORDER) {
      const block = summary[key]
      edits[key] = typeof block?.text === 'string' ? block.text : ''
    }
    source.value = result?.source || 'rule'
  } catch {
    if (alive) ui.error('摘要没有取到，请重试')
  } finally {
    if (alive) loading.value = false
  }
}

function confirm() {
  if (loading.value) return
  session.applySummaryEdits({ ...edits })
  router.replace('/generating')
}

function backToChat() {
  router.replace('/chat')
}

onMounted(load)
onUnmounted(() => {
  alive = false
})
</script>

<template>
  <div class="page">
    <GNavBar title="确认一下" subtitle="TA 是谁 · 你们的故事 · 想表达什么" />

    <div class="page__body sum">
      <p class="sum__lead">
        生成方案前，把理解到的信息整理成四块。哪一块不对，直接改掉。
      </p>

      <template v-if="!loading">
        <section
          v-for="key in BLOCK_ORDER"
          :key="key"
          class="sum__block anim-up"
        >
          <p class="sum__label">
            <span class="sum__emoji" aria-hidden="true">{{ BLOCK_EMOJI[key] }}</span>
            {{ key === 'who' ? 'TA 是谁' : key === 'story' ? '你们的故事' : key === 'feeling' ? '这次想表达什么' : '预算与约束' }}
          </p>
          <textarea
            class="sum__area"
            rows="2"
            :value="blockText(key)"
            @input="onInput(key, $event)"
            @focus="(e) => autoGrow(e.target)"
          />
          <p v-if="key === 'constraints'" class="sum__note">
            预算、时间、禁忌的硬过滤仍以上一步的选项为准；这里只留补充说明。
          </p>
        </section>

        <p v-if="source === 'rule'" class="sum__meta">根据你的回答整理 · 可直接修改</p>
      </template>

      <div v-else class="sum__loading">
        <span class="sum__spin" aria-hidden="true" />
        <p>正在整理你刚才说的话…</p>
      </div>
    </div>

    <div class="sum__footer">
      <GButton variant="ghost" @click="backToChat">回去改</GButton>
      <GButton variant="dark" block :disabled="loading" @click="confirm">就按这些来</GButton>
    </div>
  </div>
</template>

<style scoped>
.sum {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding-bottom: calc(var(--safe-bottom) + 96px);
}
.sum__lead {
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
  line-height: 1.7;
}
.sum__block {
  padding: var(--s-3);
  background: var(--c-surface);
  border-radius: var(--r-md);
  box-shadow: var(--sh-1);
}
.sum__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--s-2);
  font-weight: 600;
  font-size: var(--fs-caption);
  color: var(--c-ink);
}
.sum__emoji {
  font-size: 16px;
}
.sum__area {
  width: 100%;
  resize: none;
  padding: 12px 14px;
  font-family: var(--f-sans);
  font-size: var(--fs-body);
  line-height: 1.7;
  color: var(--c-ink);
  background: var(--c-paper);
  border-radius: var(--r-sm);
  box-shadow: inset 0 0 0 1px var(--c-line);
  overflow-y: auto;
  scrollbar-width: none;
}
.sum__area:focus {
  box-shadow: inset 0 0 0 1px var(--c-rose);
  outline: none;
}
.sum__note {
  margin-top: var(--s-2);
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
  line-height: 1.6;
}
.sum__meta {
  text-align: center;
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
}
.sum__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-3);
  padding: 72px 0;
  color: var(--c-ink-3);
  font-size: var(--fs-caption);
}
.sum__spin {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--c-line-strong);
  border-top-color: var(--c-rose);
  animation: sum-rotate 0.9s linear infinite;
}
@keyframes sum-rotate {
  to {
    transform: rotate(360deg);
  }
}
.sum__footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: var(--s-2);
  padding: 12px var(--s-3) calc(var(--safe-bottom) + 12px);
  background: linear-gradient(to top, var(--c-paper) 70%, transparent);
}
.sum__footer :deep(.g-btn--dark) {
  flex: 1;
}
</style>
