<script setup>
/**
 * 一条对话气泡
 * AI 左（白底细描边 · 左下角收口 · 中文情绪用衬线）
 * 用户右（墨色底 · 右下角收口）
 * 现已支持逐字流式打印（streaming）与闪烁光标
 */
defineProps({
  role: { type: String, default: 'ai' }, // ai | user
  text: { type: String, default: '' },
  avatar: Boolean, // 是否显示头像（仅 AI）
  spaced: Boolean, // 与上一条换了说话人，多留一点气口
  muted: Boolean, // 「跳过」这类弱化气泡
  tight: Boolean, // 紧凑内边距
  streaming: Boolean, // 是否正在逐字流式打字中
})
</script>

<template>
  <div class="bubble-row" :class="[`is-${role}`, { spaced }]">
    <div v-if="role === 'ai'" class="bubble-row__avatar" :class="{ ghost: !avatar }" aria-hidden="true">
      <GIcon name="sparkle" :size="13" :stroke="1.8" />
    </div>

    <div class="bubble" :class="{ muted, tight, 'is-streaming': streaming }">
      <slot>{{ text }}</slot>
      <span v-if="streaming" class="typing-cursor" aria-hidden="true"></span>
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
  max-width: var(--bubble-max);
  padding: 10px 14px;
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  word-break: break-word;
  white-space: pre-wrap;
  position: relative;
}

.bubble-row.is-ai .bubble {
  background: var(--c-paper);
  color: var(--c-ink);
  border: 1px solid var(--c-border);
  border-radius: 16px 16px 16px 4px;
  box-shadow: var(--sh-1);
}

.bubble-row.is-user .bubble {
  background: var(--c-ink);
  color: var(--c-paper);
  border-radius: 16px 16px 4px 16px;
  box-shadow: var(--sh-1);
}

.bubble.muted {
  opacity: 0.6;
  font-style: italic;
}
.bubble.tight {
  padding: 8px 12px;
}

/* ── 逐字流式打字机光标 ───────────────────── */
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 3px;
  background: #f43f5e;
  vertical-align: -2px;
  border-radius: 1px;
  animation: cursor-blink 0.7s infinite ease-in-out;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; transform: scaleY(1); }
  50% { opacity: 0; transform: scaleY(0.6); }
}
</style>
