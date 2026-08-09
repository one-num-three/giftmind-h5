<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  ShareView —— 收礼人打开的那一页（/s/:shareId）
 *
 *  两幕：
 *    第一幕 EnvelopeCover 占满一屏，点一下开信，900ms 后退场；
 *    第二幕逐段揭示 —— 开场 → 信 → 礼物 → 接下来会发生什么 →
 *    署名 → 回一句话 → by GiftMind。
 *
 *  这一页是给收礼人看的，所以：
 *    · 不出现价格、契合度、任何「产品感」的数据
 *    · 仪式流程只留时间与那一步的名字，不把送礼人的操作说明抖出来
 *    · 任何字段缺了都要有替补文案，绝不显示 undefined 或空白
 * ══════════════════════════════════════════════════════════════
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { useUiStore } from '@/stores/ui'
import EnvelopeCover from '@/components/share/EnvelopeCover.vue'
import RevealSection from '@/components/share/RevealSection.vue'
import { giftsForShare, recipientGiftReason } from '@/utils/sharePlan'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const THEMES = ['dawn', 'dusk', 'sage']
const OPEN_MS = 900

const loading = ref(true)
const failed = ref(false)
const data = ref(null)

const opening = ref(false)
const opened = ref(false)

const replyText = ref('')
const repliedText = ref('')
const replied = ref(false)
const replying = ref(false)

const scrollRef = ref(null)
const bgPos = ref(0)

let alive = true
let openTimer = 0
let rafId = 0
let scrollEl = null

/* ── 取数 ─────────────────────────────────── */
function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const plan = computed(() => data.value?.plan || null)
const config = computed(() => {
  const c = data.value?.config
  return c && typeof c === 'object' ? c : {}
})
const share = computed(() => {
  const s = plan.value?.share
  return s && typeof s === 'object' ? s : {}
})
const letter = computed(() => {
  const l = plan.value?.letter
  return l && typeof l === 'object' ? l : {}
})

const ready = computed(() => !loading.value && !failed.value && Boolean(plan.value))

const theme = computed(() => {
  const t = text(config.value.theme) || text(share.value.theme)
  return THEMES.includes(t) ? t : 'dawn'
})
const recipient = computed(
  () =>
    text(config.value.recipient) ||
    text(plan.value?.recipient).split('/')[0].trim() ||
    text(plan.value?.answers?.recipient).split('/')[0].trim() ||
    '你',
)
const greeting = computed(
  () =>
    text(config.value.greeting) ||
    text(share.value.greeting) ||
    '有些话当面说不出口，就写在这里了。',
)
const coverEmoji = computed(() => text(config.value.coverEmoji) || text(share.value.coverEmoji) || '🎁')

const salutation = computed(() => text(letter.value.salutation) || `${recipient.value}：`)
const paragraphs = computed(() => {
  const list = Array.isArray(letter.value.paragraphs) ? letter.value.paragraphs : []
  return list.map((p) => text(p)).filter(Boolean)
})
const signature = computed(
  () => text(config.value.signature) || text(letter.value.signature) || '爱你的我',
)

const gifts = computed(() => {
  return giftsForShare(plan.value)
})
const giftLeadText = computed(() => (
  gifts.value.length === 1
    ? '这一件，是想了很久才定下来的。'
    : '这几样是想了很久才定下来的。'
))
const ritual = computed(() => {
  const list = Array.isArray(plan.value?.ritual) ? plan.value.ritual : []
  return list.filter((r) => r && typeof r === 'object' && (text(r.title) || text(r.time)))
})

const showGifts = computed(() => config.value.showGifts !== false && gifts.value.length > 0)
const showRitual = computed(() => config.value.showRitual !== false && ritual.value.length > 0)
const showSignature = computed(() => config.value.showSignature !== false)
const allowReply = computed(() => config.value.allowReply !== false)

const bgStyle = computed(() => ({ backgroundPosition: `50% ${bgPos.value}%` }))

function giftEmoji(g) {
  return text(g.emoji) || '🎁'
}
function giftName(g) {
  return text(g.name) || '一件为你挑的东西'
}
/**
 * 礼物理由是写给「送礼人」看的，里面可能直接引用了送礼人当初说的原话
 * （如「把「她一直说想学插花」记在心上之后…」）。收礼人读到会出戏，
 * 所以这里把带引号回述的那一句剥掉，只保留描述礼物本身的部分。
 */
