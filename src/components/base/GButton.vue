<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | soft | ghost | outline | dark
  size: { type: String, default: 'md' }, // sm | md | lg
  block: Boolean,
  disabled: Boolean,
  loading: Boolean,
  round: { type: Boolean, default: true },
})
</script>

<template>
  <button
    class="g-btn tap"
    :class="[`g-btn--${variant}`, `g-btn--${size}`, { block, round, 'is-disabled': disabled || loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="g-btn__spin" />
    <slot />
  </button>
</template>

<style scoped>
.g-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  font-family: var(--f-sans);
  font-weight: 500;
  border-radius: var(--r-sm);
  transition: box-shadow var(--t-base) var(--e-out), background var(--t-fast), transform var(--t-fast);
  white-space: nowrap;
}
.g-btn.round {
  border-radius: var(--r-pill);
}
.g-btn.block {
  display: flex;
  width: 100%;
}
.g-btn.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 尺寸 */
.g-btn--sm {
  height: 32px;
  padding: 0 14px;
  font-size: var(--fs-caption);
}
.g-btn--md {
  height: 44px;
  padding: 0 24px;
  font-size: var(--fs-sm);
}
.g-btn--lg {
  height: 52px;
  padding: 0 32px;
  font-size: var(--fs-body);
}

/* 变体 */
.g-btn--primary {
  background: var(--g-primary);
  color: #fff;
  box-shadow: var(--sh-primary);
}
.g-btn--primary:active {
  box-shadow: 0 4px 12px rgba(173, 112, 100, 0.24);
}
.g-btn--soft {
  background: var(--c-rose-soft);
  color: var(--c-rose-deep);
}
.g-btn--outline {
  background: transparent;
  color: var(--c-ink-2);
  box-shadow: inset 0 0 0 1px var(--c-line-strong);
}
.g-btn--ghost {
  background: transparent;
  color: var(--c-ink-3);
}
.g-btn--dark {
  background: var(--c-ink);
  color: var(--c-ink-inverse);
}

.g-btn__spin {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
