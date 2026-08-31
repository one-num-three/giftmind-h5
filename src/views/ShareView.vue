<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  ShareView —— 收礼人打开的那一页（/s/:shareId）
 *
 *  两幕：
 *    第一幕 EnvelopeCover（3D 虚拟拆礼盒 + 解丝带 + 礼花音效）；
 *    第二幕逐段揭示 —— 问候 → 手写信 → 礼物揭晓 → 接下来会发生什么 →
 *    【免问地址自主填报卡】 → 【快捷可爱感动回信】 → 署名。
 * ══════════════════════════════════════════════════════════════
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
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
const QUICK_EMOTIONS = ['🥰 呜呜太感动了！', '🎉 超级喜欢这个！', '💖 谢谢你的用心～', '👀 期待开箱啦！']

const loading = ref(true)
const failed = ref(false)
const data = ref(null)

const opening = ref(false)
const opened = ref(false)

const replyText = ref('')
const repliedText = ref('')
const replied = ref(false)
const replying = ref(false)

/* ── 免问地址：收件信息表单 ───────────────────── */
const addressForm = reactive({
  name: '',
  phone: '',
  address: '',
  note: '',
})
const addressSubmitted = ref(false)
const addressSubmitting = ref(false)

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

/* ── 提交收件地址 ───────────────────────────── */
async function submitAddress() {
  if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.address.trim()) {
    ui.showToast('请完整填写姓名、电话和收件地址')
    return
  }
  addressSubmitting.value = true
  try {
    const summary = `[📦 收件地址] 姓名: ${addressForm.name.trim()} | 电话: ${addressForm.phone.trim()} | 地址: ${addressForm.address.trim()}${addressForm.note.trim() ? ` | 备注: ${addressForm.note.trim()}` : ''}`
    await api.sendShareReply(String(route.params.shareId || ''), summary)
    addressSubmitted.value = true
    try {
      localStorage.setItem(`gm_recipient_addr_${route.params.shareId}`, JSON.stringify(addressForm))
    } catch {}
    ui.success('收件信息已送达送礼人')
  } catch (err) {
    ui.error('提交稍慢，请重试')
  } finally {
    addressSubmitting.value = false
  }
}

/* ── 回一句话 ───────────────────────────────── */
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
      if (latest.content.startsWith('[📦 收件地址]')) {
        addressSubmitted.value = true
      } else {
        repliedText.value = text(latest.content)
        replied.value = true
      }
    }
    // 读取历史保存的地址
    try {
      const savedAddr = localStorage.getItem(`gm_recipient_addr_${route.params.shareId}`)
      if (savedAddr) {
        Object.assign(addressForm, JSON.parse(savedAddr))
        addressSubmitted.value = true
      }
    } catch {}
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
        <p class="state__note">正在把心意盲盒取出来...</p>
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

        <!-- 礼物揭晓 -->
        <template v-if="showGifts">
          <RevealSection class="blk blk--tight">
            <p class="lead__label">TA 为你准备的礼物</p>
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

        <!-- 免问地址：收礼人专属收件信息填报卡 -->
        <RevealSection class="blk">
          <div class="address-box grain">
            <div class="address-box__head">
              <span class="badge-ship">📦 配送信息</span>
              <h4 class="address-box__title">填写您的专属收件地址</h4>
              <p class="address-box__desc">心意准备向你奔赴，送礼人将根据此地址为你安排妥帖投递～</p>
            </div>

            <template v-if="!addressSubmitted">
              <div class="address-form">
                <input v-model="addressForm.name" class="addr-input" placeholder="收件人姓名 / 称呼" />
                <input v-model="addressForm.phone" class="addr-input" placeholder="手机号码" type="tel" />
                <textarea v-model="addressForm.address" class="addr-input addr-textarea" rows="2" placeholder="详细收货地址（省市区街道楼宇门牌）" />
                <input v-model="addressForm.note" class="addr-input" placeholder="尺码/颜色偏好/备注（选填）" />
                <button type="button" class="addr-btn tap" :disabled="addressSubmitting" @click="submitAddress">
                  {{ addressSubmitting ? '正在提交…' : '确认送达地址 🚀' }}
                </button>
              </div>
            </template>
            <template v-else>
              <div class="address-success">
                <span class="success-icon">✅</span>
                <p class="success-title">收件地址已妥善送达送礼人</p>
                <p class="success-detail">{{ addressForm.name }} · {{ addressForm.phone }}<br>{{ addressForm.address }}</p>
                <p class="success-sub">静候心意到家，愿你拆箱时满心欢喜！</p>
              </div>
            </template>
          </div>
        </RevealSection>

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
              <p class="reply__title">给 TA 留一句心意回话</p>
              <p class="reply__hint">写什么都行，TA 会在方案中看到你的留言。</p>

              <!-- 快捷可爱反应 -->
              <div class="quick-emotions">
                <button
                  v-for="emo in QUICK_EMOTIONS"
                  :key="emo"
                  type="button"
                  class="emotion-pill tap"
                  @click="replyText = emo"
                >
                  {{ emo }}
                </button>
              </div>

              <div class="reply__field">
                <textarea
                  v-model="replyText"
                  class="reply__input"
                  rows="2"
                  maxlength="60"
                  placeholder="或者写一句自己的心里话..."
                />
              </div>
              <button type="button" class="reply__send tap" :disabled="replying" @click="sendReply">
                {{ replying ? '正在送出…' : '送出这句话 💌' }}
              </button>
            </template>
            <template v-else>
              <p class="reply__title">你的回话已经送达</p>
              <p class="reply__echo">「{{ repliedText }}」</p>
              <p class="reply__hint">送礼人已收到你的甜蜜回馈。</p>
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
  padding: 0 24px;
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
  font-size: 24px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--c-ink);
}