const SENDER_VOICE = /^[^。！？]*[「“][^」”]*[」”][^。！？]*[。！？]\s*/
function giftWhy(g) {
  const raw = text(g.why)
  if (!raw) return ''
  const trimmed = raw.replace(SENDER_VOICE, '').trim()
  return recipientGiftReason(trimmed.length >= 12 ? trimmed : raw)
}
function ritualTime(r) {
  return text(r.time)
}
function ritualTitle(r) {
  return text(r.title) || '到时候你就知道了'
}

/* ── 开信 ─────────────────────────────────── */
function openCover() {
  if (opening.value || opened.value) return
  opening.value = true
  openTimer = setTimeout(() => {
    openTimer = 0
    if (!alive) return
    opened.value = true
    opening.value = false
  }, OPEN_MS)
}

/* ── 背景随滚动缓慢位移 ─────────────────────── */
function measure() {
  rafId = 0
  if (!scrollEl) return
  const max = scrollEl.scrollHeight - scrollEl.clientHeight
  const p = max > 8 ? (scrollEl.scrollTop / max) * 100 : 0
  bgPos.value = Math.min(100, Math.max(0, Math.round(p)))
}
function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(measure)
}

/* ── 回一句话（本地持久化到 shareId） ───────── */
async function sendReply() {
  const t = replyText.value.trim()
  if (!t) {
    ui.showToast('写一句再送过去吧')
    return
  }
  if (replying.value) return
  replying.value = true
  try {
    const reply = await api.sendShareReply(String(route.params.shareId || ''), t)
    repliedText.value = text(reply?.content) || t
    replied.value = true
    replyText.value = ''
    ui.success('已经送到了')
  } catch (error) {
    ui.error(error?.message || '暂时没送到，请再试一次')
  } finally {
    replying.value = false
  }
}

function goHome() {
  router.push('/')
}

/* ── 生命周期 ─────────────────────────────── */
onMounted(async () => {
  scrollEl = scrollRef.value
  scrollEl?.addEventListener('scroll', onScroll, { passive: true })

  try {
    const res = await api.fetchShare(String(route.params.shareId || ''))
    if (!alive) return
    if (!res || !res.plan) throw new Error('内容不完整')
    data.value = res
    const previous = await api.fetchShareReplies({ shareId: String(route.params.shareId || '') })
    const latest = Array.isArray(previous) ? previous[previous.length - 1] : null
    if (latest?.content) {
      repliedText.value = text(latest.content)
      replied.value = true
    }
  } catch {
    if (alive) failed.value = true
  } finally {
    if (alive) loading.value = false
  }
})

onUnmounted(() => {
  alive = false
  if (openTimer) clearTimeout(openTimer)
  openTimer = 0
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  scrollEl?.removeEventListener('scroll', onScroll)
  scrollEl = null
})
</script>

