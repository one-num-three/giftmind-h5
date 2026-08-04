<script setup>
/**
 * PlanView —— 方案结果页（交付核心）
 *
 * 自上而下：封面 → AI 洞察 → 三件礼物 → 一封信 → 仪式流程 → 底部操作条。
 * 路由 /plan/:id?：带 id 从 historyStore 取，不带 id 用 planStore.current，两者都没有就回首页。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useHistoryStore } from '@/stores/history'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { copyText } from '@/utils/helpers'
import api from '@/api'
import { REPLACE_REASONS } from '@/api/contracts'
import InsightBlock from '@/components/gift/InsightBlock.vue'
import GiftCard from '@/components/gift/GiftCard.vue'
import LetterCard from '@/components/gift/LetterCard.vue'
import RitualTimeline from '@/components/gift/RitualTimeline.vue'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const historyStore = useHistoryStore()
const session = useSessionStore()
const ui = useUiStore()

/* ── 取方案 ───────────────────────────────── */
const routeId = String(route.params.id || '')
if (routeId) {
  const saved = historyStore.get(routeId)
  if (saved) planStore.setCurrent(saved)
}

// 重新策划时先离开页面，等组件真正销毁再清 store，避免转场里闪一下空页
const restarting = ref(false)
const plan = computed(() => planStore.current)

const backTo = computed(() => (routeId ? '/history' : '/'))

/* ── 内容（全部带兜底，任何字段缺失都不显示 undefined） ── */
function text(v) {
  return typeof v === 'string' ? v.trim() : ''
}

const title = computed(() => text(plan.value?.title) || '给 TA 的一份方案')
const subtitle = computed(() => text(plan.value?.subtitle))
const insight = computed(() => plan.value?.insight || null)
const hasInsight = computed(() => {
  const i = insight.value
  if (!i || typeof i !== 'object') return false
  const traits = Array.isArray(i.traits) ? i.traits.filter((t) => text(t)) : []
  return Boolean(text(i.summary) || text(i.keyPoint) || traits.length)
})
const gifts = computed(() => (Array.isArray(plan.value?.gifts) ? plan.value.gifts : []))
const letter = computed(() => plan.value?.letter || null)
const ritual = computed(() => (Array.isArray(plan.value?.ritual) ? plan.value.ritual : []))

const metas = computed(() => {
  const a = plan.value?.answers || {}
  const out = []
  const push = (k, v) => {
    const t = text(v)
    if (t) out.push({ k, v: t })
  }
  push('收礼人', a.recipient)
  push('场合', a.occasion)
  push('预算', a.budget)
  push('距离送出', a.timing)
  return out
})

function isLiked(id) {
  return Boolean(id) && planStore.likedGiftIds.includes(id)
}

function giftKey(gift) {
  return gift?.catalogId || gift?.id || ''
}

function isLocked(id) {
  return Boolean(id) && planStore.lockedGiftIds.includes(id)
}

/* ── 礼物：换一批 / 收藏 ──────────────────── */
const shuffling = ref(false)

async function onShuffle() {
  if (shuffling.value || !plan.value) return
  shuffling.value = true
  try {
    await planStore.shuffleGifts()
    ui.success('换了三件新的')
  } catch {
    ui.error('没能换出新的，稍后再试')
  } finally {
    shuffling.value = false
  }
}

function onToggleLike(id) {
  planStore.toggleLike(id)
}

function onToggleLock(id) {
  planStore.toggleLock(id)
  ui.success(isLocked(id) ? '已保留这件，后续调整不会替换它' : '已取消保留')
}

const replaceOpen = ref(false)
const replaceTargetId = ref('')
const replaceReason = ref('not_for_them')
const replaceNote = ref('')
const replacingId = ref('')

function openReplace(id) {
  replaceTargetId.value = id
  replaceReason.value = 'not_for_them'
  replaceNote.value = ''
  replaceOpen.value = true
}

async function confirmReplace() {
  if (!replaceTargetId.value || replacingId.value) return
  replacingId.value = replaceTargetId.value
  replaceOpen.value = false
  try {
    await planStore.replaceGift(replacingId.value, {
      reason: replaceReason.value,
      reasonNote: replaceNote.value,
    })
    ui.success('已经换成一件更合适的')
  } catch (error) {
    ui.error(error?.message || '这次没换成，请稍后再试')
  } finally {
    replacingId.value = ''
  }
}

