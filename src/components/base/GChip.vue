<script setup>
defineProps({
  selected: Boolean,
  disabled: Boolean,
  emoji: String,
  hint: String,
  interactive: { type: Boolean, default: true },
  tone: { type: String, default: 'default' }, // default | rose | sage | lilac | sand | sky
  size: { type: String, default: 'md' }, // sm | md
})
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    class="g-chip"
    :class="[`tone-${tone}`, `size-${size}`, { tap: interactive, selected, disabled, 'is-static': !interactive }]"
    :type="interactive ? 'button' : undefined"
    :disabled="interactive ? disabled : undefined"
  >
    <span v-if="emoji" class="g-chip__emoji">{{ emoji }}</span>
    <span class="g-chip__label"><slot /></span>
    <span v-if="hint" class="g-chip__hint">{{ hint }}</span>
  </component>
</template>

<style scoped>
.g-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--c-surface);
  color: var(--c-ink-2);
  border-radius: var(--r-pill);
  box-shadow: inset 0 0 0 1px var(--c-line-strong);
  transition: all var(--t-fast) var(--e-out);
  font-family: var(--f-sans);
  max-width: 100%;
}
.size-md {
  height: 44px;
  padding: 0 15px;
  font-size: var(--fs-sm);
}
.size-sm {
  height: 28px;
  padding: 0 11px;
  font-size: var(--fs-caption);
}
.size-sm:not(.is-static) {
  height: 44px;
}
.g-chip__emoji {
  font-size: 14px;
  line-height: 1;
}
.g-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-chip__hint {
  color: var(--c-ink-4);
  font-size: var(--fs-micro);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.g-chip.selected {
  background: var(--c-rose);
  color: #fff;
  box-shadow: 0 4px 12px rgba(173, 112, 100, 0.24);
}
.g-chip.selected .g-chip__hint {
  color: rgba(255, 255, 255, 0.7);
}
.g-chip.disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* 只读标签态 */
.tone-rose {
  background: var(--c-rose-soft);
  color: var(--c-rose-deep);
  box-shadow: none;
}
.tone-sage {
  background: var(--c-sage-soft);
  color: var(--c-sage-deep);
  box-shadow: none;
}
.tone-lilac {
  background: var(--c-lilac-soft);
  color: var(--c-lilac-deep);
  box-shadow: none;
}
.tone-sand {
  background: var(--c-sand-soft);
  color: var(--c-sand-deep);
  box-shadow: none;
}
.tone-sky {
  background: var(--c-sky-soft);
  color: var(--c-sky-deep);
  box-shadow: none;
}
</style>
