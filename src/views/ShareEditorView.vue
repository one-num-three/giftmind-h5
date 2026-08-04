<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  ShareEditorView —— 送出前的配置（/share/edit/:id）
 *
 *  上半屏是一个等比缩小的手机预览（375×704 的舞台整体 scale(.5)），
 *  里面就是收礼人真会看到的 EnvelopeCover，改什么都实时反映。
 *  下半屏是配置项，底部固定条生成链接。
 *
 *  开关是自制的（不引组件库），内联在这个文件里。
 * ══════════════════════════════════════════════════════════════
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { copyText } from '@/utils/helpers'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import EnvelopeCover from '@/components/share/EnvelopeCover.vue'
import ThemePicker from '@/components/share/ThemePicker.vue'

const route = useRoute()
const router = useRouter()
const history = useHistoryStore()
const ui = useUiStore()

const GREETING_MAX = 40
const THEMES = ['dawn', 'dusk', 'sage']
const EMOJI_POOL = ['🎁', '💌', '🌿', '✨', '🕯️', '🍰', '🌙', '🎈']

const TOGGLES = [
  { key: 'showGifts', label: '展示礼物清单', desc: '让 TA 看到你挑的三件东西和理由' },
  { key: 'showRitual', label: '展示仪式流程', desc: '告诉 TA 接下来会发生什么' },
  { key: 'showSignature', label: '展示署名', desc: '在信的末尾留下你的落款' },
  { key: 'allowReply', label: '允许 TA 回信', desc: '页面底部会出现一个回话的输入框' },
]

const plan = ref(null)
const generating = ref(false)
const sheetOpen = ref(false)
const result = ref(null)

const form = reactive({
  theme: 'dawn',
  recipient: '',
  greeting: '',
  coverEmoji: '🎁',
  showGifts: true,
  showRitual: true,
  showSignature: true,
  allowReply: true,
  signature: '爱你的我',
})

let alive = true

/* ── 载入方案 ─────────────────────────────── */
function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

onMounted(() => {
  history.reload()
  const found = history.get(String(route.params.id || ''))
  if (!found) {
    ui.error('没有找到这份方案')
    router.replace('/')
    return
  }
  plan.value = found

  const share = found.share && typeof found.share === 'object' ? found.share : {}
  const answers = found.answers && typeof found.answers === 'object' ? found.answers : {}

  form.theme = THEMES.includes(share.theme) ? share.theme : 'dawn'
  // answers.recipient 形如「女朋友 / 妻子」，取斜杠前的一段当默认称呼
  form.recipient = (text(answers.recipient).split('/')[0] || '').trim().slice(0, 12)
  form.greeting = text(share.greeting).slice(0, GREETING_MAX)
  form.coverEmoji = text(share.coverEmoji) || '🎁'
  form.signature = '爱你的我'
})

onUnmounted(() => {
  alive = false
  // GSheet 打开时会锁 body 滚动，页面被直接销毁时补一次还原
  if (sheetOpen.value) document.body.style.overflow = ''
})

/* ── 配置项 ───────────────────────────────── */
const planTitle = computed(() => text(plan.value?.title))

const emojiList = computed(() => {
  const list = [...EMOJI_POOL]
  const cur = text(form.coverEmoji)
  if (cur && !list.includes(cur)) list.unshift(cur)
  return list
})

const greetLen = computed(() => form.greeting.length)
const greetFull = computed(() => greetLen.value >= GREETING_MAX)

const previewRecipient = computed(() => text(form.recipient))
const previewGreeting = computed(() => text(form.greeting))

function toggle(key) {
  form[key] = !form[key]
}

function pickEmoji(e) {
  form.coverEmoji = e
}

/* ── 生成链接 ─────────────────────────────── */
const shareId = computed(() => text(result.value?.shareId))
const shareUrl = computed(() => {
  const direct = text(result.value?.url)
  if (direct) return direct
  if (!shareId.value) return ''
  return `${location.origin}${location.pathname}#/s/${shareId.value}`
})

function buildConfig() {
  return {
    theme: THEMES.includes(form.theme) ? form.theme : 'dawn',
    recipient: text(form.recipient),
    greeting: text(form.greeting).slice(0, GREETING_MAX),
    coverEmoji: text(form.coverEmoji) || '🎁',
    showGifts: form.showGifts,
    showRitual: form.showRitual,
    showSignature: form.showSignature,
    allowReply: form.allowReply,
    signature: text(form.signature) || '爱你的我',
  }
}

async function generate() {
  if (!plan.value || generating.value) return
  generating.value = true
  try {
    // 传整份方案，adapter 会保存不可变快照；之后再编辑原方案不会污染旧分享。
    const res = await api.createShare(plan.value, buildConfig())
    if (!alive) return
    if (!res || !res.shareId) throw new Error('没能拿到链接，请再试一次')
    result.value = res
    sheetOpen.value = true
  } catch (e) {
    if (alive) ui.error(e?.message || '生成失败，请重试')
  } finally {
    if (alive) generating.value = false
  }
}

