<script setup>
/**
 * HeroScene —— 首屏装饰层
 * 暖色光晕 + 纸纹 + 几个缓慢浮动的抽象轮廓（丝带 / 礼盒 / 圆环）
 * 纯 CSS + inline SVG，无任何图片资源；pointer-events: none，不拦截交互。
 */
</script>

<template>
  <div class="scene grain" aria-hidden="true">
    <div class="scene__wash" />

    <!-- 暖色光晕 -->
    <span class="glow scene__glow scene__glow--rose" />
    <span class="glow scene__glow scene__glow--sand" />
    <span class="glow scene__glow scene__glow--sage" />

    <!-- 大圆环：右上，实线 + 虚线双环，极慢自转 -->
    <div class="shape shape--ring">
      <svg viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="98" stroke="currentColor" stroke-width="1" />
        <circle
          cx="100"
          cy="100"
          r="70"
          stroke="currentColor"
          stroke-width="1"
          stroke-dasharray="2 9"
        />
      </svg>
    </div>

    <!-- 礼盒轮廓 -->
    <div class="shape shape--gift">
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="7" y="21" width="50" height="11" rx="3" />
        <path d="M12 32v21a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V32" />
        <path d="M32 21v36" />
        <path d="M32 21s-4-13-11-13a6.5 6.5 0 0 0 0 13" />
        <path d="M32 21s4-13 11-13a6.5 6.5 0 0 1 0 13" />
      </svg>
    </div>

    <!-- 丝带 / 蝴蝶结轮廓 -->
    <div class="shape shape--ribbon">
      <svg
        viewBox="0 0 120 96"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M60 40C48 19 25 15 20 30c-4 12 15 20 40 10" />
        <path d="M60 40c12-21 35-25 40-10 4 12-15 20-40 10" />
        <path d="M60 40c-3 15-11 27-22 37" />
        <path d="M60 40c4 15 12 26 25 33" />
      </svg>
    </div>

    <!-- 小圆环 -->
    <div class="shape shape--dot">
      <svg viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1" />
      </svg>
    </div>

    <!-- 底部渐隐，与页面底色接上 -->
    <div class="scene__fade" />
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.scene__wash {
  position: absolute;
  inset: 0;
  background: var(--g-dawn);
}

.scene__fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 140px;
  background: var(--g-mask-bottom);
}

/* ── 光晕 ─────────────────────────────────── */
.scene__glow {
  filter: blur(56px);
  animation: breathe 11s var(--e-in-out) infinite;
}
.scene__glow--rose {
  width: 260px;
  height: 260px;
  top: -70px;
  left: -80px;
  background: var(--c-rose-soft);
}
.scene__glow--sand {
  width: 300px;
  height: 300px;
  top: 130px;
  right: -120px;
  background: var(--c-sand-soft);
  animation-duration: 14s;
  animation-delay: -4s;
}
.scene__glow--sage {
  width: 220px;
  height: 220px;
  bottom: -30px;
  left: 40px;
  background: var(--c-sage-soft);
  animation-duration: 13s;
  animation-delay: -7s;
}

/* ── 抽象轮廓 ─────────────────────────────── */
.shape {
  position: absolute;
  animation: floaty 12s var(--e-in-out) infinite;
}
.shape svg {
  width: 100%;
  height: auto;
}

.shape--ring {
  width: 240px;
  top: -74px;
  right: -86px;
  color: var(--c-sand);
  opacity: 0.42;
  animation-duration: 17s;
  animation-delay: -2s;
}
.shape--ring svg {
  animation: turn 96s linear infinite;
}

.shape--gift {
  width: 56px;
  top: 138px;
  right: 24px;
  color: var(--c-rose);
  opacity: 0.34;
  animation-duration: 9s;
  animation-delay: -5s;
}

.shape--ribbon {
  width: 112px;
  bottom: 76px;
  left: -38px;
  color: var(--c-lilac);
  opacity: 0.34;
  animation-duration: 14s;
  animation-delay: -1s;
}

.shape--dot {
  width: 38px;
  bottom: 226px;
  right: 46px;
  color: var(--c-sage);
  opacity: 0.44;
  animation-duration: 10s;
  animation-delay: -8s;
}

@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene__glow,
  .shape,
  .shape svg {
    animation: none;
  }
}
</style>