/* ── 信：换语气 ───────────────────────────── */
const letterLoading = ref(false)

async function onChangeTone(tone) {
  if (letterLoading.value || !plan.value) return
  letterLoading.value = true
  try {
    await planStore.regenerateLetter(tone)
    ui.success(`已经换成「${tone}」的语气`)
  } catch {
    ui.error('这次没改成，稍后再试')
  } finally {
    letterLoading.value = false
  }
}

const ritualOpen = ref(false)
const ritualInstruction = ref('')
const ritualLoading = ref(false)

async function onRewriteRitual() {
  if (ritualLoading.value) return
  ritualLoading.value = true
  ritualOpen.value = false
  try {
    await planStore.rewriteRitual(ritualInstruction.value)
    ritualInstruction.value = ''
    ui.success('仪式流程已经重新整理')
  } catch (error) {
    ui.error(error?.message || '这次没改成，请稍后再试')
  } finally {
    ritualLoading.value = false
  }
}

const sourceText = computed(() => {
  if (!plan.value?.source) return ''
  if (plan.value.source === 'deepseek') return `DeepSeek · ${text(plan.value.model) || 'AI 生成'}`
  if (plan.value.source === 'rule_fallback') return '规则模式生成'
  return text(plan.value.source)
})
const replies = computed(() => planStore.replies || [])

/* ── 分享 / 更多 ──────────────────────────── */
const moreOpen = ref(false)
const restartOpen = ref(false)

function planToText() {
  const p = plan.value
  if (!p) return ''
  const lines = [title.value]
  if (subtitle.value) lines.push(subtitle.value)

  const sum = text(p.insight?.summary)
  if (sum) lines.push('', '【读到的 TA】', sum)

  if (gifts.value.length) {
    lines.push('', '【礼物推荐】')
    gifts.value.forEach((g, i) => {
      const emo = text(g?.emoji)
      const name = text(g?.name) || '未命名'
      const price = text(g?.price)
      lines.push(`${i + 1}. ${emo ? `${emo} ` : ''}${name}${price ? `（${price}）` : ''}`)
      const why = text(g?.why)
      if (why) lines.push(`   ${why}`)
    })
  }

  const salu = text(p.letter?.salutation)
  const paras = Array.isArray(p.letter?.paragraphs) ? p.letter.paragraphs.map(text).filter(Boolean) : []
  if (salu || paras.length) {
    lines.push('', '【那封信】')
    if (salu) lines.push(salu)
    paras.forEach((x) => lines.push(x))
    const sign = text(p.letter?.signature)
    if (sign) lines.push(sign)
  }

  if (ritual.value.length) {
    lines.push('', '【送出的流程】')
    ritual.value.forEach((s) => {
      const t = text(s?.time)
      const ti = text(s?.title)
      if (t || ti) lines.push(`· ${t ? `${t} · ` : ''}${ti}`)
      const d = text(s?.desc)
      if (d) lines.push(`  ${d}`)
    })
  }

  return lines.join('\n')
}

async function onCopyPlan() {
  moreOpen.value = false
  const t = planToText()
  if (!t) return
  const ok = await copyText(t)
  if (ok) ui.success('整份方案已复制')
  else ui.error('复制没成功，可以长按选中文字')
}

function goShare() {
  moreOpen.value = false
  const id = plan.value?.id
  if (!id) {
    ui.error('这份方案还没存好，稍后再试')
    return
  }
  router.push(`/share/edit/${id}`)
}

function goHistory() {
  moreOpen.value = false
  router.push('/history')
}

function confirmRestart() {
  restartOpen.value = false
  restarting.value = true
  router.replace('/').catch(() => {
    restarting.value = false
  })
}

/* ── 滚动：顶栏从透明变实 ─────────────────── */
const bodyRef = ref(null)
const scrolled = ref(false)
let scrollEl = null
let rafId = 0

function update() {
  rafId = 0
  if (!scrollEl) return
  scrolled.value = scrollEl.scrollTop > 56
}

function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(update)
}