async function copyLink() {
  if (!shareUrl.value) return
  try {
    const ok = await copyText(shareUrl.value)
    if (ok) ui.success('链接已复制')
    else ui.error('复制失败，长按链接手动复制')
  } catch {
    ui.error('复制失败，长按链接手动复制')
  }
}

function openPreview() {
  if (!shareId.value) return
  sheetOpen.value = false
  router.push(`/s/${shareId.value}`)
}
</script>

<template>
  <div class="page">
    <GNavBar title="做成给 TA 的页面" :subtitle="planTitle" />

    <div class="page__body edit">
      <!-- ══ 实时预览 ══ -->
      <section class="pv">
        <div class="pv__frame">
          <div class="pv__stage">
            <EnvelopeCover
              :theme="form.theme"
              :recipient="previewRecipient"
              :greeting="previewGreeting"
              :emoji="form.coverEmoji"
              :interactive="false"
            />
          </div>
        </div>
        <p class="pv__cap">TA 打开链接时看到的第一屏</p>
      </section>

      <!-- ══ 色调 ══ -->
      <section class="sec">
        <div class="lab"><span class="lab__text">色调</span><span class="lab__rule" /></div>
        <ThemePicker v-model="form.theme" />
      </section>

      <!-- ══ 称呼 ══ -->
      <section class="sec">
        <div class="lab"><span class="lab__text">称呼</span><span class="lab__rule" /></div>
        <div class="field">
          <input
            v-model="form.recipient"
            class="field__input"
            type="text"
            maxlength="12"
            placeholder="TA 的名字，或你平时的叫法"
          />
        </div>
      </section>

      <!-- ══ 问候语 ══ -->
      <section class="sec">
        <div class="lab">
          <span class="lab__text">首屏问候语</span>
          <span class="lab__rule" />
          <span class="lab__count" :class="{ 'is-full': greetFull }">{{ greetLen }}/{{ GREETING_MAX }}</span>
        </div>
        <div class="field field--area">
          <textarea
            v-model="form.greeting"
            class="field__input field__input--area"
            rows="2"
            :maxlength="GREETING_MAX"
            placeholder="第一眼想让 TA 读到的一句话"
          />
        </div>
        <p class="tip">短一点更好读，最多 {{ GREETING_MAX }} 个字。</p>
      </section>

      <!-- ══ 封面 emoji ══ -->
      <section class="sec">
        <div class="lab"><span class="lab__text">封面 emoji</span><span class="lab__rule" /></div>
        <div class="emojis">
          <button
            v-for="e in emojiList"
            :key="e"
            type="button"
            class="emoji tap"
            :class="{ 'is-on': form.coverEmoji === e }"
            :aria-pressed="form.coverEmoji === e"
            @click="pickEmoji(e)"
          >
            {{ e }}
          </button>
        </div>
        <p class="tip">它会被压在信封的火漆印上。</p>
      </section>

      <!-- ══ 开关组 ══ -->
      <section class="sec">
        <div class="lab"><span class="lab__text">TA 能看到什么</span><span class="lab__rule" /></div>
        <GCard padding="none" radius="lg">
          <button
            v-for="(t, i) in TOGGLES"
            :key="t.key"
            type="button"
            class="sw"
            :class="{ 'is-on': form[t.key], 'has-line': i > 0 }"
            :aria-pressed="form[t.key]"
            @click="toggle(t.key)"
          >
            <span class="sw__text">
              <span class="sw__label">{{ t.label }}</span>
              <span class="sw__desc">{{ t.desc }}</span>
            </span>
            <span class="sw__track"><span class="sw__thumb" /></span>
          </button>
        </GCard>
      </section>

      <!-- ══ 署名 ══ -->
      <section class="sec">
        <div class="lab"><span class="lab__text">署名</span><span class="lab__rule" /></div>
        <div class="field">
          <input
            v-model="form.signature"
            class="field__input"
            type="text"
            maxlength="12"
            placeholder="爱你的我"
          />
        </div>
        <p class="tip">写在信的最后一行，可以不是真名。</p>
      </section>
    </div>

    <!-- ══ 底部固定条 ══ -->
    <div class="bar">
      <p class="bar__hint">生成后会得到一个链接，发给 TA 就行。</p>
      <GButton variant="primary" size="lg" block :loading="generating" @click="generate">
        {{ generating ? '正在生成' : '生成链接' }}
      </GButton>
    </div>

    <!-- ══ 链接结果 ══ -->
    <GSheet v-model="sheetOpen" title="链接做好了">
      <p class="done__lead">
        这个链接就是 TA 会打开的那一页。发给 TA 之前，可以自己先看一遍。
      </p>

      <div class="link">
        <span class="link__text">{{ shareUrl }}</span>
        <button type="button" class="link__copy tap" @click="copyLink">
          <GIcon name="copy" :size="15" />
          复制
        </button>
      </div>

      <div class="done__note">
        <p class="done__note-title">把链接发给 TA</p>
        <p class="done__note-text">
          微信、短信都行。不用再多说什么，TA 点开就会知道这是给谁的。
        </p>
      </div>

      <template #footer>
        <GButton variant="primary" size="lg" block @click="openPreview">预览这个页面</GButton>
        <GButton class="done__later" variant="ghost" size="md" block @click="sheetOpen = false">
          先不看了
        </GButton>
      </template>
    </GSheet>
  </div>
