<script setup>
defineProps({
  padding: { type: String, default: 'md' }, // none | sm | md | lg
  tone: { type: String, default: 'surface' }, // surface | paper | rose | sage | lilac | sand | sky
  elevated: { type: Boolean, default: true },
  bordered: { type: Boolean, default: false },
  radius: { type: String, default: 'lg' }, // sm | md | lg | xl
})
</script>

<template>
  <div
    class="g-card"
    :class="[`p-${padding}`, `tone-${tone}`, `r-${radius}`, { elevated, bordered }]"
  >
    <slot />
  </div>
</template>

<style scoped>
.g-card {
  position: relative;
  background: var(--c-surface);
  overflow: hidden;
}
.r-sm {
  border-radius: var(--r-sm);
}
.r-md {
  border-radius: var(--r-md);
}
.r-lg {
  border-radius: var(--r-lg);
}
.r-xl {
  border-radius: var(--r-xl);
}

.p-none {
  padding: 0;
}
.p-sm {
  padding: var(--s-3);
}
.p-md {
  padding: var(--s-4);
}
.p-lg {
  padding: var(--s-5);
}

.elevated {
  box-shadow: var(--sh-1);
}
.bordered {
  box-shadow: inset 0 0 0 1px var(--c-line);
}
.elevated.bordered {
  box-shadow: var(--sh-1), inset 0 0 0 1px var(--c-line);
}

.tone-paper {
  background: var(--c-paper-2);
}
.tone-rose {
  background: var(--c-rose-tint);
}
.tone-sage {
  background: var(--c-sage-soft);
}
.tone-lilac {
  background: var(--c-lilac-soft);
}
.tone-sand {
  background: var(--c-sand-soft);
}
.tone-sky {
  background: var(--c-sky-soft);
}
</style>