onMounted(() => {
  if (!planStore.current) {
    router.replace('/')
    return
  }
  scrollEl = bodyRef.value
  scrollEl?.addEventListener('scroll', onScroll, { passive: true })
  planStore.loadReplies()
})

onUnmounted(() => {
  scrollEl?.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  scrollEl = null
  // 组件被销毁时如果还开着弹层，把 body 的滚动锁还回去
  if (moreOpen.value || restartOpen.value) {
    document.body.style.overflow = ''
    moreOpen.value = false
    restartOpen.value = false
  }
  // 「重新策划」的清场放在这里做，页面已经看不见了
  if (restarting.value) {
    session.reset()
    planStore.clear()
  }
})
</script>

<template>
  <div class="page plan">
    <GNavBar
      :transparent="!scrolled"
      :title="scrolled ? title : ''"
      :to="backTo"
    >
      <template #right>
        <button class="navact tap" type="button" aria-label="分享与更多" @click="moreOpen = true">
          <GIcon name="share" :size="18" />
        </button>
      </template>
    </GNavBar>

    <div v-if="plan" ref="bodyRef" class="page__body plan__body">
      <!-- ══ 封面 ══ -->
      <header class="cover grain anim-up">
        <p class="cover__eyebrow">你的专属方案</p>
        <h1 class="cover__title">{{ title }}</h1>
        <p v-if="subtitle" class="cover__sub">{{ subtitle }}</p>
        <p v-if="sourceText" class="source-note">{{ sourceText }}</p>

        <ul v-if="metas.length" class="metas">
          <li v-for="m in metas" :key="m.k" class="meta">
            <span class="meta__k">{{ m.k }}</span>
            <span class="meta__v">{{ m.v }}</span>
          </li>
        </ul>
      </header>

      <!-- ══ 内容纸面 ══ -->
      <div class="sheet">
        <!-- 洞察 -->
        <section v-if="hasInsight" class="sec anim-up d-1">
          <InsightBlock :insight="insight" />
        </section>

        <!-- 礼物 -->
        <section class="sec anim-up d-2">
          <div class="sec__head">
            <p class="section-label">礼物推荐</p>
            <button
              v-if="api.isMock"
              class="linkbtn tap"
              type="button"
              :disabled="shuffling || !gifts.length"
              @click="onShuffle"
            >
              <GIcon name="refresh" :size="14" />
              <span>{{ shuffling ? '换着…' : '换一批' }}</span>
            </button>
          </div>

          <div v-if="gifts.length" class="gifts" :class="{ 'is-busy': shuffling }">
            <GiftCard
              v-for="(g, i) in gifts"
              :key="giftKey(g) || `gift-${i}`"
              :gift="g"
              :primary="i === 0"
              :liked="isLiked(giftKey(g))"
              :locked="isLocked(giftKey(g))"
              :replacing="replacingId === giftKey(g)"
              @toggle-like="onToggleLike"
              @toggle-lock="onToggleLock"
              @replace="openReplace"
            />
          </div>
          <GEmpty
            v-else
            emoji="🎁"
            title="这次没挑出合适的"
            desc="换一批试试，或者回去把条件放宽一点。"
          />
        </section>

        <!-- 信 -->
        <section v-if="letter || letterLoading" class="sec anim-up d-3">
          <p class="section-label">替你写的信</p>
          <LetterCard :letter="letter || {}" :loading="letterLoading" @change-tone="onChangeTone" />
        </section>

        <!-- 仪式 -->
        <section v-if="ritual.length" class="sec anim-up d-4">
          <div class="sec__head">
            <p class="section-label">送出的那一刻</p>
            <button class="linkbtn tap" type="button" :disabled="ritualLoading" @click="ritualOpen = true">
              <GIcon name="refresh" :size="14" />
              <span>{{ ritualLoading ? '调整中…' : '调整仪式' }}</span>
            </button>
          </div>
          <RitualTimeline :steps="ritual" />
        </section>

        <section v-if="replies.length" class="sec replies anim-up">
          <p class="section-label">TA 的回话</p>
          <div v-for="reply in replies" :key="reply.id" class="reply-card">
            <p>“{{ reply.content }}”</p>
          </div>
        </section>

        <p class="tail">方案已经存进「我的方案」，随时可以回来改。</p>
      </div>

      <!-- ══ 底部操作条 ══ -->
      <div class="actionbar anim-in d-5">
        <span class="actionbar__fade" aria-hidden="true" />
        <span class="actionbar__glass" aria-hidden="true" />
        <div class="actionbar__inner">
          <GButton variant="outline" size="lg" @click="restartOpen = true">重新策划</GButton>
          <GButton class="grow" variant="primary" size="lg" @click="goShare">
            做成给 TA 的页面
            <GIcon name="arrowRight" :size="17" />
          </GButton>
        </div>
      </div>
    </div>

    <!-- ══ 兜底空态 ══ -->
    <div v-else-if="!restarting" class="page__body">
      <GEmpty emoji="🌾" title="没有找到这份方案" desc="它可能已经被删掉了，或者还没有生成过。">
        <GButton variant="primary" size="md" @click="router.replace('/')">回首页看看</GButton>
      </GEmpty>
    </div>

    <!-- ══ 分享 / 更多 ══ -->
    <GSheet v-model="moreOpen" title="分享与更多">
      <ul class="acts">
        <li>
          <button class="act tap" type="button" @click="goShare">
            <span class="act__icon"><GIcon name="mail" :size="18" /></span>
            <span class="act__text">
              <span class="act__title">做成给 TA 的页面</span>
              <span class="act__desc">生成一个专属链接，TA 打开就能看到全部</span>
            </span>
            <GIcon name="chevron" :size="16" />
          </button>
        </li>
        <li>
          <button class="act tap" type="button" @click="onCopyPlan">
            <span class="act__icon"><GIcon name="copy" :size="18" /></span>
            <span class="act__text">
              <span class="act__title">复制整份方案</span>
              <span class="act__desc">纯文字版，随手粘到备忘录或聊天框</span>
            </span>
            <GIcon name="chevron" :size="16" />
          </button>
        </li>
        <li>
          <button class="act tap" type="button" @click="goHistory">
            <span class="act__icon"><GIcon name="bookmark" :size="18" /></span>
            <span class="act__text">
              <span class="act__title">我的方案</span>
              <span class="act__desc">看看之前策划过的那些</span>
            </span>
            <GIcon name="chevron" :size="16" />
          </button>
        </li>
      </ul>
    </GSheet>

    <!-- ══ 重新策划确认 ══ -->
    <GSheet v-model="restartOpen" title="重新策划一份？">
      <p class="confirm">
        这会清掉刚才的所有回答，从第一个问题重新聊起。<br />
        当前这份方案已经存在「我的方案」里，不会丢。
      </p>
      <template #footer>
        <div class="confirm__acts">
          <GButton variant="ghost" size="lg" @click="restartOpen = false">再看看</GButton>
          <GButton class="grow" variant="primary" size="lg" @click="confirmRestart">
            重新开始
          </GButton>
        </div>
      </template>
    </GSheet>

    <GSheet v-model="replaceOpen" title="为什么想换掉它？">
      <div class="replace-reasons">
        <button
          v-for="reason in REPLACE_REASONS"
          :key="reason.code"
          type="button"
          class="reason tap"
          :class="{ 'is-on': replaceReason === reason.code }"
          @click="replaceReason = reason.code"
        >
          {{ reason.label }}
        </button>
      </div>
      <textarea
        v-model="replaceNote"
        class="edit-note"
        rows="3"
        maxlength="160"
        placeholder="可选：再补充一句，你真正想要什么"
      />
      <template #footer>
        <GButton variant="primary" size="lg" block @click="confirmReplace">让 AI 换一件</GButton>
      </template>
    </GSheet>

    <GSheet v-model="ritualOpen" title="怎么调整送出的方式？">
      <textarea
        v-model="ritualInstruction"
        class="edit-note"
        rows="4"
        maxlength="240"
        placeholder="例如：流程再简单一点；改成周末在家完成；不要制造公开惊喜……"
      />
      <template #footer>
        <GButton variant="primary" size="lg" block @click="onRewriteRitual">重新整理仪式</GButton>
      </template>
    </GSheet>
  </div>
