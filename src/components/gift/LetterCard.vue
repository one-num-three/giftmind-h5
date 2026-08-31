<script setup>
/**
 * LetterCard —— 替你写的那封信（小米 MiMo 4 大多风格情话/心意卡片生成器）
 *
 * 1. 4 大风格一键实时切换：深情走心、嘴硬傲娇、幽默风趣、唯美诗意
 * 2. 复制全文（带 Toast 提示）
 * 3. 🖼️ 一键生成精美心意明信片海报
 */
import { ref, computed } from 'vue'
import { copyText } from '@/utils/helpers'
import { useUiStore } from '@/stores/ui'
import { generateCustomStyleLetter } from '@/api/mimoService'

const props = defineProps({
  letter: { type: Object, default: () => ({}) },
  loading: Boolean,
})

const emit = defineEmits(['change-tone', 'update-letter'])

const ui = useUiStore()

const STYLES = [
  { key: 'touching', label: '🍯 深情走心', desc: '细腻真挚，字字戳心' },
  { key: 'tsundere', label: '😼 嘴硬傲娇', desc: '口嫌体正直，反差萌' },
  { key: 'humorous', label: '😄 轻松幽默', desc: '默契玩笑，让人会心一笑' },
  { key: 'poetic', label: '📜 唯美诗意', desc: '文青质感，留白与画面' },
]

const currentStyleKey = ref('touching')
const generatingStyle = ref(false)
const postcardModalOpen = ref(false)

function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const salutation = computed(() => text(props.letter?.salutation) || '见信好：')
const signature = computed(() => text(props.letter?.signature) || '—— 写在心意送达之时')
const toneLabel = computed(() => text(props.letter?.tone))
const paragraphs = computed(() => {
  const list = Array.isArray(props.letter?.paragraphs) ? props.letter.paragraphs : []
  return list.map(text).filter(Boolean)
})
const hasBody = computed(() => Boolean(salutation.value || paragraphs.value.length))

const fullText = computed(() => {
  const parts = []
  if (salutation.value) parts.push(salutation.value)
  paragraphs.value.forEach((p) => parts.push(p))
  if (signature.value) parts.push(signature.value)
  return parts.join('\n\n')
})

async function onCopy() {
  if (props.loading || !fullText.value) return
  const ok = await copyText(fullText.value)
  if (ok) ui.success('整封信已复制，可直接粘贴到微信或随礼贺卡')
  else ui.error('复制没成功，可以长按选中文字')
}

async function selectStyle(styleKey) {
  if (generatingStyle.value || props.loading) return
  currentStyleKey.value = styleKey
  generatingStyle.value = true
  try {
    const customLetter = await generateCustomStyleLetter(styleKey, {
      answers: {},
      selectedGift: { name: '这份礼物' }
    })
    if (customLetter) {
      emit('update-letter', customLetter)
      ui.success(`已切换为「${customLetter.tone || '新风格'}」`)
    }
  } catch (err) {
    ui.error('风格切换稍慢，请稍后再试')
  } finally {
    generatingStyle.value = false
  }
}
</script>

<template>
  <GCard class="letter" padding="none" radius="xl">
    <!-- 4 大风格快捷切换胶囊栏 -->
    <div class="letter__styles-bar">
      <div class="styles-title">
        <span class="styles-badge">AI 情绪卡片</span>
        <span class="styles-hint">4 种心意表达语气</span>
      </div>
      <div class="styles-capsules">
        <button
          v-for="s in STYLES"
          :key="s.key"
          class="style-capsule tap"
          :class="{ 'is-active': s.key === currentStyleKey }"
          :disabled="generatingStyle || loading"
          type="button"
          @click="selectStyle(s.key)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- 信纸本体 -->
    <div class="letter__paper grain" :class="{ 'is-busy': generatingStyle }">
      <span class="letter__quote" aria-hidden="true">“</span>

      <template v-if="loading || generatingStyle">
        <div class="letter__loading">
          <div class="loading-tip">
            <span class="pulse-dot"></span>
            <span>MiMo 极速大模型正在按「{{ STYLES.find(s=>s.key===currentStyleKey)?.label }}」定制手写信...</span>
          </div>
          <GSkeleton width="38%" height="18px" />
          <GSkeleton :rows="3" height="14px" />
          <GSkeleton :rows="2" height="14px" />
          <GSkeleton width="34%" height="14px" />
        </div>
      </template>

      <template v-else-if="hasBody">
        <p v-if="salutation" class="letter__salu">{{ salutation }}</p>
        <p v-for="(p, i) in paragraphs" :key="i" class="letter__p">{{ p }}</p>
        <p v-if="signature" class="letter__sign">{{ signature }}</p>
      </template>

      <p v-else class="letter__empty">这封信还没有写出来，换个语气试试。</p>
    </div>

    <!-- 底部操作条 -->
    <div class="letter__tools">
      <button class="tool tap" type="button" :disabled="loading || generatingStyle || !fullText" @click="onCopy">
        <GIcon name="copy" :size="16" />
        <span>复制贺卡文案</span>
      </button>

      <span class="tool__sep" aria-hidden="true" />

      <button class="tool tap tool--highlight" type="button" :disabled="loading || generatingStyle" @click="postcardModalOpen = true">
        <span class="tool-emoji">🖼️</span>
        <span>生成心意明信片</span>
      </button>
    </div>

    <!-- 心意明信片生成弹窗 -->
    <GSheet v-model="postcardModalOpen" title="💌 专属手写心意明信片">
      <div class="postcard-preview grain" id="postcard-content">
        <div class="postcard-stamp">
          <span class="stamp-icon">🕊️</span>
          <span class="stamp-text">SPECIAL GIFT</span>
        </div>
        <div class="postcard-header">
          <span class="postcard-tag">{{ toneLabel || '手写心意' }}</span>
          <h4 class="postcard-title">{{ salutation }}</h4>
        </div>
        <div class="postcard-body">
          <p v-for="(p, i) in paragraphs" :key="i" class="postcard-p">{{ p }}</p>
        </div>
        <div class="postcard-footer">
          <div class="postcard-seal">
            <span class="seal-icon">✦</span>
            <span>GiftMind 心意封存</span>
          </div>
          <span class="postcard-sign">{{ signature }}</span>
        </div>
      </div>

      <div class="postcard-actions">
        <button class="action-btn action-btn--primary tap" type="button" @click="onCopy">
          <GIcon name="copy" :size="16" />
          <span>复制文字直接发微信</span>
        </button>
      </div>
    </GSheet>
  </GCard>
