<script setup>
/**
 * LandingView —— 品牌落地页 + 入口
 * 首屏 Hero（HeroScene 装饰）→ 痛点 → 流程 → 交付物 → 用户故事 → 底部常驻 CTA
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import HeroScene from '@/components/layout/HeroScene.vue'

const router = useRouter()
const session = useSessionStore()

const bodyRef = ref(null)
const heroRef = ref(null)
const hasDraft = ref(false)
const showBar = ref(false)

/* ── 内容数据 ─────────────────────────────── */
const pains = [
  {
    no: '01',
    title: '不知道送什么',
    desc: '购物 App 划了两个小时，收藏夹加了一堆，还是没有一样觉得对。',
  },
  {
    no: '02',
    title: '送了，但对方没什么感觉',
    desc: 'TA 说了声谢谢，然后礼物就一直放在那儿，没再被提起。',
  },
  {
    no: '03',
    title: '有心意，却说不出口',
    desc: '想说的话在心里排练过很多遍，递过去时只剩一句「生日快乐」。',
  },
]

const steps = [
  {
    no: 1,
    emoji: '💬',
    tone: 'sage',
    title: '聊十分钟',
    desc: '不是填表。AI 顺着你的回答往下问，问到只有你知道的那些细节。',
  },
  {
    no: 2,
    emoji: '🔍',
    tone: 'lilac',
    title: '读懂 TA',
    desc: '从你说过的话里，提炼 TA 的性格、在意的东西，和你们之间的分量。',
  },
  {
    no: 3,
    emoji: '🎁',
    tone: 'sand',
    title: '生成方案',
    desc: '四类推荐榜单各给三个方案，再附一封替你写的信和送出流程。',
  },
  {
    no: 4,
    emoji: '✉️',
    tone: 'rose',
    title: '做成给 TA 的页面',
    desc: '一键生成一个专属链接，TA 打开，就是你为 TA 准备的全部。',
  },
]

const deliverables = [
  {
    key: 'gift',
    icon: 'gift',
    title: '四类榜单，各选三个',
    desc: '各取最高分，再按综合推荐度排序；每一个都写清楚「为什么是它」。',
    meta: '含预算区间与备货提醒',
  },
  {
    key: 'letter',
    icon: 'mail',
    title: '一封替你写的信',
    desc: '用你提到过的细节写成，语气可以调，也可以改成你自己的说法。',
    meta: '可换语气 · 可重写',
  },
  {
    key: 'ritual',
    icon: 'clock',
    title: '送出那一刻的仪式',
    desc: '从提前几天埋下线索，到递出去时说什么，一步一步告诉你。',
    meta: '按时间排好的四步',
  },
]

/* ── 交互 ─────────────────────────────────── */
function startPlanning() {
  session.start(true)
  router.push('/chat')
}

function continueDraft() {
  session.restoreDraft()
  router.push('/chat')
}

function restartFresh() {
  session.reset()
  session.start(true)
  hasDraft.value = false
  router.push('/chat')
}

/* ── 滚动：底部常驻 CTA 显隐 ───────────────── */
// 组件卸载时模板 ref 会被置空，这里额外留一份原生引用，保证监听一定能摘掉
let scrollEl = null
let heroEl = null
let rafId = 0
let io = null

function update() {
  rafId = 0
  if (!scrollEl) return
  // 首屏基本滚过去之后再出现，避免和 Hero 里的主 CTA 同屏重复
  const gate = (heroEl?.offsetHeight || scrollEl.clientHeight) * 0.9
  showBar.value = scrollEl.scrollTop > gate
}

function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(update)
}

onMounted(() => {
  hasDraft.value = session.hasDraft()

  scrollEl = bodyRef.value
  heroEl = heroRef.value
  if (!scrollEl) return
  scrollEl.addEventListener('scroll', onScroll, { passive: true })

  // 滚动入场
  const targets = scrollEl.querySelectorAll('[data-reveal]')
  if (typeof IntersectionObserver === 'undefined') {
    targets.forEach((n) => n.classList.add('is-in'))
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io?.unobserve(e.target)
      })
    },
    { root: scrollEl, rootMargin: '0px 0px -10% 0px', threshold: 0.06 },
  )
  targets.forEach((n) => io.observe(n))
})