</template>

<style scoped>
/* 顶部一块渐变，其余是奶油白；透明顶栏正好落在渐变上 */
.plan {
  background-color: var(--c-paper);
  background-image: var(--g-dusk);
  background-repeat: no-repeat;
  background-position: top center;
  background-size: 100% 420px;
}
.plan__body {
  background: transparent;
}

.navact {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-ink-2);
}

/* ══ 封面 ══════════════════════════════════ */
.cover {
  position: relative;
  padding: var(--s-6) var(--page-x) var(--s-8);
  overflow: hidden;
}
.cover__eyebrow {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-rose);
}
.cover__title {
  margin-top: var(--s-3);
  font-family: var(--f-serif);
  font-size: 32px;
  font-weight: 500;
  line-height: 1.32;
  letter-spacing: -0.01em;
  color: var(--c-ink);
  word-break: break-word;
}
.cover__sub {
  margin-top: var(--s-3);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

.metas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-5);
}
.meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  background: var(--c-surface-alt);
  box-shadow: var(--sh-1);
}
.meta__k {
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
  flex-shrink: 0;
}
.meta__v {
  min-width: 0;
  font-size: var(--fs-caption);
  color: var(--c-ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ══ 内容纸面 ══════════════════════════════ */
.sheet {
  position: relative;
  background: var(--c-paper);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: var(--s-7) var(--page-x) var(--s-6);
}

.sec {
  margin-bottom: var(--s-9);
}
.sec:last-of-type {
  margin-bottom: var(--s-7);
}

.sec__head {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.sec__head .section-label {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.linkbtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  padding-left: var(--s-3);
  flex-shrink: 0;
  color: var(--c-rose-deep);
  font-size: var(--fs-caption);
  white-space: nowrap;
}
.linkbtn:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.gifts {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  transition: opacity var(--t-base) var(--e-out);
}
.gifts.is-busy {
  opacity: 0.5;
  pointer-events: none;
}

.tail {
  padding-top: var(--s-4);
  text-align: center;
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
}

/* ══ 底部操作条 ════════════════════════════ */
.actionbar {
  position: sticky;
  bottom: 0;
  z-index: var(--z-bar);
}
.actionbar__fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 40px;
  background: var(--g-mask-bottom);
  pointer-events: none;
}
.actionbar__glass {
  position: absolute;
  inset: 0;
  background: var(--c-surface);
  opacity: 0.82;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--c-line);
  pointer-events: none;
}
.actionbar__inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--page-x);
  padding-bottom: calc(var(--s-3) + var(--safe-bottom));
}
/* 375 宽下两颗按钮要能并排放下，收一点左右内边距 */
.actionbar__inner :deep(.g-btn--lg) {
  padding: 0 var(--s-4);
}

