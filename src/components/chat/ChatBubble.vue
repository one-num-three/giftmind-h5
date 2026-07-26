<script setup>
/**
 * 一条对话气泡
 * AI 左（白底细描边 · 左下角收口 · 中文情绪用衬线）
 * 用户右（墨色底 · 右下角收口）
 * 连续多条 AI 消息只有第一条带头像，后面用等宽占位保持对齐。
 * 默认插槽可以塞任意内容（打字指示器就是这么复用气泡外壳的）。
 */
defineProps({
  role: { type: String, default: 'ai' }, // ai | user
  text: { type: String, default: '' },
  avatar: Boolean, // 是否显示头像（仅 AI）
  spaced: Boolean, // 与上一条换了说话人，多留一点气口
  muted: Boolean, // 「跳过」这类弱化气泡
  tight: Boolean, // 紧凑内边距
})
</script>

<template>
  <div class="bubble-row" :class="[`is-${role}`, { spaced }]">
    <div v-if="role === 'ai'" class="bubble-row__avatar" :class="{ ghost: !avatar }" aria-hidden="true">
      <GIcon name="sparkle" :size="13" :stroke="1.8" />
    </div>

    <div class="bubble" :class="{ muted, tight }">
      <slot>{{ text }}</slot>
    </div>
  </div>
</template>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: fadeUp var(--t-slow) var(--e-out) both;
}
.bubble-row.spaced {
  margin-top: 8px;
}
.bubble-row.is-user {
  justify-content: flex-end;
}

/* ── 头像 ─────────────────────────────────── */
.bubble-row__avatar {
  width: 24px;
  height: 24px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--g-primary);
  color: var(--c-ink-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--sh-1);
}
.bubble-row__avatar.ghost {
  visibility: hidden;
}

/* ── 气泡本体 ─────────────────────────────── */
.bubble {
  max-width: 268px;
  padding: 11px 14px;
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--sh-1);
}
.bubble.tight {
  padding: 10px 14px;
}

.is-ai .bubble {
  background: var(--c-surface);
  color: var(--c-ink);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg) var(--r-lg) var(--r-lg) var(--r-xs);
  font-family: var(--f-serif);
  font-weight: 400;
}

.is-user .bubble {
  background: var(--c-ink);
  color: var(--c-ink-inverse);
  border: 1px solid transparent;
  border-radius: var(--r-lg) var(--r-lg) var(--r-xs) var(--r-lg);
  font-family: var(--f-sans);
  font-size: var(--fs-sm);
  line-height: var(--lh-snug);
  padding: 11px 15px;
}

/* 跳过 / 弱化 */
.is-user .bubble.muted {
  background: transparent;
  color: var(--c-ink-3);
  border: 1px dashed var(--c-line-strong);
  box-shadow: none;
  font-size: var(--fs-caption);
  padding: 8px 13px;
}
</style>