onUnmounted(() => {
  scrollEl?.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  io?.disconnect()
  io = null
  scrollEl = null
  heroEl = null
})
</script>

<template>
  <div class="page">
    <div ref="bodyRef" class="page__body landing">
      <!-- ══ 首屏 ══ -->
      <section ref="heroRef" class="hero">
        <HeroScene />

        <div class="hero__inner">
          <div class="hero__brand anim-up">
            <span class="hero__logo">GIFTMIND</span>
            <span class="hero__sep" />
            <span class="t-eyebrow">AI 送礼策划师</span>
          </div>

          <h1 class="hero__title anim-up d-1">
            让礼物<br />
            真正<em>抵达</em>一个人
          </h1>

          <p class="hero__sub anim-up d-2">
            和 AI 聊十分钟，换一份只为 TA 写的方案：<br />
            送什么、附上什么话、怎么送出去。
          </p>

          <GCard
            v-if="hasDraft"
            class="draft anim-up d-3"
            padding="md"
            radius="md"
            bordered
            :elevated="false"
          >
            <div class="draft__top">
              <span class="draft__emoji">💬</span>
              <div class="draft__text">
                <p class="draft__title">上次聊到一半，继续吗？</p>
                <p class="draft__desc">你的回答还留着，可以接着往下聊。</p>
              </div>
            </div>
            <div class="draft__acts">
              <GButton variant="soft" size="md" @click="continueDraft">继续</GButton>
              <GButton variant="ghost" size="md" @click="restartFresh">重新开始</GButton>
            </div>
          </GCard>

          <div class="hero__cta anim-up d-4">
            <GButton variant="primary" size="lg" @click="startPlanning">
              开始策划我的礼物
              <GIcon name="arrowRight" :size="18" />
            </GButton>
          </div>

          <p class="hero__proof anim-up d-5">
            <span class="hero__pulse" />
            每天都有人在这里想清楚了要送什么
          </p>
        </div>

        <div class="hero__scroll anim-up d-6">
          <span class="hero__scroll-text">向下看看它怎么工作</span>
          <span class="hero__arrow"><GIcon name="chevronDown" :size="16" :stroke="1.2" /></span>
        </div>
      </section>

      <!-- ══ 痛点 ══ -->
      <section class="sec">
        <div class="reveal" data-reveal>
          <p class="section-label">常见困境</p>
          <h2 class="sec__title">为什么礼物总是送不对</h2>
        </div>

        <ul class="pains">
          <li v-for="(p, i) in pains" :key="p.no" class="pain reveal" data-reveal>
            <span class="pain__no">{{ p.no }}</span>
            <div class="pain__body">
              <p class="pain__title">{{ p.title }}</p>
              <p class="pain__desc">{{ p.desc }}</p>
            </div>
            <span v-if="i < pains.length - 1" class="pain__rule" />
          </li>
        </ul>
      </section>

      <!-- ══ 流程 ══ -->
      <section class="sec">
        <div class="reveal" data-reveal>
          <p class="section-label">GiftMind 怎么做</p>
          <h2 class="sec__title">四步，把心意变成方案</h2>
        </div>

        <ol class="flow">
          <li v-for="s in steps" :key="s.no" class="step reveal" data-reveal>
            <div class="step__rail">
              <span class="step__node">{{ s.no }}</span>
              <span class="step__line" />
            </div>
            <div class="step__card" :class="`tone-${s.tone}`">
              <p class="step__head">
                <span class="step__emoji">{{ s.emoji }}</span>
                <span class="step__title">{{ s.title }}</span>
              </p>
              <p class="step__desc">{{ s.desc }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- ══ 交付物 ══ -->
      <section class="sec">
        <div class="reveal" data-reveal>
          <p class="section-label">你会拿到什么</p>
          <h2 class="sec__title">一份可以直接照着做的方案</h2>
        </div>

        <div class="goods">
          <GCard
            v-for="d in deliverables"
            :key="d.key"
            class="good reveal"
            data-reveal
            padding="md"
            radius="lg"
          >
            <!-- 样张：礼物 -->
            <div v-if="d.key === 'gift'" class="pv pv--gift">
              <span class="pv__tile pv__tile--a">🕯️</span>
              <span class="pv__tile pv__tile--b">📖</span>
              <span class="pv__tile pv__tile--c">🎧</span>
            </div>
            <!-- 样张：信 -->
            <div v-else-if="d.key === 'letter'" class="pv pv--letter">
              <div class="pv__paper">
                <p class="pv__v">见字如面</p>
                <p class="pv__v pv__v--2">有些话当面说不出口</p>
                <p class="pv__v pv__v--3">那就写在这里</p>
              </div>
            </div>
            <!-- 样张：仪式 -->
            <div v-else class="pv pv--ritual">
              <span class="pv__step"><i class="pv__dot" /><i class="pv__bar" /></span>
              <span class="pv__step"><i class="pv__dot" /><i class="pv__bar pv__bar--s" /></span>
              <span class="pv__step"><i class="pv__dot" /><i class="pv__bar pv__bar--m" /></span>
            </div>

            <div class="good__body">
              <p class="good__title">{{ d.title }}</p>
              <p class="good__desc">{{ d.desc }}</p>
              <p class="good__meta">
                <GIcon :name="d.icon" :size="13" />
                {{ d.meta }}
              </p>
            </div>
          </GCard>
        </div>
      </section>

      <!-- ══ 用户故事 ══ -->
      <section class="sec">
        <figure class="story reveal" data-reveal>
          <span class="story__mark">“</span>
          <blockquote class="story__text">
            他拆开的时候什么都没说，只是把那封信读了两遍。
          </blockquote>
          <figcaption class="story__by">—— 一位在这里策划了生日礼物的用户</figcaption>
        </figure>
      </section>

      <footer class="foot reveal" data-reveal>
        <p class="foot__logo">GIFTMIND</p>
        <p class="foot__line">想清楚再送出，礼物才会被记住。</p>
      </footer>
    </div>

    <!-- ══ 底部常驻 CTA ══ -->
    <Transition name="bar">
      <div v-if="showBar" class="ctabar">
        <div class="ctabar__inner">
          <div class="ctabar__text">
            <p class="ctabar__title">十分钟，一份专属方案</p>
            <p class="ctabar__sub">聊完就能拿到</p>
          </div>
          <GButton variant="primary" size="md" @click="startPlanning">开始策划</GButton>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.landing {
  padding-bottom: calc(var(--tabbar-h) + 80px);
}

/* ══ 首屏 ══════════════════════════════════ */
.hero {
  position: relative;
  min-height: 78vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 76px var(--page-x) 92px;
  overflow: hidden;
}

.hero__inner {
  position: relative;
  z-index: 1;
}

.hero__brand {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-6);
}
.hero__logo {
  font-family: var(--f-display);
  font-size: var(--fs-caption);
  letter-spacing: var(--ls-wider);
  color: var(--c-ink-2);
}
.hero__sep {
  width: 18px;
  height: 1px;
  background: var(--c-line-strong);
}

