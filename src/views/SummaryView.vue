<script setup>
/**
 * SummaryView —— 生成方案前的摘要确认
 *
 * 按实际聊过的问题确认回答，修改直接写回原字段；支持继续聊天或联网选礼。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { composeConsultationBlocks } from '@/utils/summaryCompose'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import GNavBar from '@/components/base/GNavBar.vue'
import GButton from '@/components/base/GButton.vue'

const router = useRouter()
const session = useSessionStore()
const ui = useUiStore()

const blocks = ref([])
const BLOCK_ORDER = computed(() => blocks.value.map((block) => block.key))

const loading = ref(true)
const edits = reactive({})
const labels = reactive({})
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
    blocks.value = composeConsultationBlocks(session.answers, session.answerSteps, session.messages)
    for (const block of blocks.value) {
      edits[block.key] = block.text
      labels[block.key] = block.label
    }
  } catch {
    if (alive) ui.error('摘要没有取到，请重试')
  } finally {
    if (alive) loading.value = false
  }
}

function confirm() {
  if (loading.value) return
  session.applyConsultationEdits({ ...edits })
  router.replace('/generating')
}

function backToChat() {
  session.applyConsultationEdits({ ...edits })
  session.resumeConsultation()
  router.replace('/chat')
}

onMounted(load)
onUnmounted(() => {
  alive = false
})
</script>

<template>
  <div class="page">
    <GNavBar title="AI 理解的是这些吗？" subtitle="先确认，再开始挑礼物" />

    <div class="page__body sum">
      <p class="sum__lead">
        这里保留了刚才实际聊到的内容，都可以直接修改；没聊过的内容不会替你补写。
      </p>

      <template v-if="!loading">
        <section
          v-for="key in BLOCK_ORDER"
          :key="key"
          class="sum__block anim-up"
        >
          <p class="sum__label">
            <span>{{ labels[key] }}</span>
            <small>可直接修改</small>
          </p>
          <textarea
            class="sum__area"
            rows="2"
            placeholder="这一项已跳过，可以留空或补充"
            :value="blockText(key)"
            :aria-label="labels[key]"
            @input="onInput(key, $event)"
            @focus="(e) => autoGrow(e.target)"
          />
        </section>

        <p class="sum__meta">来自本次对话 · 修改会同步用于联网选礼</p>
      </template>

      <div v-else class="sum__loading">
        <span class="sum__spin" aria-hidden="true" />
        <p>正在整理你刚才说的话…</p>
      </div>
    </div>

    <div class="sum__footer">
      <GButton variant="ghost" @click="backToChat()">继续聊聊</GButton>
      <GButton variant="dark" block :disabled="loading || !blocks.length" @click="confirm">确认并联网找礼物</GButton>
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
  justify-content: space-between;
  gap: var(--s-3);
  margin-bottom: var(--s-2);
  font-weight: 600;
  font-size: var(--fs-caption);
  color: var(--c-ink);
}
.sum__label small {
  color: var(--c-ink-4);
  font-size: var(--fs-micro);
  font-weight: 500;
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
  background: var(--c-paper);
  border-top: 1px solid var(--c-line);
}
.sum__footer :deep(.g-btn--dark) {
  flex: 1;
}
</style>