<template>
  <div class="page share" :class="`t-${theme}`" :style="bgStyle">
    <div ref="scrollRef" class="page__body share__scroll">
      <!-- ══ 加载 ══ -->
      <div v-if="loading" class="state">
        <GSkeleton width="128px" height="13px" radius="var(--r-pill)" />
        <div class="state__env">
          <GSkeleton width="208px" height="138px" radius="var(--r-sm)" />
        </div>
        <GSkeleton width="164px" height="20px" radius="var(--r-pill)" />
        <GSkeleton width="236px" height="14px" radius="var(--r-pill)" />
        <p class="state__note">正在把信取出来</p>
      </div>

      <!-- ══ 打不开 ══ -->
      <div v-else-if="failed || !plan" class="state state--empty">
        <GEmpty emoji="🕊️" title="这封信已经不在了" desc="链接可能已经过期，或者被收回了。">
          <GButton variant="soft" size="md" @click="goHome">去看看 GiftMind</GButton>
        </GEmpty>
      </div>

      <!-- ══ 第二幕 ══ -->
      <div v-else-if="opened" class="acts anim-in">
        <!-- 开场 -->
        <RevealSection class="blk">
          <p class="open__eyebrow">写给{{ recipient }}</p>
          <p class="open__line">{{ greeting }}</p>
        </RevealSection>

        <!-- 信 -->
        <RevealSection v-if="paragraphs.length" class="blk">
          <div class="paper grain">
            <p class="paper__salutation">{{ salutation }}</p>
            <p v-for="(p, i) in paragraphs" :key="i" class="paper__p">{{ p }}</p>
            <span class="paper__rule" />
          </div>
        </RevealSection>

        <!-- 礼物 -->
        <template v-if="showGifts">
          <RevealSection class="blk blk--tight">
            <p class="lead__label">TA 给你准备的</p>
            <p class="lead__text">{{ giftLeadText }}</p>
          </RevealSection>
          <div class="gifts">
            <RevealSection v-for="(g, i) in gifts" :key="g.id || i" :delay="i * 90">
              <article class="gift">
                <span class="gift__emoji">{{ giftEmoji(g) }}</span>
                <div class="gift__body">
                  <h3 class="gift__name">{{ giftName(g) }}</h3>
                  <p v-if="giftWhy(g)" class="gift__why">{{ giftWhy(g) }}</p>
                </div>
              </article>
            </RevealSection>
          </div>
        </template>

        <!-- 接下来会发生什么 -->
        <template v-if="showRitual">
          <RevealSection class="blk blk--tight">
            <p class="lead__label">接下来会发生什么</p>
            <p class="lead__text">这几步已经安排好了，你什么都不用准备。</p>
          </RevealSection>
          <div class="ritual">
            <RevealSection v-for="(r, i) in ritual" :key="i" :delay="i * 80">
              <div class="rit">
                <span class="rit__dot" />
                <p v-if="ritualTime(r)" class="rit__time">{{ ritualTime(r) }}</p>
                <p class="rit__title">{{ ritualTitle(r) }}</p>
              </div>
            </RevealSection>
          </div>
        </template>

        <!-- 署名 -->
        <RevealSection v-if="showSignature" class="blk">
          <div class="sign">
            <span class="sign__rule" />
            <p class="sign__name">{{ signature }}</p>
          </div>
        </RevealSection>

        <!-- 回一句话 -->
        <RevealSection v-if="allowReply" class="blk">
          <div class="reply">
            <template v-if="!replied">
              <p class="reply__title">要回一句话吗</p>
              <p class="reply__hint">写什么都行，TA 会看到。</p>
              <div class="reply__field">
                <textarea
                  v-model="replyText"
                  class="reply__input"
                  rows="2"
                  maxlength="60"
                  placeholder="比如：我很喜欢。"
                />
              </div>
              <button type="button" class="reply__send tap" :disabled="replying" @click="sendReply">
                {{ replying ? '正在送出…' : '送出这句话' }}
              </button>
            </template>
            <template v-else>
              <p class="reply__title">你的回话已经送到</p>
              <p class="reply__echo">「{{ repliedText }}」</p>
              <p class="reply__hint">送礼的人会在方案里看到。</p>
            </template>
          </div>
        </RevealSection>

        <!-- 品牌署名 -->
        <RevealSection class="blk blk--brand">
          <button type="button" class="brand tap" @click="goHome">by GiftMind</button>
        </RevealSection>
      </div>
    </div>

    <!-- ══ 第一幕 ══ -->
    <EnvelopeCover
      v-if="ready && !opened"
      :theme="theme"
      :recipient="recipient"
      :greeting="greeting"
      :emoji="coverEmoji"
      :opening="opening"
      @open="openCover"
    />
  </div>
</template>

<style scoped>
/* ══ 三套色调 ══════════════════════════════
   和 EnvelopeCover 用同一套 --sh-* 命名，全部由 token 组合。 */
.t-dawn {
  --sh-bg: var(--g-dawn);
  --sh-key: var(--c-rose);
  --sh-key-deep: var(--c-rose-deep);
  --sh-key-soft: var(--c-rose-soft);
  --sh-paper: var(--c-surface-alt);
  --sh-card: var(--c-surface);
  --sh-wash: var(--c-rose-tint);
}
.t-dusk {
  --sh-bg: var(--g-dusk);
  --sh-key: var(--c-lilac-deep);
  --sh-key-deep: var(--c-lilac-deep);
  --sh-key-soft: var(--c-lilac-soft);
  --sh-paper: var(--c-surface);
  --sh-card: var(--c-surface);
  --sh-wash: var(--c-lilac-soft);
}
.t-sage {
  --sh-bg: linear-gradient(162deg, var(--c-sage-soft) 0%, var(--c-paper) 46%, var(--c-sand-soft) 100%);
  --sh-key: var(--c-sage-deep);
  --sh-key-deep: var(--c-sage-deep);
  --sh-key-soft: var(--c-sage-soft);
  --sh-paper: var(--c-surface-alt);
  --sh-card: var(--c-surface-alt);
  --sh-wash: var(--c-sage-soft);
}

.share {
  position: relative;
  overflow: hidden;
  background: var(--sh-bg);
  background-size: 100% 172%;
  background-repeat: no-repeat;
  transition: background-position 1200ms linear;
}
.share__scroll {
  position: relative;
  z-index: 0;
}