.hero__title {
  font-family: var(--f-serif);
  font-size: 37px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--c-ink);
}
.hero__title em {
  position: relative;
  font-style: normal;
  color: var(--c-rose);
}
.hero__title em::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  bottom: 4px;
  height: 9px;
  border-radius: var(--r-pill);
  background: var(--c-rose-soft);
  z-index: -1;
}

.hero__sub {
  margin-top: var(--s-5);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink-2);
}

.hero__cta {
  margin-top: var(--s-7);
}

.hero__proof {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-top: var(--s-5);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}
.hero__pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-sage);
  flex-shrink: 0;
  animation: breathe 2.8s var(--e-in-out) infinite;
}

.hero__scroll {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--s-7);
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-1);
}
.hero__scroll-text {
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-4);
}
.hero__arrow {
  color: var(--c-ink-4);
  animation: breathe 2.4s var(--e-in-out) infinite;
}

/* 草稿续接 */
.draft {
  margin-top: var(--s-6);
}
.draft__top {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
}
.draft__emoji {
  font-size: 18px;
  line-height: 1.4;
}
.draft__text {
  flex: 1;
  min-width: 0;
}
.draft__title {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
}
.draft__desc {
  margin-top: 2px;
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}
.draft__acts {
  display: flex;
  gap: var(--s-2);
  margin-top: var(--s-3);
}