</template>

<style scoped>
.edit {
  padding-bottom: var(--s-8);
}

/* ══ 预览 ══════════════════════════════════ */
.pv {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--s-6) var(--page-x) var(--s-7);
  background: var(--g-warm);
}
.pv__frame {
  position: relative;
  width: 188px;
  height: 352px;
  border-radius: 26px;
  overflow: hidden;
  background: var(--c-surface);
  box-shadow: var(--sh-3), inset 0 0 0 1px var(--c-line-strong);
}
.pv__stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 376px;
  height: 704px;
  transform: scale(0.5);
  transform-origin: top left;
}
.pv__cap {
  margin-top: var(--s-4);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}

/* ══ 区块 ══════════════════════════════════ */
.sec {
  padding: 0 var(--page-x);
  margin-top: var(--s-7);
}

.lab {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.lab__text {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-3);
  flex-shrink: 0;
}
.lab__rule {
  flex: 1;
  height: 1px;
  background: var(--c-line);
}
.lab__count {
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
  flex-shrink: 0;
}
.lab__count.is-full {
  color: var(--c-rose);
}

.tip {
  margin-top: var(--s-2);
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
  line-height: var(--lh-snug);
}

/* ══ 输入 ══════════════════════════════════ */
.field {
  border-radius: var(--r-md);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-line);
  transition: box-shadow var(--t-base) var(--e-out);
}
.field:focus-within {
  box-shadow: inset 0 0 0 1px var(--c-rose);
}
.field__input {
  display: block;
  width: 100%;
  height: 48px;
  padding: 0 var(--s-4);
  font-size: var(--fs-body);
  color: var(--c-ink);
}
.field__input--area {
  height: auto;
  min-height: 76px;
  padding: var(--s-3) var(--s-4);
  font-family: var(--f-serif);
  line-height: var(--lh-normal);
}
.field__input::placeholder {
  color: var(--c-ink-4);
}

/* ══ emoji ═════════════════════════════════ */
.emojis {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
.emoji {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-line);
  transition: box-shadow var(--t-fast) var(--e-out), background var(--t-fast),
    transform var(--t-fast) var(--e-out);
}
.emoji.is-on {
  background: var(--c-rose-tint);
  box-shadow: inset 0 0 0 2px var(--c-rose);
  transform: scale(1.06);
}

/* ══ 自制开关 ══════════════════════════════ */
.sw {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--s-4);
  min-height: 62px;
  padding: var(--s-4);
  text-align: left;
}
.sw.has-line {
  border-top: 1px solid var(--c-line);
}
.sw__text {
  flex: 1;
  min-width: 0;
}
.sw__label {
  display: block;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
}
.sw__desc {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-micro);
  line-height: var(--lh-snug);
  color: var(--c-ink-3);
}
.sw__track {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 26px;
  border-radius: var(--r-pill);
  background: var(--c-paper-3);
  transition: background var(--t-base) var(--e-out);
}
.sw__thumb {
  position: absolute;
  top: 2px;
  left: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--sh-1);
  transform: translateX(2px);
  transition: transform var(--t-base) var(--e-out);
}
.sw.is-on .sw__track {
  background: var(--c-rose);
}
.sw.is-on .sw__thumb {
  transform: translateX(20px);
}

/* ══ 底部条 ════════════════════════════════ */
.bar {
  flex-shrink: 0;
  padding: var(--s-3) var(--page-x) calc(var(--s-4) + var(--safe-bottom));
  background: var(--c-paper);
  border-top: 1px solid var(--c-line);
}
.bar__hint {
  margin-bottom: var(--s-3);
  text-align: center;
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
}

/* ══ 结果面板 ══════════════════════════════ */
.done__lead {
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}
.link {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-top: var(--s-4);
  padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-paper-2);
}
.link__text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-caption);
  color: var(--c-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link__copy {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  padding: 0 var(--s-4);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  box-shadow: var(--sh-1);
  font-size: var(--fs-caption);
  color: var(--c-rose-deep);
}
.done__note {
  margin-top: var(--s-5);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-rose-tint);
}
.done__note-title {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
}
.done__note-text {
  margin-top: var(--s-1);
  font-size: var(--fs-caption);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}
.done__later {
  margin-top: var(--s-2);
}
</style>
