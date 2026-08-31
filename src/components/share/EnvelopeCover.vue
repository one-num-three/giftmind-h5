<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  EnvelopeCover —— 3D 虚拟拆礼盒 / 微信心意盲盒第一幕
 *
 *  玩法：
 *    1. 屏幕中央悬浮立体礼盒，带有发光丝带与蝴蝶结；
 *    2. 手指滑动丝带或轻触礼盒，触发「解开丝带」手势；
 *    3. 丝带飘散 + 盒盖 3D 旋转掀开 + 全屏五彩礼花爆炸 + Web Audio 晶莹八音盒音效；
 *    4. 信纸与心意礼物缓缓升起，丝滑转场进入第二幕！
 * ══════════════════════════════════════════════════════════════
 */
import { computed, ref, onMounted } from 'vue'

const props = defineProps({
  theme: { type: String, default: 'dawn' }, // dawn | dusk | sage
  recipient: { type: String, default: '' },
  greeting: { type: String, default: '' },
  emoji: { type: String, default: '🎁' },
  opening: { type: Boolean, default: false },
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
  () => String(props.greeting || '').trim() || '生活需要一点未知的小确幸，拆开看看吧。',
)
const boxEmoji = computed(() => String(props.emoji || '').trim() || '🎁')

const touchStartX = ref(0)
const touchStartY = ref(0)
const ribbonUntied = ref(false)
const confettiParticles = ref([])

function playUnboxSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51] // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + idx * 0.07)
      gain.gain.setValueAtTime(0.18, now + idx * 0.07)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.7)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.07)
      osc.stop(now + idx * 0.07 + 0.75)
    })
  } catch (e) {
    // ignore audio block
  }
}

function spawnConfetti() {
  const colors = ['#f43f5e', '#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#ffffff']
  const count = 36
  const list = []
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
    const distance = 80 + Math.random() * 160
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance - 40
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = 6 + Math.random() * 8
    const rot = Math.random() * 360
    list.push({ id: i, x, y, color, size, rot })
  }
  confettiParticles.value = list
}

function triggerOpen() {
  if (!props.interactive || props.opening || ribbonUntied.value) return
  ribbonUntied.value = true
  playUnboxSound()
  spawnConfetti()
  setTimeout(() => {
    emit('open')
  }, 280)
}

function onTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX.value
  const dy = e.changedTouches[0].clientY - touchStartY.value
  if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
    triggerOpen()
  }
}
</script>

<template>
  <div
    class="cover"
    :class="[`t-${theme}`, { 'is-opening': opening, 'is-static': !interactive, 'is-untied': ribbonUntied }]"
    @click="triggerOpen"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <span class="cover__glow cover__glow--a" />
    <span class="cover__glow cover__glow--b" />

    <!-- 爆炸礼花粒子 -->
    <div v-if="confettiParticles.length" class="confetti-container">
      <span
        v-for="p in confettiParticles"
        :key="p.id"
        class="confetti"
        :style="{
          '--cx': `${p.x}px`,
          '--cy': `${p.y}px`,
          '--crot': `${p.rot}deg`,
          '--cbg': p.color,
          '--csize': `${p.size}px`,
        }"
      />
    </div>

    <div class="cover__inner">
      <div class="cover__top-badge">
        <span class="pulse-sparkle">✨</span>
        <span>专属心意盲盒已送达</span>
      </div>

      <div class="cover__words">
        <p class="cover__to">{{ toText }}</p>
        <p class="cover__greet">{{ greetText }}</p>
      </div>

      <!-- 3D 悬浮礼盒与解绑丝带 -->
      <div class="giftbox-stage">
        <div class="giftbox-float">
          <div class="giftbox" :class="{ 'is-open': ribbonUntied || opening }">
            <!-- 盒盖 -->
            <div class="giftbox__lid">
              <div class="lid__ribbon-h"></div>
              <div class="lid__ribbon-v"></div>
              <div class="lid__bow">
                <span class="bow-knot">{{ boxEmoji }}</span>
                <span class="bow-loop bow-loop--left"></span>
                <span class="bow-loop bow-loop--right"></span>
              </div>
            </div>

            <!-- 盒身 -->
            <div class="giftbox__body">
              <div class="body__ribbon-h"></div>
              <div class="body__ribbon-v"></div>
              <!-- 盒内升起的信与心意卡 -->
              <div class="giftbox__content">
                <span class="letter-mini">💌 为你定制的心意</span>
              </div>
            </div>

            <div class="giftbox__shadow"></div>
          </div>
        </div>
      </div>

      <!-- 解绑提示 -->
      <div v-if="interactive" class="cover__hint">
        <span class="hint-hand">👆</span>
        <span>滑动丝带 或 点击拆开礼盒</span>
      </div>
      <p v-else class="cover__hint cover__hint--flat">
        <span>点击拆开礼盒</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.t-dawn {
  --sh-bg: linear-gradient(160deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%);
  --sh-box-base: #f43f5e;
  --sh-box-deep: #e11d48;
  --sh-ribbon: #fbbf24;
  --sh-ribbon-glow: rgba(251, 191, 36, 0.6);
  --sh-key: #f43f5e;
}
.t-dusk {
  --sh-bg: linear-gradient(160deg, #2e1065 0%, #1e1b4b 50%, #0f172a 100%);
  --sh-box-base: #7c3aed;
  --sh-box-deep: #6d28d9;
  --sh-ribbon: #f472b6;
  --sh-ribbon-glow: rgba(244, 114, 182, 0.6);
  --sh-key: #c084fc;
}
.t-sage {
  --sh-bg: linear-gradient(160deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%);
  --sh-box-base: #059669;
  --sh-box-deep: #047857;
  --sh-ribbon: #fbbf24;
  --sh-ribbon-glow: rgba(251, 191, 36, 0.6);
  --sh-key: #059669;
}

.cover {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  background: var(--sh-bg);
  transition: opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
.cover.is-static {
  pointer-events: none;
}
.cover.is-opening {
  opacity: 0;
  transform: translateY(-40px) scale(0.96);
  transition-delay: 500ms;
}

.cover__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(50px);
  pointer-events: none;
}
.cover__glow--a {
  width: 240px;
  height: 240px;
  top: -60px;
  right: -60px;
  background: rgba(244, 63, 94, 0.25);
}
.cover__glow--b {
  width: 280px;
  height: 280px;
  bottom: -80px;
  left: -80px;
  background: rgba(251, 191, 36, 0.25);
}

.cover__inner {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 50px 24px 40px;
  text-align: center;
  box-sizing: border-box;
}

.cover__top-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  font-size: 13px;
  font-weight: 600;
  color: var(--sh-key);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.cover__words {
  margin-top: 10px;
  max-width: 300px;
}
.cover__to {
  font-family: var(--f-serif);
  font-size: 24px;
  font-weight: 700;
  color: #18181b;
}
.cover__greet {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #52525b;
}

/* ══ 3D 礼盒舞台 ════════════════════════════ */
.giftbox-stage {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 800px;
}
.giftbox-float {
  animation: float-box 3.6s ease-in-out infinite;
}
@keyframes float-box {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(-12px) rotate(1.5deg); }
}

