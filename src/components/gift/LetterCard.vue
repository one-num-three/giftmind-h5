<script setup>
/**
 * LetterCard —— 替你写的那封信
 *
 * 信纸质感：微暖底 + 极淡横线 + 纸纹，段间距放到 --lh-loose 的节奏上。
 * 复制在组件内直接完成（纯读操作）；换语气只往上抛事件，方案的改写交给页面。
 */
import { ref, computed } from 'vue'
import { copyText } from '@/utils/helpers'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  letter: { type: Object, default: () => ({}) },
  loading: Boolean,
})

const emit = defineEmits(['change-tone'])

const ui = useUiStore()

/** 可选语气。match 用来把 letter.tone（可能是模板自带的说法）归到某一档上 */
const TONES = [
  { key: '现代诗意', label: '现代诗意', hint: '有画面、有留白，像写给一个人', match: ['现代诗', '诗意', 'modern_poetic', '自然'] },
  { key: '克制真诚', label: '克制真诚', hint: '少说一点，但每句都算数', match: ['克制', '真诚'] },
  { key: '俏皮', label: '俏皮', hint: '轻一点，带一句玩笑', match: ['俏皮', '轻快', '轻松', '狡黠', '有梗'] },
  { key: '郑重', label: '郑重', hint: '一字一句，认真讲完', match: ['郑重', '正式', '认真'] },
  { key: '温暖', label: '温暖', hint: '像家常话，落在日子里', match: ['温暖', '温柔', '妥帖', '踏实'] },
  { key: '热烈', label: '热烈', hint: '不含蓄，说得满一点', match: ['热烈', '深情', '直白', '炽热'] },
]

function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const salutation = computed(() => text(props.letter?.salutation))
const signature = computed(() => text(props.letter?.signature))
const toneLabel = computed(() => text(props.letter?.tone))
const paragraphs = computed(() => {
  const list = Array.isArray(props.letter?.paragraphs) ? props.letter.paragraphs : []
  return list.map(text).filter(Boolean)
})
const hasBody = computed(() => Boolean(salutation.value || paragraphs.value.length))

/** 当前语气落在哪一档：先按 key 精确命中，再按关键词模糊命中 */
const currentToneKey = computed(() => {
  const t = toneLabel.value
  if (!t) return ''
  const exact = TONES.find((o) => o.key === t)
  if (exact) return exact.key
  const fuzzy = TONES.find((o) => o.match.some((k) => t.includes(k)))
  return fuzzy ? fuzzy.key : ''
})

const sheetOpen = ref(false)

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
  if (ok) ui.success('整封信已复制')
  else ui.error('复制没成功，可以长按选中文字')
}

function pickTone(key) {
  sheetOpen.value = false
  if (!key) return
  emit('change-tone', key)
}
</script>

<template>
  <GCard class="letter" padding="none" radius="xl">
    <div class="letter__paper grain">
      <span class="letter__quote" aria-hidden="true">“</span>

      <template v-if="loading">
        <div class="letter__loading">
          <GSkeleton width="38%" height="18px" />
          <GSkeleton :rows="3" height="14px" />
          <GSkeleton :rows="3" height="14px" />
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

    <div class="letter__tools">
      <button class="tool tap" type="button" :disabled="loading || !fullText" @click="onCopy">
        <GIcon name="copy" :size="16" />
        <span>复制全文</span>
      </button>

      <span class="tool__sep" aria-hidden="true" />

      <button class="tool tap" type="button" :disabled="loading" @click="sheetOpen = true">
        <GIcon name="refresh" :size="16" />
        <span>换个语气</span>
        <em v-if="toneLabel" class="tool__now">{{ toneLabel }}</em>
      </button>
    </div>

    <GSheet v-model="sheetOpen" title="换个语气">
      <p class="sheet__desc">换的是说法，不是内容。你提到的那些细节都会留着。</p>
      <ul class="tones">
        <li v-for="t in TONES" :key="t.key">
          <button
            class="tone tap"
            :class="{ 'is-on': t.key === currentToneKey }"
            type="button"
            @click="pickTone(t.key)"
          >
            <span class="tone__text">
              <span class="tone__label">{{ t.label }}</span>
              <span class="tone__hint">{{ t.hint }}</span>
            </span>
            <GIcon v-if="t.key === currentToneKey" name="check" :size="17" />
          </button>
        </li>
      </ul>
    </GSheet>
  </GCard>
</template>

<style scoped>
.letter {
  position: relative;
}

/* ── 信纸 ─────────────────────────────────── */
.letter__paper {
  position: relative;
  padding: var(--s-7) var(--s-5) var(--s-6);
  background: var(--c-surface-alt);
  overflow: hidden;
}
/* 极淡的横线纹理，只做质感，不参与对齐 */
.letter__paper::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.5;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 29px,
    var(--c-line) 29px,
    var(--c-line) 30px
  );
}

.letter__quote {
  position: relative;
  display: block;
  font-family: var(--f-display);
  font-style: italic;
  font-size: 52px;
  line-height: 0.5;
  color: var(--c-rose);
  opacity: 0.34;
}

.letter__salu {
  position: relative;
  margin-top: var(--s-6);
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  color: var(--c-ink);
}

.letter__p {
  position: relative;
  margin-top: var(--s-5);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink);
  text-align: justify;
  word-break: break-word;
}

.letter__sign {
  position: relative;
  margin-top: var(--s-6);
  text-align: right;
  font-family: var(--f-serif);
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
}

.letter__empty {
  position: relative;
  margin-top: var(--s-5);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

.letter__loading {
  position: relative;
  margin-top: var(--s-6);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
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
  font-size: var(--fs-sm);
}
.tool:disabled {
  opacity: 0.45;
  pointer-events: none;
}
.tool__now {
  min-width: 0;
  font-style: normal;
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool__sep {
  width: 1px;
  height: 20px;
  background: var(--c-line);
  flex-shrink: 0;
}

/* ── 语气选择 ─────────────────────────────── */
.sheet__desc {
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
  margin-bottom: var(--s-4);
}
.tones {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.tone {
  width: 100%;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-ink-2);
  box-shadow: inset 0 0 0 1px var(--c-line);
  text-align: left;
  transition: all var(--t-fast) var(--e-out);
}
.tone.is-on {
  background: var(--c-rose-tint);
  color: var(--c-rose-deep);
  box-shadow: inset 0 0 0 1px var(--c-rose-soft);
}
.tone__text {
  min-width: 0;
}
.tone__label {
  display: block;
  font-size: var(--fs-body);
  font-weight: 500;
  color: var(--c-ink);
}
.tone.is-on .tone__label {
  color: var(--c-rose-deep);
}
.tone__hint {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}
</style>