/* ══ 载入 / 空态 ═══════════════════════════ */
.state {
  min-height: 76vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-4);
  padding: var(--s-9) var(--page-x);
}
.state--empty {
  gap: 0;
}
.state__env {
  margin: var(--s-3) 0 var(--s-5);
}
.state__note {
  margin-top: var(--s-3);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
  letter-spacing: var(--ls-wide);
}

/* ══ 第二幕 ════════════════════════════════ */
.acts {
  padding: 88px 0 calc(var(--s-9) + var(--safe-bottom));
}
.blk {
  padding: 0 26px;
  margin-bottom: var(--s-10);
}
.blk--tight {
  margin-bottom: var(--s-5);
}
.blk--brand {
  margin-top: var(--s-8);
  margin-bottom: 0;
}

/* 开场 */
.open__eyebrow {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--sh-key);
}
.open__line {
  margin-top: var(--s-4);
  font-family: var(--f-serif);
  font-size: 25px;
  font-weight: 500;
  line-height: 1.66;
  color: var(--c-ink);
}

/* 信 */
.paper {
  position: relative;
  overflow: hidden;
  padding: 34px 26px 30px;
  border-radius: var(--r-xl);
  background: var(--sh-paper);
  box-shadow: var(--sh-1);
}
.paper__salutation {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  color: var(--c-ink);
  margin-bottom: var(--s-6);
}
.paper__p {
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink);
  text-align: justify;
}
.paper__p + .paper__p {
  margin-top: var(--s-6);
}
.paper__rule {
  display: block;
  width: 26px;
  height: 1px;
  margin-top: var(--s-7);
  background: var(--sh-key);
  opacity: 0.5;
}

/* 小标题 */
.lead__label {
  font-family: var(--f-serif);
  font-size: var(--fs-h2);
  color: var(--c-ink);
}
.lead__text {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
}

/* 礼物 */
.gifts {
  padding: 0 26px;
  margin-bottom: var(--s-10);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.gift {
  display: flex;
  align-items: flex-start;
  gap: var(--s-4);
  padding: var(--s-5) var(--s-5);
  border-radius: var(--r-lg);
  background: var(--sh-card);
  box-shadow: var(--sh-1);
}
.gift__emoji {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  border-radius: 50%;
  background: var(--sh-wash);
}
.gift__body {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}
.gift__name {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
}
.gift__why {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

/* 接下来会发生什么 */
.ritual {
  padding: 0 26px;
  margin-bottom: var(--s-10);
}
.rit {
  position: relative;
  padding: 0 0 var(--s-6) 26px;
}
.rit::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: var(--c-line-strong);
}
.ritual > :last-child .rit::before {
  display: none;
}
.ritual > :last-child .rit {
  padding-bottom: 0;
}
.rit__dot {
  position: absolute;
  left: 0;
  top: 5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--sh-key);
  opacity: 0.75;
}
.rit__time {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--sh-key);
}
.rit__title {
  margin-top: var(--s-1);
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  line-height: var(--lh-snug);
  color: var(--c-ink);
}

/* 署名 */
.sign {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.sign__rule {
  width: 40px;
  height: 1px;
  background: var(--c-line-strong);
  margin-bottom: var(--s-4);
}
.sign__name {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  color: var(--c-ink-2);
}

/* 回一句话 */
.reply {
  padding: var(--s-6) var(--s-5);
  border-radius: var(--r-xl);
  background: var(--sh-wash);
}
.reply__title {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  color: var(--c-ink);
}
.reply__hint {
  margin-top: var(--s-2);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}
.reply__field {
  margin-top: var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-line);
  transition: box-shadow var(--t-base) var(--e-out);
}
.reply__field:focus-within {
  box-shadow: inset 0 0 0 1px var(--sh-key);
}
.reply__input {
  display: block;
  width: 100%;
  min-height: 78px;
  padding: var(--s-3) var(--s-4);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--c-ink);
}
.reply__input::placeholder {
  color: var(--c-ink-4);
}
.reply__send {
  width: 100%;
  height: 46px;
  margin-top: var(--s-4);
  border-radius: var(--r-pill);
  background: var(--sh-key);
  color: var(--c-ink-inverse);
  font-size: var(--fs-sm);
  font-weight: 500;
}
.reply__echo {
  margin-top: var(--s-4);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink);
}

/* 品牌 */
.brand {
  display: block;
  width: 100%;
  min-height: 44px;
  font-family: var(--f-display);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wider);
  color: var(--c-ink-4);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .share {
    transition: none;
  }
}
</style>