/* 信 */
.paper {
  position: relative;
  overflow: hidden;
  padding: 30px 24px;
  border-radius: var(--r-xl);
  background: var(--sh-paper);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}
.paper__salutation {
  font-family: var(--f-serif);
  font-size: var(--fs-h3);
  font-weight: 600;
  color: var(--c-ink);
  margin-bottom: var(--s-5);
}
.paper__p {
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink);
  text-align: justify;
}
.paper__p + .paper__p {
  margin-top: var(--s-5);
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
  padding: 0 24px;
  margin-bottom: var(--s-10);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.gift {
  display: flex;
  align-items: flex-start;
  gap: var(--s-4);
  padding: var(--s-5);
  border-radius: var(--r-lg);
  background: var(--sh-card);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.gift__emoji {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
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
  font-size: 16px;
  font-weight: 600;
  color: var(--c-ink);
}
.gift__why {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

/* ══ 免问地址卡片 ═══════════════════════════ */
.address-box {
  background: linear-gradient(135deg, #ffffff 0%, #fffbf5 100%);
  border: 1px solid rgba(244, 63, 94, 0.2);
  border-radius: 20px;
  padding: 24px 20px;
  box-shadow: 0 12px 32px rgba(244, 63, 94, 0.08);
}
.address-box__head {
  margin-bottom: 16px;
}
.badge-ship {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
  padding: 3px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.address-box__title {
  font-size: 16px;
  font-weight: 700;
  color: #18181b;
}
.address-box__desc {
  margin-top: 4px;
  font-size: 12px;
  color: #71717a;
  line-height: 1.5;
}
.address-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.addr-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--c-line);
  background: #fff;
  font-size: 13.5px;
  color: var(--c-ink);
  box-sizing: border-box;
}
.addr-input:focus {
  border-color: #f43f5e;
  outline: none;
}
.addr-textarea {
  height: 64px;
  padding: 10px 14px;
  resize: none;
}
.addr-btn {
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 16px rgba(244, 63, 94, 0.3);
  cursor: pointer;
  margin-top: 4px;
}

.address-success {
  text-align: center;
  padding: 16px 8px;
}
.success-icon { font-size: 32px; }
.success-title { font-size: 15px; font-weight: 700; color: #059669; margin: 8px 0 4px; }
.success-detail { font-size: 13px; color: #4b5563; line-height: 1.6; }
.success-sub { font-size: 12px; color: #9ca3af; margin-top: 8px; }

/* 仪式 */
.ritual {
  padding: 0 24px;
  margin-bottom: var(--s-10);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.rit {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--sh-card);
}
.rit__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sh-key);
  flex-shrink: 0;
}
.rit__time {
  font-size: 12px;
  color: var(--c-ink-3);
  margin-right: 6px;
}
.rit__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--c-ink);
}

/* 署名 */
.sign {
  text-align: right;
  padding: 0 8px;
}
.sign__rule {
  display: inline-block;
  width: 40px;
  height: 1px;
  background: var(--sh-key);
  margin-bottom: 8px;
}
.sign__name {
  font-family: var(--f-serif);
  font-size: 15px;
  font-weight: 600;
  color: var(--c-ink-2);
}

/* 回复 */
.reply {
  background: var(--sh-card);
  padding: 24px 20px;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}
.reply__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-ink);
}
.reply__hint {
  font-size: 12px;
  color: var(--c-ink-3);
  margin: 4px 0 12px;
}
.quick-emotions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.emotion-pill {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--sh-wash);
  color: var(--c-ink);
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.reply__field {
  margin-bottom: 12px;
}
.reply__input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--c-line);
  font-size: 13px;
  resize: none;
  box-sizing: border-box;
}
.reply__send {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  background: var(--sh-key);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.reply__echo {
  font-family: var(--f-serif);
  font-size: 15px;
  color: var(--sh-key);
  font-weight: 600;
  margin: 10px 0;
}

.brand {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--c-ink-4);
  background: none;
  border: none;
  padding: 20px 0;
}
</style>