/* ══ 通用区块 ══════════════════════════════ */
.sec {
  padding: 0 var(--page-x);
  margin-top: var(--s-10);
}
.sec__title {
  font-family: var(--f-serif);
  font-size: var(--fs-h1);
  font-weight: 500;
  line-height: 1.36;
  color: var(--c-ink);
}

.reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity var(--t-slow) var(--e-out), transform var(--t-slow) var(--e-out);
}
.reveal.is-in {
  opacity: 1;
  transform: none;
}

/* ══ 痛点 ══════════════════════════════════ */
.pains {
  margin-top: var(--s-6);
}
.pain {
  position: relative;
  display: flex;
  gap: var(--s-4);
  padding: var(--s-5) 0;
}
.pain__no {
  font-family: var(--f-display);
  font-size: var(--fs-h2);
  line-height: 1.2;
  color: var(--c-ink-4);
  flex-shrink: 0;
  width: 28px;
}
.pain__body {
  flex: 1;
  min-width: 0;
}
.pain__title {
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
}
.pain__desc {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
}
.pain__rule {
  position: absolute;
  left: 44px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--c-line);
}

/* ══ 流程 ══════════════════════════════════ */
.flow {
  margin-top: var(--s-6);
}
.step {
  display: flex;
  gap: var(--s-4);
}
.step__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 28px;
}
.step__node {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--sh-1), inset 0 0 0 1px var(--c-line);
  color: var(--c-rose-deep);
  font-size: var(--fs-caption);
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step__line {
  flex: 1;
  width: 1px;
  margin: var(--s-2) 0;
  background: var(--c-line-strong);
}
.step:last-child .step__line {
  display: none;
}
.step__card {
  flex: 1;
  min-width: 0;
  margin-bottom: var(--s-4);
  padding: var(--s-4);
  border-radius: var(--r-lg);
}
.step:last-child .step__card {
  margin-bottom: 0;
}
.step__card.tone-sage {
  background: var(--c-sage-soft);
}
.step__card.tone-lilac {
  background: var(--c-lilac-soft);
}
.step__card.tone-sand {
  background: var(--c-sand-soft);
}
.step__card.tone-rose {
  background: var(--c-rose-soft);
}
.step__head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.step__emoji {
  font-size: 16px;
}
.step__title {
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
}
.step__desc {
  margin-top: var(--s-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-2);
}

/* ══ 交付物 ════════════════════════════════ */
.goods {
  margin-top: var(--s-6);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.good {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}
.good__body {
  flex: 1;
  min-width: 0;
}
.good__title {
  font-size: var(--fs-h3);
  font-weight: 500;
  color: var(--c-ink);
}
.good__desc {
  margin-top: var(--s-1);
  font-size: var(--fs-sm);
  line-height: var(--lh-snug);
  color: var(--c-ink-3);
}
.good__meta {
  display: flex;
  align-items: center;
  gap: var(--s-1);
  margin-top: var(--s-3);
  font-size: var(--fs-micro);
  color: var(--c-rose);
}

/* 样张 */
.pv {
  position: relative;
  width: 78px;
  height: 78px;
  flex-shrink: 0;
  border-radius: var(--r-md);
  overflow: hidden;
}
.pv--gift {
  background: var(--c-sand-soft);
}
.pv--letter {
  background: var(--c-rose-soft);
}
.pv--ritual {
  background: var(--c-sage-soft);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--s-3);
  padding: 0 var(--s-3);
}