/* ══ 弹层 ══════════════════════════════════ */
.acts {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.act {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-ink-4);
  box-shadow: inset 0 0 0 1px var(--c-line);
  text-align: left;
}
.act__icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-rose-tint);
  color: var(--c-rose-deep);
}
.act__text {
  flex: 1;
  min-width: 0;
}
.act__title {
  display: block;
  font-size: var(--fs-body);
  font-weight: 500;
  color: var(--c-ink);
}
.act__desc {
  display: block;
  margin-top: 2px;
  font-size: var(--fs-caption);
  line-height: var(--lh-snug);
  color: var(--c-ink-3);
}

.confirm {
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
  padding-bottom: var(--s-2);
}
.confirm__acts {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.source-note {
  display: inline-flex;
  margin-top: var(--s-3);
  padding: 4px 10px;
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--c-surface) 72%, transparent);
  color: var(--c-ink-3);
  font-size: var(--fs-micro);
}
.replace-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.reason {
  padding: 9px 13px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  color: var(--c-ink-2);
  box-shadow: inset 0 0 0 1px var(--c-line-strong);
  font-size: var(--fs-sm);
}
.reason.is-on {
  background: var(--c-rose-tint);
  color: var(--c-rose-deep);
  box-shadow: inset 0 0 0 1px var(--c-rose-soft);
}
.edit-note {
  width: 100%;
  margin-top: var(--s-4);
  padding: var(--s-4);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-ink);
  line-height: var(--lh-normal);
  resize: vertical;
}
.reply-card {
  margin-top: var(--s-3);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-sage-tint, var(--c-paper-2));
  color: var(--c-ink-2);
  line-height: var(--lh-normal);
}
</style>