</template>

<style scoped>
.letter {
  position: relative;
  overflow: hidden;
  background: var(--c-surface);
  border: 1px solid rgba(244, 114, 182, 0.2);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.05);
}

/* ── 4 大风格胶囊栏 ────────────────────────── */
.letter__styles-bar {
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.8) 0%, rgba(245, 243, 255, 0.8) 100%);
  border-bottom: 1px solid var(--c-line);
}
.styles-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.styles-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f43f5e;
  color: #fff;
}
.styles-hint {
  font-size: 12px;
  color: var(--c-ink-3);
}
.styles-capsules {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.styles-capsules::-webkit-scrollbar {
  display: none;
}
.style-capsule {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  color: var(--c-ink-2);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.style-capsule.is-active {
  background: #f43f5e;
  border-color: #f43f5e;
  color: #fff;
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3);
  transform: scale(1.04);
}

/* ── 信纸 ─────────────────────────────────── */
.letter__paper {
  position: relative;
  padding: 24px 20px 20px;
  background: #fdfbf7;
  overflow: hidden;
  transition: opacity 0.2s ease;
}
.letter__paper.is-busy {
  opacity: 0.7;
}
.letter__paper::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 29px,
    #e2d9cc 29px,
    #e2d9cc 30px
  );
}

.letter__quote {
  position: relative;
  display: block;
  font-family: var(--f-display);
  font-style: italic;
  font-size: 48px;
  line-height: 0.4;
  color: #f43f5e;
  opacity: 0.3;
}

.letter__salu {
  position: relative;
  margin-top: 16px;
  font-family: var(--f-serif);
  font-size: 16px;
  font-weight: 600;
  color: #27272a;
}

.letter__p {
  position: relative;
  margin-top: 14px;
  font-family: var(--f-serif);
  font-size: 14px;
  line-height: 1.85;
  color: #3f3f46;
  text-align: justify;
  word-break: break-word;
}

.letter__sign {
  position: relative;
  margin-top: 20px;
  text-align: right;
  font-family: var(--f-serif);
  font-size: 13px;
  color: #71717a;
}

.letter__empty {
  position: relative;
  margin-top: 16px;
  font-size: 13px;
  color: #a1a1aa;
}

.letter__loading {
  position: relative;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.loading-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #f43f5e;
  font-weight: 500;
  margin-bottom: 4px;
}
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f43f5e;
  animation: pulse-dot 1.2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.6); opacity: 0.4; }
}

/* ── 工具条 ───────────────────────────────── */
.letter__tools {
  display: flex;
  align-items: center;
  background: var(--c-surface);
  border-top: 1px solid var(--c-line);
}
.tool {
  flex: 1;
  min-width: 0;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--c-ink-2);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s ease;
}
.tool:active {
  background: rgba(0, 0, 0, 0.04);
}
.tool--highlight {
  color: #f43f5e;
  font-weight: 600;
}
.tool-emoji {
  font-size: 15px;
}
.tool__sep {
  width: 1px;
  height: 20px;
  background: var(--c-line);
  flex-shrink: 0;
}

/* ── 心意明信片样式 ───────────────────────── */
.postcard-preview {
  position: relative;
  background: linear-gradient(135deg, #fffbf5 0%, #fff1f2 100%);
  border: 1px solid rgba(244, 63, 94, 0.25);
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 16px 36px rgba(244, 63, 94, 0.12);
  margin-bottom: 16px;
  overflow: hidden;
}
.postcard-stamp {
  position: absolute;
  top: 16px;
  right: 16px;
  border: 2px dashed #f43f5e;
  border-radius: 8px;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.8;
}
.stamp-icon { font-size: 16px; }
.stamp-text { font-size: 8px; font-weight: 800; color: #f43f5e; letter-spacing: 0.5px; }

.postcard-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.postcard-title {
  font-family: var(--f-serif);
  font-size: 16px;
  font-weight: 700;
  color: #27272a;
}
.postcard-body {
  margin: 16px 0;
}
.postcard-p {
  font-family: var(--f-serif);
  font-size: 13.5px;
  line-height: 1.8;
  color: #3f3f46;
  margin-bottom: 10px;
  text-align: justify;
}
.postcard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(244, 63, 94, 0.15);
  padding-top: 12px;
  margin-top: 12px;
}
.postcard-seal {
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}
.postcard-sign {
  font-family: var(--f-serif);
  font-size: 12px;
  font-weight: 600;
  color: #e11d48;
}

.postcard-actions {
  display: flex;
  gap: 10px;
}
.action-btn {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.action-btn--primary {
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(244, 63, 94, 0.35);
}
</style>
