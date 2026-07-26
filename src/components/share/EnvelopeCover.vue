<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  EnvelopeCover —— 收礼人看到的第一幕
 *
 *  一整屏的信封。三套色调（暖晨 / 暮色 / 草木）由 .t-* 里的一组
 *  --sh-* 变量组合出来，组件内部只用变量，不认具体颜色。
 *
 *  开信动画（总长 900ms，纯 CSS transition，父组件给 opening）：
 *      0ms   火漆印裂开、缩小淡出
 *      0ms   封口绕上边缘 rotateX 翻起
 *    300ms   封口淡出（避免翻上去之后挡住信纸）
 *    240ms   信纸从封口里抽出上移
 *    560ms   整幕上移淡出
 *
 *  interactive=false 时用于编辑页的等比缩小预览：不可点、不发事件。
 * ══════════════════════════════════════════════════════════════
 */
import { computed } from 'vue'

const props = defineProps({
  theme: { type: String, default: 'dawn' }, // dawn | dusk | sage
  recipient: { type: String, default: '' },
  greeting: { type: String, default: '' },
  emoji: { type: String, default: '🎁' },
  /** 由父组件驱动的开启态 */
  opening: { type: Boolean, default: false },
  /** 预览态传 false */
  interactive: { type: Boolean, default: true },
})

const emit = defineEmits(['open'])

const THEMES = ['dawn', 'dusk', 'sage']

const theme = computed(() => (THEMES.includes(props.theme) ? props.theme : 'dawn'))
const toText = computed(() => {
  const t = String(props.recipient || '').trim()
  return t ? `${t}，` : '喂，'
})
const greetText = computed(
  () => String(props.greeting || '').trim() || '有些话当面说不出口，就写在这里了。',
)
const sealEmoji = computed(() => String(props.emoji || '').trim() || '🎁')

function onTap() {
  if (!props.interactive || props.opening) return
  emit('open')
}
</script>

<template>
  <div
    class="cover"
    :class="[`t-${theme}`, { 'is-opening': opening, 'is-static': !interactive }]"
    @click="onTap"
  >
    <span class="cover__glow cover__glow--a" />
    <span class="cover__glow cover__glow--b" />

    <div class="cover__inner">
      <p class="cover__eyebrow">有人给你准备了一份礼物</p>

      <div class="cover__stage">
        <span class="env__shadow" />
        <div class="env-float">
          <div class="env">
            <div class="env__letter">
              <span class="env__line" />
              <span class="env__line env__line--2" />
              <span class="env__line env__line--3" />
            </div>
            <div class="env__front" />
            <div class="env__flap" />
            <div class="env__seal">
              <span class="env__seal-emoji">{{ sealEmoji }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="cover__words">
        <p class="cover__to">{{ toText }}</p>
        <p class="cover__greet">{{ greetText }}</p>
      </div>

      <button v-if="interactive" type="button" class="cover__hint">
        <span class="cover__ring" />
        轻触打开
      </button>
      <p v-else class="cover__hint cover__hint--flat">
        <span class="cover__ring" />
        轻触打开
      </p>
    </div>
  </div>
</template>

<style scoped>
/* ══ 三套色调 ══════════════════════════════════
   env-a/b/c 是信封纸的三层色，key 是火漆与强调色，
   paper 是信纸，全部由 tokens 组合，不出现具体颜色。 */
.t-dawn {
  --sh-bg: var(--g-dawn);
  --sh-key: var(--c-rose);
  --sh-key-deep: var(--c-rose-deep);
  --sh-key-soft: var(--c-rose-soft);
  --sh-env-a: var(--c-rose-tint);
  --sh-env-b: var(--c-sand-soft);
  --sh-env-c: var(--c-rose-soft);
  --sh-paper: var(--c-surface-alt);
  --sh-glow-a: var(--c-rose-soft);
  --sh-glow-b: var(--c-sand-soft);
}
.t-dusk {
  --sh-bg: var(--g-dusk);
  --sh-key: var(--c-lilac-deep);
  --sh-key-deep: var(--c-lilac-deep);
  --sh-key-soft: var(--c-lilac-soft);
  --sh-env-a: var(--c-lilac-soft);
  --sh-env-b: var(--c-rose-tint);
  --sh-env-c: var(--c-lilac-soft);
  --sh-paper: var(--c-surface);
  --sh-glow-a: var(--c-lilac-soft);
  --sh-glow-b: var(--c-rose-soft);
}
.t-sage {
  --sh-bg: linear-gradient(162deg, var(--c-sage-soft) 0%, var(--c-paper) 46%, var(--c-sand-soft) 100%);
  --sh-key: var(--c-sage-deep);
  --sh-key-deep: var(--c-sage-deep);
  --sh-key-soft: var(--c-sage-soft);
  --sh-env-a: var(--c-sage-soft);
  --sh-env-b: var(--c-paper-2);
  --sh-env-c: var(--c-sage-soft);
  --sh-paper: var(--c-surface-alt);
  --sh-glow-a: var(--c-sage-soft);
  --sh-glow-b: var(--c-sand-soft);
}

/* ══ 幕 ════════════════════════════════════════ */
.cover {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: hidden;
  background: var(--sh-bg);
  background-size: 100% 130%;
  transition: opacity 340ms var(--e-out), transform 340ms var(--e-out);
}
.cover.is-static {
  pointer-events: none;
}
.cover.is-opening {
  opacity: 0;
  transform: translateY(-30px);
  transition-delay: 560ms;
}

.cover__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(46px);
  pointer-events: none;
}
.cover__glow--a {
  width: 220px;
  height: 220px;
  top: -60px;
  right: -70px;
  background: var(--sh-glow-a);
  opacity: 0.75;
}
.cover__glow--b {
  width: 260px;
  height: 260px;
  bottom: -90px;
  left: -90px;
  background: var(--sh-glow-b);
  opacity: 0.6;
}