.pv__tile {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  box-shadow: var(--sh-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.pv__tile--a {
  left: 6px;
  top: 26px;
  transform: rotate(-9deg);
}
.pv__tile--b {
  left: 22px;
  top: 12px;
  transform: rotate(3deg);
  z-index: 2;
}
.pv__tile--c {
  left: 40px;
  top: 30px;
  transform: rotate(11deg);
}

.pv__paper {
  position: absolute;
  inset: 9px;
  display: flex;
  flex-direction: row-reverse;
  gap: 5px;
  padding: 8px 7px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  box-shadow: var(--sh-1);
  overflow: hidden;
}
.pv__v {
  writing-mode: vertical-rl;
  font-family: var(--f-serif);
  font-size: 9px;
  line-height: 1.3;
  letter-spacing: 0.1em;
  color: var(--c-ink-3);
}
.pv__v--2 {
  color: var(--c-ink-4);
}
.pv__v--3 {
  color: var(--c-ink-4);
  opacity: 0.55;
}

.pv__step {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.pv__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-sage-deep);
  flex-shrink: 0;
}
.pv__bar {
  height: 4px;
  width: 36px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
}
.pv__bar--s {
  width: 24px;
}
.pv__bar--m {
  width: 30px;
}

/* ══ 用户故事 ══════════════════════════════ */
.story {
  position: relative;
  padding: var(--s-7) var(--s-5) var(--s-6);
  border-radius: var(--r-xl);
  background: var(--g-warm);
  text-align: center;
  overflow: hidden;
}
.story__mark {
  display: block;
  font-family: var(--f-display);
  font-style: italic;
  font-size: 64px;
  line-height: 0.6;
  color: var(--c-rose);
  opacity: 0.42;
}
.story__text {
  margin-top: var(--s-4);
  font-family: var(--f-serif);
  font-size: var(--fs-h2);
  line-height: var(--lh-loose);
  color: var(--c-ink);
}
.story__by {
  margin-top: var(--s-4);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}

/* ══ 页脚 ══════════════════════════════════ */
.foot {
  margin-top: var(--s-10);
  padding: var(--s-7) var(--page-x) 0;
  text-align: center;
}
.foot__logo {
  font-family: var(--f-display);
  font-size: var(--fs-caption);
  letter-spacing: var(--ls-wider);
  color: var(--c-ink-4);
}
.foot__line {
  margin-top: var(--s-2);
  font-family: var(--f-serif);
  font-size: var(--fs-sm);
  color: var(--c-ink-3);
}

/* ══ 底部常驻 CTA ══════════════════════════ */
.ctabar {
  position: absolute;
  left: var(--page-x);
  right: var(--page-x);
  bottom: calc(var(--tabbar-h) + var(--safe-bottom));
  z-index: var(--z-bar);
  border-radius: var(--r-pill);
  box-shadow: var(--sh-2), inset 0 0 0 1px var(--c-line);
  overflow: hidden;
}
.ctabar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--c-surface);
  opacity: 0.95;
  backdrop-filter: blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
}
.ctabar__inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-2) var(--s-2) var(--s-2) var(--s-5);
}
.ctabar__text {
  flex: 1;
  min-width: 0;
}
.ctabar__title {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ctabar__sub {
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
}

.bar-enter-active,
.bar-leave-active {
  transition: opacity var(--t-base) var(--e-out), transform var(--t-base) var(--e-out);
}
.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
  }
  .hero__pulse,
  .hero__arrow {
    animation: none;
  }
}
</style>