.giftbox {
  position: relative;
  width: 140px;
  height: 140px;
  transform-style: preserve-3d;
  cursor: pointer;
}

/* 盒身 */
.giftbox__body {
  position: absolute;
  inset: 20px 0 0 0;
  background: linear-gradient(135deg, var(--sh-box-base) 0%, var(--sh-box-deep) 100%);
  border-radius: 12px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.18), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  overflow: hidden;
}
.body__ribbon-v {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 24px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%);
  box-shadow: 0 0 10px var(--sh-ribbon-glow);
}
.body__ribbon-h {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 24px;
  transform: translateY(-50%);
  background: linear-gradient(180deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%);
  box-shadow: 0 0 10px var(--sh-ribbon-glow);
}

/* 盒盖 */
.giftbox__lid {
  position: absolute;
  top: 8px;
  left: -8px;
  right: -8px;
  height: 36px;
  background: linear-gradient(135deg, #fb7185 0%, var(--sh-box-base) 100%);
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.4);
  z-index: 10;
  transform-origin: 50% 0%;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
}
.lid__ribbon-v {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 24px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%);
}
.lid__bow {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12;
}
.bow-knot {
  font-size: 24px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

/* 拆盒状态 */
.giftbox.is-open .giftbox__lid {
  transform: translateY(-60px) rotateX(-120deg) scale(1.1);
  opacity: 0;
}
.giftbox__content {
  position: absolute;
  inset: 10px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(100%);
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.letter-mini {
  font-size: 11px;
  font-weight: 700;
  color: #f43f5e;
}
.giftbox.is-open .giftbox__content {
  transform: translateY(-20px) scale(1.05);
}

.giftbox__shadow {
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 16px;
  background: radial-gradient(ellipse, rgba(0, 0, 0, 0.2) 0%, transparent 70%);
  border-radius: 50%;
}

/* 提示按钮 */
.cover__hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 999px;
  background: #18181b;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  animation: pulse-hint 2s infinite ease-in-out;
}
.hint-hand {
  font-size: 16px;
  animation: bounce-hand 1.2s infinite alternate ease-in-out;
}
@keyframes bounce-hand {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}
@keyframes pulse-hint {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

/* ══ 五彩礼花粒子 ═══════════════════════════ */
.confetti-container {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
  z-index: 100;
}
.confetti {
  position: absolute;
  width: var(--csize);
  height: var(--csize);
  background: var(--cbg);
  border-radius: 2px;
  animation: explode-confetti 0.8s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
}
@keyframes explode-confetti {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(0.4);
    opacity: 1;
  }
  100% {
    transform: translate(var(--cx), var(--cy)) rotate(var(--crot)) scale(1.2);
    opacity: 0;
  }
}
</style>