.cover__inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px var(--page-x) 96px;
  text-align: center;
}

.cover__eyebrow {
  font-size: var(--fs-caption);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-3);
  transition: opacity 240ms var(--e-out);
}
.cover.is-opening .cover__eyebrow {
  opacity: 0;
}

/* ══ 信封 ══════════════════════════════════════ */
.cover__stage {
  position: relative;
  margin: 34px 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.env__shadow {
  position: absolute;
  left: 50%;
  bottom: -16px;
  width: 148px;
  height: 18px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: var(--c-ink);
  opacity: 0.08;
  filter: blur(7px);
  transition: opacity 300ms var(--e-out);
}
.cover.is-opening .env__shadow {
  opacity: 0;
}

.env-float {
  animation: floaty 5.6s var(--e-in-out) infinite;
}
.cover.is-opening .env-float {
  animation: none;
}

.env {
  position: relative;
  width: 208px;
  height: 138px;
  border-radius: var(--r-sm);
  background: linear-gradient(158deg, var(--sh-env-a) 0%, var(--sh-env-b) 100%);
  box-shadow: var(--sh-2);
  perspective: 620px;
}

/* 信纸：静止时完全被 front + flap 盖住 */
.env__letter {
  position: absolute;
  left: 15px;
  right: 15px;
  top: 13px;
  bottom: 13px;
  z-index: 1;
  padding: 15px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  border-radius: var(--r-xs);
  background: var(--sh-paper);
  box-shadow: var(--sh-1);
  transition: transform 460ms var(--e-out) 240ms;
}
.cover.is-opening .env__letter {
  transform: translateY(-66px) scale(1.03);
}
.env__line {
  height: 4px;
  width: 84%;
  border-radius: var(--r-pill);
  background: var(--c-ink-4);
  opacity: 0.42;
}
.env__line--2 {
  width: 96%;
}
.env__line--3 {
  width: 56%;
}

/* 信封正面：中间挖一个 V 口 */
.env__front {
  position: absolute;
  inset: 0;
  z-index: 2;
  clip-path: polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%);
  background: linear-gradient(178deg, var(--sh-env-b) 0%, var(--sh-env-a) 100%);
  border-radius: var(--r-sm);
}
.env__front::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--c-ink);
  opacity: 0.035;
}

/* 封口：绕上边缘翻起 */
.env__flap {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 56%;
  z-index: 3;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  background: linear-gradient(180deg, var(--sh-env-c) 0%, var(--sh-env-a) 100%);
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  transform-origin: 50% 0%;
  transform: rotateX(0deg);
  transition: transform 440ms var(--e-in-out), opacity 260ms linear 300ms;
}
.env__flap::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--c-ink);
  opacity: 0.075;
}
.cover.is-opening .env__flap {
  transform: rotateX(-172deg);
  opacity: 0;
}

/* 火漆印 */
.env__seal {
  position: absolute;
  left: 50%;
  top: 56%;
  z-index: 4;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at 34% 28%, var(--sh-key) 0%, var(--sh-key-deep) 100%);
  box-shadow: var(--sh-1);
  transition: transform 280ms var(--e-in-out), opacity 240ms linear;
}
.env__seal::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  border: 1px solid var(--c-ink-inverse);
  opacity: 0.36;
}
.env__seal-emoji {
  font-size: 17px;
  line-height: 1;
}
.cover.is-opening .env__seal {
  transform: translate(-50%, -50%) scale(0.5) rotate(-16deg);
  opacity: 0;
}

/* ══ 文字 ══════════════════════════════════════ */
.cover__words {
  max-width: 280px;
  transition: opacity 300ms var(--e-out), transform 300ms var(--e-out);
}
.cover.is-opening .cover__words {
  opacity: 0;
  transform: translateY(-10px);
}
.cover__to {
  font-family: var(--f-serif);
  font-size: var(--fs-h1);
  font-weight: 500;
  line-height: 1.3;
  color: var(--c-ink);
}
.cover__greet {
  margin-top: var(--s-3);
  font-family: var(--f-serif);
  font-size: var(--fs-body);
  line-height: var(--lh-loose);
  color: var(--c-ink-2);
}

.cover__hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(38px + var(--safe-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  min-height: 44px;
  font-family: var(--f-sans);
  font-size: var(--fs-caption);
  letter-spacing: var(--ls-wide);
  color: var(--c-ink-3);
  transition: opacity 240ms var(--e-out);
}
.cover__hint--flat {
  pointer-events: none;
}
.cover__ring {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--sh-key);
  animation: breathe 2.6s var(--e-in-out) infinite;
}
.cover.is-opening .cover__hint {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .env-float,
  .cover__ring {
    animation: none;
  }
  .env__flap,
  .env__letter,
  .env__seal {
    transition-duration: 200ms;
  }
}
</style>
